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
    const { source: s1 } = await dumpSource(client, DIR, 'x1-before-clear-check');
    console.log('Error present before typing:', interactiveSummary(extractElements(s1)).some((e) => e.text === 'Invalid login credentials'));

    // Now type into the (still-focused, now empty) password field and check if error clears.
    const passField2 = await findFresh(client, '//XCUIElementTypeSecureTextField');
    await client.elementSendKeys(passField2, 'x');
    await sleep(500);
    await screenshot(client, DIR, '03-after-typing-x');
    const { source: s2 } = await dumpSource(client, DIR, '03-after-typing-x');
    const texts2 = interactiveSummary(extractElements(s2)).map((e) => e.text);
    console.log('AFTER TYPING x:', JSON.stringify(texts2));
    console.log('Error present after typing:', texts2.includes('Invalid login credentials'));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
