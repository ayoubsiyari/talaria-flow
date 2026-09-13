/**
 * Local server that mirrors the Vercel configuration in vercel.json:
 * clean URLs with trailing slash, redirects, rewrites, security headers,
 * public/404.html for unknown paths, and api/*.ts functions executed in-process.
 *
 *   node scripts/dev-server.mjs            -> http://127.0.0.1:5051
 *   PORT=3000 node scripts/dev-server.mjs
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBrotliCompress, createGzip } from 'node:zlib';
import { publicEnvScript } from './lib/public-env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const PORT = Number(process.env.PORT || 5051);

// Edge middleware (middleware.ts) — Node 22.18+/24 strips the types natively.
const middlewareMod = await import(pathToFileURL(join(ROOT, 'middleware.ts')).href);
const MIDDLEWARE = middlewareMod.default;
const MW_MATCHERS = ((middlewareMod.config && middlewareMod.config.matcher) || []).map(toRegex);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

/** Vercel path-to-regexp subset: literal, `:name`, `:name*`, `(.*)`, `(a|b)`. */
function toRegex(source) {
  const re = source
    .replace(/\.\*/g, '\u0000')
    .replace(/[.+^${}[\]\\]/g, (c) => `\\${c}`)
    .replace(/\u0000/g, '.*')
    .replace(/:([a-zA-Z0-9_]+)\*/g, '(?<$1>.*)')
    .replace(/:([a-zA-Z0-9_]+)/g, '(?<$1>[^/]+)');
  return new RegExp(`^${re}$`);
}
const REDIRECTS = (CONFIG.redirects || []).map((r) => ({ ...r, re: toRegex(r.source) }));
const REWRITES = (CONFIG.rewrites || []).map((r) => ({ ...r, re: toRegex(r.source) }));
const HEADERS = (CONFIG.headers || []).map((h) => ({ ...h, re: toRegex(h.source) }));

