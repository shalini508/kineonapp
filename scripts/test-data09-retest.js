// Retest DATA-09: start a live 5-min MOVE+ session, let the timer run to
// full natural completion, then close the app AT the post-session
// check-in screen (never tapping Save/Skip), and check whether the
// session is now recorded or still silently lost.
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

    // Baseline: Session Log TOTAL TIME before.
    const sessionsTab = await findFresh(client, '//XCUIElementTypeButton[@label="Sessions" or @name="Sessions"]');
    await client.elementClick(sessionsTab);
    await sleep(1000);
    await screenshot(client, DIR, 'data09-00-before-total-time');
    const { source: sBefore } = await dumpSource(client, DIR, 'data09-00-before-total-time');
    const before = interactiveSummary(extractElements(sBefore));
    console.log('BEFORE TOTAL TIME row:', JSON.stringify(before.find((e) => /Min$/.test(e.text))));

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
    await screenshot(client, DIR, 'data09-01-session-started');
    console.log('Session started, waiting ~5.5 minutes for natural completion...');
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
