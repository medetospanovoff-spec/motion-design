"""Procedural soundtrack: 120 BPM music bed + cue-synced SFX + processed Kazakh voiceover.

Reads build/timeline.json and build/cues.json, writes build/audio/{music,sfx,voice,mix}.wav.
Everything is synthesised with numpy, so the track is original and reproducible.
"""
import json
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
SR = 48000
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- utilities
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output="sos")
    return sosfilt(sos, x)


def env_exp(n, decay):
    return np.exp(-np.arange(n) / SR / decay)


def adsr(n, a=0.005, r=0.05):
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def add(buf, sig, t, gain=1.0):
    i = int(round(t * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i] * gain


def saw(f, t):
    return 2 * ((f * t) % 1.0) - 1


def note(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def reverb(x, seconds=1.6, mix=0.25, damp=3500):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (seconds / 5))
    ir = filt(ir, "low", damp)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(x, ir)[: len(x)]
    return x * (1 - mix) + wet * mix


def write_wav(path, x):
    x = np.atleast_2d(x)
    if x.shape[0] == 1:
        x = np.vstack([x, x])
    pcm = (np.clip(x.T, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def read_mono(path):
    with wave.open(str(path)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32767
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(1)
        return x


# ---------------------------------------------------------------- instruments
def kick(gain=1.0, length=0.45):
    t = t_axis(length)
    f = 45 + 130 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.16)
    click = filt(rng.standard_normal(len(t)), "high", 3000) * np.exp(-t / 0.004) * 0.3
    return (np.tanh((body + click) * 1.8) * gain).astype(np.float32)


def clap(gain=1.0):
    t = t_axis(0.35)
    n = filt(rng.standard_normal(len(t)), "band", [900, 5000])
    e = np.zeros(len(t))
    for k, d in enumerate([0, 0.011, 0.022]):
        i = int(d * SR)
        e[i:] += np.exp(-(t[: len(t) - i]) / (0.012 if k < 2 else 0.12))
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.4
    return (n * e * 0.6 + tone) * gain


def hat(gain=1.0, open_=False):
    t = t_axis(0.25 if open_ else 0.06)
    n = filt(rng.standard_normal(len(t)), "high", 7500)
    return n * np.exp(-t / (0.07 if open_ else 0.015)) * gain


def pluck(freq, dur, gain=1.0, cutoff=3200):
    t = t_axis(dur)
    x = saw(freq, t) + saw(freq * 1.006, t) * 0.6
    x = filt(x, "low", cutoff)
    return x * np.exp(-t / 0.13) * adsr(len(t), 0.002, 0.02) * gain


def bass(freq, dur, gain=1.0):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.tanh(3 * np.sin(2 * np.pi * freq * t))
    return x * adsr(len(t), 0.004, 0.03) * gain


def pad(freqs, dur, gain=1.0):
    t = t_axis(dur)
    x = sum(saw(f * d, t) for f in freqs for d in (0.996, 1.0, 1.004))
    x = filt(x, "low", 1400)
    return x * adsr(len(t), 0.25, 0.4) * gain / (len(freqs) * 3)


# ---------------------------------------------------------------- sfx
def noise(n):
    return rng.standard_normal(n)


def sfx(cue):
    typ = cue["type"]
    g = cue.get("gain", 1.0)
    pitch = cue.get("pitch", 1.0)
    if typ == "impact":
        t = t_axis(0.9)
        sub = np.sin(2 * np.pi * np.cumsum(38 + 90 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.3)
        crack = filt(noise(len(t)), "band", [400, 6000]) * np.exp(-t / 0.05)
        return np.tanh(1.6 * (sub + crack * 0.7)) * 0.9 * g
    if typ == "boom":
        t = t_axis(1.8)
        sub = np.sin(2 * np.pi * np.cumsum(30 + 80 * np.exp(-t / 0.1)) / SR) * np.exp(-t / 0.6)
        rumble = filt(noise(len(t)), "low", 900) * np.exp(-t / 0.4) * 0.7
        crack = filt(noise(len(t)), "high", 2000) * np.exp(-t / 0.03) * 0.6
        return reverb(np.tanh(1.5 * (sub + rumble + crack)), 1.5, 0.3) * g
    if typ == "whoosh":
        d = cue.get("dur", 0.3) + 0.15
        t = t_axis(d)
        n = noise(len(t))
        x = np.zeros(len(t))
        # sweep a band through the noise by blending three filtered copies
        bands = [filt(n, "band", b) for b in ([300, 900], [900, 2500], [2500, 7000])]
        p = t / d
        if cue.get("rise"):
            w = [np.clip(1 - 2 * p, 0, 1), 1 - np.abs(2 * p - 1), np.clip(2 * p - 1, 0, 1)]
            e = np.sin(np.pi * np.clip(p * 1.05, 0, 1)) ** 2 * (0.4 + 0.6 * p)
        else:
            w = [np.clip(2 * p - 1, 0, 1), 1 - np.abs(2 * p - 1), np.clip(1 - 2 * p, 0, 1)]
            e = np.sin(np.pi * p) ** 1.5
        for b, ww in zip(bands, w):
            x += b * ww
        return x * e * 0.55 * g
    if typ == "pop":
        t = t_axis(0.12)
        f = 520 * pitch * (1 + 1.2 * np.exp(-t / 0.012))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035) * 0.6 * g
    if typ == "boing":
        t = t_axis(0.25)
        f = 300 * pitch * (1 + 0.5 * np.sin(2 * np.pi * 18 * t) * np.exp(-t / 0.08))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.08) * 0.5 * g
    if typ in ("click", "key"):
        t = t_axis(0.06)
        x = filt(noise(len(t)), "band", [1500, 6000]) * np.exp(-t / 0.006)
        x += np.sin(2 * np.pi * (1800 if typ == "click" else 900) * t) * np.exp(-t / 0.01) * 0.5
        return x * 0.7 * g
    if typ == "tick1":
        t = t_axis(0.03)
        return np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.004) * 0.5 * g
    if typ == "type":
        d = cue["t1"] - cue["t"]
        out = np.zeros(int((d + 0.1) * SR))
        k, tt = 0, 0.0
        while tt < d:
            t = t_axis(0.03)
            c = filt(noise(len(t)), "band", [2000, 7000]) * np.exp(-t / 0.004)
            c += np.sin(2 * np.pi * (1100 + 400 * rng.random()) * t) * np.exp(-t / 0.006) * 0.3
            add(out, c, tt, 0.5 + 0.5 * rng.random())
            tt += 0.045 + 0.04 * rng.random()
            k += 1
        return out * g
    if typ == "tick":
        d = cue["t1"] - cue["t"]
        out = np.zeros(int((d + 0.1) * SR))
        tt, k = 0.0, 0
        while tt < d:
            t = t_axis(0.04)
            c = np.sin(2 * np.pi * (3200 if k % 2 else 2400) * t) * np.exp(-t / 0.005)
            add(out, c, tt)
            # ticks accelerate like a clock being fast-forwarded
            tt += max(0.035, 0.16 * (1 - tt / d) ** 1.5)
            k += 1
        return out * 0.5 * g
    if typ == "buzz":
        t = t_axis(cue.get("dur", 0.25))
        x = np.sign(np.sin(2 * np.pi * 110 * t)) * 0.5 + np.sign(np.sin(2 * np.pi * 116 * t)) * 0.5
        return filt(x, "low", 2500) * adsr(len(t), 0.005, 0.05) * 0.35 * g
    if typ == "glitch":
        t = t_axis(cue.get("dur", 0.2))
        x = noise(len(t))
        hold = 120
        x = np.repeat(x[::hold], hold)[: len(t)]
        x *= (np.sin(2 * np.pi * 37 * t) > 0)
        return filt(x, "band", [300, 6000]) * 0.4 * g
    if typ == "riserShort":
        d = cue["t1"] - cue["t"]
        t = t_axis(d)
        f = 300 + 1200 * (t / d) ** 2
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + filt(noise(len(t)), "high", 2000) * 0.25
        return x * (t / d) ** 1.5 * g
    if typ == "success":
        out = np.zeros(int(0.9 * SR))
        for k, n_ in enumerate([76, 83, 88]):
            t = t_axis(0.6)
            s = (np.sin(2 * np.pi * note(n_) * t) + 0.3 * np.sin(4 * np.pi * note(n_) * t)) * np.exp(-t / 0.18)
            add(out, s, k * 0.07, 0.35)
        return reverb(out, 1.0, 0.3) * g
    if typ == "send":
        t = t_axis(0.3)
        f = 600 + 1400 * (t / 0.3)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.08) * 0.45 * g
    if typ == "final":
        t = t_axis(2.6)
        chord = sum(np.sin(2 * np.pi * note(n_) * t) for n_ in (57, 64, 69, 72, 76)) / 5
        sub = np.sin(2 * np.pi * np.cumsum(35 + 70 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.5)
        crack = filt(noise(len(t)), "high", 1500) * np.exp(-t / 0.05) * 0.5
        return reverb(np.tanh(sub * 1.4 + crack) + chord * np.exp(-t / 0.9) * 0.6, 2.2, 0.35) * g
    raise ValueError(typ)


# ---------------------------------------------------------------- music
def music(tl, cues):
    dur = tl["duration"] + 2.5
    beat = 60 / tl["bpm"]
    n = int(dur * SR)
    drums, bassb, synth = np.zeros(n), np.zeros(n), np.zeros(n)
    scenes = {s["id"]: s for s in tl["scenes"]}
    # music stops on the final CTA hit so the ending lands cleanly
    end_hit = next((c["t"] for c in cues if c["type"] == "final"), tl["duration"] - 1.5)
    # Am - F - C - G (one bar each)
    prog_ = [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [55, 60, 64]), (43, [55, 59, 62])]
    arp_pat = [0, 1, 2, 1, 2, 0, 1, 2]

    def energy(t):
        if t < scenes["problem"]["start"]:
            return "full"
        if t < scenes["solution"]["start"]:
            return "low"
        if t < scenes["solution"]["words"][-1]["start"]:
            return "build"
        return "full"

    bars = int(dur / (4 * beat)) + 1
    for b in range(bars):
        root, chord = prog_[b % 4]
        bt = b * 4 * beat
        if bt < end_hit:
            add(synth, pad([note(x) for x in chord], 4 * beat + 0.4, 0.5), bt)
        for st in range(16):
            t = bt + st * beat / 4
            if t >= end_hit - 0.01:
                break
            e = energy(t)
            if st % 4 == 0 and (e == "full" or (e != "full" and st % 8 == 0)):
                add(drums, kick(0.9), t)
            if st in (4, 12) and e != "low":
                add(drums, clap(0.55), t)
            if e == "full" and st % 2 == 1:
                add(drums, hat(0.22), t)
            if e == "full" and st in (6, 14):
                add(drums, hat(0.18, open_=True), t)
            if e == "build":
                add(drums, hat(0.12 + 0.2 * (st / 16)), t)
            if st % 2 == 0 and e != "build":
                bf = note(root) * (2 if st % 4 == 2 else 1)
                add(bassb, bass(bf, beat / 2 * 0.9, 0.45 if e == "full" else 0.3), t)
            if e != "low" or st % 2 == 0:
                f = note(chord[arp_pat[st % 8]] + 12)
                add(synth, pluck(f, 0.25, 0.22, 4200 if e == "full" else 1600), t)

    # sidechain pump on bass + synth from the kick grid
    tt = np.arange(n) / SR
    phase = (tt % beat) / beat
    pump = 0.45 + 0.55 * np.clip(phase / 0.35, 0, 1) ** 0.7
    pump[tt >= end_hit] = 1
    mus = drums * 0.9 + (bassb + synth) * pump
    # gentle low-pass "underwater" feel in the problem scene
    lo = filt(mus, "low", 900)
    m = np.zeros(n)
    a, bnd = scenes["problem"]["start"], scenes["solution"]["start"]
    m[int(a * SR):int(bnd * SR)] = 1
    m = np.convolve(m, np.ones(2400) / 2400, mode="same")
    mus = mus * (1 - m) + lo * m * 1.3
    # build riser into the solution drop
    rs, re_ = scenes["solution"]["start"] + 0.5, scenes["solution"]["words"][-1]["start"]
    t = t_axis(re_ - rs)
    riser = filt(rng.standard_normal(len(t)), "high", 1500) * (t / t[-1]) ** 2 * 0.25
    add(mus, riser, rs)
    mus = reverb(mus, 1.2, 0.12)
    mus *= np.clip((tl["duration"] + 1.5 - tt) / 1.5, 0, 1)  # tail fade after the end
    return mus / (np.abs(mus).max() + 1e-9) * 0.8


