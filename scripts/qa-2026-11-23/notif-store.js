// Ground truth from the simulator's notification store while a 30 s session runs in the background.
const H = require('./h');
const { execSync } = require('child_process');
const K = `${process.env.HOME}/Library/Developer/CoreSimulator/Devices/${H.SIM_UDID}/data/Library/UserNotifications/020E08A4-E1DE-49EB-8526-89BC77AD010C`;
const store = () => {
  const files = execSync(`ls "${K}"`).toString().trim().split('\n');
  const out = {};
  for (const f of files) {
    const txt = execSync(`strings "${K}/${f}" 2>/dev/null || true`).toString();
    out[f] = { sessionComplete: /session-complete|Session complete/.test(txt), qaTest: /QA detector/.test(txt) };
  }
  return JSON.stringify(out);
};
const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
H.run(async (c) => {
  await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(2500);
  if (await H.has(c, /SESSION INTERRUPTED/)) { await H.tapXp(c, '//XCUIElementTypeButton[@label="DISCARD SESSION"]'); await H.sleep(2000); }
  for (let i = 0; i < 4 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1000); }
  console.log(`[${ts()}] STORE BEFORE: ${store()}`);
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START TODAY") or @label="Start a new session"]'); await H.sleep(1800);
  await H.tapXp(c, '//*[contains(@label,"Start with RELIEF+")]'); await H.sleep(1800);
  await H.tapXp(c, '//*[@label="Target Glutes"]'); await H.sleep(500);
  await H.tapXp(c, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]'); await H.sleep(2500);
  if (await H.has(c, /Close treatment guide/)) { await H.tapXp(c, '//*[contains(@label,"Close treatment guide")]'); await H.sleep(1200); }
  if (await H.has(c, /QUICK TIP/)) { await H.tapXp(c, '//XCUIElementTypeButton[@label="GOT IT"]'); await H.sleep(1000); }
  await H.tapXp(c, '//*[@label="Set duration to 30 seconds"]'); await H.sleep(500);
  const ok = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START SESSION")]');
  const t0 = Date.now();
  console.log(`[${ts()}] SESSION STARTED: ${ok}`);
  await H.sleep(3000);
  console.log(`[${ts()}] T+3s (app open, timer running) STORE: ${store()}`);
  await c.executeScript('mobile: pressButton', [{ name: 'home' }]);
  await H.sleep(3000);
  console.log(`[${ts()}] T+${Math.round((Date.now() - t0) / 1000)}s (app in background) STORE: ${store()}`);
  await H.sleep(Math.max(0, t0 + 45000 - Date.now()));
  console.log(`[${ts()}] T+${Math.round((Date.now() - t0) / 1000)}s (15s after planned end) STORE: ${store()}`);
  await H.shot(c, 'store-after-end');
}).catch(e => { console.error('FAILED:', e.message); process.exit(1); });
