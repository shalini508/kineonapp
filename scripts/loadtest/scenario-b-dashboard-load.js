// Scenario B: Home / Dashboard Load
// Read-heavy: daily quote, streak data, recent daily metrics. Tests
// PostgREST read throughput. Each VU reads with its own pre-minted token
// (matching real usage -- nobody re-authenticates on every screen visit).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, tokenHeadersForVU } from './lib/supabase.js';

export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  // Pre-minted token from the CSV, so no auth round-trip -- this scenario
  // measures pure PostgREST read throughput (see lib/supabase.js).
  const { headers } = tokenHeadersForVU();

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
}
