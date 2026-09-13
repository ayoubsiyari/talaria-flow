import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickRecipients, prefAllows, latestStatusByUser, audienceLabel, isCampaignTemplate, firstNameOf } from '../../src/lib/server/campaigns.ts';
import { signUnsubscribe, verifyUnsubscribe, unsubscribeUrl, parseUnsubscribe, unsubscribeKindFor } from '../../src/lib/server/unsubscribe.ts';
import { clientIp } from '../../src/lib/server/http.ts';
import { adminCampaignSchema, adminDecisionSchema, adminTestEmailSchema, waitlistSchema } from '../../src/lib/validation.ts';

const U = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const profiles = [
  { id: U(1), email: 'Admin@x.test', lang: 'en', first_name: 'Ada', name: 'Ada Admin', is_admin: true, notify: { course: true, newsletter: true, tools: false } },
  { id: U(2), email: 'pending@x.test', lang: 'en', first_name: null, name: 'Pia Pending', notify: { course: true, newsletter: false, tools: true } },
  { id: U(3), email: 'approved@x.test', lang: 'ar', first_name: 'Amir', notify: { course: false, newsletter: true, tools: true } },
  { id: U(4), email: 'rejected@x.test', lang: 'en', first_name: 'Rita', notify: null },
  { id: U(5), email: 'new@x.test', lang: 'en', first_name: 'Noor', notify: {} },
];
const submissions = [
  { user_id: U(2), status: 'submitted', created_at: '2026-02-01T00:00:00Z' },
  { user_id: U(3), status: 'rejected', created_at: '2026-01-01T00:00:00Z' },
  { user_id: U(3), status: 'approved', created_at: '2026-02-01T00:00:00Z' },
  { user_id: U(4), status: 'rejected', created_at: '2026-02-01T00:00:00Z' },
];
const waitlist = [{ email: 'w1@x.test', lang: 'en' }, { email: 'w2@x.test', lang: 'ar' }, { email: 'approved@x.test', lang: 'en' }];
const emails = (rs) => rs.map((r) => r.email).sort();

test('campaign prefs: 06 -> course, 08 -> newsletter, 09 -> tools; missing key or null notify opts in', () => {
  assert.equal(unsubscribeKindFor('06-course-ready'), 'course');
  assert.equal(unsubscribeKindFor('08'), 'newsletter');
  assert.equal(unsubscribeKindFor('09-tools-suite-launch'), 'tools');
  assert.equal(unsubscribeKindFor('04-approved'), null);
  assert.equal(prefAllows({ course: false }, '06-course-ready'), false);
  assert.equal(prefAllows({ course: false }, '08-newsletter'), true);
  assert.equal(prefAllows(null, '09'), true);
  assert.equal(prefAllows({}, '09'), true);
  assert.equal(prefAllows({ tools: false }, '04-approved'), true, 'transactional templates ignore prefs');
});

