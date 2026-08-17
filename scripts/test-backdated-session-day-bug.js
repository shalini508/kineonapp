// Repro script for a bug found while testing the Aug 17 Milestones build:
//
//   BUG: Sessions logged via "Log a past session" with a backdated DATE
//   are recorded correctly as session rows (right device/body part/
//   duration/date shows in Session Log), but the Recovery/Milestone DAY
//   counter treats them as if logged TODAY, not on the selected date.
//
// Repro:
//   1. Note the current "Recovery Day X of 21" / Profile "DAYS" value.
//   2. Log a past session for a date NOT already used (e.g. last month).
//   3. The post-submit "Session Logged" screen says e.g. "N sessions
//      logged today" (N incrementing) and the day count on Home/Profile
//      does NOT increase -- even though the session total and minutes do.
//
// This means backdating can never be used to move the day counter
// forward; every backdated entry silently collapses into "today"'s day
// credit instead of its own distinct day.
//
// Usage: node scripts/test-backdated-session-day-bug.js [--day N] [--month N] [--year N]
// Defaults to a date ~1 month before today that's unlikely to collide
// with existing history.

const path = require('path');
const fs = require('fs');
const { startSession, endSession } = require('../lib/session');
const { extractElements, sleep, screenshot, ensureDir } = require('../lib/actions');
const { dismissSavePasswordPromptIfPresent, findFresh } = require('../lib/loginActions');
const { logPastSession, completePostSessionCheckIn } = require('../lib/logSession');

function parseArgs() {
  const args = process.argv.slice(2);
  const now = new Date();
  const out = { year: now.getFullYear(), month: now.getMonth() - 1, day: 1 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--day') out.day = Number(args[++i]);
    if (args[i] === '--month') out.month = Number(args[++i]);
    if (args[i] === '--year') out.year = Number(args[++i]);
  }
  return out;
}

async function texts(client) {
  return extractElements(await client.getPageSource()).filter((e) => e.visible && (e.label || e.name)).map((e) => e.label || e.name);
}

function extractDayCount(homeTexts) {
  const line = homeTexts.find((t) => /Recovery Day|Milestone Day/i.test(t));
  const match = line && line.match(/Day (\d+) of/i);
  return { line, day: match ? Number(match[1]) : null };
}

async function goHome(client) {
  let homeBtn = null;
  for (let i = 0; i < 10 && !homeBtn; i++) {
    homeBtn = await findFresh(client, '//XCUIElementTypeButton[@label="Home" or @name="Home"]');
    if (!homeBtn) await sleep(500);
  }
  if (!homeBtn) throw new Error('Home tab never appeared (stuck on an unexpected screen?)');
  await client.elementClick(homeBtn);
  await sleep(1500);
  return texts(client);
}

async function main() {
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  const backdate = parseArgs();

  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'reports', `backdated-day-bug-${stamp}`);
  ensureDir(outDir);

  console.log('Starting session...');
  const client = await startSession();
  try {
    await sleep(2000);
    await dismissSavePasswordPromptIfPresent(client);

    const before = extractDayCount(await goHome(client));
    console.log(`Before: "${before.line}" (day=${before.day})`);
    await screenshot(client, outDir, '00-before');

    const label = `${backdate.year}-${String(backdate.month + 1).padStart(2, '0')}-${String(backdate.day).padStart(2, '0')}`;
    console.log(`\nLogging a session backdated to ${label}...`);
    await logPastSession(client, { date: backdate, today, bodyPart: 'Knee', minutes: 15 });
    const rewardTexts = await completePostSessionCheckIn(client);
    const todayMention = rewardTexts.find((t) => /logged today/i.test(t));
    console.log('Reward screen says:', JSON.stringify(todayMention || rewardTexts));
    await screenshot(client, outDir, '01-reward');

    const after = extractDayCount(await goHome(client));
    console.log(`\nAfter: "${after.line}" (day=${after.day})`);
    await screenshot(client, outDir, '02-after');

    const bugPresent = before.day !== null && after.day === before.day;
    console.log(`\n${bugPresent ? 'BUG REPRODUCED' : 'day count changed as expected'}: day went ${before.day} -> ${after.day} after backdating to ${label}.`);
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ label, before, after, bugPresent, rewardTexts }, null, 2));
  } finally {
    await endSession(client);
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
