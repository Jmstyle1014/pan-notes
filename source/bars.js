/* ---------- your part in bars: edit cues a bar at a time, with a note grid (tools from the Studio) ---------- */
// Works straight on your cues, so the chart, letters, game and lanes all follow. Bars come from ♩ Timing;
// with no tempo set, a "bar" is a 2-second block.
const BARS=(()=>{
const q=s=>document.querySelector(s);
const G=()=>S.grid&&Number.isFinite(S.grid.bpm)&&S.grid.bpm>=30&&S.grid.bpm<=300?S.grid:null;
const spb=()=>G()?60/G().bpm:0.5;
const bpb=()=>G()&&G().perBar>=2?G().perBar:4;
const barSec=()=>spb()*bpb();
const origin=()=>{const g=G();if(!g)return 0;let o=+g.offset||0;const b=barSec();while(o>1e-6)o-=b;return o};
const tOf=bar=>origin()+bar*barSec();
const barOf=t=>Math.floor((t-origin())/barSec()+1e-6);
const songEnd=()=>Math.max(hasAudio&&Number.isFinite(audio.duration)?audio.duration:0,...S.cues.map(c=>c.start+c.duration),8);
const nBars=()=>Math.max(4,Math.ceil((songEnd()-origin())/barSec())+1);
const PIDS=Object.keys(PITCH).sort((a,b)=>midiOf(PITCH[b])-midiOf(PITCH[a]));   // high to low
const panOf=id=>NOTE_PAN[(FIELDS.get(id)||{}).label]||'ec';
const pname=id=>{const f=FIELDS.get(id);return (f?f.label:id)+PITCH[id].slice(-1)};
let ver=0;const subs=[];
const changed=()=>{ver++;subs.forEach(f=>{try{f()}catch{}})};

/* every note that sounds: a run plays its notes evenly across its cue */
function events(){
  const out=[];
  for(const c of S.cues){if(!c.steps||!c.steps.length)continue;const fx=markOf(c);
    if(c.mode==='together')c.steps.forEach(id=>out.push({t:c.start,d:c.duration,p:id,fx,cid:c.id}));
    else{const n=c.steps.length;c.steps.forEach((id,i)=>out.push({t:c.start+i*c.duration/n,d:c.duration/n,p:id,fx,cid:c.id}))}}
  return out.sort((a,b)=>a.t-b.t);
}
const inR=(c,a,b)=>c.start>=a-1e-4&&c.start<b-1e-4;
function commit(msg){normalizeChords();renderCues();save();tick();changed();if(msg)say(msg)}
const r3=x=>+(+x).toFixed(3);
/* bar tools, on a stretch of time [a, b) in seconds */
function shift(a,b,dt){const cs=S.cues.filter(c=>inR(c,a,b));if(!cs.length)return 0;pushUndo();cs.forEach(c=>{c.start=r3(Math.max(0,c.start+dt))});commit();return cs.length}
const clone=(c,start)=>({...JSON.parse(JSON.stringify(c)),id:uid(),start:r3(start)});
function copyTo(a,b,to){const cs=S.cues.filter(c=>inR(c,a,b));if(!cs.length)return 0;pushUndo();cs.forEach(c=>S.cues.push(clone(c,c.start-a+to)));S.cues.sort((x,y)=>x.start-y.start);commit();return cs.length}
function repeat(a,b,end){
  const cs=S.cues.filter(c=>inR(c,a,b));if(!cs.length)return 0;pushUndo();const len=b-a;let k=1;
  for(;a+k*len<end-1e-3;k++){const off=k*len;S.cues=S.cues.filter(c=>!inR(c,a+off,Math.min(b+off,end)));cs.forEach(c=>{if(c.start+off<end)S.cues.push(clone(c,c.start+off))})}
  S.cues.sort((x,y)=>x.start-y.start);commit();return k-1;
}
function snap(a,b,qs){const cs=S.cues.filter(c=>inR(c,a,b));if(!cs.length)return 0;pushUndo();const o=origin();cs.forEach(c=>{c.start=r3(Math.max(0,o+Math.round((c.start-o)/qs)*qs))});S.cues.sort((x,y)=>x.start-y.start);commit();return cs.length}
function del(a,b){const n=S.cues.filter(c=>inR(c,a,b)&&c.steps&&c.steps.length).length;if(!n)return 0;pushUndo();
  // reminders stay: a cue's reminder is kept on its own at the same moment
  S.cues=S.cues.flatMap(c=>!inR(c,a,b)||!c.steps||!c.steps.length?[c]:c.note?[{id:uid(),start:c.start,duration:.5,steps:[],mode:'sequence',note:c.note}]:[]);commit();return n}
// rebuild the cues that start in [a, b) from a list of notes ({t, d, p, fx} in seconds); notes struck together become a chord
function replaceRange(a,b,notes,noUndo){
  if(!noUndo)pushUndo();
  const keep=[];
  for(const c of S.cues){if(!inR(c,a,b)){keep.push(c);continue}if(c.note)keep.push({id:uid(),start:c.start,duration:.5,steps:[],mode:'sequence',note:c.note})}
  const groups=new Map();
  for(const n of notes){const k=Math.round(n.t*1000)+'|'+(n.fx||'');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n)}
  for(const g of groups.values()){const steps=[...new Set(g.map(n=>n.p))].sort(byScreen);
    const c={id:uid(),start:r3(Math.max(0,g[0].t)),duration:r3(Math.max(.05,...g.map(n=>n.d))),steps,mode:steps.length>1?'together':'sequence',note:''};if(g[0].fx)c.fx=g[0].fx;keep.push(c)}
  S.cues=keep.sort((x,y)=>x.start-y.start);commit();
}

/* ---- the bar editor ---- */
const ED={open:false,sel:null,grid:null,ni:null,zoom:1,raf:0,snap:'0.25'};
const barPx=()=>Math.round((innerWidth<560?72:104)*ED.zoom);
const SNAPS=[['0.25','¼ beat'],['0.5','½ beat'],['1','Beat'],['off','Free']];
const qBeats=()=>ED.snap==='off'?.125:+ED.snap;
function sheet(){
  let el=q('#barSheet');if(el)return el;
  el=document.createElement('div');el.id='barSheet';el.className='sheetov bx';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','bxTitle');
  el.innerHTML='<div class="sheetbox bxbox"><div class="sheethead"><h2 id="bxTitle">Your part in bars</h2><button class="btn" data-bx="close">Done</button></div><div id="bxBody"></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click',onClick);
  el.addEventListener('pointerdown',e=>{const lane=e.target.closest('.bx-lane');if(lane&&!e.target.closest('button'))laneTap(e,lane)});
  return el;
}
function open(range){
  sheet().hidden=false;ED.open=true;ED.grid=null;ED.ni=null;
  if(range){const a=barOf(range.a+1e-3),b=Math.max(a+1,Math.ceil((range.b-origin())/barSec()-1e-3));ED.sel={anchor:a,a,b};if(range.grid)ED.grid={a,b}}
  render();
  if(ED.sel){const tl=q('#bxTl');if(tl)tl.scrollLeft=Math.max(0,ED.sel.a*barPx()-40)}
  cancelAnimationFrame(ED.raf);const loopf=()=>{if(!ED.open)return;playhead();ED.raf=requestAnimationFrame(loopf)};loopf();
}
function close(){const el=q('#barSheet');if(el)el.hidden=true;ED.open=false;cancelAnimationFrame(ED.raf);ED.grid=null;changed()}
function sections(){return typeof sectionsNow==='function'?sectionsNow():[]}
function render(){
  const body=q('#bxBody');if(!body)return;const keep=q('#bxTl')?[q('#bxTl').scrollLeft]:[0];
  const n=nBars(),bp=barPx(),W=n*bp,o=origin(),bs=barSec(),ev=events();
  if(ED.sel&&ED.sel.a>=n)ED.sel=null;
  let h='<div class="row bxtop"><button class="btn primary bxplay" data-bx="play" aria-label="'+(audio.paused?'Play':'Pause')+'">'+(audio.paused?'▶':'❚❚')+'</button><span class="bxpos" id="bxPos">Bar 1</span>'
    +'<button class="btn sm" data-bx="undo" '+(undoStack.length?'':'disabled')+'>↶ Undo</button><button class="btn sm" data-bx="redo" '+(redoStack.length?'':'disabled')+'>↷ Redo</button>'
    +'<span class="bxzoom"><button class="btn sm" data-bx="zout" aria-label="Zoom out">−</button><button class="btn sm" data-bx="zin" aria-label="Zoom in">+</button></span></div>';
  if(!G())h+='<p class="help">No tempo set yet, so each "bar" here is a 2-second block. Set <b>♩ Timing</b> (or ✨ Find the tempo for me) for real bars.</p>';
  h+='<div class="bxtl" id="bxTl"><div class="bxin" style="width:'+(W+96)+'px;--bp:'+bp+'px">';
  h+='<div class="bxrow bxruler"><div class="bxhd">Bar</div><div class="bxl" data-bx="ruler" style="width:'+W+'px">';
  for(let b=0;b<n;b++)h+='<span class="bxn" style="left:'+b*bp+'px">'+(b+1)+'</span>';
  for(const s of sections()){const x=(s.t-o)/bs*bp;if(x<W)h+='<span class="bxsec" style="left:'+Math.max(0,x)+'px">'+esc(s.name)+'</span>'}
  if(loop&&A!==null&&B!==null)h+='<span class="bxloop" style="left:'+(A-o)/bs*bp+'px;width:'+(B-A)/bs*bp+'px"></span>';
  h+='</div></div>';
  if(hasAudio&&peaks)h+='<div class="bxrow bxrec"><div class="bxhd">Recording</div><div class="bxl bx-lane" style="width:'+W+'px"><canvas id="bxWave" width="'+Math.min(16000,W)+'" height="44"></canvas></div></div>';
  for(const pk of ['ec','bf']){const p=PANS.find(x=>x.key===pk),ids=PIDS.filter(id=>panOf(id)===pk);
    h+='<div class="bxrow bxpan pn-'+pk+'"><div class="bxhd">'+esc(p?p.name:pk)+'</div><div class="bxl bx-lane" style="width:'+W+'px">';
    for(const e of ev){if(panOf(e.p)!==pk)continue;const y=ids.indexOf(e.p);h+='<i class="'+(e.fx?'fx':'')+'" style="left:'+((e.t-o)/bs*bp).toFixed(1)+'px;top:'+(6+y*(52/Math.max(1,ids.length-1))).toFixed(1)+'px;width:'+Math.max(4,e.d/bs*bp-1).toFixed(1)+'px"></i>'}
    if(ED.sel)h+='<span class="bxsel" style="left:'+ED.sel.a*bp+'px;width:'+(ED.sel.b-ED.sel.a)*bp+'px"></span>';
    h+='</div></div>'}
  h+='<div class="bxph" id="bxPh"></div></div></div>';
  if(ED.sel){const s=ED.sel,cnt=S.cues.filter(c=>inR(c,tOf(s.a),tOf(s.b))&&c.steps&&c.steps.length).length,range=s.b-s.a>1?'Bars '+(s.a+1)+'–'+s.b:'Bar '+(s.a+1);
    const bt=(k,l,c)=>'<button class="btn sm'+(c?' '+c:'')+'" data-bx="'+k+'">'+l+'</button>';
    h+='<div class="bxselbar"><span class="bxinfo"><b>'+range+'</b> · '+cnt+' cue'+(cnt===1?'':'s')+'</span>'+bt('left','◀ Move')+bt('right','Move ▶')+bt('copy','Copy after')+bt('repeat','Repeat to end')+bt('snap','Snap')+bt('notes',ED.grid?'Close notes':'Edit notes',ED.grid?'on':'')+bt('loop',loop&&Math.abs(A-tOf(s.a))<.01?'Loop off':'⟲ Loop')+bt('del','Delete','danger')+bt('clear','✕')+'</div>'}
  else h+='<p class="help">Tap a bar on either pan to select it; tap another bar to select everything between. Then move, copy, repeat, snap or delete those bars, or <b>Edit notes</b> on a grid. Tap the bar numbers to jump there.</p>';
  h+='<div class="row bxsnap"><span class="help">Snap to</span><div class="seg">'+SNAPS.map(([v,l])=>'<button data-bx="snapto" data-v="'+v+'" aria-pressed="'+(ED.snap===v)+'">'+l+'</button>').join('')+'</div></div>';
  if(ED.grid)h+=gridHTML();
  body.innerHTML=h;
  const tl=q('#bxTl');tl.scrollLeft=keep[0];
  const cv=q('#bxWave');if(cv&&peaks){const g=cv.getContext('2d'),w=cv.width,hh=cv.height,sc=W/w;g.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()||'#999';
    for(let x=0;x<w;x++){const t=o+x*sc/bp*bs,i=Math.floor(t*peakRate),v=i>=0&&i<peaks.length?peaks[i]:0,ph=Math.max(1,v*hh*.9);g.fillRect(x,(hh-ph)/2,1,ph)}}
  if(ED.grid)afterGrid();
  playhead();
}
function playhead(){
  const ph=q('#bxPh'),pos=q('#bxPos');if(!ph)return;const t=hasAudio?audio.currentTime:0,b=(t-origin())/barSec();
  ph.style.left=(96+b*barPx())+'px';if(pos)pos.textContent='Bar '+(Math.floor(b)+1)+(G()?'.'+(Math.floor((b%1)*bpb())+1):'');
  const pb=q('[data-bx="play"]');if(pb){const t2=audio.paused?'▶':'❚❚';if(pb.textContent!==t2)pb.textContent=t2}
  if(!audio.paused){const tl=q('#bxTl'),x=b*barPx();if(x<tl.scrollLeft||x>tl.scrollLeft+tl.clientWidth-120)tl.scrollLeft=Math.max(0,x-60)}
}
function laneTap(e,lane){
  const bar=Math.floor((e.clientX-lane.getBoundingClientRect().left)/barPx());if(bar<0||bar>=nBars())return;
  const s=ED.sel;
  if(s&&bar!==s.anchor&&!(s.b-s.a===1&&bar===s.a))ED.sel={anchor:s.anchor,a:Math.min(s.anchor,bar),b:Math.max(s.anchor,bar)+1};
  else if(s&&s.b-s.a===1&&bar===s.a)ED.sel=null;
  else ED.sel={anchor:bar,a:bar,b:bar+1};
  if(ED.grid&&ED.sel)ED.grid={a:ED.sel.a,b:ED.sel.b};else if(!ED.sel)ED.grid=null;
  ED.ni=null;render();
}
function onClick(e){
  const el=q('#barSheet');if(e.target===el){close();return}
  if(e.target.closest('#bxGrid')){gridTap(e);return}
  const b=e.target.closest('[data-bx]');if(!b)return;const act=b.dataset.bx,s=ED.sel,a=s?tOf(s.a):0,z=s?tOf(s.b):0,len=z-a;
  switch(act){
    case 'close':close();break;
    case 'play':if(!hasAudio){say('Add your recording in Setup first.');break}if(audio.paused){if(s&&!(audio.currentTime>=a&&audio.currentTime<z))audio.currentTime=Math.max(0,a);audio.play().catch(()=>{})}else audio.pause();break;
    case 'ruler':{const x=e.clientX-b.getBoundingClientRect().left;if(hasAudio)audio.currentTime=Math.max(0,tOf(Math.floor(x/barPx())));playhead();break}
    case 'undo':undo();changed();render();break;
    case 'redo':redo();render();break;
    case 'zin':ED.zoom=Math.min(3,ED.zoom*1.25);render();break;
    case 'zout':ED.zoom=Math.max(.4,ED.zoom/1.25);render();break;
    case 'snapto':ED.snap=b.dataset.v;render();break;
    case 'clear':ED.sel=null;ED.grid=null;render();break;
    case 'left':case 'right':{const d=act==='left'?-1:1;if(s.a+d<0||tOf(s.a)+d*barSec()<-1e-3){say("That's the start of the song.");break}
      if(shift(a,z,d*barSec())){s.a+=d;s.b+=d;s.anchor+=d;if(ED.grid)ED.grid={a:s.a,b:s.b}}else say('There are no notes in those bars.');render();break}
    case 'copy':{const n=copyTo(a,z,z);if(!n){say('There are no notes in those bars to copy.');break}ED.sel={anchor:s.b,a:s.b,b:s.b+(s.b-s.a)};say('Copied '+n+' cue'+(n===1?'':'s')+'. The copy is selected.');render();break}
    case 'repeat':{const k=repeat(a,z,songEnd());if(!k){say('There are no notes in those bars to repeat.');break}say('Repeated to the end of the song ('+k+' time'+(k===1?'':'s')+'). Undo takes it back.');render();break}
    case 'snap':{const n=snap(a,z,qBeats()*spb());say(n?'Snapped '+n+' cue'+(n===1?'':'s')+' to the '+SNAPS.find(x=>x[0]===ED.snap)[1]+'.':'There are no notes in those bars.');render();break}
    case 'del':{const n=del(a,z);say(n?'Deleted '+n+' cue'+(n===1?'':'s')+'. Undo brings them back.':'There are no notes in those bars.');ED.grid=null;render();break}
    case 'notes':ED.grid=ED.grid?null:{a:s.a,b:s.b};ED.ni=null;render();if(ED.grid){const g=q('#bxGridWrap');if(g)g.scrollIntoView({behavior:'smooth',block:'nearest'})}break;
    case 'loop':{if(!hasAudio){say('Add your recording in Setup first.');break}if(loop&&Math.abs(A-a)<.01){loop=false;renderLoop();render();say('Loop off.');break}
      A=Math.max(0,a);B=Math.min(audio.duration||z,z);loop=true;audio.currentTime=A;audio.play().catch(()=>{});renderLoop();render();say('Looping '+(s.b-s.a>1?'bars '+(s.a+1)+'–'+s.b:'bar '+(s.a+1))+'.');break}
    default:if(act.startsWith('g-'))gridAct(act,b.dataset.v);
  }
}

