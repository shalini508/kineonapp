// Session-ended reminder checks (Asana 1220481192800649). Usage: KEEP_APP=1 SIM_UDID=... node rem.js A|B|C
//  A: log outcomes right after the session -> no reminder
//  B: close the app mid-session without logging -> reminder arrives; then log -> reminder cleared, no duplicate
//  C: force-quit mid-session, reopen and log -> no reminder
const H = require('./h');
const sc = process.argv[2];
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${sc}`, ...a);
// A Kineon notification in Notification Centre / on the Home screen (not the app icon label "Kineon").
// Notification cells read "KINEON, now, <title>, <body>"; ignore the QA detector test push.
const isKineonNotif = (x) => /^KINEON, /.test(x) && !/QA detector test/.test(x);
const onOutcome = async (c) => (await H.texts(c)).some((x) => /^Pain \d+$/.test(x));

async function saveOutcomes(c) {
  for (const b of ['Pain 3', 'Energy 6', 'Mood 7']) await H.tapXp(c, `//XCUIElementTypeButton[@label="${b}"]`);
  const saved = await H.tapXp(c, '//XCUIElementTypeButton[@label="SAVE" or @name="SAVE"]');
  log('OUTCOMES SAVED:', saved);
  for (let i = 0; i < 6; i++) {
    await H.sleep(2000);
    if (await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"SKIP")]')) continue;
    if (await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"CONTINUE TO DASHBOARD") or @label="Continue" or @label="CONTINUE"]')) continue;
    if (await H.has(c, /Open your profile/)) break;
  }
}
async function waitOutcome(c, ms) { const end = Date.now() + ms; while (Date.now() < end) { if (await onOutcome(c)) return true; await H.sleep(2500); } return false; }
async function notifs(c, tag) { const t = await H.notificationTexts(c, `${sc}-${tag}`); return [...new Set(t.filter(isKineonNotif))]; }

async function start(c) {
  await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(2000);
  if (await onOutcome(c)) { log('cleanup: saving a pending outcome screen'); await saveOutcomes(c); }
  if (await H.has(c, /SESSION LOGGED/)) {
    const exitBtn = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"DASHBOARD") or contains(@label,"DONE") or contains(@label,"Done") or @label="Home" or contains(@label,"CONTINUE") or @label="Close"]');
    if (!exitBtn) log('SESSION LOGGED screen buttons:', (await H.vis(c)).filter((e) => /Button/.test(e.type)).map(H.lab).join(' | '));
    await H.sleep(1500);
  }
  for (let i = 0; i < 4 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1000); }
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START TODAY") or @label="Start a new session"]'); await H.sleep(1800);
  await H.tapXp(c, '//*[contains(@label,"Start with RELIEF+")]'); await H.sleep(1800);
  await H.tapXp(c, '//*[@label="Target Glutes"]'); await H.sleep(500);
  await H.tapXp(c, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]'); await H.sleep(2500);
  if (await H.has(c, /Close treatment guide/)) { await H.tapXp(c, '//*[contains(@label,"Close treatment guide")]'); await H.sleep(1200); }
  if (await H.has(c, /QUICK TIP/)) { await H.tapXp(c, '//XCUIElementTypeButton[@label="GOT IT"]'); await H.sleep(1000); }
  await H.tapXp(c, '//*[@label="Set duration to 30 seconds"]'); await H.sleep(500);
  if (await H.has(c, /quick tip/i)) { await H.tapXp(c, '//XCUIElementTypeButton[@label="GOT IT" or @label="Got it"]'); await H.sleep(1000); }
  const ok = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START SESSION")]');
  if (!ok) { log('START FAILED; screen:', (await H.texts(c)).slice(1, 12).join(' | ')); await H.shot(c, 'start-failed'); }
  log('30s SESSION STARTED:', ok);
  return Date.now();
}

H.run(async (c) => {
  const before = await notifs(c, 'before');
  log('KINEON NOTIFS BEFORE:', before.length);
  const t0 = await start(c);

  if (sc === 'A') {
    log('OUTCOME SCREEN AT END (app open):', await waitOutcome(c, 60000));
    await saveOutcomes(c);
    await c.executeScript('mobile: pressButton', [{ name: 'home' }]);
    log('app backgrounded; waiting 90s');
    await H.sleep(90000);
    const after = await notifs(c, 'after');
    log('KINEON NOTIFS AFTER:', after.length, after.slice(0, 2).join(' || '));
    log('RESULT A (expect none):', after.length <= before.length ? 'PASS' : 'FAIL');
  }

  if (sc === 'B') {
    await H.sleep(3000);
    await c.executeScript('mobile: pressButton', [{ name: 'home' }]); await H.sleep(2000);
    log('app backgrounded mid-session; watching the Home screen for a banner');
    const banners = new Set();
    while (Date.now() < t0 + 330000) { // session ends at t0+30s; watch 5 more minutes
      (await H.texts(c)).filter(isKineonNotif).forEach((x) => { if (!banners.has(x)) { banners.add(x); log('BANNER at T+' + Math.round((Date.now() - t0) / 1000) + 's:', x.slice(0, 200)); } });
      await H.sleep(1500);
    }
    const after = await notifs(c, 'after-end');
    log('KINEON NOTIFS IN NOTIFICATION CENTRE:', after.length, after.slice(0, 2).join(' || '));
    log('RESULT B1 (expect a reminder):', (banners.size > 0 || after.length > before.length) ? 'PASS' : 'FAIL');
    await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(3000);
    log('app reopened; outcome screen:', await waitOutcome(c, 10000));
    if (await onOutcome(c)) await saveOutcomes(c);
    await H.sleep(5000);
    const cleared = await notifs(c, 'after-log');
    log('KINEON NOTIFS AFTER LOGGING:', cleared.length, cleared.slice(0, 2).join(' || '));
    log('RESULT B2 (expect reminder cleared, no duplicate):', cleared.length <= before.length ? 'PASS' : 'FAIL');
  }

  if (sc === 'C') {
    await H.sleep(8000);
    await c.executeScript('mobile: terminateApp', [{ bundleId: H.BUNDLE }]);
    log('app force-closed mid-session');
    await H.sleep(3000);
    await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(4000);
    log('reopened, screen:', (await H.texts(c)).slice(1, 6).join(' | '));
    await H.shot(c, 'rem-C-reopened');
    if (await H.has(c, /SESSION INTERRUPTED/)) { log('RESUME SESSION:', await H.tapXp(c, '//XCUIElementTypeButton[@label="RESUME SESSION" or @name="RESUME SESSION"]')); }
    const got = await waitOutcome(c, 60000);
    log('outcome screen after reopen:', got);
    if (got) await saveOutcomes(c);
    await c.executeScript('mobile: pressButton', [{ name: 'home' }]);
    const banners = new Set();
    while (Date.now() < t0 + 330000) {
      (await H.texts(c)).filter(isKineonNotif).forEach((x) => { if (!banners.has(x)) { banners.add(x); log('BANNER:', x.slice(0, 200)); } });
      await H.sleep(1500);
    }
    const after = await notifs(c, 'after');
    log('KINEON NOTIFS AFTER:', after.length, after.slice(0, 2).join(' || '));
    log('RESULT C (expect none):', (banners.size === 0 && after.length <= before.length) ? 'PASS' : 'FAIL');
  }
}).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
