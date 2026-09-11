/** Server-only environment access. Never import this from browser code. */

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  get siteUrl() { return (process.env.SITE_URL || 'https://www.talaria-flow.com').replace(/\/+$/, ''); },
  get supabaseUrl() { return need('SUPABASE_URL').replace(/\/+$/, ''); },
  get supabaseAnonKey() { return need('SUPABASE_ANON_KEY'); },
  get supabaseServiceRoleKey() { return need('SUPABASE_SERVICE_ROLE_KEY'); },
  get turnstileSecret() { return process.env.TURNSTILE_SECRET_KEY || ''; },
  get resendApiKey() { return process.env.RESEND_API_KEY || ''; },
  get resendFrom() { return process.env.RESEND_FROM || 'Talaria Flow <support@talaria-flow.com>'; },
  get resendWebhookSecret() { return process.env.RESEND_WEBHOOK_SECRET || ''; },
  get cronSecret() {
    const v = process.env.CRON_SECRET || '';
    if (!v && this.failClosed) throw new Error('Missing environment variable CRON_SECRET');
    return v;
  },
  get sentryDsn() { return process.env.SENTRY_DSN || ''; },
  get redisUrl() { return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || ''; },
  get redisToken() { return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''; },
  get isProduction() { return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'; },
  /** Any Vercel deploy (production, preview, development) plus NODE_ENV=production. Local `pnpm start` stays fail-open. */
  get failClosed() { return Boolean(process.env.VERCEL_ENV || process.env.VERCEL) || process.env.NODE_ENV === 'production'; },
};
