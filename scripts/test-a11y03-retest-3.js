const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep } = require('../lib/actions');
const { findFresh } = require('../lib/loginActions');

const DIR = 'reports/retest-2026-08-21';

async function main() {
  const client = await startSession({ 'appium:bundleId': 'com.apple.Preferences' });
  ensureDir(DIR);
  try {
    const searchField = await findFresh(client, '//XCUIElementTypeSearchField');
    await client.elementClick(searchField);
    await client.elementSendKeys(searchField, 'Larger Text');
    await sleep(1000);
    const largerTextBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Larger Text, Accessibility")]');
    await client.elementClick(largerTextBtn);
    await sleep(1200);
    await screenshot(client, DIR, 'a11y03-02-larger-text-screen');
    const { source } = await dumpSource(client, DIR, 'a11y03-02-larger-text-screen');
    console.log('LARGER TEXT SCREEN:', JSON.stringify(interactiveSummary(extractElements(source)), null, 2));

    const sliders = await client.findElements('xpath', '//XCUIElementTypeSlider');
    console.log('sliders found:', sliders.length);
    if (sliders.length) {
      const sliderId = sliders[0]['element-6066-11e4-a52e-4042805e5804'] || sliders[0].ELEMENT;
      const rect = await client.getElementRect(sliderId);
      const value = await client.getElementAttribute(sliderId, 'value');
      console.log('Slider rect:', JSON.stringify(rect), 'value:', value);
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
