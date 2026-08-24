const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep, swipeUp } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-meditations-2026-08-22';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    const browseBtn = await findFresh(client, '//XCUIElementTypeButton[@label="BROWSE ALL" or @name="BROWSE ALL"]');
    if (!browseBtn) { console.log('BROWSE ALL not found'); return; }
    await client.elementClick(browseBtn);
    await sleep(1200);
    await screenshot(client, DIR, '06-browse-all');
    const { source } = await dumpSource(client, DIR, '06-browse-all');
    console.log('BROWSE ALL SCREEN:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
    for (let i = 0; i < 3; i++) {
      await swipeUp(client);
      await sleep(400);
      await screenshot(client, DIR, `06-browse-all-scroll-${i}`);
    }
    const { source: s2 } = await dumpSource(client, DIR, '06-browse-all-scroll-final');
    console.log('BROWSE ALL SCROLLED:', JSON.stringify(interactiveSummary(extractElements(s2)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
