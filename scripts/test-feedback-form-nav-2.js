const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');
const { tapPoint } = require('../lib/logSession');

const DIR = 'reports/retest-feedback-2026-08-21';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    await screenshot(client, DIR, '01b-settings-current');
    // "FAQ & Contact" row under SUPPORT section.
    await tapPoint(client, 196, 627);
    await sleep(1000);
    await screenshot(client, DIR, '02-after-tap-help-row');
    const { source } = await dumpSource(client, DIR, '02-after-tap-help-row');
    console.log(JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
