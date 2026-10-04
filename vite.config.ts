import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { apiDevServer } from './server/devMiddleware';

export default defineConfig(({ mode }) => {
  // Server-only secrets: exposed to the dev API handlers, never to the client bundle.
  const env = loadEnv(mode, '.', '');
  for (const key of ['GEMINI_API_KEY', 'GEMINI_EMBEDDING_MODEL', 'GEMINI_FLASH_MODEL', 'SEARCH_MIN_SCORE']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), apiDevServer()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