test('campaign resolver: latest submission decides status; audience/lang/prefs filter; dedupe by email', () => {
  assert.equal(latestStatusByUser(submissions).get(U(3)), 'approved');
  const q = (o) => ({ templateId: '06-course-ready', audience: 'approved', lang: 'all', ...o });
  // approved: only U(3) — but course pref is off
  assert.deepEqual(emails(pickRecipients({ profiles, submissions, waitlist }, q({}))), []);
  assert.deepEqual(emails(pickRecipients({ profiles, submissions, waitlist }, q({ templateId: '08-newsletter' }))), ['approved@x.test']);
  // none = members without a submission (admins are skipped on audience sends), newsletter prefs apply
  assert.deepEqual(emails(pickRecipients({ profiles, submissions, waitlist }, q({ templateId: '08', audience: 'none' }))), ['new@x.test']);
  // all + tools: admin has tools:false, rejected has notify null (opted in), new has {} (opted in)
  assert.deepEqual(emails(pickRecipients({ profiles, submissions, waitlist }, q({ templateId: '09', audience: 'all' }))), ['approved@x.test', 'new@x.test', 'pending@x.test', 'rejected@x.test']);
  // EN/AR force the email language for everyone; they do not shrink the audience
  const arMail = pickRecipients({ profiles, submissions, waitlist }, q({ templateId: '09', audience: 'all', lang: 'ar' }));
  assert.deepEqual(emails(arMail), ['approved@x.test', 'new@x.test', 'pending@x.test', 'rejected@x.test']);
  assert.ok(arMail.every((r) => r.lang === 'ar'));
  const enMail = pickRecipients({ profiles, submissions, waitlist }, q({ templateId: '09', audience: 'all', lang: 'en' }));
  assert.ok(enMail.every((r) => r.lang === 'en'));
  // rejected + course
  assert.deepEqual(emails(pickRecipients({ profiles, submissions, waitlist }, q({ audience: 'rejected' }))), ['rejected@x.test']);
  // waitlist ignores prefs; lang all keeps each row's language, AR forces Arabic
  assert.deepEqual(emails(pickRecipients({ profiles, submissions, waitlist }, q({ audience: 'waitlist' }))), ['approved@x.test', 'w1@x.test', 'w2@x.test']);
  const waitAr = pickRecipients({ profiles, submissions, waitlist }, q({ audience: 'waitlist', lang: 'ar' }));
  assert.deepEqual(emails(waitAr), ['approved@x.test', 'w1@x.test', 'w2@x.test']);
  assert.ok(waitAr.every((r) => r.lang === 'ar'));
  // skipRecent drops addresses mailed in the last 24h
  const recentEmails = new Set(['w1@x.test']);
  assert.deepEqual(emails(pickRecipients({ profiles, submissions, waitlist, recentEmails }, q({ audience: 'waitlist', skipRecent: true }))), ['approved@x.test', 'w2@x.test']);
  // memberIds pins the list and ignores notification prefs (admin chose these people)
  const picked = pickRecipients({ profiles, submissions, waitlist }, q({ templateId: '08', audience: 'approved', memberIds: [U(1), U(2), U(4)] }));
  assert.deepEqual(emails(picked), ['admin@x.test', 'pending@x.test', 'rejected@x.test']);
  assert.equal(picked[0].firstName, 'Ada');
  assert.equal(firstNameOf(profiles[1]), 'Pia');
  assert.equal(audienceLabel({ audience: 'approved', lang: 'en' }), 'Approved members · EN');
  assert.equal(audienceLabel({ audience: 'all', lang: 'all', memberIds: [U(1)] }), 'Selected members (1)');
  assert.equal(isCampaignTemplate('06'), true);
  assert.equal(isCampaignTemplate('04-approved'), false);
});

