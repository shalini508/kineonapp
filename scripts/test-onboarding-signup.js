// ONB-01: sign up a genuinely fresh account and step through onboarding.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { isLoggedIn, logOut, findFresh } = require('../lib/loginActions');

const DIR = 'reports/onboarding-fresh';
const EMAIL = 's2@yopmail.com';
const PASSWORD = 'Test@2006';

async function fillField(client, xpathAfterLabel, value) {
  // Text fields on this form have no accessible name either; select by
  // position among all XCUIElementTypeTextField/SecureTextField elements.
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (await isLoggedIn(client)) { await logOut(client); await sleep(1000); }
    const signupBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"DON\'T HAVE") or contains(@name,"DON\'T HAVE")]');
    await client.elementClick(signupBtn);
    await sleep(1200);

    const textFields = await client.findElements('xpath', '//XCUIElementTypeTextField');
    console.log('Text fields found:', textFields.length);
    const ids = textFields.map((e) => e['element-6066-11e4-a52e-4042805e5804'] || e.ELEMENT);
    // Order on screen: First name, Last name, Email
    await client.elementSendKeys(ids[0], 'QA');
    await client.elementSendKeys(ids[1], 'Tester2');
    await client.elementSendKeys(ids[2], EMAIL);

    const secureFields = await client.findElements('xpath', '//XCUIElementTypeSecureTextField');
    console.log('Secure fields found:', secureFields.length);
    const secureIds = secureFields.map((e) => e['element-6066-11e4-a52e-4042805e5804'] || e.ELEMENT);
    await client.elementSendKeys(secureIds[0], PASSWORD);
    await client.elementSendKeys(secureIds[1], PASSWORD);

    await screenshot(client, DIR, '02-signup-filled');

    // Accept terms checkbox -- tap the static text/checkbox area.
    const termsText = await findFresh(client, '//XCUIElementTypeStaticText[contains(@label,"accept the Terms") or contains(@name,"accept the Terms")]');
    if (termsText) { await client.elementClick(termsText); await sleep(400); }
    await screenshot(client, DIR, '03-terms-checked');

    const signUpSubmit = await findFresh(client, '//XCUIElementTypeButton[@label="SIGN UP" or @name="SIGN UP"]');
    await client.elementClick(signUpSubmit);
    await sleep(2500);
    await screenshot(client, DIR, '04-after-signup-submit');
    const { source } = await dumpSource(client, DIR, '04-after-signup-submit');
    console.log('AFTER SUBMIT:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
