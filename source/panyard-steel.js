
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
  let st={hum:6,bloom:5};try{Object.assign(st,JSON.parse(localStorage.getItem(K)||'{}')||{})}catch{}
  const keep=()=>{try{localStorage.setItem(K,JSON.stringify(st))}catch{}};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  // how much of a mode the stick's half-sine touch (tau seconds long) can set ringing
  const mallet=(f,tau)=>{const w=2*Math.PI*f,d=1-Math.pow(w*tau/Math.PI,2);return Math.abs(d)<1e-6?Math.PI/4:Math.abs(Math.cos(w*tau/2)/d)};
  const NB=new WeakMap();
  function noise(ac){let b=NB.get(ac);if(!b){b=ac.createBuffer(1,Math.round(ac.sampleRate*.05),ac.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;NB.set(ac,b)}return b}
  // one note into dest at time t; v 0–1; light = a roll's quick strike
  function play(ac,dest,id,t,v,light,extraCents){
    if(!PITCH[id])return;v=clamp(v||.9,.05,1);
    const set=(FIELDS.get(id)||{}).set||setKey(),bass=set==='six'||set==='seven',low=bass||set==='fcello'||set==='tcello';
    const T=typeof BAND!=='undefined'?BAND.tune({}):{},ringF=Math.pow(2,(+T.ring||0)/10);
    const cents=(typeof BAND!=='undefined'?BAND.cents(id):0)+(extraCents||0),f=pitchHz(id)*Math.pow(2,cents/1200);
    const T60=(bass?5:low?3.6:2.6)*Math.pow(261.6/f,.3)*ringF*(light?.35:1);
    const tau=(bass?.0016:low?.0009:.00045)*(1.25-.35*v),third=f<330?3:4,bl=st.bloom/5;
    const out=ac.createGain();out.gain.value=.32*v*(light?.7:1);
    const ch=typeof BAND!=='undefined'?BAND.chain(ac,T,id,v,t,light):null;if(ch){out.connect(ch.in);ch.out.connect(dest)}else out.connect(dest);
    const modes=light?[[1,1,1,0],[2.0015,.8,.75,0]]:[[1,1,1,0],[2.0015,.95,.75,.045*bl],[third*1.001,.5,.45,.02*bl],[2.73,.06,.25,0],[3.58,.04,.2,0],[5.02,.05,.18,0]];
    let end=t;
    for(const [mul,amp,dk,bloom] of modes){
      const fm=f*mul;if(fm>Math.min(16000,ac.sampleRate*.45))continue;
      const a=amp*mallet(fm,tau),dur=T60*dk*Math.pow(1/mul,.25);if(a<1e-4)continue;
      const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=fm;o.connect(g);g.connect(out);
      g.gain.setValueAtTime(0,t);
      if(bloom){g.gain.linearRampToValueAtTime(a*clamp(1-.65*bl,.2,1),t+.002);g.gain.setTargetAtTime(a,t+.002,bloom)}
      else g.gain.linearRampToValueAtTime(a,t+.002);
      g.gain.setTargetAtTime(0,t+.002+(bloom?bloom*2:0),dur/6.9);
      o.start(t);o.stop(t+dur+.05);end=Math.max(end,t+dur+.05)}
    if(!light){
      // the fundamental and octave pass energy back and forth: a slow, gentle swell
      const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=bass?1.6:3.1;lg.gain.value=.06*.32*v;lfo.connect(lg);lg.connect(out.gain);lfo.start(t);lfo.stop(end);
      // neighbours a fifth and an octave away ring along very softly
      for(const mul of [1.5,2]){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f*mul*1.0007;o.connect(g);g.connect(out);
        g.gain.setValueAtTime(0,t);g.gain.setTargetAtTime(.025,t,.12);g.gain.setTargetAtTime(0,t+.3,T60*1.3/6.9);o.start(t);o.stop(end)}
      // the barrel hums at its skirt's note
      const bh=typeof BAND!=='undefined'&&BAND.BODY?BAND.BODY[set]:0;
      if(bh&&st.hum>0){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=bh;o.connect(g);g.connect(out);
        g.gain.setValueAtTime(0,t);g.gain.setTargetAtTime(.05*st.hum/6*(bass?1.4:1),t,.03);g.gain.setTargetAtTime(0,t+.15,1.2/6.9);o.start(t);o.stop(Math.max(end,t+1.4))}}
    // the stick touching the steel: a tiny click
    const s=ac.createBufferSource(),ng=ac.createGain(),hp=ac.createBiquadFilter();s.buffer=noise(ac);hp.type='highpass';hp.frequency.value=bass?800:2000;
    s.connect(hp);hp.connect(ng);ng.connect(out);ng.gain.setValueAtTime(.08*v*(bass?.4:1),t);ng.gain.setTargetAtTime(0,t+.001,.0012);s.start(t);s.stop(t+.012);
  }
  function shimmer(ac,dest,id,t,v,light){play(ac,dest,id,t,v,light);if(typeof BAND!=='undefined'&&BAND.shimmerOn&&BAND.shimmerOn(light))play(ac,dest,id,t+.012,v*.5,light,9)}
  /* Play: your taps (inside strike, after How you play has set the hit's strength) */
  {const _sm=strikeMine;strikeMine=function(id,vel,light){if(S.panVoice!=='steel')return _sm.apply(this,arguments);const ac=panCtx();if(ac&&PITCH[id])shimmer(ac,pBus,id,ac.currentTime+.003,vel||1,light);return true}}
  /* Pan sounds: the third choice, and its two sliders */
  // a note to try it on: the lowest of the song's pan
  const first=()=>{const ids=SETS[setKey()].views.flatMap(v=>v.fields.map(f=>f[0]));return ids.sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b]))[Math.min(4,ids.length-1)]};
  function mount(){
    const seg=$('voiceSeg');if(!seg||seg.querySelector('[data-v=steel]'))return;
    const b=document.createElement('button');b.dataset.v='steel';b.textContent='Tuned steel';b.setAttribute('aria-pressed',String(S.panVoice==='steel'));
    const mine=seg.querySelector('[data-v=mine]');seg.insertBefore(b,mine);const bi=seg.querySelector('[data-v=synth]');if(bi)bi.textContent='Built-in';
    b.onclick=()=>{S.panVoice='steel';try{renderVoice()}catch{}try{save()}catch{}strike(first(),.9);render()};
    seg.addEventListener('click',()=>setTimeout(render,0));
    const box=document.createElement('div');box.id='steelBox';box.className='steelbox';seg.after(box);render();
    box.addEventListener('input',e=>{const k=e.target.dataset.steel;if(!k)return;st[k]=+e.target.value;keep();const o=e.target.closest('label').querySelector('output');if(o)o.textContent=e.target.value;
      clearTimeout(box._t);box._t=setTimeout(()=>strike(first(),.9),250)});
  }
  function render(){const box=$('steelBox');if(!box)return;const home=$('twSound');if(home&&home.firstElementChild!==box)home.prepend(box);   // top of Pan sounds → Soundconst on=S.panVoice==='steel';box.hidden=!on;if(!on)return;
    const sl=(k,label,sub)=>'<label class="steelsl"><span><b>'+label+'</b><small>'+sub+'</small></span><input type="range" min="0" max="10" step="1" data-steel="'+k+'" value="'+st[k]+'"><output>'+st[k]+'</output></label>';
    box.innerHTML='<h3>Tuned steel</h3><p class="help">Every note made from how a tuner tunes a pan: the note, its octave and its twelfth (or double octave), with the barrel humming along. Nothing to record. Band sound\'s Ring, Tone and Stick shape it too.</p>'
      +sl('hum','Barrel hum','The skirt ringing along (6 is a real pan)')+sl('bloom','Octave bloom','The "wah" just after you hit (5 is a real pan)')}
  {const _rv=renderVoice;renderVoice=function(){const r=_rv.apply(this,arguments);const seg=$('voiceSeg');if(seg){const b=seg.querySelector('[data-v=steel]');if(b)b.setAttribute('aria-pressed',String(S.panVoice==='steel'))}render();return r}}
  setTimeout(()=>{try{mount()}catch(e){console.warn('steel',e)}},0);
  {const c=document.createElement('style');c.textContent=`
.steelbox{margin:8px 0 4px}.steelbox[hidden]{display:none}
.steelsl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr) 26px;align-items:center;gap:10px;margin:10px 0}
.steelsl span{display:flex;flex-direction:column}.steelsl small{color:var(--muted);font-size:12px}
.steelsl input{width:100%;accent-color:var(--gold);min-height:32px}.steelsl output{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}`;document.head.appendChild(c)}
  return {play:shimmer,one:play,get s(){return st},set(k,v){st[k]=v;keep();render()},mount};
})();
