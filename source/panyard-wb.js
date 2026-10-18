/* ---------- Write, Studio-style: one thin bar, a ruler, and the pans or your timeline filling the rest ---------- */
// Nothing about how Write works changes: the same buttons (and everything listening to them) are moved into a slim bar,
// a ⋯ menu and side sheets. Your cues, the chart, the game and Studio's My part all read the same notes as before.
// Sideways phone and tablet: Pans ⇄ Timeline. Upright: the pans on top and the timeline under them, both at once.
const WB={
  view:'pans',on:false,
  ico:{
    back:'<path d="M15 5l-7 7 7 7"/>',
    tl:'<path d="M4 6h16M4 12h16M4 18h16"/><rect x="6" y="4" width="6" height="4" rx="1" fill="currentColor"/><rect x="10" y="10" width="7" height="4" rx="1" fill="currentColor"/><rect x="5" y="16" width="5" height="4" rx="1" fill="currentColor"/>',
    pans:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v5.5M12 15v5.5M3.5 12H9M15 12h5.5"/>',
    snap:'<path d="M6 4v7a6 6 0 0012 0V4"/><path d="M6 8h4M14 8h4"/>',
    undo:'<path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 010 10h-3"/>',
    more:'<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
    start:'<path d="M5 4v16"/><path d="M19 5l-10 7 10 7z" fill="currentColor"/>'
  },
  svg(k,s){return '<svg viewBox="0 0 24 24" width="'+(s||22)+'" height="'+(s||22)+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+this.ico[k]+'</svg>'},
  split:()=>innerWidth/innerHeight<1,
  init(){
    const v=$('view-cues');if(!v||!$('tlPanel'))return;
    const bar=document.createElement('div');bar.id='wbBar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Write');
    bar.innerHTML='<div class="gbl"><button class="gbi" id="wbBack" aria-label="Leave Write">'+this.svg('back')+'</button>'
      +'<button class="gbi" id="wbView" aria-label="Show the timeline">'+this.svg('tl')+'</button>'
      +'<button class="wbpill" id="wbMode" aria-label="How you add notes">✎ Tap along ▾</button></div>'
      +'<div class="gbc"><button class="btn" id="wbStart" aria-label="Back to the start">'+this.svg('start',20)+'</button><button class="btn" id="wbPlay" aria-label="Play">▶</button><button class="btn" id="wbRec" aria-label="Tap along: play and tap the pans"><span class="gbdot" aria-hidden="true"></span></button></div>'
      +'<div class="gbr"><button class="wblcd" id="wbLcd" aria-label="Tempo and timing"><b id="wbPos">0:00</b><small id="wbBpm">no tempo</small></button>'
      +'<button class="gbi" id="wbSnap" aria-label="Snap" aria-expanded="false">'+this.svg('snap')+'</button>'
      +'<button class="gbi" id="wbUndo" aria-label="Undo">'+this.svg('undo')+'</button>'
      +'<button class="gbi" id="wbMore" aria-label="More" aria-expanded="false">'+this.svg('more')+'</button></div>';
    document.body.appendChild(bar);
    // upright: the next notes, big, in the room under the pans
    const nx=document.createElement('div');nx.id='wbNext';nx.setAttribute('aria-live','off');nx.innerHTML='<span class="wbn-h">Coming up</span><div class="wbn-l"></div>';document.body.appendChild(nx);
    nx.addEventListener('click',e=>{const c=e.target.closest('[data-t]');if(c){try{audio.currentTime=+c.dataset.t;viewT=+c.dataset.t;tick();drawTL()}catch{}}});
    {const loopN=()=>{if(this.on&&document.body.classList.contains('wb-split'))this.next();requestAnimationFrame(loopN)};requestAnimationFrame(loopN)}
    const ru=document.createElement('div');ru.id='wbRuler';ru.innerHTML='<canvas aria-label="Your song: tap to move the playhead, tap a section to loop it"></canvas>';document.body.appendChild(ru);
    // the timeline's home: full screen (sideways) or the lower half (upright)
    const tl=document.createElement('div');tl.id='wbTL';document.body.appendChild(tl);
    const zm=document.createElement('div');zm.id='wbZoom';tl.appendChild(zm);['rateBtn','zoomOut','zoomLabel','zoomIn'].forEach(id=>{const e=$(id);if(e)zm.appendChild(e)});
    // snap: a small pop-up with the same buttons
    const sp=document.createElement('div');sp.id='wbSnapPop';sp.className='wbpop';sp.hidden=true;sp.innerHTML='<b>Snap new and moved notes to</b>';sp.appendChild($('snapSeg'));document.body.appendChild(sp);
    // the ⋯ menu
    const menu=document.createElement('div');menu.id='wbMenu';menu.className='wbpop';menu.hidden=true;
    const item=(id,label,fn)=>{const b=document.createElement('button');b.className='btn';b.id=id;b.innerHTML=label;b.onclick=()=>{this.pop(null);fn()};menu.appendChild(b);return b};
    item('wbmTap','✎ Tap along <small>tap the pans as it plays</small>',()=>this.setEntry('tap'));
    item('wbmBuild','✚ Build a cue <small>pick notes, set the time</small>',()=>this.setEntry('build'));
    item('wbmTempo','♩ Tempo &amp; timing',()=>this.sheet('timing'));
    item('wbmRate','⏩ Playback speed <small id="wbRate">1×</small>',()=>{$('rateBtn').click();this.sync()});
    item('wbmSel','☑ Select notes',()=>{if(this.view==='pans'&&!this.split())this.setView('tl');$('selMode').click();this.sync()});
    item('wbmBars','▦ Edit in bars',()=>$('barsBtn').click());
    item('wbmShare','⤴ Share with your band <small>chart, picture, audio</small>',()=>$('shareBtnTop').click());
    item('wbmSave','⤓ Save the timeline',()=>$('shareTL').click());
    item('wbmSong','♪ Your songs',()=>{const b=document.querySelector('[data-open-songs]');if(b)b.click()});
    item('wbmStudio','◫ Go to Studio',()=>showView('studio'));
    item('wbmHelp','? Help',()=>$('helpBtn').click());
    document.body.appendChild(menu);
    // side sheet: Tempo & timing, and Build a cue
    const sh=document.createElement('div');sh.id='wbSheet';sh.hidden=true;sh.innerHTML='<div class="wbshead"><b id="wbSheetT"></b><button class="btn" id="wbSheetX">Done</button></div><div id="wbSheetB"></div>';document.body.appendChild(sh);
    $('wbSheetX').onclick=()=>this.sheet(null);
    // wiring: the new buttons press the old ones
    $('wbBack').onclick=()=>showView('home');
    $('wbView').onclick=()=>this.setView(this.view==='pans'?'tl':'pans');
    $('wbMode').onclick=e=>{e.stopPropagation();this.setEntry(entry==='tap'?'build':'tap')};
    $('wbStart').onclick=()=>{try{audio.currentTime=loop&&A!==null?A:0;tick()}catch{}};
    $('wbPlay').onclick=()=>$('playBtn').click();
    $('wbRec').onclick=()=>{this.setEntry('tap');if(audio.paused)$('playBtn').click();else $('playBtn').click()};
    $('wbLcd').onclick=()=>this.sheet('timing');
    $('wbSnap').onclick=e=>{e.stopPropagation();this.pop($('wbSnapPop').hidden?'wbSnapPop':null)};
    $('wbUndo').onclick=()=>$('undoBtn').click();
    $('wbMore').onclick=e=>{e.stopPropagation();this.pop($('wbMenu').hidden?'wbMenu':null)};
    sp.addEventListener('click',e=>{if(e.target.closest('button'))setTimeout(()=>{this.pop(null);this.sync()},120)});
    document.addEventListener('click',e=>{if(!e.target.closest('.wbpop,#wbMore,#wbSnap'))this.pop(null)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){this.pop(null);if(!$('wbSheet').hidden&&$('wbSheet').dataset.k==='timing')this.sheet(null)}});
    const cv=ru.querySelector('canvas');cv.addEventListener('pointerdown',e=>this.rulerTap(e,cv));
    // keep the timeline in its new home whenever Write moves it (it goes to the drawer on a sideways phone)
    const _pt=placeTimeline;placeTimeline=function(){_pt();if(WB.on)WB.place()};
    const _se=setEntry;setEntry=function(m){_se(m);if(WB.on)WB.place()};
    const _show=showView;showView=function(x){_show(x);WB.enter(x==='cues')};
    let mq=0;new MutationObserver(()=>{if(mq)return;mq=requestAnimationFrame(()=>{mq=0;WB.sync()})}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['aria-pressed','disabled','hidden'],childList:false});
    addEventListener('resize',()=>{if(this.on){this.place();this.fit()}});
    const loopF=()=>{if(this.on){this.drawRuler();this.clock()}requestAnimationFrame(loopF)};requestAnimationFrame(loopF);
  },
  enter(on){
    const was=this.on;this.on=on;document.body.classList.toggle('wbmode',on);this.pop(null);
    // leaving: the play bar comes back, so whatever is showing now is laid out again around it
    if(!on){if(was){const bx=$('editPans');if(bx){['transform','width','padding','margin-left','margin-right','box-sizing'].forEach(p=>bx.style.removeProperty(p))}this.sheet(null);document.body.classList.remove('wb-tl','wb-split','wb-build');placeTimeline();try{setDockH()}catch{}try{STAGE.render()}catch{}requestAnimationFrame(()=>{try{STAGE.render();STAGE.fitStudio()}catch{}})}return}
    this.place();this.sync();requestAnimationFrame(()=>this.fit());
  },
  setView(v){this.view=v;this.place();this.sync();requestAnimationFrame(()=>this.fit())},
  setEntry(m){setEntry(m);this.place();this.sync()},
  // where everything goes for this screen
  place(){
    if(!this.on)return;const split=this.split(),tlOn=split||this.view==='tl',b=document.body;
    b.classList.toggle('wb-split',split);b.classList.toggle('wb-tl',!split&&this.view==='tl');
    const tl=$('wbTL'),p=$('tlPanel');if(p.parentNode!==tl)tl.insertBefore(p,$('wbZoom'));
    try{openDrawer(false)}catch{}
    // Build a cue: its form slides in from the side; the pans stay where they are
    const build=entry==='build';b.classList.toggle('wb-build',build);
    const bx=$('buildBox');if(build){this.sheet('build')}else if($('wbSheet').dataset.k==='build')this.sheet(null);
    if(!build&&bx.parentNode!==$('cueStage'))$('cueStage').appendChild(bx);
    if(tlOn)requestAnimationFrame(()=>{try{drawTL()}catch{}});
  },
  // the pans: the room under the bar (or the top half, upright)
  fit(){
    if(!this.on)return;const box=$('editPans');if(!box)return;
    const top=92,split=this.split();if(!split&&this.view==='tl')return;
    // upright: as much height as the pans need side by side (more for four or six drums), the rest for the timeline
    const n=STAGE.drumsOf(setKey()).length,room=innerHeight-top;
    let H=split?Math.round(n>=4?Math.min(innerWidth*1.05,room*.6):n===2?Math.min(innerWidth*.56,room*.5):Math.min(innerWidth*.95,room*.55)):innerHeight-top-8;
    // upright: the timeline on top, only as tall as it needs, the pans right under it, and what's coming up below
    if(split){const tlH=Math.round(Math.max(150,Math.min(room*.32,room-H-16)));if(tlH+H+16>room)H=Math.max(160,room-tlH-16);
      document.documentElement.style.setProperty('--wbTLH',tlH+'px');
      const nh=room-tlH-H-16;document.body.classList.toggle('wb-next',nh>=64);document.body.classList.toggle('wb-next-sm',nh<112);document.documentElement.style.setProperty('--wbNextH',Math.max(0,nh)+'px');this.nextKey=null}
    else document.body.classList.remove('wb-next','wb-next-sm');
    document.documentElement.style.setProperty('--wbPansH',H+'px');
    // full width of the screen, past the page's side inset
    // (negative margins, not a shift: the page's own width must never grow past the screen, or the phone zooms on every turn)
    const SW=document.documentElement.clientWidth;box.style.transform='';box.style.setProperty('margin-left','0px','important');box.style.setProperty('margin-right','0px','important');box.style.width='';
    const L=box.getBoundingClientRect().left;box.style.boxSizing='border-box';box.style.padding='0 4px';box.style.setProperty('width',SW+'px','important');box.style.setProperty('margin-left',(-L)+'px','important');
    box.dataset.pf='';STAGE.stageify(box,SW-8,H,split);
  },
  // the next few notes after the playhead, in big type, so a glance tells you what's coming
  next(){
    const box=$('wbNext');if(!box||!document.body.classList.contains('wb-next'))return;
    const t=typeof viewT==='number'?viewT:0,cs=S.cues.filter(c=>c.steps&&c.steps.length&&c.start+c.duration>t+.02).sort((a,b)=>a.start-b.start).slice(0,8);
    const key=cs.map(c=>c.id+':'+c.steps.join('.')).join('|');if(key===this.nextKey)return;this.nextKey=key;
    const l=box.querySelector('.wbn-l');
    l.innerHTML=cs.length?cs.map((c,i)=>'<button class="wbn'+(i===0&&c.start<=t+.02?' wbn-now':'')+'" data-t="'+c.start+'"><b>'+esc(cueLabel(c))+'</b><i>'+fmt(c.start)+'</i></button>').join(''):'<span class="wbn-e">'+(S.cues.length?'That\'s the last note.':'Tap the pans to write your first note.')+'</span>';
  },
  sheet(k){
    const sh=$('wbSheet'),B=$('wbSheetB');
    if((k||'')===(sh.dataset.k||'')&&(!k||!sh.hidden))return;   // already showing
    // put back what was borrowed
    if(sh.dataset.k==='timing'){$('tlTools').appendChild($('gridBox'));$('gridBox').hidden=true;$('tempoBtn').setAttribute('aria-expanded','false')}
    if(sh.dataset.k==='build'&&k!=='build'){$('cueStage').appendChild($('buildBox'))}
    sh.dataset.k=k||'';sh.hidden=!k;document.body.classList.toggle('wb-sheet',!!k);
    if(k==='timing'){$('wbSheetT').textContent='Tempo & timing';B.appendChild($('gridBox'));$('gridBox').hidden=false;$('tempoBtn').setAttribute('aria-expanded','true')}
    if(k==='build'){$('wbSheetT').textContent='Build a cue';B.appendChild($('buildBox'));$('buildBox').hidden=false}
    if(!k&&entry==='build')setEntry('tap');
  },
  pop(id){['wbMenu','wbSnapPop'].forEach(x=>{const e=$(x);if(e)e.hidden=x!==id});$('wbMore').setAttribute('aria-expanded',String(id==='wbMenu'));$('wbSnap').setAttribute('aria-expanded',String(id==='wbSnapPop'))},
  sync(){
    if(!$('wbBar'))return;
    const split=this.split(),vb=$('wbView');vb.hidden=split;
    const k=this.view==='tl'?'pans':'tl';if(vb.dataset.k!==k){vb.dataset.k=k;vb.innerHTML=this.svg(k);vb.setAttribute('aria-label',k==='tl'?'Show the timeline':'Show the pans')}
    const m=entry==='build'?'✚ Build a cue ▾':'✎ Tap along ▾';if($('wbMode').textContent!==m)$('wbMode').textContent=m;
    const pb=$('playBtn'),wp=$('wbPlay');const pl=pb.textContent.trim()||'▶';if(wp.textContent!==pl)wp.textContent=pl;wp.disabled=pb.disabled;$('wbRec').disabled=pb.disabled;
    $('wbRec').classList.toggle('live',!audio.paused&&entry==='tap');
    $('wbUndo').disabled=$('undoBtn').disabled;
    const sn=$('snapSeg').querySelector('[aria-pressed="true"]');$('wbSnap').classList.toggle('on',!!sn&&sn.dataset.snap!=='off');
    const r=$('wbRate');if(r)r.textContent=$('rateBtn').textContent;
    const sel=$('selMode').getAttribute('aria-pressed')==='true',ms=$('wbmSel');if(ms)ms.innerHTML=sel?'☑ Stop selecting':'☑ Select notes';
    $('wbBpm').textContent=S.grid?(+S.grid.bpm.toFixed(1))+' bpm':'no tempo';
  },
  clock(){
    const t=viewT||0,el=$('wbPos');let s;
    if(S.grid){const sp=60/S.grid.bpm,b=(t-(+S.grid.offset||0))/sp,n=S.grid.perBar||4;s=b<0?'1.1':(Math.floor(b/n)+1)+'.'+(Math.floor(b%n)+1)}
    else s=Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
    if(el.textContent!==s)el.textContent=s;
    const live=!audio.paused&&entry==='tap',rb=$('wbRec');if(rb.classList.contains('live')!==live)rb.classList.toggle('live',live);
  },
  len(){let L=0;try{L=totalLen()}catch{}const ss=sectionsNow();if(ss.length)L=Math.max(L,ss[ss.length-1].end);return Math.max(L,1)},
  drawRuler(){
    const cv=document.querySelector('#wbRuler canvas');if(!cv||!cv.offsetParent)return;
    const W=cv.clientWidth,H=cv.clientHeight,d=devicePixelRatio||1;if(!W)return;
    if(cv.width!==Math.round(W*d)||cv.height!==Math.round(H*d)){cv.width=Math.round(W*d);cv.height=Math.round(H*d)}
    const g=cv.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,W,H);
    const L=this.len(),px=W/L,FF=getComputedStyle(document.body).fontFamily;
    sectionsNow().forEach((s,i)=>{const x0=s.t*px,x1=s.end*px,on=loop&&A!==null&&Math.abs(A-s.t)<.05&&Math.abs(B-s.end)<.05;
      g.fillStyle=on?'rgba(255,209,102,.28)':(i%2?'rgba(143,199,255,.12)':'rgba(201,162,255,.12)');g.fillRect(x0+1,0,Math.max(0,x1-x0-2),16);
      g.fillStyle=on?'#ffd166':'#c3bbe8';g.font='700 10px '+FF;g.textBaseline='middle';g.save();g.beginPath();g.rect(x0,0,x1-x0,16);g.clip();g.fillText((on?'⟲ ':'')+s.name.toUpperCase(),x0+5,8.5);g.restore()});
    if(loop&&A!==null&&B!==null){g.fillStyle='rgba(255,209,102,.16)';g.fillRect(A*px,16,(B-A)*px,H-16)}
    g.strokeStyle='#30275a';g.fillStyle='#9d93c9';g.font='600 10px '+FF;g.textBaseline='alphabetic';
    if(S.grid){const bar=60/S.grid.bpm*(S.grid.perBar||4),o=((+S.grid.offset||0)%bar+bar)%bar,n=Math.ceil((L-o)/bar),step=Math.max(1,Math.ceil(26/(bar*px)));
      for(let b=0;b<n;b++){const x=Math.round((o+b*bar)*px)+.5;g.beginPath();g.moveTo(x,b%step?H-6:17);g.lineTo(x,H);g.stroke();if(b%step===0)g.fillText(String(b+1),x+3,H-5)}}
    else{const st=[1,2,5,10,15,30,60].find(s=>s*px>=40)||60;for(let s=0;s<=L;s+=st){const x=Math.round(s*px)+.5;g.beginPath();g.moveTo(x,17);g.lineTo(x,H);g.stroke();g.fillText(Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'),x+3,H-5)}}
    const x=(viewT||0)*px;g.fillStyle='#ffd166';g.fillRect(x-1,16,2,H-16);g.beginPath();g.moveTo(x-5,16);g.lineTo(x+5,16);g.lineTo(x,22);g.fill();
  },
  rulerTap(e,cv){
    const r=cv.getBoundingClientRect(),L=this.len(),t=Math.max(0,Math.min(L,(e.clientX-r.left)/r.width*L));
    if(e.clientY-r.top<16){const sec=sectionsNow().find(s=>t>=s.t&&t<s.end);if(sec){loopSection(sec);return}}
    try{audio.currentTime=t;viewT=t;tick();drawTL()}catch{}
  }
};
WB.init();
