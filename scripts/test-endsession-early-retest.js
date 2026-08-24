const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-endsession-2026-08-21';
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
    const moveBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Start with MOVE") or contains(@name,"Start with MOVE")]');
    await client.elementClick(moveBtn);
    await sleep(800);
    const kneeBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Target Knee") or contains(@name,"Target Knee")]');
    await client.elementClick(kneeBtn);
    await sleep(400);
    const cont1 = await findFresh(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]');
    await client.elementClick(cont1);
    await sleep(1000);

    // Duration screen -- check state BEFORE tapping START SESSION.
    await screenshot(client, DIR, '01-duration-screen-before-start');
    const { source: s1 } = await dumpSource(client, DIR, '01-duration-screen-before-start');
    console.log('DURATION SCREEN (before START SESSION):', JSON.stringify(interactiveSummary(extractElements(s1)), null, 2));

    const fiveMin = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"5 minutes") or contains(@name,"5 minutes")]');
    if (fiveMin) { await client.elementClick(fiveMin); await sleep(500); }
    await screenshot(client, DIR, '02-after-selecting-5min-before-start');
    const { source: s2 } = await dumpSource(client, DIR, '02-after-selecting-5min-before-start');
    console.log('AFTER SELECTING 5 MIN (before START SESSION):', JSON.stringify(interactiveSummary(extractElements(s2)), null, 2));

    const startSessionBtn = await findFresh(client, '//XCUIElementTypeButton[@label="START SESSION" or @name="START SESSION"]');
    await client.elementClick(startSessionBtn);
    // Capture IMMEDIATELY, minimal delay, to catch any 0:00/Play transient state.
    await sleep(150);
    await screenshot(client, DIR, '03-immediately-after-start-tap');
    const { source: s3 } = await dumpSource(client, DIR, '03-immediately-after-start-tap');
    console.log('IMMEDIATELY AFTER START SESSION TAP:', JSON.stringify(interactiveSummary(extractElements(s3)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
