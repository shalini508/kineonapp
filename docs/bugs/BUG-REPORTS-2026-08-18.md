# Bug reports — 2026-08-18 test pass

Five distinct bugs found while executing the QA test case backlog
(`docs/qa-test-cases.md`/`.csv`). Each section below is self-contained and
can be copy-pasted into its own ticket. (A sixth failing case, `LOG-05`/
`DATA-02` — backdated sessions not crediting their date — already has its
own writeup: `docs/bugs/BUG-backdated-session-day-count.md`.)

**Shared context for all of these:**
**Build:** Kineon Move+ iOS, `io.kineon.move` v1.0.0 (build 23)
**Account:** `s@yopmail.com` (shared QA account)

---

## 1. Live session is lost entirely if the check-in screen is abandoned before Save/Skip

**Test case:** DATA-09
**Severity:** High — silent data loss for a real, completed session, with no warning to the user

### Summary

After a live session's timer completes naturally, the app shows an optional
"How does it feel?" check-in screen (Pain/Energy/Mood + photo, with Save,
Skip, or Back-to-session options). If the app closes at this exact point —
before the user taps **Save** or **Skip** — the entire session is lost.
Not just the check-in data: the session itself never gets recorded, with
no error, no warning, and critically, **no recovery prompt on next
launch** — even though the equivalent mid-timer interruption *does* show
a recovery prompt (see the ghost-session-recovery pass noted below).

### Steps to reproduce

1. Note the current value of Session Log's **TOTAL TIME**.
2. Start a live session (any device, e.g. MOVE+, 5 min).
3. Let the timer run to completion naturally (do not end it early).
4. On the "How does it feel?" check-in screen, close the app **without**
   tapping Save, Skip, or Back to session.
5. Reopen the app.
6. Check Session Log's **TOTAL TIME** again.

### Expected result

Either the session is recorded automatically once the timer completes
(independent of whether the check-in is filled in), or reopening the app
shows a recovery/resume prompt for the abandoned check-in, similar to the
mid-timer case.

### Actual result

Session Log's **TOTAL TIME** was unchanged (74 Min before and after) —
confirming the 5-minute session that had already fully completed was
never saved. The app returned straight to Home on reopen, with no
indication anything was lost.

### Contrast: mid-timer interruption works correctly (not a bug, included for context)

Closing the app **while the timer is still running** (before it
completes) behaves correctly: reopening shows **"SESSION INTERRUPTED —
Continue your session? ... COMPLETED SO FAR: 3m 8s / LEFT TO RUN: 1m
52s"**, with both figures accurately reflecting all real time that passed
while the app was closed. Tapping **RESUME SESSION** continues the timer
correctly through to natural completion. This confirms the "Ghost-Session
Recovery" feature (per the team's Aug 6 build notes) works well — the gap
is specifically the window *after* the timer completes but *before* the
check-in is saved or skipped.

### Likely area to check

Whatever mechanism drives ghost-session recovery for an in-progress timer
doesn't appear to cover the post-timer, pre-save check-in state. Worth
checking whether the session's "completed" state is only persisted at
Save/Skip time (consistent with the deferred-INSERT design Kundan
described on Aug 13 for the live-session flow) — if so, that deferred
INSERT needs its own recovery path, the same way the timer itself has one.

---

## 2. No client-side email format validation on login

**Test case:** AUTH-07
**Severity:** Medium — not a security issue, but a real usability gap (hung UI state with no feedback)

### Summary

Entering a malformed email (missing `@`, e.g. `notanemail`) into the login
form's email field and tapping **SIGN IN** doesn't trigger any client-side
validation. The request is sent to the server anyway, and the Sign In
button is left in a "SIGNING IN..." loading state with no error ever
surfacing (at least not within several seconds of observation).

### Steps to reproduce

1. On the login form, enter `notanemail` (or any string without an `@`)
   in the email field.
2. Enter any password.
3. Tap **SIGN IN**.

### Expected result

Immediate client-side validation blocks submission with a clear message
(e.g. "Enter a valid email address"), consistent with the existing
"Enter your email" / "Enter your password" validation for empty fields.

### Actual result

No validation message appears. The button shows "SIGNING IN..." and the
screen was observed to hang in that state with no resolution within the
observation window.

### Likely area to check

The empty-field validation ("Enter your email") clearly already exists in
this form — this is likely just a missing regex/format check that should
run at the same validation step, before the network call fires.

---

## 3. Device/Body Part pickers and the date-picker calendar aren't accessible to VoiceOver

**Test cases:** A11Y-01, A11Y-02 (SETUP-04 is a duplicate of A11Y-01)
**Severity:** High — blocks VoiceOver users from completing the "Log a past session" form at all

### Summary

The **Log a past session** form's "Select" dropdowns (Device Used, Body
Part Treated) and its date-picker calendar all share the same underlying
accessibility gap: each is exposed to the accessibility tree as a single
element with every option's text concatenated into one label, rather than
as individually-focusable rows/days.

- The two dropdown **buttons** themselves are both labeled just `"Select"`
  — this doesn't change to reflect the chosen value, so a VoiceOver user
  gets no confirmation of what's currently selected, and can't
  distinguish the Device field from the Body Part field by label alone.
