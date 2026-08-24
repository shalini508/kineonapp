const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-copy-2026-08-21';
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
    const startBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"START TODAY") or contains(@name,"START TODAY")]');
    await client.elementClick(startBtn);
    await sleep(1000);
    await screenshot(client, DIR, '01-select-device');
    const { source: s0 } = await dumpSource(client, DIR, '01-select-device');
    console.log('SELECT DEVICE SCREEN:', JSON.stringify(interactiveSummary(extractElements(s0)), null, 2));

    const moveBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Start with MOVE") or contains(@name,"Start with MOVE")]');
    await client.elementClick(moveBtn);
    await sleep(800);
    const kneeBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Target Knee") or contains(@name,"Target Knee")]');
    await client.elementClick(kneeBtn);
    await sleep(400);
    const cont1 = await findFresh(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]');
    await client.elementClick(cont1);
    await sleep(1000);
    await screenshot(client, DIR, '02-duration-screen-move');
    const { source: s1 } = await dumpSource(client, DIR, '02-duration-screen-move');
    console.log('DURATION SCREEN (MOVE+):', JSON.stringify(interactiveSummary(extractElements(s1)), null, 2));

    const fiveMin = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"5 minutes") or contains(@name,"5 minutes")]');
    await client.elementClick(fiveMin);
    await sleep(500);
    const startSessionBtn = await findFresh(client, '//XCUIElementTypeButton[@label="START SESSION" or @name="START SESSION"]');
    await client.elementClick(startSessionBtn);
    await sleep(1200);
    await screenshot(client, DIR, '03-live-session-header');
    const { source: s2 } = await dumpSource(client, DIR, '03-live-session-header');
    console.log('LIVE SESSION SCREEN:', JSON.stringify(interactiveSummary(extractElements(s2)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
