/* Talaria Flow — "How to register" animated tutorial.
   Renders from T only. Screenshots live in assets/howto/. */

const { CompositionStage, useComposition, useTimeline, Shot, Easing, animate, interpolate, clamp } = window;

const W = 1920, H = 1080;
const SCN = JSON.parse(window.OM_SCENES || '[]');
const DUR = (name) => { const e = SCN.find(x => x.name === name); return e ? e.dur : 5.4; };
const CARD = { x: 200, y: 148, w: 1520, h: 790 };

const C = {
  bg: '#07080C', panel: '#0B0D13', line: 'rgba(255,255,255,0.12)',
  text: '#F2F4F8', text2: '#B7BCCB', text3: '#8B90A3', text4: '#7C8296',
  cyan: '#2EE8FF', magenta: '#FF37B0', amber: '#FBBF24'
};

const mix = (v, a, b, e) => { const t = clamp(v, 0, 1); return a + (b - a) * (e ? e(t) : t); };

const MOTION = {
  enter: (start) => animate({ from: 0, to: 1, start, end: start + 0.5, ease: Easing.easeOutCubic }),
  zoom:  (start, from, to) => animate({ from, to, start, end: start + 1.0, ease: Easing.easeInOutCubic }),
  pop:   (start) => animate({ from: 0, to: 1, start, end: start + 0.45, ease: Easing.easeOutBack })
};

/* Short step titles for the frame alt text ("Step N: <title>", SEO.md). */
const STEP_TITLES = ['Open NinjaTrader', 'Get Started', 'Sign up', 'Confirm prompt', 'Confirm email', 'Create user', 'Simulation trial', 'Fill details', 'Screenshot 1', 'Start trading', 'Access Simulation', 'Screenshot 2', 'Talaria account', 'Upload proof', 'Attach files', 'Send', 'Under review'];

