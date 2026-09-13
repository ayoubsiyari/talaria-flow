import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loginSchema, signupSchema, waitlistSchema, proofFinishSchema, resetSchema, sniffImage, PROOF_MAX_FILES,
} from '../../src/lib/validation.ts';
import { escapeHtml, fillTemplate } from '../../src/lib/escape.ts';
import { rateLimit, RATE_LIMIT, _resetMemory } from '../../src/lib/server/ratelimit.ts';
import { sessionCookie, clearSessionCookie, jwtExpiry } from '../../src/lib/server/session-cookie.ts';

test('login: normalises email and rejects junk', () => {
  const ok = loginSchema.parse({ email: '  Max@Example.COM ', password: 'x' });
  assert.equal(ok.email, 'max@example.com');
  assert.equal(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(200) }).success, false);
});

test('signup: password >= 8, ISO country, names capped', () => {
  const base = { email: 'a@b.co', password: 'longenough', first_name: 'A', last_name: 'B', country: 'GB' };
  assert.equal(signupSchema.safeParse(base).success, true);
  assert.equal(signupSchema.safeParse({ ...base, password: 'short' }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, country: 'gbr' }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, first_name: 'x'.repeat(121) }).success, false);
  assert.equal(signupSchema.parse(base).lang, 'en');
});

test('reset: email required, redirect optional', () => {
  assert.equal(resetSchema.safeParse({ email: '  A@B.co ' }).success, true);
  assert.equal(resetSchema.parse({ email: '  A@B.co ' }).email, 'a@b.co');
  assert.equal(resetSchema.safeParse({ email: 'nope' }).success, false);
});

test('waitlist: source and lang are enums', () => {
  assert.equal(waitlistSchema.safeParse({ email: 'a@b.co', source: 'suite' }).success, true);
  assert.equal(waitlistSchema.safeParse({ email: 'a@b.co', source: 'evil' }).success, false);
  assert.equal(waitlistSchema.safeParse({ email: 'a@b.co', lang: 'fr' }).success, false);
});

test('proof: 2-4 files, own incoming path only, note capped', () => {
  const uid = '11111111-2222-4333-8444-555555555555';
  const file = (ext, id) => ({ path: `${uid}/incoming/${id}.${ext}`, name: 'shot.png' });
  const a = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const b = 'aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff';
  assert.equal(proofFinishSchema.safeParse({ files: [file('png', a)] }).success, false);
  assert.equal(proofFinishSchema.safeParse({ files: [file('png', a), file('jpg', b)] }).success, true);
  assert.equal(proofFinishSchema.safeParse({ resend: true }).success, true);
  assert.equal(proofFinishSchema.safeParse({ resend: false }).success, false);
  assert.equal(proofFinishSchema.safeParse({ files: [] }).success, false);
  assert.equal(proofFinishSchema.safeParse({ files: Array(PROOF_MAX_FILES + 1).fill(file('jpg', a)) }).success, false);
  assert.equal(proofFinishSchema.safeParse({ files: [file('gif', a), file('png', b)] }).success, false);
  assert.equal(proofFinishSchema.safeParse({ files: [{ path: `${uid}/final/x.png`, name: 'x' }, file('png', b)] }).success, false);
  assert.equal(proofFinishSchema.safeParse({ files: [{ path: '../etc/passwd', name: 'x' }, file('png', b)] }).success, false);
  assert.equal(proofFinishSchema.safeParse({ note: 'x'.repeat(1001), files: [file('webp', a), file('png', b)] }).success, false);
});

test('sniffImage: magic bytes decide, not the extension', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.equal(sniffImage(png), 'image/png');
  assert.equal(sniffImage(jpg), 'image/jpeg');
  assert.equal(sniffImage(webp), 'image/webp');
  assert.equal(sniffImage(svg), null);
  assert.equal(sniffImage(new Uint8Array(3)), null);
});

test('escapeHtml / fillTemplate neutralise markup in merge fields', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(fillTemplate('<p>{{ reason }}</p>', { reason: '"><script>1</script>' }), '<p>&quot;&gt;&lt;script&gt;1&lt;/script&gt;</p>');
  assert.equal(fillTemplate('{{missing}}', {}), '');
});

test('rate limit: 5 allowed, 6th blocked, keyed by ip+email', async () => {
  _resetMemory();
  assert.equal(RATE_LIMIT.attempts, 5);
  assert.equal(RATE_LIMIT.windowSeconds, 900);
  for (let i = 0; i < 5; i++) await rateLimit('login', '1.2.3.4', 'a@b.co');
  await assert.rejects(() => rateLimit('login', '1.2.3.4', 'a@b.co'), (e) => e.status === 429);
  await rateLimit('login', '1.2.3.4', 'other@b.co');
  await rateLimit('login', '9.9.9.9', 'a@b.co');
  await assert.rejects(() => rateLimit('login', '1.2.3.4', 'A@B.CO'), (e) => e.status === 429);
});

test('session cookie is HttpOnly, Secure, SameSite=Lax', () => {
  const c = sessionCookie('tok', 3600);
  assert.match(c, /^tf-session=tok; Path=\/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure$/);
  assert.match(clearSessionCookie(), /Max-Age=0/);
  const payload = Buffer.from(JSON.stringify({ exp: 1900000000 })).toString('base64url');
  assert.equal(jwtExpiry(`a.${payload}.b`), 1900000000);
  assert.equal(jwtExpiry('garbage'), null);
});
