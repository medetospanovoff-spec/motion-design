// QA for the course site (docs/): opens every page at phone size and checks content + layout.
//   python3 -m http.server 8765 --directory docs &   then   node scripts/check_course.js [--shots]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8765/';
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'build', 'course-shots');
const course = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/content/course.json'), 'utf8'));
const SECTIONS = ['Сабақ мақсаты', 'Түсіндірме', 'Қадамдар', 'Практикалық тапсырма', 'Күтілетін нәтиже', 'Жиі қателер', 'Тексеру сұрақтары'];

(async () => {
  const shots = process.argv.includes('--shots');
  if (shots) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const problems = [];
  page.on('pageerror', e => problems.push('JS error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });

  const visit = async (hash, name) => {
    await page.goto(BASE + hash);
    await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 10000 });
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) problems.push(`${hash}: horizontal overflow ${overflow}px`);
    if (shots && name) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false });
  };

  for (const [hash, name] of [['#/', 'home'], ['#/modules', 'modules'], ['#/prompts', 'prompts'], ['#/practice', 'practice'],
    ['#/progress', 'progress'], ['#/final', 'final'], ['#/scripts', 'scripts'], ['#/scripts/m04', 'scripts-m04']]) await visit(hash, name);

  let quizCount = 0, promptCount = 0;
  for (const m of course.modules) for (const l of m.lessons) {
    await visit('#/lesson/' + l.id, l.id === 'm02-l05' || l.id === 'm03-l04' ? 'lesson-' + l.id : null);
    const info = await page.evaluate(() => ({
      h1: document.querySelector('.md h1')?.textContent || '',
      h2: [...document.querySelectorAll('.md h2')].map(h => h.textContent),
      quiz: document.querySelectorAll('.q').length,
      prompts: document.querySelectorAll('.md .prompt').length,
      badQuiz: [...document.querySelectorAll('.q')].filter(q => q.querySelectorAll('.q-opt[data-ok="1"]').length !== 1).length,
    }));
    if (info.h1.trim() !== l.title) problems.push(`${l.id}: title mismatch "${info.h1}" vs "${l.title}"`);
    for (const s of SECTIONS) if (!info.h2.some(h => h.includes(s))) problems.push(`${l.id}: missing section ${s}`);
    if (info.quiz < 3) problems.push(`${l.id}: only ${info.quiz} quiz questions`);
    if (info.badQuiz) problems.push(`${l.id}: ${info.badQuiz} questions without exactly one right answer`);
    quizCount += info.quiz; promptCount += info.prompts;
  }

  // interactions: quiz answer, copy, mark lesson done, progress, prompt filter
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await visit('#/lesson/m01-l01');
  await page.click('.q .q-opt[data-ok="1"]');
  await page.click('.prompt .copy');
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  if (!clip.includes('мейірімді мұғалімсің')) problems.push('copy button did not copy prompt text');
  await page.click('#markDone');
  await visit('#/progress', shots ? 'progress-after' : null);
  const pct = await page.textContent('#ringPct');
  if (pct === '0%') problems.push('progress ring did not update after completing a lesson');
  await visit('#/prompts');
  const total = await page.locator('#plist .prompt').count();
  await page.click('.filter[data-cat="fix"]');
  const fix = await page.locator('#plist .prompt').count();
  if (!(fix > 0 && fix < total)) problems.push(`prompt filter broken (${fix}/${total})`);
  await page.fill('.search', 'субтитр');
  await page.click('.filter[data-cat="all"]');
  if (shots) await page.screenshot({ path: path.join(SHOTS, 'prompts-search.png') });
  await visit('#/final');
  await page.check('.md li.task input >> nth=0');
  await page.reload(); await page.waitForTimeout(300);
  if (!(await page.isChecked('.md li.task input >> nth=0'))) problems.push('final-project checkbox not persisted');

  await browser.close();
  const lessons = course.modules.reduce((a, m) => a + m.lessons.length, 0);
  console.log(`lessons: ${lessons}, quiz questions: ${quizCount}, lesson prompts: ${promptCount}, library prompts: ${total}`);
  if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
  console.log('OK — no problems found');
})();
