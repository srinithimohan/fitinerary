import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@clerk/nextjs/server';
import { POST } from '@/app/api/boards/route';
import { GET, PATCH, DELETE } from '@/app/api/boards/[id]/route';
import { GET as pastBoards } from '@/app/api/past-boards/route';
import { db, failure, ok } from '../support/supabase';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/app/lib/supabase', async () => {
  const { db } = await import('../support/supabase');
  return { createServerSupabaseClient: () => db };
});

const context = () => ({ params: Promise.resolve({ id: 'board-1' }) });
const request = () => new Request('http://localhost/api/boards/board-1');
const clothing = { id: 'item-1', name: 'Shirt', category: 'Tops', image_path: 'user-a/shirt.png' };
const board = { id: 'board-1', name: 'Trip', is_public: false, created_at: '2026-01-01', board_items: [] };
function formRequest(items: unknown, file?: File, method = 'POST') {
  const form = new FormData();
  form.set('name', ' Trip ');
  form.set('items', typeof items === 'string' ? items : JSON.stringify(items));
  if (file) form.set('file-0', file);
  return new Request('http://localhost/api/boards', { method, body: form });
}

beforeEach(() => {
  db.reset();
  vi.mocked(auth).mockResolvedValue({ userId: 'user-a' } as Awaited<ReturnType<typeof auth>>);
});

