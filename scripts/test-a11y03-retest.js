// Retest A11Y-03: max out iOS accessibility text size via Settings, then
// check the Kineon Home screen for clipping.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-2026-08-21';

async function main() {
  const client = await startSession({ 'appium:bundleId': 'com.apple.Preferences' });
  ensureDir(DIR);
  try {
    // Navigate via Settings' own search field -- more reliable than the
    // menu tree, and Settings preserves its last-viewed screen across
    // relaunches (unlike Kineon, which always resets to Home).
    await screenshot(client, DIR, 'a11y03-00-settings-initial');
    const { source } = await dumpSource(client, DIR, 'a11y03-00-settings-initial');
    console.log('SETTINGS INITIAL:', JSON.stringify(interactiveSummary(extractElements(source)).slice(0, 15), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
