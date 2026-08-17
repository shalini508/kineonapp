// Read-only checks for the new combined Recovery/Milestone dashboard card
// (Aug 17 build). Deliberately does NOT complete or backdate any session
// -- it only observes navigation, since this runs against a real shared
// test account whose history we don't want to alter without explicit
// sign-off.
//
// Usage: node scripts/test-milestone-dashboard.js

const path = require('path');
const fs = require('fs');
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, getTabBarLabels, tapByLabel, sleep, ensureDir } = require('../lib/actions');
const {
  isLoggedIn,
  goToLoginForm,
  setEmail,
  setPassword,
  submitLogin,
  waitForOutcome,
  dismissSavePasswordPromptIfPresent,
  findFresh,
} = require('../lib/loginActions');

const EMAIL = 's@yopmail.com';
const PASSWORD = 'Test@2006';

async function visibleTexts(client) {
  const source = await client.getPageSource();
  const elements = extractElements(source);
  return [...new Set(elements.filter((e) => e.type === 'XCUIElementTypeStaticText' && e.visible && (e.label || e.name)).map((e) => e.label || e.name))];
}

async function visibleButtons(client) {
  const source = await client.getPageSource();
  const elements = extractElements(source);
  return [...new Set(elements.filter((e) => e.type === 'XCUIElementTypeButton' && e.visible && (e.label || e.name)).map((e) => e.label || e.name))];
}

async function ensureLoggedIn(client) {
  await dismissSavePasswordPromptIfPresent(client);
  if (await isLoggedIn(client)) return;
  await goToLoginForm(client);
  await setEmail(client, EMAIL);
  await setPassword(client, PASSWORD);
  await submitLogin(client);
  await waitForOutcome(client);
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'reports', `milestone-dashboard-${stamp}`);
  ensureDir(outDir);
  const findings = [];

  console.log('Starting session...');
  const client = await startSession();

  try {
    await sleep(2000);
    await ensureLoggedIn(client);
    await sleep(1500);

    // --- 1.4/1.5: relaunch consistency + layout-shift check ---
    console.log('\n[1.4/1.5] Checking relaunch consistency & layout shift...');
    for (let i = 0; i < 2; i++) {
      await client.executeScript('mobile: terminateApp', [{ bundleId: 'io.kineon.move' }]);
      await sleep(500);
      await client.executeScript('mobile: activateApp', [{ bundleId: 'io.kineon.move' }]);
      // Rapid-fire captures right after relaunch to catch any shifting skeleton
      const frames = [];
      for (const delay of [300, 800, 1500, 2500]) {
        await sleep(delay - (frames.length ? [300, 800, 1500, 2500][frames.length - 1] : 0));
        const texts = await visibleTexts(client);
        frames.push({ atMs: delay, hasRecoveryCard: texts.some((t) => /RECOVERY DAY|MILESTONE DAY/i.test(t)) });
      }
      await screenshot(client, outDir, `relaunch-${i + 1}-final`);
      findings.push({ check: `relaunch-${i + 1}`, frames });
      console.log(`  relaunch ${i + 1}:`, JSON.stringify(frames));
    }

    // --- Capture the current dashboard state precisely ---
    const dashboardTexts = await visibleTexts(client);
    const recoveryLine = dashboardTexts.find((t) => /^\d+$/.test(t.trim())) || null;
    findings.push({ check: 'current-dashboard-state', texts: dashboardTexts });
    await screenshot(client, outDir, 'dashboard-state');
    console.log('\nCurrent dashboard-relevant text:', JSON.stringify(dashboardTexts.filter((t) => /day|milestone|recovery/i.test(t)), null, 2));

    // --- 2.7: negative check — no celebration card should show pre-Day-21 ---
    const hasCelebration = dashboardTexts.some((t) => /MILESTONE EARNED/i.test(t));
    findings.push({ check: '2.7-no-early-celebration', pass: !hasCelebration, hasCelebration });
    console.log(`\n[2.7] Celebration card shown pre-Day-21? ${hasCelebration} (expected: false) -> ${!hasCelebration ? 'PASS' : 'FAIL'}`);

    // --- 1.7: regression check on other tabs ---
    console.log('\n[1.7] Checking other tabs still render...');
    const tabs = await getTabBarLabels(client);
    for (const tab of tabs) {
      await tapByLabel(client, tab);
      await sleep(1200);
      const texts = await visibleTexts(client);
      const safeLabel = tab.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      await screenshot(client, outDir, `tab-${safeLabel}`);
      findings.push({ check: `tab-${tab}`, textCount: texts.length, sample: texts.slice(0, 5) });
      console.log(`  ${tab}: ${texts.length} visible text elements`);
    }
    await tapByLabel(client, 'Home');
    await sleep(1000);

    // --- Inspect "Start Today's Session" flow WITHOUT completing it ---
    console.log('\n[inspect] Opening "Start Today\'s Session" (will back out, not complete)...');
    const startBtn = await findFresh(client, '//XCUIElementTypeButton[@label="START TODAY\'S SESSION" or @name="START TODAY\'S SESSION"]');
    if (startBtn) {
      await client.elementClick(startBtn);
      await sleep(1500);
      const texts = await visibleTexts(client);
      const buttons = await visibleButtons(client);
      await screenshot(client, outDir, 'start-session-screen');
      findings.push({ check: 'start-session-flow', texts, buttons });
      console.log('  Screen after tapping Start Today\'s Session:');
      console.log('  texts:', JSON.stringify(texts));
      console.log('  buttons:', JSON.stringify(buttons));
    } else {
      findings.push({ check: 'start-session-flow', error: 'Button not found' });
      console.log('  "START TODAY\'S SESSION" button not found');
    }
  } finally {
    await endSession(client);
  }

  fs.writeFileSync(path.join(outDir, 'findings.json'), JSON.stringify(findings, null, 2));
  console.log(`\nReport written to: ${outDir}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
