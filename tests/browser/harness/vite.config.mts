import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  plugins: [
    {
      name: 'test-only-next-font',
      enforce: 'pre',
      resolveId(source) {
        if (source === '../fonts' || source === '../ui/fonts') return `${root}fonts.ts`;
      },
    },
    react(),
  ],
  resolve: { alias: [
    { find: 'next/navigation', replacement: `${root}navigation.ts` },
    { find: '@', replacement: fileURLToPath(new URL('../../../', import.meta.url)) },
  ] },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
});
