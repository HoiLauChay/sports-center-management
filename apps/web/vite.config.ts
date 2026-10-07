import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

import type { ServerResponse } from 'http';
import { devApiPlugin } from './src/lib/mock/devApiPlugin.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [tanstackRouter(), react(), tailwindcss(), devApiPlugin()],
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            const httpRes = res as ServerResponse;
            if (httpRes && typeof httpRes.writeHead === 'function' && !httpRes.headersSent) {
              httpRes.writeHead(503, { 'Content-Type': 'application/json' });
              httpRes.end(
                JSON.stringify({ status: false, code: 'SERVICE_UNAVAILABLE', message: 'Backend is offline' }),
              );
            }
          });
        },
      },
    },
  },
});
