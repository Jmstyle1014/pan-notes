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
// a shape through these points with its corners rounded off (arcs are dense, so only real corners round)
function roundPoly(pts,c){
  const n=pts.length,seg=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);let d='';
  for(let i=0;i<n;i++){const p=pts[i],a=pts[(i+n-1)%n],b=pts[(i+1)%n],da=Math.min(c,seg(a,p)/2),db=Math.min(c,seg(p,b)/2);
    const p1=[p[0]+(a[0]-p[0])*da/seg(a,p),p[1]+(a[1]-p[1])*da/seg(a,p)],p2=[p[0]+(b[0]-p[0])*db/seg(p,b),p[1]+(b[1]-p[1])*db/seg(p,b)];
    d+=(i?' L':'M')+f1(p1[0])+' '+f1(p1[1])+' Q'+f1(p[0])+' '+f1(p[1])+' '+f1(p2[0])+' '+f1(p2[1])}
  return d+' Z';
}
// a rounded slice of a ring: from radius r0 to r1, angles a0 to a1, with a straight gap of g between neighbours
function ringTile(cx,cy,r0,r1,a0,a1,g,c){
  const pts=[],N=14,ang=(r,a,side)=>a+side*(g/2)/r*180/Math.PI;
  for(let k=0;k<=N;k++){const a=ang(r1,a0,1)+(ang(r1,a1,-1)-ang(r1,a0,1))*k/N;pts.push(arcXY(cx,cy,r1,a))}
  for(let k=N;k>=0;k--){const a=ang(r0,a0,1)+(ang(r0,a1,-1)-ang(r0,a0,1))*k/N;pts.push(arcXY(cx,cy,r0,a))}
  return roundPoly(pts,c);
}
// Low C tenor, drawn like the real pan: twelve big notes round the rim, an oval for each octave on the middle ring,
// and five small notes in the centre
function tenorSet(){
  const cx=500,cy=500,R=445,fields=[],add=(n,pos,grp,path,x,y,fs)=>{const m=nmOf(n);fields.push(['tenor:'+m,PC_LAB[m%12],pos,path,f1(x),f1(y),fs,grp,0])};
  fifthsRing(4,0).forEach(([n,a])=>{const [x,y]=arcXY(cx,cy,R*.81,a);add(n,'outer','gTo',ringTile(cx,cy,R*.665,R*.955,a-15,a+15,R*.035,R*.09),x,y,58)});
  fifthsRing(5,0).forEach(([n,a])=>{const [x,y]=arcXY(cx,cy,R*.5,a);add(n,'middle','gTm',ellPath(x,y,R*.112,R*.135,a+90),x,y,46)});
  [['C6',90,96],['C#6',-126,96],['D6',18,96],['Eb6',162,96],['E6',-54,96]].forEach(([n,a,d])=>{const [x,y]=arcXY(cx,cy,d,a);add(n,'centre','gTc',ellPath(x,y,R*.11,R*.11,0),x,y,42)});
  const ds=[{name:'Low C Tenor',cx,cy,rx:R,ry:R}];
  return{name:'Low C Tenor',key:'tenor',view:stageViewBox(ds),cx,cy,rx:R,ry:R,drums:ds,fields};
}
// Four cello, drawn from the real pans: each pan has three big notes round the rim (its lowest notes), two white
// notes at the rim between them, and two small notes near the middle. Positions measured from the Digital Pan screen:
// [note, angle, distance from the centre as a share of the radius].
function cello4Set(drums){
  const fields=[],ds=[],HW=33;
  drums.forEach(([dn,cx,cy,r,notes],di)=>{
    ds.push({name:dn,cx,cy,rx:r,ry:r});
    const pts=notes.map(([n,a,d])=>({n,m:nmOf(n),a:((a%360)+360)%360,d:d*r})).sort((x,y)=>x.m-y.m);
    pts.forEach((p,i)=>{p.kind=i<3?'big':i<5?'white':'small'});
    const rim=pts.filter(p=>p.kind!=='small').sort((x,y)=>x.a-y.a);
    const add=(p,pos,path,fs)=>{const [x,y]=arcXY(cx,cy,p.d,p.a);fields.push(['fcello:'+p.m,PC_LAB[p.m%12],dn+' '+pos,path,f1(x),f1(y),fs,'gC'+di,di])};
    // the small notes go last so they sit on top
    for(const kind of ['big','white']){rim.forEach((p,i)=>{if(p.kind!==kind)return;
      if(kind==='white'){const [x,y]=arcXY(cx,cy,r*.69,p.a);add(p,'rim',ellPath(x,y,r*.3,r*.235,p.a+90),Math.round(r*.17));return}
      const prev=rim[(i+rim.length-1)%rim.length],next=rim[(i+1)%rim.length],gp=(p.a-prev.a+360)%360,gn=(next.a-p.a+360)%360;
      const a0=prev.kind==='white'?p.a-gp+HW:p.a-gp/2,a1=next.kind==='white'?p.a+gn-HW:p.a+gn/2;
      add(p,'outer',ringTile(cx,cy,r*.4,r*.95,a0,a1,r*.12,r*.28),Math.round(r*.2))})}
    pts.filter(p=>p.kind==='small').forEach(p=>{const [x,y]=arcXY(cx,cy,p.d,p.a);add(p,'inner',ellPath(x,y,r*.2,r*.2,0),Math.round(r*.16))});
  });
  return{name:'Four Cello',key:'fcello',view:stageViewBox(ds),cx:ds[0].cx,cy:ds[0].cy,rx:ds[0].rx,ry:ds[0].ry,drums:ds,fields};
}
// a field: [id, letter on the pan, where it sits, shape, label x, label y, label size, colour group, which drum]
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
// Double seconds, measured from the Digital Pan screen: two pans of whole tones (C D E F♯ G♯ B♭ on the left,
// C♯ E♭ F G A B on the right). Eight big notes round each rim (the lowest), seven smaller ones inside.
// [note, x and y from the centre as a share of the radius, size (share of the radius), round?]
function dsecSet(drums){
  const fields=[],ds=[];
  drums.forEach(([dn,cx,cy,r,notes],di)=>{
    ds.push({name:dn,cx,cy,rx:r,ry:r});
    notes.forEach(([n,dx,dy,sz,inner])=>{const m=nmOf(n),x=cx+dx*r,y=cy+dy*r,a=Math.atan2(dy,dx)*180/Math.PI;
      // rim notes are ovals lying along the rim; inner notes are rounder
      const rx=inner?sz*r:sz*r*1.18,ry=inner?sz*r*.82:sz*r*.8;
      fields.push(['dsec:'+m,PC_LAB[m%12],dn+' '+(inner?'inner':'outer'),ellPath(x,y,rx,ry,a+90),f1(x),f1(y),Math.round(Math.max(26,Math.min(70,ry*.85))),'gD'+di,di])});
  });
  return{name:'Double Seconds',key:'dsec',view:stageViewBox(ds),cx:ds[0].cx,cy:ds[0].cy,rx:ds[0].rx,ry:ds[0].ry,drums:ds,fields};
}
const FIFTHS=[0,7,2,9,4,11,6,1,8,3,10,5];
const fifthsRing=(oct,d)=>FIFTHS.map((pc,k)=>[PC_NAME[pc]+oct,90-30*k,d]);
const GUITAR_PANS=PANS;
GUITAR_PANS.forEach(p=>p.fields.forEach(f=>{f[6]=f[6]||0;f[7]=p.key}));
const SETS={
  guitar:{name:'Double Guitar',range:'C♯3–G♯4',views:GUITAR_PANS,plain:null,groups:[{key:'ec',name:'E / C pan',short:'E/C'},{key:'bf',name:'B / F pan',short:'B/F'}]},
  // Low C tenor, C4–E6: circle of fifths round the rim with C at the bottom, octaves on the middle ring, five top notes in the centre
  tenor:{name:'Low C Tenor',range:'C4–E6',plain:[72,83],
    views:[tenorSet()],
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
    views:[cello4Set([
      ['B♭ pan',730,240,190,[['Eb3',-97.5,.7],['F2',-40,.76],['Eb2',-166.3,.67],['F3',-56.7,.23],['Bb3',114.6,.22],['Bb2',126.5,.72],['Bb1',40.8,.66]]],
      ['C♯ pan',1180,230,180,[['C#3',-145.1,.76],['F#2',-86.3,.65],['F#3',-12.6,.66],['C#4',-152.2,.28],['G#3',29.1,.18],['C#2',134.2,.64],['G#2',46.2,.74]]],
      ['C pan',450,680,240,[['D3',-93.6,.69],['G2',-39.4,.78],['D2',-167.8,.64],['G3',-50.3,.22],['C4',111.8,.26],['C3',125,.78],['C2',45,.68]]],
      ['B pan',1390,650,230,[['E3',-105.8,.73],['A2',-45.4,.72],['E2',-165.7,.71],['A3',-62.4,.23],['B3',104.7,.2],['B2',120,.65],['B1',35.2,.72]]]])],
    groups:['B♭','C♯','C','B'].map((n,i)=>({key:'gC'+i,name:n+' pan',short:n,color:['#f2b38a','#9be38f','#8fc7ff','#c9a2ff'][i]}))},
  // Double seconds, E3–A5: two whole-tone pans side by side
  dsec:{name:'Double Seconds',range:'E3–A5',plain:[60,71],
    views:[dsecSet([
      ['C',460,480,430,[['G#3',-.03,-.69,.27],['C4',.51,-.47,.25],['E3',.72,.07,.27],['E4',.53,.59,.21],['Bb3',-.01,.76,.26],['F#3',-.61,.43,.27],['F#4',-.75,-.14,.21],['D4',-.58,-.52,.22],
        ['G#4',-.06,-.26,.19,1],['C5',.31,-.09,.15,1],['E5',.31,.24,.14,1],['Bb4',-.02,.39,.17,1],['F#5',-.33,.2,.13,1],['D5',-.37,-.09,.16,1],['G#5',-.03,.07,.11,1]]],
      ['C♯',1360,480,430,[['G3',.02,-.76,.26],['G4',.54,-.53,.21],['Eb4',.69,-.14,.21],['B3',.6,.37,.26],['F3',.05,.72,.27],['F4',-.57,.52,.21],['A3',-.77,.04,.25],['C#4',-.59,-.54,.22],
        ['C#5',-.19,-.34,.15,1],['G5',.16,-.34,.12,1],['Eb5',.28,-.06,.14,1],['B4',.15,.27,.17,1],['F5',-.19,.31,.13,1],['A4',-.41,.01,.19,1],['A5',-.09,-.02,.1,1]]]])],
    groups:[{key:'gD0',name:'C pan',short:'C',color:'#f2b38a'},{key:'gD1',name:'C♯ pan',short:'C♯',color:'#8fc7ff'}]}
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
