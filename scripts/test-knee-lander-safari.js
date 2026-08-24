const WebDriver = require('webdriver');
const { ensureDir } = require('../lib/actions');
const fs = require('fs');
const path = require('path');

const DIR = 'reports/knee-lander-2026-08-24';
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

async function screenshot(client, name) {
  ensureDir(DIR);
  const data = await client.takeScreenshot();
  fs.writeFileSync(path.join(DIR, `${name}.png`), Buffer.from(data, 'base64'));
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
    await new Promise((r) => setTimeout(r, 3000));
    await screenshot(client, '01-initial-load');

    const title = await client.getTitle();
    console.log('PAGE TITLE:', title);

    const bodyText = await client.executeScript('return document.body.innerText', []);
    console.log('BODY TEXT (first 2000 chars):', bodyText.slice(0, 2000));

    // Check for console errors
    const perfEntries = await client.executeScript(
      'return performance.getEntriesByType("resource").filter(r => r.responseStatus >= 400 || r.duration === 0).map(r => r.name)',
      []
    ).catch(() => []);
    console.log('SLOW/FAILED RESOURCES (heuristic):', JSON.stringify(perfEntries));

    // Scroll through the page taking screenshots
    const scrollHeight = await client.executeScript('return document.body.scrollHeight', []);
    const viewportHeight = await client.executeScript('return window.innerHeight', []);
    console.log('scrollHeight:', scrollHeight, 'viewportHeight:', viewportHeight);
    let scrolled = 0;
    let i = 0;
    while (scrolled < scrollHeight - viewportHeight && i < 10) {
      scrolled += viewportHeight;
      await client.executeScript(`window.scrollTo(0, ${scrolled})`, []);
      await new Promise((r) => setTimeout(r, 600));
      await screenshot(client, `02-scroll-${i}`);
      i++;
    }

    // Find all clickable CTAs
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
