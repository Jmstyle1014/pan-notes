
/* ---------- Tune my pans (Settings, and Studio ⋯): read each recorded pan note like a tuner, then fill in the rest ---------- */
// Each recording is read the way a strobe tuner reads a real pan note: the note itself, its octave, and on the
// higher pans the twelfth (an octave and a fifth up). "Tune" keeps a pitch correction next to the recording, the same
// setting the record sheet's fine-tuning uses, so nothing is re-recorded and it can always be undone.
// "Fill the gaps" plays every note you haven't recorded (or have marked rough) from the closest clean recording on the
// same pan, retuned to the right note. Tuning one recording therefore also tunes every note made from it.
// Kept on this device and in backups.
var TW=(()=>{
  const LS='panyard-fill',FILL_MAX=7;   // semitones: further than this a pan note stops sounding like itself
  const st=(()=>{try{const x=JSON.parse(localStorage.getItem(LS)||'{}');return x&&typeof x==='object'?x:{}}catch{return {}}})();
  const store=()=>{try{localStorage.setItem(LS,JSON.stringify(st))}catch{}};
  const cfg=k=>{const c=st[k]||{};return {on:!!c.on,skip:Array.isArray(c.skip)?c.skip.filter(id=>FIELDS.has(id)):[]}};
  const setCfg=(k,c)=>{st[k]={on:!!c.on,skip:[...new Set(c.skip)]};store()};
  const setOf=id=>(FIELDS.get(id)||{}).set||'guitar';
  const mid=id=>midiOf(PITCH[id]);
  const nice=id=>PITCH[id].replace('#','♯').replace(/([A-G])b/,'$1♭');
  const stdHz=id=>440*Math.pow(2,(mid(id)-69)/12);   // the note at A = 440; the song's own A is added when it plays
  const PARTS=k=>['six','fcello'].includes(k)?[[1,'Note','the note itself'],[2,'Octave','twice as high']]
    :[[1,'Note','the note itself'],[2,'Octave','twice as high'],[3,'Twelfth','an octave and a fifth up']];

  /* which recording plays each note */
  function fillOf(id,evenOff){
    if(!PITCH[id])return null;const k=setOf(id),c=cfg(k);if(!c.on&&!evenOff)return null;
    const m=mid(id);let best=null;
    for(const s of Object.keys(SAMPLES.wav)){if(s===id||setOf(s)!==k||!PITCH[s]||c.skip.includes(s))continue;
      const d=m-mid(s),cost=Math.abs(d)+(d>0?.1:0);   // a tie goes to shifting down, which keeps more ring
      if(!best||cost<best.cost)best={src:s,st:d,cost}}
    return best&&Math.abs(best.st)<=FILL_MAX?{src:best.src,st:best.st,cents:best.st*100,fill:true}:null;
  }
  // a recording you've marked rough is left out, but only when a clean one nearby can stand in for it
  const skip=id=>!!SAMPLES.wav[id]&&cfg(setOf(id)).skip.includes(id)&&!!fillOf(id);

  /* ---- reading a recording ---- */
  function fft(re,im){
    const n=re.length;
    for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
    for(let len=2;len<=n;len<<=1){const h=len>>1,a=-2*Math.PI/len;
      for(let k=0;k<h;k++){const wr=Math.cos(a*k),wi=Math.sin(a*k);
        for(let i=k;i<n;i+=len){const j=i+h,tr=re[j]*wr-im[j]*wi,ti=re[j]*wi+im[j]*wr;re[j]=re[i]-tr;im[j]=im[i]-ti;re[i]+=tr;im[i]+=ti}}}
  }
  async function decode(blob){
    const ab=await blob.arrayBuffer(),C=window.OfflineAudioContext||window.webkitOfflineAudioContext,oc=new C(1,1,44100);
    const b=await new Promise((res,rej)=>{const p=oc.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)});
    const x=new Float32Array(b.length);for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=0;i<x.length;i++)x[i]+=d[i]/b.numberOfChannels}
    return {x,sr:b.sampleRate};
  }
  function peakNear(a,f,win){
    const lo=Math.max(2,Math.floor(f*Math.pow(2,-win/1200)/a.bin)),hi=Math.min(a.mag.length-2,Math.ceil(f*Math.pow(2,win/1200)/a.bin));
    if(hi<=lo)return {hz:f,mag:0,edge:true};
    let bi=lo;for(let i=lo;i<=hi;i++)if(a.mag[i]>a.mag[bi])bi=i;
    const l=Math.log(a.mag[bi-1]+1e-12),c=Math.log(a.mag[bi]+1e-12),r=Math.log(a.mag[bi+1]+1e-12),d=l-2*c+r,off=d?Math.max(-1,Math.min(1,.5*(l-r)/d)):0;
    return {hz:(bi+off)*a.bin,mag:a.mag[bi],edge:bi===lo||bi===hi};
  }
  function analyse(x,sr,id){
    let pk=0;for(let i=0;i<x.length;i++)pk=Math.max(pk,Math.abs(x[i]));
    let on=0;while(on<x.length&&Math.abs(x[on])<pk*.3)on++;
    const start=Math.min(x.length-1,on+Math.round(.04*sr)),N=Math.min(16384,x.length-start);
    if(N<2048||pk<.005)return {ok:false};
    const M=65536,re=new Float64Array(M),im=new Float64Array(M);
    for(let i=0;i<N;i++)re[i]=x[start+i]*(.5-.5*Math.cos(2*Math.PI*i/(N-1)));
    fft(re,im);const mag=new Float64Array(M/2);for(let i=0;i<M/2;i++)mag[i]=Math.hypot(re[i],im[i]);
    const f0=stdHz(id),bin=sr/M,a={mag,bin};let max=1e-12;
    for(let i=Math.floor(40/bin);i<Math.min(M/2,8000/bin);i++)if(mag[i]>max)max=mag[i];a.max=max;
    const parts=PARTS(setOf(id)).map(([k,name,sub])=>{const p=peakNear(a,k*f0,k===1?60:80),db=20*Math.log10(p.mag/max+1e-12);
      return {k,name,sub,cents:1200*Math.log2(p.hz/(k*f0)),db,heard:db>-42&&!p.edge}});
    // how clean it is: how much of the sound sits on the pan's own tones (not buzz, rattle or room noise)…
    let tones=0,all=0;const lo=Math.floor(f0*.8/bin),hi=Math.min(mag.length-1,Math.floor(Math.min(sr/2-50,f0*5.5)/bin));
    for(let i=lo;i<=hi;i++)all+=mag[i]*mag[i];
    for(const k of [1,2,3,4]){const p=peakNear(a,k*f0,70),c=p.hz/bin,w=Math.max(2,c*(Math.pow(2,35/1200)-1));
      for(let i=Math.max(lo,Math.floor(c-w));i<=Math.min(hi,Math.ceil(c+w));i++)tones+=mag[i]*mag[i]}
    const harm=all?Math.min(1,tones/all):0;
    // …how far the note stands above the hiss and room noise underneath it…
    const band=Array.from(mag.subarray(lo,hi+1)).sort((p,q)=>p-q),floor=band[band.length>>1]||1e-12;
    const top=Math.max(...[1,2].map(k=>peakNear(a,k*f0,70).mag)),snr=20*Math.log10(top/floor);
    // …and how long it rings before it fades away
    const F=1024;let peakR=0,peakAt=0;const rms=[];
    for(let i=on;i+F<=x.length;i+=F){let s=0;for(let j=i;j<i+F;j++)s+=x[j]*x[j];const r=Math.sqrt(s/F);rms.push(r);if(r>peakR){peakR=r;peakAt=rms.length-1}}
    let t30=rms.length;for(let i=peakAt;i<rms.length;i++)if(rms[i]<peakR*.0316){t30=i;break}
    const ring=t30*F/sr,want=1.1*Math.pow(261.6/f0,.35),ringS=Math.min(1,ring/want);
    const cl=v=>Math.max(0,Math.min(1,v)),score=Math.round(100*(.35*cl((snr-25)/35)+.45*cl((harm-.75)/.22)+.2*ringS));
    // the pitch to tune by: the note itself, or its octave when the note is too low for a phone microphone to catch
    // the pitch to tune by. Low notes (below E3) go by their octave: a phone microphone (or speaker) barely catches the
    // note itself down there, and a faint reading of it can be far out, while the octave comes through clearly.
    // Higher up the note itself is used, unless it's much quieter than its octave and the two disagree.
    const p0=parts[0],p1=parts[1],low=midiOf(PITCH[id])<52,
      useOct=p1&&p1.heard&&(low||!p0.heard||(Math.abs(p0.cents-p1.cents)>25&&p0.db<p1.db-6)),
      pc=useOct?p1.cents:p0.heard?p0.cents:null;
    return {ok:true,parts,pc,pcFrom:pc==null?null:useOct?'octave':'note',score,harm,snr,ring,a,f0,on:on/sr};
  }
  const CACHE=new WeakMap();
  async function reading(id){
    const b=SAMPLES.wav[id];if(!b)return null;if(CACHE.has(b))return CACHE.get(b);
    let r;try{const {x,sr}=await decode(b);r=analyse(x,sr,id)}catch{r={ok:false}}
    CACHE.set(b,r);return r;
  }
  const quality=s=>s>=75?['ok','Clean']:s>=55?['mid','OK']:['bad','Rough'];
  const tuneC=id=>{try{return tuneOf(id).cents||0}catch{return 0}};

  /* ---- Tune my pans: the pan in the middle, the chosen note's tools beside it ----
     Tap a note on the pan (or in the list). Its panel has a tuner with Fix it, then Pitch, Volume, Ring and Tone,
     and the sound editor. Every change is a setting next to the recording (Reset takes it back), except the sound
     editor, which keeps the untouched take so it can always go back to it. */
  let sel=null,open=false,run=0,vk=null,moreOn=false;
  const keyNow=()=>vk&&SETS[vk]?vk:setKey();
  const msg=t=>{const m=$('twMsg');if(m){m.textContent=t||'';m.classList.toggle('on',!!t);clearTimeout(msg.t);if(t)msg.t=setTimeout(()=>m.classList.remove('on'),5200)}};
  const order=()=>{const v=SETS[keyNow()].views;return [...new Set(v.flatMap(p=>p.fields.map(f=>f[0])))].filter(id=>PITCH[id]).sort((a,b)=>mid(a)-mid(b))};
  function mineOn(){if(S.panVoice!=='mine'){S.panVoice='mine';try{save()}catch{}}}
  function changed(){try{renderVoice()}catch{}try{renderBorrow()}catch{}try{warmAll()}catch{}render()}
  function warmAll(){SAMPLES.warm=true;Object.keys(SAMPLES.wav).forEach(id=>sampleBuf(id))}
  // what plays when you tap this note right now
  function sourceOf(id){
    if(SAMPLES.wav[id]&&!skip(id))return {kind:'own'};
    const f=fillOf(id);if(f)return {kind:'fill',src:f.src,st:f.st};
    if(S.panVoice==='mine'&&!SAMPLES.wav[id]){try{const b=borrowOf(id);if(b)return {kind:'borrow',src:b.src,st:b.st}}catch{}}
    if(SAMPLES.wav[id])return {kind:'own'};
    return {kind:'built'};
  }
  const Rget=id=>{const b=SAMPLES.wav[id];return b?CACHE.get(b):undefined};   // the reading of each note's current recording
  // families: each recording that plays, with every note made from it; notes nothing reaches go last
  function families(){
    const ids=order(),map=new Map(),loose=[];
    for(const id of ids){let a=null;
      if(SAMPLES.wav[id]&&!(cfg(setOf(id)).skip.includes(id)&&fillOf(id,true)))a=id;
      else{const f=fillOf(id,true);if(f)a=f.src}
      if(a){if(!map.has(a))map.set(a,[]);map.get(a).push(id)}else loose.push(id)}
    return {fams:[...map.entries()].sort((x,y)=>mid(x[0])-mid(y[0])).map(([a,notes])=>({a,notes})),loose};
  }
  const famOf=id=>{if(!id||!cfg(setOf(id)).on)return id?[id]:[];const s=sourceOf(id),a=s.kind==='own'?id:s.kind==='fill'?s.src:null;return a?(families().fams.find(f=>f.a===a)||{notes:[]}).notes:[]};
  const nowCents=id=>{const r=Rget(id);return r&&r.pc!=null?r.pc+tuneC(id):null};
  // ok = in tune, off = needs a touch, own = recorded (still listening), fill = made from a nearby recording, built = built-in sound
  function stateOf(id){const s=sourceOf(id);if(s.kind==='built')return 'built';if(s.kind!=='own')return 'fill';const c=nowCents(id);return c==null?'own':Math.abs(c)<=5?'ok':'off'}
  const STATES=[['off','Needs a touch'],['ok','In tune'],['own','Recorded'],['fill','Made from a nearby note'],['built','Built-in sound']];
  const fmt=c=>{const r=Math.round(c*10)/10;return r?(r>0?'+':'−')+Math.abs(r).toFixed(Math.abs(r)<10&&r%1?1:0)+'¢':'0¢'};
  const where=id=>{const f=FIELDS.get(id)||{};return [f.pos,f.pan].filter(Boolean).join(' · ')};

  function build(){
    if($('twSheet'))return;
    const sh=document.createElement('div');sh.id='twSheet';sh.className='sheetov tw';sh.hidden=true;sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.setAttribute('aria-labelledby','twTitle');
    sh.innerHTML='<div class="sheetbox twbox">'
      +'<div class="twtop"><button class="twback" id="twBack" aria-label="Close">‹</button><div class="twtt"><span class="eyebrow">Settings</span><h2 id="twTitle">Pan sounds</h2></div>'
        +'<div class="twtabs" role="tablist" aria-label="Pan sounds"><button role="tab" data-tab="tune" aria-selected="true">Record &amp; tune</button><button role="tab" data-tab="sound" aria-selected="false">Sound</button></div><button class="btn" id="twClose">Done</button></div>'
      +'<div class="twswitch" id="twSwitch" role="group" aria-label="Which pan"></div>'
      +'<div class="twrecbar"><div class="twrc"><b id="twRecN"></b><small id="twRecS"></small></div><div class="twvoice" id="twVoice"><span>When you tap:</span></div><button class="btn twrecgo" id="twRecGo">🎙 Record</button></div>'
      +'<div class="twmain">'
        +'<div class="twlist" id="twList" aria-label="Notes, grouped by how they sound"></div>'
        +'<div class="twpanarea" id="twPanArea"><div class="twpname"><button id="twPrev" aria-label="Previous pan">‹</button><div><b id="twPName"></b><small id="twSub"></small></div><button id="twNext" aria-label="Next pan">›</button></div>'
          +'<div class="twpanbox" id="twPanBox"></div>'
          +'<div class="twlegend">'+STATES.map(([k,t])=>'<span><i class="twdot s-'+k+'"></i>'+t+'</span>').join('')+'</div>'
          +'<p class="twhint2">Tap a note. Swipe the pan, or use ‹ ›, for another pan.</p></div>'
        +'<div class="twstrip" id="twStrip" role="listbox" aria-label="Notes, low to high"></div>'
        +'<div class="twed" id="twEd"></div>'
      +'</div>'
      +'<div class="twsound" id="twSound" hidden><div class="twsh"><h3>The sound of your pans</h3><p>The room your pans play in, saved as a sound profile. It changes every pan and every song that uses your recordings.</p></div></div>'
      +'<div class="twfoot"><button class="btn twgo" id="twAll">▶ Play the whole pan</button><button class="btn" id="twTuneAll">✨ Tune all for me</button><span class="twgrow"></span>'
        +'<div class="twmore"><button class="btn" id="twMoreBtn" aria-expanded="false">⋯ More</button><div class="twmenu" id="twMenu" hidden>'
          +'<label class="twmi"><input type="checkbox" id="twFill"><span><b>Fill the gaps</b><small id="twFillInfo">Notes you haven\'t recorded are made from your nearest recording</small></span></label>'
          +'<div class="twborrow" id="twBorrow"></div>'
          +'<button class="twmi" id="twPick"><span><b>Pick the cleanest for me</b><small>Rough recordings are made from a cleaner neighbour instead</small></span></button>'
          +'<button class="twmi" id="twRough"><span><b id="twRoughT">Rough: fill this note instead</b><small>Leave this recording out; a nearby clean one plays it</small></span></button>'
          +'<button class="twmi" id="twResetPan"><span><b>Reset this pan</b><small>Take every tuning, volume, ring and tone change off this pan</small></span></button>'
          +'<button class="twmi" id="twHow"><span><b>How tuning works</b><small>Families, Fix it and Tune all, in plain words</small></span></button>'
        +'</div></div></div>'
      +'<p class="twmsg" id="twMsg" aria-live="polite"></p>'
      +'<div class="twhow" id="twHowBox" hidden><h3>How tuning works</h3>'
        +'<p><b>Families.</b> You only record some notes. Every other note borrows the closest of your recordings on this pan (up to 7 notes away), shifted to the right pitch. A recording and the notes made from it are a family: when you pick a recorded note, its family is outlined on the pan. Tuning, Volume, Ring and Tone on a recording change its whole family.</p>'
        +'<p><b>Fix it</b> listens to the recording and moves it to the right pitch. <b>Tune all for me</b> does that for every recording on this pan. A recording more than half a note off is left alone and named, because it probably sounds like a different note.</p>'
        +'<p><b>Pitch</b> makes it the right note. <b>Volume</b> evens it out with its neighbours. <b>Ring</b> makes it sing shorter or a little longer. <b>Tone</b> makes it darker or brighter. <b>Reset</b> takes all four off.</p>'
        +'<p>A hit pan note rings its note, its octave and (on the higher pans) the twelfth. Fix it can move the whole note but not the octave on its own, so if a note still sounds sour, record it again.</p>'
        +'<button class="btn" id="twHowClose">Close</button></div>'
      +'</div>';
    document.body.appendChild(sh);
    // the old Pan sounds page's own controls move in here (their buttons keep working as before)
    {const vs=$('voiceSeg');if(vs)$('twVoice').appendChild(vs);
     const bb=$('borrowBox');if(bb)$('twBorrow').appendChild(bb);
     const pb=$('profSel')&&$('profSel').closest('.profbox');if(pb){$('twSound').appendChild(pb);const h=pb.querySelector('h3');if(h)h.textContent='Sound profile'}
     const mb=$('profBest');if(mb)mb.hidden=true;}   // ✨ Tune all for me does this now, and keeps Ring, Tone and the longer bass notes
    sh.querySelector('.twtabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)tabTo(b.dataset.tab)});
    $('twRecGo').onclick=()=>{const ids=order(),id=ids.find(x=>!SAMPLES.wav[x])||sel||ids[0];recordNote(id)};
    sh.addEventListener('click',e=>{if(e.target===sh)show(false)});
    $('twClose').onclick=$('twBack').onclick=()=>show(false);
    $('twSwitch').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)go(b.dataset.k)});
    $('twPrev').onclick=()=>step(-1);$('twNext').onclick=()=>step(1);
    // a tap on a note picks it; a long sideways swipe across the pan moves to the next pan
    {let x0=null,y0=0;const pa=$('twPanArea');
      pa.addEventListener('pointerdown',e=>{x0=e.clientX;y0=e.clientY;const f=e.target.closest('.field');if(f&&FIELDS.has(f.dataset.field)){pick(f.dataset.field,true)}});
      pa.addEventListener('pointerup',e=>{if(x0===null)return;const dx=e.clientX-x0,dy=e.clientY-y0;x0=null;if(Math.abs(dx)>80&&Math.abs(dx)>Math.abs(dy)*1.6)step(dx<0?1:-1)})}
    const listPick=e=>{const b=e.target.closest('[data-id]');if(b)pick(b.dataset.id,true)};
    $('twList').addEventListener('click',listPick);$('twStrip').addEventListener('click',listPick);
    $('twStrip').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const ids=order(),i=ids.indexOf(sel),n=ids[Math.max(0,Math.min(ids.length-1,i+(e.key==='ArrowRight'?1:-1)))];
      if(n){pick(n,true);const b=$('twStrip').querySelector('[data-id="'+CSS.escape(n)+'"]');if(b)b.focus()}});
    $('twEd').addEventListener('click',onEd);$('twEd').addEventListener('input',onSlide);$('twEd').addEventListener('change',onSlideEnd);
    $('twAll').onclick=playAll;$('twTuneAll').onclick=tuneAll;
    $('twMoreBtn').onclick=()=>more(!moreOn);
    document.addEventListener('pointerdown',e=>{if(moreOn&&!e.target.closest('.twmore'))more(false)},true);
    $('twFill').onchange=e=>{const k=keyNow(),c=cfg(k);c.on=e.target.checked;setCfg(k,c);mineOn();changed();
      msg(c.on?'Gaps filled. Tap ▶ Play the whole pan to hear it.':'Gaps off: notes you haven\'t recorded use '+(BORROW[k]?'Advanced tuning':'the built-in sound')+'.')};
    $('twPick').onclick=()=>{more(false);pickClean()};
    $('twRough').onclick=()=>{more(false);rough()};
    $('twResetPan').onclick=()=>{more(false);resetPan()};
    $('twHow').onclick=()=>{more(false);$('twHowBox').hidden=false};$('twHowClose').onclick=()=>{$('twHowBox').hidden=true};
    document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!open||(typeof WAVE!=='undefined'&&WAVE.isOpen))return;if(!$('twHowBox').hidden){$('twHowBox').hidden=true;return}if(moreOn){more(false);return}show(false)});
    window.addEventListener('resize',()=>{if(open){clearTimeout(build.rt);build.rt=setTimeout(()=>drawPan(true),120)}});
  }
  let tab='tune';
  function tabTo(t){tab=t==='sound'?'sound':'tune';const box=$('twSheet').querySelector('.twbox');box.dataset.tab=tab;$('twSound').hidden=tab!=='sound';
    $('twSheet').querySelectorAll('.twtabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));if(tab==='tune')requestAnimationFrame(()=>drawPan(true))}
  function recordNote(id){back=true;show(false);recSel=id;openRec(true);
    if(setOf(id)!==setKey())recMsg('Recording '+nice(id)+' for the '+SETS[setOf(id)].name+'. The pans shown are this song\'s; your take is kept with the '+SETS[setOf(id)].name+'.')}
  function more(on){moreOn=!!on;$('twMenu').hidden=!moreOn;$('twMoreBtn').setAttribute('aria-expanded',String(moreOn))}
  const KEYS=()=>Object.keys(SETS);
  function go(k){if(!SETS[k]||k===keyNow())return;vk=k;sel=null;++allRun;render(true);listen()}
  function step(d){const ks=KEYS(),i=ks.indexOf(keyNow());go(ks[(i+d+ks.length)%ks.length])}
  function pick(id,play){sel=id;render();if(play){mineOn();try{warmAll();strike(id,.95)}catch{}}}

  /* the pan itself, drawn like Play's (STAGE), each note coloured by how it sounds */
  function drawPan(force){
    const box=$('twPanBox'),k=keyNow();if(!box)return;
    if(force||box.dataset.k!==k){
      let views=SETS[k].views;if(k==='guitar'&&S.swapped)views=[views[1],views[0]];
      box.dataset.k=k;box.dataset.pf='';box.innerHTML=views.map(p=>panSVG(p,false)).join('');
      const W=box.clientWidth,H=Math.max(160,Math.min(box.clientWidth*.68,innerHeight*.52));
      try{if(typeof STAGE!=='undefined'&&W>=120)STAGE.stageify(box,W,H,true)}catch{}
      box.querySelectorAll('.pan:not(.pfsvg)').forEach(p=>{if(box.querySelector('.pfsvg'))p.remove()});
    }
    const fam=new Set(famOf(sel));
    box.querySelectorAll('.field').forEach(f=>{const id=f.dataset.field;if(!FIELDS.has(id))return;
      for(const [s] of STATES)f.classList.toggle('tws-'+s,stateOf(id)===s);
      f.classList.toggle('twsel',id===sel);f.classList.toggle('twfam',fam.size>1&&fam.has(id)&&id!==sel)});
  }
  function render(force){
    if(!open)return;const k=keyNow(),c=cfg(k),ids=order();
    if(!sel||!ids.includes(sel))sel=ids.find(id=>stateOf(id)==='off')||ids.find(id=>SAMPLES.wav[id])||ids[0];
    const own=ids.filter(id=>SAMPLES.wav[id]).length;
    $('twSwitch').innerHTML=KEYS().map(x=>'<button data-k="'+x+'" aria-pressed="'+(x===k)+'">'+esc(SETS[x].name)+'</button>').join('');
    $('twPName').textContent=SETS[k].name;$('twSub').textContent=(SETS[k].range?SETS[k].range.replace('–',' – ')+' · ':'')+ids.length+' notes';
    $('twFill').checked=c.on;
    $('twRecN').textContent=own+' of '+ids.length+' recorded';$('twRecS').textContent=own===ids.length?'Every note is your real pan':own?'The rest '+(c.on?'are made from your recordings':'use the built-in sound'):'Record a few notes to start';
    $('twRecGo').textContent=own<ids.length?'🎙 Record':'🎙 Record again';
    {const bb=$('borrowBox'),hint=$('twBorrowHint')||(()=>{const p=document.createElement('p');p.id='twBorrowHint';p.className='twmi twhint3';$('twBorrow').appendChild(p);return p})();
     const mine=k===setKey();if(bb)bb.classList.toggle('twoff',!mine);try{renderBorrow()}catch{}
     hint.textContent=mine?'':'Borrowing from another pan is set for this song\'s pan ('+curSet().name+'). Open a song with the '+SETS[k].name+' to set it there.';hint.hidden=mine}
    const filled=ids.filter(id=>sourceOf(id).kind==='fill').length,built=ids.filter(id=>sourceOf(id).kind==='built').length;
    $('twFillInfo').textContent=!own?'Record a few notes on this pan first.':c.on?filled+' note'+(filled===1?'':'s')+' made from your recordings'+(built?', '+built+' too far from any (built-in sound)':'')+'.':'Off: notes you haven\'t recorded use '+(BORROW[k]?'Advanced tuning':'the built-in sound')+'.';
    const st=new Map(ids.map(id=>[id,stateOf(id)])),sub=id=>{const s=st.get(id),so=sourceOf(id),cn=nowCents(id);
      return s==='ok'||s==='off'?fmt(cn):s==='own'?'listening…':s==='fill'?(SAMPLES.wav[id]&&skip(id)?'rough · ':'')+'from '+nice(so.src):'not recorded'};
    $('twList').innerHTML=STATES.map(([s,t])=>{const xs=ids.filter(id=>st.get(id)===s);if(!xs.length)return '';
      return '<h3>'+t+' · '+xs.length+'</h3><div class="twnl">'+xs.map(id=>'<button data-id="'+id+'" aria-current="'+(id===sel)+'"><i class="twdot s-'+s+'"></i><b>'+nice(id)+'</b><span>'+sub(id)+'</span></button>').join('')+'</div>'}).join('');
    $('twStrip').innerHTML=ids.map(id=>'<button role="option" data-id="'+id+'" aria-selected="'+(id===sel)+'" tabindex="'+(id===sel?0:-1)+'"><i class="twdot s-'+st.get(id)+'"></i><b>'+nice(id)+'</b></button>').join('');
    drawPan(force);ed();
    {const a=$('twStrip').querySelector('[aria-selected=true]');if(a)a.scrollIntoView({block:'nearest',inline:'center'});const l=$('twList').querySelector('[aria-current=true]');if(l)l.scrollIntoView({block:'nearest'})}
    $('twTuneAll').disabled=!own;$('twPick').disabled=own<2;
    const has=!!SAMPLES.wav[sel],rg=has&&cfg(setOf(sel)).skip.includes(sel);$('twRough').disabled=!has;$('twRoughT').textContent=rg?'Use my recording of '+nice(sel)+' again':'Rough: fill '+(sel?nice(sel):'this note')+' instead';
  }
  /* the chosen note's panel */
  const SL=[['cents','Pitch','fine tune',-50,50,1,['lower','higher']],['db','Volume','this note only',-12,12,0.5,['softer','louder']],['ring','Ring','how long it sings',-10,10,1,['shorter','longer']],['tone','Tone','',-10,10,1,['darker','brighter']]];
  const slVal=(k,v)=>k==='cents'?fmt(+v):k==='db'?(v>0?'+':'')+(+v)+' dB':(v>0?'+':'')+(+v);
  function ed(){
    const id=sel,box=$('twEd');if(!id){box.innerHTML='';return}
    const s=sourceOf(id),r=Rget(id),has=!!SAMPLES.wav[id],T=tuneOf(id),stt=stateOf(id),cn=nowCents(id);
    let chip=stt==='ok'?'<span class="twchip ok">In tune</span>':stt==='off'?'<span class="twchip off">'+Math.abs(cn).toFixed(0)+' cents '+(cn>0?'sharp':'flat')+'</span>':stt==='fill'?'<span class="twchip">Made from '+nice(s.src)+'</span>':stt==='built'?'<span class="twchip">Built-in sound</span>':'<span class="twchip">Your recording</span>';
    let h='<div class="twehead"><div><div class="twname">'+nice(id)+'</div><div class="twpos">'+esc(where(id))+'</div></div>'+chip+'</div>';
    if(s.kind==='own'||has){
      if(!r)h+='<p class="twhint">Listening…</p>';
      else if(!r.ok)h+='<p class="twhint">This recording is too short or quiet to read. Record it again and let the note ring.</p>';
      else{const c=cn??0,q=quality(r.score);
        h+='<div class="twtuner"><div class="twtl"><span>Tuner</span><b id="twRead">'+(cn==null?'Can\'t hear a clear pitch':Math.abs(c)<=5?'In tune ✓':Math.abs(c).toFixed(0)+' cents '+(c>0?'sharp':'flat'))+'</b>'
          +'<button class="btn twfix" data-a="fix"'+(cn==null||Math.abs(c)<=0.5?' disabled':'')+'>Fix it</button></div>'
          +'<div class="twmeter" aria-hidden="true"><i class="twz"></i>'+[...Array(11)].map((_,i)=>'<span style="left:'+i*10+'%"'+(i===5?' class="c"':'')+'></span>').join('')+'<em>flat</em><em class="r">sharp</em><i class="twneedle'+(Math.abs(c)<=5?' good':'')+'" id="twNeedle" style="left:'+(50+Math.max(-50,Math.min(50,c)))+'%"></i></div>'
          +'<div class="twq '+q[0]+'"><span>Recording</span><b>'+q[1]+'</b>'+(r.pcFrom==='octave'?'<small>'+(mid(id)<52?'low notes are tuned by their octave, which a phone hears clearly':'tuned by its octave: the note itself is faint in this take')+'</small>':'')+'</div></div>';
        const o=r.parts[1];if(o&&o.heard&&r.parts[0].heard&&Math.abs(o.cents-r.parts[0].cents)>12)
          h+='<p class="twhint">Its octave is '+Math.abs(o.cents-r.parts[0].cents).toFixed(0)+' cents '+(o.cents>r.parts[0].cents?'sharp':'flat')+' of the note itself. Tuning can\'t fix that part, so it may still sound a little sour: a fresh recording usually helps.</p>'}
      if(s.kind!=='own')h+='<p class="twhint">You marked this recording rough, so '+nice(id)+' plays '+nice(s.src)+'\'s recording right now. Its settings below still belong to your own take.</p>';
      h+='<div class="twsls">'+SL.map(([k,l,sb,mn,mx,stp,ends])=>{const v=+(T[k]||0);return '<div class="twsl"><label for="twS-'+k+'">'+l+(sb?'<small>'+sb+'</small>':'')+'</label><input type="range" id="twS-'+k+'" data-k="'+k+'" min="'+mn+'" max="'+mx+'" step="'+stp+'" value="'+v+'"><output id="twO-'+k+'">'+slVal(k,v)+'</output><div class="twends"><span>'+ends[0]+'</span><span>'+ends[1]+'</span></div></div>'}).join('')+'</div>';
      h+='<div class="twbtns"><button class="btn" data-a="hear">▶ Hear it</button><button class="btn" data-a="raw">▶ As recorded</button><button class="btn twrec" data-a="rec">● Record</button><button class="btn" data-a="reset"'+(SAMPLES.tune[id]?'':' disabled')+'>↺ Reset</button></div>';
      h+=takesHTML(id);
      h+='<button class="btn twedit" data-a="edit">〰 Edit the sound<small>trim, cut noise, fade, level'+(typeof WAVE!=='undefined'&&WAVE.edited(id)?' · edited':'')+'</small></button>';
      const fs=famOf(id).length-1;
      h+='<p class="twsrc">'+(fs>0?'Its family: '+fs+' more note'+(fs===1?'':'s')+' made from it, outlined on the pan. They follow these settings.':'No other notes are made from it'+(cfg(setOf(id)).on?'.':' (Fill the gaps is off, under ⋯ More).'))+'</p>';
    } else if(s.kind==='fill'||s.kind==='borrow'){
      h+='<p class="twhint">'+nice(id)+' isn\'t recorded, so it plays '+nice(s.src)+'\'s recording, '+Math.abs(s.st)+' note'+(Math.abs(s.st)===1?'':'s')+' '+(s.st>0?'up':'down')+(s.kind==='borrow'?' (from another pan, Advanced tuning)':'')+'. To change how it sounds, adjust '+nice(s.src)+', or record this note.</p>';
      h+='<div class="twbtns"><button class="btn" data-a="hear">▶ Hear it</button><button class="btn" data-a="src" data-v="'+s.src+'">Go to '+nice(s.src)+'</button><button class="btn twrec" data-a="rec">● Record this note</button></div>';
    } else {
      h+='<p class="twhint">'+(cfg(setOf(id)).on?'No recording within 7 notes, so this plays the built-in sound. Recording this one, or one nearby, would help.':'Not recorded yet: it plays the built-in sound. Record it, or turn on Fill the gaps under ⋯ More.')+'</p>';
      h+='<div class="twbtns"><button class="btn" data-a="hear">▶ Hear it</button><button class="btn twrec" data-a="rec">● Record this note</button></div>';
    }
    box.innerHTML=h;
  }
  /* every take of this note (TAKES): play, use, delete, or let it pick the cleanest */
  const TKR=new WeakMap(),tkBusy=new Set();
  const when=at=>!at?'from before takes were kept':new Date(at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  async function tkRead(id,t){if(TKR.has(t.b))return TKR.get(t.b);let r;try{const {x,sr}=await decode(t.b);r=analyse(x,sr,id)}catch{r={ok:false}}TKR.set(t.b,r);return r}
  function takesHTML(id){
    if(typeof TAKES==='undefined')return '';const tk=TAKES.list(id),cur=TAKES.cur(id);if(!tk.length)return '';
    const need=tk.filter(t=>!TKR.has(t.b));if(need.length&&!tkBusy.has(id)){tkBusy.add(id);(async()=>{for(const t of need)await tkRead(id,t);tkBusy.delete(id);if(open&&sel===id)ed()})()}
    return '<div class="twtakes"><div class="twtkh"><b>Takes · '+tk.length+'</b><small>every recording of '+nice(id)+' is kept'+(tk.length>=TAKES_MAX?' (up to '+TAKES_MAX+')':'')+'</small>'
      +(tk.length>1?'<button class="btn" data-a="tbest">★ Pick the best</button>':'')+'</div>'
      +tk.map((t,i)=>{const r=TKR.get(t.b),on=i===cur,q=r&&r.ok?quality(r.score):null;
        return '<div class="twtk'+(on?' on':'')+'"><button class="twtkp" data-a="tplay" data-v="'+i+'" aria-label="Play take '+(i+1)+'">▶</button>'
          +'<span class="twtki"><b>Take '+(i+1)+(t.how==='edit'?' · edited':'')+'</b><small>'+when(t.at)+' · '+(!r?'listening…':!r.ok?'too quiet to read':'<em class="'+q[0]+'">'+q[1]+'</em>'+(r.pc!=null?' · '+fmt(r.pc)+' as recorded':''))+'</small></span>'
          +(on?'<span class="twtkon">In use</span>':'<button class="btn" data-a="tuse" data-v="'+i+'">Use</button>')
          +'<button class="twtkx" data-a="tdel" data-v="'+i+'" aria-label="Delete take '+(i+1)+'">🗑</button></div>'}).join('')+'</div>';
  }
  async function takeAct(a,id,i){
    const tk=TAKES.list(id),t=tk[i];
    if(a==='tplay'){if(!t)return;const ac=panCtx();if(!ac)return;try{const buf=await new Promise((res,rej)=>{t.b.arrayBuffer().then(ab=>{const p=ac.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)},rej)});const s=ac.createBufferSource(),g=ac.createGain();g.gain.value=.9;s.buffer=buf;s.connect(g);g.connect(pBus);s.start()}catch{msg('That take couldn\'t be played.')}return}
    if(a==='tuse'){if(!TAKES.pick(id,i))return;mineOn();await sampleBuf(id);changed();msg('Take '+(i+1)+' of '+nice(id)+' is in use now. Its pitch is read fresh: tap Fix it if it needs tuning.');listen();setTimeout(()=>{try{strike(id,.95)}catch{}},60);return}
    if(a==='tdel'){if(!t||!confirm('Delete take '+(i+1)+' of '+nice(id)+'? This can\'t be undone.'+(tk.length===1?' It\'s the only take, so '+nice(id)+' will be unrecorded.':'')))return;TAKES.drop(id,i);changed();msg('Take deleted.');return}
    if(a==='tbest'){msg('Listening to every take…');let best=-1,bs=-1;for(let j=0;j<tk.length;j++){const r=await tkRead(id,tk[j]);if(r&&r.ok&&r.score>bs){bs=r.score;best=j}}
      if(best<0){msg('Couldn\'t read any take clearly.');return}
      if(best===TAKES.cur(id)){msg('Take '+(best+1)+' is already the cleanest, and it\'s in use.');ed();return}
      await takeAct('tuse',id,best);msg('Take '+(best+1)+' sounds cleanest, so it\'s in use now. Tap Fix it if it needs tuning.')}
  }
  let slT=0;
  function onSlide(e){const k=e.target.dataset.k;if(!k||!sel)return;const v=+e.target.value;setT(sel,{[k]:v});$('twO-'+k).textContent=slVal(k,v);
    if(k==='cents'){const r=Rget(sel);if(r&&r.pc!=null){const c=r.pc+v,n=$('twNeedle');if(n){n.style.left=(50+Math.max(-50,Math.min(50,c)))+'%';n.classList.toggle('good',Math.abs(c)<=5)}
      const rd=$('twRead');if(rd)rd.textContent=Math.abs(c)<=5?'In tune ✓':Math.abs(c).toFixed(0)+' cents '+(c>0?'sharp':'flat')}}
    clearTimeout(slT);slT=setTimeout(()=>{try{strike(sel,.95)}catch{}},260)}
  function onSlideEnd(e){if(!e.target.dataset.k)return;mineOn();changed()}
  async function onEd(e){
    const b=e.target.closest('[data-a]');if(!b||b.disabled)return;const id=sel,a=b.dataset.a;
    if(a==='hear'){mineOn();try{warmAll();strike(id,.95)}catch{}}
    else if(a==='raw'){const ac=panCtx(),buf=await sampleBuf(id);if(ac&&buf){const s=ac.createBufferSource(),g=ac.createGain();g.gain.value=.9;s.buffer=buf;s.connect(g);g.connect(pBus);s.start()}}
    else if(a==='fix'){const r=Rget(id);if(!r||r.pc==null)return;setTune(id,-r.pc);mineOn();changed();const n=fills(id);msg(nice(id)+' tuned'+(n?', and the '+n+' note'+(n===1?'':'s')+' made from it':'')+'.');setTimeout(()=>{try{strike(id,.95)}catch{}},60)}
    else if(a==='reset'){delete SAMPLES.tune[id];saveTune();try{if(typeof renderTune==='function')renderTune()}catch{}changed();msg(nice(id)+' is back to how it was recorded.');setTimeout(()=>{try{strike(id,.95)}catch{}},60)}
    else if(a==='rec')recordNote(id);
    else if(a==='src')pick(b.dataset.v,true);
    else if(a==='edit'&&typeof WAVE!=='undefined')WAVE.open(id);
    else if(a[0]==='t'&&['tplay','tuse','tdel','tbest'].includes(a))takeAct(a,id,+b.dataset.v);
  }
  function setT(id,patch){const t=Object.assign({},SAMPLES.tune[id]||{},patch);for(const k of['cents','db','ring','tone'])if(k in t&&!+t[k])delete t[k];
    if(Object.keys(t).length)SAMPLES.tune[id]=t;else delete SAMPLES.tune[id];saveTune();try{if(typeof renderTune==='function')renderTune()}catch{}}
  function rough(){const id=sel;if(!SAMPLES.wav[id])return;const k=setOf(id),c=cfg(k);
    if(c.skip.includes(id)){c.skip=c.skip.filter(x=>x!==id);setCfg(k,c);changed();msg(nice(id)+' uses your recording again.');return}
    c.skip.push(id);c.on=true;setCfg(k,c);mineOn();changed();const s=sourceOf(id);
    msg(s.kind==='fill'?nice(id)+' will now be made from '+nice(s.src)+'.':'No other recording within 7 notes, so '+nice(id)+' keeps your recording for now.')}
  function resetPan(){const ids=order().filter(id=>SAMPLES.tune[id]);if(!ids.length){msg('Nothing to reset on this pan.');return}
    if(!confirm('Take every tuning, volume, ring and tone change off the '+SETS[keyNow()].name+'? ('+ids.length+' note'+(ids.length===1?'':'s')+')'))return;
    ids.forEach(id=>{delete SAMPLES.tune[id]});saveTune();changed();msg('The '+SETS[keyNow()].name+' is back to how it was recorded.')}
  async function listen(){
    const me=++run,ids=order().filter(id=>SAMPLES.wav[id]&&!Rget(id));let n=0;
    for(const id of ids){if(me!==run||!open)return;msg('Listening to your notes… '+(++n)+' of '+ids.length);
      await reading(id);await new Promise(r=>setTimeout(r,0));if(me===run&&open)render()}
    if(me===run&&ids.length)msg('');
  }
  const fills=id=>order().filter(x=>{const s=sourceOf(x);return s.kind==='fill'&&s.src===id}).length;
  function setTune(id,c){setT(id,{cents:Math.round(c*10)/10})}
  /* ✨ Tune all for me: the whole clean-up for every recording on this pan, in one go. Each take is trimmed to start
     on the hit and end when the ring has died away (basses keep their longer ring), clicks are smoothed out (saved back
     at 24-bit), it's tuned to pitch, and the volumes are evened out. Ring and Tone stay as you set them, and the room is
     left alone. (This replaces "Make my pans sound their best", which did the same but reset Ring and Tone.) */
  async function cleanAll(ids,quiet){
    ids=ids||order().filter(id=>SAMPLES.wav[id]);if(!ids.length){if(!quiet)msg('Nothing recorded on this pan yet.');return {n:0}}
    mineOn();if(!quiet)msg('Tidying '+ids.length+' recording'+(ids.length===1?'':'s')+'…');
    let tuned=0,clicks=0;const odd=[],loud={};
    for(const id of ids){
      const b=await sampleBuf(id);if(!b)continue;const sr=b.sampleRate,d=new Float32Array(b.getChannelData(0));
      let pk=0;for(const v of d)pk=Math.max(pk,Math.abs(v));if(pk<1e-4)continue;
      let on=0;while(on<d.length&&Math.abs(d[on])<pk*.2)on++;
      const n=declick(d,sr,on);
      if(n){clicks+=n;const w=encodeWav24(d,sr);SAMPLES.wav[id]=w;if(typeof TAKES!=='undefined'&&TAKES.replaceCur)TAKES.replaceCur(id,w);
        delete SAMPLES.buf[id];await sampleBuf(id)}
      const start=Math.max(0,on/sr-.004),win=Math.round(sr*.02);let end=d.length;
      for(let i=d.length-win;i>on;i-=win){let m=0;for(let j=i;j<i+win;j++)m=Math.max(m,Math.abs(d[j]));if(m>pk*.006){end=i+win;break}}
      const endS=Math.min(d.length/sr,end/sr+.05,start+takeCap(id)),len=endS-start;
      const patch={start:+start.toFixed(3),end:+endS.toFixed(3),fade:+Math.min(.35,Math.max(.08,len*.25)).toFixed(2)};
      const r=await reading(id);if(r&&r.pc!=null){if(Math.abs(r.pc)<=55){patch.cents=Math.round(-r.pc*10)/10;tuned++}else odd.push(nice(id))}
      setT(id,patch);
      const a=Math.round((start+.02)*sr),z=Math.min(d.length,a+Math.round(.3*sr));let q=0;for(let i=a;i<z;i++)q+=d[i]*d[i];loud[id]=Math.sqrt(q/Math.max(1,z-a));
    }
    const vals=Object.values(loud).filter(v=>v>0).sort((x,y)=>x-y),target=vals[vals.length>>1];
    if(vals.length>1)for(const [id,v] of Object.entries(loud))if(v>0){const lift=mid(id)<55?1:0;setT(id,{db:Math.max(-12,Math.min(12,Math.round((20*Math.log10(target/v)+lift)*2)/2))})}
    saveTune();changed();
    if(!quiet)msg('Done: '+ids.length+' recording'+(ids.length===1?'':'s')+' trimmed'+(vals.length>1?', evened out':'')+(tuned?', '+tuned+' tuned to pitch':'')+(clicks?', '+clicks+' click'+(clicks===1?'':'s')+' smoothed out':'')+'. Ring and Tone are as you left them.'+(odd.length?' Left alone (they sound like a different note, so check them): '+odd.join(', ')+'.':''));
    return {n:ids.length,tuned,clicks,odd};
  }
  const tuneAll=()=>cleanAll();
  async function listenAll(){for(const id of order())if(SAMPLES.wav[id]&&!Rget(id))await reading(id)}
  async function pickClean(){
    msg('Listening…');await listenAll();const k=keyNow(),c=cfg(k),ids=order().filter(id=>SAMPLES.wav[id]&&Rget(id)&&Rget(id).ok);
    // rough = below "OK", or clearly worse than the rest of your recordings on this pan
    const sc=ids.map(id=>Rget(id).score).sort((p,q)=>p-q),med=sc[sc.length>>1]||0;
    const bar=Math.min(55,med-15),clean=id=>Rget(id).score>=bar,marked=[];   // bass pans recorded on a phone all score lower, so each pan is judged against itself
    c.skip=c.skip.filter(id=>!ids.includes(id)||!clean(id));
    for(const id of ids){if(clean(id)||c.skip.includes(id))continue;
      if(ids.some(o=>o!==id&&clean(o)&&Math.abs(mid(o)-mid(id))<=4)){c.skip.push(id);marked.push(nice(id))}}
    c.on=true;setCfg(k,c);mineOn();changed();
    msg(marked.length?'Marked '+marked.length+' rough recording'+(marked.length===1?'':'s')+' ('+marked.join(', ')+'). '+(marked.length===1?'It\'s':'They\'re')+' now made from a cleaner neighbour, and the gaps are filled.':'All your recordings sound clean enough to keep. Gaps are filled from them.');
  }
  let allRun=0;
  const ping=id=>{const f=$('twPanBox').querySelector('.field[data-field="'+CSS.escape(id)+'"]');if(f){f.classList.remove('twping');void f.getBoundingClientRect();f.classList.add('twping')}};
  function playAll(){
    const me=++allRun,ids=order();mineOn();warmAll();msg('Playing '+nice(ids[0])+' to '+nice(ids[ids.length-1])+'…');
    ids.forEach((id,i)=>setTimeout(()=>{if(me!==allRun||!open)return;try{strike(id,.9)}catch{}ping(id);if(i===ids.length-1)setTimeout(()=>msg(''),400)},300+i*260));
  }
  let back=false;
  function show(on){
    build();open=!!on;$('twSheet').hidden=!on;document.body.classList.toggle('tw-open',open);
    if(on){++allRun;if(!vk||!SETS[vk])vk=setKey();more(false);if(!back)tabTo('tune');$('twHowBox').hidden=true;requestAnimationFrame(()=>{render(true);listen()})}
    else{++run;++allRun;if(!back)vk=null}
  }
  const _openRec=openRec;openRec=function(on){_openRec(on);if(!on&&back){back=false;show(true)}};
  // one pitch check for the whole app: the record sheet and "Make my pans sound their best" read notes the way the workshop does
  const _centsOff=centsOff;centsOff=function(id){const c=centsNow(id);return c===undefined?_centsOff(id):c};
  // fill notes in wherever Advanced tuning would be asked
  const _borrow=borrowOf;borrowOf=function(id){return fillOf(id)||_borrow(id)};
  PAN_HOOKS.push(()=>{if(open)render()});
  // backups carry the workshop choices too (hooked in once Studio has set up its own)
  setTimeout(()=>{const be=window.backupExtra;window.backupExtra=async()=>Object.assign(be?await be():{},{panFill:JSON.parse(JSON.stringify(st))});
  const bi=window.backupIn;window.backupIn=async p=>{let m=bi?await bi(p):'';const f=p&&p.panFill;
    if(f&&typeof f==='object'){for(const [k,v] of Object.entries(f))if(SETS[k]&&v&&typeof v==='object')st[k]={on:!!v.on,skip:Array.isArray(v.skip)?v.skip.filter(id=>typeof id==='string'&&FIELDS.has(id)):[]};store();m+=' Tuning workshop choices added.'}
    return m}},0);
  function centsNow(id){
    const b=SAMPLES.wav[id];if(!b)return null;let r=CACHE.get(b);
    if(!r){const buf=SAMPLES.buf[id];if(!buf)return undefined;const x=new Float32Array(buf.length);
      for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=0;i<x.length;i++)x[i]+=d[i]/buf.numberOfChannels}
      r=analyse(x,buf.sampleRate,id);CACHE.set(b,r)}
    return r.pc!=null?r.pc:null;
  }
  // a new take (or a different take) of a note starts fresh: any "rough" mark was about the old one
  const unrough=id=>{const k=setOf(id),c=cfg(k);if(c.skip.includes(id)){c.skip=c.skip.filter(x=>x!==id);setCfg(k,c)}};
  return {centsNow,allowed:true,open:show,decode,cleanAll,unrough,refresh:()=>{if(open)changed()},skip,fillOf,reading,analyse,get isOpen(){return open},get tab(){return tab}};
})();
