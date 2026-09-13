(function () {
  window.TF = window.TF || {};

  var cache = Object.create(null);
  var CACHE_MS = 15000;
  var scrolls = Object.create(null);
  var loadedScripts = Object.create(null);
  var heroCtl = null;
  var navigating = false;

  try { history.scrollRestoration = 'manual'; } catch (e) {}

  function pageEl() {
    return document.getElementById('page') || document.querySelector('[data-admin-main]') || document.querySelector('main');
  }

  /** Soft-navigation failures are reported, not logged to the console; the caller falls back to a hard load. */
  function report(err) {
    try { if (window.TF.captureException) window.TF.captureException(err, 'nav'); } catch (e) {}
  }

  function isAdminPath(pathname) {
    return /(?:^|\/)admin(?:\/|$)/.test(pathname || '');
  }

  var SOURCE = {
    '/': '/index.html',
    '/login': '/login/index.html',
    '/signup': '/signup/index.html',
    '/signup/verify': '/signup/verify/index.html',
    '/tools': '/tools/index.html',
    '/ninjatrader': '/ninjatrader/index.html',
    '/legal/privacy': '/legal/privacy/index.html',
    '/legal/terms': '/legal/terms/index.html',
    '/legal/disclaimers': '/legal/disclaimers/index.html',
    '/course': '/course/index.html',
    '/account': '/account/index.html',
    '/account/access': '/account/access/index.html',
    '/account/course': '/account/course/index.html',
    '/account/profile': '/account/profile/index.html',
    '/account/notifications': '/account/notifications/index.html',
    '/admin': '/admin/index.html',
    '/admin/members': '/admin/members/index.html',
    '/admin/campaigns': '/admin/campaigns/index.html',
    '/admin/campaigns/history': '/admin/campaigns/history/index.html',
    '/admin/emails': '/admin/emails/index.html',
    '/admin/emails/new': '/admin/emails/new/index.html',
    '/admin/waitlist': '/admin/waitlist/index.html',
  };

  function barePath(pathname) {
    var p = String(pathname || '');
    p = p.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
    var bare = p.replace(/\/+$/, '') || '/';
    if (bare === '/suite') return '/tools';
    if (bare === '/dashboard') return '/account/access';
    if (bare === '/legal') return '/legal/privacy';
    return bare;
  }

  function sourceFile(pathname) {
    var bare = barePath(pathname);
    if (SOURCE[bare]) return SOURCE[bare];
    if (/^\/admin\/emails\/[^/]+$/.test(bare) && bare !== '/admin/emails/new') return '/admin/emails/edit/index.html';
    if (/^\/account\/course\/[^/]+$/.test(bare)) return '/account/course/index.html';
    return null;
  }

  function absUrl(href) {
    try { return new URL(href, location.href); } catch (e) { return null; }
  }

  function canonicalPath(pathname) {
    var bare = barePath(pathname);
    if (bare === '/') return '/';
    if (sourceFile(bare)) return bare + '/';
    var raw = String(pathname || '/');
    if (raw.length > 1 && !raw.endsWith('/')) return raw + '/';
    return raw;
  }

  function keyOf(url) {
    var path = canonicalPath(url.pathname);
    return String(path).replace(/\/index\.html$/, '/') + url.search;
  }

  function isInternal(url) {
    if (!url || url.origin !== location.origin) return false;
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') return false;
    return true;
  }

  function shouldIntercept(a) {
    if (!a || a.target === '_blank') return false;
    if (a.hasAttribute('download')) return false;
    if ((a.getAttribute('rel') || '').indexOf('sponsored') !== -1) return false;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return false;
    var url = absUrl(href);
    if (!isInternal(url)) return false;
    if (url.hostname === 'ninjatraderdomesticvendor.sjv.io') return false;
    if (isAdminPath(url.pathname) !== isAdminPath(location.pathname)) return false;
    return true;
  }

  function rememberScroll() {
    scrolls[keyOf(location)] = window.scrollY;
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function pauseHero() {
    if (heroCtl && heroCtl.pause) heroCtl.pause();
    if (window.TF.pauseHero) window.TF.pauseHero();
  }

  async function resumeHero() {
    var canvas = document.querySelector('#page canvas, main canvas');
    if (!canvas) return;
    try {
      await document.fonts.ready;
      var mod = await import('/assets/js/hero-sequence.js');
      if (heroCtl && heroCtl.destroy) heroCtl.destroy();
      heroCtl = mod.mountHeroSequence(canvas, { elapsed: window.__tfHeroElapsed || 0 });
      window.TF.pauseHero = heroCtl && heroCtl.pause;
      window.TF.resumeHero = heroCtl && heroCtl.resume;
    } catch (e) {}
  }

  function markLoadedScripts() {
    document.querySelectorAll('script[src]').forEach(function (s) {
      loadedScripts[new URL(s.getAttribute('src'), location.href).href] = true;
    });
  }

  function loadScripts(doc) {
    var list = [];
    doc.querySelectorAll('script[src]').forEach(function (s) {
      var src = s.getAttribute('src');
      if (!src || s.getAttribute('type') === 'module') return;
      var abs = new URL(src, location.href).href;
      if (loadedScripts[abs]) return;
      if (/\/nav\.js$/.test(abs)) return;
      loadedScripts[abs] = true;
      list.push(new Promise(function (resolve) {
        var el = document.createElement('script');
        el.src = src;
        el.onload = resolve;
        el.onerror = resolve;
        document.body.appendChild(el);
      }));
    });
    return Promise.all(list);
  }

  function cacheGet(k) {
    var e = cache[k];
    if (!e) return null;
    if (Date.now() - e.t > CACHE_MS) { delete cache[k]; return null; }
    return e.html;
  }

  async function fetchPage(url) {
    var k = keyOf(url);
    var hit = cacheGet(k);
    if (hit) return hit;
    var src = sourceFile(url.pathname);
    if (!src) {
      var miss = new Error('notfound');
      miss.code = 'notfound';
      throw miss;
    }
    var res = await fetch(src, { credentials: 'same-origin', cache: 'no-cache' });
    if (!res.ok) throw new Error('nav ' + res.status);
    var html = await res.text();
    cache[k] = { html: html, t: Date.now() };
    return html;
  }

  function adoptSheets(doc) {
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var abs = new URL(href, location.href).href;
      if ([].some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) { return l.href === abs; })) return;
      var el = document.createElement('link');
      el.rel = 'stylesheet';
      el.href = href;
      document.head.appendChild(el);
    });
  }

  // Carry the per-page SEO head over on soft navigation: title, description, robots, canonical,
  // hreflang and the tf-seo key that site.js uses for the language-specific title.
  var HEAD_SYNC = 'meta[name="description"], meta[name="robots"], meta[name="tf-seo"], link[rel="canonical"], link[rel="alternate"][hreflang], meta[property^="og:"], meta[name^="twitter:"]';
  function syncHead(doc) {
    document.head.querySelectorAll(HEAD_SYNC).forEach(function (el) { el.remove(); });
    if (!doc) return;
    doc.head.querySelectorAll(HEAD_SYNC).forEach(function (el) { document.head.appendChild(document.importNode(el, true)); });
  }

  // Each page ships its own inline <style> blocks (per-page hover classes, layout tweaks). They are
  // scoped to that page's markup, so on soft navigation the old ones go and the new page's come in;
  // otherwise a hover rule from the previous page keeps painting elements of the next one.
  var PAGE_STYLE = 'data-tf-page-style';
  function pageStyleSelector() {
    return 'style:not([id]), style#tf-cyan-btn';
  }
  function markPageStyles() {
    document.head.querySelectorAll(pageStyleSelector()).forEach(function (s) { s.setAttribute(PAGE_STYLE, ''); });
  }
  function syncPageStyles(doc) {
    document.head.querySelectorAll('style[' + PAGE_STYLE + '], style#tf-cyan-btn').forEach(function (s) { s.remove(); });
    if (!doc) return;
    doc.head.querySelectorAll(pageStyleSelector()).forEach(function (s) {
      var el = document.importNode(s, true);
      el.setAttribute(PAGE_STYLE, '');
      document.head.appendChild(el);
    });
  }

  async function renderNotFound() {
    closeChrome();
    try {
      var res = await fetch('/404.html', { credentials: 'same-origin' });
      var html = await res.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var next = doc.getElementById('page') || doc.querySelector('main');
      var cur = pageEl();
      if (cur && next) {
        var incoming = document.importNode(next, true);
        if (!incoming.id) incoming.id = 'page';
        cur.replaceWith(incoming);
      } else if (cur) {
        cur.innerHTML = '<div style="min-height:calc(100vh - 68px);display:grid;place-items:center;padding:48px 20px"><div style="max-width:42ch"><div style="font-family:Geist Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3"><span data-i18n="notfound.axis">404</span></div><h1 style="margin:12px 0 16px;font-size:32px"><span data-i18n="notfound.h1">Page not found</span></h1><p style="margin:0 0 28px;color:#B7BCCB"><span data-i18n="notfound.p">This address is not on the site.</span></p><a href="/" class="btn-primary" style="display:inline-flex;align-items:center;justify-content:center;height:48px;padding:0 22px;background:#2EE8FF;color:#04141A;border-radius:10px;font-weight:600"><span data-i18n="notfound.home">Back to home</span></a></div></div>';
      }
      syncHead(doc);
      syncPageStyles(doc);
      document.title = 'Page not found · Talaria Flow';
      if (window.TF.keepOneHeader) window.TF.keepOneHeader();
      if (window.TF.applyI18n) window.TF.applyI18n();
      if (window.TF.markActiveNav) window.TF.markActiveNav(location.pathname);
    } catch (e) {
      report(e);
    }
  }

  async function swapPage(href, opts) {
    opts = opts || {};
    var url = absUrl(href);
    if (!url) { location.href = href; return; }
    var canon = canonicalPath(url.pathname);
    if (canon && canon !== url.pathname) {
      url = new URL(canon + url.search + url.hash, url.origin);
    }

    var samePath = url.pathname === location.pathname && url.search === location.search;

    // First load of a page whose URL is already canonical: the server sent the right document and every
    // page script has self-mounted, so only normalise history and settle the hash. No refetch, no swap.
    if (opts.boot && samePath && sourceFile(url.pathname)) {
      history.replaceState({ tf: 1 }, '', url.pathname + url.search + url.hash);
      if (window.TF.markActiveNav) window.TF.markActiveNav(url.pathname);
      if (url.hash) {
        var bootTarget = document.getElementById(url.hash.slice(1));
        if (bootTarget) bootTarget.scrollIntoView();
      }
      return;
    }

    if (samePath && url.hash && !opts.boot) {
      var hashEl = document.getElementById(url.hash.slice(1));
      if (hashEl) {
        if (!opts.replace && !opts.pop) history.pushState({ tf: 1 }, '', url.pathname + url.search + url.hash);
        if (window.TF.showLegal) window.TF.showLegal();
        if (window.TF.mountTutorial) window.TF.mountTutorial();
        hashEl.scrollIntoView();
        return;
      }
    }

    if (!sourceFile(url.pathname)) {
      if (!opts.pop) {
        var method0 = opts.replace ? 'replaceState' : 'pushState';
        history[method0]({ tf: 1 }, '', url.pathname + url.search + url.hash);
      }
      await renderNotFound();
      return;
    }

    var html;
    try {
      html = await fetchPage(url);
    } catch (e) {
      if (e && e.code === 'notfound') {
        await renderNotFound();
        return;
      }
      location.href = url.href;
      return;
    }

    var doc = new DOMParser().parseFromString(html, 'text/html');
    var next = doc.getElementById('page') || doc.querySelector('[data-admin-main]') || doc.querySelector('main');
    var cur = pageEl();
    var nextAdmin = !!doc.querySelector('[data-shell]');
    var curAdmin = !!document.querySelector('[data-shell]');
    if (nextAdmin !== curAdmin) {
      adoptSheets(doc);
      syncHead(doc);
      syncPageStyles(doc);
      document.title = doc.title || document.title;
      document.body.innerHTML = doc.body.innerHTML;
      Array.prototype.forEach.call(doc.body.attributes, function (a) {
        document.body.setAttribute(a.name, a.value);
      });
      if (!opts.pop) {
        var method1 = opts.replace ? 'replaceState' : 'pushState';
        history[method1]({ tf: 1 }, '', url.pathname + url.search + url.hash);
      }
      await loadScripts(doc);
      if (window.TF.initClient) window.TF.initClient();
      if (window.TF.keepOneHeader) window.TF.keepOneHeader();
      if (window.TF.applyI18n) window.TF.applyI18n();
      if (window.TF.markActiveNav) window.TF.markActiveNav(url.pathname);
      if (window.TF.mountAccountApp) window.TF.mountAccountApp();
      if (window.TF.bootApp) window.TF.bootApp();
      if (nextAdmin && window.TF.mountAdminShell) {
        window.TF.mountAdminShell(document.body.getAttribute('data-admin-active') || 'overview');
        if (window.TF.mountAdminApp) window.TF.mountAdminApp();
      }
      if (window.TF.updateCrumb) window.TF.updateCrumb();
      return;
    }
    if (!next || !cur) {
      location.href = url.href;
      return;
    }

    pauseHero();
    rememberScroll();

    var incoming = document.importNode(next, true);
    if (!incoming.id) incoming.id = 'page';
    cur.replaceWith(incoming);

    // Icon, font and stylesheet links stay on the first document; the SEO subset and the page-scoped
    // inline styles are swapped.
    syncHead(doc);
    syncPageStyles(doc);
    document.title = doc.title || document.title;
    var nextActive = doc.body.getAttribute('data-admin-active');
    if (nextActive) document.body.setAttribute('data-admin-active', nextActive);

    if (!opts.pop) {
      var method = opts.replace ? 'replaceState' : 'pushState';
      history[method]({ tf: 1 }, '', url.pathname + url.search + url.hash);
    }

    if (window.TF.keepOneHeader) window.TF.keepOneHeader();
    if (window.TF.applyQueryLang) window.TF.applyQueryLang();
    else if (window.TF.applyI18n) window.TF.applyI18n();
    if (window.TF.markActiveNav) window.TF.markActiveNav(url.pathname);
    document.documentElement.classList.add('i18n-ready');

    await loadScripts(doc);
    if (window.TF.initClient) window.TF.initClient();
    if (window.TF.mountAccountApp) window.TF.mountAccountApp();
    if (window.TF.bootApp) window.TF.bootApp();
    if (curAdmin && window.TF.mountAdminShell) {
      window.TF.mountAdminShell(document.body.getAttribute('data-admin-active') || 'overview');
      if (window.TF.mountAdminApp) window.TF.mountAdminApp();
    }
    if (window.TF.showLegal) window.TF.showLegal();
    if (window.TF.mountTutorial) window.TF.mountTutorial();
    await resumeHero();

    if (opts.pop) {
      var y = scrolls[keyOf(url)];
      window.scrollTo({ top: y == null ? 0 : y, left: 0, behavior: 'instant' });
    } else {
      if (url.hash) {
        var target = document.getElementById(url.hash.slice(1));
        if (target) target.scrollIntoView();
        else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    }

  }

  function hardNav(href) {
    try { location.assign(href); } catch (e) { location.href = href; }
  }

  function closeChrome() {
    try {
      if (window.TF && window.TF.hideMenus) window.TF.hideMenus();
      if (window.TF && window.TF.hideTip) window.TF.hideTip();
      if (window.TF && window.TF.setDrawer) window.TF.setDrawer(false);
    } catch (e) {}
  }

  function isAccountPath(pathname) {
    return /^\/account(?:\/|$)/.test(pathname || '');
  }

  async function navigate(href, opts) {
    opts = opts || {};
    if (navigating) {
      hardNav(href);
      return;
    }
    navigating = true;
    closeChrome();
    try {
      var url = absUrl(href);
      if (url && isAccountPath(location.pathname) && isAccountPath(url.pathname) && window.TF.setAccountTab && !opts.boot) {
        var canon = canonicalPath(url.pathname);
        if (canon && canon !== url.pathname) url = new URL(canon + url.search + url.hash, url.origin);
        if (!opts.pop) {
          var method = opts.replace ? 'replaceState' : 'pushState';
          history[method]({ tf: 1 }, '', url.pathname + url.search + url.hash);
        }
        if (window.TF.markActiveNav) window.TF.markActiveNav(url.pathname);
        if (window.TF.applyQueryLang) window.TF.applyQueryLang();
        if (window.TF.mountAccountApp) window.TF.mountAccountApp();
        else window.TF.setAccountTab();
        if (window.TF.updateCrumb) window.TF.updateCrumb();
        return;
      }
      await swapPage(href, opts);
      closeChrome();
      if (window.TF && window.TF.updateCrumb) window.TF.updateCrumb();
    } catch (e) {
      report(e);
      hardNav(href);
    } finally {
      navigating = false;
    }
  }

  function prefetch(href) {
    var url = absUrl(href);
    if (!url || !isInternal(url)) return;
    if (isAdminPath(url.pathname) !== isAdminPath(location.pathname)) return;
    var k = keyOf(url);
    if (cacheGet(k)) return;
    fetchPage(url).catch(function () {});
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!shouldIntercept(a)) return;
    var href = a.getAttribute('href');
    if (navigating) {
      e.preventDefault();
      hardNav(a.href);
      return;
    }
    e.preventDefault();
    navigate(href).catch(function (err) {
      report(err);
      hardNav(a.href);
    });
  });

  document.addEventListener('mouseover', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (shouldIntercept(a)) prefetch(a.getAttribute('href'));
  }, true);

  document.addEventListener('focusin', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (shouldIntercept(a)) prefetch(a.getAttribute('href'));
  });

  window.addEventListener('popstate', function () {
    navigate(location.href, { pop: true });
  });

  window.TF.navigate = function (href) { return navigate(href); };
  window.TF.prefetch = prefetch;
  window.TF.sourceFile = sourceFile;

  markLoadedScripts();
  markPageStyles();
  if (document.querySelector('#page canvas, main canvas')) {
    resumeHero();
  }

  var bootPath = location.pathname + location.search + location.hash;
  var bootBare = barePath(location.pathname);
  if (!sourceFile(location.pathname)) {
    renderNotFound();
  } else if (bootBare !== '/') {
    navigate(bootPath, { replace: true, boot: true }).catch(function (err) {
      report(err);
    });
  }
})();
