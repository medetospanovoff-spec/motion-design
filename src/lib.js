// Deterministic motion toolkit: everything is a pure function of time `t`.
const W = 1080, H = 1920;
const C = {
  navy: '#0C1222', navy2: '#141C33', ink: '#0B0F1A', orange: '#FF4D17', paper: '#D6DDE7',
  blue: '#2E3CFF', white: '#F4F6FA', red: '#FF2E2E', mute: '#8A93A6', yellow: '#FFD23F',
};

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  lin: t => t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  outBounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};
// eased progress from t0 over dur
const pin = (t, t0, dur = 0.3, ease = E.outExpo) => ease(prog(t, t0, t0 + dur));
const on = (t, a, b = Infinity) => t >= a && t < b;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const up = s => s.toLocaleUpperCase('kk');

// decaying spikes after each event time -> camera punch / shake
function punch(t, times, amp = 0.06, dur = 0.35) {
  let v = 0;
  for (const t0 of times) if (t >= t0 && t < t0 + dur) v += amp * Math.pow(1 - (t - t0) / dur, 2.2);
  return v;
}
function shake(t, times, amp = 14, dur = 0.3) {
  let x = 0, y = 0;
  for (const t0 of times) if (t >= t0 && t < t0 + dur) {
    const k = Math.pow(1 - (t - t0) / dur, 2) * amp;
    x += Math.sin(t * 91.3 + t0) * k; y += Math.cos(t * 77.1 + t0 * 3) * k;
  }
  return [x, y];
}

