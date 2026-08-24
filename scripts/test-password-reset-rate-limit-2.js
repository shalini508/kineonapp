// AUTH-13 continued: does going Back and re-triggering "Forgot password?"
// bypass the 60s client-side resend cooldown, i.e. is there any
// server-side rate limit on repeated password-reset requests?
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/new-account-auth13';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    // We're currently on the "Enter the 6-digit code" screen from the previous run.
    for (let i = 1; i <= 5; i++) {
      const backBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Go back") or contains(@name,"Go back")]');
      if (backBtn) { await client.elementClick(backBtn); await sleep(800); }

      // Back on the login form -- email should still be filled in; tap Forgot password again.
      const forgotBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Forgot password") or contains(@name,"Forgot password")]');
      if (!forgotBtn) { console.log(`Round ${i}: no Forgot password button (maybe email got cleared)`); break; }
      await client.elementClick(forgotBtn);
      await sleep(1200);
      await screenshot(client, DIR, `05-round-${i}`);
      const { source } = await dumpSource(client, DIR, `05-round-${i}`);
      const texts = interactiveSummary(extractElements(source)).map((e) => e.text);
      console.log(`Round ${i} screen texts:`, JSON.stringify(texts));
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
