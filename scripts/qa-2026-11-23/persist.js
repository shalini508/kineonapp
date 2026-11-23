// Sign in, then relaunch the app (terminate + launch) and check whether the user is still signed in.
const H = require('./h');
H.run(async (c) => {
  const li = await H.login(c, 'day65@yopmail.com', process.env.DAY65_PW);
  console.log('LOGIN:', JSON.stringify(li));
  await H.shot(c, 'persist-1-after-login');
  for (const wait of [3, 15]) {
    await c.executeScript('mobile: terminateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(2000);
    await c.executeScript('mobile: activateApp', [{ bundleId: H.BUNDLE }]); await H.sleep(wait * 1000);
    const signedIn = await H.L.isLoggedIn(c);
    console.log(`AFTER RELAUNCH (waited ${wait}s): signed in = ${signedIn} | screen: ${(await H.texts(c)).slice(1, 5).join(' | ')}`);
    await H.shot(c, `persist-relaunch-${wait}s`);
  }
}).catch(e => { console.error('FAILED:', e.message); process.exit(1); });
