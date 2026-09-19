const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, ensureDir, sleep, swipeUp } = require('../lib/actions');
const { findFresh, isLoggedIn } = require('../lib/loginActions');

const DIR = 'reports/retest-2026-08-25-build25';

async function tap(client, xpath, label) {
  const el = await findFresh(client, xpath);
  if (!el) { console.log(`NOT FOUND: ${label} (${xpath})`); return false; }
  await client.elementClick(el);
  return true;
}

function labeled(source) {
  return extractElements(source)
    .filter((e) => (e.label || e.name) && e.visible)
    .map((e) => ({ type: e.type, label: e.label || e.name, value: e.value, y: e.y }));
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    console.log('LOGGED IN?', await isLoggedIn(client));
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Open your profile") or contains(@name,"Open your profile")]', 'profile');
    await sleep(1000);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"SETTINGS") or contains(@name,"SETTINGS")]', 'Settings');
    await sleep(1200);
    await swipeUp(client);
    await sleep(600);

    let { source } = await dumpSource(client, DIR, '70-settings-before-toggle');
    console.log('BEFORE TOGGLE:', JSON.stringify(labeled(source), null, 2));

    const switchEl = await findFresh(client, '//XCUIElementTypeSwitch');
    if (!switchEl) { console.log('Notifications switch not found'); return; }
    await client.elementClick(switchEl);
    await sleep(1500);

    await screenshot(client, DIR, '71-after-notif-toggle');
    ({ source } = await dumpSource(client, DIR, '71-after-notif-toggle'));
    console.log('AFTER TOGGLE (may be a native permission alert):', JSON.stringify(labeled(source), null, 2));

    // If a native "Allow Notifications" alert appeared, allow it.
    const allowBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Allow") or contains(@name,"Allow")]');
    if (allowBtn) {
      console.log('Native permission alert detected -- tapping Allow');
      await client.elementClick(allowBtn);
      await sleep(1200);
    }

    await screenshot(client, DIR, '72-settings-after-allow');
    ({ source } = await dumpSource(client, DIR, '72-settings-after-allow'));
    console.log('SETTINGS AFTER ALLOW:', JSON.stringify(labeled(source), null, 2));

    // Now go into Session Reminders and check the footer/queue state.
    const remindersRow = await findFresh(client, '//*[contains(@label,"Session Reminders") or contains(@name,"Session Reminders")]');
    if (!remindersRow) { console.log('Session Reminders row not found after enabling notifications'); return; }
    await client.elementClick(remindersRow);
    await sleep(1500);
    await screenshot(client, DIR, '73-session-reminders-after-enable');
    ({ source } = await dumpSource(client, DIR, '73-session-reminders-after-enable'));
    console.log('SESSION REMINDERS AFTER ENABLING NOTIFICATIONS:', JSON.stringify(labeled(source), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
