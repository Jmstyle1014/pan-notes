
/* ---------- Tuning workshop (Studio ⋯): read each recorded pan note like a tuner, then fill in the rest ---------- */
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
    const p0=parts[0],p1=parts[1],pc=p0.heard?p0.cents:(p1&&p1.heard?p1.cents:null);
    return {ok:true,parts,pc,pcFrom:p0.heard?'note':pc==null?null:'octave',score,harm,snr,ring,a,f0,on:on/sr};
  }
  const CACHE=new WeakMap();
  async function reading(id){
    const b=SAMPLES.wav[id];if(!b)return null;if(CACHE.has(b))return CACHE.get(b);
    let r;try{const {x,sr}=await decode(b);r=analyse(x,sr,id)}catch{r={ok:false}}
    CACHE.set(b,r);return r;
  }
  const quality=s=>s>=75?['ok','Clean']:s>=55?['mid','OK']:['bad','Rough'];
  const tuneC=id=>{try{return tuneOf(id).cents||0}catch{return 0}};

  /* ---- the sheet ---- */
  let sel=null,open=false,raf=0,run=0,busy=false;const strobes=[];
  function build(){
    if($('twSheet'))return;
    const sh=document.createElement('div');sh.id='twSheet';sh.className='sheetov tw';sh.hidden=true;sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.setAttribute('aria-labelledby','twTitle');
    sh.innerHTML='<div class="sheetbox twbox">'
      +'<div class="twhead"><div><span class="eyebrow">Studio · pan sounds</span><h2 id="twTitle">Tuning workshop</h2><p class="twsub" id="twSub"></p></div><button class="btn" id="twClose">Done</button></div>'
      +'<label class="twfill"><input type="checkbox" id="twFill"><span class="twsw" aria-hidden="true"></span><span><b>Fill the gaps from my best notes</b><small id="twFillInfo"></small></span></label>'
      +'<p class="twkey"><span><i class="k anc"></i>The recording</span><span><i class="k fil"></i>Made from it (↑↓ notes moved)</span><span><s>G4</s> rough take, left out</span></p>'
      +'<div class="twfams" id="twStrip" aria-label="Your note families, low to high"></div>'
      +'<div class="twdetail" id="twDetail"></div>'
      +'<div class="twacts"><button class="btn" id="twAll">▶ Play the whole pan</button><button class="btn gold" id="twTuneAll">✨ Tune all my recordings</button><button class="btn" id="twPick">Pick the cleanest for me</button></div>'
      +'<p class="twmsg" id="twMsg" aria-live="polite"></p>'
      +'<details class="twhow"><summary>How the workshop works</summary>'
      +'<p>When you hit a pan note it rings several tones at once: the note, its octave (twice as high) and, on the higher pans, the twelfth (an octave and a fifth up). A tuner hammers the note until those tones line up on a strobe tuner. Here every recording gets the same check: when a strobe band stands still the tone is on pitch, drifting right is sharp, drifting left is flat.</p>'
      +'<p><b>Tune</b> moves the whole recording to the right pitch. It cannot move the octave on its own the way a hammer can, so if the octave is still far off after tuning, that note on your real pan is out, or the take was. Recording it again usually helps.</p>'
      +'<p><b>Fill the gaps</b> makes every note you haven\'t recorded from the closest of your recordings on this pan, up to 7 notes away, retuned to the right pitch. A recording you mark <b>rough</b> is filled from a cleaner neighbour instead. Record a handful of clean notes spread across the pan (one every 3 or 4 notes, on the outer, middle and inner rings) and the rest will sound like your pan.</p>'
      +'</details></div>';
    document.body.appendChild(sh);
    sh.addEventListener('click',e=>{if(e.target===sh)show(false)});
    $('twClose').onclick=()=>show(false);
    $('twFill').onchange=e=>{const k=setKey(),c=cfg(k);c.on=e.target.checked;setCfg(k,c);mineOn();changed();
      msg(c.on?'Gaps filled. Tap ▶ Play the whole pan to hear it.':'Gaps off: notes you haven\'t recorded use '+(BORROW[k]?'Advanced tuning':'the built-in sound')+'.')};
    $('twAll').onclick=playAll;$('twTuneAll').onclick=tuneAll;$('twPick').onclick=pickClean;
    $('twStrip').addEventListener('click',e=>{const f=e.target.closest('[data-fam]');if(f){playFam(f.dataset.fam);return}
      const b=e.target.closest('[data-id]');if(!b)return;sel=b.dataset.id;render();try{strike(sel,.9)}catch{}});
    $('twStrip').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const ids=order(),i=ids.indexOf(sel),n=ids[Math.max(0,Math.min(ids.length-1,i+(e.key==='ArrowRight'?1:-1)))];
      if(n){sel=n;render();const b=$('twStrip').querySelector('[data-id="'+CSS.escape(n)+'"]');if(b)b.focus();try{strike(n,.9)}catch{}}});
    $('twDetail').addEventListener('click',onDetail);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open)show(false)});
  }
  const msg=t=>{const m=$('twMsg');if(m)m.textContent=t||''};
  const order=()=>REC_ORDER.filter(id=>PITCH[id]).slice().sort((a,b)=>mid(a)-mid(b)||REC_ORDER.indexOf(a)-REC_ORDER.indexOf(b));
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
  const FAM_COL=['#ff8a5c','#ffd166','#5fd4a0','#6fb7ff','#c792ff','#ff7ab8','#4fd6d6','#f2a65a','#9fe07a','#b8a4ff'];
  function families(){
    const ids=order(),map=new Map(),loose=[];
    for(const id of ids){let a=null;
      if(SAMPLES.wav[id]&&!(cfg(setOf(id)).skip.includes(id)&&fillOf(id,true)))a=id;
      else{const f=fillOf(id,true);if(f)a=f.src}
      if(a){if(!map.has(a))map.set(a,[]);map.get(a).push(id)}else loose.push(id)}
    const fams=[...map.entries()].sort((x,y)=>mid(x[0])-mid(y[0])).map(([a,notes],i)=>({a,notes,col:FAM_COL[i%FAM_COL.length]}));
    return {fams,loose};
  }
  function famChip(id,a,col,on){
    const own=id===a,has=!!SAMPLES.wav[id],rough=has&&!own,r=Rget(id),tc=tuneC(id),d=mid(id)-mid(a);let sub='',tone='';
    if(own){if(r&&r.pc!=null){const c=r.pc+tc;sub=Math.abs(c)<=3?'in tune':(c>0?'+':'−')+Math.abs(c).toFixed(0)+'¢';tone=Math.abs(c)<=3?'good':Math.abs(c)<=10?'near':'off'}else sub=r?'unclear':'…'}
    else if(rough)sub='rough';else sub=(d>0?'↑':'↓')+Math.abs(d);
    return '<button class="twc '+(own?'anc':'fil')+(rough?' rough':'')+(!own&&!on?' dim':'')+(id===sel?' on':'')+'" aria-pressed="'+(id===sel)+'" data-id="'+id+'"><b>'+nice(id)+'</b><small class="'+tone+'">'+sub+'</small></button>';
  }
  function famStatus(a){const r=Rget(a),tc=tuneC(a);if(!r)return ['','listening…'];if(r.pc==null)return ['off','unclear take'];
    const c=r.pc+tc;return Math.abs(c)<=3?['good','in tune']:[Math.abs(c)<=10?'near':'off',(c>0?'+':'−')+Math.abs(c).toFixed(0)+'¢ · tune it']}
  function chip(id){
    const s=sourceOf(id),r=Rget(id),rough=SAMPLES.wav[id]&&skip(id),tc=tuneC(id);let line='';
    if(s.kind==='own'){if(r&&r.pc!=null){const c=r.pc+tc;line=(Math.abs(c)<=3?'in tune':(c>0?'+':'−')+Math.abs(c).toFixed(0)+'¢')}else line=r?'unclear':'…'}
    else if(s.kind==='fill'||s.kind==='borrow')line='from '+nice(s.src);else line='built-in';
    const c0=r&&r.pc!=null?r.pc+tc:null,cls=s.kind==='own'?'anc':s.kind==='built'?'bin':'fil';
    const tone=c0==null?'':Math.abs(c0)<=3?' good':Math.abs(c0)<=10?' near':' off';
    return '<button class="twc '+cls+(rough?' rough':'')+(id===sel?' on':'')+'" role="option" aria-selected="'+(id===sel)+'" tabindex="'+(id===sel?0:-1)+'" data-id="'+id+'"><b>'+nice(id)+'</b><small class="'+tone.trim()+'">'+line+'</small></button>';
  }
  function render(){
    if(!open)return;const k=setKey(),c=cfg(k),ids=order();
    if(!sel||!ids.includes(sel))sel=ids.find(id=>SAMPLES.wav[id])||ids[0];
    const own=ids.filter(id=>SAMPLES.wav[id]).length;
    $('twSub').textContent=curSet().name+' · '+own+' of '+ids.length+' notes recorded';
    $('twFill').checked=c.on;
    const filled=ids.filter(id=>sourceOf(id).kind==='fill').length,built=ids.filter(id=>sourceOf(id).kind==='built').length;
    $('twFillInfo').textContent=!own?'Record a few notes on this pan first.':c.on?filled+' note'+(filled===1?'':'s')+' made from your recordings'+(built?', '+built+' too far from any recording (built-in sound)':'')+'.':'Off: notes you haven\'t recorded use '+(BORROW[k]?'Advanced tuning':'the built-in sound')+'.';
    const {fams,loose}=families(),dBox=$('twDetail');
    $('twStrip').innerHTML=fams.map(f=>{const [tc,tt]=famStatus(f.a);
      return '<div class="twfam" style="--fc:'+f.col+'" data-of="'+f.a+'"><div class="twfh"><span class="twdot" aria-hidden="true"></span><b>'+nice(f.a)+' family</b><small>'+f.notes.length+' note'+(f.notes.length===1?'':'s')+'</small>'
        +'<span class="twfs '+tc+'">'+tt+'</span><button class="twfp" data-fam="'+f.a+'" aria-label="Hear the '+nice(f.a)+' family, low to high">▶</button></div>'
        +'<div class="twchips">'+f.notes.map(id=>famChip(id,f.a,f.col,c.on)).join('')+'</div></div>'}).join('')
      +(loose.length?'<div class="twfam loose"><div class="twfh"><span class="twdot" aria-hidden="true"></span><b>Not covered yet</b><small>'+loose.length+' note'+(loose.length===1?'':'s')+'</small></div>'
        +'<p class="twhint">'+(own?'More than 7 notes from any of your recordings, so these play the built-in sound. Record one of them to start a new family.':'Record a few notes spread across the pan and they\'ll each start a family.')+'</p>'
        +'<div class="twchips">'+loose.map(id=>'<button class="twc bin'+(id===sel?' on':'')+'" aria-pressed="'+(id===sel)+'" data-id="'+id+'"><b>'+nice(id)+'</b><small>built-in</small></button>').join('')+'</div></div>':'');
    // the chosen note's readings open right under its own family
    const home=[...$('twStrip').querySelectorAll('.twfam')].find(r=>r.querySelector('[data-id="'+CSS.escape(sel)+'"]'));
    if(home){home.after(dBox);dBox.style.setProperty('--fc',getComputedStyle(home).getPropertyValue('--fc'))}
    detail();
    $('twTuneAll').disabled=!own;$('twPick').disabled=own<2;
  }
  function detail(){
    const id=sel,box=$('twDetail');strobes.length=0;if(!id){box.innerHTML='';return}
    const f=FIELDS.get(id),s=sourceOf(id),r=Rget(id),has=!!SAMPLES.wav[id],rough=has&&cfg(setOf(id)).skip.includes(id),tc=tuneC(id);
    let h='<div class="twtop"><div><div class="twname">'+nice(id)+'</div><div class="twpos">'+[f.pos,f.pan].filter(Boolean).join(' · ')+'</div></div><div class="twstate">';
    if(s.kind==='own')h+='<span class="twtag anc">Your recording</span>';
    else if(s.kind==='fill')h+='<span class="twtag fil">Made from '+nice(s.src)+'</span><span class="twnote">'+Math.abs(s.st)+' note'+(Math.abs(s.st)===1?'':'s')+' '+(s.st>0?'up':'down')+(rough?', because you marked this recording rough':'')+'</span>';
    else if(s.kind==='borrow')h+='<span class="twtag fil">Borrowed from '+nice(s.src)+'</span><span class="twnote">Advanced tuning, from another pan</span>';
    else h+='<span class="twtag bin">Built-in sound</span><span class="twnote">'+(cfg(setOf(id)).on?'No recording within 7 notes. Recording this one, or one nearby, would help.':'Turn on Fill the gaps, or record this note.')+'</span>';
    h+='</div></div>';
    if(has){
      if(!r)h+='<p class="twhint">Listening…</p>';
      else if(!r.ok)h+='<p class="twhint">This recording was too short or quiet to read. Record it again, letting the note ring.</p>';
      else{const [q,ql]=quality(r.score);
        if(s.kind!=='own')h+='<p class="twhint">Below are the readings of your own recording of '+nice(id)+', which isn\'t playing right now.</p>';
        if(r.pcFrom==='octave')h+='<p class="twhint">This note is too low for a phone microphone to catch clearly, so its pitch is read from its octave.</p>';
        h+='<div class="twq '+q+'"><span>Sound quality</span><div class="twbar"><i style="width:'+r.score+'%"></i></div><b>'+ql+'</b></div>';
        h+='<div class="twstrobes">'+r.parts.map((p,i)=>{const now=p.cents+tc;return '<div class="twrow"><div class="twrn">'+p.name+'<small>'+p.sub+'</small></div><div class="twrc" id="twC'+i+'"></div><canvas id="twS'+i+'"></canvas>'
          +'<div class="twcmp">'+(p.heard?'as recorded '+fmt(p.cents)+(tc?' · with tuning <b>'+fmt(now)+'</b>':''):'too quiet to read in this take')+'</div></div>'}).join('')+'</div>';
        h+='<canvas class="twspec" id="twSpec" aria-label="The tones inside this recording, with dashed lines where they should be"></canvas>';
      }
    }
    h+='<div class="twbtns"><button class="btn" data-a="hear">▶ Hear it</button>';
    if(has)h+='<button class="btn" data-a="raw">▶ As recorded</button>';
    if(has&&r&&r.pc!=null)h+=Math.abs(r.pc+tc)>0.5?'<button class="btn gold" data-a="tune">Tune to pitch ('+fmt(-(r.pc))+')</button>':'<span class="twok">✓ Tuned</span>';
    if(has&&tc)h+='<button class="btn" data-a="untune">Undo tuning</button>';
    if(has)h+=rough?'<button class="btn" data-a="keep">Use my recording again</button>':'<button class="btn" data-a="rough">Rough: fill this note instead</button>';
    h+='<button class="btn" data-a="rec">● '+(has?'Record again':'Record this note')+'</button></div>';
    if(has&&r&&r.ok){const o=r.parts[1];if(o&&o.heard&&r.parts[0].heard&&Math.abs(o.cents-r.parts[0].cents)>12)
      h+='<p class="twhint">The octave is '+Math.abs(o.cents-r.parts[0].cents).toFixed(0)+' cents '+(o.cents>r.parts[0].cents?'sharp':'flat')+' of the note itself. Tuning can\'t fix that part, so this note may sound a little sour. That\'s on the pan (or the take): a fresh recording, or a neighbour marked as the anchor, may sound sweeter.</p>'}
    box.innerHTML=h;
    if(has&&r&&r.ok){r.parts.forEach((p,i)=>{strobes.push({cv:$('twS'+i),c:p.cents+tc,heard:p.heard,off:0});const el=$('twC'+i),[cl,t]=verdict(p.cents+tc,p.heard);el.innerHTML='<span>'+(p.heard?fmt(p.cents+tc):'–')+'</span><span class="twv '+cl+'">'+t+'</span>'});drawSpec(r,tc)}
  }
  const fmt=c=>(c>=0?'+':'−')+Math.abs(c).toFixed(1)+'¢';
  const verdict=(c,h)=>!h?['none','Not heard']:Math.abs(c)<=3?['ok','In tune']:Math.abs(c)<=10?['mid',c>0?'A bit sharp':'A bit flat']:['bad',c>0?'Sharp':'Flat'];
  function drawSpec(r,tc){
    const cv=$('twSpec');if(!cv)return;const w=cv.clientWidth,h=cv.clientHeight,dpr=devicePixelRatio||1;if(!w)return;
    cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    const css=getComputedStyle(document.documentElement),col=n=>css.getPropertyValue(n).trim()||'#ccc';
    const f0=r.f0,ks=r.parts.map(p=>p.k),fl=f0*.6,fh=f0*(ks[ks.length-1]+1.2),X=f=>6+Math.log(f/fl)/Math.log(fh/fl)*(w-12),Y=db=>8+(-db/60)*(h-28);
    g.beginPath();g.moveTo(X(fl),Y(-60));const a=r.a,shift=Math.pow(2,tc/1200);
    for(let px=0;px<=w-12;px++){const f=fl*Math.pow(fh/fl,px/(w-12)),f2=fl*Math.pow(fh/fl,(px+1)/(w-12));let m=0;
      for(let b=Math.floor(f/shift/a.bin);b<=Math.ceil(f2/shift/a.bin)&&b<a.mag.length;b++)m=Math.max(m,a.mag[b]);
      g.lineTo(6+px,Y(Math.max(-60,20*Math.log10(m/a.max+1e-9))))}
    g.lineTo(X(fh),Y(-60));g.closePath();const gold=col('--gold');
    g.globalAlpha=.35;g.fillStyle=gold;g.fill();g.globalAlpha=1;g.strokeStyle=gold;g.lineWidth=1.2;g.stroke();
    g.font='11px system-ui,sans-serif';g.fillStyle=col('--muted');g.strokeStyle=col('--steel');g.globalAlpha=.8;
    ks.forEach((k,i)=>{const x=X(k*f0);g.setLineDash([3,4]);g.beginPath();g.moveTo(x,6);g.lineTo(x,h-18);g.stroke();g.setLineDash([]);g.textAlign='center';g.fillText(k===1?nice(sel):k+'×',Math.max(14,Math.min(w-14,x)),h-4)});
    g.globalAlpha=1;
  }
  function tick(t){
    if(!open){raf=0;return}raf=requestAnimationFrame(tick);
    const dt=Math.min(.05,(t-(tick.l||t))/1000);tick.l=t;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css=getComputedStyle(document.documentElement),col=n=>css.getPropertyValue(n).trim();
    for(const s of strobes){const cv=s.cv;if(!cv||!cv.isConnected)continue;const w=cv.clientWidth,h=cv.clientHeight,dpr=devicePixelRatio||1;if(!w)continue;
      if(cv.width!==Math.round(w*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
      const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
      if(!reduce)s.off+=Math.max(-160,Math.min(160,s.c*5))*dt;
      const a=Math.abs(s.c);g.fillStyle=!s.heard?col('--line'):a<=3?'#5fd48a':a<=10?col('--gold'):col('--danger');
      for(const [p,y,bh] of [[16,0,h/2-1],[8,h/2+1,h/2-1]]){const per=p*2,o=((s.off*(16/p)%per)+per)%per;for(let x=-per+o;x<w;x+=per)g.fillRect(x,y,p,bh)}
      g.fillStyle=col('--text');g.globalAlpha=.55;g.fillRect(w/2-1,0,2,h);g.globalAlpha=1}
  }
  async function listen(){
    const me=++run,ids=order().filter(id=>SAMPLES.wav[id]&&!Rget(id));let n=0;
    for(const id of ids){if(me!==run||!open)return;msg('Listening to your notes… '+(++n)+' of '+ids.length);
      await reading(id);await new Promise(r=>setTimeout(r,0));if(me===run&&open)render()}
    if(me===run)msg(ids.length?'':$('twMsg').textContent);
  }
  async function onDetail(e){
    const b=e.target.closest('[data-a]');if(!b)return;const id=sel,a=b.dataset.a,k=setOf(id);
    if(a==='hear'){mineOn();try{warmAll();strike(id,.95)}catch{}}
    else if(a==='raw'){const ac=panCtx(),buf=await sampleBuf(id);if(ac&&buf){const s=ac.createBufferSource(),g=ac.createGain();g.gain.value=.9;s.buffer=buf;s.connect(g);g.connect(pBus);s.start()}}
    else if(a==='tune'){const r=Rget(id);if(!r||!r.ok)return;setTune(id,-r.pc);mineOn();changed();msg(nice(id)+' tuned'+(fills(id)?', and the '+fills(id)+' note'+(fills(id)===1?'':'s')+' made from it':'')+'.');setTimeout(()=>{try{strike(id,.95)}catch{}},60)}
    else if(a==='untune'){setTune(id,0);changed();msg('Tuning undone for '+nice(id)+'.')}
    else if(a==='rough'){const c=cfg(k);c.skip.push(id);c.on=true;setCfg(k,c);mineOn();changed();
      const s=sourceOf(id);msg(s.kind==='fill'?nice(id)+' will now be made from '+nice(s.src)+'.':'No other recording within 7 notes, so '+nice(id)+' keeps your recording for now.')}
    else if(a==='keep'){const c=cfg(k);c.skip=c.skip.filter(x=>x!==id);setCfg(k,c);changed();msg(nice(id)+' uses your recording again.')}
    else if(a==='rec'){show(false);back=true;recSel=id;openRec(true)}
  }
  const fills=id=>order().filter(x=>{const s=sourceOf(x);return s.kind==='fill'&&s.src===id}).length;
  function setTune(id,c){const t=Object.assign({},SAMPLES.tune[id]||{});t.cents=Math.round(c*10)/10;if(!t.cents)delete t.cents;
    if(Object.keys(t).length)SAMPLES.tune[id]=t;else delete SAMPLES.tune[id];saveTune();try{if(typeof renderTune==='function')renderTune()}catch{}}
  async function tuneAll(){
    mineOn();msg('Listening…');await listenAll();let n=0,odd=[];
    for(const id of order()){const r=Rget(id);if(!SAMPLES.wav[id]||!r||r.pc==null)continue;
      if(Math.abs(r.pc)>55){odd.push(nice(id));continue}setTune(id,-r.pc);n++}
    changed();msg(n?'Tuned '+n+' recording'+(n===1?'':'s')+' to pitch'+(cfg(setKey()).on?', and every note made from them':'')+'.'+(odd.length?' Left alone (they sound like a different note, so check them): '+odd.join(', ')+'.':''):'Nothing to tune yet.');
  }
  async function listenAll(){for(const id of order())if(SAMPLES.wav[id]&&!Rget(id))await reading(id)}
  async function pickClean(){
    msg('Listening…');await listenAll();const k=setKey(),c=cfg(k),ids=order().filter(id=>SAMPLES.wav[id]&&Rget(id)&&Rget(id).ok);
    // rough = below "Good", or clearly worse than the rest of your recordings on this pan
    const sc=ids.map(id=>Rget(id).score).sort((p,q)=>p-q),med=sc[sc.length>>1]||0;
    const bar=Math.min(55,med-15),clean=id=>Rget(id).score>=bar,marked=[];   // bass pans recorded on a phone all score lower, so each pan is judged against itselfc.skip=c.skip.filter(id=>!ids.includes(id)||!clean(id));
    for(const id of ids){if(clean(id)||c.skip.includes(id))continue;
      if(ids.some(o=>o!==id&&clean(o)&&Math.abs(mid(o)-mid(id))<=4)){c.skip.push(id);marked.push(nice(id))}}
    c.on=true;setCfg(k,c);mineOn();changed();
    msg(marked.length?'Marked '+marked.length+' rough recording'+(marked.length===1?'':'s')+' ('+marked.join(', ')+'). '+(marked.length===1?'It\'s':'They\'re')+' now made from a cleaner neighbour, and the gaps are filled.':'All your recordings sound clean enough to keep. Gaps are filled from them.');
  }
  let allRun=0;
  function playFam(a){const f=families().fams.find(x=>x.a===a);if(!f)return;const me=++allRun;mineOn();warmAll();
    f.notes.forEach((id,i)=>setTimeout(()=>{if(me!==allRun||!open)return;try{strike(id,.9)}catch{}
      const b=$('twStrip').querySelector('[data-id="'+CSS.escape(id)+'"]');if(b){b.classList.add('ping');setTimeout(()=>b.classList.remove('ping'),260)}},200+i*280))}
  function playAll(){
    const me=++allRun,ids=order();mineOn();warmAll();msg('Playing '+nice(ids[0])+' to '+nice(ids[ids.length-1])+'…');
    ids.forEach((id,i)=>setTimeout(()=>{if(me!==allRun||!open)return;try{strike(id,.9)}catch{}
      const b=$('twStrip').querySelector('[data-id="'+CSS.escape(id)+'"]');if(b){b.classList.add('ping');setTimeout(()=>b.classList.remove('ping'),260)}
      if(i===ids.length-1)setTimeout(()=>msg(''),400)},300+i*260));
  }
  let back=false;
  function show(on){
    build();open=!!on;$('twSheet').hidden=!on;document.body.classList.toggle('tw-open',open);
    if(on){++allRun;render();listen();if(!raf)raf=requestAnimationFrame(tick);setTimeout(()=>{const b=$('twStrip').querySelector('.on');if(b)b.scrollIntoView({block:'nearest',inline:'center'})},50)}
    else{++run;++allRun}
  }
  // coming back from the record sheet reopens the workshop on the same note
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
  return {centsNow,allowed:true,open:show,skip,fillOf,reading,analyse,get isOpen(){return open}};
})();
