const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep, swipeUp } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-learn-2026-08-21';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    const learnTab = await findFresh(client, '//XCUIElementTypeButton[@label="Learn" or @name="Learn"]');
    await client.elementClick(learnTab);
    await sleep(1200);
    await screenshot(client, DIR, '02-learn-top');
    for (let i = 0; i < 3; i++) {
      await swipeUp(client);
      await sleep(500);
      await screenshot(client, DIR, `02-learn-scroll-${i}`);
    }
    const { source } = await dumpSource(client, DIR, '02-learn-scroll-final');
    console.log('SCROLLED LEARN:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
