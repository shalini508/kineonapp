// Retest LOG-05: log a session for YESTERDAY and check whether the day
// count now increments correctly (it was previously always attributed to
// "today" regardless of the picked date).
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');
const { openLogPastSessionForm, selectBodyPart, selectPastDate, selectDuration, submitLogSession } = require('../lib/logSession');

const DIR = 'reports/retest-2026-08-21';
const EMAIL = 's1@yopmail.com';
const PASSWORD = 'Test@2006';
// Today is 2026-08-21 -> yesterday is 2026-08-20. Month is 0-indexed for the helper.
const TODAY = { year: 2026, month: 7, day: 21 };
const YESTERDAY = { year: 2026, month: 7, day: 20 };

async function readHomeSummary(client) {
  const { source } = await dumpSource(client, DIR, 'scratch-home');
  return interactiveSummary(extractElements(source));
}

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
    await screenshot(client, DIR, 'log05-01-home-before');
    const before = await readHomeSummary(client);
    console.log('BEFORE:', before.find((e) => /Recovery Day|No recovery/.test(e.text))?.text);

    await openLogPastSessionForm(client);
    await selectBodyPart(client, 'Shoulder');
    await selectPastDate(client, YESTERDAY, TODAY.year, TODAY.month);
    await screenshot(client, DIR, 'log05-02-date-selected');
    await selectDuration(client, 10);
    await submitLogSession(client);
    await sleep(2000);

    for (let i = 0; i < 3; i++) {
      const skip = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"SKIP") or contains(@name,"SKIP")]');
      if (skip) { await client.elementClick(skip); await sleep(1000); continue; }
      const cont = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE") or contains(@name,"CONTINUE")]');
      if (cont) { await client.elementClick(cont); await sleep(1000); continue; }
      break;
    }
    await screenshot(client, DIR, 'log05-03-after-submit');
    const { source } = await dumpSource(client, DIR, 'log05-03-after-submit');
    console.log('AFTER SUBMIT SCREEN:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));

    const homeTab = await findFresh(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]');
    if (homeTab) { await client.elementClick(homeTab); await sleep(1000); }
    await screenshot(client, DIR, 'log05-04-home-after');
    const after = await readHomeSummary(client);
    console.log('AFTER:', after.find((e) => /Recovery Day|No recovery/.test(e.text))?.text);
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
