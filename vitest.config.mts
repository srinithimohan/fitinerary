import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    allowOnly: !process.env.CI,
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/support/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