/* the note grid: every pan note as a row, time across */
const RH=26;
function gridNotes(){const a=tOf(ED.grid.a),b=tOf(ED.grid.b),ev=events(),mine=new Set(S.cues.filter(c=>inR(c,a,b)).map(c=>c.id));
  return{edit:ev.filter(e=>mine.has(e.cid)).map(({t,d,p,fx})=>({t,d,p,fx})),other:ev.filter(e=>!mine.has(e.cid)&&e.t+e.d>a&&e.t<b)}}
function gridHTML(){
  const a=tOf(ED.grid.a),b=tOf(ED.grid.b),qs=qBeats()*spb(),cols=Math.round((b-a)/qs),cw=Math.max(14,Math.min(34,Math.round(26*Math.sqrt(.25/qBeats())))),W=cols*cw;
  const {edit,other}=gridNotes(),x=t=>((t-a)/qs*cw).toFixed(1),w=d=>Math.max(9,d/qs*cw-2).toFixed(1);
  let gr='';PIDS.forEach((id,i)=>{gr+='<div class="bxgr pn-'+panOf(id)+'" style="top:'+i*RH+'px;width:'+W+'px"></div>'});
  for(let c=0;c<=cols;c++){const bt=c*qBeats();if(Math.abs(bt-Math.round(bt))<1e-6)gr+='<div class="bxgl'+(Math.round(bt)%bpb()===0?' bar':'')+'" style="left:'+c*cw+'px;height:'+PIDS.length*RH+'px"></div>'}
  other.forEach(n=>{gr+='<span class="bxgn dim pn-'+panOf(n.p)+'" style="left:'+x(n.t)+'px;top:'+(PIDS.indexOf(n.p)*RH+3)+'px;width:'+w(n.d)+'px;height:'+(RH-6)+'px"></span>'});
  edit.forEach((n,i)=>{gr+='<button class="bxgn pn-'+panOf(n.p)+(ED.ni===i?' on':'')+(n.fx?' fx':'')+'" data-i="'+i+'" style="left:'+x(n.t)+'px;top:'+(PIDS.indexOf(n.p)*RH+3)+'px;width:'+w(n.d)+'px;height:'+(RH-6)+'px" aria-label="'+esc(pname(n.p))+' at '+fmt(n.t)+'">'+(n.fx?MARKS[n.fx]:'')+'</button>'});
  const sel=ED.ni!=null?edit[ED.ni]:null,range=ED.grid.b-ED.grid.a>1?'bars '+(ED.grid.a+1)+'–'+ED.grid.b:'bar '+(ED.grid.a+1);
  const bt=(k,l,v,c)=>'<button class="btn sm'+(c?' '+c:'')+'" data-bx="g-'+k+'"'+(v!=null?' data-v="'+v+'"':'')+'>'+l+'</button>';
  return '<div id="bxGridWrap" class="bxgridwrap"><b class="bxgt">Notes in '+range+'</b><div class="bxgw"><div class="bxglabs" id="bxGLabs">'+PIDS.map(id=>'<div class="pn-'+panOf(id)+'" style="height:'+RH+'px">'+esc(pname(id))+'</div>').join('')+'</div>'
    +'<div class="bxgs" id="bxGS"><div class="bxgrid" id="bxGrid" style="width:'+W+'px;height:'+PIDS.length*RH+'px">'+gr+'</div></div></div>'
    +'<div class="row bxgtools"><span class="help">'+(sel?esc(pname(sel.p))+' selected:':'Tap an empty spot to add a note, or a note to select it. Faded notes belong to a cue that starts in an earlier bar.')+'</span>'
    +(sel?bt('nudge','◀',-1)+bt('nudge','▶',1)+bt('pitch','▲',1)+bt('pitch','▼',-1)+bt('len','Shorter',-1)+bt('len','Longer',1)+bt('fx',sel.fx==='roll'?'✓ Roll':'Roll','roll')+bt('fx',sel.fx==='strum'?'✓ Strum':'Strum','strum')+bt('del','Delete',null,'danger'):'')+'</div></div>';
}
let gsTop=null;
function afterGrid(){const sc=q('#bxGS'),lab=q('#bxGLabs');if(!sc)return;
  if(gsTop==null){const {edit}=gridNotes(),idx=edit.map(n=>PIDS.indexOf(n.p));gsTop=idx.length?Math.max(0,Math.min(...idx)*RH-RH):0}
  sc.scrollTop=gsTop;lab.scrollTop=gsTop;sc.onscroll=()=>{lab.scrollTop=sc.scrollTop;gsTop=sc.scrollTop}}
