const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-meditations-2026-08-22';
const EMAIL = 's@yopmail.com';
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
    const learnTab = await findFresh(client, '//XCUIElementTypeButton[@label="Learn" or @name="Learn"]');
    await client.elementClick(learnTab);
    await sleep(1200);
    await screenshot(client, DIR, '01-learn-tab');

    const openLibraryBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Open Meditation Library") or contains(@name,"Open Meditation Library")]');
    if (!openLibraryBtn) {
      console.log('Open Meditation Library button not found on Learn tab');
      const { source } = await dumpSource(client, DIR, '01-learn-tab');
      console.log(JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
      return;
    }
    await client.elementClick(openLibraryBtn);
    await sleep(1200);
    await screenshot(client, DIR, '02-meditation-library');
    const { source } = await dumpSource(client, DIR, '02-meditation-library');
    console.log('MEDITATION LIBRARY:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