describe('board routes (mocked Clerk/Supabase)', () => {
  it('rejects unauthenticated access for every board handler', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    for (const response of [await POST(formRequest([])), await GET(request(), context()), await PATCH(formRequest([], undefined, 'PATCH'), context()), await DELETE(request(), context()), await pastBoards()]) {
      expect(response.status).toBe(401);
    }
    expect(db.from).not.toHaveBeenCalled();
    expect(db.storage.from).not.toHaveBeenCalled();
  });

  it.each(['{broken', [], [{ position: -1 }], [{ position: 9 }], [{ position: 0 }, { position: 0 }]])('rejects invalid board items before inserting: %j', async (items) => {
    expect((await POST(formRequest(items))).status).toBe(400);
    expect(db.queries).toHaveLength(0);
  });

  it('copies closet images to independent snapshot paths and inserts snapshot metadata', async () => {
    db.results.push(ok(board), ok(clothing), ok());
    const response = await POST(formRequest([{ position: 0, clothingItemId: clothing.id }]));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'board-1', name: 'Trip' });
    const [source, destination] = db.bucket.copy.mock.calls[0];
    expect(source).toBe(clothing.image_path);
    expect(destination).toMatch(/^user-a\/board-snapshots\/board-1\/0-[0-9a-f-]+\.png$/);
    expect(db.queries[2].insert).toHaveBeenCalledWith([{ board_id: 'board-1', position: 0, clothing_item_id: clothing.id, image_path_snapshot: destination, name_snapshot: 'Shirt', category_snapshot: 'Tops' }]);
    expect(db.bucket.upload).not.toHaveBeenCalled();
  });

  it('preserves direct board uploads without creating closet items', async () => {
    db.results.push(ok(board), ok());
    const file = new File(['fixture'], 'trip.webp', { type: 'image/webp' });
    expect((await POST(formRequest([{ position: 0, hasUpload: true }], file))).status).toBe(201);
    expect(db.from.mock.calls.map(([table]) => table)).toEqual(['boards', 'board_items']);
    expect(db.bucket.upload.mock.calls[0][0]).toMatch(/^user-a\/board-snapshots\/board-1\//);
  });

  it('cleans up copied images and the new board when item insertion fails', async () => {
    db.results.push(ok(board), ok(clothing), failure('item insert failed'), ok());
    expect((await POST(formRequest([{ position: 0, clothingItemId: clothing.id }]))).status).toBe(500);
    expect(db.bucket.remove).toHaveBeenCalledWith([db.bucket.copy.mock.calls[0][1]]);
    expect(db.queries[3].delete).toHaveBeenCalled();
    expect(db.queries[3].eq).toHaveBeenCalledWith('id', 'board-1');
  });

  it('rejects a missing clothing reference and removes the new board', async () => {
    db.results.push(ok(board), failure('not found'), ok());
    expect((await POST(formRequest([{ position: 0, clothingItemId: 'missing' }]))).status).toBe(400);
    expect(db.bucket.copy).not.toHaveBeenCalled();
    expect(db.queries[2].delete).toHaveBeenCalled();
  });

  it('loads board snapshots with signed URLs', async () => {
    db.results.push(ok({ ...board, board_items: [{ id: 'snapshot-1', position: 2, clothing_item_id: null, image_path_snapshot: 'user-a/board-snapshots/board-1/photo.png', name_snapshot: 'Old shirt', category_snapshot: 'Tops' }] }));
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect((await response.json()).items).toEqual([expect.objectContaining({ position: 2, name: 'Old shirt', image: 'https://images.invalid/fixture' })]);
    expect(db.bucket.createSignedUrl).toHaveBeenCalledWith('user-a/board-snapshots/board-1/photo.png', 3600);
  });

  it('loads saved boards with the existing response shape', async () => {
    db.results.push(ok([board]));
    expect(await (await pastBoards()).json()).toEqual([{ id: board.id, name: board.name, isPublic: false, createdAt: board.created_at, items: [] }]);
  });

  it('reports a saved-board query error', async () => {
    db.results.push(failure('database unavailable'));
    expect((await pastBoards()).status).toBe(500);
  });

  it('edits a board while preserving existing snapshot references', async () => {
    const snapshot = 'user-a/board-snapshots/board-1/saved.png';
    const omitted = 'user-a/board-snapshots/board-1/omitted.png';
    db.results.push(ok({ id: board.id }), ok([
      { id: 'kept-row', position: 0, image_path_snapshot: snapshot },
      { id: 'omitted-row', position: 1, image_path_snapshot: omitted },
    ]), ok(), ok(), ok(board));
    const response = await PATCH(formRequest([{ position: 0, snapshotPath: snapshot, clothingItemId: null }], undefined, 'PATCH'), context());
    expect(response.status).toBe(200);
    expect(db.queries[2].upsert).toHaveBeenCalledWith([expect.objectContaining({ board_id: board.id, position: 0, image_path_snapshot: snapshot })], { onConflict: 'board_id,position' });
    expect(db.queries[3].delete).toHaveBeenCalledOnce();
    expect(db.queries[3].in).toHaveBeenCalledExactlyOnceWith('id', ['omitted-row']);
    expect(db.queries[4].update).toHaveBeenCalledWith({ name: 'Trip', updated_at: expect.any(String) });
    expect(db.bucket.copy).not.toHaveBeenCalled();
    expect(db.bucket.remove).toHaveBeenCalledExactlyOnceWith([omitted]);
    expect(db.bucket.remove.mock.calls.flat(2)).not.toContain(snapshot);
  });

  it('rejects another owner prefix on a supplied snapshot', async () => {
    db.results.push(ok({ id: board.id }), ok([]));
    expect((await PATCH(formRequest([{ position: 0, snapshotPath: 'user-b/private.png' }], undefined, 'PATCH'), context())).status).toBe(400);
    expect(db.queries).toHaveLength(2);
    expect(db.bucket.upload).not.toHaveBeenCalled();
  });

  it('successfully deletes a board and its snapshot images', async () => {
    const path = 'user-a/board-snapshots/board-1/photo.png';
    db.results.push(ok([{ image_path_snapshot: path }]), ok({ id: board.id }));
    expect((await DELETE(request(), context())).status).toBe(200);
    expect(db.bucket.remove).toHaveBeenCalledWith([path]);
    expect(db.queries[1].delete).toHaveBeenCalled();
  });

  it('does not delete the board row if snapshot deletion fails', async () => {
    db.results.push(ok([{ image_path_snapshot: 'snapshot.png' }]));
    db.bucket.remove.mockResolvedValue(failure('storage unavailable'));
    expect((await DELETE(request(), context())).status).toBe(500);
    expect(db.queries).toHaveLength(1);
  });

  describe('known defects (follow-up: docs/security-audit.md#board-consistency-follow-up)', () => {
    // These assert observed calls/error responses, not real persisted state.
    // Fixes must replace the unsafe expectations in a separately scoped PR.
    const oldItems = [
      { id: 'replaced-row', position: 0, image_path_snapshot: 'user-a/board-snapshots/board-1/old.png' },
      { id: 'omitted-row', position: 1, image_path_snapshot: 'user-a/board-snapshots/board-1/omitted.png' },
    ];
    const replacement = () => formRequest([{ position: 0, hasUpload: true }], new File(['fixture'], 'new.png', { type: 'image/png' }), 'PATCH');

    it('BD-01: accepts an unrelated same-user snapshot path without copying it', async () => {
      const unrelated = 'user-a/board-snapshots/board-2/shared.png';
      db.results.push(ok({ id: board.id }), ok([oldItems[0]]), ok(), ok(board));
      const response = await PATCH(formRequest([{ position: 0, snapshotPath: unrelated, clothingItemId: null }], undefined, 'PATCH'), context());
      expect(response.status).toBe(200);
      expect(db.queries[2].upsert).toHaveBeenCalledWith([expect.objectContaining({ image_path_snapshot: unrelated })], { onConflict: 'board_id,position' });
      expect(db.bucket.copy).not.toHaveBeenCalled();
      expect(db.bucket.upload).not.toHaveBeenCalled();
      expect(db.bucket.remove).toHaveBeenCalledExactlyOnceWith([oldItems[0].image_path_snapshot]);
      // The alias above is not desired behavior. A scripted later read models
      // that reference; it does not establish persistence in a real database.
      db.results.push(ok([{ image_path_snapshot: unrelated }]), ok({ id: board.id }));
      expect((await DELETE(request(), context())).status).toBe(200);
      expect(db.bucket.remove).toHaveBeenNthCalledWith(2, [unrelated]);
    });

    it('BD-02: removes images even when the subsequent board deletion fails', async () => {
      const path = oldItems[0].image_path_snapshot;
      db.results.push(ok([{ image_path_snapshot: path }]), failure('board delete failed'));
      const response = await DELETE(request(), context());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'board delete failed' });
      expect(db.bucket.remove).toHaveBeenCalledExactlyOnceWith([path]);
      expect(db.queries[1].delete).toHaveBeenCalledOnce();
      expect(db.queries[1].eq).toHaveBeenCalledWith('id', board.id);
      expect(db.bucket.remove.mock.invocationCallOrder[0]).toBeLessThan(db.queries[1].delete.mock.invocationCallOrder[0]);
      expect(db.bucket.copy).not.toHaveBeenCalled();
      expect(db.bucket.upload).not.toHaveBeenCalled();
      expect(db.queries).toHaveLength(2);
    });

    it('BD-03: does not undo item upsert when omitted-row deletion returns an error', async () => {
      db.results.push(ok({ id: board.id }), ok(oldItems), ok(), failure('row delete failed'));
      const response = await PATCH(replacement(), context());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'row delete failed' });
      const newPath = db.bucket.upload.mock.calls[0][0];
      expect(db.bucket.upload).toHaveBeenCalledOnce();
      expect(db.queries[2].upsert).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ image_path_snapshot: newPath })], { onConflict: 'board_id,position' });
      expect(db.queries[3].delete).toHaveBeenCalledOnce();
      expect(db.queries[3].in).toHaveBeenCalledWith('id', ['omitted-row']);
      expect(db.bucket.upload.mock.invocationCallOrder[0]).toBeLessThan(db.queries[2].upsert.mock.invocationCallOrder[0]);
      expect(db.queries[2].upsert.mock.invocationCallOrder[0]).toBeLessThan(db.queries[3].delete.mock.invocationCallOrder[0]);
      expect(db.queries).toHaveLength(4); // No board update or compensating write.
      expect(db.bucket.remove).not.toHaveBeenCalled();
    });

    it('BD-04: does not undo item writes when the later board update returns an error', async () => {
      db.results.push(ok({ id: board.id }), ok(oldItems), ok(), ok(), failure('board update failed'));
      const response = await PATCH(replacement(), context());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'board update failed' });
      const newPath = db.bucket.upload.mock.calls[0][0];
      expect(db.queries[2].upsert).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ image_path_snapshot: newPath })], { onConflict: 'board_id,position' });
      expect(db.queries[3].delete).toHaveBeenCalledOnce();
      expect(db.queries[3].in).toHaveBeenCalledWith('id', ['omitted-row']);
      expect(db.queries[4].update).toHaveBeenCalledWith({ name: 'Trip', updated_at: expect.any(String) });
      expect(db.queries[2].upsert.mock.invocationCallOrder[0]).toBeLessThan(db.queries[3].delete.mock.invocationCallOrder[0]);
      expect(db.queries[3].delete.mock.invocationCallOrder[0]).toBeLessThan(db.queries[4].update.mock.invocationCallOrder[0]);
      expect(db.queries).toHaveLength(5); // No compensating writes.
      expect(db.bucket.remove).not.toHaveBeenCalled();
    });

    it('BD-05: returns success despite a Storage cleanup error after item persistence', async () => {
      db.results.push(ok({ id: board.id }), ok([oldItems[0]]), ok(), ok(board));
      db.bucket.remove.mockResolvedValueOnce(failure('old image cleanup failed'));
      const response = await PATCH(replacement(), context());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: board.id, name: board.name });
      const newPath = db.bucket.upload.mock.calls[0][0];
      expect(db.queries[2].upsert).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ image_path_snapshot: newPath })], { onConflict: 'board_id,position' });
      expect(db.queries[3].update).toHaveBeenCalledOnce();
      expect(db.queries[3].single.mock.invocationCallOrder[0]).toBeLessThan(db.bucket.remove.mock.invocationCallOrder[0]);
      expect(db.bucket.remove).toHaveBeenCalledExactlyOnceWith([oldItems[0].image_path_snapshot]);
      expect(db.queries).toHaveLength(4);
    });

    it('BD-06: thrown old-image cleanup triggers removal of a newly referenced image', async () => {
      db.results.push(ok({ id: board.id }), ok([oldItems[0]]), ok(), ok(board));
      db.bucket.remove.mockRejectedValueOnce(new Error('cleanup threw')).mockResolvedValueOnce(ok());
      const response = await PATCH(replacement(), context());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Could not update board: cleanup threw' });
      const newPath = db.bucket.upload.mock.calls[0][0];
      expect(db.queries[2].upsert).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ image_path_snapshot: newPath })], { onConflict: 'board_id,position' });
      expect(db.queries[3].update).toHaveBeenCalledOnce();
      expect(db.queries[2].upsert.mock.invocationCallOrder[0]).toBeLessThan(db.queries[3].single.mock.invocationCallOrder[0]);
      expect(db.queries[3].single.mock.invocationCallOrder[0]).toBeLessThan(db.bucket.remove.mock.invocationCallOrder[0]);
      expect(db.bucket.remove).toHaveBeenCalledTimes(2);
      expect(db.bucket.remove).toHaveBeenNthCalledWith(1, [oldItems[0].image_path_snapshot]);
      expect(db.bucket.remove).toHaveBeenNthCalledWith(2, [newPath]);
      expect(db.queries).toHaveLength(4); // References are not rolled back by this catch path.
    });
  });
});
