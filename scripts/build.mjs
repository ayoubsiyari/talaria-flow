/**
 * Build: produces every generated file under public/ from the sources in src/ and emails/.
 *
 *   src/i18n/{en,ar}.json        -> public/assets/js/i18n.js          (window.TF_I18N)
 *   src/tutorial/*.jsx           -> public/assets/js/tutorial/*.js    (JSX stripped with sucrase)
 *   emails/templates.json        -> public/assets/emails/templates.json (admin preview / editor)
 *   emails/render.js             -> public/assets/js/emails-render.js   (window.TFEmail, admin preview)
 *   .env (public keys only)      -> public/assets/js/env.js           (window.__ENV)
 *
 * Idempotent; safe to run on Vercel (`pnpm build`) and locally before `pnpm start`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'sucrase';
import { publicEnvScript } from './lib/public-env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');

function out(rel, text) {
  const p = join(PUB, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  console.log('build', rel, `${Buffer.byteLength(text)} B`);
}

// ---- i18n --------------------------------------------------------------
const en = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'ar.json'), 'utf8'));
function merge(e, a) {
  const o = {};
  for (const k of Object.keys(e)) {
    if (e[k] && typeof e[k] === 'object') o[k] = merge(e[k], (a && a[k]) || {});
    else o[k] = { en: e[k], ar: a && typeof a[k] === 'string' ? a[k] : e[k] };
  }
  return o;
}
const missing = [];
(function check(e, a, path) {
  for (const k of Object.keys(e)) {
    const p = path ? `${path}.${k}` : k;
    if (e[k] && typeof e[k] === 'object') check(e[k], (a && a[k]) || {}, p);
    else if (!a || typeof a[k] !== 'string') missing.push(p);
  }
})(en, ar, '');
if (missing.length) console.warn(`i18n: ${missing.length} keys fall back to English:`, missing.slice(0, 10).join(', '), missing.length > 10 ? '…' : '');
out('assets/js/i18n.js', `window.TF_I18N = ${JSON.stringify(merge(en, ar), null, 2)};\n`);

// ---- tutorial (React UMD is vendored in public/assets/js/vendor) --------
const engine = readFileSync(join(ROOT, 'src', 'tutorial', 'animations-v3.jsx'), 'utf8');
out('assets/js/tutorial/animations-v3.js', transform(engine, { transforms: ['jsx'], production: true }).code);
const scene = readFileSync(join(ROOT, 'src', 'tutorial', 'tutorial-scene.jsx'), 'utf8');
// The scene is plain JS (React.createElement); wrap it so the SPA can load it more than once.
out('assets/js/tutorial/tutorial-scene.js', `(function () {\n${transform(scene, { transforms: ['jsx'], production: true }).code}\n})();\n`);

// ---- email templates (admin preview + campaign editor) -------------------
const templatesJson = readFileSync(join(ROOT, 'emails', 'templates.json'), 'utf8');
out('assets/emails/templates.json', templatesJson);
// One renderer: emails/render.js is the source of truth for the server (send-template.ts via vm) and
// the admin preview (window.TFEmail); the browser copy is generated, never edited.
out('assets/js/emails-render.js', readFileSync(join(ROOT, 'emails', 'render.js'), 'utf8'));

// ---- public env ---------------------------------------------------------
out('assets/js/env.js', publicEnvScript(join(ROOT, '.env')));
