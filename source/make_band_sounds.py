"""Panyard Band's built-in pan sounds, from a Panyard sounds file (Pan sounds → Sound → Save my sounds file).
Each note keeps only the part its tuning plays (start to end, plus a short tail), as 16-bit FLAC (lossless, about a
third of the 24-bit WAV), in source/band-sounds/ with a manifest.json that Panyard Band reads the first time it opens.
Usage: python3 source/make_band_sounds.py "My pans - Panyard sounds.json" """
import sys, os, json, base64, io, wave, subprocess, tempfile, hashlib
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'band-sounds')
d = json.load(open(sys.argv[1]))
assert d.get('format') == 'panyard-sounds', 'not a Panyard sounds file'
for f in os.listdir(OUT):
    if f.endswith('.flac') or f == 'manifest.json': os.remove(os.path.join(OUT, f))
def read(b):   # a WAV (16 or 24-bit) into floats
    w = wave.open(io.BytesIO(b)); sr, n, sw, ch = w.getframerate(), w.getnframes(), w.getsampwidth(), w.getnchannels(); raw = w.readframes(n)
    if sw == 3: a = np.frombuffer(raw, np.uint8).reshape(-1, 3); x = (a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16)); x = np.where(x >= 1 << 23, x - (1 << 24), x) / float(1 << 23)
    elif sw == 2: x = np.frombuffer(raw, '<i2') / 32768.0
    else: raise ValueError('sample width %d' % sw)
    return x.reshape(-1, ch).mean(1), sr
files, tune, total = {}, {}, 0
for i, (nid, url) in enumerate(sorted(d['sounds'].items())):
    x, sr = read(base64.b64decode(url.split(',', 1)[1])); T = dict((d.get('tune') or {}).get(nid) or {})
    a = int(max(0, T.get('start') or 0) * sr); e = T.get('end'); b = len(x) if e in (None, '') else min(len(x), int((float(e) + .05) * sr))
    y = x[a:b]
    if e not in (None, ''): T['end'] = round((b - a) / sr, 4)
    T['start'] = 0
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, 'n.wav'); w = wave.open(src, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()); w.close()
        name = '%03d.flac' % i; subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c:a', 'flac', '-compression_level', '8', os.path.join(OUT, name)], check=True)
    files[nid] = name; tune[nid] = T; total += os.path.getsize(os.path.join(OUT, name))
man = {'format': 'panyard-band-sounds', 'name': d.get('name') or 'Band pans', 'sets': d.get('sets'), 'files': files, 'tune': tune,
       'fx': d.get('fx'), 'borrow': d.get('borrow'), 'savedAt': d.get('savedAt')}
man['version'] = hashlib.sha1(json.dumps(man, sort_keys=True).encode()).hexdigest()[:10]
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=0)
print(len(files), 'notes,', round(total / 1e6, 1), 'MB of FLAC, version', man['version'])
