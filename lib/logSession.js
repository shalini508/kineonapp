// Helper for driving the "Log a past session" manual-entry form.
//
// The device/body-part picker sheets and the calendar date picker all
// expose their options as ONE opaque XCUIElementType with every row's
// text concatenated into a single accessibility label (a real
// accessibility gap worth flagging to the team -- VoiceOver users would
// hear "Select, button" for both dropdowns regardless of what's chosen,
// and the whole calendar reads as one wall of text). None of the
// individual rows/days are independently addressable by accessibility
// query, so this module taps by computed screen coordinates instead.

const { sleep } = require('./actions');
const { findFresh } = require('./loginActions');

const BODY_PART_ROW_POINTS = {
  Knee: { x: 150, y: 519 },
  'Lower Back': { x: 150, y: 583 },
  Shoulder: { x: 150, y: 647 },
  'Hip & Glute': { x: 150, y: 711 },
  Elbow: { x: 150, y: 775 },
  'Ankle & Foot': { x: 150, y: 839 },
};

const CAL_COL_X = { 0: 38, 1: 91, 2: 143, 3: 196, 4: 249, 5: 302, 6: 354 }; // Sun..Sat
const CAL_ROW_Y = { 0: 477, 1: 510, 2: 543, 3: 576, 4: 609, 5: 642 };
const CAL_PREV_ARROW = { x: 36, y: 401 };
const CAL_HEADER_LABEL_XPATH = '//XCUIElementTypeOther[contains(@label, "Previous month")]';

async function tapPoint(client, x, y) {
  await client.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
  await client.releaseActions();
}

// Returns {row, col} (0-indexed, Sun=0) for `day` within `month` (0-indexed)/`year`.
function calendarPosition(year, month, day) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const col = (firstWeekday + day - 1) % 7;
  const row = Math.floor((firstWeekday + day - 1) / 7);
  return { row, col };
}

async function openLogPastSessionForm(client) {
  const sessionsTab = await findFresh(client, '//XCUIElementTypeButton[@label="Sessions" or @name="Sessions"]');
  await client.elementClick(sessionsTab);
  await sleep(1000);
  const logPastBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"Log a past") or contains(@name,"Log a past")]');
  await client.elementClick(logPastBtn);
  await sleep(1200);
}

async function selectBodyPart(client, bodyPart) {
  const point = BODY_PART_ROW_POINTS[bodyPart];
  if (!point) throw new Error(`Unknown body part "${bodyPart}"`);
  const selects = await client.findElements('xpath', '//XCUIElementTypeButton[@label="Select" or @name="Select"]');
  if (selects.length < 2) throw new Error(`Expected 2 "Select" buttons, found ${selects.length}`);
  const bodyPartBtn = selects[1]['element-6066-11e4-a52e-4042805e5804'] || selects[1].ELEMENT;
  await client.elementClick(bodyPartBtn);
  await sleep(700);
  await tapPoint(client, point.x, point.y);
  await sleep(500);
}

// Navigates the calendar back `monthsBack` months from the current
// month shown (assumes the picker opens on the current real-world month)
// and taps `day`.
async function selectPastDate(client, { year, month, day }, currentYear, currentMonth) {
  const dateBtn = await findFresh(client, '//XCUIElementTypeButton[@label="Date of the session" or @name="Date of the session"]');
  await client.elementClick(dateBtn);
  await sleep(900);

  const monthsBack = (currentYear - year) * 12 + (currentMonth - month);
  for (let i = 0; i < monthsBack; i++) {
    await tapPoint(client, CAL_PREV_ARROW.x, CAL_PREV_ARROW.y);
    await sleep(400);
  }

  const { row, col } = calendarPosition(year, month, day);
  await tapPoint(client, CAL_COL_X[col], CAL_ROW_Y[row]);
  await sleep(600);
}

async function selectDuration(client, minutes) {
  const label = `${minutes} min`;
  const el = await findFresh(client, `//XCUIElementTypeOther[@label="${label}" or @name="${label}"]`);
  if (el) {
    await client.elementClick(el);
    await sleep(400);
  }
}

async function submitLogSession(client) {
  const btn = await findFresh(client, '//XCUIElementTypeButton[@label="LOG SESSION" or @name="LOG SESSION"]');
  await client.elementClick(btn);
  await sleep(2000);
}

// Full flow: opens the form, sets body part + date + duration (device
// left at its default, Move Plus), and submits. `date` is
// {year, month (0-indexed), day}. `today` is the same shape, used to
// compute how many months to page back in the calendar.
async function logPastSession(client, { date, today, bodyPart = 'Knee', minutes = 15 }) {
  await openLogPastSessionForm(client);
  await selectBodyPart(client, bodyPart);
  const isToday = date.year === today.year && date.month === today.month && date.day === today.day;
  if (!isToday) {
    await selectPastDate(client, date, today.year, today.month);
  }
  await selectDuration(client, minutes);
  await submitLogSession(client);
}

// After LOG SESSION, an optional pain/energy/mood check-in screen may
// appear ("How does it feel?"). Skips it if present and returns whatever
// visible text is on screen immediately after, so callers can detect a
// Reward Reveal screen if one shows up.
async function completePostSessionCheckIn(client) {
  const { extractElements } = require('./actions');
  const skipBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"SKIP") or contains(@name,"SKIP")]');
  if (skipBtn) {
    await client.elementClick(skipBtn);
    await sleep(2000);
  }
  // Manual/backdated entries skip straight to a "Session Logged" Reward
  // Reveal screen (no check-in step) with a "CONTINUE TO DASHBOARD"
  // button -- without tapping it there's no tab bar, so anything relying
  // on Home/Sessions being reachable gets stuck here.
  const continueBtn = await findFresh(client, '//XCUIElementTypeButton[contains(@label,"CONTINUE TO DASHBOARD") or contains(@name,"CONTINUE TO DASHBOARD")]');
  const source = await client.getPageSource();
  const rewardTexts = extractElements(source)
    .filter((e) => e.visible && (e.label || e.name))
    .map((e) => e.label || e.name);
  if (continueBtn) {
    await client.elementClick(continueBtn);
    await sleep(1500);
  }
  return rewardTexts;
}

module.exports = {
  calendarPosition,
  openLogPastSessionForm,
  selectBodyPart,
  selectPastDate,
  selectDuration,
  submitLogSession,
  logPastSession,
  completePostSessionCheckIn,
  tapPoint,
};
