"""Builds Panyard VR (vr/ at /pan-notes/vr/): the band's pans (tenor to seven bass) in a VR headset's browser (WebXR), the controllers as
sticks. One page, source/panyard-vr.html, with the pans' notes from source/pansets.js put in, plus three.js
(source/vr-lib/). Its pan sounds are Panyard Band's (../band/band-sounds/), so rebuild band/ first when they change.
Needs node (to read the pans from pansets.js and pan-notes.html).  python3 source/make_vr.py  →  vr/"""
import json, os, shutil, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'vr')
JS = """const fs=require('fs');const src=fs.readFileSync(process.argv[1],'utf8'),base=fs.readFileSync(process.argv[2],'utf8');
const hz=m=>+(440*Math.pow(2,(m-69)/12)).toFixed(2);
const midiOf=n=>{const m=/^([A-G])([#b]?)(\\d)$/.exec(n);return 12*(+m[3]+1)+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)};
const SETS=new Function('PANS','FIELDS','dottedLabel',src+';return SETS')([],new Map(),()=>'');
// a set from pansets.js: each note goes to the drum whose centre is nearest, in that drum's own frame
const UP={fcello:12};   // the four cello's note ids are an octave below how it sounds
const fromSet=(k,name)=>{const v=SETS[k].views[0];return {name,drums:v.drums.map((d,i)=>({key:k+i,name:d.name,cx:d.cx,cy:d.cy,r:Math.max(d.rx,d.ry),
  notes:v.fields.filter(f=>v.drums.reduce((b,e,j)=>Math.hypot(+f[4]-e.cx,+f[5]-e.cy)<Math.hypot(+f[4]-v.drums[b].cx,+f[5]-v.drums[b].cy)?j:b,0)===i)
    .map(f=>({id:f[0],label:f[1],pos:f[2],path:f[3],x:+f[4],y:+f[5],fs:+f[6],hz:hz(+f[0].split(':')[1]+(UP[k]||0))}))}))}};
const tenor=fromSet('tenor','Tenor'),dsec=fromSet('dsec','Double Second'),dten=fromSet('dten','Double Tenor'),fcello=fromSet('fcello','Four Cello'),tcello=fromSet('tcello','Three Cello'),six=fromSet('six','Six Bass'),seven=fromSet('seven','Seven Bass');
// the Double Guitar lives in the base app: its two pans (PANS) and their pitches (PITCH)
const PANS=JSON.parse(/let PANS=(\\[.*?\\]);\\n/s.exec(base)[1]);
const PITCH=new Function('return '+/const PITCH=(\\{[^}]*\\});/s.exec(base)[1])();
const guitar={name:'Double Guitar',drums:PANS.map(p=>{const r=Math.max(p.rx,p.ry);return {key:p.key,name:p.name,cx:p.cx,cy:p.cy,r,notes:p.fields.map(f=>({id:f[0],label:f[1],pos:f[2],path:f[3],x:+f[4],y:+f[5],fs:Math.round(r*.115),hz:hz(midiOf(PITCH[f[0]]))}))}})};
console.log(JSON.stringify({tenor,dten,dsec,guitar,fcello,tcello,six,seven}))"""
sets = json.loads(subprocess.check_output(['node', '-e', JS, os.path.join(HERE, 'pansets.js'), os.path.join(HERE, 'pan-notes.html')]))
assert len(sets['tenor']['drums'][0]['notes']) == 29 and sum(len(d['notes']) for d in sets['guitar']['drums']) == 20
assert [len(d['notes']) for d in sets['dsec']['drums']] == [15, 15]
assert [len(sets[k]['drums']) for k in ('dten', 'fcello', 'tcello', 'six', 'seven')] == [2, 4, 3, 6, 7]
page = open(os.path.join(HERE, 'panyard-vr.html'), encoding='utf-8').read()
assert page.count('/*SETS*/{}') == 1
page = page.replace('/*SETS*/{}', json.dumps(sets, separators=(',', ':')))
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(os.path.join(OUT, 'lib'))
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(page)
for f in os.listdir(os.path.join(HERE, 'vr-lib')):
    shutil.copy(os.path.join(HERE, 'vr-lib', f), os.path.join(OUT, 'lib', f))
print('wrote', OUT, ', '.join(k + ' ' + str(sum(len(d['notes']) for d in v['drums'])) for k, v in sets.items()))
