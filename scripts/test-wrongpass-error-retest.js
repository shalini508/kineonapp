// Retest: wrong-password error should appear inline under the Password
// field (near top), not as a bottom toast.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, isLoggedIn, logOut, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-wrongpass-2026-08-21';
const EMAIL = 's1@yopmail.com';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (await isLoggedIn(client)) { await logOut(client); await sleep(1000); }
    await goToLoginForm(client);
    const emailField = await findFresh(client, '//XCUIElementTypeTextField');
    await client.elementClear(emailField);
    await client.elementSendKeys(emailField, EMAIL);
    const passField = await findFresh(client, '//XCUIElementTypeSecureTextField');
    await client.elementClear(passField);
    await client.elementSendKeys(passField, 'DefinitelyWrongPassword123');
    const signInBtn = await findFresh(client, '//XCUIElementTypeButton[@label="SIGN IN" or @name="SIGN IN"]');
    await client.elementClick(signInBtn);
    await sleep(3000);
    await screenshot(client, DIR, '01-wrong-password-error');
    const { source } = await dumpSource(client, DIR, '01-wrong-password-error');
    console.log(JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
