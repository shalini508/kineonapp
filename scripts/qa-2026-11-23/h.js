// QA helpers for Kineon on a physical iPhone or an iOS simulator.
// Simulator: set SIM_UDID (and optionally SIM_NAME, SIM_OS). Appium on APPIUM_PORT (default 4724).
process.env.APPIUM_PORT = process.env.APPIUM_PORT || '4724';
const P = '/Users/shalini/Desktop/Kineon_seo/KineoApp_auto';
const { startSession, endSession } = require(`${P}/lib/session`);
const { screenshot, extractElements, sleep, ensureDir, swipeUp } = require(`${P}/lib/actions`);
const L = require(`${P}/lib/loginActions`);

const SIM_UDID = process.env.SIM_UDID;
const TAG = process.env.SIM_TAG || (SIM_UDID ? 'sim' : 'device');
const DIR = `${__dirname}/shots/${TAG}`; ensureDir(DIR);
const BUNDLE = 'io.kineon.move';

const vis = async (c) => extractElements(await c.getPageSource()).filter((e) => e.visible && (e.label || e.name));
const lab = (e) => e.label || e.name || '';
const texts = async (c) => (await vis(c)).map(lab);
const tapXp = async (c, x) => { const el = await L.findFresh(c, x); if (!el) return false; await c.elementClick(el); return true; };
const has = async (c, re) => (await texts(c)).some((t) => re.test(t));
const shot = (c, name) => screenshot(c, DIR, name);

async function scrollTap(c, x, tries = 10) {
  for (let i = 0; i < tries; i++) { if (await tapXp(c, x)) return true; await swipeUp(c); await sleep(400); }
  return false;
}

async function open(keep = !!process.env.KEEP_APP) {
  const caps = { 'appium:autoAcceptAlerts': !process.env.NO_AUTO_ACCEPT };
  if (SIM_UDID) {
    Object.assign(caps, {
      'appium:udid': SIM_UDID,
      'appium:deviceName': process.env.SIM_NAME || 'iPhone Simulator',
      'appium:platformVersion': process.env.SIM_OS || '27.2',
      'appium:usePrebuiltWDA': false,
      'appium:noReset': true, // without this the simulator app data (and sign-in) is wiped at every session start
      'appium:usePreinstalledWDA': false,
      'appium:xcodeOrgId': undefined,
      'appium:xcodeSigningId': undefined,
      'appium:allowProvisioningDeviceRegistration': undefined,
    });
  } else {
    Object.assign(caps, { 'appium:updatedWDABundleId': 'com.shalini.appium.WebDriverAgentRunner', 'appium:usePreinstalledWDA': true });
  }
  if (keep) Object.assign(caps, { 'appium:autoLaunch': false, 'appium:shouldTerminateApp': false });
  return startSession(caps);
}

async function run(fn) {
  const c = await open();
  try { await fn(c); } finally { await endSession(c); }
}

async function tab(c, name) { const ok = await tapXp(c, `//XCUIElementTypeButton[@label="${name}" or @name="${name}"]`); await sleep(1800); return ok; }

async function back(c) {
  return (await tapXp(c, '//XCUIElementTypeButton[@label="Go back" or @name="Go back"]'))
    || (await tapXp(c, '//*[contains(@label,"Close treatment guide")]'));
}

// Sign in from wherever the app is (welcome screen, login form, or already signed in).
async function login(c, email, pw) {
  await sleep(1500);
  if (await tapXp(c, '//XCUIElementTypeButton[@label="Continue" or @name="Continue"]')) await sleep(1200);
  if (await L.isLoggedIn(c)) return { already: true };
  if (!(await L.isOnLoginForm(c))) await L.goToLoginForm(c);
  await L.setEmail(c, email);
  // Typing into the secure field is unreliable under automation, so reveal it first and type as plain text.
  await tapXp(c, '//XCUIElementTypeButton[contains(@label,"Show password")]'); await sleep(600);
  const fields = await c.findElements('xpath', '//XCUIElementTypeTextField');
  const pwField = fields[fields.length - 1];
  const pid = pwField['element-6066-11e4-a760-000000000000'] || pwField.ELEMENT;
  await c.elementClick(pid);
  for (let attempt = 0; attempt < 3; attempt++) {
    await c.elementClear(pid).catch(() => {});
    for (const ch of pw) { await c.elementSendKeys(pid, ch); await sleep(120); } // simulators drop fast keystrokes
    if ((await c.getElementAttribute(pid, 'value')) === pw) break;
  }
  // Close the keyboard (it covers SIGN IN on small screens), then submit.
  const kb = async () => (await c.findElements('xpath', '//XCUIElementTypeKeyboard')).length > 0;
  if (await kb()) { await tapXp(c, '//XCUIElementTypeKeyboard//*[@name="Return" or @name="return" or @label="return" or @name="Go" or @name="Done"]'); await sleep(800); }
  if (await kb()) {
    await c.performActions([{ type: 'pointer', id: 't', parameters: { pointerType: 'touch' }, actions: [
      { type: 'pointerMove', duration: 0, x: 180, y: 110 }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 80 }, { type: 'pointerUp', button: 0 }] }]);
    await c.releaseActions().catch(() => {}); await sleep(800);
  }
  console.log(`[login] keyboard still shown before SIGN IN: ${await kb()}`);
  if (!(await L.isLoggedIn(c))) await tapXp(c, '//XCUIElementTypeButton[@label="SIGN IN" or @name="SIGN IN"]');
  for (let i = 0; i < 20; i++) { await sleep(1000); if (await L.isLoggedIn(c)) break; await L.dismissSavePasswordPromptIfPresent(c); }
  await tapXp(c, '//XCUIElementTypeButton[@label="Continue" or @name="Continue"]');
  return { loggedIn: await L.isLoggedIn(c) };
}

// Elements whose frame runs past the screen edges (a sign of clipped layout).
async function offscreen(c) {
  const { width } = await c.getWindowRect();
  return extractElements(await c.getPageSource())
    .filter((e) => e.visible && (e.label || e.name) && e.x !== undefined && (Number(e.x) < -1 || Number(e.x) + Number(e.width) > width + 1))
    .map((e) => `${lab(e)} [x=${e.x}, w=${e.width}]`);
}

module.exports = { P, DIR, TAG, SIM_UDID, BUNDLE, sleep, swipeUp, screenshot, shot, vis, lab, texts, tapXp, has, scrollTap, open, run, tab, back, login, offscreen, L, endSession };

// Open Notification Centre from the Home screen, read its first screen (newest items), then close it.
async function notificationTexts(c, tag) {
  await c.executeScript('mobile: pressButton', [{ name: 'home' }]); await sleep(1500);
  const { width } = await c.getWindowRect();
  await c.performActions([{ type: 'pointer', id: 'nc', parameters: { pointerType: 'touch' }, actions: [
    { type: 'pointerMove', duration: 0, x: Math.round(width * 0.25), y: 2 }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 150 },
    { type: 'pointerMove', duration: 500, x: Math.round(width * 0.25), y: 600 }, { type: 'pointerUp', button: 0 }] }]);
  await c.releaseActions().catch(() => {}); await sleep(2000);
  const all = await texts(c);
  if (tag) await shot(c, 'notif-' + tag);
  await c.executeScript('mobile: pressButton', [{ name: 'home' }]); await sleep(1000);
  return all;
}
module.exports.notificationTexts = notificationTexts;
