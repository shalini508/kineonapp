// Device training popup (Asana 1217727634653799): first-time guide after Continue shows once per body part,
// and "?" (How to place your device) still opens it afterwards. No session is started.
const H = require('./h');
const log = (...a) => console.log(...a);
async function toBodyParts(c, device) {
  for (let i = 0; i < 5 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1000); }
  await H.tapXp(c, '//XCUIElementTypeButton[contains(@label,"START TODAY") or @label="Start a new session"]'); await H.sleep(1800);
  await H.tapXp(c, `//*[contains(@label,"Start with ${device}")]`); await H.sleep(1800);
}
async function tryPart(c, device, part, tag) {
  await toBodyParts(c, device);
  await H.scrollTap(c, `//*[@label="Target ${part}"]`, 6); await H.sleep(500);
  await H.tapXp(c, '//XCUIElementTypeButton[@label="CONTINUE"]'); await H.sleep(2500);
  const guide = await H.has(c, /TREATMENT GUIDE/);
  const title = guide ? (await H.texts(c)).find((x) => x === part || x === part.replace(/ & .*/, '')) || '?' : '';
  await H.shot(c, `popup-${tag}`);
  log(`${tag}: ${device} ${part} -> guide after Continue: ${guide}${guide ? ` (title "${title}")` : ''}`);
  if (guide) { await H.tapXp(c, '//*[contains(@label,"Close treatment guide")]'); await H.sleep(1200); }
  if (await H.has(c, /quick tip/i)) { await H.tapXp(c, '//XCUIElementTypeButton[@label="GOT IT"]'); await H.sleep(1000); }
  return guide;
}
H.run(async (c) => {
  const li = await H.login(c, 'day65@yopmail.com', process.env.DAY65_PW);
  log('LOGIN:', JSON.stringify(li));
  await tryPart(c, 'RELIEF+', 'Quads', '1-quads-first');
  await tryPart(c, 'RELIEF+', 'Quads', '2-quads-second');
  log('3-quads-? icon opens guide:', (await H.tapXp(c, '//*[@label="How to place your device"]')) && (await H.sleep(2000), await H.has(c, /TREATMENT GUIDE/)));
  await H.shot(c, 'popup-3-quads-qicon');
  await H.tapXp(c, '//*[contains(@label,"Close treatment guide")]'); await H.sleep(1000);
  await tryPart(c, 'MOVE+', 'Knee', '4-move-knee-first');
  await tryPart(c, 'MOVE+', 'Knee', '5-move-knee-second');
  for (let i = 0; i < 5 && !(await H.has(c, /Open your profile/)); i++) { await H.back(c); await H.sleep(1000); }
}).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
