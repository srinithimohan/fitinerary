import { vi } from 'vitest';

export type DbResult = { data: unknown; error: { message: string } | null };
export const ok = (data: unknown = null): DbResult => ({ data, error: null });
export const failure = (message: string): DbResult => ({ data: null, error: { message } });

function query(result: DbResult) {
  const response = Promise.resolve(result);
  return {
    select: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: response.then.bind(response),
  };
}

export const db = {
  results: [] as DbResult[],
  queries: [] as ReturnType<typeof query>[],
  from: vi.fn(),
  bucket: {
    upload: vi.fn(), copy: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn(),
  },
  storage: { from: vi.fn() },
  reset() {
    this.results = [];
    this.queries = [];
    this.from.mockReset().mockImplementation(() => {
      if (!this.results.length) throw new Error('Unexpected database query: supply an explicit result');
      const q = query(this.results.shift()!);
      this.queries.push(q);
      return q;
    });
    this.storage.from.mockReset().mockReturnValue(this.bucket);
    this.bucket.upload.mockReset().mockResolvedValue(ok());
    this.bucket.copy.mockReset().mockResolvedValue(ok());
    this.bucket.remove.mockReset().mockResolvedValue(ok());
    this.bucket.createSignedUrl.mockReset().mockResolvedValue(ok({ signedUrl: 'https://images.invalid/fixture' }));
  },
};
