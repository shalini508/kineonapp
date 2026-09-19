const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep, swipeUp } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');
const { tapPoint } = require('../lib/logSession');

const DIR = 'reports/retest-feedback-2026-08-21';
const EMAIL = 's1@yopmail.com';
const PASSWORD = 'Test@2006';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (!(await isLoggedIn(client))) {
      await goToLoginForm(client);
      await setEmail(client, EMAIL);
      await setPassword(client, PASSWORD);
      await submitLogin(client);
      await waitForOutcome(client, 8000, 500);
      await sleep(1000);
    }
    const profileBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Open your profile") or contains(@name,"Open your profile")]');
    await client.elementClick(profileBtn);
    await sleep(1000);
    const settingsBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"SETTINGS") or contains(@name,"SETTINGS")]');
    await client.elementClick(settingsBtn);
    await sleep(1000);
    await tapPoint(client, 196, 627);
    await sleep(1000);
    await swipeUp(client);
    await sleep(500);
    await tapPoint(client, 196, 619);
    await sleep(1200);

    // Find the description text field/view and tap it to bring up the keyboard.
    let descField = await findFresh(client, '//XCUIElementTypeTextView');
    if (!descField) descField = await findFresh(client, '//XCUIElementTypeTextField[2]');
    if (!descField) {
      // Fall back to tapping the known coordinate area under "ISSUE DESCRIPTION".
      await tapPoint(client, 180, 130);
      await sleep(500);
    } else {
      await client.elementClick(descField);
      await sleep(500);
    }
    await client.elementSendKeys(descField || (await findFresh(client, '//XCUIElementTypeTextView')), 'Testing the Enter key bug');
    await sleep(500);
    await screenshot(client, DIR, '07-typed-description');
    const { source: s1 } = await dumpSource(client, DIR, '07-typed-description');
    console.log('BEFORE ENTER:', JSON.stringify(interactiveSummary(extractElements(s1)), null, 2));

    // Press the Return/Enter-equivalent key on the software keyboard
    // (this field's keyboard shows "done" rather than "return").
    const returnKey = await findFresh(client, '//XCUIElementTypeButton[@label="return" or @name="return" or @label="Return" or @name="Return" or @label="done" or @name="done" or @label="Done" or @name="Done"]');
    if (returnKey) {
      await client.elementClick(returnKey);
      await sleep(700);
    } else {
      console.log('No return/done key found on keyboard');
    }
    await screenshot(client, DIR, '08-after-enter');
    const { source: s2 } = await dumpSource(client, DIR, '08-after-enter');
    const afterTexts = interactiveSummary(extractElements(s2));
    console.log('AFTER ENTER/DONE:', JSON.stringify(afterTexts, null, 2));
    console.log('SEND FEEDBACK button present after Enter/Done:', afterTexts.some((e) => e.text === 'SEND FEEDBACK'));

    // Now type more text (simulating continued composition after the
    // keyboard's return key was pressed) to see if the field/keyboard/
    // button end up in a broken state.
    const descField2 = await findFresh(client, '//XCUIElementTypeTextView');
    if (descField2) {
      await client.elementClick(descField2);
      await sleep(400);
      await client.elementSendKeys(descField2, ' more text after done');
      await sleep(500);
      await screenshot(client, DIR, '09-after-typing-more');
      const { source: s3 } = await dumpSource(client, DIR, '09-after-typing-more');
      const finalTexts = interactiveSummary(extractElements(s3));
      console.log('AFTER TYPING MORE:', JSON.stringify(finalTexts, null, 2));
      console.log('SEND FEEDBACK button present after re-typing:', finalTexts.some((e) => e.text === 'SEND FEEDBACK'));
    } else {
      console.log('Could not re-focus description field after Enter/Done -- field may have lost focus/become unreachable.');
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
