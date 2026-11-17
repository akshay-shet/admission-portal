# Front end (React + Vite)

The portal's user interface — the same React code as the claude.ai portal.

- `npm install` then `npm run build` → `dist/` (served by the backend).
- `npm run dev` → http://localhost:5173 for development; `/api` calls go to the backend on port 3000 (`npm start` in the project folder).
- Talks to the backend through `connectivity/api-client/apiBackend.js` (alias `@connectivity`).
