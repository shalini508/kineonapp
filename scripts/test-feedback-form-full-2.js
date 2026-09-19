const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep, swipeUp } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');
const { tapPoint } = require('../lib/logSession');

const DIR = 'reports/retest-feedback-2026-08-21';
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
    const profileBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Open your profile") or contains(@name,"Open your profile")]');
    await client.elementClick(profileBtn);
    await sleep(1000);
    const settingsBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"SETTINGS") or contains(@name,"SETTINGS")]');
    await client.elementClick(settingsBtn);
    await sleep(1000);
    await tapPoint(client, 196, 627); // FAQ & Contact row
    await sleep(1000);

    await swipeUp(client);
    await sleep(500);
    await screenshot(client, DIR, '05-help-center-scrolled');
    const { source } = await dumpSource(client, DIR, '05-help-center-scrolled');
    console.log('SCROLLED HELP CENTER:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