/* step: img, size, targets[{x,y,at}], en, ar, note */
const STEPS = [
  { img: 'p01.png', targets: [{ x: 0.28, y: 0.507, w: 0.115, h: 0.055, at: 1.6 }],
    en: 'On the free course page, click Start with NinjaTrader. Use this button only, not a search or a bookmark, and not in private mode. You must be new to NinjaTrader, under any email.',
    ar: 'من صفحة الدورة المجانية اضغط ابدأ مع NinjaTrader. استخدم هذا الزر فقط لا البحث ولا الإشارات المرجعية ولا وضع التصفح الخاص. يجب أن تكون جديداً على NinjaTrader بأي بريد' },
  { img: 'p02.png', targets: [{ x: 0.795, y: 0.053, w: 0.13, h: 0.05, at: 1.6 }],
    en: 'You land on NinjaTrader. Click Get Started.',
    ar: 'ستنتقل إلى NinjaTrader. اضغط Get Started' },
  { img: 'p03.png', lEn: ["Type","Click"], lAr: ["اكتب","اضغط"], targets: [{ x: 0.69, y: 0.244, w: 0.29, h: 0.05, at: 1.6 }, { x: 0.69, y: 0.379, w: 0.29, h: 0.068, at: 0.55 }],
    en: 'Type your email, then click Sign Up. Use the same email you will use on Talaria Flow.',
    ar: 'اكتب بريدك الإلكتروني ثم اضغط Sign Up. استخدم البريد نفسه الذي ستستخدمه في Talaria Flow' },
  { img: 'p04.png', targets: [],
    en: 'NinjaTrader asks you to confirm the address. Leave this page open and go to your inbox.',
    ar: 'سيطلب NinjaTrader تأكيد البريد. اترك هذه الصفحة مفتوحة وافتح صندوق بريدك' },
  { img: 'p05.png', zMax: 1.12, inbox: true, targets: [{ x: 0.411, y: 0.47, w: 0.17, h: 0.062, at: 2.4 }],
    en: 'In your inbox, open the email from NinjaTrader and click Confirm Email Address.',
    ar: 'في صندوق بريدك افتح الرسالة من NinjaTrader واضغط Confirm Email Address' },
  { img: 'p06.png', lEn: ["Tick","Click"], lAr: ["علّم","اضغط"], targets: [{ x: 0.576, y: 0.478, w: 0.025, h: 0.04, at: 1.6 }, { x: 0.688, y: 0.796, w: 0.28, h: 0.065, at: 0.55 }],
    en: 'Pick a username and password, tick the terms box, then click Create User.',
    ar: 'اختر اسم مستخدم وكلمة مرور وضع علامة الموافقة على الشروط ثم اضغط Create User' },
  { img: 'p07.png', lEn: ["Click"], lAr: ["اضغط"], targets: [{ x: 0.309, y: 0.867, w: 0.36, h: 0.03, at: 1.6 }],
    en: 'Choose the risk-free simulation trial at the bottom. No deposit is required at any point.',
    ar: 'اختر التجربة المحاكاة بلا مخاطر في الأسفل. لا يلزم أي إيداع في أي مرحلة' },
  { img: 'p08.png', lEn: ["Fill","Click"], lAr: ["املأ","اضغط"], targets: [{ x: 0.36, y: 0.545, w: 0.37, h: 0.308, at: 1.6 }, { x: 0.36, y: 0.774, w: 0.37, h: 0.068, at: 0.55 }],
    en: 'Fill in your name, country and phone number, then click Continue.',
    ar: 'أدخل اسمك وبلدك ورقم هاتفك ثم اضغط Continue' },
  { img: 'p09.png', shot: true, lEn: ["Screenshot 1"], lAr: ["اللقطة 1"], targets: [{ x: 0.333, y: 0.57, w: 0.29, h: 0.075, at: 1.6 }], zMax: 1.15,
    en: 'Your NinjaTrader account is registered and the dashboard says Welcome with your name. Take screenshot 1 of this page.',
    ar: 'تم تسجيل حساب NinjaTrader وتظهر لوحة التحكم Welcome مع اسمك. خذ اللقطة 1 لهذه الصفحة' },
  { img: 'p09.png', lEn: ["Click"], lAr: ["اضغط"], targets: [{ x: 0.89, y: 0.958, w: 0.11, h: 0.05, at: 1.6 }], zMax: 1.15,
    en: 'Ignore both Start Application banners, they are for a funded live account. Scroll down and click Start trading with Simulation selected.',
    ar: 'تجاهل شريطي Start Application فهما لحساب حقيقي مموّل. انزل للأسفل واضغط Start trading مع اختيار Simulation' },
  { img: 'p16.png', lEn: ["Click"], lAr: ["اضغط"], targets: [{ x: 0.742, y: 0.928, w: 0.21, h: 0.066, at: 1.6 }], zMax: 1.2,
    en: 'On Select a Trading Mode click Access Simulation. Ignore Live Trading: no live account, no funding, no ID documents.',
    ar: 'في صفحة Select a Trading Mode اضغط Access Simulation. تجاهل Live Trading: لا حساب حقيقي ولا تمويل ولا مستندات هوية' },
  { img: 'p18.png', shot: true, lEn: ["Screenshot 2"], lAr: ["اللقطة 2"], targets: [{ x: 0.52, y: 0.033, w: 0.2, h: 0.05, at: 1.6 }], zMax: 1.15,
    en: 'The trading platform opens. This login must happen within 7 days of registering. Close any pop-up and take screenshot 2 with your account shown at the top.',
    ar: 'تُفتح منصة التداول. يجب أن يتم هذا الدخول خلال 7 أيام من التسجيل. أغلق أي نافذة منبثقة وخذ اللقطة 2 مع ظهور حسابك في الأعلى' },
  { img: 'p10.png', targets: [{ x: 0.892, y: 0.043, w: 0.07, h: 0.042, at: 1.6 }],
    en: 'Come back to Talaria Flow and click Create account. Use the same email.',
    ar: 'عد إلى Talaria Flow واضغط إنشاء حساب. استخدم البريد نفسه' },
  /* NinjaTrader screens stay on the English product UI. imgAr is only for Talaria chrome (p12, p19). */
  { img: 'p12.png', imgAr: 'p12-ar.png', targets: [{ x: 0.344, y: 0.423, w: 0.06, h: 0.03, at: 1.6 }],
    en: 'In your dashboard, open Upload proof.',
    ar: 'من لوحة التحكم افتح رفع الإثبات' },
  { img: 'p13.png', lEn: ["Drop 2 here","Disabled"], lAr: ["أسقط اللقطتين","معطّل"], targets: [{ x: 0.548, y: 0.63, w: 0.46, h: 0.16, at: 1.6 }, { x: 0.731, y: 0.922, w: 0.09, h: 0.05, at: 0.55 }],
    en: 'You must upload 2 screenshots: screenshot 1 (Welcome dashboard) and screenshot 2 (trading platform). Drop both here. Send stays disabled until both are attached.',
    ar: 'يجب رفع لقطتين: اللقطة 1 (لوحة Welcome) واللقطة 2 (منصة التداول). أسقط اللقطتين هنا. يبقى زر الإرسال معطّلاً حتى تُرفق اللقطتان' },
  { img: 'p15.png', lEn: ["2 attached","Send"], lAr: ["لقطتان مرفقتان","أرسل"], targets: [{ x: 0.548, y: 0.63, w: 0.46, h: 0.16, at: 1.6 }, { x: 0.731, y: 0.922, w: 0.09, h: 0.05, at: 0.55 }],
    en: 'Both screenshots are attached: 1 Welcome dashboard, 2 trading platform. The Send button turns on. Click Send for review.',
    ar: 'اللقطتان مرفقتان: 1 لوحة Welcome و2 منصة التداول. يُفعَّل زر الإرسال. اضغط إرسال للمراجعة' },
  { img: 'p19.png', imgAr: 'p19-ar.png', targets: [],
    en: 'Done. Your status is Under review. We check it by hand and email you the result before 31 December 2026.',
    ar: 'انتهى. حالتك الآن قيد المراجعة. نراجعها يدوياً ونرسل لك النتيجة بالبريد قبل 31 ديسمبر 2026' }
];