function hear(id){if(typeof strike==='function')strike(id,.85)}
function writeBack(list,keepSel){const a=tOf(ED.grid.a),b=tOf(ED.grid.b);replaceRange(a,b,list);
  if(keepSel){const {edit}=gridNotes();ED.ni=edit.findIndex(n=>n.p===keepSel.p&&Math.abs(n.t-keepSel.t)<.002);if(ED.ni<0)ED.ni=null}else ED.ni=null;render()}
function gridTap(e){
  const {edit}=gridNotes(),nb=e.target.closest('.bxgn:not(.dim)');
  if(nb){ED.ni=+nb.dataset.i;hear(edit[ED.ni].p);render();return}
  const g=q('#bxGrid'),r=g.getBoundingClientRect(),qs=qBeats()*spb(),a=tOf(ED.grid.a),cols=Math.round((tOf(ED.grid.b)-a)/qs),cw=parseFloat(g.style.width)/cols;
  const id=PIDS[Math.floor((e.clientY-r.top)/RH)],col=Math.floor((e.clientX-r.left)/cw);if(!id||col<0||col>=cols)return;
  const n={t:r3(a+col*qs),d:r3(Math.max(qs,spb()*.5)),p:id,fx:''};hear(id);writeBack([...edit,n],n);
}
function gridAct(act,v){
  const {edit}=gridNotes(),n=edit[ED.ni];if(!n)return;const qs=qBeats()*spb(),a=tOf(ED.grid.a),b=tOf(ED.grid.b);
  if(act==='g-del'){edit.splice(ED.ni,1);writeBack(edit);return}
  if(act==='g-nudge')n.t=r3(Math.max(a,Math.min(b-qs,n.t+(+v)*qs)));
  else if(act==='g-len')n.d=r3(Math.max(qs/2,n.d+(+v)*qs));
  else if(act==='g-pitch'){const i=PIDS.indexOf(n.p);n.p=PIDS[Math.max(0,Math.min(PIDS.length-1,i-(+v)))]}
  else if(act==='g-fx')n.fx=n.fx===v?'':v;
  hear(n.p);writeBack(edit,n);
}
window.addEventListener('resize',()=>{if(ED.open)render()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ED.open)close()});
return{events,shift,copyTo,repeat,snap,del,replaceRange,open,close,onChange:f=>subs.push(f),get ver(){return ver},origin,barSec,spb,tOf,ED,render};
})();
/* redo, alongside the timeline's undo */
let redoStack=[];
{const _push=pushUndo;pushUndo=function(){_push();redoStack=[]}}
{const _undo=undo;undo=function(){if(undoStack.length)redoStack.push(JSON.stringify(S.cues));_undo();BARS.render&&document.getElementById('barSheet')&&!document.getElementById('barSheet').hidden&&BARS.render()}}
function redo(){
  if(!redoStack.length){say('Nothing to redo.');return}
  undoStack.push(JSON.stringify(S.cues));S.cues=JSON.parse(redoStack.pop());
  renderCues();if(typeof renderSel==='function')renderSel();save();tick();renderUndo();say('Redone.');
}
$('undoBtn').onclick=()=>undo();
$('barsBtn').onclick=()=>{
  const cs=typeof selCues==='function'?selCues():[];
  BARS.open(cs.length?{a:Math.min(...cs.map(c=>c.start)),b:Math.max(...cs.map(c=>c.start))+0.01}:null);
};
