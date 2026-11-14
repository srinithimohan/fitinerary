import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@clerk/nextjs/server';
import { PATCH } from '@/app/api/boards/[id]/route';
import { db, failure, ok } from '../support/supabase';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/app/lib/supabase', async () => {
  const { db } = await import('../support/supabase');
  return { createServerSupabaseClient: () => db };
});

const ownedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const foreignId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const missingId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const path = 'user-a/board-snapshots/board-1/saved.png';
const context = () => ({ params: Promise.resolve({ id: 'board-1' }) });
function request(items: unknown) {
  const form = new FormData();
  form.set('name', 'Trip');
  form.set('items', JSON.stringify(items));
  form.set('file-0', new File(['synthetic'], 'upload.png', { type: 'image/png' }));
  return new Request('http://localhost/api/boards/board-1', { method: 'PATCH', body: form });
}
function expectNoWrites() {
  for (const query of db.queries) {
    expect(query.upsert).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
    expect(query.delete).not.toHaveBeenCalled();
  }
  expect(db.bucket.upload).not.toHaveBeenCalled();
  expect(db.bucket.copy).not.toHaveBeenCalled();
  expect(db.bucket.remove).not.toHaveBeenCalled();
}

beforeEach(() => {
  db.reset();
  vi.mocked(auth).mockResolvedValue({ userId: 'user-a' } as Awaited<ReturnType<typeof auth>>);
});

describe('PATCH snapshot clothing ownership', () => {
  it.each([['foreign', foreignId], ['missing', missingId]])('rejects a %s clothing reference with the same generic response', async (_label, clothingItemId) => {
    // The user-scoped ownership query returns neither foreign nor missing rows.
    db.results.push(ok({ id: 'board-1' }), ok([]));
    const response = await PATCH(request([{ position: 0, snapshotPath: path, clothingItemId }]), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'One of the clothing items could not be found.' });
    expectNoWrites();
  });

  it('rejects a forged snapshot reference before processing an earlier direct upload', async () => {
    db.results.push(ok({ id: 'board-1' }), ok([]));
    const response = await PATCH(request([
      { position: 0, hasUpload: true, clothingItemId: null },
      { position: 1, snapshotPath: path, clothingItemId: foreignId },
    ]), context());
    expect(response.status).toBe(400);
    expectNoWrites();
  });

  it('rejects a mixed list of owned and foreign snapshot references before writing either item', async () => {
    db.results.push(ok({ id: 'board-1' }), ok([{ id: ownedId }]));
    const response = await PATCH(request([
      { position: 0, snapshotPath: path, clothingItemId: ownedId },
      { position: 1, snapshotPath: 'user-a/board-snapshots/board-1/second.png', clothingItemId: foreignId },
    ]), context());
    expect(response.status).toBe(400);
    expectNoWrites();
  });

  it.each([false, 0, {}, '', 'not-a-uuid'])('rejects malformed non-null snapshot references: %j', async (clothingItemId) => {
    db.results.push(ok({ id: 'board-1' }));
    expect((await PATCH(request([{ position: 0, snapshotPath: path, clothingItemId }]), context())).status).toBe(400);
    expectNoWrites();
  });

  it('fails closed on an ownership-query outage without exposing backend details', async () => {
    db.results.push(ok({ id: 'board-1' }), failure('private backend details'));
    const response = await PATCH(request([{ position: 0, snapshotPath: path, clothingItemId: ownedId }]), context());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Could not validate clothing references.' });
    expectNoWrites();
  });

  it.each([ownedId, ownedId.toUpperCase()])('preserves an owned non-null reference and its independent snapshot: %s', async (clothingItemId) => {
    db.results.push(ok({ id: 'board-1' }), ok([{ id: ownedId }]),
      ok([{ id: 'saved-row', position: 0, image_path_snapshot: path }]), ok(), ok({ id: 'board-1', name: 'Trip' }));
    const response = await PATCH(request([{ position: 0, snapshotPath: path, clothingItemId }]), context());
    expect(response.status).toBe(200);
    expect(db.queries[1].eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(db.queries[3].upsert).toHaveBeenCalledWith([
      { board_id: 'board-1', position: 0, clothing_item_id: clothingItemId, image_path_snapshot: path },
    ], { onConflict: 'board_id,position' });
    expect(db.bucket.upload).not.toHaveBeenCalled();
    expect(db.bucket.copy).not.toHaveBeenCalled();
    expect(db.bucket.remove).not.toHaveBeenCalled();
  });

  it.each([null, undefined])('preserves a snapshot without a clothing reference: %s', async (clothingItemId) => {
    db.results.push(ok({ id: 'board-1' }), ok([{ id: 'saved-row', position: 0, image_path_snapshot: path }]),
      ok(), ok({ id: 'board-1', name: 'Trip' }));
    const response = await PATCH(request([{ position: 0, snapshotPath: path, clothingItemId }]), context());
    expect(response.status).toBe(200);
    expect(db.from).not.toHaveBeenCalledWith('clothing_items');
    expect(db.bucket.remove).not.toHaveBeenCalled();
  });
});
