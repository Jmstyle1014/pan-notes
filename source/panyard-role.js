/* ---------- Who's playing: Producer (everything) or Band member (just your pan) ---------- */
// The first time Panyard opens it asks. A band member picks a section (Frontline or Backline), then a pan, and from
// then on sees only that pan: no Studio, no pan picker, no tuning. New songs are made for that pan. The choice stays
// until you change it (tap your pan at the top of Home). A Producer sees everything, as before.
// New song now asks for the song's name first (and, for a Producer, which pan it's for).
var ROLE={   // var: Home can ask about it before this part has run
  SECTIONS:{front:{name:'Frontline',sub:'The melody: Tenor or Double Seconds',pans:['tenor','dsec']},
            back:{name:'Backline',sub:'The harmony and bass: Double Guitar, Four Cello or Six Bass',pans:['guitar','fcello','six']}},
  get(){try{const x=JSON.parse(localStorage.getItem('panyard-role')||'null');if(x&&(x.role==='producer'||(x.role==='band'&&SETS[x.pan])))return x}catch{}return null},
  // the last band pan is kept while you're a Producer, so the switch on Home can go straight back to it
  put(x){const o=this.get(),last=x.role==='band'?x.pan:(o&&(o.pan||o.lastPan));if(last&&SETS[last])x.lastPan=last;try{localStorage.setItem('panyard-role',JSON.stringify(x))}catch{}},
  lastPan(){const r=this.get();const k=r&&(r.pan||r.lastPan);return k&&SETS[k]?k:null},
  // the quick switch on Home
  toProducer(){if(!this.band())return;this.put({role:'producer'});this.apply();say('Producer: everything is open. Studio, every pan, tuning and mixing.')},
  toBand(){const k=this.lastPan();if(!k){this.open('section');return}if(this.band())return;this.put({role:'band',pan:k});this.apply(true);say('Band member: just your '+SETS[k].name+'. Studio is hidden.')},
  band(){const r=this.get();return !!(r&&r.role==='band')},
  pan(){const r=this.get();return r&&r.role==='band'?r.pan:null},
  sectionOf(k){return Object.keys(this.SECTIONS).find(s=>this.SECTIONS[s].pans.includes(k))},
  sheet(){
    let ov=$('roleSheet');if(ov)return ov;
    ov=document.createElement('div');ov.id='roleSheet';ov.className='sheetov role-ov';ov.hidden=true;ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','roleT');
    document.body.appendChild(ov);
    ov.addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(!b){if(e.target===ov&&this.get())this.close();return}
      const v=b.dataset.v;
      switch(b.dataset.r){
        case 'producer':this.put({role:'producer'});this.close();this.apply();say('Producer: everything is open. Studio, every pan, tuning and mixing.');break;
        case 'band':this.step('section');break;
        case 'section':this.sec=v;this.step('pan');break;
        case 'pan':this.put({role:'band',pan:v});this.close();this.apply(true);say('Band member: just your '+SETS[v].name+'. Change it any time from Home.');break;
        case 'back':this.step(b.dataset.to);break;
        case 'close':this.close();break;
        case 'create':this.create();break;
        case 'npan':ov.querySelectorAll('[data-r=npan]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));this.newPan=v;break;
      }});
    ov.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='nsName'){e.preventDefault();this.create()}});
    return ov;
  },
  open(step){const ov=this.sheet();ov.hidden=false;this.step(step||'who')},
  close(){const ov=$('roleSheet');if(ov){ov.hidden=true;ov.innerHTML=''}},
  card(r,v,ic,title,sub,now){return '<button class="role-card'+(now?' role-cur':'')+'" data-r="'+r+'"'+(v?' data-v="'+v+'"':'')+(now?' aria-current="true"':'')+'>'+ic+'<span><b>'+title+(now?' <em class="role-now">✓ Now</em>':'')+'</b><small>'+sub+'</small></span><i aria-hidden="true">›</i></button>'},
  step(s){
    const ov=this.sheet(),r=this.get();let h='';
    const top=(t,p,back)=>'<div class="role-top">'+(back?'<button class="iconbtn" data-r="back" data-to="'+back+'" aria-label="Back">‹</button>':'')+'<div><h2 id="roleT">'+t+'</h2>'+(p?'<p>'+p+'</p>':'')+'</div>'+(r&&s!=='new'?'<button class="mini" data-r="close">Close</button>':'')+'</div>';
    if(s==='who')h=top('Who’s playing today?','You can change this any time from Home.')
      +this.card('producer','','<span class="role-ic" style="background:#ffd166">🎛</span>','Producer','Make music. Studio, every pan, tuning and mixing. Everything is open.',r&&r.role==='producer')
      +this.card('band','','<span class="role-ic" style="background:#8fc7ff">🥁</span>','Band member',(r&&r.role==='band'?'Your '+esc(SETS[r.pan].name)+'. Tap to change pan. ':'Just your pan. ')+'Learn your part and play along. Studio and the other pans are hidden.',r&&r.role==='band');
    else if(s==='section')h=top('Which section do you play in?','',  'who')
      +Object.entries(this.SECTIONS).map(([k,x])=>this.card('section',k,'<span class="role-ics">'+x.pans.map(p=>HOME.mini(p,30)).join('')+'</span>',x.name,x.sub)).join('');
    else if(s==='pan'){const x=this.SECTIONS[this.sec||'front'];
      h=top('Which pan is yours?',x.name,'section')+x.pans.map(p=>this.card('pan',p,HOME.mini(p,54),SETS[p].name,SETS[p].range)).join('')}
    else if(s==='new'){const bp=this.pan();this.newPan=bp||setKey();
      h='<div class="role-top"><div><h2 id="roleT">New song</h2><p>'+(bp?'For your '+esc(SETS[bp].name):'Give it a name, and choose its pan')+'</p></div><button class="mini" data-r="close">Cancel</button></div>'
        +'<label class="lab">Song name<input id="nsName" type="text" maxlength="80" autocomplete="off" placeholder="e.g. Pan in A Minor"></label>'
        +(bp?'':'<div class="lab">Pan<div class="role-pans">'+Object.keys(SETS).map(k=>'<button data-r="npan" data-v="'+k+'" aria-pressed="'+(k===this.newPan)+'">'+HOME.mini(k,30)+'<span>'+esc(SETS[k].name)+'</span></button>').join('')+'</div></div>')
        +'<button class="btn primary role-go" data-r="create">Create song</button>';
    }
    ov.innerHTML='<div class="sheet role-sh">'+h+'</div>';
    if(s==='new')setTimeout(()=>{const i=$('nsName');if(i)i.focus()},60);
  },
  async create(){
    const i=$('nsName'),name=(i&&i.value||'').trim().slice(0,80);
    if(!name){if(i){i.focus();i.classList.add('role-need')}say('Give your song a name first.');return}
    const pan=this.pan()||this.newPan||setKey();this.close();
    await this.songNew0();
    S.title=name;$('title').value=name;try{$('recName').textContent=name}catch{}
    if(S.panSet!==pan){S.panSet=pan;applyPanSet();try{renderSetPick()}catch{}}
    renderAll();save();songTouch();try{SETUP.render()}catch{}
    say('“'+name+'” is ready. Add its recording to get started.');
  },
  // what a band member doesn't need goes away; everything comes back for a Producer
  apply(fresh){
    const r=this.get(),band=!!(r&&r.role==='band');document.body.classList.toggle('band',band);
    const nav=document.querySelector('.tabs');if(nav){nav.classList.toggle('five',!band);nav.classList.toggle('four',true)}
    if(band){
      // the open song: an empty one takes your pan; one written for another pan stays as it is
      if(S.panSet!==r.pan&&!S.cues.length&&!isDemo){S.panSet=r.pan;applyPanSet();renderAll();save()}
      if(document.body.dataset.view==='studio')showView('home');
    }
    try{LOOK.tab=null;LOOK.renderPanel()}catch{}
    try{SETUP.render()}catch{}try{HOME.render()}catch{}
  },
  init(){
    this.songNew0=songNew;songNew=()=>this.open('new');
    // Home: your pan (or Producer) at the top, and only your pan's songs in the list
    const _r=HOME.render.bind(HOME);HOME.render=function(){
      const r=ROLE.get(),band=r&&r.role==='band';let keep=null;
      if(band){keep=SONGS.list;SONGS.list=SONGS.list.filter(s=>s.id===SONGS.active||!s.pan||s.pan===r.pan)}
      try{_r()}finally{if(keep)SONGS.list=keep}
      const top=document.querySelector('#view-home .hm-top>div');if(!top||!r)return;
      // a two-way switch: Producer or your pan (tap your pan again to choose another)
      const lp=ROLE.lastPan(),b=document.createElement('div');b.className='role-sw';b.id='roleChip';b.setAttribute('role','group');b.setAttribute('aria-label','Who’s playing');
      b.innerHTML='<button data-rs="p" aria-pressed="'+!band+'">🎛 Producer</button><button data-rs="b" aria-pressed="'+band+'">'+(lp?HOME.mini(lp,18)+esc(SETS[lp].name):'🥁 Band member')+'</button>';
      top.appendChild(b);b.onclick=e=>{const x=e.target.closest('[data-rs]');if(!x)return;if(x.dataset.rs==='p')ROLE.toProducer();else if(band)ROLE.open('section');else ROLE.toBand()};
      if(band){const j=$('hmJust');if(j)j.lastChild.textContent='Practise'}
      // the example song is for the Double Guitar: a band member on another pan gets their first song instead
      const card=document.querySelector('#view-home .hm-card');
      if(band&&isDemo&&r.pan!=='guitar'&&card){
        card.innerHTML='<div class="hm-cardtop">'+HOME.mini(r.pan,76)+'<div class="hm-ct"><span class="hm-eyebrow">Get started</span><h2>Your '+esc(SETS[r.pan].name)+'</h2><p>'+esc(SETS[r.pan].range)+'</p><p>Make your first song, add its recording, then tap in your part.</p></div></div>'
          +'<button class="hm-go" id="roleFirst"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New song for your '+esc(SETS[r.pan].name)+'</button>';
        $('roleFirst').onclick=()=>songNew()}};
    // Just play goes to the pans in Studio; a band member has no Studio, so it's Play instead
    document.addEventListener('click',e=>{if(!ROLE.band())return;const j=e.target.closest('#hmJust');if(j){e.stopPropagation();showView('play')}},true);
    // Setup: no pan picker or tuning for a band member, and Pan look shows only your pan
    const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();if(!ROLE.band())return;
      ['pan','tune'].forEach(k=>{const x=document.querySelector('#setList [data-row="'+k+'"]');if(x)x.remove()})};
    const _rp=LOOK.renderPanel.bind(LOOK);LOOK.renderPanel=function(){const bp=ROLE.pan();if(bp)this.tab=bp;_rp();
      const t=$('lkTabs');if(t)t.hidden=!!bp};
    // a song opened later: an empty one takes your pan
    const _open=songOpen;songOpen=async function(...a){const res=await _open.apply(this,a);const bp=ROLE.pan();if(bp&&S.panSet!==bp&&!S.cues.length&&!isDemo){S.panSet=bp;applyPanSet();renderAll();save()}return res};
    this.apply();
    if(!this.get())setTimeout(()=>{if(!this.get())this.open('who')},400);
  }
};
ROLE.init();
/* ---------- Day or night: the whole app in daytime colours, or Panyard's night look ---------- */
// Only the colours change (photos and pictures keep theirs), so nothing moves. Kept on this phone.
var DAY={
  on(){try{return localStorage.getItem('panyard-day')==='1'}catch{return false}},
  set(v){try{localStorage.setItem('panyard-day',v?'1':'0')}catch{}this.apply();say(v?'Day mode.':'Night mode.')},
  apply(){document.documentElement.classList.toggle('day',this.on());const b=$('dayBtn');if(b){b.textContent=this.on()?'🌙':'☀️';b.setAttribute('aria-label',this.on()?'Switch to night mode':'Switch to day mode')}},
  init(){
    this.apply();
    // a sun/moon at the top of Home
    const _r=HOME.render.bind(HOME);HOME.render=function(){_r();const st=$('hmSetup');if(st&&!$('dayBtn')){const b=document.createElement('button');b.className='iconbtn';b.id='dayBtn';b.onclick=()=>DAY.set(!DAY.on());st.before(b);DAY.apply()}};
    // and a switch in Setup, under Playing
    const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();const list=$('setList');if(!list||list.querySelector('[data-row=day]'))return;
      const fs=list.querySelector('[data-row=fs],[data-row=wake],[data-row=play]');if(!fs)return;
      const r=document.createElement('button');r.className='sxrow';r.dataset.row='day';r.setAttribute('role','switch');r.setAttribute('aria-checked',String(DAY.on()));
      r.innerHTML='<span class="sxic" style="background:#ffd166" aria-hidden="true">☀</span><span class="sxlab"><b>Day mode</b><small>Light colours for daytime</small></span><span class="sxtog'+(DAY.on()?' on':'')+'" aria-hidden="true"><i></i></span>';
      r.onclick=e=>{e.stopPropagation();DAY.set(!DAY.on());SETUP.render()};fs.parentNode.insertBefore(r,fs.nextSibling)};
    try{HOME.render();SETUP.render()}catch{}
  }
};
DAY.init();
