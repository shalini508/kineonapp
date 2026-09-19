const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { isLoggedIn, logOut, findFresh } = require('../lib/loginActions');
const { tapPoint } = require('../lib/logSession');

const DIR = 'reports/onboarding-fresh';
const EMAIL = 's2@yopmail.com';
const PASSWORD = 'Test@2006';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (await isLoggedIn(client)) { await logOut(client); await sleep(1000); }
    const signupBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"DON\'T HAVE") or contains(@name,"DON\'T HAVE")]');
    await client.elementClick(signupBtn);
    await sleep(1200);

    const textFields = await client.findElements('xpath', '//XCUIElementTypeTextField');
    const ids = textFields.map((e) => e['element-6066-11e4-a52e-4042805e5804'] || e.ELEMENT);
    const secureFields = await client.findElements('xpath', '//XCUIElementTypeSecureTextField');
    const secureIds = secureFields.map((e) => e['element-6066-11e4-a52e-4042805e5804'] || e.ELEMENT);

    await client.elementClick(ids[0]); await client.elementSendKeys(ids[0], 'QA');
    await client.elementClick(ids[1]); await client.elementSendKeys(ids[1], 'Tester2');
    await client.elementClick(ids[2]); await client.elementSendKeys(ids[2], EMAIL);
    await client.elementClick(secureIds[0]); await client.elementSendKeys(secureIds[0], PASSWORD);
    await client.elementClick(secureIds[1]); await client.elementSendKeys(secureIds[1], PASSWORD);
    // Immediately dismiss keyboard + tap terms checkbox + submit, no
    // screenshots/attribute-reads in between to avoid giving iOS AutoFill
    // an idle moment to rewrite the fields.
    await tapPoint(client, 40, 551);
    await sleep(200);
    const signUpSubmit = await findFresh(client, '//XCUIElementTypeButton[@label="SIGN UP" or @name="SIGN UP"]');
    await client.elementClick(signUpSubmit);
    await sleep(2500);

    await screenshot(client, DIR, '07-after-fast-submit');
    const { source } = await dumpSource(client, DIR, '07-after-fast-submit');
    console.log('RESULT:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
