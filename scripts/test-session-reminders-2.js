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

    const { source: srcBefore } = await dumpSource(client, DIR, '80-settings-check-switch');
    const sw = extractElements(srcBefore).find((e) => e.type === 'XCUIElementTypeSwitch');
    console.log('Notifications switch value:', sw ? sw.value : 'NOT FOUND');

    if (sw && sw.value !== '1') {
      console.log('Switch is OFF -- turning it ON');
      const switchEl = await findFresh(client, '//XCUIElementTypeSwitch');
      await client.elementClick(switchEl);
      await sleep(1500);
      const allowBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Allow") or contains(@name,"Allow")]');
      if (allowBtn) {
        console.log('Native permission alert -- tapping Allow');
        await client.elementClick(allowBtn);
        await sleep(1200);
      }
    } else {
      console.log('Switch already ON -- leaving as-is');
    }

    await screenshot(client, DIR, '81-notifications-on-confirmed');
    const { source: srcConfirm } = await dumpSource(client, DIR, '81-notifications-on-confirmed');
    const swAfter = extractElements(srcConfirm).find((e) => e.type === 'XCUIElementTypeSwitch');
    console.log('Notifications switch value now:', swAfter ? swAfter.value : 'NOT FOUND');

    const remindersRow = await findFresh(client, '//*[contains(@label,"Session Reminders") or contains(@name,"Session Reminders")]');
    if (!remindersRow) { console.log('Session Reminders row not found'); return; }
    await client.elementClick(remindersRow);
    await sleep(1500);
    await screenshot(client, DIR, '82-session-reminders-with-notif-on');
    const { source } = await dumpSource(client, DIR, '82-session-reminders-with-notif-on');
    console.log('SESSION REMINDERS (notifications ON):', JSON.stringify(labeled(source), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
