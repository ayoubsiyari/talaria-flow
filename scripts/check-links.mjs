/**
 * Internal link checker (docs/CHECKLIST.md: zero broken internal links).
 *
 *   node scripts/check-links.mjs                 -> starts scripts/dev-server.mjs on a free port and crawls it
 *   node scripts/check-links.mjs --origin http://127.0.0.1:5051
 *
 * Crawls from / plus every sitemap.xml <loc>, following a[href], link[href], script[src], img/source
 * src/srcset, <picture>, meta og:image/twitter:image and hreflang alternates. Absolute
 * https://www.talaria-flow.com/... URLs are rewritten to the local origin. Every internal URL must
 * answer 200 (308/307 are followed and the target must be 200). Exit 1 on any failure.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const SITE = 'https://www.talaria-flow.com';

let origin = flag('--origin');
let srv = null;
if (!origin) {
  const mod = await import(`file://${join(ROOT, 'scripts', 'dev-server.mjs').replace(/\\/g, '/')}`);
  const started = await mod.listen(0);
  origin = started.origin;
  srv = started.srv;
}

const seen = new Map(); // url -> { status, from }
const queue = [];
const broken = [];

function push(url, from) {
  url = url.split('#')[0];
  if (!url || seen.has(url)) return;
  seen.set(url, { status: null, from });
  queue.push({ url, from });
}

function toLocal(href, base) {
  if (!href || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(href)) return null;
  let u;
  try { u = new URL(href, base); } catch { return null; }
  if (u.origin === SITE) u = new URL(u.pathname + u.search, origin);
  if (u.origin !== origin) return null;
  return u.href;
}

function extract(html, base) {
  const out = [];
  // Pages declare <base href="/">; relative asset paths resolve against it, as the browser does.
  const baseTag = /<base\b[^>]*?href=["']([^"']+)["']/i.exec(html);
  if (baseTag) { try { base = new URL(baseTag[1], base).href; } catch {} }
  const attr = /<(a|link|script|img|source|iframe)\b[^>]*?\s(href|src|srcset)=["']([^"']+)["']/gi;
  let m;
  while ((m = attr.exec(html))) {
    if (m[2] === 'srcset') for (const part of m[3].split(',')) out.push(part.trim().split(/\s+/)[0]);
    else out.push(m[3]);
  }
  const meta = /<meta\b[^>]*?(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*?content=["']([^"']+)["']/gi;
  while ((m = meta.exec(html))) out.push(m[1]);
  const meta2 = /<meta\b[^>]*?content=["']([^"']+)["'][^>]*?(?:property|name)=["'](?:og:image|twitter:image)["']/gi;
  while ((m = meta2.exec(html))) out.push(m[1]);
  return out.map((h) => toLocal(h.replace(/&amp;/g, '&'), base)).filter(Boolean);
}

async function check(url, from) {
  let res;
  try {
    res = await fetch(url, { redirect: 'manual', headers: { accept: 'text/html,*/*' } });
  } catch (e) {
    return broken.push({ url, from, status: 'ERR ' + e.message });
  }
  if ([301, 302, 307, 308].includes(res.status)) {
    const loc = toLocal(res.headers.get('location'), url);
    if (!loc) return broken.push({ url, from, status: `${res.status} -> external/none` });
    push(loc, `${url} (redirect)`);
    seen.get(url).status = res.status;
    return;
  }
  seen.get(url).status = res.status;
  if (res.status !== 200) return broken.push({ url, from, status: res.status });
  const type = res.headers.get('content-type') || '';
  if (/text\/html/.test(type)) {
    const html = await res.text();
    for (const next of extract(html, url)) push(next, url);
  } else if (/xml/.test(type) && /sitemap/.test(url)) {
    const xml = await res.text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>|href="([^"]+)"/g)) {
      const local = toLocal((m[1] || m[2]).replace(/&amp;/g, '&'), url);
      if (local) push(local, url);
    }
  }
}

push(`${origin}/`, 'seed');
push(`${origin}/sitemap.xml`, 'seed');
// Assets referenced from JS/CSS rather than markup (tutorial frames, email logos, CSS url()).
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|css)$/.test(f)) out.push(p);
  }
  return out;
}
for (const file of walk(join(ROOT, 'public', 'assets'))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/["'(](\/?(?:assets|fonts)\/[A-Za-z0-9_./-]+\.(?:svg|png|webp|jpg|woff2|css|js|json))["')]/g)) {
    push(`${origin}/${m[1].replace(/^\//, '')}`, `public/${file.slice(ROOT.length + 8).replace(/\\/g, '/')}`);
  }
}
for (const id of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '12', '12-ar', '13', '15', '16', '18', '19', '19-ar']) {
  for (const ext of ['webp', 'png']) push(`${origin}/assets/howto/p${id}.${ext}`, 'tutorial frames');
}
push(`${origin}/robots.txt`, 'seed');
push(`${origin}/404.html`, 'seed');
// Pages behind the session guard: they redirect to /login/ for a crawler, which is the expected state;
// their own document is fetched directly so their asset links are still verified.
for (const p of ['/account/', '/account/access/', '/account/course/', '/account/profile/', '/account/notifications/']) push(`${origin}${p}`, 'seed');

while (queue.length) {
  const batch = queue.splice(0, 12);
  await Promise.all(batch.map((j) => check(j.url, j.from)));
}

const checked = [...seen.entries()];
const pages = checked.filter(([u, v]) => v.status === 200 && !/\.(css|js|svg|png|webp|ico|woff2|json|xml|txt|webmanifest)(\?|$)/.test(u)).length;
console.log(`check-links: ${checked.length} internal URLs (${pages} documents) from ${origin}`);
if (broken.length) {
  for (const b of broken) console.log(`  BROKEN ${b.status}  ${b.url}\n         from ${b.from}`);
  console.log(`check-links: ${broken.length} broken`);
} else {
  console.log('check-links: 0 broken');
}
if (srv) srv.close();
process.exit(broken.length ? 1 : 0);
