const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');

const DIR = 'reports/new-account-sub01';
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
    await screenshot(client, DIR, '01-profile');
    const { source } = await dumpSource(client, DIR, '01-profile');
    console.log('PROFILE:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));

    const settingsBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"SETTINGS") or contains(@name,"SETTINGS") or contains(@label,"Settings") or contains(@name,"Settings")]');
    if (settingsBtn) {
      await client.elementClick(settingsBtn);
      await sleep(1000);
      await screenshot(client, DIR, '02-settings');
      const { source: s2 } = await dumpSource(client, DIR, '02-settings');
      console.log('SETTINGS:', JSON.stringify(interactiveSummary(extractElements(s2)), null, 2));
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
