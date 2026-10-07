import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import type { ServerResponse } from 'http';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

import { devApiPlugin } from './src/lib/mock/devApiPlugin.ts';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The in-process mock API shadows the real backend, so it only runs when explicitly asked for (`VITE_MOCK_API=true`).
  const mockApi = loadEnv(mode, import.meta.dirname, 'VITE_').VITE_MOCK_API === 'true';

  return {
    plugins: [tanstackRouter(), react(), tailwindcss(), ...(mockApi ? [devApiPlugin()] : [])],
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
                  JSON.stringify({
                    status: false,
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Không kết nối được máy chủ API.',
                  }),
                );
              }
            });
          },
        },
      },
    },
  };
});
