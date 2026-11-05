/* ---- 🎼 Score (a fifth Studio view, inside STUDIO; the owner: "work more like MuseScore") ----
   The song's pan tracks and My part as a band score, a staff per track (treble, or bass for the basses and cellos), and
   editing it edits the song: tap a note to pick it (it plays), drag it up or down to the next note on its pan, change its
   length with the length buttons, ◀ ▶ to move it, ⌫ to take it out. New notes three ways: tap the staff (✏ Add on), the
   letter keys C D E F G A B (the octave nearest the note before, ♯ ♭ and Oct ± after), or the pans under the score; each
   goes in at the cursor (a teal line; tap the staff to place it) at the chosen length, and the cursor moves on. Pan tracks'
   notes are {t, d, p} in beats; My part is S.cues (seconds): a note of a chord or of a run is split into its own cue
   before it changes (`cueSolo`). Every change is one ↶ Undo step (`pushHistory`). Drags past the edge pan the view. */
const SC={len:1,dot:false,add:false,names:true,sel:null,cur:{pi:0,b:0},x0:0,ppb:56,lastAdd:0,raf:0,drag:null};
try{Object.assign(SC,JSON.parse(localStorage.getItem('panyard-score')||'{}'),{sel:null,drag:null,raf:0})}catch{}
const scSave=()=>{try{localStorage.setItem('panyard-score',JSON.stringify({len:SC.len,dot:SC.dot,add:SC.add,names:SC.names,ppb:SC.ppb}))}catch{}};
const SC_LOW=new Set(['six','seven','fcello','tcello']),SC_LET={C:0,D:1,E:2,F:3,G:4,A:5,B:6},SC_PC=[0,2,4,5,7,9,11],SC_LENS=[[4,'Whole'],[2,'Half'],[1,'Quarter'],[.5,'Eighth'],[.25,'16th']];
const scC=c=>{try{return THEME.c(c)}catch{return c}};
const r3=x=>+(+x).toFixed(3);
const scLabel=id=>{const f=FIELDS.get(id);return (f?f.label:'').replace(/[̣̤̇̈]/g,'')||PITCH[id].replace(/\d$/,'').replace('#','♯').replace('b','♭')};
const scMidi=id=>midiOf(PITCH[id]);
function scDn(id){const L=scLabel(id),acc=/♯|#/.test(L)?1:/♭/.test(L.slice(1))?-1:0,nat=scMidi(id)-acc,lt=L[0].toUpperCase();return (Math.floor(nat/12)-1)*7+(SC_LET[lt]!=null?SC_LET[lt]:0)}
const scParts=()=>song.tracks.filter(t=>t.type==='pan'||t.type==='part');
const scClef=tr=>SC_LOW.has(trSet(tr))?'bass':'treble';
const scLen=()=>SC.len*(SC.dot?1.5:1);
// a track's notes as the score shows them: pan tracks' own notes (rolls' extra strokes left out), My part from its cues
function scNotes(tr){
  if(tr.type==='pan')return (tr.notes||[]).filter(n=>!n.roll&&PITCH[n.p]).map(n=>({t:n.t,d:n.d,p:n.p,ref:n}));
  const o=origin(),sp=spb(),out=[];
  for(const c of S.cues){if(!c.steps||!c.steps.length)continue;const n=c.steps.length;
    c.steps.forEach((id,i)=>{if(!PITCH[id])return;const tog=c.mode==='together',st=tog?c.start:c.start+i*c.duration/n,du=tog?c.duration:c.duration/n;
      out.push({t:r3((st-o)/sp),d:r3(du/sp),p:id,ref:{cue:c,i}})})}
  return out.sort((a,b)=>a.t-b.t);
}
// My part: a note that shares its cue (a chord, or a run of notes) gets a cue of its own before it's changed
function cueSolo(ref){const c=ref.cue;if(c.steps.length===1)return c;const n=c.steps.length;
  if(c.mode!=='together'){const parts=c.steps.map((id,i)=>({id:uid(),start:r3(c.start+i*c.duration/n),duration:r3(c.duration/n),steps:[id],mode:'together',note:c.note||''}));
    S.cues=S.cues.filter(x=>x!==c).concat(parts);return parts[ref.i]}
  const id=c.steps.splice(ref.i,1)[0],nc={id:uid(),start:c.start,duration:c.duration,steps:[id],mode:'together',note:c.note||''};S.cues.push(nc);return nc}
function scDone(tr){if(tr.type==='part'){S.cues.sort((x,y)=>x.start-y.start);partCache=null;try{normalizeChords()}catch{}try{save();renderCues()}catch{}}else{tr.notes.sort((a,b)=>a.t-b.t);dirty()}
  try{renderTimeline()}catch{}scDraw()}
const scOps={
  pitch(tr,ref,id){if(tr.type==='pan')ref.p=id;else ref.cue.steps[ref.i]=id},
  len(tr,ref,d){if(tr.type==='pan')ref.d=r3(d);else{const c=cueSolo(ref);c.duration=r3(d*spb())}},
  move(tr,ref,dt){if(tr.type==='pan')ref.t=r3(Math.max(0,ref.t+dt));else{const c=cueSolo(ref);c.start=r3(Math.max(origin(),c.start+dt*spb()))}},
  del(tr,ref){if(tr.type==='pan'){const i=tr.notes.indexOf(ref);if(i>=0)tr.notes.splice(i,1)}else{const c=ref.cue;if(c.mode!=='together'&&c.steps.length>1){const nc=cueSolo(ref);S.cues=S.cues.filter(x=>x!==nc);return}c.steps.splice(ref.i,1);if(!c.steps.length)S.cues=S.cues.filter(x=>x!==c)}},
  add(tr,t,d,id){t=r3(Math.max(0,t));if(tr.type==='pan'){const n={t,d:r3(d),p:id,v:.9};tr.notes.push(n);return n}
    const st=r3(origin()+t*spb()),c=S.cues.find(x=>x.mode==='together'&&Math.abs(x.start-st)<.03);
    if(c){if(!c.steps.includes(id))c.steps.push(id);return {cue:c,i:c.steps.indexOf(id)}}
    const nc={id:uid(),start:st,duration:r3(d*spb()),steps:[id],mode:'together',note:''};S.cues.push(nc);return {cue:nc,i:0}}};
// the notes a part's pan really has, low to high
const scIds=tr=>pidsOf(tr).slice().reverse();
const scSound=(tr,id)=>{try{if(!AC())return;panVoice(channel(tr).out,id,ctx.currentTime+.003,.85,false)}catch{}};
function scStep(tr,id,k){const ids=scIds(tr),i=ids.indexOf(id);if(i<0)return id;return ids[Math.max(0,Math.min(ids.length-1,i+k))]}
function scNearest(tr,m,letter){let best=null,bd=1e9;for(const id of scIds(tr)){if(letter&&scLabel(id)[0].toUpperCase()!==letter)continue;const d=Math.abs(scMidi(id)-m)+(letter&&/♯|♭/.test(scLabel(id))?.5:0);if(d<bd){bd=d;best=id}}return best}
/* ---- drawing ---- */
const S_=9,LM=58,ROWH=()=>SC.names?158:136,TOP=50;
function scRows(){return scParts().map((tr,pi)=>{const y=12+pi*ROWH()+TOP,yb=y+4*S_;return {tr,pi,y,yb,clef:scClef(tr),Z:scClef(tr)==='bass'?18:30}})}
const scX=b=>LM+(b-SC.x0)*SC.ppb,scB=x=>SC.x0+(x-LM)/SC.ppb;
function scDraw(){const cv=q('#scCan');if(!cv||VIEW!=='score')return;cv.style.width='100%';const W=Math.round(cv.clientWidth)||360,rows=scRows(),H=Math.max(160,rows.length*ROWH()+24),dpr=Math.min(2,devicePixelRatio||1);
  if(cv.width!==W*dpr||cv.height!==H*dpr){cv.width=W*dpr;cv.height=H*dpr;cv.style.height=H+'px'}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);const fg=scC('#eef2f4'),dim=scC('#77838d'),gold=scC('#f6ba45'),teal=scC('#4fd1c5');
  SC.hits=[];const bpb=BPB(),b0=SC.x0,b1=scB(W);
  if(!rows.length){g.fillStyle=dim;g.font='15px system-ui,sans-serif';g.fillText('Add a Pan taps track (+ Add track) or write My part, and its notes show here.',12,40)}
  for(const R of rows){const {tr,pi,y,yb,clef,Z}=R,sel=SC.cur.pi===pi;
    g.fillStyle=sel?gold:dim;g.font='700 13px system-ui,sans-serif';g.textAlign='left';g.textBaseline='alphabetic';g.fillText(tr.type==='part'?'My part':(tr.name||SETS[trSet(tr)].name),8,y-26);
    g.strokeStyle=fg;g.lineWidth=1;for(let i=0;i<5;i++){g.beginPath();g.moveTo(4,yb-i*S_);g.lineTo(W-4,yb-i*S_);g.stroke()}
    g.fillStyle=g.strokeStyle=fg;if(clef==='bass')scBass(g,10,yb,S_);else scTreble(g,8,yb,S_);
    // bar lines and numbers
    for(let k=Math.max(0,Math.floor(b0/bpb));k*bpb<=b1;k++){const x=scX(k*bpb)-S_*.9;if(x<LM-14)continue;g.strokeStyle=fg;g.lineWidth=1.2;g.beginPath();g.moveTo(x,yb);g.lineTo(x,yb-4*S_);g.stroke();
      g.fillStyle=dim;g.font='11px system-ui,sans-serif';g.fillText(String(k+1),x+2,yb-4*S_-6)}
    // the cursor
    if(sel){const x=scX(SC.cur.b);if(x>=LM-14){g.strokeStyle=teal;g.lineWidth=3;g.beginPath();g.moveTo(x-S_*.9,yb+S_*1.5);g.lineTo(x-S_*.9,yb-5.5*S_);g.stroke()}}
    // the notes, a stem per chord
    const ns=scNotes(tr),groups=new Map();ns.forEach(n=>{const k=n.t.toFixed(3);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n)});
    g.save();g.beginPath();g.rect(LM-16,0,W,H);g.clip();
    for(const [k,gp] of groups){const t=+k,x=scX(t);if(x<LM-20||x>W+20)continue;let lo=1e9,hi=-1e9;
      for(const n of gp){const dn=scDn(n.p),ny=yb-(dn-Z)*S_/2,isSel=SC.sel&&SC.sel.ref===n.ref,col=isSel?gold:fg;lo=Math.min(lo,ny);hi=Math.max(hi,ny);g.fillStyle=g.strokeStyle=col;
        g.lineWidth=1;for(let L=Z-2;L>=dn;L-=2){const ly=yb-(L-Z)*S_/2;g.beginPath();g.moveTo(x-S_*1.1,ly);g.lineTo(x+S_*1.1,ly);g.stroke()}
        for(let L=Z+10;L<=dn;L+=2){const ly=yb-(L-Z)*S_/2;g.beginPath();g.moveTo(x-S_*1.1,ly);g.lineTo(x+S_*1.1,ly);g.stroke()}
        const lab=scLabel(n.p),acc=lab.slice(1).replace(/[^♯♭#]/g,'');if(acc){g.font='700 15px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(acc.replace('#','♯'),x-S_*1.6,ny)}
        const d=n.d;scHead(g,x,ny,S_,d>=1.9);if([.75,1.5,3].some(v=>Math.abs(d-v)<.05)){g.beginPath();g.arc(x+S_*1.05,ny-(dn%2?0:S_*.4),S_*.2,0,7);g.fill()}
        if(isSel){g.strokeStyle=gold;g.lineWidth=2;g.beginPath();g.arc(x,ny,S_*1.15,0,7);g.stroke()}
        SC.hits.push({x,y:ny,pi,n});
        if(SC.names){g.fillStyle=isSel?gold:dim;g.font=(isSel?'700 ':'')+'12px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(lab+(Math.floor(scMidi(n.p)/12)-1),x,yb+S_*2.4+gp.filter(q=>scMidi(q.p)>scMidi(n.p)).length*13)}}
      const d=Math.min(...gp.map(n=>n.d));if(d<3.9){const up=(lo+hi)/2>yb-2*S_,sx=up?x+S_*.6:x-S_*.6,top=up?Math.min(lo,hi)-S_*3.4:Math.max(lo,hi)+S_*3.4;g.strokeStyle=gp.some(n=>SC.sel&&SC.sel.ref===n.ref)?gold:fg;g.lineWidth=1.4;
        g.beginPath();g.moveTo(sx,up?hi:lo);g.lineTo(sx,top);g.stroke();const fl=d<.3?2:d<.7?1:0;
        for(let f=0;f<fl;f++){const fy=top+(up?1:-1)*f*S_*.8;g.beginPath();g.moveTo(sx,fy);g.quadraticCurveTo(sx+S_*.9,fy+(up?S_:-S_),sx+S_*.6,fy+(up?S_*2:-S_*2));g.stroke()}}}
    // what's playing
    if(T.playing){let b=0;try{b=heardNow()}catch{b=beatNow()}const x=scX(b);if(x>LM-14&&x<W){g.strokeStyle=gold;g.lineWidth=2;g.beginPath();g.moveTo(x,y-20);g.lineTo(x,yb+S_*3);g.stroke()}}
    g.restore()}
  const lab=q('#scWhere');if(lab)lab.textContent='Bar '+(Math.floor(SC.x0/bpb)+1)+(SC.sel?' · '+scLabel(SC.sel.n.p)+(Math.floor(scMidi(SC.sel.n.p)/12)-1)+', '+scLenName(SC.sel.n.d):'');
  if(T.playing&&!SC.raf){const tick=()=>{SC.raf=0;if(VIEW!=='score'||!T.playing){scDraw();return}let b=0;try{b=heardNow()}catch{}const w=(q('#scCan')||{}).clientWidth||360;if(scX(b)>w-30||scX(b)<LM)SC.x0=Math.max(0,b-1);scDraw()};SC.raf=requestAnimationFrame(tick)}}
const scLenName=d=>{const m=[[4,'whole'],[3,'dotted half'],[2,'half'],[1.5,'dotted quarter'],[1,'quarter'],[.75,'dotted eighth'],[.5,'eighth'],[.25,'16th']].find(([v])=>Math.abs(v-d)<.06);return m?m[1]:(Math.round(d*100)/100)+' beats'};
function scHead(g,x,y,s,open){g.save();g.translate(x,y);g.rotate(-.35);g.beginPath();g.ellipse(0,0,s*.66,s*.46,0,0,7);if(open){g.lineWidth=s*.17;g.stroke()}else g.fill();g.restore()}
function scTreble(g,x,yb,s){g.save();g.font=(s*7.4)+'px "Noto Music","Segoe UI Symbol","Apple Symbols",serif';g.textBaseline='alphabetic';g.textAlign='left';
  if(g.measureText('𝄞').width>s*1.5)g.fillText('𝄞',x,yb+s*1.55);
  else{const yg=yb-s;g.lineWidth=s*.22;g.beginPath();g.moveTo(x+s*1.1,yb+s*1.8);g.lineTo(x+s*1.1,yb-s*5);g.quadraticCurveTo(x+s*2.2,yb-s*3.8,x+s*.6,yb-s*2.2);g.quadraticCurveTo(x-s*.2,yb-s*1.1,x+s*.9,yb-s*.2);
    g.quadraticCurveTo(x+s*2.1,yb-s*.4,x+s*1.8,yg-s*.1);g.quadraticCurveTo(x+s*1.2,yg-s*.8,x+s*.7,yg+s*.1);g.stroke();g.beginPath();g.arc(x+s*.75,yb+s*1.75,s*.32,0,7);g.fill()}g.restore()}
function scBass(g,x,yb,s){g.save();g.font=(s*3.6)+'px "Noto Music","Segoe UI Symbol","Apple Symbols",serif';g.textBaseline='alphabetic';g.textAlign='left';
  if(g.measureText('𝄢').width>s*1.2)g.fillText('𝄢',x,yb-s*.9);else{const yf=yb-3*s;g.lineWidth=s*.32;g.beginPath();g.arc(x+s*.55,yf,s*.38,0,7);g.fill();
    g.beginPath();g.moveTo(x+s*.3,yf-s*.3);g.bezierCurveTo(x+s*1.2,yf-s*1.6,x+s*2.8,yf-s*.6,x+s*1.6,yf+s*1.2);g.quadraticCurveTo(x+s*1,yf+s*2.2,x+s*.2,yf+s*2.6);g.stroke();
    for(const dy of [-.5,.5]){g.beginPath();g.arc(x+s*2.6,yf+dy*s,s*.2,0,7);g.fill()}}g.restore()}
/* ---- editing ---- */
const scTr=()=>scParts()[SC.cur.pi]||scParts()[0];
const scGrid=()=>Math.min(.5,scLen())>=.5?.5:.25;
function scSelect(h){SC.sel=h?{pi:h.pi,ref:h.n.ref,n:h.n}:null;if(h){SC.cur={pi:h.pi,b:h.n.t};scSound(scParts()[h.pi],h.n.p)}scRender()}
// after a change, find the picked note again (its object can change when a My part cue is split)
function scRepick(pi,t,p){const tr=scParts()[pi];if(!tr){SC.sel=null;return}const n=scNotes(tr).find(x=>Math.abs(x.t-t)<.002&&x.p===p);SC.sel=n?{pi,ref:n.ref,n}:null}
function scEdit(fn,keepSel){const s=SC.sel;if(!s)return say('Tap a note first.');const tr=scParts()[s.pi];if(!tr)return;pushHistory();const r=fn(tr,s.ref,s.n);scDone(tr);if(keepSel!==false)scRepick(s.pi,r&&r.t!=null?r.t:s.n.t,r&&r.p||s.n.p);scRender()}
function scAddAt(pi,b,id){const tr=scParts()[pi];if(!tr||!id)return;const now=performance.now(),chord=now-SC.lastAdd<120&&SC.lastAt&&SC.lastAt.pi===pi;
  const t=chord?SC.lastAt.b:r3(b);pushHistory();scOps.add(tr,t,scLen(),id);scDone(tr);scSound(tr,id);SC.lastAdd=now;SC.lastAt={pi,b:t};
  SC.cur={pi,b:r3(t+scLen())};scRepick(pi,t,id);const W=(q('#scCan')||{}).clientWidth||360;if(scX(SC.cur.b)>W-40)SC.x0=Math.max(0,SC.cur.b-((W-LM)/SC.ppb)*.6);scRender()}
function scLetter(L){const tr=scTr();if(!tr)return say('Add a pan track first.');const pi=scParts().indexOf(tr);
  const before=scNotes(tr).filter(n=>n.t<SC.cur.b+.001).pop(),ids=scIds(tr),ref=before?scMidi(before.p):scMidi(ids[Math.floor(ids.length/2)]);
  let best=null,bd=1e9;for(const id of ids){const lab=scLabel(id);if(lab[0].toUpperCase()!==L)continue;const d=Math.abs(scMidi(id)-ref)+(/♯|♭/.test(lab)?24:0);if(d<bd){bd=d;best=id}}   // the plain letter first; its ♯ or ♭ only when the pan has no natural
  if(!best)return say('This pan has no '+L+'.');scAddAt(pi,SC.cur.b,best)}
function scShift(semi){scEdit((tr,ref,n)=>{const m=scMidi(n.p)+semi,id=scIds(tr).find(x=>scMidi(x)===m);if(!id){say('This pan has no note there.');return}scOps.pitch(tr,ref,id);scSound(tr,id);return {p:id}})}
/* ---- pointer: tap a note to pick it, drag it up or down; tap the staff to place the cursor (or add a note with ✏ Add); drag the staff sideways to look along */
function scDown(e){const cv=q('#scCan');if(!cv)return;const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  let best=null,bd=14*14;for(const h of SC.hits||[]){const d=(h.x-x)**2+(h.y-y)**2;if(d<bd){bd=d;best=h}}
  const row=scRows().find(R=>y>=R.y-34&&y<=R.yb+S_*5);
  SC.drag={x0:e.clientX,y0:e.clientY,hit:best,row,moved:false,steps:0,xs:SC.x0,pid:e.pointerId,hist:false};try{cv.setPointerCapture(e.pointerId)}catch{}
  if(best){scSelect(best)}e.preventDefault()}
function scMove(e){const D=SC.drag;if(!D||D.pid!==e.pointerId)return;const dx=e.clientX-D.x0,dy=e.clientY-D.y0;if(!D.moved&&Math.hypot(dx,dy)<6)return;D.moved=true;
  if(D.hit&&SC.sel){const k=Math.round(-dy/(S_/2));if(k!==D.steps){const tr=scParts()[SC.sel.pi],from=D.hit.n.p,to=scStep(tr,from,k);
      if(to!==SC.sel.n.p){if(!D.hist){pushHistory();D.hist=true}scOps.pitch(tr,SC.sel.ref,to);const t=SC.sel.n.t;scDone(tr);scRepick(SC.sel.pi,t,to);scSound(tr,to);scRender()}D.steps=k}}
  else{SC.x0=Math.max(0,D.xs-dx/SC.ppb);scDraw()}}
function scUp(e){const D=SC.drag;if(!D||D.pid!==e.pointerId)return;SC.drag=null;if(D.moved||D.hit)return;
  const cv=q('#scCan'),r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,R=D.row;if(!R){SC.sel=null;scRender();return}
  const g=scGrid(),b=Math.max(0,Math.round(scB(x+S_*.9)/g)*g);SC.cur={pi:R.pi,b:r3(b)};
  if(SC.add){const dn=R.Z+Math.round((R.yb-y)/(S_/2)),m=12*(Math.floor(dn/7)+1)+SC_PC[((dn%7)+7)%7];scAddAt(R.pi,b,scNearest(R.tr,m))}else{SC.sel=null;scRender()}}
/* ---- the panel ---- */
function scRender(){const el=q('#stScore');if(!el||VIEW!=='score'||!song)return;const parts=scParts();if(SC.cur.pi>=parts.length)SC.cur.pi=0;
  const tr=parts[SC.cur.pi],s=SC.sel,L=scLen();
  if(!el.querySelector('#scCan')){el.innerHTML='<div class="sc-bar" id="scBar"></div><div class="sc-keys" id="scKeys"></div><div class="sc-wrap"><canvas id="scCan" aria-label="The score: tap a note to pick it, drag it up or down"></canvas></div><div class="sc-foot" id="scFoot"></div><div class="pair st-pans sc-pans" id="scPans"></div><p class="help" id="scHelp"></p>';
    const cv=q('#scCan');cv.addEventListener('pointerdown',scDown);cv.addEventListener('pointermove',scMove);cv.addEventListener('pointerup',scUp);cv.addEventListener('pointercancel',()=>{SC.drag=null});
    el.addEventListener('click',scClick)}
  const len=d=>{const on=s?Math.abs(s.n.d-d*(SC.dot?1.5:1))<.06||Math.abs(s.n.d-d)<.06:SC.len===d;return '<button class="chip'+(on?' on':'')+'" data-sc="len" data-v="'+d+'" aria-pressed="'+on+'">'+SC_LENS.find(x=>x[0]===d)[1]+'</button>'};
  q('#scBar').innerHTML=SC_LENS.map(([d])=>len(d)).join('')+'<button class="chip'+(SC.dot?' on':'')+'" data-sc="dot" aria-pressed="'+SC.dot+'">Dotted</button>'
    +'<span class="sc-gap"></span><button class="chip'+(SC.add?' on':'')+'" data-sc="addmode" aria-pressed="'+SC.add+'">✏ Add by tapping</button>';
  q('#scKeys').innerHTML=['C','D','E','F','G','A','B'].map(k=>'<button class="btn sm sc-k" data-sc="let" data-v="'+k+'">'+k+'</button>').join('')
    +'<button class="btn sm" data-sc="semi" data-v="1"'+(s?'':' disabled')+'>♯</button><button class="btn sm" data-sc="semi" data-v="-1"'+(s?'':' disabled')+'>♭</button>'
    +'<button class="btn sm" data-sc="semi" data-v="12"'+(s?'':' disabled')+' aria-label="Up an octave">8va ▲</button><button class="btn sm" data-sc="semi" data-v="-12"'+(s?'':' disabled')+' aria-label="Down an octave">8va ▼</button>';
  q('#scFoot').innerHTML='<button class="btn sm" data-sc="step" data-v="1"'+(s?'':' disabled')+' aria-label="Up to the next note on the pan">▲</button><button class="btn sm" data-sc="step" data-v="-1"'+(s?'':' disabled')+' aria-label="Down to the next note on the pan">▼</button>'
    +'<button class="btn sm" data-sc="move" data-v="-1"'+(s?'':' disabled')+' aria-label="Earlier">◀</button><button class="btn sm" data-sc="move" data-v="1"'+(s?'':' disabled')+' aria-label="Later">▶</button>'
    +'<button class="btn sm danger" data-sc="del"'+(s?'':' disabled')+'>⌫ Delete</button><span class="sc-gap"></span>'
    +'<button class="btn sm" data-sc="names" aria-pressed="'+SC.names+'">'+(SC.names?'🔤 Names on':'🔤 Names off')+'</button>'
    +'<button class="btn sm" data-sc="zoom" data-v="-1" aria-label="Zoom out">−</button><button class="btn sm" data-sc="zoom" data-v="1" aria-label="Zoom in">+</button>'
    +'<button class="btn sm primary" data-sc="play">'+(T.playing?'■ Stop':'▶ From the cursor')+'</button><span class="sc-where" id="scWhere"></span>';
  // the pans of the part the cursor is in: tap one to put it in at the cursor
  const pans=q('#scPans');const sk=tr?trSet(tr):null;if(pans.dataset.set!==String(sk)){pans.dataset.set=String(sk);
    if(sk){const views=SETS[sk].views,order=sk==='guitar'&&S.swapped?[views[1],views[0]]:views;pans.className='pair st-pans sc-pans'+(order.length===1?' one':'');pans.innerHTML=order.map(p=>panSVG(p,true)).join('');
      pans.querySelectorAll('.field').forEach(f=>f.addEventListener('pointerdown',e=>{e.preventDefault();const t=scTr();if(!t)return;f.classList.add('hit');setTimeout(()=>f.classList.remove('hit'),160);scAddAt(SC.cur.pi,SC.cur.b,f.dataset.field)}))}else pans.innerHTML=''}
  q('#scHelp').innerHTML=!parts.length?'':s?'<b>'+scLabel(s.n.p)+'</b> is picked: drag it up or down, tap a length, or ◀ ▶ ⌫. Tap the staff to let go.'
    :'Tap a note to pick it. New notes go in at the <span style="color:var(--teal)">teal line</span> ('+scLenName(L)+'s): tap a pan below, a letter above'+(SC.add?', or the staff':', or switch on ✏ Add by tapping')+'. Tap the staff to move the line; drag it sideways to look along.';
  scDraw()}
function scClick(e){const b=e.target.closest('[data-sc]');if(!b||b.disabled)return;const k=b.dataset.sc,v=+b.dataset.v,s=SC.sel;
  if(k==='len'){SC.len=v;scSave();if(s){const d=v*(SC.dot?1.5:1);scEdit((tr,ref)=>scOps.len(tr,ref,d))}else scRender()}
  else if(k==='dot'){SC.dot=!SC.dot;scSave();if(s){const d=SC.len*(SC.dot?1.5:1);scEdit((tr,ref)=>scOps.len(tr,ref,d))}else scRender()}
  else if(k==='addmode'){SC.add=!SC.add;scSave();scRender()}
  else if(k==='let')scLetter(b.dataset.v);
  else if(k==='semi')scShift(v);
  else if(k==='step')scEdit((tr,ref,n)=>{const id=scStep(tr,n.p,v);scOps.pitch(tr,ref,id);scSound(tr,id);return {p:id}});
  else if(k==='move')scEdit((tr,ref,n)=>{const dt=v*scGrid();scOps.move(tr,ref,dt);return {t:r3(Math.max(0,n.t+dt))}});
  else if(k==='del'){scEdit((tr,ref)=>scOps.del(tr,ref),false);SC.sel=null;scRender()}
  else if(k==='names'){SC.names=!SC.names;scSave();scRender()}
  else if(k==='zoom'){SC.ppb=Math.max(28,Math.min(120,SC.ppb*(v>0?1.25:.8)));scSave();scDraw()}
  else if(k==='play'){if(T.playing){stop(false)}else{seek(SC.cur.b);play(false)}setTimeout(scRender,60)}}
