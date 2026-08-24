// Clean, controlled retest: start a 10-min session, stay connected
// (no interruption), end it early via END SESSION -> End & Log after a
// known ~60s of real elapsed time, and check exactly how many minutes
// get recorded.
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
    const { source: sBefore } = await dumpSource(client, DIR, 'clean-00-before');
    const before = interactiveSummary(extractElements(sBefore));
    const beforeTotal = before.find((e) => /Min$/.test(e.text));
    console.log('BEFORE TOTAL TIME:', JSON.stringify(beforeTotal));

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
    const t0 = Date.now();
    await client.elementClick(startSessionBtn);
    await sleep(1500);
    console.log('Session started at', new Date(t0).toISOString());

    // Stay connected, poll a few times (well under newCommandTimeout),
    // for ~65 real seconds total.
    for (let i = 0; i < 4; i++) {
      await sleep(15000);
      const { source } = await dumpSource(client, DIR, `clean-poll-${i}`);
      const texts = interactiveSummary(extractElements(source)).map((e) => e.text);
      const remaining = texts.find((t) => /^\d+:\d+$/.test(t));
      console.log(`poll ${i} (t+${(i + 1) * 15}s real): remaining shown =`, remaining);
    }
    const elapsedRealSeconds = (Date.now() - t0) / 1000;
    console.log('Actual real elapsed seconds before ending:', elapsedRealSeconds.toFixed(1));

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
    await screenshot(client, DIR, 'clean-99-after');
    const { source: sAfter } = await dumpSource(client, DIR, 'clean-99-after');
    const after = interactiveSummary(extractElements(sAfter));
    console.log('AFTER TOTAL TIME:', JSON.stringify(after.find((e) => /Min$/.test(e.text))));
    console.log('FULL AFTER SCREEN:', JSON.stringify(after, null, 2));
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
