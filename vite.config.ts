import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const build = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || 'local').slice(0, 7);

export default defineConfig({
  plugins: [react()],
  define: { __APP_BUILD__: JSON.stringify(build) },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg')) {
            return 'pdf-vendor';
          }
        },
      },
    },
  },
});
