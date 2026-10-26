
/* ---------- On the phone speaker: clearer basses on a phone's own little speaker ----------
   A phone speaker plays almost nothing under about 150 Hz, so most of a bass pan's note is lost on it. With this on,
   bass and cello notes get their overtones (2×, 3× the note) brought out, which the speaker can play and the ear hears
   as the low note ("the missing fundamental"); the deep part the speaker can't play is trimmed so it doesn't waste loudness.
   Only the bass pans (six, seven, the cellos), in Play's tap sound and Studio's bass tracks. Per phone, not backed up
   (localStorage 'panyard-phone'). */
var PHONE=(()=>{
  const K='panyard-phone',BASS=new Set(['six','seven','fcello','tcello']);
  let on=false;try{on=localStorage.getItem(K)==='1'}catch{}
  // the overtone maker: |x| gives the octave, tanh the twelfth; DC and the original low note are filtered out after
  let curve=null;
  const mkCurve=()=>{if(curve)return curve;const n=2048;curve=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;curve[i]=.45*Math.tanh(2.2*x)+.75*Math.abs(x)}return curve};
  function make(ac){
    const f=(ty,fr,q)=>{const b=ac.createBiquadFilter();b.type=ty;b.frequency.value=fr;b.Q.value=q||.707;return b};
    const inp=ac.createGain(),out=ac.createGain(),cut=f('highpass',80),cut2=f('highpass',80),
      l1=f('lowpass',160),l2=f('lowpass',160),drv=ac.createGain(),ws=ac.createWaveShaper(),h1=f('highpass',150),h2=f('highpass',150),top=f('lowpass',1100),amt=ac.createGain();
    drv.gain.value=2.5;ws.curve=mkCurve();ws.oversample='2x';amt.gain.value=.85;
    inp.connect(cut);cut.connect(cut2);cut2.connect(out);
    inp.connect(l1);l1.connect(l2);l2.connect(drv);drv.connect(ws);ws.connect(h1);h1.connect(h2);h2.connect(top);top.connect(amt);amt.connect(out);
    return {in:inp,out};
  }
  const bassSet=k=>BASS.has(k);
  /* Play: between the sound profile's low cut and the rest of its chain, while the song's pan is a bass */
  let tap=null,tapOn=false;
  function sync(){
    try{if(typeof FX==='undefined'||!FX.ac||!FX.hp||!FX.shelf)return;
      const want=on&&bassSet(setKey());if(want===tapOn)return;
      if(!tap)tap=make(FX.ac);
      try{FX.hp.disconnect()}catch{}try{tap.out.disconnect()}catch{}
      if(want){FX.hp.connect(tap.in);tap.out.connect(FX.shelf)}else FX.hp.connect(FX.shelf);
      tapOn=want}catch(e){console.warn('phone',e)}
  }
  function set(v){on=!!v;try{localStorage.setItem(K,on?'1':'0')}catch{}sync();try{STUDIO.refresh()}catch{}}
  {const _a=applyFx;applyFx=function(){const r=_a.apply(this,arguments);sync();return r}}
  {const _p=applyPanSet;applyPanSet=function(){const r=_p.apply(this,arguments);sync();return r}}
  /* the switch in Settings, under How you play */
  {const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();try{
      const list=$('setList');if(!list||list.querySelector('[data-row=phone]'))return;
      const at=list.querySelector('[data-row=feel]')||list.querySelector('[data-row=play]');if(!at)return;
      const r=document.createElement('button');r.className='sxrow';r.dataset.row='phone';r.setAttribute('role','switch');r.setAttribute('aria-checked',String(on));
      r.innerHTML='<span class="sxic" style="background:#9fd3ff" aria-hidden="true">📱</span><span class="sxlab"><b>On the phone speaker</b><small>Clearer basses on your phone\'s own speaker. Turn off for earbuds or a speaker.</small></span><span class="sxtog'+(on?' on':'')+'" aria-hidden="true"><i></i></span>';
      r.onclick=e=>{e.stopPropagation();set(!on);SETUP.render();say(on?'On the phone speaker: the basses\' overtones come through so you can hear them.':'Off: the full, deep bass, for earbuds or a speaker.')};
      at.parentNode.insertBefore(r,at.nextSibling)}catch(e){console.warn(e)}}}
  return {get on(){return on},set,sync,make,bassSet,BASS};
})();
