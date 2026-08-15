// Reusable login test suite for the Kineon Move+ iOS app.
//
// Runs a matrix of negative scenarios first (the app stays on the login
// screen after each), then one positive scenario last (valid credentials,
// which navigates away to the Home screen).
//
// Usage:
//   node scripts/test-login.js
//   node scripts/test-login.js --email you@example.com --password 'Secret123!'
//
// Handles whatever state the app is in when it starts (logged in, on the
// welcome screen, or already on the login form) by signing out first if
// needed, so the suite is safe to re-run without manual setup.

const path = require('path');
const fs = require('fs');
const { startSession, endSession } = require('../lib/session');
const { screenshot, dumpSource, sleep, ensureDir } = require('../lib/actions');
const {
  goToLoginForm,
  isOnLoginForm,
  isLoggedIn,
  setEmail,
  setPassword,
  submitLogin,
  waitForOutcome,
  logOut,
  getVisibleTexts,
} = require('../lib/loginActions');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { email: 's@yopmail.com', password: 'Test@2006' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email') out.email = args[++i];
    if (args[i] === '--password') out.password = args[++i];
  }
  return out;
}

function buildScenarios(validEmail, validPassword) {
  return [
    // --- Negative scenarios (run first; each should leave the user on the login screen) ---
    {
      id: 'wrong-password',
      kind: 'negative',
      description: 'Valid email, incorrect password',
      email: validEmail,
      password: 'WrongPassword123!',
    },
    {
      id: 'unregistered-email',
      kind: 'negative',
      description: 'Well-formed email that is not a registered account',
      email: `no-such-user-${Date.now()}@yopmail.com`,
      password: validPassword,
    },
    {
      id: 'empty-both',
      kind: 'negative',
      description: 'Empty email and empty password',
      email: '',
      password: '',
    },
    {
      id: 'empty-email',
      kind: 'negative',
      description: 'Empty email, valid password',
      email: '',
      password: validPassword,
    },
    {
      id: 'empty-password',
      kind: 'negative',
      description: 'Valid email, empty password',
      email: validEmail,
      password: '',
    },
    {
      id: 'malformed-email',
      kind: 'negative',
      description: 'Malformed email (no @ or domain)',
      email: 'notanemail',
      password: validPassword,
    },
    {
      id: 'whitespace-email',
      kind: 'edge', // no hard expectation: trimming-and-succeeding is arguably good UX
      description: 'Valid email padded with leading/trailing whitespace',
      email: `  ${validEmail}  `,
      password: validPassword,
    },
    {
      id: 'injection-like-input',
      kind: 'negative',
      description: "Injection-style input in email field (e.g. ' OR '1'='1)",
      email: "' OR '1'='1",
      password: 'anything',
    },
    {
      id: 'case-varied-email',
      kind: 'edge', // expectation unknown; recorded as an observation, not a hard pass/fail
      description: 'Valid email with swapped case (tests case-sensitivity handling)',
      email: validEmail.toUpperCase(),
      password: validPassword,
    },
    // --- Positive scenario (run last; expected to actually sign in) ---
    {
      id: 'valid-credentials',
      kind: 'positive',
      description: 'Correct email and password',
      email: validEmail,
      password: validPassword,
    },
  ];
}

