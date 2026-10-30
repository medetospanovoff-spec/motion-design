"""Kazakh voiceover + word-level timeline.

Synthesises each scene's line with the offline Piper (ISSAI KazakhTTS) voice,
extracts word timings from phoneme alignments and lays the scenes out on the
beat grid. Writes build/voice/<scene>.wav and build/timeline.json.
"""
import hashlib
import json
import math
import re
import sys
import tarfile
import urllib.request
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
VOICE_DIR = ROOT / "assets" / "voice"  # cached: VITS sampling is not deterministic
SR = 48000


def ensure_model(voice_cfg):
    model = ROOT / voice_cfg["model"]
    if model.exists():
        return model
    model.parent.parent.mkdir(parents=True, exist_ok=True)
    archive = model.parent.parent / "voice.tar.bz2"
    print(f"[tts] downloading voice model {voice_cfg['modelUrl']}")
    urllib.request.urlretrieve(voice_cfg["modelUrl"], archive)
    with tarfile.open(archive) as tar:
        tar.extractall(model.parent.parent, filter="data")
    archive.unlink()
    # Piper only returns phoneme timings from a model patched with the
    # alignment output; patching is idempotent.
    from piper.patch_voice_with_alignment import add_alignment_output
    import onnx

    m = onnx.load(str(model))
    add_alignment_output(m)
    onnx.save(m, str(model))
    return model


def synthesize(voice, text, cfg):
    from piper import SynthesisConfig

    syn = SynthesisConfig(
        speaker_id=cfg["speaker"],
        length_scale=cfg["lengthScale"],
        noise_scale=cfg["noiseScale"],
        noise_w_scale=cfg["noiseWScale"],
    )
    audio, words = [], []
    t = 0.0
    for chunk in voice.synthesize(text, syn, include_alignments=True):
        sr = chunk.sample_rate
        cur, cur_start = [], None
        pos = t
        for al in chunk.phoneme_alignments or []:
            dur = al.num_samples / sr
            ph = al.phoneme
            if ph in (" ", "^", "$", "_") or re.fullmatch(r"[.,!?;:—\-…«»\"]+", ph):
                if cur:
                    words.append({"start": cur_start, "end": pos})
                    cur, cur_start = [], None
            else:
                if cur_start is None:
                    cur_start = pos
                cur.append(ph)
            pos += dur
        if cur:
            words.append({"start": cur_start, "end": pos})
        audio.append(chunk.audio_float_array)
        t += len(chunk.audio_float_array) / sr
    samples = np.concatenate(audio).astype(np.float32)
    return samples, sr, words


def resample(x, sr_in, sr_out):
    from scipy.signal import resample_poly

    g = math.gcd(sr_in, sr_out)
    return resample_poly(x, sr_out // g, sr_in // g).astype(np.float32)


def display_words(text):
    """Split on spaces; glue punctuation-only tokens (e.g. '—') to the previous word."""
    out = []
    for tok in text.split():
        if re.search(r"\w", tok):
            out.append(tok)
        elif out:
            out[-1] += " " + tok
    return out


def write_wav(path, x, sr):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def read_wav(path):
    with wave.open(str(path)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        return x.astype(np.float32) / 32767, w.getframerate()


def main():
    cfg = json.loads((ROOT / "config/script.json").read_text())
    force = "--force" in sys.argv
    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    voice = None

    beat = 60 / cfg["bpm"]
    grid = beat / 2  # scene cuts land on eighth notes
    t = 0.0
    scenes = []
    for i, sc in enumerate(cfg["scenes"]):
        key = hashlib.sha1(json.dumps([sc["tts"], cfg["voice"]], sort_keys=True).encode()).hexdigest()[:12]
        wav_path = VOICE_DIR / f"{i + 1:02d}_{sc['id']}.wav"
        meta_path = wav_path.with_suffix(".json")
        cached = meta_path.exists() and json.loads(meta_path.read_text()).get("key") == key
        if cached and not force:
            meta = json.loads(meta_path.read_text())
            samples, _ = read_wav(wav_path)
        else:
            if voice is None:
                from piper import PiperVoice

                voice = PiperVoice.load(str(ensure_model(cfg["voice"])))
            raw, sr, words = synthesize(voice, sc["tts"], cfg["voice"])
            # trim leading/trailing silence so timings start at the first phoneme
            env = np.abs(raw)
            idx = np.where(env > 0.01)[0]
            a = max(0, idx[0] - int(0.02 * sr))
            b = min(len(raw), idx[-1] + int(0.06 * sr))
            raw = raw[a:b]
            off = a / sr
            words = [{"start": max(0.0, w["start"] - off), "end": max(0.0, w["end"] - off)} for w in words]
            samples = resample(raw, sr, SR)
            samples /= max(1e-6, np.abs(samples).max()) / 0.95
            write_wav(wav_path, samples, SR)
            meta = {"key": key, "words": words}
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        dur = len(samples) / SR

        shown = display_words(sc["display"])
        timed = meta["words"]
        if len(timed) != len(shown):
            # fall back to length-proportional timing
            print(f"[tts] {sc['id']}: {len(timed)} timed vs {len(shown)} shown words, using proportional timing")
            weights = np.array([len(w) + 2 for w in shown], float)
            edges = np.concatenate([[0], np.cumsum(weights)]) / weights.sum() * dur
            timed = [{"start": edges[k], "end": edges[k + 1]} for k in range(len(shown))]

        vo_start = t + sc["voLead"]
        length = max(sc["minDuration"], sc["voLead"] + dur + sc["tail"])
        length = math.ceil(length / grid - 1e-6) * grid
        scenes.append({
            "id": sc["id"],
            "index": i + 1,
            "label": sc["label"],
            "start": round(t, 4),
            "end": round(t + length, 4),
            "display": sc["display"],
            "prompt": sc.get("prompt"),
            "voice": {"file": str(wav_path.relative_to(ROOT)), "start": round(vo_start, 4), "duration": round(dur, 4)},
            "words": [
                {"text": w, "start": round(vo_start + tw["start"], 4), "end": round(vo_start + tw["end"], 4)}
                for w, tw in zip(shown, timed)
            ],
        })
        print(f"[tts] {sc['id']:9s} {t:6.2f}–{t + length:6.2f}s  voice {dur:.2f}s")
        t += length

    if t > cfg["maxDuration"]:
        print(f"[tts] WARNING: total {t:.2f}s exceeds maxDuration {cfg['maxDuration']}s")
    timeline = {
        "width": cfg["width"], "height": cfg["height"], "fps": cfg["fps"], "bpm": cfg["bpm"],
        "duration": round(t, 4), "scenes": scenes,
    }
    (BUILD / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1))
    print(f"[tts] total {t:.2f}s -> build/timeline.json")


if __name__ == "__main__":
    main()
