const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-learn-2026-08-21';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    const learnTab = await findFresh(client, '//XCUIElementTypeButton[@label="Learn" or @name="Learn"]');
    await client.elementClick(learnTab);
    await sleep(1200);
    await screenshot(client, DIR, '04-learn-before-video-tap');

    const video = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Play Latest Get Started")]');
    if (video) {
      await client.elementClick(video);
      await sleep(2000);
      await screenshot(client, DIR, '05-after-video-tap');
      const { source } = await dumpSource(client, DIR, '05-after-video-tap');
      console.log('AFTER TAPPING VIDEO:', JSON.stringify(interactiveSummary(extractElements(source)).slice(0, 15), null, 2));
    } else {
      console.log('Video button not found');
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
