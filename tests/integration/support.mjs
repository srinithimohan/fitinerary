import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createPrivateKey, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const statePath = process.env.FITINERARY_INTEGRATION_STATE;
assert.ok(statePath, 'Run pnpm test:integration; no ambient Supabase URL is accepted');
const state = JSON.parse(readFileSync(statePath, 'utf8'));
assert.match(state.project, /^fitinerary-it-[0-9a-f]{8}$/);
assert.equal(state.container, `supabase_db_${state.project}`);
const base = new URL(state.url);
assert.equal(base.origin, 'http://127.0.0.1:55321');
assert.ok(state.anonKey && state.serviceKey, 'Local stack did not return required test credentials');
export const A = 'user_fitinerary_test_a';
export const B = 'user_fitinerary_test_b';
export const bucket = 'clothing-images';
export const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
export const id = () => randomUUID();
export const catalog = JSON.parse(readFileSync(new URL('./fixtures/catalog.ownership-target.json', import.meta.url), 'utf8'));
const key = createPrivateKey({ key: state.privateKey, format: 'jwk' });

export function token(sub, overrides = {}, invalidSignature = false) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'ES256', kid: state.privateKey.kid, typ: 'JWT' })}.${encode({
    iss: state.issuer, sub, role: 'authenticated', aud: 'authenticated', iat: now - 5, exp: now + 600, ...overrides,
  })}`;
  const signingKey = invalidSignature ? generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey : key;
  return `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key: signingKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
// Refuse redirects and any destination outside this run's loopback gateway.
export async function localFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert.equal(url.origin, base.origin, 'Nonlocal network request blocked');
  return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(60_000) });
}
export function client(subject, jwt) {
  return createClient(base.origin, state.anonKey, {
    accessToken: subject ? async () => jwt ?? token(subject) : undefined,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: localFetch },
  });
}
// This client never leaves setup. Tests use user-scoped clients for every action.
export async function setupBucket() {
  const admin = createClient(base.origin, state.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch },
  });
  const result = await admin.storage.createBucket(bucket, {
    public: false, fileSizeLimit: catalog.bucket.file_size_limit, allowedMimeTypes: catalog.bucket.allowed_mime_types,
  });
  assert.equal(result.error, null, 'Local bucket setup failed');
}
export function sql(query) {
  const result = spawnSync('docker', ['exec', '-i', state.container, 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], {
    input: `BEGIN READ ONLY;\n${query}\nROLLBACK;`, encoding: 'utf8', timeout: 60_000,
  });
  assert.equal(result.status, 0, 'Independent local database verification failed');
  return result.stdout.split('\n').filter((line) => line && !['BEGIN', 'ROLLBACK'].includes(line)).join('\n');
}
export const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
export function row(table, rowId) {
  assert.ok(['clothing_items', 'boards', 'board_items'].includes(table));
  const result = sql(`SELECT row_to_json(t)::text FROM public.${table} t WHERE id = ${quote(rowId)};`);
  return result ? JSON.parse(result) : null;
}
export function objectExists(objectPath) {
  return sql(`SELECT count(*) FROM storage.objects WHERE bucket_id=${quote(bucket)} AND name=${quote(objectPath)};`) !== '0';
}
export function success(result, message = 'Owner operation failed') {
  // Do not include response data (which can contain bearer URLs/tokens).
  assert.equal(result.error, null, message);
  return result.data;
}
export async function clothing(subject, name = 'Synthetic shirt') {
  const path = `${subject}/${id()}.png`;
  success(await client(subject).storage.from(bucket).upload(path, image, { contentType: 'image/png', upsert: false }));
  return success(await client(subject).from('clothing_items').insert({ name, category: 'Tops', image_path: path }).select().single());
}
export async function board(subject) {
  return success(await client(subject).from('boards').insert({ name: 'Synthetic board' }).select().single());
}
export const objectUrl = (path, kind = 'authenticated') => `${base.origin}/storage/v1/object/${kind}/${bucket}/${path}`;
export async function bytes(subject, path) {
  const blob = success(await client(subject).storage.from(bucket).download(path), 'Owner download failed');
  return Buffer.from(await blob.arrayBuffer());
}
