// Talaria Flow — hero sequence, tick-driven.
// A deterministic tape of ~1,400 prints (time, price, size, side) is generated once. Every frame replays the
// prints up to the current time; candles, footprint cells, the volume profile, delta and the time & sales
// column are all derived from those prints — nothing is drawn that a tick didn't cause.
// Story: profile builds → zoom into the footprint → buyers hammer the ask and price won't lift (absorption)
// → big sells hit the bid → reversal, delta flips → loop.
export function mountHeroSequence(canvas, opts = {}) {
  const W = 600, H = 520, T = 27.6, SLOW = 2.1; // SLOW stretches the whole timeline (loop ≈ 58s)
  const REF = [[13, 'PRIOR HIGH'], [7, 'VWAP']]; // reference levels: the reversal fires at the prior high and targets VWAP
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || opts.static || opts.time != null;
  let raf = 0, start = performance.now();
  let elapsed = opts.elapsed != null ? opts.elapsed : (window.__tfHeroElapsed || 0);
  let paused = false;
  const container = canvas.parentElement || canvas;

  function fitCanvas(contentRect) {
    const box = contentRect || container.getBoundingClientRect();
    const width = box.width || 0;
    const height = box.height || 0;
    if (width < 2 || height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  const LV = 16, base = 21484.0, tk = 0.25;
  const ch = { l: 24, r: 356, t: 50, b: 464 }; // ch.r is a hard wall: nothing from the chart may cross it
  const prof = { l: 380, w: 62 }, axisX = 494, tape = { l: 508, r: 600 };
  const rh = (ch.b - ch.t) / LV;
  const N = 14, GAP = 36, cw = (ch.r - GAP - ch.l - 12) / N; // candles end GAP px before the wall at z=1
  const yOf = l => ch.b - (l + 0.5) * rh, xOf = i => ch.l + 6 + i * cw + cw / 2;
  const price = l => (base + l * tk).toFixed(2), short = l => price(l).slice(2);
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, k) => a + (b - a) * k;
  const fmt = n => n.toLocaleString('en-US');

  // ---- tape ----------------------------------------------------------
  let seed = 20260905; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  // [start, duration, fromLevel, toLevel, prints, mode]
  const SPEC = [
    [0.3, .8, 3, 4, 40], [1.1, .8, 4, 5, 40], [1.9, .8, 5, 4, 40], [2.7, .8, 4, 6, 44], [3.5, .8, 6, 7, 44], [4.3, .8, 7, 6, 40], [5.1, .8, 6, 8, 44], [5.9, .8, 8, 9, 46], [6.7, .8, 9, 10, 46], [7.5, .9, 10, 11, 50],
    [8.5, 1.6, 11, 12, 60],
    [10.2, 7.2, 12, 13, 150, 'absorb'],
    [17.5, 3.0, 13, 9, 150, 'dump'],
    [20.6, 2.2, 9, 7, 80, 'dump2'],
    [22.9, 2.6, 7, 7, 60]
  ];
  const ticks = [], bars = [];
  SPEC.forEach(([s0, d, from, to, n, mode], ci) => {
    let lv = Math.round(from), i0 = ticks.length;
    for (let k = 0; k < n; k++) {
      const p = k / n, ts = s0 + d * p + (rnd() - .5) * (d / n) * .8;
      let target = lerp(from, to, mode === 'absorb' ? Math.min(1, p * 2.2) : mode === 'dump' ? (p < .2 ? 0 : (p - .2) / .8) : p);
      target += (rnd() - .5) * 0.6;
      // price moves at most one tick per print, and most prints do not move it at all
      let dir = target > lv + .5 ? (rnd() < .45 ? 1 : 0) : target < lv - .5 ? (rnd() < .45 ? -1 : 0) : (rnd() < .12 ? (rnd() < .5 ? 1 : -1) : 0);
      if ((mode === 'dump' && p >= .2) || mode === 'dump2') dir = target < lv - .3 ? (rnd() < .85 ? -1 : 0) : (rnd() < .05 ? 1 : 0); // sharp sell-off, few upticks
      if (mode === 'absorb' && p > .45) dir = lv < 13 ? (rnd() < .4 ? 1 : 0) : (rnd() < .08 ? -1 : 0); // pinned at 13
      lv = Math.max(0, Math.min(LV - 1, Math.round(lv + dir)));
      if (mode === 'absorb' && lv > 13) lv = 13;
      let side = dir > 0 ? 1 : dir < 0 ? -1 : (rnd() < (to >= from ? .58 : .42) ? 1 : -1);
      let size = 1 + Math.floor(Math.pow(rnd(), 2.4) * 12);
      if (mode === 'absorb' && p > .45 && lv === 13) { side = rnd() < .8 ? 1 : -1; if (side === 1 && rnd() < .07) size = 80 + Math.floor(rnd() * 120); }
      if (mode === 'dump' && p < .2) { side = -1; if (rnd() < .18) size = 120 + Math.floor(rnd() * 180); }
      if ((mode === 'dump' && p >= .2) || mode === 'dump2') { side = rnd() < .85 ? -1 : 1; if (side === -1 && rnd() < .05) size = 60 + Math.floor(rnd() * 80); }
      ticks.push({ ts, lv, size, side, ci });
    }
    bars.push({ s0, i0, i1: ticks.length });
  });
  ticks.sort((a, b) => a.ts - b.ts);
  const big = ticks.filter(x => x.size >= 60);

  function replay(t) {
    const vol = new Array(LV).fill(0), cs = [], fp = [];
    let delta = 0, total = 0, last = null;
    for (let i = 0; i < ticks.length; i++) {
      const x = ticks[i]; if (x.ts > t) break;
      vol[x.lv] += x.size; total += x.size; delta += x.side * x.size; last = x;
      let c = cs[x.ci]; if (!c) { c = cs[x.ci] = { o: x.lv, c: x.lv, h: x.lv, l: x.lv, n: 0 }; fp[x.ci] = {}; }
      c.c = x.lv; c.h = Math.max(c.h, x.lv); c.l = Math.min(c.l, x.lv); c.n++;
      const cell = fp[x.ci][x.lv] || (fp[x.ci][x.lv] = [0, 0]); cell[x.side > 0 ? 1 : 0] += x.size;
    }
    return { vol, cs, fp, delta, total, last };
  }

  // ---- render ----------------------------------------------------------
  function draw(now) {
    const t = opts.time != null ? opts.time : still ? 16.2 : ((now - start) / 1000 / SLOW + elapsed) % T;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const sx = (canvas.width / dpr) / W;
    const sy = (canvas.height / dpr) / H;
    ctx.setTransform(dpr * sx, 0, 0, dpr * sy, 0, 0); ctx.clearRect(0, 0, W, H);
    const S = replay(t);
    const mono = s => `${s}px 'Geist Mono', monospace`;

    // camera: zoom on the last three candles
    // camera: zoom on the absorption candle, then pull back to show the full drop
    const zin = ease((t - 9.2) / 1.8), zout = ease((t - 17.3) / 2.2), zend = 1 - ease((t - 25.6) / 1.0);
    const zk = zin * (1 - zout * .8) * zend, fpReveal = zin * zend;
    const z = lerp(1, 2.7, zk);
    const sf = { x: ch.l + (ch.r - ch.l) * .5, y: (ch.t + ch.b) / 2 };
    // hard rule: the newest candle's right edge always stays ≥ 24px inside the wall; older candles slide off the left instead
    const lastIdx = Math.max(0, S.cs.length - 1);
    const minX = xOf(lastIdx) + cw * .5 - (ch.r - GAP - sf.x) / z;
    const wf = { x: Math.max(lerp(xOf(11.6), xOf(11.2), zout), minX), y: lerp(yOf(11.6), yOf(10.2), zout) };
    ctx.save(); ctx.beginPath(); ctx.rect(0, ch.t - 12, ch.r, ch.b - ch.t + 24); ctx.clip();
    ctx.translate(lerp(wf.x, sf.x, zk), lerp(wf.y, sf.y, zk)); ctx.scale(z, z); ctx.translate(-wf.x, -wf.y);

    // rules
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1 / z;
    for (let l = 0; l <= LV; l++) { const y = ch.b - l * rh; ctx.beginPath(); ctx.moveTo(ch.l - 400, y); ctx.lineTo(ch.r + 400, y); ctx.stroke(); }
    // reference levels
    REF.forEach(([l, name]) => { const y = yOf(l); ctx.setLineDash([4 / z, 4 / z]); ctx.strokeStyle = 'rgba(242,244,248,0.35)'; ctx.lineWidth = 1 / z; ctx.beginPath(); ctx.moveTo(ch.l - 400, y); ctx.lineTo(ch.r + 400, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#B7BCCB'; ctx.font = `${8.5 / z}px 'Geist Mono', monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(name, ch.l + 2, y - 2 / z); });

    // candles + footprint
    S.cs.forEach((c, i) => {
      if (!c) return;
      const up = c.c >= c.o, col = up ? '#2EE8FF' : '#FF37B0', x = xOf(i), bw = cw * .62;
      const fpk = i >= 9 ? fpReveal : 0;
      const yTop = yOf(Math.max(c.o, c.c)) - rh * .5, yBot = yOf(Math.min(c.o, c.c)) + rh * .5;
      // wick above and below the body only
      ctx.strokeStyle = col; ctx.lineWidth = 1.2 / z; ctx.globalAlpha = 1 - fpk * .5;
      ctx.beginPath(); ctx.moveTo(x, yOf(c.h) - rh * .5); ctx.lineTo(x, yTop); ctx.moveTo(x, yBot); ctx.lineTo(x, yOf(c.l) + rh * .5); ctx.stroke();
      if (fpk < .98) {
        ctx.globalAlpha = 1 - fpk;
        ctx.fillStyle = up ? '#0B3A44' : '#4A1034'; ctx.fillRect(x - bw / 2, yTop, bw, yBot - yTop); ctx.strokeRect(x - bw / 2, yTop, bw, yBot - yTop);
      }
      ctx.globalAlpha = 1;
      if (fpk > .02) {
        // footprint column: solid bid cell | thin candle | solid ask cell, per price
        const F = S.fp[i], colW = cw * .96, half = colW / 2, mid = 7 / z, cellW = half - mid, fs = z >= 2.4 ? 9.5 / z : 8.5 / z;
        let cvol = 0, cdelta = 0;
        for (let l = c.l; l <= c.h; l++) { const [b, a] = F[l] || [0, 0]; cvol += b + a; cdelta += a - b; }
        ctx.globalAlpha = fpk; ctx.textBaseline = 'middle'; ctx.font = mono(fs);
        for (let l = c.l; l <= c.h; l++) {
          const [b, a] = F[l] || [0, 0], y = yOf(l), y0 = y - rh / 2 + 0.5 / z, hh = rh - 1 / z;
          const askImb = F[l - 1] && a >= 3 * F[l - 1][0] && a >= 25, bidImb = F[l + 1] && b >= 3 * F[l + 1][1] && b >= 25;
          ctx.fillStyle = bidImb ? '#FF37B0' : '#3A0F2A'; ctx.fillRect(x - half, y0, cellW, hh);
          ctx.fillStyle = askImb ? '#2EE8FF' : '#0B3A44'; ctx.fillRect(x + mid, y0, cellW, hh);
          ctx.fillStyle = bidImb ? '#fff' : '#FF8AD0'; ctx.textAlign = 'right'; ctx.fillText(String(b), x - mid - 3 / z, y);
          ctx.fillStyle = askImb ? '#04141A' : '#8FF3FF'; ctx.textAlign = 'left'; ctx.fillText(String(a), x + mid + 3 / z, y);
        }
        // thin candle between the two cell columns
        ctx.fillStyle = col; ctx.fillRect(x - 1.5 / z, yTop, 3 / z, Math.max(1 / z, yBot - yTop));
        // candle delta + volume under the column
        const yb = yOf(c.l) + rh * .5 + 6 / z;
        ctx.font = `600 ${8.5 / z}px 'Geist Mono', monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = cdelta >= 0 ? '#2EE8FF' : '#FF37B0'; ctx.fillText((cdelta >= 0 ? '+' : '−') + Math.abs(cdelta), x, yb);
        ctx.fillStyle = '#8B90A3'; ctx.font = mono(8 / z); ctx.fillText(String(cvol), x, yb + 11 / z);
        ctx.globalAlpha = 1;
      }
    });

    // big prints: pulse ring + size tag + tick mark on the price axis, held for 3s
    big.forEach(p => {
      const k = (t - p.ts) / 3.0; if (k <= 0 || k > 1) return;
      const x = xOf(p.ci) + (p.side > 0 ? cw * .3 : -cw * .3), y = yOf(p.lv), col = p.side > 0 ? '#2EE8FF' : '#FF37B0';
      const pulse = (k * 3) % 1;
      ctx.strokeStyle = col; ctx.lineWidth = 2 / z; ctx.globalAlpha = (1 - pulse) * (1 - k * .5);
      ctx.beginPath(); ctx.arc(x, y, (6 + pulse * 30) / z, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1 - Math.max(0, (k - .8) / .2);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 4 / z, 0, Math.PI * 2); ctx.fill();
      const label = (p.side > 0 ? 'BUY ' : 'SELL ') + p.size, fs = 11 / z; ctx.font = `700 ${fs}px 'Geist Mono', monospace`;
      const tw = ctx.measureText(label).width + 12 / z, th = 18 / z, tx = p.side > 0 ? x + 12 / z : x - 12 / z - tw, ty = y - 30 / z;
      ctx.fillStyle = col; ctx.fillRect(tx, ty, tw, th);
      ctx.beginPath(); ctx.moveTo(x, y - 6 / z); ctx.lineTo(p.side > 0 ? tx : tx + tw, ty + th); ctx.strokeStyle = col; ctx.lineWidth = 1.5 / z; ctx.stroke();
      ctx.fillStyle = '#04141A'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, tx + 6 / z, ty + th / 2);
      ctx.globalAlpha = 1;
    });

    // trade: short at the reversal (t=17.8) — entry 13, stop 15 (above the prior high), target 7 (VWAP). Lines are world-space, labels screen-space.
    const TRADE = { t0: 17.8, entry: 13, stop: 14, tp: 7 };
    const tk1 = ease((t - TRADE.t0) / .6) * (1 - ease((t - 26.4) / .6));
    const hitTp = S.last && t > TRADE.t0 && S.last.lv <= TRADE.tp && t > 20.6;
    if (tk1 > 0) {
      const x0 = xOf(11) + cw * .5;
      const zone = (l1, l2, fill) => { ctx.fillStyle = fill; ctx.fillRect(x0, yOf(Math.max(l1, l2)) - rh / 2, ch.r + 400 - x0, Math.abs(l1 - l2) * rh + rh); };
      ctx.globalAlpha = tk1 * (hitTp ? .45 : 1);
      zone(TRADE.entry, TRADE.stop, 'rgba(255,55,176,0.10)');
      zone(TRADE.entry, TRADE.tp, 'rgba(46,232,255,0.08)');
      const line = (l, col, dash) => { ctx.setLineDash(dash ? [5 / z, 4 / z] : []); ctx.strokeStyle = col; ctx.lineWidth = 1.2 / z; ctx.beginPath(); ctx.moveTo(x0, yOf(l)); ctx.lineTo(ch.r + 400, yOf(l)); ctx.stroke(); ctx.setLineDash([]); };
      line(TRADE.stop, '#FF37B0', true); line(TRADE.entry, '#F2F4F8', false); line(TRADE.tp, '#2EE8FF', true);
      // entry marker
      ctx.fillStyle = '#F2F4F8'; ctx.beginPath(); ctx.moveTo(x0, yOf(TRADE.entry) - 5 / z); ctx.lineTo(x0 + 6 / z, yOf(TRADE.entry)); ctx.lineTo(x0, yOf(TRADE.entry) + 5 / z); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // last price line
    if (S.last) {
      const y = yOf(S.last.lv), col = S.last.side > 0 ? '#2EE8FF' : '#FF37B0';
      ctx.setLineDash([3 / z, 4 / z]); ctx.strokeStyle = col; ctx.globalAlpha = .5; ctx.lineWidth = 1 / z;
      ctx.beginPath(); ctx.moveTo(xOf(S.last.ci) + cw * .4, y); ctx.lineTo(ch.r + 400, y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    ctx.restore();

    // volume profile: fixed column in screen space, rows follow the camera
    const toScreenY = y => lerp(wf.y, sf.y, zk) + (y - wf.y) * z, rhS = rh * z;
    const vmax = Math.max(...S.vol, 1), poc = S.vol.indexOf(Math.max(...S.vol));
    ctx.save(); ctx.beginPath(); ctx.rect(prof.l - 2, ch.t - 12, prof.w + 4, ch.b - ch.t + 24); ctx.clip();
    for (let l = 0; l < LV; l++) { if (!S.vol[l]) continue; const y = toScreenY(yOf(l)); const w = (S.vol[l] / vmax) * prof.w; ctx.fillStyle = l === poc ? 'rgba(255,55,176,0.6)' : 'rgba(255,255,255,0.12)'; ctx.fillRect(prof.l, y - rhS * .36, w, rhS * .72); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(prof.l - 4, ch.t - 12, 1, ch.b - ch.t + 24);

    // price axis (screen space, follows camera)
    ctx.font = mono(10); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (let l = 0; l < LV; l++) { const y = toScreenY(yOf(l)); if (y < ch.t - 4 || y > ch.b + 4) continue; if (z < 1.4 && l % 2) continue; ctx.fillStyle = '#7C8296'; ctx.fillText(short(l), axisX - 50, y); }
    if (S.last) { const y = toScreenY(yOf(S.last.lv)), col = S.last.side > 0 ? '#2EE8FF' : '#FF37B0'; ctx.fillStyle = col; ctx.fillRect(axisX - 54, y - 8, 52, 16); ctx.fillStyle = '#04141A'; ctx.font = `600 ${10}px 'Geist Mono', monospace`; ctx.fillText(short(S.last.lv), axisX - 50, y); }

    // time & sales
    ctx.fillStyle = '#7C8296'; ctx.font = mono(9.5); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('TIME & SALES', tape.l, ch.t - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(tape.l, ch.t + 4, tape.r - tape.l, 1);
    let shown = 0;
    for (let i = ticks.length - 1; i >= 0 && shown < 22; i--) {
      const x = ticks[i]; if (x.ts > t) continue;
      const y = ch.t + 20 + shown * 19, age = Math.min(1, (t - x.ts) / .6), bigp = x.size >= 45;
      ctx.globalAlpha = .35 + .65 * (1 - shown / 22) + (1 - age) * .3; ctx.textBaseline = 'middle';
      ctx.fillStyle = x.side > 0 ? '#2EE8FF' : '#FF37B0'; ctx.fillRect(tape.l, y - 3, 3, 6);
      ctx.fillStyle = bigp ? '#fff' : '#B7BCCB'; ctx.font = bigp ? `700 ${9.5}px 'Geist Mono', monospace` : mono(9.5); ctx.textAlign = 'left'; ctx.fillText(short(x.lv), tape.l + 9, y);
      ctx.textAlign = 'right'; ctx.fillStyle = bigp ? '#fff' : x.side > 0 ? '#8FF3FF' : '#FF8AD0'; ctx.fillText(String(x.size), tape.r, y);
      shown++;
    }
    ctx.globalAlpha = 1;

    // trade labels on the axis side (screen space)
    if (tk1 > 0) {
      ctx.globalAlpha = tk1; ctx.font = `600 9px 'Geist Mono', monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      const tag = (l, txt, col, ink) => { const y = toScreenY(yOf(l)); if (y < ch.t - 6 || y > ch.b + 6) return; const w = ctx.measureText(txt).width + 10; ctx.fillStyle = col; ctx.fillRect(ch.r - w, y - 7, w, 14); ctx.fillStyle = ink; ctx.fillText(txt, ch.r - 5, y); };
      tag(TRADE.stop, 'STOP ' + short(TRADE.stop), '#FF37B0', '#fff');
      tag(TRADE.entry, 'SHORT ' + short(TRADE.entry), '#F2F4F8', '#07080C');
      tag(TRADE.tp, (hitTp ? 'TP HIT ' : 'TP ') + short(TRADE.tp), '#2EE8FF', '#04141A');
      // running P&L in ticks
      if (S.last) {
        const pnl = TRADE.entry - S.last.lv, r = (TRADE.entry - TRADE.tp) / (TRADE.stop - TRADE.entry);
        ctx.textAlign = 'left'; ctx.font = mono(9.5);
        ctx.fillStyle = '#8B90A3'; ctx.fillText('P&L', ch.l, ch.t - 14 + 40);
        ctx.fillStyle = pnl >= 0 ? '#2EE8FF' : '#FF37B0'; ctx.font = `700 11px 'Geist Mono', monospace`; ctx.fillText((pnl >= 0 ? '+' : '−') + Math.abs(pnl) + ' ticks', ch.l + 26, ch.t - 14 + 40);
        ctx.fillStyle = '#8B90A3'; ctx.font = mono(9.5); ctx.fillText('R ' + r.toFixed(0) + ':1', ch.l + 96, ch.t - 14 + 40);
      }
      ctx.globalAlpha = 1;
    }

    // caption: step index + title on one line, description underneath, with a progress rule
    const caps = [[0.2, 8.4, 'Volume profile', 'Every print adds to the profile'], [9.4, 12.6, 'Footprint', 'Bid × ask at each price, live'], [12.8, 17.2, 'Absorption', 'Buyers lift the ask at the prior high, price will not move'], [17.6, 25.4, 'Reversal trade', 'Short at the prior high, stop above it, target VWAP']];
    caps.forEach(([a, b, h, s], i) => {
      const k = Math.min(ease((t - a) / .5), 1 - ease((t - b + .4) / .4)); if (k <= 0) return;
      const prog = Math.max(0, Math.min(1, (t - a) / (b - a)));
      ctx.globalAlpha = k; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#FF37B0'; ctx.font = mono(10); ctx.fillText('0' + (i + 1), 24, 18);
      ctx.fillStyle = '#F2F4F8'; ctx.font = "600 15px 'Archivo', sans-serif"; ctx.fillText(h, 48, 18);
      ctx.fillStyle = '#8B90A3'; ctx.font = mono(9.5); ctx.fillText(s.toUpperCase(), 48, 31);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(24, 36, 200, 1);
      ctx.fillStyle = '#2EE8FF'; ctx.fillRect(24, 36, 200 * prog, 1);
      ctx.globalAlpha = 1;
    });

    // footer readout
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(24, H - 36, W - 48, 1);
    ctx.textBaseline = 'middle'; ctx.font = mono(10.5); ctx.textAlign = 'left';
    const items = [['DELTA', (S.delta >= 0 ? '+' : '−') + fmt(Math.abs(S.delta)), S.delta >= 0 ? '#2EE8FF' : '#FF37B0'], ['VOLUME', fmt(S.total), '#F2F4F8'], ['PRINTS', fmt(S.cs.reduce((a, c) => a + (c ? c.n : 0), 0)), '#F2F4F8']];
    let x = 24; items.forEach(([k, v, col]) => { ctx.fillStyle = '#8B90A3'; ctx.fillText(k, x, H - 18); x += ctx.measureText(k).width + 8; ctx.fillStyle = col; ctx.fillText(v, x, H - 18); x += ctx.measureText(v).width + 26; });
    ctx.fillStyle = '#8B90A3'; ctx.textAlign = 'right'; ctx.fillText(opts.caption || 'ILLUSTRATIVE', W - 24, H - 18);

    const fade = ease((t - 26.9) / .6) + (1 - ease(t / .5));
    if (fade > 0) { ctx.fillStyle = `rgba(7,8,12,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); }
    if (!still) raf = requestAnimationFrame(draw);
  }
  function pause() {
    if (paused || still || opts.time != null) return;
    elapsed = ((performance.now() - start) / 1000 / SLOW + elapsed) % T;
    window.__tfHeroElapsed = elapsed;
    paused = true;
    cancelAnimationFrame(raf);
    raf = 0;
  }
  function resume() {
    if (!paused || still || opts.time != null) return;
    paused = false;
    start = performance.now();
    raf = requestAnimationFrame(draw);
  }
  function onVis() {
    if (document.hidden) pause();
    else resume();
  }
  document.addEventListener('visibilitychange', onVis);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (entries) {
    const e = entries && entries[0];
    if (!e) return;
    fitCanvas(e.contentRect);
    if (still || paused || opts.time != null) draw(performance.now());
  }) : null;
  if (ro) ro.observe(container);
  window.addEventListener('resize', function () { fitCanvas(); });
  fitCanvas();
  if (opts.time != null) { draw(start); return { pause: function () {}, resume: function () {}, destroy: function () { if (ro) ro.disconnect(); window.removeEventListener('resize', fitCanvas); } }; }
  raf = requestAnimationFrame(draw);
  return {
    pause: pause,
    resume: resume,
    destroy: function () {
      pause();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', fitCanvas);
      if (ro) ro.disconnect();
    },
  };
}
