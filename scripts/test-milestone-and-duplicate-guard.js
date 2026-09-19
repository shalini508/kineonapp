const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh, isLoggedIn } = require('../lib/loginActions');

const DIR = 'reports/regression-2026-08-27';

async function tap(client, xpath, label) {
  const el = await findFresh(client, xpath);
  if (!el) { console.log(`NOT FOUND: ${label} (${xpath})`); return false; }
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

function labeled(source) {
  return interactiveSummary(extractElements(source));
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    console.log('LOGGED IN?', await isLoggedIn(client));
    await tap(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]', 'Home tab');
    await sleep(1000);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"START TODAY") or contains(@name,"START TODAY")]', 'START TODAY\'S SESSION');
    await sleep(1500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Start with RELIEF+") or contains(@name,"Start with RELIEF+")]', 'Start with RELIEF+');
    await sleep(1500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Target Shoulder") or contains(@name,"Target Shoulder")]', 'Target Shoulder');
    await sleep(500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE") or contains(@name,"CONTINUE")]', 'CONTINUE');
    await sleep(1500);

    let { source } = await dumpSource(client, DIR, '30-check-popup');
    let raw = extractElements(source).filter((e) => e.visible && (e.label || e.name));
    const hasTrainingPopup = raw.some((e) => /how to place|CLOSE/i.test(e.label || e.name));
    if (hasTrainingPopup) {
      console.log('Training popup present -- dismissing');
      await tapPoint(client, 355, 78);
      await sleep(1200);
    } else {
      console.log('No training popup this time (already seen for this body part)');
    }

    await tap(client, '//XCUIElementTypeButton[contains(@label,"Set duration to 5 minutes") or contains(@name,"Set duration to 5 minutes")]', '5 min duration');
    await sleep(500);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"START SESSION") or contains(@name,"START SESSION")]', 'START SESSION');
    await sleep(2000);
    await screenshot(client, DIR, '31-live-session');
    ({ source } = await dumpSource(client, DIR, '31-live-session'));
    console.log('LIVE SESSION:', JSON.stringify(labeled(source), null, 2));

    const pauseOk = await tap(client, '//XCUIElementTypeButton[contains(@label,"Pause session") or contains(@name,"Pause session")]', 'Pause session');
    await sleep(1000);
    ({ source } = await dumpSource(client, DIR, '32-after-pause'));
    console.log('AFTER PAUSE (pauseOk=' + pauseOk + '):', JSON.stringify(labeled(source), null, 2));
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Resume session") or contains(@name,"Resume session")]', 'Resume session');
    await sleep(1000);

    await tap(client, '//XCUIElementTypeButton[contains(@label,"END SESSION") or contains(@name,"END SESSION")]', 'END SESSION');
    await sleep(1000);
    ({ source } = await dumpSource(client, DIR, '33-end-confirm'));
    console.log('END CONFIRM:', JSON.stringify(labeled(source), null, 2));
    await tap(client, '//XCUIElementTypeButton[contains(@label,"End & Log") or contains(@name,"End & Log") or @label="End" or @name="End"]', 'End & Log / End');
    await sleep(1500);
    await screenshot(client, DIR, '34-post-session-log');
    ({ source } = await dumpSource(client, DIR, '34-post-session-log'));
    console.log('POST-SESSION LOG:', JSON.stringify(labeled(source), null, 2));

    await tap(client, '//XCUIElementTypeButton[contains(@label,"Pain 4") or contains(@name,"Pain 4")]', 'Pain 4');
    await sleep(300);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Energy 7") or contains(@name,"Energy 7")]', 'Energy 7');
    await sleep(300);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Mood 8") or contains(@name,"Mood 8")]', 'Mood 8');
    await sleep(300);
    await screenshot(client, DIR, '35-log-filled');
    await tap(client, '//XCUIElementTypeButton[contains(@label,"SAVE") or contains(@name,"SAVE")]', 'SAVE');
    await sleep(1500);
    await screenshot(client, DIR, '36-after-save');
    ({ source } = await dumpSource(client, DIR, '36-after-save'));
    console.log('AFTER SAVE:', JSON.stringify(labeled(source), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
