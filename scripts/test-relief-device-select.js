// RELIEF-01/RELIEF-03: select Relief Plus in the Log-a-past-session
// device picker, then confirm the form shows "Relief Plus" and that no
// BLE-dependent UI (pairing/Connected badge) appears anywhere in it.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');
const { openLogPastSessionForm, tapPoint } = require('../lib/logSession');

const DIR = 'reports/new-account-relief';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    await openLogPastSessionForm(client);
    const selects = await client.findElements('xpath', '//XCUIElementTypeButton[@label="Select" or @name="Select"]');
    const deviceBtn = selects[0]['element-6066-11e4-a52e-4042805e5804'] || selects[0].ELEMENT;
    await client.elementClick(deviceBtn);
    await sleep(800);
    await screenshot(client, DIR, '10-sheet-open');

    await tapPoint(client, 150, 613); // "Relief Plus" row
    await sleep(800);
    await screenshot(client, DIR, '11-after-tap-relief');

    const { source } = await dumpSource(client, DIR, '11-after-tap-relief');
    const elements = extractElements(source);
    const summary = interactiveSummary(elements);
    console.log('FORM AFTER TAP:', JSON.stringify(summary, null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
