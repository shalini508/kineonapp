// Retest for the "session ended early" messaging bug (Asana 1218215239342778).
//
// Original defect: ending a session before the timer finished still showed a
// success screen -- "SESSION LOGGED / You're at N sessions / great work" --
// even though the session is stored as status="abandoned" and never appears
// in the Session Log. Kundan's 10 Sep build is meant to show "SESSION ENDED
// EARLY" instead and suppress the green checkmark and streak counter.
//
// This drives a real session on the physical device, ends it early on
// purpose, and asserts on what the post-session screens actually say.
//
// Usage: node scripts/test-early-session-message-retest.js

const path = require('path');
const fs = require('fs');
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, sleep, ensureDir } = require('../lib/actions');
const {
  goToLoginForm,
  setEmail,
  setPassword,
  submitLogin,
  waitForOutcome,
  isLoggedIn,
  logOut,
  findFresh,
  dismissSavePasswordPromptIfPresent,
} = require('../lib/loginActions');
const { tapPoint } = require('../lib/logSession');

const EMAIL = process.env.TEST_EMAIL || 'isaacdiaz@yopmail.com';
const PASSWORD = process.env.TEST_PASSWORD;
if (!PASSWORD) {
  console.error('Missing TEST_PASSWORD -- see .env.example');
  process.exit(1);
}
// Long enough to be a real session, short enough to be clearly "early"
// against the 5-minute timer.
const RUN_SECONDS = parseInt(process.env.RUN_SECONDS || '75', 10);

async function tap(client, xpath) {
  const el = await findFresh(client, xpath);
  if (!el) return false;
  try {
    await client.elementClick(el);
    return true;
  } catch (err) {
    if (/stale element|not present in the current view/i.test(err.message || '')) return false;
    throw err;
  }
}

async function visibleTexts(client) {
  const source = await client.getPageSource();
  return extractElements(source)
    .filter((e) => e.visible && (e.label || e.name))
    .map((e) => e.label || e.name);
}

