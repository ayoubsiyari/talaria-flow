// P1 security: server-side guards, headers, API input validation. Runs against scripts/dev-server.mjs
// (which executes middleware.ts and api/*.ts exactly like Vercel does).
import { test, expect } from '@playwright/test';
import { login } from './helpers.mjs';

test.describe('server-side session guard (middleware.ts)', () => {
  test('/account/* without a session redirects to login with the return path', async ({ request }) => {
    const res = await request.get('/account/access/', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/login\/\?redirect=%2Faccount%2Faccess%2F$/);
  });

  test('/admin/* without a session is a 404, not a redirect', async ({ request }) => {
    for (const path of ['/admin/', '/admin/members/', '/admin/emails/edit/']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
      expect(res.headers()['content-type']).toMatch(/text\/html/);
      expect(res.headers()['x-robots-tag']).toContain('noindex');
    }
  });

  test('a forged session cookie is rejected the same way', async ({ request }) => {
    const headers = { cookie: 'tf-session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged' };
    expect((await request.get('/admin/', { headers, maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get('/account/', { headers, maxRedirects: 0 })).status()).toBe(307);
  });
});

test.describe('security headers (vercel.json)', () => {
  test('every HTML response carries CSP, HSTS, frame, referrer and permissions policies', async ({ request }) => {
    for (const path of ['/', '/course/', '/login/']) {
      const h = (await request.get(path)).headers();
      expect(h['content-security-policy'], path).toMatch(/default-src 'self'/);
      expect(h['content-security-policy']).toMatch(/script-src 'self' https:\/\/challenges\.cloudflare\.com 'sha256-/);
      expect(h['content-security-policy']).toMatch(/frame-ancestors 'none'/);
      expect(h['content-security-policy']).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(h['strict-transport-security']).toMatch(/max-age=63072000; includeSubDomains; preload/);
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(h['permissions-policy']).toMatch(/camera=\(\)/);
    }
  });

  test('inline scripts in the pages match the CSP hashes', async ({ page }) => {
    const violations = [];
    page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
    await page.goto('/login/');
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);
    // The language bootstrap ran (it is the only inline script).
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-lang'))).toMatch(/^(en|ar)$/);
  });
});

test.describe('API input validation (zod)', () => {
  const endpoints = ['/api/auth/login', '/api/auth/signup', '/api/auth/reset', '/api/waitlist', '/api/proof', '/api/admin/emails/test', '/api/admin/member'];

  test('GET is not allowed on POST endpoints', async ({ request }) => {
    for (const p of endpoints) {
      const res = await request.get(p);
      expect(res.status(), p).toBe(405);
    }
  });

  test('non-JSON bodies are rejected (CSRF via HTML forms is impossible)', async ({ request }) => {
    const res = await request.post('/api/auth/login', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'email=a%40b.co&password=x' });
    expect(res.status()).toBe(415);
  });

  test('invalid payloads return 400 with a field path and no stack', async ({ request }) => {
    const cases = [
      ['/api/auth/login', { email: 'nope', password: 'x' }, /email/],
      ['/api/auth/signup', { email: 'a@b.co', password: 'short', first_name: 'A', last_name: 'B', country: 'GB' }, /password/],
      ['/api/auth/signup', { email: 'a@b.co', password: 'longenough', first_name: 'A', last_name: 'B', country: 'GBR' }, /country/],
      ['/api/auth/reset', { email: '' }, /email/],
      ['/api/waitlist', { email: 'a@b.co', source: 'evil' }, /source/],
    ];
    for (const [path, body, re] of cases) {
      const res = await request.post(path, { data: body });
      expect(res.status(), path).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('invalid_input');
      expect(json.message, path).toMatch(re);
      expect(JSON.stringify(json)).not.toMatch(/at .*\.ts/);
    }
  });

  test('protected endpoints need a bearer token (signed-in non-admins get 404 from admin routes)', async ({ request }) => {
    expect((await request.post('/api/proof', { data: { files: [] } })).status()).toBe(401);
    expect((await request.delete('/api/account/delete')).status()).toBe(401);
    expect((await request.post('/api/admin/emails/test', { data: {} })).status()).toBe(401);
  });

  test('proof rejects a second submit while pending or after approval', async ({ browser, request, baseURL }) => {
    async function sessionFor(email) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, email, { baseURL });
      const session = await page.evaluate(async () => {
        const s = (await window.TF.getClient().auth.getSession()).data.session;
        return { token: s.access_token, uid: s.user.id };
      });
      await ctx.close();
      return session;
    }
    const pending = await sessionFor('member-pending@talaria-flow.test');
    const pendingRes = await request.post('/api/proof', {
      headers: { authorization: 'Bearer ' + pending.token },
      data: { files: [{ path: pending.uid + '/incoming/00000000-0000-4000-8000-0000000000aa.png', name: 'x.png' }] },
    });
    expect(pendingRes.status()).toBe(409);
    expect((await pendingRes.json()).error).toBe('already_pending');

    const approved = await sessionFor('member-approved@talaria-flow.test');
    const approvedRes = await request.post('/api/proof', {
      headers: { authorization: 'Bearer ' + approved.token },
      data: { files: [{ path: approved.uid + '/incoming/00000000-0000-4000-8000-0000000000bb.png', name: 'x.png' }] },
    });
    expect(approvedRes.status()).toBe(409);
    expect((await approvedRes.json()).error).toBe('already_approved');
  });

  test('admin cannot re-decide an already-decided submission', async ({ page, request, baseURL }) => {
    await login(page, 'admin@talaria-flow.test', { baseURL });
    const token = await page.evaluate(async () => (await window.TF.getClient().auth.getSession()).data.session.access_token);
    const res = await request.post('/api/admin/submission', {
      headers: { authorization: 'Bearer ' + token },
      data: { action: 'approve', id: 's-00000000-0000-4000-8000-000000000003' },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe('already_decided');
  });

  test('rate limit: the sixth login attempt for the same IP+email is 429', async ({ request }) => {
    const body = { email: `rl-${Date.now()}@example.com`, password: 'whatever1' };
    let last;
    for (let i = 0; i < 6; i++) last = await request.post('/api/auth/login', { data: body });
    expect(last.status()).toBe(429);
    expect((await last.json()).error).toBe('rate_limited');
  });
});
