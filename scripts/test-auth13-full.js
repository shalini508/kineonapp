// AUTH-13, single continuous session: repeatedly go Back from the
// "enter code" screen to the login form and re-trigger "Forgot password?"
// with the same email, to see whether the 60s resend cooldown is purely
// client-side UI state (bypassable by navigating away and back) or
// backed by a real server-side rate limit.
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

    for (let round = 1; round <= 5; round++) {
      const emailField = await findFresh(client, '//XCUIElementTypeTextField');
      if (emailField) {
        await client.elementClear(emailField);
        await client.elementSendKeys(emailField, EMAIL);
      }
      await sleep(300);
      // Dismiss the keyboard (tapping a static label defocuses the text field)
      // -- otherwise the keyboard can swallow the tap on "Forgot password?".
      const welcomeLabel = await findFresh(client, '//XCUIElementTypeStaticText[contains(@label,"WELCOME") or contains(@name,"WELCOME")]');
      if (welcomeLabel) { await client.elementClick(welcomeLabel); await sleep(500); }
      const forgotBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Forgot password") or contains(@name,"Forgot password")]');
      if (!forgotBtn) { console.log(`Round ${round}: no Forgot password button, screen may differ`); break; }
      await client.elementClick(forgotBtn);
      await sleep(1300);
      await screenshot(client, DIR, `round-${round}`);
      const { source } = await dumpSource(client, DIR, `round-${round}`);
      const texts = interactiveSummary(extractElements(source)).map((e) => e.text);
      console.log(`Round ${round}:`, JSON.stringify(texts));

      // Go back to the login form for the next round.
      const backBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Go back") or contains(@name,"Go back")]');
      if (backBtn) { await client.elementClick(backBtn); await sleep(900); }
      // "Go back" may land on the welcome screen rather than the login form directly.
      await goToLoginForm(client);
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
