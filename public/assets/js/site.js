(function () {
  var I18N = window.TF_I18N || {};

  (function injectBtnStates() {
    if (document.getElementById('tf-btn-states')) return;
    var s = document.createElement('style');
    s.id = 'tf-btn-states';
    s.textContent = [
      'a:not([class*="btn"]):not([data-signup]):hover{color:#F2F4F8}',
      'html body .btn-primary,html body .btn--primary,html body a.btn-primary,html body [data-signup],html body form button[type="submit"]:not(.btn-outline):not(.btn-neutral){color:#04141A!important;background:#2EE8FF!important}',
      'html body .btn-primary:hover,html body .btn-primary:focus,html body .btn-primary:focus-visible,html body .btn-primary:active,html body .btn--primary:hover,html body a.btn-primary:hover,html body a.btn-primary:focus-visible,html body [data-signup]:hover,html body form button[type="submit"]:not(.btn-outline):not(.btn-neutral):hover,html body form button[type="submit"]:not(.btn-outline):not(.btn-neutral):focus-visible,html body form button[type="submit"]:not(.btn-outline):not(.btn-neutral):active{background:#8FF3FF!important;color:#04141A!important}',
      'html body .btn-primary:disabled,html body .btn-primary.is-pending,html body .btn-primary.is-loading,html body form button[type="submit"]:disabled{color:#04141A!important;background:#2EE8FF!important}',
      'html body .btn-primary *,html body [data-signup] *,html body form button[type="submit"]:not(.btn-outline):not(.btn-neutral) *{color:#04141A!important}',
      'html body .btn-outline{color:#2EE8FF!important;background:transparent!important;border-color:#2EE8FF!important}',
      'html body .btn-outline:hover,html body .btn-outline:focus,html body .btn-outline:focus-visible,html body .btn-outline:active{background:rgba(46,232,255,.14)!important;color:#2EE8FF!important}',
      'html body .btn-outline:disabled,html body .btn-outline.is-pending,html body .btn-outline.is-loading,html body .btn-outline *{color:#2EE8FF!important}',
      'html body .btn-neutral{color:#F2F4F8!important;background:transparent!important}',
      'html body .btn-neutral:hover,html body .btn-neutral:focus,html body .btn-neutral:focus-visible,html body .btn-neutral:active{border-color:#F2F4F8!important;color:#F2F4F8!important}',
      'html body .btn-neutral:disabled,html body .btn-neutral.is-pending,html body .btn-neutral.is-loading,html body .btn-neutral *{color:#F2F4F8!important}',
      'html body .btn-primary:focus-visible,html body .btn-outline:focus-visible,html body .btn-neutral:focus-visible,html body [data-signup]:focus-visible,html body form button[type="submit"]:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(46,232,255,.18)}',
      '.tag:hover,[data-tag]:hover,[data-status]:hover,[data-status]:hover *,[data-kpi]>div:hover,[data-kpi]>div:hover *,table tbody tr:hover td{color:inherit}',
      '[role="menuitem"]:hover,[data-nav] a:hover,[data-account-nav] a:hover,[data-user-menu] a:hover{color:#F2F4F8}',
      'button,a[class*="btn"],[data-signup],[data-login],[data-drawer-actions] a,[data-act],.dlg-actions button{white-space:nowrap!important;flex:none!important;padding-top:0!important;padding-bottom:0!important;line-height:1}',
      'button span,a[class*="btn"] span,[data-signup] span,[data-login] span,[data-drawer-actions] a span{white-space:nowrap!important}',
      '[data-hd] [data-signup] [data-label-short]{display:none}',
      '@media (max-width:1100px){[data-hd] [data-signup] [data-label-full]{display:none!important}[data-hd] [data-signup] [data-label-short]{display:inline!important}}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  })();

  (function splitBrand() {
    var btn = document.getElementById('brand-menu-btn');
    if (!btn || btn.getAttribute('data-split') === '1') return;
    var parent = btn.parentNode;
    if (!parent) return;
    var img = btn.querySelector('img');
    var word = btn.querySelector('span');
    var home = document.createElement('a');
    home.href = '/';
    home.setAttribute('data-brand-home', '');
    home.setAttribute('aria-label', 'Talaria Flow');
    home.style.cssText = 'display:flex;align-items:center;gap:12px;height:40px;padding:0 4px 0 8px;color:#F2F4F8;font-family:Archivo,Cairo,sans-serif;font-size:17px;letter-spacing:-0.01em;white-space:nowrap;border-radius:10px;text-decoration:none';
    if (img) home.appendChild(img.cloneNode(true));
    if (word) home.appendChild(word.cloneNode(true));
    var chev = document.createElement('button');
    chev.id = 'brand-menu-btn';
    chev.setAttribute('data-brand', '');
    chev.setAttribute('data-split', '1');
    chev.type = 'button';
    chev.setAttribute('aria-haspopup', 'menu');
    chev.setAttribute('aria-expanded', 'false');
    chev.setAttribute('aria-label', 'Talaria sites');
    chev.style.cssText = 'width:32px;height:32px;display:grid;place-items:center;padding:0;margin:0;border:0;background:transparent;color:#8B90A3;cursor:pointer;border-radius:8px;flex:none';
    chev.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>';
    parent.style.display = 'flex';
    parent.style.alignItems = 'center';
    parent.style.gap = '2px';
    parent.insertBefore(home, btn);
    parent.insertBefore(chev, btn);
    parent.removeChild(btn);
  })();

  var brandBtn = document.getElementById('brand-menu-btn');
  var langBtn = document.getElementById('lang-menu-btn') || document.querySelector('button[aria-haspopup="listbox"]');
  var menuBtn = document.getElementById('menu-btn') || document.querySelector('[data-menu]');
  var brandMenu = document.getElementById('brand-menu');
  var langMenu = document.getElementById('lang-menu');
  var drawer = document.querySelector('[data-drawer]');
  var ICON_OPEN = 'M4 7h16M4 12h16M4 17h16';
  var ICON_CLOSE = 'M6 6l12 12M18 6 6 18';

  function langFromQuery() {
    try {
      var q = new URL(location.href).searchParams.get('lang');
      if (q === 'ar' || q === 'en') return q;
    } catch (e) {}
    return null;
  }

  function currentLang() {
    var q = langFromQuery();
    if (q) return q;
    try { return localStorage.getItem('tf-lang') || 'en'; } catch (e) { return 'en'; }
  }

  function liveLangBtn() {
    return document.querySelector('header [data-langbtn], #lang-menu-btn');
  }

  function liveLangMenu(btn) {
    btn = btn || liveLangBtn();
    if (btn && btn.parentElement) {
      var nest = btn.parentElement.querySelector('[role="listbox"]');
      if (nest) return nest;
    }
    return document.getElementById('lang-menu');
  }

  function keepOneHeader() {
    var headers = document.querySelectorAll('body > header, header');
    var seen = [];
    document.querySelectorAll('header').forEach(function (h) {
      if (seen.indexOf(h) !== -1) return;
      seen.push(h);
    });
    if (seen.length < 2) return;
    var page = document.getElementById('page');
    seen.forEach(function (h, i) {
      if (i === 0) return;
      if (page && page.contains(h) && h.parentNode) h.parentNode.removeChild(h);
    });
    var left = document.querySelectorAll('header');
    if (left.length < 2) return;
    for (var i = 1; i < left.length; i++) {
      if (left[i].parentNode) left[i].parentNode.removeChild(left[i]);
    }
  }

  function lookup(key, lang) {
    var node = I18N;
    key.split('.').forEach(function (p) { node = node && node[p]; });
    if (!node) return null;
    if (node.en != null || node.ar != null) return node[lang] != null ? node[lang] : node.en;
    return null;
  }

  function isFlexOrGrid(el) {
    try {
      var d = getComputedStyle(el).display;
      return d === 'flex' || d === 'inline-flex' || d === 'grid' || d === 'inline-grid';
    } catch (e) {
      return false;
    }
  }

  function isMonoEyebrow(el) {
    var probe = el;
    for (var i = 0; i < 3 && probe; i++) {
      var fam = (probe.style && probe.style.fontFamily) || '';
      if (/Geist Mono|monospace/i.test(fam)) return true;
      probe = probe.parentElement;
    }
    return false;
  }

  function isLayoutRoot(el) {
    if (!el || !el.tagName) return true;
    var t = el.tagName;
    if (/^(HTML|BODY|MAIN|HEADER|NAV|FOOTER|FORM)$/.test(t)) return true;
    if (el.hasAttribute('data-hero') || el.hasAttribute('data-axis') || el.hasAttribute('data-split') || el.hasAttribute('data-row') || el.hasAttribute('data-ladder') || el.hasAttribute('data-nav') || el.hasAttribute('data-hd') || el.hasAttribute('data-cols') || el.hasAttribute('data-check') || el.hasAttribute('data-step')) return true;
    return isFlexOrGrid(el);
  }

  function applyTdir(el, lang, str) {
    if (!el || isLayoutRoot(el)) return;
    var ar = lang === 'ar' && /[\u0600-\u06FF]/.test(str || '');
    el.setAttribute('dir', ar ? 'rtl' : 'ltr');
    el.style.textAlign = 'left';
    if (ar) el.style.letterSpacing = '0';
    else el.style.letterSpacing = '';
    var wrap = el.parentElement;
    if (wrap && wrap.hasAttribute('dir') && !isLayoutRoot(wrap)) {
      wrap.setAttribute('dir', ar ? 'rtl' : 'ltr');
      wrap.style.textAlign = 'left';
    }
    var heading = el.closest('h1, h2, h3, p');
    if (heading && heading !== el && !isLayoutRoot(heading)) {
      heading.setAttribute('dir', ar ? 'rtl' : 'ltr');
      heading.style.textAlign = 'left';
    }
  }

  function setText(el, str, lang) {
    if (!el) return;
    if (isFlexOrGrid(el)) {
      var inner = el.querySelector('[data-i18n], span') || el;
      if (inner === el) {
        el.textContent = '';
        inner = document.createElement('span');
        el.appendChild(inner);
      }
      el = inner;
    }
    el.textContent = str;
    applyTdir(el, lang, str);
    if (lang === 'ar' && /[\u0600-\u06FF]/.test(str) && isMonoEyebrow(el)) {
      el.style.fontFamily = "'Geist Mono','Cairo',monospace";
    }
  }
  window.TF_setText = setText;

  function applyI18n(lang) {
    var forceEn = /(?:^|\/)admin(?:\/|$)|admin(?:-[a-z]+)?\.html$/i.test(location.pathname);
    if (forceEn) lang = 'en';
    if (!forceEn) {
      try { localStorage.setItem('tf-lang', lang); } catch (e) {}
    }
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.dir = 'ltr';
    document.documentElement.classList.add('i18n-ready');
    // Legal pages: the English-original block under each section and the translation banner
    // exist only when lang === 'ar'. In English they are removed from the flow (hidden attribute,
    // in addition to the CSS rule) so no empty banner box or duplicate text can render.
    document.querySelectorAll('[data-ar-only],[data-en-orig]').forEach(function (el) {
      if (lang === 'ar') el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var val = lookup(el.getAttribute('data-i18n'), lang);
      if (val == null) return;
      if (el.querySelector('svg, img')) {
        var span = el.querySelector('span');
        if (span && !span.querySelector('svg, img')) setText(span, val, lang);
        else {
          var textNode = null;
          for (var i = 0; i < el.childNodes.length; i++) {
            if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim()) {
              textNode = el.childNodes[i];
              break;
            }
          }
          if (textNode) textNode.textContent = val;
        }
        applyTdir(span || el, lang, val);
      } else {
        setText(el, val, lang);
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var val = lookup(el.getAttribute('data-i18n-placeholder'), lang);
      if (val == null) return;
      el.setAttribute('placeholder', val);
      if (lang === 'ar') {
        el.setAttribute('dir', 'rtl');
        el.style.textAlign = 'left';
      } else {
        el.setAttribute('dir', 'ltr');
      }
    });
    var btn = liveLangBtn();
    var langLabel = btn && (btn.querySelector('[data-i18n="header.lang"]') || btn.querySelector('span'));
    if (langLabel) langLabel.textContent = lang === 'ar' ? 'العربية' : 'EN';
    // Accessible name must contain the visible text (WCAG 2.5.3): "Language: EN" / "اللغة: العربية".
    if (btn) btn.setAttribute('aria-label', (lang === 'ar' ? 'اللغة: ' : 'Language: ') + (langLabel ? langLabel.textContent : lang.toUpperCase()));
    var menu = liveLangMenu(btn);
    if (menu) {
      menu.querySelectorAll('[role="option"]').forEach(function (opt) {
        var on = (opt.getAttribute('lang') === lang);
        var mark = opt.querySelector('span:last-child');
        if (mark && mark !== opt.firstElementChild) mark.style.background = on ? '#2EE8FF' : 'transparent';
        opt.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    document.querySelectorAll('[data-drawer-lang] [lang]').forEach(function (dbtn) {
      var on = dbtn.getAttribute('lang') === lang;
      dbtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    try {
      placeIndicator();
      requestAnimationFrame(function () { try { placeIndicator(); } catch (e2) {} });
    } catch (e) {}
    applySeo(lang);
  }

  function setMeta(attr, name, value) {
    var el = document.head.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  // Per-page title/description from SEO.md in the rendered language; OG image follows the language.
  function applySeo(lang) {
    var key = document.head.querySelector('meta[name="tf-seo"]');
    if (!key) return;
    key = key.getAttribute('content');
    var title = lookup('seo.' + key + '.title', lang);
    var desc = lookup('seo.' + key + '.description', lang);
    if (title) {
      document.title = title;
      setMeta('property', 'og:title', title);
      setMeta('name', 'twitter:title', title);
    }
    if (desc) {
      setMeta('name', 'description', desc);
      setMeta('property', 'og:description', desc);
      setMeta('name', 'twitter:description', desc);
    }
    var img = 'https://www.talaria-flow.com/assets/og-default' + (lang === 'ar' ? '-ar' : '') + '.png';
    setMeta('property', 'og:image', img);
    setMeta('name', 'twitter:image', img);
    setMeta('property', 'og:locale', lang === 'ar' ? 'ar_AR' : 'en_GB');
    setMeta('property', 'og:locale:alternate', lang === 'ar' ? 'en_GB' : 'ar_AR');
  }

  function hideBrandLang() {
    if (brandMenu) brandMenu.style.setProperty('display', 'none');
    var menu = liveLangMenu();
    var btn = liveLangBtn();
    if (menu) {
      menu.style.setProperty('display', 'none');
      menu.removeAttribute('data-open');
    }
    if (brandBtn) brandBtn.setAttribute('aria-expanded', 'false');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function clickInsideChrome(el) {
    return !!(el && el.closest && el.closest('[aria-haspopup], [role="menu"], [role="listbox"], [data-user-menu], [data-drawer], [data-langbtn]'));
  }

  function toastLang(msg) {
    if (window.tfToast) return window.tfToast(msg);
    var el = document.querySelector('[data-tf-toast]');
    if (!el) {
      el = document.createElement('div');
      el.setAttribute('data-tf-toast', '');
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:80;padding:10px 14px;border-radius:10px;background:#0E1017;border:1px solid rgba(255,255,255,0.12);color:#F2F4F8;font-size:13.5px;display:none';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 3200);
  }

  function persistMemberLang(lang) {
    Promise.resolve().then(function () {
      var session = window.TF.getSession && window.TF.getSession();
      if (!session || !session.user || !window.TF.getClient) return null;
      return window.TF.getClient().from('profiles').update({ lang: lang }).eq('id', session.user.id);
    }).then(function (res) {
      if (res && res.error) throw res.error;
    }).catch(function () {
      toastLang(lookup('auth.langSaveFailed', lang) || 'Could not save language to your account');
    });
  }

  function setLang(lang) {
    lang = lang === 'ar' ? 'ar' : 'en';
    if (/(?:^|\/)admin(?:\/|$)|admin(?:-[a-z]+)?\.html$/i.test(location.pathname)) lang = 'en';
    try { localStorage.setItem('tf-lang', lang); } catch (e) {}
    applyI18n(lang);
    updateCrumb();
    window.dispatchEvent(new CustomEvent('tf-lang', { detail: lang }));
    persistMemberLang(lang);
  }

  function closeUserMenu() {
    var menu = document.querySelector('[data-user-menu]');
    var btn = document.querySelector('[data-user-wrap] > button[aria-haspopup="menu"]');
    if (menu) menu.style.display = 'none';
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function hideMenus() {
    hideBrandLang();
    closeUserMenu();
    if (window.TF.hideTip) window.TF.hideTip();
  }

  function setDrawer(open) {
    if (!drawer || !menuBtn) return;
    drawer.style.setProperty('display', open ? 'block' : 'none');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var path = menuBtn.querySelector('path');
    if (path) path.setAttribute('d', open ? ICON_CLOSE : ICON_OPEN);
  }

  function drawerOpen() {
    return drawer && getComputedStyle(drawer).display !== 'none';
  }

  if (brandBtn && brandMenu) brandBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = getComputedStyle(brandMenu).display === 'none';
    hideMenus();
    setDrawer(false);
    if (open) {
      brandMenu.style.setProperty('display', 'flex');
      brandBtn.setAttribute('aria-expanded', 'true');
    }
  });

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
    if (!t || !t.closest) return;
    var langTrigger = t.closest('[data-langbtn]');
    if (langTrigger) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      var menu = liveLangMenu(langTrigger);
      var willOpen = menu && menu.getAttribute('data-open') !== '1';
      hideMenus();
      setDrawer(false);
      if (willOpen && menu) {
        menu.style.setProperty('display', 'flex');
        menu.setAttribute('data-open', '1');
        langTrigger.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    // Only the header language menu is handled here; other listboxes (custom selects) own their clicks.
    var opt = t.closest('[role="option"]');
    var langMenuEl = opt ? liveLangMenu() : null;
    if (opt && (opt.closest('#lang-menu') || (langMenuEl && langMenuEl.contains(opt)))) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      var next = opt.getAttribute('lang') === 'ar' || /العربية/.test(opt.textContent) ? 'ar' : 'en';
      hideMenus();
      setLang(next);
      return;
    }
    var drawerLang = t.closest('[data-drawer-lang] [lang]');
    if (drawerLang) {
      e.stopPropagation();
      setLang(drawerLang.getAttribute('lang') === 'ar' ? 'ar' : 'en');
      setDrawer(false);
      return;
    }
    if (drawer && drawerOpen() && !t.closest('[data-drawer]') && !t.closest('[data-menu]')) {
      setDrawer(false);
    }
    if (!clickInsideChrome(t)) hideMenus();
  }, true);

  if (menuBtn) menuBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    hideMenus();
    setDrawer(!drawerOpen());
  });

  if (drawer) {
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) setDrawer(false);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      hideMenus();
      setDrawer(false);
    }
  });

  // Legacy /legal/#section links: the server sends /legal/ to /legal/privacy/ and browsers keep the
  // fragment, so land on the page the fragment names.
  function showLegal() {
    var m = /^\/legal\/(privacy|terms|disclaimers)\/?$/.exec(location.pathname);
    var want = (location.hash || '').replace('#', '');
    if (!m || !/^(disclaimers|privacy|terms)$/.test(want) || want === m[1]) return;
    location.replace('/legal/' + want + '/');
  }
  window.addEventListener('hashchange', function () {
    showLegal();
    markActiveNav(location.pathname);
    if (window.TF.mountTutorial) window.TF.mountTutorial();
  });
  showLegal();

  function activeKeyFromPath(pathname) {
    var p = String(pathname == null ? location.pathname : pathname).replace(/\/+$/, '') || '/';
    if (/\/account(?:\/|$)/i.test(p)) return '';
    if (/\/course(?:\/|$|\.html)/i.test(p)) return 'course';
    var file = (p.split('/').pop() || '').replace(/\.html$/i, '').toLowerCase();
    if (!file || file === 'index') return 'home';
    if (file === 'ninjatrader') return 'ninjatrader';
    if (file === 'tools' || file === 'suite') return 'suite';
    return '';
  }

  var navEl = document.querySelector('[data-nav]');
  var navInd = null;
  var navReady = false;
  var navHoverBound = false;
  var lastPathname = null;

  // Active rule lives on the link (position:absolute; bottom:-1px), not as a border on the link
  // and not as a sliding bar on the header. Matches the header snippet in DO-THIS-NOW.
  function ensureNavInd() {
    navEl = document.querySelector('[data-nav]');
    return navEl || null;
  }

  function canHoverNav() {
    try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
    catch (e) { return false; }
  }

  function placeIndicator(pathname, previewKey) {
    if (!ensureNavInd()) return;
    var key = previewKey != null ? previewKey : activeKeyFromPath(pathname != null ? pathname : lastPathname);
    navEl.querySelectorAll('[data-nav-rule]').forEach(function (el) { el.remove(); });
    document.querySelectorAll('.nav-ind').forEach(function (el) { el.remove(); });
    var a = key ? navEl.querySelector('[data-key="' + key + '"]') : null;
    if (!a) return;
    var rule = document.createElement('span');
    rule.setAttribute('aria-hidden', 'true');
    rule.setAttribute('data-nav-rule', '');
    rule.style.cssText = 'position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#2EE8FF';
    a.appendChild(rule);
    if (!navReady) navReady = true;
  }

  function bindNavIndicator() {
    if (!ensureNavInd() || navHoverBound) return;
    navHoverBound = true;
    if (window.ResizeObserver) {
      new ResizeObserver(function () { placeIndicator(); }).observe(navEl);
    }
    window.addEventListener('resize', function () { placeIndicator(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { placeIndicator(); });
    }
    if (!canHoverNav()) return;
    navEl.addEventListener('mouseenter', function (e) {
      var a = e.target.closest('[data-key]');
      if (!a || !navEl.contains(a)) return;
      placeIndicator(null, a.getAttribute('data-key'));
    }, true);
    navEl.addEventListener('mouseleave', function () { placeIndicator(); });
  }

  function markActiveNav(pathname) {
    lastPathname = pathname != null ? pathname : location.pathname;
    var key = activeKeyFromPath(lastPathname);
    document.querySelectorAll('[data-nav] [data-key]').forEach(function (a) {
      var on = a.getAttribute('data-key') === key;
      a.style.color = '';
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-drawer] .container > a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var itemKey = a.getAttribute('data-key') || activeKeyFromPath(href);
      var on = itemKey === key && key !== '';
      a.style.color = on ? '#F2F4F8' : '#B7BCCB';
      a.style.fontWeight = on ? '600' : '500';
      var dot = a.querySelector('span[style*="border-radius: 50%"], span[style*="border-radius:50%"]');
      if (dot && !dot.textContent.trim()) dot.style.background = on ? '#2EE8FF' : 'transparent';
    });
    bindNavIndicator();
    placeIndicator(lastPathname);
  }

  keepOneHeader();
  mountSkipLink();
  var bootLang = langFromQuery();
  if (bootLang) {
    try { localStorage.setItem('tf-lang', bootLang); } catch (e) {}
  }
  applyI18n(currentLang());
  markActiveNav();

  function mountSkipLink() {
    if (document.querySelector('.tf-skip-link')) return;
    var target = document.getElementById('page') || document.querySelector('main');
    if (!target) return;
    if (!target.id) target.id = 'page';
    var a = document.createElement('a');
    a.className = 'tf-skip-link';
    a.href = '#' + target.id;
    a.setAttribute('data-i18n', 'header.skip');
    a.textContent = lookup('header.skip', currentLang()) || 'Skip to content';
    a.addEventListener('click', function (e) {
      e.preventDefault();
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: false });
      target.scrollIntoView({ block: 'start' });
    });
    document.body.insertBefore(a, document.body.firstChild);
  }

  window.TF = window.TF || {};
  function crumbParts(pathname) {
    var p = String(pathname == null ? location.pathname : pathname).replace(/\/+$/, '') || '/';
    if (!/^\/account(?:\/|$)/i.test(p)) return null;
    var parts = [
      { href: '/', key: 'header.home', fallback: 'Home' },
      { href: '/account/', key: 'header.account', fallback: 'Account' }
    ];
    if (/\/account\/profile/i.test(p)) parts.push({ href: '/account/profile/', key: 'header.userProfile', fallback: 'Profile' });
    else if (/\/account\/course/i.test(p)) parts.push({ href: '/account/course/', key: 'header.course', fallback: 'Course' });
    else if (/\/account\/notifications/i.test(p)) parts.push({ href: '/account/notifications/', key: 'account.nav.notifications', fallback: 'Notifications' });
    else if (/\/account\/access/i.test(p)) parts.push({ href: '/account/access/', key: 'account.nav.access', fallback: 'Course access' });
    return parts;
  }

  function updateCrumb(pathname) {
    var parts = crumbParts(pathname);
    var existing = document.querySelector('[data-crumb]');
    if (!parts) {
      if (existing) existing.remove();
      return;
    }
    var nav = existing || document.createElement('nav');
    nav.setAttribute('data-crumb', '');
    nav.setAttribute('aria-label', 'Breadcrumb');
    nav.innerHTML = '';
    var lang = currentLang();
    parts.forEach(function (part, i) {
      if (i) {
        var sep = document.createElement('span');
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '/';
        nav.appendChild(sep);
      }
      var last = i === parts.length - 1;
      var label = lookup(part.key, lang) || part.fallback;
      if (last) {
        var cur = document.createElement('span');
        cur.setAttribute('aria-current', 'page');
        cur.setAttribute('data-i18n', part.key);
        cur.textContent = label;
        nav.appendChild(cur);
      } else {
        var a = document.createElement('a');
        a.href = part.href;
        a.setAttribute('data-i18n', part.key);
        a.textContent = label;
        nav.appendChild(a);
      }
    });
    if (!existing) {
      var header = document.querySelector('header');
      if (header) header.after(nav);
    }
  }

  window.TF.applyI18n = function (lang) { applyI18n(lang || currentLang()); updateCrumb(); };
  window.TF.applyQueryLang = function () {
    var q = langFromQuery();
    if (q) setLang(q);
    else applyI18n(currentLang());
    updateCrumb();
  };
  window.TF.lookup = lookup;
  window.TF.setLang = setLang;
  window.TF.logout = logout;
  window.TF.keepOneHeader = keepOneHeader;
  window.TF.markActiveNav = markActiveNav;
  window.TF.placeIndicator = placeIndicator;
  window.TF.showLegal = showLegal;
  window.TF.currentLang = currentLang;
  window.TF.hideMenus = hideMenus;
  window.TF.setDrawer = setDrawer;
  window.TF.updateCrumb = updateCrumb;
  updateCrumb();

  function logout(e) {
    if (e) e.preventDefault();
    hideMenus();
    setDrawer(false);
    var goHome = /^\/(account|admin)(\/|$)/.test(location.pathname || '/');
    Promise.resolve().then(function () {
      return window.TF && window.TF.signOut ? window.TF.signOut() : null;
    }).then(function () {
      if (!goHome) return;
      if (window.TF.navigate) window.TF.navigate('/');
      else location.href = '/';
    }).catch(function () {
      if (goHome) location.href = '/';
    });
  }

  function memberIdentity(name, email, profile) {
    var firstName = profile && profile.first_name ? String(profile.first_name).trim() : '';
    var lastName = profile && profile.last_name ? String(profile.last_name).trim() : '';
    name = String(name == null ? '' : name).trim();
    email = String(email == null ? '' : email).trim();
    if (!name && (firstName || lastName)) name = [firstName, lastName].filter(Boolean).join(' ');
    var words = name.split(/\s+/).filter(Boolean);
    var initials = firstName
      ? (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase()
      : words.length
        ? words.map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase()
        : (email.charAt(0) || '').toUpperCase();
    var local = email.split('@')[0] || '';
    var first = firstName;
    if (first.length < 2) {
      first = (words[0] && words[0].length >= 2) ? words[0] : (firstName || words[0] || local.split(/[._-]/)[0] || '');
    }
    return { initials: initials, first: first, display: name || local, email: email, name: name };
  }

  function avatarSpan(size, initials) {
    var el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    var fs = size >= 36 ? '15px' : '11px';
    el.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,#2EE8FF,#FF37B0);color:#04141A;font-weight:700;font-size:' + fs + ';letter-spacing:.02em';
    el.textContent = initials || '';
    return el;
  }

  function iconSvg(d) {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }

  function userMenuRow(href, key, fallback, d, extra) {
    var a = document.createElement('a');
    a.setAttribute('role', 'menuitem');
    a.href = href;
    a.style.cssText = 'display:flex;align-items:center;gap:10px;height:38px;padding:0 10px;border-radius:8px;font-size:14px;color:#F2F4F8' + (extra || '');
    a.innerHTML = iconSvg(d) + '<span data-i18n="' + key + '">' + fallback + '</span>';
    return a;
  }

  var lastSession = null;
  var guestSnap = null;

  function htmlNode(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    return wrap.firstElementChild;
  }

  function drawerActionsEl() {
    return document.querySelector('[data-drawer-actions]') || document.querySelector('[data-drawer] > div > div:last-child');
  }

  function footerSiteCol() {
    var a = document.querySelector('footer a[href="/course/"]');
    return a ? a.parentNode : null;
  }

  function cacheGuest() {
    if (guestSnap) return;
    var login = document.querySelector('[data-hd] [data-login]');
    var signup = document.querySelector('[data-hd] [data-signup]');
    var actions = drawerActionsEl();
    var footerLogin = document.querySelector('footer a[href="/login/"], footer a[href*="/login/"]');
    var footerSignup = document.querySelector('footer a[href="/signup/"], footer a[href*="/signup/"]');
    guestSnap = {
      loginHTML: login ? login.outerHTML : '',
      signupHTML: signup ? signup.outerHTML : '',
      drawerHTML: actions ? actions.innerHTML : '',
      drawerStyle: actions ? (actions.getAttribute('style') || '') : '',
      footerLoginHTML: footerLogin ? footerLogin.outerHTML : '',
      footerSignupHTML: footerSignup ? footerSignup.outerHTML : '',
    };
  }

  function clearHeaderSession() {
    document.querySelectorAll('[data-hd] [data-login], [data-hd] [data-signup], [data-hd] [data-user-wrap]').forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function showGuestHeader() {
    if (!guestSnap) return;
    clearHeaderSession();
    var menu = document.querySelector('[data-hd] [data-menu]');
    var parent = menu && menu.parentNode;
    if (parent && guestSnap.loginHTML) parent.insertBefore(htmlNode(guestSnap.loginHTML), menu);
    if (parent && guestSnap.signupHTML) {
      if (menu.nextSibling) parent.insertBefore(htmlNode(guestSnap.signupHTML), menu.nextSibling);
      else parent.appendChild(htmlNode(guestSnap.signupHTML));
    }
    var actions = drawerActionsEl();
    if (actions && guestSnap.drawerHTML) {
      actions.innerHTML = guestSnap.drawerHTML;
      if (guestSnap.drawerStyle) actions.setAttribute('style', guestSnap.drawerStyle);
    }
    var col = footerSiteCol();
    if (col) {
      if (!col.querySelector('a[href*="/signup/"]') && guestSnap.footerSignupHTML) col.appendChild(htmlNode(guestSnap.footerSignupHTML));
      if (!col.querySelector('a[href*="/login/"]') && guestSnap.footerLoginHTML) col.appendChild(htmlNode(guestSnap.footerLoginHTML));
    }
    if (window.TF.applyI18n) window.TF.applyI18n();
  }

  function applySessionHeader(state) {
    cacheGuest();
    if (!state || !state.user) {
      lastSession = null;
      showGuestHeader();
      return;
    }
    lastSession = state;
    var email = state.user.email || '';
    var name = (state.profile && (state.profile.name || [state.profile.first_name, state.profile.last_name].filter(Boolean).join(' '))) || '';
    var isAdmin = Boolean(state.isAdmin);
    var ident = memberIdentity(name, email, state.profile);
    var dashHref = isAdmin ? '/admin/' : '/account/';
    var dashKey = isAdmin ? 'header.queue' : 'header.userDash';
    var dashLabel = lookup(dashKey, currentLang()) || (isAdmin ? 'Admin' : 'Dashboard');
    var lang = currentLang();

    clearHeaderSession();

    var menuBtn = document.querySelector('[data-hd] [data-menu]');
    var parent = menuBtn && menuBtn.parentNode;
    if (parent) {
      var slot = document.createElement('div');
      slot.setAttribute('data-user-wrap', '');
      slot.setAttribute('data-session-chip', '');
      slot.style.position = 'relative';
      slot.style.flex = 'none';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', lookup('header.account', lang) || 'Account menu');
      btn.style.cssText = 'display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 10px 0 4px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;background:transparent;color:#F2F4F8;font-family:Archivo,Cairo,sans-serif;font-size:13.5px;font-weight:600;white-space:nowrap;cursor:pointer';
      btn.appendChild(avatarSpan(26, ident.initials));
      var first = document.createElement('span');
      first.setAttribute('data-chip-first', '');
      first.textContent = ident.first;
      btn.appendChild(first);
      btn.insertAdjacentHTML('beforeend', '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="opacity:.7"><path d="m6 9 6 6 6-6"></path></svg>');
      var menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      menu.setAttribute('data-user-menu', '');
      menu.style.cssText = 'display:none;position:absolute;top:calc(100% + 6px);right:0;width:220px;padding:6px;background:#0E1017;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.45);z-index:60;flex-direction:column;gap:2px';
      var head = document.createElement('div');
      head.style.cssText = 'padding:8px 10px 10px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px';
      head.innerHTML = '<div data-menu-name style="font-size:13.5px;font-weight:600">' + window.TF.escapeHtml(ident.display || ident.first) + '</div><div style="font-family:Geist Mono,monospace;font-size:11px;color:#8B90A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + window.TF.escapeHtml(email) + '</div>';
      menu.appendChild(head);
      menu.appendChild(userMenuRow(dashHref, dashKey, dashLabel, '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path>'));
      menu.appendChild(userMenuRow('/account/profile/', 'header.userProfile', lookup('header.userProfile', lang) || 'Profile', '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>'));
      var out = userMenuRow('#logout', 'header.logout', lookup('header.logout', lang) || 'Log out', '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"></path>', ';color:#B7BCCB;border-top:1px solid rgba(255,255,255,0.08);margin-top:4px;border-radius:0 0 8px 8px');
      out.addEventListener('click', logout);
      menu.appendChild(out);
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = menu.style.display === 'none' || !menu.style.display;
        hideBrandLang();
        setDrawer(false);
        menu.style.display = open ? 'flex' : 'none';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      slot.appendChild(btn);
      slot.appendChild(menu);
      parent.insertBefore(slot, menuBtn);
    }

    var emailLine = document.querySelector('[data-drawer-email]');
    if (emailLine && emailLine.parentNode) emailLine.parentNode.removeChild(emailLine);

    var actions = drawerActionsEl();
    if (actions) {
      actions.style.display = 'flex';
      actions.style.flexDirection = 'column';
      actions.style.gap = '8px';
      actions.innerHTML = '';
      function drawerLink(href, key, fallback, onClick) {
        var a = document.createElement('a');
        a.href = href;
        a.style.cssText = 'display:flex;align-items:center;justify-content:center;height:48px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;font-size:15px;font-weight:600;color:#F2F4F8';
        var span = document.createElement('span');
        span.setAttribute('data-i18n', key);
        span.textContent = fallback;
        a.appendChild(span);
        if (onClick) a.addEventListener('click', onClick);
        actions.appendChild(a);
      }
      drawerLink(dashHref, dashKey, dashLabel);
      drawerLink('#logout', 'header.logout', lookup('header.logout', lang) || 'Log out', logout);
    }

    document.querySelectorAll('footer a[href*="/login/"], footer a[href*="/signup/"]').forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    if (window.TF.applyI18n) window.TF.applyI18n();
  }

  window.TF.memberIdentity = memberIdentity;
  window.TF.applySessionHeader = applySessionHeader;
  window.TF.refreshSessionHeader = function (patch) {
    if (lastSession && patch) {
      lastSession.profile = Object.assign({}, lastSession.profile || {}, patch);
    }
    if (lastSession) applySessionHeader(lastSession);
  };
  window.TF.authCopy = function (key) {
    return lookup('auth.' + key, currentLang()) || key;
  };
  window.TF.mountPwToggle = function (input) {
    if (!input || input.parentElement.querySelector('.tf-pw-toggle')) return;
    var wrap = input.parentElement;
    if (!wrap.classList.contains('tf-input-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'tf-input-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    input.classList.add('tf-input');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tf-pw-toggle';
    btn.setAttribute('aria-label', lookup('auth.show', currentLang()) || 'Show password');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      var label = lookup(show ? 'auth.hide' : 'auth.show', currentLang()) || (show ? 'Hide password' : 'Show password');
      btn.setAttribute('aria-label', label);
    });
    wrap.appendChild(btn);
  };

  (function bindTooltips() {
    var tip = document.createElement('div');
    tip.className = 'tf-tip';
    // Visual hover aid only: the text mirrors the control's title/aria-label, so hide it from AT.
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    var timer = null;
    var active = null;
    function coarse() {
      return window.matchMedia && window.matchMedia('(hover: none)').matches;
    }
    function isToggle(el) {
      return el.matches('[data-menu], .tf-pw-toggle, [data-play], [data-pause], button[aria-pressed]');
    }
    function hide() {
      clearTimeout(timer);
      tip.classList.remove('is-on');
      tip.textContent = '';
      active = null;
    }
    function show(el) {
      if (!el || coarse() || isToggle(el)) return;
      var text = el.getAttribute('data-tip') || el.getAttribute('title');
      if (!text) return;
      if (el.hasAttribute('title')) el.removeAttribute('title');
      tip.textContent = text;
      var r = el.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(window.innerWidth - 248, r.left)) + 'px';
      tip.style.top = (r.bottom + 6) + 'px';
      tip.classList.add('is-on');
      active = el;
    }
    document.addEventListener('mouseover', function (e) {
      var el = e.target.closest('[data-tip], button[title]');
      if (!el || el === tip || isToggle(el)) return;
      clearTimeout(timer);
      timer = setTimeout(function () { show(el); }, 400);
    });
    document.addEventListener('mouseout', function (e) {
      var el = e.target.closest('[data-tip], [title]');
      if (el && !el.contains(e.relatedTarget)) hide();
    });
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('click', hide, true);
    document.addEventListener('focusin', function (e) {
      var el = e.target.closest('[data-tip]');
      if (el && !isToggle(el)) show(el);
    });
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    var obs = new MutationObserver(function () {
      if (active && !document.contains(active)) hide();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    if (menuBtn) menuBtn.removeAttribute('data-tip');
    document.querySelectorAll('[data-tip-i18n]').forEach(function (el) {
      var val = lookup(el.getAttribute('data-tip-i18n'), currentLang());
      if (val) el.setAttribute('data-tip', val);
    });
    window.TF.hideTip = hide;
  })();

  var CONSENT_KEY = 'tf-consent';
  var CONSENT_MS = 365 * 24 * 60 * 60 * 1000;

  function isAdminPath(pathname) {
    return /\/admin(?:\/|$)/.test(pathname == null ? location.pathname : pathname);
  }

  function readConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || (o.v !== 'all' && o.v !== 'essential') || !o.t) return null;
      if (Date.now() - Number(o.t) > CONSENT_MS) return null;
      return o.v;
    } catch (e) { return null; }
  }

  function writeConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }

  function consentCopy(lang) {
    var ar = lang === 'ar';
    var L = window.TF.lookup;
    function pick(key, fallback) { var v = L && L(key, lang); return v || fallback; }
    return {
      body: pick('cookies.body', ar
        ? 'نستخدم ملفات تعريف الارتباط الضرورية لتشغيل الموقع وتذكّر لغتك. لا إعلانات ولا تتبّع. حسناً يغلق هذا الإشعار.'
        : 'We only use cookies needed to run the site and remember your language. There is no advertising or tracking. OK dismisses this notice.'),
      accept: pick('cookies.ok', ar ? 'حسناً' : 'OK'),
      more: pick('cookies.more', ar ? 'اعرف المزيد' : 'Learn more'),
      label: pick('cookies.label', ar ? 'إشعار ملفات تعريف الارتباط' : 'Cookie notice'),
    };
  }

  function padForConsent(on) {
    document.body.style.paddingBottom = on ? '88px' : '';
  }

  function removeConsentBar() {
    var el = document.getElementById('tf-consent');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    padForConsent(false);
  }

  function showConsent(force) {
    if (isAdminPath()) { removeConsentBar(); return; }
    if (!force && readConsent()) { removeConsentBar(); return; }
    if (!force && document.getElementById('tf-consent')) return;
    removeConsentBar();
    var lang = currentLang();
    var ar = lang === 'ar';
    var t = consentCopy(lang);
    var bar = document.createElement('div');
    bar.id = 'tf-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-modal', 'true');
    bar.setAttribute('aria-labelledby', 'tf-consent-label');
    bar.tabIndex = -1;
    bar.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:180;display:flex;flex-wrap:wrap;align-items:center;gap:16px;max-width:1180px;margin:0 auto;padding:14px 18px;background:#0E1017;border:1px solid rgba(255,255,255,0.12);border-radius:12px;transform:translateY(12px);opacity:0;transition:transform .2s ease,opacity .2s ease';
    bar.innerHTML =
      '<p id="tf-consent-label" dir="' + (ar ? 'rtl' : 'ltr') + '" style="margin:0;flex:1 1 320px;font-size:14px;line-height:1.55;color:#B7BCCB;text-align:left">' +
        t.body + ' <a href="/legal/privacy/" style="color:#2EE8FF;border-bottom:1px solid rgba(46,232,255,.4)">' + t.more + '</a>' +
      '</p>' +
      '<div style="display:flex;gap:10px;flex:none">' +
        '<button type="button" data-consent="essential" style="min-height:44px;height:44px;padding:0 18px;border-radius:10px;border:1px solid #2EE8FF;background:transparent;color:#2EE8FF;font:600 14px ' + (ar ? 'Cairo' : 'Archivo') + ',sans-serif;cursor:pointer;white-space:nowrap;line-height:1">' + t.accept + '</button>' +
      '</div>';
    document.body.appendChild(bar);
    padForConsent(true);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bar.style.transform = 'none';
        bar.style.opacity = '1';
      });
    });
    function trap(e) {
      if (e.key === 'Escape') { e.preventDefault(); bar.querySelector('[data-consent]').click(); return; }
      if (e.key !== 'Tab') return;
      var list = bar.querySelectorAll('a, button');
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    bar.addEventListener('keydown', trap);
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (!btn) return;
      writeConsent(btn.getAttribute('data-consent'));
      removeConsentBar();
    });
    var firstBtn = bar.querySelector('[data-consent]');
    if (firstBtn) firstBtn.focus();
  }

  function injectCookieSettings() {
    var privacy = document.querySelector('footer a[href="/legal/privacy/"]');
    if (!privacy || !privacy.parentNode) return;
    if (privacy.parentNode.querySelector('[data-cookie-settings]')) return;
    if (isAdminPath()) return;
    var a = document.createElement('button');
    a.type = 'button';
    a.setAttribute('data-cookie-settings', '');
    a.setAttribute('data-i18n', 'footer.cookies');
    a.className = 'scp5';
    a.style.cssText = 'display:block;height:auto;padding:0;border:0;background:transparent;color:#B7BCCB;font:inherit;font-size:var(--fs-small);cursor:pointer;text-align:left';
    a.textContent = lookup('footer.cookies', currentLang()) || 'Cookie settings';
    a.addEventListener('click', function () { showConsent(true); });
    privacy.parentNode.appendChild(a);
  }

  function mountConsent() {
    injectCookieSettings();
    showConsent(false);
  }

  window.TF.showConsent = function () { showConsent(true); };
  window.TF.mountConsent = mountConsent;
  window.TF.applyI18n = function (lang) { applyI18n(lang || currentLang()); updateCrumb(); mountConsent(); };
  window.TF.lookup = lookup;
  mountConsent();
  window.addEventListener('tf-lang', function () {
    if (document.getElementById('tf-consent')) showConsent(true);
    var link = document.querySelector('[data-cookie-settings]');
    if (link) link.textContent = lookup('footer.cookies', currentLang()) || 'Cookie settings';
  });

  if (window.TF && window.TF.useSession) {
    window.TF.useSession(applySessionHeader);
  } else if (window.TF && window.TF.getCurrentUser) {
    window.TF.getCurrentUser().then(applySessionHeader).catch(function () {});
  }
})();
