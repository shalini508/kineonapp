const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-2026-08-21';

async function main() {
  const client = await startSession({ 'appium:bundleId': 'com.apple.Preferences' });
  ensureDir(DIR);
  try {
    const searchField = await findFresh(client, '//XCUIElementTypeSearchField');
    if (!searchField) throw new Error('Search field not found on Settings root');
    await client.elementClick(searchField);
    await client.elementSendKeys(searchField, 'Larger Text');
    await sleep(1000);
    await screenshot(client, DIR, 'a11y03-01-search-results');
    const { source } = await dumpSource(client, DIR, 'a11y03-01-search-results');
    console.log('SEARCH RESULTS:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
