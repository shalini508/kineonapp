const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function screenshot(client, outDir, name) {
  ensureDir(outDir);
  const data = await client.takeScreenshot();
  const filePath = path.join(outDir, `${name}.png`);
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  return filePath;
}

async function dumpSource(client, outDir, name) {
  ensureDir(outDir);
  const source = await client.getPageSource();
  const filePath = path.join(outDir, `${name}.xml`);
  fs.writeFileSync(filePath, source);
  return { filePath, source };
}

// Flattens the XCUITest page-source XML into a plain list of
// { type, name, label, value, x, y, width, height, enabled, visible }
function extractElements(xmlSource) {
  const json = parser.parse(xmlSource);
  const elements = [];

  function walk(node, tag) {
    if (!node || typeof node !== 'object') return;
    if (tag && tag.startsWith('XCUIElementType')) {
      elements.push({
        type: tag,
        name: node.name || '',
        label: node.label || '',
        value: node.value || '',
        x: Number(node.x) || 0,
        y: Number(node.y) || 0,
        width: Number(node.width) || 0,
        height: Number(node.height) || 0,
        enabled: node.enabled === 'true',
        visible: node.visible === 'true',
      });
    }
    for (const key of Object.keys(node)) {
      if (key.startsWith('@_') || typeof node[key] !== 'object') continue;
      const children = Array.isArray(node[key]) ? node[key] : [node[key]];
      children.forEach((child) => walk(child, key));
    }
  }

  walk(json, null);
  return elements;
}

function interactiveSummary(elements) {
  const interactiveTypes = new Set([
    'XCUIElementTypeButton',
    'XCUIElementTypeStaticText',
    'XCUIElementTypeTextField',
    'XCUIElementTypeSwitch',
    'XCUIElementTypeCell',
    'XCUIElementTypeLink',
    'XCUIElementTypeImage',
  ]);
  return elements
    .filter((el) => interactiveTypes.has(el.type) && el.visible && (el.name || el.label))
    .map((el) => ({ type: el.type, text: el.label || el.name, rect: [el.x, el.y, el.width, el.height] }));
}

// Many RN apps render a custom bottom nav instead of a native
// XCUIElementTypeTabBar. We detect it structurally: the fixed nav row is a
// set of 3+ buttons that all share the same y-coordinate (a real row),
// picking the bottom-most such row on screen. Returns labels only (not
// element handles) since callers should re-locate fresh before each tap
// to avoid stale-element errors once the screen changes.
async function getTabBarLabels(client) {
  const source = await client.getPageSource();
  const elements = extractElements(source);

  const buttons = elements.filter((el) => el.type === 'XCUIElementTypeButton' && el.visible && (el.label || el.name));

  const rowsByY = new Map();
  for (const el of buttons) {
    const key = Math.round(el.y / 5) * 5; // bucket into 5px bands
    if (!rowsByY.has(key)) rowsByY.set(key, []);
    rowsByY.get(key).push(el);
  }

  let bestRow = null;
  for (const [y, els] of rowsByY.entries()) {
    if (els.length < 3) continue;
    if (!bestRow || y > bestRow.y) bestRow = { y, els };
  }

  if (!bestRow) return [];
  return bestRow.els
    .sort((a, b) => a.x - b.x)
    .map((el) => el.label || el.name);
}

async function tapElement(client, elementId) {
  await client.elementClick(elementId);
}

async function tapByLabel(client, label) {
  const els = await client.findElements('xpath', `//*[@label="${label}" or @name="${label}"]`);
  if (els.length === 0) throw new Error(`No element found with label/name "${label}"`);
  const elementId = els[0]['element-6066-11e4-a52e-4042805e5804'] || els[0].ELEMENT;
  await tapElement(client, elementId);
}

async function swipeUp(client) {
  const { width, height } = await client.getWindowRect();
  await client.executeScript('mobile: swipe', [{ direction: 'up' }]).catch(async () => {
    // fallback: W3C actions-based swipe if 'mobile: swipe' isn't supported
    const startX = width / 2;
    const startY = height * 0.8;
    const endY = height * 0.2;
    await client.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: startX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 300, x: startX, y: endY },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await client.releaseActions();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  screenshot,
  dumpSource,
  extractElements,
  interactiveSummary,
  getTabBarLabels,
  tapElement,
  tapByLabel,
  swipeUp,
  sleep,
  ensureDir,
};
