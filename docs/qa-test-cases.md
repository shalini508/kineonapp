# Kineon Mobile App — QA Test Cases (Draft)

Status: Draft test cases, mapped to Mary's QA Test Coverage Documentation structure.
This is step 1 (test case definitions) — pass/fail numbers and coverage %s for the
full "shareable doc" come next, once these are executed and gaps are filled in.

Scope note: BLE/Heal+ testing is intentionally excluded per Mary's request ("wait on
Hardware Connectivity & Pairing Testing"). MOVE+ and Relief+ have no BLE, so all
cases below are executable now via Appium against the physical iPhone. Sections
with no current tooling/access (performance profiling, backend load testing, pen
testing, App Store compliance, push notification infra) are listed at the bottom as
**not yet testable**, per Mary's ask to flag gaps rather than leave them blank.

Status legend: ✅ Executed — Pass · ❌ Executed — Fail · ⬜ Not yet executed

---

## Section 2 — Functional Test Coverage

### 2a. Onboarding (8-question flow)

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| ONB-01 | Complete onboarding with valid answers to all 8 questions | Fresh account → step through all 8 questions with valid input → finish | Reaches Home screen; answers persist to profile | High | ⬜ |
| ONB-02 | Back navigation mid-flow | Start onboarding → go back 1+ questions → change an answer | Previous answer is preserved/editable, no data loss | Medium | ⬜ |
| ONB-03 | Exit and resume onboarding | Start onboarding → kill app mid-flow → relaunch | Resumes at the same question, or restarts cleanly (no crash, no stuck state) | High | ⬜ |
| ONB-04 | Skip optional questions (if any are optional) | Leave optional fields blank → continue | Flow proceeds; downstream screens handle missing data gracefully | Medium | ⬜ |
| ONB-05 | "Best treatment time" selection feeds notification scheduling | Select a specific time in onboarding → check Settings/Notifications later | Selected time is reflected wherever it's used downstream | Medium | ⬜ |

### 2b. Device session setup (Device → Body Part → Time → Meditation)

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| SETUP-01 | Full setup flow, MOVE+, valid selections at each step | Device=MOVE+ → Body Part=Knee → Time=15min → Meditation=Body Scan → confirm | Session starts/logs with exactly these values | High | ⬜ |
| SETUP-02 | Change device mid-flow | Select MOVE+ → go back → change to Relief+ | Downstream body-part/time options update correctly for the new device if they differ | Medium | ⬜ |
| SETUP-03 | Skip meditation step | Complete Device/Body Part/Time → skip meditation | Session still logs correctly without a meditation attached | Medium | ⬜ |
| SETUP-04 | Device/body-part dropdown accessibility | Open Device and Body Part selects with VoiceOver on | **Known gap (found 2026-08-17):** both dropdown buttons expose the generic label "Select" regardless of the chosen value — VoiceOver users can't tell which field is which or what's selected. See Section 10. | High | ❌ |

