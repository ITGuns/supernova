import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Nova POS dev server. Offline/PWA service worker is layered in during Phase 2/5.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 5173, host: true },
  build: {
    rollupOptions: {
      output: {
        // Split stable vendor code from app code so a UI change doesn't
        // invalidate the (much larger, rarely changing) framework bundle.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
