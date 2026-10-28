
/* ---------- Tuned steel: pan notes made the way a tuner tunes them, no recording needed ----------
   Each note area is a small dome that rings in a few modes. The tuner hammers it until mode 1 is the note, mode 2 is
   exactly the octave and mode 3 an octave and a fifth (cellos and basses) or two octaves (the small notes of the higher
   pans); a few untuned higher modes give the steel its edge. The octave blooms in just after the hit (the pan's "wah"),
   the stick's rubber tip decides how bright it is (a harder hit, a shorter touch, a brighter note), neighbours a fifth
   and an octave away ring along softly, and the barrel hums at its skirt's own note (BAND.BODY).
   Pan sounds → Tuned steel (S.panVoice 'steel'). Its own two sliders, Barrel hum (default 6) and Octave bloom (default 5),
   are kept in localStorage 'panyard-steel'; Band sound's Ring, Tone, Stick, Shimmer, Sweet ↔ Sharp and Drum body work on top. */
var STEEL=(()=>{
  const K='panyard-steel';
  let st={hum:6,bloom:5,edge:6};try{Object.assign(st,JSON.parse(localStorage.getItem(K)||'{}')||{})}catch{}
  const keep=()=>{try{localStorage.setItem(K,JSON.stringify(st))}catch{}};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  // how much of a mode the stick's half-sine touch (tau seconds long) can set ringing
  const mallet=(f,tau)=>{const w=2*Math.PI*f,d=1-Math.pow(w*tau/Math.PI,2);return Math.abs(d)<1e-6?Math.PI/4:Math.abs(Math.cos(w*tau/2)/d)};
  const NB=new WeakMap();
  function noise(ac){let b=NB.get(ac);if(!b){b=ac.createBuffer(1,Math.round(ac.sampleRate*.05),ac.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;NB.set(ac,b)}return b}
  // one note into dest at time t; v 0–1; light = a roll's quick strike. raw: made once at A 440 with no band sound, to be
  // kept as a ready note (the band sound, the song's A and Sweet ↔ Sharp go on when it plays, as on a recording)
  function play(ac,dest,id,t,v,light,extraCents,raw){
    if(!PITCH[id])return;v=clamp(v||.9,.05,1);const srcs=[];
    const set=(FIELDS.get(id)||{}).set||setKey(),bass=set==='six'||set==='seven',low=bass||set==='fcello'||set==='tcello';
    const hasB=!raw&&typeof BAND!=='undefined',T=hasB?BAND.tune({}):{},ringF=Math.pow(2,(+T.ring||0)/10);
    const cents=(hasB?BAND.cents(id):0)+(extraCents||0),f=(raw?440*Math.pow(2,(midiOf(PITCH[id])-69)/12):pitchHz(id))*Math.pow(2,cents/1200);
    const F=st.fit&&st.fit[set];   // Tune it like your pans: measured from your recordings of this pan
    const T60=(F?F.t60*Math.pow(F.f/f,.3):(bass?5:low?3.6:2.6)*Math.pow(261.6/f,.3))*ringF*(light?.35:1);
    const tau=(bass?.0016:low?.0009:.00045)*(1.25-.35*v),third=f<330?3:4,bl=st.bloom/5;
    const out=ac.createGain();out.gain.value=.34*v*(light?.7:1);
    const ch=hasB?BAND.chain(ac,T,id,v,t,light):null;if(ch){out.connect(ch.in);ch.out.connect(dest)}else out.connect(dest);
    // with your pans' measurements, the octave and third come out as loud as on your pans (the stick's filter taken off)
    // The steel's sound. Hammered thin and stretched, a note rings a whole ladder of tones (2×, 3×, 4×, 5× … the note):
    // the tuner sets the note, the octave and the third, and the steel's own stiffness adds the rest, bright at the hit
    // and gone quickly. Each tuned tone is really two a hair apart (the dome isn't perfectly round), which beat: the
    // pan's shimmer. A few untuned plate tones and the oil drum's thin shell ringing give the metal. Steel edge (0–10,
    // 6 = a real pan) turns that up or down; Tune it like your pans copies the ladder from your own recordings (F.h).
    const m1=mallet(f,tau),ed=st.edge/6,mc=(k)=>m1/Math.max(1e-3,mallet(k*f,tau));   // the stick's filter taken off a measured level
    const hk=(k,tuned)=>F&&F.h&&F.h[k-1]!=null?clamp(F.h[k-1]*(tuned?Math.sqrt(mc(k)):1),.005,3):null;
    const o2=hk(2,1)??(F?clamp(F.r2*Math.sqrt(mc(2)),.03,3):.95),o3=hk(third,1)??(F?clamp(F.r3*Math.sqrt(mc(third)),.01,2):.5),
      b2=F?clamp(F.bloom/2.5,.004,.12):.045,b3=F?clamp(F.bloom/4,.003,.08):.02;
    const lim=Math.min(16000,ac.sampleRate*.45);let end=t;
    // one tone: [frequency ×, level, how long it rings (× T60), bloom, a bright burst at the hit, beat Hz (0 = single)]
    // the stick sets the tuned tones ringing (its rubber softens the high ones a little); the rest of the ladder comes from the
    // steel itself bending, so the stick's filter doesn't apply to it (steel=1)
    // nothing above 8 kHz, and softer from 4 kHz: a pan's tones fade out up there, and very high bursts at each hit sound like ticks
    const tone=(mul,amp,dk,bloom,burst,beat,steel)=>{const fm=f*mul;if(fm>Math.min(lim,8000))return;const hf=1/(1+Math.pow(fm/4500,2));if(fm>4500)burst=(burst||0)*hf;const a=(steel?amp*m1:amp*m1*Math.sqrt(mallet(fm,tau)/m1))*(mul>1.5?hf:1),dur=Math.max(.06,T60*dk*Math.pow(1/mul,.25));if(a<2e-4)return;
      const g=ac.createGain();g.connect(out);
      for(const [df,share] of beat?[[-beat/2,.84],[beat/2,.16]]:[[0,1]]){const o=ac.createOscillator(),og=ac.createGain();o.frequency.value=fm+df;og.gain.value=share;o.connect(og);og.connect(g);o.start(t);o.stop(t+dur+.05);srcs.push(o)}
      g.gain.setValueAtTime(0,t);
      if(bloom){g.gain.linearRampToValueAtTime(a*clamp(1-.65*bl,.2,1),t+.002);g.gain.setTargetAtTime(a,t+.002,bloom);g.gain.setTargetAtTime(0,t+.002+bloom*2,dur/6.9)}
      else if(burst){g.gain.linearRampToValueAtTime(a*(1+burst),t+.0015);g.gain.setTargetAtTime(a,t+.0015,.02);g.gain.setTargetAtTime(0,t+.05,dur/6.9)}
      else{g.gain.linearRampToValueAtTime(a,t+.002);g.gain.setTargetAtTime(0,t+.002,dur/6.9)}
      end=Math.max(end,t+dur+.05)};
    const bt=k=>(bass?.5:low?.9:1.4)*(k===1?1:k===2?1.6:2.2);
    if(light){tone(1,1,1,0,0,0);tone(2.0015,o2*.85,.75,0,0,0);tone(third*1.001,o3*.6,.45,0,0,0)}
    else{
      tone(1,1,1,0,0,bt(1));tone(2.0015,o2,.75,b2*bl,0,bt(2));tone(third*1.001,F?o3:(third===4?.22:.3),.45,b3*bl,0,bt(3),F?0:1);
      // the rest of the ladder, up to 12× the note
      for(let k=3;k<=12;k++){if(k===third)continue;const lv=hk(k)??.24*Math.pow(.8,k-3);tone(k,lv*ed,.7/Math.pow(k,.4),0,k>=5?1.2*ed:.4*ed,0,1)}
      // untuned plate tones: a quick metallic edge
      [[1.43,.05],[2.37,.045],[3.21,.04],[4.47,.035],[6.13,.03],[7.4,.025]].forEach(([mul,lv])=>tone(mul,lv*ed,.12,0,1.5,0,1));
      // the oil drum's thin steel shell rings under the note (a 22.5 in drum: its own fixed tones, a little lower on a long skirt)
      const sh=raw||ac instanceof OfflineAudioContext;   // made once into the ready note, so its cost doesn't matter
      if(sh&&ed>0){const nb=ac.createBufferSource();nb.buffer=noise(ac);const ng=ac.createGain();nb.connect(ng);ng.gain.setValueAtTime(0,t);ng.gain.linearRampToValueAtTime(1,t+.0008);ng.gain.setTargetAtTime(0,t+.001,.003);
        const sc=bass?.6:low?.8:1;
        [[310,.9],[520,.8],[840,.7],[1190,.6],[1630,.5],[2210,.4],[2950,.3]].forEach(([fq,lv])=>{const bp=ac.createBiquadFilter(),gg=ac.createGain();bp.type='bandpass';bp.frequency.value=fq*sc;bp.Q.value=45;gg.gain.value=lv*.9*ed*v;ng.connect(bp);bp.connect(gg);gg.connect(out)});
        nb.start(t);nb.stop(t+.03);srcs.push(nb)}}
    if(!light){
      // the fundamental and octave pass energy back and forth: a slow, gentle swell
      const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=bass?1.6:3.1;lg.gain.value=.03*.32*v;lfo.connect(lg);lg.connect(out.gain);lfo.start(t);lfo.stop(end);srcs.push(lfo);
      // neighbours a fifth and an octave away ring along very softly
      for(const mul of [1.5,2]){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f*mul*1.0007;o.connect(g);g.connect(out);
        g.gain.setValueAtTime(0,t);g.gain.setTargetAtTime(.025,t,.12);g.gain.setTargetAtTime(0,t+.3,T60*1.3/6.9);o.start(t);o.stop(end);srcs.push(o)}
      // the barrel hums at its skirt's note
      const bh=typeof BAND!=='undefined'&&BAND.BODY?BAND.BODY[set]:0;
      if(bh&&st.hum>0){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=bh;o.connect(g);g.connect(out);
        g.gain.setValueAtTime(0,t);g.gain.setTargetAtTime(.05*st.hum/6*(bass?1.4:1),t,.03);g.gain.setTargetAtTime(0,t+.15,1.2/6.9);o.start(t);o.stop(Math.max(end,t+1.4));srcs.push(o)}}
    // the rubber tip touching the steel: a soft, short tap (not on a roll's quick strikes, where it piled up into ticks)
    if(!light){const s=ac.createBufferSource(),ng=ac.createGain(),bp=ac.createBiquadFilter();s.buffer=noise(ac);bp.type='bandpass';bp.Q.value=.8;bp.frequency.value=Math.min(3000,f*(bass?6:3));
      s.connect(bp);bp.connect(ng);ng.connect(out);ng.gain.setValueAtTime(0,t);ng.gain.linearRampToValueAtTime(.025*v,t+.0008);ng.gain.setTargetAtTime(0,t+.001,.002);s.start(t);s.stop(t+.02);srcs.push(s)}
    return srcs;
  }
  /* Ready notes: each note made once (at 32 kHz, a few seconds) and played like a recording, so a whole song costs the
     phone no more than your recordings do, and Studio's Stop, loops and same-note damping work on it as on them.
     Remade when Barrel hum, Octave bloom or your pans' measurements change. */
  const BUF=new Map();let sig='';
  function fresh(){const x=JSON.stringify([st.hum,st.bloom,st.edge,st.fit||null]);if(x!==sig){sig=x;BUF.clear()}}
  function ready(id){fresh();const b=BUF.get(id);return b instanceof AudioBuffer?b:null}
  function make(id){fresh();if(BUF.has(id))return Promise.resolve(BUF.get(id));if(!PITCH[id]||typeof OfflineAudioContext==='undefined')return Promise.resolve(null);
    const set=(FIELDS.get(id)||{}).set||setKey(),bass=set==='six'||set==='seven',low=bass||set==='fcello'||set==='tcello',F=st.fit&&st.fit[set],
      f=440*Math.pow(2,(midiOf(PITCH[id])-69)/12),T60=F?F.t60*Math.pow(F.f/f,.3):(bass?5:low?3.6:2.6)*Math.pow(261.6/f,.3),dur=clamp(T60*1.05+.2,1,6.5),sr=32000,my=sig;
    const p=(async()=>{try{const oc=new OfflineAudioContext(1,Math.ceil(sr*dur),sr);play(oc,oc.destination,id,0,.9,false,0,true);const b=await oc.startRendering();
      // fade the very end so a note that's still ringing when the made part ends never stops with a click
      const d=b.getChannelData(0),n=Math.min(d.length,Math.round(sr*.25));for(let i=0;i<n;i++)d[d.length-1-i]*=i/n;
      if(sig===my)BUF.set(id,b);return b}catch(e){console.warn('steel',e);BUF.delete(id);return null}})();
    BUF.set(id,p);return p}
  const warm=ids=>Promise.all([...new Set(ids)].map(make));
  // played like a recording: Band sound's chain, the song's A and Sweet ↔ Sharp; a new hit damps the same note's last ring
  const TUNE=b=>({start:0,end:b.duration,db:0,fade:.12,cents:0});
  // the ready note was made at a firm hit; a softer one is darker too (less of the stick's bite reaches the high tones)
  function soft(ac,dest,id,v,t){if(v>=.85)return dest;const lp=ac.createBiquadFilter();lp.type='lowpass';lp.Q.value=.5;
    lp.frequency.setValueAtTime(Math.min(16000,(typeof pitchHz==='function'?pitchHz(id):440)*(1.6+14*v*v)),t);lp.connect(dest);return lp}
  const LAST=new Map();
  function tapBuf(ac,dest,id,b,t,v,light){
    const T=typeof BAND!=='undefined'?BAND.tune(TUNE(b)):TUNE(b),det=(typeof refCents==='function'?refCents():0)+(typeof BAND!=='undefined'?BAND.cents(id):0);
    dest=soft(ac,dest,id,v,t);const ch=typeof BAND!=='undefined'?BAND.chain(ac,T,id,Math.min(1,v),t,light):null;if(ch)ch.out.connect(dest);
    const old=LAST.get(id);if(old&&!light){try{old.g.gain.cancelScheduledValues(t);old.g.gain.setTargetAtTime(0,t,.03);old.s.stop(t+.25)}catch{}}
    const one=(d,a,at)=>{const s=ac.createBufferSource(),g=ac.createGain();s.buffer=b;s.detune.value=d;s.connect(g);g.connect(ch?ch.in:dest);
      const len=b.duration;if(light){g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(a,at+.004);const e=Math.min(len,.45);g.gain.setValueAtTime(a,at+.12);g.gain.linearRampToValueAtTime(0,at+e);s.start(at);s.stop(at+e+.01)}
      else{noteEnvelope(g.gain,a,at,len,T.fade,T);s.start(at);s.stop(at+len+.01)}return {s,g}};
    const m=one(det,v*(light?.7:1),t);if(!light)LAST.set(id,m);
    if(typeof BAND!=='undefined'&&BAND.shimmerOn&&BAND.shimmerOn(light))one(det+9,v*.5*(light?.7:1),t+.012);
  }
  function shimmer(ac,dest,id,t,v,light){play(ac,dest,id,t,v,light);if(typeof BAND!=='undefined'&&BAND.shimmerOn&&BAND.shimmerOn(light))play(ac,dest,id,t+.012,v*.5,light,9)}
  /* Play: your taps (inside strike, after How you play has set the hit's strength) */
  {const _sm=strikeMine;strikeMine=function(id,vel,light){if(S.panVoice!=='steel')return _sm.apply(this,arguments);const ac=panCtx();if(!ac||!PITCH[id])return true;
    const b=ready(id),t=ac.currentTime+.003;if(b)tapBuf(ac,pBus,id,b,t,vel||1,light);else{make(id);shimmer(ac,pBus,id,t,vel||1,light)}return true}}
  // the song's pans get ready as soon as Tuned steel is on (a few at a time, so nothing stutters)
  function warmSong(){if(S.panVoice!=='steel'||!SETS[setKey()])return;const ids=SETS[setKey()].views.flatMap(v=>v.fields.map(f=>f[0]));(async()=>{for(const id of ids){await make(id);await new Promise(r=>setTimeout(r,80))}})()}
  {const _p=applyPanSet;applyPanSet=function(){const r=_p.apply(this,arguments);setTimeout(warmSong,300);return r}}
  setTimeout(warmSong,1500);
  /* Tune it like your pans: listen to your recordings of each pan and measure how it rings. The pitch always comes from
     the tuning maths, so a recording a little off, late or noisy doesn't matter; only its character is taken:
     how long the note rings (t60), how loud the octave and the third are next to the note (r2, r3) and how soon the
     octave peaks after the hit (bloom). Each one is the middle value of all that pan's recorded notes. */
  function goertzel(d,a,n,f,sr){const w=2*Math.PI*f/sr,c=2*Math.cos(w);let s1=0,s2=0;for(let i=0;i<n;i++){const h=.5-.5*Math.cos(2*Math.PI*i/(n-1)),s0=d[a+i]*h+c*s1-s2;s2=s1;s1=s0}return Math.sqrt(Math.max(0,s1*s1+s2*s2-c*s1*s2))/n}
  function measure(buf,T,fn){
    const d=buf.getChannelData(0),sr=buf.sampleRate,a0=Math.max(0,Math.floor((T.start||0)*sr)),e0=Math.min(d.length,Math.floor((T.end??buf.duration)*sr));
    let mx=0;for(let i=a0;i<e0;i++)mx=Math.max(mx,Math.abs(d[i]));if(mx<1e-3)return null;
    let on=a0;while(on<e0&&Math.abs(d[on])<.3*mx)on++;on=Math.max(a0,on-Math.round(.005*sr));
    const N=Math.round(.04*sr),hop=Math.round(.01*sr);if(e0-on<N*4)return null;
    // the recording's own pitch: the strongest spot within half a semitone of the note
    let f=fn,best=0;const M=Math.min(e0-on,Math.round(.25*sr));for(let c=-50;c<=50;c+=5){const ff=fn*Math.pow(2,c/1200),g=goertzel(d,on,M,ff,sr);if(g>best){best=g;f=ff}}
    const third=fn<330?3:4,A=[[],[],[]],H=[...Array(8)].map(()=>[]);let fr=0;
    for(let a=on;a+N<=e0;a+=hop,fr++){A[0].push(goertzel(d,a,N,f,sr));A[1].push(goertzel(d,a,N,2*f,sr));A[2].push(third*f<sr*.45?goertzel(d,a,N,third*f,sr):0)
      // the steel's ladder, 1× to 8× the note, in the first quarter second
      if(fr<25)for(let k=1;k<=8;k++)H[k-1].push(k*f<sr*.45?goertzel(d,a,N,k*f,sr):0)}
    const pk=x=>{let m=0,i=0;x.forEach((v,j)=>{if(v>m){m=v;i=j}});return [m,i]};
    const [p1,i1]=pk(A[0]),[p2,i2]=pk(A[1]),[p3]=pk(A[2]);if(p1<1e-6)return null;
    // ring: the fundamental's fall in dB per second, from 3 dB under its peak down to 30 dB under (or the end)
    const xs=[],ys=[];for(let j=i1;j<A[0].length;j++){const db=20*Math.log10(A[0][j]/p1+1e-9);if(db<-30)break;if(db<-3){xs.push(j*hop/sr);ys.push(db)}}
    let t60=null;if(xs.length>=4){const mx_=xs.reduce((s,x)=>s+x,0)/xs.length,my=ys.reduce((s,y)=>s+y,0)/ys.length;let nu=0,de=0;xs.forEach((x,k)=>{nu+=(x-mx_)*(ys[k]-my);de+=(x-mx_)**2});const sl=nu/de;if(sl<-1)t60=clamp(-60/sl,.3,12)}
    const h=H.map(x=>Math.max(0,...x)/p1);
    return {f:fn,t60,r2:p2/p1,r3:p3/p1,bloom:Math.max(0,(i2-i1)*hop/sr),h};
  }
  const med=a=>{a=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y);return a.length?a[a.length>>1]:null};
  async function learn(){
    const by={};for(const id of Object.keys(SAMPLES.wav||{})){const fd=FIELDS.get(id);if(!fd||!PITCH[id])continue;(by[fd.set]=by[fd.set]||[]).push(id)}
    const fit={},said=[];
    for(const [set,ids] of Object.entries(by)){
      const ms=[];for(const id of ids.slice(0,40)){const b=SAMPLES.buf[id]||await sampleBuf(id);if(!b)continue;try{const m=measure(b,typeof tuneOf==='function'?tuneOf(id):{},pitchHz(id));if(m)ms.push(m)}catch(e){console.warn(e)}await new Promise(r=>setTimeout(r,0))}
      if(ms.length<2)continue;
      const t60=med(ms.map(m=>m.t60))||null,fm=med(ms.map(m=>m.f));
      fit[set]={n:ms.length,f:fm,t60:t60||((set==='six'||set==='seven')?5:2.6)*Math.pow(261.6/fm,.3),r2:med(ms.map(m=>m.r2)),r3:med(ms.map(m=>m.r3)),bloom:med(ms.map(m=>m.bloom)),h:[...Array(8)].map((_,k)=>med(ms.map(m=>m.h&&m.h[k])))};
    }
    st.fit=fit;keep();render();
    const n=Object.keys(fit).length;say(n?'Tuned steel now rings like your '+Object.keys(fit).map(k=>SETS[k]?SETS[k].name:k).join(', ')+'.':'Record at least two notes of a pan first, then try again.');
    return fit;
  }
  function unlearn(){delete st.fit;keep();render();say('Tuned steel is back to a standard pan.')}
  // the measurements in words, for the list under the button
  function words(F){const db=x=>Math.round(20*Math.log10(Math.max(1e-4,x)));
    const d=db(F.r2);return 'rings '+F.t60.toFixed(1)+' s · '+(d<-6?'a soft':d>1?'a strong':'an even')+' octave · wah after '+Math.round(F.bloom*1000)+' ms · from '+F.n+' notes'}

  /* Pan sounds: the third choice, and its two sliders */
  // a note to try it on: the lowest of the song's pan
  const first=()=>{const ids=SETS[setKey()].views.flatMap(v=>v.fields.map(f=>f[0]));return ids.sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b]))[Math.min(4,ids.length-1)]};
  function mount(){
    const seg=$('voiceSeg');if(!seg||seg.querySelector('[data-v=steel]'))return;
    const b=document.createElement('button');b.dataset.v='steel';b.textContent='Tuned steel';b.setAttribute('aria-pressed',String(S.panVoice==='steel'));
    const mine=seg.querySelector('[data-v=mine]');seg.insertBefore(b,mine);const bi=seg.querySelector('[data-v=synth]');if(bi)bi.textContent='Built-in';
    b.onclick=()=>{S.panVoice='steel';setTimeout(warmSong,50);try{renderVoice()}catch{}try{save()}catch{}strike(first(),.9);render()};
    seg.addEventListener('click',()=>setTimeout(render,0));
    const box=document.createElement('div');box.id='steelBox';box.className='steelbox';seg.after(box);render();
    box.addEventListener('click',e=>{const b=e.target.closest('[data-steelfit]');if(!b)return;if(b.dataset.steelfit==='clear'){unlearn();return}b.disabled=true;b.textContent='Listening to your pans…';learn().finally(()=>render())});
    box.addEventListener('input',e=>{const k=e.target.dataset.steel;if(!k)return;st[k]=+e.target.value;keep();const o=e.target.closest('label').querySelector('output');if(o)o.textContent=e.target.value;
      clearTimeout(box._t);box._t=setTimeout(()=>strike(first(),.9),250)});
  }
  function render(){const box=$('steelBox');if(!box)return;const home=$('twSound');if(home&&home.firstElementChild!==box)home.prepend(box);   // top of Pan sounds → Sound
    const on=S.panVoice==='steel';box.hidden=!on;if(!on)return;
    const sl=(k,label,sub)=>'<label class="steelsl"><span><b>'+label+'</b><small>'+sub+'</small></span><input type="range" min="0" max="10" step="1" data-steel="'+k+'" value="'+st[k]+'"><output>'+st[k]+'</output></label>';
    box.innerHTML='<h3>Tuned steel</h3><p class="help">Every note made from how a tuner tunes a pan: the note, its octave and its twelfth (or double octave), with the barrel humming along. Nothing to record. Band sound\'s Ring, Tone and Stick shape it too.</p>'
      +sl('hum','Barrel hum','The skirt ringing along (6 is a real pan)')+sl('bloom','Octave bloom','The "wah" just after you hit (5 is a real pan)')+sl('edge','Steel edge','The metal: the ladder of bright tones and the drum\'s shell ringing (6 is a real pan)')
      +'<div class="steelfit"><button class="btn" data-steelfit="learn">✨ Tune it like my pans</button>'+(st.fit&&Object.keys(st.fit).length?'<button class="btn sm" data-steelfit="clear">Standard pan</button>':'')+'</div>'
      +(st.fit&&Object.keys(st.fit).length?'<ul class="steelfitl">'+Object.entries(st.fit).map(([k,F])=>'<li><b>'+esc(SETS[k]?SETS[k].name:k)+'</b> '+words(F)+'</li>').join('')+'</ul>'
        :'<p class="help">Listens to the notes you\'ve recorded and makes Tuned steel ring like your own pans: how long they sing, how strong the octave is, how soon the "wah" comes. Background noise in your recordings stays out: only how your pans ring is used.</p>')}
  {const _rv=renderVoice;renderVoice=function(){const r=_rv.apply(this,arguments);const seg=$('voiceSeg');if(seg){const b=seg.querySelector('[data-v=steel]');if(b)b.setAttribute('aria-pressed',String(S.panVoice==='steel'))}render();return r}}
  setTimeout(()=>{try{mount()}catch(e){console.warn('steel',e)}},0);
  {const c=document.createElement('style');c.textContent=`
.steelbox{margin:8px 0 4px}.steelbox[hidden]{display:none}
.steelsl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr) 26px;align-items:center;gap:10px;margin:10px 0}
.steelsl span{display:flex;flex-direction:column}.steelsl small{color:var(--muted);font-size:12px}
.steelfit{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 6px}.steelfitl{margin:6px 0 4px;padding-left:18px;font-size:13px;color:var(--muted)}.steelfitl b{color:var(--text)}
.steelsl input{width:100%;accent-color:var(--gold);min-height:32px}.steelsl output{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}`;document.head.appendChild(c)}
  return {play:shimmer,one:play,ready,make,warm,tapBuf,soft,T:TUNE,get s(){return st},set(k,v){st[k]=v;keep();render()},mount,learn,unlearn,measure};
})();
