const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, ensureDir, sleep } = require('../lib/actions');
const { findFresh, isLoggedIn } = require('../lib/loginActions');

const DIR = 'reports/retest-batch-2026-08-22';

async function tap(client, xpath, label) {
  const el = await findFresh(client, xpath);
  if (!el) { console.log(`NOT FOUND: ${label} (${xpath})`); return false; }
  await client.elementClick(el);
  return true;
}

async function tapPoint(client, x, y) {
  await client.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 80 },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
  await client.releaseActions();
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    console.log('LOGGED IN?', await isLoggedIn(client));
    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab');
    await sleep(1000);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Play Body Scan") or contains(@name,"Play Body Scan")]', 'Play Body Scan');
    await sleep(2000);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Go back") or contains(@name,"Go back")]', 'Go back');
    await sleep(1000);

    console.log('Tapping pause-icon area of mini player (left of close X)...');
    await tapPoint(client, 290, 725);
    await sleep(1000);
    const { source: s1 } = await dumpSource(client, DIR, '62-after-tap-pause-icon');
    const els1 = extractElements(s1).filter((e) => e.type === 'XCUIElementTypeButton' && e.visible);
    console.log('Buttons after pause-icon tap:', JSON.stringify(els1.map((e) => e.label), null, 2));
    await screenshot(client, DIR, '62-after-tap-pause-icon');

    // tap again at same spot -- should resume if it paused
    console.log('Tapping same spot again (expect resume if it was pause)...');
    await tapPoint(client, 290, 725);
    await sleep(1000);
    const { source: s2 } = await dumpSource(client, DIR, '63-after-second-tap');
    const els2 = extractElements(s2).filter((e) => e.type === 'XCUIElementTypeButton' && e.visible);
    console.log('Buttons after second tap:', JSON.stringify(els2.map((e) => e.label), null, 2));
    await screenshot(client, DIR, '63-after-second-tap');
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
