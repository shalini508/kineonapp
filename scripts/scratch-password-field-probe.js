const { startSession, endSession } = require('../lib/session');
const { screenshot, ensureDir, sleep } = require('../lib/actions');
const { isLoggedIn, logOut, findFresh } = require('../lib/loginActions');

const DIR = 'reports/onboarding-fresh';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    if (await isLoggedIn(client)) { await logOut(client); await sleep(1000); }
    const signupBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"DON\'T HAVE") or contains(@name,"DON\'T HAVE")]');
    await client.elementClick(signupBtn);
    await sleep(1200);

    const secureFields = await client.findElements('xpath', '//XCUIElementTypeSecureTextField');
    console.log('secure fields:', secureFields.length);
    const id0 = secureFields[0]['element-6066-11e4-a52e-4042805e5804'] || secureFields[0].ELEMENT;
    await client.elementClick(id0);
    await sleep(600);
    await screenshot(client, DIR, 'p1-after-click');
    await client.elementSendKeys(id0, 'Test@2006');
    await sleep(600);
    await screenshot(client, DIR, 'p2-after-sendkeys');
    const val = await client.getElementAttribute(id0, 'value');
    console.log('value attr after sendKeys:', val);
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
