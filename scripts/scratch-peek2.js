const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir } = require('../lib/actions');
async function main() {
  const client = await startSession();
  const dir = 'reports/new-account-auth13';
  ensureDir(dir);
  try {
    await screenshot(client, dir, '06-current');
    const { source } = await dumpSource(client, dir, '06-current');
    console.log(JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally { await endSession(client); }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
