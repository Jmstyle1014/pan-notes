
/* ---------- no recording yet? ▶ plays your part ----------
   A song with notes but no recording: the play button makes "Your part" (every note you've written, played on your
   own pan recordings, or the built-in tone where there's none) and plays it like a recording, so the notes fall,
   the pans light up, and loops, speed and the game all work. It is never kept as the song's recording: nothing is
   saved, uploaded or backed up, Studio and Tuning don't use it, and choosing a real recording replaces it.
   Change a note and the next ▶ makes it again. */
var MYPART=(()=>{
  const NAME='Your part';
  const on=()=>hasAudio&&curName===NAME;
  const can=()=>!hasAudio&&!isDemo&&S.cues.some(c=>c.steps&&c.steps.length);
  const sig=()=>JSON.stringify(S.cues.map(c=>[c.start,c.duration,c.steps,c.mode,c.fx]))+'|'+REF_A()+'|'+Object.keys(SAMPLES.wav).length;
  let made='',busy=false;
  // the play bar when there's no recording
  function ui(){
    // a song with no notes yet has nothing to fall: the lanes step aside and the pans move up
    document.body.classList.toggle('nolanes',!isDemo&&!S.cues.some(c=>c.steps&&c.steps.length));
    if(hasAudio)return;const ok=can();$('playBtn').disabled=!ok;
    $('recName').textContent=ok?NAME+' · tap ▶ to hear it':'No recording';
  }
  // every note, played on your recordings, into a sound file
  async function render(){
    const ev=BARS.events();if(!ev.length)return null;const sr=44100,end=Math.min(1200,ev.reduce((m,e)=>Math.max(m,e.t+e.d),0)+3);
    const oc=new OfflineAudioContext(1,Math.ceil(sr*end),sr),out=oc.createGain(),cp=oc.createDynamicsCompressor();
    out.gain.value=0.55;cp.threshold.value=-10;cp.ratio.value=4;out.connect(cp);cp.connect(oc.destination);
    const one=(id,t,v,light)=>{
      let src=id,sh=0;if(S.panVoice==='mine'&&(!SAMPLES.wav[id]||(typeof TW!=='undefined'&&TW.skip(id)))){const bw=typeof borrowOf==='function'&&borrowOf(id);if(bw){src=bw.src;sh=bw.cents}else src=null}
      const b=S.panVoice==='mine'&&src?SAMPLES.buf[src]:null;
      if(b){const T=BAND.tune(tuneOf(src)),e2=Math.min(b.duration,T.end??b.duration),st=Math.min(T.start,e2-.05),len=(e2-st)/Math.pow(2,sh/1200);
        const s=oc.createBufferSource(),g=oc.createGain();s.buffer=b;s.detune.value=(T.cents||0)+refCents()+sh+BAND.cents(id);
        const tn=toneNode(oc,T,id);if(tn){s.connect(tn);tn.connect(g)}else s.connect(g);g.connect(out);
        const a=v*Math.pow(10,(T.db||0)/20)*(light?.7:1);
        if(light){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+.004);const e=Math.min(len,.45);g.gain.setValueAtTime(a,t+.12);g.gain.linearRampToValueAtTime(0,t+e);s.start(t,st);s.stop(t+e+.01)}
        else{noteEnvelope(g.gain,a,t,len,T.fade,T);s.start(t,st);s.stop(t+len+.01)}
        return}
      // no recording for this note: the built-in tone
      const f=pitchHz(id);if(!f)return;const ring=(light?.7:1.7)*Math.pow(261.6/f,.35);
      for(const [mul,amp,dk] of [[1,1,1],[2,.55,.6],[3.003,.18,.35]]){const o=oc.createOscillator(),g=oc.createGain(),a=amp*v*.3,e=t+ring*dk;
        o.frequency.value=f*mul;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(a,t+.004);g.gain.exponentialRampToValueAtTime(.0001,e);o.connect(g);g.connect(out);o.start(t);o.stop(e+.02)}
    };
    // your recordings first (the ones this part needs)
    if(S.panVoice==='mine')for(const id of new Set(ev.map(e=>e.p))){const s=SAMPLES.wav[id]?id:(typeof borrowOf==='function'&&(borrowOf(id)||{}).src);if(s&&!SAMPLES.buf[s])await sampleBuf(s)}
    for(const e of ev){
      if(e.fx==='roll'){one(e.p,e.t,.95,false);for(let x=.07,k=0;x<e.d-.03;x+=.072,k++)one(e.p,e.t+x,.55+((k*37)%11)/50,true)}
      else one(e.p,e.t,.95,false)}
    const buf=await oc.startRendering();
    return encodeWav(buf.getChannelData(0),sr);
  }
  async function make(){
    if(busy)return false;busy=true;const was=on()?audio.currentTime:0;
    try{say('Getting your part ready…');const blob=await render();if(!blob){say('Write some notes first, then ▶ plays them.');return false}
      loadAudio(blob,NAME);made=sig();
      await new Promise(r=>{if(audio.readyState>=1)r();else{audio.addEventListener('loadedmetadata',r,{once:true});setTimeout(r,3000)}});
      if(was)try{audio.currentTime=was}catch{}
      return true}
    catch(e){console.warn(e);say('Your part couldn\'t be made. Try again.');return false}
    finally{busy=false}
  }
  // ▶ with no recording (or with your part, after you changed a note): make it, then play as usual
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#playBtn');if(!b)return;
    const stale=on()&&audio.paused&&made!==sig();if(!(can()||stale))return;
    e.stopImmediatePropagation();e.preventDefault();make().then(ok=>{if(ok)$('playBtn').click()})},true);
  // the play bar and the loop pill follow whether there's anything to play
  for(const f of['renderAll','unloadAudio','renderCues'])try{const _f=window[f];if(typeof _f==='function')window[f]=function(){const r=_f.apply(this,arguments);try{ui()}catch{}return r}}catch{}
  {const _rl=renderLoop;renderLoop=function(){_rl();const p=$('loopPill');if(p&&!hasAudio)p.hidden=true}}
  // it is not the song's recording: the song list, Settings and the checklist still say there's none
  {const _st=songTouch;songTouch=function(){_st();if(on()){const s=songNow();if(s){s.rec=false;songsSave()}}}}
  {const _v=SETUP.val.bind(SETUP);SETUP.val=function(k){return k==='rec'&&on()?'None yet':_v(k)}}
  {const st=document.createElement('style');st.textContent='html body.nolanes #view-play #lanes{display:none!important}';document.head.appendChild(st)}
  setTimeout(()=>{try{ui()}catch{}},0);
  return {on,can,make,ui,NAME};
})();
