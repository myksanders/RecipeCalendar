import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/photos': 'http://localhost:3000',
      '/calendar.ics': 'http://localhost:3000',
    },
  },
  test: { root: '.', include: ['server/**/*.test.ts', 'shared/**/*.test.ts'] },
} as any);
