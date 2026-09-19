// Smoke test for the simulator build Kundan sent (io.kineon.move).
// Installed beforehand with `xcrun simctl install <udid> Kineon.app`.
//
// Covers:
//   1. App launches past the splash screen
//   2. Login with a seeded test account
//   3. Bottom tab bar is present, and every tab loads
//   4. Full session journey: start a MOVE+ knee session, run it, end it,
//      fill in the post-session check-in (pain/energy/mood) and SAVE
//   5. The saved session actually shows up in the Sessions tab
//
// Screenshots + page source are written per screen under reports/.
//
// Runs against either target:
//   physical device:  node scripts/smoke-test.js
//   simulator:        SIM_UDID=<udid> SIM_NAME="iPhone 17 Pro" SIM_OS=26.5 node scripts/smoke-test.js
// With no SIM_UDID it uses the device capabilities in config/capabilities.js.

const path = require('path');
const fs = require('fs');
const { startSession, endSession } = require('../lib/session');
const {
  screenshot,
  dumpSource,
  extractElements,
  getTabBarLabels,
  tapByLabel,
  sleep,
  ensureDir,
} = require('../lib/actions');
const {
  goToLoginForm,
  setEmail,
  setPassword,
  submitLogin,
  waitForOutcome,
  isLoggedIn,
  logOut,
  findFresh,
  dismissSavePasswordPromptIfPresent,
} = require('../lib/loginActions');
const { tapPoint } = require('../lib/logSession');

const SIM_UDID = process.env.SIM_UDID;
const SIM_NAME = process.env.SIM_NAME || 'iOS Simulator';
const SIM_OS = process.env.SIM_OS;
const TEST_EMAIL = process.env.TEST_EMAIL || 'isaacdiaz@yopmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD;
if (!TEST_PASSWORD) {
  console.error('Missing TEST_PASSWORD -- see .env.example');
  process.exit(1);
}
// Which timer preset to run. The session must run to completion to be
// stored as status="completed" -- ending early via END SESSION -> "End &
// Log" persists it as status="abandoned", which the Session Log filters
// out and which doesn't count toward TOTAL TIME (verified against the API).
// So the default is the shortest preset, run all the way through.
const DURATION_MINUTES = parseInt(process.env.DURATION_MINUTES || '5', 10);
// Safety margin over the timer before we give up waiting for the check-in.
const COMPLETION_TIMEOUT_MS = DURATION_MINUTES * 60 * 1000 + 90000;
const BODY_PART = process.env.BODY_PART || 'Knee';

const TARGET = SIM_UDID ? SIM_NAME : 'physical device';

async function tap(client, xpath, what) {
  const el = await findFresh(client, xpath);
  if (!el) return false;
  await client.elementClick(el);
  return true;
}

async function getTabBarWithRetry(client, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    await dismissSavePasswordPromptIfPresent(client);
    const labels = await getTabBarLabels(client);
    if (labels.length > 0) return labels;
    await sleep(1500);
  }
  return [];
}

async function visibleTexts(client) {
  const source = await client.getPageSource();
  return extractElements(source)
    .filter((e) => e.visible && (e.label || e.name))
    .map((e) => e.label || e.name);
}

// Drags from near the top of the sheet to the bottom of the screen -- the
// standard iOS gesture for dismissing a bottom sheet.
async function swipeSheetDown(client, width, height) {
  await client.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: Math.round(width * 0.5), y: Math.round(height * 0.2) },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 150 },
        { type: 'pointerMove', duration: 500, x: Math.round(width * 0.5), y: Math.round(height * 0.95) },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
  await client.releaseActions();
}

