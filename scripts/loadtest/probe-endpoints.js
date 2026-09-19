// Per-endpoint latency probe.
//
// The tier scenario makes five calls per iteration. If one of them regresses,
// aggregate p50 barely moves (the other four dominate) while p95 lifts sharply
// -- which is exactly the shape we saw after the 11 Sep database tuning. This
// times each call separately so the culprit is identifiable rather than
// inferred.
//
// Usage: node scripts/loadtest/probe-endpoints.js [iterations]

const fs = require('fs');
const path = require('path');

const CSV = process.env.USERS_CSV || path.join(__dirname, '..', '..', 'data', 'users_15thsep.csv');
// Supabase connection comes from the environment so the project ref and key
// stay out of this public repo -- see .env.example.
const BASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!BASE_URL || !ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY -- see .env.example');
  process.exit(1);
}
const ITERATIONS = parseInt(process.argv[2] || '30', 10);

const BODY_PARTS = ['knee', 'shoulder', 'elbow', 'wrist', 'lower-back', 'hip', 'neck', 'ankle'];

function pct(sorted, p) {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function timed(label, stats, fn) {
  const t = Date.now();
  const res = await fn();
  const ms = Date.now() - t;
  (stats[label] = stats[label] || { ms: [], bad: 0 }).ms.push(ms);
  if (!res.ok) stats[label].bad++;
  return res;
}

async function main() {
  const lines = fs.readFileSync(CSV, 'utf8').trim().split('\n').slice(1).filter((l) => l.trim());
  console.log(`Probing ${ITERATIONS} iterations, one user each, against ${BASE_URL}\n`);

  const stats = {};
  for (let i = 0; i < ITERATIONS; i++) {
    const [userId, , , , token] = lines[(i * 37) % lines.length].split(',');
    const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token.trim()}`, 'Content-Type': 'application/json' };

    await timed('dashboard_quotes', stats, () =>
      fetch(`${BASE_URL}/rest/v1/dashboard_quotes?is_active=eq.true&select=*`, { headers })
    );
    await timed('streaks', stats, () => fetch(`${BASE_URL}/rest/v1/streaks?select=*`, { headers }));
    await timed('daily_metrics', stats, () =>
      fetch(`${BASE_URL}/rest/v1/daily_metrics?select=*&order=metric_date.desc&limit=7`, { headers })
    );

    const now = new Date();
    const sessionRes = await timed('sessions (insert)', stats, () =>
      fetch(`${BASE_URL}/rest/v1/sessions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: parseInt(userId, 10),
          device_model_id: 2,
          body_part: BODY_PARTS[i % BODY_PARTS.length],
          intensity: 'medium',
          session_type: 'recovery',
          duration_minutes: 5,
          elapsed_seconds: 300,
          entry_method: 'timer',
          status: 'completed',
          started_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
          completed_at: now.toISOString(),
          session_entry_type: 'guided',
          capture_method: 'app_timer',
          device_control: 'app_only',
          timing_source: 'app_measured',
          counts_toward_milestone: false,
          treatment_day: now.toISOString().slice(0, 10),
        }),
      })
    );

    let sessionId = null;
    try {
      sessionId = (await sessionRes.json())[0].id;
    } catch (e) {
      /* insert failed; outcome probe skipped below */
    }
    if (sessionId) {
      await timed('session_outcomes (insert)', stats, () =>
        fetch(`${BASE_URL}/rest/v1/session_outcomes`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            session_id: sessionId,
            user_id: parseInt(userId, 10),
            pain_score: 2,
            energy_score: 8,
            mood_score: 8,
          }),
        })
      );
    }
  }

  console.log('endpoint                      n     p50      p95      max     errors');
  console.log('------------------------------------------------------------------');
  for (const [label, s] of Object.entries(stats)) {
    const sorted = [...s.ms].sort((a, b) => a - b);
    console.log(
      label.padEnd(28) +
        String(sorted.length).padStart(4) +
        String(pct(sorted, 50) + 'ms').padStart(9) +
        String(pct(sorted, 95) + 'ms').padStart(9) +
        String(sorted[sorted.length - 1] + 'ms').padStart(9) +
        String(s.bad).padStart(8)
    );
  }
  console.log('\nNote: this inserts one session + outcome per iteration on load_test accounts.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
