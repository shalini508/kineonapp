const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, extractElements, interactiveSummary, ensureDir, sleep, swipeUp } = require('../lib/actions');
const { findFresh, isLoggedIn } = require('../lib/loginActions');

const DIR = 'reports/retest-batch-2026-08-22';

async function main() {
  const client = await startSession();
  ensureDir(DIR);
  try {
    console.log('LOGGED IN?', await isLoggedIn(client));

    // --- 1. Sessions tab: look for any per-body-part analytics ---
    const sessionsTab = await findFresh(client, '//XCUIElementTypeButton[@label="Sessions" or @name="Sessions"]');
    await client.elementClick(sessionsTab);
    await sleep(1200);
    await screenshot(client, DIR, '01-sessions-tab');
    const { source: s1 } = await dumpSource(client, DIR, '01-sessions-tab');
    console.log('SESSIONS TAB:', JSON.stringify(interactiveSummary(extractElements(s1)), null, 2));
    for (let i = 0; i < 3; i++) {
      await swipeUp(client);
      await sleep(400);
      await screenshot(client, DIR, `01-sessions-scroll-${i}`);
    }
    const { source: s1b } = await dumpSource(client, DIR, '01-sessions-scroll-final');
    console.log('SESSIONS TAB SCROLLED:', JSON.stringify(interactiveSummary(extractElements(s1b)), null, 2));

    // --- 2. Home tab: check profile/stats area for body-part breakdown ---
    const homeTab = await findFresh(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]');
    await client.elementClick(homeTab);
    await sleep(1000);
    const profileBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Open your profile") or contains(@name,"Open your profile")]');
    if (profileBtn) {
      await client.elementClick(profileBtn);
      await sleep(1200);
      await screenshot(client, DIR, '02-profile');
      const { source: s2 } = await dumpSource(client, DIR, '02-profile');
      console.log('PROFILE SCREEN:', JSON.stringify(interactiveSummary(extractElements(s2)), null, 2));
      for (let i = 0; i < 3; i++) {
        await swipeUp(client);
        await sleep(400);
        await screenshot(client, DIR, `02-profile-scroll-${i}`);
      }
      const { source: s2b } = await dumpSource(client, DIR, '02-profile-scroll-final');
      console.log('PROFILE SCROLLED:', JSON.stringify(interactiveSummary(extractElements(s2b)), null, 2));
      // go back to home
      const backBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Back") or contains(@name,"Back") or contains(@label,"Close") or contains(@name,"Close")]');
      if (backBtn) { await client.elementClick(backBtn); await sleep(800); }
    } else {
      console.log('No profile button found from Home');
    }

    // --- 3. Streak Calendar alignment check ---
    await client.elementClick(homeTab);
    await sleep(1000);
    const challengeCard = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Recovery Day") or contains(@name,"Recovery Day")]');
    if (challengeCard) {
      await client.elementClick(challengeCard);
      await sleep(1200);
      await screenshot(client, DIR, '03-after-challenge-tap');
      const { source: s3 } = await dumpSource(client, DIR, '03-after-challenge-tap');
      console.log('AFTER CHALLENGE CARD TAP:', JSON.stringify(interactiveSummary(extractElements(s3)), null, 2));
    } else {
      console.log('No challenge/streak card button found on Home');
    }

    // --- 4. Persistent Mini Audio Player ---
    await client.elementClick(homeTab);
    await sleep(1000);
    const learnTab = await findFresh(client, '//XCUIElementTypeButton[@label="Learn" or @name="Learn"]');
    await client.elementClick(learnTab);
    await sleep(1200);
    await screenshot(client, DIR, '04-learn-tab');
    const openLibraryBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Open Meditation Library") or contains(@name,"Open Meditation Library")]');
    if (openLibraryBtn) {
      await client.elementClick(openLibraryBtn);
      await sleep(1200);
      await screenshot(client, DIR, '05-meditation-library');
      const { source: s5 } = await dumpSource(client, DIR, '05-meditation-library');
      const els5 = interactiveSummary(extractElements(s5));
      console.log('MEDITATION LIBRARY:', JSON.stringify(els5, null, 2));
    } else {
      console.log('No Open Meditation Library button on Learn tab');
    }
  } finally {
    await endSession(client);
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
