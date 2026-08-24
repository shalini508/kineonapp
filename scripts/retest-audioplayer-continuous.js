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

function hasMiniPlayer(els) {
  return els.find((e) => /now playing/i.test(e.text || ''));
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    console.log('LOGGED IN?', await isLoggedIn(client));

    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab');
    await sleep(1000);

    const played = await tap(client, '//XCUIElementTypeButton[contains(@label,"Play Body Scan") or contains(@name,"Play Body Scan")]', 'Play Body Scan (Home)');
    console.log('Tapped play:', played);
    await sleep(2000);

    let { source } = await dumpSource(client, DIR, '40-after-play');
    let els = interactiveSummary(extractElements(source));
    console.log('Right after play tap -- on library/player screen. mini player row present:', !!hasMiniPlayer(els));
    await screenshot(client, DIR, '40-after-play');

    // Go back to a screen that has the tab bar
    const wentBack = await tap(client, '//XCUIElementTypeButton[contains(@label,"Go back") or contains(@name,"Go back")]', 'Go back');
    console.log('Tapped go back:', wentBack);
    await sleep(1200);
    ({ source } = await dumpSource(client, DIR, '41-after-go-back'));
    els = interactiveSummary(extractElements(source));
    console.log('AFTER GO BACK -- elements:', JSON.stringify(els, null, 2));
    console.log('AFTER GO BACK -- mini player present:', !!hasMiniPlayer(els));
    await screenshot(client, DIR, '41-after-go-back');

    for (const tabName of ['Sessions', 'Learn', 'Shop', 'Home']) {
      const ok = await tap(client, `//XCUIElementTypeButton[@label="${tabName}" or @name="${tabName}"]`, `${tabName} tab`);
      await sleep(1000);
      ({ source } = await dumpSource(client, DIR, `42-${tabName.toLowerCase()}-with-player`));
      els = interactiveSummary(extractElements(source));
      const mp = hasMiniPlayer(els);
      console.log(`${tabName} tab tapped=${ok}; mini player present: ${!!mp}`, mp ? JSON.stringify(mp) : '');
      await screenshot(client, DIR, `42-${tabName.toLowerCase()}-with-player`);
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
