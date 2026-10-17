/* ---------- the band's pans: each song plays one set ---------- */
// Layouts from the Digital Pan screens (as in Pocket Band): every pan or drum has a centre and radius on its
// stage, and every note an angle (0° points right, 90° down) and a distance from that centre.
const PC_LAB=['C','C♯','D','E♭','E','F','F♯','G','G♯','A','B♭','B'],PC_NAME=['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B'];
const nmOf=s=>{const x=/^([A-G])(#|b)?(\d)$/.exec(s);return 12*(+x[3]+1)+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[x[1]]+(x[2]==='#'?1:x[2]==='b'?-1:0)};
const arcXY=(cx,cy,r,a)=>[cx+r*Math.cos(a*Math.PI/180),cy+r*Math.sin(a*Math.PI/180)];
const f1=x=>+(+x).toFixed(1);
function ellPath(cx,cy,rx,ry,rot){const a=rot*Math.PI/180,dx=rx*Math.cos(a),dy=rx*Math.sin(a),A='A'+f1(rx)+' '+f1(ry)+' '+f1(rot)+' 1 1 ';
  return 'M'+f1(cx+dx)+' '+f1(cy+dy)+' '+A+f1(cx-dx)+' '+f1(cy-dy)+' '+A+f1(cx+dx)+' '+f1(cy+dy)+' Z'}
function wedgePath(cx,cy,r,a0,a1){const span=((a1-a0)%360+360)%360,[x0,y0]=arcXY(cx,cy,r,a0),[x1,y1]=arcXY(cx,cy,r,a0+span);
  return 'M'+cx+' '+cy+' L'+f1(x0)+' '+f1(y0)+' A'+r+' '+r+' 0 '+(span>180?1:0)+' 1 '+f1(x1)+' '+f1(y1)+' Z'}
function stageViewBox(ds){const pad=24,xs=ds.flatMap(p=>[p.cx-p.rx,p.cx+p.rx]),ys=ds.flatMap(p=>[p.cy-p.ry,p.cy+p.ry]),x0=Math.min(...xs)-pad,y0=Math.min(...ys)-pad-(ds.length>1?56:0);
  return [x0,y0,Math.max(...xs)+pad-x0,Math.max(...ys)+pad-y0].map(Math.round).join(' ')}
// a field: [id, letter on the pan, where it sits, shape, label x, label y, label size, colour group]
function stageSet(set,name,drums,grp){
  const fields=[],ds=[];
  drums.forEach(([dn,cx,cy,r,notes],di)=>{
    ds.push({name:dn,cx,cy,rx:r,ry:r});
    const pts=notes.map(([n,a,d])=>{const [x,y]=arcXY(cx,cy,d,a);return{m:nmOf(n),a,d,x,y}});
    for(const p of pts){
      const near=Math.min(r,...pts.filter(o=>o!==p).map(o=>Math.hypot(o.x-p.x,o.y-p.y)));
      const tan=Math.min(near*.52,r*.46),rad=Math.min(near*.5,r*.42,Math.max(r-p.d-8,near*.32)),round=p.d<r*.12;
      const rx=round?Math.min(tan,rad):tan,ry=round?Math.min(tan,rad):rad,g=grp(di,p,r,dn);
      fields.push([set+':'+p.m,PC_LAB[p.m%12],g.pos,ellPath(p.x,p.y,rx,ry,round?0:p.a+90),f1(p.x),f1(p.y),Math.round(Math.max(18,Math.min(64,Math.min(rx,ry)*.95))),g.grp]);
    }
  });
  return{name,key:set,view:stageViewBox(ds),cx:ds[0].cx,cy:ds[0].cy,rx:ds[0].rx,ry:ds[0].ry,drums:ds,fields};
}
// bass drums: each note is a slice of its drum
function bassSet(set,name,drums){
  const fields=[],ds=[];
  drums.forEach(([dn,cx,cy,r,notes],di)=>{
    ds.push({name:dn,cx,cy,rx:r,ry:r});
    const s=notes.map(([n,a])=>({m:nmOf(n),a:((a%360)+360)%360})).sort((x,y)=>x.a-y.a);
    s.forEach((p,i)=>{const prev=s[(i+s.length-1)%s.length].a,next=s[(i+1)%s.length].a,a0=prev+((p.a-prev+360)%360)/2+2,a1=p.a+((next-p.a+360)%360)/2-2,[tx,ty]=arcXY(cx,cy,r*.55,p.a);
      fields.push([set+':'+p.m,PC_LAB[p.m%12],dn+' drum',wedgePath(cx,cy,f1(r*.93),a0,a1),f1(tx),f1(ty),Math.round(Math.min(64,r*.34)),'gS'+di])});
  });
  return{name,key:set,view:stageViewBox(ds),cx:ds[0].cx,cy:ds[0].cy,rx:ds[0].rx,ry:ds[0].ry,drums:ds,fields};
}
const FIFTHS=[0,7,2,9,4,11,6,1,8,3,10,5];
const fifthsRing=(oct,d)=>FIFTHS.map((pc,k)=>[PC_NAME[pc]+oct,90-30*k,d]);
const GUITAR_PANS=PANS;
GUITAR_PANS.forEach(p=>p.fields.forEach(f=>{f[6]=f[6]||0;f[7]=p.key}));
const SETS={
  guitar:{name:'Double Guitar',range:'C♯3–G♯4',views:GUITAR_PANS,plain:null,groups:[{key:'ec',name:'E / C pan',short:'E/C'},{key:'bf',name:'B / F pan',short:'B/F'}]},
  // Low C tenor, C4–E6: circle of fifths round the rim with C at the bottom, octaves on the middle ring, five top notes in the centre
  tenor:{name:'Low C Tenor',range:'C4–E6',plain:[72,83],
    views:[stageSet('tenor','Low C Tenor',[['Low C Tenor',500,500,445,[...fifthsRing(4,378),...fifthsRing(5,228),['C6',111,97],['C#6',-158,108],['D6',11,51],['Eb6',158,146],['E6',-87,90]]]],
      (di,p)=>p.d>300?{grp:'gTo',pos:'outer'}:p.d>150?{grp:'gTm',pos:'middle'}:{grp:'gTc',pos:'centre'})],
    groups:[{key:'gTo',name:'Outer ring',short:'Outer',color:'#f2b38a'},{key:'gTm',name:'Middle ring',short:'Middle',color:'#8fc7ff'},{key:'gTc',name:'Centre',short:'Centre',color:'#c9a2ff'}]},
  // Six bass, B♭1–E♭3: six drums in an arch, each with its note, the octave and the fifth
  six:{name:'Six Bass',range:'B♭1–E♭3',plain:[34,45],
    views:[bassSet('six','Six Bass',[
      ['B♭',510,690,160,[['Bb1',-48.8],['F2',-160],['Bb2',97]]],
      ['E♭',590,375,125,[['Eb2',-28],['G#2',-157],['Eb3',108]]],
      ['C♯',820,185,115,[['F#2',-111.8],['C#2',3.6],['C#3',119]]],
      ['B',1100,185,115,[['E2',-73],['B1',176],['B2',42]]],
      ['D',1330,375,125,[['D2',-106],['D3',143],['A2',9.5]]],
      ['C',1470,690,160,[['C2',-119],['C3',113],['G2',-5.7]]]])],
    groups:['B♭','E♭','C♯','B','D','C'].map((n,i)=>({key:'gS'+i,name:n+' drum',short:n,color:['#f2b38a','#ffd36b','#9be38f','#8fc7ff','#c9a2ff','#ff9ac1'][i]}))},
  // Four cello, B♭1–C♯4: two smaller pans on top, two larger below
  fcello:{name:'Four Cello',range:'B♭1–C♯4',plain:[46,57],
    views:[stageSet('fcello','Four Cello',[
      ['B♭ pan',730,240,190,[['Bb1',42,135],['Bb2',137.6,156],['Bb3',108,32],['Eb2',-170.5,122],['Eb3',-99.5,122],['F2',-34.7,158],['F3',-45,57]]],
      ['C♯ pan',1180,230,180,[['C#2',149.7,139],['C#3',-152,170],['C#4',-153,56],['F#2',-100,112],['F#3',-16.7,104],['G#2',48,135],['G#3',16,36]]],
      ['C pan',450,680,240,[['C2',29,180],['C3',106,146],['C4',39.3,71],['D2',-166,124],['D3',-70.6,170],['G2',-29.2,180],['G3',-20.9,105]]],
      ['B pan',1390,650,230,[['B1',42.7,165],['B2',122.7,160],['B3',90,50],['E2',-168.7,150],['E3',-104,160],['A2',-39.8,150],['A3',-33.7,36]]]],
      (di,p,r,dn)=>({grp:'gC'+di,pos:dn+(p.d<r*.45?' inner':' outer')}))],
    groups:['B♭','C♯','C','B'].map((n,i)=>({key:'gC'+i,name:n+' pan',short:n,color:['#f2b38a','#9be38f','#8fc7ff','#c9a2ff'][i]}))}
};
// octave dots, so a letter that comes round again reads clearly: Ċ above the middle octave, C̣ below
const OCT_MARK={1:'̇',2:'̈','-1':'̣','-2':'̤'};
function dottedLabel(m,plain){const L=PC_LAB[m%12];if(!plain)return L;const o=m<plain[0]?-Math.ceil((plain[0]-m)/12):m>plain[1]?Math.ceil((m-plain[1])/12):0;return o?L[0]+OCT_MARK[o]+L.slice(1):L}
const SET_PITCH={};
for(const [sk,set] of Object.entries(SETS)){if(sk==='guitar')continue;
  for(const v of set.views)for(const f of v.fields){const m=+f[0].split(':')[1];SET_PITCH[f[0]]=PC_NAME[m%12]+(Math.floor(m/12)-1);
    FIELDS.set(f[0],{label:dottedLabel(m,set.plain),pos:f[2],pan:v.drums.length>1?(f[2].split(' ')[0]+' '+(sk==='six'?'drum':'pan')):set.name,grp:f[7],set:sk})}}
GUITAR_PANS.forEach(p=>p.fields.forEach(f=>{const x=FIELDS.get(f[0]);x.grp=p.key;x.set='guitar'}));
const setKey=()=>S&&SETS[S.panSet]?S.panSet:'guitar';
const curSet=()=>SETS[setKey()];
const isGuitar=()=>setKey()==='guitar';
const panOrder=()=>isGuitar()&&S.swapped?[PANS[1],PANS[0]]:PANS;
const groupsNow=()=>{const g=curSet().groups;return isGuitar()&&S.swapped?[g[1],g[0]]:g};
const grpOf=id=>(FIELDS.get(id)||{}).grp||'ec';
const grpColor=k=>getComputedStyle(document.documentElement).getPropertyValue('--'+k).trim()||'#999';
const NOTE_PAN={};
const PAN_HOOKS=[];
// every colour rule written for the E / C pan, copied for the new pans' groups
function groupCss(){
  let st=document.getElementById('grpCss');if(!st){st=document.createElement('style');st.id='grpCss';document.head.appendChild(st)}
  if(st.dataset.set===setKey())return;st.dataset.set=setKey();if(isGuitar()){st.textContent='';return}
  const src=[];
  for(const sh of document.styleSheets){let rs;try{rs=sh.cssRules}catch{continue}for(const r of rs)if(r.selectorText&&/(\.|pn-)ec\b/.test(r.selectorText)&&!/#grpCss/.test(r.cssText))src.push(r.cssText)}
  let css=':root{'+curSet().groups.map(g=>'--'+g.key+':'+g.color).join(';')+'}';
  for(const g of curSet().groups)for(const t of src)css+=t.replace(/\.ec\b/g,'.'+g.key).replace(/pn-ec\b/g,'pn-'+g.key).replace(/var\(--ec\)/g,'var(--'+g.key+')');
  st.textContent=css;
}
function applyPanSet(){
  PANS=curSet().views;
  ORD.clear();PANS.forEach((p,pi)=>p.fields.forEach((f,fi)=>ORD.set(f[0],[pi,fi])));
  for(const k in NOTE_PAN)delete NOTE_PAN[k];
  for(const p of PANS)for(const f of p.fields)NOTE_PAN[FIELDS.get(f[0]).label]=f[7];
  if(document.head)groupCss();
  PAN_HOOKS.forEach(f=>{try{f()}catch{}});
}
