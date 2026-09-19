// AUTH-13: repeated password-reset requests should be rate-limited.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, isLoggedIn, logOut, findFresh } = require('../lib/loginActions');

const DIR = 'reports/new-account-auth13';
const EMAIL = 's1@yopmail.com';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (await isLoggedIn(client)) { await logOut(client); await sleep(1000); }
    await goToLoginForm(client);

    const emailField = await findFresh(client, '//XCUIElementTypeTextField');
    if (emailField) {
      await client.elementClear(emailField);
      await client.elementSendKeys(emailField, EMAIL);
    }
    await sleep(400);
    await screenshot(client, DIR, '03-email-filled');

    const forgotBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Forgot password") or contains(@name,"Forgot password")]');
    await client.elementClick(forgotBtn);
    await sleep(1200);
    await screenshot(client, DIR, '02-forgot-password-screen');
    const { source } = await dumpSource(client, DIR, '02-forgot-password-screen');
    console.log('SCREEN:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));

    for (let i = 1; i <= 5; i++) {
      const submitBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"RESET") or contains(@name,"RESET") or contains(@label,"SEND") or contains(@name,"SEND") or contains(@label,"CONTINUE") or contains(@name,"CONTINUE")]');
      if (!submitBtn) { console.log(`Attempt ${i}: no submit button found`); break; }
      await client.elementClick(submitBtn);
      await sleep(900);
      await screenshot(client, DIR, `04-attempt-${i}`);
      const { source: s2 } = await dumpSource(client, DIR, `04-attempt-${i}`);
      const texts = interactiveSummary(extractElements(s2)).map((e) => e.text);
      console.log(`Attempt ${i} screen texts:`, JSON.stringify(texts));
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
