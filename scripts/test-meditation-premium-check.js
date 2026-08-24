const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-meditations-2026-08-22';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    await screenshot(client, DIR, '04-home-before-upgrade-tap');
    const upgradeBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Upgrade to premium") or contains(@name,"Upgrade to premium")]');
    if (!upgradeBtn) {
      console.log('Upgrade button not found on current screen');
      const { source } = await dumpSource(client, DIR, '04-home-before-upgrade-tap');
      console.log(JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
      return;
    }
    await client.elementClick(upgradeBtn);
    await sleep(1200);
    await screenshot(client, DIR, '05-after-upgrade-tap');
    const { source } = await dumpSource(client, DIR, '05-after-upgrade-tap');
    console.log('AFTER UPGRADE TAP:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