function Arrow({ from, to }) {           // from/to in stage px
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const endX = to.x - ux * 6, endY = to.y - uy * 6;   // stop 6px short
  const a = Math.atan2(dy, dx), h = 14, w = 9;
  const tip = `${endX},${endY}`;
  const l = `${endX - h * ux + w * Math.sin(a)},${endY - h * uy - w * Math.cos(a)}`;
  const r = `${endX - h * ux - w * Math.sin(a)},${endY - h * uy + w * Math.cos(a)}`;
  return React.createElement('g', null,
    React.createElement('line', {
      x1: from.x, y1: from.y, x2: endX - h * ux, y2: endY - h * uy,
      stroke: '#F5B800', strokeWidth: 4, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke'
    }),
    React.createElement('polygon', { points: `${tip} ${l} ${r}`, fill: '#F5B800' })
  );
}

function Target({ x, y, bw, bh, a, pulse, flip, label, mono }) {
  if (a <= 0) return null;
  const k = mix(a, 0.5, 1, Easing.easeOutCubic);
  const len = 300;
  const side = (x - bw / 2 - 300 < 0) ? 1 : -1;
  const tx = x + side * (bw / 2 + 14 + 6), ty = flip ? y + bh / 2 + 14 + 6 : y - bh / 2 - 14 - 6;
  const sx = tx + side * len * 0.74 * k, sy = ty + (flip ? len * 0.62 * k : -len * 0.62 * k);
  const pad = 36, lw = label ? label.w + 16 : 0;
  const sxC = clamp(sx, pad + (side < 0 ? lw : 0), CARD.w - pad - (side > 0 ? lw : 0));
  const syC = clamp(sy, pad + 30, CARD.h - pad - 30);
  const grow = pulse * 10, P = 14;
  const box = { l: x - bw / 2 - P, t: y - bh / 2 - P, r: x + bw / 2 + P, b: y + bh / 2 + P };
  const lab = label ? { l: sxC + side * 8 + (side > 0 ? 0 : -label.w), t: syC - 27, w: label.w, h: 54 } : null;
  let sx0 = sxC, sy0 = syC;
  if (lab) {
    const lcx = lab.l + lab.w / 2, lcy = lab.t + lab.h / 2;
    const dx = x - lcx, dy = y - lcy;
    if (Math.abs(dx) * lab.h >= Math.abs(dy) * lab.w) { sx0 = dx > 0 ? lab.l + lab.w : lab.l; sy0 = lcy; }
    else { sx0 = lcx; sy0 = dy > 0 ? lab.t + lab.h : lab.t; }
  }
  const to = { x: clamp(sx0, box.l, box.r), y: clamp(sy0, box.t, box.b) };
  const from = { x: sx0, y: sy0 };
  return React.createElement('g', { opacity: a },
    React.createElement('rect', { x: box.l - grow, y: box.t - grow, width: bw + 2 * P + grow * 2, height: bh + 2 * P + grow * 2, rx: 14 + grow / 2, fill: 'none', stroke: C.amber, strokeWidth: 3, opacity: (1 - pulse) * 0.7 }),
    React.createElement('rect', { x: box.l, y: box.t, width: bw + 2 * P, height: bh + 2 * P, rx: 14, fill: 'none', stroke: C.amber, strokeWidth: 5 }),
    React.createElement(Arrow, { from, to }),
    label ? React.createElement('g', { transform: `translate(${sxC + side * 8} ${syC})` },
      React.createElement('rect', { x: side > 0 ? 0 : -label.w, y: -27, width: label.w, height: 54, rx: 14, fill: C.amber }),
      React.createElement('text', { x: side > 0 ? label.w / 2 : -label.w / 2, y: 9, textAnchor: 'middle', fill: '#04141A', style: { fontFamily: mono, fontSize: 26, fontWeight: 600 } }, label.text)
    ) : null
  );
}

