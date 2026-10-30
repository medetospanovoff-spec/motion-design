// AI VIDEO CREATOR — single-page course app (no build step, no backend).
// Content lives in /content (course.json, prompts.json, lessons/*.md); progress is kept in localStorage.
(function () {
  'use strict';

  const view = document.getElementById('view');
  const STORE_KEY = 'aivc-progress-v1';
  let course = null;
  let prompts = null;
  const mdCache = {};

  // ---------- progress store ----------
  const store = {
    data: { lessons: {}, quiz: {}, practice: {}, checks: {}, name: '' },
    load() {
      try { Object.assign(this.data, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { /* private mode */ }
    },
    save() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ }
      updateRing();
    },
    reset() { this.data = { lessons: {}, quiz: {}, practice: {}, checks: {}, name: '' }; this.save(); },
  };

  const allLessons = () => course.modules.flatMap(m => m.lessons.map(l => ({ ...l, module: m })));
  const lessonDone = id => !!store.data.lessons[id];
  const moduleStats = m => {
    const done = m.lessons.filter(l => lessonDone(l.id)).length;
    return { done, total: m.lessons.length, pct: Math.round((done / m.lessons.length) * 100) };
  };
  const totalPct = () => {
    const ls = allLessons();
    return ls.length ? Math.round((ls.filter(l => lessonDone(l.id)).length / ls.length) * 100) : 0;
  };
  function updateRing() {
    if (!course) return;
    const p = totalPct();
    document.getElementById('ringFg').style.strokeDashoffset = (97.4 * (1 - p / 100)).toFixed(1);
    document.getElementById('ringPct').textContent = p + '%';
  }

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = view) => root.querySelector(sel);
  const $$ = (sel, root = view) => [...root.querySelectorAll(sel)];
  async function getText(url) {
    if (mdCache[url]) return mdCache[url];
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(url + ' — ' + r.status);
    return (mdCache[url] = await r.text());
  }
  const getJSON = async url => JSON.parse(await getText(url));

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      document.execCommand('copy'); ta.remove();
    }
    toast('Көшірілді ✓');
  }
  function bindCopy(root) {
    $$('[data-copy]', root).forEach(btn => btn.addEventListener('click', () => {
      const src = btn.closest('.prompt').querySelector('.prompt-body');
      copyText(src.textContent);
      btn.classList.add('ok'); btn.innerHTML = '✓ Көшірілді';
      setTimeout(() => { btn.classList.remove('ok'); btn.innerHTML = copyLabel; }, 1600);
    }));
    $$('.prompt-more', root).forEach(b => b.addEventListener('click', () => {
      const body = b.closest('.prompt').querySelector('.prompt-body');
      body.classList.toggle('expanded');
      b.textContent = body.classList.contains('expanded') ? 'Жию ▲' : 'Толық көрсету ▼';
    }));
  }
  const copyLabel = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>Copy';

  function promptCard(title, text, extra = '') {
    const long = text.split('\n').length > 14 || text.length > 900;
    return `<div class="prompt">
      <div class="prompt-head"><div class="ttl">${esc(title)}</div><button class="copy" data-copy>${copyLabel}</button></div>
      <pre class="prompt-body">${esc(text)}</pre>
      ${long ? '<button class="prompt-more">Толық көрсету ▼</button>' : ''}
      ${extra}
    </div>`;
  }

  // ---------- markdown with course extensions ----------
  // ```prompt  -> first line "# Title", rest is copyable text
  // ```quiz    -> "? question", "- wrong", "+ right", "> explanation", blank line between questions
  // > ⚠️ / > 💡 / > 📱 blockquotes get coloured
  function renderMarkdown(src, pageKey) {
    const blocks = [];
    src = src.replace(/```(prompt|quiz)\n([\s\S]*?)```/g, (_, kind, body) => {
      blocks.push({ kind, body: body.replace(/\s+$/, '') });
      return `\n<div data-block="${blocks.length - 1}"></div>\n`;
    });
    const html = marked.parse(src, { gfm: true, breaks: false });
    const wrap = document.createElement('div');
    wrap.className = 'md';
    wrap.innerHTML = html;

    $$('[data-block]', wrap).forEach(ph => {
      const b = blocks[+ph.dataset.block];
      if (b.kind === 'prompt') {
        const lines = b.body.split('\n');
        const title = lines[0].startsWith('# ') ? lines.shift().slice(2) : 'Промпт';
        ph.outerHTML = promptCard(title, lines.join('\n').trim());
      } else {
        ph.outerHTML = quizHTML(b.body, pageKey);
      }
    });
    $$('blockquote', wrap).forEach(q => {
      const t = q.textContent.trim();
      if (t.startsWith('⚠️')) q.classList.add('warn');
      else if (t.startsWith('💡') || t.startsWith('✅')) q.classList.add('tip');
      else if (t.startsWith('📱')) q.classList.add('phone');
    });
    // interactive, persisted task lists
    $$('li', wrap).forEach((li, i) => {
      const cb = li.querySelector(':scope > input[type=checkbox], :scope > p > input[type=checkbox]');
      if (!cb) return;
      li.classList.add('task');
      const key = pageKey + ':' + i;
      cb.disabled = false;
      cb.checked = !!store.data.checks[key];
      cb.addEventListener('change', () => { store.data.checks[key] = cb.checked; store.save(); });
    });
    $$('a[href^="http"]', wrap).forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    return wrap;
  }

  function quizHTML(body, pageKey) {
    const qs = body.split(/\n\s*\n/).map(chunk => {
      const q = { title: '', opts: [], exp: '' };
      chunk.split('\n').forEach(line => {
        if (line.startsWith('? ')) q.title = line.slice(2);
        else if (line.startsWith('+ ')) q.opts.push({ t: line.slice(2), ok: true });
        else if (line.startsWith('- ')) q.opts.push({ t: line.slice(2), ok: false });
        else if (line.startsWith('> ')) q.exp = line.slice(2);
      });
      return q;
    }).filter(q => q.title);
    return `<div class="quiz" data-quiz="${esc(pageKey)}" data-count="${qs.length}">` + qs.map((q, qi) => `
      <div class="q" data-q="${qi}">
        <div class="q-title">${qi + 1}. ${esc(q.title)}</div>
        ${q.opts.map((o, oi) => `<button class="q-opt" data-ok="${o.ok ? 1 : 0}" data-o="${oi}">${esc(o.t)}</button>`).join('')}
        <div class="q-exp">${esc(q.exp)}</div>
      </div>`).join('') + '</div>';
  }
  function bindQuiz(root) {
    $$('.quiz', root).forEach(qz => {
      const key = qz.dataset.quiz;
      const saved = store.data.quiz[key] || {};
      $$('.q', qz).forEach(q => {
        const qi = q.dataset.q;
        const mark = oi => {
          q.classList.add('answered');
          $$('.q-opt', q).forEach(b => {
            b.disabled = true;
            if (b.dataset.ok === '1') b.classList.add('right');
            else if (b.dataset.o === String(oi)) b.classList.add('wrong');
          });
        };
        if (saved[qi] != null) mark(saved[qi]);
        $$('.q-opt', q).forEach(b => b.addEventListener('click', () => {
          const s = store.data.quiz[key] || (store.data.quiz[key] = {});
          s[qi] = +b.dataset.o; store.save(); mark(+b.dataset.o);
          if (b.dataset.ok === '1') toast('Дұрыс! 🎉'); else toast('Қате — түсіндірмені оқыңыз');
        }));
      });
    });
  }

  // ---------- pages ----------
  function homePage() {
    const all = allLessons();
    const next = all.find(l => !lessonDone(l.id));
    const started = all.some(l => lessonDone(l.id));
    const cta = next ? `#/lesson/${next.id}` : '#/final';
    const ctaLabel = !started ? 'Курсты бастау' : next ? 'Жалғастыру' : 'Финалдық жоба';
    view.innerHTML = `
      <section class="hero">
        <div>
          <div class="eyebrow">Авторлық курс</div>
          <h1>Тек <em>смартфонмен</em> алғашқы AI-видеоңызды жасаңыз</h1>
          <p class="muted" style="margin-top:14px">Монтаж, бағдарламалау және дизайн тәжірибесі қажет емес. ChatGPT, GitHub және Claude Code көмегімен TikTok, Instagram Reels және YouTube Shorts үшін кәсіби вертикал видео жасауды үйренесіз.</p>
          <div class="badges" style="margin:16px 0 18px">
            <span class="chip accent">📱 Тек телефон</span>
            <span class="chip">${course.modules.length} модуль</span>
            <span class="chip">${all.length} сабақ · 5–10 мин</span>
            <span class="chip green">Финалдық жоба</span>
          </div>
          <a class="btn" href="${cta}">${ctaLabel} →</a>
          ${next && started ? `<p class="muted" style="font-size:14px;margin-top:10px;text-align:center">Келесі сабақ: ${esc(next.title)}</p>` : ''}
        </div>
        <div>
          <div class="hero-media">
            <video src="media/example-reel.mp4" poster="media/example-poster.jpg" controls playsinline preload="none"></video>
          </div>
          <div class="hero-caption">Мысал: бір промпт арқылы Claude Code жасаған видео</div>
        </div>
      </section>

      <section class="section">
        <h2>Курстың соңында сізде болады</h2>
        <div class="card"><ol class="steps-mini">
          <li><div><b>Кәсіби промпт</b><br><span class="muted">Claude Code-қа видео жасату үшін дайын тапсырма.</span></div></li>
          <li><div><b>Өз GitHub репозиторийіңіз</b><br><span class="muted">Видео жобаңыз сақталатын «бұлттағы папка».</span></div></li>
          <li><div><b>Алғашқы AI-видео</b><br><span class="muted">1080×1920, субтитрмен, музыкамен, анимациямен.</span></div></li>
          <li><div><b>Жариялау жоспары</b><br><span class="muted">Тақырып, сипаттама және 7 видеоға идея.</span></div></li>
        </ol></div>
      </section>

      <section class="section">
        <h2>Қажетті құралдар</h2>
        <div class="stack">
          ${tool('GPT', '#10A37F', 'ChatGPT', 'Идея, сценарий, промпт жазу. Тегін нұсқасы жеткілікті.')}
          ${tool('GH', '#F2F4F8', 'GitHub', 'Жобаны сақтайтын орын. Тегін. Телефон браузерінен жұмыс істейміз.')}
          ${tool('CC', '#D97757', 'Claude Code', 'Видеоны жасайтын AI-көмекші. Claude қосымшасындағы Code бөлімі. Ақылы жазылым қажет (Pro немесе одан жоғары).')}
          ${tool('📱', '#7C8CFF', 'Смартфон', 'iPhone немесе Android, интернет және шамамен 1 GB бос орын.')}
        </div>
      </section>

      <section class="section">
        <h2>Модульдер</h2>
        <div class="stack">${course.modules.map(m => moduleCardSmall(m)).join('')}</div>
      </section>

      <section class="section">
        <a class="card tap" href="#/final" style="background:linear-gradient(135deg,rgba(255,90,31,.18),rgba(124,140,255,.14))">
          <div class="eyebrow">Финалдық жоба</div>
          <h2 style="margin-bottom:8px">Өз AI Reels-іңізді нөлден жасаңыз</h2>
          <p class="muted" style="margin:0">10 қадамдық чек-лист: идеядан жарияланған видеоға дейін →</p>
        </a>
      </section>
      ${footer()}`;
  }
  const tool = (ic, col, name, desc) => `<div class="card tool"><div class="tool-ic" style="background:${col}22;color:${col}">${ic}</div><div><b>${name}</b><span>${desc}</span></div></div>`;
  function moduleCardSmall(m) {
    const s = moduleStats(m);
    return `<a class="card tap module-card" href="#/modules/${m.id}">
      <div class="module-head"><div class="module-num ${s.pct === 100 ? 'complete' : ''}">${s.pct === 100 ? '✓' : m.num}</div>
      <div><div class="module-title">${esc(m.title)}</div><div class="module-meta">${s.done}/${s.total} сабақ · ${m.lessons.reduce((a, l) => a + l.minutes, 0)} мин</div></div></div>
      <div class="bar"><i style="width:${s.pct}%"></i></div></a>`;
  }
  const footer = () => `<div class="footer-links">
      <a href="#/scripts">🎬 Видеосабақ сценарийлері (авторларға)</a>
      <span>Прогресіңіз тек осы құрылғыдағы браузерде сақталады.</span>
    </div>`;

  function modulesPage(openId) {
    view.innerHTML = `<div class="eyebrow">Курс бағдарламасы</div><h1 style="margin-bottom:6px">Модульдер</h1>
      <p class="muted">Ретімен өтіңіз: әр модуль алдыңғысына сүйенеді.</p>
      <div class="stack" style="margin-top:18px">${course.modules.map(m => {
        const s = moduleStats(m);
        return `<details class="card module" ${m.id === openId || (!openId && s.pct < 100 && s.done > 0) ? 'open' : ''} id="${m.id}">
          <summary class="module-card">
            <div class="module-head"><div class="module-num ${s.pct === 100 ? 'complete' : ''}">${s.pct === 100 ? '✓' : m.num}</div>
              <div><div class="module-title">${esc(m.title)}</div><div class="module-meta">${s.done}/${s.total} сабақ</div></div>
              <span class="chev">›</span></div>
            <div class="bar"><i style="width:${s.pct}%"></i></div>
          </summary>
          <div class="lesson-list">${m.lessons.map(l => `
            <a class="lesson-link ${lessonDone(l.id) ? 'done' : ''}" href="#/lesson/${l.id}">
              <span class="lesson-dot">✓</span><span class="t">${esc(l.title)}</span><span class="m">${l.minutes} мин</span></a>`).join('')}
            <div class="card" style="background:var(--surface-2);margin-top:8px;padding:14px">
              <div class="module-meta" style="font-weight:800;letter-spacing:.1em">НӘТИЖЕ</div>
              <div style="font-size:15px">${esc(m.result)}</div>
            </div>
          </div>
        </details>`;
      }).join('')}</div>`;
    if (openId) document.getElementById(openId)?.scrollIntoView({ block: 'start' });
  }

  async function lessonPage(id) {
    const all = allLessons();
    const idx = all.findIndex(l => l.id === id);
    if (idx < 0) return notFound();
    const l = all[idx], m = l.module;
    const li = m.lessons.findIndex(x => x.id === id);
    view.innerHTML = `<div class="loading">Жүктелуде…</div>`;
    let src;
    try { src = await getText(`content/lessons/${id}.md`); } catch (e) { return failed(e); }
    if (currentRoute() !== '#/lesson/' + id) return;
    const prev = all[idx - 1], next = all[idx + 1];
    view.innerHTML = `
      <div class="lesson-top"><a class="back" href="#/modules/${m.id}">‹ Модуль ${m.num}</a>
        <span class="chip">${li + 1}/${m.lessons.length}</span><span class="chip">⏱ ${l.minutes} мин</span></div>
      <div class="lesson-hero"><div class="eyebrow">${m.num} · ${esc(m.title)}</div>
        <div class="bar"><i style="width:${Math.round(((li + 1) / m.lessons.length) * 100)}%"></i></div></div>
      <div id="mdHost"></div>
      <div class="complete-box" id="completeBox"></div>
      <div class="lesson-nav">
        ${next ? `<a class="btn secondary" href="#/lesson/${next.id}">Келесі: ${esc(next.title)} →</a>` : `<a class="btn secondary" href="#/final">Финалдық жобаға өту →</a>`}
        ${prev ? `<a class="btn ghost" href="#/lesson/${prev.id}">‹ Алдыңғы сабақ</a>` : ''}
      </div>`;
    const md = renderMarkdown(src, 'lesson:' + id);
    $('#mdHost').appendChild(md);
    bindCopy(view); bindQuiz(view);
    const box = $('#completeBox');
    const drawBox = () => {
      const done = lessonDone(id);
      box.innerHTML = done
        ? `<h3>Сабақ аяқталды ✓</h3><p style="margin:8px 0 14px">Тамаша! Келесі сабаққа өтіңіз.</p><button class="btn small ghost" id="undo">Белгіні алып тастау</button>`
        : `<h3>Сабақты түсіндіңіз бе?</h3><p style="margin:8px 0 14px">Практикалық тапсырманы орындап, белгі қойыңыз.</p><button class="btn" id="markDone">Сабақты аяқтадым ✓</button>`;
      $('#markDone', box)?.addEventListener('click', () => {
        store.data.lessons[id] = Date.now(); store.save(); drawBox();
        const ms = moduleStats(m);
        toast(ms.pct === 100 ? `Модуль ${m.num} аяқталды! 🏆` : 'Сабақ аяқталды ✓');
      });
      $('#undo', box)?.addEventListener('click', () => { delete store.data.lessons[id]; store.save(); drawBox(); });
    };
    drawBox();
  }

  async function promptsPage() {
    view.innerHTML = `<div class="loading">Жүктелуде…</div>`;
    try { prompts = prompts || await getJSON('content/prompts.json'); } catch (e) { return failed(e); }
    const cats = prompts.categories;
    let cat = 'all', q = '';
    view.innerHTML = `<div class="eyebrow">Кітапхана</div><h1 style="margin-bottom:6px">Дайын промпттар</h1>
      <p class="muted">Көшіріп алыңыз, [ТІКБҰРЫШТЫ ЖАҚШАЛАРДАҒЫ] жерлерді өз мәліметіңізбен ауыстырыңыз да, жіберіңіз.</p>
      <input class="search" type="search" placeholder="Іздеу: сценарий, субтитр, қате…" aria-label="Промпт іздеу">
      <div class="filters">${[['all', 'Барлығы'], ...cats.map(c => [c.id, c.title])].map(([id, t]) => `<button class="filter ${id === 'all' ? 'on' : ''}" data-cat="${id}">${esc(t)}</button>`).join('')}</div>
      <div id="plist"></div>`;
    const draw = () => {
      const list = prompts.items.filter(p => (cat === 'all' || p.category === cat) &&
        (!q || (p.title + ' ' + p.purpose + ' ' + p.text).toLowerCase().includes(q)));
      $('#plist').innerHTML = list.length ? list.map(p => {
        const c = cats.find(x => x.id === p.category);
        return promptCard(p.title, p.text, `<div class="prompt-meta">
          <div><span class="chip violet">${esc(c.title)}</span></div>
          <div><div class="lbl">Не үшін</div>${esc(p.purpose)}</div>
          <div><div class="lbl">Қалай қолдану</div>${esc(p.how)}</div>
          <div><div class="lbl">Күтілетін нәтиже (мысал)</div><div class="example">${esc(p.example)}</div></div></div>`);
      }).join('') : `<p class="muted" style="text-align:center;padding:30px 0">Ештеңе табылмады.</p>`;
      bindCopy($('#plist'));
    };
    $$('.filter').forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.cat; $$('.filter').forEach(x => x.classList.toggle('on', x === b)); draw();
    }));
    $('.search').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }

  function practicePage() {
    view.innerHTML = `<div class="eyebrow">Практика</div><h1 style="margin-bottom:6px">Практикалық тапсырмалар</h1>
      <p class="muted">Әр модульдің соңындағы негізгі тапсырма. Орындағанда белгі қойыңыз.</p>
      <div class="stack" style="margin-top:18px">${course.modules.map(m => `
        <div class="card task-card">
          <div class="eyebrow" style="margin:0">Модуль ${m.num}</div>
          <h3>${esc(m.practice.title)}</h3>
          <p style="margin:0">${esc(m.practice.task)}</p>
          <p class="muted" style="margin:0;font-size:15px"><b>Нәтиже:</b> ${esc(m.practice.done)}</p>
          <label class="check"><input type="checkbox" data-p="${m.id}" ${store.data.practice[m.id] ? 'checked' : ''}> Орындадым</label>
        </div>`).join('')}
        <a class="card tap" href="#/final" style="background:linear-gradient(135deg,rgba(255,90,31,.18),rgba(124,140,255,.14))">
          <div class="eyebrow">Финал</div><h3>Финалдық жоба: өз AI Reels-іңіз →</h3></a>
      </div>`;
    $$('[data-p]').forEach(cb => cb.addEventListener('change', () => {
      store.data.practice[cb.dataset.p] = cb.checked; store.save();
      if (cb.checked) toast('Тапсырма орындалды ✓');
    }));
  }

  function progressPage() {
    const p = totalPct();
    const all = allLessons();
    const doneCount = all.filter(l => lessonDone(l.id)).length;
    const practiceDone = course.modules.filter(m => store.data.practice[m.id]).length;
    const C = 2 * Math.PI * 46;
    view.innerHTML = `<div class="eyebrow">Менің жолым</div><h1 style="margin-bottom:18px">Прогресс</h1>
      <div class="card big-stat">
        <svg class="big-ring" viewBox="0 0 110 110"><circle class="bg" cx="55" cy="55" r="46"/><circle class="fg" cx="55" cy="55" r="46" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - p / 100)).toFixed(1)}"/></svg>
        <div><div class="big-pct">${p}%</div><div class="muted">${doneCount} / ${all.length} сабақ<br>${practiceDone} / ${course.modules.length} практикалық тапсырма</div></div>
      </div>
      <div class="section"><h2>Модульдер бойынша</h2><div class="stack">${course.modules.map(m => moduleCardSmall(m)).join('')}</div></div>
      <div class="section" id="certBox"></div>
      <div class="section"><button class="btn ghost" id="reset">Прогресті тазалау</button></div>
      ${footer()}`;
    const cert = $('#certBox');
    if (p === 100) {
      cert.innerHTML = `<div class="cert"><div class="eyebrow">Құттықтаймыз!</div>
        <h2>Сіз AI VIDEO CREATOR курсын аяқтадыңыз 🏆</h2>
        <p class="muted">Атыңызды жазып, осы экранның скриншотын жасаңыз.</p>
        <input class="input" id="nm" placeholder="Аты-жөніңіз" value="${esc(store.data.name)}">
        <p style="margin-top:14px;font-weight:800;font-size:20px" id="nmShow">${esc(store.data.name)}</p>
        <p class="muted" style="font-size:13px;margin:0">${new Date().toLocaleDateString('kk-KZ')}</p></div>`;
      $('#nm').addEventListener('input', e => { store.data.name = e.target.value; store.save(); $('#nmShow').textContent = e.target.value; });
    } else {
      cert.innerHTML = `<div class="card" style="text-align:center"><h3>Сертификат экраны</h3><p class="muted" style="margin:8px 0 0">Барлық сабақты аяқтағанда осында ашылады.</p></div>`;
    }
    $('#reset').addEventListener('click', () => {
      if (confirm('Барлық прогресс өшіріледі. Жалғастырасыз ба?')) { store.reset(); progressPage(); toast('Прогресс тазаланды'); }
    });
  }

  async function mdPage(file, key, eyebrow) {
    view.innerHTML = `<div class="loading">Жүктелуде…</div>`;
    let src;
    try { src = await getText(file); } catch (e) { return failed(e); }
    view.innerHTML = `${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<div id="mdHost"></div>`;
    $('#mdHost').appendChild(renderMarkdown(src, key));
    bindCopy(view); bindQuiz(view);
  }

  function scriptsIndex() {
    view.innerHTML = `<div class="eyebrow">Авторларға</div><h1 style="margin-bottom:6px">Видеосабақ сценарийлері</h1>
      <p class="muted">Әр сабаққа арналған экран жазбасының сценарийі: не көрсету, не айту, қай жерде тоқтау. Видеоларды өз телефоныңыздың экран жазбасымен түсіруге болады.</p>
      <div class="stack" style="margin-top:18px">${course.modules.map(m => `
        <a class="card tap tool" href="#/scripts/${m.id}"><div class="module-num">${m.num}</div><div><b>${esc(m.title)}</b><span>${m.lessons.length} сценарий</span></div></a>`).join('')}</div>`;
  }

  function notFound() { view.innerHTML = `<h1>Бет табылмады</h1><p class="muted" style="margin-top:10px">Сілтеме қате болуы мүмкін.</p><a class="btn" href="#/">Басты бетке</a>`; }
  function failed(e) {
    view.innerHTML = `<div class="error"><h3>Жүктеу мүмкін болмады</h3><p class="muted" style="margin:8px 0 0">Интернет байланысын тексеріп, бетті жаңартыңыз.<br><small>${esc(e.message)}</small></p></div>`;
  }

  // ---------- router ----------
  const currentRoute = () => location.hash || '#/';
  async function route() {
    const h = currentRoute();
    const parts = h.replace(/^#\/?/, '').split('/');
    const tab = { '': 'home', modules: 'modules', lesson: 'modules', prompts: 'prompts', practice: 'practice', final: 'practice', progress: 'progress', scripts: 'progress' }[parts[0]] || 'home';
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
    window.scrollTo(0, 0);
    switch (parts[0]) {
      case '': homePage(); break;
      case 'modules': modulesPage(parts[1]); break;
      case 'lesson': await lessonPage(parts[1]); break;
      case 'prompts': await promptsPage(); break;
      case 'practice': practicePage(); break;
      case 'progress': progressPage(); break;
      case 'final': await mdPage('content/final-project.md', 'final', 'Финалдық жоба'); break;
      case 'scripts':
        if (parts[1]) await mdPage(`content/video-scripts/${parts[1]}.md`, 'scripts:' + parts[1], 'Видеосабақ сценарийлері');
        else scriptsIndex();
        break;
      default: notFound();
    }
    const title = view.querySelector('h1');
    document.title = (title ? title.textContent + ' · ' : '') + 'AI VIDEO CREATOR';
  }

  async function init() {
    store.load();
    try { course = await getJSON('content/course.json'); } catch (e) { return failed(e); }
    updateRing();
    window.addEventListener('hashchange', route);
    route();
  }
  init();
})();
