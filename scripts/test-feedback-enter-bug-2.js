const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-feedback-2026-08-21';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    const doneKey = await findFresh(client, '//XCUIElementTypeButton[@label="done" or @name="done" or @label="Done" or @name="Done"]');
    if (doneKey) { await client.elementClick(doneKey); await sleep(700); }
    await screenshot(client, DIR, '09-after-done-key');
    const { source } = await dumpSource(client, DIR, '09-after-done-key');
    const texts = interactiveSummary(extractElements(source));
    console.log('AFTER DONE KEY:', JSON.stringify(texts, null, 2));
    console.log('SEND FEEDBACK button present:', texts.some((e) => e.text === 'SEND FEEDBACK'));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
