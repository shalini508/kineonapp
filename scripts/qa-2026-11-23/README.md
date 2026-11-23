# QA scripts — 2026-11-23

Appium scripts used for the TestFlight 1.0.0 (42) QA round. They drive the
physical iPhone by default, or an iOS simulator when `SIM_UDID` is set.

## Setup

- Appium on port 4724 (`APPIUM_PORT`, default 4724).
- Physical iPhone: the RemoteXPC tunnel must be running
  (`sudo appium driver run xcuitest tunnel-creation`).
- Simulator: set `SIM_UDID` (and optionally `SIM_NAME`, `SIM_OS`). Install Kundan's
  simulator build first (`xcrun simctl install <udid> data/ipa_simulator/Kineon.app`).
- `KEEP_APP=1` attaches without relaunching Kineon, so app state survives between scripts.
- `NO_AUTO_ACCEPT=1` turns off auto-accepting iOS alerts (needed to read in-app confirm dialogs).
- Test account password comes from `DAY65_PW`; nothing secret is stored in these files.
- Screenshots go to `shots/<SIM_TAG>/` (git-ignored).

## Scripts

| Script | What it checks |
|---|---|
| `h.js` | Shared helpers (session, sign-in, navigation, Notification Centre reader) |
| `navpass.js` | General navigation pass: 19 screens, flags elements running off-screen |
| `rem.js A\|B\|C` | Session-complete reminder: A log right after, B close without logging (reminder must arrive, then clear after logging), C force-quit, resume and log |
| `k42.js` | Build 42 checks: check-in header shows the device, 30s body-part totals, recovery screen after the planned end |
| `enddlg.js` | End-early dialog wording early vs near the end of a session (run with `NO_AUTO_ACCEPT=1`) |
| `interrupt.js <secs>` | Recovery screen when reopening an interrupted session N seconds after its start |
| `popup-once.js` | First-time treatment guide shows once per body part; `?` still opens it |
| `persist.js` | Sign-in survives an app relaunch |
| `notif-store.js` | Reads the simulator's notification store during a backgrounded session |
| `reminders-control.js`, `phone-reminders.js` | Session Reminders control: how many reminders the app schedules |

## Notes

- Notification checks must run on the physical iPhone: on simulators the app
  schedules no local notifications at all.
- On simulators `appium:noReset` is required (set in `h.js`); without it every
  session wipes the app's sign-in.