# ---------------------------------------------------------------- voice
def compress(x, thr=0.25, ratio=3.5, att=0.003, rel=0.08):
    env = np.zeros_like(x)
    a, r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    lvl = 0.0
    ax = np.abs(x)
    for i in range(len(x)):
        c = a if ax[i] > lvl else r
        lvl = c * lvl + (1 - c) * ax[i]
        env[i] = lvl
    gain = np.where(env > thr, (thr + (env - thr) / ratio) / np.maximum(env, 1e-9), 1.0)
    return x * gain


def voice_track(tl, n):
    out = np.zeros(n)
    for sc in tl["scenes"]:
        v = read_mono(ROOT / sc["voice"]["file"])
        v = filt(v, "high", 85)
        # presence lift + warmth
        v = v + 0.35 * filt(v, "band", [2500, 6000]) + 0.15 * filt(v, "band", [120, 300])
        v = compress(v / (np.abs(v).max() + 1e-9))
        add(out, v, sc["voice"]["start"])
    return out / (np.abs(out).max() + 1e-9) * 0.9


def main():
    tl = json.loads((BUILD / "timeline.json").read_text())
    cues = json.loads((BUILD / "cues.json").read_text())
    (BUILD / "audio").mkdir(exist_ok=True)
    mus = music(tl, cues)
    n = len(mus)
    fx = np.zeros(n)
    for c in cues:
        add(fx, sfx(c), c["t"])
    fx = fx / (np.abs(fx).max() + 1e-9) * 0.8
    vo = voice_track(tl, n)

    # duck music under the voice
    env = np.convolve(np.abs(vo), np.ones(2400) / 2400, mode="same")
    env = np.clip(env / 0.05, 0, 1)
    env = np.convolve(env, np.ones(9600) / 9600, mode="same")
    duck = 1 - 0.55 * env

    mix = vo * 1.0 + mus * 0.42 * duck + fx * 0.5
    # light stereo: music/sfx slightly widened with a short delay, voice centred
    side = (mus * 0.42 * duck + fx * 0.5)
    delayed = np.concatenate([np.zeros(int(0.012 * SR)), side])[:n]
    L = mix + 0.12 * (side - delayed)
    R = mix - 0.12 * (side - delayed)
    st = np.vstack([L, R])
    st = np.tanh(st * 1.1) / np.tanh(1.1)
    st = st / (np.abs(st).max() + 1e-9) * 0.95
    st = st[:, : int((tl["duration"] + 0.05) * SR)]
    write_wav(BUILD / "audio/music.wav", mus)
    write_wav(BUILD / "audio/sfx.wav", fx)
    write_wav(BUILD / "audio/voice.wav", vo)
    write_wav(BUILD / "audio/mix.wav", st)
    print(f"[audio] mix {st.shape[1] / SR:.2f}s -> build/audio/mix.wav")


if __name__ == "__main__":
    main()
