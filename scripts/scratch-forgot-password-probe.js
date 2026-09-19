const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, isLoggedIn, logOut } = require('../lib/loginActions');

const DIR = 'reports/new-account-auth13';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (await isLoggedIn(client)) {
      await logOut(client);
      await sleep(1000);
    }
    await goToLoginForm(client);
    await screenshot(client, DIR, '01-login-form');
    const { source } = await dumpSource(client, DIR, '01-login-form');
    console.log(JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
