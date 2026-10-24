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
    db.results.push(ok({ id: board.id }), ok([]), ok(), ok(board));
    const response = await PATCH(formRequest([{ position: 0, snapshotPath: snapshot, clothingItemId: null }], undefined, 'PATCH'), context());
    expect(response.status).toBe(200);
    expect(db.queries[2].upsert).toHaveBeenCalledWith([expect.objectContaining({ board_id: board.id, position: 0, image_path_snapshot: snapshot })], { onConflict: 'board_id,position' });
    expect(db.queries[3].update).toHaveBeenCalledWith({ name: 'Trip', updated_at: expect.any(String) });
    expect(db.bucket.copy).not.toHaveBeenCalled();
    expect(db.bucket.remove).not.toHaveBeenCalled();
  });

  it('rejects another owner prefix on a supplied snapshot', async () => {
    db.results.push(ok({ id: board.id }), ok([]));
    expect((await PATCH(formRequest([{ position: 0, snapshotPath: 'user-b/private.png' }], undefined, 'PATCH'), context())).status).toBe(400);
    expect(db.queries).toHaveLength(2);
    expect(db.bucket.upload).not.toHaveBeenCalled();
  });

  it('deletes snapshot storage before deleting the board', async () => {
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
});
