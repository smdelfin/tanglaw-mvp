import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://tanglaw-api-tximek6mta-eu.a.run.app', // No trailing slash
        changeOrigin: true,
        secure: false, // Required to fix the 502 Bad Gateway
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'https://tanglaw-api-tximek6mta-eu.a.run.app', // No trailing slash
        changeOrigin: true,
        secure: false, // Required to fix the 502 Bad Gateway
      },
    },
  },
});