/**
 * Email render EN/AR for all nine templates. Uses the same renderer (emails/render.js) and seed rows the
 * server sender (send-template.ts) and the admin preview (public/assets/js/emails-render.js, generated
 * by pnpm build) use.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { templateRows, seedSql } from '../../scripts/seed.ts';

await import('../../emails/render.js');
const { TFEmail } = globalThis;
const specs = JSON.parse(readFileSync(new URL('../../emails/templates.json', import.meta.url), 'utf8'));
const ARABIC = /[\u0600-\u06FF]/;
// Every merge field the nine specs use (emails/README.md); campaigns (08) are entirely merge-driven.
const SAMPLE = {
  email: 'member@example.com', first_name: 'Sam', confirm_url: 'https://x/confirm', token: 't', code: '123456', verify_url: 'https://x/verify',
  device: 'Chrome on Windows', location: 'London, UK', time: '2026-09-09 10:00', submitted_at: '2026-09-09', file_count: '2',
  reason: 'Second screenshot is missing the Simulation label', course_url: 'https://x/course', reset_url: 'https://x/reset',
  subject: 'Hello', preheader: 'Pre', issue_label: 'Issue 1', title: 'Title', intro: 'Intro', body: '<p>Body</p>',
  hero_image_url: 'https://x/h.png', hero_image_alt: 'Hero', section_1_title: 'S1', section_1_body: 'B1', section_2_title: 'S2', section_2_body: 'B2',
  cta_label: 'Open', cta_url: 'https://x', dashboard_url: 'https://x/account/', unsubscribe_url: 'https://x/u', preferences_url: 'https://x/p',
};
const isMerge = (s) => /^\{\{\s*[a-z_]+\s*\}\}$/.test(String(s || ''));
const fill = (html) => html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => SAMPLE[k] ?? `<<${k}>>`);

test('templates.json has the ten templates, each with an Arabic variant', () => {
  assert.equal(specs.length, 10);
  for (const s of specs) {
    assert.match(s.file, /^(0[1-9]|10)-[a-z-]+$/, s.file);
    assert.ok(s.subject && s.title && Array.isArray(s.blocks) && s.blocks.length, `${s.file} en body`);
    assert.ok(s.ar && s.ar.subject && s.ar.title && Array.isArray(s.ar.blocks) && s.ar.blocks.length, `${s.file} ar body`);
    if (!isMerge(s.ar.title)) assert.ok(ARABIC.test(s.ar.title) && ARABIC.test(s.ar.subject), `${s.file} ar copy is Arabic`);
    else assert.ok(ARABIC.test(JSON.stringify(s.ar.blocks)), `${s.file} ar blocks carry Arabic copy`);
  }
});

test('every template renders to a complete HTML document in EN and AR', () => {
  const rows = templateRows(specs);
  assert.equal(rows.length, 20);
  for (const row of rows) {
    const html = fill(TFEmail.render(row.spec, {}));
    assert.ok(html.startsWith('<!doctype html>'), `${row.id}/${row.lang} doctype`);
    assert.ok(html.includes(`<html lang="${row.lang}" dir="${row.lang === 'ar' ? 'rtl' : 'ltr'}">`), `${row.id}/${row.lang} lang/dir`);
    const title = isMerge(row.spec.title) ? SAMPLE.title : row.spec.title;
    if (row.lang === 'ar' && /[A-Za-z]/.test(title)) {
      assert.ok(html.includes('unicode-bidi:isolate'), `${row.id}/ar isolates Latin in mixed copy`);
      assert.ok(ARABIC.test(html), `${row.id}/ar title still has Arabic`);
    } else {
      assert.ok(html.includes(title), `${row.id}/${row.lang} title`);
    }
    assert.ok(html.includes('assets/email-logo-2x.png'), `${row.id}/${row.lang} PNG logo`);
    assert.ok(html.includes('support@talaria-flow.com') && html.includes('not affiliated with'), `${row.id}/${row.lang} footer`);
    assert.ok(!/<<[a-z_]+>>/.test(html), `${row.id}/${row.lang} unknown merge field: ${(html.match(/<<[a-z_]+>>/) || [])[0]}`);
    if (row.lang === 'ar') assert.ok(ARABIC.test(html), `${row.id}/ar renders Arabic copy`);
    if (row.spec.unsubscribe === false) assert.ok(!html.includes('Unsubscribe'), `${row.id} transactional mail has no unsubscribe link`);
    else assert.ok(html.includes('https://x/u'), `${row.id} campaign mail has an unsubscribe link`);
  }
});

test('transactional templates hide the unsubscribe link; campaigns (06, 08, 09) show it', () => {
  for (const s of specs) {
    const campaign = s.kind === 'campaign';
    assert.equal(s.unsubscribe === false, !campaign, `${s.file}: unsubscribe flag`);
    assert.equal(campaign, ['06-course-ready', '08-newsletter', '09-tools-suite-launch'].includes(s.file), `${s.file}: kind`);
  }
});

test('renderer: opts.lang=ar applies the ar overrides, inherits hrefs and isolates Latin runs', () => {
  const spec = specs.find((s) => s.file === '05-needs-resubmission');
  const html = TFEmail.render(spec, { lang: 'ar' });
  assert.ok(html.includes('<html lang="ar" dir="rtl">'));
  assert.ok(html.includes(spec.ar.title));
  assert.ok(html.includes('https://www.talaria-flow.com/account/access/'), 'button href inherited from the English block');
  assert.ok(html.includes("'Cairo'"), 'Arabic font stack');
  assert.ok(html.includes('<td dir="ltr" style="unicode-bidi:isolate;padding:24px 4px 0'), 'footer stays LTR');
  assert.ok(html.includes('dir="ltr"'), 'layout tables stay LTR so Gmail matches the preview');
  const en = TFEmail.render(spec, { lang: 'en' });
  assert.ok(en.includes('<html lang="en" dir="ltr">') && en.includes(spec.title));
  assert.equal(TFEmail.bidi('NinjaTrader'), '<span dir="ltr" style="unicode-bidi:isolate">NinjaTrader</span>');
  assert.ok(TFEmail.blocks.includes('spacer'));
});

test('public/assets/js/emails-render.js is the generated copy of emails/render.js', () => {
  const a = readFileSync(new URL('../../emails/render.js', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../../public/assets/js/emails-render.js', import.meta.url), 'utf8');
  assert.equal(a, b, 'run pnpm build');
});

test('supabase/seed.sql is generated from templates.json and up to date', () => {
  const generated = seedSql(templateRows(specs));
  const committed = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, generated, 'run `pnpm seed -- --sql` and commit supabase/seed.sql');
  assert.ok(generated.includes("select public.set_admin('admin@your-domain.com', true)"));
});
