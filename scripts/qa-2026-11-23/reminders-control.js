const H = require('./h');
const { execSync } = require('child_process');
const K = `${process.env.HOME}/Library/Developer/CoreSimulator/Devices/${H.SIM_UDID}/data/Library/UserNotifications/020E08A4-E1DE-49EB-8526-89BC77AD010C`;
const store = () => execSync(`ls "${K}"`).toString().trim().replace(/\n/g, ', ');
const footer = async (c) => (await H.texts(c)).find(x => /scheduled on this device/.test(x)) || '(no footer)';
async function toggle(c) {
  const sw = await c.findElements('xpath', '//XCUIElementTypeSwitch');
  if (sw.length) { await c.elementClick(sw[0]['element-6066-11e4-a760-000000000000'] || sw[0].ELEMENT); return 'switch'; }
  await c.performActions([{ type: 'pointer', id: 't', parameters: { pointerType: 'touch' }, actions: [
    { type: 'pointerMove', duration: 0, x: 344, y: 231 }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 80 }, { type: 'pointerUp', button: 0 }] }]);
  await c.releaseActions().catch(() => {});
  return 'coordinates';
}
H.run(async (c) => {
  console.log('BEFORE | footer:', await footer(c), '| store:', store());
  console.log('TOGGLE ON via', await toggle(c)); await H.sleep(4000);
  if (await H.tapXp(c, '//XCUIElementTypeButton[@label="Allow" or @name="Allow"]')) { console.log('allowed permission prompt'); await H.sleep(2000); }
  console.log('AFTER ON | footer:', await footer(c), '| store:', store());
  await H.shot(c, 'reminders-on');
  console.log('TOGGLE OFF via', await toggle(c)); await H.sleep(3000);
  console.log('AFTER OFF | footer:', await footer(c), '| store:', store());
}).catch(e => { console.error('FAILED:', e.message); process.exit(1); });
