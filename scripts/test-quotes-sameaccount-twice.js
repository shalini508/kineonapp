const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, logOut, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-quotes-2026-08-22';
const EMAIL = 's@yopmail.com';
const PASSWORD = 'Test@2006';

async function getQuote(client) {
  const { source } = await dumpSource(client, DIR, 'scratch2');
  const els = interactiveSummary(extractElements(source));
  const quoteEl = els.find((e) => /^".*"$/.test(e.text) && e.text.length > 20);
  return quoteEl ? quoteEl.text : null;
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    for (let round = 1; round <= 2; round++) {
      if (await isLoggedIn(client)) { await logOut(client); await sleep(1000); }
      await goToLoginForm(client);
      await setEmail(client, EMAIL);
      await setPassword(client, PASSWORD);
      await submitLogin(client);
      await waitForOutcome(client, 8000, 500);
      await sleep(1500);
      const quote = await getQuote(client);
      console.log(`Round ${round} (same account, fresh login) quote:`, quote);
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
