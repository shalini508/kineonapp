const H = require('./h');
const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const log = (...a) => console.log(`[${ts()}]`, ...a);
async function readDialog(c, tag) {
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"END SESSION")]'); await H.sleep(1500);
  let text = await c.getAlertText().catch(() => null);
  let buttons = await c.executeScript('mobile: alert', [{ action: 'getButtons' }]).catch(() => null);
  if (!text) { // in-app modal instead of a native alert
    const t = await H.texts(c);
    text = t.filter((x) => /count|end anyway|close to|milestone/i.test(x)).join(' | ') || t.slice(1, 8).join(' | ');
    buttons = (await H.vis(c)).filter((e) => /Button/.test(e.type)).map(H.lab).slice(0, 8);
  }
  await H.shot(c, `enddlg-${tag}`);
  log(`END DIALOG (${tag}) text: ${String(text).replace(/\n/g, ' / ')} | buttons: ${JSON.stringify(buttons)}`);
  const keep = (buttons || []).find((b) => /keep|cancel|continue|not now|back/i.test(b));
  if (keep) { await c.executeScript('mobile: alert', [{ action: 'accept', buttonLabel: keep }]).catch(async () => { await H.tapXp(c, `//XCUIElementTypeButton[@label="${keep}"]`); }); log(`tapped "${keep}"`); }
  else log('no keep-going option found');
  await H.sleep(1000);
  log('screen after:', (await H.texts(c)).slice(1, 4).join(' | '));
}
H.run(async (c) => {
  await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(2500);
  for (let i = 0; i < 5 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1000); }
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START TODAY") or @label="Start a new session"]'); await H.sleep(1800);
  await H.tapXp(c, '//*[contains(@label,"Start with RELIEF+")]'); await H.sleep(1800);
  await H.tapXp(c, '//*[@label="Target Glutes"]'); await H.sleep(500);
  await H.tapXp(c, '//XCUIElementTypeButton[@label="CONTINUE"]'); await H.sleep(2500);
  if (await H.has(c, /Close treatment guide/)) { await H.tapXp(c, '//*[contains(@label,"Close treatment guide")]'); await H.sleep(1200); }
  await H.tapXp(c, '//*[@label="Set duration to 1 minute"]'); await H.sleep(500);
  const ok = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START SESSION")]'); const t0 = Date.now();
  log('1-MIN SESSION STARTED:', ok);
  await H.sleep(5000); await readDialog(c, 'early-5s');
  await H.sleep(Math.max(0, t0 + 50000 - Date.now())); await readDialog(c, 'late-50s');
  for (let i = 0; i < 20 && !(await H.has(c, /^Pain \d+$/)); i++) await H.sleep(2000);
  if (await H.has(c, /^Pain \d+$/)) {
    for (const b of ['Pain 3', 'Energy 6', 'Mood 7']) await H.tapXp(c, `//XCUIElementTypeButton[@label="${b}"]`);
    log('session finished; outcomes saved:', await H.tapXp(c, '//XCUIElementTypeButton[@label="SAVE"]'));
    for (let i = 0; i < 5; i++) { await H.sleep(2000); if (await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"SKIP") or contains(@label,"CONTINUE TO DASHBOARD") or @label="Continue"]')) continue; break; }
  } else log('did not reach check-in; screen:', (await H.texts(c)).slice(1, 5).join(' | '));
}).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
