// Scene library. Each scene: build(s) once, layout(s) after fonts load,
// update(s, t) per frame (returns HUD ink colour), cues(s) -> sound-effect events.
const ws = (s, i) => s.data.words[Math.min(i, s.data.words.length - 1)].start;
const we = (s, i) => s.data.words[Math.min(i, s.data.words.length - 1)].end;

const SCENES = {};

// ============================== 1. HOOK ==============================
SCENES.hook = {
  build(s) {
    const c = s.cam, st = s.state;
    st.bg = div(c, 'layer');
    st.cards = [0, 1, 2].map(v => miniReel(c, [3, 0, 1][v]));
    st.label = txt(c, '', { cls: 'mono', size: 24, color: C.ink });
    // seg0: МҰНДАЙ
    st.w0 = txt(c, 'МҰНДАЙ', { size: 330, color: C.ink });
    // seg1: ВИДЕОЛАРДЫ
    st.rows = [0, 1, 2, 3, 4, 5, 6, 7].map(i => txt(c, 'ВИДЕО ВИДЕО ВИДЕО ВИДЕО ВИДЕО', { size: 230, stroke: '2px rgba(255,255,255,0.10)' }));
    st.w1a = txt(c, 'МҰНДАЙ', { size: 150, stroke: '3px #F4F6FA' });
    st.w1 = txt(c, 'ВИДЕОЛАРДЫ', { size: 230, color: C.white });
    st.w1ch = chars(st.w1);
    st.w1bar = div(c, 'a', { width: '900px', height: '22px', background: C.orange });
    // seg2: ӨЗІҢ
    st.rays = svg(c, 1800, 1800, Array.from({ length: 24 }, (_, i) =>
      `<path d="M900 900 L${900 + 1300 * Math.cos(i / 24 * 6.283 - 0.06)} ${900 + 1300 * Math.sin(i / 24 * 6.283 - 0.06)} L${900 + 1300 * Math.cos(i / 24 * 6.283 + 0.06)} ${900 + 1300 * Math.sin(i / 24 * 6.283 + 0.06)}Z" fill="rgba(255,255,255,0.07)"/>`).join(''));
    st.w2 = txt(c, 'ӨЗІҢ', { size: 560, color: C.white, extra: { textShadow: `18px 18px 0 ${C.orange}` } });
    // seg3: final stacked poster
    st.L = [
      txt(c, 'МҰНДАЙ', { size: 300, color: C.ink }),
      txt(c, 'ВИДЕОЛАРДЫ', { size: 200, color: C.ink }),
      txt(c, 'ӨЗІҢ ЖАСАЙ', { size: 200, color: C.ink }),
    ];
    st.box = div(c, 'a', { background: C.ink, borderRadius: '6px' });
    st.L4 = txt(c, 'АЛАСЫҢ!', { size: 260, color: C.orange });
    st.tag = txt(c, 'бір ғана промптпен', { cls: 'serif', size: 64, color: C.ink, extra: { lineHeight: 1.1 } });
  },
  layout(s) {
    const st = s.state;
    fit(st.w0, 920, 340); fit(st.w1, 920, 260); fit(st.w2, 900, 600);
    st.Lsz = st.L.map((e, i) => fit(e, 900, [320, 230, 230][i]));
    st.L4sz = fit(st.L4, 800, 300);
  },
  update(s, t) {
    const st = s.state, d = s.data, T0 = d.start, T1 = d.end;
    const w1 = ws(s, 1), w2 = ws(s, 2), w3 = ws(s, 3), w4 = ws(s, 4);
    const seg = t < w1 - 0.05 ? 0 : t < w2 - 0.04 ? 1 : t < w3 - 0.04 ? 2 : 3;
    const bgc = [C.orange, C.navy, C.blue, C.orange][seg];
    st.bg.style.background = bgc;

    // camera: punches on every word + zoom-through exit
    const hits = [ws(s, 0), w1, w2, w3, w4].map(x => x - 0.04);
    const exit = E.inExpo(prog(t, T1 - 0.26, T1));
    const [shx, shy] = shake(t, [hits[0], hits[2], hits[4]], 16);
    const camS = 1 + punch(t, hits, 0.07) + (seg === 3 ? 0.05 * prog(t, w3, T1 - 0.26) : 0) + exit * 5;
    place(s.cam, 540 + shx, 960 + shy, { s: camS, blur: exit * 30 });
    s.cam.style.transformOrigin = '50% 52%';

    // showcase reels (orange segments)
    const cardPos = [[205, 1560, -14], [880, 1520, 12], [545, 1700, -3]];
    st.cards.forEach((cd, i) => {
      const vis = seg === 0 || seg === 3;
      const pin0 = 0.45 + 0.55 * pin(t, T0 + i * 0.05, 0.4, E.outCubic);
      const p3 = seg === 3 ? pin(t, w3 - 0.04 + i * 0.06, 0.45, E.outBack) : 1;
      const [x, y, r] = cardPos[i];
      place(cd.root, x, y + (1 - pin0) * 900 + (1 - p3) * 500 + (seg === 3 ? 170 : 0) - (t - T0) * 30, { r: r + (1 - pin0) * 25 + Math.sin(t * 1.3 + i) * 2, s: seg === 3 ? 0.78 : 0.95, op: vis ? 1 : 0 });
      cd.update(t);
    });

    // top label
    typeText(st.label, 'AI · БІР ПРОМПТ · МОНТАЖСЫЗ', t, T0 + 0.05, 45, true, seg === 1 || seg === 2 ? C.orange : C.ink);
    st.label.style.color = seg === 1 || seg === 2 ? C.white : C.ink;
    place(st.label, 540, 330);

    // seg 0
    const p0 = 0.35 + 0.65 * pin(t, T0, 0.2);
    place(st.w0, 540, 860, { s: 1.7 - 0.7 * p0, blur: (1 - p0) * 14, op: seg === 0 ? clamp(p0 * 3) : 0 });

    // seg 1
    st.rows.forEach((r, i) => place(r, 540 + ((i % 2 ? 1 : -1) * (t - w1) * 260) + (i % 2 ? -200 : 200), 260 + i * 205, { op: seg === 1 ? 1 : 0 }));
    place(st.w1a, 540, 640, { op: seg === 1 ? 1 : 0, s: 1 + 0.08 * (1 - pin(t, w1, 0.3)) });
    place(st.w1, 540, 840, { op: seg === 1 ? 1 : 0 });
    animChars(st.w1ch, t, w1 - 0.05, 0.022, (sp, p) => {
      const e = E.outExpo(p);
      sp.style.transform = `translateY(${(1 - e) * 140}px) rotate(${(1 - e) * 12}deg)`;
      sp.style.opacity = clamp(p * 3);
    });
    place(st.w1bar, 90, 980, { ax: 0, sx: pin(t, w1 + 0.1, 0.4, E.outCubic), op: seg === 1 ? 1 : 0 });

    // seg 2
    const p2 = pin(t, w2 - 0.04, 0.35, E.outBack);
    place(st.rays, 540, 880, { r: (t - w2) * 40, op: seg === 2 ? 1 : 0 });
    place(st.w2, 540, 880, { s: 0.55 + 0.45 * p2, op: seg === 2 ? 1 : 0 });

    // seg 3 — stacked poster
    const vis3 = seg === 3 ? 1 : 0;
    const lh = st.Lsz.map(x => x * 0.86);
    const total = lh.reduce((a, b) => a + b, 0) + st.L4sz * 0.86 + 70;
    let y = 860 - total / 2 + 30;
    st.L.forEach((e, i) => {
      const p = pin(t, w3 - 0.04 + i * 0.05, 0.3);
      place(e, 540 + (i % 2 ? 1 : -1) * (1 - p) * 700, y + lh[i] / 2, { op: vis3 });
      y += lh[i] + 6;
    });
    const pb = pin(t, w4 - 0.08, 0.2, E.outCubic);
    const pl = pin(t, w4 - 0.02, 0.32, E.outBack);
    const boxH = st.L4sz * 0.86 + 50;
    place(st.box, 540, y + 24 + boxH / 2, { op: vis3, sx: pb });
    st.box.style.width = '940px'; st.box.style.height = boxH + 'px';
    place(st.L4, 540, y + 24 + boxH / 2 + 6, { op: vis3 * clamp(pl * 2), s: 0.6 + 0.4 * pl });
    place(st.tag, 540, y + boxH + 85, { op: vis3 * pin(t, w4 + 0.35, 0.3, E.lin) });

    return seg === 0 || seg === 3 ? C.ink : C.white;
  },
  cues(s) {
    const d = s.data;
    return [
      { t: 0, type: 'impact', gain: 1.0 },
      { t: ws(s, 0) - 0.04, type: 'pop', gain: 0.8 },
      { t: ws(s, 1) - 0.12, type: 'whoosh', dur: 0.18, gain: 0.7 },
      { t: ws(s, 2) - 0.04, type: 'impact', gain: 0.9 },
      { t: ws(s, 3) - 0.1, type: 'whoosh', dur: 0.15, gain: 0.6 },
      { t: ws(s, 4) - 0.06, type: 'impact', gain: 0.8 },
      { t: d.start + 0.05, t1: d.start + 0.65, type: 'type', gain: 0.35 },
      { t: d.end - 0.42, type: 'whoosh', dur: 0.42, gain: 0.9, rise: true },
    ];
  },
};

