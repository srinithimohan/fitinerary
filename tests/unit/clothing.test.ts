import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@clerk/nextjs/server';
import { GET, POST, PATCH, DELETE } from '@/app/api/clothing/route';
import { db, failure, ok } from '../support/supabase';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/app/lib/supabase', async () => {
  const { db } = await import('../support/supabase');
  return { createServerSupabaseClient: () => db };
});

const item = { id: 'item-1', name: 'Linen shirt', category: 'Tops', image_path: 'user-a/original.png' };
function upload(overrides: Record<string, string | File> = {}) {
  const form = new FormData();
  Object.entries({ name: ' Linen shirt ', category: ' Tops ', file: new File(['fixture'], 'shirt.png', { type: 'image/png' }), ...overrides })
    .forEach(([key, value]) => form.set(key, value));
  return new Request('http://localhost/api/clothing', { method: 'POST', body: form });
}
const patch = (body: unknown) => new Request('http://localhost/api/clothing', { method: 'PATCH', body: JSON.stringify(body) });

beforeEach(() => {
  db.reset();
  vi.mocked(auth).mockResolvedValue({ userId: 'user-a' } as Awaited<ReturnType<typeof auth>>);
});

describe('clothing route contract (mocked Clerk/Supabase)', () => {
  it('rejects every unauthenticated method before database/storage access', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    for (const response of [await GET(), await POST(upload()), await PATCH(patch({})), await DELETE(new Request('http://localhost/api/clothing?id=x'))]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    }
    expect(db.from).not.toHaveBeenCalled();
    expect(db.storage.from).not.toHaveBeenCalled();
  });

  it.each<Record<string, string | File>>([{ name: '' }, { category: ' ' }, { file: 'not a file' }, { file: new File(['text'], 'notes.txt', { type: 'text/plain' }) }])('rejects invalid upload fields: %j', async (fields) => {
    expect((await POST(upload(fields))).status).toBe(400);
    expect(db.bucket.upload).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });

  it('uploads to an owner-prefixed path, trims metadata, and returns a one-hour URL', async () => {
    db.results.push(ok(item));
    const response = await POST(upload());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: item.id, name: item.name, category: item.category, imagePath: item.image_path, image: 'https://images.invalid/fixture' });
    const path = db.bucket.upload.mock.calls[0][0];
    expect(path).toMatch(/^user-a\/[0-9a-f-]+\.png$/);
    expect(db.bucket.upload.mock.calls[0][2]).toEqual({ contentType: 'image/png', upsert: false });
    expect(db.queries[0].insert).toHaveBeenCalledWith({ name: item.name, category: 'Tops', image_path: path });
    expect(db.bucket.createSignedUrl).toHaveBeenCalledWith(path, 3600);
  });

  it('does not insert a row when storage upload fails', async () => {
    db.bucket.upload.mockResolvedValue(failure('storage unavailable'));
    const response = await POST(upload());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Storage upload failed: storage unavailable' });
    expect(db.from).not.toHaveBeenCalled();
  });

  it('removes the uploaded object when row insertion fails', async () => {
    db.results.push(failure('insert rejected'));
    expect((await POST(upload())).status).toBe(500);
    expect(db.bucket.remove).toHaveBeenCalledWith([db.bucket.upload.mock.calls[0][0]]);
  });

  it('characterizes existing post-commit URL failure without implying retry safety', async () => {
    db.results.push(ok(item));
    db.bucket.createSignedUrl.mockResolvedValue(failure('signing failed'));
    expect((await POST(upload())).status).toBe(500);
    expect(db.queries[0].insert).toHaveBeenCalled();
    expect(db.bucket.remove).not.toHaveBeenCalled();
  });

  it('lists signed images and preserves an empty URL on signing failure', async () => {
    db.results.push(ok([item]));
    db.bucket.createSignedUrl.mockResolvedValue(failure('signing failed'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: item.id, name: item.name, category: item.category, imagePath: item.image_path, image: '' }]);
    expect(log).toHaveBeenCalledWith('Could not create signed URL:', 'signing failed');
  });

  it('reports a listing database error', async () => {
    db.results.push(failure('database unavailable'));
    expect((await GET()).status).toBe(500);
  });

  it('edits metadata without uploading/replacing the image', async () => {
    db.results.push(ok({ ...item, name: 'Updated' }));
    const response = await PATCH(patch({ id: item.id, name: ' Updated ', category: ' Tops ' }));
    expect(response.status).toBe(200);
    expect(db.queries[0].eq).toHaveBeenCalledWith('id', item.id);
    expect(db.queries[0].update).toHaveBeenCalledWith({ name: 'Updated', category: 'Tops', updated_at: expect.any(String) });
    expect(db.bucket.upload).not.toHaveBeenCalled();
  });

  it.each([{}, { id: 'x', name: ' ', category: 'Tops' }])('rejects invalid edits', async (body) => {
    expect((await PATCH(patch(body))).status).toBe(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('requires a deletion ID and returns not found for missing items', async () => {
    expect((await DELETE(new Request('http://localhost/api/clothing'))).status).toBe(400);
    db.results.push(failure('not found'));
    expect((await DELETE(new Request('http://localhost/api/clothing?id=missing'))).status).toBe(404);
    expect(db.bucket.remove).not.toHaveBeenCalled();
  });

  it('deletes only the closet original, preserving independent board snapshots', async () => {
    db.results.push(ok(item), ok());
    expect((await DELETE(new Request(`http://localhost/api/clothing?id=${item.id}`))).status).toBe(200);
    expect(db.from.mock.calls.map(([table]) => table)).toEqual(['clothing_items', 'clothing_items']);
    expect(db.bucket.remove).toHaveBeenCalledExactlyOnceWith([item.image_path]);
  });

  it('does not remove storage when row deletion fails', async () => {
    db.results.push(ok(item), failure('delete rejected'));
    expect((await DELETE(new Request('http://localhost/api/clothing?id=item-1'))).status).toBe(500);
    expect(db.bucket.remove).not.toHaveBeenCalled();
  });

  it('characterizes logged storage deletion failure after successful row deletion', async () => {
    db.results.push(ok(item), ok());
    db.bucket.remove.mockResolvedValue(failure('storage unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await DELETE(new Request('http://localhost/api/clothing?id=item-1'))).status).toBe(200);
    expect(log).toHaveBeenCalledWith('Could not remove clothing image:', 'storage unavailable');
  });
});
