const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { isLoggedIn, logOut, findFresh } = require('../lib/loginActions');

const DIR = 'reports/onboarding-fresh';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (await isLoggedIn(client)) { await logOut(client); await sleep(1000); }
    await screenshot(client, DIR, '00-welcome');
    const { source } = await dumpSource(client, DIR, '00-welcome');
    console.log('WELCOME:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));

    const signupBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"DON\'T HAVE") or contains(@name,"DON\'T HAVE")]');
    if (signupBtn) {
      await client.elementClick(signupBtn);
      await sleep(1200);
      await screenshot(client, DIR, '01-signup-form');
      const { source: s2 } = await dumpSource(client, DIR, '01-signup-form');
      console.log('SIGNUP FORM:', JSON.stringify(interactiveSummary(extractElements(s2)), null, 2));
    } else {
      console.log('No signup button found on welcome screen');
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
