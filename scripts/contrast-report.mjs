/**
 * WCAG contrast of every text/background pair defined in public/assets/css/tokens.css
 * (docs/CHECKLIST.md: all ≥ 4.5:1, display headlines ≥ 3:1). Prints a Markdown table; exit 1 on a miss.
 *
 *   node scripts/contrast-report.mjs
 */
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(ROOT, 'public', 'assets', 'css', 'tokens.css'), 'utf8');

const tokens = {};
for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6}|rgba?\([^)]+\))\s*;/g)) tokens[m[1]] = m[2];

function rgb(value) {
  if (value.startsWith('#')) return { r: parseInt(value.slice(1, 3), 16), g: parseInt(value.slice(3, 5), 16), b: parseInt(value.slice(5, 7), 16), a: 1 };
  const m = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}
function blend(fg, bg) { const a = fg.a; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }; }
function lum({ r, g, b }) {
  const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) { const L1 = lum(fg), L2 = lum(bg); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); }

// Where each colour is allowed to carry text, per tokens.css comments and DESIGN.md.
const TEXT = ['text', 'text-2', 'text-3', 'text-4', 'cyan', 'cyan-2', 'magenta', 'magenta-2', 'warn'];
const BACKGROUNDS = ['bg', 'bg-2', 'surface', 'black'];
const EXTRA = [
  ['btn-text-on-cyan', 'cyan', 'primary button label'],
  ['btn-text-on-cyan', 'cyan-2', 'primary button label, hover'],
  ['text', 'cyan-dim', 'outline button label on hover fill (over --bg)'],
  ['text', 'sheen', 'active segmented item (over --bg)'],
  ['cyan', 'sheen', 'active nav item (over --bg)'],
];
const DISPLAY_ONLY = new Set(); // no token is restricted to display sizes; everything is held to 4.5:1

const rows = [];
let fail = 0;
function add(fgName, bgName, note = '') {
  let fg = rgb(tokens[fgName]);
  let bg = rgb(tokens[bgName]);
  if (bg.a < 1) bg = blend(bg, rgb(tokens.bg));
  if (fg.a < 1) fg = blend(fg, bg);
  const r = Math.round(ratio(fg, bg) * 100) / 100;
  const min = DISPLAY_ONLY.has(fgName) ? 3 : 4.5;
  const ok = r >= min;
  if (!ok) fail++;
  rows.push(`| \`--${fgName}\` | \`--${bgName}\` | ${r.toFixed(2)}:1 | ${ok ? 'pass' : '**FAIL**'} | ${note} |`);
}
for (const t of TEXT) for (const b of BACKGROUNDS) add(t, b);
for (const [t, b, note] of EXTRA) add(t, b, note);

console.log('| Text token | Background token | Contrast | ≥ 4.5:1 | Note |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log(r);
console.log('');
console.log(`${rows.length} pairs, ${fail} below 4.5:1.`);
process.exit(fail ? 1 : 0);
