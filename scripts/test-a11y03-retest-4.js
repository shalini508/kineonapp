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

    // Turn on "Larger Accessibility Sizes" so the slider's max reaches the
    // true largest Dynamic Type category, not just the standard range.
    const accessSwitch = await findFresh(client, '//XCUIElementTypeSwitch[contains(@label,"Larger Accessibility Sizes")]');
    const switchValue = await client.getElementAttribute(accessSwitch, 'value');
    console.log('Accessibility sizes switch currently:', switchValue);
    if (switchValue === '0' || switchValue === false) {
      await client.elementClick(accessSwitch);
      await sleep(800);
    }

    const sliders = await client.findElements('xpath', '//XCUIElementTypeSlider');
    const sliderId = sliders[0]['element-6066-11e4-a52e-4042805e5804'] || sliders[0].ELEMENT;
    const rect = await client.getElementRect(sliderId);
    const valueBefore = await client.getElementAttribute(sliderId, 'value');
    console.log('Slider rect:', JSON.stringify(rect), 'value before:', valueBefore);

    // Drag from the thumb's current position (left edge, since value is
    // low) to the far right edge to max it out. Starting the touch-down
    // AT the thumb is required -- iOS sliders ignore drags that start
    // elsewhere on the track.
    const thumbX = rect.x + 20;
    const midY = rect.y + rect.height / 2;
    const targetX = rect.x + rect.width - 5;
    await client.performActions([
      {
        type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: thumbX, y: midY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 400, x: targetX, y: midY },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await client.releaseActions();
    await sleep(600);
    const valueAfter = await client.getElementAttribute(sliderId, 'value');
    console.log('Slider value after drag:', valueAfter);
    await screenshot(client, DIR, 'a11y03-03-slider-maxed');
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
