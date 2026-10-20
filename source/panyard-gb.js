/* ---------- Studio, GarageBand-style: one thin toolbar, the instrument fills the rest ---------- */
// Everything Studio already had is still here; this only moves it. The same buttons (with everything listening to them)
// are moved into one slim bar across the top, the tab bar tucks away, a thin ruler shows the bars and your sections,
// the track name floats over the pans, and the rest lives behind ⋯.
const GB={
  open:false,
  ico:{
    back:'<path d="M15 5l-7 7 7 7"/>',
    tracks:'<path d="M4 6h16M4 12h16M4 18h16"/><rect x="6" y="4" width="6" height="4" rx="1" fill="currentColor"/><rect x="10" y="10" width="7" height="4" rx="1" fill="currentColor"/><rect x="5" y="16" width="5" height="4" rx="1" fill="currentColor"/>',
    pans:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v5.5M12 15v5.5M3.5 12H9M15 12h5.5"/>',
    song:'<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/>',
    arr:'<rect x="3" y="5" width="5" height="4" rx="1" fill="currentColor"/><rect x="9.5" y="5" width="5" height="4" rx="1"/><rect x="16" y="5" width="5" height="4" rx="1" fill="currentColor"/><rect x="3" y="10.5" width="5" height="4" rx="1"/><rect x="9.5" y="10.5" width="5" height="4" rx="1" fill="currentColor"/><rect x="16" y="10.5" width="5" height="4" rx="1" fill="currentColor"/><rect x="3" y="16" width="18" height="3" rx="1" fill="currentColor" opacity=".5"/>',
    mixer:'<path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1" fill="currentColor"/><rect x="10" y="7" width="4" height="3" rx="1" fill="currentColor"/><rect x="16" y="11" width="4" height="3" rx="1" fill="currentColor"/>',
    metro:'<path d="M9 3h6l3.5 17h-13z"/><path d="M12 16l5-9"/><circle cx="17.2" cy="6.6" r="1.3" fill="currentColor"/>',
    loop:'<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 014-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 01-4 4H4"/>',
    tset:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    write:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    more:'<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
    home:'<path d="M5 4v16"/><path d="M19 5l-10 7 10 7z" fill="currentColor"/>'
  },
  svg(k){return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+this.ico[k]+'</svg>'},
  init(){
    const v=$('view-studio');if(!v||!$('stPlay'))return;
    const bar=document.createElement('div');bar.id='gbBar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Studio');
    bar.innerHTML='<div class="gbl"><button class="gbi" id="gbBack" aria-label="Leave Studio">'+this.svg('back')+'</button>'
      // which view you're on is always shown: the pans or the track lanes, one of the two lit
      +'<div class="gbseg" id="gbView" role="group" aria-label="View"><button class="gbi gbt" data-v="inst" aria-pressed="true" aria-label="Pans">'+this.svg('pans')+'<span>Pans</span></button>'
      +'<button class="gbi gbt" data-v="tracks" aria-pressed="false" aria-label="Tracks">'+this.svg('tracks')+'<span>Tracks</span></button>'
      +'<button class="gbi gbt" data-v="song" aria-pressed="false" aria-label="Song: only what\'s in the sections">'+this.svg('song')+'<span>Song</span></button></div>'
      +'<button class="gbi gbt" id="gbMix" aria-label="Mixer: levels, tone and echo for every track">'+this.svg('mixer')+'<span>Mixer</span></button>'
+'</div>'
      +'<div class="gbc"></div>'
      +'<div class="gbr"><button class="gbi gbw" id="gbWrite" aria-label="Write">'+this.svg('write')+'<span>Write</span></button><span class="gblcd"></span><button class="gbi" id="gbMetro" aria-label="Click (metronome)">'+this.svg('metro')+'</button>'
      +'<button class="gbi" id="gbLoop" aria-label="Loop">'+this.svg('loop')+'</button>'
      +'<button class="gbi" id="gbMore" aria-label="More: count-in, undo, export, timing" aria-expanded="false">'+this.svg('more')+'</button></div>';
    v.prepend(bar);
    // the real transport buttons move into the middle; the bar counter moves to the right
    const c=bar.querySelector('.gbc');['stHome','stPlay','stRec'].forEach(id=>c.appendChild($(id)));
    $('stHome').innerHTML=this.svg('home');$('stRec').innerHTML='<span class="gbdot" aria-hidden="true"></span>';$('stRec').setAttribute('aria-label','Record');
    const lcd=bar.querySelector('.gblcd');lcd.appendChild(document.querySelector('.st-lcd'));
    // the bar counter is also the tempo: tap it for Tempo & metronome
    lcd.setAttribute('role','button');lcd.tabIndex=0;lcd.setAttribute('aria-label','Tempo and metronome');lcd.title='Tempo & metronome';
    lcd.onclick=()=>STUDIO.tempoSheet();lcd.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();STUDIO.tempoSheet()}};
    // the menu behind ⋯: everything else from the old tools row
    const menu=document.createElement('div');menu.id='gbMenu';menu.hidden=true;menu.setAttribute('role','menu');
    menu.innerHTML='<div class="gbmrow" id="gbMUndo"></div><div class="gbmlist"></div>';
    v.appendChild(menu);
    menu.querySelector('#gbMUndo').append($('stUndo'),$('stRedo'));
    const list=menu.querySelector('.gbmlist');['stCount','stExp','stTime'].forEach(id=>list.appendChild($(id)));
    const wm=document.createElement('button');wm.className='btn gbwritem';wm.textContent='✎ Write your part';wm.onclick=()=>{this.menu(false);showView('cues')};list.prepend(wm);
    const lp=document.createElement('button');lp.className='btn gbloopm';lp.textContent='⟲ Loop on / off';lp.onclick=()=>{this.menu(false);$('stLoop').click();this.sync()};list.prepend(lp);
    const tun=document.createElement('button');tun.className='btn';tun.textContent='♮ Tuning (match a recording)';tun.onclick=()=>{this.menu(false);showView('setup');try{SETUP.show('tune')}catch{}};list.prepend(tun);
    {const ab=document.createElement('button');ab.className='btn gbarrm';ab.textContent='▦ Arrangement';ab.onclick=()=>{this.menu(false);STUDIO.arrangement()};list.prepend(ab)}
    {const tb=document.createElement('button');tb.className='btn';tb.id='gbTemplate';tb.textContent='🎼 New song from a template';tb.onclick=()=>{this.menu(false);STUDIO.templates()};list.prepend(tb)}
    if(typeof TW!=='undefined'&&TW.allowed){const tw=document.createElement('button');tw.className='btn';tw.id='gbWorkshop';tw.textContent='🔧 Tuning workshop (pan sounds)';tw.onclick=()=>{this.menu(false);TW.open(true)};list.prepend(tw)}
    const tmp=document.createElement('button');tmp.className='btn';tmp.id='gbTempo';tmp.textContent='♩ Tempo & metronome';tmp.onclick=()=>{this.menu(false);STUDIO.tempoSheet()};list.prepend(tmp);
    const mx=document.createElement('button');mx.className='btn gbmix';mx.textContent='🎚 Mixer & sound';mx.onclick=()=>{this.menu(false);$('stMix').click()};list.prepend(mx);
    const toWrite=document.createElement('button');toWrite.className='btn';toWrite.textContent='✎ Go to Write';toWrite.onclick=()=>{this.menu(false);showView('cues')};list.appendChild(toWrite);
    $('stExp').textContent='⤓ Export / share';$('stTime').textContent='⏱ Timing fix';
    // the floating track pill (Pans view) and the ruler
    const pill=document.createElement('button');pill.id='gbPill';pill.setAttribute('aria-haspopup','true');pill.setAttribute('aria-expanded','false');
    // Options sits beside the track name: the pan picker, Add on top / Replace, snapping, the track's name and Delete
    const opts=document.createElement('button');opts.id='gbOpts';opts.textContent='⚙ Options';opts.hidden=true;opts.setAttribute('aria-haspopup','dialog');opts.setAttribute('aria-expanded','false');
    const pills=document.createElement('div');pills.id='gbPills';pills.append(pill,opts);v.appendChild(pills);
    // on a sideways phone or a tablet the track name sits in the top bar, off the pans; upright it floats above them
    const place=()=>{const inBar=innerWidth>560;document.body.classList.toggle('gb-inbar',inBar);
      const home=inBar?bar.querySelector('.gbl'):v;if(pills.parentNode!==home)home.appendChild(pills);
      const r=pill.getBoundingClientRect();document.documentElement.style.setProperty('--gbPillL',Math.max(10,Math.round(r.left))+'px')};
    this.place=place;place();addEventListener('resize',place);
    // the track list under the name also holds the pan & recording options and the track's settings
    document.addEventListener('click',e=>{const it=e.target.closest('#gbOptItem,#gbSetItem');if(!it)return;e.stopPropagation();this.pick(false);
      if(it.id==='gbOptItem')this.opts(true);else STUDIO.trackSheet()},true);
    const ru=document.createElement('div');ru.id='gbRuler';ru.innerHTML='<canvas aria-label="Bars: tap to move the playhead"></canvas>';bar.after(ru);
    // wiring: the new icons press the old buttons, so Studio's own logic does the work
    $('gbBack').onclick=()=>{showView('home')};
    $('gbView').onclick=e=>{const t=e.target.closest('[data-v]');if(!t)return;const b=document.querySelector('#stViews [data-sv="'+t.dataset.v+'"]');if(b)b.click();this.sync()};
    $('gbMix').onclick=()=>$('stMix').click();
    // names for the icons: a hover tip on a computer, and press and hold on a phone shows the name
    bar.querySelectorAll('.gbl .gbi').forEach(b=>{const n=b.getAttribute('aria-label')||'';if(!b.title)b.title=n.split(':')[0]});
    {let tt=0,tip=null,held=false;
     const hide=()=>{clearTimeout(tt);if(tip){tip.remove();tip=null}};
     bar.querySelector('.gbl').addEventListener('pointerdown',e=>{const b=e.target.closest('.gbi');if(!b||e.pointerType==='mouse')return;held=false;hide();
       tt=setTimeout(()=>{held=true;const r=b.getBoundingClientRect();tip=document.createElement('div');tip.className='gbtip';tip.textContent=b.title;document.body.appendChild(tip);
         tip.style.left=Math.max(6,Math.min(innerWidth-tip.offsetWidth-6,r.left+r.width/2-tip.offsetWidth/2))+'px';tip.style.top=(r.bottom+6)+'px'},450)});
     ['pointerup','pointercancel','pointerleave'].forEach(ev=>bar.querySelector('.gbl').addEventListener(ev,()=>{clearTimeout(tt);setTimeout(hide,ev==='pointerup'?900:0)}));
     bar.querySelector('.gbl').addEventListener('click',e=>{if(held){held=false;e.preventDefault();e.stopPropagation()}},true)}
    $('gbWrite').onclick=()=>showView('cues');
    // tap the metronome to switch it on or off; hold it for its settings
    {const m=$('gbMetro');let lt=0,long=false;m.title='Tap: click on/off · Hold: tempo & metronome';
     m.addEventListener('pointerdown',()=>{long=false;clearTimeout(lt);lt=setTimeout(()=>{long=true;STUDIO.tempoSheet()},550)});
     ['pointerup','pointerleave','pointercancel'].forEach(ev=>m.addEventListener(ev,()=>clearTimeout(lt)));
     m.onclick=()=>{if(long){long=false;return}$('stMetro').click();this.sync()}}
    $('gbLoop').onclick=()=>{$('stLoop').click();this.sync()};
    $('gbMore').onclick=e=>{e.stopPropagation();this.menu($('gbMenu').hidden)};
    menu.addEventListener('click',e=>{if(e.target.closest('#stCount')){setTimeout(()=>this.sync(),30);return}if(e.target.closest('button')&&!e.target.closest('#gbMUndo'))this.menu(false)});
    document.addEventListener('click',e=>{if(!$('gbMenu').hidden&&!e.target.closest('#gbMenu,#gbMore'))this.menu(false);
      if(document.body.classList.contains('gb-picking')&&!e.target.closest('#gbPill,.st-tchips'))this.pick(false)});
    pill.onclick=e=>{e.stopPropagation();this.opts(false);this.place();this.pick(!document.body.classList.contains('gb-picking'))};
    opts.onclick=e=>{e.stopPropagation();this.pick(false);this.opts(!document.body.classList.contains('gb-opts'))};
    document.addEventListener('click',e=>{if(document.body.classList.contains('gb-opts')&&!e.target.closest('#gbOpts,#stPopts,.st-sheet')&&e.target.isConnected)this.opts(false)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('gb-opts')){this.opts(false);$('gbOpts').focus()}});
    document.addEventListener('click',e=>{if(e.target.closest('.st-tchips [data-st="ipick"],.st-tchips [data-st="addsheet"]'))setTimeout(()=>this.pick(false),0)},true);
    const cv=ru.querySelector('canvas');
    cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect(),n=this.nBars();if(!n)return;const b=Math.max(0,Math.min(n,(e.clientX-r.left)/r.width*n));
      const sec=this.secs().find(s=>e.clientY-r.top<16&&b>=s.a&&b<s.b);
      if(sec){const chip=document.querySelector('#stSecs [data-sec="'+sec.a+','+sec.b+'"]');if(chip){chip.click();return}}
      try{STUDIO.seek(Math.round(b*2)/2*STUDIO.BPB())}catch{}});
    let mq=0;new MutationObserver(()=>{if(mq)return;mq=requestAnimationFrame(()=>{mq=0;this.sync()})}).observe(v,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed','aria-selected']});
    const loop=()=>{if(document.body.dataset.view==='studio')this.drawRuler();requestAnimationFrame(loop)};requestAnimationFrame(loop);
    const _show=showView;showView=function(x){_show(x);document.body.classList.toggle('gbmode',x==='studio');GB.menu(false);GB.pick(false);GB.opts(false);try{setDockH()}catch{}if(x==='studio')requestAnimationFrame(()=>{GB.sync();STAGE.fitStudio()})};
  },
  menu(on){const m=$('gbMenu');if(!m)return;m.hidden=!on;$('gbMore').setAttribute('aria-expanded',String(!!on))},
  opts(on){document.body.classList.toggle('gb-opts',!!on);const b=$('gbOpts');if(b)b.setAttribute('aria-expanded',String(!!on))},
  pick(on){document.body.classList.toggle('gb-picking',!!on);const p=$('gbPill');if(p)p.setAttribute('aria-expanded',String(!!on))},
  nBars(){try{return STUDIO.bars()}catch{return 0}},
  secs(){return[...document.querySelectorAll('#stSecs [data-sec]')].map(c=>{const [a,b]=c.dataset.sec.split(',').map(Number);return{a,b,name:c.textContent.replace(/^⟲\s*/,''),on:c.classList.contains('on')}})},
  sync(){
    if(!$('gbBar'))return;const inst=document.body.classList.contains('st-inst');
    const cur=(document.querySelector('#stViews [aria-selected="true"]')||{dataset:{sv:inst?'inst':'tracks'}}).dataset.sv;
    {const tb=$('gbView').querySelector('[data-v="tracks"]'),lab=STUDIO.zones&&STUDIO.zones()?'Takes':'Tracks';if(tb&&tb.dataset.l!==lab){tb.dataset.l=lab;tb.querySelector('span').textContent=lab;tb.setAttribute('aria-label',lab==='Takes'?'Takes: your recordings':'Tracks')}}
    $('gbView').querySelectorAll('[data-v]').forEach(b=>{const on=b.dataset.v===cur;if(b.getAttribute('aria-pressed')!==String(on))b.setAttribute('aria-pressed',String(on))});
    const tg=(el,on)=>{if(el.classList.contains('on')!==on)el.classList.toggle('on',on)};
    // the instrument button is named for the chosen track: Pans, Drums, Beat…
    {const il=document.querySelector('#stViews [data-sv="inst"]'),gv=$('gbView').querySelector('[data-v="inst"] span');if(il&&gv){const t=il.textContent.replace(/^\S+\s/,'');if(t&&gv.textContent!==t)gv.textContent=t}}
    tg($('gbMetro'),$('stMetro').getAttribute('aria-pressed')==='true');tg($('gbLoop'),$('stLoop').getAttribute('aria-pressed')==='true');
    const on=document.querySelector('.st-tchips .chip.on'),pill=$('gbPill');
    if(pill&&on){const t=on.textContent.trim();if(pill.dataset.t!==t){pill.dataset.t=t;pill.textContent=t+' ▾'}}
    const ob=$('gbOpts'),has=!!$('stPopts');if(ob&&ob.hidden===has)ob.hidden=!has;if(!has&&document.body.classList.contains('gb-opts'))this.opts(false);
    const list=document.querySelector('#stInst>.st-tchips');
    if(list&&!list.querySelector('#gbSetItem')){const add=(id,t)=>{const b=document.createElement('button');b.className='chip gbitem';b.id=id;b.textContent=t;list.appendChild(b)};
      if(has)add('gbOptItem','⚙ Pan & recording options');add('gbSetItem','🎚 This track\'s sound: tone, echo, takes')}
  },
  drawRuler(){
    const cv=document.querySelector('#gbRuler canvas');if(!cv||!cv.offsetParent)return;
    const W=cv.clientWidth,H=cv.clientHeight,d=devicePixelRatio||1;if(!W)return;
    if(cv.width!==Math.round(W*d)||cv.height!==Math.round(H*d)){cv.width=Math.round(W*d);cv.height=Math.round(H*d)}
    const g=cv.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,W,H);
    const n=this.nBars();if(!n)return;const bw=W/n,FF=this.ff||(this.ff=getComputedStyle(document.body).fontFamily);
    // sections along the top, like GarageBand's A / B / C markers: tap one to loop it
    this.secs().forEach((s,i)=>{const x0=s.a*bw,x1=s.b*bw;g.fillStyle=s.on?'rgba(255,209,102,.28)':(i%2?'rgba(143,199,255,.12)':'rgba(201,162,255,.12)');g.fillRect(x0+1,0,Math.max(0,x1-x0-2),16);
      g.fillStyle=s.on?'#ffd166':'#c3bbe8';g.font='700 10px '+FF;g.textBaseline='middle';g.textAlign='left';g.save();g.beginPath();g.rect(x0,0,x1-x0,16);g.clip();g.fillText((s.on?'⟲ ':'')+s.name.toUpperCase(),x0+5,8.5);g.restore()});
    // loop range
    try{const lp=document.querySelector('#stLoop').getAttribute('aria-pressed')==='true',c=STUDIO.song&&STUDIO.song.cycle;if(lp&&c){g.fillStyle='rgba(255,209,102,.18)';g.fillRect(c.s*bw,16,(c.e-c.s)*bw,H-16)}}catch{}
    // bar numbers and ticks
    const step=Math.max(1,Math.ceil(26/bw));g.fillStyle='#9d93c9';g.strokeStyle='#30275a';g.lineWidth=1;g.font='600 10px '+FF;g.textAlign='left';g.textBaseline='alphabetic';
    for(let b=0;b<n;b++){const x=Math.round(b*bw)+.5;g.beginPath();g.moveTo(x,b%step?H-6:17);g.lineTo(x,H);g.stroke();if(b%step===0)g.fillText(String(b+1),x+3,H-5)}
    // playhead
    let beat=0;try{beat=STUDIO.beatNow()}catch{}const x=beat/STUDIO.BPB()*bw;
    g.fillStyle='#ffd166';g.fillRect(x-1,16,2,H-16);g.beginPath();g.moveTo(x-5,16);g.lineTo(x+5,16);g.lineTo(x,22);g.fill();
  }
};
GB.init();
