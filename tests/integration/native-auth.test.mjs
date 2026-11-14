import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { state, jwt, untrusted, encode } from './native-auth-support.mjs';
import { A, B, bucket, image, id, client, setupBucket, success, row, objectExists, sql, quote } from './support.mjs';

function tamperSignature(value) {
  const parts = value.split('.');
  const signature = Buffer.from(parts[2], 'base64url');
  signature[0] ^= 1;
  return `${parts[0]}.${parts[1]}.${signature.toString('base64url')}`;
}

before(async () => {
  if (sql(`SELECT count(*) FROM storage.buckets WHERE id=${quote(bucket)};`) === '0') await setupBucket();
});
describe('Native Clerk configuration: isolated HTTPS discovery and real service verification', () => {
  it('retrieves discovery and JWKS through the CLI before starting services', () => {
    assert.ok(state.discoveryRequests.includes('/.well-known/openid-configuration'));
    assert.ok(state.discoveryRequests.includes('/.well-known/jwks.json'));
  });
  it('accepts separate Clerk-style string subjects and enforces isolation on both APIs', async () => {
    const users = [A, B].map((subject) => client(subject, jwt(subject)));
    for (const [index, subject] of [A, B].entries()) {
      const owner = users[index], other = users[1 - index];
      const path = `${subject}/${id()}.png`;
      success(await owner.storage.from(bucket).upload(path, image, { contentType: 'image/png' }));
      const created = success(await owner.from('clothing_items').insert({ name: 'Native provider shirt', category: 'Tops', image_path: path }).select().single());
      assert.equal(created.user_id, subject);
      assert.equal(row('clothing_items', created.id).user_id, subject);
      const downloaded = success(await owner.storage.from(bucket).download(path));
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), image);
      assert.equal(success(await other.from('clothing_items').select('id').eq('id', created.id)).length, 0);
      assert.ok((await other.storage.from(bucket).download(path)).error);
      success(await owner.from('clothing_items').delete().eq('id', created.id));
      success(await owner.storage.from(bucket).remove([path]));
      assert.equal(row('clothing_items', created.id), null);
      assert.equal(objectExists(path), false);
    }
  });
  const negatives = [
    ['untrusted issuer with an independent key', () => jwt(A, { key: untrusted, kid: 'untrusted-key', claims: { iss: 'https://untrusted.fixture.test' } })],
    ['untrusted key colliding with the provider kid', () => jwt(A, { key: untrusted })],
    ['untrusted key colliding with the project kid', () => jwt(A, { key: untrusted, kid: state.privateKey.kid })],
    ['tampered signature', () => tamperSignature(jwt(A))],
    ['tampered subject without re-signing', () => {
      const parts = jwt(A).split('.');
      parts[1] = encode({ ...JSON.parse(Buffer.from(parts[1], 'base64url')), sub: B });
      return parts.join('.');
    }, B],
    ['expired provider token', () => jwt(A, { claims: { iat: 0, exp: 1 } })],
    ['unknown kid with an otherwise trusted provider signature', () => jwt(A, { kid: 'unknown-provider-key' })],
  ];
  for (const [name, make, attemptedSubject = A] of negatives) {
    it(`rejects ${name} without persisting rows or objects`, async () => {
      // Use the claimed owner's prefix: rejection must not be explained merely
      // by a mismatch between the forged subject and the requested object path.
      const c = client(attemptedSubject, make()), objectPath = `${attemptedSubject}/${id()}.png`, rowId = id();
      const read = await c.from('clothing_items').select('id');
      assert.equal(read.status, 401, 'PostgREST did not reject invalid authentication');
      const inserted = await c.from('clothing_items').insert({ id: rowId, name: 'Rejected token', category: 'Tops', image_path: objectPath });
      const uploaded = await c.storage.from(bucket).upload(objectPath, image, { contentType: 'image/png' });
      assert.ok(inserted.error && uploaded.error, 'An API accepted invalid authentication');
      assert.equal(row('clothing_items', rowId), null, 'Rejected JWT persisted a row');
      assert.equal(objectExists(objectPath), false, 'Rejected JWT persisted an object');
    });
  }
  it('keeps anonymous requests anonymous across REST and Storage', async () => {
    const owner = client(A, jwt(A)), anon = client(), objectPath = `${A}/${id()}.png`;
    success(await owner.storage.from(bucket).upload(objectPath, image, { contentType: 'image/png' }));
    const created = success(await owner.from('clothing_items').insert({ name: 'Anonymous isolation', category: 'Tops', image_path: objectPath }).select().single());
    const baseline = row('clothing_items', created.id);
    assert.equal(success(await anon.from('clothing_items').select('id').eq('id', created.id)).length, 0);
    assert.ok((await anon.storage.from(bucket).download(objectPath)).error);
    assert.ok((await anon.storage.from(bucket).createSignedUrl(objectPath, 60)).error);
    await anon.from('clothing_items').update({ name: 'Anonymous mutation' }).eq('id', created.id);
    await anon.storage.from(bucket).remove([objectPath]);
    assert.deepEqual(row('clothing_items', created.id), baseline);
    assert.ok(objectExists(objectPath));
    const forged = `${A}/${id()}.png`;
    const forgedId = id();
    assert.ok((await anon.from('clothing_items').insert({ id: forgedId, user_id: A, name: 'Anonymous', category: 'Tops', image_path: forged })).error);
    assert.ok((await anon.storage.from(bucket).upload(forged, image, { contentType: 'image/png' })).error);
    assert.equal(row('clothing_items', forgedId), null);
    assert.equal(objectExists(forged), false);
    success(await owner.from('clothing_items').delete().eq('id', created.id));
    success(await owner.storage.from(bucket).remove([objectPath]));
  });

});
