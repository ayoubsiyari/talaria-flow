/**
 * Lighthouse ≥ 90 gate (docs/CHECKLIST.md): /, /course/, /login/ on mobile and desktop.
 *
 *   pnpm build && pnpm start          (in another terminal, or pass --start)
 *   node scripts/lighthouse.mjs [--start] [--origin http://127.0.0.1:5051] [--only home,course,login]
 *
 * Uses the Chromium that Playwright installed (pnpm exec playwright install chromium) and the
 * lighthouse CLI via `pnpm dlx`, so nothing extra lands in package.json. Writes HTML + JSON reports
 * and a summary table to docs/lighthouse/. Exits 1 if any category on any run is below 90.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'lighthouse');
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const ORIGIN = flag('--origin', 'http://127.0.0.1:5051');
const ONLY = (flag('--only', 'home,course,login') || '').split(',').filter(Boolean);
const PAGES = { home: '/', course: '/course/', login: '/login/' };
const FORMS = ['mobile', 'desktop'];
const MIN = 90;

let server = null;
if (args.includes('--start')) {
  server = spawn(process.execPath, [join(ROOT, 'scripts', 'dev-server.mjs')], { stdio: 'ignore', env: { ...process.env, PORT: new URL(ORIGIN).port } });
  await new Promise((r) => setTimeout(r, 1500));
}

mkdirSync(OUT, { recursive: true });
const chrome = chromium.executablePath();
const rows = [];
let failed = false;

for (const key of ONLY) {
  for (const form of FORMS) {
    const name = `${key}-${form}`;
    const cli = [
      'dlx', 'lighthouse', `${ORIGIN}${PAGES[key]}`,
      `--chrome-path=${chrome}`, '--chrome-flags=--headless=new --no-sandbox',
      '--only-categories=performance,accessibility,best-practices,seo',
      '--output=html', '--output=json', `--output-path=${join(OUT, name)}`, '--quiet',
    ];
    if (form === 'desktop') cli.push('--preset=desktop');
    process.stdout.write(`lighthouse ${name} … `);
    // chrome-launcher fails to delete its temp profile on Windows after a successful run; ignore that exit code.
    rmSync(join(OUT, `${name}.report.json`), { force: true });
    const cmd = ['pnpm', ...cli].map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' ');
    spawnSync(cmd, { cwd: ROOT, stdio: 'ignore', shell: true });
    if (!existsSync(join(OUT, `${name}.report.json`))) {
      console.log('no report written — run the command by hand to see the error:\n  ' + cmd);
      process.exit(1);
    }
    const r = JSON.parse(readFileSync(join(OUT, `${name}.report.json`), 'utf8'));
    const c = Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map((k) => [k, Math.round(r.categories[k].score * 100)]));
    const a = r.audits;
    const row = { name, path: PAGES[key], form, ...c, lcp: a['largest-contentful-paint'].displayValue, fcp: a['first-contentful-paint'].displayValue, tbt: a['total-blocking-time'].displayValue, cls: a['cumulative-layout-shift'].displayValue };
    rows.push(row);
    if (Object.values(c).some((v) => v < MIN)) failed = true;
    console.log(`perf ${c.performance}  a11y ${c.accessibility}  bp ${c['best-practices']}  seo ${c.seo}  (LCP ${row.lcp})`);
  }
}

const date = new Date().toISOString().slice(0, 10);
const md = [
  `# Lighthouse — ${date}`,
  '',
  `Lighthouse ${JSON.parse(readFileSync(join(OUT, `${rows[0].name}.report.json`), 'utf8')).lighthouseVersion}, Chromium via Playwright, default simulated throttling (mobile: Moto G Power / slow 4G; desktop preset). Origin: \`${ORIGIN}\` served by \`scripts/dev-server.mjs\` (same headers, redirects and compression as Vercel).`,
  '',
  '| Page | Form | Performance | Accessibility | Best practices | SEO | LCP | FCP | TBT | CLS | Report |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| \`${r.path}\` | ${r.form} | ${r.performance} | ${r.accessibility} | ${r['best-practices']} | ${r.seo} | ${r.lcp} | ${r.fcp} | ${r.tbt} | ${r.cls} | [${r.name}](./${r.name}.report.html) |`),
  '',
  `Gate: every category ≥ ${MIN}. ${failed ? '**FAILED**' : 'Passed'}.`,
  '',
];
writeFileSync(join(OUT, 'README.md'), md.join('\n'));
if (server) server.kill();
console.log(failed ? `\nBelow ${MIN} somewhere — see docs/lighthouse/README.md` : `\nAll ≥ ${MIN}. Summary: docs/lighthouse/README.md`);
process.exit(failed ? 1 : 0);
