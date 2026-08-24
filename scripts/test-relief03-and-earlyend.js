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
    const startBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"START TODAY") or contains(@name,"START TODAY")]');
    await client.elementClick(startBtn);
    await sleep(1200);

    const reliefBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Start with RELIEF") or contains(@name,"Start with RELIEF")]');
    await client.elementClick(reliefBtn);
    await sleep(1000);

    const kneeBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Target Knee") or contains(@name,"Target Knee")]');
    await client.elementClick(kneeBtn);
    await sleep(400);
    const continueBtn1 = await findFresh(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]');
    await client.elementClick(continueBtn1);
    await sleep(1000);
    await screenshot(client, DIR, 'relief03-02-duration-screen');
    const { source: s1 } = await dumpSource(client, DIR, 'relief03-02-duration-screen');
    console.log('DURATION SCREEN:', JSON.stringify(interactiveSummary(extractElements(s1)), null, 2));

    // Pick the shortest duration (5 min) so the early-end test doesn't take long.
    const fiveMin = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"5 min") or contains(@name,"5 min")] | //XCUIElementTypeOther[contains(@label,"5 min") or contains(@name,"5 min")]');
    if (fiveMin) { await client.elementClick(fiveMin); await sleep(500); }
    const continueBtn2 = await findFresh(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE" or contains(@label,"START") or contains(@name,"START")]');
    if (continueBtn2) { await client.elementClick(continueBtn2); await sleep(1500); }
    await screenshot(client, DIR, 'relief03-03-after-duration-continue');
    const { source: s2 } = await dumpSource(client, DIR, 'relief03-03-after-duration-continue');
    console.log('AFTER DURATION CONTINUE:', JSON.stringify(interactiveSummary(extractElements(s2)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