### 2c. Daily outcome logging (pain/energy/mood)

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| LOG-01 | Submit full pain/energy/mood check-in after a session | Complete a live session → fill all 3 sliders → Save | Values save and display correctly on the session's detail view | High | ⬜ |
| LOG-02 | Skip the check-in ("I don't remember") | Complete a session → tap Skip | Session still logs and still counts (per app copy: "the session still counts") | High | ✅ *(confirmed 2026-08-17 via manual log flow — "NO CHECK-IN ON THIS ONE — THE SESSION STILL COUNTS")* |
| LOG-03 | "Back" safety net from check-in screen | On "How does it feel?" screen, tap the `< Session` back button | Session resumes exactly where it left off (timer, audio, BLE state for future Heal+) with no time lost | High | ⬜ *(feature confirmed shipped per Kundan's Aug 13 build notes; not independently re-verified by us)* |
| LOG-04 | Manual "Log a past session" — all fields | Sessions tab → Log a past session → set Device/Body Part/Date/Duration → submit | Session recorded with exactly the selected values; total time & session-by-body-part counts update correctly | High | ✅ *(verified minutes/session counts update correctly)* |
| LOG-05 | Manual log — date field's effect on Milestone/day counter | Log a past session for a date **other than today** → check Recovery/Milestone day count | Day count should increase by 1 for a new distinct qualifying date | High | ❌ **BUG — see `reports/BUG-backdated-session-day-count.md`.** Backdated entries are attributed to today's date for day-counting, not the selected date. Reward screen literally says "3 sessions logged today" after 3 entries on 3 different dates. |
| LOG-06 | Duplicate-submission guard | Submit the same manual log twice in quick succession (double-tap) | Only one session record is created | Medium | ⬜ |

### 2d. Milestone/progress dashboard

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| MILE-01 | Combined Home dashboard card renders (Recovery Day, mid-cycle) | Fresh Home load, account with 1 ≤ day < 21 | Card shows "RECOVERY DAY X of 21", correct progress bar fill, correct "N days to your next milestone" | High | ✅ *(verified at Day 7 and Day 8, 2026-08-17)* |
| MILE-02 | No legacy 21-Day Challenge card / no layout shift on load | Cold-launch app, watch first ~2.5s | No old intro card renders; no skeleton flash/jank | High | ✅ |
| MILE-03 | Cross-screen day-count consistency | Compare Home's day count vs. Profile's DAYS stat vs. Sessions tab | All three match exactly | High | ✅ |
| MILE-04 | Negative: no early celebration | Account below Day 21 | "MILESTONE EARNED" card must NOT show | High | ✅ |
| MILE-05 | Day 21 → "MILESTONE EARNED" celebration | Reach exactly Day 21 | Card shows "MILESTONE EARNED • DAY 21", "21-Day Reset complete" message, Premium Challenges prompt | High | ⬜ **Blocked by LOG-05** — can't reach Day 21 via backdating until that bug is fixed. Needs either the fix, a real-time-aged account, or direct DB seeding. |
| MILE-06 | Day 22+ transition ("Milestone Day") | Day after the Day-21 celebration | Card shows "Milestone Day 22", not frozen on the celebration state (regression: previous "zombie state" bug) | High | ⬜ Blocked by LOG-05 |
| MILE-07 | Tapping Premium Challenges prompt | From the Day-21 celebration card, tap the prompt | Navigates to upsell screen; does **not** hard-block continued app use | Medium | ⬜ Blocked by LOG-05 |
| MILE-08 | "Sessions Logged" → Device Breakdown tap-through | Profile → tap "Sessions Logged: N" | Navigates to "Sessions by Device" screen with correct per-device totals | Medium | ✅ |
| MILE-09 | Reward Reveal shows live total, not stale/capped count | Log a session when total sessions exceeds any previously-capped display value | Reward header matches Profile's live total exactly | High | ✅ *(confirmed "You're at 12 sessions" / "13" matched Profile each time)* |
| MILE-10 | Milestone ladder rungs (7/14/21/30/40/50/66/75/100/150/200/+100) | Cross a ladder threshold (e.g. Day 14) | "MILESTONES" count on Profile/Sessions increments by exactly 1 | High | ⬜ Partially blocked by LOG-05 for anything past Day 8 |
| MILE-11 | 3 AM day-boundary rule | Log a qualifying session at 2:59 AM local vs 3:01 AM local | 2:59 AM credits the previous day; 3:01 AM credits the current day | Medium | ⬜ |
| MILE-12 | 1-per-day cap | Log 2+ qualifying sessions on the same calendar day | Day count increases by 1 only, not per session | High | ⬜ *(implied working, since our repeated same-day "today" entries didn't inflate the day count beyond 8 — but not a clean isolated test)* |

### 2e. Subscription/account

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| ACCT-01 | Sign out / sign back in | Profile → Log Out → sign back in with same credentials | Returns to the same account state, no data loss | High | ✅ *(used routinely as part of our login/milestone test scaffolding)* |
| ACCT-02 | Retake Health Quiz | Profile → Retake Health Quiz | Re-runs onboarding quiz; new answers overwrite old ones correctly | Medium | ⬜ |
| SUB-01 through SUB-08 | Trial/renewal/cancel flows | — | — | High | ⬜ **Not yet testable** — needs a test account at the right trial/renewal stage; see Section 9 below for the dedicated ARL compliance cases |

### 2f. Notifications

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| NOTIF-01 | Notification permission prompt | Fresh install, reach the point notifications are requested | System prompt appears with expected copy | Medium | ⬜ |
| NOTIF-02 | Scheduled time matches onboarding's "best treatment time" | Set a treatment time in onboarding → check when a reminder fires | Matches selected time, accounts for device timezone | Medium | ⬜ |
| NOTIF-03 | Cadence cap (2–5/week) | Observe notification frequency over a week | Never exceeds 5 in a 7-day window | Low (needs real-time observation) | ⬜ |

---

## Section 3 — Device-Specific Session Testing (MOVE+ & Relief+ only)

### MOVE+ (no BLE)

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| MOVE-01 | Manual session logging accuracy | Log a session with Device=MOVE+, specific body part & duration | All three fields save and display correctly in Session Log | High | ✅ |
| MOVE-02 | In-app timer accuracy (live session) | Start a live MOVE+ session, time it against a stopwatch | In-app timer matches real elapsed time within a few seconds | Medium | ⬜ *(blocked without physical MOVE+ hardware to actually start a live session — device-select screen requires picking a device to pair, see MOVE-03)* |
| MOVE-03 | No BLE UI ever appears for MOVE+ | Start a new session, select MOVE+ | No pairing screen, no "Connected" badge, no BLE start/pause controls | High | ⬜ *(the device-select screen itself lists MOVE+ alongside RELIEF+/HEAL+ — worth confirming MOVE+'s own session UI doesn't inherit any BLE chrome)* |

### Relief+ (no BLE)

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| RELIEF-01 | Manual session logging accuracy | Log a session with Device=Relief+ | Same as MOVE-01 | High | ⬜ |
| RELIEF-02 | Guided audio sequence (hold durations, breathing cues, positional prompts) | Run a full Relief+ guided session | Cues play in order, stay in sync with the timer, no desync | High | ⬜ |
| RELIEF-03 | No BLE UI appears for Relief+ | Same as MOVE-03 for Relief+ | No pairing/Connected badge/BLE controls | High | ⬜ |

### Heal+ (BLE — out of scope for now)

Per Mary's note, held until Heal+ is closer to launch. Placeholder test areas to build out later (not detailed test cases yet): pairing/re-pairing success rate, start/pause/cancel command reliability, settings sync accuracy, offline-then-reconnect upload behavior, "Device not connected" state, "Bluetooth Connected" badge scoped only to Heal+.

---

## Section 6 — Outcome Logging, Sync & Data Integrity

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| DATA-01 | Treatment day counted once per day regardless of session count | Log 2+ qualifying sessions same day | Day counter +1, not +2 | High | ⬜ *(see MILE-12 — same underlying check)* |
| DATA-02 | Backdated sessions credit their own date | Log a session for a past, unused date | Day counter increases for that date | High | ❌ **BUG — LOG-05 / see full repro in `reports/BUG-backdated-session-day-count.md`** |
| DATA-03 | Counter/milestones never decrease or reset | Observe counter across multiple sessions over time | Monotonically non-decreasing | High | ⬜ |
| DATA-04 | Counter never shown as "days since last session" | Skip a day, then log again | Copy still frames it as cumulative progress, not a broken streak | Medium | ✅ *(matches shipped copy: "A missed day pauses nothing — you just keep going")* |
| DATA-05 | Migration backfill for existing history | Existing account with prior sessions, first load after this build | Shows correct historical day count, not zero | High | ✅ *(our test account correctly showed Day 7 reflecting pre-existing history on first check)* |
| DATA-06 | Graceful degradation on sparse data | Reach a milestone with minimal logged detail (e.g. manual entries, no check-in) | Milestone still pays out fully, never shown as "insufficient" | Medium | ✅ *(manual, no-check-in entries explicitly said "the session still counts")* |
| DATA-07 | Concurrent writes from two "sessions" close together | Fire two manual logs in quick succession | Both persist correctly, no dropped write, no duplicate/race corruption | Medium | ⬜ |
| DATA-08 | Offline outcome log queuing & sync-on-reconnect | Log a session in airplane mode → reconnect | Session syncs once reconnected, no duplication | High | ⬜ *(prior fix shipped Aug 6 per thread; not independently re-verified by us on current build)* |

---

## Section 8 — Security, Privacy & Compliance (Authentication subset)

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| AUTH-01 | Valid login | Correct email + password | Logs in successfully | High | ✅ |
| AUTH-02 | Wrong password | Valid email + wrong password | Blocked, "Invalid login credentials" shown | High | ✅ |
| AUTH-03 | Unregistered email | Well-formed but unregistered email | Blocked, same error shown | High | ✅ |
| AUTH-04 | Empty email + password | Submit with both blank | Blocked, "Enter your email" / "Enter your password" shown | High | ✅ |
| AUTH-05 | Empty email only | Blank email, valid password | Blocked, "Enter your email" shown | Medium | ✅ |
| AUTH-06 | Empty password only | Valid email, blank password | Blocked, "Enter your password" shown | Medium | ✅ |
| AUTH-07 | Malformed email (no @) | e.g. "notanemail" | **Gap found:** no client-side validation — request is sent to the server and the Sign In button hangs in a loading state with no error surfaced | Medium | ❌ |
| AUTH-08 | Injection-style input | `' OR '1'='1` in email field | Safely rejected, no crash | High | ✅ |
| AUTH-09 | Whitespace-padded valid email | `"  user@x.com  "` | Logs in successfully (trimmed) | Low | ✅ *(edge case, passes leniently)* |
| AUTH-10 | Case-varied valid email | `USER@X.COM` | Logs in successfully (case-insensitive) | Low | ✅ *(edge case, passes leniently)* |
| AUTH-11 | Expired session handling | Force an expired token/session, attempt an action | Redirects to login gracefully, no crash | High | ⬜ |
| AUTH-12 | Concurrent logins (same account, two devices) | Log in on two devices simultaneously | Defined, non-corrupting behavior on both sessions | Medium | ⬜ |
| AUTH-13 | Password reset abuse / rate limiting | Repeated password-reset requests | Rate-limited appropriately | Medium | ⬜ |
| AUTH-14 | Biometric login fallback | Enable Face ID/Touch ID, then fail biometric | Falls back to password entry cleanly | Medium | ⬜ |

*(Full reusable automated suite: `scripts/test-login.js` in the repo — covers AUTH-01 through AUTH-10.)*

---

## Section 10 — Usability & Accessibility

| ID | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| A11Y-01 | VoiceOver reads dropdown selections | Enable VoiceOver, focus the Device/Body Part dropdowns | Announces the selected value (e.g. "Move Plus, selected") | High | ❌ **Both dropdowns announce only the generic "Select" regardless of chosen value.** |
| A11Y-02 | VoiceOver navigation of the date-picker calendar | Enable VoiceOver, open the date picker | Each day is individually announced/navigable | High | ❌ **The entire calendar (all 31 days + nav arrows) is exposed as one concatenated accessibility string — not navigable day-by-day with VoiceOver.** |
| A11Y-03 | Dynamic text size support | Set iOS text size to largest accessibility setting, review key screens | Text scales without truncation/overlap; 44×44px tap targets still hold | High | ⬜ *(flagged as important given the 45–65 persona per Mary's doc — not yet tested)* |
| A11Y-04 | Color contrast | Run key screens through a contrast checker | Meets WCAG 2.1 AA minimum | High | ⬜ |
| A11Y-05 | "One screen, one instruction, one button" audit | Review each screen in the app | Flag any screen with competing CTAs or multiple instructions | Medium | ⬜ |
| A11Y-06 | Missing product images (Shop tab) | Open Shop tab | **Gap found (2026-08-14):** MOVE+, Pain to Possible Bundle, and RELIEF+ show blank placeholder boxes instead of product images | Medium | ❌ |

---

## Sections not yet testable with current tooling/access

Flagging per Mary's ask to mark gaps explicitly rather than leave them blank:

| Section | Why it's blocked | What's needed to start |
|---|---|---|
| 1. Device & OS Coverage Matrix | We're testing on one physical iPhone (iPhone 16-class device, current iOS) | Access to App Store Connect analytics for real device/OS distribution; additional physical test devices or a device cloud (e.g. BrowserStack/Sauce Labs) to cover older iPhones/iOS versions |
| 4. Client-Side Performance Testing | No profiling harness set up (Instruments, frame-rate capture) | Xcode Instruments session on representative older hardware; Crashlytics/Sentry dashboard access for crash-free rates |
| 5. Backend Load & Stress Testing | No load-testing tool (k6, Locust, etc.) wired up, no staging environment access confirmed | Load-testing tool + agreed target tiers from engineering; staging environment safe to hammer |
| 7. Network Condition & Connectivity Resilience | Appium/XCUITest has no built-in network-condition simulation on real devices | Network Link Conditioner (Mac) paired with the device, or a proxy tool (Charles/mitmproxy) to simulate latency/packet loss |
| 8. (rest) — Pen testing, TLS/storage audit, claims/compliance scan | No security-scanning tooling in this workflow | A dedicated security review (see the `security-review` capability) or a third-party pen test |
| 9. Subscription, Trial & Cancel (CA ARL) | Test account isn't at any trial/renewal milestone; no visibility into the renewal-notice scheduling system | A test account seeded at each renewal milestone (M10/M11/M12/M13), or backend access to fast-forward account state |
| 11. App Store / Platform Compliance | Requires the actual App Store Connect submission/checklist, not device testing | Access to the App Store Connect listing and current submission checklist |
| 12. Push Notification cadence/timezone/DST | Requires real-time observation over days, plus notification-service visibility | Either a multi-day observation window, or backend logs of scheduled sends |
| 13. Regression & Release Testing metrics | No historical defect-tracking data pulled yet | Access to whatever tracker (Asana/Linear/etc.) logs QA-found vs. production-found defects |
| 14. Reporting Cadence & Format | Depends on all of the above being populated first | — |

---

## Summary of confirmed defects so far

1. **LOG-05 / DATA-02** — Backdated "Log a past session" entries don't credit their selected date toward the Recovery/Milestone day counter (attributed to today instead). High severity, blocks Day-21/22+ testing. Full repro: `reports/BUG-backdated-session-day-count.md`.
2. **AUTH-07** — No client-side email format validation; malformed email hangs the Sign In button with no error.
3. **A11Y-01 / A11Y-02** — Device/Body Part dropdowns and the date-picker calendar aren't properly exposed to VoiceOver (generic "Select" label; entire calendar as one string).
4. **A11Y-06** — Missing product images for 3 of 5 Shop items.
