(function () {
  window.TF = window.TF || {};
  if (window.__tfTutorialPlayer) return;
  window.__tfTutorialPlayer = true;

  var SCENES = [
    { name: 'Intro', dur: 4.2, desc: 'Title card: how to get the course for free, seventeen steps, no deposit' },
    { name: 'Step01', dur: 6.5, desc: 'Talaria course page, click Start with NinjaTrader (affiliate button only, no private mode)' },
    { name: 'Step02', dur: 4.5, desc: 'NinjaTrader landing, click Get Started' },
    { name: 'Step03', dur: 7, desc: 'Type email, click Sign Up' },
    { name: 'Step04', dur: 4.5, desc: 'Confirm-email prompt, go to inbox' },
    { name: 'Step05', dur: 6, desc: 'Inbox: open NinjaTrader email, click Confirm Email Address' },
    { name: 'Step06', dur: 7, desc: 'Username + password, tick terms, Create User' },
    { name: 'Step07', dur: 5.5, desc: 'Choose the risk-free simulation trial' },
    { name: 'Step08', dur: 7, desc: 'Fill name, country, phone; Continue' },
    { name: 'Step09', dur: 7, desc: 'Dashboard Welcome with name: screenshot 1' },
    { name: 'Step10', dur: 8, desc: 'Ignore Start Application banners; click Start trading (Simulation)' },
    { name: 'Step11', dur: 7, desc: 'Select a Trading Mode: Access Simulation' },
    { name: 'Step12', dur: 7.5, desc: 'Trading platform open: screenshot 2, within 7 days' },
    { name: 'Step13', dur: 5, desc: 'Back to Talaria Flow, Create account with same email' },
    { name: 'Step14', dur: 4.5, desc: 'Dashboard: open Upload proof' },
    { name: 'Step15', dur: 9, desc: 'Must upload 2 screenshots; dropzone 0/2, Send disabled' },
    { name: 'Step16', dur: 7, desc: 'Both attached 2/2 (Welcome, platform); Send enabled' },
    { name: 'Step17', dur: 6, desc: 'Under review; result by email' },
    { name: 'Outro', dur: 5, desc: 'Closing card with the two calls to action' }
  ];

  var STEPS = SCENES.filter(function (s) { return /^Step/.test(s.name); });
  var DURATION = SCENES.reduce(function (n, s) { return n + s.dur; }, 0);
  var SEGMENTS = (function () {
    var t = 0;
    return SCENES.map(function (s) {
      var row = { name: s.name, start: t, dur: s.dur };
      t += s.dur;
      return row;
    });
  })();
  var CUES = (function () {
    var t = 0, out = {};
    SCENES.forEach(function (s) { out[s.name] = t; t += s.dur; });
    return out;
  })();

  var LABELS = {
    en: {
      play: 'Play', pause: 'Pause', replay: 'Replay', speed: 'Speed', full: 'Full screen',
      steps: 'Steps', poster: 'Play the 2-minute guide', intro: 'Intro', outro: 'Close'
    },
    ar: {
      play: 'تشغيل', pause: 'إيقاف', replay: 'إعادة', speed: 'السرعة', full: 'ملء الشاشة',
      steps: 'الخطوات', poster: 'شغّل الدليل في دقيقتين', intro: 'مقدمة'
    }
  };

  var STEP_SHORT = {
    en: ['Open NinjaTrader', 'Get Started', 'Sign up', 'Confirm prompt', 'Confirm email', 'Create user', 'Simulation trial', 'Fill your details', 'Screenshot 1', 'Start trading', 'Access Simulation', 'Screenshot 2', 'Talaria account', 'Upload proof', 'Attach files', 'Send', 'Under review'],
    ar: ['افتح NinjaTrader', 'Get Started', 'التسجيل', 'تأكيد البريد', 'تأكيد البريد', 'إنشاء المستخدم', 'تجربة المحاكاة', 'أدخل بياناتك', 'اللقطة 1', 'ابدأ التداول', 'Access Simulation', 'اللقطة 2', 'حساب Talaria', 'رفع الإثبات', 'أرفق الملفات', 'أرسل', 'قيد المراجعة']
  };

  var engineReady = null;
  var host = null;

  var loading = window.__tfScriptLoads || (window.__tfScriptLoads = {});
  function loadScript(src) {
    var abs = new URL(src, location.origin).href;
    if (loading[abs]) return loading[abs];
    loading[abs] = new Promise(function (resolve, reject) {
      var found = document.querySelector('script[src="' + src + '"], script[src="' + abs + '"]');
      if (found && found.getAttribute('data-tf-loaded') === '1') { resolve(); return; }
      if (found) {
        found.addEventListener('load', resolve);
        found.addEventListener('error', reject);
        return;
      }
      var el = document.createElement('script');
      el.src = abs;
      el.onload = function () { el.setAttribute('data-tf-loaded', '1'); resolve(); };
      el.onerror = reject;
      document.body.appendChild(el);
    });
    return loading[abs];
  }

  function ensureEngine() {
    if (engineReady) return engineReady;
    engineReady = (async function () {
      window.OM_SCENES = JSON.stringify(SCENES);
      window.OM_PLAYBACK = JSON.stringify({ mode: 'times', count: 1 });
      if (!window.React) await loadScript('/assets/js/vendor/react.production.min.js');
      if (!window.ReactDOM) await loadScript('/assets/js/vendor/react-dom.production.min.js');
      if (!window.CompositionStage) await loadScript('/assets/js/tutorial/animations-v3.js');
      if (!window.__tfCSWrapped && window.CompositionStage) {
        var Orig = window.CompositionStage;
        window.CompositionStage = function (props) {
          return window.React.createElement(Orig, Object.assign({}, props, { autoplay: false, loop: false, persistKey: 'tf-tutorial-engine' }));
        };
        window.__tfCSWrapped = true;
      }
      if (!window.TutorialPiece) await loadScript('/assets/js/tutorial/tutorial-scene.js');
    })();
    return engineReady;
  }

  function lang() {
    try { return localStorage.getItem('tf-lang') === 'ar' ? 'ar' : 'en'; } catch (e) { return 'en'; }
  }

  function readPersist() {
    try {
      var v = parseFloat(localStorage.getItem('tf-tutorial-t') || '0');
      return isFinite(v) ? Math.max(0, Math.min(DURATION, v)) : 0;
    } catch (e) { return 0; }
  }

  function writePersist(t) {
    try { localStorage.setItem('tf-tutorial-t', String(t)); } catch (e) {}
  }

  function parseStepParam() {
    var q = new URLSearchParams(location.search);
    var n = q.get('step');
    if (!n && location.hash) {
      var hm = location.hash.match(/[?&]step=(\d+)/);
      if (hm) n = hm[1];
    }
    var i = parseInt(n, 10);
    if (!i || i < 1 || i > STEPS.length) return null;
    return i;
  }

  function fmt(t) {
    var s = Math.max(0, Math.floor(t));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function stepIndexAt(t) {
    var i = -1;
    for (var k = 0; k < STEPS.length; k++) {
      if (t >= CUES[STEPS[k].name] - 0.02) i = k;
    }
    return i;
  }

  function svgEl(root) {
    return root.querySelector('[data-om-exportable-video-with-duration-secs]');
  }

  function seekEngine(root, t, playing) {
    var el = svgEl(root);
    if (!el) return;
    el.dispatchEvent(new CustomEvent('data-om-seek-to-time-frame', {
      detail: { time: t, playing: !!playing, sync: true }
    }));
  }

  function Host(opts) {
    this.root = opts.root;
    this.stage = opts.stage;
    this.chrome = opts.chrome;
    this.poster = opts.poster;
    this.time = opts.startTime || 0;
    this.playing = false;
    this.speed = 1;
    this.started = false;
    this.raf = 0;
    this.lastTs = 0;
    this.reactRoot = null;
    this.lang = lang();
    var self = this;
    this.onLang = function (e) {
      var next = e && e.detail === 'ar' ? 'ar' : lang();
      if (next === self.lang) return;
      self.lang = next;
      self.remountScene();
      self.paint();
    };
    window.addEventListener('tf-lang', this.onLang);
  }

  Host.prototype.destroy = function () {
    this.playing = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('tf-lang', this.onLang);
    if (this.reactRoot && this.reactRoot.unmount) this.reactRoot.unmount();
  };

  Host.prototype.remountScene = function () {
    if (!this.started || !window.TutorialPiece || !window.ReactDOM) return;
    var mount = this.stage.querySelector('[data-tf-scene]');
    if (!mount) return;
    if (this.reactRoot && this.reactRoot.unmount) this.reactRoot.unmount();
    this.reactRoot = window.ReactDOM.createRoot(mount);
    this.reactRoot.render(window.React.createElement(window.TutorialPiece, { lang: this.lang }));
    var self = this;
    requestAnimationFrame(function () { seekEngine(self.stage, self.time, false); });
  };

  Host.prototype.mountScene = function () {
    if (this.started) return Promise.resolve();
    var self = this;
    return ensureEngine().then(function () {
      self.started = true;
      if (self.poster) {
        self.poster.hidden = true;
        self.poster.style.display = 'none';
      }
      var mount = self.stage.querySelector('[data-tf-scene]');
      if (!mount) return;
      self.reactRoot = window.ReactDOM.createRoot(mount);
      self.reactRoot.render(window.React.createElement(window.TutorialPiece, { lang: self.lang }));
      return new Promise(function (resolve) {
        var n = 0;
        var wait = function () {
          if (svgEl(self.stage) || n > 120) {
            if (self.poster) self.poster.hidden = true;
            seekEngine(self.stage, self.time, false);
            resolve();
            return;
          }
          n += 1;
          requestAnimationFrame(wait);
        };
        wait();
      });
    });
  };

  Host.prototype.setPlaying = function (on) {
    var self = this;
    if (on && this.time >= DURATION - 0.05) this.time = 0;
    this.playing = !!on;
    if (this.playing) this.removeBigPlay();
    if (!this.started) {
      // Flip the stage state now so the paused circle leaves while the engine loads.
      this.paintScrub();
      this.mountScene().then(function () {
        if (self.playing) self.loop();
        self.paint();
      });
      return;
    }
    if (this.playing) this.loop();
    else seekEngine(this.stage, this.time, false);
    this.paint();
  };

  Host.prototype.loop = function () {
    var self = this;
    this.lastTs = 0;
    if (this.raf) cancelAnimationFrame(this.raf);
    var tick = function (ts) {
      if (!self.playing) return;
      if (!self.lastTs) self.lastTs = ts;
      var dt = (ts - self.lastTs) / 1000 * self.speed;
      self.lastTs = ts;
      self.time = Math.min(DURATION, self.time + dt);
      writePersist(self.time);
      seekEngine(self.stage, self.time, true);
      if (self.time >= DURATION) {
        self.playing = false;
        self.paint();
        return;
      }
      self.paintScrub();
      self.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  };

  Host.prototype.seek = function (t, play) {
    this.removeBigPlay();
    this.time = Math.max(0, Math.min(DURATION, t));
    writePersist(this.time);
    var self = this;
    if (!this.started) {
      this.mountScene().then(function () {
        seekEngine(self.stage, self.time, false);
        if (play) self.setPlaying(true);
        else self.paint();
      });
      return;
    }
    seekEngine(this.stage, this.time, false);
    if (play) this.setPlaying(true);
    else this.paint();
  };

  function pillLabel(t, ar) {
    var i = stepIndexAt(t);
    if (i < 0) return LABELS[ar ? 'ar' : 'en'].intro;
    var titles = STEP_SHORT[ar ? 'ar' : 'en'];
    return String(i + 1).padStart(2, '0') + ' · ' + (titles[i] || '');
  }

  Host.prototype.paintScrub = function () {
    var now = this.chrome.querySelector('[data-tf-now]');
    if (now) now.textContent = fmt(this.time);
    var hover = this.hoverSeg;
    this.chrome.querySelectorAll('[data-tf-seg]').forEach(function (el, i) {
      var s = SEGMENTS[i];
      if (!s) return;
      var done = this.time >= s.start + s.dur;
      var cur = this.time >= s.start && !done;
      var pct = cur ? ((this.time - s.start) / s.dur) * 100 : 0;
      var grow = hover === i || cur;
      el.style.height = grow ? '6px' : '4px';
      var fill = el.firstElementChild;
      if (fill) fill.style.width = done ? '100%' : pct + '%';
    }, this);
    this.root.setAttribute('data-tutorial-step', String(stepIndexAt(this.time) + 1));
    this.root.setAttribute('data-tutorial-playing', this.playing ? '1' : '0');
  };

  Host.prototype.paint = function () {
    var L = LABELS[this.lang];
    var playBtn = this.chrome.querySelector('[data-tf-play]');
    var ended = this.time >= DURATION - 0.05;
    if (playBtn) {
      playBtn.setAttribute('aria-label', ended ? L.replay : (this.playing ? L.pause : L.play));
      playBtn.removeAttribute('title');
      playBtn.innerHTML = ended
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"/></svg>'
        : this.playing
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
    var spd = this.chrome.querySelector('[data-tf-speed]');
    if (spd) {
      spd.textContent = this.speed === 1.5 ? '1.5×' : '1×';
      spd.setAttribute('aria-label', L.speed);
      spd.removeAttribute('title');
    }
    var full = this.chrome.querySelector('[data-tf-full]');
    if (full) {
      full.setAttribute('aria-label', L.full);
      full.removeAttribute('title');
    }
    var posterLab = this.poster && this.poster.querySelector('[data-tf-poster-lab]');
    if (posterLab) posterLab.textContent = L.poster;
    this.syncBigPlay();
    this.paintScrub();
  };

  var BIGPLAY_HTML = '<button type="button" data-tf-bigplay aria-label="Play" style="position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border:0;border-radius:50%;padding:0;background:#2EE8FF;color:#04141A;display:grid;place-items:center;cursor:pointer;z-index:4;box-shadow:0 8px 24px rgba(0,0,0,.4)">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
  '</button>';

  Host.prototype.removeBigPlay = function () {
    var big = this.stage && this.stage.querySelector('[data-tf-bigplay]');
    if (big) big.remove();
  };

  Host.prototype.syncBigPlay = function () {
    if (this.playing) { this.removeBigPlay(); return; }
    if (this.stage.querySelector('[data-tf-bigplay]')) return;
    this.stage.insertAdjacentHTML('beforeend', BIGPLAY_HTML);
    var big = this.stage.querySelector('[data-tf-bigplay]');
    var L = LABELS[this.lang];
    var ended = this.time >= DURATION - 0.05;
    if (big) big.setAttribute('aria-label', ended ? L.replay : L.play);
  };

  function buildChrome(ar) {
    var L = LABELS[ar ? 'ar' : 'en'];
    var segs = SEGMENTS.map(function (s) {
      return '<div data-tf-seg data-tf-name="' + s.name + '" style="flex:' + s.dur + ';height:4px;border-radius:2px;overflow:hidden;background:rgba(255,255,255,0.14);transition:height .12s"><div style="width:0;height:100%;background:#2EE8FF"></div></div>';
    }).join('');
    return (
      '<div data-tf-chrome style="display:flex;align-items:center;gap:12px;height:56px;box-sizing:border-box;padding:0 16px;border-top:1px solid rgba(255,255,255,.08);background:#0B0D13;direction:ltr">' +
        '<button type="button" data-tf-play class="tf-tut-play" aria-label="' + L.play + '"></button>' +
        '<div data-tf-scrub tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="' + Math.round(DURATION) + '" aria-label="' + L.steps + '" style="flex:1;min-width:64px;height:28px;position:relative;display:flex;align-items:center;cursor:pointer">' +
          '<div data-tf-track style="position:relative;flex:1;display:flex;gap:2px;align-items:center;height:16px">' + segs + '</div>' +
          '<span data-tf-hover-pill hidden style="position:absolute;bottom:calc(100% + 6px);left:0;transform:translateX(-50%);padding:4px 8px;background:#0E1017;border:1px solid rgba(255,255,255,.16);border-radius:6px;font-family:\'Geist Mono\',monospace;font-size:11px;color:#F2F4F8;white-space:nowrap;pointer-events:none;z-index:2"></span>' +
        '</div>' +
        '<span data-tf-time style="font-family:\'Geist Mono\',monospace;font-size:12px;color:#8B90A3;white-space:nowrap"><span data-tf-now>0:00</span><span data-tf-dur> / 1:58</span></span>' +
        '<button type="button" data-tf-speed class="tf-tut-speed" aria-label="' + L.speed + '">1×</button>' +
        '<button type="button" data-tf-full class="tf-tut-full" aria-label="' + L.full + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"></path></svg>' +
        '</button>' +
      '</div>'
    );
  }

  function bind(h) {
    var play = h.chrome.querySelector('[data-tf-play]');
    var scrub = h.chrome.querySelector('[data-tf-scrub]');
    var speed = h.chrome.querySelector('[data-tf-speed]');
    var full = h.chrome.querySelector('[data-tf-full]');
    var card = h.root.querySelector('[data-player]');
    if (play) play.addEventListener('click', function () { h.setPlaying(!h.playing); });
    if (h.poster) h.poster.addEventListener('click', function () { h.setPlaying(true); });
    h.stage.addEventListener('click', function (e) {
      if (e.target.closest('[data-tf-bigplay]')) h.setPlaying(true);
    });
    if (speed) speed.addEventListener('click', function () {
      h.speed = h.speed === 1 ? 1.5 : 1;
      h.paint();
    });
    if (full && card) full.addEventListener('click', function () {
      var rq = card.requestFullscreen || card.webkitRequestFullscreen;
      if (document.fullscreenElement === card) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) ex.call(document);
      } else if (rq) rq.call(card);
    });
    if (scrub) {
      var pill = scrub.querySelector('[data-tf-hover-pill]');
      var track = scrub.querySelector('[data-tf-track]') || scrub;
      var hitFromEv = function (e) {
        var nodes = track.querySelectorAll('[data-tf-seg]');
        var x = e.clientX;
        for (var i = 0; i < nodes.length; i++) {
          var r = nodes[i].getBoundingClientRect();
          if (x >= r.left && x <= r.right) {
            var seg = SEGMENTS[i];
            var pct = r.width ? (x - r.left) / r.width : 0;
            return { i: i, t: Math.max(0, Math.min(DURATION, seg.start + pct * seg.dur)), seg: seg };
          }
        }
        var tr = track.getBoundingClientRect();
        var p = Math.max(0, Math.min(1, (x - tr.left) / tr.width));
        return { i: -1, t: p * DURATION, seg: null };
      };
      var showHover = function (e, hit) {
        hit = hit || hitFromEv(e);
        h.hoverSeg = hit.i;
        if (pill) {
          pill.hidden = false;
          pill.textContent = pillLabel(hit.t, h.lang === 'ar');
          var sr = scrub.getBoundingClientRect();
          pill.style.left = (e.clientX - sr.left) + 'px';
        }
        h.paintScrub();
      };
      var hideHover = function () {
        h.hoverSeg = null;
        if (pill) pill.hidden = true;
        h.paintScrub();
      };
      scrub.addEventListener('pointerdown', function (e) {
        scrub.setPointerCapture(e.pointerId);
        var hit = hitFromEv(e);
        if (hit.seg && h.time < hit.seg.start) h.seek(hit.seg.start, false);
        else h.seek(hit.t, false);
        showHover(e, hit);
      });
      scrub.addEventListener('pointermove', function (e) {
        var hit = hitFromEv(e);
        showHover(e, hit);
        if (e.buttons) h.seek(hit.t, false);
      });
      scrub.addEventListener('pointerup', function (e) {
        try { scrub.releasePointerCapture(e.pointerId); } catch (err) {}
        if (!scrub.matches(':hover')) hideHover();
      });
      scrub.addEventListener('pointercancel', hideHover);
      scrub.addEventListener('pointerleave', hideHover);
      scrub.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowLeft' && e.shiftKey) {
          var i = stepIndexAt(h.time);
          next = i <= 0 ? CUES[STEPS[0].name] : CUES[STEPS[i - 1].name];
        } else if (e.key === 'ArrowRight' && e.shiftKey) {
          var j = stepIndexAt(h.time);
          next = j < 0 ? CUES[STEPS[0].name] : CUES[STEPS[Math.min(STEPS.length - 1, j + 1)].name];
        } else if (e.key === 'ArrowLeft') next = h.time - 5;
        else if (e.key === 'ArrowRight') next = h.time + 5;
        else if (e.key === 'Home') next = CUES[STEPS[0].name];
        else if (e.key === 'End') next = CUES[STEPS[STEPS.length - 1].name];
        if (next == null) return;
        e.preventDefault();
        h.seek(next, false);
      });
    }
    h.root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tf-jump]');
      if (!btn || !h.root.contains(btn)) return;
      var n = Number(btn.getAttribute('data-tf-jump'));
      var key = 'Step' + String(n).padStart(2, '0');
      if (CUES[key] == null) return;
      h.seek(CUES[key] + 0.02, true);
    });
  }

  function mount() {
    var root = document.getElementById('guide') || document.querySelector('[data-guide]');
    if (!root) return null;
    if (host && host.root === root && root.querySelector('[data-tf-scene]')) {
      var step = parseStepParam();
      if (step) host.seek(CUES['Step' + String(step).padStart(2, '0')] + 0.02, true);
      return host;
    }
    if (host) host.destroy();

    var stage = root.querySelector('[data-tf-stage]') || root.querySelector('[data-player]');
    if (!stage) return null;
    if (!stage.querySelector('[data-tf-scene]')) {
      stage.insertAdjacentHTML('beforeend',
        '<div data-tf-scene style="position:absolute;inset:0;bottom:-48px"></div>' +
        // Still frame shown until the engine has started once; it never shows again after that.
        '<button type="button" data-tf-poster style="position:absolute;inset:0;border:0;padding:0;cursor:pointer;background:transparent;color:#F2F4F8;z-index:3">' +
          '<picture style="display:contents"><source type="image/webp" srcset="/assets/howto/p01.webp"><img src="/assets/howto/p01.png" alt="Step 1: Open NinjaTrader" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.42"></picture>' +
          '<span style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,8,12,.15),rgba(7,8,12,.55))"></span>' +
          '<span data-tf-poster-lab data-i18n="course.vidPlay" class="visually-hidden">' + ((window.TF && window.TF.lookup && window.TF.lookup('course.vidPlay', lang())) || 'Play the 2-minute guide') + '</span>' +
        '</button>' +
        // Paused state: one 64px cyan circle centred on the stage. Hidden by CSS whenever the host
        // reports data-tutorial-playing="1", so it never renders while playing and never survives a seek.
        BIGPLAY_HTML
      );
    }
    var card = root.querySelector('[data-player]');
    var chromeHost = root.querySelector('[data-tf-controls]');
    if (card && chromeHost && chromeHost.parentElement !== card) card.appendChild(chromeHost);
    if (!chromeHost && card) {
      card.insertAdjacentHTML('beforeend', '<div data-tf-controls></div>');
      chromeHost = card.querySelector('[data-tf-controls]');
    }
    if (chromeHost) chromeHost.innerHTML = buildChrome(lang() === 'ar');
    var start = readPersist();
    var step = parseStepParam();
    if (step) start = CUES['Step' + String(step).padStart(2, '0')] + 0.02;
    host = new Host({
      root: root,
      stage: stage,
      chrome: chromeHost || root,
      poster: stage.querySelector('[data-tf-poster]'),
      startTime: start
    });
    bind(host);
    host.paint();
    if (step) host.seek(start, true);
    if (location.hash === '#guide' || location.hash.indexOf('#guide') === 0) {
      root.scrollIntoView();
    }
    return host;
  }

  window.TF.mountTutorial = function () { return mount(); };
  window.TF.tutorialSeek = function (t, play) {
    if (!host) mount();
    if (host) host.seek(t, play);
  };
  window.TF.tutorialPlayAt = function (t) {
    if (!host) mount();
    if (host) host.seek(t, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mount(); });
  } else {
    mount();
  }
})();
