# motion-design

Code-only pipeline that turns one script file into a finished vertical Reel/TikTok,
**without any video editor**. The first video it makes is a 30-second Kazakh-language
AI Reel: *«Мұндай видеоларды өзің жасай аласың!»*

**Result:** `output/ai_reels_kz.mp4` — 1080×1920, 30 fps, H.264 High / AAC 48 kHz, ~29.75 s, −14 LUFS

| File | What it is |
|---|---|
| `output/ai_reels_kz.mp4` | final video with voiceover, music, SFX and on-screen subtitles |
| `output/ai_reels_kz.srt` | synchronized Kazakh subtitles (to upload as captions) |
| `output/ai_reels_kz_voiceover.wav` | clean Kazakh voiceover track |

## How to generate it

```bash
pip install piper-tts onnx scipy soundfile numpy   # offline Kazakh TTS + audio DSP
python3 generate.py                                # everything, end to end
```

Requirements: Python 3, Node 18+ with Playwright + Chromium, and ffmpeg. The first run
downloads the ISSAI Kazakh Piper voice (~130 MB) into `assets/models/`.

To make a new video, edit **`config/script.json`** (the text per scene, the voice and
the timing limits) and run `generate.py` again. Scene lengths, subtitle timing and
sound effects all follow the new voiceover on their own.

## Pipeline

1. **`scripts/tts.py`** synthesizes each scene's line with the offline Piper VITS
   voice (ISSAI KazakhTTS, male speaker). Word timestamps come from the phoneme
   alignments, and scene cuts are snapped to the 120 BPM eighth-note grid. Output:
   `build/timeline.json`. Voice clips are cached in `assets/voice/`, because VITS
   sampling is random.
2. **`src/`** (`index.html`, `lib.js`, `scenes.js`, `main.js`) is the motion-graphics
   engine. Every frame is a pure function of time `t`, built from DOM, SVG and Canvas
   (stateless flow-field particles, sparks, rays). Each scene also declares its own
   sound-effect cues.
3. **`scripts/render.js`** drives headless Chromium frame by frame with 4 parallel
   pages and streams the PNGs into ffmpeg/x264.
4. **`scripts/audio.py`** synthesizes the music with numpy (kick, clap, hats,
   side-chained bass, plucks, pads; Am–F–C–G at 120 BPM). It adds the cue-synced SFX
   (impacts, whooshes, typing, clock ticks, glitch, success chime, final hit) and
   processes the voice (EQ, compression, music ducking).
5. **`generate.py`** muxes video and audio, normalizes loudness to −14 LUFS, and
   writes the `.srt` and voiceover files.

QC helpers: `node scripts/render.js --stills 0.5,3.2,…` renders single frames;
`python3 scripts/contact_sheet.py out.png build/stills/*.png` tiles them into one image.

## Creative direction (from the reference video)

The reference (`18cf83a20f1e4e969b5ad85a82051d24.mov`) uses Swiss/brutalist kinetic
typography. Its traits, and how this video reuses them:

- **Palette:** navy, signal orange, paper grey-blue and electric blue, alternating
  on hard cuts → the same colour system, with colours switching on every spoken word
  in the hook.
- **Type:** heavy condensed caps for headlines, widely tracked monospace labels, a
  small italic serif for asides → Fira Sans Extra Condensed Black, JetBrains Mono and
  PT Serif Italic. All three cover the full Kazakh alphabet.
- **HUD frame:** corner brackets, a "scene NN / NN" counter, a timecode and a
  progress bar.
- **Devices:** typewriter labels with a red cursor, a racing timer
  (0:00:00 → 3:00:00), outlined marquee text behind a solid word, a script-to-AI card
  flow, flow-field particles, glow and ray bursts, strike-throughs and zoom punches.
- **Pacing:** a visual change roughly every 0.3–0.8 s, a hook in the first frame,
  word-level sync between voice, text and SFX, and a clean final frame.

Scenes: 1 hook · 2 problem · 3 solution (prompt → render → phone) · 4 demo
(editing / animation / subtitles / VFX → "1") · 5 offer («НӨЛДЕН») · 6 CTA
(comment box typing «AI»).

## AI VIDEO CREATOR — курс (docs/)

Қазақ тіліндегі мобильді курс: «AI VIDEO CREATOR — Нөлден алғашқы AI-видеоға дейін». It teaches someone with only a
smartphone to make a vertical video with ChatGPT, GitHub and Claude Code (the same method that produced the video above).

- **Platform:** `docs/`, a static mobile-first site in plain HTML/CSS/JS with no build step and no backend. Progress is
  saved in the browser's `localStorage`.
- **Content:** written in Markdown. `docs/content/course.json` lists the 6 modules and 37 lessons; the lessons are in
  `docs/content/lessons/*.md`. The prompt library is `docs/content/prompts.json` (35 prompts); the final project is
  `docs/content/final-project.md`; the screen-recording scripts are in `docs/content/video-scripts/`.
- **Lesson extensions:** a ```` ```prompt ```` block becomes a card with a Copy button, a ```` ```quiz ```` block becomes an
  interactive quiz, and `- [ ]` checklists are saved per device.
- **Publish:** GitHub → Settings → Pages → *Deploy from a branch* → choose the branch and the `/docs` folder → Save.
  The site appears at `https://<user>.github.io/<repo>/`. On a free plan this requires a public repository.
- **Local preview and QA:** `python3 -m http.server 8765 --directory docs`, then `node scripts/check_course.js --shots`.
  This opens every page at phone size and checks lesson structure, quizzes, copy, progress and layout overflow.

## Licences

Fonts are under the SIL Open Font License (Fira Sans Extra Condensed, PT Serif,
JetBrains Mono, Inter; OFL texts are in `assets/fonts/`). The voice is the
ISSAI KazakhTTS Piper model, trained on the IS2AI Kazakh_TTS dataset (CC-BY-4.0). All music, SFX and graphics are
procedurally generated by this repository.
