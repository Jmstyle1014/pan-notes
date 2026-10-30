"""Builds Panyard VR (vr/ at /pan-notes/vr/): the band's tenor in a VR headset's browser (WebXR), the controllers as
sticks. One page, source/panyard-vr.html, with the tenor's notes from source/pansets.js put in, plus three.js
(source/vr-lib/). Its pan sounds are Panyard Band's (../band/band-sounds/), so rebuild band/ first when they change.
Needs node (to read the tenor from pansets.js).  python3 source/make_vr.py  →  vr/"""
import json, os, shutil, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'vr')
JS = """const fs=require('fs');const src=fs.readFileSync(process.argv[1],'utf8');
const t=new Function('PANS','FIELDS','dottedLabel',src+';return tenorSet()')([],new Map(),()=>'');
console.log(JSON.stringify(t.fields.map(f=>{const m=+f[0].split(':')[1];return {id:f[0],label:f[1],pos:f[2],path:f[3],x:+f[4],y:+f[5],fs:+f[6],hz:+(440*Math.pow(2,(m-69)/12)).toFixed(2)}})))"""
tenor = json.loads(subprocess.check_output(['node', '-e', JS, os.path.join(HERE, 'pansets.js')]))
assert len(tenor) == 29, len(tenor)
page = open(os.path.join(HERE, 'panyard-vr.html'), encoding='utf-8').read()
assert page.count('/*TENOR*/[]') == 1
page = page.replace('/*TENOR*/[]', json.dumps(tenor, separators=(',', ':')))
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(os.path.join(OUT, 'lib'))
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(page)
for f in os.listdir(os.path.join(HERE, 'vr-lib')):
    shutil.copy(os.path.join(HERE, 'vr-lib', f), os.path.join(OUT, 'lib', f))
print('wrote', OUT, len(tenor), 'tenor notes')
