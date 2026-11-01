"""A studio sound pack for one pan set, from a sample library with one WAV per note per loudness (e.g. the Dunleavy
Double Seconds: "A#4v1.wav" … "A#4v7.wav"). For each of the pan's notes it keeps a few loudness layers, mono, trimmed
to the strike and its ring (with a short fade), and measures each note's pitch so a cents correction lands it on A 440
(the apps tune to the band's A from there). Out: packs/<pack>/ (16-bit FLAC + pack.json), served at /pan-notes/packs/.
Usage: python3 source/make_sound_pack.py <folder or .zip of WAVs> <set key> <pack name> "<title>" "<credit>" "<licence>"
       [--layers 1,3,5,7]"""
import sys, os, io, re, json, wave, zipfile, subprocess, tempfile, hashlib
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
src, setkey, pack, title, credit, licence = args
LAYERS = [int(v) for v in opts.get('layers', '1,3,5,7').split(',')]
OUT = os.path.join(ROOT, 'packs', pack)
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def midi(name):
    m = re.match(r'([A-G])([#b]?)(-?\d)$', name)
    return 12 * (int(m.group(3)) + 1) + PC[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)]

def read(b):   # a WAV (16, 24 or 32-bit, any channels) into mono floats
    if b[20:22] == b'\xfe\xff':   # WAVE_FORMAT_EXTENSIBLE: Python's wave module wants plain PCM
        b = b[:20] + b'\x01\x00' + b[22:]
    w = wave.open(io.BytesIO(b)); sr, n, sw, ch = w.getframerate(), w.getnframes(), w.getsampwidth(), w.getnchannels(); raw = w.readframes(n)
    if sw == 3:
        a = np.frombuffer(raw, np.uint8).reshape(-1, 3)
        x = a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16)
        x = np.where(x >= 1 << 23, x - (1 << 24), x) / float(1 << 23)
    elif sw == 2: x = np.frombuffer(raw, '<i2') / 32768.0
    elif sw == 4: x = np.frombuffer(raw, '<i4') / 2147483648.0
    else: raise ValueError('sample width %d' % sw)
    return x.reshape(-1, ch).mean(1), sr

def cut(x, sr):   # from just before the strike to where the ring has faded (at most 4.5 s), with a 0.25 s fade
    env = np.abs(x); pk = env.max() or 1
    a = max(0, int(np.argmax(env > pk * 0.01)) - int(0.004 * sr))
    hop = int(0.02 * sr); e = len(x)
    for i in range(a + int(0.3 * sr), len(x), hop):
        if env[i:i + hop].max() < pk * 10 ** (-56 / 20): e = i; break
    e = min(e, a + int(4.5 * sr)); y = x[a:e].copy(); f = min(len(y), int(0.25 * sr))
    y[-f:] *= np.linspace(1, 0, f); return y

def cents_off(y, sr, m):   # the strike's fundamental against the note (equal temperament, A 440), from 0.15–1.2 s in
    f0 = 440 * 2 ** ((m - 69) / 12); s = y[int(0.15 * sr):int(1.2 * sr)]
    if len(s) < sr // 4: return 0.0
    n = 1 << 18; spec = np.abs(np.fft.rfft(s * np.hanning(len(s)), n)); fr = np.fft.rfftfreq(n, 1 / sr)
    lo, hi = f0 * 2 ** (-0.6 / 12), f0 * 2 ** (0.6 / 12); band = (fr > lo) & (fr < hi)
    if not band.any(): return 0.0
    i = np.argmax(np.where(band, spec, 0)); return float(1200 * np.log2(fr[i] / f0))

# the library's files: <note>v<layer>.wav, from a folder or a zip
if src.endswith('.zip'):
    z = zipfile.ZipFile(src); entries = {os.path.basename(i.filename): (lambda i=i: z.read(i)) for i in z.infolist() if not i.filename.startswith('__MACOSX')}
else:
    entries = {f: (lambda f=f: open(os.path.join(src, f), 'rb').read()) for f in os.listdir(src)}
lib = {}
for name in entries:
    m = re.match(r'([A-G][#b]?-?\d)v(\d+)\.wav$', name)
    if m: lib.setdefault(midi(m.group(1)), {})[int(m.group(2))] = name
# the pan's notes, from the app's pan drawings
js = ("const fs=require('fs');const S=new Function('PANS','FIELDS','dottedLabel',fs.readFileSync(process.argv[1],'utf8')+';return SETS')([],new Map(),()=>'');"
      "console.log(JSON.stringify(S[process.argv[2]].views[0].fields.map(f=>f[0])))")
ids = json.loads(subprocess.check_output(['node', '-e', js, os.path.join(HERE, 'pansets.js'), setkey]))
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
files, tune, missing, total = {}, {}, [], 0
for nid in sorted(ids, key=lambda s: int(s.split(':')[1])):
    m = int(nid.split(':')[1])
    if m not in lib: missing.append(nid); continue
    have = sorted(lib[m]); pick = [min(have, key=lambda v: abs(v - L)) for L in LAYERS]
    ys = []
    for v in pick:
        x, sr = read(entries[lib[m][v]]()); ys.append((cut(x, sr), sr))
    peak = max(np.abs(y).max() for y, _ in ys) or 1; g = 0.89 / peak   # the loudest layer to about −1 dB; the others keep their own level
    c = float(np.median([cents_off(y, sr, m) for y, sr in ys]))
    files[nid] = []
    for k, (y, sr) in enumerate(ys):
        name = '%s-%d.flac' % (nid.replace(':', '_'), k)
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, 'n.wav'); w = wave.open(p, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((np.clip(y * g, -1, 1) * 32767).astype('<i2').tobytes()); w.close()
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-c:a', 'flac', '-compression_level', '8', os.path.join(OUT, name)], check=True)
        files[nid].append(name); total += os.path.getsize(os.path.join(OUT, name))
    tune[nid] = {'cents': round(-c, 1)}
man = {'format': 'panyard-sound-pack', 'name': title, 'set': setkey, 'credit': credit, 'licence': licence,
       'layers': [round(k / max(1, len(LAYERS) - 1), 3) for k in range(len(LAYERS))], 'files': files, 'tune': tune}
man['version'] = hashlib.sha1(json.dumps(man, sort_keys=True).encode()).hexdigest()[:10]
json.dump(man, open(os.path.join(OUT, 'pack.json'), 'w'), indent=0)
print(len(files), 'notes x', len(LAYERS), 'layers,', round(total / 1e6, 1), 'MB, missing', missing, 'version', man['version'])
print('cents corrections:', {k: v['cents'] for k, v in tune.items()})
