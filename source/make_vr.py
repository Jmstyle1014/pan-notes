"""Builds Panyard VR (vr/ at /pan-notes/vr/): the band's pans (tenor, double guitar) in a VR headset's browser (WebXR), the controllers as
sticks. One page, source/panyard-vr.html, with the pans' notes from source/pansets.js put in, plus three.js
(source/vr-lib/). Its pan sounds are Panyard Band's (../band/band-sounds/), so rebuild band/ first when they change.
Needs node (to read the pans from pansets.js and pan-notes.html).  python3 source/make_vr.py  →  vr/"""
import json, os, shutil, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'vr')
JS = """const fs=require('fs');const src=fs.readFileSync(process.argv[1],'utf8'),base=fs.readFileSync(process.argv[2],'utf8');
const hz=m=>+(440*Math.pow(2,(m-69)/12)).toFixed(2);
const midiOf=n=>{const m=/^([A-G])([#b]?)(\\d)$/.exec(n);return 12*(+m[3]+1)+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)};
const t=new Function('PANS','FIELDS','dottedLabel',src+';return tenorSet()')([],new Map(),()=>'');
const tenor={name:'Tenor',drums:[{key:'tenor',name:t.name,cx:t.cx,cy:t.cy,r:t.rx,notes:t.fields.map(f=>({id:f[0],label:f[1],pos:f[2],path:f[3],x:+f[4],y:+f[5],fs:+f[6],hz:hz(+f[0].split(':')[1])}))}]};
// the Double Guitar lives in the base app: its two pans (PANS) and their pitches (PITCH)
const PANS=JSON.parse(/let PANS=(\\[.*?\\]);\\n/s.exec(base)[1]);
const PITCH=new Function('return '+/const PITCH=(\\{[^}]*\\});/s.exec(base)[1])();
const guitar={name:'Double Guitar',drums:PANS.map(p=>{const r=Math.max(p.rx,p.ry);return {key:p.key,name:p.name,cx:p.cx,cy:p.cy,r,notes:p.fields.map(f=>({id:f[0],label:f[1],pos:f[2],path:f[3],x:+f[4],y:+f[5],fs:Math.round(r*.115),hz:hz(midiOf(PITCH[f[0]]))}))}})};
console.log(JSON.stringify({tenor,guitar}))"""
sets = json.loads(subprocess.check_output(['node', '-e', JS, os.path.join(HERE, 'pansets.js'), os.path.join(HERE, 'pan-notes.html')]))
assert len(sets['tenor']['drums'][0]['notes']) == 29 and sum(len(d['notes']) for d in sets['guitar']['drums']) == 20
page = open(os.path.join(HERE, 'panyard-vr.html'), encoding='utf-8').read()
assert page.count('/*SETS*/{}') == 1
page = page.replace('/*SETS*/{}', json.dumps(sets, separators=(',', ':')))
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(os.path.join(OUT, 'lib'))
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(page)
for f in os.listdir(os.path.join(HERE, 'vr-lib')):
    shutil.copy(os.path.join(HERE, 'vr-lib', f), os.path.join(OUT, 'lib', f))
print('wrote', OUT, ', '.join(k + ' ' + str(sum(len(d['notes']) for d in v['drums'])) for k, v in sets.items()))
