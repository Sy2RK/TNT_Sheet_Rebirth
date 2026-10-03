import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Plugin } from 'vite';
import { isOfficialQwenHost } from '../src/ai/qwen-endpoint.ts';

const connectionSchema = z.object({
  endpoint: z.string().trim().url(),
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().trim().min(1),
});
const configSchema = z.object({
  providers: z.object({
    deepseek: connectionSchema.optional(),
    qwen: connectionSchema.optional(),
  }),
});

/** Local development only. Keys are read at request time, never imported into the bundle. */
export function localConfigPlugin(): Plugin {
  return {
    name: 'tnt-local-model-config',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.split('?')[0];
        if (route !== '/_dev/model-config' && route !== '/_dev/qwen-models') return next();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json');
        const address = req.socket.remoteAddress;
        let origin: URL;
        try {
          origin = new URL(`http://${req.headers.host}`);
        } catch {
          res.statusCode = 403;
          return res.end('{}');
        }
        if (
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address || '') ||
          !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
          (req.headers.origin && req.headers.origin !== origin.origin) ||
          (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') ||
          req.headers['x-tnt-local-config'] !== '1'
        ) {
          res.statusCode = 403;
          return res.end('{}');
        }
        if (req.method !== 'GET') {
          res.statusCode = 405;
          return res.end('{}');
        }
        if (route === '/_dev/qwen-models') {
          let target: URL;
          try {
            const requestUrl = new URL(req.url!, origin);
            target = new URL(requestUrl.searchParams.get('url') || '');
            if (
              target.protocol !== 'https:' ||
              target.port ||
              target.username ||
              target.password ||
              target.hash ||
              !isOfficialQwenHost(target.hostname) ||
              target.pathname !== '/api/v1/models' ||
              [...target.searchParams.keys()].some(
                (key) => !['capabilities', 'language', 'page_no', 'page_size'].includes(key),
              ) ||
              target.searchParams.get('capabilities') !== 'TG' ||
              target.searchParams.get('language') !== 'zh-CN' ||
              target.searchParams.get('page_size') !== '100' ||
              !/^(?:[1-9]|1[0-9]|20)$/.test(target.searchParams.get('page_no') || '') ||
              !/^Bearer \S{1,4096}$/.test(req.headers.authorization || '')
            )
              throw new Error();
          } catch {
            res.statusCode = 400;
            return res.end('{}');
          }
          const disconnected = new AbortController();
          res.once('close', () => disconnected.abort());
          try {
            const upstream = await fetch(target, {
              headers: { Authorization: req.headers.authorization! },
              redirect: 'error',
              signal: AbortSignal.any([disconnected.signal, AbortSignal.timeout(15000)]),
            });
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              return res.end('{}');
            }
            const body = await upstream.arrayBuffer();
            if (body.byteLength > 2_000_000) throw new Error();
            res.end(Buffer.from(body));
          } catch {
            if (!res.destroyed) {
              res.statusCode = 502;
              res.end('{}');
            }
          }
          return;
        }
        try {
          const path = resolve(server.config.root, 'config.local.json');
          const config = configSchema.parse(JSON.parse(await readFile(path, 'utf8')));
          res.end(JSON.stringify(config));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return res.end('{"providers":{}}');
          res.statusCode = 503;
          res.end('{"message":"本地模型配置格式无效，请检查 config.local.json。"}');
        }
      });
    },
  };
}
