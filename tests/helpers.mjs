import { MOCK_PASSWORD } from './mock-supabase.mjs';

export const PASSWORD = process.env.TEST_PASSWORD || MOCK_PASSWORD;

let ipSeq = 0;
/**
 * /api/auth/login is limited to 5 attempts per 15 minutes per IP+email (src/lib/server/ratelimit.ts) and
 * the dev server trusts x-forwarded-for exactly like Vercel does. Every browser login in the suite gets
 * its own client IP so the limiter is exercised by security.spec.js only, never tripped by the others.
 */
export function freshClientIp() {
  ipSeq += 1;
  return `10.${(ipSeq >> 16) & 255}.${(ipSeq >> 8) & 255}.${ipSeq & 255}`;
}

export async function login(page, email, { baseURL = '', password = PASSWORD } = {}) {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': freshClientIp() });
  await page.goto(baseURL + '/login/', { waitUntil: 'networkidle' });
  await page.fill('#login-form input[type="email"]', email);
  await page.fill('#login-form input[type="password"]', password);
  await page.click('#login-form button[type="submit"]');
  await page.waitForURL((u) => /\/(account|admin)\//.test(u.pathname), { timeout: 20000 });
}
