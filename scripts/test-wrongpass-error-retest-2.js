const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-wrongpass-2026-08-21';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    // Should still be on the login form with the "Invalid login credentials" error showing.
    const passField = await findFresh(client, '//XCUIElementTypeSecureTextField');
    if (!passField) { console.log('Password field not found -- app state may have reset'); return; }
    await client.elementClick(passField);
    await client.elementSendKeys(passField, 'x');
    await sleep(500);
    await screenshot(client, DIR, '02-after-typing-one-char');
    const { source } = await dumpSource(client, DIR, '02-after-typing-one-char');
    const texts = interactiveSummary(extractElements(source)).map((e) => e.text);
    console.log('AFTER TYPING:', JSON.stringify(texts));
    console.log('Error still present:', texts.includes('Invalid login credentials'));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
