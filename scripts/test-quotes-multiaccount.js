// Retest dashboard motivational quotes with 2 accounts on the same
// device. The feature spec is device-level (AsyncStorage cache + 7-day
// exclusion ring, no server-side per-user sync) -- so switching accounts
// on the same device should NOT reset or duplicate the rotation state.
// Compare what quote each account sees on the same day/session.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, logOut, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-quotes-2026-08-22';
const ACCOUNTS = [
  { email: 's@yopmail.com', password: 'Test@2006', label: 'account-A (s)' },
  { email: 's1@yopmail.com', password: 'Test@2006', label: 'account-B (s1)' },
];

async function getQuote(client) {
  const { source } = await dumpSource(client, DIR, 'scratch');
  const els = interactiveSummary(extractElements(source));
  // The quote is the long quoted static text on Home.
  const quoteEl = els.find((e) => /^".*"$/.test(e.text) && e.text.length > 20);
  return quoteEl ? quoteEl.text : null;
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  const results = [];
  try {
    for (const acct of ACCOUNTS) {
      if (await isLoggedIn(client)) { await logOut(client); await sleep(1000); }
      await goToLoginForm(client);
      await setEmail(client, acct.email);
      await setPassword(client, acct.password);
      await submitLogin(client);
      const outcome = await waitForOutcome(client, 8000, 500);
      await sleep(1500);
      if (!outcome.loggedIn) {
        console.log(`${acct.label}: login did not complete cleanly, outcome=`, JSON.stringify(outcome));
        continue;
      }
      await screenshot(client, DIR, `quote-${acct.label.replace(/[^a-z0-9-]/gi, '_')}`);
      const quote = await getQuote(client);
      console.log(`${acct.label} (${acct.email}) quote:`, quote);
      results.push({ ...acct, quote });
    }
  } finally {
    await endSession(client);
  }
  console.log('SUMMARY:', JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
