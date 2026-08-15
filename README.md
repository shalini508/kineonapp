# KineoApp_auto

Reusable Appium/WebDriverAgent test scaffolding for testing the Kineon
Move+ iOS app (`io.kineon.move`) on a physical device via Appium's
XCUITest driver.

## Prerequisites

- Appium 3.x with the XCUITest driver installed, running on `127.0.0.1:4723`
- `libimobiledevice`, `ideviceinstaller`, `ios-deploy` (via Homebrew)
- Xcode with a signed-in Apple Developer account that has a valid
  Development certificate for the team in `config/capabilities.js`
- The target iPhone connected via USB, trusted, with Developer Mode on,
  and the Kineon Move+ app already installed (e.g. via TestFlight)

## Usage

```sh
npm install
node scripts/explore.js
node scripts/test-login.js
node scripts/test-login.js --email you@example.com --password 'Secret123!'
```

`explore.js` walks every tab in the app's bottom nav, capturing a
screenshot, the full accessibility-tree page source, and a list of
visible buttons/text for each tab (before and after one scroll).

`test-login.js` runs a data-driven suite of login scenarios (wrong
password, unregistered email, empty fields, malformed email, whitespace
padding, email case sensitivity, injection-style input, and valid
credentials). It's self-contained: it signs out first if the app is
already logged in, and signs back out after any scenario that results in
a successful login, so it's safe to re-run without manual setup.

Both scripts write to `reports/<timestamp>/` (git-ignored — these are run
artifacts, not source): screenshots, full page-source XML, and for the
login suite, `results.json` / `results.md`.

## Project layout

- `config/capabilities.js` — device UDID, team ID, and other Appium
  capabilities. Update `DEVICE_UDID`/`TEAM_ID` if testing on a different
  device or signing team.
- `lib/session.js` — `startSession()` / `endSession()` helpers.
- `lib/actions.js` — reusable actions: `screenshot`, `dumpSource`,
  `extractElements`, `getTabBarLabels` (position/structure-based bottom
  nav detection, since this app uses a custom RN tab bar rather than a
  native `XCUIElementTypeTabBar`), `tapByLabel` (always re-locates the
  element fresh right before tapping, to avoid stale-element errors),
  `swipeUp`.
- `lib/loginActions.js` — login-flow helpers: `goToLoginForm`, `setEmail`/
  `setPassword` (the fields have no accessibility name, so they're
  targeted positionally by type), `submitLogin`, `waitForOutcome` (polls
  rather than a fixed sleep, and auto-dismisses iOS's native "Save
  Password?" keychain prompt, which otherwise blocks state detection),
  `logOut` (retries a couple of times, since an unrelated app's push
  notification banner can transiently cover the profile button on a real
  device).
- `scripts/explore.js` — the exploratory test entry point.
- `scripts/test-login.js` — the login test suite; also a template for
  writing additional scenario-matrix scripts for other flows.

## Notes on the signing setup

WebDriverAgent is signed under Apple Development team `XTW26G8FF2`
(a personal team on the Apple ID configured in Xcode). If you see
`No Account for Team` or code-signing errors when Appium tries to
launch WebDriverAgent, check for duplicate certificates in the keychain
(`security find-identity -v -p codesigning`) — an ambiguous match
between two identically-named certs was the root cause the first time
this was set up.
