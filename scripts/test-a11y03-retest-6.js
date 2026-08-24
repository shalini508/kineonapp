const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { swipeUp } = require('../lib/actions');

const DIR = 'reports/retest-2026-08-21';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    await sleep(800);
    for (let i = 0; i < 6; i++) {
      await swipeUp(client);
      await sleep(500);
      await screenshot(client, DIR, `a11y03-05-scroll-${i}`);
    }
    const { source } = await dumpSource(client, DIR, 'a11y03-05-scroll-final');
    console.log(JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
