// Precise DATA-09 retest: start a live 5-min session, hold ONE continuous
// WebDriver connection while polling for the "How does it feel?" check-in
// screen (natural timer completion, not an interruption), then disconnect
// (terminating the app) AT that screen without tapping Save/Skip.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-2026-08-21';
const EMAIL = 's1@yopmail.com';
const PASSWORD = 'Test@2006';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (!(await isLoggedIn(client))) {
      await goToLoginForm(client);
      await setEmail(client, EMAIL);
      await setPassword(client, PASSWORD);
      await submitLogin(client);
      await waitForOutcome(client, 8000, 500);
      await sleep(1000);
    }

    const sessionsTab = await findFresh(client, '//XCUIElementTypeButton[@label="Sessions" or @name="Sessions"]');
    await client.elementClick(sessionsTab);
    await sleep(1000);
    const { source: sBefore } = await dumpSource(client, DIR, 'precise-00-before');
    const before = interactiveSummary(extractElements(sBefore));
    console.log('BEFORE TOTAL TIME:', JSON.stringify(before.find((e) => /Min$/.test(e.text))));

    const homeTab = await findFresh(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]');
    await client.elementClick(homeTab);
    await sleep(800);
    const startBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"START TODAY") or contains(@name,"START TODAY")]');
    await client.elementClick(startBtn);
    await sleep(1000);
    const moveBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Start with MOVE") or contains(@name,"Start with MOVE")]');
    await client.elementClick(moveBtn);
    await sleep(800);
    const kneeBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Target Knee") or contains(@name,"Target Knee")]');
    await client.elementClick(kneeBtn);
    await sleep(400);
    const cont1 = await findFresh(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]');
    await client.elementClick(cont1);
    await sleep(1000);
    const fiveMin = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"5 minutes") or contains(@name,"5 minutes")]');
    if (fiveMin) { await client.elementClick(fiveMin); await sleep(500); }
    const startSessionBtn = await findFresh(client, '//XCUIElementTypeButton[@label="START SESSION" or @name="START SESSION"]');
    await client.elementClick(startSessionBtn);
    await sleep(1500);
    console.log('Session started -- polling every 30s (holding one connection) for the check-in screen...');

    let found = false;
    for (let i = 0; i < 14; i++) { // up to 7 minutes
      await sleep(30000);
      const { source } = await dumpSource(client, DIR, `precise-poll-${i}`);
      const texts = interactiveSummary(extractElements(source)).map((e) => e.text).join(' | ');
      console.log(`poll ${i} (t+${(i + 1) * 30}s):`, texts.slice(0, 200));
      if (/How does it feel/.test(texts)) { found = true; break; }
    }

    if (found) {
      console.log('Reached check-in screen -- disconnecting now WITHOUT tapping Save/Skip.');
      await screenshot(client, DIR, 'precise-01-checkin-screen');
    } else {
      console.log('Never reached check-in screen within the poll window.');
      await screenshot(client, DIR, 'precise-01-timeout-state');
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
