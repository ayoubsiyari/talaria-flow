/**
 * Content-Security-Policy hashes for the inline scripts in public/**\/*.html.
 *
 *   node scripts/csp-hashes.mjs          -> verify vercel.json lists every inline-script hash (exit 1 if not)
 *   node scripts/csp-hashes.mjs --write  -> rewrite the script-src hashes in vercel.json
 *
 * The site has exactly one inline script (the language bootstrap) so the policy carries one hash;
 * everything else must be an external file under /assets/js/.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const VERCEL = join(ROOT, 'vercel.json');

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith('.html')) yield p;
  }
}

const hashes = new Map();
const inlineHandlers = [];
for (const file of htmlFiles(PUB)) {
  const html = readFileSync(file, 'utf8');
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/type\s*=\s*["'](application\/(ld\+)?json|text\/template)["']/i.test(attrs)) continue;
    const body = m[2];
    if (!body.trim()) continue;
    const h = `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
    if (!hashes.has(h)) hashes.set(h, []);
    hashes.get(h).push(file.replace(`${PUB}\\`, '').replace(`${PUB}/`, ''));
  }
  const onAttr = html.match(/\son[a-z]+\s*=\s*["']/i);
  if (onAttr) inlineHandlers.push(file);
}

const config = JSON.parse(readFileSync(VERCEL, 'utf8'));
const entry = (config.headers || []).flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy');
if (!entry) {
  console.error('vercel.json has no Content-Security-Policy header');
  process.exit(1);
}

const want = [...hashes.keys()].sort();
const scriptSrc = entry.value.split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src')) || '';
const have = scriptSrc.split(/\s+/).filter((t) => t.startsWith("'sha256-")).sort();

if (process.argv.includes('--write')) {
  const rest = scriptSrc.split(/\s+/).filter((t) => t && !t.startsWith("'sha256-"));
  const next = [...rest, ...want].join(' ');
  entry.value = entry.value.split(';').map((s) => (s.trim().startsWith('script-src') ? ` ${next}` : s)).join(';').replace(/^\s+/, '');
  writeFileSync(VERCEL, `${JSON.stringify(config, null, 2)}\n`);
  console.log('csp: wrote', want.length, 'hash(es) to vercel.json');
}

for (const [h, files] of hashes) console.log(`${h}  (${files.length} page${files.length === 1 ? '' : 's'})`);
if (inlineHandlers.length) {
  console.error('inline event handlers found (blocked by CSP):', inlineHandlers);
  process.exit(1);
}
const missing = want.filter((h) => !have.includes(h));
const stale = have.filter((h) => !want.includes(h));
if (!process.argv.includes('--write') && (missing.length || stale.length)) {
  if (missing.length) console.error('csp: hashes missing from vercel.json:', missing);
  if (stale.length) console.error('csp: stale hashes in vercel.json:', stale);
  process.exit(1);
}
console.log('csp: ok');
