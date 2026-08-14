// Exploratory pass over the Kineon Move+ app: walks every tab in the tab
// bar, captures a screenshot + page source + a list of visible text/buttons
// for each (before and after one scroll-down), and writes a report.
//
// Usage: node scripts/explore.js

const path = require('path');
const fs = require('fs');
const { startSession, endSession } = require('../lib/session');
const {
  screenshot,
  dumpSource,
  extractElements,
  interactiveSummary,
  getTabBarLabels,
  tapByLabel,
  swipeUp,
  sleep,
  ensureDir,
} = require('../lib/actions');

async function captureScreen(client, outDir, label) {
  await screenshot(client, outDir, label);
  const { source } = await dumpSource(client, outDir, label);
  const elements = extractElements(source);
  const summary = interactiveSummary(elements);
  return summary;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'reports', stamp);
  ensureDir(outDir);

  console.log('Starting session...');
  const client = await startSession();
  const report = { timestamp: stamp, screens: [] };

  try {
    await sleep(3000); // let the splash screen clear
    console.log('Capturing initial screen...');
    const initialSummary = await captureScreen(client, outDir, '00-initial');
    report.screens.push({ label: 'initial', elements: initialSummary });

    const tabLabels = await getTabBarLabels(client);
    console.log(`Found ${tabLabels.length} tab bar button(s):`, tabLabels);

    for (let i = 0; i < tabLabels.length; i++) {
      const label = tabLabels[i];
      const safeLabel = (label || `tab-${i}`).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      console.log(`Tapping tab: ${label}`);
      try {
        await tapByLabel(client, label); // re-locates fresh, avoids stale elements
      } catch (err) {
        console.warn(`  Could not tap tab "${label}":`, err.message);
        continue;
      }
      await sleep(1500);

      const beforeScroll = await captureScreen(client, outDir, `${String(i + 1).padStart(2, '0')}-${safeLabel}-a`);
      report.screens.push({ label: `${label} (top)`, elements: beforeScroll });

      try {
        await swipeUp(client);
        await sleep(800);
        const afterScroll = await captureScreen(client, outDir, `${String(i + 1).padStart(2, '0')}-${safeLabel}-b`);
        report.screens.push({ label: `${label} (scrolled)`, elements: afterScroll });
      } catch (err) {
        console.warn(`  Scroll capture failed for "${label}":`, err.message);
      }
    }
  } finally {
    await endSession(client);
  }

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const md = ['# Exploratory test report', '', `Run: ${stamp}`, ''];
  for (const screen of report.screens) {
    md.push(`## ${screen.label}`);
    if (screen.elements.length === 0) {
      md.push('_No visible text/button elements detected._');
    } else {
      for (const el of screen.elements) {
        md.push(`- [${el.type.replace('XCUIElementType', '')}] ${el.text}`);
      }
    }
    md.push('');
  }
  fs.writeFileSync(path.join(outDir, 'report.md'), md.join('\n'));

  console.log(`\nDone. Report written to: ${outDir}`);
}

main().catch((err) => {
  console.error('Exploratory run FAILED:', err);
  process.exit(1);
});
