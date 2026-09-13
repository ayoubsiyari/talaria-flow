(function () {
  'use strict';

  function toast(msg) {
    if (window.tfToast) window.tfToast(msg);
  }

  // Confirmation / recovery states are per-visitor, not pages: keep them out of the index (SEO.md).
  // The default /login/ and /signup/ views stay indexable and are listed in sitemap.xml.
  function setNoindex() {
    var robots = document.head.querySelector('meta[name="robots"]') || document.head.appendChild(document.createElement('meta'));
    robots.setAttribute('name', 'robots');
    robots.setAttribute('content', 'noindex');
  }

  function showLoginView(name) {
    ['login', 'unverified', 'reset', 'update'].forEach(function (v) {
      var el = document.querySelector('[data-view="' + v + '"]');
      if (el) el.style.display = v === name ? '' : 'none';
    });
    if (name !== 'login') setNoindex();
  }

  function showDashState(name) {
    document.querySelectorAll('[data-state]').forEach(function (el) {
      el.style.display = el.getAttribute('data-state') === name ? '' : 'none';
    });
  }

  function hasClient() {
    try { return !!(window.TF && window.TF.client); } catch (e) { return false; }
  }

  function authMsg(key) {
    return (window.TF.authCopy && window.TF.authCopy(key)) || key;
  }

  function apiErrorMsg(res, fallbackKey) {
    var code = res && res.body && res.body.error;
    if (code === 'rate_limited') return authMsg('locked');
    if (code === 'turnstile_failed' || code === 'turnstile_required') return authMsg('verify');
    if (code === 'turnstile_unconfigured' || code === 'ratelimit_unconfigured' || code === 'server_error' || code === 'signup_failed') return authMsg('unavailable');
    return authMsg(fallbackKey || 'uploadFailed');
  }

  /** Signed-in visitors do not need the login/signup forms; send them to their area. */
  function redirectIfSignedIn(fallback) {
    if (!hasClient() || !window.TF.getCurrentUser) return;
    window.TF.getCurrentUser().then(function (auth) {
      if (!auth || !auth.user) return;
      if (!(auth.user.email_confirmed_at || auth.user.confirmed_at)) return;
      var params = new URLSearchParams(location.search);
      var redirect = params.get('redirect');
      var safe = redirect && /^\/(?!\/)/.test(redirect) ? redirect : '';
      location.replace(safe || (auth.isAdmin ? '/admin/' : fallback || '/account/'));
    }).catch(function () {});
  }

  function setFieldError(input, errEl, msg) {
    if (input) {
      input.classList.toggle('is-invalid', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    if (errEl) {
      var text = errEl.querySelector('span:last-child') || errEl;
      if (text !== errEl || !errEl.querySelector('svg')) text.textContent = msg || '';
      else {
        var t = errEl.querySelector('span');
        if (t) t.textContent = msg || '';
      }
      errEl.classList.toggle('is-on', !!msg);
    }
  }

  function clearFieldError(input, errEl) {
    setFieldError(input, errEl, '');
  }

  var ERR_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4M12 16h.01"></path></svg><span></span>';
  /** Inline error for forms whose markup has no dedicated error slot (reset, new password, waitlist). */
  function inlineError(input, msg) {
    if (!input) return;
    var host = input.closest('.tf-input-wrap') || input;
    var errEl = host.nextElementSibling && host.nextElementSibling.classList.contains('tf-field-err') ? host.nextElementSibling : null;
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'tf-field-err';
      errEl.setAttribute('role', 'alert');
      errEl.innerHTML = ERR_ICON;
      host.parentNode.insertBefore(errEl, host.nextSibling);
      input.addEventListener('input', function () { setFieldError(input, errEl, ''); });
    }
    setFieldError(input, errEl, msg);
  }

  function setPending(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-pending', !!on);
    btn.classList.toggle('is-loading', !!on);
    if (on) btn.setAttribute('aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
    var st = btn.style;
    st.position = 'relative';
    st.display = 'inline-flex';
    st.alignItems = 'center';
    st.justifyContent = 'center';
    st.gap = '10px';
    st.whiteSpace = 'nowrap';
    st.lineHeight = '1';
    var spin = btn.querySelector(':scope > .tf-spin');
    if (on && !spin) {
      spin = document.createElement('span');
      spin.className = 'tf-spin';
      btn.insertBefore(spin, btn.firstChild);
    }
    if (spin) spin.style.display = on ? '' : 'none';
  }

  function initSignup() {
    var form = document.getElementById('signup-form');
    if (!form || form.getAttribute('data-bound')) return;
    form.setAttribute('data-bound', '1');
    var firstIn = form.querySelector('#signup-first, [name="first_name"]');
    var lastIn = form.querySelector('#signup-last, [name="last_name"]');
    var countryIn = form.querySelector('#signup-country, [name="country"]');
    var emailIn = form.querySelector('#signup-email, input[type="email"]');
    var pwIn = form.querySelector('#signup-password, input[autocomplete="new-password"]');
    var pw2In = form.querySelector('#signup-password2');
    if (!pwIn) pwIn = form.querySelector('input[type="password"]');
    var firstErr = document.getElementById('signup-first-err');
    var lastErr = document.getElementById('signup-last-err');
    var countryErr = document.getElementById('signup-country-err');
    var emailErr = document.getElementById('signup-email-err');
    var pwErr = document.getElementById('signup-pw-err');
    var pw2Err = document.getElementById('signup-pw2-err');
    var terms = form.querySelector('input[type="checkbox"]');
    var termsErr = document.getElementById('signup-terms-err');
    function lang() {
      return (window.TF.currentLang && window.TF.currentLang()) || localStorage.getItem('tf-lang') || 'en';
    }
    function fillCountries() {
      if (countryIn && window.TF.fillCountrySelect) window.TF.fillCountrySelect(countryIn, lang(), countryIn.value);
    }
    if (!window.TF.fillCountrySelect) {
      var cs = document.createElement('script');
      cs.src = '/assets/js/countries.js';
      cs.onload = fillCountries;
      document.head.appendChild(cs);
    } else fillCountries();
    if (!window.__tfSignupLangBound) {
      window.__tfSignupLangBound = true;
      window.addEventListener('tf-lang', function () {
        var live = document.getElementById('signup-form');
        var sel = live && live.querySelector('#signup-country, [name="country"]');
        if (sel && window.TF.fillCountrySelect) {
          var loc = (window.TF.currentLang && window.TF.currentLang()) || localStorage.getItem('tf-lang') || 'en';
          window.TF.fillCountrySelect(sel, loc, sel.value);
        }
      });
    }
    if (pwIn && window.TF.mountPwToggle) window.TF.mountPwToggle(pwIn);
    if (pw2In && window.TF.mountPwToggle) window.TF.mountPwToggle(pw2In);
    function reqMsg() { return authMsg('required') || 'This field is required'; }
    function validateFirst() {
      var ok = !!(firstIn && firstIn.value.trim());
      setFieldError(firstIn, firstErr, ok ? '' : reqMsg());
      return ok;
    }
    function validateLast() {
      var ok = !!(lastIn && lastIn.value.trim());
      setFieldError(lastIn, lastErr, ok ? '' : reqMsg());
      return ok;
    }
    function validateCountry() {
      var ok = !!(countryIn && countryIn.value);
      setFieldError(countryIn, countryErr, ok ? '' : (authMsg('country') || reqMsg()));
      return ok;
    }
    function validateEmail() {
      var email = (emailIn && emailIn.value || '').trim();
      if (!email) { setFieldError(emailIn, emailErr, reqMsg()); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError(emailIn, emailErr, authMsg('email')); return false; }
      clearFieldError(emailIn, emailErr);
      return true;
    }
    function validatePw() {
      var pw = (pwIn && pwIn.value) || '';
      if (!pw) { setFieldError(pwIn, pwErr, reqMsg()); return false; }
      if (pw.length < 8) { setFieldError(pwIn, pwErr, authMsg('short')); return false; }
      clearFieldError(pwIn, pwErr);
      return true;
    }
    function validatePw2() {
      var pw = (pwIn && pwIn.value) || '';
      var pw2 = (pw2In && pw2In.value) || '';
      if (!pw2) { setFieldError(pw2In, pw2Err, reqMsg()); return false; }
      if (pw !== pw2) { setFieldError(pw2In, pw2Err, authMsg('mismatch')); return false; }
      clearFieldError(pw2In, pw2Err);
      return true;
    }
    function validateTerms() {
      var ok = !terms || terms.checked;
      if (termsErr) termsErr.classList.toggle('is-on', !ok);
      return ok;
    }
    if (firstIn) { firstIn.addEventListener('blur', validateFirst); firstIn.addEventListener('input', function () { clearFieldError(firstIn, firstErr); }); }
    if (lastIn) { lastIn.addEventListener('blur', validateLast); lastIn.addEventListener('input', function () { clearFieldError(lastIn, lastErr); }); }
    if (countryIn) { countryIn.addEventListener('blur', validateCountry); countryIn.addEventListener('change', function () { clearFieldError(countryIn, countryErr); }); }
    if (emailIn) { emailIn.addEventListener('blur', validateEmail); emailIn.addEventListener('input', function () { clearFieldError(emailIn, emailErr); }); }
    if (pwIn) { pwIn.addEventListener('blur', validatePw); pwIn.addEventListener('input', function () { clearFieldError(pwIn, pwErr); if (pw2In && pw2In.value) validatePw2(); }); }
    if (pw2In) { pw2In.addEventListener('blur', validatePw2); pw2In.addEventListener('input', function () { clearFieldError(pw2In, pw2Err); }); }
    if (terms) terms.addEventListener('change', validateTerms);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var ok = [validateFirst(), validateLast(), validateCountry(), validateEmail(), validatePw(), validatePw2(), validateTerms()].every(Boolean);
      if (!ok) return;
      if (window.TF.ensureClient) await window.TF.ensureClient();
      if (!hasClient()) { setFieldError(emailIn, emailErr, authMsg('unavailable')); return; }
      var email = (emailIn && emailIn.value || '').trim().toLowerCase();
      var pw = (pwIn && pwIn.value) || '';
      var btn = form.querySelector('[type="submit"]');
      setPending(btn, true);
      try {
        var token = await window.TF.turnstile('signup');
        var res = await window.TF.api('/api/auth/signup', {
          auth: false,
          body: {
            email: email,
            password: pw,
            first_name: (firstIn && firstIn.value || '').trim(),
            last_name: (lastIn && lastIn.value || '').trim(),
            country: countryIn && countryIn.value || '',
            lang: lang(),
            redirectTo: location.origin + '/account/',
            turnstileToken: token,
          },
        });
        if (!res.ok) {
          var code = res.body && res.body.error;
          if (code === 'weak_password') setFieldError(pwIn, pwErr, authMsg('short'));
          else setFieldError(emailIn, emailErr, apiErrorMsg(res, 'email'));
          return;
        }
        if (!res.body.needsConfirmation && res.body.session) {
          await window.TF.adoptSession(res.body.session);
          location.href = '/account/';
          return;
        }
        var next = (res.body && res.body.next) || ('/signup/verify?email=' + encodeURIComponent(email));
        try { sessionStorage.setItem('tf-signup-email', email); } catch (eSt) {}
        if (window.TF.navigate) window.TF.navigate(next);
        else location.href = next;
      } catch (err) {
        setFieldError(emailIn, emailErr, authMsg('uploadFailed'));
      } finally {
        setPending(btn, false);
      }
    });
    if (window.TF.ensureClient) window.TF.ensureClient().then(function () { redirectIfSignedIn('/account/'); });
    else redirectIfSignedIn('/account/');
  }

  function showSignupVerify(form, email) {
    var done = document.createElement('div');
    done.setAttribute('data-view', 'signup-done');
    done.style.cssText = 'display:flex;flex-direction:column;gap:14px;padding:24px;background:#0E1017;border:1px solid rgba(46,232,255,0.35);border-radius:14px';
    var h = document.createElement('h2');
    h.style.cssText = 'font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0';
    h.textContent = authMsg('signupDoneTitle');
    var p = document.createElement('p');
    p.style.cssText = 'margin:0;font-size:15px;line-height:1.55;color:#B7BCCB';
    p.textContent = authMsg('signupDoneBody').replace('{email}', email);
    done.appendChild(h);
    done.appendChild(p);
    mountCodeForm(done, email, '/account/');
    var a = document.createElement('a');
    a.href = '/login/';
    a.className = 'tf-text-link';
    a.style.cssText = 'font-size:14px;font-weight:600;color:#2EE8FF;width:max-content';
    a.textContent = authMsg('signupDoneLogin');
    done.appendChild(a);
    form.style.display = 'none';
    form.parentNode.insertBefore(done, form);
    h.setAttribute('tabindex', '-1');
    h.focus();
  }

  function showResetVerify(form, email) {
    var done = form.parentNode.querySelector('[data-reset-code]');
    if (done) done.remove();
    done = document.createElement('div');
    done.setAttribute('data-reset-code', '1');
    done.style.cssText = 'display:flex;flex-direction:column;gap:14px';
    var h = document.createElement('h2');
    h.style.cssText = 'font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0';
    h.textContent = authMsg('signupDoneTitle');
    var p = document.createElement('p');
    p.style.cssText = 'margin:0;font-size:15px;line-height:1.55;color:#B7BCCB';
    p.textContent = authMsg('signupDoneBody').replace('{email}', email);
    done.appendChild(h);
    done.appendChild(p);
    mountCodeForm(done, email, '/login/', 'recovery');
    form.style.display = 'none';
    form.parentNode.insertBefore(done, form);
    h.setAttribute('tabindex', '-1');
    h.focus();
  }

  function mountCodeForm(host, email, afterPath, purpose) {
    if (host.querySelector('[data-verify-form]')) return;
    purpose = purpose || 'signup';
    var wrap = document.createElement('form');
    wrap.setAttribute('data-verify-form', '1');
    wrap.setAttribute('novalidate', '');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    var label = document.createElement('label');
    label.style.cssText = 'display:flex;flex-direction:column;gap:6px;font-family:Geist Mono,monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8B90A3';
    var lab = document.createElement('span');
    lab.textContent = authMsg('codeLabel');
    var input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'text';
    input.autocomplete = 'one-time-code';
    input.maxLength = 12;
    input.className = 'tf-input';
    input.setAttribute('aria-label', authMsg('codeLabel'));
    input.style.letterSpacing = '0.18em';
    var err = document.createElement('span');
    err.className = 'tf-field-err';
    err.setAttribute('role', 'alert');
    err.innerHTML = ERR_ICON;
    label.appendChild(lab);
    label.appendChild(input);
    label.appendChild(err);
    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn-primary';
    btn.style.cssText = 'height:48px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font:600 15px Archivo,Cairo,sans-serif;cursor:pointer';
    btn.textContent = authMsg('codeCta');
    var resend = document.createElement('button');
    resend.type = 'button';
    resend.style.cssText = 'height:40px;padding:0;border:0;background:transparent;color:#2EE8FF;font:600 14px Archivo,Cairo,sans-serif;cursor:pointer;width:max-content';
    resend.textContent = authMsg('codeResend');
    wrap.appendChild(label);
    wrap.appendChild(btn);
    wrap.appendChild(resend);
    host.appendChild(wrap);
    wrap.addEventListener('submit', async function (e) {
      e.preventDefault();
      var code = (input.value || '').trim();
      if (!/^[A-Za-z0-9]{6,12}$/.test(code)) { setFieldError(input, err, authMsg('codeInvalid')); return; }
      setPending(btn, true);
      try {
        var token = await window.TF.turnstile('verify');
        var res = await window.TF.api('/api/auth/verify', { auth: false, body: { email: email, token: code, purpose: purpose, turnstileToken: token } });
        if (!res.ok) {
          setFieldError(input, err, res.body && res.body.error === 'rate_limited' ? apiErrorMsg(res) : authMsg('codeInvalid'));
          return;
        }
        await window.TF.adoptSession(res.body.session);
        if (purpose === 'recovery') {
          showLoginView('update');
          return;
        }
        var dest = (res.body.user && res.body.user.is_admin) ? '/admin/' : (afterPath || '/account/');
        location.href = dest;
      } catch (err2) {
        setFieldError(input, err, authMsg('codeInvalid'));
      } finally {
        setPending(btn, false);
      }
    });
    resend.addEventListener('click', async function () {
      setPending(resend, true);
      try {
        var token = await window.TF.turnstile('resend');
        var r = await window.TF.api('/api/auth/resend', { auth: false, body: { email: email, purpose: purpose, turnstileToken: token } });
        toast(r.ok ? authMsg('resent') : authMsg('uploadFailed'));
      } catch (err2) {
        toast(authMsg('uploadFailed'));
      } finally {
        setPending(resend, false);
      }
    });
    setTimeout(function () { input.focus(); }, 50);
  }

  function initLogin() {
    var form = document.getElementById('login-form');
    if (!form || form.getAttribute('data-bound')) return;
    form.setAttribute('data-bound', '1');
    var resetForm = document.getElementById('reset-form');
    var updateForm = document.getElementById('update-form');
    var params = new URLSearchParams(location.search);
    var view = params.get('view');
    if (params.get('type') === 'recovery' || (location.hash && location.hash.includes('type=recovery'))) showLoginView('update');
    else if (view && /^(unverified|reset|update)$/.test(view)) showLoginView(view);
    else showLoginView('login');

    var forgot = form.querySelector('a[href*="view=reset"], a[href="#"]');
    if (forgot) forgot.addEventListener('click', function (e) { e.preventDefault(); showLoginView('reset'); });
    var cancel = resetForm && resetForm.querySelector('button[type="button"]');
    if (cancel) { cancel.setAttribute('data-bound', 'cancel'); cancel.addEventListener('click', function () { showLoginView('login'); }); }
    var resendEarly = document.querySelector('[data-view="unverified"] button');
    if (resendEarly) resendEarly.setAttribute('data-bound', 'resend');
    var isRecovery = params.get('type') === 'recovery' || (location.hash && location.hash.includes('type=recovery')) || view === 'update';

    var emailIn = form.querySelector('#login-email, input[type="email"]');
    var pwIn = form.querySelector('#login-password, input[type="password"]');
    var emailErr = document.getElementById('login-email-err');
    var pwErr = document.getElementById('login-pw-err');
    var formErr = document.getElementById('login-form-err');
    if (pwIn && window.TF.mountPwToggle) window.TF.mountPwToggle(pwIn);
    if (emailIn) emailIn.addEventListener('input', function () { clearFieldError(emailIn, emailErr); if (formErr) formErr.classList.remove('is-on'); });
    if (pwIn) pwIn.addEventListener('input', function () { clearFieldError(pwIn, pwErr); if (formErr) formErr.classList.remove('is-on'); });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = ((emailIn && emailIn.value) || '').trim().toLowerCase();
      var pw = (pwIn && pwIn.value) || '';
      var btn = form.querySelector('[type="submit"]');
      clearFieldError(emailIn, emailErr);
      clearFieldError(pwIn, pwErr);
      if (formErr) formErr.classList.remove('is-on');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError(emailIn, emailErr, authMsg('email')); return; }
      if (window.TF.ensureClient) await window.TF.ensureClient();
      if (!hasClient()) { setFieldError(pwIn, pwErr, authMsg('unavailable')); return; }
      setPending(btn, true);
      try {
        var token = await window.TF.turnstile('login');
        var res = await window.TF.api('/api/auth/login', { auth: false, body: { email: email, password: pw, turnstileToken: token } });
        if (!res.ok) {
          var code = res.body && res.body.error;
          if (code === 'rate_limited' || code === 'turnstile_unconfigured' || code === 'ratelimit_unconfigured') {
            if (formErr) {
              var t = formErr.querySelector('span:last-child') || formErr;
              t.textContent = apiErrorMsg(res);
              formErr.classList.add('is-on');
            }
          } else if (code === 'email_not_confirmed') {
            showLoginView('unverified');
            var unv = document.querySelector('[data-view="unverified"]');
            if (unv) mountCodeForm(unv, email, (params.get('redirect') && /^\/(?!\/)/.test(params.get('redirect')) ? params.get('redirect') : '/account/'));
          }
          else if (code === 'turnstile_failed' || code === 'turnstile_required') setFieldError(emailIn, emailErr, authMsg('verify'));
          else setFieldError(pwIn, pwErr, authMsg('password'));
          return;
        }
        await window.TF.adoptSession(res.body.session);
        var redirect = params.get('redirect');
        var safeRedirect = redirect && /^\/(?!\/)/.test(redirect) ? redirect : '';
        var dest = safeRedirect || (res.body.user && res.body.user.is_admin ? '/admin/' : '/account/');
        location.href = dest;
      } catch (err) {
        setFieldError(pwIn, pwErr, authMsg('password'));
      } finally {
        setPending(btn, false);
      }
    });

    var resend = document.querySelector('[data-view="unverified"] button');
    if (resend) resend.addEventListener('click', async function () {
      var email = ((form.querySelector('input[type="email"]') || {}).value || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast(authMsg('enterEmailFirst'));
        showLoginView('login');
        if (emailIn) emailIn.focus();
        return;
      }
      setPending(resend, true);
      try {
        var token = await window.TF.turnstile('resend');
        var r = await window.TF.api('/api/auth/resend', { auth: false, body: { email: email, turnstileToken: token } });
        toast(r.ok ? authMsg('resent') : authMsg('uploadFailed'));
      } catch (err) {
        toast(authMsg('uploadFailed'));
      } finally {
        setPending(resend, false);
      }
    });

    if (resetForm) resetForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var resetIn = resetForm.querySelector('input[type="email"]');
      var email = ((resetIn && resetIn.value) || '').trim().toLowerCase();
      var btn = resetForm.querySelector('[type="submit"]');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { inlineError(resetIn, authMsg('email')); return; }
      setPending(btn, true);
      try {
        var token = await window.TF.turnstile('reset');
        var res = await window.TF.api('/api/auth/reset', { auth: false, body: { email: email, redirectTo: location.origin + '/login/?type=recovery', turnstileToken: token } });
        if (!res.ok) { inlineError(resetIn, apiErrorMsg(res)); return; }
        showResetVerify(resetForm, email);
      } catch (err) { inlineError(resetIn, authMsg('uploadFailed')); }
      finally { setPending(btn, false); }
    });

    if (updateForm) {
      var upw = updateForm.querySelector('input[type="password"]');
      if (upw && window.TF.mountPwToggle) window.TF.mountPwToggle(upw);
      updateForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var upwIn = updateForm.querySelector('input[type="password"]');
        var pw = (upwIn && upwIn.value) || '';
        var btn = updateForm.querySelector('[type="submit"]');
        if (pw.length < 8) { inlineError(upwIn, authMsg('short')); return; }
        if (!hasClient()) return;
        setPending(btn, true);
        try {
          var sb = window.TF.getClient();
          var who = await sb.auth.getUser();
          if (!who || !who.data || !who.data.user) { inlineError(upwIn, authMsg('recoveryExpired')); return; }
          var res = await sb.auth.updateUser({ password: pw });
          if (res.error) inlineError(upwIn, authMsg('short'));
          else { toast(authMsg('pwUpdated')); location.href = '/account/'; }
        } catch (err) {
          inlineError(upwIn, authMsg('uploadFailed'));
        } finally {
          setPending(btn, false);
        }
      });
    }
    if (window.TF.ensureClient) window.TF.ensureClient().then(function () {
      if (!isRecovery && view !== 'unverified') redirectIfSignedIn('/account/');
    });
    else if (hasClient() && !isRecovery && view !== 'unverified') redirectIfSignedIn('/account/');
  }

  function dashCopy(key) {
    var lang = (window.TF.currentLang && window.TF.currentLang()) || 'en';
    var node = window.TF_I18N && window.TF_I18N.dashboard && window.TF_I18N.dashboard[key];
    if (!node) return key;
    return (node[lang] != null ? node[lang] : node.en) || key;
  }

  function dashDir() {
    return ((window.TF.currentLang && window.TF.currentLang()) || 'en') === 'ar' ? 'rtl' : 'ltr';
  }

  function proofShell() {
    var existing = document.querySelector('[data-proof-dialog]');
    if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.setAttribute('data-proof-dialog', '');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:20px;background:rgba(4,5,9,.72);backdrop-filter:blur(4px)';
    var panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.style.cssText = 'width:min(460px,100%);padding:28px;background:#0E1017;border:1px solid rgba(255,255,255,0.12);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.5);font-family:Archivo,Cairo,sans-serif;color:#F2F4F8';
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    var closed = false;
    var onClose = null;
    function focusables() {
      return Array.prototype.slice.call(panel.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter(function (el) { return !el.disabled; });
    }
    function close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      if (onClose) onClose(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
      if (e.key !== 'Tab') return;
      var list = focusables();
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(false); });
    return {
      wrap: wrap,
      panel: panel,
      close: close,
      onClose: function (fn) { onClose = fn; },
      focus: function () {
        var list = focusables();
        if (list[0]) list[0].focus();
      },
    };
  }

  function checklistRow(ok, text) {
    var dir = dashDir();
    var mark = ok
      ? '<span aria-hidden="true" style="width:16px;height:16px;flex:none;display:grid;place-items:center;color:#2EE8FF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"></path></svg></span>'
      : '<span aria-hidden="true" style="width:6px;height:6px;flex:none;margin:5px;background:#FF37B0;display:inline-block"></span>';
    return '<li style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">' + mark + '<span dir="' + dir + '" style="font-size:14px;line-height:1.5;color:#B7BCCB;text-align:left">' + text + '</span></li>';
  }

  function showBlockedDialog(files, opener) {
    return new Promise(function (resolve) {
      var dir = dashDir();
      var name = dashCopy('nameFallback');
      var shell = proofShell();
      var n = files.length;
      shell.panel.innerHTML =
        '<h2 dir="' + dir + '" style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin:0 0 12px;text-align:left">' + dashCopy('blockedTitle') + '</h2>' +
        '<ul style="list-style:none;margin:0 0 22px;padding:0;border-top:1px solid rgba(255,255,255,0.08)">' +
          checklistRow(n >= 1, dashCopy('shotReg')) +
          checklistRow(n >= 2, dashCopy('shotLogin').replace('{name}', name)) +
        '</ul>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">' +
          '<button type="button" data-dlg="cancel" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:transparent;color:#B7BCCB;font:600 14px Archivo,Cairo,sans-serif;cursor:pointer"><span dir="' + dir + '">' + dashCopy('dlgCancel') + '</span></button>' +
          '<button type="button" data-dlg="add" class="btn-primary" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font:600 14px Archivo,Cairo,sans-serif;cursor:pointer"><span dir="' + dir + '">' + dashCopy('addShots') + '</span></button>' +
        '</div>';
      shell.onClose(function (ok) {
        if (ok) {
          var drop = document.getElementById('upload-dropzone');
          if (drop) drop.focus();
        }
        resolve(ok);
      });
      shell.panel.querySelector('[data-dlg="cancel"]').addEventListener('click', function () { shell.close(false); });
      shell.panel.querySelector('[data-dlg="add"]').addEventListener('click', function () { shell.close(true); });
      shell.focus();
    });
  }

  function showConfirmDialog(files, email) {
    return new Promise(function (resolve) {
      var dir = dashDir();
      var shell = proofShell();
      var thumbs = files.slice(0, 2).map(function (f) {
        var blob = f.file || f;
        var url = f.preview || URL.createObjectURL(blob);
        return '<img src="' + url + '" alt="" data-revoke="' + url + '" style="width:100%;height:88px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:#07080C">';
      }).join('');
      shell.panel.innerHTML =
        '<h2 dir="' + dir + '" style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin:0 0 10px;text-align:left">' + dashCopy('confirmTitle') + '</h2>' +
        '<p dir="' + dir + '" style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#B7BCCB;text-align:left">' + dashCopy('confirmBody').replace('{email}', email) + '</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:22px">' + thumbs + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">' +
          '<button type="button" data-dlg="no" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:transparent;color:#B7BCCB;font:600 14px Archivo,Cairo,sans-serif;cursor:pointer"><span dir="' + dir + '">' + dashCopy('confirmNotYet') + '</span></button>' +
          '<button type="button" data-dlg="yes" class="btn-primary" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font:600 14px Archivo,Cairo,sans-serif;cursor:pointer"><span dir="' + dir + '">' + dashCopy('confirmSend') + '</span></button>' +
        '</div>';
      function revoke() {
        shell.panel.querySelectorAll('[data-revoke]').forEach(function (img) { try { URL.revokeObjectURL(img.getAttribute('data-revoke')); } catch (e) {} });
      }
      shell.onClose(function (ok) { revoke(); resolve(ok); });
      shell.panel.querySelector('[data-dlg="no"]').addEventListener('click', function () { shell.close(false); });
      shell.panel.querySelector('[data-dlg="yes"]').addEventListener('click', function () { shell.close(true); });
      shell.focus();
    });
  }

  function showSentDialog(email) {
    return new Promise(function (resolve) {
      var dir = dashDir();
      var shell = proofShell();
      shell.panel.innerHTML =
        '<div style="display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:rgba(46,232,255,0.12);margin-bottom:16px">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2EE8FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"></path></svg>' +
        '</div>' +
        '<h2 dir="' + dir + '" style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin:0 0 10px;text-align:left">' + dashCopy('sentTitle') + '</h2>' +
        '<p dir="' + dir + '" style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#B7BCCB;text-align:left">' + dashCopy('sentBody').replace('{email}', email) + '</p>' +
        '<button type="button" data-dlg="back" class="btn-primary" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font:600 14px Archivo,Cairo,sans-serif;cursor:pointer"><span dir="' + dir + '">' + dashCopy('sentBack') + '</span></button>';
      shell.onClose(function () { resolve(true); });
      shell.panel.querySelector('[data-dlg="back"]').addEventListener('click', function () { shell.close(true); });
      shell.focus();
    });
  }

  window.TF.initDashboard = initDashboard;
  function initDashboard() {
    if (!document.getElementById('upload-dropzone') && !document.querySelector('[data-state]')) return;
    // Inside the account app the current state is already resolved and only that state is rendered.
    var inAccountApp = !!document.querySelector('[data-account]');
    if (!inAccountApp) {
      showDashState('none');
      if (!hasClient()) return;
      window.TF.requireAuth().then(async function (auth) {
        if (!auth) return;
        if (!auth.isEmailVerified) { location.href = '/login/?view=unverified'; return; }
        var sb = window.TF.getClient();
        var row = await sb.from('submissions').select('status').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        var status = row.data && row.data.status;
        var state = !status || status === 'none' ? 'none' : status === 'submitted' || status === 'review' ? 'review' : status === 'approved' ? 'approved' : 'rejected';
        showDashState(state);
      }).catch(function () {});
    }
    if (!hasClient()) return;

    var drop = document.getElementById('upload-dropzone');
    var note = document.getElementById('upload-note');
    var submit = document.getElementById('submit-proof');
    if (drop && drop.getAttribute('data-bound')) return;
    if (drop) drop.setAttribute('data-bound', '1');
    if (!window.TF._proofUploads) window.TF._proofUploads = [];
    var files = window.TF._proofUploads;
    function showReview() {
      if (window.TF.refreshAccount) window.TF.refreshAccount();
      else showDashState('review');
    }
    function revokeFile(f) {
      if (f && f.preview) { try { URL.revokeObjectURL(f.preview); } catch (e) {} }
    }
    function syncSend() {
      window.TF._proofUploads = files;
      var on = files.length >= 2;
      var empty = drop && drop.querySelector('[data-upload-empty]');
      var grid = drop && drop.querySelector('[data-upload-grid]');
      var count = drop && drop.querySelector('[data-upload-count]');
      if (count) count.textContent = files.length + ' / 4';
      if (empty) empty.style.display = files.length ? 'none' : '';
      if (grid) {
        grid.style.display = files.length ? 'grid' : 'none';
        grid.innerHTML = files.map(function (f) {
          var name = String(f.name || 'screenshot').replace(/[<>]/g, '');
          return '<figure data-upload-id="' + f.id + '" style="margin:0;width:100%;position:relative;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:#0E1017">' +
            '<img src="' + f.preview + '" alt="" style="display:block;width:100%;aspect-ratio:4/3;object-fit:cover">' +
            '<figcaption style="display:block;padding:6px 8px;font:400 11px \'Geist Mono\',monospace;color:#8B90A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</figcaption>' +
            '<button type="button" data-upload-remove="' + f.id + '" aria-label="Remove" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:6px;border:0;background:rgba(7,8,12,.8);color:#F2F4F8;cursor:pointer;line-height:1">×</button></figure>';
        }).join('') + (files.length < 4
          ? '<button type="button" data-upload-add aria-label="Add screenshot" style="display:flex;flex-direction:column;align-items:stretch;gap:0;width:100%;height:auto;margin:0;padding:0;border:0;background:transparent;cursor:pointer">' +
            '<span style="display:grid;place-items:center;width:100%;aspect-ratio:4/3;border:1px dashed rgba(255,255,255,0.16);border-radius:8px;background:transparent;color:#8B90A3;font:500 13px Archivo,Cairo,sans-serif;box-sizing:border-box">+ Add</span>' +
            '<span aria-hidden="true" style="display:block;padding:6px 8px;font:400 11px \'Geist Mono\',monospace;visibility:hidden;line-height:1">.</span></button>'
          : '');
      }
      if (!submit) return;
      submit.disabled = !on;
      submit.setAttribute('aria-disabled', on ? 'false' : 'true');
      submit.style.opacity = on ? '1' : '0.5';
      submit.style.cursor = on ? 'pointer' : 'not-allowed';
      submit.style.pointerEvents = on ? '' : 'none';
      if (on) {
        submit.removeAttribute('data-tip');
        submit.removeAttribute('title');
      } else {
        submit.setAttribute('data-tip', dashCopy('attachTip'));
        submit.setAttribute('data-tip-i18n', 'dashboard.attachTip');
      }
      var wrap = submit.parentNode;
      if (wrap && wrap.getAttribute('data-submit-wrap') === '') {
        wrap.tabIndex = on ? -1 : 0;
      }
    }
    syncSend();
    var MAX_BYTES = 5 * 1024 * 1024;
    var OK_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    function acceptFiles(list) {
      var picked = Array.from(list || []);
      var bad = picked.filter(function (f) { return !OK_TYPES[f.type] || f.size > MAX_BYTES; });
      if (bad.length) toast(authMsg('fileRule'));
      picked.filter(function (f) { return OK_TYPES[f.type] && f.size <= MAX_BYTES; }).forEach(function (file) {
        if (files.length >= 4) return;
        files.push({ id: randomId(), name: file.name, file: file, type: file.type, preview: URL.createObjectURL(file) });
      });
      syncSend();
    }
    function randomId() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
    }
    if (drop) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp';
      input.multiple = true;
      input.hidden = true;
      drop.appendChild(input);
      drop.addEventListener('click', function (e) {
        if (e.target.closest('[data-upload-remove]')) return;
        if (files.length >= 4) return;
        input.click();
      });
      drop.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-upload-remove]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-upload-remove');
        var gone = files.filter(function (f) { return f.id === id; })[0];
        files = files.filter(function (f) { return f.id !== id; });
        revokeFile(gone);
        syncSend();
      });
      drop.addEventListener('dragover', function (e) { e.preventDefault(); });
      drop.addEventListener('drop', function (e) { e.preventDefault(); acceptFiles(e.dataTransfer.files); });
      input.addEventListener('change', function () { acceptFiles(input.files); input.value = ''; });
    }
    window.addEventListener('pagehide', function () { files.forEach(revokeFile); });
    if (submit && submit.parentNode && submit.parentNode.getAttribute('data-submit-wrap') !== '') {
      var wrap = document.createElement('span');
      wrap.setAttribute('data-submit-wrap', '');
      wrap.style.display = 'inline-flex';
      submit.parentNode.insertBefore(wrap, submit);
      wrap.appendChild(submit);
    }
    async function sendProof() {
      if (files.length < 2) {
        await showBlockedDialog(files, submit);
        return;
      }
      if (!window.TF) return;
      var auth = await window.TF.getCurrentUser();
      if (!auth.user) { location.href = '/login/'; return; }
      var ok = await showConfirmDialog(files, auth.user.email || '');
      if (!ok) return;
      var sb = window.TF.getClient();
      setPending(submit, true);
      try {
        var uploaded = [];
        for (var i = 0; i < files.length; i++) {
          var blob = files[i].file || files[i];
          var path = auth.user.id + '/incoming/' + randomId() + '.' + OK_TYPES[blob.type];
          var up = await sb.storage.from('proofs').upload(path, blob, { upsert: false, contentType: blob.type });
          if (up.error) throw new Error(up.error.message);
          uploaded.push({ path: path, name: files[i].name });
        }
        var res = await window.TF.api('/api/proof', { body: { note: note ? note.value : '', files: uploaded } });
        if (!res.ok) {
          var code = res.body && res.body.error;
          if (code === 'already_pending') { showReview(); return; }
          toast(apiErrorMsg(res));
          return;
        }
        files.forEach(revokeFile);
        files = [];
        window.TF._proofUploads = files;
        syncSend();
        await showSentDialog(auth.user.email || '');
        showReview();
      } catch (err) {
        toast(authMsg('uploadFailed'));
      } finally {
        setPending(submit, false);
      }
    }
    if (submit) {
      submit.addEventListener('click', function () { sendProof(); });
      var host = submit.parentNode;
      if (host && host.getAttribute('data-submit-wrap') === '') {
        host.addEventListener('click', function (e) {
          if (submit.disabled) { e.preventDefault(); sendProof(); }
        });
        host.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            sendProof();
          }
        });
      }
    }
    syncSend();
  }

  function initAdminEmails() {
    if (window.TF && window.TF.initEmailEditorPage) window.TF.initEmailEditorPage();
  }

  function initWaitlist() {
    document.querySelectorAll('form[data-waitlist]').forEach(function (form) {
      if (form.getAttribute('data-bound')) return;
      form.setAttribute('data-bound', '1');
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var emailInput = form.querySelector('input[type="email"]');
        if (!emailInput) return;
        var email = emailInput.value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { inlineError(emailInput, authMsg('email')); return; }
        inlineError(emailInput, '');
        var btn = form.querySelector('[type="submit"]');
        setPending(btn, true);
        try {
          var token = await window.TF.turnstile('waitlist');
          var lang = (window.TF.currentLang && window.TF.currentLang()) || 'en';
          var res = await window.TF.api('/api/waitlist', {
            auth: false,
            body: { email: email, source: form.getAttribute('data-waitlist') || 'website', lang: lang, turnstileToken: token },
          });
          if (!res.ok) { inlineError(emailInput, apiErrorMsg(res)); return; }
          // Success replaces the form with a confirmation so it cannot be submitted twice.
          var done = document.createElement('p');
          done.setAttribute('role', 'status');
          done.setAttribute('data-waitlist-done', '');
          done.style.cssText = 'display:flex;align-items:center;gap:10px;min-height:44px;font-size:15px;color:#F2F4F8';
          done.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2EE8FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg><span></span>';
          done.querySelector('span').textContent = authMsg('waitlistDone').replace('{email}', email);
          form.setAttribute('data-state', 'done');
          form.innerHTML = '';
          form.appendChild(done);
          toast(authMsg('waitlistOk'));
        } catch (err) {
          inlineError(emailInput, authMsg('uploadFailed'));
        } finally {
          setPending(btn, false);
        }
      });
    });
  }

  function readPendingSignupEmail() {
    var q = new URLSearchParams(location.search).get('email');
    if (q) return String(q).trim().toLowerCase();
    try { var s = sessionStorage.getItem('tf-signup-email'); if (s) return s; } catch (e) {}
    var m = ('; ' + document.cookie).match(/; tf-signup-email=([^;]*)/);
    return m ? decodeURIComponent(m[1]).trim().toLowerCase() : '';
  }

  function initSignupVerify() {
    var form = document.getElementById('signup-verify-form');
    if (!form || form.getAttribute('data-bound')) return;
    var email = readPendingSignupEmail();
    if (!email) {
      if (window.TF.navigate) window.TF.navigate('/signup/');
      else location.href = '/signup/';
      return;
    }
    form.setAttribute('data-bound', '1');
    try { sessionStorage.setItem('tf-signup-email', email); } catch (e0) {}
    var ar = ((window.TF.currentLang && window.TF.currentLang()) || localStorage.getItem('tf-lang') || 'en') === 'ar';
    var h1 = document.getElementById('signup-verify-h1');
    if (h1) h1.textContent = ar ? 'أدخل رمزك' : 'Enter your code';
    var lede = document.getElementById('signup-verify-lede');
    if (lede) {
      lede.innerHTML = ar
        ? ('أرسلنا رمزاً من 6 أرقام إلى <strong style="color:#F2F4F8;font-weight:600"></strong>. ينتهي خلال 15 دقيقة.')
        : ('We sent a 6-digit code to <strong style="color:#F2F4F8;font-weight:600"></strong>. It expires in 15 minutes.');
      var strong = lede.querySelector('strong');
      if (strong) strong.textContent = email;
    }
    var boxHost = document.getElementById('signup-verify-boxes');
    var err = document.getElementById('signup-verify-err');
    var resend = document.getElementById('signup-verify-resend');
    var btn = form.querySelector('[type="submit"]');
    var boxes = [];
    var BOX = 'width:48px;height:56px;box-sizing:border-box;background:#07080C;border:1px solid rgba(255,255,255,.16);border-radius:10px;color:#F2F4F8;font:400 22px "Geist Mono",monospace;text-align:center;outline:none';
    function setBoxesError(on) {
      boxes.forEach(function (b) {
        b.style.border = on ? '1px solid #FF37B0' : '1px solid rgba(255,255,255,.16)';
      });
      if (err) {
        err.style.display = on ? 'block' : 'none';
        err.textContent = on ? 'That code is not right. Check the email or send a new one.' : '';
      }
    }
    function codeValue() { return boxes.map(function (b) { return b.value; }).join(''); }
    function fillCode(str) {
      var digits = String(str || '').replace(/\D/g, '').slice(0, 6).split('');
      boxes.forEach(function (b, i) { b.value = digits[i] || ''; });
    }
    if (boxHost && !boxHost.getAttribute('data-ready')) {
      boxHost.setAttribute('data-ready', '1');
      for (var i = 0; i < 6; i++) {
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.inputMode = 'numeric';
        inp.autocomplete = i === 0 ? 'one-time-code' : 'off';
        inp.maxLength = 1;
        inp.setAttribute('aria-label', 'Digit ' + (i + 1));
        inp.style.cssText = BOX;
        inp.addEventListener('focus', function () { this.style.border = '1px solid #2EE8FF'; });
        inp.addEventListener('blur', function () {
          if (!(err && err.style.display === 'block')) this.style.border = '1px solid rgba(255,255,255,.16)';
        });
        boxes.push(inp);
        boxHost.appendChild(inp);
      }
      boxes.forEach(function (inp, idx) {
        inp.addEventListener('input', function (e) {
          var v = (inp.value || '').replace(/\D/g, '');
          if (v.length > 1) { fillCode(v); if (boxes[Math.min(v.length, 5)]) boxes[Math.min(v.length, 5)].focus(); return; }
          inp.value = v.slice(-1);
          if (inp.value && boxes[idx + 1]) boxes[idx + 1].focus();
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Backspace' && !inp.value && boxes[idx - 1]) { boxes[idx - 1].focus(); boxes[idx - 1].value = ''; e.preventDefault(); }
        });
        inp.addEventListener('paste', function (e) {
          var text = (e.clipboardData && e.clipboardData.getData('text')) || '';
          if (/\d{6}/.test(text.replace(/\s/g, ''))) { e.preventDefault(); fillCode(text); boxes[5].focus(); }
        });
      });
    }
    var qCode = new URLSearchParams(location.search).get('code');
    if (qCode) fillCode(qCode);
    var left = 60;
    function tickResend() {
      if (!resend) return;
      if (left > 0) {
        resend.disabled = true;
        resend.textContent = (ar ? 'إعادة الإرسال' : 'Resend code') + ' · ' + left + 's';
        left -= 1;
        setTimeout(tickResend, 1000);
      } else {
        resend.disabled = false;
        resend.textContent = ar ? 'إعادة الإرسال' : 'Resend code';
      }
    }
    tickResend();
    async function submitCode() {
      var code = codeValue();
      if (!/^\d{6}$/.test(code)) { setBoxesError(true); return; }
      setBoxesError(false);
      setPending(btn, true);
      try {
        var token = await window.TF.turnstile('verify');
        var res = await window.TF.api('/api/auth/verify', { auth: false, body: { email: email, token: code, purpose: 'signup', turnstileToken: token } });
        if (!res.ok) { setBoxesError(true); return; }
        await window.TF.adoptSession(res.body.session);
        var dest = (res.body.user && res.body.user.is_admin) ? '/admin/' : '/account/';
        location.href = dest;
      } catch (err2) {
        setBoxesError(true);
      } finally {
        setPending(btn, false);
      }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); submitCode(); });
    if (resend) resend.addEventListener('click', async function () {
      if (resend.disabled) return;
      setPending(resend, true);
      try {
        var token = await window.TF.turnstile('resend');
        await window.TF.api('/api/auth/resend', { auth: false, body: { email: email, purpose: 'signup', turnstileToken: token } });
        left = 60;
        tickResend();
      } finally {
        setPending(resend, false);
      }
    });
    if (qCode && /^\d{6}$/.test(String(qCode).replace(/\D/g, '').slice(0, 6))) submitCode();
  }

  window.TF = window.TF || {};
  window.TF.bootApp = function () {
    initSignup();
    initSignupVerify();
    initLogin();
    initDashboard();
    initAdminEmails();
    initWaitlist();
  };
  window.TF.bootApp();
})();
