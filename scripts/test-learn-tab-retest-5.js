const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-learn-2026-08-21';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    const learnTab = await findFresh(client, '//XCUIElementTypeButton[@label="Learn" or @name="Learn"]');
    await client.elementClick(learnTab);
    await sleep(1200);

    const matches = await client.findElements('xpath', '//*[contains(@label,"Why Red Light Works") or contains(@name,"Why Red Light Works")]');
    console.log('Elements matching "Why Red Light Works":', matches.length);
    for (const m of matches) {
      const id = m['element-6066-11e4-a52e-4042805e5804'] || m.ELEMENT;
      const type = await client.getElementAttribute(id, 'elementType').catch(() => 'unknown');
      const rect = await client.getElementRect(id).catch(() => null);
      console.log('  match:', JSON.stringify({ type, rect }));
    }
    await screenshot(client, DIR, '06-before-precise-tap');
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
