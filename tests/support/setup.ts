import { beforeEach, vi } from 'vitest';

// Route tests must use explicit doubles, never an ambient cloud connection.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network forbidden in unit tests')));
});
