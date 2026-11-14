// Deliberately strict conformance assertions. This file is excluded only from
// the explicit required profile; the full diagnostic profile executes everything.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { A, bucket, image, id, token, client, objectExists, setupBucket, sql, quote } from './support.mjs';

before(async () => {
  if (sql(`SELECT count(*) FROM storage.buckets WHERE id=${quote(bucket)};`) === '0') await setupBucket();
});

describe('Issuer conformance diagnostic: project signing key', () => {
  for (const [name, make] of [
    ['untrusted issuer (same trusted key)', () => token(A, { iss: 'https://untrusted.integration.invalid' })],
  ]) {
    it(`rejects ${name} at REST and Storage`, async () => {
      const c = client(A, make());
      const path = `${A}/${id()}.png`;
      const rest = await c.from('clothing_items').select('id');
      const storage = await c.storage.from(bucket).upload(path, image, { contentType: 'image/png' });
      assert.deepEqual({ restRejected: !!rest.error, storageRejected: !!storage.error, objectCreated: objectExists(path) },
        { restRejected: true, storageRejected: true, objectCreated: false },
        'Invalid authentication was accepted; native Clerk verification is not established');
    });
  }
});
