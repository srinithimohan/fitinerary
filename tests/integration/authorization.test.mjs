import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import {
  A, B, bucket, image, id, catalog, token, client, setupBucket, sql, quote, row,
  success, clothing, board, objectUrl, localFetch, bytes, objectExists,
} from './support.mjs';

before(setupBucket);

describe('Exported authorization fixture parity', () => {
  it('installs all 16 exact policy predicates and role targets', () => {
    const actual = JSON.parse(sql(`SELECT json_agg(p ORDER BY schemaname, tablename, policyname)::text FROM (
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
      WHERE (schemaname = 'public' AND tablename IN ('clothing_items','boards','board_items'))
        OR (schemaname = 'storage' AND tablename IN ('objects','buckets'))
    ) p;`));
    assert.deepEqual(actual, catalog.policies);
  });
  it('preserves ownership, RLS flags, roles, and the owner column type/default', () => {
    for (const expected of catalog.ownership) {
      const actual = JSON.parse(sql(`SELECT json_build_object('owner', pg_get_userbyid(c.relowner),
        'enabled', c.relrowsecurity, 'forced', c.relforcerowsecurity)::text
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=${quote(expected.schema_name)} AND c.relname=${quote(expected.table_name)};`));
      assert.deepEqual(actual, { owner: expected.owner, enabled: true, forced: false });
      const acl = JSON.parse(sql(`SELECT json_agg(a::text ORDER BY a::text)::text
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
          LATERAL unnest(c.relacl) a
        WHERE n.nspname=${quote(expected.schema_name)} AND c.relname=${quote(expected.table_name)};`));
      assert.deepEqual(acl, [...expected.table_acl].sort(), 'Effective table ACL fixture differs from export');
    }
    for (const expected of catalog.roles) {
      const actual = JSON.parse(sql(`SELECT json_build_object('rolsuper', rolsuper,
        'rolinherit', rolinherit, 'rolbypassrls', rolbypassrls, 'rolcanlogin', rolcanlogin)::text
        FROM pg_roles WHERE rolname=${quote(expected.rolname)};`));
      const { rolsuper, rolinherit, rolbypassrls, rolcanlogin } = expected;
      assert.deepEqual(actual, { rolsuper, rolinherit, rolbypassrls, rolcanlogin });
    }
    assert.equal(sql("SELECT count(*) FROM pg_auth_members WHERE member IN ('anon'::regrole, 'authenticated'::regrole);"), '0');
    for (const schema of catalog.schemaPrivileges) {
      const actual = JSON.parse(sql(`SELECT json_build_object('a', has_schema_privilege('authenticated', ${quote(schema.schema_name)}, 'USAGE'),
        'anon', has_schema_privilege('anon', ${quote(schema.schema_name)}, 'USAGE'))::text;`));
      assert.deepEqual(actual, { a: schema.authenticated_usage, anon: schema.anon_usage });
    }
    for (const table of ['clothing_items', 'boards']) {
      assert.equal(sql(`SELECT data_type || ':' || column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name=${quote(table)} AND column_name='user_id';`), "text:(auth.jwt() ->> 'sub'::text)");
    }
  });
  it('reproduces all exported application columns, constraints, and indexes', () => {
    const columns = JSON.parse(sql(`SELECT json_agg(json_build_object('table_name', table_name,
      'column_name', column_name, 'data_type', data_type, 'is_nullable', is_nullable,
      'column_default', column_default) ORDER BY table_name, ordinal_position)::text
      FROM information_schema.columns WHERE table_schema='public'
        AND table_name IN ('clothing_items','boards','board_items');`));
    assert.deepEqual(columns, catalog.columns.map(({ table_name, column_name, data_type, is_nullable, column_default }) =>
      ({ table_name, column_name, data_type, is_nullable, column_default })));
    for (const constraint of catalog.constraints) {
      assert.equal(sql(`SELECT pg_get_constraintdef(k.oid) FROM pg_constraint k
        JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname=${quote(constraint.table_name)} AND k.conname=${quote(constraint.constraint_name)};`), constraint.definition);
    }
    for (const index of catalog.indexes) {
      assert.equal(sql(`SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname=${quote(index.indexname)};`), index.indexdef);
    }
  });
  it('uses the documented direct policy helpers with invoker rights and client execution grants', () => {
    for (const helper of catalog.helpers) {
      const signature = `${helper.schema_name}.${helper.function_name}(${helper.function_name === 'foldername' ? 'text' : ''})`;
      const actual = JSON.parse(sql(`SELECT json_build_object('owner', pg_get_userbyid(proowner),
        'definer', prosecdef, 'config', proconfig,
        'a', has_function_privilege('authenticated', oid, 'EXECUTE'),
        'anon', has_function_privilege('anon', oid, 'EXECUTE'), 'body', prosrc)::text
        FROM pg_proc WHERE oid=${quote(signature)}::regprocedure;`));
      assert.equal(actual.owner, helper.owner);
      assert.equal(actual.definer, false);
      assert.equal(actual.config, helper.configuration);
      assert.equal(actual.a, true);
      assert.equal(actual.anon, true);
      const expectedBody = helper.definition.split('$function$')[1];
      assert.equal(actual.body.replace(/\s+/g, ' ').trim(), expectedBody.replace(/\s+/g, ' ').trim(), 'Pinned helper body differs from export');
    }
  });
  it('has all exported provider triggers and their nested lifecycle dependencies from pinned Storage migrations', () => {
    const actual = JSON.parse(sql(`SELECT json_agg(json_build_object('name', t.tgname,
      'definition', pg_get_triggerdef(t.oid), 'owner', pg_get_userbyid(p.proowner),
      'definer', p.prosecdef, 'config', p.proconfig) ORDER BY t.tgname)::text
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE NOT t.tgisinternal AND n.nspname IN ('public','storage')
        AND c.relname IN ('clothing_items','boards','board_items','buckets','objects');`));
    assert.equal(actual.length, catalog.triggers.length, 'Local trigger inventory differs from export');
    for (const expected of catalog.triggers) {
      const trigger = actual.find((t) => t.name === expected.trigger_name);
      assert.ok(trigger, `Missing trigger ${expected.trigger_name}`);
      assert.equal(trigger.definition, expected.definition);
      assert.equal(trigger.owner, 'supabase_storage_admin', 'Unexpected local provider function owner');
      if (expected.trigger_function.includes('SECURITY DEFINER')) {
        assert.equal(trigger.definer, true);
        assert.deepEqual(trigger.config, ['search_path=pg_catalog']);
      }
    }
    assert.equal(sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='storage' AND p.proname='reconcile_lifecycle_state';"), '1');
    assert.equal(sql("SELECT to_regclass('storage.bucket_lifecycle_states')::text;"), 'storage.bucket_lifecycle_states');
  });
});

describe('Real service JWT validation (local asymmetric keys; NOT native Clerk evidence)', () => {
  it('accepts two distinct non-UUID subjects through REST and Storage', async () => {
    for (const subject of [A, B]) assert.equal((await clothing(subject)).user_id, subject);
  });
  for (const [name, make] of [
    ['invalid signature', () => token(A, {}, true)],
    ['expired token', () => token(A, { exp: 1, iat: 0 })],
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

describe('Database authorization over real PostgREST HTTP', () => {
  for (const table of ['clothing_items', 'boards']) {
    it(`${table}: owner CRUD, cross-user and anonymous reads/mutations, spoofing and upsert`, async () => {
      const owned = table === 'boards' ? await board(A) : await clothing(A);
      const own = client(A), other = client(B), anon = client();
      assert.equal(success(await own.from(table).select('id').eq('id', owned.id)).length, 1);
      for (const c of [other, anon]) {
        const read = await c.from(table).select('*').eq('id', owned.id);
        assert.ok(read.error || read.data.length === 0, 'Unauthorized row was exposed');
        const baseline = row(table, owned.id);
        await c.from(table).update({ name: 'Unauthorized mutation' }).eq('id', owned.id);
        assert.deepEqual(row(table, owned.id), baseline, 'Unauthorized update persisted');
        await c.from(table).delete().eq('id', owned.id);
        assert.deepEqual(row(table, owned.id), baseline, 'Unauthorized delete persisted');
        const upsert = await c.from(table).upsert({ ...owned, name: 'Unauthorized upsert' });
        assert.ok(upsert.error, 'Unauthorized upsert succeeded');
        assert.deepEqual(row(table, owned.id), baseline);
        const forgedId = id();
        const forged = await c.from(table).insert({ ...owned, id: forgedId, user_id: A });
        assert.ok(forged.error, 'Spoofed owner insertion succeeded');
        assert.equal(row(table, forgedId), null);
      }
      assert.ok((await own.from(table).update({ user_id: B }).eq('id', owned.id)).error);
      assert.equal(row(table, owned.id).user_id, A);
      success(await own.from(table).upsert({ ...owned, name: 'Owner upsert' }));
      assert.equal(row(table, owned.id).name, 'Owner upsert');
      success(await own.from(table).delete().eq('id', owned.id));
      assert.equal(row(table, owned.id), null);
    });
  }
  it('board_items: owner writes, nested query isolation, cross-owner board insertion and reassignment', async () => {
    const ba = await board(A), bb = await board(B), itemId = id();
    const payload = { id: itemId, board_id: ba.id, position: 0, image_path_snapshot: `${A}/${id()}.png` };
    success(await client(A).from('board_items').insert(payload));
    success(await client(A).from('board_items').upsert({ ...payload, name_snapshot: 'Owner update' }));
    assert.equal(row('board_items', itemId).name_snapshot, 'Owner update');
    const nested = success(await client(A).from('boards').select('id,board_items(*)').eq('id', ba.id).single());
    assert.equal(nested.board_items.length, 1);
    const baseline = row('board_items', itemId);
    for (const c of [client(B), client()]) {
      const read = await c.from('board_items').select('*').eq('id', itemId);
      assert.ok(read.error || read.data.length === 0);
      const hidden = await c.from('boards').select('id,board_items(*)').eq('id', ba.id);
      assert.ok(hidden.error || hidden.data.length === 0);
      await c.from('board_items').update({ name_snapshot: 'Other user' }).eq('id', itemId);
      await c.from('board_items').delete().eq('id', itemId);
      assert.deepEqual(row('board_items', itemId), baseline);
      assert.ok((await c.from('board_items').upsert(payload)).error);
      const forgedId = id();
      assert.ok((await c.from('board_items').insert({ ...payload, id: forgedId, position: 1 })).error);
      assert.equal(row('board_items', forgedId), null);
    }
    assert.ok((await client(A).from('board_items').update({ board_id: bb.id }).eq('id', itemId)).error);
    assert.deepEqual(row('board_items', itemId), baseline);
    success(await client(A).from('board_items').delete().eq('id', itemId));
    assert.equal(row('board_items', itemId), null);
  });
  for (const operation of ['insert', 'update', 'upsert']) {
    it(`rejects a cross-owner clothing_item_id via ${operation} (security regression gate)`, async () => {
      const ba = await board(A), cb = await clothing(B), itemId = id();
      const payload = { id: itemId, board_id: ba.id, position: 0, image_path_snapshot: `${A}/${id()}.png` };
      if (operation !== 'insert') success(await client(A).from('board_items').insert(payload));
      const baseline = row('board_items', itemId);
      const query = client(A).from('board_items');
      const result = operation === 'update'
        ? await query.update({ clothing_item_id: cb.id }).eq('id', itemId)
        : await query[operation]({ ...payload, clothing_item_id: cb.id });
      assert.deepEqual(row('board_items', itemId), baseline, 'SECURITY: an owned board can reference another user’s clothing row');
      assert.ok(result.error, 'Cross-owner clothing reference was accepted');
    });
  }
});

describe('Real Supabase Storage authorization', () => {
  it('allows owner upload/download/sign/copy/overwrite/delete; signed URLs are bearer capabilities', async () => {
    const path = `${A}/${id()}.png`, copy = `${A}/board-snapshots/${id()}/copy.png`;
    const storage = client(A).storage.from(bucket);
    success(await storage.upload(path, image, { contentType: 'image/png', upsert: false }));
    assert.deepEqual(await bytes(A, path), image);
    assert.ok((await storage.upload(path, image, { contentType: 'image/png', upsert: false })).error);
    const replacement = Buffer.concat([image, Buffer.from([0])]);
    success(await storage.upload(path, replacement, { contentType: 'image/png', upsert: true }));
    assert.deepEqual(await bytes(A, path), replacement);
    success(await storage.copy(path, copy));
    const signed = success(await storage.createSignedUrl(path, 60));
    const response = await localFetch(signed.signedUrl); // No user Authorization header.
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), replacement);
    success(await storage.remove([path]));
    assert.ok((await storage.download(path)).error);
    assert.deepEqual(await bytes(A, copy), replacement, 'Independent snapshot was deleted with original');
    success(await storage.remove([copy]));
    assert.ok((await storage.download(copy)).error);
  });
  it('preserves a saved board snapshot after deletion of original clothing row and object', async () => {
    const c = await clothing(A), b = await board(A), snapshot = `${A}/board-snapshots/${b.id}/${id()}.png`;
    const storage = client(A).storage.from(bucket);
    success(await storage.copy(c.image_path, snapshot));
    const item = success(await client(A).from('board_items').insert({ board_id: b.id, position: 0,
      clothing_item_id: c.id, image_path_snapshot: snapshot }).select().single());
    success(await client(A).from('clothing_items').delete().eq('id', c.id));
    success(await storage.remove([c.image_path]));
    assert.equal(row('board_items', item.id).clothing_item_id, null);
    assert.equal(row('board_items', item.id).image_path_snapshot, snapshot);
    assert.deepEqual(await bytes(A, snapshot), image);
  });
  for (const subject of [B, undefined]) {
    it(`${subject ?? 'anonymous'} cannot read/sign/overwrite/delete another owner’s objects or forge prefixes`, async () => {
      const c = await clothing(A), original = await bytes(A, c.image_path);
      const storage = client(subject).storage.from(bucket);
      assert.ok((await storage.download(c.image_path)).error);
      assert.ok((await storage.createSignedUrl(c.image_path, 60)).error);
      for (const kind of ['authenticated', 'public']) {
        const response = await localFetch(objectUrl(c.image_path, kind));
        assert.notEqual(response.status, 200, 'Unsigned access exposed private bytes');
      }
      assert.ok((await storage.upload(c.image_path, Buffer.from('overwrite'), { contentType: 'image/png', upsert: true })).error);
      await storage.remove([c.image_path]); // Storage can silently filter denied deletes.
      assert.deepEqual(await bytes(A, c.image_path), original);
      const forged = `${A}/${id()}.png`;
      assert.ok((await storage.upload(forged, image, { contentType: 'image/png' })).error);
      assert.equal(objectExists(forged), false);
      assert.ok((await client(A).storage.from(bucket).download(forged)).error);
      const dest = `${subject ?? A}/${id()}.png`;
      assert.ok((await storage.copy(c.image_path, dest)).error);
      assert.equal(objectExists(dest), false);
      assert.ok((await client(subject ?? A).storage.from(bucket).download(dest)).error);
      assert.deepEqual(await bytes(A, c.image_path), original);
    });
  }
  it('rejects copying an owned source into a different owner’s prefix', async () => {
    const c = await clothing(B), destination = `${A}/${id()}.png`;
    assert.ok((await client(B).storage.from(bucket).copy(c.image_path, destination)).error);
    assert.equal(objectExists(destination), false);
    assert.ok((await client(A).storage.from(bucket).download(destination)).error);
    assert.deepEqual(await bytes(B, c.image_path), image);
  });
});
