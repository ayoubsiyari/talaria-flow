/**
 * Runs in <head> (blocking, same-origin) so CSP 'self' allows it.
 * Sets language + guest/session flags before the first paint.
 */
(function () {
  var html = document.documentElement;
  var admin = /\/admin(?:\/|$)/.test(location.pathname);
  var lang = 'en';
  try {
    var q = /[?&]lang=(en|ar)(?:&|$)/.exec(location.search);
    lang = admin ? 'en' : (q ? q[1] : (localStorage.getItem('tf-lang') || 'en'));
    if (q && !admin) localStorage.setItem('tf-lang', lang);
  } catch (e) {}
  html.lang = lang;
  html.setAttribute('data-lang', lang);

  var sess = false;
  try {
    var stores = [window.localStorage, window.sessionStorage];
    for (var s = 0; s < stores.length && !sess; s++) {
      var st = stores[s];
      if (!st) continue;
      for (var i = 0; i < st.length; i++) {
        var k = st.key(i) || '';
        if (/^sb-.*-auth-token/.test(k) && !/code-verifier|pkce/.test(k)) {
          sess = true;
          break;
        }
      }
    }
  } catch (e2) {}

  if (sess) {
    html.setAttribute('data-tf-session', '1');
    html.classList.remove('tf-guest');
  } else {
    html.classList.add('tf-guest');
    html.removeAttribute('data-tf-session');
  }

  if (lang === 'ar') {
    try {
      var p = document.createElement('link');
      p.rel = 'preload';
      p.as = 'font';
      p.type = 'font/woff2';
      p.crossOrigin = 'anonymous';
      p.href = '/fonts/Cairo-wght.woff2';
      (document.head || html).appendChild(p);
    } catch (e3) {}
    setTimeout(function () { html.classList.add('i18n-ready'); }, 4000);
  } else {
    html.classList.add('i18n-ready');
  }
})();
