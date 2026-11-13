import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces ONE self-contained dist/index.html (all JS + CSS inlined)
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: { chunkSizeWarningLimit: 5000 },
  // npm run dev: send /api calls to the PostgreSQL portal server (npm start) on port 3000
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
});
