// Generalized mobile Safari UI/responsiveness check for the Kineon pain
// landing pages. Usage: node test-lander-mobile-responsive.js <url> <outDir>
const WebDriver = require('webdriver');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2];
const DIR = process.argv[3];
if (!URL || !DIR) {
  console.error('Usage: node test-lander-mobile-responsive.js <url> <outDir>');
  process.exit(1);
}

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

    const title = await client.getTitle();
    console.log('PAGE TITLE:', title);

    const overflowCheck = await client.executeScript(
      `return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        innerWidth: window.innerWidth,
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content || null
      }`,
      []
    );
    console.log('OVERFLOW/VIEWPORT CHECK:', JSON.stringify(overflowCheck, null, 2));

    await screenshot(client, '00-initial');

    let i = 0;
    let lastScrollY = -1;
    const maxSwipes = 40;
    while (i < maxSwipes) {
      await humanSwipeUp(client, width, height);
      await sleep(700);
      const scrollY = await client.executeScript('return window.scrollY', []);
      await screenshot(client, `${String(i + 1).padStart(2, '0')}-scrollY-${scrollY}`);
      console.log(`Swipe ${i + 1}: scrollY = ${scrollY}`);
      if (scrollY === lastScrollY) {
        console.log('Reached bottom -- stopping.');
        break;
      }
      lastScrollY = scrollY;
      i++;
    }

    const offenders = await client.executeScript(
      `return Array.from(document.querySelectorAll('body *')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > window.innerWidth + 2 || r.right > window.innerWidth + 2;
      }).slice(0, 15).map(el => ({
        tag: el.tagName, class: el.className,
        width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right,
        text: (el.innerText || '').slice(0, 60)
      }))`,
      []
    );
    console.log('ELEMENTS WIDER THAN VIEWPORT:', JSON.stringify(offenders, null, 2));

    const imgs = await client.executeScript(
      `return Array.from(document.querySelectorAll('img')).map(img => ({src: img.currentSrc || img.src, complete: img.complete, naturalWidth: img.naturalWidth}))`,
      []
    );
    const brokenImgs = imgs.filter((im) => im.complete && im.naturalWidth === 0);
    console.log('TOTAL IMAGES:', imgs.length, 'GENUINELY BROKEN (complete but 0 width):', JSON.stringify(brokenImgs, null, 2));

    const ctas = await client.executeScript(
      `return Array.from(document.querySelectorAll('a,button')).map(el => ({tag: el.tagName, text: (el.innerText||'').trim(), href: el.href || null})).filter(el => el.text)`,
      []
    );
    console.log('CTAs / LINKS / BUTTONS FOUND:', JSON.stringify(ctas, null, 2));
  } finally {
    await client.deleteSession();
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
