/**
 * Routes, redirects and SPA navigation. Every public route must answer 200 with its own
 * document, legacy paths must 308 to their new home, and unknown paths must return the 404 page.
 */
import { test, expect } from '@playwright/test';
import { login } from './helpers.mjs';

const PUBLIC = ['/', '/course/', '/login/', '/signup/', '/tools/', '/ninjatrader/', '/legal/privacy/', '/legal/terms/', '/legal/disclaimers/'];
const REDIRECTS = [
  ['/suite/', '/tools/'],
  ['/suite', '/tools/'],
  ['/login', '/login/'],
  ['/login.html', '/login/'],
  ['/course/how-to-register/', '/course/#guide'],
  ['/how-to', '/course/#guide'],
  ['/dashboard', '/account/access/'],
  ['/admin/emails/templates', '/admin/emails/'],
];

test('public routes render their own document', async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  for (const route of PUBLIC) {
    const res = await page.goto(baseURL + route, { waitUntil: 'networkidle' });
    expect(res.status(), route).toBe(200);
    await expect(page.locator('h1').first(), route).toBeVisible();
    // SEO.md titles verbatim; description + canonical present on every public page.
    expect((await page.title()).length, route).toBeGreaterThan(10);
    expect(await page.locator('meta[name="description"]').getAttribute('content'), route).toBeTruthy();
    expect(await page.locator('link[rel="canonical"]').getAttribute('href'), route).toBe('https://www.talaria-flow.com' + route);
  }
  expect(errors).toEqual([]);
});

test('legacy paths redirect permanently', async ({ request, baseURL }) => {
  for (const [from, to] of REDIRECTS) {
    const res = await request.fetch(baseURL + from, { maxRedirects: 0 });
    expect([301, 308], from).toContain(res.status());
    expect(res.headers().location, from).toBe(to);
  }
});

test('unknown paths return the designed 404', async ({ page, baseURL }) => {
  const res = await page.goto(baseURL + '/this-page-does-not-exist/');
  expect(res.status()).toBe(404);
  await expect(page.locator('h1')).toContainText(/Nothing traded at this price|لا يوجد شيء عند هذا السعر/);
  expect(await page.locator('meta[name="robots"]').getAttribute('content')).toMatch(/noindex/);
});

test('language switch swaps SEO title, description and OG image', async ({ page, baseURL }) => {
  await page.goto(baseURL + '/course/?lang=ar', { waitUntil: 'networkidle' });
  expect(await page.getAttribute('html', 'lang')).toBe('ar');
  expect(await page.title()).toBe('دورة Order Flow المجانية — 30 فيديو بلا تكلفة');
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toContain('og-default-ar.png');
  await page.goto(baseURL + '/course/?lang=en', { waitUntil: 'networkidle' });
  expect(await page.title()).toBe('Free order flow course — 30 videos, no cost');
});

test('/legal/ and old fragment links land on the right legal page', async ({ page, request, baseURL }) => {
  const res = await request.fetch(baseURL + '/legal/', { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers().location).toBe('/legal/privacy/');
  await page.goto(baseURL + '/legal/#terms', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/legal\/terms\/$/);
  await expect(page.locator('h1')).toContainText(/Terms of use/);
  const robots = await request.get(baseURL + '/robots.txt');
  expect(await robots.text()).toMatch(/Disallow: \/admin\//);
  const sitemap = await request.get(baseURL + '/sitemap.xml');
  expect((await sitemap.text()).match(/<loc>/g).length).toBe(9);
});

test('header navigation swaps pages without a reload', async ({ page, baseURL }) => {
  await page.goto(baseURL + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { window.__tfMarker = 1; });
  await page.click('header a[href="/course/"]');
  await expect(page).toHaveURL(/\/course\/$/);
  await expect(page.locator('h1').first()).toContainText(/Thirty videos/i);
  await page.click('header a[href="/tools/"]');
  await expect(page).toHaveURL(/\/tools\/$/);
  expect(await page.evaluate(() => window.__tfMarker)).toBe(1);
});

// Against tests/mock-supabase.mjs by default; with TEST_REAL_BACKEND=1 it needs the accounts from
// scripts/create-test-accounts.ts and TEST_PASSWORD in .env.
test('member session: login lands in the account area, /admin/ is refused', async ({ page, baseURL }) => {
  await login(page, 'member-new@talaria-flow.test', { baseURL });
  await expect(page).toHaveURL(/\/account\/(access\/)?$/);
  const res = await page.goto(baseURL + '/admin/', { waitUntil: 'networkidle' });
  expect(res.status()).toBe(404);
});

test('course lesson URLs serve the account course page, not 404', async ({ page, baseURL }) => {
  await login(page, 'member-approved@talaria-flow.test', { baseURL });
  for (const path of ['/account/course/1/', '/account/course/auction/']) {
    const res = await page.goto(baseURL + path, { waitUntil: 'networkidle' });
    expect(res.status(), path).toBe(200);
    await expect(page.locator('h1').first(), path).toContainText(/Free order flow course|دورة Order Flow/);
    expect(await page.locator('h1').first().textContent(), path).not.toMatch(/Nothing traded|لا يوجد شيء/);
  }
});
