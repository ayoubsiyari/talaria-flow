import { test, expect } from '@playwright/test';
import { login, freshClientIp } from './helpers.mjs';

/**
 * Regression tests for the findings closed after the 10 September audit. Each test names the finding it
 * guards so a future failure points straight at the behaviour that regressed.
 */

// The resubmit test mutates the mock's fixtures; reset them so the other specs see the seeded states.
const MOCK = 'http://127.0.0.1:5099';
const real = process.env.TEST_REAL_BACKEND === '1';
test.beforeAll(async ({ request }) => { if (!real) await request.post(MOCK + '/__reset').catch(() => {}); });
test.afterAll(async ({ request }) => { if (!real) await request.post(MOCK + '/__reset').catch(() => {}); });

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('B1: clicking an option in the custom select picks it and does not switch the site language', async ({ page, baseURL }) => {
  await page.goto(baseURL + '/signup/', { waitUntil: 'networkidle' });
  await page.locator('#signup-country-host button[aria-haspopup="listbox"]').click();
  const listbox = page.locator('form#signup-form [role="listbox"]');
  await expect(listbox).toBeVisible();
  const option = listbox.locator('[role="option"]').filter({ hasText: /Germany|ألمانيا/ }).first();
  await option.click();
  await expect(listbox).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('form#signup-form [aria-haspopup="listbox"]').first()).toContainText(/Germany/);
});

test('B2: a rejected member sees one upload box, one h1, and can resubmit', async ({ page, baseURL }) => {
  await login(page, 'member-rejected@talaria-flow.test', { baseURL });
  await page.goto(baseURL + '/account/access/', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-account-main] h1')).toHaveCount(1);
  await expect(page.locator('#upload-dropzone')).toHaveCount(1);
  await expect(page.locator('#submit-proof')).toHaveCount(1);
  await expect(page.locator('#submit-proof')).toBeDisabled();
  await page.setInputFiles('#upload-dropzone input[type="file"]', [
    { name: 'dashboard.png', mimeType: 'image/png', buffer: PNG_1x1 },
    { name: 'platform.png', mimeType: 'image/png', buffer: PNG_1x1 },
  ]);
  await expect(page.locator('#submit-proof')).toBeEnabled();
  await page.click('#submit-proof');
  await page.locator('[data-proof-dialog] [data-dlg="yes"]').click();
  await page.locator('[data-proof-dialog] [data-dlg="back"]').click();
  await expect(page.locator('[data-state="review"]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#upload-dropzone')).toHaveCount(0);
});

test('B6: the account area shows no seeded activity or placeholder tiles', async ({ page, baseURL }) => {
  await login(page, 'member-pending@talaria-flow.test', { baseURL });
  const body = await page.textContent('body');
  expect(body).not.toMatch(/You uploaded 2 screenshots|Last changed 4 Sep 2026|screenshot-1\.png/);
  await page.goto(baseURL + '/account/access/', { waitUntil: 'networkidle' });
  expect(await page.textContent('body')).not.toMatch(/screenshot-1\.png|screenshot-2\.png/);
  await page.goto(baseURL + '/account/profile/', { waitUntil: 'networkidle' });
  expect(await page.textContent('body')).not.toMatch(/Last changed/);
});

test('M1: the waitlist form is replaced by a confirmation and cannot be submitted twice', async ({ page, baseURL }) => {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': freshClientIp() });
  await page.goto(baseURL + '/tools/', { waitUntil: 'networkidle' });
  const form = page.locator('form[data-waitlist]').first();
  await form.locator('input[type="email"]').fill('waitlist-test@talaria-flow.test');
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('[data-waitlist-done]')).toBeVisible();
  await expect(form.locator('[data-waitlist-done]')).toContainText('waitlist-test@talaria-flow.test');
  await expect(form.locator('button[type="submit"]')).toHaveCount(0);
});

test('M2: successful signup replaces the form with a check-your-inbox state', async ({ page, baseURL }) => {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': freshClientIp() });
  await page.goto(baseURL + '/signup/', { waitUntil: 'networkidle' });
  await page.fill('#signup-first', 'Test');
  await page.fill('#signup-last', 'Member');
  const host = page.locator('form#signup-form [aria-haspopup="listbox"]').first();
  await host.click();
  await page.locator('form#signup-form [role="option"]').filter({ hasText: 'Germany' }).first().click();
  await page.fill('#signup-email', `new-${Date.now()}@talaria-flow.test`);
  await page.fill('#signup-password', 'Talaria!2026-new');
  await page.fill('#signup-password2', 'Talaria!2026-new');
  await page.check('#signup-form input[type="checkbox"]');
  await page.click('#signup-form button[type="submit"]');
  await expect(page.locator('[data-view="signup-done"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#signup-form')).toBeHidden();
});

