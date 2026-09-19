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
  const client = await startSession();
  ensureDir(DIR);
  try {
    console.log('LOGGED IN?', await isLoggedIn(client));
    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab');
    await sleep(1000);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"START TODAY") or contains(@name,"START TODAY")]', "START TODAY'S SESSION");
    await sleep(1500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Start with MOVE+") or contains(@name,"Start with MOVE+")]', 'Start with MOVE+');
    await sleep(1500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Target Elbow") or contains(@name,"Target Elbow")]', 'Target Elbow');
    await sleep(500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE") or contains(@name,"CONTINUE")]', 'CONTINUE');
    await sleep(1500);

    let { source } = await dumpSource(client, DIR, '50-post-continue');
    let raw = extractElements(source).filter((e) => e.visible && (e.label || e.name));
    if (raw.some((e) => /how to place|CLOSE/i.test(e.label || e.name))) {
      console.log('Training popup present -- dismissing');
      await tapPoint(client, 355, 78);
      await sleep(1200);
    }

    await tap(client, '//XCUIElementTypeButton[contains(@label,"Set duration to 5 minutes") or contains(@name,"Set duration to 5 minutes")]', '5 min duration');
    await sleep(500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"START SESSION") or contains(@name,"START SESSION")]', 'START SESSION');
    await sleep(2500);
    await screenshot(client, DIR, '51-live-session');
    ({ source } = await dumpSource(client, DIR, '51-live-session'));
    console.log('LIVE SESSION:', JSON.stringify(labeled(source), null, 2));

    await tap(client, '//XCUIElementTypeButton[contains(@label,"END SESSION") or contains(@name,"END SESSION")]', 'END SESSION');
    await sleep(1000);
    ({ source } = await dumpSource(client, DIR, '52-end-confirm'));
    console.log('END CONFIRM:', JSON.stringify(labeled(source), null, 2));

    // Handle whichever confirm-button wording appears
    let confirmed = await tap(client, '//XCUIElementTypeButton[contains(@label,"End & Log") or contains(@name,"End & Log")]', 'End & Log');
    if (!confirmed) confirmed = await tap(client, '//XCUIElementTypeButton[@label="End" or @name="End"]', 'End');
    await sleep(1500);
    await screenshot(client, DIR, '53-post-session-log');
    ({ source } = await dumpSource(client, DIR, '53-post-session-log'));
    console.log('POST-SESSION LOG (confirmed=' + confirmed + '):', JSON.stringify(labeled(source), null, 2));

    // Fill and save WITHOUT any relaunch in between
    const p1 = await tap(client, '//XCUIElementTypeButton[contains(@label,"Pain 3") or contains(@name,"Pain 3")]', 'Pain 3');
    await sleep(300);
    const p2 = await tap(client, '//XCUIElementTypeButton[contains(@label,"Energy 6") or contains(@name,"Energy 6")]', 'Energy 6');
    await sleep(300);
    const p3 = await tap(client, '//XCUIElementTypeButton[contains(@label,"Mood 7") or contains(@name,"Mood 7")]', 'Mood 7');
    await sleep(300);
    await screenshot(client, DIR, '54-log-filled');
    const saved = await tap(client, '//XCUIElementTypeButton[contains(@label,"SAVE") or contains(@name,"SAVE")]', 'SAVE');
    await sleep(1500);
    await screenshot(client, DIR, '55-after-save');
    ({ source } = await dumpSource(client, DIR, '55-after-save'));
    console.log(`RATINGS TAPPED (pain=${p1} energy=${p2} mood=${p3}) SAVED=${saved}`);
    console.log('AFTER SAVE:', JSON.stringify(labeled(source), null, 2));

    // Now check Sessions tab in the SAME continuous session
    await tap(client, '//XCUIElementTypeButton[@label="Sessions" or @name="Sessions"]', 'Sessions tab');
    await sleep(1200);
    await screenshot(client, DIR, '56-sessions-tab-after-save');
    ({ source } = await dumpSource(client, DIR, '56-sessions-tab-after-save'));
    console.log('SESSIONS TAB AFTER SAVE:', JSON.stringify(labeled(source), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
