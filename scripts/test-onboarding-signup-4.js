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

    // Dismiss keyboard via its own "done" button so the layout settles
    // back to its unscrolled position before we compute tap coordinates.
    const doneBtn = await findFresh(client, '//XCUIElementTypeButton[@label="done" or @name="done" or @label="Done" or @name="Done"]');
    if (doneBtn) { await client.elementClick(doneBtn); await sleep(700); }

    await screenshot(client, DIR, '08-before-checkbox-tap');
    const { source: srcBefore } = await dumpSource(client, DIR, '08-before-checkbox-tap');
    const elBefore = extractElements(srcBefore);
    const termsRow = elBefore.find((e) => /accept the Terms/.test(e.label || e.name || ''));
    console.log('Terms row element:', JSON.stringify(termsRow));

    if (termsRow) {
      // Checkbox sits just to the left of the label's left edge.
      const checkboxX = Math.max(termsRow.x - 20, 10);
      const checkboxY = termsRow.y + termsRow.height / 2;
      console.log(`Tapping checkbox at (${checkboxX}, ${checkboxY})`);
      await tapPoint(client, checkboxX, checkboxY);
      await sleep(600);
    }
    await screenshot(client, DIR, '09-after-checkbox-tap');

    const signUpSubmit = await findFresh(client, '//XCUIElementTypeButton[@label="SIGN UP" or @name="SIGN UP"]');
    await client.elementClick(signUpSubmit);
    await sleep(2500);
    await screenshot(client, DIR, '10-after-submit');
    const { source } = await dumpSource(client, DIR, '10-after-submit');
    console.log('RESULT:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
