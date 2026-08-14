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
```

`explore.js` walks every tab in the app's bottom nav, capturing a
screenshot, the full accessibility-tree page source, and a list of
visible buttons/text for each tab (before and after one scroll). Output
goes to `reports/<timestamp>/` (git-ignored — these are run artifacts,
not source).

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
- `scripts/explore.js` — the exploratory test entry point. Use the `lib/`
  helpers to write additional targeted scripts for specific flows.

## Notes on the signing setup

WebDriverAgent is signed under Apple Development team `XTW26G8FF2`
(a personal team on the Apple ID configured in Xcode). If you see
`No Account for Team` or code-signing errors when Appium tries to
launch WebDriverAgent, check for duplicate certificates in the keychain
(`security find-identity -v -p codesigning`) — an ambiguous match
between two identically-named certs was the root cause the first time
this was set up.