test('M3: a signed-in member who opens /login/ or /signup/ lands in the account area', async ({ page, baseURL }) => {
  await login(page, 'member-approved@talaria-flow.test', { baseURL });
  await page.goto(baseURL + '/login/');
  await page.waitForURL((u) => /\/account\//.test(u.pathname), { timeout: 15000 });
  await page.goto(baseURL + '/signup/');
  await page.waitForURL((u) => /\/account\//.test(u.pathname), { timeout: 15000 });
});

test('M4: deleting the account asks through an accessible dialog, not window.confirm', async ({ page, baseURL }) => {
  await login(page, 'member-new@talaria-flow.test', { baseURL });
  await page.goto(baseURL + '/account/profile/', { waitUntil: 'networkidle' });
  let nativeConfirm = false;
  page.on('dialog', (d) => { nativeConfirm = true; d.dismiss(); });
  await page.click('[data-account-delete]');
  const dialog = page.locator('[data-account-dialog] [role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(nativeConfirm).toBe(false);
});

test('Low: a skip link is the first focusable element and jumps to the content', async ({ page, baseURL }) => {
  await page.goto(baseURL + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const active = page.locator(':focus');
  await expect(active).toHaveClass(/tf-skip-link/);
  await expect(active).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#page:focus, main:focus')).toHaveCount(1);
});

test.describe('admin', () => {
  test('B5/B6: approving a member goes through /api/admin/submission and persists; no seed rows anywhere', async ({ page, baseURL }) => {
    await login(page, 'admin@talaria-flow.test', { baseURL });
    for (const p of ['/admin/', '/admin/members/', '/admin/campaigns/', '/admin/campaigns/history/', '/admin/emails/', '/admin/waitlist/']) {
      await page.goto(baseURL + p, { waitUntil: 'networkidle' });
      const text = await page.textContent('body');
      expect(text, p).not.toMatch(/example\.com|screenshot-\d\.png|Draft for review/);
    }
    await page.goto(baseURL + '/admin/members/', { waitUntil: 'networkidle' });
    const calls = [];
    page.on('request', (r) => { if (/\/api\/admin\/submission$/.test(r.url())) calls.push(JSON.parse(r.postData() || '{}')); });
    const row = page.locator('[data-act="row-approve"]').first();
    await expect(row).toBeVisible();
    const memberId = await row.getAttribute('data-id');
    await row.click();
    await expect.poll(() => calls.length, { timeout: 10000 }).toBeGreaterThan(0);
    expect(calls[0].action).toBe('approve');
    expect(calls[0].id).toBeTruthy();
    await expect(page.locator('body')).toContainText(/Approved/);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator(`[data-act="row-approve"][data-id="${memberId}"]`)).toHaveCount(0);
    const ls = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^TF_/.test(k)));
    expect(ls).toEqual([]);
  });

  test('B4: sending a campaign creates a server-side email_sends row that shows in history', async ({ page, baseURL }) => {
    await login(page, 'admin@talaria-flow.test', { baseURL });
    await page.goto(baseURL + '/admin/campaigns/?tpl=08', { waitUntil: 'networkidle' });
    await page.locator('[data-act="audience"][data-audience="approved"]').click();
    await expect(page.locator('[data-recip-count]')).toHaveText(/^[1-9]\d*$/, { timeout: 10000 });
    await page.locator('[data-act="submit-send"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const createReq = page.waitForRequest((r) => /\/api\/admin\/campaigns$/.test(r.url()) && /"action":"create"/.test(r.postData() || ''));
    await dialog.getByRole('button', { name: /^Send now$/ }).click();
    const req = await createReq;
    const res = await (await req.response()).json();
    expect(res.ok).toBe(true);
    expect(res.send.state).toBe('sent');
    await page.waitForURL((u) => /\/admin\/campaigns\/history\//.test(u.pathname));
    await expect(page.locator('body')).toContainText(/Newsletter/);
    const token = await page.evaluate(async () => (await window.TF.getClient().auth.getSession()).data.session.access_token);
    const hist = await page.request.get(baseURL + '/api/admin/campaigns', { headers: { authorization: 'Bearer ' + token } });
    expect(hist.status()).toBe(200);
    expect((await hist.json()).sends.some((s) => s.id === res.send.id)).toBe(true);
  });
});

test('B8: legal pages no longer say they are drafts', async ({ page, baseURL }) => {
  for (const p of ['/legal/privacy/', '/legal/terms/', '/legal/disclaimers/']) {
    await page.goto(baseURL + p, { waitUntil: 'networkidle' });
    expect(await page.textContent('body')).not.toMatch(/Draft for review/i);
  }
});
