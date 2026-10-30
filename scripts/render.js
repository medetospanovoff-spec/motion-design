// Headless renderer: drives src/index.html frame by frame and pipes PNGs into ffmpeg.
//   node scripts/render.js            -> build/video.mp4 (silent, 1080x1920)
//   node scripts/render.js --cues     -> build/cues.json (sound-effect events)
//   node scripts/render.js --stills 0.5,3.2,...  -> build/stills/*.png
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const args = process.argv.slice(2);
const arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

async function openPage(browser, timeline) {
  const page = await browser.newPage({ viewport: { width: timeline.width, height: timeline.height }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('[page]', e.message); process.exitCode = 1; });
  await page.addInitScript(tl => { window.__TIMELINE__ = tl; }, timeline);
  await page.goto('file://' + path.join(ROOT, 'src/index.html'));
  await page.evaluate(() => window.__ready);
  return page;
}

async function main() {
  const timeline = JSON.parse(fs.readFileSync(path.join(BUILD, 'timeline.json'), 'utf8'));
  const browser = await chromium.launch();
  try {
    if (args.includes('--cues')) {
      const page = await openPage(browser, timeline);
      const cues = await page.evaluate(() => window.getCues());
      fs.writeFileSync(path.join(BUILD, 'cues.json'), JSON.stringify(cues, null, 1));
      console.log(`[render] ${cues.length} cues -> build/cues.json`);
      return;
    }
    if (arg('--stills')) {
      const dir = path.join(BUILD, 'stills');
      fs.mkdirSync(dir, { recursive: true });
      const page = await openPage(browser, timeline);
      // render sequentially from 0 so any frame-history state matches the real render
      for (const ts of arg('--stills').split(',').map(Number)) {
        await page.evaluate(t => window.renderFrame(t), ts);
        await page.screenshot({ path: path.join(dir, `t${ts.toFixed(2).padStart(6, '0')}.png`) });
      }
      console.log(`[render] stills -> ${dir}`);
      return;
    }

    const fps = timeline.fps;
    const total = Math.round(timeline.duration * fps);
    const workers = Number(arg('--workers') || 4);
    const out = path.join(BUILD, 'video.mp4');
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));

    const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser, timeline)));
    const done = new Map();
    let next = 0, written = 0;
    const t0 = Date.now();
    const flush = async () => {
      while (done.has(written)) {
        const buf = done.get(written); done.delete(written);
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        written++;
        if (written % 60 === 0) console.log(`[render] ${written}/${total} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    };
    let flushing = Promise.resolve();
    await Promise.all(pages.map(async page => {
      while (true) {
        const f = next++;
        if (f >= total) break;
        // keep at most ~3 frames per worker buffered ahead of the writer
        while (f - written > workers * 3) await new Promise(r => setTimeout(r, 5));
        await page.evaluate(t => window.renderFrame(t), f / fps);
        done.set(f, await page.screenshot({ type: 'png' }));
        flushing = flushing.then(flush);
      }
    }));
    await flushing;
    ff.stdin.end();
    await ffDone;
    console.log(`[render] ${total} frames -> ${path.relative(ROOT, out)} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
