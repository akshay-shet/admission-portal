// Builds a single page fragment for publishing as a claude.ai Artifact:
//   node build-artifact.mjs  ->  dist-artifact/student-portal.html
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const out = 'dist-artifact/raw';
await build({
  configFile: false,
  logLevel: 'warn',
  plugins: [react()],
  build: {
    outDir: out, emptyOutDir: true, assetsInlineLimit: 100000000, cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app[extname]' } },
  },
});
const js = fs.readFileSync(path.join(out, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(out, 'app.css'), 'utf8').replace(/<\/style/gi, '<\\/style');
const page = `<title>Student Portal</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
// literal U+FFFD characters inside library strings are written as \uFFFD escapes (same meaning, safe to publish)
fs.writeFileSync('dist-artifact/student-portal.html', page.replace(/\uFFFD/g, '\\uFFFD'));
console.log('wrote dist-artifact/student-portal.html', (page.length / 1024).toFixed(0) + ' KB');
