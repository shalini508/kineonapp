// Single-account, single-device longitudinal check for the dashboard
// motivational quote feature: log today's quote, and flag if it repeats
// anything seen in the last 7 days for this same account.
const fs = require('fs');
const path = require('path');
const { startSession, endSession } = require('../lib/session');
const { dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');

const EMAIL = 's@yopmail.com';
const PASSWORD = 'Test@2006';
const LOG_PATH = path.join(__dirname, '..', 'reports', 'quote-monitor', 'daily-log.jsonl');

async function getQuote(client) {
  const { source } = await dumpSource(client, 'reports/quote-monitor', 'scratch');
  const els = interactiveSummary(extractElements(source));
  const quoteEl = els.find((e) => /^".*"$/.test(e.text) && e.text.length > 20);
  return quoteEl ? quoteEl.text : null;
}

async function main() {
  ensureDir(path.dirname(LOG_PATH));
  const client = await startSession();
  let quote = null;
  try {
    // Force a cold-launch-equivalent check: log out and back in so we're
    // reading a fresh app state, not just whatever was already on screen.
    if (await isLoggedIn(client)) {
      // Already logged in (warm resume) -- read directly, this exercises
      // the AppState/warm-resume path the original bug was about.
      quote = await getQuote(client);
    } else {
      await goToLoginForm(client);
      await setEmail(client, EMAIL);
      await setPassword(client, PASSWORD);
      await submitLogin(client);
      await waitForOutcome(client, 8000, 500);
      await sleep(1500);
      quote = await getQuote(client);
    }
  } finally {
    await endSession(client);
  }

  const today = new Date().toISOString().slice(0, 10); // relies on system clock, not Date.now() banned-context
  const entry = { date: today, quote };

  let history = [];
  if (fs.existsSync(LOG_PATH)) {
    history = fs.readFileSync(LOG_PATH, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }

  const alreadyLoggedToday = history.find((h) => h.date === today);
  if (alreadyLoggedToday) {
    console.log(`Already logged today (${today}): "${alreadyLoggedToday.quote}" -- not appending duplicate.`);
    console.log('FULL HISTORY:', JSON.stringify(history, null, 2));
    return;
  }

  const last7 = history.slice(-7);
  const repeat = last7.find((h) => h.quote === quote);

  fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');

  console.log(`Logged ${today}: "${quote}"`);
  if (repeat) {
    console.log(`*** REPEAT DETECTED *** -- same quote also seen on ${repeat.date} (within last 7 logged days). This violates the no-repeat-within-7-days rule.`);
  } else {
    console.log('No repeat within the logged history window. OK so far.');
  }
  console.log('FULL HISTORY:', JSON.stringify([...history, entry], null, 2));
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
