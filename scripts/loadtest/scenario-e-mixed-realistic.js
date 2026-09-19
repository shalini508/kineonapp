// Scenario E: Realistic Mixed Traffic
// One VU = one simulated user doing a full realistic visit: log in, look
// up their profile, read the dashboard, then complete a session (write).
// This is the scenario used for the tier-by-tier report (50 -> 15,000
// users), since it's the closest approximation to a real traffic spike.
import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  tokenHeadersForVU,
  buildSessionPayload,
  buildOutcomePayload,
} from './lib/supabase.js';

const VUS = __ENV.VUS ? parseInt(__ENV.VUS) : 10;

// Thresholds double as the pass/fail criteria for a tier: a breach is the
// signal that this concurrency level is past what the backend serves well.
const thresholds = {
  http_req_duration: ['p(95)<2000'],
  checks: ['rate>0.9'],
};

// Two shapes:
//   - smoke (default): one iteration per VU, for quick script validation.
//   - tier (set HOLD, e.g. HOLD=60s): ramp up, hold the target concurrency,
//     ramp down -- the shape that actually measures a traffic spike, since a
//     single burst of one iteration each never reaches steady state.
// p(99) isn't in k6's default trend stats, and it's the number that shows
// the tail users actually feel at high concurrency.
const summaryTrendStats = ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'];

export const options = __ENV.HOLD
  ? {
      stages: [
        { duration: __ENV.RAMP || '30s', target: VUS },
        { duration: __ENV.HOLD, target: VUS },
        { duration: '10s', target: 0 },
      ],
      thresholds,
      summaryTrendStats,
    }
  : { vus: VUS, iterations: VUS, thresholds, summaryTrendStats };

// Writes a machine-readable summary per tier so results stay comparable
// across runs, while still printing the numbers worth eyeballing live.
export function handleSummary(data) {
  const m = data.metrics || {};
  const g = (name, field) => (m[name] && m[name].values ? m[name].values[field] : undefined);
  const fmt = (v, unit) => (v === undefined ? 'n/a' : `${v.toFixed(unit === 'ms' ? 0 : 2)}${unit}`);
  const checksPass = g('checks', 'rate');
  const failRate = g('http_req_failed', 'rate');

  const lines = [
    '',
    `  tier ................ ${VUS} VUs${__ENV.HOLD ? ` (hold ${__ENV.HOLD})` : ''}`,
    `  requests ............ ${g('http_reqs', 'count') || 0}  (${fmt(g('http_reqs', 'rate'), '/s')})`,
    `  checks passed ....... ${checksPass === undefined ? 'n/a' : (checksPass * 100).toFixed(2) + '%'}`,
    `  http failures ....... ${failRate === undefined ? 'n/a' : (failRate * 100).toFixed(2) + '%'}`,
    `  latency p50 ......... ${fmt(g('http_req_duration', 'med'), 'ms')}`,
    `  latency p95 ......... ${fmt(g('http_req_duration', 'p(95)'), 'ms')}`,
    `  latency p99 ......... ${fmt(g('http_req_duration', 'p(99)'), 'ms')}`,
    `  latency max ......... ${fmt(g('http_req_duration', 'max'), 'ms')}`,
    `  iterations .......... ${g('iterations', 'count') || 0}`,
    '',
  ];

  const out = { stdout: lines.join('\n') };
  if (__ENV.SUMMARY_OUT) out[__ENV.SUMMARY_OUT] = JSON.stringify(data, null, 2);
  return out;
}

export default function () {
  // --- Step 1: authenticate ---
  // Pre-minted token from the CSV, so no /auth/v1/token call -- see the
  // note in lib/supabase.js for why we bypass the login endpoint here.
  const { user, headers } = tokenHeadersForVU();
  const userId = user.userId;
  sleep(1);

  // --- Step 2: dashboard reads ---
  const quotesRes = http.get(`${BASE_URL}/rest/v1/dashboard_quotes?is_active=eq.true&select=*`, {
    headers,
    tags: { name: 'dashboard_quotes' },
  });
  check(quotesRes, { 'quotes: status 200': (r) => r.status === 200 });

  const streaksRes = http.get(`${BASE_URL}/rest/v1/streaks?select=*`, {
    headers,
    tags: { name: 'streaks' },
  });
  check(streaksRes, { 'streaks: status 200': (r) => r.status === 200 });

  const metricsRes = http.get(
    `${BASE_URL}/rest/v1/daily_metrics?select=*&order=metric_date.desc&limit=7`,
    { headers, tags: { name: 'daily_metrics' } }
  );
  check(metricsRes, { 'daily_metrics: status 200': (r) => r.status === 200 });
  sleep(1);

  // --- Step 3: complete a session (the write-heavy part) ---
  const writeHeaders = { ...headers, Prefer: 'return=representation' };
  const sessionPayload = buildSessionPayload(userId, __VU);

  const sessionRes = http.post(`${BASE_URL}/rest/v1/sessions`, JSON.stringify(sessionPayload), {
    headers: writeHeaders,
    tags: { name: 'session_insert' },
  });
  const sessionOk = check(sessionRes, {
    'session insert: status 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  if (!sessionOk) {
    console.error(`VU ${__VU} session insert failed: [${sessionRes.status}] ${sessionRes.body}`);
    return;
  }

  let sessionId = null;
  try {
    sessionId = sessionRes.json()[0].id;
  } catch (e) {
    console.error(`VU ${__VU} could not parse session insert response: ${sessionRes.body}`);
    return;
  }

  const outcomeRes = http.post(
    `${BASE_URL}/rest/v1/session_outcomes`,
    JSON.stringify(buildOutcomePayload(sessionId, userId)),
    { headers, tags: { name: 'session_outcome_insert' } }
  );
  const outcomeOk = check(outcomeRes, {
    'outcome insert: status 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  if (!outcomeOk) {
    console.error(`VU ${__VU} outcome insert failed: [${outcomeRes.status}] ${outcomeRes.body}`);
  }

  sleep(1);
}
