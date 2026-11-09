import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  server: { port: 5173, host: '127.0.0.1' },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: { chunkSizeWarningLimit: 2000, outDir: mode === 'single' ? 'dist/single' : 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
}) as any);
