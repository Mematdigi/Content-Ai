import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server runs on :5173, the Express API on :5000.
// We proxy /api in dev so the frontend code can use relative URLs.
export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/articles': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
