// Headless Chrome UI/responsiveness check for a landing page, in both a
// mobile-emulated viewport and a desktop viewport.
// Usage: node test-lander-headless.js <url> <outDir>
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2];
const DIR = process.argv[3];
if (!URL || !DIR) {
  console.error('Usage: node test-lander-headless.js <url> <outDir>');
  process.exit(1);
}

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// iPhone 16-ish mobile viewport (matches the physical device we test on
// elsewhere), and a common 1440x900 desktop viewport.
const VIEWPORTS = {
  mobile: { width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
};

async function humanScroll(page, subdir, label) {
  ensureDir(path.join(DIR, subdir));
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  let i = 0;
  let lastY = -1;
  const maxSteps = 40;
  while (i < maxSteps) {
    await page.evaluate((step) => window.scrollBy(0, step), Math.round(viewportHeight * 0.72));
    await sleep(500); // pause between steps, like a person reading
    const y = await page.evaluate(() => window.scrollY);
    await page.screenshot({ path: path.join(DIR, subdir, `${String(i + 1).padStart(2, '0')}-scrollY-${y}.png`) });
    console.log(`[${label}] step ${i + 1}: scrollY = ${y}`);
    if (y === lastY) {
      console.log(`[${label}] reached bottom -- stopping.`);
      break;
    }
    lastY = y;
    i++;
  }
}

async function checkViewport(page, label) {
  const check = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
    viewportMeta: document.querySelector('meta[name="viewport"]')?.content || null,
  }));
  console.log(`[${label}] OVERFLOW/VIEWPORT CHECK:`, JSON.stringify(check));

  const offenders = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > window.innerWidth + 2 || r.right > window.innerWidth + 2;
      })
      .slice(0, 15)
      .map((el) => ({
        tag: el.tagName,
        class: el.className,
        width: el.getBoundingClientRect().width,
        right: el.getBoundingClientRect().right,
        text: (el.innerText || '').slice(0, 60),
      }));
  });
  console.log(`[${label}] ELEMENTS WIDER THAN VIEWPORT:`, JSON.stringify(offenders, null, 2));

  const imgs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img')).map((img) => ({
      src: img.currentSrc || img.src,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
    }))
  );
  const brokenImgs = imgs.filter((im) => im.complete && im.naturalWidth === 0);
  console.log(`[${label}] TOTAL IMAGES:`, imgs.length, 'BROKEN:', JSON.stringify(brokenImgs));

  const consoleErrors = page.__consoleErrors || [];
  console.log(`[${label}] CONSOLE ERRORS:`, JSON.stringify(consoleErrors));
}

async function testViewport(browser, label, viewportOpts) {
  const page = await browser.newPage();
  page.__consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') page.__consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => page.__consoleErrors.push(String(err)));
  page.on('requestfailed', (req) => {
    page.__consoleErrors.push(`REQUEST FAILED: ${req.url()} (${req.failure()?.errorText})`);
  });

  await page.setViewport({
    width: viewportOpts.width,
    height: viewportOpts.height,
    deviceScaleFactor: viewportOpts.deviceScaleFactor,
    isMobile: viewportOpts.isMobile,
    hasTouch: viewportOpts.hasTouch,
  });
  if (viewportOpts.userAgent) {
    await page.setUserAgent(viewportOpts.userAgent);
  }

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);

  const title = await page.title();
  console.log(`[${label}] PAGE TITLE:`, title);

  ensureDir(DIR);
  await page.screenshot({ path: path.join(DIR, `${label}-00-initial.png`) });

  await checkViewport(page, label);
  await humanScroll(page, label, label);

  const ctas = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a,button'))
      .map((el) => ({ tag: el.tagName, text: (el.innerText || '').trim(), href: el.href || null }))
      .filter((el) => el.text)
  );
  console.log(`[${label}] CTAs / LINKS / BUTTONS FOUND:`, JSON.stringify(ctas, null, 2));

  await page.close();
}

async function main() {
  ensureDir(DIR);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });
  try {
    await testViewport(browser, 'mobile', VIEWPORTS.mobile);
    await testViewport(browser, 'desktop', VIEWPORTS.desktop);
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
