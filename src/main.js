// Frame driver: builds every scene once, then renderFrame(t) poses the whole stage for time t.
(function () {
  const TL = window.__TIMELINE__;
  const stage = document.getElementById('stage');
  const sceneLayer = document.getElementById('scenes');
  const flash = document.getElementById('flash');
  const instances = [];

  // ---------- HUD (corner brackets, labels, scene counter, progress) ----------
  const hud = document.getElementById('hud');
  const brackets = [[44, 44, 'top', 'left'], [44, 44, 'top', 'right'], [44, 44, 'bottom', 'left'], [44, 44, 'bottom', 'right']].map(([a, b, v, h]) =>
    div(hud, '', { position: 'absolute', [v]: a + 'px', [h]: b + 'px', width: '46px', height: '46px',
      [`border${v[0].toUpperCase() + v.slice(1)}`]: '4px solid', [`border${h[0].toUpperCase() + h.slice(1)}`]: '4px solid' }));
  const hudL = div(hud, 'mono', { position: 'absolute', left: '112px', top: '62px', fontSize: '21px' });
  const hudDot = el('span', '', hudL, { display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: C.red, marginRight: '14px', verticalAlign: '1px' });
  el('span', '', hudL, {}, 'AI REELS — БІР ПРОМПТ');
  const hudR = div(hud, 'mono', { position: 'absolute', right: '112px', top: '62px', fontSize: '21px' });
  const hudTC = div(hud, 'mono', { position: 'absolute', left: '112px', bottom: '62px', fontSize: '21px', letterSpacing: '0.2em' });
  const hudBar = div(hud, '', { position: 'absolute', right: '112px', bottom: '70px', width: '300px', height: '6px', background: 'rgba(128,128,128,0.35)' });
  const hudFill = div(hudBar, '', { height: '100%', width: '0%', background: C.orange });

  // ---------- captions (word-synced subtitles) ----------
  const capLayer = document.getElementById('captions');
  const capBox = div(capLayer, 'cap-box');
  function chunks(words) {
    const out = []; let cur = [];
    words.forEach((w, i) => {
      cur.push(i);
      const len = cur.map(k => words[k].text).join(' ').length;
      if (cur.length >= 3 || len > 17 || /[,.!?—]$/.test(w.text)) { out.push(cur); cur = []; }
    });
    if (cur.length) out.push(cur);
    return out;
  }
  let capKey = '';
  function renderCaptions(t, sc) {
    if (!sc || !sc.captions) { capBox.style.display = 'none'; return; }
    const words = sc.data.words;
    const groups = chunks(words);
    let g = -1;
    groups.forEach((grp, i) => { if (t >= words[grp[0]].start - 0.06) g = i; });
    const last = groups[groups.length - 1];
    if (g < 0 || t > words[last[last.length - 1]].end + 0.45) { capBox.style.display = 'none'; return; }
    capBox.style.display = '';
    const grp = groups[g];
    const key = sc.data.id + g;
    if (key !== capKey) {
      capBox.innerHTML = '';
      grp.forEach(k => el('span', 'cap-w', capBox, {}, up(words[k].text.replace(/[,.—]+$/g, '').trim())));
      capKey = key;
    }
    const spans = capBox.children;
    const g0 = words[grp[0]].start - 0.06;
    const pIn = pin(t, g0, 0.22, E.outBack);
    capBox.style.transform = `translate(-50%,-50%) scale(${0.85 + 0.15 * pIn})`;
    capBox.style.opacity = clamp(pIn * 1.5);
    grp.forEach((k, j) => {
      const w = words[k], sp = spans[j];
      const active = t >= w.start - 0.04 && (j === grp.length - 1 || t < words[grp[j + 1]].start - 0.04);
      const seen = t >= w.start - 0.04;
      const p = pin(t, w.start - 0.04, 0.18, E.outBack);
      sp.style.opacity = seen ? 1 : 0.28;
      sp.style.background = active ? C.orange : 'transparent';
      sp.style.color = active ? C.ink : C.white;
      sp.style.transform = `scale(${seen ? 0.9 + 0.1 * p + (active ? 0.04 : 0) : 0.92})`;
    });
  }

  // ---------- film grain ----------
  const grain = document.getElementById('grain'), gctx = grain.getContext('2d');
  const grainFrames = [0, 1, 2, 3].map(seed => {
    const img = gctx.createImageData(540, 960);
    let s = seed * 9973 + 1;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 16807) % 2147483647;
      const v = (s / 2147483647) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    return img;
  });

  // ---------- build ----------
  TL.scenes.forEach((data, i) => {
    const def = SCENES[data.id];
    const root = div(sceneLayer, 'scene');
    const cam = div(root, 'cam');
    const inst = { data, def, root, cam, captions: !!def.captions, state: {} };
    def.build(inst, TL);
    instances.push(inst);
  });

  function sceneAt(t) {
    for (const s of instances) if (t >= s.data.start && t < s.data.end) return s;
    return instances[instances.length - 1];
  }

  let fitted = false;
  window.renderFrame = function (t) {
    if (!fitted) {
      // measuring needs the scenes laid out, so show them all while fitting text
      instances.forEach(s => { s.root.style.display = 'block'; s.def.layout && s.def.layout(s); });
      fitted = true;
    }
    const cur = sceneAt(t);
    instances.forEach(s => { s.root.style.display = s === cur ? 'block' : 'none'; });
    const ink = cur.def.update(cur, t) || C.white;

    renderCaptions(t, cur);

    // HUD
    hud.style.color = ink;
    brackets.forEach(b => (b.style.borderColor = ink));
    hudR.textContent = `САХНА ${String(cur.data.index).padStart(2, '0')} / ${String(instances.length).padStart(2, '0')}`;
    const f = Math.floor(t * TL.fps);
    hudTC.textContent = `${String(Math.floor(t)).padStart(2, '0')}:${String(f % TL.fps).padStart(2, '0')}  ${cur.data.label}`;
    hudFill.style.width = (t / TL.duration * 100).toFixed(2) + '%';
    hudDot.style.opacity = Math.floor(t * 2) % 2 ? 0.25 : 1;
    const endFade = 1 - prog(t, TL.duration - 1.0, TL.duration - 0.6);
    [hudL, hudR, hudTC, hudBar].forEach(e => (e.style.opacity = endFade));

    // white flash on hard cuts flagged by scenes
    let fl = 0;
    instances.forEach(s => {
      if (s.def.flashIn && t >= s.data.start && t < s.data.start + 0.12) fl = Math.max(fl, (1 - prog(t, s.data.start, s.data.start + 0.12)) * s.def.flashIn);
    });
    flash.style.opacity = fl;

    gctx.putImageData(grainFrames[f % 4], 0, 0);
  };

  window.getCues = function () {
    const cues = [];
    instances.forEach(s => (s.def.cues ? s.def.cues(s) : []).forEach(c => cues.push(c)));
    return cues.sort((a, b) => a.t - b.t);
  };

  window.__ready = (async () => {
    await Promise.all([
      document.fonts.load('900 100px Head', 'ӘҒҚҢӨҰҮІ'), document.fonts.load('800 100px Head', 'Ә'),
      document.fonts.load('700 30px Mono', 'Ә'), document.fonts.load('400 30px Mono', 'Ә'),
      document.fonts.load('italic 400 30px Serif', 'Ә'), document.fonts.load('900 30px Sans', 'Ә'),
      document.fonts.load('600 30px Sans', 'Ә'), document.fonts.load('700 30px Sans', 'Ә'),
    ]);
    await document.fonts.ready;
    window.renderFrame(0);
    return true;
  })();
})();
