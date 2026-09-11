/* Browser error reporting to Sentry (envelope API, no SDK). Reads window.__ENV.SENTRY_DSN from env.js;
   does nothing when it is empty. Sends uncaught errors and unhandled rejections only — no PII,
   no breadcrumbs, no session replay. */
(function () {
  var dsn = window.__ENV && window.__ENV.SENTRY_DSN;
  if (!dsn) return;
  var u;
  try { u = new URL(dsn); } catch (e) { return; }
  var projectId = u.pathname.replace(/^\/+/, '').split('/').pop();
  if (!u.username || !projectId) return;
  var endpoint = u.protocol + '//' + u.host + '/api/' + projectId + '/envelope/';
  var sent = 0;

  function id() {
    var s = '';
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }

  function report(err, kind) {
    if (sent >= 10) return;
    sent++;
    var e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Non-error thrown');
    var eventId = id();
    var now = new Date().toISOString();
    var event = {
      event_id: eventId,
      timestamp: now,
      platform: 'javascript',
      level: 'error',
      tags: { runtime: 'browser', kind: kind, lang: document.documentElement.lang || 'en' },
      request: { url: location.origin + location.pathname },
      exception: { values: [{ type: e.name, value: String(e.message).slice(0, 500), stacktrace: e.stack ? { frames: [{ filename: 'stack', function: String(e.stack).slice(0, 2000) }] } : undefined }] }
    };
    var header = { event_id: eventId, sent_at: now, dsn: dsn };
    var body = JSON.stringify(header) + '\n' + JSON.stringify({ type: 'event' }) + '\n' + JSON.stringify(event) + '\n';
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/x-sentry-envelope' }));
      else fetch(endpoint, { method: 'POST', body: body, keepalive: true, headers: { 'content-type': 'application/x-sentry-envelope' } });
    } catch (ignored) {}
  }

  window.addEventListener('error', function (ev) { if (ev.error || ev.message) report(ev.error || ev.message, 'error'); });
  window.addEventListener('unhandledrejection', function (ev) { report(ev.reason, 'unhandledrejection'); });
  window.TF = window.TF || {};
  window.TF.captureException = function (err, kind) { report(err, kind || 'handled'); };
})();
