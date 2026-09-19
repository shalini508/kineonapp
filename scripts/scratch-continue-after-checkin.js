const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/new-account-milestone';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    for (let i = 0; i < 3; i++) {
      const skip = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"SKIP") or contains(@name,"SKIP")]');
      if (skip) { await client.elementClick(skip); await sleep(1000); continue; }
      const cont = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE") or contains(@name,"CONTINUE")]');
      if (cont) { await client.elementClick(cont); await sleep(1000); continue; }
      break;
    }
    await screenshot(client, DIR, '03b-after-checkin-dismissed');

    const sessionsTab = await findFresh(client, '//XCUIElementTypeButton[@label="Sessions" or @name="Sessions"]');
    await client.elementClick(sessionsTab);
    await sleep(1200);
    await screenshot(client, DIR, '04-session-log-after');
    const { source } = await dumpSource(client, DIR, '04-session-log-after');
    console.log('SESSION LOG SCREEN:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));

    const homeTab = await findFresh(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]');
    await client.elementClick(homeTab);
    await sleep(1000);
    await screenshot(client, DIR, '05-home-after');
    const { source: src2 } = await dumpSource(client, DIR, '05-home-after');
    const after = interactiveSummary(extractElements(src2));
    console.log('AFTER:', after.find((e) => /Recovery Day|No recovery/.test(e.text))?.text);
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
