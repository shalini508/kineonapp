// Retest AUTH-07: malformed email should trigger client-side validation.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, isLoggedIn, logOut, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-2026-08-21';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (await isLoggedIn(client)) { await logOut(client); await sleep(1000); }
    await goToLoginForm(client);
    const emailField = await findFresh(client, '//XCUIElementTypeTextField');
    await client.elementClear(emailField);
    await client.elementSendKeys(emailField, 'notanemail');
    const passField = await findFresh(client, '//XCUIElementTypeSecureTextField');
    await client.elementClear(passField);
    await client.elementSendKeys(passField, 'Whatever123');
    const signInBtn = await findFresh(client, '//XCUIElementTypeButton[@label="SIGN IN" or @name="SIGN IN"]');
    await client.elementClick(signInBtn);
    await sleep(3000);
    await screenshot(client, DIR, 'auth07-retest');
    const { source } = await dumpSource(client, DIR, 'auth07-retest');
    console.log('AUTH-07 RETEST:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
