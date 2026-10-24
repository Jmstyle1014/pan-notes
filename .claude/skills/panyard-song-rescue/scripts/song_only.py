#!/usr/bin/env python3
"""Make a song-only copy of a Panyard / Pan Notes backup file: the song (notes, Studio tracks, tempo, chart,
notebook, band sound) without the phone's pan sounds, sound tuning, profiles, looks or photos.
Usage: song_only.py <backup.json> <out.json>"""
import json, os, sys

KEEP = ['format', 'version', 'title', 'refA', 'panSet', 'studio', 'swapped', 'grid', 'cues', 'chart',
        'notebook', 'band', 'savedAt']

def main(src, dst):
    p = json.load(open(src, encoding='utf-8'))
    if not str(p.get('format', '')).startswith('pan-notes'):
        sys.exit("That isn't a Pan Notes / Panyard backup file (format: %r)" % p.get('format'))
    out = {k: p[k] for k in KEEP if k in p}
    json.dump(out, open(dst, 'w', encoding='utf-8'), separators=(',', ':'))
    dropped = [k for k in p if k not in out]
    print('Song:', out.get('title'), '| pan:', out.get('panSet'), '| saved:', out.get('savedAt'))
    print('Write notes:', len(out.get('cues') or []))
    for t in (out.get('studio') or {}).get('tracks', []):
        extra = t.get('panSet') or t.get('kit') or ''
        if t.get('type') == 'beats':
            hits = sum(1 for r in t.get('rows') or [] for v in r.get('steps') or [] if v)
            what = '%d-step beat, %d hits' % (t.get('len') or 16, hits)
        else:
            what = '%d notes' % len(t.get('notes') or [])
        print('  Studio track: %-28s %-8s %-7s %s' % (t.get('name'), t.get('type'), extra, what))
    print('Left out:', ', '.join(dropped) or 'nothing')
    print('Size: %d KB (was %d KB)' % (os.path.getsize(dst) // 1024, os.path.getsize(src) // 1024))

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
