// General navigation pass on one simulator. Usage: SIM_UDID=... SIM_TAG=se DAY65_PW=... node navpass.js
// Logs one RESULT line per screen: whether it opened, and any elements running past the screen edge.
const H = require('./h');
const results = [];
async function check(c, name, opened, extra = '') {
  await H.sleep(800);
  await H.shot(c, name);
  const off = await H.offscreen(c);
  results.push({ name, opened, off });
  console.log(`RESULT ${H.TAG} | ${name} | opened: ${opened} | offscreen: ${off.length ? off.slice(0, 4).join(' ; ') : 'none'}${extra ? ' | ' + extra : ''}`);
}

H.run(async (c) => {
  const li = await H.login(c, 'day65@yopmail.com', process.env.DAY65_PW);
  await check(c, '01-home', await H.has(c, /Open your profile/), `login ${JSON.stringify(li)}`);

  // Sessions tab + Log a past session form
  await check(c, '02-sessions', (await H.tab(c, 'Sessions')) && (await H.has(c, /Session Log/)));
  const lp = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"Log a past")]'); await H.sleep(1800);
  await check(c, '03-log-past-session', lp && (await H.has(c, /Log session/)));
  await H.back(c); await H.sleep(1200);

  // Learn: MOVE+, RELIEF+, a guide, the science article, a lesson
  await check(c, '04-learn-move', (await H.tab(c, 'Learn')) && (await H.has(c, /Your guide to MOVE\+/)));
  const rs = await H.tapXp(c, '//*[@label="RELIEF+" or @name="RELIEF+"]'); await H.sleep(1800);
  await check(c, '05-learn-relief', rs && (await H.has(c, /RELIEF\+/)));
  await H.tapXp(c, '//*[@label="MOVE+" or @name="MOVE+"]'); await H.sleep(1500);
  const g = await H.scrollTap(c, '//*[@label="Open the Knee treatment guide"]', 4); await H.sleep(2000);
  await check(c, '06-guide-knee', g && (await H.has(c, /TREATMENT GUIDE/)));
  await H.back(c); await H.sleep(1500);
  const art = await H.scrollTap(c, '//*[contains(@label,"The science behind light therapy. Read all")]', 10); await H.sleep(2500);
  await check(c, '07-science-list', art);
  const card = await H.scrollTap(c, '//*[@label="The science behind light therapy"]', 8); await H.sleep(2500);
  await check(c, '08-science-article', card);
  await H.back(c); await H.sleep(1200); await H.back(c); await H.sleep(1500);
  await H.tab(c, 'Learn');
  const les = await H.scrollTap(c, '//*[starts-with(@label,"Lesson 2")]', 12); await H.sleep(2500);
  await check(c, '09-lesson-2', les && (await H.has(c, /Lesson 2 of 5/)));
  await H.back(c); await H.sleep(1500);

  // Shop
  await check(c, '10-shop', await H.tab(c, 'Shop'));

  // New session setup (no session is started)
  await H.tab(c, 'Home');
  const st = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START TODAY") or @label="Start a new session"]'); await H.sleep(2000);
  await check(c, '11-device-picker', st && (await H.has(c, /Pick your device/)));
  await H.tapXp(c, '//*[contains(@label,"Start with RELIEF+")]'); await H.sleep(1800);
  await check(c, '12-relief-body-parts', await H.has(c, /Where does it hurt/));
  await H.tapXp(c, '//*[@label="Target Calf"]'); await H.sleep(500);
  await H.tapXp(c, '//XCUIElementTypeButton[@label="CONTINUE" or @name="CONTINUE"]'); await H.sleep(2500);
  const guideShown = await H.has(c, /TREATMENT GUIDE/);
  await check(c, '13-after-continue', true, `guide shown: ${guideShown}`);
  if (guideShown) { await H.tapXp(c, '//*[contains(@label,"Close treatment guide")]'); await H.sleep(1500); }
  const tip = await H.has(c, /QUICK TIP/);
  if (tip) { await H.shot(c, '13b-quick-tip'); await H.tapXp(c, '//XCUIElementTypeButton[@label="GOT IT" or @name="GOT IT"]'); await H.sleep(1200); }
  console.log(`NOTE ${H.TAG} | quick tip overlay shown after guide: ${tip}`);
  await check(c, '14-set-time', await H.has(c, /Set your time/));
  for (let i = 0; i < 5 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1200); }

  // Profile, View sessions, Settings, Help Center, Feedback
  await H.tab(c, 'Home');
  const pr = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"Open your profile")]'); await H.sleep(2000);
  await check(c, '15-profile', pr && (await H.has(c, /sessions logged/)));
  const vs = await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"sessions logged")]'); await H.sleep(2200);
  await check(c, '16-view-sessions', vs && (await H.has(c, /Session Log/)));
  await H.tab(c, 'Home');
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"Open your profile")]'); await H.sleep(2000);
  const se = await H.tapXp(c, '//*[@label="SETTINGS" or @name="SETTINGS"]'); await H.sleep(2000);
  await check(c, '17-settings', se && (await H.has(c, /PREFERENCES|APPEARANCE/)));
  await H.back(c); await H.sleep(1500);
  const hc = await H.tapXp(c, '//*[contains(@label,"HELP CENTER")]'); await H.sleep(2200);
  await check(c, '18-help-center', hc);
  await H.back(c); await H.sleep(1500);
  const fb = await H.tapXp(c, '//*[contains(@label,"SEND FEEDBACK")]'); await H.sleep(2200);
  await check(c, '19-feedback', fb);
  await H.back(c); await H.sleep(1200);

  const bad = results.filter((r) => !r.opened || r.off.length);
  console.log(`SUMMARY ${H.TAG}: ${results.length} screens, ${results.filter((r) => r.opened).length} opened, ${results.filter((r) => r.off.length).length} with off-screen elements; issues: ${bad.map((r) => r.name).join(', ') || 'none'}`);
}).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
