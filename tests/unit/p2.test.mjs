import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signSvix, verifySvix, svixHeaders } from '../../src/lib/server/svix.ts';
import { parseDsn, envelopeFor } from '../../src/lib/server/sentry.ts';
import { retentionCutoff, PROOF_RETENTION_DAYS } from '../../src/lib/server/purge.ts';
import { templateIdFrom, EVENT_MAP } from '../../api/webhooks/resend.ts';

const SECRET = 'whsec_' + Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

test('svix: valid signature within tolerance verifies; tampered body, stale timestamp and wrong secret fail', async () => {
  const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'x' } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await signSvix(SECRET, 'msg_1', ts, body);
  const headers = { id: 'msg_1', timestamp: ts, signature: `v1,garbage ${sig}` };
  assert.equal(await verifySvix(SECRET, headers, body), true);
  assert.equal(await verifySvix(SECRET, headers, body + ' '), false);
  assert.equal(await verifySvix(SECRET, { ...headers, timestamp: String(Number(ts) - 3600) }, body), false);
  assert.equal(await verifySvix('whsec_' + Buffer.from('another-secret-another-secret!!').toString('base64'), headers, body), false);
  assert.equal(await verifySvix('', headers, body), false);
  assert.equal(await verifySvix(SECRET, { id: null, timestamp: ts, signature: sig }, body), false);
});

test('svix: reads svix-* and webhook-* header names', () => {
  const req = new Request('http://x', { headers: { 'svix-id': 'a', 'svix-timestamp': '1', 'svix-signature': 'v1,b' } });
  assert.deepEqual(svixHeaders(req), { id: 'a', timestamp: '1', signature: 'v1,b' });
});

test('resend webhook: template id from array or object tags, unknown events ignored', () => {
  assert.equal(templateIdFrom([{ name: 'template_id', value: '04-approved' }]), '04-approved');
  assert.equal(templateIdFrom({ template_id: '05-needs-resubmission' }), '05-needs-resubmission');
  assert.equal(templateIdFrom(undefined), 'unknown');
  assert.equal(EVENT_MAP['email.bounced'], 'bounced');
  assert.equal(EVENT_MAP['email.sent'], undefined);
});

test('sentry: dsn parsing and envelope shape', () => {
  const dsn = parseDsn('https://abc123@o1.ingest.sentry.io/456');
  assert.deepEqual(dsn, { publicKey: 'abc123', host: 'o1.ingest.sentry.io', projectId: '456', protocol: 'https' });
  assert.equal(parseDsn(''), null);
  assert.equal(parseDsn('not a url'), null);
  const { url, body } = envelopeFor(dsn, new Error('boom'), { route: '/api/x' });
  assert.equal(url, 'https://o1.ingest.sentry.io/api/456/envelope/');
  const [header, item, event] = body.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(item.type, 'event');
  assert.equal(header.event_id, event.event_id);
  assert.equal(event.exception.values[0].value, 'boom');
  assert.equal(event.extra.route, '/api/x');
});

test('purge: cutoff is exactly 90 days before now', () => {
  const now = new Date('2026-12-31T00:00:00Z');
  assert.equal(PROOF_RETENTION_DAYS, 90);
  assert.equal(retentionCutoff(now), '2026-10-02T00:00:00.000Z');
});
