// Serves /api/* from the Vite dev server so `npm run dev` works without the
// Vercel CLI. Production uses the same handlers through api/*.ts.

import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  return new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
  });
}

async function send(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (!response.body) return res.end();
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

export function apiDevServer(): Plugin {
  return {
    name: 'propertylens-api',
    configureServer(server: ViteDevServer) {
      const routes: Record<string, string> = { '/api/search': 'handleSearch', '/api/chat': 'handleChat' };
      server.middlewares.use(async (req, res, next) => {
        const route = routes[(req.url || '').split('?')[0]];
        if (!route) return next();
        try {
          const mod = await server.ssrLoadModule('/server/handlers.ts');
          await send(res, await mod[route](await toRequest(req)));
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Dev API error' }));
        }
      });
    },
  };
}
