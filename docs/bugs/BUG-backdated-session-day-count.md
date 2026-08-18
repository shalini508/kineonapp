# Bug: Backdated "Log a past session" entries don't credit their selected date toward the Recovery/Milestone day counter

**Found while testing:** Aug 17 Milestones build (Kundan's TestFlight release covering the combined Home dashboard card, Day-21 celebration, and Reward Reveal sync fix)
**Build:** Kineon Move+ iOS, `io.kineon.move` v1.0.0 (build 23)
**Account:** `s@yopmail.com` (shared QA account)
**Severity:** High — blocks backdating as a way to test/reach any Recovery Day or Milestone Day state, and silently produces wrong day counts for any user who logs a past session

## Summary

Manually logging a past session via **Sessions → Log a past session**, with a date other than today selected in the **DATE** field, records the session correctly (device, body part, duration, and date all display correctly in Session Log) but does **not** credit that date toward the Recovery/Milestone day counter. Instead, the day-counting logic silently attributes the session to **today's** date regardless of what was picked, so it either does nothing to the counter (if today is already credited) or inflates today's credit — it never adds a new distinct day.

This breaks the "21 cumulative days, not 21 consecutive days" model the day counter is built on (per Mary's Aug 12 spec): a backdated qualifying session should immediately increase the day count by 1 if that calendar date wasn't already credited, exactly as a same-day session would.

## Steps to reproduce

1. Sign in and note the current value on Home ("Recovery Day X of 21" or "Milestone Day X") and/or Profile's **DAYS** stat.
2. Go to **Sessions → Log a past session**.
3. Set **DATE** to any date in the past that does not already have a logged session (e.g. a date from last month).
4. Leave device/body part/duration as any valid qualifying values (e.g. Move Plus, Knee, 15 min) and tap **LOG SESSION**.
5. On the resulting "Session Logged" screen, read the subtext.
6. Return to Home / Profile and check the day count again.

## Expected result

- Step 5: subtext should reference the session's logged date, and total-sessions/day-count should both reflect a **new distinct day**.
- Step 6: day count increases by 1 (assuming that calendar date wasn't already credited).

## Actual result

- Step 5: the screen explicitly says **"3 sessions logged today — great work. You're on Recovery Day 8."** — after backdating to two different past dates in a row (in this repro: one date roughly a month prior, then a second date for "yesterday"), the app still describes both as logged **today**.
- Step 6: the day count did not move. Verified independently on **both** Home ("Recovery Day 8 of 21") and Profile (**DAYS: 8**) after each backdated entry — ruling out a screen-specific rendering/cache issue; the day count itself is not being recalculated for the selected date.
- The session records themselves ARE correct: Session Log's total minutes and per-body-part session counts increased correctly after each entry (e.g. 29 → 59 → 74 minutes, Knee sessions 9 → 12), confirming the date/duration data is stored, just not used for day-count attribution.

## Repro script

Pushed to the repo for easy re-verification: [`scripts/test-backdated-session-day-bug.js`](https://github.com/shalini508/kineonapp/blob/main/scripts/test-backdated-session-day-bug.js)

```sh
node scripts/test-backdated-session-day-bug.js --year 2026 --month 7 --day 1
```

It logs the before/after day count and the reward screen's text, and reports `BUG REPRODUCED` if the day count doesn't change.

## Likely area to check

The day-count aggregate (probably the `get_session_totals`-style RPC mentioned in the Aug 11 "Single Source of Truth" fix, or wherever Recovery/Milestone day attribution happens) appears to key off the session's *insertion timestamp* rather than the *user-selected session date* for manually-logged entries. Worth checking whether the "Log a past session" form is actually passing the selected date through to whatever field the day-count query group-by's on.

## Secondary observation (unconfirmed, worth a quick look)

After the 3rd manual entry, Session Log's "Milestone Sessions by Type" showed **"Manual — OF 4 LOGGED — 3"** (4 total manual entries logged, but only 3 credited) — one manual entry appears to not be counted as qualifying, for reasons not yet isolated. Might be related to the same date-attribution issue, or might be unrelated; flagging in case it's useful context, not confirmed as a separate bug yet.

## Data cleanup note

This account now has 3 real manual session entries created during this testing (one correctly dated today, two intended for past dates but mis-attributed to today per the bug above). Flagging in case the team wants to clean these up before using this account for further QA.
