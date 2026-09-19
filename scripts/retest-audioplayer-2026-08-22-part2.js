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

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    await sleep(1500);
    console.log('LOGGED IN?', await isLoggedIn(client));

    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab');
    await sleep(1000);

    await tap(client, '//XCUIElementTypeButton[contains(@label,"Play Body Scan") or contains(@name,"Play Body Scan")]', 'Play Body Scan');
    await sleep(2000);
    await screenshot(client, DIR, '20-on-player-screen');
    let { source } = await dumpSource(client, DIR, '20-on-player-screen');
    console.log('ON PLAYER SCREEN:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));

    console.log('--- now tapping Go back ---');
    const ok = await tap(client, '//XCUIElementTypeButton[contains(@label,"Go back") or contains(@name,"Go back")]', 'Go back');
    console.log('go back tapped:', ok);
    await sleep(800);
    await screenshot(client, DIR, '21-immediately-after-go-back');
    ({ source } = await dumpSource(client, DIR, '21-immediately-after-go-back'));
    console.log('IMMEDIATELY AFTER GO BACK (0.8s):', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));

    await sleep(2000);
    await screenshot(client, DIR, '22-2.8s-after-go-back');
    ({ source } = await dumpSource(client, DIR, '22-2.8s-after-go-back'));
    console.log('2.8s AFTER GO BACK:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