async function dismissOverlays(client, width, height) {
  await dismissSavePasswordPromptIfPresent(client);
  const source = await client.getPageSource();
  // "Skip placement guide" only exists inside the first-run how-to sheet,
  // whose CLOSE button isn't independently addressable (known a11y issue),
  // so it has to be dismissed by position.
  if (source.includes('Skip placement guide')) {
    await tapPoint(client, Math.round(width * 0.5), Math.round(height * 0.936));
    await sleep(1800);
  }
  if (await tap(client, '//XCUIElementTypeButton[@label="GOT IT" or @name="GOT IT"]')) {
    await sleep(1200);
  }
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'reports', `earlysession-retest-${stamp}`);
  ensureDir(outDir);

  const results = { timestamp: stamp, email: EMAIL, checks: [], screens: {} };
  const record = (step, pass, note) => {
    results.checks.push({ step, pass, note });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${step}${note ? ` -- ${note}` : ''}`);
  };

  console.log('Connecting to device...\n');
  const client = await startSession({ 'appium:autoAcceptAlerts': true });

  try {
    await sleep(4000);
    await dismissSavePasswordPromptIfPresent(client);

    // Sign out first if anyone is already signed in. isLoggedIn() only tells
    // us that *a* session exists, not whose -- trusting it once meant a whole
    // run executed as a different test account than the one being verified
    // against the API, which produced a completely bogus result.
    if (await isLoggedIn(client)) {
      console.log('Existing session found -- signing out so we run as the intended account...');
      await logOut(client);
      await sleep(2000);
    }
    console.log(`Logging in as ${EMAIL}...`);
    await goToLoginForm(client);
    await setEmail(client, EMAIL);
    await setPassword(client, PASSWORD);
    await submitLogin(client);
    await waitForOutcome(client, 12000, 500);
    await sleep(1500);
    await dismissSavePasswordPromptIfPresent(client);
    const loggedIn = await isLoggedIn(client);
    record('logged in', loggedIn);
    if (!loggedIn) throw new Error('Could not reach a logged-in state');

    const { width, height } = await client.getWindowRect();

    // --- start a session ---
    await tap(client, '//XCUIElementTypeButton[contains(@label,"START TODAY") or contains(@name,"START TODAY")]');
    await sleep(1800);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Start with MOVE") or contains(@name,"Start with MOVE")]');
    await sleep(1800);
    await tap(client, '//XCUIElementTypeButton[contains(@label,"Target Knee") or contains(@name,"Target Knee")]');
    await sleep(900);
    await tap(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]');
    await sleep(2500);
    await dismissOverlays(client, width, height);

    await tap(client, '//XCUIElementTypeButton[contains(@label,"Set duration to 5 minutes")]');
    await sleep(900);
    const t0 = Date.now();
    const started = await tap(client, '//XCUIElementTypeButton[@label="START SESSION" or @name="START SESSION"]');
    await sleep(3000);
    await dismissOverlays(client, width, height);
    await screenshot(client, outDir, '01-session-running');
    const runningTexts = await visibleTexts(client);
    record('session started', started && runningTexts.some((t) => /Session in Progress/i.test(t)));

    // --- let it run, then END EARLY (this is the whole point) ---
    console.log(`  running ${RUN_SECONDS}s, then ending early...`);
    while ((Date.now() - t0) / 1000 < RUN_SECONDS) {
      await sleep(15000);
      await dismissSavePasswordPromptIfPresent(client);
    }
    const ranSeconds = Math.round((Date.now() - t0) / 1000);

    await tap(client, '//XCUIElementTypeButton[@label="END SESSION" or @name="END SESSION"]');
    await sleep(2000);
    await screenshot(client, outDir, '02-end-confirm');
    await tap(client, '//XCUIElementTypeButton[contains(@label,"End & Log") or contains(@name,"End & Log")]');
    await sleep(3500);
    record('ended session early', true, `${ranSeconds}s of a 5 min session`);

    // --- post-session check-in ---
    await screenshot(client, outDir, '03-post-session-log');
    const checkInTexts = await visibleTexts(client);
    results.screens.checkIn = [...new Set(checkInTexts)];
    record('check-in screen appears', checkInTexts.some((t) => /POST-SESSION LOG|How does it feel/i.test(t)));

    // Scores are configurable so a rerun can use values that don't collide
    // with historical data -- otherwise "the app shows your check-in" is
    // indistinguishable from "the app shows an older identical check-in".
    const PAIN = process.env.PAIN || '3';
    const ENERGY = process.env.ENERGY || '8';
    const MOOD = process.env.MOOD || '8';
    await tap(client, `//XCUIElementTypeButton[@label="Pain ${PAIN}" or @name="Pain ${PAIN}"]`);
    await sleep(400);
    await tap(client, `//XCUIElementTypeButton[@label="Energy ${ENERGY}" or @name="Energy ${ENERGY}"]`);
    await sleep(400);
    await tap(client, `//XCUIElementTypeButton[@label="Mood ${MOOD}" or @name="Mood ${MOOD}"]`);
    await sleep(600);
    results.scores = { pain: PAIN, energy: ENERGY, mood: MOOD };
    await tap(client, '//XCUIElementTypeButton[@label="SAVE" or @name="SAVE"]');
    await sleep(4500);

    // --- THE ASSERTION: what does the confirmation screen say? ---
    await screenshot(client, outDir, '04-confirmation');
    await dumpSource(client, outDir, '04-confirmation');
    const confirmTexts = await visibleTexts(client);
    results.screens.confirmation = [...new Set(confirmTexts)];
    const joined = confirmTexts.join(' | ');

    const saysEndedEarly = /ENDED EARLY|ended early/i.test(joined);
    const saysLogged = /SESSION LOGGED/i.test(joined);
    const saysGreatWork = /great work/i.test(joined);
    const claimsSessionCount = /You're at \d+ session|\d+ session logged today/i.test(joined);

    console.log('\n--- confirmation screen text ---');
    for (const t of results.screens.confirmation) console.log(`   ${t}`);
    console.log('--------------------------------\n');

    record('shows "SESSION ENDED EARLY"', saysEndedEarly);
    record('no longer says "SESSION LOGGED"', !saysLogged, saysLogged ? 'still present' : undefined);
    record('no longer congratulates ("great work")', !saysGreatWork, saysGreatWork ? 'still present' : undefined);
    record('no longer claims a session was counted', !claimsSessionCount, claimsSessionCount ? 'still present' : undefined);

    results.ranSeconds = ranSeconds;
  } finally {
    await endSession(client);
  }

  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
  const failed = results.checks.filter((c) => !c.pass);
  console.log(`\n${results.checks.length - failed.length}/${results.checks.length} checks passed.`);
  if (failed.length) console.log('Failed:', failed.map((f) => f.step).join(', '));
  console.log(`Report: ${outDir}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Retest crashed:', err);
  process.exitCode = 1;
});
