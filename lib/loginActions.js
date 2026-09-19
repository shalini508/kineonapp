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

// Simulators (unlike the physical device this was originally built against)
// can drop characters when sendKeys types a long string quickly -- the
// on-screen keyboard's animation doesn't always keep up with synthetic
// events. Verify what actually landed and retry a couple of times before
// giving up, rather than silently submitting a corrupted value.
// `isMatch` compares the field's reported value against what we typed --
// plaintext fields report the real string, secure fields report a run of
// bullet characters instead, so callers check length rather than content.
async function setFieldWithVerification(client, xpath, value, fieldLabel, isMatch, attempts = 3) {
  const elementId = await findFresh(client, xpath);
  if (!elementId) throw new Error(`${fieldLabel} field not found`);
  if (!value) {
    await client.elementClear(elementId);
    return;
  }
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await client.elementClear(elementId);
    await client.elementSendKeys(elementId, value);
    await sleep(300);
    const freshId = await findFresh(client, xpath);
    const actual = await client.getElementAttribute(freshId, 'value');
    if (isMatch(actual, value)) return;
    if (attempt === attempts) {
      throw new Error(`${fieldLabel} field: typed "${value}" but field shows "${actual}" after ${attempts} attempts`);
    }
  }
}

async function setEmail(client, value) {
  await setFieldWithVerification(
    client,
    '//XCUIElementTypeTextField',
    value,
    'Email',
    (actual, expected) => actual === expected
  );
}

async function setPassword(client, value) {
  await setFieldWithVerification(
    client,
    '//XCUIElementTypeSecureTextField',
    value,
    'Password',
    // Secure field echoes one bullet char per typed character, not the text itself.
    (actual, expected) => typeof actual === 'string' && [...actual].length === [...expected].length
  );
}

// On small screens (375x667 -- iPhone SE / 8 / 7 / 6s) the software keyboard
// covers the bottom third, and the SIGN IN button sits underneath it. The
// button is still in the accessibility tree, so a click "succeeds" but the
// tap actually lands on the keyboard and nothing happens -- the form just
// sits there with no error. Dismiss the keyboard first so the tap reaches
// the button. Taller screens were unaffected, which is why this only ever
// showed up on the small-device sweep.
async function dismissKeyboardIfPresent(client) {
  const keyboardish = await findFresh(
    client,
    '//XCUIElementTypeKeyboard | //XCUIElementTypeOther[contains(@name,"UIKeyboardLayout")]'
  );
  if (!keyboardish) return false;
  try {
    await client.hideKeyboard();
  } catch (err) {
    // hideKeyboard isn't always supported; tapping a neutral area also works.
    const heading = await findFresh(
      client,
      '//XCUIElementTypeStaticText[contains(@label,"Sign in to continue") or contains(@name,"Sign in to continue")]'
    );
    if (heading) {
      try {
        await client.elementClick(heading);
      } catch (e) {
        /* best effort */
      }
    }
  }
  await sleep(700);
  return true;
}

async function submitLogin(client) {
  await dismissKeyboardIfPresent(client);
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
// The prompt can also dismiss itself between the lookup and the click (iOS
// tears it down on its own in some flows), which surfaces as a stale element
// reference. That just means it's already gone, so swallow it rather than
// letting it kill the run.
async function dismissSavePasswordPromptIfPresent(client) {
  const notNow = await findFresh(client, '//XCUIElementTypeButton[@label="Not Now" or @name="Not Now"]');
  if (!notNow) return false;
  try {
    await client.elementClick(notNow);
  } catch (err) {
    if (/stale element|not present in the current view/i.test(err.message || '')) return false;
    throw err;
  }
  await sleep(500);
  return true;
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