- When either dropdown is opened, the resulting sheet's options are
  exposed as **one single element** whose label is the literal string
  `"Heal Plus, Move Plus, Relief Plus, Vertical scroll bar, 1 page,
  Horizontal scroll bar, 1 page"` (or the equivalent for body parts) —
  there's no way to navigate to or select an individual row via
  VoiceOver's standard swipe-through-elements gesture.
- The date-picker calendar has the identical problem: opening it exposes
  one element whose label is `"Previous month, AUGUST 2026, Next month,
  SU, MO, TU, ... August 1, 2026, August 2, 2026, ... August 31, 2026"` —
  all 31 days and the month-navigation controls collapsed into a single
  unreadable, unnavigable string.

### Steps to reproduce

1. Enable VoiceOver (Settings → Accessibility → VoiceOver).
2. Go to **Sessions → Log a past session**.
3. Swipe to and focus the "Device Used" field, then the "Body Part
   Treated" field. Note what VoiceOver announces for each.
4. Open either dropdown with VoiceOver active. Try to swipe through the
   individual options.
5. Open the **Date** field. Try to swipe through individual days.

### Expected result

- Each dropdown announces its own current value (e.g. "Device Used, Move
  Plus, button").
- Each row in an opened dropdown is individually focusable and
  selectable via VoiceOver.
- Each calendar day is individually focusable and selectable via
  VoiceOver, with month navigation as separate controls.

### Actual result

As described above — none of the three controls are properly exposed.
This isn't just a VoiceOver-experience issue: **it also made this exact
form impossible to reliably automate**, which is directly why the
RELIEF-01 test case (logging a session with Device=Relief+) is currently
blocked — coordinate-based tapping against these opaque, full-screen
elements produced inconsistent, non-reproducible results across 5
attempts (see `docs/qa-test-cases.md` for the RELIEF-01 notes). If a real
user hits the same underlying interaction ambiguity these controls
present, that's worth investigating independent of accessibility.

### Likely area to check

This looks like a custom-drawn bottom-sheet/list component (not a native
`UIPickerView` or plain `UITableView` row) that isn't setting
`isAccessibilityElement`/`accessibilityLabel` per-row, and is instead
letting the container's default accessibility behavior concatenate all
child text into one label. Likely the same shared component backs all
three controls (Device select, Body Part select, and the calendar), so
one fix should cover all three.

---

## 4. Text truncation at maximum accessibility text size (Home screen)

**Test case:** A11Y-03
**Severity:** High — directly affects the app's core persona (45–65, more likely to use larger accessibility text sizes, per Mary's QA doc)

### Summary

With iOS's text size set to maximum (Settings → Accessibility → Display &
Text Size → Larger Text, slider maxed), several text elements on the Home
screen clip, truncate, or become unreadable instead of wrapping or
reflowing gracefully.

### Steps to reproduce

1. Settings → Accessibility → Display & Text Size → Larger Text.
2. Drag the text-size slider to maximum.
3. Open the Kineon app and view the Home screen.

### Expected result

Text scales up and wraps/reflows within its container; nothing is cut off
or rendered illegible.

### Actual result

- The motivational quote heading (e.g. *"Recovery is built, not
  found..."*) is severely clipped on both the left and right edges,
  rendering as just **"Recovery is b..."** with the rest of the sentence
  cut off entirely, not wrapped.
- The "N days to your next milestone" caption beneath the Recovery Day
  progress bar is reduced to unreadable fragments (dashes and partial
  characters).
- The bottom tab bar's labels (Home/Sessions/Learn/Shop) appeared to
  overlap or truncate under the icons.

See attached screenshot reference: `reports/scratch-textsize/03-kineon-home-large-text.png` *(local — not committed to the repo; ask if you'd like it uploaded somewhere)*.

### Likely area to check

The quote heading in particular looks like a fixed-height/fixed-line-count
text view that isn't using Dynamic Type's line-wrapping correctly, or is
clipping instead of wrapping (`.lineLimit` set too low, or a fixed frame
height without `.minimumScaleFactor`/wrapping enabled). Worth an audit of
every Home-screen text element against the full Dynamic Type size range,
not just this one heading.

---

## 5. Missing product images in Shop tab

**Test case:** A11Y-06
**Severity:** Medium — visual/content gap, not a functional blocker

### Summary

Three of the five products listed in the Shop tab show blank placeholder
boxes instead of their product image.

### Steps to reproduce

1. Open the **Shop** tab.
2. Scroll through the product list.

### Expected result

All products show their real product image.

### Actual result

**MOVE+**, **Pain to Possible Bundle**, and **RELIEF+** all show blank
placeholder boxes. **MOVE+ Extender Strap** and **Recover Like a Pro
Bundle** show correct images.

### Likely area to check

Since 2 of 5 render correctly, this is likely missing/broken image URLs
for the specific 3 products in whatever product data source feeds the
Shop tab, rather than a systemic image-loading bug.

---

## Test data note

Reproducing bugs 1 and 2 above added a small amount of real data to the
shared `s@yopmail.com` account (one completed-then-abandoned 5-minute
session for #1, a couple of login attempts for #2 — no account state
changes from #2). Flagging in case the team wants to clean up before
reusing this account as a fresh baseline.
