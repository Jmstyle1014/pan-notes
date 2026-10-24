#!/usr/bin/env python3
"""Measure a steelband recording: tuning, tone balance, ring, the pitched hum between hits, and clipping.
Usage: analyze.py <recording> [<recording> ...]   (any format ffmpeg reads; needs ffmpeg and numpy)"""
import subprocess, sys
import numpy as np

SR = 48000
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(float)

def analyze(path):
    x = load(path)
    N, H = 8192, 2048
    fr = np.lib.stride_tricks.sliding_window_view(x, N)[::H] * np.hanning(N)
    S = np.abs(np.fft.rfft(fr, axis=1)) ** 2
    f = np.fft.rfftfreq(N, 1 / SR)
    e = S.sum(1)
    print('==', path)
    print('  length %.1f s, loudness %.1f dB' % (len(x) / SR, 10 * np.log10((x ** 2).mean() + 1e-12)))
    clip = (np.abs(x) > 0.99).mean() * 100
    print('  clipping: %.2f%% of the sound%s' % (clip, '  <- too loud or too close: some hits are distorted' if clip > 0.05 else ''))
    # tuning: the strongest peak a moment after each loud onset, its offset from A 440 in cents
    env = 10 * np.log10(e + 1e-12)
    onsets = [i for i in range(3, len(env) - 3) if env[i] - env[i - 2] > 4 and env[i] == env[i - 2:i + 3].max()]
    cents, alone = [], 0
    band = (f > 120) & (f < 3000)
    for k, i in enumerate(onsets):
        m = S[min(i + 1, len(S) - 1)] * band
        j = int(m.argmax())
        if j < 2 or j > len(m) - 3:
            continue
        a, b, c = np.log(m[j - 1] + 1e-20), np.log(m[j] + 1e-20), np.log(m[j + 1] + 1e-20)
        fq = (j + .5 * (a - c) / (a - 2 * b + c)) * SR / N
        midi = 69 + 12 * np.log2(fq / 440)
        cents.append((midi - round(midi)) * 100)
        gap = (onsets[k + 1] - i) * H / SR if k + 1 < len(onsets) else 9
        peaks = int((m > m.max() * .25).sum())
        if gap > .6 and peaks <= 6:
            alone += 1
    if cents:
        c = float(np.median(cents))
        print('  tuning: about A = %.1f Hz (%+.0f cents from 440), from %d notes' % (440 * 2 ** (c / 1200), c, len(cents)))
    print('  notes that may stand alone (check by ear before cutting samples): %d of %d' % (alone, len(onsets)))
    # tone balance in 1/3 octaves, relative to the loudest band
    cen = [c for c in (25 * 2 ** (i / 3) for i in range(30)) if 60 < c < 12000]
    lt = np.array([10 * np.log10(S[:, (f >= c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))].sum(1).mean() + 1e-20) for c in cen])
    lt -= lt.max()
    print('  tone balance (dB):', ' '.join('%d:%.0f' % (c, v) for c, v in zip(cen, lt)))
    top = lt[[i for i, c in enumerate(cen) if c > 3000]].mean()
    print('  top end above 3 kHz: %.0f dB%s' % (top, ' (warm, rolled-off yard)' if top < -18 else ''))
    # ring: how fast loud moments fade
    d = [(env[i] - env[i + 8]) / (8 * H / SR) for i in range(5, len(env) - 12) if env[i] == env[i - 5:i + 6].max() and env[i] - env[i + 8] > 3]
    if d:
        print('  ring: notes fade about %.0f dB per second (lower = longer ring)' % np.median(d))
    # hum: the quiet moments vs the loud ones, and which notes keep sounding there
    q = S[e < np.percentile(e, 15)].mean(0)
    l = S[e > np.percentile(e, 50)].mean(0)
    ch = np.zeros(12)
    for k in range(len(f)):
        if 60 < f[k] < 2000:
            ch[int(round(12 * np.log2(f[k] / 440) + 69)) % 12] += q[k]
    ch /= ch.max()
    keys = [NAMES[i] for i in np.argsort(-ch)[:6] if ch[i] > .45]
    print('  hum: quiet moments are %.1f dB below the loud ones; still ringing there: %s'
          % (-10 * np.log10(q.sum() / l.sum()), ', '.join(keys)))
    print('  hum weights by note (for Yard hum):', ', '.join('%s %.2f' % (NAMES[i], ch[i]) for i in range(12)))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for p in sys.argv[1:]:
        analyze(p)
