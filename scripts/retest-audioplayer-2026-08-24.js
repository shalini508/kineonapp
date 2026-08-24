const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh, isLoggedIn } = require('../lib/loginActions');

const DIR = 'reports/retest-2026-08-24-mini-player';

async function tap(client, xpath, label) {
  const el = await findFresh(client, xpath);
  if (!el) { console.log(`NOT FOUND: ${label} (${xpath})`); return false; }
  await client.elementClick(el);
  return true;
}

function miniPlayerRelated(els) {
  return els.filter((e) => /now playing|play|pause|close/i.test(e.text || '') && e.rect[1] > 600);
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    await sleep(1500);
    console.log('LOGGED IN?', await isLoggedIn(client));

    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab');
    await sleep(1000);

    const played = await tap(client, '//XCUIElementTypeButton[contains(@label,"Play Body Scan") or contains(@name,"Play Body Scan")]', 'Play Body Scan (Home)');
    console.log('Tapped play:', played);
    await sleep(2000);
    await screenshot(client, DIR, '10-after-play-tap');

    const wentBack = await tap(client, '//XCUIElementTypeButton[contains(@label,"Go back") or contains(@name,"Go back")]', 'Go back');
    console.log('Tapped go back:', wentBack);
    await sleep(1200);

    // 1. Check overlap on Home
    let { source } = await dumpSource(client, DIR, '11-home-with-player');
    let els = interactiveSummary(extractElements(source));
    console.log('HOME WITH MINI PLAYER -- elements near bottom:', JSON.stringify(miniPlayerRelated(els), null, 2));
    console.log('FULL HOME ELEMENTS:', JSON.stringify(els, null, 2));
    await screenshot(client, DIR, '11-home-with-player');

    // 2. Check raw accessibility tree for mini player -- looking for 3 distinct
    // focus stops (Track Info, Play/Pause, Close) instead of 1 merged button
    const raw = extractElements(source).filter((e) => e.type === 'XCUIElementTypeButton' && e.visible && e.y >= 650 && e.y <= 780);
    console.log('RAW BUTTONS NEAR MINI PLAYER BAND (y 650-780):', JSON.stringify(raw, null, 2));

    // 3. Navigate through tabs, checking persistence + no overlap each time
    for (const tabName of ['Sessions', 'Learn', 'Shop', 'Home']) {
      await tap(client, `//XCUIElementTypeButton[@label="${tabName}" or @name="${tabName}"]`, `${tabName} tab`);
      await sleep(1000);
      ({ source } = await dumpSource(client, DIR, `12-${tabName.toLowerCase()}-with-player`));
      const elsTab = interactiveSummary(extractElements(source));
      const mp = elsTab.find((e) => /now playing/i.test(e.text || ''));
      console.log(`${tabName}: mini player present =`, !!mp, mp ? JSON.stringify(mp) : '');
      await screenshot(client, DIR, `12-${tabName.toLowerCase()}-with-player`);
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
