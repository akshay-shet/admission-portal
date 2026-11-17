/* Google Sheets for the hosted portal, through a Google Cloud SERVICE ACCOUNT (no extra packages).
   The front end's sync (frontend/src/os/gsheet.js) asks the backend for the same five actions it used on claude.ai:
   get_spreadsheet, update_spreadsheet, batch_clear_values, update_values, get_values — this file performs them with the Sheets REST API.
   The key file stays on the server only (GOOGLE_SERVICE_ACCOUNT_FILE in connectivity/config/.env). */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { GOOGLE_KEY_FILE, GOOGLE_KEY_JSON } from '../config/env.js';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = process.env.SHEETS_API_BASE || 'https://sheets.googleapis.com/v4/spreadsheets'; // (SHEETS_API_BASE: only for testing)
let key = null; let token = null; let tokenExp = 0;

export function sheetsConfigured() {
  return !!GOOGLE_KEY_JSON || (!!GOOGLE_KEY_FILE && fs.existsSync(GOOGLE_KEY_FILE));
}
export function serviceAccountEmail() {
  try { return loadKey().client_email; } catch { return ''; }
}
function loadKey() {
  if (key) return key;
  if (!sheetsConfigured()) { const e = new Error('The Google service-account key file is not on the server (GOOGLE_SERVICE_ACCOUNT_FILE).'); e.code = 'server_not_connected'; throw e; }
  key = JSON.parse(GOOGLE_KEY_JSON || fs.readFileSync(GOOGLE_KEY_FILE, 'utf8'));
  if (!key.client_email || !key.private_key) throw new Error('The service-account key file is not valid (no client_email / private_key).');
  return key;
}
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

/** short-lived access token (signed JWT → OAuth token), cached until a minute before it expires */
async function accessToken() {
  if (token && Date.now() < tokenExp - 60e3) return token;
  const k = loadKey();
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: k.client_email, scope: SCOPE, aud: k.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(k.private_key).toString('base64url');
  const r = await fetch(k.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { const e = new Error(`Google sign-in for the service account failed: ${j.error_description || j.error || r.status}`); e.code = 'needs_reauth'; throw e; }
  token = j.access_token; tokenExp = Date.now() + (j.expires_in || 3600) * 1000;
  return token;
}

async function google(method, url, body) {
  const r = await fetch(url, { method, headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error?.message || `Google Sheets error ${r.status}`);
    e.code = r.status === 429 || r.status >= 500 ? 'server_unavailable' : 'tool_error';
    e.status = r.status;
    throw e;
  }
  return j;
}
const enc = encodeURIComponent;
const ID = /^[A-Za-z0-9_-]{20,}$/;

/** the five actions the front end uses, with the same input names as the claude.ai connector */
export async function runSheetsTool(tool, input = {}) {
  const id = String(input.spreadsheetId || '');
  if (!ID.test(id)) { const e = new Error('Bad spreadsheet id'); e.code = 'bad_request'; throw e; }
  switch (tool) {
    case 'get_spreadsheet': {
      const f = Array.isArray(input.fields) && input.fields.length ? `?fields=${enc(input.fields.join(','))}` : '';
      return google('GET', `${API}/${id}${f}`);
    }
    case 'update_spreadsheet':
      return google('POST', `${API}/${id}:batchUpdate`, { requests: input.requests || [] });
    case 'batch_clear_values':
      return google('POST', `${API}/${id}/values:batchClear`, { ranges: input.ranges || [] });
    case 'update_values':
      return google('PUT', `${API}/${id}/values/${enc(String(input.range || ''))}?valueInputOption=USER_ENTERED`, { range: input.range, values: input.values || [] });
    case 'get_values':
      return google('GET', `${API}/${id}/values/${enc(String(input.range || ''))}`);
    default: { const e = new Error('Unknown action'); e.code = 'bad_request'; throw e; }
  }
}
