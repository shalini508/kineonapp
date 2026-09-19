// Scenario C: Full Session Journey (write-heavy)
// Per Kundan: session START makes no network call -- only session END
// writes a full session record, followed by the post-session outcome log.
// So "the session journey" from a backend load perspective is just these
// two writes: INSERT sessions, then INSERT session_outcomes.
//
// Schema confirmed by inspecting real rows via the API and validating each
// field with trial inserts (see scripts/loadtest/lib/supabase.js).
import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  tokenHeadersForVU,
  buildSessionPayload,
  buildOutcomePayload,
} from './lib/supabase.js';

export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  iterations: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  // Pre-minted token from the CSV -- no auth round-trip, so this measures
  // pure write throughput (see lib/supabase.js).
  const { user, headers: baseHeaders } = tokenHeadersForVU();
  const userId = user.userId;
  const headers = { ...baseHeaders, Prefer: 'return=representation' };
  const sessionPayload = buildSessionPayload(userId, __VU);

  const sessionRes = http.post(`${BASE_URL}/rest/v1/sessions`, JSON.stringify(sessionPayload), {
    headers,
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
    { headers: baseHeaders, tags: { name: 'session_outcome_insert' } }
  );
  const outcomeOk = check(outcomeRes, {
    'outcome insert: status 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  if (!outcomeOk) {
    console.error(`VU ${__VU} outcome insert failed: [${outcomeRes.status}] ${outcomeRes.body}`);
  }

  sleep(1);
}
