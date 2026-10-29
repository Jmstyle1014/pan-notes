"""Builds Panyard Band (source/pan-notes-band.html) from Panyard (source/pan-notes-panyard.html): the same app, always in
band-member mode, with the band's own pan sounds (source/band-sounds/, made by make_band_sounds.py) and A = 441.
Its saved things live apart from Panyard's on the same phone: the first script gives it its own localStorage keys
(prefix pb:) and IndexedDB names (prefix band-) before anything else runs.
Put it live: python3 source/make_panyard.py && python3 source/make_band.py &&
  python3 source/build.py source/pan-notes-band.html <scratch>/bsite "Panyard Band" && rm -rf band && cp -r <scratch>/bsite band"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'pan-notes-panyard.html'), encoding='utf-8').read()
SHIM = """<script>/* BANDSHIM: Panyard Band keeps its saved things apart from Panyard's (same website, same phone) */
(()=>{const P='pb:',ls=window.localStorage;const mine=()=>{const a=[];for(let i=0;i<ls.length;i++){const k=ls.key(i);if(k&&k.startsWith(P))a.push(k.slice(P.length))}return a};
 const s={getItem:k=>ls.getItem(P+k),setItem:(k,v)=>ls.setItem(P+k,String(v)),removeItem:k=>ls.removeItem(P+k),clear(){mine().forEach(k=>ls.removeItem(P+k))},key:i=>{const a=mine();return i<a.length?a[i]:null},get length(){return mine().length}};
 Object.defineProperty(window,'localStorage',{value:s,configurable:true});
 const op=IDBFactory.prototype.open;IDBFactory.prototype.open=function(n,...a){return op.call(this,'band-'+n,...a)};
 const dl=IDBFactory.prototype.deleteDatabase;IDBFactory.prototype.deleteDatabase=function(n){return dl.call(this,'band-'+n)}})();
</script>
"""
i = src.index('<script>')
assert src.count('<script>') == 1, 'Panyard has one main script'
out = src[:i] + SHIM + src[i:]
out += '\n<script>\n' + open(os.path.join(HERE, 'panyard-bandapp.js'), encoding='utf-8').read() + '\n</script>\n'
open(os.path.join(HERE, 'pan-notes-band.html'), 'w', encoding='utf-8').write(out)
print('wrote', os.path.join(HERE, 'pan-notes-band.html'))
