(function () {
  window.TF = window.TF || {};

  var COLORS = { none: '#8B90A3', review: '#FBBF24', approved: '#2EE8FF', rejected: '#FF8AD0', blocked: '#FF37B0' };
  var MODULES = [
    ['Auction Market Theory', 4],
    ['Volume Profile & Market Profile', 6],
    ['Footprint charts', 5],
    ['Delta and cumulative delta', 4],
    ['VWAP and anchored VWAP', 3],
    ['Absorption, imbalance, exhaustion', 4],
    ['Building a session plan', 4],
  ];
  var T = {
    en: {
      account: 'Account', hello: 'Welcome back', memberSince: 'Member since', logout: 'Log out',
      nav: ['Overview', 'Course access', 'Course', 'Profile', 'Notifications'],
      courseAccess: 'Course access', course: 'Course', courseTitle: 'Free order flow course', recent: 'Recent activity',
      profile: 'Profile', notifications: 'Notifications', name: 'Name', emailLabel: 'Email',
      emailNote: 'This is your login and where course emails go. Contact support to change it.',
      language: 'Language', languageNote: 'Used for the site and every email we send you.',       save: 'Save changes',
      password: 'Password', passwordNote: 'Use a strong phrase you do not use anywhere else.', change: 'Change',
      pwCurrent: 'Current password', pwNew: 'New password', pwRepeat: 'Repeat new password',
      pwRule: 'At least 8 characters. Use a phrase you do not use anywhere else.', pwSave: 'Update password', cancel: 'Cancel',
      pwUpdated: 'Password updated',
      deleteAccount: 'Delete account', deleteNote: 'Removes your account and uploaded screenshots. Course access cannot be restored.', delete: 'Delete',
      saved: 'Saved.', saveFailed: 'Could not save. Try again.', deleted: 'Account deleted.',
      deleteTitle: 'Delete your account?', deleteConfirm: 'Delete account',
      deletePassword: 'Enter your password to confirm',
      country: 'Country',
      tags: { none: 'Not submitted', review: 'Under review', approved: 'Approved', rejected: 'Needs resubmission', blocked: 'Rejected' },
      accessBody: {
        none: 'Two screenshots are required: (1) the NinjaTrader dashboard showing "Welcome, your name" and (2) the NinjaTrader Web trading platform (Simulation). Up to two more are optional. Blur anything private; keep your email or username visible.',
        review: 'A person is checking your screenshots. You will get an email either way.',
        approved: 'Your registration is confirmed. Course access lands here before 31 December 2026.',
        rejected: 'The reviewer asked for a clearer screenshot. Upload again to continue.',
        blocked: 'This application was rejected. Contact admin support — you cannot upload again until access is restored.',
      },
      accessCta: { none: 'Upload proof', review: 'View submission', approved: 'View details', rejected: 'Upload again', blocked: 'Contact support' },
      resubmitNotice: 'Your last submission was not accepted. Upload new screenshots to continue.',
      resubmitCta: 'Upload again',
      blockedNotice: 'Your application was rejected. Contact admin support — you cannot submit again until an admin restores your access.',
      blockedCta: 'Email admin support',
      courseBodyLocked: 'Opens once your course access is approved and released.',
      courseBodyOpen: 'The seven-module list is unlocked. Full video playback is not in the dashboard yet — use the public curriculum for the outline.',
      courseCtaLocked: 'See what is inside', courseCtaOpen: 'View curriculum',
      lockedBody: 'The course opens for approved members before 31 December 2026. Module titles are revealed at release. Until then, get NinjaTrader set up.',
      modState: { locked: 'Locked', open: 'Open', done: 'Done' },
      videos: function (n) { return n + ' videos · notes PDF'; },
      noActivity: 'No activity yet.',
      activityKinds: { proof: 'You uploaded {n} screenshot(s)', decision_approved: 'Your proof was approved', decision_rejected: 'The reviewer asked you to upload again', decision_blocked: 'Your application was rejected', account: 'Account created', reset: 'Password reset requested' },
      yourFiles: 'Your files', noFiles: 'No files on record.',
      prefs: [
        ['review', 'Review updates', 'Approved, needs resubmission and other decisions about your proof. Always on.'],
        ['course', 'Course emails', 'Module releases, lesson notes and access announcements.'],
        ['newsletter', 'Newsletter', 'Occasional order flow notes from the team.'],
        ['tools', 'Tools suite news', 'Launch and updates for the Talaria Flow indicators.'],
      ],
      resendEmail: 'Resend the “proof received” email',
      resendOk: 'Proof-received email sent.',
      resendFail: 'Could not send the email. Try again.',
      moduleLocked: 'Module {n}',
    },
  };
  var NAV = [
    { key: 'overview', href: '/account/' },
    { key: 'access', href: '/account/access/' },
    { key: 'course', href: '/account/course/' },
    { key: 'profile', href: '/account/profile/' },
    { key: 'notif', href: '/account/notifications/' },
  ];
  var S = {
    email: '',
    name: '',
    firstName: '',
    lastName: '',
    country: '',
    since: '',
    state: 'none',
    released: false,
    progress: {},
    prefs: { review: true, course: true, newsletter: true, tools: false },
    activity: [],
    files: [],
    reason: '',
    resubmitNote: '',
    blocked: false,
    pwOpen: false,
    pwOk: false,
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function lang() {
    return (window.TF.currentLang && window.TF.currentLang()) || localStorage.getItem('tf-lang') || 'en';
  }
  function t() {
    var loc = lang() === 'ar' ? 'ar' : 'en';
    var base = T.en;
    var lookup = window.TF && window.TF.lookup;
    if (!lookup) return base;
    function str(key, fallback) {
      var hit = lookup('accountApp.' + key, loc);
      return hit != null ? hit : fallback;
    }
    return {
      account: str('account', base.account),
      hello: str('hello', base.hello),
      memberSince: str('memberSince', base.memberSince),
      logout: str('logout', base.logout),
      nav: [0, 1, 2, 3, 4].map(function (i) { return str('nav.' + i, base.nav[i]); }),
      courseAccess: str('courseAccess', base.courseAccess),
      course: str('course', base.course),
      courseTitle: str('courseTitle', base.courseTitle),
      recent: str('recent', base.recent),
      profile: str('profile', base.profile),
      notifications: str('notifications', base.notifications),
      name: str('name', base.name),
      emailLabel: str('emailLabel', base.emailLabel),
      emailNote: str('emailNote', base.emailNote),
      language: str('language', base.language),
      languageNote: str('languageNote', base.languageNote),
      save: str('save', base.save),
      password: str('password', base.password),
      passwordNote: str('passwordNote', base.passwordNote),
      change: str('change', base.change),
      pwCurrent: str('pwCurrent', base.pwCurrent),
      pwNew: str('pwNew', base.pwNew),
      pwRepeat: str('pwRepeat', base.pwRepeat),
      pwRule: str('pwRule', base.pwRule),
      pwSave: str('pwSave', base.pwSave),
      cancel: str('cancel', base.cancel),
      pwUpdated: str('pwUpdated', base.pwUpdated),
      deleteAccount: str('deleteAccount', base.deleteAccount),
      deleteNote: str('deleteNote', base.deleteNote),
      delete: str('delete', base.delete),
      saved: str('saved', base.saved),
      saveFailed: str('saveFailed', base.saveFailed),
      deleted: str('deleted', base.deleted),
      deleteTitle: str('deleteTitle', base.deleteTitle),
      deleteConfirm: str('deleteConfirm', base.deleteConfirm),
      deletePassword: str('deletePassword', base.deletePassword),
      country: str('country', base.country),
      tags: {
        none: str('tags.none', base.tags.none),
        review: str('tags.review', base.tags.review),
        approved: str('tags.approved', base.tags.approved),
        rejected: str('tags.rejected', base.tags.rejected),
        blocked: str('tags.blocked', base.tags.blocked),
      },
      accessBody: {
        none: str('accessBody.none', base.accessBody.none),
        review: str('accessBody.review', base.accessBody.review),
        approved: str('accessBody.approved', base.accessBody.approved),
        rejected: str('accessBody.rejected', base.accessBody.rejected),
        blocked: str('accessBody.blocked', base.accessBody.blocked),
      },
      accessCta: {
        none: str('accessCta.none', base.accessCta.none),
        review: str('accessCta.review', base.accessCta.review),
        approved: str('accessCta.approved', base.accessCta.approved),
        rejected: str('accessCta.rejected', base.accessCta.rejected),
        blocked: str('accessCta.blocked', base.accessCta.blocked),
      },
      resubmitNotice: str('resubmitNotice', base.resubmitNotice),
      resubmitCta: str('resubmitCta', base.resubmitCta),
      blockedNotice: str('blockedNotice', base.blockedNotice),
      blockedCta: str('blockedCta', base.blockedCta),
      courseBodyLocked: str('courseBodyLocked', base.courseBodyLocked),
      courseBodyOpen: str('courseBodyOpen', base.courseBodyOpen),
      courseCtaLocked: str('courseCtaLocked', base.courseCtaLocked),
      courseCtaOpen: str('courseCtaOpen', base.courseCtaOpen),
      lockedBody: str('lockedBody', base.lockedBody),
      modState: {
        locked: str('modState.locked', base.modState.locked),
        open: str('modState.open', base.modState.open),
        done: str('modState.done', base.modState.done),
      },
      videos: function (n) {
        var tmpl = lookup('accountApp.videos', loc);
        return tmpl ? tmpl.replace('{n}', n) : base.videos(n);
      },
      noActivity: str('noActivity', base.noActivity),
      activityKinds: {
        proof: str('activityKinds.proof', base.activityKinds.proof),
        decision_approved: str('activityKinds.decision_approved', base.activityKinds.decision_approved),
        decision_rejected: str('activityKinds.decision_rejected', base.activityKinds.decision_rejected),
        decision_blocked: str('activityKinds.decision_blocked', base.activityKinds.decision_blocked),
        account: str('activityKinds.account', base.activityKinds.account),
        reset: str('activityKinds.reset', base.activityKinds.reset),
      },
      yourFiles: str('yourFiles', base.yourFiles),
      noFiles: str('noFiles', base.noFiles),
      resendEmail: str('resendEmail', base.resendEmail),
      resendOk: str('resendOk', base.resendOk),
      resendFail: str('resendFail', base.resendFail),
      moduleLocked: str('moduleLocked', base.moduleLocked),
      prefs: base.prefs.map(function (p) {
        return [p[0], str('prefs.' + p[0] + '.title', p[1]), str('prefs.' + p[0] + '.body', p[2])];
      }),
    };
  }
  function tdir() { return lang() === 'ar' ? 'rtl' : 'ltr'; }
  function lsH() { return lang() === 'ar' ? '0' : '-0.02em'; }
  function ident() {
    if (window.TF.memberIdentity) return window.TF.memberIdentity(S.name, S.email, { first_name: S.firstName, last_name: S.lastName });
    var name = String(S.name || '').trim();
    var email = String(S.email || '').trim();
    var words = name.split(/\s+/).filter(Boolean);
    var initials = words.length
      ? words.map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase()
      : (email.charAt(0) || '').toUpperCase();
    return { initials: initials, first: words[0] || '', display: name || email.split('@')[0] || '', email: email, name: name };
  }
  function parseTab() {
    var p = location.pathname.replace(/\/+$/, '') || '/';
    if (/\/account\/access/.test(p)) return 'access';
    if (/\/account\/course/.test(p)) return 'course';
    if (/\/account\/profile/.test(p)) return 'profile';
    if (/\/account\/notifications/.test(p)) return 'notif';
    if (location.hash === '#password' || location.hash === '#profile') return 'profile';
    return 'overview';
  }
  function go(path) {
    if (window.TF.navigate) window.TF.navigate(path);
    else location.href = path;
  }
  function toast(msg) {
    if (window.tfToast) window.tfToast(msg);
  }
  function fmtDate(iso, withTime) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(lang() === 'ar' ? 'ar' : 'en-GB', withTime
        ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    } catch (e) { return d.toDateString(); }
  }
  function activityLabel(row) {
    var kinds = t().activityKinds;
    var kind = String(row.kind || '');
    var text = String(row.text || '');
    if (kind === 'proof') {
      var m = text.match(/(\d+)/);
      return kinds.proof.replace('{n}', m ? m[1] : '');
    }
    if (kind === 'decision') {
      if (/approved|اعتمد/i.test(text)) return kinds.decision_approved;
      if (/asked to resubmit|resubmit/i.test(text)) return kinds.decision_rejected;
      if (/rejected|رُفض/i.test(text)) return kinds.decision_blocked;
      return kinds.decision_rejected;
    }
    if (kinds[kind]) return kinds[kind];
    return esc(text);
  }
  function dirSpan(s) {
    return '<span dir="' + tdir() + '">' + s + '</span>';
  }
  function eyebrow(label) {
    return '<div style="font-family:\'Geist Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3;margin-bottom:6px">' + dirSpan(label) + '</div>';
  }
  function title(label) {
    return '<h1 dir="' + tdir() + '" style="font-size:24px;font-weight:700;letter-spacing:' + lsH() + ';line-height:1.15;text-align:left">' + label + '</h1>';
  }
  function courseReleased() {
    if (window.__TF_COURSE_RELEASED) return true;
    var v = window.__ENV && window.__ENV.COURSE_RELEASED;
    return /^(1|true|yes|on)$/i.test(String(v || ''));
  }
  function courseOpen() {
    return S.state === 'approved' && S.released;
  }
  function doneCount() {
    if (!courseOpen()) return 0;
    var n = 0;
    MODULES.forEach(function (_, i) { if (S.progress[i] === 'done') n += 1; });
    return n;
  }

  function renderNav(tab) {
    var copy = t();
    var who = ident();
    var html = '<div style="display:flex;align-items:center;gap:12px;padding:4px 10px 16px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:10px">' +
      '<span aria-hidden="true" style="width:40px;height:40px;border-radius:50%;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,#2EE8FF,#FF37B0);color:#04141A;font-weight:700;font-size:15px;letter-spacing:.02em">' + esc(who.initials) + '</span>' +
      '<div style="min-width:0"><div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(who.display) + '</div>' +
      '<div style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#8B90A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(S.email) + '</div></div></div>';
    NAV.forEach(function (item, i) {
      var on = item.key === tab;
      var dot = item.key === 'access' && (S.state === 'rejected' || S.state === 'none' || S.state === 'blocked') ? COLORS[S.state] : 'transparent';
      html += '<a href="' + item.href + '" style="display:flex;align-items:center;justify-content:space-between;width:100%;height:38px;padding:0 10px;border:0;border-radius:8px;font-size:14px;font-weight:' + (on ? '600' : '500') + ';color:' + (on ? '#F2F4F8' : '#B7BCCB') + ';background:' + (on ? 'rgba(46,232,255,0.08)' : 'transparent') + ';text-align:left;box-sizing:border-box"><span dir="' + tdir() + '">' + copy.nav[i] + '</span><span style="width:6px;height:6px;border-radius:50%;background:' + dot + '"></span></a>';
    });
    html += '<a href="/" data-account-logout style="display:flex;align-items:center;height:38px;padding:0 10px;margin-top:12px;border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;font-size:14px;color:#8B90A3">' + dirSpan(copy.logout) + '</a>';
    return html;
  }

  function renderMobileChrome(tab) {
    var copy = t();
    var who = ident();
    var accent = COLORS[S.state] || '#8B90A3';
    var tagBorder = S.state === 'none' ? 'rgba(255,255,255,0.16)' : accent;
    var html = '<div data-account-strip style="display:flex;align-items:center;gap:12px;height:52px;padding:0 16px;box-sizing:border-box">' +
      '<span aria-hidden="true" style="width:28px;height:28px;border-radius:50%;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,#2EE8FF,#FF37B0);color:#04141A;font-weight:700;font-size:11px;letter-spacing:.02em">' + esc(who.initials) + '</span>' +
      '<div style="min-width:0;flex:1;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(who.display) + '</div>' +
      '<span data-status style="display:inline-flex;align-items:center;gap:7px;flex:none;font-family:\'Geist Mono\',\'Cairo\',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:' + accent + ';border:1px solid ' + tagBorder + ';border-radius:6px;padding:4px 8px;white-space:nowrap"><span style="width:6px;height:6px;background:' + accent + ';display:inline-block"></span><span dir="' + tdir() + '">' + copy.tags[S.state] + '</span></span>' +
      '</div>' +
      '<nav data-account-tabs style="display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:0 16px 10px;border-bottom:1px solid rgba(255,255,255,0.08)">';
    NAV.forEach(function (item, i) {
      var on = item.key === tab;
      html += '<a href="' + item.href + '" data-account-tab' + (on ? ' aria-current="page"' : '') +
        ' style="flex:none;display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:10px;white-space:nowrap;font-size:14px;font-weight:' + (on ? '600' : '500') +
        ';color:' + (on ? '#F2F4F8' : '#B7BCCB') + ';background:' + (on ? 'rgba(46,232,255,0.10)' : 'transparent') +
        '"><span dir="' + tdir() + '">' + copy.nav[i] + '</span></a>';
    });
    html += '</nav>';
    return html;
  }

  function paintMobileChrome(tab) {
    var root = document.querySelector('[data-account]');
    if (!root) return;
    var el = document.querySelector('[data-account-mobile]');
    if (!el) {
      el = document.createElement('div');
      el.setAttribute('data-account-mobile', '');
      root.insertBefore(el, root.firstChild);
    }
    el.innerHTML = renderMobileChrome(tab);
    var active = el.querySelector('[data-account-tab][aria-current="page"]');
    if (active && window.matchMedia && window.matchMedia('(max-width:900px)').matches) {
      active.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }

  function supportMailto() {
    return 'mailto:support@talaria-flow.com?subject=' + encodeURIComponent('Application rejected');
  }
  function statusBanner(withCta) {
    var copy = t();
    if (S.state === 'blocked') {
      var blockedCta = withCta
        ? '<a href="' + supportMailto() + '" style="display:inline-flex;align-items:center;margin-top:12px;font-size:13.5px;font-weight:600;color:#FF8AD0">' + dirSpan(copy.blockedCta) + ' →</a>'
        : '';
      return '<div role="status" style="margin-top:20px;padding:16px 18px;border:1px solid rgba(255,55,176,0.55);border-radius:12px;background:rgba(255,55,176,0.08)">' +
        '<div style="font-weight:600;color:#FF8AD0">' + dirSpan(copy.blockedNotice) + '</div>' +
        blockedCta + '</div>';
    }
    if (S.state !== 'rejected') return '';
    var reason = S.reason ? '<p dir="auto" style="margin:8px 0 0;font-size:14px;color:#B7BCCB;line-height:1.5">' + esc(S.reason) + '</p>' : '';
    var cta = withCta
      ? '<a href="/account/access/" style="display:inline-flex;align-items:center;margin-top:12px;font-size:13.5px;font-weight:600;color:#FF8AD0">' + dirSpan(copy.resubmitCta) + ' →</a>'
      : '';
    return '<div role="status" style="margin-top:20px;padding:16px 18px;border:1px solid rgba(255,138,208,0.45);border-radius:12px;background:rgba(255,55,176,0.08)">' +
      '<div style="font-weight:600;color:#FF8AD0">' + dirSpan(copy.resubmitNotice) + '</div>' +
      reason + cta + '</div>';
  }

  function renderOverview() {
    var copy = t();
    var open = courseOpen();
    var done = doneCount();
    var accent = COLORS[S.state];
    var tagBorder = S.state === 'none' ? 'rgba(255,255,255,0.16)' : accent;
    var who = ident();
    var hello = who.first ? copy.hello + ', ' + esc(who.first) : copy.hello;
    return eyebrow(copy.account) +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px">' +
      '<h1 dir="' + tdir() + '" style="font-size:24px;font-weight:700;letter-spacing:' + lsH() + ';line-height:1.15;text-align:left;flex:0 1 auto;margin:0">' + hello + '</h1>' +
      '<span style="font-family:\'Geist Mono\',\'Cairo\',monospace;font-size:11px;color:#8B90A3;flex:none">' + dirSpan(copy.memberSince) + ' ' + esc(S.since) + '</span></div>' +
      statusBanner(true) +
      '<div data-two style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin-top:20px">' +
      '<a href="/account/access/" class="scp-acc" style="display:flex;flex-direction:column;gap:14px;padding:16px 18px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-top:2px solid ' + accent + ';border-radius:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 dir="' + tdir() + '" style="font-size:15px;font-weight:600;text-align:left">' + copy.courseAccess + '</h2>' +
      '<span data-status style="display:inline-flex;align-items:center;gap:7px;font-family:\'Geist Mono\',\'Cairo\',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:' + accent + ';border:1px solid ' + tagBorder + ';border-radius:6px;padding:4px 8px;white-space:nowrap"><span style="width:6px;height:6px;background:' + accent + ';display:inline-block"></span><span dir="' + tdir() + '">' + copy.tags[S.state] + '</span></span></div>' +
      '<p dir="' + tdir() + '" style="font-size:13.5px;color:#B7BCCB;text-align:left;text-wrap:pretty">' + copy.accessBody[S.state] + '</p>' +
      '<span style="font-size:13.5px;font-weight:600;color:#2EE8FF;margin-top:auto">' + dirSpan(copy.accessCta[S.state]) + ' →</span></a>' +
      '<a href="/account/course/" class="scp-acc" style="display:flex;flex-direction:column;gap:14px;padding:16px 18px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;opacity:' + (open ? '1' : '.75') + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 dir="' + tdir() + '" style="font-size:15px;font-weight:600;text-align:left">' + copy.course + '</h2>' +
      '<span style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#8B90A3">' + (open ? done : 0) + ' / 7</span></div>' +
      '<div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + (open ? Math.round(done / 7 * 100) : 0) + '%;background:#2EE8FF"></div></div>' +
      '<p dir="' + tdir() + '" style="font-size:13.5px;color:#B7BCCB;text-align:left;text-wrap:pretty">' + (open ? copy.courseBodyOpen : copy.courseBodyLocked) + '</p>' +
      '<span style="font-size:13.5px;font-weight:600;color:#2EE8FF;margin-top:auto">' + dirSpan(open ? copy.courseCtaOpen : copy.courseCtaLocked) + ' →</span></a></div>' +
      '<div style="margin-top:32px"><h3 dir="' + tdir() + '" style="font-size:15px;font-weight:600;text-align:left;margin-bottom:6px">' + copy.recent + '</h3>' +
      (S.activity.length ? S.activity.map(function (a) {
        return '<div style="display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:12px;align-items:baseline;padding:10px 0;border-top:1px solid rgba(255,255,255,0.08);font-size:13.5px"><span style="width:6px;height:6px;background:' + esc(a.color || '#8B90A3') + ';display:inline-block"></span><span dir="' + tdir() + '" style="color:#B7BCCB;text-align:left">' + activityLabel(a) + '</span><span style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#7C8296">' + esc(fmtDate(a.created_at, true)) + '</span></div>';
      }).join('') : '<p dir="' + tdir() + '" style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.08);font-size:13.5px;color:#7C8296;text-align:left">' + copy.noActivity + '</p>') +
      '<div style="border-top:1px solid rgba(255,255,255,0.08)"></div></div>';
  }

  function timeline(active) {
    var keys = ['dashboard.timeline.0', 'dashboard.timeline.1', 'dashboard.timeline.2', 'dashboard.timeline.3'];
    var labels = ['Account', 'Proof uploaded', 'Review', 'Approved'];
    return '<div data-timeline style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:28px">' +
      keys.map(function (k, i) {
        var on = i < active;
        var now = i === active - 1;
        var color = now ? '#F2F4F8' : on ? '#B7BCCB' : '#7C8296';
        var bar = now ? '#FF37B0' : on ? '#2EE8FF' : 'rgba(255,255,255,0.12)';
        return '<div style="font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:' + color + ';padding-top:10px;border-top:2px solid ' + bar + '"><span data-i18n="' + k + '">' + labels[i] + '</span></div>';
      }).join('') + '</div>';
  }

  function uploadBox(resubmit) {
    return '<div style="margin-top:40px;padding:28px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:14px">' +
      '<h3 style="font-size:20px;font-weight:600;letter-spacing:-0.02em;margin-bottom:8px"><span data-i18n="' + (resubmit ? 'dashboard.uploadAgain' : 'dashboard.uploadTitle') + '">' + (resubmit ? 'Upload again' : 'Upload proof') + '</span></h3>' +
      '<p style="margin:0 0 18px;font-size:14px"><a href="/course/?step=9#guide" class="tf-text-link" data-i18n="dashboard.screenshotHelp">How to take a valid screenshot →</a></p>' +
      '<div id="upload-dropzone" role="button" tabindex="0" aria-label="Upload screenshots" class="scp0" style="position:relative;border:1px solid rgba(255,255,255,0.16);padding:28px 24px;text-align:center;background:#07080C;cursor:pointer;border-radius:10px">' +
      '<div data-upload-empty style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2EE8FF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"></path></svg>' +
      '<div dir="' + tdir() + '" style="font-size:var(--fs-body);text-align:center"><strong style="font-weight:600"><span data-i18n="dashboard.dropStrong">Drop screenshots here</span></strong> <span style="color:#B7BCCB"><span data-i18n="dashboard.dropRest">or click to choose</span></span></div></div>' +
      '<div data-upload-grid></div>' +
      '<p style="margin-top:6px;font-family:\'Geist Mono\',monospace;font-size:11.5px;letter-spacing:.04em;color:#8B90A3"><span data-i18n="dashboard.dropMeta">PNG, JPG or WEBP · up to 4 files · 5 MB each</span></p>' +
      '<span data-upload-count style="position:absolute;top:10px;right:12px;font:400 11px \'Geist Mono\',monospace;color:#8B90A3">0 / 4</span></div>' +
      '<label style="display:flex;flex-direction:column;gap:8px;margin-top:24px;font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3"><span data-i18n="dashboard.noteLabel">Note for the reviewer</span> <span style="color:#7C8296"><span data-i18n="dashboard.optional">(optional)</span></span>' +
      '<textarea id="upload-note" data-i18n-placeholder="dashboard.notePh" placeholder="Anything that helps us match your NinjaTrader account to this one." class="scp1" style="width:100%;min-height:96px;resize:vertical;background:#07080C;border:1px solid rgba(255,255,255,0.16);padding:12px 14px;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:15px;line-height:1.5;outline:none;box-sizing:border-box;border-radius:10px"></textarea></label>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px;margin-top:20px">' +
      '<p style="font-size:12.5px;color:#8B90A3;max-width:44ch;line-height:1.5"><span data-i18n="dashboard.privacyNote">Uploads are stored privately and seen only by the reviewer.</span> <a href="/legal/privacy/" style="color:#B7BCCB;border-bottom:1px solid rgba(255,255,255,0.25)" data-i18n="dashboard.privacyLink">See our privacy policy</a>.</p>' +
      '<button id="submit-proof" type="button" disabled class="btn btn-primary" data-tip="Attach two screenshots" data-tip-i18n="dashboard.attachTip" aria-disabled="true" style="display:inline-flex;align-items:center;gap:12px;height:48px;padding:0 22px;background:#2EE8FF;color:#04141A;border-radius:10px;border:0;font-family:Archivo,sans-serif;font-size:15px;font-weight:600;cursor:not-allowed;opacity:.5"><span data-i18n="' + (resubmit ? 'dashboard.resubmit' : 'dashboard.submit') + '">' + (resubmit ? 'Resubmit' : 'Submit for review') + '</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button>' +
      '</div></div>';
  }

  function accessHead(state, tag, titleKey, titleFallback, bodyKey, bodyFallback, extra) {
    return '<div data-state="' + state + '">' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:28px">' +
      '<h1 style="font-size:clamp(32px,3.6vw,44px);font-weight:700;letter-spacing:-0.03em;line-height:1.02;font-stretch:112%"><span data-i18n="dashboard.h1">Your course access</span></h1>' +
      '<span data-status style="display:inline-flex;align-items:center;gap:8px;font-family:\'Geist Mono\',monospace;font-size:var(--fs-mono);letter-spacing:.1em;text-transform:uppercase;color:' + tag + ';border:1px solid ' + (state === 'none' ? 'rgba(255,255,255,0.16)' : tag) + ';padding:6px 10px;border-radius:6px;white-space:nowrap"><span style="width:6px;height:6px;background:' + tag + ';display:inline-block"></span><span data-i18n="dashboard.tags.' + state + '">' + t().tags[state] + '</span></span></div>' +
      '<div style="border-top:2px solid ' + tag + ';padding:24px 0 0">' +
      '<h2 style="font-size:clamp(24px,2.4vw,30px);font-weight:600;letter-spacing:-0.025em;line-height:1.15"><span data-i18n="' + titleKey + '">' + titleFallback + '</span></h2>' +
      '<p style="margin-top:10px;font-size:var(--fs-body);color:#B7BCCB;max-width:64ch;text-wrap:pretty">' + extra + (bodyKey ? '<span data-i18n="' + bodyKey + '">' + bodyFallback + '</span>' : bodyFallback) + '</p>' +
      timeline(state === 'none' ? 2 : state === 'review' ? 3 : state === 'approved' ? 4 : 3) + '</div>';
  }

  function filesGrid() {
    var copy = t();
    if (!S.files.length) return '<p style="font-size:13px;color:#8B90A3">' + dirSpan(copy.noFiles) + '</p>';
    return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">' +
      S.files.map(function (f) {
        var src = f.preview || '';
        var name = esc(f.file_name || f.name || 'screenshot');
        if (!src) {
          return '<div style="display:block;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:#07080C">' +
            '<div style="display:grid;place-items:center;width:100%;aspect-ratio:4/3;color:#8B90A3;font:400 11px \'Geist Mono\',monospace">Unavailable</div>' +
            '<span style="display:block;padding:6px 8px;font:400 10.5px \'Geist Mono\',monospace;color:#8B90A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</span></div>';
        }
        return '<a href="' + esc(src) + '" target="_blank" rel="noopener" style="display:block;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:#07080C">' +
          '<img src="' + esc(src) + '" alt="" style="display:block;width:100%;aspect-ratio:4/3;object-fit:cover">' +
          '<span style="display:block;padding:6px 8px;font:400 10.5px \'Geist Mono\',monospace;color:#8B90A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</span></a>';
      }).join('') + '</div>';
  }

  // Only the current state is rendered, so ids inside the upload box stay unique and there is one <h1>.
  function renderAccess() {
    var copy = t();
    if (S.state === 'review') {
      return accessHead('review', '#FBBF24', 'dashboard.tags.review', 'Under review', 'dashboard.review.body', 'We received your screenshots and a person is checking them. Reviews are manual and usually take a few days. You will get an email either way.', '') +
        '<div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08)"><h3 style="font-size:16px;font-weight:600;letter-spacing:-0.01em;margin-bottom:14px"><span data-i18n="dashboard.yourSubmission">Your submission</span></h3>' +
        filesGrid() +
        '<p style="margin-top:12px;font-size:13px;color:#8B90A3"><span data-i18n="dashboard.submittedLocked">Submitted · you can\'t edit while it\'s under review.</span></p>' +
        '<p style="margin-top:16px"><button type="button" data-proof-resend class="btn-outline" style="height:40px;padding:0 16px;border:1px solid #2EE8FF;border-radius:10px;background:transparent;color:#2EE8FF;font-size:14px;font-weight:600;cursor:pointer">' + dirSpan(copy.resendEmail) + '</button></p></div></div>';
    }
    if (S.state === 'approved') {
      return accessHead('approved', '#2EE8FF', 'dashboard.approved.title', 'Approved — you\'re in', 'dashboard.approved.body', 'Your NinjaTrader registration is confirmed. You will receive access to the full 30-video order flow course, with written materials and lesson notes, before 31 December 2026 at this email address. No further action is needed.', '') +
        '<div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px">' +
        '<div><h3 style="font-size:16px;font-weight:600;letter-spacing:-0.01em"><span data-i18n="dashboard.nextTitle">What happens next</span></h3>' +
        '<p style="margin-top:6px;font-size:14px;color:#8B90A3;max-width:56ch"><span data-i18n="dashboard.nextBody">Course access lands in your inbox before 31 December 2026. Keep an eye on the email you signed up with.</span></p></div>' +
        '<a href="/account/course/" class="scp2" style="display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid #2EE8FF;color:#2EE8FF;border-radius:10px;font-size:14px;font-weight:600;white-space:nowrap"><span data-i18n="dashboard.viewCurriculum">View curriculum</span></a></div></div>';
    }
    if (S.state === 'blocked') {
      return accessHead('blocked', '#FF37B0', 'dashboard.blocked.title', 'Application rejected', 'dashboard.blocked.body', 'We cannot approve this application. You cannot upload again until an admin restores your access. Email support if you think this is a mistake.', '') +
        '<p style="margin-top:28px"><a href="' + supportMailto() + '" class="scp2" style="display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid #FF8AD0;color:#FF8AD0;border-radius:10px;font-size:14px;font-weight:600">' + dirSpan(copy.blockedCta) + '</a></p></div>';
    }
    if (S.state === 'rejected') {
      var reason = S.reason ? '<span dir="auto">' + esc(S.reason) + '</span>' : '<span data-i18n="dashboard.rejected.body">the screenshot doesn\'t show your account email or username. Please upload one where it is visible, then submit again.</span>';
      return accessHead('rejected', '#FF8AD0', 'dashboard.rejected.title', 'Needs resubmission', null, reason, '<span data-i18n="dashboard.rejected.reasonLead" style="color:#F2F4F8">Reason from the reviewer: </span>') +
        uploadBox(true) + '</div>';
    }
    return accessHead('none', '#8B90A3', 'dashboard.none.title', 'Upload your proof to get started', 'dashboard.none.body', 'Two screenshots are required: (1) the NinjaTrader dashboard showing "Welcome, your name" and (2) the NinjaTrader Web trading platform (Simulation). Up to two more are optional. Blur anything private; keep your email or username visible.', '') +
      uploadBox(false) + '</div>';
  }

  function renderCourse() {
    var copy = t();
    var open = courseOpen();
    var done = doneCount();
    var html = eyebrow(copy.course) + title(copy.courseTitle);
    if (!open) {
      html += '<div style="margin-top:24px;padding:20px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:14px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between">' +
        '<p dir="' + tdir() + '" style="font-size:13.5px;color:#B7BCCB;max-width:56ch;text-align:left;text-wrap:pretty">' + copy.lockedBody + '</p>' +
        '<a href="/account/access/" class="scp2" style="display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid #2EE8FF;color:#2EE8FF;border-radius:10px;font-size:14px;font-weight:600">' + dirSpan(copy.courseAccess) + '</a></div>';
    }
    html += '<div style="margin-top:28px">';
    MODULES.forEach(function (mod, i) {
      var st = !open ? 'locked' : i < done ? 'done' : 'open';
      var color = st === 'done' ? '#2EE8FF' : st === 'open' ? '#F2F4F8' : '#7C8296';
      var num = String(i + 1).padStart(2, '0');
      var name = st === 'locked' ? copy.moduleLocked.replace('{n}', num) : mod[0];
      var blur = st === 'locked' ? 'blur(5px)' : 'none';
      var hidden = st === 'locked' ? ' aria-hidden="true"' : '';
      var inner = '<span style="font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3">' + num + '</span>' +
        '<div><div dir="ltr"' + hidden + ' style="font-size:15px;font-weight:600;text-align:left;filter:' + blur + ';user-select:none;pointer-events:none">' + esc(name) + '</div>' +
        '<div' + hidden + ' style="font-family:\'Geist Mono\',\'Cairo\',monospace;font-size:11px;color:#8B90A3;margin-top:2px;filter:' + blur + ';user-select:none">' + dirSpan(copy.videos(mod[1])) + '</div></div>' +
        '<span style="display:inline-flex;align-items:center;gap:8px;font-family:\'Geist Mono\',\'Cairo\',monospace;font-size:11px;color:' + color + '">' + dirSpan(copy.modState[st]) +
        (st === 'locked' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>' : '') + '</span>';
      html += (open && st !== 'locked' ? '<a href="/course/" style="display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 0;border-top:1px solid rgba(255,255,255,0.08);color:inherit">' : '<div style="display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 0;border-top:1px solid rgba(255,255,255,0.08)' + (open ? '' : ';opacity:.7') + '">') + inner + (open && st !== 'locked' ? '</a>' : '</div>');
    });
    html += '<div style="border-top:1px solid rgba(255,255,255,0.08)"></div></div>';
    return html;
  }

  function renderProfile() {
    var copy = t();
    var ar = lang() === 'ar';
    return eyebrow(copy.account) + title(copy.profile) +
      statusBanner(true) +
      '<form data-account-profile style="max-width:480px;display:flex;flex-direction:column;gap:22px;margin-top:28px">' +
      '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3">' + dirSpan(copy.name) +
      '<input name="name" value="' + esc(S.name) + '" style="background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,0.16);padding:10px 0;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:16px;outline:none"></label>' +
      '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3">' + dirSpan(copy.emailLabel) +
      '<input value="' + esc(S.email) + '" dir="ltr" readonly style="background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,0.16);padding:10px 0;color:#8B90A3;font-family:Archivo,sans-serif;font-size:16px;outline:none">' +
      '<span dir="' + tdir() + '" style="font-family:Archivo,sans-serif;font-size:12px;letter-spacing:0;text-transform:none;color:#7C8296;text-align:left">' + copy.emailNote + '</span></label>' +
      '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3">' + dirSpan(copy.country || 'Country') +
      '<input value="' + esc(S.country || '—') + '" dir="ltr" readonly style="background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,0.16);padding:10px 0;color:#8B90A3;font-family:Archivo,sans-serif;font-size:16px;outline:none"></label>' +
      '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3">' + dirSpan(copy.language) +
      '<div style="display:inline-flex;border:1px solid rgba(255,255,255,0.16);border-radius:10px;overflow:hidden;width:max-content">' +
      '<button type="button" data-set-lang="en" style="height:36px;padding:0 14px;border:0;background:' + (ar ? 'transparent' : 'rgba(255,255,255,0.08)') + ';color:' + (ar ? '#8B90A3' : '#F2F4F8') + ';font-family:Archivo,sans-serif;font-size:13.5px;font-weight:600;cursor:pointer">English</button>' +
      '<button type="button" data-set-lang="ar" lang="ar" style="height:36px;padding:0 14px;border:0;border-left:1px solid rgba(255,255,255,0.12);background:' + (ar ? 'rgba(255,255,255,0.08)' : 'transparent') + ';color:' + (ar ? '#F2F4F8' : '#8B90A3') + ';font-family:Cairo,sans-serif;font-size:14px;font-weight:600;cursor:pointer">العربية</button></div>' +
      '<span dir="' + tdir() + '" style="font-family:Archivo,sans-serif;font-size:12px;letter-spacing:0;text-transform:none;color:#7C8296;text-align:left">' + copy.languageNote + '</span></label>' +
      '<div style="display:flex;gap:10px;padding-top:6px"><button type="submit" class="btn-primary" style="height:44px;padding:0 18px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font-size:14.5px;font-weight:600;cursor:pointer;white-space:nowrap">' + dirSpan(copy.save) + '</button></div></form>' +
      '<div style="max-width:480px;margin-top:40px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:16px">' +
      '<div id="password" style="display:flex;flex-direction:column;gap:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:16px"><div><div dir="' + tdir() + '" style="font-weight:600;text-align:left">' + copy.password + '</div><div dir="' + tdir() + '" style="font-size:13px;color:#8B90A3;text-align:left">' + copy.passwordNote + '</div></div>' +
      '<button type="button" data-account-pw-toggle style="height:36px;padding:0 14px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;background:transparent;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:13.5px;font-weight:600;white-space:nowrap;cursor:pointer">' + dirSpan(S.pwOpen ? copy.cancel : copy.change) + '</button></div>' +
      (S.pwOpen ? (
        '<form data-account-password novalidate style="display:flex;flex-direction:column;gap:16px;padding:16px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px">' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3">' + dirSpan(copy.pwCurrent) +
        '<input name="current" type="password" autocomplete="current-password" class="tf-input" style="height:42px;background:#07080C"></label>' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3">' + dirSpan(copy.pwNew) +
        '<input name="next" type="password" autocomplete="new-password" minlength="8" class="tf-input" style="height:42px;background:#07080C">' +
        '<span dir="' + tdir() + '" style="font-family:Archivo,sans-serif;font-size:12px;letter-spacing:0;text-transform:none;color:#7C8296;text-align:left">' + copy.pwRule + '</span></label>' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-family:\'Geist Mono\',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3">' + dirSpan(copy.pwRepeat) +
        '<input name="repeat" type="password" autocomplete="new-password" class="tf-input" style="height:42px;background:#07080C"></label>' +
        '<span data-pw-err class="tf-field-err" role="alert"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4M12 16h.01"></path></svg><span></span></span>' +
        (S.pwOk ? '<div class="tf-form-ok is-on">' + copy.pwUpdated + '</div>' : '') +
        '<div style="display:flex;gap:10px"><button type="submit" class="btn-primary" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap">' + dirSpan(copy.pwSave) + '</button>' +
        '<button type="button" data-account-pw-toggle style="height:40px;padding:0 10px;border:0;background:none;color:#8B90A3;font-family:Archivo,sans-serif;font-size:14px;cursor:pointer">' + dirSpan(copy.cancel) + '</button></div></form>'
      ) : '') +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:16px"><div><div dir="' + tdir() + '" style="font-weight:600;color:#FF8AD0;text-align:left">' + copy.deleteAccount + '</div><div dir="' + tdir() + '" style="font-size:13px;color:#8B90A3;text-align:left">' + copy.deleteNote + '</div></div>' +
      '<button type="button" data-account-delete style="height:36px;padding:0 14px;border:1px solid rgba(255,138,208,0.5);border-radius:10px;background:transparent;color:#FF8AD0;font-family:Archivo,sans-serif;font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap">' + dirSpan(copy.delete) + '</button></div></div>';
  }

  function renderNotif() {
    var copy = t();
    return eyebrow(copy.account) + title(copy.notifications) +
      '<div style="max-width:560px;margin-top:24px">' +
      copy.prefs.map(function (p) {
        var on = p[0] === 'review' ? true : S.prefs[p[0]];
        var locked = p[0] === 'review';
        return '<label style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:16px 0;border-top:1px solid rgba(255,255,255,0.08);cursor:' + (locked ? 'default' : 'pointer') + '">' +
          '<div><div dir="' + tdir() + '" style="font-weight:600;text-align:left">' + p[1] + '</div><div dir="' + tdir() + '" style="font-size:13px;color:#8B90A3;text-align:left;text-wrap:pretty">' + p[2] + '</div></div>' +
          '<button type="button" role="switch" aria-checked="' + on + '" aria-label="' + esc(p[1]) + '" data-pref="' + p[0] + '"' + (locked ? ' disabled' : '') + ' style="width:40px;height:22px;border-radius:11px;border:0;color:' + (on ? '#04141A' : '#F2F4F8') + ';background:' + (on ? '#2EE8FF' : 'rgba(255,255,255,0.16)') + ';position:relative;cursor:' + (locked ? 'default' : 'pointer') + ';opacity:' + (locked ? '.6' : '1') + '"><span style="position:absolute;top:3px;left:' + (on ? '21px' : '3px') + ';width:16px;height:16px;border-radius:50%;background:#F2F4F8;transition:left .15s"></span></button></label>';
      }).join('') +
      '<div style="border-top:1px solid rgba(255,255,255,0.08)"></div></div>';
  }

  function bind(root) {
    var out = root.querySelector('[data-account-logout]');
    if (out) out.addEventListener('click', function (e) {
      e.preventDefault();
      Promise.resolve(window.TF.signOut ? window.TF.signOut() : null).then(function () { location.href = '/'; });
    });
    var form = root.querySelector('[data-account-profile]');
    if (form) form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var nextName = String((form.querySelector('[name="name"]') || {}).value || '').trim().slice(0, 80);
      try {
        if (window.TF.getClient && S.id) {
          var up = await window.TF.getClient().from('profiles').update({ name: nextName, lang: lang() }).eq('id', S.id);
          if (up.error) throw up.error;
        }
      } catch (err2) {
        toast(t().saveFailed);
        return;
      }
      S.name = nextName;
      if (window.TF.refreshSessionHeader) window.TF.refreshSessionHeader({ name: S.name });
      toast(t().saved);
      paint();
    });
    var resend = root.querySelector('[data-proof-resend]');
    if (resend) resend.addEventListener('click', async function () {
      resend.disabled = true;
      try {
        var res = await window.TF.api('/api/proof', { body: { resend: true } });
        if (!res.ok || (res.body.email && res.body.email.ok === false)) { toast(t().resendFail); return; }
        toast(t().resendOk);
      } catch (err) { toast(t().resendFail); }
      finally { resend.disabled = false; }
    });
    root.querySelectorAll('[data-set-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('data-set-lang');
        if (window.TF.setLang) window.TF.setLang(next);
        else if (window.TF.applyI18n) window.TF.applyI18n(next);
      });
    });
    var del = root.querySelector('[data-account-delete]');
    if (del) del.addEventListener('click', async function () {
      var copy = t();
      var pw = await confirmDialog({ title: copy.deleteTitle, body: copy.deleteNote, ok: copy.deleteConfirm, cancel: copy.cancel, danger: true, opener: del, password: copy.deletePassword || 'Enter your password to confirm' });
      if (!pw) return;
      try {
        var res = await window.TF.api('/api/account/delete', { method: 'POST', body: { password: pw } });
        if (!res.ok) { toast(window.TF.authCopy('uploadFailed')); return; }
        await window.TF.signOut();
      } catch (err) { toast(window.TF.authCopy('uploadFailed')); return; }
      toast(copy.deleted);
      location.href = '/';
    });
    root.querySelectorAll('[data-account-pw-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S.pwOpen = !S.pwOpen;
        S.pwOk = false;
        if (!S.pwOpen && location.hash === '#password') history.replaceState(null, '', location.pathname + location.search);
        paint();
      });
    });
    var pwForm = root.querySelector('[data-account-password]');
    if (pwForm) pwForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var cur = (pwForm.querySelector('[name="current"]') || {}).value || '';
      var next = (pwForm.querySelector('[name="next"]') || {}).value || '';
      var repeat = (pwForm.querySelector('[name="repeat"]') || {}).value || '';
      var err = pwForm.querySelector('[data-pw-err]');
      var msg = '';
      if (next.length < 8) msg = (window.TF.authCopy && window.TF.authCopy('short')) || t().pwRule;
      else if (next !== repeat) msg = (window.TF.authCopy && window.TF.authCopy('mismatch')) || 'mismatch';
      if (msg) {
        if (err) { var span = err.querySelector('span:last-child'); if (span) span.textContent = msg; err.classList.add('is-on'); }
        return;
      }
      try {
        if (window.TF.getClient) {
          var email = S.email;
          var check = await window.TF.getClient().auth.signInWithPassword({ email: email, password: cur });
          if (check.error) {
            if (err) { var s2 = err.querySelector('span:last-child'); if (s2) s2.textContent = (window.TF.authCopy && window.TF.authCopy('wrongCurrent')) || 'Wrong current password'; err.classList.add('is-on'); }
            return;
          }
          var res = await window.TF.getClient().auth.updateUser({ password: next });
          if (res.error) {
            if (err) { var s3 = err.querySelector('span:last-child'); if (s3) s3.textContent = (window.TF.authCopy && window.TF.authCopy('short')) || t().pwRule; err.classList.add('is-on'); }
            return;
          }
        }
      } catch (err2) {}
      S.pwOk = true;
      paint();
      setTimeout(function () { S.pwOk = false; S.pwOpen = false; paint(); }, 4000);
    });
    root.querySelectorAll('[data-pref]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-pref');
        if (key === 'review') return;
        var prev = S.prefs[key];
        S.prefs[key] = !prev;
        paint();
        if (!(window.TF.getClient && S.id)) return;
        window.TF.getClient().from('profiles').update({ notify: S.prefs }).eq('id', S.id).then(function (res) {
          if (res && res.error) throw res.error;
        }).catch(function () {
          S.prefs[key] = prev;
          toast(t().saveFailed);
          paint();
        });
      });
    });
  }

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var ar = lang() === 'ar';
      var wrap = document.createElement('div');
      wrap.setAttribute('data-account-dialog', '');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:20px;background:rgba(4,5,8,0.72)';
      var titleId = 'tf-dlg-title-' + Date.now();
      var bodyId = titleId + '-body';
      wrap.innerHTML = '<div role="dialog" aria-modal="true" aria-labelledby="' + titleId + '" aria-describedby="' + bodyId + '" dir="' + (ar ? 'rtl' : 'ltr') + '" style="width:min(440px,100%);padding:24px;background:#0E1017;border:1px solid rgba(255,255,255,0.12);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.5);font-family:Archivo,Cairo,sans-serif;color:#F2F4F8">' +
        '<h2 id="' + titleId + '" style="font-size:19px;font-weight:700;letter-spacing:-0.01em;margin:0 0 8px">' + opts.title + '</h2>' +
        '<p id="' + bodyId + '" style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#B7BCCB">' + opts.body + '</p>' +
        (opts.password ? '<label style="display:block;margin:0 0 16px;font-size:12px;color:#8B90A3">' + opts.password + '<input type="password" data-dlg-pw autocomplete="current-password" style="display:block;width:100%;margin-top:6px;height:40px;box-sizing:border-box;background:#07080C;border:1px solid rgba(255,255,255,.16);border-radius:10px;color:#F2F4F8;padding:0 12px"></label>' : '') +
        '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">' +
        '<button type="button" data-dlg-cancel style="height:40px;padding:0 16px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;background:transparent;color:#F2F4F8;font:600 14px Archivo,Cairo,sans-serif;cursor:pointer">' + opts.cancel + '</button>' +
        '<button type="button" data-dlg-ok style="height:40px;padding:0 16px;border:0;border-radius:10px;background:' + (opts.danger ? '#FF8AD0' : '#2EE8FF') + ';color:#04141A;font:600 14px Archivo,Cairo,sans-serif;cursor:pointer">' + opts.ok + '</button>' +
        '</div></div>';
      document.body.appendChild(wrap);
      var panel = wrap.firstChild;
      var focusables = function () { return Array.prototype.slice.call(panel.querySelectorAll('button, input')); };
      function close(result) {
        document.removeEventListener('keydown', onKey, true);
        wrap.remove();
        if (opts.opener && opts.opener.focus) opts.opener.focus();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
        if (e.key === 'Tab') {
          var list = focusables();
          var first = list[0];
          var last = list[list.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(false); });
      panel.querySelector('[data-dlg-cancel]').addEventListener('click', function () { close(false); });
      panel.querySelector('[data-dlg-ok]').addEventListener('click', function () {
        var pw = wrap.querySelector('[data-dlg-pw]');
        close(opts.password ? (pw && pw.value ? pw.value : false) : true);
      });
      panel.querySelector('[data-dlg-cancel]').focus();
    });
  }

  function viewHtml(tab) {
    if (tab === 'access') return renderAccess();
    if (tab === 'course') return renderCourse();
    if (tab === 'profile') return renderProfile();
    if (tab === 'notif') return renderNotif();
    return renderOverview();
  }

  async function loadMember() {
    // The course is released to approved members before 31 December 2026; flip this flag at release.
    S.released = courseReleased();
    if (location.hash === '#password') S.pwOpen = true;
    if (!window.TF.requireAuth) return;
    var auth = await window.TF.requireAuth();
    if (!auth) return;
    if (!auth.isEmailVerified) { location.href = '/login/?view=unverified'; return; }
    S.email = (auth.user && auth.user.email) || '';
    S.id = auth.user && auth.user.id;
    var created = (auth.profile && auth.profile.created_at) || (auth.user && auth.user.created_at);
    if (created) {
      var d = new Date(created);
      if (!isNaN(d.getTime())) S.since = d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear();
    }
    if (auth.profile) {
      S.firstName = auth.profile.first_name || '';
      S.lastName = auth.profile.last_name || '';
      S.country = auth.profile.country || '';
      S.name = auth.profile.name || [S.firstName, S.lastName].filter(Boolean).join(' ') || S.name;
    }
    var storedLang = null;
    try { storedLang = localStorage.getItem('tf-lang'); } catch (e3) {}
    if (!storedLang && auth.profile && auth.profile.lang && window.TF.setLang) {
      window.TF.setLang(auth.profile.lang);
    }
    if (auth.profile && auth.profile.notify) S.prefs = Object.assign(S.prefs, auth.profile.notify, { review: true });
    S.resubmitNote = (auth.profile && auth.profile.resubmit_note) || '';
    S.blocked = !!(auth.profile && auth.profile.blocked);
    await loadStatus(auth.user.id);
  }

  async function loadStatus(uid) {
    uid = uid || S.id;
    if (!uid || !window.TF.getClient) return;
    var sb = window.TF.getClient();
    try {
      var row = await sb.from('submissions').select('id, status, reviewer_note').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
      var sub = row.data || null;
      var status = sub && sub.status;
      S.state = !status || status === 'none' ? 'none' : status === 'submitted' || status === 'review' ? 'review' : status === 'approved' ? 'approved' : 'rejected';
      S.reason = (sub && sub.reviewer_note) || '';
      if (S.state === 'none' && S.resubmitNote) {
        S.state = 'rejected';
        S.reason = S.resubmitNote;
      }
      if (S.blocked) {
        S.state = 'blocked';
      }
      S.files = [];
      if (sub && sub.id) {
        var files = await sb.from('submission_files').select('file_name, file_path, created_at').eq('submission_id', sub.id).order('created_at', { ascending: true });
        S.files = files.data || [];
        var paths = S.files.map(function (f) { return f.file_path; }).filter(Boolean);
        if (paths.length) {
          var signed = await sb.storage.from('proofs').createSignedUrls(paths, 600);
          var rows = (signed && signed.data) || [];
          S.files = S.files.map(function (f, i) {
            f.preview = (rows[i] && rows[i].signedUrl) || '';
            return f;
          });
        }
      }
    } catch (err) {}
    try {
      var act = await sb.from('activity_log').select('kind, text, color, created_at').eq('actor_id', uid).order('created_at', { ascending: false }).limit(5);
      S.activity = act.data || [];
    } catch (err2) { S.activity = []; }
  }

  // Called by the upload flow (app.js) after a successful submission.
  window.TF.refreshAccount = async function () {
    await loadStatus();
    paint();
  };

  var painting = false;
  var memberLoaded = false;
  var pending = false;

  function applyPending() {
    var main = document.querySelector('[data-account-main]');
    if (!main) return;
    main.style.minHeight = '420px';
    main.style.transition = 'opacity .12s';
    main.style.opacity = pending ? '0.6' : '1';
  }

  function paintPanel() {
    var nav = document.querySelector('[data-account-nav]');
    var main = document.querySelector('[data-account-main]');
    if (!nav || !main) return;
    var tab = parseTab();
    nav.innerHTML = renderNav(tab);
    paintMobileChrome(tab);
    main.style.minHeight = '420px';
    main.innerHTML = viewHtml(tab);
    bind(document.querySelector('[data-account]') || document);
    if (tab === 'access' && window.TF.initDashboard) window.TF.initDashboard();
    if (window.TF.applyI18n) window.TF.applyI18n();
  }

  function startTransition(fn) {
    pending = true;
    applyPending();
    var run = function () {
      fn();
      pending = false;
      applyPending();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else run();
  }

  async function paint() {
    if (painting) return;
    var nav = document.querySelector('[data-account-nav]');
    var main = document.querySelector('[data-account-main]');
    if (!nav || !main) return;
    painting = true;
    try {
      paintPanel();
    } finally {
      painting = false;
    }
  }

  if (!window.__tfAccountLangBound) {
    window.__tfAccountLangBound = true;
    window.addEventListener('tf-lang', function () {
      if (document.querySelector('[data-account]') && !painting) paint();
    });
  }
  if (window.TF.useSession && !window.__tfAccountSessionBound) {
    window.__tfAccountSessionBound = true;
    window.TF.useSession(function (state) {
      if (!document.querySelector('[data-account]')) return;
      if (!state || !state.user) return;
      S.email = state.user.email || S.email;
      if (state.profile) {
        S.firstName = state.profile.first_name || S.firstName;
        S.lastName = state.profile.last_name || S.lastName;
        S.country = state.profile.country || S.country;
        S.name = state.profile.name || [S.firstName, S.lastName].filter(Boolean).join(' ') || S.name;
      }
      if (!painting) paint();
    });
  }

  window.TF.setAccountTab = function () {
    startTransition(function () { paintPanel(); });
  };

  window.TF.mountAccountApp = async function () {
    if (!document.querySelector('[data-account]')) return;
    if (!memberLoaded) {
      await loadMember();
      memberLoaded = true;
      await paint();
      return;
    }
    S.released = courseReleased();
    await loadStatus();
    window.TF.setAccountTab();
  };

  function boot() {
    if (document.querySelector('[data-account]')) window.TF.mountAccountApp();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
