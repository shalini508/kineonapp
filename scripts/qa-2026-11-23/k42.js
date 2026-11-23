// Kundan's build-42 checks on the phone + recovery-screen bug recheck.
const H = require('./h');
const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const log = (...a) => console.log(`[${ts()}]`, ...a);
const onOutcome = async (c) => (await H.texts(c)).some((x) => /^Pain \d+$/.test(x));

async function toHome(c) {
  await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(2500);
  if (await H.has(c, /SESSION INTERRUPTED/)) { await H.tapXp(c, '//XCUIElementTypeButton[@label="DISCARD SESSION"]'); await H.sleep(2000); }
  for (let i = 0; i < 5 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1000); }
}
async function startRelief(c, part, durLabel) {
  await toHome(c);
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START TODAY") or @label="Start a new session"]'); await H.sleep(1800);
  await H.tapXp(c, '//*[contains(@label,"Start with RELIEF+")]'); await H.sleep(1800);
  await H.scrollTap(c, `//*[@label="Target ${part}"]`, 6); await H.sleep(500);
  await H.tapXp(c, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]'); await H.sleep(2500);
  if (await H.has(c, /Close treatment guide/)) { await H.tapXp(c, '//*[contains(@label,"Close treatment guide")]'); await H.sleep(1200); }
  if (await H.has(c, /quick tip/i)) { await H.tapXp(c, '//XCUIElementTypeButton[@label="GOT IT" or @label="Got it"]'); await H.sleep(1000); }
  await H.tapXp(c, `//*[@label="${durLabel}"]`); await H.sleep(500);
  const ok = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START SESSION")]');
  return { ok, t0: Date.now() };
}
async function saveOutcomes(c) {
  for (const b of ['Pain 3', 'Energy 6', 'Mood 7']) await H.tapXp(c, `//XCUIElementTypeButton[@label="${b}"]`);
  const saved = await H.tapXp(c, '//XCUIElementTypeButton[@label="SAVE"]');
  for (let i = 0; i < 6; i++) {
    await H.sleep(2000);
    if (await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"SKIP")]')) continue;
    if (await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"CONTINUE TO DASHBOARD") or @label="Continue" or @label="CONTINUE"]')) continue;
    if (await H.has(c, /Open your profile/)) break;
  }
  return saved;
}
async function endDialog(c, tag) {
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"END SESSION")]'); await H.sleep(1500);
  const t = await H.texts(c);
  const msg = t.filter((x) => /close to making|won.t count|end anyway|milestone|End & Log|Keep going/i.test(x));
  await H.shot(c, `end-dialog-${tag}`);
  log(`END DIALOG (${tag}):`, [...new Set(msg)].join(' | ') || t.slice(1, 8).join(' | '));
  // keep the session running
  if (!(await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"Keep going") or contains(@label,"KEEP GOING") or @label="Cancel" or contains(@label,"Continue session")]'))) {
    log('no keep-going button found; buttons:', (await H.vis(c)).filter((e) => /Button/.test(e.type)).map(H.lab).join(' | '));
  }
  await H.sleep(800);
}

H.run(async (c) => {
  // 1 + 3: Calf 30 s run to completion; header on the check-in; 30s in totals
  let { ok, t0 } = await startRelief(c, 'Calf', 'Set duration to 30 seconds');
  log('CALF 30s SESSION STARTED:', ok);
  while (Date.now() < t0 + 60000 && !(await onOutcome(c))) await H.sleep(2000);
  const hdr = (await H.texts(c)).filter((x) => /·|MEDITATION|Meditation|SEC|MIN/.test(x) && x.length < 40);
  log('CHECK-IN HEADER CANDIDATES:', [...new Set(hdr)].join(' | '));
  await H.shot(c, 'checkin-header');
  log('SAVED:', await saveOutcomes(c));
  await H.tab(c, 'Sessions'); await H.sleep(2000);
  const rows = (await H.texts(c)).filter((x) => /^(Calf|Glutes|Knee|Foot|Gut)$|SESSION|^\d+m|^\d+s$|^\d+m \d+s$/.test(x));
  log('SESSION LOG ROWS:', rows.slice(0, 24).join(' | '));
  await H.shot(c, 'session-log-totals');

  // 2: end-early dialog early vs near the end (1-minute session; cancel both times)
  ({ ok, t0 } = await startRelief(c, 'Glutes', 'Set duration to 1 minute'));
  log('1-MIN SESSION STARTED:', ok);
  await H.sleep(5000); await endDialog(c, 'early-5s');
  await H.sleep(Math.max(0, t0 + 50000 - Date.now())); await endDialog(c, 'late-50s');
  while (Date.now() < t0 + 90000 && !(await onOutcome(c))) await H.sleep(2000);
  log('1-MIN SESSION REACHED CHECK-IN:', await onOutcome(c));
  if (await onOutcome(c)) log('SAVED:', await saveOutcomes(c));

  // 4: recovery screen after the planned end
  ({ ok, t0 } = await startRelief(c, 'Glutes', 'Set duration to 30 seconds'));
  log('RECOVERY TEST SESSION STARTED:', ok);
  await H.sleep(8000);
  await c.executeScript('mobile: terminateApp', [{ bundleId: H.BUNDLE }]);
  await H.sleep(Math.max(0, t0 + 60000 - Date.now()));
  await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(3500);
  const secs = Math.round((Date.now() - t0) / 1000);
  const t = await H.texts(c);
  log(`RECOVERY SCREEN at T+${secs}s (${secs - 30}s after planned end):`, t.find((x) => /Continue your session\?|What happened here\?/.test(x)) || '(none)', '|', t.find((x) => /can't be resumed|pick it up/.test(x)) || '');
  await H.shot(c, 'recovery-42');
  if (await H.tapXp(c, '//XCUIElementTypeButton[@label="DISCARD SESSION"]')) log('discarded');
}).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