function el(tag, cls, parent, style = {}, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  Object.assign(e.style, style);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const div = (parent, cls, style, text) => el('div', cls, parent, style, text);

function svg(parent, w, h, inner, style = {}) {
  const wrap = div(parent, 'a', { width: w + 'px', height: h + 'px', ...style });
  wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">${inner}</svg>`;
  return wrap;
}

// Place an element so that its anchor (ax, ay) sits at (x, y).
function place(e, x, y, o = {}) {
  const { s = 1, sx = 1, sy = 1, r = 0, ax = 0.5, ay = 0.5, op = 1, blur = 0, skx = 0 } = o;
  e.style.transform = `translate(${x}px,${y}px) translate(${-ax * 100}%,${-ay * 100}%) rotate(${r}deg) skewX(${skx}deg) scale(${s * sx},${s * sy})`;
  e.style.transformOrigin = `${ax * 100}% ${ay * 100}%`;
  e.style.opacity = op;
  e.style.filter = blur > 0.3 ? `blur(${blur}px)` : '';
  e.style.visibility = op <= 0.001 ? 'hidden' : 'visible';
}
const show = (e, v) => { e.style.display = v ? '' : 'none'; };

// Text block helper. Returns the element; size is in px.
function txt(parent, text, o = {}) {
  const { cls = 'head', size = 120, color = C.white, ls, stroke, weight, extra = {} } = o;
  const e = div(parent, 'a ' + cls, { fontSize: size + 'px', color, ...extra }, text);
  if (ls != null) e.style.letterSpacing = ls;
  if (weight) e.style.fontWeight = weight;
  if (stroke) { e.style.webkitTextStroke = stroke; e.style.color = 'transparent'; }
  return e;
}
// Shrink font so the element is at most maxW wide (call after fonts are loaded).
function fit(e, maxW, maxSize) {
  e.style.fontSize = maxSize + 'px';
  const w = e.scrollWidth;
  if (w > maxW) e.style.fontSize = (maxSize * maxW / w).toFixed(1) + 'px';
  return parseFloat(e.style.fontSize);
}
// Wrap characters into spans for per-letter animation.
function chars(e) {
  const s = e.textContent; e.textContent = '';
  return [...s].map(c => el('span', 'ch', e, {}, c));
}
function animChars(spans, t, t0, stagger, fn) {
  spans.forEach((sp, i) => {
    const p = prog(t, t0 + i * stagger, t0 + i * stagger + 0.32);
    fn(sp, p, i);
  });
}
// Typewriter: show n characters, optional cursor.
function typeText(e, full, t, t0, cps, cursor = true, cursorColor = C.red) {
  const n = Math.floor(clamp((t - t0) * cps, 0, full.length));
  const blink = cursor && (n < full.length || Math.floor(t * 2.6) % 2 === 0);
  e.innerHTML = '';
  e.appendChild(document.createTextNode(full.slice(0, n)));
  if (cursor && t >= t0 - 0.3) el('span', '', e, { display: 'inline-block', width: '0.12em', height: '0.95em',
    background: cursorColor, marginLeft: '0.08em', verticalAlign: '-0.12em', opacity: blink ? 1 : 0 });
  return n;
}

// Smooth pseudo-random flow field (stateless, so any frame renders identically).
function flowAngle(x, y, t) {
  return Math.sin(x * 0.0042 + t * 0.55) * 1.8 + Math.cos(y * 0.0031 - t * 0.42) * 2.0 +
    Math.sin((x + y) * 0.0021 + t * 0.3) * 1.3 + Math.cos((x - y) * 0.0017 - t * 0.2) * 0.9;
}
function drawFlow(ctx, t, o = {}) {
  const { n = 900, steps = 26, step = 9, colors = ['#4A5BFF', '#8C7BFF', '#FF6A3D', '#C9D2FF'], alpha = 0.55, width = 1.6, seed = 1 } = o;
  ctx.clearRect(0, 0, W, H);
  ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    let x = hash(i * 1.37 + seed) * (W + 200) - 100, y = hash(i * 2.91 + seed * 7) * (H + 200) - 100;
    const col = colors[i % colors.length];
    ctx.strokeStyle = col;
    ctx.globalAlpha = alpha * (0.35 + 0.65 * hash(i * 5.3 + seed));
    ctx.beginPath(); ctx.moveTo(x, y);
    const drift = t * 40;
    for (let s = 0; s < steps; s++) {
      const a = flowAngle(x + drift, y, t);
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function canvas(parent, style = {}) {
  const c = el('canvas', '', parent, { width: W + 'px', height: H + 'px', ...style });
  c.width = W; c.height = H;
  return c;
}

// A tiny procedural "reel" thumbnail used as a showcase element.
function miniReel(parent, v, w = 300, h = 533) {
  const bgs = [C.navy, C.blue, C.white, C.orange];
  const fgs = [C.orange, C.white, C.navy, C.ink];
  const words = ['AI', 'REELS', 'ПРОМПТ', 'ВИДЕО'];
  const root = div(parent, 'a', { width: w + 'px', height: h + 'px', borderRadius: '30px', overflow: 'hidden',
    background: bgs[v % 4], boxShadow: '0 30px 60px rgba(0,0,0,0.35)', border: '3px solid rgba(255,255,255,0.18)' });
  const word = txt(root, words[v % 4], { size: 120, color: fgs[v % 4] });
  const bar = div(root, 'a', { width: (w - 60) + 'px', height: '10px', borderRadius: '5px', background: fgs[v % 4], opacity: 0.35 });
  const fill = div(bar, '', { height: '100%', width: '0%', background: fgs[v % 4], borderRadius: '5px' });
  const circ = div(root, 'a', { width: '90px', height: '90px', borderRadius: '50%', border: `10px solid ${fgs[v % 4]}`, boxSizing: 'border-box' });
  const lines = [0, 1, 2].map(i => div(root, 'a', { height: '14px', borderRadius: '7px', background: fgs[v % 4], opacity: 0.5, width: (w - 90 - i * 50) + 'px' }));
  let fitted = false;
  return {
    root,
    update(t) {
      if (!fitted) { fit(word, w - 50, 130); fitted = true; }
      place(word, w / 2, h * 0.42 + Math.sin(t * 3 + v) * 10, { s: 1 + 0.05 * Math.sin(t * 4 + v) });
      place(bar, w / 2, h * 0.86);
      fill.style.width = ((t * 0.45 + v * 0.23) % 1 * 100).toFixed(1) + '%';
      place(circ, w * 0.78, h * 0.16, { s: 0.6 + 0.4 * Math.abs(Math.sin(t * 2.4 + v)) });
      lines.forEach((l, i) => place(l, 30, h * 0.6 + i * 32, { ax: 0, sx: 0.4 + 0.6 * Math.abs(Math.sin(t * 1.7 + i + v)) }));
    },
  };
}
