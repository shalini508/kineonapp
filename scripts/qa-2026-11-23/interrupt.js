// Interrupted-session check. Usage: KEEP_APP=1 SIM_UDID=... node interrupt.js <reopen-seconds-after-start>
// Starts a 30 s RELIEF+ session, force-quits it at 8 s, reopens after N s, records the screen, then discards.
const H = require('./h');
const reopenAt = parseInt(process.argv[2], 10);
const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const log = (...a) => console.log(`[${ts()}] reopen@${reopenAt}s`, ...a);

H.run(async (c) => {
  await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(2500);
  if (await H.has(c, /SESSION INTERRUPTED/)) { await H.tapXp(c, '//XCUIElementTypeButton[@label="DISCARD SESSION" or @name="DISCARD SESSION"]'); await H.sleep(2000); }
  for (let i = 0; i < 4 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1000); }
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START TODAY") or @label="Start a new session"]'); await H.sleep(1800);
  await H.tapXp(c, '//*[contains(@label,"Start with RELIEF+")]'); await H.sleep(1800);
  await H.tapXp(c, '//*[@label="Target Glutes"]'); await H.sleep(500);
  await H.tapXp(c, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]'); await H.sleep(2500);
  if (await H.has(c, /Close treatment guide/)) { await H.tapXp(c, '//*[contains(@label,"Close treatment guide")]'); await H.sleep(1200); }
  if (await H.has(c, /QUICK TIP/)) { await H.tapXp(c, '//XCUIElementTypeButton[@label="GOT IT"]'); await H.sleep(1000); }
  await H.tapXp(c, '//*[@label="Set duration to 30 seconds"]'); await H.sleep(500);
  const started = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START SESSION")]');
  const t0 = Date.now();
  log('SESSION STARTED:', started, '| start time', ts());
  if (!started) return;
  await H.sleep(8000);
  await c.executeScript('mobile: terminateApp', [{ bundleId: H.BUNDLE }]);
  log(`FORCE-QUIT at T+${Math.round((Date.now() - t0) / 1000)}s`);
  await H.sleep(Math.max(0, t0 + reopenAt * 1000 - Date.now()));
  await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(3500);
  const secs = Math.round((Date.now() - t0) / 1000);
  const t = await H.texts(c);
  const heading = t.find((x) => /Continue your session\?|What happened here\?/.test(x)) || '(no interrupted screen)';
  const body = t.find((x) => /can't be resumed|pick it up where it left off/.test(x)) || '';
  log(`REOPENED at T+${secs}s (${secs - 30}s after planned end) | ${heading} | ${body}`);
  log('DETAILS:', t.filter((x) => /^(STARTED|PLANNED|TIME WE CAN CREDIT|COMPLETED SO FAR|LEFT TO RUN)$/.test(x) || /Nov \d+ at|sec$|^\d+s$/.test(x)).join(' | '));
  await H.shot(c, `interrupt-reopen-${reopenAt}s`);
  if (await H.tapXp(c, '//XCUIElementTypeButton[@label="DISCARD SESSION" or @name="DISCARD SESSION"]')) log('discarded (what-happened screen)');
  else if (await H.tapXp(c, '//XCUIElementTypeButton[@label="END EARLY & LOG" or @name="END EARLY & LOG"]')) {
    await H.sleep(2000);
    log('continue screen: used END EARLY & LOG; now:', (await H.texts(c)).slice(1, 4).join(' | '));
    if (await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"Discard") or contains(@label,"DISCARD")]')) log('discarded');
  }
  await H.sleep(2000);
  log('AFTER CLEANUP:', (await H.texts(c)).slice(1, 3).join(' | '));
}).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
