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

function findEl(els, re) {
  return els.find((e) => re.test(e.text || ''));
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

    // Test Pause control on mini player
    let { source } = await dumpSource(client, DIR, '50-before-pause');
    let els = interactiveSummary(extractElements(source));
    console.log('Mini player before pause:', JSON.stringify(findEl(els, /now playing/i)));
    const pauseTapped = await tap(client, '//XCUIElementTypeButton[contains(@label,"Pause") or contains(@name,"Pause")]', 'mini player Pause');
    console.log('Tapped pause on mini player:', pauseTapped);
    await sleep(1000);
    ({ source } = await dumpSource(client, DIR, '51-after-pause'));
    els = interactiveSummary(extractElements(source));
    console.log('Elements after pause tap:', JSON.stringify(els, null, 2));
    await screenshot(client, DIR, '51-after-pause');

    // Test resume (Play) then Close (X)
    const playTapped = await tap(client, '//XCUIElementTypeButton[contains(@label,"Play") or contains(@name,"Play")][not(contains(@label,"Body Scan"))]', 'mini player Play (resume)');
    console.log('Tapped resume play on mini player:', playTapped);
    await sleep(1000);
    ({ source } = await dumpSource(client, DIR, '52-after-resume'));
    els = interactiveSummary(extractElements(source));
    console.log('Mini player after resume:', JSON.stringify(findEl(els, /now playing/i)));

    const closeTapped = await tap(client, '//XCUIElementTypeButton[contains(@label,"Close") or contains(@name,"Close") or contains(@label,"Stop") or contains(@name,"Stop")]', 'mini player Close/Stop');
    console.log('Tapped close/stop on mini player:', closeTapped);
    await sleep(1000);
    ({ source } = await dumpSource(client, DIR, '53-after-close'));
    els = interactiveSummary(extractElements(source));
    console.log('Mini player after close tap (should be gone):', JSON.stringify(findEl(els, /now playing/i)));
    await screenshot(client, DIR, '53-after-close');
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
