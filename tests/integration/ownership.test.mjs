import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { A, B, id, client, board, success, row, sql, quote, catalog } from './support.mjs';

// These relationship tests need no Storage objects. Snapshot-byte preservation
// remains covered by the existing, unchanged real Storage integration tests.
async function metadata(subject) {
  return success(await client(subject).from('clothing_items').insert({
    name: 'Synthetic clothing reference', category: 'Tops', image_path: `${subject}/${id()}.png`,
  }).select().single());
}

describe('Approved clothing ownership migration', () => {
  it('changes only the two WITH CHECK expressions and preserves the audited baseline', () => {
    const original = JSON.parse(readFileSync(new URL('./fixtures/catalog.json', import.meta.url), 'utf8'));
    const { targetMigration, ...target } = catalog;
    assert.equal(targetMigration, 'supabase/migrations/20261109000100_board_item_clothing_ownership.sql');
    const changes = [];
    for (let i = 0; i < original.policies.length; i++) {
      const before = original.policies[i], after = target.policies[i];
      const { with_check: oldCheck, ...oldRest } = before;
      const { with_check: newCheck, ...newRest } = after;
      assert.deepEqual(newRest, oldRest, 'Policy name/role/command/USING must not change');
      if (oldCheck !== newCheck) changes.push(`${before.schemaname}.${before.tablename}:${before.cmd}`);
    }
    assert.deepEqual(changes, ['public.board_items:INSERT', 'public.board_items:UPDATE']);
    const { policies: originalPolicies, ...originalRest } = original;
    const { policies: targetPolicies, ...targetRest } = target;
    assert.equal(targetPolicies.length, originalPolicies.length);
    assert.deepEqual(targetRest, originalRest, 'No schema/grant/Storage configuration changes');
  });

  it('allows owner insert, reference reassignment, upsert, and null detachment', async () => {
    const b = await board(A), first = await metadata(A), second = await metadata(A), itemId = id();
    const payload = { id: itemId, board_id: b.id, position: 0, clothing_item_id: first.id, image_path_snapshot: `${A}/${id()}.png` };
    success(await client(A).from('board_items').insert(payload));
    assert.equal(row('board_items', itemId).clothing_item_id, first.id);
    success(await client(A).from('board_items').update({ clothing_item_id: second.id }).eq('id', itemId));
    assert.equal(row('board_items', itemId).clothing_item_id, second.id);
    success(await client(A).from('board_items').upsert(payload));
    assert.equal(row('board_items', itemId).clothing_item_id, first.id);
    success(await client(A).from('board_items').update({ clothing_item_id: null }).eq('id', itemId));
    assert.equal(row('board_items', itemId).clothing_item_id, null);
    assert.equal(row('board_items', itemId).image_path_snapshot, payload.image_path_snapshot);
  });

  for (const occupied of [false, true]) {
    it(`allows owned references using the route's board_id,position upsert (${occupied ? 'occupied' : 'new'} position)`, async () => {
      const b = await board(A), c = await metadata(A);
      const payload = { board_id: b.id, position: 0, clothing_item_id: c.id, image_path_snapshot: `${A}/${id()}.png` };
      if (occupied) success(await client(A).from('board_items').insert({ ...payload, clothing_item_id: null }));
      success(await client(A).from('board_items').upsert(payload, { onConflict: 'board_id,position' }));
      const result = success(await client(A).from('board_items').select('*').eq('board_id', b.id).single());
      assert.equal(result.clothing_item_id, c.id);
      assert.equal(result.image_path_snapshot, payload.image_path_snapshot);
    });

    it(`rejects foreign references using board_id,position upsert (${occupied ? 'occupied' : 'new'} position)`, async () => {
      const b = await board(A), c = await metadata(B);
      const payload = { board_id: b.id, position: 0, clothing_item_id: null, image_path_snapshot: `${A}/${id()}.png` };
      if (occupied) success(await client(A).from('board_items').insert(payload));
      const before = sql(`SELECT json_agg(t)::text FROM public.board_items t WHERE board_id=${quote(b.id)};`);
      const result = await client(A).from('board_items').upsert({ ...payload, clothing_item_id: c.id }, { onConflict: 'board_id,position' });
      assert.ok(result.error);
      assert.equal(sql(`SELECT json_agg(t)::text FROM public.board_items t WHERE board_id=${quote(b.id)};`), before);
    });
  }

  it('rejects nonexistent references without inserting a row', async () => {
    const b = await board(A), itemId = id();
    const result = await client(A).from('board_items').insert({ id: itemId, board_id: b.id, position: 0,
      clothing_item_id: id(), image_path_snapshot: `${A}/${id()}.png` });
    assert.ok(result.error);
    assert.equal(row('board_items', itemId), null);
  });

  it('preserves ON DELETE SET NULL and permits later snapshot edits and board deletion', async () => {
    const b = await board(A), c = await metadata(A), itemId = id(), path = `${A}/${id()}.png`;
    success(await client(A).from('board_items').insert({ id: itemId, board_id: b.id, position: 0,
      clothing_item_id: c.id, image_path_snapshot: path }));
    success(await client(A).from('clothing_items').delete().eq('id', c.id));
    assert.equal(row('board_items', itemId).clothing_item_id, null);
    success(await client(A).from('board_items').update({ name_snapshot: 'Retained snapshot' }).eq('id', itemId));
    assert.equal(row('board_items', itemId).image_path_snapshot, path);
    success(await client(A).from('boards').delete().eq('id', b.id));
    assert.equal(row('board_items', itemId), null);
  });
});