async function dismissFirstRunOverlays(client, width, height) {
  const source = await client.getPageSource();
  // Match on "Skip placement guide", which only exists inside the sheet's
  // merged label -- NOT on "How to place your", which also matches the
  // "How to place your device" help button that sits on the session screen
  // (tapping blind there lands on END SESSION and kills the session).
  //
  // The sheet is a single merged accessibility element, so neither its X nor
  // its CLOSE button can be targeted by label. On short screens (375x667 --
  // iPhone SE / 8 / 7 / 6s) the sheet is taller than the display and CLOSE is
  // off-screen entirely, so a coordinate tap at a fixed proportion can't work
  // across device sizes. Swipe it away instead, then fall back to tapping
  // where CLOSE sits on taller screens.
  if (source.includes('Skip placement guide')) {
    // The X sits at roughly 90% across / 22% down on every size measured
    // (375x667 -> ~339,141 and 402x874 -> ~365,202), and both land inside the
    // 44pt touch target. Unlike CLOSE, it is always on screen.
    await tapPoint(client, Math.round(width * 0.905), Math.round(height * 0.22));
    await sleep(1500);
    if ((await client.getPageSource()).includes('Skip placement guide')) {
      // Taller screens also expose CLOSE at the bottom of the sheet.
      await tapPoint(client, Math.round(width * 0.5), Math.round(height * 0.936));
      await sleep(1500);
    }
    if ((await client.getPageSource()).includes('Skip placement guide')) {
      await swipeSheetDown(client, width, height);
      await sleep(1500);
    }
  }
  if (await tap(client, '//XCUIElementTypeButton[@label="GOT IT" or @name="GOT IT"]', 'GOT IT')) {
    await sleep(1200);
  }
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'reports', `smoke-sim-${stamp}`);
  ensureDir(outDir);

  const results = { device: TARGET, udid: SIM_UDID || null, timestamp: stamp, checks: [] };
  const record = (step, pass, extra = {}) => {
    results.checks.push({ step, pass, ...extra });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${step}${extra.note ? ` -- ${extra.note}` : ''}`);
  };

  console.log(`Starting session on ${TARGET}${SIM_UDID ? ` (${SIM_UDID})` : ''}...\n`);
  const client = await startSession({
    // Simulator needs its own udid and no WDA signing; on the physical
    // device we keep whatever config/capabilities.js already provides.
    ...(SIM_UDID
      ? {
          'appium:udid': SIM_UDID,
          'appium:deviceName': SIM_NAME,
          ...(SIM_OS ? { 'appium:platformVersion': SIM_OS } : {}),
          'appium:usePrebuiltWDA': false,
        }
      : {}),
    'appium:autoAcceptAlerts': true, // iOS notification-permission prompt fires mid-session
  });

  try {
    // --- 1. Launch ---
    await sleep(4000);
    await screenshot(client, outDir, '00-launch');
    const { source: launchSource } = await dumpSource(client, outDir, '00-launch');
    const launchElements = extractElements(launchSource);
    record('app launches', launchElements.length > 0, { note: `${launchElements.length} elements` });

    // --- 2. Login ---
    // Sign out first if a session already exists. isLoggedIn() only proves
    // *someone* is signed in, not who -- on a shared test device that meant
    // a run once executed as a different account than the one being verified.
    if (await isLoggedIn(client)) {
      console.log('  existing session found -- signing out first');
      await logOut(client);
      await sleep(2000);
    }
    await goToLoginForm(client);
    await setEmail(client, TEST_EMAIL);
    await setPassword(client, TEST_PASSWORD);
    await submitLogin(client);
    const outcome = await waitForOutcome(client, 12000, 500);
    await sleep(1500);
    await screenshot(client, outDir, '01-post-login');
    record('login', outcome.loggedIn, { note: TEST_EMAIL });
    if (!outcome.loggedIn) throw new Error('Login failed -- cannot continue');

    const { width, height } = await client.getWindowRect();

    // --- 3. Tab bar + every tab ---
    // iOS's "Save Password?" keychain sheet pops up shortly after a login
    // with new credentials and covers the app's whole accessibility tree,
    // so the tab bar reads as empty until it's dismissed. It can land a
    // beat later on slower device profiles -- dismiss and retry.
    const tabLabels = await getTabBarWithRetry(client);
    record('tab bar present', tabLabels.length > 0, { tabs: tabLabels });
    for (let i = 0; i < tabLabels.length; i++) {
      const label = tabLabels[i];
      const safe = (label || `tab-${i}`).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      let ok = false;
      try {
        await tapByLabel(client, label);
        await sleep(1500);
        await screenshot(client, outDir, `02-tab-${safe}`);
        const dump = await dumpSource(client, outDir, `02-tab-${safe}`);
        ok = extractElements(dump.source).length > 0;
      } catch (err) {
        // leave ok = false
      }
      record(`tab loads: ${label}`, ok);
    }

    // --- 3b. QA debug panel (internal review-prompt tooling) ---
    // Surfaces the in-app review prompt gating that previously couldn't be
    // inspected from outside the app. Smoke level only: does it open, does it
    // report the gates, does it close again.
    await tapByLabel(client, 'Home');
    await sleep(1200);
    const qaOpened = await tap(client, '//XCUIElementTypeButton[contains(@label,"QA debug") or contains(@name,"QA debug")]', 'QA panel');
    await sleep(2000);
    if (qaOpened) {
      await screenshot(client, outDir, '02b-qa-panel');
      const qaTexts = await visibleTexts(client);
      const joined = qaTexts.join(' | ');
      results.qaPanel = [...new Set(qaTexts)];
      record('QA panel opens', /QA · INTERNAL|QA · INTERNAL/i.test(joined) || qaTexts.some((t) => /QA/.test(t)));
      record('QA panel reports a gate verdict', /Gate verdict/i.test(joined));
      record('QA panel shows review-prompt gates', ['INSTALL AGE GATE', 'COOLDOWN GATE', 'ANNUAL CAP'].every((g) => joined.includes(g)));
      const closed = await tap(client, '//XCUIElementTypeButton[contains(@label,"Close QA") or contains(@name,"Close QA")]', 'close QA panel');
      await sleep(1500);
      record('QA panel closes', closed && (await getTabBarWithRetry(client)).length > 0);
    } else {
      record('QA panel opens', false, { note: 'no QA debug button found on Home' });
    }

    // --- 4. Baseline: what the Sessions tab shows before we log anything ---
    await tapByLabel(client, 'Sessions');
    await sleep(1800);
    await screenshot(client, outDir, '03-sessions-before');
    const beforeTexts = await visibleTexts(client);
    const beforeTotal = beforeTexts.find((t) => /^\d+\s*Min$/i.test(t)) || 'unknown';
    const beforeDetailButtons = beforeTexts.filter((t) => /^View .* session details$/.test(t)).length;
    console.log(`\n  baseline: TOTAL TIME = ${beforeTotal}, ${beforeDetailButtons} session row(s)\n`);

    // --- 5. Full session journey ---
    await tapByLabel(client, 'Home');
    await sleep(1500);

    const started = await tap(client, '//XCUIElementTypeButton[contains(@label,"START TODAY") or contains(@name,"START TODAY")]', 'start');
    await sleep(1800);
    record('open new-session flow', started);

    const pickedDevice = await tap(client, '//XCUIElementTypeButton[contains(@label,"Start with MOVE") or contains(@name,"Start with MOVE")]', 'MOVE+');
    await sleep(1800);
    record('pick device: MOVE+', pickedDevice);

    await tap(client, `//XCUIElementTypeButton[contains(@label,"Target ${BODY_PART}") or contains(@name,"Target ${BODY_PART}")]`, BODY_PART);
    await sleep(900);
    const continued = await tap(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]', 'CONTINUE');
    await sleep(2500);
    record(`pick body part: ${BODY_PART}`, continued);

    await dismissFirstRunOverlays(client, width, height);

    const pickedDuration = await tap(
      client,
      `//XCUIElementTypeButton[contains(@label,"Set duration to ${DURATION_MINUTES} minutes")]`,
      `${DURATION_MINUTES} min`
    );
    await sleep(900);
    await screenshot(client, outDir, '04-duration-set');
    record(`set duration: ${DURATION_MINUTES} minutes`, pickedDuration);

    const t0 = Date.now();
    const sessionStarted = await tap(client, '//XCUIElementTypeButton[@label="START SESSION" or @name="START SESSION"]', 'START SESSION');
    await sleep(3000);
    await dismissFirstRunOverlays(client, width, height);
    await screenshot(client, outDir, '05-session-running');
    const runningTexts = await visibleTexts(client);
    record('session starts', sessionStarted && runningTexts.some((t) => /Session in Progress/i.test(t)));

    // Let the timer run all the way out. When it finishes, the app moves
    // itself to the post-session check-in -- poll for that rather than
    // ending the session early.
    console.log(`  running the full ${DURATION_MINUTES} min so it completes...`);
    let onCheckIn = false;
    while (Date.now() - t0 < COMPLETION_TIMEOUT_MS) {
      await sleep(15000);
      const texts = await visibleTexts(client);
      if (texts.some((t) => /POST-SESSION LOG|How does it feel/i.test(t))) {
        onCheckIn = true;
        break;
      }
      const remaining = texts.find((t) => /^\d+:\d{2}$/.test(t));
      if (remaining) console.log(`    ${remaining} remaining`);
    }
    const ranSeconds = Math.round((Date.now() - t0) / 1000);
    console.log(`  session ran ${ranSeconds}s\n`);
    record('session runs to completion', onCheckIn, { note: `${ranSeconds}s elapsed` });

    // --- 6. Post-session check-in, then SAVE ---
    await screenshot(client, outDir, '07-post-session-log');
    record('post-session check-in appears', onCheckIn);

    const scored = { pain: false, energy: false, mood: false };
    scored.pain = await tap(client, '//XCUIElementTypeButton[@label="Pain 3" or @name="Pain 3"]', 'Pain 3');
    await sleep(400);
    scored.energy = await tap(client, '//XCUIElementTypeButton[@label="Energy 8" or @name="Energy 8"]', 'Energy 8');
    await sleep(400);
    scored.mood = await tap(client, '//XCUIElementTypeButton[@label="Mood 8" or @name="Mood 8"]', 'Mood 8');
    await sleep(600);
    await screenshot(client, outDir, '08-check-in-filled');
    record('fill check-in (pain 3 / energy 8 / mood 8)', scored.pain && scored.energy && scored.mood);

    const saved = await tap(client, '//XCUIElementTypeButton[@label="SAVE" or @name="SAVE"]', 'SAVE');
    await sleep(4000);
    await screenshot(client, outDir, '09-after-save');
    record('save session', saved);

    // A "Session Logged" reward screen can sit between save and the dashboard
    await tap(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE TO DASHBOARD") or contains(@name,"CONTINUE TO DASHBOARD")]', 'CONTINUE TO DASHBOARD');
    await sleep(2500);
    await tap(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]', 'CONTINUE');
    await sleep(2000);

    // --- 7. Verify it was actually recorded ---
    await tapByLabel(client, 'Sessions');
    await sleep(2500);
    await screenshot(client, outDir, '10-sessions-after');
    await dumpSource(client, outDir, '10-sessions-after');
    const afterTexts = await visibleTexts(client);
    const afterTotal = afterTexts.find((t) => /^\d+\s*Min$/i.test(t)) || 'unknown';
    const afterDetailButtons = afterTexts.filter((t) => /^View .* session details$/.test(t)).length;
    const hasBodyPartRow = afterTexts.some((t) => new RegExp(`View ${BODY_PART} session details`, 'i').test(t));

    record('session appears in Sessions tab', afterDetailButtons > beforeDetailButtons || hasBodyPartRow, {
      note: `rows ${beforeDetailButtons} -> ${afterDetailButtons}, total time ${beforeTotal} -> ${afterTotal}`,
    });
    results.totalTimeBefore = beforeTotal;
    results.totalTimeAfter = afterTotal;
    results.sessionRowsBefore = beforeDetailButtons;
    results.sessionRowsAfter = afterDetailButtons;
  } finally {
    await endSession(client);
  }

  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
  const failed = results.checks.filter((c) => !c.pass);
  console.log(`\n${results.checks.length - failed.length}/${results.checks.length} checks passed.`);
  if (failed.length) console.log('Failed:', failed.map((f) => f.step).join(', '));
  console.log(`Report: ${outDir}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exitCode = 1;
});
