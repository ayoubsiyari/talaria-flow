(function () {
  window.TF = window.TF || {};

  var ITEMS = [
    { key: 'overview', href: '/admin/', label: 'Overview' },
    { key: 'members', href: '/admin/members/', label: 'Members', badge: 'pending', badgeColor: '#FBBF24' },
    { key: 'campaigns', href: '/admin/campaigns/', label: 'Campaigns', badge: 'scheduled', badgeColor: '#2EE8FF', hideZero: true, suffix: ' scheduled' },
    { key: 'emails', href: '/admin/emails/', label: 'Email templates', badge: 'emails', badgeColor: '#8B90A3' },
    { key: 'waitlist', href: '/admin/waitlist/', label: 'Waitlist', badge: 'waitlist', badgeColor: '#8B90A3' },
  ];

  function itemHtml(item, active, counts) {
    var on = item.key === active;
    var raw = item.badge ? counts[item.badge] : '';
    var n = raw === 0 || raw ? raw : '';
    if (item.hideZero && !n) n = '';
    var label = n !== '' && item.suffix ? n + item.suffix : n;
    var badge = label !== ''
      ? '<span style="font-family:\'Geist Mono\',monospace;font-size:11px;color:' + (item.badgeColor || '#8B90A3') + ';margin-left:10px">' + label + '</span>'
      : '';
    return '<a href="' + item.href + '" class="scp6" style="display:flex;align-items:center;justify-content:space-between;height:38px;padding:0 10px;border-radius:8px;font-size:14px;font-weight:' + (on ? '600' : '500') + ';color:' + (on ? '#F2F4F8' : '#B7BCCB') + ';background:' + (on ? 'rgba(46,232,255,0.08)' : 'transparent') + '"><span>' + item.label + '</span>' + badge + '</a>';
  }

  function activeFromPath(pathname) {
    var p = pathname || location.pathname;
    if (/\/admin\/members/.test(p)) return 'members';
    if (/\/admin\/campaigns/.test(p)) return 'campaigns';
    if (/\/admin\/emails/.test(p)) return 'emails';
    if (/\/admin\/waitlist/.test(p)) return 'waitlist';
    return 'overview';
  }

  window.TF.mountAdminShell = async function (active) {
    var aside = document.querySelector('[data-side]');
    if (!aside) return;
    active = active || document.body.getAttribute('data-admin-active') || activeFromPath();
    if (active === 'queue') active = 'overview';
    document.body.setAttribute('data-admin-active', active);
    // Badges come from the same loaded data as the page (members, waitlist, GET /api/admin/campaigns).
    var counts = { pending: '', waitlist: '', scheduled: '', emails: '' };
    var email = '';
    try {
      var auth = await window.TF.requireAdmin();
      if (!auth) return;
      email = (auth.user && auth.user.email) || email;
      if (window.TF.getAdminSummary) {
        var sum = await window.TF.getAdminSummary();
        if (sum) {
          counts.pending = sum.pending || 0;
          counts.waitlist = sum.waitlist || 0;
          counts.scheduled = sum.scheduled || 0;
          counts.emails = sum.emails || 0;
        }
      }
    } catch (e) {}

    var html = '<a href="/" style="display:flex;align-items:center;gap:10px;padding:4px 8px 16px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:8px"><img src="/assets/logo.svg" alt="Talaria Flow" width="20" height="22" style="display:block"><span style="font-size:15px"><b style="font-weight:700">Talaria</b> <span style="color:#8B90A3">Flow</span></span><span style="margin-left:auto;font-family:\'Geist Mono\',monospace;font-size:10px;letter-spacing:.12em;color:#8B90A3;border:1px solid rgba(255,255,255,0.16);border-radius:6px;padding:2px 6px">ADMIN</span></a><nav style="display:flex;flex-direction:column;gap:2px">';
    ITEMS.forEach(function (item) { html += itemHtml(item, active, counts); });
    html += '</nav><div data-acct style="margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:8px"><div style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#8B90A3;word-break:break-all;padding:0 8px">' + window.TF.escapeHtml(email) + '</div><a href="#logout" data-admin-logout class="scp5" style="display:inline-flex;align-items:center;justify-content:center;height:34px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;font-size:13px;font-weight:600">Log out</a></div>';
    aside.innerHTML = html;
    var out = aside.querySelector('[data-admin-logout]');
    if (out) out.addEventListener('click', function (e) {
      e.preventDefault();
      Promise.resolve(window.TF.signOut ? window.TF.signOut() : null).then(function () { location.href = '/'; });
    });
  };

  function boot() {
    if (document.querySelector('[data-side]')) window.TF.mountAdminShell();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
