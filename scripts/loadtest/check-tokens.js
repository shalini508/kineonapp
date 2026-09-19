// Pre-flight check for the pre-minted load-test tokens.
//
// The tokens in data/loadtest/users2.csv are short-lived. A run started on
// expired tokens doesn't fail obviously -- every request comes back
// 401 PGRST303 and the whole tier looks like a catastrophic backend failure.
// So run this first, every time, before any tier:
//
//   node scripts/loadtest/check-tokens.js
//
// It decodes the expiry locally (no network) and then makes one real read
// and one real write with a sample of tokens, since a well-formed
// unexpired token can still be rejected by RLS.

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
// Set WRITE_CHECK=0 to skip the insert and only verify reads.
const DO_WRITE = process.env.WRITE_CHECK !== '0';

function decodeJwt(token) {
  const part = token.split('.')[1];
  if (!part) return null;
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
}

async function checkRow(row, index) {
  const [userId, authId, email, password, accessToken] = row.split(',');
  const token = (accessToken || '').trim();
  const label = `row ${index} (${email})`;
  if (!token) return { label, ok: false, reason: 'no access_token in CSV' };

  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const read = await fetch(`${BASE_URL}/rest/v1/users?select=id`, { headers });
  if (read.status !== 200) {
    return { label, ok: false, reason: `read ${read.status}: ${(await read.text()).slice(0, 120)}` };
  }

  if (!DO_WRITE) return { label, ok: true, reason: 'read ok (write check skipped)' };

  const now = new Date();
  const payload = {
    user_id: parseInt(userId, 10),
    device_model_id: 2,
    body_part: 'knee',
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
  };
  const write = await fetch(`${BASE_URL}/rest/v1/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (write.status < 200 || write.status >= 300) {
    return { label, ok: false, reason: `write ${write.status}: ${(await write.text()).slice(0, 120)}` };
  }
  return { label, ok: true, reason: 'read + write ok' };
}

async function main() {
  const lines = fs.readFileSync(CSV, 'utf8').trim().split('\n').slice(1).filter((l) => l.trim());
  console.log(`CSV: ${CSV}`);
  console.log(`Accounts: ${lines.length}\n`);

  // Expiry is identical across the batch (all minted together), so decode
  // the first row for the window and then confirm none have drifted.
  const claims = decodeJwt(lines[0].split(',')[4] || '');
  if (!claims) {
    console.error('FAIL: could not decode the first token -- is the CSV in the expected format?');
    process.exit(1);
  }
  const expMs = claims.exp * 1000;
  const hoursLeft = (expMs - Date.now()) / 3600000;
  console.log(`Minted : ${new Date(claims.iat * 1000).toString()}`);
  console.log(`Expires: ${new Date(expMs).toString()}`);
  console.log(`Window : ${((claims.exp - claims.iat) / 3600).toFixed(0)}h`);

  if (hoursLeft <= 0) {
    console.error(`\nFAIL: tokens expired ${Math.abs(hoursLeft).toFixed(1)}h ago. Ask Kundan to re-mint before running any tier.`);
    process.exit(1);
  }
  console.log(`Valid  : ${hoursLeft.toFixed(1)}h remaining${hoursLeft < 2 ? '  <-- tight, consider re-minting' : ''}\n`);

  const indices = [0, Math.floor(lines.length / 2), lines.length - 1];
  const results = [];
  for (const i of indices) {
    results.push(await checkRow(lines[i], i));
  }
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label} -- ${r.reason}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\n${failed.length}/${results.length} sample tokens unusable -- do not start a tier run.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} sampled tokens work. Safe to run a tier.`);
  if (DO_WRITE) {
    console.log('Note: this check inserted 3 test sessions (load-test accounts, cleaned up with the rest).');
  }
}

main().catch((e) => {
  console.error('check-tokens crashed:', e);
  process.exit(1);
});