// ============================== 2. PROBLEM ==============================
function appWindow(parent, kind, title) {
  const w = div(parent, 'win', { width: '820px', height: '470px' });
  const bar = div(w, 'win-bar');
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach(col => el('span', 'dot', bar, { background: col }));
  el('span', '', bar, { marginLeft: '14px' }, title);
  const body = div(w, '', { position: 'relative', height: '416px' });
  const parts = {};
  if (kind === 0) { // timeline editor
    parts.clips = [];
    const cols = [C.orange, C.blue, '#7A8BFF', '#FFB347', C.navy];
    for (let r = 0; r < 4; r++) {
      div(body, 'a', { width: '780px', height: '56px', background: '#E9EDF4', borderRadius: '8px', transform: `translate(20px,${120 + r * 70}px)` });
      for (let k = 0; k < 4; k++) {
        const wd = 80 + hash(r * 9 + k) * 120;
        parts.clips.push(div(body, 'a', { width: wd + 'px', height: '48px', background: cols[(r + k) % 5], borderRadius: '7px',
          transform: `translate(${30 + k * 190 + hash(r + k * 3) * 30}px,${124 + r * 70}px)` }));
      }
    }
    div(body, 'a', { width: '780px', height: '80px', background: '#1B2236', borderRadius: '10px', transform: 'translate(20px,20px)' });
    parts.head = div(body, 'a', { width: '4px', height: '310px', background: C.red, transform: 'translate(300px,100px)' });
  } else if (kind === 1) { // keyframe graph
    parts.svg = svg(body, 820, 416, `
      <g stroke="#D4DAE5" stroke-width="2">${Array.from({ length: 9 }, (_, i) => `<line x1="${40 + i * 92}" y1="20" x2="${40 + i * 92}" y2="396"/>`).join('')}</g>
      <path d="M40 360 C 220 360, 260 60, 420 80 S 640 340, 790 120" fill="none" stroke="${C.blue}" stroke-width="7"/>
      <path d="M40 300 C 200 120, 360 380, 520 260 S 700 60, 790 200" fill="none" stroke="${C.orange}" stroke-width="5" stroke-dasharray="14 10"/>
      ${[[40, 360], [420, 80], [790, 120], [520, 260]].map(([x, y]) => `<rect x="${x - 12}" y="${y - 12}" width="24" height="24" transform="rotate(45 ${x} ${y})" fill="${C.ink}"/>`).join('')}`);
  } else { // audio
    parts.bars = Array.from({ length: 46 }, (_, i) => div(body, 'a', { width: '10px', borderRadius: '5px', background: i % 7 === 0 ? C.orange : C.navy }));
  }
  return { root: w, parts, kind };
}

