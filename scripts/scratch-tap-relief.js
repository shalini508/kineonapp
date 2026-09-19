const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-quotes-2026-08-22';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    const endEarlyBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"END EARLY") or contains(@name,"END EARLY")]');
    if (endEarlyBtn) { await client.elementClick(endEarlyBtn); await sleep(1000); }
    const confirmBtn = await findFresh(client, '//XCUIElementTypeButton[@label="End" or @name="End" or contains(@label,"End & Log") or contains(@name,"End & Log")]');
    if (confirmBtn) { await client.elementClick(confirmBtn); await sleep(1500); }
    for (let i = 0; i < 4; i++) {
      const skip = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"SKIP") or contains(@name,"SKIP")]');
      if (skip) { await client.elementClick(skip); await sleep(1000); continue; }
      const cont = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE") or contains(@name,"CONTINUE")]');
      if (cont) { await client.elementClick(cont); await sleep(1000); continue; }
      break;
    }
    await screenshot(client, DIR, 'cleanup');
    const { source } = await dumpSource(client, DIR, 'cleanup');
    console.log(JSON.stringify(interactiveSummary(extractElements(source)).slice(0, 6), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
