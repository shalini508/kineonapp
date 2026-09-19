// One-off exploration: log in with the fresh test account and see what
// screen we land on (onboarding vs. Home), to plan ONB-01/04/05 etc.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, logOut } = require('../lib/loginActions');

const EMAIL = 's1@yopmail.com';
const PASSWORD = 'Test@2006';

async function main() {
  const client = await startSession();
  const dir = 'reports/new-account-explore';
  ensureDir(dir);
  try {
    if (await isLoggedIn(client)) {
      console.log('Currently logged in as another account — logging out first.');
      await logOut(client);
      await sleep(1000);
    }
    await goToLoginForm(client);
    await setEmail(client, EMAIL);
    await setPassword(client, PASSWORD);
    await submitLogin(client);
    const outcome = await waitForOutcome(client, 8000, 500);
    console.log('Login outcome (loggedIn/onLoginForm):', outcome);
    await sleep(1500);
    await screenshot(client, dir, '01-after-login');
    const { source } = await dumpSource(client, dir, '01-after-login');
    const elements = extractElements(source);
    const summary = interactiveSummary(elements);
    console.log('Screen contents:', JSON.stringify(summary, null, 2));
  } finally {
    await endSession(client);
  }
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
