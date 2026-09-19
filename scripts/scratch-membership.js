const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/new-account-sub01';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    const membershipBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Manage") or contains(@name,"Manage")]');
    if (!membershipBtn) throw new Error('Manage button not found -- app may have reset state');
    await client.elementClick(membershipBtn);
    await sleep(1200);
    await screenshot(client, DIR, '03-membership');
    const { source } = await dumpSource(client, DIR, '03-membership');
    console.log(JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
