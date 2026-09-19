// Retest: session should record ACTUAL elapsed duration, not a hardcoded
// 15 min. Start a 10-min session, end it early after ~2 real minutes via
// END SESSION -> End & Log, then check what Session Log actually records.
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { goToLoginForm, setEmail, setPassword, submitLogin, waitForOutcome, isLoggedIn, findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-duration-2026-08-21';
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

    const sessionsTab = await findFresh(client, '//XCUIElementTypeButton[@label="Sessions" or @name="Sessions"]');
    await client.elementClick(sessionsTab);
    await sleep(1000);
    const { source: sBefore } = await dumpSource(client, DIR, '00-before');
    const before = interactiveSummary(extractElements(sBefore));
    console.log('BEFORE TOTAL TIME:', JSON.stringify(before.find((e) => /Min$/.test(e.text))));

    const homeTab = await findFresh(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]');
    await client.elementClick(homeTab);
    await sleep(800);
    const startBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"START TODAY") or contains(@name,"START TODAY")]');
    await client.elementClick(startBtn);
    await sleep(1000);
    const moveBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Start with MOVE") or contains(@name,"Start with MOVE")]');
    await client.elementClick(moveBtn);
    await sleep(800);
    const kneeBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Target Knee") or contains(@name,"Target Knee")]');
    await client.elementClick(kneeBtn);
    await sleep(400);
    const cont1 = await findFresh(client, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]');
    await client.elementClick(cont1);
    await sleep(1000);
    const tenMin = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"10 minutes") or contains(@name,"10 minutes")]');
    await client.elementClick(tenMin);
    await sleep(500);
    const startSessionBtn = await findFresh(client, '//XCUIElementTypeButton[@label="START SESSION" or @name="START SESSION"]');
    await client.elementClick(startSessionBtn);
    await sleep(1500);
    console.log('10-min session started -- will hold for ~2 real minutes then end early.');

    for (let i = 0; i < 4; i++) {
      await sleep(30000);
      const { source } = await dumpSource(client, DIR, `poll-${i}`);
      const texts = interactiveSummary(extractElements(source)).map((e) => e.text).join(' | ');
      console.log(`poll ${i} (t+${(i + 1) * 30}s):`, texts.slice(0, 150));
    }

    const endBtn = await findFresh(client, '//XCUIElementTypeButton[@label="END SESSION" or @name="END SESSION"]');
    await client.elementClick(endBtn);
    await sleep(1000);
    const endEarlyConfirm = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"End & Log") or contains(@name,"End & Log")]');
    if (endEarlyConfirm) { await client.elementClick(endEarlyConfirm); await sleep(1500); }
    for (let i = 0; i < 4; i++) {
      const skip = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"SKIP") or contains(@name,"SKIP")]');
      if (skip) { await client.elementClick(skip); await sleep(1000); continue; }
      const cont = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE") or contains(@name,"CONTINUE")]');
      if (cont) { await client.elementClick(cont); await sleep(1000); continue; }
      break;
    }
    const sessionsTab2 = await findFresh(client, '//XCUIElementTypeButton[@label="Sessions" or @name="Sessions"]');
    if (sessionsTab2) { await client.elementClick(sessionsTab2); await sleep(1000); }
    await screenshot(client, DIR, '99-after-end-early');
    const { source: sAfter } = await dumpSource(client, DIR, '99-after-end-early');
    console.log('AFTER:', JSON.stringify(interactiveSummary(extractElements(sAfter)), null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
