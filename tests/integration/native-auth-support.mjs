import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const state = JSON.parse(readFileSync(process.env.FITINERARY_INTEGRATION_STATE, 'utf8'));
assert.equal(state.providerIssuer, 'https://clerk.fixture.test');
assert.equal(state.providerKey.alg, 'RS256');
assert.equal(state.providerKey.kty, 'RSA');
assert.notEqual(state.providerKey.kid, state.privateKey.kid);
assert.ok(state.providerKey.d !== state.privateKey.d, 'Provider and project signing keys must be independent');
const provider = createPrivateKey({ key: state.providerKey, format: 'jwk' });
export const untrusted = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
export const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
export function jwt(subject, { claims = {}, kid = state.providerKey.kid, key = provider } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const message = `${encode({ alg: 'RS256', typ: 'JWT', kid })}.${encode({
    iss: state.providerIssuer, sub: subject, role: 'authenticated', v: 2,
    sid: `sess_fitinerary_${subject}`, nbf: now - 5, iat: now - 5, exp: now + 600, ...claims,
  })}`;
  const signature = sign('RSA-SHA256', Buffer.from(message), key);
  return `${message}.${signature.toString('base64url')}`;
}
