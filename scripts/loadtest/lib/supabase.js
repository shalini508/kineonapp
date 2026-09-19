// Shared helpers for Kineon Move+ load test scenarios.
// Talks directly to Supabase (GoTrue auth + PostgREST), the same way the
// mobile app does -- there is no custom backend (confirmed by Kundan).
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

// Supabase connection comes from the environment so the project ref and key
// stay out of this public repo. k6 reads these via -e, not process.env:
//   k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... scenario-e-mixed-realistic.js
// Use the legacy JWT anon key rather than the newer sb_publishable_... format,
// for broadest client-library compatibility.
export const BASE_URL = __ENV.SUPABASE_URL;
export const ANON_KEY = __ENV.SUPABASE_ANON_KEY;

if (!BASE_URL || !ANON_KEY) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY -- pass them with k6 -e (see .env.example)'
  );
}

// The 12,000 seeded load-test accounts (tagged load_test:true in their user
// metadata by Kundan, so they're identifiable for cleanup). All share the
// password, which the CSV carries per row. CSV columns:
// user_id,auth_id,email,password,access_token
//
// user_id is the internal integer PK every app table is keyed on (see the
// getInternalUserId note below), so no per-VU lookup is needed.
//
// access_token is a pre-minted JWT. The point of these is to skip the
// /auth/v1/token login endpoint entirely: at 10k concurrent VUs a login
// storm can trip GoTrue's own rate limiting, which would look like "Move+
// hit its ceiling" when it's really just the auth layer. Bypassing auth
// keeps the measurement pointed at Postgres/PostgREST, which is what we
// actually want to size.
//
// users_15thsep.csv was minted 14 Sep with a 168h window (expires 21 Sep
// 10:16 IST) -- verify before a run with scripts/loadtest/check-tokens.js,
// since an expired token yields 401 PGRST303 on every request and makes a
// healthy backend look like a total outage.
export const users = new SharedArray('users', function () {
  const csv = open('../../../data/users_15thsep.csv');
  const lines = csv.trim().split('\n').slice(1); // drop header row
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [userId, authId, email, password, accessToken] = line.split(',');
      return {
        userId: parseInt(userId, 10),
        email: email.trim(),
        password: password.trim(),
        accessToken: (accessToken || '').trim(),
      };
    });
});

// Picks a distinct test user per virtual user (wraps around if VUs > 20).
export function userForVU() {
  return users[(__VU - 1) % users.length];
}

export function login(user) {
  const res = http.post(
    `${BASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      tags: { name: 'auth_login' },
    }
  );
  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: has access_token': (r) => {
      try {
        return !!r.json('access_token');
      } catch (e) {
        return false;
      }
    },
  });
  if (!ok) {
    console.error(`VU ${__VU} login failed for ${user.email}: [${res.status}] ${res.body}`);
    return null;
  }
  return res.json();
}

export function authHeaders(accessToken) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

// Preferred path for every scenario except the login-storm one: use the
// pre-minted token straight from the CSV, no auth round-trip. Fails loudly
// rather than silently degrading to anonymous requests, so a bad CSV shows
// up immediately instead of as a wall of 401s mid-run.
export function tokenHeadersForVU() {
  const user = userForVU();
  if (!user.accessToken) {
    throw new Error(
      `VU ${__VU}: no access_token for ${user.email} -- check data/loadtest/users2.csv`
    );
  }
  return { user, headers: authHeaders(user.accessToken) };
}

// public.users.id is a separate internal integer PK, distinct from the
// Supabase Auth UUID -- every app table (sessions, session_outcomes,
// daily_metrics, streaks) is keyed on this integer, not the auth UUID.
// Confirmed by inspecting real rows via the API (schema introspection at
// /rest/v1/ requires the service_role key, which we deliberately don't use).
export function getInternalUserId(accessToken) {
  const res = http.get(`${BASE_URL}/rest/v1/users?select=id`, {
    headers: authHeaders(accessToken),
    tags: { name: 'users_lookup' },
  });
  const ok = check(res, { 'users lookup: status 200': (r) => r.status === 200 });
  if (!ok) {
    console.error(`VU ${__VU} users lookup failed: [${res.status}] ${res.body}`);
    return null;
  }
  try {
    const rows = res.json();
    return rows[0] && rows[0].id;
  } catch (e) {
    console.error(`VU ${__VU} could not parse users lookup response: ${res.body}`);
    return null;
  }
}

// device_models: id 2 = MOVE+ (slug move-plus), id 3 = RELIEF+ (slug
// relief-plus). Confirmed directly via the API.
export const DEVICE_MODEL_IDS = { 'MOVE+': 2, 'RELIEF+': 3 };

// Valid values for sessions.body_part (check constraint), confirmed by
// trial insert -- note the hyphen in "lower-back", inconsistent with the
// underscore-free single-word values.
export const BODY_PARTS = ['knee', 'shoulder', 'elbow', 'wrist', 'lower-back', 'hip', 'neck', 'ankle'];

// Builds one realistic completed-session payload for the given internal
// (integer) user id. Field set matches a real row observed via the API.
export function buildSessionPayload(userId, vuIndex) {
  const now = new Date();
  const startedAt = new Date(now.getTime() - 5 * 60 * 1000);
  const deviceModelId = vuIndex % 2 === 0 ? DEVICE_MODEL_IDS['MOVE+'] : DEVICE_MODEL_IDS['RELIEF+'];
  return {
    user_id: userId,
    device_model_id: deviceModelId,
    body_part: BODY_PARTS[vuIndex % BODY_PARTS.length],
    intensity: 'medium',
    session_type: 'recovery',
    duration_minutes: 5,
    elapsed_seconds: 300,
    entry_method: 'timer',
    status: 'completed',
    started_at: startedAt.toISOString(),
    completed_at: now.toISOString(),
    session_entry_type: 'guided',
    capture_method: 'app_timer',
    device_control: 'app_only',
    timing_source: 'app_measured',
    counts_toward_milestone: false,
    treatment_day: now.toISOString().slice(0, 10),
  };
}

export function buildOutcomePayload(sessionId, userId) {
  return {
    session_id: sessionId,
    user_id: userId,
    pain_score: 2,
    energy_score: 8,
    mood_score: 8,
    notes: 'k6 load test',
  };
}
