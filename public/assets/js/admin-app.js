(function () {
  window.TF = window.TF || {};

  var SELECTED_KEY = 'TF_ADMIN_SELECTED';
  var COLORS = { submitted: '#FBBF24', approved: '#2EE8FF', rejected: '#FF8AD0', blocked: '#FF37B0', none: '#8B90A3', scheduled: '#2EE8FF', sending: '#FBBF24', sent: '#B7BCCB', failed: '#FF8AD0', cancelled: '#7C8296' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var TPL_META = [
    { id: '01', file: '01-confirm-email', name: 'Confirm your email', kind: 'auto', trigger: 'Auth: signup', subject: 'Confirm your email' },
    { id: '02', file: '02-signup-code', name: 'Sign-in code', kind: 'auto', trigger: 'Auth: OTP', subject: 'Your sign-in code' },
    { id: '03', file: '03-submission-received', name: 'Submission received', kind: 'auto', trigger: 'On upload', subject: 'We received your proof' },
    { id: '04', file: '04-approved', name: 'Approved', kind: 'auto', trigger: 'Status → approved', subject: 'Approved — you are in' },
    { id: '05', file: '05-needs-resubmission', name: 'Needs resubmission', kind: 'auto', trigger: 'Status → resubmit', subject: 'We need a clearer screenshot' },
    { id: '10', file: '10-application-rejected', name: 'Application rejected', kind: 'auto', trigger: 'Status → blocked', subject: 'We cannot approve your application' },
    { id: '06', file: '06-course-ready', name: 'Course ready', kind: 'campaign', trigger: 'Manual / scheduled', subject: 'Your course is ready' },
    { id: '07', file: '07-password-reset', name: 'Password reset', kind: 'auto', trigger: 'Auth: reset', subject: 'Your password reset code' },
    { id: '08', file: '08-newsletter', name: 'Newsletter', kind: 'campaign', trigger: 'Manual / scheduled', subject: 'Talaria Flow — this week in order flow' },
    { id: '09', file: '09-tools-suite-launch', name: 'Tools suite launch', kind: 'campaign', trigger: 'Manual / scheduled', subject: 'The Talaria Flow tools suite is live' },
  ];
  var S = {
    q: '',
    qInput: '',
    sort: 'submitted',
    dir: -1,
    focus: '',
    tpl: '06',
    subject: '',
    audience: 'approved',
    langF: 'all',
    skipRecent: false,
    when: 'now',
    date: '',
    time: '09:00',
    pv: 'en',
    reason: '',
    selected: new Set(),
    previewHtml: '',
    dlg: null,
    dlgOpener: '',
    note: '',
    actFilter: 'all',
    calOpen: false,
    clkOpen: false,
    calView: '',
    previewSubject: '',
    routeKey: '',
    count: null,
    countKey: '',
    countError: '',
    busy: false,
  };
  // Everything below is loaded from Supabase (RLS) or the admin API; nothing is seeded.
  var members = [];
  var waitlist = [];
  var sends = [];
  var activity = [];
  var tplStats = {};
  var lastEmailByRecipient = {};
  var loadErrors = {};
  var loaded = false;
  var qTimer = null;
  var countTimer = null;
  var countSeq = 0;
  var mounted = false;
  var ranDue = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
  function toast(msg, kind) {
    msg = String(msg || '').trim();
    if (!msg) return;
    kind = kind === 'error' || kind === 'wait' ? kind : 'ok';
    var el = document.querySelector('[data-admin-toast]');
    if (!el) {
      el = document.createElement('div');
      el.setAttribute('data-admin-toast', '');
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.setAttribute('data-kind', kind);
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('is-on'); }, kind === 'wait' ? 8000 : 4200);
  }
  window.tfToast = toast;
  var rowMenuEl = null;
  function closeRowMenu() {
    if (rowMenuEl) { rowMenuEl.remove(); rowMenuEl = null; }
  }
  function menuIcon(kind) {
    var icons = {
      open: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="5" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="19" cy="12" r="1.2"></circle></svg>',
      approve: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"></path></svg>',
      resubmit: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"></path></svg>',
      reject: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>',
      restore: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0"></path></svg>',
      email: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>',
      history: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l3 2"></path></svg>',
    };
    return icons[kind] || '';
  }
  function menuItem(act, id, label, kind, color) {
    return '<button type="button" role="menuitem" data-act="' + act + '" data-id="' + esc(id) + '" style="color:' + (color || '#F2F4F8') + '">' + menuIcon(kind) + '<span>' + esc(label) + '</span></button>';
  }
  function openRowMenu(btn) {
    var id = elId(btn);
    var m = members.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!m) return;
    closeRowMenu();
    var menu = document.createElement('div');
    menu.setAttribute('data-admin-row-menu', '');
    menu.setAttribute('role', 'menu');
    var html = '';
    html += menuItem('open', m.id, 'View details', 'open');
    if (m.submissionId && m.status === 'submitted') html += menuItem('row-approve', m.id, 'Approve', 'approve', '#2EE8FF');
    if (m.status === 'submitted' || m.status === 'rejected') {
      html += menuItem('row-reject', m.id, 'Request resubmission', 'resubmit', '#FF8AD0');
      html += menuItem('row-block', m.id, 'Reject', 'reject', '#FF37B0');
    }
    if (m.status === 'blocked') html += menuItem('row-restore', m.id, 'Restore access', 'restore', '#2EE8FF');
    html += menuItem('row-email', m.id, 'Send email', 'email');
    html += menuItem('email-hist', m.id, 'Email history', 'history');
    menu.innerHTML = html;
    document.body.appendChild(menu);
    var r = btn.getBoundingClientRect();
    var mw = 200;
    var left = Math.min(Math.max(8, r.right - mw), window.innerWidth - mw - 8);
    var top = r.bottom + 6;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    var box = menu.getBoundingClientRect();
    if (box.bottom > window.innerHeight - 8) {
      menu.style.top = Math.max(8, r.top - box.height - 6) + 'px';
    }
    rowMenuEl = menu;
  }
  function elId(el) {
    return el && el.getAttribute ? (el.getAttribute('data-id') || '') : '';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    if (/[A-Za-z]/.test(iso) && iso.indexOf('T') === -1) return iso;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var h = d.getHours();
    var m = d.getMinutes();
    var time = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' ' + time;
  }
  function fmtDay(iso) {
    if (!iso) return '—';
    if (/[A-Za-z]/.test(iso) && iso.indexOf('T') === -1) return String(iso).replace(/ \d{2}:\d{2}$/, '');
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function ageOf(submitted) {
    if (!submitted || submitted === '—') return '—';
    var d = new Date(submitted);
    if (isNaN(d.getTime())) return '—';
    var days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 day';
    return days + ' days';
  }
  function initialsOf(m) {
    var first = String((m && (m.firstName || m.first_name)) || '').trim();
    var last = String((m && (m.lastName || m.last_name)) || '').trim();
    if (first && last) return (first.charAt(0) + last.charAt(0)).toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    var email = String((m && m.email) || '');
    var letters = email.replace(/[^a-zA-Z]/g, '');
    return (letters.slice(0, 2) || email.slice(0, 2) || '??').toUpperCase();
  }
  function classifyActivity(a) {
    var text = String((a && a.text) || '').toLowerCase();
    var kind = (a && a.kind) || '';
    var filter = (a && a.filter) || '';
    if (!kind) {
      if (/approv/.test(text)) { kind = 'Approved'; filter = filter || 'review'; }
      else if (/resubmit|reject/.test(text)) { kind = 'Rejected'; filter = filter || 'review'; }
      else if (/upload|file/.test(text)) { kind = 'Upload'; filter = filter || 'review'; }
      else if (/waitlist/.test(text)) { kind = 'Waitlist'; filter = filter || 'signup'; }
      else if (/sign[- ]?up|signed up/.test(text)) { kind = 'Sign-up'; filter = filter || 'signup'; }
      else if (/sent|schedul|email|campaign/.test(text)) { kind = 'Email'; filter = filter || 'email'; }
      else { kind = 'Upload'; filter = filter || 'review'; }
    }
    if (!filter) {
      if (kind === 'Approved' || kind === 'Rejected' || kind === 'Upload') filter = 'review';
      else if (kind === 'Sign-up' || kind === 'Waitlist') filter = 'signup';
      else if (kind === 'Email') filter = 'email';
      else filter = 'review';
    }
    var color = (a && a.color) || (
      kind === 'Approved' ? '#2EE8FF' :
      kind === 'Rejected' ? '#FF8AD0' :
      kind === 'Upload' ? '#FBBF24' :
      kind === 'Email' ? '#B7BCCB' : '#8B90A3'
    );
    return { color: color, text: a && a.text, when: a && a.when, kind: kind, filter: filter };
  }
  function parseLooseDate(s) {
    if (!s || s === '—') return null;
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    var m = String(s).match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (!m) return null;
    var months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    if (months[m[2]] == null) return null;
    d = new Date(parseInt(m[3], 10), months[m[2]], parseInt(m[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  function isTodayDate(s) {
    var d = parseLooseDate(s);
    if (!d) return false;
    var n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  function inLastDays(s, days) {
    var d = parseLooseDate(s);
    if (!d) return false;
    var diff = Date.now() - d.getTime();
    return diff >= 0 && diff < days * 86400000;
  }
  function trendLabel(n, unit) {
    return n > 0 ? '+' + n + ' ' + unit : '';
  }
  function cardHead(color, title, count, action) {
    return '<header class="tf-card-h"><span class="tf-card-title"><span class="tf-dot" style="background:' + color + '"></span><h2>' + title + '</h2>' +
      (count == null || count === '' ? '' : '<span class="tf-card-count">' + count + '</span>') + '</span>' + (action || '') + '</header>';
  }
  function emptyRow(text, cols) {
    return '<tr><td colspan="' + cols + '"><div class="tf-empty" data-empty>' + esc(text) + '</div></td></tr>';
  }
  function errorLine(key) {
    var msg = loadErrors[key];
    if (!msg) return '';
    return '<div data-load-error="' + esc(key) + '" role="alert" style="padding:10px 18px;border-bottom:1px solid rgba(255,138,208,0.25);background:rgba(255,138,208,0.06);color:#FF8AD0;font-size:13px">' + esc(msg) + '</div>';
  }
  function apiMessage(res, fallback) {
    var b = (res && res.body) || {};
    return b.message || b.error || fallback || 'Request failed.';
  }
  function fail(key, message) {
    loadErrors[key] = message;
    toast(message);
  }
  // EmailSend row from the API -> table row model.
  function sendRow(row) {
    row = row || {};
    var count = row.recipient_count || 0;
    var sent = row.sent_count || 0;
    var opened = row.opened_count || 0;
    var progress;
    if (row.state === 'scheduled') progress = '—';
    else if (row.state === 'cancelled') progress = 'cancelled';
    else if (row.state === 'failed') progress = sent + '/' + count + ' · failed';
    else progress = sent + '/' + count + (opened ? ' · ' + opened + ' opened' : '');
    return {
      id: row.id,
      state: row.state || 'sent',
      template: row.template_name || row.template_id || '—',
      audience: typeof row.audience === 'string' ? row.audience : (row.audience && row.audience.label) || '—',
      count: count,
      sent: sent,
      opened: opened,
      progress: progress,
      when: fmtDate(row.state === 'scheduled' ? row.scheduled_for : (row.finished_at || row.scheduled_for || row.created_at)),
      scheduledFor: row.scheduled_for || null,
      templateId: row.template_id,
      subject: row.subject || '',
      lang: row.lang || 'all',
      note: row.note || '',
      error: row.error || '',
      raw: row,
    };
  }
  var adminStats = null;
  function countsOf() {
    var fromRows = {
      pending: members.filter(function (m) { return m.status === 'submitted'; }).length,
      approved: members.filter(function (m) { return m.status === 'approved'; }).length,
      rejected: members.filter(function (m) { return m.status === 'rejected'; }).length,
      blocked: members.filter(function (m) { return m.status === 'blocked'; }).length,
      none: members.filter(function (m) { return m.status === 'none'; }).length,
      total: members.length,
      waitlist: waitlist.length,
      scheduled: sends.filter(function (s) { return s.state === 'scheduled'; }).length,
      emails: templates().length,
    };
    var s = adminStats;
    if (!s || Number(s.pending) < fromRows.pending) return fromRows;
    return {
      pending: Number(s.pending) || 0,
      approved: Number(s.approved) || 0,
      rejected: Number(s.resubmission != null ? s.resubmission : s.rejected) || 0,
      blocked: Number(s.blocked != null ? s.blocked : fromRows.blocked) || 0,
      none: Number(s.no_proof != null ? s.no_proof : s.none) || 0,
      total: Number(s.total) || 0,
      waitlist: Number(s.waitlist) || 0,
      scheduled: Number(s.scheduled) || 0,
      emails: templates().length,
    };
  }
  async function loadStats() {
    var res = await window.TF.api('/api/admin/stats');
    if (res.ok && res.body && res.body.pending != null) adminStats = res.body;
  }
  window.TF.getAdminSummary = async function () {
    if (!adminStats) {
      try { await loadStats(); } catch (e) { /* paint still uses last known counts */ }
    }
    if (!loaded) await loadLive();
    return countsOf();
  };

  function parseRoute() {
    var p = location.pathname.replace(/\/+$/, '') || '/';
    var q = new URLSearchParams(location.search);
    if (/\/admin\/members/.test(p)) return Object.assign({ view: 'members', tab: 'compose' }, fromQuery(q));
    if (/\/admin\/campaigns\/history/.test(p)) return Object.assign({ view: 'campaigns', tab: 'history' }, fromQuery(q));
    if (/\/admin\/campaigns/.test(p)) return Object.assign({ view: 'campaigns', tab: 'compose' }, fromQuery(q));
    if (/\/admin\/emails\/history/.test(p)) return Object.assign({ view: 'campaigns', tab: 'history' }, fromQuery(q));
    if (/\/admin\/emails/.test(p)) return Object.assign({ view: 'emails', tab: 'templates' }, fromQuery(q));
    if (/\/admin\/waitlist/.test(p)) return { view: 'waitlist', tab: 'compose' };
    return { view: 'overview', tab: 'compose' };
  }
  function fromQuery(q) {
    var selected = readSelected();
    var filter = q.get('status') || q.get('filter') || 'all';
    if (filter === 'pending') filter = 'submitted';
    return {
      filter: filter,
      q: q.get('q') || '',
      sort: q.get('sort') || 'submitted',
      dir: q.get('dir') === 'asc' ? 1 : -1,
      focus: q.get('id') || '',
      tpl: q.get('tpl') || '',
      audience: q.get('audience') || '',
    };
  }
  function readSelected() {
    try { return JSON.parse(sessionStorage.getItem(SELECTED_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeSelected(set) {
    try { sessionStorage.setItem(SELECTED_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
  }
  function applyRoute(extra) {
    extra = extra || {};
    var route = parseRoute();
    S.q = extra.q != null ? extra.q : (route.q || S.q);
    S.qInput = S.q;
    S.sort = extra.sort || route.sort || S.sort;
    S.dir = extra.dir != null ? extra.dir : (route.dir != null ? route.dir : S.dir);
    S.focus = extra.focus != null ? extra.focus : (route.focus || S.focus);
    // ?tpl= / ?audience= seed the compose form once per URL; later picker changes must win over the query.
    var routeKey = location.pathname + location.search;
    if (routeKey !== S.routeKey) {
      S.routeKey = routeKey;
      if (route.tpl) S.tpl = route.tpl;
      if (route.audience) S.audience = route.audience;
    }
    if (extra.tpl) S.tpl = extra.tpl;
    if (extra.audience) S.audience = extra.audience;
    S.filter = extra.filter || route.filter || 'all';
    if (route.view === 'campaigns' && S.audience === 'selected') S.audience = 'approved';
    var stored = readSelected();
    S.selected = new Set(stored);
    if (S.focus && !members.some(function (m) { return String(m.id) === String(S.focus); }) && members[0]) {
      S.focus = members[0].id;
    }
    if (!S.focus && members[0]) S.focus = members[0].id;
  }
  function closePickers() {
    S.calOpen = false;
    S.clkOpen = false;
  }
  function go(path) {
    closePickers();
    if (window.TF.navigate) window.TF.navigate(path);
    else location.href = path;
  }
  function openDlg(ids, opener) {
    ids = (ids || []).map(String).filter(Boolean);
    if (!ids.length) { toast('Select at least one member.'); return; }
    S.dlg = ids;
    S.dlgOpener = opener ? selectorFor(opener) : '';
    S.tpl = '06';
    S.subject = '';
    S.note = '';
    S.when = 'now';
    closePickers();
    paint();
  }
  // The page is re-rendered from strings, so focus is restored by selector, not by element reference.
  function selectorFor(el) {
    if (!el || !el.getAttribute) return '';
    var act = el.getAttribute('data-act');
    if (!act) return '';
    var sel = '[data-act="' + act + '"]';
    ['data-id', 'data-pv', 'data-when', 'data-filter', 'data-audience', 'data-langf', 'data-tpl', 'data-sort'].forEach(function (a) {
      var v = el.getAttribute(a);
      if (v != null) sel += '[' + a + '="' + String(v).replace(/"/g, '\\"') + '"]';
    });
    return sel;
  }
  function focusables(root) {
    if (!root) return [];
    return Array.prototype.filter.call(
      root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null || el === document.activeElement; }
    );
  }
  // Tab / Shift+Tab stay inside `root`; returns an unbind function.
  function trapFocus(root) {
    function onKey(e) {
      if (e.key !== 'Tab') return;
      var list = focusables(root);
      if (!list.length) { e.preventDefault(); return; }
      var first = list[0];
      var last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
    root.addEventListener('keydown', onKey);
    return function () { root.removeEventListener('keydown', onKey); };
  }
  function focusFirst(root) {
    var list = focusables(root);
    var target = list.filter(function (el) { return el.tagName !== 'IFRAME' && el.getAttribute('data-act') !== 'dlg-close'; })[0] || list[0];
    if (target) target.focus();
  }
  function membersUrl(extra) {
    extra = extra || {};
    var filter = extra.filter != null ? extra.filter : S.filter;
    var q = extra.q != null ? extra.q : S.q;
    var sort = extra.sort || S.sort;
    var dir = extra.dir != null ? extra.dir : S.dir;
    var id = extra.focus != null ? extra.focus : S.focus;
    var p = new URLSearchParams();
    if (filter && filter !== 'all') p.set('status', filter);
    if (q) p.set('q', q);
    if (sort && sort !== 'submitted') p.set('sort', sort);
    if (dir > 0) p.set('dir', 'asc');
    if (id) p.set('id', id);
    var qs = p.toString();
    return '/admin/members/' + (qs ? '?' + qs : '');
  }

  function defaultSubjectOf(t, lang) {
    var row = window.TF.getEmailTemplate && window.TF.getEmailTemplate(t.file || t.id);
    var spec = (row && row.spec) || {};
    var ar = (spec && spec.ar) || (row && row.spec_ar);
    if (lang === 'ar' && ar && ar.subject) return ar.subject;
    return (spec && spec.subject) || t.subject || '';
  }
  function campaignSendLang() {
    if (S.pv === 'ar') return 'ar';
    if (S.langF === 'en' || S.langF === 'ar') return S.langF;
    return 'all';
  }
  function subjectForSend(t) {
    var typed = String(S.subject || '').trim();
    if (!typed) return '';
    if (typed === defaultSubjectOf(t, 'en') || typed === defaultSubjectOf(t, 'ar')) return '';
    return typed;
  }
  function campaignTemplates() {
    return templates().filter(function (t) { return t.kind !== 'auto'; });
  }
  // Per-template stats come from email_events only; "—" / "never" when there are none.
  function statsFor(file) {
    var s = tplStats[file];
    if (!s || !s.sent) return { sent: 0, open: '—', last: 'never' };
    return { sent: s.sent, open: Math.round((s.opened / s.sent) * 100) + '%', last: fmtDate(s.last) };
  }
  function hasArabicSpec(spec, row) {
    return !!(spec && spec.ar && (spec.ar.title || spec.ar.subject || (spec.ar.blocks && spec.ar.blocks.length)))
      || !!(row && row.spec_ar && (row.spec_ar.title || row.spec_ar.subject || (row.spec_ar.blocks && row.spec_ar.blocks.length)));
  }
  function templates() {
    var live = (window.TF.getEmailTemplates && window.TF.getEmailTemplates()) || [];
    var seen = {};
    var out = TPL_META.map(function (t) {
      var ev = statsFor(t.file);
      var row = live.filter(function (x) { return x.id === t.file || x.id === t.id || (x.id && x.id.indexOf(t.id) === 0); })[0];
      var spec = row && (row.spec || row);
      seen[t.file] = true;
      seen[t.id] = true;
      if (row && row.id) seen[row.id] = true;
      return {
        id: t.id,
        file: t.file,
        name: (row && row.name) || t.name,
        kind: (row && row.kind) || t.kind,
        trigger: (row && row.trigger) || t.trigger,
        subject: (spec && spec.subject) || t.subject,
        sent: ev.sent,
        open: ev.open,
        last: ev.last,
        hasAr: hasArabicSpec(spec, row),
      };
    });
    live.forEach(function (row) {
      if (!row || !row.id || seen[row.id]) return;
      var spec = row.spec || row;
      var ev = statsFor(row.id);
      seen[row.id] = true;
      out.push({
        id: row.id,
        file: row.id,
        name: row.name || row.id,
        kind: row.kind || 'campaign',
        trigger: row.trigger || 'Manual send',
        subject: (spec && spec.subject) || row.name || '',
        sent: ev.sent,
        open: ev.open,
        last: ev.last,
        hasAr: hasArabicSpec(spec, row),
      });
    });
    return out;
  }
  function tplById(id) {
    return templates().filter(function (t) { return t.id === id || t.file === id; })[0] || templates()[0];
  }
  // Local view of an audience, used only for the preview's first recipient. The real recipient
  // count (including the 24h skip) comes from POST /api/admin/campaigns { action: 'count' }.
  function audienceOf(key, langF) {
    var list;
    if (key === 'waitlist') list = waitlist.map(function (w) { return { email: w.email, lang: w.lang, firstName: '' }; });
    else if (key === 'selected') list = members.filter(function (m) { return S.selected.has(String(m.id)); });
    else if (key === 'all') list = members.slice();
    else list = members.filter(function (m) { return m.status === key; });
    return list;
  }
  function tplNameOf(templateId) {
    var t = templates().filter(function (x) { return x.file === templateId || x.id === templateId; })[0];
    return t ? t.name : (templateId || '—');
  }

  function rowsOf(res) {
    if (!res) throw new Error('No response');
    if (res.error) throw new Error(res.error.message || 'Query failed');
    return res.data || [];
  }

  async function loadMembers(sb) {
    var profs = await sb.from('profiles').select('id, email, is_admin, role, first_name, last_name, name, country, lang, notify, created_at, resubmit_note, blocked');
    if (profs.error && /blocked|resubmit_note/i.test(profs.error.message || '')) {
      profs = await sb.from('profiles').select('id, email, is_admin, role, first_name, last_name, name, country, lang, notify, created_at, resubmit_note');
    }
    if (profs.error && /resubmit_note/i.test(profs.error.message || '')) {
      profs = await sb.from('profiles').select('id, email, is_admin, role, first_name, last_name, name, country, lang, notify, created_at');
    }
    var subs = await sb.from('submissions').select('id, user_id, status, note, reviewer_note, file_count, created_at, decided_at');
    var filesRes = await sb.from('submission_files').select('submission_id, file_path, file_name');
    var profiles = rowsOf(profs).filter(function (p) { return !p.is_admin && p.role !== 'admin'; });
    var subRows = rowsOf(subs);
    var fileRows = rowsOf(filesRes);
    members = profiles.map(function (p) {
      var sub = subRows.filter(function (s) { return s.user_id === p.id; })
        .sort(function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); })[0];
      var thumbs = fileRows.filter(function (f) { return sub && f.submission_id === sub.id; }).map(function (f) { return f.file_path; });
      var last = lastEmailByRecipient[String(p.email || '').toLowerCase()];
      var first = p.first_name || (p.name ? String(p.name).split(' ')[0] : '');
      var status = 'none';
      if (p.blocked) status = 'blocked';
      else if (sub && (sub.status === 'submitted' || sub.status === 'approved')) status = sub.status;
      else if ((sub && sub.status === 'rejected') || p.resubmit_note) status = 'rejected';
      return {
        id: p.id,
        email: p.email,
        firstName: first || '',
        lastName: p.last_name || '',
        status: status,
        submitted: sub ? fmtDate(sub.created_at) : '—',
        submittedAt: sub ? sub.created_at : '',
        decidedAt: sub ? (sub.decided_at || '') : '',
        signup: fmtDay(p.created_at),
        signupAt: p.created_at,
        lang: p.lang || 'en',
        country: p.country || '',
        files: thumbs.length || (sub && sub.file_count) || 0,
        note: (sub && sub.note) || '—',
        emails: last ? (last.count + ' · last: ' + tplNameOf(last.templateId)) : '—',
        lastEmail: last ? tplNameOf(last.templateId) : '—',
        submissionId: sub ? sub.id : null,
        thumbs: thumbs,
        reason: (sub && sub.reviewer_note) || p.resubmit_note || '',
      };
    });
  }
  async function loadWaitlist(sb) {
    var wait = await sb.from('waitlist').select('email, source, lang, created_at').order('created_at', { ascending: false });
    waitlist = rowsOf(wait).map(function (w) {
      return { email: w.email, source: w.source || 'Website', lang: w.lang || 'en', joined: fmtDay(w.created_at), joinedAt: w.created_at };
    });
  }
  async function loadEmailEvents(sb) {
    var ev = await sb.from('email_events').select('template_id, event, recipient, created_at').order('created_at', { ascending: false }).limit(2000);
    var stats = {};
    var byRecipient = {};
    rowsOf(ev).forEach(function (e) {
      var id = e.template_id || '';
      var s = stats[id] || (stats[id] = { sent: 0, opened: 0, last: '' });
      if (e.event === 'sent' || e.event === 'delivered') {
        s.sent += 1;
        if (!s.last || e.created_at > s.last) s.last = e.created_at;
        var key = String(e.recipient || '').toLowerCase();
        if (key) {
          var r = byRecipient[key] || (byRecipient[key] = { count: 0, templateId: id, at: e.created_at });
          r.count += 1;
          if (e.created_at > r.at) { r.at = e.created_at; r.templateId = id; }
        }
      } else if (e.event === 'opened') s.opened += 1;
    });
    tplStats = stats;
    lastEmailByRecipient = byRecipient;
  }
  async function loadSends() {
    var res = await window.TF.api('/api/admin/campaigns');
    if (!res.ok) throw new Error(apiMessage(res, 'Could not load the send history.'));
    sends = ((res.body && res.body.sends) || []).map(sendRow);
  }
  async function loadActivity(sb) {
    var act = await sb.from('activity_log').select('kind, text, color, filter, created_at').order('created_at', { ascending: false }).limit(20);
    activity = rowsOf(act).map(function (a) {
      return classifyActivity({
        color: a.color,
        text: a.text || a.kind || '',
        when: fmtDate(a.created_at).replace(/ 20\d\d /, ' '),
        kind: '',
        filter: a.filter || '',
      });
    });
  }

  var loading = null;
  function shortProofName(path) {
    var base = String(path || '').split('/').pop() || 'file';
    var i = base.lastIndexOf('.');
    var ext = i >= 0 ? base.slice(i) : '';
    var stem = i >= 0 ? base.slice(0, i) : base;
    return stem.slice(0, 8) + '…' + ext;
  }
  async function signMemberProofs(m) {
    if (!m || m.proofTiles) return;
    var paths = m.thumbs || [];
    if (!paths.length) { m.proofTiles = []; return; }
    try {
      var sb = window.TF.getClient();
      var res = await sb.storage.from('proofs').createSignedUrls(paths, 600);
      var rows = (res && res.data) || [];
      m.proofTiles = paths.map(function (path, i) {
        var row = rows[i] || {};
        return { path: path, url: row.signedUrl || '', shortName: shortProofName(path) };
      });
    } catch (e) {
      m.proofTiles = paths.map(function (path) {
        return { path: path, url: '', shortName: shortProofName(path) };
      });
    }
  }
  // One round-trip set per page load; failures are recorded per panel (loadErrors) and toasted.
  function loadLive() {
    if (loading) return loading;
    loading = (async function () {
      loadErrors = {};
      if (!window.TF || !window.TF.getClient) return;
      var auth = await window.TF.requireAdmin();
      if (!auth) return;
      var sb = window.TF.getClient();
      if (!sb) { fail('members', 'Not connected to the backend.'); return; }
      try { await loadStats(); } catch (eS) { fail('stats', 'Could not load admin stats: ' + eS.message); }
      try { await loadEmailEvents(sb); } catch (e0) { tplStats = {}; lastEmailByRecipient = {}; fail('stats', 'Could not load email stats: ' + e0.message); }
      try { await loadMembers(sb); } catch (e1) { members = []; fail('members', 'Could not load members: ' + e1.message); }
      try { await loadWaitlist(sb); } catch (e2) { waitlist = []; fail('waitlist', 'Could not load the waitlist: ' + e2.message); }
      try { await loadSends(); } catch (e3) { sends = []; fail('sends', e3.message); }
      try { await loadActivity(sb); } catch (e4) { activity = []; fail('activity', 'Could not load activity: ' + e4.message); }
    })().catch(function (err) {
      fail('members', 'Could not load admin data: ' + ((err && err.message) || 'unknown error'));
    }).then(function () {
      loaded = true;
      loading = null;
    });
    return loading;
  }

  function filteredMembers() {
    var q = (S.q || '').toLowerCase();
    var list = members.filter(function (m) {
      return (S.filter === 'all' || m.status === S.filter) && (!q || m.email.toLowerCase().indexOf(q) >= 0 || String(m.note || '').toLowerCase().indexOf(q) >= 0);
    });
    var key = S.sort;
    var ord = { submitted: 0, approved: 1, rejected: 2, none: 3 };
    list = list.slice().sort(function (a, b) {
      var va = key === 'status' ? ord[a.status] : (a[key] || '');
      var vb = key === 'status' ? ord[b.status] : (b[key] || '');
      return (va > vb ? 1 : va < vb ? -1 : 0) * S.dir;
    });
    return list;
  }

  function csvEscape(v) {
    var s = String(v == null ? '' : v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function downloadCsv(name, rows) {
    var blob = new Blob([rows], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  var dlgSeq = 0;
  // Modal helper: role=dialog, labelled by its title, focus moved in and trapped, restored on close, Escape closes.
  function dialog(opts) {
    return new Promise(function (resolve) {
      var opener = document.activeElement;
      var titleId = 'tf-dlg-title-' + (++dlgSeq);
      var wrap = document.createElement('div');
      wrap.setAttribute('data-admin-dialog', '');
      wrap.setAttribute('data-email-lang', opts.lang === 'ar' ? 'ar' : 'en');
      var single = opts.ok === 'Close';
      wrap.innerHTML = '<div data-admin-dialog-panel role="dialog" aria-modal="true" aria-labelledby="' + titleId + '"><h3 id="' + titleId + '">' + esc(opts.title) + '</h3>' +
        (opts.body ? '<p>' + opts.body + '</p>' : '') +
        (opts.textarea ? '<textarea data-dlg-text aria-label="' + esc(opts.textareaLabel || 'Reason') + '" placeholder="' + esc(opts.placeholder || '') + '">' + esc(opts.value || '') + '</textarea>' : '') +
        (opts.langPick
          ? '<div data-dlg-lang><span>Email language</span><div role="group" aria-label="Email language">' +
            '<button type="button" data-dlg-lang-btn="en">EN</button>' +
            '<button type="button" data-dlg-lang-btn="ar">AR</button></div></div>'
          : '') +
        '<div class="dlg-actions"><button type="button" data-dlg-ok class="' + (single ? 'scp5' : 'btn-primary scp4') + '">' + esc(opts.ok || 'Confirm') + '</button>' + (single ? '' : '<button type="button" data-dlg-cancel class="scp5">Cancel</button>') + '</div></div>';
      document.body.appendChild(wrap);
      var panel = wrap.querySelector('[data-admin-dialog-panel]');
      function paintLang() {
        var cur = wrap.getAttribute('data-email-lang') || 'en';
        wrap.querySelectorAll('[data-dlg-lang-btn]').forEach(function (b) {
          b.setAttribute('aria-pressed', b.getAttribute('data-dlg-lang-btn') === cur ? 'true' : 'false');
        });
      }
      paintLang();
      wrap.querySelectorAll('[data-dlg-lang-btn]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          wrap.setAttribute('data-email-lang', btn.getAttribute('data-dlg-lang-btn') === 'ar' ? 'ar' : 'en');
          paintLang();
        });
      });
      var untrap = trapFocus(wrap);
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(false); } }
      document.addEventListener('keydown', onKey, true);
      function close(val) {
        untrap();
        document.removeEventListener('keydown', onKey, true);
        wrap.remove();
        if (opener && opener.focus && document.body.contains(opener)) { try { opener.focus(); } catch (e) {} }
        resolve(val);
      }
      wrap.querySelector('[data-dlg-ok]').addEventListener('click', function () {
        var ta = wrap.querySelector('[data-dlg-text]');
        var lang = wrap.getAttribute('data-email-lang') === 'ar' ? 'ar' : 'en';
        close(opts.textarea ? { ok: true, text: ta ? ta.value : '', lang: lang } : true);
      });
      var cancel = wrap.querySelector('[data-dlg-cancel]');
      if (cancel) cancel.addEventListener('click', function () { close(false); });
      wrap.addEventListener('click', function (e) { if (e.target === wrap) close(false); });
      var first = wrap.querySelector('[data-dlg-text]') || wrap.querySelector('[data-dlg-ok]');
      if (first) first.focus();
      else focusFirst(panel);
    });
  }
  // Proofs live in a private bucket: the admin's own JWT (RLS select) mints a 10-minute signed URL.
  async function lightbox(path, url) {
    var opener = document.activeElement;
    var label = String(path || '').split('/').pop();
    var wrap = document.createElement('div');
    wrap.setAttribute('data-admin-lightbox', '');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Proof preview');
    wrap.innerHTML = '<div data-admin-lightbox-bar><span style="font-family:Geist Mono,monospace;font-size:12px;color:#8B90A3;word-break:break-all;min-width:0">' + esc(label) + '</span><button type="button" data-lightbox-close aria-label="Close proof preview" style="width:32px;height:32px;flex:none;border:1px solid rgba(255,255,255,0.16);border-radius:8px;background:transparent;color:#F2F4F8;cursor:pointer;font-size:18px;line-height:1">×</button></div><div data-lightbox-body style="color:#7C8296;font-family:Geist Mono,monospace">Loading…</div>';
    document.body.appendChild(wrap);
    var untrap = trapFocus(wrap);
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    function close() {
      untrap();
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      if (opener && opener.focus && document.body.contains(opener)) { try { opener.focus(); } catch (e) {} }
    }
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target === wrap.querySelector('[data-lightbox-body]') || e.target.closest('[data-lightbox-close]')) close();
    });
    var closeBtn = wrap.querySelector('[data-lightbox-close]');
    if (closeBtn) closeBtn.focus();
    var body = wrap.querySelector('[data-lightbox-body]');
    try {
      var src = String(url || '');
      if (!src) {
        var sb = window.TF.getClient();
        var res = await sb.storage.from('proofs').createSignedUrl(path, 600);
        if (res.error || !res.data || !res.data.signedUrl) throw new Error('no url');
        src = res.data.signedUrl;
      }
      var img = document.createElement('img');
      img.alt = 'Proof screenshot ' + label;
      img.src = src;
      body.textContent = '';
      body.appendChild(img);
    } catch (e) {
      body.textContent = 'Could not load this file.';
    }
  }

  /**
   * Approve / reject through POST /api/admin/submission, one call per submission. The server updates the
   * row, sends template 04/05 and writes activity_log. Local rows are only touched on a 200.
   * Resolves { done, failed, emailSent, emailSkipped, noProof, errors[] }.
   */
  async function setMemberStatus(ids, status, reason, lang) {
    var out = { done: 0, failed: 0, emailSent: 0, emailSkipped: 0, noProof: 0, errors: [] };
    for (var i = 0; i < ids.length; i++) {
      var m = members.filter(function (x) { return String(x.id) === String(ids[i]); })[0];
      var memberId = m ? m.id : ids[i];
      if (!memberId) continue;
      var action = status === 'approved' ? 'approve' : status === 'blocked' ? 'reject' : status === 'restore' ? 'restore' : 'resubmit';
      if (action !== 'restore' && !m) continue;
      if (action === 'approve' && (!m || !m.submissionId)) { out.noProof += 1; continue; }
      if (action === 'resubmit' && m && !m.submissionId && m.status !== 'rejected') { out.noProof += 1; continue; }
      var body = { action: action, id: action === 'restore' ? memberId : ((m && m.submissionId) || memberId) };
      if (action === 'resubmit' || action === 'reject') {
        body.reason = String(reason || '').trim().slice(0, 600);
        if (lang === 'ar' || lang === 'en') body.lang = lang;
      }
      var res;
      try { res = await window.TF.api('/api/admin/submission', { body: body }); }
      catch (e) { res = { ok: false, body: { message: (e && e.message) || 'Network error' } }; }
      if (!res.ok) {
        out.failed += 1;
        out.errors.push((m && m.email ? m.email : memberId) + ': ' + apiMessage(res, res.status === 401 ? 'Session expired — refresh the page and try again.' : 'Request failed'));
        continue;
      }
      out.done += 1;
      var r = res.body || {};
      if (m) {
        m.status = r.status || (action === 'restore' ? 'none' : status);
        m.decidedAt = new Date().toISOString();
        if (action === 'resubmit' || action === 'reject' || action === 'restore') {
          m.submissionId = null;
          m.thumbs = [];
          m.files = 0;
          m.proofTiles = [];
          m.submitted = '—';
          m.submittedAt = '';
        }
        if (action === 'resubmit') {
          m.status = 'rejected';
          m.reason = body.reason || '';
        }
        if (action === 'reject') {
          m.status = 'blocked';
          m.reason = body.reason || '';
        }
        if (action === 'restore') {
          m.status = 'none';
          m.reason = '';
        }
        if (r.email && r.email.ok && !r.email.skipped) {
          out.emailSent += 1;
          m.lastEmail = action === 'approve' ? 'Approved' : action === 'reject' ? 'Application rejected' : 'Needs resubmission';
        } else if (action !== 'restore') out.emailSkipped += 1;
      } else if (r.email && r.email.ok && !r.email.skipped) out.emailSent += 1;
    }
    return out;
  }
  function decisionToast(res, status) {
    var verb = status === 'approved' ? 'Approved' : status === 'blocked' ? 'Rejected' : status === 'restore' ? 'Access restored' : 'Resubmission requested';
    if (res.failed && !res.done) { toast(res.errors[0] || 'Request failed.', 'error'); return; }
    var parts = [];
    if (res.done > 1) parts.push(verb + ' ' + res.done + ' members');
    else if (res.done === 1) parts.push(verb);
    if (res.done && status !== 'restore') {
      if (res.emailSent && !res.emailSkipped) parts.push(res.emailSent > 1 ? 'emails sent.' : (status === 'approved' ? 'confirmation email sent.' : 'email sent.'));
      else if (res.emailSkipped && !res.emailSent) parts.push('email skipped (already sent).');
      else parts.push(res.emailSent + ' emails sent, ' + res.emailSkipped + ' skipped (already sent).');
    }
    if (res.noProof) parts.push(res.noProof + ' skipped: no proof uploaded yet.');
    if (res.failed) parts.push(res.failed + ' failed: ' + res.errors[0]);
    if (!parts.length) toast(res.failed ? (res.errors[0] || 'Request failed.') : 'Nothing changed.', res.failed ? 'error' : 'ok');
    else toast(parts.join(' — '), res.failed ? 'error' : 'ok');
  }
  async function decide(ids, status, reason, lang) {
    closeRowMenu();
    if (S.busy) { toast('Please wait…', 'wait'); return; }
    S.busy = true;
    toast('Working…', 'wait');
    var res;
    try { res = await setMemberStatus(ids, status, reason, lang); }
    finally { S.busy = false; }
    decisionToast(res, status);
    if (res.done) {
      if (status === 'rejected' || status === 'blocked') S.reason = '';
      S.selected = new Set();
      writeSelected(S.selected);
      await loadLive();
    }
    await paint();
  }

  async function previewHtml() {
    var t = tplById(S.tpl);
    var first = S.dlg && S.dlg.length
      ? members.filter(function (m) { return S.dlg.indexOf(String(m.id)) >= 0; })[0]
      : audienceOf(S.audience, S.langF)[0];
    var lang = S.pv === 'ar' ? 'ar' : 'en';
    if (window.TF && window.TF.renderEmail) {
      try {
        var out = await window.TF.renderEmail(t.file || t.id, lang, {
          first_name: (first && first.firstName) || 'there',
          email: (first && first.email) || '',
          hero_image_url: (location.origin || '') + '/assets/nt-platform.png',
          hero_image_alt: 'Talaria Flow suite on a NinjaTrader chart',
        });
        S.previewSubject = out.subject || '';
        return out;
      } catch (e) {}
    }
    S.previewSubject = '';
    return { html: '<!doctype html><html><body style="margin:0;background:#07080C;color:#8B90A3;font-family:Archivo,sans-serif;display:grid;place-items:center;min-height:240px">Preview unavailable</body></html>', subject: '', missingAr: false };
  }

  function pickerLocale() {
    return (document.documentElement.getAttribute('data-lang') || document.documentElement.lang) === 'ar' ? 'ar' : 'en-GB';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoDay(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function startOfToday() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function dateLabelOf(iso) {
    if (!iso) return 'Pick a date';
    var d = new Date(iso + 'T00:00:00');
    if (pickerLocale() === 'ar') {
      return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' }).format(d);
    }
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }
  function tomorrow() {
    var t = startOfToday();
    t.setDate(t.getDate() + 1);
    return t;
  }
  function ensureScheduleDefaults() {
    if (!S.date) { S.date = isoDay(tomorrow()); S.time = '09:00'; }
  }
  // Date + time pickers are the admin's local wall clock; the API gets an ISO instant.
  function scheduledIso() {
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(S.date || '');
    var t = /^(\d{2}):(\d{2})$/.exec(S.time || '');
    if (!d || !t) return null;
    var when = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
    if (isNaN(when.getTime())) return null;
    return when.toISOString();
  }
  function renderDateTimePickers(note) {
    ensureScheduleDefaults();
    var loc = pickerLocale();
    var cur = S.date ? new Date(S.date + 'T00:00:00') : tomorrow();
    var view = S.calView ? new Date(S.calView + '-01T00:00:00') : new Date(cur.getFullYear(), cur.getMonth(), 1);
    var today = startOfToday();
    var y = view.getFullYear();
    var m = view.getMonth();
    var first = new Date(y, m, 1);
    var offset = (first.getDay() + 6) % 7;
    var total = new Date(y, m + 1, 0).getDate();
    var days = [];
    var k;
    for (k = 0; k < offset; k++) days.push(null);
    for (k = 1; k <= total; k++) days.push(new Date(y, m, k));
    while (days.length % 7) days.push(null);
    var dow = [];
    for (k = 1; k <= 7; k++) {
      dow.push(new Intl.DateTimeFormat(loc, { weekday: 'short', numberingSystem: 'latn' }).format(new Date(2026, 5, k)));
    }
    var calMonth = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', numberingSystem: 'latn' }).format(view);
    var dayBtns = days.map(function (d) {
      if (!d) return '<span style="height:34px"></span>';
      var key = isoDay(d);
      var past = d < today;
      var sel = key === S.date;
      var isToday = key === isoDay(today);
      var border = sel ? '#2EE8FF' : isToday ? 'rgba(255,255,255,0.24)' : 'transparent';
      var bg = sel ? 'rgba(46,232,255,0.14)' : 'transparent';
      var color = past ? '#3A3E4C' : sel ? '#2EE8FF' : '#F2F4F8';
      return '<button type="button" data-act="cal-day" data-iso="' + key + '" ' + (past ? 'disabled' : '') + ' style="height:34px;display:grid;place-items:center;border:1px solid ' + border + ';border-radius:8px;background:' + bg + ';color:' + color + ';font-family:\'Geist Mono\',monospace;font-size:12.5px;cursor:' + (past ? 'not-allowed' : 'pointer') + ';line-height:1">' + d.getDate() + '</button>';
    }).join('');
    var times = [];
    for (var h = 6; h <= 21; h++) { times.push(pad2(h) + ':00'); times.push(pad2(h) + ':30'); }
    var timeRows = times.map(function (label) {
      var on = label === S.time;
      return '<button type="button" data-act="clk-pick" data-time="' + label + '" role="option" aria-selected="' + (on ? 'true' : 'false') + '" style="display:flex;align-items:center;justify-content:space-between;width:100%;height:32px;padding:0 10px;border:0;border-radius:8px;background:' + (on ? 'rgba(46,232,255,0.10)' : 'transparent') + ';color:#F2F4F8;font-family:\'Geist Mono\',monospace;font-size:12.5px;cursor:pointer;text-align:left;line-height:1"><span>' + label + '</span><span style="width:5px;height:5px;border-radius:50%;background:' + (on ? '#2EE8FF' : 'transparent') + '"></span></button>';
    }).join('');
    return '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
      '<div data-pop style="position:relative">' +
      '<button type="button" data-act="cal-toggle" aria-haspopup="dialog" aria-expanded="' + (S.calOpen ? 'true' : 'false') + '" style="display:inline-flex;align-items:center;gap:10px;height:36px;padding:0 12px;background:#07080C;border:1px solid ' + (S.calOpen ? '#2EE8FF' : 'rgba(255,255,255,0.16)') + ';border-radius:10px;color:#F2F4F8;font-family:\'Geist Mono\',monospace;font-size:13px;cursor:pointer;white-space:nowrap;line-height:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B90A3" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path></svg>' + esc(dateLabelOf(S.date)) + '</button>' +
      (S.calOpen ? '<div role="dialog" aria-label="Choose date" style="position:absolute;top:calc(100% + 8px);left:0;z-index:70;width:288px;padding:14px;background:#0E1017;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.5)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px"><span style="font-size:14px;font-weight:600">' + esc(calMonth) + '</span><span style="display:inline-flex;gap:4px">' +
        '<button type="button" data-act="cal-prev" aria-label="Previous month" style="width:28px;height:28px;display:grid;place-items:center;border:1px solid rgba(255,255,255,0.16);border-radius:8px;background:transparent;color:#B7BCCB;cursor:pointer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"></path></svg></button>' +
        '<button type="button" data-act="cal-next" aria-label="Next month" style="width:28px;height:28px;display:grid;place-items:center;border:1px solid rgba(255,255,255,0.16);border-radius:8px;background:transparent;color:#B7BCCB;cursor:pointer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"></path></svg></button></span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">' + dow.map(function (d) { return '<span style="display:grid;place-items:center;height:22px;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#7C8296">' + esc(d) + '</span>'; }).join('') + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">' + dayBtns + '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)">' +
        '<button type="button" data-act="cal-tomorrow" style="height:30px;padding:0 10px;border:1px solid rgba(255,255,255,0.16);border-radius:8px;background:transparent;color:#B7BCCB;font-family:Archivo,sans-serif;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;line-height:1">Tomorrow</button>' +
        '<button type="button" data-act="cal-done" class="btn-primary" style="height:30px;padding:0 12px;border:0;border-radius:8px;background:#2EE8FF;color:#04141A;font-family:Archivo,sans-serif;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;line-height:1">Done</button></div></div>' : '') +
      '</div>' +
      '<div data-pop style="position:relative">' +
      '<button type="button" data-act="clk-toggle" aria-haspopup="listbox" aria-expanded="' + (S.clkOpen ? 'true' : 'false') + '" style="display:inline-flex;align-items:center;gap:10px;height:36px;padding:0 12px;background:#07080C;border:1px solid ' + (S.clkOpen ? '#2EE8FF' : 'rgba(255,255,255,0.16)') + ';border-radius:10px;color:#F2F4F8;font-family:\'Geist Mono\',monospace;font-size:13px;cursor:pointer;white-space:nowrap;line-height:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B90A3" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>' + esc(S.time) + '</button>' +
      (S.clkOpen ? '<div role="listbox" style="position:absolute;top:calc(100% + 8px);left:0;z-index:70;width:132px;max-height:232px;overflow-y:auto;padding:6px;background:#0E1017;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.5)">' + timeRows + '</div>' : '') +
      '</div>' +
      (note ? '<span style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#8B90A3">' + note + '</span>' : '') +
      '</div>';
  }

  function pill(on) {
    return on
      ? 'background:rgba(255,255,255,0.08);color:#F2F4F8'
      : 'background:transparent;color:#8B90A3';
  }
  function chip(on) {
    return on
      ? 'border-color:#2EE8FF;background:rgba(46,232,255,0.1);color:#F2F4F8'
      : 'border-color:rgba(255,255,255,0.16);background:transparent;color:#B7BCCB';
  }

  function renderOverview(c) {
    var pending = members.filter(function (m) { return m.status === 'submitted'; });
    var scheduled = sends.filter(function (s) { return s.state === 'scheduled'; });
    var pendingToday = pending.filter(function (m) { return isTodayDate(m.submittedAt); }).length;
    var approvedWeek = members.filter(function (m) { return m.status === 'approved' && inLastDays(m.decidedAt || m.submittedAt, 7); }).length;
    var waitWeek = waitlist.filter(function (w) { return inLastDays(w.joinedAt, 7); }).length;
    var kpis = [
      ['Pending review', c.pending, '#FBBF24', trendLabel(pendingToday, 'today'), '/admin/members/?status=submitted'],
      ['Approved', c.approved, '#2EE8FF', trendLabel(approvedWeek, 'this week'), '/admin/members/?status=approved'],
      ['Needs resubmission', c.rejected, '#FF8AD0', '', '/admin/members/?status=rejected'],
      ['Waitlist', c.waitlist, '#B7BCCB', trendLabel(waitWeek, 'this week'), '/admin/waitlist/'],
    ];
    var actFilters = [['all', 'All'], ['review', 'Reviews'], ['signup', 'Sign-ups'], ['email', 'Emails']];
    var activityRows = activity.filter(function (a) {
      return S.actFilter === 'all' || a.filter === S.actFilter;
    });
    var pendingRows = pending.length
      ? pending.map(function (m) {
          return '<a href="' + membersUrl({ filter: 'submitted', focus: m.id }) + '" class="scp2" style="display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;padding:12px 18px;border:0;border-bottom:1px solid rgba(255,255,255,0.06);background:transparent;color:inherit;text-align:left;cursor:pointer;font-family:inherit;box-sizing:border-box">' +
            '<span aria-hidden="true" style="width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#2EE8FF,#FF37B0);color:#04141A;font-size:10.5px;font-weight:700">' + esc(initialsOf(m)) + '</span>' +
            '<span style="min-width:0"><span style="display:block;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(m.email) + '</span><span style="display:block;font-family:\'Geist Mono\',monospace;font-size:11px;color:#8B90A3">' + m.files + ' files · ' + ageOf(m.submittedAt || m.submitted) + '</span></span>' +
            '<span style="font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#FBBF24;border:1px solid #FBBF24;border-radius:6px;padding:3px 7px;white-space:nowrap">Review</span></a>';
        }).join('')
      : '<div class="tf-empty">Nothing waiting. Every submission is reviewed.</div>';
    var scheduledRows = scheduled.length
      ? scheduled.map(function (s) {
          return '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.06)">' +
            '<span style="min-width:0"><span style="display:block;font-size:14px;font-weight:500">' + esc(s.template) + '</span><span style="display:block;font-family:\'Geist Mono\',monospace;font-size:11px;color:#8B90A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(s.audience) + ' · ' + s.count + ' recipients</span></span>' +
            '<span style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#2EE8FF;text-align:right;white-space:nowrap">' + esc(s.when) + '</span></div>';
        }).join('')
      : '<div class="tf-empty">No campaign scheduled.</div>';
    return '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px">' +
      '<div><div style="font-family:\'Geist Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3;margin-bottom:6px">Overview</div><h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;line-height:1.15">Today</h1></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<a href="/admin/members/?status=submitted" class="btn-outline scp1" style="height:36px;padding:0 14px;border-radius:10px;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center">Review ' + c.pending + ' pending</a>' +
      '<a href="/admin/campaigns/" class="btn-primary scp4" style="height:36px;padding:0 14px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center">New campaign</a>' +
      '</div></div>' +
      '<div data-kpi>' +
      kpis.map(function (k) {
        return '<a href="' + k[4] + '" class="tf-kpi" style="border-top:2px solid ' + k[2] + '">' +
          '<span style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><span style="font-size:28px;font-weight:700;letter-spacing:-0.03em;line-height:1;color:' + k[2] + '">' + k[1] + '</span><span style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#7C8296">' + esc(k[3]) + '</span></span>' +
          '<span style="font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">' + k[0] + '</span></a>';
      }).join('') + '</div>' +
      '<div data-work data-two style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start">' +
      '<section class="tf-card tf-work">' +
      cardHead('#FBBF24', 'Needs your decision', c.pending, '<a href="/admin/members/?status=submitted" class="tf-card-link">Open queue →</a>') +
      errorLine('members') +
      '<div style="flex:1;display:flex;flex-direction:column">' + pendingRows + '</div></section>' +
      '<section class="tf-card tf-work">' +
      cardHead('#2EE8FF', 'Scheduled campaigns', c.scheduled, '<a href="/admin/campaigns/history/" class="tf-card-link">All sends →</a>') +
      errorLine('sends') +
      '<div style="flex:1;display:flex;flex-direction:column">' + scheduledRows + '</div></section>' +
      '<section class="tf-card" style="grid-column:1 / -1">' +
      cardHead('#8B90A3', 'Recent activity', '',
        '<div role="tablist" class="tf-seg">' +
        actFilters.map(function (f, i) {
          var on = S.actFilter === f[0];
          return '<button type="button" data-act="act-filter" data-filter="' + f[0] + '" style="height:30px;padding:0 12px;border:0;' + (i < actFilters.length - 1 ? 'border-right:1px solid rgba(255,255,255,0.08);' : '') + (on ? 'background:rgba(255,255,255,0.08);color:#F2F4F8' : 'background:transparent;color:#8B90A3') + ';font-family:Archivo,sans-serif;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;line-height:1">' + f[1] + '</button>';
        }).join('') + '</div>') +
      errorLine('activity') +
      '<div>' +
      (activityRows.length ? activityRows.map(function (a) {
        return '<div class="tf-act-row"><span style="width:6px;height:6px;background:' + a.color + ';display:inline-block;margin-left:8px"></span>' +
          '<span style="color:#B7BCCB;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(a.text) + '</span>' +
          '<span style="font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:' + a.color + '">' + esc(a.kind) + '</span>' +
          '<span style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#7C8296;white-space:nowrap;text-align:right">' + esc(a.when) + '</span></div>';
      }).join('') : '<div class="tf-empty" data-empty>' + (S.actFilter === 'all' ? 'No activity yet.' : 'No activity in this category yet.') + '</div>') +
      '</div></section></div>';
  }

  function renderMembers(c) {
    var titles = { submitted: 'Pending review', approved: 'Approved', rejected: 'Needs resubmission', blocked: 'Rejected', none: 'No proof yet' };
    var list = filteredMembers();
    var filters = [['all', 'All', c.total], ['submitted', 'Pending', c.pending], ['approved', 'Approved', c.approved], ['rejected', 'Resubmission', c.rejected], ['blocked', 'Rejected', c.blocked || 0], ['none', 'No proof', c.none]];
    var cols = [['email', 'Member'], ['status', 'Status'], ['submitted', 'Submitted'], ['lang', 'Lang'], ['country', 'Country'], ['lastEmail', 'Last email']];
    var focus = members.filter(function (m) { return String(m.id) === String(S.focus); })[0];
    if (!focus || (list.length && !list.some(function (m) { return String(m.id) === String(focus.id); }))) focus = list[0] || members[0];
    if (focus) S.focus = focus.id;
    var allSel = list.length > 0 && list.every(function (m) { return S.selected.has(String(m.id)); });
    var hasSel = S.selected.size > 0;
    var html = '<div><div style="font-family:\'Geist Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3;margin-bottom:6px">Members</div><h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;line-height:1.15">' + (titles[S.filter] || 'All members') + '</h1></div>';
    html += '<div data-two style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:24px;align-items:start">' +
      '<section class="tf-card">' +
      '<header class="tf-card-h">' +
      '<span class="tf-card-title"><span class="tf-dot" style="background:' + (COLORS[S.filter] || '#8B90A3') + '"></span><h2>' + (titles[S.filter] || 'All members') + '</h2><span class="tf-card-count">' + list.length + '</span></span>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<input type="search" data-act="search" placeholder="Search email or note" value="' + esc(S.qInput) + '" style="height:36px;width:220px;padding:0 12px;background:#07080C;border:1px solid rgba(255,255,255,0.16);border-radius:10px;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:13.5px;outline:none">' +
      '<div role="tablist" class="tf-seg">' +
      filters.map(function (f, i) {
        return '<button type="button" data-act="filter" data-filter="' + f[0] + '" style="height:36px;padding:0 12px;border:0;' + (i < filters.length - 1 ? 'border-right:1px solid rgba(255,255,255,0.08);' : '') + pill(S.filter === f[0]) + ';font-family:Archivo,sans-serif;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap">' + f[1] + ' <span style="font-family:\'Geist Mono\',monospace;font-size:10.5px;color:#8B90A3">' + f[2] + '</span></button>';
      }).join('') + '</div>' +
      '<button type="button" data-act="export" class="btn-neutral scp5" style="height:36px;padding:0 14px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer">Export CSV</button>' +
      '</div></header>';
    if (hasSel) {
      html += '<div class="tf-bulk">' +
        '<span style="font-size:13.5px;font-weight:600;margin-right:8px">' + S.selected.size + ' selected</span>' +
        '<button type="button" data-act="bulk-approve" style="height:32px;padding:0 12px;border:0;border-radius:8px;background:#2EE8FF;color:#04141A;font-size:13px;font-weight:600;cursor:pointer">Approve all</button>' +
        '<button type="button" data-act="bulk-reject" class="btn-neutral scp5" style="height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Request resubmission</button>' +
        '<button type="button" data-act="bulk-email" class="btn-neutral scp5" style="height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Email selected</button>' +
        '<button type="button" data-act="export-sel" class="btn-neutral scp5" style="height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Export selected</button>' +
        '<button type="button" data-act="clear-sel" style="margin-left:auto;height:32px;padding:0 10px;border:0;background:none;color:#8B90A3;font-size:13px;cursor:pointer">Clear</button></div>';
    }
    html += errorLine('members');
    html += '<div class="tf-table-wrap"><table style="min-width:760px"><thead><tr>' +
      '<th style="width:32px;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,0.16)"><input type="checkbox" data-act="toggle-all" aria-label="Select all members" ' + (allSel ? 'checked' : '') + (list.length ? '' : ' disabled') + ' style="accent-color:#2EE8FF;width:15px;height:15px;margin:0"></th>' +
      cols.map(function (col) {
        var on = S.sort === col[0];
        return '<th style="text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.16)"><button type="button" data-act="sort" data-sort="' + col[0] + '" style="border:0;background:none;padding:0;font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:' + (on ? '#F2F4F8' : '#8B90A3') + ';cursor:pointer;white-space:nowrap">' + col[1] + (on ? (S.dir > 0 ? ' ↑' : ' ↓') : '') + '</button></th>';
      }).join('') +
      '<th style="text-align:right;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.16);font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3;font-weight:500;position:sticky;right:0;background:#0E1017;z-index:1">Actions</th>' +
      '</tr></thead><tbody>' +
      (list.length ? list.map(function (m) {
        var on = String(m.id) === String(S.focus);
        var checked = S.selected.has(String(m.id));
        return '<tr style="background:' + (on ? 'rgba(46,232,255,0.05)' : 'transparent') + '">' +
          '<td style="padding:10px 6px;border-bottom:1px solid rgba(255,255,255,0.08);border-left:2px solid ' + (on ? '#2EE8FF' : 'transparent') + '"><input type="checkbox" data-act="toggle" data-id="' + esc(m.id) + '" aria-label="Select ' + esc(m.email) + '" ' + (checked ? 'checked' : '') + ' style="accent-color:#2EE8FF;width:15px;height:15px;margin:0"></td>' +
          '<td data-act="open" data-id="' + esc(m.id) + '" style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:500;cursor:pointer;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.email) + '</td>' +
          '<td data-act="open" data-id="' + esc(m.id) + '" style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);cursor:pointer"><span style="display:inline-flex;align-items:center;gap:7px;font-family:\'Geist Mono\',monospace;font-size:11px;color:' + COLORS[m.status] + '"><span style="width:6px;height:6px;background:' + COLORS[m.status] + ';display:inline-block"></span>' + m.status + '</span></td>' +
          '<td data-act="open" data-id="' + esc(m.id) + '" style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3;white-space:nowrap;cursor:pointer">' + esc(m.submitted) + '</td>' +
          '<td data-act="open" data-id="' + esc(m.id) + '" style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3;cursor:pointer">' + esc(m.lang) + '</td>' +
          '<td data-act="open" data-id="' + esc(m.id) + '" style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3;cursor:pointer">' + esc(m.country || '—') + '</td>' +
          '<td data-act="open" data-id="' + esc(m.id) + '" style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3;white-space:nowrap;cursor:pointer">' + esc(m.lastEmail) + '</td>' +
          '<td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap;text-align:right;position:sticky;right:0;background:' + (on ? '#0C1216' : '#0E1017') + ';z-index:1">' +
          '<button type="button" data-act="row-menu" data-id="' + esc(m.id) + '" aria-haspopup="menu" aria-label="Actions for ' + esc(m.email) + '" style="width:26px;height:26px;border:1px solid rgba(255,255,255,0.16);border-radius:7px;background:transparent;color:#B7BCCB;cursor:pointer;display:grid;place-items:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle></svg></button>' +
          '</td></tr>';
      }).join('') : emptyRow(members.length ? (S.q ? 'No members match this search.' : 'No members in this list.') : 'No members yet.', cols.length + 2)) +
      '</tbody></table><div style="display:flex;justify-content:space-between;align-items:center;padding:10px 18px;font-family:\'Geist Mono\',monospace;font-size:11px;color:#8B90A3"><span>' + list.length + ' of ' + c.total + ' members</span><span>Sorted by ' + (cols.filter(function (x) { return x[0] === S.sort; })[0] || cols[2])[1].toLowerCase() + (S.dir > 0 ? ' ascending' : ' descending') + '</span></div></div></section>';
    if (focus) {
      var thumbs = (focus.proofTiles && focus.proofTiles.length) ? focus.proofTiles : (focus.thumbs || []).map(function (t) {
        return { path: t, url: '', shortName: shortProofName(t) };
      });
      html += '<section class="tf-card" style="min-width:0;border-top:2px solid ' + COLORS[focus.status] + ';position:sticky;top:20px">' +
        '<header class="tf-card-h">' +
        '<h3 style="font-size:15px;font-weight:600;word-break:break-all">' + esc(focus.email) + '</h3>' +
        '<span style="display:inline-flex;align-items:center;gap:7px;font-family:\'Geist Mono\',monospace;font-size:11px;color:' + COLORS[focus.status] + ';border:1px solid ' + COLORS[focus.status] + ';border-radius:6px;padding:4px 8px"><span class="tf-dot" style="background:' + COLORS[focus.status] + '"></span>' + focus.status + '</span></header>' +
        '<div style="padding:0 18px 20px">' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08)">' +
        '<div style="padding:10px 10px 10px 0"><div style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Signed up</div><div style="font-family:\'Geist Mono\',monospace;font-size:12px;margin-top:3px">' + esc(focus.signup) + '</div></div>' +
        '<div style="padding:10px;border-left:1px solid rgba(255,255,255,0.08)"><div style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Language</div><div style="font-family:\'Geist Mono\',monospace;font-size:12px;margin-top:3px">' + esc(focus.lang) + '</div></div>' +
        '<div style="padding:10px 0 10px 10px;border-left:1px solid rgba(255,255,255,0.08)"><div style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Emails sent</div><div style="font-family:\'Geist Mono\',monospace;font-size:12px;margin-top:3px">' + esc(focus.emails) + '</div></div></div>';
      if (focus.submissionId) {
        html += '<div style="margin-top:14px;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Proof · ' + focus.files + ' file' + (focus.files === 1 ? '' : 's') + '</div>' +
          (thumbs.length
            ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:8px">' +
              thumbs.map(function (t) {
                var src = t.url || '';
                var name = t.shortName || shortProofName(t.path);
                if (!src) {
                  return '<div style="display:block;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:#07080C">' +
                    '<div style="display:grid;place-items:center;width:100%;aspect-ratio:4/3;color:#8B90A3;font:400 11px \'Geist Mono\',monospace">' +
                    '<span style="display:flex;flex-direction:column;align-items:center;gap:6px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 19 6-6 3 3 4-4 5 5"/><circle cx="8.5" cy="9.5" r="1.2"/></svg>Unavailable</span></div>' +
                    '<span style="display:block;padding:6px 8px;font:400 10.5px \'Geist Mono\',monospace;color:#8B90A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(name) + '</span></div>';
                }
                return '<button type="button" data-act="lightbox" data-src="' + esc(t.path) + '" data-url="' + esc(src) + '" aria-label="Open proof ' + esc(name) + ' full size" style="display:block;width:100%;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:#07080C;padding:0;cursor:zoom-in;text-align:left">' +
                  '<img src="' + esc(src) + '" alt="" style="display:block;width:100%;aspect-ratio:4/3;object-fit:cover;pointer-events:none">' +
                  '<span style="display:block;padding:6px 8px;font:400 10.5px \'Geist Mono\',monospace;color:#8B90A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(name) + '</span></button>';
              }).join('') + '</div>'
            : '<p style="margin-top:8px;font-size:13px;color:#8B90A3">Files are not available for preview.</p>') +
          '<div style="margin-top:14px;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Member note</div>' +
          '<p style="margin-top:4px;font-size:13.5px;color:#B7BCCB">' + esc(focus.note) + '</p>' +
          (focus.status === 'rejected' && focus.reason ? '<div style="margin-top:14px;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Reason sent</div><p style="margin-top:4px;font-size:13.5px;color:#B7BCCB">' + esc(focus.reason) + '</p>' : '');
        if (focus.status === 'blocked') {
          html += '<p style="margin-top:14px;font-size:13px;color:#8B90A3">Rejected. This member cannot upload until you restore access.</p>';
        } else if (focus.status === 'approved') {
          html += '<p style="margin-top:14px;font-size:13px;color:#8B90A3">Approved' + (focus.decidedAt ? ' on ' + esc(fmtDay(focus.decidedAt)) : '') + '.</p>';
        }
      } else if (focus.status === 'blocked') {
        html += '<p style="margin-top:14px;font-size:13.5px;color:#8B90A3">Rejected. This member cannot upload until you restore access.</p>' +
          (focus.reason ? '<p style="margin-top:8px;font-size:13.5px;color:#B7BCCB">' + esc(focus.reason) + '</p>' : '');
      } else if (focus.status === 'rejected') {
        html += '<p style="margin-top:14px;font-size:13.5px;color:#8B90A3">Asked to resubmit' + (focus.reason ? ': ' + esc(focus.reason) : '') + '.</p>';
      } else {
        html += '<p style="margin-top:14px;font-size:13.5px;color:#8B90A3">No proof uploaded yet.</p>';
      }
      html += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);display:flex;flex-wrap:wrap;gap:14px;font-size:13px">' +
        '<button type="button" data-act="reset-pw" style="border:0;background:none;padding:0;color:#B7BCCB;font-weight:500;cursor:pointer">Reset password</button>' +
        '<button type="button" data-act="delete" style="border:0;background:none;padding:0;color:#FF8AD0;font-weight:500;cursor:pointer;margin-left:auto">Delete member</button></div></div></section>';
    }
    html += '</div>';
    return html;
  }

  function renderCampaigns(c) {
    var route = parseRoute();
    var tab = route.tab === 'history' ? 'history' : 'compose';
    var titles = { compose: 'New campaign', history: 'Send history' };
    var tabs = [['compose', 'Configure', '/admin/campaigns/'], ['history', 'History', '/admin/campaigns/history/']];
    var html = '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px">' +
      '<div><div style="font-family:\'Geist Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3;margin-bottom:6px">Campaigns</div><h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;line-height:1.15">' + titles[tab] + '</h1></div>' +
      '<div role="tablist" style="display:inline-flex;border:1px solid rgba(255,255,255,0.16);border-radius:10px;overflow:hidden">' +
      tabs.map(function (t, i) {
        return '<a href="' + t[2] + '" style="height:36px;padding:0 14px;border:0;display:inline-flex;align-items:center;' + (i < 1 ? 'border-right:1px solid rgba(255,255,255,0.08);' : '') + pill(tab === t[0]) + ';font-size:13.5px;font-weight:500">' + t[1] + '</a>';
      }).join('') + '</div></div>';

    if (tab === 'compose') {
      var t = tplById(S.tpl);
      var sendLang = campaignSendLang();
      var subject = S.subject || defaultSubjectOf(t, sendLang === 'ar' || S.pv === 'ar' ? 'ar' : 'en');
      var countLabel = S.count == null ? '…' : String(S.count);
      var audDefs = [['approved', 'Approved members', c.approved], ['submitted', 'Pending review', c.pending], ['rejected', 'Needs resubmission', c.rejected], ['none', 'No proof yet', c.none], ['all', 'All members', c.total], ['waitlist', 'Waitlist', c.waitlist]];
      var later = S.when === 'later';
      if (later) ensureScheduleDefaults();
      html += '<div data-two style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:start"><div style="display:flex;flex-direction:column;gap:18px">' +
        '<div style="padding:18px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;gap:14px">' +
        '<div style="display:flex;align-items:center;gap:8px"><span class="tf-dot" style="background:#2EE8FF"></span><span style="font-family:\'Geist Mono\',monospace;font-size:11px;font-weight:600;color:#F2F4F8">1</span><span style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3">What</span></div>' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Template' +
        '<div data-tf-select="tpl"></div></label>' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Subject' +
        '<input data-act="subject" value="' + esc(subject) + '" style="height:38px;padding:0 10px;background:#07080C;border:1px solid rgba(255,255,255,0.16);border-radius:10px;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:14px;outline:none"></label>' +
        '<div style="display:flex;gap:14px;font-size:13px;color:#8B90A3"><span>AR in the preview sends Arabic to everyone. All = each member\'s language.</span><a href="/admin/emails/' + esc(t.file || t.id) + '/" style="color:#2EE8FF;font-weight:600;margin-left:auto">Edit template</a></div></div>' +
        '<div style="padding:18px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;gap:14px">' +
        '<div style="display:flex;align-items:center;gap:8px"><span class="tf-dot" style="background:#FBBF24"></span><span style="font-family:\'Geist Mono\',monospace;font-size:11px;font-weight:600;color:#F2F4F8">2</span><span style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3">Who</span></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
        audDefs.filter(function (a) { return a[0] !== 'selected' || S.selected.size; }).map(function (a) {
          return '<button type="button" data-act="audience" data-audience="' + a[0] + '" style="height:32px;padding:0 12px;border:1px solid;border-radius:8px;' + chip(S.audience === a[0]) + ';font-size:13px;font-weight:500;cursor:pointer">' + a[1] + ' <span style="font-family:\'Geist Mono\',monospace;font-size:10.5px;color:#8B90A3">' + a[2] + '</span></button>';
        }).join('') + '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;font-size:13px;color:#8B90A3;flex-wrap:wrap">Language' +
        [['all', 'All'], ['en', 'EN'], ['ar', 'AR']].map(function (l) {
          return '<button type="button" data-act="langf" data-langf="' + l[0] + '" style="height:28px;padding:0 10px;border:1px solid;border-radius:8px;' + chip(S.langF === l[0]) + ';font-size:12.5px;cursor:pointer">' + l[1] + '</button>';
        }).join('') +
        '<label style="margin-left:auto;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-act="skip" ' + (S.skipRecent ? 'checked' : '') + ' style="accent-color:#2EE8FF;margin:0">Skip anyone who got this campaign in the last 24h</label></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08)"><span style="font-size:13px;color:#8B90A3">Recipients</span><span data-recip-count aria-live="polite" style="font-size:22px;font-weight:700;letter-spacing:-0.02em">' + esc(countLabel) + '</span></div>' +
        '<div data-count-error role="alert" style="font-size:12.5px;color:#FF8AD0;' + (S.countError ? '' : 'display:none') + '">' + esc(S.countError) + '</div></div>' +
        '<div style="padding:18px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;gap:14px">' +
        '<div style="display:flex;align-items:center;gap:8px"><span class="tf-dot" style="background:#B7BCCB"></span><span style="font-family:\'Geist Mono\',monospace;font-size:11px;font-weight:600;color:#F2F4F8">3</span><span style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3">When</span></div>' +
        '<div style="display:inline-flex;border:1px solid rgba(255,255,255,0.16);border-radius:10px;overflow:hidden;width:max-content">' +
        '<button type="button" data-act="when" data-when="now" style="height:34px;padding:0 14px;border:0;border-right:1px solid rgba(255,255,255,0.08);' + pill(!later) + ';font-size:13px;font-weight:500;cursor:pointer">Send now</button>' +
        '<button type="button" data-act="when" data-when="later" style="height:34px;padding:0 14px;border:0;' + pill(later) + ';font-size:13px;font-weight:500;cursor:pointer">Schedule</button></div>' +
        (later ? renderDateTimePickers('Europe/London · sends in batches of 100') : '') +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08)">' +
        '<button type="button" data-act="submit-send" class="btn-primary scp4" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font-size:14px;font-weight:600;cursor:pointer">' + (later ? 'Schedule for ' + dateLabelOf(S.date) + ' ' + S.time : 'Send to <span data-recip-count-btn>' + esc(countLabel) + '</span> now') + '</button>' +
        '<button type="button" data-act="test-send" class="scp5" style="height:40px;padding:0 14px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;background:transparent;color:#F2F4F8;font-size:14px;font-weight:600;cursor:pointer">Send test to me</button>' +
        '<span style="font-size:12.5px;color:#8B90A3;margin-left:auto">' + (later ? 'You can cancel until it starts.' : 'Asks for confirmation before sending.') + '</span></div></div></div>' +
        '<div style="position:sticky;top:20px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3">Preview · first recipient</span>' +
        '<div style="display:inline-flex;border:1px solid rgba(255,255,255,0.16);border-radius:8px;overflow:hidden">' +
        '<button type="button" data-act="pv" data-pv="en" style="height:28px;padding:0 10px;border:0;' + pill(S.pv === 'en') + ';font-size:12px;font-weight:600;cursor:pointer">EN</button>' +
        '<button type="button" data-act="pv" data-pv="ar" style="height:28px;padding:0 10px;border:0;border-left:1px solid rgba(255,255,255,0.08);' + pill(S.pv === 'ar') + ';font-size:12px;font-weight:600;cursor:pointer">AR</button></div></div>' +
        '<div style="border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;background:#0E1017">' +
        '<div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:11.5px;color:#8B90A3">From <b style="color:#B7BCCB;font-weight:500">Talaria Flow &lt;support@talaria-flow.com&gt;</b> · Subject <b data-preview-subject style="color:#F2F4F8;font-weight:500">' + esc(S.previewSubject || subject) + '</b></div>' +
        '<iframe title="Email preview" data-preview-frame style="width:100%;height:560px;border:0;background:#fff;display:block"></iframe></div></div></div>';
    }

    if (tab === 'history') {
      html += '<section class="tf-card">' +
        cardHead('#2EE8FF', 'Send history', sends.length, '<a href="/admin/campaigns/" class="tf-card-link">New campaign →</a>') +
        errorLine('sends') +
        '<div class="tf-table-wrap"><table style="min-width:720px"><thead><tr>' +
        ['State', 'Template', 'Audience', 'Recipients', 'Progress', 'When', ''].map(function (h) {
          return '<th style="text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.16);font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3;font-weight:500;white-space:nowrap">' + h + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        (sends.length ? sends.map(function (s) {
          var color = COLORS[s.state] || '#B7BCCB';
          var action = s.state === 'scheduled'
            ? '<button type="button" data-act="cancel-send" data-id="' + esc(s.id) + '" aria-label="Cancel ' + esc(s.template) + '" style="height:30px;padding:0 10px;border:1px solid rgba(255,255,255,0.16);border-radius:8px;background:transparent;color:#FF8AD0;font-size:12.5px;font-weight:600;cursor:pointer">Cancel</button>'
            : '<button type="button" data-act="report" data-id="' + esc(s.id) + '" class="scp5" aria-label="Report for ' + esc(s.template) + '" style="height:30px;padding:0 10px;border:1px solid rgba(255,255,255,0.16);border-radius:8px;background:transparent;color:#F2F4F8;font-size:12.5px;font-weight:600;cursor:pointer">Report</button>';
          return '<tr><td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08)"><span style="display:inline-flex;align-items:center;gap:7px;font-family:\'Geist Mono\',monospace;font-size:11px;color:' + color + '"><span style="width:6px;height:6px;background:' + color + ';display:inline-block"></span>' + s.state + '</span></td>' +
            '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:500">' + esc(s.template) + '</td>' +
            '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px;color:#B7BCCB">' + esc(s.audience) + '</td>' +
            '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px">' + s.count + '</td>' +
            '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3">' + esc(s.progress) + '</td>' +
            '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3;white-space:nowrap">' + esc(s.when) + '</td>' +
            '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap;text-align:right">' + action + '</td></tr>';
        }).join('') : emptyRow('Nothing sent yet.', 7)) + '</tbody></table></div></section>';
    }
    return html;
  }

  function renderTemplates() {
    var tpls = templates();
    return '<div><div style="font-family:\'Geist Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3;margin-bottom:6px">Email templates</div><h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;line-height:1.15">Templates</h1></div>' +
      '<section class="tf-card">' +
      cardHead('#8B90A3', 'Templates', tpls.length, '<a href="/admin/emails/new/" class="tf-card-link">+ New template</a>') +
      errorLine('stats') +
      (window.TF.emailTemplatesError ? '<div role="alert" style="padding:10px 18px;border-bottom:1px solid rgba(255,138,208,0.25);background:rgba(255,138,208,0.06);color:#FF8AD0;font-size:13px">' + esc(window.TF.emailTemplatesError) + '</div>' : '') +
      '<div class="tf-table-wrap"><table style="min-width:640px"><thead><tr>' +
      ['Template', 'Kind', 'Trigger', 'Sent', 'Open rate', 'Last sent', ''].map(function (h) {
        return '<th style="text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.16);font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3;font-weight:500;white-space:nowrap">' + h + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      tpls.map(function (t) {
        var kindColor = t.kind === 'auto' ? '#2EE8FF' : '#FF8AD0';
        return '<tr>' +
          '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08)"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:600">' + esc(t.name) + '</span>' + (t.hasAr ? '' : '<span style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#FBBF24;border:1px solid rgba(251,191,36,0.4);border-radius:6px;padding:2px 6px">EN only</span>') + '</div><div style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#8B90A3">' + esc(t.id) + '</div></td>' +
          '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08)"><span style="display:inline-flex;align-items:center;gap:7px;font-family:\'Geist Mono\',monospace;font-size:11px;color:' + kindColor + '"><span style="width:6px;height:6px;background:' + kindColor + ';display:inline-block"></span>' + t.kind + '</span></td>' +
          '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px;color:#B7BCCB">' + esc(t.trigger) + '</td>' +
          '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px">' + t.sent + '</td>' +
          '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3">' + esc(t.open) + '</td>' +
          '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3;white-space:nowrap">' + esc(t.last) + '</td>' +
          '<td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap;text-align:right">' + (t.kind === 'auto' ? '' : '<button type="button" data-act="use-tpl" data-tpl="' + esc(t.file || t.id) + '" style="height:30px;padding:0 10px;border:1px solid #2EE8FF;border-radius:8px;background:transparent;color:#2EE8FF;font-size:12.5px;font-weight:600;cursor:pointer">Use</button> ') + '<a href="/admin/emails/' + esc(t.file || t.id) + '/" style="display:inline-flex;align-items:center;height:30px;padding:0 10px;border:1px solid rgba(255,255,255,0.16);border-radius:8px;font-size:12.5px;font-weight:600;margin-left:6px">Edit</a></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function renderDialog() {
    if (!S.dlg || !S.dlg.length) return '';
    var ids = S.dlg.map(String);
    var recips = members.filter(function (m) { return ids.indexOf(String(m.id)) >= 0; });
    var emails = recips.map(function (m) { return m.email; });
    var shown = emails.slice(0, 4);
    var more = emails.length > 4 ? '+' + (emails.length - 4) + ' more' : '';
    var t = tplById(S.tpl);
    var subject = S.subject || t.subject;
    var later = S.when === 'later';
    var sendLabel = later ? 'Schedule' : ('Send' + (ids.length > 1 ? ' to ' + ids.length : ''));
    return '<div data-send-dialog data-act="dlg-close" style="position:fixed;inset:0;z-index:80;background:rgba(4,5,9,0.7);display:grid;place-items:center;padding:20px">' +
      '<div data-act="dlg-stop" data-two role="dialog" aria-modal="true" aria-labelledby="tf-send-dialog-title" style="width:min(1040px,100%);max-height:92vh;overflow:auto;background:#0E1017;border:1px solid rgba(255,255,255,0.16);border-radius:16px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)">' +
      '<div style="padding:22px;display:flex;flex-direction:column;gap:16px;border-right:1px solid rgba(255,255,255,0.08)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h3 id="tf-send-dialog-title" style="font-size:18px;font-weight:600;letter-spacing:-0.01em">Send email</h3><button type="button" data-act="dlg-close" aria-label="Close send dialog" style="width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#8B90A3;cursor:pointer;font-size:20px;line-height:1">×</button></div>' +
      '<div style="padding:10px 12px;background:#07080C;border:1px solid rgba(255,255,255,0.08);border-radius:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3;margin-right:4px">To · ' + emails.length + '</span>' +
      shown.map(function (e) { return '<span style="font-size:12.5px;padding:3px 8px;border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#B7BCCB">' + esc(e) + '</span>'; }).join('') +
      (more ? '<span style="font-size:12px;color:#7C8296">' + more + '</span>' : '') + '</div>' +
      '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Template' +
      '<div data-tf-select="tpl"></div></label>' +
      '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Subject' +
      '<input data-act="subject" value="' + esc(subject) + '" style="height:38px;padding:0 10px;background:#07080C;border:1px solid rgba(255,255,255,0.16);border-radius:10px;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:14px;outline:none"></label>' +
      '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3">Personal note <span style="color:#7C8296">(optional, inserted above the button)</span>' +
      '<textarea data-act="dlg-note" placeholder="e.g. Your screenshot was fine, the delay was on our side." style="min-height:72px;resize:vertical;padding:10px 12px;background:#07080C;border:1px solid rgba(255,255,255,0.16);border-radius:10px;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:14px;line-height:1.5;outline:none">' + esc(S.note) + '</textarea></label>' +
      '<div style="display:flex;gap:14px;align-items:center;font-size:13px;color:#8B90A3"><span>Language: each member\'s preference</span>' +
      '<div style="display:inline-flex;border:1px solid rgba(255,255,255,0.16);border-radius:10px;overflow:hidden;margin-left:auto">' +
      '<button type="button" data-act="when" data-when="now" style="height:32px;padding:0 12px;border:0;border-right:1px solid rgba(255,255,255,0.08);' + pill(!later) + ';font-size:13px;font-weight:500;cursor:pointer">Now</button>' +
      '<button type="button" data-act="when" data-when="later" style="height:32px;padding:0 12px;border:0;' + pill(later) + ';font-size:13px;font-weight:500;cursor:pointer">Schedule</button></div></div>' +
      (later ? renderDateTimePickers('') : '') +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08)">' +
      '<button type="button" data-act="dlg-send" class="btn-primary scp4" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font-size:14px;font-weight:600;cursor:pointer">' + sendLabel + '</button>' +
      '<button type="button" data-act="dlg-test" class="scp5" style="height:40px;padding:0 14px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;background:transparent;color:#F2F4F8;font-size:14px;font-weight:600;cursor:pointer">Send test to me</button>' +
      '<button type="button" data-act="dlg-close" style="margin-left:auto;height:40px;padding:0 10px;border:0;background:none;color:#8B90A3;font-size:14px;cursor:pointer">Cancel</button></div></div>' +
      '<div style="padding:22px;background:#0B0D13">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3">Preview · <b data-preview-subject style="color:#F2F4F8;font-weight:500">' + esc(S.previewSubject || subject) + '</b></span>' +
      '<div style="display:inline-flex;border:1px solid rgba(255,255,255,0.16);border-radius:8px;overflow:hidden">' +
      '<button type="button" data-act="pv" data-pv="en" style="height:28px;padding:0 10px;border:0;' + pill(S.pv === 'en') + ';font-size:12px;font-weight:600;cursor:pointer">EN</button>' +
      '<button type="button" data-act="pv" data-pv="ar" style="height:28px;padding:0 10px;border:0;border-left:1px solid rgba(255,255,255,0.08);' + pill(S.pv === 'ar') + ';font-size:12px;font-weight:600;cursor:pointer">AR</button></div></div>' +
      '<iframe title="Email preview" data-preview-frame style="width:100%;height:520px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:#fff;display:block"></iframe></div></div></div>';
  }

  function renderWaitlist() {
    return '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px">' +
      '<div><div style="font-family:\'Geist Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3;margin-bottom:6px">Waitlist</div><h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;line-height:1.15">Tools suite waitlist</h1></div>' +
      '<button type="button" data-act="export-wait" class="btn-neutral scp5" style="height:36px;padding:0 14px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer">Export CSV</button></div>' +
      '<section class="tf-card">' +
      cardHead('#8B90A3', 'Waitlist', waitlist.length, '<button type="button" data-act="email-waitlist" class="tf-card-link"' + (waitlist.length ? '' : ' disabled') + '>Email the waitlist →</button>') +
      errorLine('waitlist') +
      '<div class="tf-table-wrap"><table style="min-width:520px"><thead><tr>' +
      ['Email', 'Source', 'Language', 'Joined'].map(function (h) {
        return '<th style="text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.16);font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3;font-weight:500">' + h + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      (waitlist.length ? waitlist.map(function (w) {
        return '<tr><td style="padding:11px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:500">' + esc(w.email) + '</td><td style="padding:11px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px;color:#B7BCCB">' + esc(w.source) + '</td><td style="padding:11px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3">' + esc(w.lang) + '</td><td style="padding:11px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3">' + esc(w.joined) + '</td></tr>';
      }).join('') : emptyRow('No one on the waitlist yet.', 4)) + '</tbody></table></div></section>';
  }

  var dlgWasOpen = false;
  var untrapDlg = null;
  async function paint() {
    var main = document.querySelector('[data-admin-main]');
    if (!main || main.hasAttribute('data-email-editor')) return;
    var route = parseRoute();
    applyRoute();
    if (route.view === 'members') {
      var focusM = members.filter(function (m) { return String(m.id) === String(S.focus); })[0];
      await signMemberProofs(focusM);
    }
    var c = countsOf();
    // innerHTML replaces every node, so remember where focus was and put it back on the matching control.
    var active = document.activeElement;
    var focusSel = active && main.contains(active) ? selectorFor(active) : '';
    var html = '';
    if (route.view === 'overview') html = renderOverview(c);
    else if (route.view === 'members') html = renderMembers(c) + renderDialog();
    else if (route.view === 'campaigns') html = renderCampaigns(c);
    else if (route.view === 'emails') html = renderTemplates();
    else html = renderWaitlist();
    main.innerHTML = html;
    bind(main);
    mountTplSelects(main);
    var dlgOpen = !!(route.view === 'members' && S.dlg && S.dlg.length);
    var dlgPanel = dlgOpen ? main.querySelector('[data-send-dialog] [role="dialog"]') : null;
    if (untrapDlg) { untrapDlg(); untrapDlg = null; }
    if (dlgPanel) untrapDlg = trapFocus(dlgPanel);
    if (dlgOpen && !dlgWasOpen && dlgPanel) focusFirst(dlgPanel);
    else if (!dlgOpen && dlgWasOpen) {
      var back = S.dlgOpener ? main.querySelector(S.dlgOpener) : null;
      if (back) back.focus();
      S.dlgOpener = '';
    } else if (focusSel) {
      var again = main.querySelector(focusSel);
      if (again && again.getAttribute('data-act') !== 'search') again.focus();
    }
    dlgWasOpen = dlgOpen;
    var needsPreview = (route.view === 'campaigns' && route.tab === 'compose') || dlgOpen;
    if (needsPreview) {
      var out = await previewHtml();
      var frame = main.querySelector('[data-preview-frame]');
      if (frame) frame.srcdoc = out.html || '';
      var subEl = main.querySelector('[data-preview-subject]');
      if (subEl) subEl.textContent = out.subject || S.previewSubject || '';
    }
    if (route.view === 'campaigns' && route.tab === 'compose') refreshAudienceCount();
    if (route.view === 'campaigns' && route.tab === 'history') runDueOnce();
    if (window.TF.mountAdminShell) window.TF.mountAdminShell(route.view);
  }

  function mountTplSelects(root) {
    if (!window.TF.mountSelect || !root) return;
    var tpls = campaignTemplates();
    var current = tpls.filter(function (t) { return t.id === S.tpl || t.file === S.tpl; })[0] || tpls[0];
    if (current) S.tpl = current.file || current.id;
    var hosts = root.querySelectorAll('[data-tf-select="tpl"]');
    for (var i = 0; i < hosts.length; i++) {
      window.TF.mountSelect(hosts[i], {
        value: S.tpl,
        options: tpls.map(function (x) { return { value: x.file || x.id, label: x.name }; }),
        ariaLabel: 'Template',
        onChange: function (v) { S.tpl = v; S.subject = ''; paint(); }
      });
    }
  }

  function countPayload() {
    var t = tplById(S.tpl);
    return { action: 'count', templateId: t.file || t.id, audience: S.audience, lang: campaignSendLang(), skipRecent: !!S.skipRecent };
  }
  function paintCount() {
    var label = S.count == null ? '…' : String(S.count);
    var el = document.querySelector('[data-recip-count]');
    if (el) el.textContent = label;
    var btn = document.querySelector('[data-recip-count-btn]');
    if (btn) btn.textContent = label;
    var err = document.querySelector('[data-count-error]');
    if (err) { err.textContent = S.countError; err.style.display = S.countError ? '' : 'none'; }
  }
  // Debounced: every change of audience / language / skip asks the API for the real recipient count.
  function refreshAudienceCount(force) {
    var key = JSON.stringify(countPayload());
    if (!force && key === S.countKey && (S.count != null || S.countError)) { paintCount(); return; }
    S.countKey = key;
    S.count = null;
    S.countError = '';
    paintCount();
    clearTimeout(countTimer);
    var seq = ++countSeq;
    countTimer = setTimeout(async function () {
      var res;
      try { res = await window.TF.api('/api/admin/campaigns', { body: countPayload() }); }
      catch (e) { res = { ok: false, body: { message: (e && e.message) || 'Network error' } }; }
      if (seq !== countSeq) return;
      if (!res.ok) {
        S.count = null;
        S.countError = 'Could not count recipients: ' + apiMessage(res);
        toast(S.countError);
      } else {
        S.count = Number(res.body && res.body.count) || 0;
        S.countError = '';
      }
      paintCount();
      if (S.count == null) {
        var el = document.querySelector('[data-recip-count]');
        if (el) el.textContent = '—';
        var btn = document.querySelector('[data-recip-count-btn]');
        if (btn) btn.textContent = '—';
      }
    }, 250);
  }
  // Scheduled sends are processed server-side; the history page nudges the runner once per visit.
  async function runDueOnce() {
    if (ranDue) return;
    ranDue = true;
    var res;
    try { res = await window.TF.api('/api/admin/campaigns', { body: { action: 'run-due' } }); }
    catch (e) { return; }
    if (res.ok && Number(res.body && res.body.processed) > 0) {
      try { await loadSends(); } catch (e2) { fail('sends', e2.message); }
      await paint();
    }
  }
  async function reloadSends() {
    delete loadErrors.sends;
    try { await loadSends(); } catch (e) { sends = []; fail('sends', e.message); }
  }

  function memberCsv(list) {
    return 'email,status,submitted,lang,country,note\n' + list.map(function (m) {
      return [m.email, m.status, m.submitted, m.lang, m.country || '', m.note].map(csvEscape).join(',');
    }).join('\n');
  }

  async function onAction(act, el) {
    if (act === 'search') {
      S.qInput = el.value;
      clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        S.q = S.qInput;
        if (window.history && history.replaceState) history.replaceState({ tf: 1 }, '', membersUrl());
        paint();
      }, 250);
      return;
    }
    if (act === 'act-filter') {
      S.actFilter = el.getAttribute('data-filter') || 'all';
      paint();
      return;
    }
    if (act === 'filter') {
      S.filter = el.getAttribute('data-filter');
      S.selected = new Set();
      writeSelected(S.selected);
      go(membersUrl());
      return;
    }
    if (act === 'sort') {
      var key = el.getAttribute('data-sort');
      S.dir = S.sort === key ? -S.dir : -1;
      S.sort = key;
      if (window.history && history.replaceState) history.replaceState({ tf: 1 }, '', membersUrl());
      paint();
      return;
    }
    if (act === 'open') {
      S.focus = el.getAttribute('data-id');
      if (window.history && history.replaceState) history.replaceState({ tf: 1 }, '', membersUrl());
      paint();
      return;
    }
    if (act === 'toggle') {
      var id = String(el.getAttribute('data-id'));
      if (S.selected.has(id)) S.selected.delete(id); else S.selected.add(id);
      writeSelected(S.selected);
      paint();
      return;
    }
    if (act === 'toggle-all') {
      var list = filteredMembers();
      var allSel = list.length > 0 && list.every(function (m) { return S.selected.has(String(m.id)); });
      S.selected = allSel ? new Set() : new Set(list.map(function (m) { return String(m.id); }));
      writeSelected(S.selected);
      paint();
      return;
    }
    if (act === 'clear-sel') {
      S.selected = new Set();
      writeSelected(S.selected);
      paint();
      return;
    }
    if (act === 'export' || act === 'export-sel') {
      var rows = act === 'export-sel' ? members.filter(function (m) { return S.selected.has(String(m.id)); }) : filteredMembers();
      downloadCsv(act === 'export-sel' ? 'talaria-selected.csv' : 'talaria-members.csv', memberCsv(rows));
      return;
    }
    if (act === 'bulk-approve') {
      var ok = await dialog({ title: 'Approve ' + S.selected.size + ' members?', body: 'Sets status to approved and sends the confirmation email to each member with a submission.', ok: 'Approve all' });
      if (!ok) return;
      await decide(Array.from(S.selected), 'approved');
      return;
    }
    if (act === 'bulk-reject') {
      var res = await dialog({ title: 'Request resubmission', body: 'This reason is sent to every selected member with a submission.', textarea: true, placeholder: 'e.g. Email address isn\'t visible in the screenshot.', ok: 'Request resubmission', langPick: true, lang: 'en' });
      if (!res || !res.ok) return;
      if (!String(res.text || '').trim()) { toast('Add a reason before requesting resubmission.'); return; }
      await decide(Array.from(S.selected), 'rejected', res.text.trim(), res.lang);
      return;
    }
    if (act === 'bulk-email' || act === 'email-one' || act === 'row-email') {
      var ids = act === 'bulk-email' ? Array.from(S.selected) : [String(el.getAttribute('data-id') || S.focus)];
      openDlg(ids, el);
      return;
    }
    if (act === 'row-menu') {
      if (rowMenuEl && rowMenuEl.querySelector('[data-id="' + el.getAttribute('data-id') + '"]')) { closeRowMenu(); return; }
      openRowMenu(el);
      return;
    }
    if (act === 'row-approve') {
      S.focus = el.getAttribute('data-id');
      await decide([S.focus], 'approved');
      return;
    }
    if (act === 'row-reject' || act === 'resubmit' || act === 'reject') {
      S.focus = el.getAttribute('data-id') || S.focus;
      var rowMem = members.filter(function (x) { return String(x.id) === String(S.focus); })[0];
      var rowRes = await dialog({ title: 'Request resubmission', body: 'This reason is sent with the resubmission email. The member can upload again.', textarea: true, placeholder: 'e.g. Email address isn\'t visible in the screenshot.', ok: 'Request resubmission', langPick: true, lang: rowMem && rowMem.lang === 'ar' ? 'ar' : 'en' });
      if (!rowRes || !rowRes.ok) return;
      if (!String(rowRes.text || '').trim()) { toast('Add a reason before requesting resubmission.', 'error'); return; }
      await decide([S.focus], 'rejected', rowRes.text.trim(), rowRes.lang);
      return;
    }
    if (act === 'row-block' || act === 'block') {
      S.focus = el.getAttribute('data-id') || S.focus;
      var blockMem = members.filter(function (x) { return String(x.id) === String(S.focus); })[0];
      var blockRes = await dialog({ title: 'Reject this application?', body: 'Sends a rejection email. The member cannot upload again until you restore access.', textarea: true, placeholder: 'e.g. We cannot accept this application.', ok: 'Reject', langPick: true, lang: blockMem && blockMem.lang === 'ar' ? 'ar' : 'en' });
      if (!blockRes || !blockRes.ok) return;
      if (!String(blockRes.text || '').trim()) { toast('Add a reason before rejecting.', 'error'); return; }
      await decide([S.focus], 'blocked', blockRes.text.trim(), blockRes.lang);
      return;
    }
    if (act === 'row-restore' || act === 'restore') {
      S.focus = el.getAttribute('data-id') || S.focus;
      if (!S.focus) { toast('Select a member first.'); return; }
      await decide([S.focus], 'restore');
      return;
    }
    if (act === 'dlg-close') {
      S.dlg = null;
      closePickers();
      paint();
      return;
    }
    if (act === 'dlg-stop') return;
    if (act === 'dlg-note') { S.note = el.value; return; }
    if (act === 'dlg-test') {
      await onAction('test-send', el);
      return;
    }
    if (act === 'dlg-send') {
      if (!S.dlg || !S.dlg.length || S.busy) return;
      var dlgIds = S.dlg.map(String);
      var dlgRecips = members.filter(function (m) { return dlgIds.indexOf(String(m.id)) >= 0; });
      if (!dlgRecips.length) { toast('That audience is empty.'); return; }
      var dlgLater = S.when === 'later';
      var dlgTpl = tplById(S.tpl);
      if (!dlgTpl || !dlgTpl.file) { toast('Pick a template first.'); return; }
      if (dlgTpl.kind === 'auto') { toast('That template sends automatically.'); return; }
      var dlgBody = {
        action: 'create',
        templateId: dlgTpl.file,
        audience: 'all',
        lang: campaignSendLang(),
        skipRecent: false,
        memberIds: dlgRecips.map(function (m) { return m.id; }),
      };
      var dlgSubject = subjectForSend(dlgTpl);
      if (dlgSubject) dlgBody.subject = dlgSubject;
      if (String(S.note || '').trim()) dlgBody.note = S.note.trim();
      if (dlgLater) {
        var dlgIso = scheduledIso();
        if (!dlgIso) { toast('Pick a date and time first.'); return; }
        if (new Date(dlgIso).getTime() <= Date.now()) { toast('That time is in the past. Pick a later time or send now.'); return; }
        dlgBody.scheduledFor = dlgIso;
      }
      S.busy = true;
      var dlgRes;
      try { dlgRes = await window.TF.api('/api/admin/campaigns', { body: dlgBody }); }
      catch (eDlg) { dlgRes = { ok: false, body: { message: (eDlg && eDlg.message) || 'Network error' } }; }
      finally { S.busy = false; }
      if (!dlgRes.ok) { toast(apiMessage(dlgRes, 'Could not create the send.')); return; }
      var dlgSend = sendRow(dlgRes.body && dlgRes.body.send);
      toast(sendToast(dlgSend));
      S.dlg = null;
      S.selected = new Set();
      writeSelected(S.selected);
      S.note = '';
      S.subject = '';
      closePickers();
      await paint();
      await loadLive();
      paint();
      return;
    }
    if (act === 'approve') {
      await decide([S.focus], 'approved');
      return;
    }
    if (act === 'reason') { S.reason = el.value; return; }
    if (act === 'lightbox') { lightbox(el.getAttribute('data-src'), el.getAttribute('data-url')); return; }
    if (act === 'email-hist') { go('/admin/campaigns/history/'); return; }
    if (act === 'reset-pw') {
      var rm = members.filter(function (x) { return String(x.id) === String(S.focus); })[0];
      if (!rm) return;
      var rr = await window.TF.api('/api/admin/member', { body: { action: 'reset-password', id: rm.id } });
      toast(rr.ok ? 'Password reset sent to ' + rm.email + '.' : apiMessage(rr, 'Could not send the reset email.'), rr.ok ? 'ok' : 'error');
      return;
    }
    if (act === 'delete') {
      var m = members.filter(function (x) { return String(x.id) === String(S.focus); })[0];
      if (!m) return;
      var sure = await dialog({ title: 'Delete ' + m.email + '?', body: 'This removes the member, their submissions and proof files. It cannot be undone.', ok: 'Delete member' });
      if (!sure) return;
      var dr = await window.TF.api('/api/admin/member', { body: { action: 'delete', id: m.id } });
      if (!dr.ok) { toast(apiMessage(dr, 'Could not delete this member.'), 'error'); return; }
      members = members.filter(function (x) { return String(x.id) !== String(m.id); });
      S.selected.delete(String(m.id));
      writeSelected(S.selected);
      S.focus = members[0] ? members[0].id : '';
      toast('Member deleted.', 'ok');
      await loadLive();
      paint();
      return;
    }
    if (act === 'tpl') { S.tpl = el.value; S.subject = ''; paint(); return; }
    if (act === 'subject') { S.subject = el.value; return; }
    if (act === 'audience') { S.audience = el.getAttribute('data-audience'); paint(); return; }
    if (act === 'langf') {
      S.langF = el.getAttribute('data-langf');
      if (S.langF === 'all') S.pv = 'en';
      else if (S.langF === 'ar' || S.langF === 'en') S.pv = S.langF;
      paint();
      return;
    }
    if (act === 'skip') { S.skipRecent = el.checked; paint(); return; }
    if (act === 'when') { S.when = el.getAttribute('data-when'); closePickers(); paint(); return; }
    if (act === 'cal-toggle') { S.calOpen = !S.calOpen; S.clkOpen = false; paint(); return; }
    if (act === 'clk-toggle') { S.clkOpen = !S.clkOpen; S.calOpen = false; paint(); return; }
    if (act === 'cal-prev' || act === 'cal-next') {
      var base = S.calView ? new Date(S.calView + '-01T00:00:00') : (S.date ? new Date(S.date + 'T00:00:00') : new Date());
      var next = new Date(base.getFullYear(), base.getMonth() + (act === 'cal-next' ? 1 : -1), 1);
      S.calView = next.getFullYear() + '-' + pad2(next.getMonth() + 1);
      paint();
      return;
    }
    if (act === 'cal-day') {
      var iso = el.getAttribute('data-iso');
      if (iso) S.date = iso;
      S.calOpen = false;
      paint();
      return;
    }
    if (act === 'cal-tomorrow') {
      var tmr = startOfToday();
      tmr.setDate(tmr.getDate() + 1);
      S.date = isoDay(tmr);
      S.calView = tmr.getFullYear() + '-' + pad2(tmr.getMonth() + 1);
      S.calOpen = false;
      paint();
      return;
    }
    if (act === 'cal-done') { S.calOpen = false; paint(); return; }
    if (act === 'clk-pick') { S.time = el.getAttribute('data-time') || S.time; S.clkOpen = false; paint(); return; }
    if (act === 'pv') {
      S.pv = el.getAttribute('data-pv');
      if (S.pv === 'ar' || S.pv === 'en') S.langF = S.pv;
      paint();
      return;
    }
    if (act === 'use-tpl') {
      var use = tplById(el.getAttribute('data-tpl'));
      if (!use || use.kind === 'auto') { toast('That template sends automatically.'); return; }
      S.tpl = use.id; S.subject = ''; go('/admin/campaigns/?tpl=' + encodeURIComponent(use.file || use.id)); return;
    }
    if (act === 'email-waitlist') { S.audience = 'waitlist'; S.tpl = '09'; S.subject = ''; go('/admin/campaigns/?audience=waitlist&tpl=09'); return; }
    if (act === 'export-wait') {
      downloadCsv('talaria-waitlist.csv', 'email,source,lang,joined\n' + waitlist.map(function (w) {
        return [w.email, w.source, w.lang, w.joined].map(csvEscape).join(',');
      }).join('\n'));
      return;
    }
    if (act === 'cancel-send') {
      var cancelId = el.getAttribute('data-id');
      var target = sends.filter(function (s) { return String(s.id) === String(cancelId); })[0];
      var sureCancel = await dialog({ title: 'Cancel this send?', body: (target ? esc(target.template) + ' to ' + target.count + ' recipients, ' + esc(target.when) + '. ' : '') + 'Nothing is sent and the row stays in history as cancelled.', ok: 'Cancel send' });
      if (!sureCancel) return;
      var cr;
      try { cr = await window.TF.api('/api/admin/campaigns', { body: { action: 'cancel', id: cancelId } }); }
      catch (eC) { cr = { ok: false, body: { message: (eC && eC.message) || 'Network error' } }; }
      if (!cr.ok) {
        toast(cr.status === 409 ? 'Too late — this send has already started.' : apiMessage(cr, 'Could not cancel the send.'));
        await reloadSends();
        paint();
        return;
      }
      var updated = sendRow(cr.body && cr.body.send);
      sends = sends.map(function (s) { return String(s.id) === String(updated.id) ? updated : s; });
      toast('Send cancelled.');
      paint();
      return;
    }
    if (act === 'report') {
      var send = sends.filter(function (s) { return String(s.id) === String(el.getAttribute('data-id')); })[0];
      if (!send) return;
      var lines = [
        '<b style="color:#F2F4F8">' + esc(send.state) + '</b> · ' + esc(send.audience),
        'Recipients ' + send.count + ' · Sent ' + send.sent + ' · Opened ' + send.opened + (send.count ? ' (' + Math.round((send.opened / Math.max(1, send.sent)) * 100) + '% of sent)' : ''),
        (send.state === 'scheduled' ? 'Scheduled for ' : 'Finished ') + esc(send.when),
      ];
      if (send.subject) lines.push('Subject: ' + esc(send.subject));
      if (send.lang && send.lang !== 'all') lines.push('Language: ' + esc(String(send.lang).toUpperCase()));
      if (send.note) lines.push('Note: ' + esc(send.note));
      if (send.error) lines.push('<span style="color:#FF8AD0">Error: ' + esc(send.error) + '</span>');
      await dialog({ title: send.template, body: lines.join('<br>'), ok: 'Close' });
      return;
    }
    if (act === 'test-send') {
      var auth = window.TF.getCurrentUser ? await window.TF.getCurrentUser() : null;
      var email = auth && auth.user && auth.user.email;
      if (!email) { toast('Sign in again to send a test.'); return; }
      var t = tplById(S.tpl);
      var testRes;
      try { testRes = await window.TF.api('/api/admin/emails/test', { body: { id: t.file || t.id, lang: S.pv === 'ar' ? 'ar' : 'en', to: email } }); }
      catch (eT) { testRes = { ok: false, body: { message: (eT && eT.message) || 'Network error' } }; }
      toast(testRes.ok ? 'Test sent to ' + email + '.' : apiMessage(testRes, 'Test send failed.'));
      return;
    }
    if (act === 'submit-send') {
      if (S.busy) return;
      var t = tplById(S.tpl);
      if (!t || !t.file) { toast('Pick a template first.'); return; }
      if (t.kind === 'auto') { toast('That template sends automatically.'); return; }
      var later = S.when === 'later';
      var body = {
        action: 'create',
        templateId: t.file,
        audience: S.audience,
        lang: campaignSendLang(),
        skipRecent: !!S.skipRecent,
      };
      var customSubject = subjectForSend(t);
      if (customSubject) body.subject = customSubject;
      if (later) {
        var iso = scheduledIso();
        if (!iso) { toast('Pick a date and time first.'); return; }
        if (new Date(iso).getTime() <= Date.now()) { toast('That time is in the past. Pick a later time or send now.'); return; }
        body.scheduledFor = iso;
      } else {
        if (S.count === 0) { toast('That audience is empty.'); return; }
        var sendLang = campaignSendLang();
        var langLine = sendLang === 'ar'
          ? 'Everyone receives the Arabic email — the same version as the preview.'
          : sendLang === 'en'
            ? 'Everyone receives the English email.'
            : 'Each member receives their own language (EN or AR). Click AR in the preview to send Arabic to everyone.';
        var okSend = await dialog({ title: 'Send to ' + (S.count == null ? 'this audience' : S.count) + ' now?', body: langLine + ' This cannot be undone once it starts.', ok: 'Send now' });
        if (!okSend) return;
      }
      S.busy = true;
      var created;
      try { created = await window.TF.api('/api/admin/campaigns', { body: body }); }
      catch (eS) { created = { ok: false, body: { message: (eS && eS.message) || 'Network error' } }; }
      finally { S.busy = false; }
      if (!created.ok) { toast(apiMessage(created, 'Could not create the campaign.')); return; }
      var createdRow = sendRow(created.body && created.body.send);
      sends.unshift(createdRow);
      toast(sendToast(createdRow));
      S.subject = '';
      go('/admin/campaigns/history/');
    }
  }
  function sendToast(s) {
    if (s.state === 'scheduled') return 'Scheduled for ' + s.when + ' · ' + s.count + ' recipient' + (s.count === 1 ? '' : 's') + '.';
    if (s.state === 'failed') return 'Send failed' + (s.error ? ': ' + s.error : '.') + ' ' + s.sent + '/' + s.count + ' delivered.';
    if (s.state === 'sending') return 'Sending to ' + s.count + ' recipient' + (s.count === 1 ? '' : 's') + '…';
    if (!s.count || Number(s.sent) === 0) return 'Nobody was emailed. They may have this category turned off, or the list was empty.';
    return 'Sent ' + s.sent + '/' + s.count + ' · ' + s.template + '.';
  }

  function bind(main) {
    if (main.__tfBound) return;
    main.__tfBound = true;
    main.addEventListener('click', function (e) {
      if (e.target.closest('[data-pop]')) e.stopPropagation();
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var act = el.getAttribute('data-act');
      if (act === 'search' || act === 'subject' || act === 'reason' || act === 'tpl' || act === 'skip' || act === 'dlg-note') return;
      if (act === 'dlg-stop') { e.stopPropagation(); return; }
      e.preventDefault();
      onAction(act, el);
    });
    main.addEventListener('input', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var act = el.getAttribute('data-act');
      if (act === 'search' || act === 'subject' || act === 'reason' || act === 'dlg-note') onAction(act, el);
    });
    main.addEventListener('change', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var act = el.getAttribute('data-act');
      if (act === 'tpl' || act === 'skip' || act === 'toggle' || act === 'toggle-all') onAction(act, el);
    });
  }

  window.TF.mountAdminApp = async function () {
    var main = document.querySelector('[data-admin-main]');
    if (!main || main.hasAttribute('data-email-editor')) return;
    if (window.TF.readyEmails) {
      try {
        await Promise.race([
          window.TF.readyEmails,
          new Promise(function (resolve) { setTimeout(resolve, 8000); }),
        ]);
      } catch (e) {}
    }
    ranDue = false;
    dlgWasOpen = false;
    S.dlg = null;
    S.count = null;
    S.countKey = '';
    if (window.TF.emailTemplatesError) toast(window.TF.emailTemplatesError);
    await loadLive();
    applyRoute();
    if (!S.focus && members[0]) S.focus = members[0].id;
    if (!window.__tfDlgEsc) {
      window.__tfDlgEsc = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          if (rowMenuEl) { closeRowMenu(); return; }
          if (S.calOpen || S.clkOpen) { closePickers(); paint(); return; }
          if (S.dlg) { S.dlg = null; paint(); }
        }
      });
      document.addEventListener('click', function (e) {
        var item = e.target.closest && e.target.closest('[data-admin-row-menu] [data-act]');
        if (item) {
          e.preventDefault();
          e.stopPropagation();
          var act = item.getAttribute('data-act');
          closeRowMenu();
          onAction(act, item);
          return;
        }
        if (rowMenuEl && !e.target.closest('[data-act="row-menu"]') && !e.target.closest('[data-admin-row-menu]')) closeRowMenu();
        if (!S.calOpen && !S.clkOpen) return;
        if (e.target.closest('[data-pop]')) return;
        closePickers();
        paint();
      });
    }
    await paint();
    mounted = true;
  };

  if (window.TF.useSession && !window.__tfAdminSessionBound) {
    window.__tfAdminSessionBound = true;
    window.TF.useSession(function (state) {
      if (!document.querySelector('[data-admin-main]')) return;
      if (!state || !state.user || !state.isAdmin) return;
      if (mounted) paint();
    });
  }

  function boot() {
    if (document.querySelector('[data-admin-main]') && !document.querySelector('[data-email-editor]')) {
      window.TF.mountAdminApp();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
