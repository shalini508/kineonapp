const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');
const { openLogPastSessionForm } = require('../lib/logSession');

const DIR = 'reports/new-account-relief';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    await openLogPastSessionForm(client);
    const selects = await client.findElements('xpath', '//XCUIElementTypeButton[@label="Select" or @name="Select"]');
    console.log('Select buttons found:', selects.length);
    const deviceBtn = selects[0]['element-6066-11e4-a52e-4042805e5804'] || selects[0].ELEMENT;
    await client.elementClick(deviceBtn);
    await sleep(800);
    await screenshot(client, DIR, '01-device-sheet-open');
    const { source } = await dumpSource(client, DIR, '01-device-sheet-open');
    console.log('SHEET ELEMENTS:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
