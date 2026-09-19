const { startSession, endSession } = require('../lib/session');
const { screenshot, ensureDir } = require('../lib/actions');
async function main() {
  const client = await startSession();
  const dir = 'reports/wda-recovery-check';
  ensureDir(dir);
  try {
    await screenshot(client, dir, 'current-state');
    console.log('WDA session succeeded.');
  } finally { await endSession(client); }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
