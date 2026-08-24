const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-howtoplace-2026-08-21';
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
    const reliefBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Start with RELIEF") or contains(@name,"Start with RELIEF")]');
    await client.elementClick(reliefBtn);
    await sleep(800);
    const shoulderBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Target Shoulder") or contains(@name,"Target Shoulder")]');
    await client.elementClick(shoulderBtn);
    await sleep(400);
    const cont1 = await findFresh(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]');
    await client.elementClick(cont1);
    await sleep(1000);
    const fiveMin = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"5 minutes") or contains(@name,"5 minutes")]');
    await client.elementClick(fiveMin);
    await sleep(500);
    const startSessionBtn = await findFresh(client, '//XCUIElementTypeButton[@label="START SESSION" or @name="START SESSION"]');
    await client.elementClick(startSessionBtn);
    await sleep(1200);

    const howToBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"How to place") or contains(@name,"How to place")]');
    if (howToBtn) {
      await client.elementClick(howToBtn);
      await sleep(1000);
      await screenshot(client, DIR, '04-howto-relief-shoulder');
    } else {
      console.log('No How to place button found for Relief+/Shoulder');
      await screenshot(client, DIR, '04-no-howto-relief-shoulder');
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
