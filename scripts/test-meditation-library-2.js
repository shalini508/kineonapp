const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep, swipeUp } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-meditations-2026-08-22';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    const learnTab = await findFresh(client, '//XCUIElementTypeButton[@label="Learn" or @name="Learn"]');
    await client.elementClick(learnTab);
    await sleep(1200);
    const openLibraryBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Open Meditation Library") or contains(@name,"Open Meditation Library")]');
    await client.elementClick(openLibraryBtn);
    await sleep(1200);

    for (let i = 0; i < 4; i++) {
      await swipeUp(client);
      await sleep(500);
      await screenshot(client, DIR, `03-library-scroll-${i}`);
    }
    const { source } = await dumpSource(client, DIR, '03-library-scroll-final');
    console.log('FULL LIBRARY (after scrolling):', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
