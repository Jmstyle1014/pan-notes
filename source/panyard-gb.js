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
    mixer:'<path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1" fill="currentColor"/><rect x="10" y="7" width="4" height="3" rx="1" fill="currentColor"/><rect x="16" y="11" width="4" height="3" rx="1" fill="currentColor"/>',
    metro:'<path d="M9 3h6l3.5 17h-13z"/><path d="M12 16l5-9"/><circle cx="17.2" cy="6.6" r="1.3" fill="currentColor"/>',
    loop:'<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 014-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 01-4 4H4"/>',
    more:'<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
    home:'<path d="M5 4v16"/><path d="M19 5l-10 7 10 7z" fill="currentColor"/>'
  },
  svg(k){return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+this.ico[k]+'</svg>'},
  init(){
    const v=$('view-studio');if(!v||!$('stPlay'))return;
    const bar=document.createElement('div');bar.id='gbBar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Studio');
    bar.innerHTML='<div class="gbl"><button class="gbi" id="gbBack" aria-label="Leave Studio">'+this.svg('back')+'</button>'
      +'<button class="gbi" id="gbView" aria-label="Show the pans">'+this.svg('pans')+'</button>'
      +'<button class="gbi" id="gbMix" aria-label="Mixer">'+this.svg('mixer')+'</button></div>'
      +'<div class="gbc"></div>'
      +'<div class="gbr"><span class="gblcd"></span><button class="gbi" id="gbMetro" aria-label="Click (metronome)">'+this.svg('metro')+'</button>'
      +'<button class="gbi" id="gbLoop" aria-label="Loop">'+this.svg('loop')+'</button>'
      +'<button class="gbi" id="gbMore" aria-label="More: count-in, undo, export, timing" aria-expanded="false">'+this.svg('more')+'</button></div>';
    v.prepend(bar);
    // the real transport buttons move into the middle; the bar counter moves to the right
    const c=bar.querySelector('.gbc');['stHome','stPlay','stRec'].forEach(id=>c.appendChild($(id)));
    $('stHome').innerHTML=this.svg('home');$('stRec').innerHTML='<span class="gbdot" aria-hidden="true"></span>';$('stRec').setAttribute('aria-label','Record');
    bar.querySelector('.gblcd').appendChild(document.querySelector('.st-lcd'));
    // the menu behind ⋯: everything else from the old tools row
    const menu=document.createElement('div');menu.id='gbMenu';menu.hidden=true;menu.setAttribute('role','menu');
    menu.innerHTML='<div class="gbmrow" id="gbMUndo"></div><div class="gbmlist"></div>';
    v.appendChild(menu);
    menu.querySelector('#gbMUndo').append($('stUndo'),$('stRedo'));
    const list=menu.querySelector('.gbmlist');['stCount','stExp','stTime'].forEach(id=>list.appendChild($(id)));
    const mx=document.createElement('button');mx.className='btn gbmix';mx.textContent='🎚 Mixer';mx.onclick=()=>{this.menu(false);$('stMix').click()};list.prepend(mx);
    const toWrite=document.createElement('button');toWrite.className='btn';toWrite.textContent='✎ Go to Write';toWrite.onclick=()=>{this.menu(false);showView('cues')};list.appendChild(toWrite);
    $('stExp').textContent='⤓ Export / share';$('stTime').textContent='⏱ Timing fix';
    // the floating track pill (Pans view) and the ruler
    const pill=document.createElement('button');pill.id='gbPill';pill.setAttribute('aria-haspopup','true');pill.setAttribute('aria-expanded','false');
    // Options sits beside the track name: the pan picker, Add on top / Replace, snapping, the track's name and Delete
    const opts=document.createElement('button');opts.id='gbOpts';opts.textContent='⚙ Options';opts.hidden=true;opts.setAttribute('aria-haspopup','dialog');opts.setAttribute('aria-expanded','false');
    const pills=document.createElement('div');pills.id='gbPills';pills.append(pill,opts);v.appendChild(pills);
    const ru=document.createElement('div');ru.id='gbRuler';ru.innerHTML='<canvas aria-label="Bars: tap to move the playhead"></canvas>';bar.after(ru);
    // wiring: the new icons press the old buttons, so Studio's own logic does the work
    $('gbBack').onclick=()=>{showView('home')};
    $('gbView').onclick=()=>{const inst=document.body.classList.contains('st-inst');const b=document.querySelector('#stViews [data-sv="'+(inst?'tracks':'inst')+'"]');if(b)b.click();this.sync()};
    $('gbMix').onclick=()=>$('stMix').click();
    $('gbMetro').onclick=()=>{$('stMetro').click();this.sync()};
    $('gbLoop').onclick=()=>{$('stLoop').click();this.sync()};
    $('gbMore').onclick=e=>{e.stopPropagation();this.menu($('gbMenu').hidden)};
    menu.addEventListener('click',e=>{if(e.target.closest('#stCount')){setTimeout(()=>this.sync(),30);return}if(e.target.closest('button')&&!e.target.closest('#gbMUndo'))this.menu(false)});
    document.addEventListener('click',e=>{if(!$('gbMenu').hidden&&!e.target.closest('#gbMenu,#gbMore'))this.menu(false);
      if(document.body.classList.contains('gb-picking')&&!e.target.closest('#gbPill,.st-tchips'))this.pick(false)});
    pill.onclick=e=>{e.stopPropagation();this.opts(false);this.pick(!document.body.classList.contains('gb-picking'))};
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
    const gv=$('gbView');if(gv.dataset.v!==String(inst)){gv.dataset.v=String(inst);gv.innerHTML=this.svg(inst?'tracks':'pans');gv.setAttribute('aria-label',inst?'Show the tracks':'Show the instrument')}
    const tg=(el,on)=>{if(el.classList.contains('on')!==on)el.classList.toggle('on',on)};
    tg($('gbMetro'),$('stMetro').getAttribute('aria-pressed')==='true');tg($('gbLoop'),$('stLoop').getAttribute('aria-pressed')==='true');
    const on=document.querySelector('.st-tchips .chip.on'),pill=$('gbPill');
    if(pill&&on){const t=on.textContent.trim();if(pill.dataset.t!==t){pill.dataset.t=t;pill.textContent=t+' ▾'}}
    const ob=$('gbOpts'),has=!!$('stPopts');if(ob&&ob.hidden===has)ob.hidden=!has;if(!has&&document.body.classList.contains('gb-opts'))this.opts(false);
  },
  drawRuler(){
    const cv=document.querySelector('#gbRuler canvas');if(!cv||!cv.offsetParent)return;
    const W=cv.clientWidth,H=cv.clientHeight,d=devicePixelRatio||1;if(!W)return;
    if(cv.width!==Math.round(W*d)||cv.height!==Math.round(H*d)){cv.width=Math.round(W*d);cv.height=Math.round(H*d)}
    const g=cv.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,W,H);
    const n=this.nBars();if(!n)return;const bw=W/n,FF=getComputedStyle(document.body).fontFamily;
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
