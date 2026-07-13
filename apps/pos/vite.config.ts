import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Nova POS dev server. Offline/PWA service worker is layered in during Phase 2/5.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 5173, host: true },
});
