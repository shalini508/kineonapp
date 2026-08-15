// Reusable helpers for driving the Kineon Move+ login flow.
//
// The login form's email/password fields have no accessibility
// name/label (confirmed by inspecting the live page source), so they're
// targeted positionally by type: there is exactly one
// XCUIElementTypeTextField (email) and one XCUIElementTypeSecureTextField
// (password) on the form.

const { extractElements, sleep } = require('./actions');

async function findFresh(client, xpath) {
  const els = await client.findElements('xpath', xpath);
  if (els.length === 0) return null;
  return els[0]['element-6066-11e4-a52e-4042805e5804'] || els[0].ELEMENT;
}

async function isOnWelcomeScreen(client) {
  const el = await findFresh(client, '//XCUIElementTypeStaticText[@label="KINEON" or @name="KINEON"]');
  return !!el;
}

async function isOnLoginForm(client) {
  const email = await findFresh(client, '//XCUIElementTypeTextField');
  const password = await findFresh(client, '//XCUIElementTypeSecureTextField');
  return !!(email && password);
}

// Navigates from the welcome screen (if present) to the email/password
// login form. No-ops if already on the form.
async function goToLoginForm(client) {
  if (await isOnLoginForm(client)) return;
  const signInBtn = await findFresh(client, '//XCUIElementTypeButton[@label="SIGN IN" or @name="SIGN IN"]');
  if (!signInBtn) throw new Error('Could not find "SIGN IN" button on welcome screen');
  await client.elementClick(signInBtn);
  await sleep(1200);
  if (!(await isOnLoginForm(client))) {
    throw new Error('Tapped "SIGN IN" but the email/password form did not appear');
  }
}

async function setEmail(client, value) {
  const elementId = await findFresh(client, '//XCUIElementTypeTextField');
  if (!elementId) throw new Error('Email field not found');
  await client.elementClear(elementId);
  if (value) await client.elementSendKeys(elementId, value);
}

async function setPassword(client, value) {
  const elementId = await findFresh(client, '//XCUIElementTypeSecureTextField');
  if (!elementId) throw new Error('Password field not found');
  await client.elementClear(elementId);
  if (value) await client.elementSendKeys(elementId, value);
}

async function submitLogin(client) {
  const elementId = await findFresh(client, '//XCUIElementTypeButton[@label="SIGN IN" or @name="SIGN IN"]');
  if (!elementId) throw new Error('Sign In submit button not found');
  await client.elementClick(elementId);
}

async function isLoggedIn(client) {
  // Reuse the same structural tab-bar detection as the exploratory suite:
  // logged-in screens show the Home/Sessions/Learn/Shop bottom nav.
  const source = await client.getPageSource();
  const elements = extractElements(source);
  const buttons = elements.filter((e) => e.type === 'XCUIElementTypeButton' && e.visible);
  const labels = new Set(buttons.map((b) => (b.label || b.name || '').toLowerCase()));
  return labels.has('home') && labels.has('sessions');
}

// Polls up to `timeoutMs` for the app to settle into either the logged-in
// state (tab bar visible) or back on the login form, instead of checking
// state at a single fixed instant (which races with in-flight navigation
// animations after tapping Sign In).
// iOS shows a native "Save Password?" keychain prompt after a successful
// login with credentials it hasn't seen before. It sits outside the app's
// own UI, so isLoggedIn()/isOnLoginForm() can't see past it — dismiss it
// with "Not Now" whenever it appears so it never blocks a later scenario.
async function dismissSavePasswordPromptIfPresent(client) {
  const notNow = await findFresh(client, '//XCUIElementTypeButton[@label="Not Now" or @name="Not Now"]');
  if (notNow) {
    await client.elementClick(notNow);
    await sleep(500);
    return true;
  }
  return false;
}

async function waitForOutcome(client, timeoutMs = 6000, intervalMs = 400) {
  const deadline = Date.now() + timeoutMs;
  let loggedIn = false;
  let onLoginForm = false;
  while (Date.now() < deadline) {
    await dismissSavePasswordPromptIfPresent(client);
    loggedIn = await isLoggedIn(client);
    onLoginForm = await isOnLoginForm(client);
    if (loggedIn || onLoginForm) break;
    await sleep(intervalMs);
  }
  return { loggedIn, onLoginForm };
}

// Retries a couple of times: on a real device, an unrelated app's push
// notification banner can transiently cover the profile button/nav bar,
// causing a single attempt to miss. Banners auto-dismiss within a few
// seconds, so a short retry is usually enough.
async function logOut(client, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await dismissSavePasswordPromptIfPresent(client);
    try {
      const profileBtn = await findFresh(client, '//XCUIElementTypeButton[@label="Open your profile" or @name="Open your profile"]');
      if (!profileBtn) throw new Error('Could not find the profile button ("Open your profile") to sign out');
      await client.elementClick(profileBtn);
      await sleep(1200);
      const logOutBtn = await findFresh(client, '//XCUIElementTypeButton[@label="LOG OUT" or @name="LOG OUT"]');
      if (!logOutBtn) throw new Error('Could not find "LOG OUT" button on the profile screen');
      await client.elementClick(logOutBtn);
      await sleep(1500);
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      await sleep(1500); // give a transient overlay (e.g. a notification banner) time to clear
    }
  }
}

async function getVisibleTexts(client) {
  const source = await client.getPageSource();
  const elements = extractElements(source);
  return elements
    .filter((e) => e.type === 'XCUIElementTypeStaticText' && e.visible && (e.label || e.name))
    .map((e) => e.label || e.name);
}

module.exports = {
  isOnWelcomeScreen,
  isOnLoginForm,
  goToLoginForm,
  setEmail,
  setPassword,
  submitLogin,
  isLoggedIn,
  waitForOutcome,
  dismissSavePasswordPromptIfPresent,
  logOut,
  getVisibleTexts,
  findFresh,
};
