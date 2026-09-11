import { defineConfig } from '@playwright/test';

/**
 * The suite runs from a fresh clone without a Supabase project: tests/mock-supabase.mjs stands in for
 * GoTrue + PostgREST and the dev server is pointed at it (both the API routes and the browser env.js).
 * Set TEST_REAL_BACKEND=1 with a filled .env to run the same tests against your real project instead.
 */
const MOCK = 'http://127.0.0.1:5099';
const real = process.env.TEST_REAL_BACKEND === '1';

export default defineConfig({
  testDir: './tests',
  testMatch: /\.spec\.js$/, // tests/unit/*.test.mjs belong to node --test
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5051',
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    ...(real ? [] : [{
      command: 'node tests/mock-supabase.mjs',
      url: `${MOCK}/auth/v1/health`,
      reuseExistingServer: true,
      timeout: 30000,
      ignoreHTTPSErrors: true,
    }]),
    {
      // Generated assets (i18n.js, env.js, tutorial, email templates) must exist before the server starts.
      command: real
        ? 'node scripts/build.mjs && node --env-file-if-exists=.env scripts/dev-server.mjs'
        : 'node scripts/build.mjs && node scripts/dev-server.mjs',
      url: 'http://127.0.0.1:5051',
      reuseExistingServer: true,
      timeout: 120000,
      env: real ? {} : {
        SUPABASE_URL: MOCK,
        SUPABASE_ANON_KEY: 'mock-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
        TURNSTILE_SITE_KEY: '',
        TURNSTILE_SECRET_KEY: '',
        SENTRY_DSN: '',
      },
    },
  ],
});
