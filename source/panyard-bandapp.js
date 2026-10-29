/* ---------- Panyard Band: the band members' version (built by make_band.py, at /pan-notes/band/) ----------
   Always Band member: a player picks their section and pan, and never sees Studio, recording, Pan sounds, the band
   sound, the pan picker or tuning. The pan sounds are the band's own (source/band-sounds/, put in the first time it
   opens), every song plays at A = 441, and a sounds file can't replace them. Songs, song recordings, Write, My notes,
   Play, the Game, looks and backup all work as in Panyard. Its saved things are kept apart from Panyard's on the same
   phone (BANDSHIM, the first script), and its Google Drive backup is its own file. */
var BANDAPP=(()=>{
  const A=441,VK='panyard-bandsounds';
  let installing=false;
  // the tuning and the pan sound are fixed for every song: whatever a song (or a shared song) says is ignored
  Object.defineProperty(S,'refA',{get:()=>A,set(){},enumerable:true,configurable:true});
  Object.defineProperty(S,'panVoice',{get:()=>'mine',set(){},enumerable:true,configurable:true});
  try{CLOUD.MAN='panyard-band-backup.json'}catch{}
  document.body.classList.add('bandapp');
  /* always a band member: no Producer card, no way back to it */
  const _open=ROLE.open.bind(ROLE);ROLE.open=function(step){return _open(step==='who'||step==='new'&&!ROLE.band()?'section':step)};
  ROLE.toProducer=function(){};
  const _band=ROLE.band.bind(ROLE);
  /* Studio, Pan sounds and the band sound are for the Producer's Panyard */
  const _sv=showView;showView=function(v){return _sv.call(this,v==='studio'?'home':v)};
  try{TW.open=function(){say('Panyard Band plays the band’s own pan sounds.')}}catch{}
  {const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();['pan','tune','sound','band'].forEach(k=>{const x=document.querySelector('#setList [data-row="'+k+'"]');if(x)x.remove()})}}
  {const _so=SHARE.open.bind(SHARE);SHARE.open=async function(p,ask){if(installing)return _so(p,ask);if(p&&p.format===SHARE.FMT){say('Panyard Band plays the band’s own pan sounds, so a sounds file can’t change them.');return true}return _so(p,ask)}}
  {const _r=HOME.render.bind(HOME);HOME.render=function(){_r();const h=document.querySelector('#view-home .hm-top h1');if(h)h.textContent='Panyard Band';
    // the guides card: no Studio here
    setTimeout(()=>{const g=document.querySelector('#hmGuide small');if(g&&/Studio/.test(g.textContent))g.textContent='Step-by-step: load a recording, play along, write your part, share'},0)}}
  /* the band's pan sounds, put in the first time (and again when the band's sounds are updated) */
  function cover(on,txt){let d=$('bandInst');if(!d&&on){d=document.createElement('div');d.id='bandInst';d.className='band-inst';d.setAttribute('role','status');document.body.appendChild(d)}if(!d)return;d.hidden=!on;if(on)d.innerHTML='<div><b>Panyard Band</b><p>'+txt+'</p></div>'}
  const asUrl=b=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(b)});
  async function install(){
    let m;try{m=await (await fetch('band-sounds/manifest.json',{cache:'no-cache'})).json()}catch{return false}
    let have='';try{have=localStorage.getItem(VK)||''}catch{}
    if(have===m.version&&Object.keys(SAMPLES.wav).length)return true;
    const ids=Object.keys(m.files||{}),sounds={};let n=0;
    cover(true,'Getting the band’s pan sounds ready… (just this once)');
    try{
      for(const id of ids){const r=await fetch('band-sounds/'+m.files[id]);if(!r.ok)throw Error('missing '+id);const b=await r.blob();
        sounds[id]=(await asUrl(new Blob([b],{type:'audio/flac'})));if(++n%5===0)cover(true,'Getting the band’s pan sounds ready… '+n+' of '+ids.length)}
      installing=true;await SHARE.open({format:SHARE.FMT,version:1,name:m.name||'Band pans',sounds,tune:m.tune,fx:m.fx,borrow:m.borrow},false);
      try{localStorage.setItem(VK,m.version)}catch{}
      say('The band\u2019s pan sounds are ready.');   // in place of "… as the sound profile …"
      return true}
    catch(e){console.warn('band sounds',e);say('The pan sounds couldn’t be fetched. Check the internet and open Panyard Band again.');return false}
    finally{installing=false;cover(false)}
  }
  /* Drum body hum and Suggested tone: on for every song (a band member has no Band sound or Studio to set them), each
     with its own switch in Settings (localStorage 'panyard-bandtone', {body, tone}). Drum body lifts each pan's barrel
     hum (BAND.BODY, from its skirt length) as the Band sound's Drum body at 6 does; Suggested tone is Studio's tone for
     that pan (STUDIO.TONE / SHELF: basses more bottom, tenors more shine). */
  const TK='panyard-bandtone';let tn={body:1,tone:1,intro:0};
  try{Object.assign(tn,JSON.parse(localStorage.getItem(TK)||'{}'))}catch{}
  const tkeep=()=>{try{localStorage.setItem(TK,JSON.stringify(tn))}catch{}};
  const BODYAMT=.6;
  {const _ch=BAND.chain.bind(BAND);BAND.chain=function(ac,T,id,v,t,light){
    const ch=_ch(ac,T,id,v,t,light),set=(FIELDS.get(id)||{}).set,nodes=[];
    if(light||!set)return ch;
    const pk=(ty,f,g,q)=>{const b=ac.createBiquadFilter();b.type=ty;b.frequency.value=f;b.gain.value=g;if(q)b.Q.value=q;nodes.push(b)};
    const b=BAND.now();
    if(tn.body&&!(b&&b.body)){const bd=BAND.BODY[set];if(bd){pk('peaking',bd,5.5*BODYAMT,2.2);pk('peaking',bd*3,2.5*BODYAMT,2.2)}}
    if(tn.tone){let TO=null,SH=null;try{TO=STUDIO.TONE[set];SH=STUDIO.SHELF[set]}catch{}
      if(TO&&SH){if(TO.bass)pk('lowshelf',SH[0],TO.bass);if(TO.treble)pk('highshelf',SH[1],TO.treble)}}
    if(!nodes.length)return ch;
    for(let i=1;i<nodes.length;i++)nodes[i-1].connect(nodes[i]);
    if(ch){ch.out.connect(nodes[0]);return {in:ch.in,out:nodes[nodes.length-1]}}
    return {in:nodes[0],out:nodes[nodes.length-1]}}}
  // a few notes on your pan, low ones and a chord, to hear the hum
  function riff(){const ids=(SETS[S.panSet]||SETS.tenor).views.flatMap(v=>v.fields.map(f=>f[0])).filter(i=>PITCH[i]).sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b]));
    if(!ids.length)return 0;const pick=[ids[0],ids[2]||ids[0],ids[4]||ids[0]];
    pick.forEach((id,i)=>setTimeout(()=>strike(id,.85),i*380));setTimeout(()=>pick.forEach(id=>strike(id,.7)),pick.length*380);return pick.length*380+1600}
  function hearBoth(){const was={body:tn.body,tone:tn.tone};tn.body=0;tn.tone=0;say('Without the hum and tone…');const d=riff();
    setTimeout(()=>{tn.body=1;tn.tone=1;say('…and with them.');setTimeout(()=>{tn.body=was.body;tn.tone=was.tone},riff())},d)}
  const ROWS=[['body','🥁','#ffcf6e','Drum body hum','The air inside the barrel hums, as on a real pan: a fuller bass, a tighter, ringing tenor. Each pan hums at its own note, from how long its skirt is.'],
    ['tone','✨','#9fe3c4','Suggested tone for my pan','The best bass and treble for your pan: basses get more bottom and less stick click, tenors more shine and less boom.']];
  function rowsHTML(cls){return ROWS.map(([k,ic,col,t,x])=>'<button class="'+cls+'" data-row="bt-'+k+'" data-bt="'+k+'" role="switch" aria-checked="'+!!tn[k]+'"><span class="sxic" style="background:'+col+'" aria-hidden="true">'+ic+'</span><span class="sxlab"><b>'+t+'</b><small>'+x+'</small></span><span class="sxtog'+(tn[k]?' on':'')+'" aria-hidden="true"><i></i></span></button>').join('')}
  function flip(k){tn[k]=tn[k]?0:1;tkeep();say(ROWS.find(r=>r[0]===k)[3]+(tn[k]?': on. Have a listen.':': off. Have a listen.'));riff()}
  {const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();try{const list=$('setList');if(!list||list.querySelector('[data-row=bt-body]'))return;
      const at=list.querySelector('[data-row=phone]')||list.querySelector('[data-row=feel]')||list.querySelector('[data-row=play]');if(!at)return;
      const w=document.createElement('div');w.innerHTML=rowsHTML('sxrow');let after=at;
      [...w.children].forEach(r=>{r.onclick=e=>{e.stopPropagation();flip(r.dataset.bt);SETUP.render()};after.parentNode.insertBefore(r,after.nextSibling);after=r});
      const h=document.createElement('button');h.className='sxrow bt-hear';h.dataset.row='bt-hear';h.innerHTML='<span class="sxic" style="background:#c9b8ff" aria-hidden="true">▶</span><span class="sxlab"><b>Hear the difference</b><small>A few notes on your pan without the hum and tone, then with them.</small></span>';
      h.onclick=e=>{e.stopPropagation();hearBoth()};after.parentNode.insertBefore(h,after.nextSibling)}catch(e){console.warn(e)}}}
  // the first time: a short introduction
  function intro(){if(tn.intro)return;const d=document.createElement('div');d.id='btIntro';d.className='band-inst bt-intro';d.setAttribute('role','dialog');d.setAttribute('aria-label','Your pan’s hum and tone');
    d.innerHTML='<div class="bt-card"><b>Your pan’s hum and tone</b><p>Two things now make your pan sound more like it does in the yard. Both are on; you can turn either off here or later in Settings.</p><div class="bt-rows">'+rowsHTML('sxrow bt-row')+'</div><button class="bt-btn" data-bt="hear">▶ Hear the difference</button><button class="bt-btn bt-go" data-bt="ok">Got it</button></div>';
    document.body.appendChild(d);
    const draw=()=>d.querySelectorAll('[data-bt=body],[data-bt=tone]').forEach(r=>{const k=r.dataset.bt;r.setAttribute('aria-checked',String(!!tn[k]));r.querySelector('.sxtog').classList.toggle('on',!!tn[k])});
    d.addEventListener('click',e=>{const x=e.target.closest('[data-bt]');if(!x)return;const k=x.dataset.bt;
      if(k==='ok'){tn.intro=1;tkeep();d.remove()}else if(k==='hear')hearBoth();else{flip(k);draw()}})}
  const ready=(async()=>{
    // let Panyard read its saved notes first, then add the band's
    await new Promise(r=>setTimeout(r,900));
    const ok=await install();
    if(!_band())ROLE.open('section');else intro();
    return ok})();
  {const c=document.createElement('style');c.textContent=`
body.bandapp [data-r=producer],body.bandapp [data-rs=p],body.bandapp .role-ov [data-to=who],body.bandapp .tabs [data-tab=studio]{display:none!important}
.band-inst{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgb(6 8 14/.86);color:#fff;text-align:center;padding:24px}
.band-inst[hidden]{display:none}
.bt-card{background:var(--raised,#1d1638);border:1px solid rgb(255 255 255/.14);border-radius:20px;padding:18px 16px;max-width:440px;width:100%;text-align:left;max-height:calc(100vh - 32px);overflow:auto}
.bt-card>b{font-size:20px}.bt-card>p{opacity:.85;margin:8px 0 10px}
.bt-row{width:100%;text-align:left}.bt-row .sxlab b{font-size:16px}
.bt-btn{display:block;width:100%;min-height:48px;margin-top:10px;border-radius:14px;border:1px solid rgb(255 255 255/.18);background:rgb(255 255 255/.07);color:inherit;font-size:16px;font-weight:600}
.bt-go{background:var(--gold);color:#1a1205;border-color:var(--gold)}.band-inst b{font-size:22px}.band-inst p{margin:10px 0 0;opacity:.85}`;document.head.appendChild(c)}
  return {A,ready,install,tone:tn,intro,hearBoth,get installing(){return installing}};
})();
