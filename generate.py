#!/usr/bin/env python3
"""One-command pipeline: config/script.json -> output/ai_reels_kz.mp4

  python3 generate.py            # full build (voice, cues, audio, frames, mux, subtitles)
  python3 generate.py --force-tts  # re-synthesise the voiceover too

Steps:
  1. scripts/tts.py      Kazakh voiceover (offline Piper / ISSAI) + word timings -> build/timeline.json
  2. scripts/render.js   --cues: sound-effect events from the scene code -> build/cues.json
  3. scripts/audio.py    procedural music + SFX + voice mix -> build/audio/mix.wav
  4. scripts/render.js   headless Chromium renders every frame -> build/video.mp4
  5. ffmpeg mux + loudness normalisation (-14 LUFS) -> output/ai_reels_kz.mp4
  6. subtitles (.srt) + voiceover (.wav) next to the video
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(*cmd):
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=ROOT, check=True)


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(timeline, path, max_chars=40):
    """Subtitle cues: each scene's line split into readable chunks on word timings."""
    cues = []
    for sc in timeline["scenes"]:
        words = sc["words"]
        cur = []
        for i, w in enumerate(words):
            cur.append(w)
            text = " ".join(x["text"] for x in cur)
            nxt = words[i + 1]["text"] if i + 1 < len(words) else ""
            if i + 1 == len(words) or len(text) + 1 + len(nxt) > max_chars or text[-1] in ",.!?":
                cues.append((cur[0]["start"], cur[-1]["end"] + 0.25, text))
                cur = []
    lines = []
    for k, (a, b, text) in enumerate(cues):
        if k + 1 < len(cues):
            b = min(b, cues[k + 1][0] - 0.02)
        lines += [str(k + 1), f"{srt_time(a)} --> {srt_time(b)}", text, ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    cfg = json.loads((ROOT / "config/script.json").read_text())
    out = ROOT / cfg["output"]
    out.parent.mkdir(parents=True, exist_ok=True)

    run(sys.executable, "scripts/tts.py", *(["--force"] if "--force-tts" in sys.argv else []))
    run("node", "scripts/render.js", "--cues")
    run(sys.executable, "scripts/audio.py")
    run("node", "scripts/render.js", "--workers", "4")
    run("ffmpeg", "-y", "-v", "error", "-i", "build/video.mp4", "-i", "build/audio/mix.wav",
        "-map", "0:v", "-map", "1:a", "-c:v", "copy",
        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-shortest", "-movflags", "+faststart", str(out))

    timeline = json.loads((ROOT / "build/timeline.json").read_text())
    write_srt(timeline, out.with_suffix(".srt"))
    run("ffmpeg", "-y", "-v", "error", "-i", "build/audio/voice.wav", "-ac", "1",
        str(out.with_name(out.stem + "_voiceover.wav")))
    print(f"\nDone -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