function Spotlight({ w, h, hole, a }) {
  if (a <= 0 || !hole) return null;
  const bw = hole.w + 120, bh = hole.h + 90;
  const x = clamp(hole.x - bw / 2, 0, Math.max(0, w - bw));
  const y = clamp(hole.y - bh / 2, 0, Math.max(0, h - bh));
  const dim = { fill: '#04060B', opacity: a * 0.7 };
  return React.createElement('g', null,
    React.createElement('rect', Object.assign({ x: 0, y: 0, width: w, height: y }, dim)),
    React.createElement('rect', Object.assign({ x: 0, y: y + bh, width: w, height: Math.max(0, h - y - bh) }, dim)),
    React.createElement('rect', Object.assign({ x: 0, y, width: x, height: bh }, dim)),
    React.createElement('rect', Object.assign({ x: x + bw, y, width: Math.max(0, w - x - bw), height: bh }, dim)),
    null
  );
}

// Step rail only. Play/pause lives in the host's bottom bar (tutorial-player.js); the stage itself
// carries no play control while playing, and the host draws the paused-state circle.
function Controls({ active, shell, ar, mono, T }) {
  const tl = useTimeline() || {};
  const { CUES } = useComposition();
  const go = (i) => { const k = 'Step' + String(clamp(i, 0, STEPS.length - 1) + 1).padStart(2, '0'); if (tl.setTime) tl.setTime(CUES[k] + 0.02); };
  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: { position: 'absolute', left: CARD.x, top: 1030, width: CARD.w, height: 46, display: 'flex', alignItems: 'center', gap: 18, opacity: Math.max(shell, 0.001), pointerEvents: 'auto' } },
    React.createElement('div', { style: { flex: 1, display: 'flex', gap: 5, alignItems: 'center', height: 46 } },
      STEPS.map((_, i) => {
        const s = CUES['Step' + String(i + 1).padStart(2, '0')];
        const p = clamp((T - s) / DUR('Step' + String(i + 1).padStart(2, '0')), 0, 1);
        return React.createElement('button', { key: i, type: 'button', onClick: () => go(i), 'aria-label': (ar ? 'الخطوة ' : 'Step ') + (i + 1), style: { flex: 1, height: 22, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', position: 'relative' } },
          React.createElement('span', { style: { position: 'absolute', left: 0, right: 0, top: 9, height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 2 } }),
          React.createElement('span', { style: { position: 'absolute', left: 0, top: 9, height: 4, width: (p * 100) + '%', background: i === active ? C.cyan : 'rgba(46,232,255,0.5)', borderRadius: 2 } })
        );
      })),
    React.createElement('span', { style: { flex: 'none', fontFamily: mono, fontSize: 14, letterSpacing: '.12em', color: C.text3 } }, active < 0 ? '' : String(active + 1).padStart(2, '0') + ' / ' + String(STEPS.length).padStart(2, '0'))
  ));
}

