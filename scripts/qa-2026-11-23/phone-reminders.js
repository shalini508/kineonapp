const H = require('./h');
const footer = async (c) => (await H.texts(c)).find(x => /scheduled on this device/.test(x)) || '(no footer)';
async function toggle(c) { const sw = await c.findElements('xpath', '//XCUIElementTypeSwitch'); if (!sw.length) return false; await c.elementClick(sw[0]['element-6066-11e4-a760-000000000000'] || sw[0].ELEMENT); return true; }
H.run(async (c) => {
  await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(3000);
  console.log('SIGNED IN:', await H.L.isLoggedIn(c), '|', (await H.texts(c)).slice(1, 3).join(' | '));
  if ((await H.texts(c)).some(x => /^Pain \d+$/.test(x))) console.log('NOTE: outcome screen pending');
  for (let i = 0; i < 4 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1000); }
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"Open your profile")]'); await H.sleep(2000);
  await H.tapXp(c, '//*[@label="SETTINGS" or @name="SETTINGS"]'); await H.sleep(2000);
  console.log('REMINDERS ROW:', await H.scrollTap(c, '//*[contains(@label,"Session Reminders")]', 5)); await H.sleep(2000);
  const sw = await c.findElements('xpath', '//XCUIElementTypeSwitch');
  const startVal = sw.length ? await c.getElementAttribute(sw[0]['element-6066-11e4-a760-000000000000'] || sw[0].ELEMENT, 'value') : '?';
  console.log('START | reminders switch:', startVal, '| footer:', await footer(c));
  if (startVal === '0') {
    await toggle(c); await H.sleep(4000);
    console.log('ON | footer:', await footer(c));
    await H.shot(c, 'phone-reminders-on');
    await toggle(c); await H.sleep(3000);
    console.log('RESTORED OFF | footer:', await footer(c));
  }
  for (let i = 0; i < 4 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1000); }
}).catch(e => { console.error('FAILED:', e.message); process.exit(1); });