test('unsubscribe: signature verifies, rejects tampering, wrong key and bad params', () => {
  const key = 'service-role-secret';
  const member = { kind: 'course', memberId: U(3) };
  const t = signUnsubscribe(member, key);
  assert.match(t, /^[0-9a-f]{40}$/);
  assert.equal(verifyUnsubscribe(member, t, key), true);
  assert.equal(verifyUnsubscribe({ kind: 'newsletter', memberId: U(3) }, t, key), false, 'kind is part of the payload');
  assert.equal(verifyUnsubscribe({ kind: 'course', memberId: U(4) }, t, key), false);
  assert.equal(verifyUnsubscribe(member, t.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')), key), false);
  assert.equal(verifyUnsubscribe(member, t, 'other-key'), false);
  assert.equal(verifyUnsubscribe(member, '', key), false);
  assert.equal(signUnsubscribe(member, ''), null);
  assert.equal(signUnsubscribe({ kind: 'nope', memberId: U(3) }, key), null);

  const url = unsubscribeUrl('https://www.talaria-flow.com/', member, key);
  const u = new URL(url);
  assert.equal(u.pathname, '/api/unsubscribe');
  assert.deepEqual(parseUnsubscribe(u.searchParams, key), member);
  u.searchParams.set('k', 'tools');
  assert.equal(parseUnsubscribe(u.searchParams, key), null);

  const wl = unsubscribeUrl('https://x', { kind: 'waitlist', email: 'W1@X.test' }, key);
  const w = new URL(wl);
  assert.equal(w.searchParams.get('e'), 'w1@x.test');
  assert.deepEqual(parseUnsubscribe(w.searchParams, key), { kind: 'waitlist', email: 'w1@x.test' });
  assert.equal(parseUnsubscribe(new URLSearchParams('m=not-a-uuid&k=course&t=abc'), key), null);
  assert.equal(parseUnsubscribe(new URLSearchParams(''), key), null);
});

test('clientIp: x-vercel-forwarded-for, then x-real-ip, then right-most public x-forwarded-for', () => {
  const ip = (h) => clientIp(new Request('http://x', { headers: h }));
  assert.equal(ip({ 'x-vercel-forwarded-for': '203.0.113.9', 'x-forwarded-for': '1.1.1.1' }), '203.0.113.9');
  assert.equal(ip({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }), '198.51.100.7');
  assert.equal(ip({ 'x-forwarded-for': '1.1.1.1, 203.0.113.5, 10.0.0.1' }), '203.0.113.5', 'spoofed left-most and private right-most are skipped');
  assert.equal(ip({ 'x-forwarded-for': '10.0.0.7' }), '10.0.0.7', 'all-private chain (local dev / Playwright) keeps the right-most hop');
  assert.equal(ip({ 'x-forwarded-for': '10.0.0.1, 192.168.1.4' }), '192.168.1.4');
  assert.equal(ip({ 'cf-connecting-ip': '203.0.113.1' }), '203.0.113.1');
  assert.equal(ip({}), '0.0.0.0');
});

test('admin schemas: decision needs a reason when rejecting; campaigns union; test send accepts id or spec', () => {
  assert.equal(adminDecisionSchema.safeParse({ action: 'approve', id: U(2) }).success, true);
  assert.equal(adminDecisionSchema.safeParse({ action: 'reject', id: U(2) }).success, false);
  assert.equal(adminDecisionSchema.safeParse({ action: 'reject', id: U(2), reason: '  ' }).success, false);
  assert.equal(adminDecisionSchema.safeParse({ action: 'resubmit', id: U(2) }).success, false);
  assert.equal(adminDecisionSchema.safeParse({ action: 'resubmit', id: U(2), reason: 'Blurry' }).success, true);
  assert.equal(adminDecisionSchema.safeParse({ action: 'resubmit', id: U(2), reason: 'Blurry', lang: 'ar' }).success, true);
  assert.equal(adminDecisionSchema.safeParse({ action: 'reject', id: U(2), reason: 'No', lang: 'en' }).success, true);
  assert.equal(adminDecisionSchema.safeParse({ action: 'reject', id: U(2), reason: 'No', lang: 'fr' }).success, false);
  assert.equal(adminDecisionSchema.safeParse({ action: 'restore', id: U(2) }).success, true);
  assert.equal(adminDecisionSchema.safeParse({ action: 'reject', id: U(2), reason: 'x'.repeat(601) }).success, false);
  assert.equal(adminDecisionSchema.safeParse({ action: 'approve', id: `s-${U(2)}` }).success, true, 'mock fixture ids are accepted; unknown ids 404 server-side');
  assert.equal(adminDecisionSchema.safeParse({ action: 'approve', id: '' }).success, false);
  assert.equal(adminDecisionSchema.safeParse({ action: 'approve' }).success, false);

  const create = adminCampaignSchema.parse({ action: 'create', templateId: '06', audience: 'approved' });
  assert.equal(create.lang, 'all');
  assert.equal(create.skipRecent, false);
  assert.equal(adminCampaignSchema.safeParse({ action: 'create', templateId: '04-approved', audience: 'approved' }).success, true);
  assert.equal(adminCampaignSchema.safeParse({ action: 'create', templateId: 'custom-launch', audience: 'all' }).success, true);
  assert.equal(adminCampaignSchema.safeParse({ action: 'create', templateId: '../secret', audience: 'approved' }).success, false);
  assert.equal(adminCampaignSchema.safeParse({ action: 'create', templateId: '08-newsletter', audience: 'everyone' }).success, false);
  assert.equal(adminCampaignSchema.safeParse({ action: 'create', templateId: '08-newsletter', audience: 'all', scheduledFor: 'tomorrow' }).success, false);
  assert.equal(adminCampaignSchema.safeParse({ action: 'create', templateId: '08-newsletter', audience: 'all', scheduledFor: '2026-12-01T09:00:00Z', memberIds: [U(1)] }).success, true);
  assert.equal(adminCampaignSchema.safeParse({ action: 'count', audience: 'waitlist' }).success, true);
  assert.equal(adminCampaignSchema.safeParse({ action: 'cancel', id: 'abc' }).success, true);
  assert.equal(adminCampaignSchema.safeParse({ action: 'run-due' }).success, true);
  assert.equal(adminCampaignSchema.safeParse({ action: 'explode' }).success, false);

  assert.equal(adminTestEmailSchema.safeParse({ id: '04-approved', to: 'a@b.co' }).success, true);
  assert.equal(adminTestEmailSchema.safeParse({ to: 'a@b.co' }).success, false);
  assert.equal(adminTestEmailSchema.safeParse({ spec: { subject: 'S', title: 'T', blocks: [{ type: 'p', text: 'x' }] }, lang: 'ar', to: 'a@b.co' }).success, true);
  assert.equal(waitlistSchema.parse({ email: ' Someone@Example.COM ' }).email, 'someone@example.com');
});
