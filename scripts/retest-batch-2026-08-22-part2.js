const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh, isLoggedIn } = require('../lib/loginActions');

const DIR = 'reports/retest-batch-2026-08-22';

async function tap(client, xpath, label) {
  const el = await findFresh(client, xpath);
  if (!el) { console.log(`NOT FOUND: ${label} (${xpath})`); return false; }
  await client.elementClick(el);
  return true;
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    console.log('LOGGED IN?', await isLoggedIn(client));

    // Go to Home fresh
    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab');
    await sleep(1000);
    const { source: homeSrc } = await dumpSource(client, DIR, '10-home-fresh');
    console.log('HOME (fresh):', JSON.stringify(interactiveSummary(extractElements(homeSrc)), null, 2));

    // Try tapping the streak/challenge area to find calendar
    const tapped = await tap(client, '//XCUIElementTypeButton[contains(@label,"Recovery") or contains(@name,"Recovery")]', 'Recovery/challenge card');
    if (tapped) {
      await sleep(1200);
      await screenshot(client, DIR, '11-after-recovery-tap');
      const { source } = await dumpSource(client, DIR, '11-after-recovery-tap');
      console.log('AFTER RECOVERY TAP:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
