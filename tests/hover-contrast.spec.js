/**
 * BUGS-ROUND-8 — hover every button / a[class*="btn"] on every page, both languages.
 * Fails if color === backgroundColor or contrast < 4.5:1.
 */
import { test, expect } from '@playwright/test';
import { login } from './helpers.mjs';

const PAGES = [
  '/',
  '/course/',
  '/ninjatrader/',
  '/tools/',
  '/login/',
  '/signup/',
  '/legal/privacy/',
  '/account/',
  '/account/access/',
  '/account/course/',
  '/account/profile/',
  '/account/notifications/',
];

const LIST = `(() => {
  function vis(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  }
  return [...document.querySelectorAll('button, a[class*="btn"]')].map((el, i) => ({
    i,
    text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
    skip: !vis(el) || !(el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()
  }));
})()`;

const SAMPLE = `(el) => {
  function parseRgb(str) {
    const m = String(str || '').match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/i);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  function same(a, b) {
    return !!(a && b && Math.abs(a.r - b.r) < 1 && Math.abs(a.g - b.g) < 1 && Math.abs(a.b - b.b) < 1 && Math.abs(a.a - b.a) < 0.02);
  }
  function srgb(c) {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }
  function lum(c) { return 0.2126 * srgb(c.r) + 0.7152 * srgb(c.g) + 0.0722 * srgb(c.b); }
  function blend(fg, bg) {
    const a = Math.max(0, Math.min(1, fg.a));
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function contrast(a, b) {
    const L1 = lum(a), L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }
  function effectiveBg(node) {
    let acc = { r: 7, g: 8, b: 12, a: 1 };
    const stack = [];
    let n = node;
    while (n && n !== document.documentElement) {
      const bg = parseRgb(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0.01) stack.push(bg);
      n = n.parentElement;
    }
    for (let i = stack.length - 1; i >= 0; i--) acc = blend(stack[i], acc);
    return acc;
  }
  const cs = getComputedStyle(el);
  const fg = parseRgb(cs.color);
  const rawBg = parseRgb(cs.backgroundColor);
  const bg = (rawBg && rawBg.a >= 0.08) ? blend(rawBg, effectiveBg(el.parentElement || el)) : effectiveBg(el);
  return {
    color: cs.color,
    backgroundColor: cs.backgroundColor,
    equal: cs.color === cs.backgroundColor || same(fg, rawBg),
    contrast: Math.round(((fg && bg) ? contrast(fg, bg) : 0) * 100) / 100,
    text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80)
  };
}`;

for (const lang of ['en', 'ar']) {
  for (const path of PAGES) {
    test(`[${lang}] ${path} hover contrast`, async ({ page }) => {
      await page.addInitScript((l) => { localStorage.setItem('tf-lang', l); }, lang);
      if (path.startsWith('/account')) await login(page, 'member-approved@talaria-flow.test');
      await page.goto(path, { waitUntil: 'networkidle' });
      const targets = await page.evaluate(LIST);
      const fails = [];
      for (const t of targets) {
        if (t.skip) continue;
        const loc = page.locator('button, a[class*="btn"]').nth(t.i);
        try {
          await loc.scrollIntoViewIfNeeded();
          await loc.hover({ timeout: 2500 });
        } catch {
          continue;
        }
        const sample = await loc.evaluate(new Function('el', `return (${SAMPLE})(el)`));
        const label = sample.text || t.text || 'control #' + t.i;
        if (sample.equal) fails.push(`${label}: color === backgroundColor (${sample.color})`);
        else if (sample.contrast < 4.5) fails.push(`${label}: contrast ${sample.contrast} < 4.5 (${sample.color} on ${sample.backgroundColor})`);
      }
      expect(fails, fails.join('\n')).toEqual([]);
    });
  }
}
