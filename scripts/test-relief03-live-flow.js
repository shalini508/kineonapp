const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh, isLoggedIn } = require('../lib/loginActions');

const DIR = 'reports/regression-2026-08-27';

async function tap(client, xpath, label) {
  const el = await findFresh(client, xpath);
  if (!el) { console.log(`NOT FOUND: ${label}`); return false; }
  await client.elementClick(el);
  return true;
}
async function tapPoint(client, x, y) {
  await client.performActions([{ type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' }, actions: [
    { type: 'pointerMove', duration: 0, x, y },
    { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 80 }, { type: 'pointerUp', button: 0 },
  ]}]);
  await client.releaseActions();
}
function labeled(source) { return interactiveSummary(extractElements(source)); }

async function main() {
  const client = await startSession({ 'appium:newCommandTimeout': 400 });
  ensureDir(DIR);
  try {
    console.log('LOGGED IN?', await isLoggedIn(client));

    // Clear any leftover pending post-session log first
    let { source } = await dumpSource(client, DIR, '80-initial-check');
    let raw = extractElements(source).filter((e) => e.visible && (e.label || e.name));
    if (raw.some((e) => /POST-SESSION LOG/i.test(e.label || e.name))) {
      console.log('Clearing leftover pending log via SKIP');
      const skipped = await tap(client, '//XCUIElementTypeButton[contains(@label,"SKIP") or contains(@name,"SKIP")]', 'SKIP leftover');
      if (!skipped) {
        // no skip option (normal-completion variant) -- just SAVE with no ratings
        await tap(client, '//XCUIElementTypeButton[contains(@label,"SAVE") or contains(@name,"SAVE")]', 'SAVE leftover');
      }
      await sleep(2000);
    }

    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab');
    await sleep(1000);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"START TODAY") or contains(@name,"START TODAY")]', "START TODAY'S SESSION");
    await sleep(1500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Start with MOVE+") or contains(@name,"Start with MOVE+")]', 'Start with MOVE+');
    await sleep(1500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Target Wrist") or contains(@name,"Target Wrist")]', 'Target Wrist');
    await sleep(500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE") or contains(@name,"CONTINUE")]', 'CONTINUE');
    await sleep(1500);

    ({ source } = await dumpSource(client, DIR, '81-post-continue'));
    raw = extractElements(source).filter((e) => e.visible && (e.label || e.name));
    if (raw.some((e) => /how to place|CLOSE/i.test(e.label || e.name))) {
      console.log('Training popup present -- dismissing');
      await tapPoint(client, 355, 78);
      await sleep(1200);
    }

    await tap(client, '//XCUIElementTypeButton[contains(@label,"Set duration to 5 minutes") or contains(@name,"Set duration to 5 minutes")]', '5 min duration');
    await sleep(500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"START SESSION") or contains(@name,"START SESSION")]', 'START SESSION');
    await sleep(2000);
    await screenshot(client, DIR, '82-live-session-start');

    console.log('Waiting for the full 5-minute timer to run out (no early end this time)...');
    // Poll every 15s for up to 6 minutes, watching for the screen to
    // transition away from the live-session countdown on its own.
    let finished = false;
    for (let i = 0; i < 24; i++) {
      await sleep(15000);
      ({ source } = await dumpSource(client, DIR, `83-poll-${i}`));
      const els = labeled(source);
      const remaining = els.find((e) => /REMAINING/i.test(e.text));
      const stillLive = els.some((e) => /END SESSION/i.test(e.text));
      console.log(`poll ${i}: stillLive=${stillLive}`, remaining ? '' : '(no REMAINING label found)');
      if (!stillLive) { finished = true; break; }
    }
    console.log('Timer loop finished. finished=' + finished);
    await screenshot(client, DIR, '84-after-timer-wait');
    ({ source } = await dumpSource(client, DIR, '84-after-timer-wait'));
    console.log('STATE AFTER WAIT:', JSON.stringify(labeled(source), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
