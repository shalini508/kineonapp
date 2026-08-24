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
    await screenshot(client, DIR, '60-before-coord-taps');

    // Mini player bar rect: x=12,y=692,w=369,h=66 (points). Try tapping the
    // right-hand ~15% (close/X icon area) first, since that's the more
    // destructive/observable action.
    console.log('Tapping near right edge of mini player (expected X/close icon area)...');
    await tapPoint(client, 340, 725);
    await sleep(1000);
    const { source: s1 } = await dumpSource(client, DIR, '61-after-tap-right');
    const els1 = extractElements(s1).filter((e) => e.type === 'XCUIElementTypeButton' && e.visible);
    console.log('Buttons after right-edge tap:', JSON.stringify(els1.map((e) => e.label), null, 2));
    await screenshot(client, DIR, '61-after-tap-right');
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
