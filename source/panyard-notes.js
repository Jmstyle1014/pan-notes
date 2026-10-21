
/* ---------- My notes: your practice notebook, next to the song (Play, Write, and Chart → Notes) ----------
   Each song has its own pages (pages written before this, which belonged to no song, show in every song). A page
   holds handwriting (pen and marker, in 8 colours and 3 sizes), typed text, and section tags: a tag names a part of
   the song (Intro, Verse 1…), and its ▶ jumps the recording there and ↻ loops it. While the song plays, Follow
   scrolls your notes to the part that's playing. Full screen has every tool: Pen, Marker, Eraser, Text, Select
   (move, copy, paste, duplicate, delete), Section, and Page (background, pages). Two fingers scroll and pinch zoom.
   Saved on this phone: handwriting in localStorage 'pan-ink-<page>' (the same as before, so old pages keep working),
   the rest in 'pan-note-<page>', which song a page belongs to in 'panyard-notebook'. All of it is in the Google
   Drive backup, and the backup file carries this song's pages. */
var NOTES=(()=>{
  const W=1000,PH=1414,EXT=700;
  const COLS=['#f3efe8','#ffc65c','#5fc4c0','#ff8a7a','#ff3a4f','#7be07b','#8fb6ff','#c9a2ff'],SIZES=[3,6,11];
  // the old notebook draws from INKS: it gets the new colours too (its first four stay what they were)
  try{while(INKS.length<COLS.length)INKS.push(COLS[INKS.length])}catch{}
  const BGS=[['dark','Dark'],['paper','Paper'],['lined','Lined'],['staff','Music staff'],['grid','Grid'],['flag','Flag red']];
  const K='panyard-notebook';let book={own:{},cur:{}};
  try{const x=JSON.parse(localStorage.getItem(K)||'null');if(x&&typeof x==='object')book={own:x.own||{},cur:x.cur||{}}}catch{}
  const keepBook=()=>{try{localStorage.setItem(K,JSON.stringify(book))}catch{}};
  const sid=()=>{try{return isDemo?'demo':songNow().id}catch{return 'demo'}};
  // this song's own pages first (there's always one), then pages from before My notes, which every song shows
  // A song with no page yet shows a blank one that only becomes real (and is saved) when you write on it, so opening
  // a screen never saves anything, and nothing is saved while the app is still starting up.
  const blanks=new Map(),alias={};
  const blank=s=>{if(!blanks.has(s))blanks.set(s,{id:'new:'+s,created:Date.now(),h:PH});return blanks.get(s)};
  const songPages=()=>{const s=sid();let own=S.notePages.filter(p=>book.own[p.id]===s);if(!own.length)own=[blank(s)];
    return own.concat(S.notePages.filter(p=>!book.own[p.id]&&!String(p.id).startsWith('new:')))};
  let ready=false;setTimeout(()=>{ready=true},0);
  function real(id){
    if(alias[id])return alias[id];if(!String(id).startsWith('new:')||!ready)return id;
    const s=id.slice(4),b=blank(s),p={id:uid(),created:b.created,h:b.h};S.notePages.push(p);book.own[p.id]=s;keepBook();
    data.set(p.id,data.get(id)||{strokes:[],texts:[],tags:[],bg:'lined'});alias[id]=p.id;blanks.delete(s);try{save()}catch{}return p.id}
  const curIdx=()=>Math.max(0,Math.min(songPages().length-1,book.cur[sid()]||0));
  const curPg=()=>songPages()[curIdx()];
  /* ---- a page's contents ---- */
  const data=new Map();   // page id → {strokes:[{c,w,m,p:[[x,y,pr]…]}], texts:[{id,x,y,s,c,t}], tags:[{id,x,y,name,t}], bg}
  function load(id){
    if(alias[id])id=alias[id];if(data.has(id))return data.get(id);
    let strokes=[],ex={};
    try{const r=JSON.parse(localStorage.getItem('pan-ink-'+id)||'[]');if(Array.isArray(r))strokes=r.filter(k=>k&&typeof k.d==='string').map(k=>({c:Math.max(0,Math.min(COLS.length-1,+k.c||0)),w:+k.w||5,m:k.m?1:0,p:k.d.split(';').map(q=>q.split(',').map(Number)).filter(q=>q.length===3&&q.every(Number.isFinite))}))}catch{}
    try{ex=JSON.parse(localStorage.getItem('pan-note-'+id)||'{}')||{}}catch{}
    const d={strokes,texts:Array.isArray(ex.texts)?ex.texts.filter(t=>t&&typeof t.t==='string'):[],tags:Array.isArray(ex.tags)?ex.tags.filter(t=>t&&typeof t.name==='string'):[],bg:BGS.some(b=>b[0]===ex.bg)?ex.bg:'lined'};
    data.set(id,d);return d;
  }
  const saveT=new Map();
  function store(id){
    id=real(id);if(String(id).startsWith('new:'))return;
    clearTimeout(saveT.get(id));saveT.set(id,setTimeout(()=>{const d=load(id);
      const ink=JSON.stringify(d.strokes.map(k=>({c:k.c,w:k.w,...(k.m?{m:1}:{}),d:k.p.map(q=>q.join(',')).join(';')})));
      try{localStorage.setItem('pan-ink-'+id,ink);localStorage.setItem('pan-note-'+id,JSON.stringify({bg:d.bg,texts:d.texts,tags:d.tags}))}
      catch{say('This phone is out of room for notes. Delete an old page to keep writing.')}
      if(ink.length>400000)say('This page is getting full. Add a new page in Page to keep writing.');
      try{save()}catch{}},500));
  }
  /* ---- undo ---- */
  let undo=[],redo=[];
  const snap=id=>{id=real(id);const d=load(id);return {id,v:JSON.stringify({strokes:d.strokes,texts:d.texts,tags:d.tags,bg:d.bg})}};
  function mark(id){undo.push(snap(id));if(undo.length>80)undo.shift();redo=[]}
  function restore(s){const d=load(s.id),v=JSON.parse(s.v);Object.assign(d,v);store(s.id)}
  function undoDo(){const u=undo.pop();if(!u)return;redo.push(snap(u.id));restore(u);sel.clear();all()}
  function redoDo(){const r=redo.pop();if(!r)return;undo.push(snap(r.id));restore(r);sel.clear();all()}
  /* ---- the song's sections, for tags and chips ---- */
  const secs=()=>{try{return sectionsNow()}catch{return []}};
  const secOf=name=>secs().find(s=>s.name.toLowerCase()===String(name).toLowerCase());
  function chipNames(){const n=secs().map(s=>s.name);for(const p of songPages())for(const t of load(p.id).tags)if(!n.some(x=>x.toLowerCase()===t.name.toLowerCase()))n.push(t.name);return n}
  function nowSec(){if(!hasAudio)return null;const t=audio.currentTime;const s=secs().find(x=>t>=x.t-0.05&&t<x.end);return s?s.name:null}
  async function jump(name,loopIt,t0){
    if(!hasAudio&&typeof MYPART!=='undefined'&&MYPART.can()){if(!await MYPART.make())return}
    if(!hasAudio){say('Add the recording (or write some notes) to jump to '+name+'.');return}
    const s=secOf(name),t=s?s.t:Number.isFinite(t0)?t0:null;
    if(t==null){say('“'+name+'” isn’t in this song’s sections yet. Add it on the Chart, or tag it while the recording plays.');return}
    audio.currentTime=Math.max(0,t);
    if(loopIt&&s){try{if(!(loop&&A!==null&&Math.abs(A-s.t)<0.05))loopSection(s)}catch{}}
    try{if(audio.paused)await audio.play()}catch{}
    say((loopIt&&s?'Looping ':'Playing from ')+name+'.');
  }
  /* ---- drawing a page ---- */
  const inkCol=(c,bg)=>bg==='paper'&&c===0?'#1d1b22':COLS[c]||COLS[0];
  function drawBg(g,d,h){
    const bg=d.bg;g.fillStyle=bg==='paper'?'#f6f1e6':bg==='flag'?'#3a0910':'#17181d';g.fillRect(0,0,W,h);
    if(bg==='flag'){const gr=g.createRadialGradient(W*.3,200,50,W*.5,h*.4,W);gr.addColorStop(0,'rgba(206,17,38,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,W,h)}
    const ln=bg==='paper'?'rgba(60,70,90,.16)':'rgba(220,226,232,.08)';g.strokeStyle=ln;g.lineWidth=2;
    if(bg==='lined'||bg==='paper')for(let y=130;y<h;y+=70){g.beginPath();g.moveTo(40,y);g.lineTo(W-40,y);g.stroke()}
    if(bg==='staff'){g.strokeStyle='rgba(220,226,232,.14)';for(let y=150;y<h-80;y+=210)for(let k=0;k<5;k++){g.beginPath();g.moveTo(40,y+k*18);g.lineTo(W-40,y+k*18);g.stroke()}}
    if(bg==='grid'){for(let x=50;x<W;x+=50){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}for(let y=50;y<h;y+=50){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}}
  }
  function drawStroke(g,k,bg,dx,dy){
    const p=k.p;if(!p.length)return;dx=dx||0;dy=dy||0;const col=inkCol(k.c,bg);g.save();
    if(k.m){g.globalAlpha=bg==='paper'?.35:.32;g.strokeStyle=col;g.lineCap='butt';g.lineJoin='round';g.lineWidth=k.w*4.2;g.beginPath();g.moveTo(p[0][0]+dx,p[0][1]+dy);for(const q of p)g.lineTo(q[0]+dx,q[1]+dy);g.stroke();g.restore();return}
    g.strokeStyle=col;g.fillStyle=col;g.lineCap='round';g.lineJoin='round';const wd=q=>k.w*(0.35+q[2]/100*1.3);
    if(p.length===1){g.beginPath();g.arc(p[0][0]+dx,p[0][1]+dy,wd(p[0])/2,0,Math.PI*2);g.fill();g.restore();return}
    for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],m0=i>1?[(p[i-2][0]+a[0])/2,(p[i-2][1]+a[1])/2]:a,m1=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      g.lineWidth=wd(a);g.beginPath();g.moveTo(m0[0]+dx,m0[1]+dy);g.quadraticCurveTo(a[0]+dx,a[1]+dy,m1[0]+dx,m1[1]+dy);g.stroke()}
    const a=p[p.length-2],b=p[p.length-1];g.lineWidth=wd(b);g.beginPath();g.moveTo((a[0]+b[0])/2+dx,(a[1]+b[1])/2+dy);g.lineTo(b[0]+dx,b[1]+dy);g.stroke();g.restore();
  }
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  /* ---- a view of the current page (a panel, the full-screen editor, or the Chart's Notes) ---- */
  const views=new Set();
  const sel={strokes:new Set(),texts:new Set(),tags:new Set(),clear(){this.strokes.clear();this.texts.clear();this.tags.clear()},get size(){return this.strokes.size+this.texts.size+this.tags.size}};
  let clip=null;
  const st={tool:'pen',color:1,size:1,stylus:false,follow:true};
  try{Object.assign(st,JSON.parse(localStorage.getItem('panyard-notes-tools')||'{}'))}catch{}
  const keepTools=()=>{try{localStorage.setItem('panyard-notes-tools',JSON.stringify({color:st.color,size:st.size,stylus:st.stylus,follow:st.follow}))}catch{}};
  function makeView(host,mode){
    const v={host,mode,zoom:1,scale:1,live:null,lasso:null,move:null};
    host.classList.add('nb-view','nb-'+mode);
    host.innerHTML='<div class="nb-scroll"><div class="nb-pg"><canvas class="nb-cv"></canvas><div class="nb-layer"></div><div class="nb-selbox" hidden></div></div></div>'+(mode==='panel'?'<button class="nb-quick" aria-pressed="false" aria-label="Write here">✎</button>':'');
    v.sc=host.querySelector('.nb-scroll');v.pg=host.querySelector('.nb-pg');v.cv=host.querySelector('.nb-cv');v.layer=host.querySelector('.nb-layer');v.box=host.querySelector('.nb-selbox');
    v.quick=host.querySelector('.nb-quick');if(v.quick)v.quick.onclick=()=>{v.drawOn=!v.drawOn;v.quick.setAttribute('aria-pressed',String(!!v.drawOn));host.classList.toggle('nb-drawing',!!v.drawOn)};
    views.add(v);input(v);return v;
  }
  function render(v){
    if(!v.host.isConnected||!v.host.offsetParent&&v.mode!=='full')return;
    const p=curPg(),d=load(p.id),w=Math.max(80,v.sc.clientWidth*v.zoom),sc=w/W,h=p.h,dpr=Math.min(2.5,window.devicePixelRatio||1);
    v.scale=sc;v.pg.style.width=w+'px';v.pg.style.height=Math.round(h*sc)+'px';
    const cw=Math.round(w*dpr),ch=Math.round(h*sc*dpr);if(v.cv.width!==cw||v.cv.height!==ch){v.cv.width=cw;v.cv.height=ch}
    v.cv.style.width=w+'px';v.cv.style.height=Math.round(h*sc)+'px';draw(v);layer(v);
  }
  function draw(v){
    const p=curPg(),d=load(p.id),g=v.cv.getContext('2d'),dpr=v.cv.width/(W*v.scale);
    g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,v.cv.width,v.cv.height);g.setTransform(dpr*v.scale,0,0,dpr*v.scale,0,0);
    drawBg(g,d,p.h);
    g.fillStyle=d.bg==='paper'?'rgba(60,60,80,.6)':'rgba(200,206,214,.6)';g.font='600 26px '+getComputedStyle(document.body).fontFamily;g.textBaseline='alphabetic';
    g.fillText(new Date(p.created).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+'  ·  '+(S.title||'Practice notes'),40,64);
    const mv=v.move;d.strokes.forEach((k,i)=>drawStroke(g,k,d.bg,mv&&sel.strokes.has(i)?mv.dx:0,mv&&sel.strokes.has(i)?mv.dy:0));
    if(v.live)drawStroke(g,v.live,d.bg);
    if(v.lasso&&v.lasso.length>1){g.save();g.strokeStyle='#7be0c3';g.lineWidth=3;g.setLineDash([12,9]);g.beginPath();g.moveTo(v.lasso[0][0],v.lasso[0][1]);for(const q of v.lasso)g.lineTo(q[0],q[1]);g.stroke();g.restore()}
  }
  function layer(v){
    if(editing&&editing.v===v)commitText();
    const p=curPg(),d=load(p.id),sc=v.scale,mv=v.move,now=nowSec();
    v.layer.innerHTML=d.texts.map(t=>{const m=mv&&sel.texts.has(t.id);return '<div class="nb-text'+(sel.texts.has(t.id)?' sel':'')+'" data-text="'+t.id+'" style="left:'+((t.x+(m?mv.dx:0))*sc)+'px;top:'+((t.y+(m?mv.dy:0))*sc)+'px;font-size:'+(t.s*sc)+'px;color:'+inkCol(t.c,d.bg)+';max-width:'+((W-t.x-20)*sc)+'px">'+esc(t.t)+'</div>'}).join('')
      +d.tags.map(t=>{const m=mv&&sel.tags.has(t.id),on=now&&now.toLowerCase()===t.name.toLowerCase();return '<div class="nb-tag'+(on?' on':'')+(sel.tags.has(t.id)?' sel':'')+'" data-tag="'+t.id+'" style="left:'+((t.x+(m?mv.dx:0))*sc)+'px;top:'+((t.y+(m?mv.dy:0))*sc)+'px;font-size:'+Math.max(10,24*sc)+'px"><b>'+esc(t.name.toUpperCase())+'</b><button data-go="play" aria-label="Play '+esc(t.name)+'">▶</button><button data-go="loop" aria-label="Loop '+esc(t.name)+'">↻</button></div>'}).join('');
    selBox(v);
  }
  function all(){for(const v of views)render(v);for(const f of hooks)try{f()}catch{}}
  const hooks=new Set();
  /* ---- selection ---- */
  function bounds(){const d=load(curPg().id);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const add=(x,y)=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)};
    d.strokes.forEach((k,i)=>{if(sel.strokes.has(i))for(const q of k.p)add(q[0],q[1])});
    d.texts.forEach(t=>{if(sel.texts.has(t.id)){add(t.x,t.y);add(t.x+Math.min(W-t.x,t.t.length*t.s*.55),t.y+t.s*1.3)}});
    d.tags.forEach(t=>{if(sel.tags.has(t.id)){add(t.x,t.y);add(t.x+t.name.length*21+150,t.y+56)}});
    return x1<x0?null:[x0-14,y0-14,x1+14,y1+14]}
  function selBox(v){const b=sel.size&&v.mode!=='panel'?bounds():null;v.box.hidden=!b;if(!b)return;const sc=v.scale,dx=v.move?v.move.dx:0,dy=v.move?v.move.dy:0;
    Object.assign(v.box.style,{left:(b[0]+dx)*sc+'px',top:(b[1]+dy)*sc+'px',width:(b[2]-b[0])*sc+'px',height:(b[3]-b[1])*sc+'px'})}
  const inPoly=(x,y,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c};
  function pickLasso(P){const d=load(curPg().id);sel.clear();if(P.length<3)return;
    d.strokes.forEach((k,i)=>{const n=k.p.filter(q=>inPoly(q[0],q[1],P)).length;if(n&&n>=k.p.length*.5)sel.strokes.add(i)});
    d.texts.forEach(t=>{if(inPoly(t.x+10,t.y+t.s*.6,P))sel.texts.add(t.id)});d.tags.forEach(t=>{if(inPoly(t.x+20,t.y+28,P))sel.tags.add(t.id)})}
  function shiftSel(dx,dy){const d=load(curPg().id);d.strokes.forEach((k,i)=>{if(sel.strokes.has(i))k.p=k.p.map(q=>[Math.round(q[0]+dx),Math.round(q[1]+dy),q[2]])});
    d.texts.forEach(t=>{if(sel.texts.has(t.id)){t.x+=dx;t.y+=dy}});d.tags.forEach(t=>{if(sel.tags.has(t.id)){t.x+=dx;t.y+=dy}})}
  function copySel(){const d=load(curPg().id);if(!sel.size)return;clip={strokes:d.strokes.filter((k,i)=>sel.strokes.has(i)).map(k=>JSON.parse(JSON.stringify(k))),texts:d.texts.filter(t=>sel.texts.has(t.id)).map(t=>({...t})),tags:d.tags.filter(t=>sel.tags.has(t.id)).map(t=>({...t}))};say('Copied.')}
  function pasteClip(off){if(!clip)return;const id=curPg().id,d=load(id);mark(id);sel.clear();const o=off==null?40:off;
    for(const k of clip.strokes){sel.strokes.add(d.strokes.length);d.strokes.push({...k,p:k.p.map(q=>[q[0]+o,q[1]+o,q[2]])})}
    for(const t of clip.texts){const n={...t,id:uid(),x:t.x+o,y:t.y+o};d.texts.push(n);sel.texts.add(n.id)}
    for(const t of clip.tags){const n={...t,id:uid(),x:t.x+o,y:t.y+o};d.tags.push(n);sel.tags.add(n.id)}
    store(id);all()}
  function delSel(){const id=curPg().id,d=load(id);if(!sel.size)return;mark(id);d.strokes=d.strokes.filter((k,i)=>!sel.strokes.has(i));d.texts=d.texts.filter(t=>!sel.texts.has(t.id));d.tags=d.tags.filter(t=>!sel.tags.has(t.id));sel.clear();store(id);all()}
  /* ---- touch, stylus and mouse ---- */
  const segDist=(q,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((q[0]-a[0])*dx+(q[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy)};
  const hit=(k,q,R)=>k.p.length===1?Math.hypot(k.p[0][0]-q[0],k.p[0][1]-q[1])<R:k.p.some((p,i)=>i>0&&segDist(q,k.p[i-1],p)<R);
  function input(v){
    const pts=new Map();let pinch=null,raf=0;
    const at=e=>{const r=v.pg.getBoundingClientRect();return[Math.round((e.clientX-r.left)/v.scale),Math.round((e.clientY-r.top)/v.scale),Math.round((e.pointerType==='pen'?(e.pressure||.5):.5)*99)]};
    const redraw=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;draw(v);if(v.move)layer(v)})};
    const tool=()=>v.mode==='panel'?'pen':st.tool;
    const drawing=()=>v.mode!=='panel'||v.drawOn;
    // taps on a tag's ▶ / ↻, on text (Text tool edits it, Eraser removes it), and on a tag (Eraser removes it)
    v.layer.addEventListener('click',e=>{const go=e.target.closest('[data-go]');const tg=e.target.closest('[data-tag]');const tx=e.target.closest('[data-text]');const d=load(curPg().id);
      if(go&&tg&&tool()!=='eraser'){const t=d.tags.find(x=>x.id===tg.dataset.tag);if(t)jump(t.name,go.dataset.go==='loop',t.t);return}
      if(v.mode==='panel')return;
      if(st.tool==='eraser'&&(tg||tx)){const id=curPg().id;mark(id);if(tg)d.tags=d.tags.filter(x=>x.id!==tg.dataset.tag);else d.texts=d.texts.filter(x=>x.id!==tx.dataset.text);store(id);all();return}
      if(st.tool==='text'&&tx){editText(v,tx.dataset.text)}});
    v.pg.addEventListener('pointerdown',e=>{
      if(e.target.closest('[data-go]')||e.target.closest('.nb-text[contenteditable=true]'))return;
      if(!drawing())return;
      if(v.mode!=='panel'&&(st.tool==='text'||st.tool==='eraser')&&(e.target.closest('[data-text]')||e.target.closest('[data-tag]')))return;   // the tap edits or removes it
      if(e.pointerType==='touch'&&st.stylus&&v.mode!=='panel'){pts.set(e.pointerId,e);scrollStart(e);return}
      pts.set(e.pointerId,e);
      if(pts.size===2&&e.pointerType==='touch'){ // two fingers: scroll and zoom, never ink
        if(v.live){v.live=null;redraw()}v.lasso=null;
        const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),z:v.zoom,x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2,sl:v.sc.scrollLeft,stp:v.sc.scrollTop};return}
      if(pts.size>1)return;
      e.preventDefault();try{v.pg.setPointerCapture(e.pointerId)}catch{}
      const q=at(e),id=curPg().id,d=load(id),t=tool();
      if(t==='pen'||t==='marker'){v.live={c:st.color,w:SIZES[st.size],m:t==='marker'?1:0,p:[q]};redraw();return}
      if(t==='eraser'){mark(id);v.erasing=true;eraseAt(v,q);return}
      if(t==='select'){const b=sel.size?bounds():null;if(b&&q[0]>=b[0]&&q[0]<=b[2]&&q[1]>=b[1]&&q[1]<=b[3]){v.move={x0:q[0],y0:q[1],dx:0,dy:0};return}sel.clear();v.lasso=[q];all();return}
      v.tap={q,t};
    });
    v.pg.addEventListener('pointermove',e=>{
      if(!pts.has(e.pointerId))return;pts.set(e.pointerId,e);
      if(st.stylus&&e.pointerType==='touch'&&v.mode!=='panel'){scrollMove(e);return}
      if(pinch&&pts.size===2){const [a,b]=[...pts.values()],dd=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),mx=(a.clientX+b.clientX)/2,my=(a.clientY+b.clientY)/2;
        if(v.mode!=='panel'){const z=Math.max(1,Math.min(3,pinch.z*dd/pinch.d));if(Math.abs(z-v.zoom)>.02){const k=z/v.zoom;v.zoom=z;render(v);v.sc.scrollLeft=(v.sc.scrollLeft+mx-v.sc.getBoundingClientRect().left)*k-(mx-v.sc.getBoundingClientRect().left)}}
        v.sc.scrollTop=pinch.stp-(my-pinch.y);if(v.mode!=='panel')v.sc.scrollLeft=pinch.sl-(mx-pinch.x)+(v.sc.scrollLeft-pinch.sl);return}
      const q=at(e);
      if(v.live){const l=v.live.p[v.live.p.length-1];if(Math.hypot(q[0]-l[0],q[1]-l[1])>=2){v.live.p.push(q);redraw()}return}
      if(v.erasing){eraseAt(v,q);return}
      if(v.lasso){v.lasso.push(q);redraw();return}
      if(v.move){v.move.dx=q[0]-v.move.x0;v.move.dy=q[1]-v.move.y0;redraw();selBox(v)}
    });
    const up=e=>{
      if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);if(pts.size<2)pinch=null;
      if(st.stylus&&e.pointerType==='touch'&&v.mode!=='panel')return;
      const id=curPg().id,d=load(id);
      if(v.live){const k=v.live;v.live=null;if(k.p.length){mark(id);d.strokes.push(k);grow(id,k.p);store(id)}all();return}
      if(v.erasing){v.erasing=false;store(id);return}
      if(v.lasso){pickLasso(v.lasso);v.lasso=null;all();menu(v);return}
      if(v.move){const {dx,dy}=v.move;v.move=null;if(dx||dy){mark(id);shiftSel(dx,dy);store(id)}all();menu(v);return}
      if(v.tap){const {q,t}=v.tap;v.tap=null;if(t==='text')newText(v,q);else if(t==='section')pickSection(v,q)}
    };
    v.pg.addEventListener('pointerup',up);v.pg.addEventListener('pointercancel',e=>{v.live=null;v.lasso=null;v.move=null;up(e);draw(v)});
    // with Stylus only on, a finger scrolls the page
    let s0=null;const scrollStart=e=>{s0={y:e.clientY,x:e.clientX,t:v.sc.scrollTop,l:v.sc.scrollLeft}};
    const scrollMove=e=>{if(!s0)return;v.sc.scrollTop=s0.t-(e.clientY-s0.y);v.sc.scrollLeft=s0.l-(e.clientX-s0.x)};
  }
  function grow(id,pts){id=real(id);const p=S.notePages.find(x=>x.id===id);if(!p)return;const my=Math.max(...pts.map(q=>q[1]));if(my>p.h-160){p.h+=EXT;try{save()}catch{}}}
  function eraseAt(v,q){const id=curPg().id,d=load(id),n=d.strokes.length;d.strokes=d.strokes.filter(k=>!hit(k,q,22+k.w*(k.m?2:1)));if(d.strokes.length!==n){sel.clear();draw(v)}}
  /* ---- text ---- */
  function newText(v,q){const id=curPg().id,d=load(id);mark(id);const t={id:uid(),x:Math.max(20,q[0]),y:Math.max(80,q[1]-20),s:[30,40,56][st.size],c:st.color,t:''};d.texts.push(t);layer(v);editText(v,t.id,true)}
  // the text being typed is kept the moment you leave it, or the page redraws (another tool, another page…)
  let editing=null;
  function commitText(){const e=editing;if(!e)return;editing=null;const d=load(e.id),t=d.texts.find(x=>x.id===e.tid);
    if(t){t.t=e.el.innerText.replace(/\n$/,'').slice(0,2000);if(!t.t.trim())d.texts=d.texts.filter(x=>x.id!==e.tid)}store(e.id)}
  function editText(v,tid,fresh){
    commitText();const el=v.layer.querySelector('[data-text="'+tid+'"]');if(!el)return;const id=curPg().id;if(!fresh)mark(id);
    el.contentEditable='true';el.classList.add('edit');el.focus();try{const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r)}catch{}
    editing={v,tid,id,el};el.addEventListener('blur',()=>{if(editing&&editing.el===el){commitText();all()}},{once:true});
  }
  /* ---- section tags ---- */
  function pickSection(v,q){
    let pop=$('nbSecPop');if(pop)pop.remove();pop=document.createElement('div');pop.id='nbSecPop';pop.className='nb-pop';
    const names=chipNames();
    pop.innerHTML='<b>Tag a part of the song</b><div class="nb-poplist">'+names.map(n=>'<button data-sec="'+esc(n)+'">'+esc(n)+'</button>').join('')+'<button data-sec="" class="nb-new">＋ New name…</button></div>'+(names.length?'':'<p>Name the part. While the recording plays, the tag also remembers where you are in it.</p>');
    document.body.appendChild(pop);
    const close=()=>{pop.remove();document.removeEventListener('pointerdown',out,true)},out=e=>{if(!pop.contains(e.target))close()};
    setTimeout(()=>document.addEventListener('pointerdown',out,true),0);
    pop.onclick=e=>{const b=e.target.closest('[data-sec]');if(!b)return;let name=b.dataset.sec;
      if(!name){name=(prompt('Name this part (e.g. Intro, Verse 2, Bridge):')||'').trim().slice(0,40);if(!name)return}
      close();const id=curPg().id,d=load(id);mark(id);const s=secOf(name);
      d.tags.push({id:uid(),x:Math.max(20,Math.min(W-260,q[0])),y:Math.max(80,q[1]-28),name,t:s?null:(hasAudio?+audio.currentTime.toFixed(2):null)});store(id);all()};
  }
  /* ---- follow along: the notes scroll to the part that's playing ---- */
  let lastSec=null;
  function follow(){
    const n=nowSec();if(n===lastSec)return;lastSec=n;for(const f of hooks)try{f()}catch{}
    for(const v of views)if(v.host.isConnected)layer(v);
    if(!n||!st.follow)return;
    const pages=songPages();let pi=-1,tag=null;for(let i=0;i<pages.length&&!tag;i++){tag=load(pages[i].id).tags.find(t=>t.name.toLowerCase()===n.toLowerCase());if(tag)pi=i}
    if(!tag)return;if(pi!==curIdx()){book.cur[sid()]=pi;keepBook();sel.clear();all()}
    for(const v of views){if(!v.host.isConnected||v.live||!v.host.offsetParent)continue;v.sc.scrollTo({top:Math.max(0,tag.y*v.scale-10),behavior:'smooth'})}
  }
  audio.addEventListener('timeupdate',follow);audio.addEventListener('seeked',follow);
  /* ---- pages ---- */
  function goPage(i){const n=songPages().length;book.cur[sid()]=Math.max(0,Math.min(n-1,i));keepBook();sel.clear();undo=[];redo=[];for(const v of views){v.zoom=Math.min(v.zoom,3);v.sc.scrollTop=0}all()}
  function addPage(){real(curPg().id);const p={id:uid(),created:Date.now(),h:PH};S.notePages.push(p);book.own[p.id]=sid();keepBook();try{save()}catch{}data.set(p.id,{strokes:[],texts:[],tags:[],bg:load(curPg().id).bg});goPage(songPages().findIndex(x=>x.id===p.id));say('New page.')}
  function delPage(){const p=curPg(),n=songPages().length;if(String(p.id).startsWith('new:'))return;S.notePages=S.notePages.filter(x=>x.id!==p.id);delete book.own[p.id];keepBook();data.delete(p.id);
    try{localStorage.removeItem('pan-ink-'+p.id);localStorage.removeItem('pan-note-'+p.id)}catch{}try{save()}catch{}goPage(Math.min(curIdx(),n-2));say('Page deleted.')}
  function clearPage(){const id=curPg().id,d=load(id);mark(id);d.strokes=[];d.texts=[];d.tags=[];store(id);sel.clear();all();say('Page cleared. ↶ brings it back.')}
  function setBg(b){const id=curPg().id;mark(id);load(id).bg=b;store(id);all()}
  async function savePicture(){const p=curPg(),d=load(p.id),cv=document.createElement('canvas');cv.width=1000;cv.height=p.h;const g=cv.getContext('2d');drawBg(g,d,p.h);d.strokes.forEach(k=>drawStroke(g,k,d.bg));
    g.textBaseline='top';for(const t of d.texts){g.fillStyle=inkCol(t.c,d.bg);g.font='600 '+t.s+'px '+getComputedStyle(document.body).fontFamily;t.t.split('\n').forEach((l,i)=>g.fillText(l,t.x,t.y+i*t.s*1.25))}
    for(const t of d.tags){g.fillStyle='#ff3a4f';g.beginPath();g.roundRect?g.roundRect(t.x,t.y,t.name.length*21+60,52,26):g.rect(t.x,t.y,t.name.length*21+60,52);g.fill();g.fillStyle='#fff';g.font='800 26px system-ui';g.fillText(t.name.toUpperCase(),t.x+24,t.y+13)}
    const blob=await new Promise(r=>cv.toBlob(r,'image/png'));if(blob)offerFile((S.title||'Pan')+' - notes page '+(curIdx()+1)+'.png',blob)}
  /* ---- the selection menu ---- */
  function menu(v){let m=v.host.querySelector('.nb-menu');if(m)m.remove();if(v.mode==='panel'||st.tool!=='select'||(!sel.size&&!clip))return;
    m=document.createElement('div');m.className='nb-menu';
    m.innerHTML=(sel.size?'<button data-m="copy">Copy</button>':'')+(clip?'<button data-m="paste">Paste</button>':'')+(sel.size?'<button data-m="dup">Duplicate</button><button data-m="del" class="nb-danger">Delete</button>':'');
    v.host.appendChild(m);
    m.onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const k=b.dataset.m;
      if(k==='copy')copySel();else if(k==='paste')pasteClip();else if(k==='dup'){copySel();pasteClip()}else if(k==='del')delSel();menu(v)}}
  /* ---- backup files carry this song's pages ---- */
  setTimeout(()=>{const be=window.backupExtra;window.backupExtra=async()=>{const o=be?await be():{};const pages=songPages().filter(p=>{const d=load(p.id);return d.strokes.length||d.texts.length||d.tags.length});
      if(pages.length)o.notebook={pages:pages.map(p=>({id:p.id,created:p.created,h:p.h})),ink:Object.fromEntries(pages.map(p=>[p.id,localStorage.getItem('pan-ink-'+p.id)||'[]'])),note:Object.fromEntries(pages.map(p=>[p.id,localStorage.getItem('pan-note-'+p.id)||'{}']))};return o};
    const bi=window.backupIn;window.backupIn=async p=>{const m=bi?await bi(p):'';const nb=p&&p.notebook;if(!nb||!Array.isArray(nb.pages))return m;let k=0;
      for(const x of nb.pages.slice(0,100)){if(!x||typeof x.id!=='string'||S.notePages.some(y=>y.id===x.id))continue;S.notePages.push({id:x.id,created:+x.created||Date.now(),h:Math.max(PH,+x.h||PH)});book.own[x.id]=sid();
        try{if(typeof nb.ink[x.id]==='string')localStorage.setItem('pan-ink-'+x.id,nb.ink[x.id]);if(typeof nb.note[x.id]==='string')localStorage.setItem('pan-note-'+x.id,nb.note[x.id])}catch{}data.delete(x.id);k++}
      keepBook();try{save()}catch{}all();return m+(k?' '+k+' notes page'+(k===1?'':'s')+' added.':'')}},0);
  // another song has its own pages
  {const _so=songOpen;songOpen=async function(){const r=await _so.apply(this,arguments);sel.clear();undo=[];redo=[];lastSec=null;all();return r}}
  window.addEventListener('resize',()=>{clearTimeout(all.t);all.t=setTimeout(all,150)});
  return {COLS,SIZES,BGS,st,sel,views,hooks,makeView,render,all,songPages,curPg,curIdx,load,store,mark,undoDo,redoDo,get canUndo(){return undo.length>0},get canRedo(){return redo.length>0},
    jump,chipNames,nowSec,goPage,addPage,delPage,clearPage,setBg,savePicture,menu,copySel,pasteClip,delSel,keepTools,get clip(){return clip},follow};
})();