SCENES.problem = {
  captions: true,
  flashIn: 0.9,
  build(s) {
    const c = s.cam, st = s.state;
    st.bg = div(c, 'layer', { background: C.paper });
    st.grid = svg(c, 1080, 1920, Array.from({ length: 13 }, (_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90}" y2="1920" stroke="rgba(12,18,34,0.05)" stroke-width="2"/>`).join(''));
    st.label = txt(c, '', { cls: 'mono', size: 26, color: C.navy });
    st.title = txt(c, 'БҰРЫН', { size: 330, color: C.navy });
    st.titleCh = chars(st.title);
    st.line = div(c, 'a', { width: '900px', height: '4px', background: C.navy });
    st.sub = txt(c, 'видео жасау қалай еді?', { cls: 'serif', size: 60, color: C.navy });
    st.wins = [appWindow(c, 0, 'МОНТАЖ'), appWindow(c, 1, 'АНИМАЦИЯ'), appWindow(c, 2, 'ДЫБЫС')];
    st.pill = div(c, 'a sans', { background: C.orange, color: C.ink, fontWeight: 900, fontSize: '44px', padding: '18px 34px', borderRadius: '60px' }, 'БІРНЕШЕ БАҒДАРЛАМА');
    // P3 — experience
    st.t3a = txt(c, 'МОНТАЖ', { size: 230, color: C.navy });
    st.t3b = txt(c, 'ТӘЖІРИБЕСІ', { size: 230, color: C.navy });
    st.tl = appWindow(c, 0, 'ТАЙМЛАЙН');
    st.meterLbl = txt(c, 'ДЕҢГЕЙ', { cls: 'mono', size: 24, color: C.navy });
    st.meterVal = txt(c, 'ЖЫЛДАР', { cls: 'mono', size: 24, color: C.red });
    st.segs = Array.from({ length: 12 }, () => div(c, 'a', { width: '58px', height: '30px', borderRadius: '6px', background: C.navy }));
    // P4 — time
    st.t4 = txt(c, 'КӨП УАҚЫТ', { size: 250, color: C.red });
    st.clock = svg(c, 150, 150, `<circle cx="75" cy="75" r="62" fill="none" stroke="${C.navy}" stroke-width="9"/><line id="hand" x1="75" y1="75" x2="75" y2="28" stroke="${C.navy}" stroke-width="9" stroke-linecap="round"/><circle cx="75" cy="75" r="9" fill="${C.navy}"/>`);
    st.hand = st.clock.querySelector('#hand');
    st.timer = txt(c, '0:00:00', { size: 280, color: C.navy, extra: { fontVariantNumeric: 'tabular-nums' } });
    st.tbar = div(c, 'a', { width: '900px', height: '20px', background: 'rgba(12,18,34,0.15)', borderRadius: '4px' });
    st.tfill = div(st.tbar, '', { height: '100%', width: '0%', background: C.navy, borderRadius: '4px' });
    st.tlbl = txt(c, 'БІР РОЛИКТІ МОНТАЖДАУ', { cls: 'mono', size: 24, color: C.navy });
    st.strike = div(c, 'a', { width: '980px', height: '18px', background: C.red });
  },
  layout(s) {
    const st = s.state;
    fit(st.title, 900, 360); fit(st.t3a, 900, 200); fit(st.t3b, 900, 200); fit(st.t4, 900, 260);
  },
  update(s, t) {
    const st = s.state, d = s.data, T0 = d.start, T1 = d.end;
    const w5 = ws(s, 5), w7 = ws(s, 7), w9 = ws(s, 9);
    const ph = t < w5 - 0.05 ? 1 : t < w7 - 0.06 ? 2 : t < w9 - 0.06 ? 3 : 4;
    const hits = [T0, w5 - 0.05, w7 - 0.06, w9 - 0.06];
    const glitch = prog(t, T1 - 0.22, T1);
    const [gx] = shake(t, [T1 - 0.22], 40, 0.22);
    place(s.cam, 540 + gx, 960, { s: 1 + punch(t, hits, 0.05) + 0.12 * (1 - pin(t, T0, 0.35)) });
    s.cam.style.filter = glitch > 0 ? `drop-shadow(${12 * glitch}px 0 0 rgba(255,40,40,0.8)) drop-shadow(${-12 * glitch}px 0 0 rgba(40,80,255,0.8)) contrast(${1 + 0.35 * glitch})` : '';
    place(st.grid, 540, 960, { op: 1 });

    // label typed across the whole scene, changing with the phase
    const labels = { 1: 'ЕСКІ ӘДІС', 2: '01 — БАҒДАРЛАМАЛАР', 3: '02 — ТӘЖІРИБЕ', 4: '03 — УАҚЫТ' };
    typeText(st.label, labels[ph], t, hits[ph - 1] + 0.02, 40, true, C.red);
    place(st.label, 540, 300);

    // P1
    const v1 = ph === 1 ? 1 : 0;
    animChars(st.titleCh, t, T0 + 0.05, 0.05, (sp, p) => {
      const e = E.outExpo(p); sp.style.transform = `translateY(${(1 - e) * 200}px)`; sp.style.opacity = clamp(p * 4);
    });
    place(st.title, 540, 780, { op: v1, s: 1 + 0.04 * prog(t, T0, w5) });
    place(st.line, 540, 990, { sx: pin(t, T0 + 0.3, 0.6, E.outCubic), op: v1 });
    place(st.sub, 540, 1090, { op: v1 * pin(t, T0 + 0.6, 0.4, E.lin) });

    // P2 windows
    const wp = [[500, 760, -5], [570, 880, 3], [530, 1010, -1.5]];
    st.wins.forEach((w, i) => {
      const t0 = w5 - 0.05 + i * 0.22;
      const p = pin(t, t0, 0.35, E.outBack);
      const [x, y, r] = wp[i];
      place(w.root, x, y + (1 - p) * 120, { r: r * p, s: (0.7 + 0.3 * p) * 0.92, op: ph === 2 ? clamp(p * 3) : 0 });
      if (w.kind === 0) place(w.parts.head, 30 + ((t * 300) % 760), 100, { ax: 0, ay: 0 });
      if (w.kind === 2) w.parts.bars.forEach((b, k) => {
        const hgt = 30 + 150 * Math.abs(Math.sin(k * 0.7 + t * 6) * Math.cos(k * 0.23 + t * 2));
        b.style.height = hgt + 'px'; place(b, 40 + k * 16.5, 208, { ax: 0 });
      });
    });
    const pp = pin(t, ws(s, 6) - 0.04, 0.3, E.outBack);
    place(st.pill, 540, 470, { s: pp, op: ph === 2 ? 1 : 0, r: -2 });

    // P3 experience
    const v3 = ph === 3 ? 1 : 0;
    const p3 = pin(t, w7 - 0.06, 0.3);
    place(st.t3a, 540 - (1 - p3) * 600, 420, { op: v3 });
    place(st.t3b, 540 + (1 - pin(t, ws(s, 8) - 0.06, 0.3)) * 700, 595, { op: v3 });
    place(st.tl.root, 540, 975, { s: 0.9 + 0.1 * p3, op: v3, r: 0 });
    st.tl.parts.clips.forEach((cl, k) => { cl.style.opacity = t > w7 + k * 0.04 ? 1 : 0; });
    place(st.tl.parts.head, 30 + ((t - w7) * 420 % 760), 100, { ax: 0, ay: 0 });
    place(st.meterLbl, 90, 1300, { ax: 0, op: v3 });
    place(st.meterVal, 990, 1300, { ax: 1, op: v3 * (Math.floor(t * 4) % 2 ? 1 : 0.4) });
    st.segs.forEach((g, k) => {
      place(g, 90 + k * 76.5, 1252, { ax: 0, op: v3 });
      g.style.background = t > w7 + 0.1 + k * 0.09 ? (k > 8 ? C.red : C.navy) : 'rgba(12,18,34,0.15)';
    });

    // P4 time
    const v4 = ph === 4 ? 1 : 0;
    const pt = pin(t, ws(s, 10) - 0.05, 0.3, E.outBack);
    place(st.t4, 540, 470, { s: 0.6 + 0.4 * pt, op: v4 * clamp(pt * 3) });
    const cnt = E.inOutCubic(prog(t, w9, ws(s, 13)));
    const secs = Math.floor(cnt * 3 * 3600);
    st.timer.textContent = `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    place(st.clock, 540, 690, { op: v4 });
    st.hand.setAttribute('transform', `rotate(${cnt * 1080 + t * 200} 75 75)`);
    place(st.timer, 540, 900, { op: v4, s: 1 + punch(t, [ws(s, 13)], 0.08) });
    place(st.tbar, 540, 1080, { op: v4 });
    st.tfill.style.width = (cnt * 100).toFixed(1) + '%';
    st.tfill.style.background = cnt > 0.85 ? C.red : C.navy;
    place(st.tlbl, 540, 1150, { op: v4 });
    place(st.strike, 540, 900, { r: -8, sx: pin(t, we(s, 13) - 0.05, 0.18, E.outCubic), ax: 0.5, op: v4 });
    return C.navy;
  },
  cues(s) {
    const d = s.data, st = s.state;
    const w5 = ws(s, 5), w7 = ws(s, 7), w9 = ws(s, 9);
    return [
      { t: d.start, type: 'impact', gain: 0.8 },
      { t: d.start + 0.02, t1: d.start + 0.3, type: 'type', gain: 0.3 },
      ...[0, 1, 2].map(i => ({ t: w5 - 0.05 + i * 0.22, type: 'pop', gain: 0.7, pitch: 1 + i * 0.25 })),
      { t: ws(s, 6) - 0.04, type: 'click', gain: 0.6 },
      { t: w7 - 0.1, type: 'whoosh', dur: 0.14, gain: 0.6 },
      { t: ws(s, 8) - 0.1, type: 'whoosh', dur: 0.12, gain: 0.5 },
      { t: w9 - 0.06, type: 'impact', gain: 0.6 },
      { t: w9, t1: ws(s, 13), type: 'tick', gain: 0.45 },
      { t: we(s, 13) - 0.05, type: 'buzz', dur: 0.25, gain: 0.55 },
      { t: d.end - 0.22, type: 'glitch', dur: 0.22, gain: 0.7 },
    ];
  },
};

// ============================== 3. SOLUTION ==============================
SCENES.solution = {
  captions: true,
  build(s) {
    const c = s.cam, st = s.state;
    st.bg = div(c, 'layer', { background: C.navy });
    st.flow = canvas(c, { opacity: 0.45 });
    st.al = txt(c, 'АЛ', { size: 230, color: C.white });
    st.qz = txt(c, 'ҚАЗІР', { size: 420, color: C.orange });
    st.bar = txt(c, '[ БАР БОЛҒАНЫ ]', { cls: 'mono', size: 34, color: C.white });
    st.h1 = txt(c, 'БІР ДҰРЫС', { size: 150, color: C.white });
    st.h2 = txt(c, 'ПРОМПТ', { size: 220, color: C.orange });
    st.h3 = txt(c, 'ЖЕТКІЛІКТІ!', { size: 240, color: C.white, extra: { textShadow: `10px 10px 0 ${C.orange}` } });
    // prompt card
    st.card = div(c, 'a', { width: '920px', height: '600px', borderRadius: '30px', background: '#121A30',
      border: '2px solid rgba(255,255,255,0.14)', boxShadow: '0 40px 90px rgba(0,0,0,0.5)' });
    const head = div(st.card, '', { height: '86px', display: 'flex', alignItems: 'center', gap: '16px', padding: '0 34px',
      borderBottom: '2px solid rgba(255,255,255,0.08)', fontFamily: 'Mono', fontWeight: 700, fontSize: '24px', letterSpacing: '0.3em', color: C.mute });
    el('span', 'dot', head, { background: C.orange, width: '18px', height: '18px' });
    el('span', '', head, {}, 'ПРОМПТ');
    el('span', '', head, { marginLeft: 'auto', color: C.white }, 'AI ✦');
    st.ptext = div(st.card, 'sans', { position: 'absolute', left: '40px', top: '120px', width: '840px', fontWeight: 600, fontSize: '46px',
      lineHeight: 1.32, color: C.white, whiteSpace: 'normal' });
    st.btn = div(st.card, 'a sans', { background: C.orange, color: C.ink, fontWeight: 900, fontSize: '38px', padding: '20px 36px', borderRadius: '50px' }, 'ЖАСАУ ↵');
    st.ring = div(st.card, 'a', { width: '240px', height: '240px', borderRadius: '50%', border: `6px solid ${C.orange}` });
    // render progress
    st.rbar = div(c, 'a', { width: '920px', height: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.12)' });
    st.rfill = div(st.rbar, '', { height: '100%', width: '0%', borderRadius: '8px', background: `linear-gradient(90deg, ${C.blue}, ${C.orange})` });
    st.rlbl = txt(c, '', { cls: 'mono', size: 24, color: C.white });
    st.steps = ['СЦЕНАРИЙ', 'ДАУЫС', 'АНИМАЦИЯ', 'СУБТИТР', 'РЕНДЕР'].map(n => txt(c, n, { cls: 'mono', size: 20, color: C.mute }));
    // phone preview
    st.phone = div(c, 'a', { width: '420px', height: '746px', borderRadius: '54px', background: C.ink, padding: '14px', boxSizing: 'border-box',
      boxShadow: `0 0 0 4px rgba(255,255,255,0.15), 0 50px 120px rgba(0,0,0,0.6)` });
    st.reel = miniReel(st.phone, 3, 392, 718);
    st.reel.root.style.position = 'relative'; st.reel.root.style.transform = 'none'; st.reel.root.style.border = 'none';
    st.ok = div(c, 'a sans', { background: '#2BD47D', color: C.ink, fontWeight: 900, fontSize: '42px', padding: '16px 30px', borderRadius: '50px' }, 'ДАЙЫН ✓');
  },
  layout(s) {
    const st = s.state;
    fit(st.qz, 900, 440); fit(st.h3, 920, 250); fit(st.h2, 900, 230);
  },
  update(s, t) {
    const st = s.state, d = s.data, T0 = d.start, T1 = d.end;
    const w0 = ws(s, 0), w1 = ws(s, 1), w2 = ws(s, 2), w4 = ws(s, 4), w7 = ws(s, 7);
    drawFlow(st.flow.getContext('2d'), t, { n: 650, alpha: 0.5 });
    const typeStart = w4 - 0.05, cps = 62;
    const prompt = d.prompt;
    const typeEnd = typeStart + prompt.length / cps;
    const press = typeEnd + 0.12;
    const rStart = press + 0.12, rEnd = rStart + 0.85;
    const phoneIn = rEnd + 0.05, zoomOut = T1 - 0.32;

    const [shx, shy] = shake(t, [w0 - 0.03, w1 - 0.03, w7 - 0.04], 14);
    const exit = E.inExpo(prog(t, zoomOut, T1));
    place(s.cam, 540 + shx, 960 + shy, { s: 1 + punch(t, [w0, w1, w4, w7, press].map(x => x - 0.04), 0.05) });

    // Q1
    const q1 = t < w4 - 0.08 ? 1 : 0;
    const pa = pin(t, w0 - 0.05, 0.25), pq = pin(t, w1 - 0.05, 0.3, E.outBack);
    place(st.al, 540, 700, { s: 1.5 - 0.5 * pa, op: q1 * clamp(pa * 3), blur: (1 - pa) * 10 });
    place(st.qz, 540, 930, { s: 0.5 + 0.5 * pq, op: q1 * clamp(pq * 3) });
    const pb = pin(t, w2 - 0.05, 0.25);
    place(st.bar, 540, 1170, { op: q1 * pb, ls: '0.3em', s: 0.9 + 0.1 * pb });
    st.bar.style.letterSpacing = (0.6 - 0.3 * pb) + 'em';

    // header
    const q2 = 1 - q1;
    const swap = t >= w7 - 0.04;
    const ph1 = pin(t, w4 - 0.08, 0.3), ph2 = pin(t, ws(s, 6) - 0.05, 0.3, E.outBack), ph3 = pin(t, w7 - 0.04, 0.3, E.outBack);
    place(st.h1, 540, 330, { op: q2 * (swap ? 0 : 1), sy: ph1 });
    place(st.h2, 540, 490, { op: q2 * (swap ? 0 : clamp(ph2 * 3)), s: 0.6 + 0.4 * ph2 });
    place(st.h3, 540, 420, { op: swap ? clamp(ph3 * 3) : 0, s: 0.5 + 0.5 * ph3 });

    // card
    const pc = pin(t, w4 - 0.12, 0.4, E.outCubic);
    const flip = E.inOutCubic(prog(t, phoneIn - 0.2, phoneIn + 0.15));
    place(st.card, 540, 930 + (1 - pc) * 500, { op: q2 * (flip < 0.5 ? 1 : 0), sx: 1 - flip * 2 > 0 ? 1 - flip * 2 : 0.001, s: 1 });
    typeText(st.ptext, prompt, t, typeStart, cps, true, C.orange);
    const pr = prog(t, press, press + 0.18);
    place(st.btn, 880, 560, { ax: 1, ay: 1, s: 1 - 0.12 * Math.sin(pr * Math.PI) + 0.06 * Math.sin(t * 6) * (t < press ? 1 : 0) });
    const rp = prog(t, press, press + 0.5);
    place(st.ring, 735, 510, { s: 0.3 + rp * 1.4, op: rp > 0 && rp < 1 ? 1 - rp : 0 });

    // render bar
    const rv = q2 * (t > rStart - 0.1 && t < phoneIn + 0.3 ? 1 : 0);
    const rprog = E.inOutCubic(prog(t, rStart, rEnd));
    place(st.rbar, 540, 1290, { op: rv });
    st.rfill.style.width = (rprog * 100).toFixed(1) + '%';
    st.rlbl.textContent = rprog < 1 ? `ВИДЕО ЖАСАЛУДА · ${Math.round(rprog * 100)}%` : 'ВИДЕО ДАЙЫН · 100%';
    place(st.rlbl, 90, 1245, { ax: 0, op: rv });
    st.steps.forEach((e, i) => {
      const done = rprog > (i + 1) / 5 - 0.01;
      e.textContent = (done ? '✓ ' : '· ') + e.textContent.replace(/^[✓·] /, '');
      e.style.color = done ? C.white : C.mute;
      place(e, 90 + i * 190, 1340, { ax: 0, op: rv });
    });

    // phone
    const pp = pin(t, phoneIn - 0.05, 0.45, E.outBack);
    const zoom = 1 + exit * 4;
    place(st.phone, 540, 930, { s: (flip >= 0.5 ? 0.3 + 0.7 * pp : 0) * zoom, op: flip >= 0.5 ? 1 : 0, r: (1 - pp) * -8 });
    st.reel.update(t);
    place(st.ok, 760, 600, { s: pin(t, phoneIn + 0.3, 0.3, E.outBack), op: t > phoneIn + 0.3 && exit < 0.2 ? 1 : 0, r: 6 });
    return C.white;
  },
  cues(s) {
    const d = s.data, st = s.state;
    const w4 = ws(s, 4);
    const typeStart = w4 - 0.05, typeEnd = typeStart + d.prompt.length / 62;
    const press = typeEnd + 0.12, rStart = press + 0.12, rEnd = rStart + 0.85, phoneIn = rEnd + 0.05;
    return [
      { t: d.start, type: 'glitch', dur: 0.08, gain: 0.5 },
      { t: ws(s, 0) - 0.04, type: 'impact', gain: 0.8 },
      { t: ws(s, 1) - 0.04, type: 'impact', gain: 0.7 },
      { t: ws(s, 2) - 0.05, type: 'click', gain: 0.4 },
      { t: w4 - 0.12, type: 'whoosh', dur: 0.3, gain: 0.5 },
      { t: typeStart, t1: typeEnd, type: 'type', gain: 0.5 },
      { t: ws(s, 7) - 0.04, type: 'impact', gain: 0.9 },
      { t: press, type: 'click', gain: 1.0 },
      { t: rStart, t1: rEnd, type: 'riserShort', gain: 0.5 },
      { t: phoneIn, type: 'success', gain: 0.7 },
      { t: d.end - 0.35, type: 'whoosh', dur: 0.35, gain: 0.8, rise: true },
    ];
  },
};

// ============================== 4. DEMO ==============================
SCENES.demo = {
  build(s) {
    const c = s.cam, st = s.state;
    st.bg = div(c, 'layer');
    st.label = txt(c, '', { cls: 'mono', size: 26, color: C.white });
    // A: montage
    st.tracks = [0, 1, 2, 3].map(() => div(c, 'a', { width: '940px', height: '74px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)' }));
    const cols = [C.orange, C.blue, C.white, '#7A8BFF', '#FFB347'];
    st.clips = Array.from({ length: 14 }, (_, i) => div(c, 'a', { width: (110 + hash(i * 3.3) * 170) + 'px', height: '62px', borderRadius: '9px', background: cols[i % 5] }));
    st.razor = div(c, 'a', { width: '5px', height: '380px', background: C.red });
    st.mA = [0, 1, 2].map(() => txt(c, 'МОНТАЖ', { size: 330, color: C.white }));
    // B: animation
    st.path = svg(c, 1000, 700, `<path d="M40 600 C 260 -40, 420 -40, 520 360 S 820 760, 960 120" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="5" stroke-dasharray="18 14"/>
      ${[[40, 600], [520, 360], [960, 120]].map(([x, y]) => `<rect x="${x - 16}" y="${y - 16}" width="32" height="32" transform="rotate(45 ${x} ${y})" fill="${C.yellow}"/>`).join('')}`);
    st.ball = div(c, 'a', { width: '120px', height: '120px', borderRadius: '50%', background: C.white, boxShadow: `0 0 0 14px rgba(255,255,255,0.18)` });
    st.sq = div(c, 'a', { width: '110px', height: '110px', borderRadius: '18px', background: C.orange });
    st.tri = svg(c, 130, 120, `<path d="M65 0 L130 120 L0 120Z" fill="${C.yellow}"/>`);
    st.mB = txt(c, 'АНИМАЦИЯ', { size: 260, color: C.white });
    st.mBch = chars(st.mB);
    // C: subtitles
    st.rowsC = Array.from({ length: 9 }, () => txt(c, 'СУБТИТРЛЕР СУБТИТРЛЕР СУБТИТРЛЕР', { size: 200, stroke: '2.5px rgba(12,18,34,0.16)' }));
    st.mC = txt(c, 'СУБТИТРЛЕР', { size: 260, color: C.ink });
    st.chips = ['СӨЗБЕ-СӨЗ', 'ДӘЛ', 'УАҚЫТЫНДА'].map(w => div(c, 'a sans', { fontWeight: 900, fontSize: '52px', padding: '10px 22px 14px', borderRadius: '14px', color: C.ink }, w));
    st.and = txt(c, '+ ЖӘНЕ', { cls: 'mono', size: 40, color: C.ink });
    // D: vfx
    st.glow = div(c, 'layer', { background: `radial-gradient(circle at 50% 46%, rgba(255,90,30,0.85) 0%, rgba(255,60,20,0.35) 25%, rgba(12,18,34,0) 60%)` });
    st.rays = svg(c, 2200, 2200, Array.from({ length: 36 }, (_, i) => {
      const a = i / 36 * 6.283, b = 0.035;
      return `<path d="M1100 1100 L${1100 + 1500 * Math.cos(a - b)} ${1100 + 1500 * Math.sin(a - b)} L${1100 + 1500 * Math.cos(a + b)} ${1100 + 1500 * Math.sin(a + b)}Z" fill="rgba(255,140,80,${i % 2 ? 0.16 : 0.08})"/>`;
    }).join(''));
    st.sparks = canvas(c);
    st.dTop = txt(c, 'ВИЗУАЛДЫ', { size: 170, color: C.white });
    st.dR = txt(c, 'ЭФФЕКТІЛЕР', { size: 250, color: 'rgba(255,40,60,0.45)' });
    st.dB = txt(c, 'ЭФФЕКТІЛЕР', { size: 250, color: 'rgba(40,200,255,0.45)' });
    st.dM = txt(c, 'ЭФФЕКТІЛЕР', { size: 250, color: '#FFF4EA', extra: { textShadow: '0 0 30px rgba(255,90,30,0.95), 0 0 80px rgba(255,90,30,0.7)' } });
    // E: all in one
    st.eTop = txt(c, 'БАРЛЫҒЫ', { size: 220, color: C.white });
    const tileDefs = [[C.navy2, 'МОНТАЖ', C.white], [C.blue, 'АНИМАЦИЯ', C.white], [C.paper, 'СУБТИТР', C.ink], [C.orange, 'ЭФФЕКТ', C.ink]];
    st.tiles = tileDefs.map(([bg, w, fg], i) => {
      const tile = div(c, 'a', { width: '400px', height: '400px', borderRadius: '36px', background: bg, border: '3px solid rgba(255,255,255,0.12)', overflow: 'hidden' });
      const icon = [
        `<rect x="40" y="70" width="240" height="40" rx="8" fill="${C.orange}"/><rect x="100" y="130" width="180" height="40" rx="8" fill="${C.blue}"/><rect x="40" y="190" width="140" height="40" rx="8" fill="#fff"/><rect x="200" y="40" width="6" height="230" fill="${C.red}"/>`,
        `<path d="M30 250 C 100 0, 220 0, 290 250" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="14 10"/><circle cx="160" cy="70" r="40" fill="${C.yellow}"/>`,
        `<rect x="40" y="90" width="240" height="40" rx="10" fill="${C.ink}"/><rect x="70" y="150" width="180" height="40" rx="10" fill="${C.orange}"/><rect x="100" y="210" width="120" height="26" rx="8" fill="${C.ink}" opacity=".4"/>`,
        `<path d="M160 20 L190 120 L295 125 L210 185 L240 285 L160 225 L80 285 L110 185 L25 125 L130 120Z" fill="${C.ink}"/>`,
      ][i];
      svg(tile, 320, 300, icon, { transform: 'translate(40px,30px)' });
      const lbl = txt(tile, w, { cls: 'mono', size: 26, color: fg });
      place(lbl, 200, 360);
      return tile;
    });
    st.one = div(c, 'a', { width: '420px', height: '420px', borderRadius: '50%', background: C.orange, boxShadow: '0 0 120px rgba(255,77,23,0.6)' });
    st.oneT = txt(st.one, '1', { size: 330, color: C.ink });
    place(st.oneT, 210, 222);
    st.eBot = txt(c, 'БІР ПРОЦЕСТЕ', { size: 170, color: C.white });
  },
  layout(s) {
    const st = s.state;
    st.mA.forEach(e => fit(e, 900, 340)); fit(st.mB, 920, 280); fit(st.mC, 920, 280);
    [st.dR, st.dB, st.dM].forEach(e => fit(e, 920, 260)); fit(st.dTop, 700, 180); fit(st.eTop, 800, 230); fit(st.eBot, 900, 180);
  },
  update(s, t) {
    const st = s.state, d = s.data, T0 = d.start, T1 = d.end;
    const w = i => ws(s, i);
    const seg = t < w(1) - 0.04 ? 0 : t < w(2) - 0.04 ? 1 : t < w(4) - 0.04 ? 2 : t < w(6) - 0.04 ? 3 : 4;
    const segStart = [T0, w(1) - 0.04, w(2) - 0.04, w(4) - 0.04, w(6) - 0.04][seg];
    st.bg.style.background = [C.navy, C.blue, C.paper, '#0A0E1A', C.navy][seg];
    const ls = t - segStart;
    const [shx, shy] = shake(t, [w(5) - 0.03], 22);
    const exitP = E.inExpo(prog(t, T1 - 0.38, T1));
    place(s.cam, 540 + shx, 960 + shy, { s: 1 + punch(t, [T0, w(1), w(2), w(4), w(5), w(6), w(7)].map(x => x - 0.04), 0.06) + 0.04 * ls });

    const labels = ['01 / 04 — МОНТАЖ', '02 / 04 — АНИМАЦИЯ', '03 / 04 — СУБТИТРЛЕР', '04 / 04 — ЭФФЕКТІЛЕР', '01 + 02 + 03 + 04'];
    typeText(st.label, labels[seg], t, segStart, 50, true, C.orange);
    st.label.style.color = seg === 2 ? C.ink : C.white;
    place(st.label, 540, 300, { op: exitP > 0.3 ? 0 : 1 });

    // A — montage
    const vA = seg === 0 ? 1 : 0;
    st.tracks.forEach((tr, i) => place(tr, 540, 1080 + i * 88, { op: vA, sx: pin(t, T0 + i * 0.04, 0.3) }));
    st.clips.forEach((cl, i) => {
      const row = i % 4, t0 = T0 + 0.02 + i * 0.028;
      const p = pin(t, t0, 0.22, E.outBack);
      const xs = 70 + Math.floor(i / 4) * 250 + hash(i) * 40;
      place(cl, xs + (1 - p) * 900, 1080 + row * 88, { ax: 0, op: vA });
    });
    place(st.razor, 70 + ((t - T0) * 1600) % 940, 1210, { op: vA });
    const snap = pin(t, T0 + 0.05, 0.28, E.outExpo);
    st.mA.forEach((m, i) => {
      m.style.clipPath = `inset(${i * 33.3}% 0 ${100 - (i + 1) * 33.4}% 0)`;
      place(m, 540 + (1 - snap) * [-260, 300, -180][i], 720, { op: vA });
    });

    // B — animation
    const vB = seg === 1 ? 1 : 0;
    place(st.path, 540, 1150, { op: vB });
    const bp = E.inOutCubic(clamp(ls / 0.6));
    const bx = 540 - 500 + lerp(40, 960, bp), by = 1150 - 350 + (Math.sin(bp * Math.PI * 2.2) * -230 + lerp(600, 120, bp)) * 0.85;
    const sq = 1 + 0.25 * Math.sin(ls * 22);
    place(st.ball, bx, by, { op: vB, sx: sq, sy: 2 - sq });
    place(st.sq, 210, 1500 - Math.abs(Math.sin(ls * 7)) * 140, { op: vB, r: ls * 360 });
    place(st.tri, 870, 1480 - Math.abs(Math.sin(ls * 7 + 1.4)) * 160, { op: vB, r: -ls * 200 });
    place(st.mB, 540, 640, { op: vB });
    animChars(st.mBch, t, segStart, 0.03, (sp, p) => {
      const e = E.outBounce(p); sp.style.transform = `translateY(${(1 - e) * -380}px)`; sp.style.opacity = p > 0 ? 1 : 0;
    });

    // C — subtitles
    const vC = seg === 2 ? 1 : 0;
    st.rowsC.forEach((r, i) => place(r, 540 + (i % 2 ? 1 : -1) * (ls * 320 + 120), 160 + i * 205, { op: vC }));
    const pC = pin(t, segStart, 0.3, E.outBack);
    place(st.mC, 540, 800, { op: vC, s: 0.7 + 0.3 * pC });
    const chipT = segStart + 0.25;
    let cx = 540 - 400;
    const widths = [370, 150, 400];
    st.chips.forEach((ch, i) => {
      const active = Math.floor((t - chipT) / 0.22) % 3 === i && t > chipT;
      ch.style.background = active ? C.orange : 'rgba(12,18,34,0.08)';
      place(ch, cx + widths[i] / 2 - 20, 1040, { op: vC * pin(t, chipT + i * 0.06, 0.2, E.lin), s: active ? 1.08 : 1 });
      cx += widths[i] + 20;
    });
    place(st.and, 540, 1200, { op: vC * (t > w(3) - 0.04 ? 1 : 0), s: pin(t, w(3) - 0.04, 0.25, E.outBack) });

    // D — vfx
    const vD = seg === 3 ? 1 : 0;
    place(st.glow, 540, 960, { op: vD * (0.7 + 0.3 * Math.sin(t * 20)) });
    place(st.rays, 540, 880, { op: vD, r: ls * 30, s: 1 + punch(t, [w(5) - 0.03], 0.2) });
    const sctx = st.sparks.getContext('2d');
    sctx.clearRect(0, 0, W, H);
    if (vD) {
      const bt = t - (w(5) - 0.03);
      if (bt > 0) for (let i = 0; i < 140; i++) {
        const a = hash(i * 7.1) * 6.283, sp = 600 + hash(i * 3.7) * 1500;
        const dd = sp * bt * Math.exp(-bt * 1.6);
        const x = 540 + Math.cos(a) * dd, y = 880 + Math.sin(a) * dd + 300 * bt * bt;
        sctx.fillStyle = i % 3 ? '#FFB070' : '#FFFFFF';
        sctx.globalAlpha = clamp(1 - bt / 1.2);
        sctx.beginPath(); sctx.arc(x, y, 3 + hash(i) * 6, 0, 6.283); sctx.fill();
      }
      sctx.globalAlpha = 1;
    }
    const pD = pin(t, segStart, 0.35);
    place(st.dTop, 540, 640, { op: vD * clamp(pD * 2), s: 1.4 - 0.4 * pD, blur: (1 - pD) * 12 });
    const pE = pin(t, w(5) - 0.05, 0.35, E.outBack);
    const jit = t > w(5) - 0.05 ? 1 : 0;
    const ca = 3 + 14 * (1 - pE) + 3 * Math.abs(Math.sin(t * 37));
    place(st.dR, 540 - ca, 880, { op: vD * jit, s: 0.6 + 0.4 * pE });
    place(st.dB, 540 + ca, 880, { op: vD * jit, s: 0.6 + 0.4 * pE });
    place(st.dM, 540, 880, { op: vD * jit, s: 0.6 + 0.4 * pE });

    // E — all in one
    const vE = seg === 4 ? 1 : 0;
    const merge = E.inOutCubic(prog(t, w(7) - 0.05, w(7) + 0.35));
    place(st.eTop, 540, 380, { op: vE * (1 - exitP), s: pin(t, segStart, 0.3, E.outBack) });
    const tp = [[320, 760], [760, 760], [320, 1200], [760, 1200]];
    st.tiles.forEach((tile, i) => {
      const p = pin(t, segStart + i * 0.06, 0.35, E.outBack);
      const [x, y] = tp[i];
      place(tile, lerp(x, 540, merge), lerp(y, 980, merge), { s: 0.9 * p * (1 - 0.6 * merge), r: merge * (i % 2 ? 90 : -90), op: vE * (merge < 0.95 ? 1 : 0) });
    });
    const po = pin(t, w(7) + 0.25, 0.35, E.outBack);
    place(st.one, 540, 980, { op: vE * (t > w(7) + 0.25 ? 1 : 0), s: po * (1 + exitP * 7) });
    st.oneT.style.opacity = 1 - exitP * 2;
    place(st.eBot, 540, 1340, { op: vE * (t > w(8) - 0.04 ? 1 : 0) * (1 - exitP), s: pin(t, w(8) - 0.04, 0.3, E.outBack) });
    return seg === 2 ? C.ink : C.white;
  },
  cues(s) {
    const d = s.data, w = i => ws(s, i);
    const c = [
      { t: d.start, type: 'impact', gain: 0.9 },
      ...Array.from({ length: 14 }, (_, i) => ({ t: d.start + 0.02 + i * 0.028 + 0.1, type: 'tick1', gain: 0.25 })),
      { t: w(1) - 0.08, type: 'whoosh', dur: 0.12, gain: 0.6 },
      ...[0, 1, 2, 3].map(k => ({ t: w(1) + k * 0.13, type: 'boing', gain: 0.35, pitch: 1 + k * 0.12 })),
      { t: w(2) - 0.04, type: 'impact', gain: 0.7 },
      ...[0, 1, 2, 3].map(k => ({ t: w(2) + 0.25 + k * 0.22, type: 'pop', gain: 0.35, pitch: 1.4 })),
      { t: w(3) - 0.04, type: 'pop', gain: 0.5 },
      { t: w(4) - 0.3, type: 'whoosh', dur: 0.3, gain: 0.7, rise: true },
      { t: w(5) - 0.04, type: 'boom', gain: 1.0 },
      { t: w(6) - 0.04, type: 'impact', gain: 0.7 },
      ...[0, 1, 2, 3].map(k => ({ t: w(6) + k * 0.06, type: 'pop', gain: 0.4, pitch: 0.9 + k * 0.15 })),
      { t: w(7) - 0.05, type: 'whoosh', dur: 0.35, gain: 0.6 },
      { t: w(7) + 0.25, type: 'success', gain: 0.6 },
      { t: d.end - 0.4, type: 'whoosh', dur: 0.4, gain: 0.8, rise: true },
    ];
    return c;
  },
};

// ============================== 5. OFFER ==============================
SCENES.offer = {
  build(s) {
    const c = s.cam, st = s.state;
    st.bg = div(c, 'layer', { background: C.orange });
    st.zero = txt(c, '0', { size: 1500, stroke: '6px rgba(11,15,26,0.10)' });
    st.l1 = [txt(c, 'МЕН', { size: 150, color: C.ink }), txt(c, 'САҒАН', { size: 150, color: C.ink })];
    st.l2 = [txt(c, 'ОСЫНДАЙ', { size: 150, color: C.ink }), txt(c, 'ВИДЕОЛАРДЫ', { size: 150, color: C.ink })];
    st.tag0 = txt(c, '[ ТӘЖІРИБЕСІЗ ДЕ ]', { cls: 'mono', size: 26, color: C.ink });
    st.block = div(c, 'a', { width: '960px', height: '330px', background: C.ink, borderRadius: '8px' });
    st.nol = txt(c, 'НӨЛДЕН', { size: 330, color: C.white });
    st.nolCh = chars(st.nol);
    st.l4 = [txt(c, 'БАСТАП', { size: 150, color: C.ink }), txt(c, 'ЖАСАУДЫ', { size: 150, color: C.ink })];
    st.pill = div(c, 'a', { background: C.white, borderRadius: '90px', height: '170px', width: '900px' });
    st.l5 = [txt(c, 'ҮЙРЕТЕ', { size: 130, color: C.ink }), txt(c, 'АЛАМЫН!', { size: 130, color: C.orange, extra: { WebkitTextStroke: '0px' } })];
    st.tagline = txt(c, 'қадам-қадаммен, түсінікті тілде', { cls: 'serif', size: 58, color: C.ink, extra: { lineHeight: 1.15 } });
  },
  layout(s) {
    const st = s.state;
    fit(st.nol, 880, 340);
    // fit word pairs into one line each with a shared size
    const pair = (arr, maxW, size, gap) => {
      arr.forEach(e => (e.style.fontSize = size + 'px'));
      const tot = arr.reduce((a, e) => a + e.scrollWidth, 0) + gap;
      const k = Math.min(1, maxW / tot);
      arr.forEach(e => (e.style.fontSize = (size * k).toFixed(1) + 'px'));
      return arr.map(e => e.scrollWidth);
    };
    st.wl1 = pair(st.l1, 700, 170, 40); st.wl2 = pair(st.l2, 920, 190, 40); st.wl4 = pair(st.l4, 920, 190, 40); st.wl5 = pair(st.l5, 800, 140, 36);
  },
  update(s, t) {
    const st = s.state, d = s.data, T0 = d.start, T1 = d.end;
    const w = i => ws(s, i);
    const exit = prog(t, T1 - 0.3, T1);
    const [shx, shy] = shake(t, [w(4) - 0.04, w(8) - 0.04], 18);
    place(s.cam, 540 + shx, 960 + shy, { s: 1.0 + 0.045 * prog(t, T0, T1) + punch(t, [T0, w(4) - 0.04, w(8) - 0.04], 0.06) });
    place(st.zero, 700, 900, { r: (t - T0) * 12, s: 1 + 0.08 * Math.sin(t) });
    const row = (arr, widths, y, gap, i0) => {
      const tot = widths[0] + widths[1] + gap;
      let x = 540 - tot / 2;
      arr.forEach((e, k) => {
        const p = pin(t, w(i0 + k) - 0.05, 0.28, E.outBack);
        place(e, x + widths[k] / 2, y + (1 - p) * 60, { op: clamp(p * 3), s: 0.85 + 0.15 * p });
        x += widths[k] + gap;
      });
    };
    row(st.l1, st.wl1, 390, 40, 0);
    row(st.l2, st.wl2, 560, 40, 2);
    const pb = pin(t, w(4) - 0.1, 0.2, E.outCubic);
    place(st.block, 60, 830, { ax: 0, sx: pb, r: -2 });
    place(st.tag0, 540, 685, { op: pin(t, w(4) - 0.1, 0.2, E.lin) });
    place(st.nol, 540, 838, { r: -2 });
    animChars(st.nolCh, t, w(4) - 0.04, 0.03, (sp, p) => {
      const e = E.outBack(p); sp.style.transform = `scale(${0.3 + 0.7 * e})`; sp.style.opacity = clamp(p * 4);
    });
    row(st.l4, st.wl4, 1100, 40, 5);
    const pp = pin(t, w(7) - 0.1, 0.25, E.outCubic);
    place(st.pill, 540, 1285, { sx: pp, op: pp > 0 ? 1 : 0 });
    row(st.l5, st.wl5, 1290, 36, 7);
    place(st.tagline, 540, 1440, { op: pin(t, we(s, 8) + 0.05, 0.35, E.lin) });

    // exit: navy panel wipe from the bottom (drawn in-scene, CTA starts navy)
    if (!st.wipe) st.wipe = div(s.root, 'a', { width: '1400px', height: '2400px', background: C.navy });
    place(st.wipe, 540, 1920 + 1250 - E.inOutCubic(exit) * 2400, { r: -6, op: exit > 0 ? 1 : 0 });
    return C.ink;
  },
  cues(s) {
    const d = s.data, w = i => ws(s, i);
    return [
      ...[0, 1, 2, 3].map(i => ({ t: w(i) - 0.05, type: 'pop', gain: 0.45, pitch: 0.9 + i * 0.1 })),
      { t: w(4) - 0.1, type: 'whoosh', dur: 0.1, gain: 0.5 },
      { t: w(4) - 0.04, type: 'boom', gain: 0.9 },
      { t: w(5) - 0.05, type: 'pop', gain: 0.4 },
      { t: w(6) - 0.05, type: 'pop', gain: 0.4, pitch: 1.1 },
      { t: w(7) - 0.1, type: 'whoosh', dur: 0.15, gain: 0.5 },
      { t: w(8) - 0.04, type: 'impact', gain: 0.9 },
      { t: d.end - 0.32, type: 'whoosh', dur: 0.32, gain: 0.7 },
    ];
  },
};

// ============================== 6. CTA ==============================
SCENES.cta = {
  build(s) {
    const c = s.cam, st = s.state;
    st.bg = div(c, 'layer', { background: C.navy });
    st.flow = canvas(c, { opacity: 0.35 });
    st.big1 = txt(c, 'ҮЙРЕНГІҢ', { size: 300, color: C.white });
    st.big2a = txt(c, 'КЕЛЕ', { size: 260, color: C.white });
    st.big2b = txt(c, 'МЕ?', { size: 260, color: C.orange });
    st.small = txt(c, 'ҮЙРЕНГІҢ КЕЛЕ МЕ?', { size: 130, color: C.white });
    st.pik = txt(c, 'ПІКІРГЕ', { size: 200, color: C.white });
    st.box = div(c, 'a', { width: '780px', height: '380px', borderRadius: '44px', background: C.orange, boxShadow: '0 30px 90px rgba(255,77,23,0.45)' });
    st.ph = txt(st.box, 'ПІКІР ЖАЗУ...', { cls: 'mono', size: 24, color: 'rgba(11,15,26,0.6)' });
    place(st.ph, 44, 52, { ax: 0 });
    st.ai = div(st.box, 'a head', { fontSize: '300px', color: C.ink, lineHeight: 0.86 });
    st.send = div(st.box, 'a', { width: '110px', height: '110px', borderRadius: '50%', background: C.ink });
    svg(st.send, 110, 110, `<path d="M36 55 L78 55 M60 36 L80 55 L60 74" fill="none" stroke="${C.orange}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`);
    st.depjaz = txt(c, 'ДЕП ЖАЗ!', { size: 200, color: C.white });
    st.bubble = div(c, 'a sans', { background: C.white, color: C.ink, fontWeight: 900, fontSize: '48px', padding: '20px 30px', borderRadius: '30px 30px 30px 6px', display: 'flex', alignItems: 'center', gap: '18px' });
    el('span', '', st.bubble, { width: '48px', height: '48px', borderRadius: '50%', background: C.blue, display: 'inline-block' });
    el('span', '', st.bubble, {}, 'AI');
    st.hearts = Array.from({ length: 10 }, (_, i) => txt(c, '♥', { cls: 'sans', size: 60 + hash(i) * 40, color: i % 2 ? C.red : C.orange, weight: 900 }));
    st.arrow = txt(c, '↓', { cls: 'sans', size: 110, color: C.orange, weight: 900 });
    st.arrowLbl = txt(c, 'ПІКІРЛЕР', { cls: 'mono', size: 26, color: C.white });
  },
  layout(s) {
    const st = s.state;
    fit(st.big1, 900, 320); fit(st.small, 900, 140); fit(st.pik, 760, 230); fit(st.depjaz, 760, 230);
    const tot = st.big2a.scrollWidth + st.big2b.scrollWidth + 40;
    if (tot > 900) [st.big2a, st.big2b].forEach(e => (e.style.fontSize = (260 * 900 / tot).toFixed(1) + 'px'));
    st.w2a = st.big2a.scrollWidth; st.w2b = st.big2b.scrollWidth;
  },
  update(s, t) {
    const st = s.state, d = s.data, T0 = d.start, T1 = d.end;
    const w = i => ws(s, i);
    drawFlow(st.flow.getContext('2d'), t, { n: 600, alpha: 0.45, colors: ['#FF6A3D', '#4A5BFF', '#C9D2FF'], seed: 3 });
    const sent = we(s, 6) + 0.15;
    place(s.cam, 540, 960, { s: 1 + punch(t, [w(0), w(2), w(3), w(4), w(6), sent].map(x => x - 0.04), 0.05) });

    // header: big two lines -> compact single line at "Пікірге"
    const comp = E.inOutCubic(prog(t, w(3) - 0.2, w(3) + 0.1));
    const p0 = pin(t, w(0) - 0.05, 0.3, E.outBack);
    place(st.big1, 540, 700 - comp * 300, { op: (1 - comp) * clamp(p0 * 3), s: (0.6 + 0.4 * p0) * (1 - 0.5 * comp) });
    const p1 = pin(t, w(1) - 0.05, 0.28, E.outBack), p2 = pin(t, w(2) - 0.05, 0.3, E.outElastic);
    const tot = st.w2a + st.w2b + 40;
    place(st.big2a, 540 - tot / 2 + st.w2a / 2, 960 - comp * 400, { op: (1 - comp) * clamp(p1 * 3), s: 0.7 + 0.3 * p1 });
    place(st.big2b, 540 + tot / 2 - st.w2b / 2, 960 - comp * 400, { op: (1 - comp) * clamp(p2 * 3), s: 0.4 + 0.6 * p2, r: (1 - p2) * 20 });
    place(st.small, 540, 330, { op: comp, s: 0.9 + 0.1 * comp });

    // build the CTA: ПІКІРГЕ / [AI] / ДЕП ЖАЗ!
    const pk = pin(t, w(3) - 0.05, 0.3, E.outBack);
    place(st.pik, 540, 560, { op: clamp(pk * 3), s: 0.6 + 0.4 * pk });
    const pbx = pin(t, w(3) + 0.05, 0.35, E.outBack);
    const sendPress = Math.sin(clamp((t - sent) / 0.18) * Math.PI);
    place(st.box, 540, 860, { s: (0.5 + 0.5 * pbx) * (1 - 0.04 * sendPress), op: clamp(pbx * 3) });
    const typed = t < w(4) - 0.04 ? '' : t < w(4) + 0.1 ? 'A' : 'AI';
    const blink = Math.floor(t * 2.6) % 2 === 0;
    st.ai.innerHTML = typed + `<span style="display:inline-block;width:14px;height:220px;background:${C.ink};margin-left:14px;vertical-align:-10px;opacity:${blink ? 1 : 0}"></span>`;
    place(st.ai, 330, 215, { s: 1 + punch(t, [w(4) - 0.04, w(4) + 0.1], 0.12) });
    place(st.send, 680, 300, { s: 1 - 0.25 * sendPress + 0.06 * Math.sin(t * 8) * (t < sent ? 1 : 0) });
    const pd = pin(t, w(5) - 0.05, 0.3, E.outBack);
    place(st.depjaz, 540, 1170, { op: clamp(pd * 3), s: 0.6 + 0.4 * pd });

    // comment posted: bubble flies up + hearts
    const fb = prog(t, sent, sent + 0.9);
    place(st.bubble, lerp(700, 900, E.outCubic(fb)), lerp(900, 700, E.outCubic(fb)), { op: fb > 0 ? clamp((1 - fb) * 3) : 0, s: 0.5 + 0.6 * E.outBack(clamp(fb * 3)) });
    st.hearts.forEach((h, i) => {
      const ht = t - sent - 0.05 - i * 0.04;
      const a = -Math.PI / 2 + (hash(i * 4.1) - 0.5) * 2.4;
      const dd = 500 * (1 - Math.exp(-ht * 3));
      place(h, 830 + Math.cos(a) * dd * 0.6, 970 + Math.sin(a) * dd * 0.8, { op: ht > 0 ? clamp(1 - ht / 1.1) : 0, s: 0.6 + 0.6 * clamp(ht * 4), r: (hash(i) - 0.5) * 50 });
    });
    // final hold: bouncing arrow
    const pa = pin(t, sent + 0.4, 0.35, E.outBack);
    place(st.arrow, 540, 1340 + Math.abs(Math.sin(t * 5)) * 26, { op: clamp(pa * 2), s: pa });
    place(st.arrowLbl, 540, 1450, { op: pin(t, sent + 0.5, 0.3, E.lin) });
    return C.white;
  },
  cues(s) {
    const d = s.data, w = i => ws(s, i);
    const sent = we(s, 6) + 0.15;
    return [
      { t: w(0) - 0.05, type: 'impact', gain: 0.6 },
      { t: w(2) - 0.05, type: 'boing', gain: 0.4, pitch: 1.3 },
      { t: w(3) - 0.2, type: 'whoosh', dur: 0.3, gain: 0.5 },
      { t: w(4) - 0.04, type: 'key', gain: 0.8 },
      { t: w(4) + 0.1, type: 'key', gain: 0.8 },
      { t: w(5) - 0.05, type: 'pop', gain: 0.5 },
      { t: sent, type: 'send', gain: 0.9 },
      { t: sent + 0.06, type: 'success', gain: 0.6 },
      { t: sent + 0.4, type: 'final', gain: 1.0 },
    ];
  },
};
