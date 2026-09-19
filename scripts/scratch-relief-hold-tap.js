const { startSession, endSession } = require('../lib/session');
const { screenshot, ensureDir, sleep } = require('../lib/actions');
const { openLogPastSessionForm } = require('../lib/logSession');

const DIR = 'reports/new-account-relief';

async function holdTap(client, x, y, holdMs) {
  await client.performActions([
    {
      type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: holdMs },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
  await client.releaseActions();
}

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    await openLogPastSessionForm(client);
    const selects = await client.findElements('xpath', '//XCUIElementTypeButton[@label="Select" or @name="Select"]');
    const deviceBtn = selects[0]['element-6066-11e4-a52e-4042805e5804'] || selects[0].ELEMENT;
    await client.elementClick(deviceBtn);
    await sleep(900);

    await holdTap(client, 150, 615, 90);
    await sleep(900);
    await screenshot(client, DIR, '12-after-hold-tap-relief');
    console.log('done, check screenshot');
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
