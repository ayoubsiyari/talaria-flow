/**
 * SHIP.md §2 P4 — frontend verification that needs a browser:
 *  - responsive at 390 / 768 / 1024 / 1440 / 1920 with no horizontal scroll, EN and AR
 *  - every form validates inline with error copy in both languages
 *  - one cyan primary per view (audit)
 *  - session + language state on every page after login (member and admin), guard behaviour
 *
 * Runs against tests/mock-supabase.mjs (see playwright.config.mjs); set SHOTS_DIR to also save
 * screenshots of every page × width × language.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { login as loginAs } from './helpers.mjs';

const PUBLIC = ['/', '/course/', '/ninjatrader/', '/tools/', '/signup/', '/login/', '/legal/privacy/', '/legal/terms/', '/legal/disclaimers/'];
const ACCOUNT = ['/account/', '/account/access/', '/account/course/', '/account/profile/', '/account/notifications/'];
const ADMIN = ['/admin/', '/admin/members/', '/admin/campaigns/', '/admin/campaigns/history/', '/admin/emails/', '/admin/emails/new/', '/admin/waitlist/'];
const WIDTHS = [390, 768, 1024, 1440, 1920];
const SHOTS = process.env.SHOTS_DIR || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const ARABIC = /[\u0600-\u06FF]/;

// Seed the language once per tab (init scripts run on every navigation; re-seeding would undo a switch
// made through the header, which is exactly what the session/language test checks).
async function setLang(page, lang) {
  await page.addInitScript((l) => {
    try {
      if (sessionStorage.getItem('tf-test-lang')) return;
      sessionStorage.setItem('tf-test-lang', l);
      localStorage.setItem('tf-lang', l);
    } catch (e) {}
  }, lang);
}

async function noHorizontalScroll(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const over = [];
    const vw = window.innerWidth;
    if (doc.scrollWidth > vw || document.body.scrollWidth > vw) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
          over.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} right=${Math.round(r.right)}`);
          if (over.length > 5) break;
        }
      }
      return { ok: false, scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), vw, over };
    }
    return { ok: true };
  });
}

const login = (page, baseURL, email) => loginAs(page, email, { baseURL });

// ---------------------------------------------------------------- responsive
for (const lang of ['en', 'ar']) {
  test(`[${lang}] no horizontal scroll on any public page at ${WIDTHS.join('/')}`, async ({ browser, baseURL }) => {
    const failures = [];
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 900 } });
      const page = await ctx.newPage();
      await setLang(page, lang);
      for (const path of PUBLIC) {
        await page.goto(baseURL + path, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const r = await noHorizontalScroll(page);
        if (!r.ok) failures.push(`${lang} ${width} ${path}: scrollWidth ${r.scrollWidth} > ${r.vw} — ${r.over.join(', ')}`);
        if (SHOTS) await page.screenshot({ path: join(SHOTS, `${lang}-${width}-${path.replace(/\//g, '_') || 'home'}.png`), fullPage: width >= 1024 ? false : true });
      }
      await ctx.close();
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
}

// ---------------------------------------------------------------- forms EN/AR
for (const lang of ['en', 'ar']) {
  test(`[${lang}] forms validate inline with localised copy`, async ({ page, baseURL }) => {
    await setLang(page, lang);
    const isLocal = (s) => (lang === 'ar' ? ARABIC.test(s) : !ARABIC.test(s) && /[a-z]/i.test(s));

    // Login: empty submit -> email error; bad password -> password error from the API (mock: 401)
    await page.goto(baseURL + '/login/', { waitUntil: 'networkidle' });
    await page.click('#login-form button[type="submit"]');
    const loginErr = page.locator('#login-email-err');
    await expect(loginErr).toBeVisible();
    expect(isLocal(await loginErr.innerText())).toBe(true);
    await page.fill('#login-form input[type="email"]', 'member-new@talaria-flow.test');
    await page.fill('#login-form input[type="password"]', 'wrong-password');
    await page.click('#login-form button[type="submit"]');
    const pwErr = page.locator('#login-pw-err');
    await expect(pwErr).toBeVisible();
    expect(isLocal(await pwErr.innerText())).toBe(true);
    expect(await page.locator('#login-form input[type="password"]').getAttribute('aria-invalid')).toBe('true');

    // Password reset view: empty submit -> inline error under the email field
    await page.goto(baseURL + '/login/?view=reset', { waitUntil: 'networkidle' });
    await page.click('#reset-form button[type="submit"]');
    const resetErr = page.locator('#reset-form .tf-field-err.is-on');
    await expect(resetErr).toBeVisible();
    expect(isLocal(await resetErr.innerText())).toBe(true);
    expect(await page.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex');

    // Signup: empty submit -> every required field flagged
    await page.goto(baseURL + '/signup/', { waitUntil: 'networkidle' });
    await page.click('#signup-form button[type="submit"]');
    for (const id of ['signup-first-err', 'signup-last-err', 'signup-email-err', 'signup-pw-err']) {
      const el = page.locator('#' + id);
      await expect(el, id).toBeVisible();
      expect(isLocal(await el.innerText()), id).toBe(true);
    }

    // Waitlist (home): invalid email -> inline error under the field
    await page.goto(baseURL + '/', { waitUntil: 'networkidle' });
    const wl = page.locator('form[data-waitlist]').first();
    await wl.locator('input[type="email"]').fill('not-an-email');
    await wl.locator('button[type="submit"]').click();
    const wlErr = wl.locator('.tf-field-err.is-on');
    await expect(wlErr).toBeVisible();
    expect(isLocal(await wlErr.innerText())).toBe(true);
    expect(await wl.locator('input[type="email"]').getAttribute('aria-invalid')).toBe('true');
  });
}

// ---------------------------------------------------------------- one cyan primary per view
// SHIP.md §2 P4: "one cyan primary per view (audit, don't redesign)". The header's "Create account" is
// site chrome mandated by Site Header.dc.html and is reported separately; the page body may hold one.
test('one cyan primary per view (audit)', async ({ page, baseURL }) => {
  const report = [];
  for (const path of PUBLIC) {
    await page.goto(baseURL + path, { waitUntil: 'networkidle' });
    const found = await page.evaluate(() => {
      const cyan = 'rgb(46, 232, 255)';
      const label = (el) => (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40);
      const above = [...document.querySelectorAll('a, button')].filter((el) => {
        if (el.closest('#tf-consent')) return false;
        const cs = getComputedStyle(el);
        if (cs.backgroundColor !== cyan || cs.display === 'none') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight; // above the fold
      });
      return {
        header: above.filter((el) => el.closest('header')).map(label),
        body: above.filter((el) => !el.closest('header')).map(label),
      };
    });
    report.push(`${path}: body ${found.body.length}${found.body.length ? ' (' + found.body.join(' | ') + ')' : ''}, header ${found.header.length}${found.header.length ? ' (' + found.header.join(' | ') + ')' : ''}`);
    expect(found.body.length, `${path} has ${found.body.length} cyan primaries above the fold: ${found.body.join(' | ')}`).toBeLessThanOrEqual(1);
    expect(found.header.length, `${path} header primaries`).toBeLessThanOrEqual(1);
  }
  console.log(report.join('\n'));
});

// ---------------------------------------------------------------- guards
test('guards: guest -> /login/?redirect, member -> /admin/ is 404, admin -> /admin/ is 200', async ({ page, baseURL }) => {
  const guest = await page.goto(baseURL + '/account/access/', { waitUntil: 'networkidle' });
  expect(guest.status()).toBe(200);
  await expect(page).toHaveURL(/\/login\/\?redirect=%2Faccount%2Faccess%2F/);
  const adminAsGuest = await page.request.get(baseURL + '/admin/', { maxRedirects: 0 });
  expect(adminAsGuest.status()).toBe(404);

  await login(page, baseURL, 'member-new@talaria-flow.test');
  await expect(page).toHaveURL(/\/account\/(access\/)?$/);
  const res = await page.goto(baseURL + '/admin/', { waitUntil: 'networkidle' });
  expect(res.status()).toBe(404);
  await expect(page.locator('h1')).toContainText(/Nothing traded at this price/);
});

// ---------------------------------------------------------------- session + language on every page
test('member: session chip and Arabic persist on every page after login', async ({ page, baseURL }) => {
  await setLang(page, 'ar');
  await login(page, baseURL, 'member-approved@talaria-flow.test');
  for (const path of [...ACCOUNT, ...PUBLIC.filter((p) => p !== '/login/' && p !== '/signup/')]) {
    const res = await page.goto(baseURL + path, { waitUntil: 'networkidle' });
    expect(res.status(), path).toBe(200);
    expect(await page.getAttribute('html', 'lang'), path).toBe('ar');
    const chip = page.locator('[data-session-chip]');
    await expect(chip, path).toBeVisible();
    await chip.locator('button').first().click();
    await expect(page.locator('[data-user-menu]'), path).toContainText('member-approved@talaria-flow.test');
    await page.keyboard.press('Escape');
    // Cookie-guarded pages were served by the middleware, i.e. the HttpOnly session cookie is in place.
    if (path.startsWith('/account/')) expect(await page.locator('main, #page').first().isVisible(), path).toBe(true);
  }
  // Switch back to English from the header on an account page and confirm it sticks on the next page.
  await page.goto(baseURL + '/account/profile/', { waitUntil: 'networkidle' });
  await page.click('#lang-menu-btn, [data-langbtn]');
  await page.click('#lang-menu [role="option"][lang="en"], [role="listbox"] [role="option"][lang="en"]');
  await page.goto(baseURL + '/account/', { waitUntil: 'networkidle' });
  expect(await page.getAttribute('html', 'lang')).toBe('en');
  // Log out clears the cookie: the guarded page redirects again.
  await page.locator('[data-session-chip] button').first().click();
  await page.click('[data-user-menu] [href="#logout"]');
  await page.waitForURL((u) => !/\/account\//.test(u.pathname), { timeout: 15000 });
  await page.goto(baseURL + '/account/', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/login\/\?redirect=/);
});

test('admin: every admin page answers 200 with the shell after login', async ({ page, baseURL }) => {
  await login(page, baseURL, 'admin@talaria-flow.test');
  await expect(page).toHaveURL(/\/admin\/$/);
  for (const path of ADMIN) {
    const res = await page.goto(baseURL + path, { waitUntil: 'networkidle' });
    expect(res.status(), path).toBe(200);
    await expect(page.locator('[data-shell]'), path).toBeVisible();
    expect(await page.getAttribute('html', 'lang'), path).toBe('en'); // admin is English-only
  }
  // Admin session also shows on the public site
  await page.goto(baseURL + '/', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-session-chip]')).toBeVisible();
});
