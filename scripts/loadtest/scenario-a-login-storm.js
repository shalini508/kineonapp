// Scenario A: Login Storm
// Many users opening the app around the same time (e.g. reacting to the
// same push notification). Tests Supabase GoTrue auth capacity only.
import { sleep } from 'k6';
import { login, userForVU } from './lib/supabase.js';

export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  iterations: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const user = userForVU();
  login(user);
  sleep(1);
}
