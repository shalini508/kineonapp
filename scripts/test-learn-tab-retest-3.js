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

    // Tap the featured "Why Red Light Works" article.
    const featured = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Why Red Light Works") or contains(@name,"Why Red Light Works")] | //XCUIElementTypeStaticText[contains(@label,"Why Red Light Works")]');
    if (featured) {
      await client.elementClick(featured);
      await sleep(1800);
      await screenshot(client, DIR, '03-featured-article-tapped');
      const { source } = await dumpSource(client, DIR, '03-featured-article-tapped');
      console.log('AFTER TAPPING FEATURED ARTICLE:', JSON.stringify(interactiveSummary(extractElements(source)).slice(0, 12), null, 2));
    } else {
      console.log('Featured article element not found');
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