function fill(dest, match) {
  return dest.replace(/:([a-zA-Z0-9_]+)\*?/g, (_, k) => (match.groups && match.groups[k]) || '');
}
function requestOrigin(req) {
  if (!req || !req.headers) return '';
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return '';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function headersFor(pathname, req) {
  const out = {};
  for (const h of HEADERS) if (h.re.test(pathname)) for (const kv of h.headers) out[kv.key] = kv.value;
  const origin = requestOrigin(req) || (process.env.SITE_URL || '').replace(/\/+$/, '');
  let host = '';
  try { host = origin ? new URL(origin).hostname : ''; } catch { host = ''; }
  // IP / HTTP preview must not set HSTS — browsers would force HTTPS and hit a cert mismatch.
  if (/^http:\/\//i.test(origin) || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) delete out['Strict-Transport-Security'];
  // vercel.json allows *.supabase.co; a local/self-hosted SUPABASE_URL (the test mock) must be reachable too.
  const sb = (origin || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  if (out['Content-Security-Policy'] && sb && !/\.supabase\.co$/i.test(host)) {
    const http = origin.replace(/^https:/i, 'http:');
    const https = origin.replace(/^http:/i, 'https:');
    out['Content-Security-Policy'] = out['Content-Security-Policy'].replace(/connect-src ([^;]*)/, () => (
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io ${http} ${https} ${http.replace(/^http/i, 'ws')} ${https.replace(/^https/i, 'wss')}`
    ));
  }
  // Production pins hashed assets for a year. Locally JS/CSS must not be cached; images in emails must be.
  if (/^\/(assets|fonts)\//.test(pathname)) {
    out['Cache-Control'] = /\.(png|jpe?g|webp|gif|ico|svg)$/i.test(pathname)
      ? 'public, max-age=86400'
      : 'no-store';
  }
  return out;
}
function fileFor(pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidates = rel.endsWith('/') || rel === '' ? [join(PUB, rel, 'index.html')] : [join(PUB, rel), join(PUB, `${rel}.html`), join(PUB, rel, 'index.html')];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) || null;
}
// Vercel compresses text responses (br/gzip); mirror that so local Lighthouse runs see production transfer sizes.
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.svg', '.json', '.xml', '.txt', '.webmanifest']);
function send(res, status, file, extra, req) {
  const ext = extname(file).toLowerCase();
  const headers = { 'content-type': MIME[ext] || 'application/octet-stream', ...extra };
  const accept = (req && req.headers['accept-encoding']) || '';
  const stream = createReadStream(file);
  if (COMPRESSIBLE.has(ext) && /\bbr\b/.test(accept)) {
    res.writeHead(status, { ...headers, 'content-encoding': 'br', vary: 'Accept-Encoding' });
    return stream.pipe(createBrotliCompress()).pipe(res);
  }
  if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(accept)) {
    res.writeHead(status, { ...headers, 'content-encoding': 'gzip', vary: 'Accept-Encoding' });
    return stream.pipe(createGzip()).pipe(res);
  }
  res.writeHead(status, headers);
  stream.pipe(res);
}

async function runApi(req, res, pathname) {
  const rel = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  const candidates = [join(ROOT, 'api', `${rel}.ts`), join(ROOT, 'api', rel, 'index.ts'), join(ROOT, 'api', `${rel}.js`)];
  const file = candidates.find((p) => existsSync(p));
  if (!file) return false;
  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  const handler = mod.default || mod.handler;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const hdrs = new Headers();
  for (const [k, vals] of Object.entries(req.headers)) {
    if (k === 'connection' || k === 'keep-alive' || k === 'transfer-encoding') continue;
    const v = Array.isArray(vals) ? vals.join(', ') : vals;
    if (v) try { hdrs.set(k, v); } catch { /* hop-by-hop / forbidden */ }
  }
  const request = new Request(url, { method: req.method, headers: hdrs, body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw });
  const response = await handler(request);
  const h = Object.fromEntries(response.headers.entries());
  // Headers.entries() folds multiple Set-Cookie values; keep them separate for Node.
  if (typeof response.headers.getSetCookie === 'function') {
    const cookies = response.headers.getSetCookie();
    if (cookies.length) h['set-cookie'] = cookies;
  }
  res.writeHead(response.status, { ...h, ...headersFor(pathname, req) });
  res.end(Buffer.from(await response.arrayBuffer()));
  return true;
}

export function listen(port = PORT) {
  const srv = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);
    let pathname = url.pathname;
    const base = headersFor(pathname, req);
    try {
      if (pathname.startsWith('/api/')) {
        if (await runApi(req, res, pathname)) return;
        res.writeHead(404, { 'content-type': 'application/json', ...base });
        return res.end('{"error":"not_found"}');
      }
      for (const r of REDIRECTS) {
        const m = pathname.match(r.re);
        if (m) {
          res.writeHead(r.permanent === false ? 307 : 308, { location: fill(r.destination, m) + (fill(r.destination, m).includes('?') ? '' : url.search), ...base });
          return res.end();
        }
      }
      if (MIDDLEWARE && MW_MATCHERS.some((re) => re.test(pathname))) {
        const request = new Request(url, { method: req.method, headers: req.headers });
        const out = await MIDDLEWARE(request);
        if (out instanceof Response) {
          res.writeHead(out.status, { ...Object.fromEntries(out.headers.entries()), ...base });
          return res.end(Buffer.from(await out.arrayBuffer()));
        }
      }
      // Public env rendered live from process.env/.env (build.mjs writes the same file for Vercel).
      if (pathname === '/assets/js/env.js') {
        const origin = requestOrigin(req);
        const extras = origin ? { SITE_URL: origin, SUPABASE_URL: origin } : {};
        res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store', ...base });
        return res.end(publicEnvScript(join(ROOT, '.env'), extras));
      }
      // cleanUrls + trailingSlash: /login -> /login/, /login.html -> /login/
      if (pathname === '/404.html') return send(res, 200, join(PUB, '404.html'), base, req);
      if (/\.html$/.test(pathname)) {
        res.writeHead(308, { location: pathname.replace(/(?:\/index)?\.html$/, '/'), ...base });
        return res.end();
      }
      if (!/\.[a-z0-9]+$/i.test(pathname) && !pathname.endsWith('/') && existsSync(join(PUB, pathname.slice(1), 'index.html'))) {
        res.writeHead(308, { location: `${pathname}/${url.search}`, ...base });
        return res.end();
      }
      let file = fileFor(pathname);
      if (!file) {
        for (const r of REWRITES) {
          const m = pathname.match(r.re);
          if (m) { file = fileFor(fill(r.destination, m)); break; }
        }
      }
      if (file) return send(res, 200, file, base, req);
      const nf = join(PUB, '404.html');
      if (existsSync(nf)) return send(res, 404, nf, base, req);
      res.writeHead(404, base);
      res.end('not found');
    } catch (e) {
      console.error('[dev-server]', e);
      res.writeHead(500, base);
      res.end('server error');
    }
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok({ srv, origin: `http://127.0.0.1:${srv.address().port}` })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { origin } = await listen();
  console.log(`talaria-flow  ${origin}`);
}
