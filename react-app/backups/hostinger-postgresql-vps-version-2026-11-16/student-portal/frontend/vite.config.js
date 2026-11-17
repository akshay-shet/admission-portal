import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// React front end for the hosted portal.
//   npm run dev    → http://localhost:5173 (API calls go to the backend on port 3000)
//   npm run build  → frontend/dist (served by the backend / nginx)
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@connectivity': path.resolve(here, '../connectivity') } },
  optimizeDeps: { entries: ['index.html'] },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 5000, sourcemap: false },
  server: { fs: { allow: ['..'] }, proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
});