async function runScenario(client, outDir, scenario, index) {
  const label = `${String(index + 1).padStart(2, '0')}-${scenario.id}`;
  console.log(`\n[${label}] ${scenario.description}`);

  await goToLoginForm(client);
  const beforeTexts = new Set(await getVisibleTexts(client));

  await setEmail(client, scenario.email);
  await setPassword(client, scenario.password);
  await submitLogin(client);

  // Poll rather than a fixed sleep: avoids a race where the app is still
  // mid-navigation when we check, which previously produced a false
  // "neither logged in nor on the form" reading.
  const { loggedIn, onLoginForm } = await waitForOutcome(client);
  const afterTexts = await getVisibleTexts(client);
  const newTexts = afterTexts.filter((t) => !beforeTexts.has(t));

  // Don't rely solely on the before/after diff: if an identical error
  // message was already on screen from a prior scenario, it won't show up
  // as "new" even though it's genuinely displayed. Scan the full current
  // text for anything error/validation-shaped instead.
  const errorKeywords = /invalid|incorrect|enter your|required|error/i;
  const currentErrorTexts = afterTexts.filter((t) => errorKeywords.test(t));

  await screenshot(client, outDir, label);
  await dumpSource(client, outDir, label);

  const result = {
    id: scenario.id,
    kind: scenario.kind,
    description: scenario.description,
    input: { email: scenario.email, password: scenario.password ? '[redacted]' : '(empty)' },
    loggedIn,
    stillOnLoginForm: onLoginForm,
    newTextOnScreen: newTexts,
    currentErrorLikeText: [...new Set(currentErrorTexts)],
  };

  console.log(`  loggedIn=${loggedIn} stillOnLoginForm=${onLoginForm} newText=${JSON.stringify(newTexts)} currentErrorLikeText=${JSON.stringify(result.currentErrorLikeText)}`);

  if (scenario.kind === 'negative') {
    // A passing result means the login did NOT succeed. We don't assert
    // on exact error copy since we don't want to hardcode UI text we
    // haven't independently verified stays stable across builds.
    result.pass = !loggedIn;
  } else if (scenario.kind === 'positive') {
    result.pass = loggedIn;
  } else {
    // 'edge' cases (e.g. whitespace/case handling): no hard expectation,
    // just record what actually happened for a human to judge.
    result.pass = null;
  }

  // Reset to a logged-out state before the next scenario, whether this
  // one succeeded intentionally (the positive case) or unexpectedly
  // (e.g. an edge case that turned out valid).
  if (loggedIn) {
    try {
      await logOut(client);
    } catch (err) {
      console.warn('  Warning: log out after this scenario failed:', err.message);
    }
  }

  return result;
}

async function main() {
  const { email, password } = parseArgs();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'reports', `login-tests-${stamp}`);
  ensureDir(outDir);

  console.log('Starting session...');
  const client = await startSession();
  const results = [];

  try {
    await sleep(2000);
    if (await isLoggedIn(client)) {
      console.log('App started in a logged-in state; signing out first...');
      await logOut(client);
    }
    const scenarios = buildScenarios(email, password);

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      try {
        const result = await runScenario(client, outDir, scenario, i);
        results.push(result);
      } catch (err) {
        console.warn(`  Scenario "${scenario.id}" threw an error:`, err.message);
        results.push({ id: scenario.id, kind: scenario.kind, description: scenario.description, error: err.message, pass: false });
      }
    }
  } finally {
    await endSession(client);
  }

  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));

  const scored = results.filter((r) => r.pass !== null && r.pass !== undefined || r.error);
  const passCount = scored.filter((r) => r.pass === true).length;
  const md = ['# Login test results', '', `Run: ${stamp}`, `${passCount}/${scored.length} scored scenarios passed`, ''];
  for (const r of results) {
    md.push(`## ${r.id} (${r.kind})`);
    md.push(r.description);
    md.push('');
    if (r.error) {
      md.push(`**Errored:** ${r.error}`);
    } else {
      md.push(`- Logged in: ${r.loggedIn}`);
      md.push(`- Still on login form: ${r.stillOnLoginForm}`);
      md.push(`- New text shown: ${r.newTextOnScreen.length ? r.newTextOnScreen.join(' | ') : '(none detected)'}`);
      md.push(`- Error/validation text visible: ${r.currentErrorLikeText.length ? r.currentErrorLikeText.join(' | ') : '(none detected)'}`);
      md.push(`- **${r.pass === null ? 'OBSERVED (no hard expectation)' : r.pass ? 'PASS' : 'FAIL'}**`);
    }
    md.push('');
  }
  fs.writeFileSync(path.join(outDir, 'results.md'), md.join('\n'));

  console.log(`\n${passCount}/${scored.length} scored scenarios passed (plus ${results.length - scored.length} observational edge cases).`);
  console.log(`Report written to: ${outDir}`);
}

main().catch((err) => {
  console.error('Login test run FAILED:', err);
  process.exit(1);
});
