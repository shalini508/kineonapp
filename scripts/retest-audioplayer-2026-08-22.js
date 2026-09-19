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

    // Close any open modal first
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Close") or contains(@name,"Close") or @label="X" or @name="X"]', 'close modal (if present)');
    await sleep(500);

    // Go Home, play the "Today's Meditation" (Body Scan) track directly
    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab');
    await sleep(1000);
    const playedFromHome = await tap(client, '//XCUIElementTypeButton[contains(@label,"Play Body Scan") or contains(@name,"Play Body Scan")]', 'Play Body Scan (Home)');
    await sleep(2000);
    await screenshot(client, DIR, '20-after-play-tap');
    const { source: s0 } = await dumpSource(client, DIR, '20-after-play-tap');
    console.log('AFTER PLAY TAP:', JSON.stringify(interactiveSummary(extractElements(s0)), null, 2));

    // Navigate to Learn tab -- mini player should persist
    await tap(client, '//XCUIElementTypeButton[@label="Learn" or @name="Learn"]', 'Learn tab');
    await sleep(1200);
    await screenshot(client, DIR, '21-learn-tab-with-player');
    const { source: s1 } = await dumpSource(client, DIR, '21-learn-tab-with-player');
    console.log('LEARN TAB (checking for mini player):', JSON.stringify(interactiveSummary(extractElements(s1)), null, 2));

    // Navigate to Shop tab -- mini player should still persist
    await tap(client, '//XCUIElementTypeButton[@label="Shop" or @name="Shop"]', 'Shop tab');
    await sleep(1200);
    await screenshot(client, DIR, '22-shop-tab-with-player');
    const { source: s2 } = await dumpSource(client, DIR, '22-shop-tab-with-player');
    console.log('SHOP TAB (checking for mini player):', JSON.stringify(interactiveSummary(extractElements(s2)), null, 2));

    // Back to home, try pause/stop controls on mini player
    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab (return)');
    await sleep(1000);
    await screenshot(client, DIR, '23-home-with-player');
    const { source: s3 } = await dumpSource(client, DIR, '23-home-with-player');
    console.log('HOME TAB AGAIN (checking for mini player):', JSON.stringify(interactiveSummary(extractElements(s3)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
