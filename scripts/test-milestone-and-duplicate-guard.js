// MILE-10 (day counter increments 0 -> 1 on a fresh account) and
// LOG-06 (double-tapping LOG SESSION doesn't create two records),
// run together since MILE-10's baseline read is a natural byproduct
// of setting up LOG-06's test session.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');
const {
  openLogPastSessionForm,
  selectBodyPart,
  selectDuration,
} = require('../lib/logSession');

const DIR = 'reports/new-account-milestone';

async function readHomeSummary(client) {
  const { source } = await dumpSource(client, DIR, 'scratch');
  return interactiveSummary(extractElements(source));
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    await screenshot(client, DIR, '01-home-before');
    const before = await readHomeSummary(client);
    console.log('BEFORE:', before.find((e) => /Recovery Day|No recovery/.test(e.text))?.text);

    // Fill the manual-log form for today's date (device left at default Move Plus).
    await openLogPastSessionForm(client);
    await selectBodyPart(client, 'Knee');
    await selectDuration(client, 15);
    await screenshot(client, DIR, '02-form-filled-before-double-tap');

    // LOG-06: double-tap LOG SESSION in quick succession, no delay between taps.
    const btn = await findFresh(client, '//XCUIElementTypeButton[@label="LOG SESSION" or @name="LOG SESSION"]');
    if (!btn) throw new Error('LOG SESSION button not found');
    await client.elementClick(btn);
    const btn2 = await findFresh(client, '//XCUIElementTypeButton[@label="LOG SESSION" or @name="LOG SESSION"]');
    if (btn2) await client.elementClick(btn2); // fires immediately, before the first tap's navigation settles
    await sleep(2500);

    // Skip / dismiss whatever check-in or reward screen appears.
    for (let i = 0; i < 3; i++) {
      const skip = await findFresh(client, '//XCUIElementTypeButton[@label="SKIP" or @name="SKIP"]');
      if (skip) { await client.elementClick(skip); await sleep(1000); continue; }
      const cont = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE") or contains(@name,"CONTINUE")]');
      if (cont) { await client.elementClick(cont); await sleep(1000); continue; }
      break;
    }
    await screenshot(client, DIR, '03-after-double-tap-submit');

    // Go to Sessions tab to count how many "Knee" entries exist for today.
    const sessionsTab = await findFresh(client, '//XCUIElementTypeButton[@label="Sessions" or @name="Sessions"]');
    await client.elementClick(sessionsTab);
    await sleep(1200);
    await screenshot(client, DIR, '04-session-log-after');
    const { source } = await dumpSource(client, DIR, '04-session-log-after');
    const elements = extractElements(source);
    console.log('SESSION LOG SCREEN:', JSON.stringify(interactiveSummary(elements), null, 2));

    // Go to Home/Profile to re-check day count.
    const homeTab = await findFresh(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]');
    await client.elementClick(homeTab);
    await sleep(1000);
    await screenshot(client, DIR, '05-home-after');
    const after = await readHomeSummary(client);
    console.log('AFTER:', after.find((e) => /Recovery Day|No recovery/.test(e.text))?.text);
  } finally {
    await endSession(client);
  }
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