function Piece({ lang }) {
  const { T, CUES, authoredTotal } = useComposition();
  const ar = lang === 'ar';
  const face = ar ? "'Cairo','Archivo',sans-serif" : "'Archivo',sans-serif";
  const mono = "'Geist Mono',monospace";
  const dir = ar ? 'rtl' : 'ltr';

  const introA = MOTION.enter(0)(T);
  const introOut = animate({ from: 1, to: 0, start: CUES.Step01 - 0.5, end: CUES.Step01, ease: Easing.easeInQuad })(T);
  const shellIn = animate({ from: 0, to: 1, start: CUES.Step01 - 0.35, end: CUES.Step01 + 0.3, ease: Easing.easeOutCubic })(T);
  const shellOut = animate({ from: 1, to: 0, start: CUES.Outro - 0.4, end: CUES.Outro + 0.1, ease: Easing.easeInQuad })(T);
  const shell = Math.min(shellIn, shellOut);

  let active = -1;
  for (let i = 0; i < STEPS.length; i++) {
    const s = CUES['Step' + String(i + 1).padStart(2, '0')];
    if (T >= s - 0.05) active = i;
  }

  const frames = STEPS.map((st, i) => {
    const start = CUES['Step' + String(i + 1).padStart(2, '0')];
    const dur = DUR('Step' + String(i + 1).padStart(2, '0'));
    const end = start + dur;
    const t = T - start;
    const tg0 = st.targets;
    const focusIdx = tg0.length ? Math.max(0, tg0.reduce((idx, g, k) => (t >= (g.at <= 1 ? g.at * dur : g.at) - 0.35 ? k : idx), 0)) : -1;
    const fo = focusIdx >= 0 ? tg0[focusIdx] : { x: 0.5, y: 0.5, w: 0.3, h: 0.1 };
    const fitZ = (g) => Math.max(1, Math.min(st.zMax || 1.5, 0.42 / Math.max(g.w || 0.12, (g.h || 0.052) * 0.55)));
    const zTo = st.shot ? 1 : (tg0.length ? fitZ(fo) : 1.05);
    // camera glides between targets: anchor + zoom interpolate over 0.9 s after each focus change
    const focusAt = focusIdx > 0 ? (tg0[focusIdx].at <= 1 ? tg0[focusIdx].at * dur : tg0[focusIdx].at) - 0.35 : 0;
    const prev = focusIdx > 0 ? tg0[focusIdx - 1] : fo;
    const gl = focusIdx > 0 ? clamp(animate({ from: 0, to: 1, start: focusAt, end: focusAt + 0.9, ease: Easing.easeInOutCubic })(t), 0, 1) : 1;
    const primary = { x: prev.x + (fo.x - prev.x) * gl, y: prev.y + (fo.y - prev.y) * gl };
    let z = 1;
    if (t > 0.75) z = MOTION.zoom(0.75, 1, focusIdx > 0 ? fitZ(prev) + (zTo - fitZ(prev)) * gl : zTo)(t);
    if (t > dur - 1.15) z = MOTION.zoom(dur - 1.15, z, 1)(t);
    const fadeIn = animate({ from: 0, to: 1, start: -0.08, end: 0.34, ease: Easing.easeOutCubic })(t);
    const fadeOut = animate({ from: 1, to: 0, start: dur - 0.26, end: dur + 0.02, ease: Easing.easeInQuad })(t);
    const op = Math.min(fadeIn, fadeOut, 1);
    const slide = mix(fadeIn, 46, 0, Easing.easeOutCubic);
    const ox = primary.x * CARD.w, oy = primary.y * CARD.h;
    const pulse = ((t * 0.9) % 1);

    return React.createElement(Shot, { key: i, from: start - 1.2, to: end + 1.2 },
      React.createElement('div', {
        style: {
          position: 'absolute', left: 0, top: 0, width: CARD.w, height: CARD.h,
          opacity: op, transform: `translateX(${slide}px)`
        }
      },
        React.createElement('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden' } },
          // WebP with the original PNG as fallback; frames mount only around their own cue, so they load lazily.
          React.createElement('picture', { style: { display: 'contents' } },
            React.createElement('source', { type: 'image/webp', srcSet: 'assets/howto/' + (ar && st.imgAr ? st.imgAr : st.img).replace(/\.png$/, '.webp') }),
            React.createElement('img', {
              src: 'assets/howto/' + (ar && st.imgAr ? st.imgAr : st.img), alt: 'Step ' + (i + 1) + ': ' + STEP_TITLES[i], loading: 'lazy', decoding: 'async',
              style: {
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill',
                transform: `scale(${z})`, transformOrigin: `${primary.x * 100}% ${primary.y * 100}%`
              }
            })
          )
        ),
        React.createElement('svg', { width: CARD.w, height: CARD.h, viewBox: `0 0 ${CARD.w} ${CARD.h}`, style: { position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' } },
          (function () {
            const out = clamp(animate({ from: 1, to: 0, start: dur - 0.55, end: dur - 0.25 })(t), 0, 1);
            const marks = st.targets.map((tg, k) => {
              const px = ox + (tg.x * CARD.w - ox) * z, py = oy + (tg.y * CARD.h - oy) * z;
              const bw = (tg.w || 0.12) * CARD.w * z, bh = (tg.h || 0.052) * CARD.h * z;
              const at = tg.at <= 1 ? tg.at * dur : tg.at;
              const a = clamp(MOTION.pop(at)(t), 0, 1) * out;
              const L = ar ? st.lAr : st.lEn; return { k, px, py, bw, bh, a, label: L && L[k] };
            });
            const lit = st.shot ? [] : marks.filter(m => m.a > 0.15);
            if (st.shot) {
              const on = clamp(MOTION.pop(1.4)(t), 0, 1) * out;
              const flash = t > 2.6 && t < 3.3 ? clamp(1 - (t - 2.6) / 0.7, 0, 1) : 0;
              const L = 70, m = 18 + (1 - on) * 40, col = C.magenta;
              const br = (x1, y1, dx, dy) => React.createElement('path', { d: `M ${x1 + dx * L} ${y1} L ${x1} ${y1} L ${x1} ${y1 + dy * L}`, fill: 'none', stroke: col, strokeWidth: 8, strokeLinecap: 'round' });
              return [
                React.createElement('rect', { key: 'fl', x: 0, y: 0, width: CARD.w, height: CARD.h, fill: '#fff', opacity: flash * 0.85 }),
                React.createElement('g', { key: 'br', opacity: on },
                  br(m, m, 1, 1), br(CARD.w - m, m, -1, 1), br(m, CARD.h - m, 1, -1), br(CARD.w - m, CARD.h - m, -1, -1)),
                React.createElement('g', { key: 'cam', opacity: on, transform: `translate(${CARD.w / 2} ${CARD.h / 2})` },
                  React.createElement('circle', { r: 64 + (1 - on) * 30, fill: col }),
                  React.createElement('g', { fill: 'none', stroke: '#fff', strokeWidth: 4.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
                    React.createElement('path', { d: 'M -30 -14 h 12 l 8 -10 h 20 l 8 10 h 12 a 6 6 0 0 1 6 6 v 30 a 6 6 0 0 1 -6 6 h -60 a 6 6 0 0 1 -6 -6 v -30 a 6 6 0 0 1 6 -6 z' }),
                    React.createElement('circle', { cx: 0, cy: 8, r: 11 }))
                )
              ];
            }
            const inboxA = st.inbox ? clamp(MOTION.pop(0.7)(t), 0, 1) * clamp(animate({ from: 1, to: 0, start: 2.2, end: 2.7 })(t), 0, 1) : 0;
            const inboxG = inboxA > 0 ? React.createElement('g', { key: 'inbox', opacity: inboxA, transform: `translate(${CARD.w / 2} ${CARD.h * 0.42}) scale(${0.85 + inboxA * 0.15})` },
              React.createElement('rect', { x: -CARD.w / 2, y: -CARD.h * 0.42, width: CARD.w, height: CARD.h, fill: '#04060B', opacity: 0.72 }),
              React.createElement('g', { transform: 'translate(0 -90) scale(4.2)', fill: 'none', stroke: C.amber, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                React.createElement('path', { d: 'M -14 -2 L -8 -12 H 8 L 14 -2 V 10 a 2 2 0 0 1 -2 2 H -12 a 2 2 0 0 1 -2 -2 Z' }),
                React.createElement('path', { d: 'M -14 -2 H -6 l 2 4 h 8 l 2 -4 H 14' })),
              React.createElement('text', { y: 92, textAnchor: 'middle', fill: C.amber, direction: dir, style: { fontFamily: face, fontSize: 84, fontWeight: 800, letterSpacing: ar ? 0 : '-0.02em' } }, ar ? 'افتح صندوق بريدك' : 'Check your inbox'),
              React.createElement('text', { y: 150, textAnchor: 'middle', fill: C.text2, direction: dir, style: { fontFamily: face, fontSize: 30 } }, ar ? 'رسالة من support@ninjatrader.com' : 'An email from support@ninjatrader.com')
            ) : null;
            return [
              inboxG,
              React.createElement(Spotlight, { key: 'sl', w: CARD.w, h: CARD.h, hole: lit.length ? { x: lit[lit.length - 1].px, y: lit[lit.length - 1].py, w: lit[lit.length - 1].bw, h: lit[lit.length - 1].bh } : null, a: lit.length ? lit[lit.length - 1].a : 0 }),
              marks.map(m => React.createElement(Target, {
                key: m.k, x: m.px, y: m.py, bw: m.bw, bh: m.bh, a: m.a, pulse,
                flip: (m.py - m.bh / 2) < 110 || (m.k > 0 && marks[m.k - 1].py < m.py && (m.py - marks[m.k - 1].py) < 320),
                label: m.a > 0.4 ? (function(){ const txt = m.label || (ar ? 'اضغط' : 'Click'); return { text: txt, w: txt.length * (ar ? 18 : 16) + 34 }; })() : null,
                mono
              }))
            ];
          })()
        )
      )
    );
  });

  const st = STEPS[Math.max(0, active)];
  const shotStart = CUES.Step09, shotA = clamp(animate({ from: 0, to: 1, start: shotStart + 1.2, end: shotStart + 1.7, ease: Easing.easeOutBack })(T), 0, 1) * clamp(animate({ from: 1, to: 0, start: shotStart + DUR('Step09') - 0.5, end: shotStart + DUR('Step09') - 0.2 })(T), 0, 1);
  const capStart = active < 0 ? 0 : CUES['Step' + String(active + 1).padStart(2, '0')];
  const capA = clamp(animate({ from: 0, to: 1, start: capStart + 0.15, end: capStart + 0.7, ease: Easing.easeOutCubic })(T), 0, 1);

  return React.createElement('div', { style: { position: 'absolute', inset: 0, fontFamily: face, color: C.text } },

    /* header */
    React.createElement('div', { style: { position: 'absolute', left: CARD.x, top: 56, right: CARD.x, display: 'flex', alignItems: 'center', gap: 18, opacity: shell } },
      React.createElement('img', { src: 'assets/logo.svg', alt: 'Talaria Flow', width: 26, height: 29 }),
      React.createElement('span', { style: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' } }, 'Talaria ',
        React.createElement('span', { style: { fontWeight: 400, color: C.text3 } }, 'Flow')),
      React.createElement('span', { style: { width: 1, height: 22, background: C.line } }),
      React.createElement('span', { dir, style: { fontSize: 20, color: C.text2 } }, ar ? 'كيف تسجّل وتحصل على الدورة' : 'How to register and get the course'),
      React.createElement('span', { style: { marginLeft: 'auto', fontFamily: mono, fontSize: 15, letterSpacing: '.14em', color: C.text3 } },
        active < 0 ? '' : `STEP ${String(active + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`)
    ),

    /* card shell + frames */
    React.createElement('div', {
      style: {
        position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h,
        borderRadius: 16, border: shotA > 0.5 ? '3px solid ' + C.magenta : '1px solid ' + C.line, background: C.panel, overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,.55)', opacity: shell,
        transform: `translateY(${mix(shell, 24, 0, Easing.easeOutCubic)}px)`
      }
    }, frames),

    /* screenshot banner (step 9) */
    React.createElement('div', { style: { position: 'absolute', left: CARD.x, top: CARD.y - 2, width: CARD.w, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: shotA, transform: `translateY(${mix(shotA, -30, 0)}px)` } },
      React.createElement('div', { dir, style: { display: 'inline-flex', alignItems: 'center', gap: 14, height: 62, padding: '0 26px', background: C.magenta, color: '#fff', borderRadius: '0 0 16px 16px', fontSize: 24, fontWeight: 700, boxShadow: '0 16px 40px rgba(255,55,176,.35)' } },
        React.createElement('svg', { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2' }), React.createElement('circle', { cx: 12, cy: 12, r: 3.5 })),
        ar ? 'خذ لقطة شاشة للصفحة كاملة — هذا هو إثباتك' : 'Screenshot the whole page — this is your proof'
      )
    ),

    /* caption */
    React.createElement('div', { style: { position: 'absolute', left: CARD.x, top: 946, width: CARD.w, display: 'flex', gap: 20, alignItems: 'flex-start', opacity: shell * capA } },
      React.createElement('span', {
        style: { flex: 'none', width: 46, height: 46, display: 'grid', placeItems: 'center', background: C.cyan, color: '#04141A', fontFamily: mono, fontSize: 17, fontWeight: 500, borderRadius: 10 }
      }, String(Math.max(0, active) + 1).padStart(2, '0')),
      React.createElement('span', {
        dir, style: { fontSize: 27, lineHeight: 1.3, color: C.text, maxWidth: 1440, textAlign: 'left', letterSpacing: ar ? '0' : '-0.01em' }
      }, ar ? st.ar : st.en)
    ),

    /* clickable step rail */
    React.createElement(Controls, { active, shell, ar, mono, T }),

    /* intro */
    React.createElement(Shot, { from: -1, to: CUES.Step01 + 0.2 },
      React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: C.bg, opacity: Math.min(introA, introOut) } },
        React.createElement('div', { style: { textAlign: 'center', maxWidth: 1250 } },
          React.createElement('img', { src: 'assets/logo.svg', alt: 'Talaria Flow', width: 58, height: 64, style: { display: 'block', margin: '0 auto 40px', opacity: introA } }),
          React.createElement('div', { style: { fontFamily: mono, fontSize: 16, letterSpacing: '.18em', textTransform: 'uppercase', color: C.text3, marginBottom: 26 } }, ar ? 'دليل مصوّر' : 'Step-by-step guide'),
          React.createElement('div', {
            dir, style: {
              fontSize: 82, fontWeight: 800, lineHeight: ar ? 1.18 : 0.98, letterSpacing: ar ? '0' : '-0.035em',
              transform: `translateY(${mix(introA, 26, 0, Easing.easeOutCubic)}px)`
            }
          }, ar ? 'كيف تحصل على الدورة مجاناً' : 'How to get the course for free'),
          React.createElement('div', { dir, style: { marginTop: 30, fontSize: 29, lineHeight: 1.45, color: C.text2 } },
            ar ? 'أربع عشرة خطوة من فتح حساب NinjaTrader إلى رفع الإثبات. لا يلزم أي إيداع' : 'Fourteen steps, from opening your NinjaTrader account to uploading your proof. No deposit required.')
        )
      )
    ),

    /* outro */
    React.createElement(Shot, { from: CUES.Outro - 0.6, to: authoredTotal + 1 },
      React.createElement('div', {
        style: {
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: C.bg,
          opacity: clamp(animate({ from: 0, to: 1, start: CUES.Outro - 0.3, end: CUES.Outro + 0.35, ease: Easing.easeOutCubic })(T), 0, 1)
            * clamp(animate({ from: 1, to: 0, start: authoredTotal - 0.45, end: authoredTotal, ease: Easing.easeInQuad })(T), 0, 1)
        }
      },
        React.createElement('div', { style: { textAlign: 'center' } },
          React.createElement('div', { dir, style: { fontSize: 64, fontWeight: 800, lineHeight: ar ? 1.2 : 1.02, letterSpacing: ar ? '0' : '-0.03em' } },
            ar ? 'جاهز للبدء؟' : 'Ready to start?'),
          React.createElement('div', { dir, style: { marginTop: 24, fontSize: 27, color: C.text2 } },
            ar ? 'افتح حساب NinjaTrader عبر رابط شراكتنا ثم أنشئ حساب Talaria Flow' : 'Open your NinjaTrader account through our partner link, then create your Talaria Flow account.'),
          React.createElement('div', { style: { marginTop: 40, display: 'inline-flex', gap: 16 } },
            React.createElement('span', { dir, style: { display: 'inline-flex', alignItems: 'center', height: 60, padding: '0 30px', background: C.cyan, color: '#04141A', borderRadius: 12, fontSize: 21, fontWeight: 600, whiteSpace: 'nowrap' } },
              ar ? 'ابدأ مع NinjaTrader' : 'Start with NinjaTrader'),
            React.createElement('span', { dir, style: { display: 'inline-flex', alignItems: 'center', height: 60, padding: '0 30px', border: '1px solid ' + C.cyan, color: C.cyan, borderRadius: 12, fontSize: 21, fontWeight: 600, whiteSpace: 'nowrap' } },
              ar ? 'أنشئ حساب Talaria' : 'Create a Talaria account')
          ),
          React.createElement('div', { style: { marginTop: 44, fontFamily: mono, fontSize: 14, letterSpacing: '.14em', color: C.text4 } }, 'TALARIA-FLOW.COM')
        )
      )
    )
  );
}

function TutorialPiece(props) {
  return React.createElement(CompositionStage, {
    width: W, height: H, bg: C.bg,
    scenes: window.OM_SCENES, playback: window.OM_PLAYBACK
  }, React.createElement(Piece, { lang: props.lang || 'en' }));
}

window.TutorialPiece = TutorialPiece;
