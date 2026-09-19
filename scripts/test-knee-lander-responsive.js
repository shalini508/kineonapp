const WebDriver = require('webdriver');
const fs = require('fs');
const path = require('path');

const DIR = 'reports/knee-lander-2026-08-24-responsive';
const URL = 'https://kineon-knee-pain-lander-v1.netlify.app/knee-pain-v1';

const capabilities = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:udid': '00008140-00142C6214EB001C',
  'appium:deviceName': "Shalini's iPhone",
  'appium:platformVersion': '26.6',
  browserName: 'Safari',
  'appium:usePrebuiltWDA': true,
  'appium:showXcodeLog': false,
  'appium:wdaLaunchTimeout': 240000,
  'appium:wdaConnectionTimeout': 240000,
  'appium:newCommandTimeout': 180,
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(client, name) {
  ensureDir(DIR);
  const data = await client.takeScreenshot();
  fs.writeFileSync(path.join(DIR, `${name}.png`), Buffer.from(data, 'base64'));
}

// Human-speed swipe: a real finger swipe with a natural duration (not an
// instant window.scrollTo jump), moving roughly one "screen minus a bit"
// per swipe so nothing gets skipped, then a pause to mimic reading time.
async function humanSwipeUp(client, width, height) {
  const startX = width / 2;
  const startY = height * 0.78;
  const endY = height * 0.28;
  await client.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: startX, y: startY },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 500, x: startX, y: startY - (startY - endY) * 0.4 },
        { type: 'pointerMove', duration: 500, x: startX, y: endY },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
  await client.releaseActions();
}

async function main() {
  ensureDir(DIR);
  const client = await WebDriver.newSession({
    protocol: 'http',
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    logLevel: 'warn',
    connectionRetryTimeout: 240000,
    capabilities,
  });
  try {
    await client.navigateTo(URL);
    await sleep(2500);

    const { width, height } = await client.getWindowRect();
    console.log('Viewport (device points):', width, height);

    // Horizontal-overflow check -- the classic mobile responsiveness bug:
    // some element wider than the viewport forcing unwanted side-scroll.
    const overflowCheck = await client.executeScript(
      `return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        innerWidth: window.innerWidth,
        devicePixelRatio: window.devicePixelRatio,
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content || null
      }`,
      []
    );
    console.log('OVERFLOW/VIEWPORT CHECK:', JSON.stringify(overflowCheck, null, 2));

    await screenshot(client, '00-initial');

    let i = 0;
    let lastScrollY = -1;
    const maxSwipes = 25;
    while (i < maxSwipes) {
      await humanSwipeUp(client, width, height);
      await sleep(900); // pause between swipes, like a person reading

      const scrollY = await client.executeScript('return window.scrollY', []);
      await screenshot(client, `${String(i + 1).padStart(2, '0')}-scrollY-${scrollY}`);
      console.log(`Swipe ${i + 1}: scrollY = ${scrollY}`);

      if (scrollY === lastScrollY) {
        console.log('Reached bottom (scrollY unchanged) -- stopping.');
        break;
      }
      lastScrollY = scrollY;
      i++;
    }

    // Re-check horizontal overflow at the bottom too, in case a
    // late-page element (e.g. a wide table or FAQ block) causes it only
    // once expanded/visible.
    const overflowCheck2 = await client.executeScript(
      `return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }`,
      []
    );
    console.log('OVERFLOW CHECK AT BOTTOM:', JSON.stringify(overflowCheck2, null, 2));

    // Elements wider than viewport, or overflowing off the right edge --
    // another concrete responsiveness signal.
    const offenders = await client.executeScript(
      `return Array.from(document.querySelectorAll('body *')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > window.innerWidth + 2 || r.right > window.innerWidth + 2;
      }).slice(0, 20).map(el => ({
        tag: el.tagName,
        class: el.className,
        width: el.getBoundingClientRect().width,
        right: el.getBoundingClientRect().right,
        text: (el.innerText || '').slice(0, 60)
      }))`,
      []
    );
    console.log('ELEMENTS WIDER THAN VIEWPORT / OVERFLOWING RIGHT EDGE:', JSON.stringify(offenders, null, 2));
  } finally {
    await client.deleteSession();
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
