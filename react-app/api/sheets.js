import crypto from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

let keyCache = null;
let tokenCache = null;
let tokenExp = 0;

function getKey() {
  if (keyCache) return keyCache;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    keyCache = typeof raw === 'object' ? raw : JSON.parse(raw);
    return keyCache;
  } catch (e) {
    console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON:', e);
    return null;
  }
}

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function accessToken() {
  if (tokenCache && Date.now() < tokenExp - 60e3) return tokenCache;
  const k = getKey();
  if (!k || !k.client_email || !k.private_key) {
    const e = new Error('Google Service Account key is not configured or invalid');
    e.code = 'server_not_connected';
    throw e;
  }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: k.client_email,
    scope: SCOPE,
    aud: k.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(k.private_key).toString('base64url');
  const r = await fetch(k.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${sig}`,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const e = new Error(`Google token error: ${j.error_description || j.error || r.status}`);
    e.code = 'needs_reauth';
    throw e;
  }
  tokenCache = j.access_token;
  tokenExp = Date.now() + (j.expires_in || 3600) * 1000;
  return tokenCache;
}

async function google(method, url, body) {
  const token = await accessToken();
  const r = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error?.message || `Google Sheets error: ${r.status}`);
    e.code = r.status === 429 || r.status >= 500 ? 'server_unavailable' : 'tool_error';
    e.status = r.status;
    throw e;
  }
  return j;
}

const enc = encodeURIComponent;
const ID = /^[A-Za-z0-9_-]{20,}$/;

async function runSheetsTool(tool, input = {}) {
  const id = String(input.spreadsheetId || '');
  if (!ID.test(id)) {
    const e = new Error('Bad spreadsheet ID');
    e.code = 'bad_request';
    throw e;
  }
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
    default: {
      const e = new Error(`Unknown action: ${tool}`);
      e.code = 'bad_request';
      throw e;
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const k = getKey();
    return res.status(200).json({ ok: true, configured: !!k, email: k?.client_email || '' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { tool, input } = body;
    if (!tool) {
      return res.status(400).json({ error: 'Missing tool param' });
    }
    const result = await runSheetsTool(tool, input);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Sheets handler error:', err);
    return res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      code: err.code || 'unknown_error',
    });
  }
}
