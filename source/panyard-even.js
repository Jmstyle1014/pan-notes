/* ---------- Even out my pan, and Clean the rumble ----------
   Even out (Pan sounds → Sound, for the song's pan): each recorded note is measured (the first 0.3 s from where it starts:
   its octave and its sparkle above 3.6× the note, both against the note itself) and nudged 60% of the way toward the
   notes round it (within 4 semitones, past a 2 dB allowance): the sparkle by the note's own Tone (a shelf, 0.9 dB a step), the octave by T.oct (a narrow lift or
   dip at 2×, in BAND.chain). The recording itself isn't changed; ↶ Undo puts each note's Tone and octave back (localStorage
   'panyard-even', per pan). Panyard Band does it once for the band's tenor (each time the band's sounds change).
   Clean the rumble (Settings, localStorage 'panyard-clean' {set: true}): three 170 Hz high-passes on recordings of that pan
   (BAND.chain), for the room and handling rumble a phone picks up. A tenor's skirt hums higher (~265 Hz), so that stays.
   The tenor's recordings had ~20 dB more under 200 Hz than a studio pan. The double tenor plays the tenor's recordings,
   so it follows the tenor's switch. */
var EVENOUT=(()=>{
  const K='panyard-even',KC='panyard-clean',KB='panyard-even-band';
  const get=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')||{}}catch{return {}}},put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  let undo=get(K),cl=get(KC);
  const setOf=id=>/^(\w+):/.test(id)?id.split(':')[0]:'guitar';
  const clean=set=>!!(set&&(cl[set]||(set==='dten'&&cl.tenor)));
  // energy near a frequency (Goertzel over a Hann window, the strongest within ±2%, as pans' overtones sit a hair off)
  function near(d,sr,f){let best=0;for(let k=-4;k<=4;k++){const fq=f*(1+k*0.005);if(fq>=sr/2)continue;const w=2*Math.cos(2*Math.PI*fq/sr);let s1=0,s2=0;const n=d.length;
      for(let i=0;i<n;i++){const s0=d[i]*(0.5-0.5*Math.cos(2*Math.PI*i/(n-1)))+w*s1-s2;s2=s1;s1=s0}const p=s1*s1+s2*s2-w*s1*s2;if(p>best)best=p}return best+1e-12}
  // energy above a frequency: the window through a 4th-order high-pass
  function above(d,sr,f){if(f>=sr/2.2)return 1e-12;const w0=2*Math.PI*f/sr,al=Math.sin(w0)/(2*0.707),c=Math.cos(w0),a0=1+al,b0=(1+c)/2/a0,b1=-(1+c)/a0,b2=b0,a1=-2*c/a0,a2=(1-al)/a0;
    let x=Float32Array.from(d);for(let p=0;p<2;p++){const y=new Float32Array(x.length);let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<x.length;i++){const v=b0*x[i]+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=x[i];y2=y1;y1=v;y[i]=v}x=y}
    let e=0;for(let i=0;i<x.length;i++){const h=0.5-0.5*Math.cos(2*Math.PI*i/(x.length-1));e+=(x[i]*h)*(x[i]*h)}return e*x.length/4+1e-12}
  function measure(b,T,f){const sr=b.sampleRate,d0=b.getChannelData(0),st=Math.max(0,Math.round((+T.start||0)*sr));
    let a=st,pk=0;for(let i=st;i<Math.min(d0.length,st+sr);i++)pk=Math.max(pk,Math.abs(d0[i]));for(let i=st;i<d0.length;i++)if(Math.abs(d0[i])>pk*0.05){a=i;break}
    const d=d0.subarray(a,Math.min(d0.length,a+Math.round(0.3*sr)));if(d.length<sr*0.1)return null;
    const h1=near(d,sr,f),db=x=>10*Math.log10(x);return {oct:db(near(d,sr,2*f)/h1),top:db(above(d,sr,3.6*f)/h1)}}
  const med=a=>{const s=a.slice().sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
  const cl2=(x,a,b)=>Math.max(a,Math.min(b,x));
  async function run(set,quiet){
    const ids=Object.keys(SAMPLES.wav).filter(id=>setOf(id)===set&&PITCH[id]);if(ids.length<4){if(!quiet)say('Record at least four notes of this pan first.');return 0}
    const m={};for(const id of ids){const b=SAMPLES.buf[id]||await sampleBuf(id);if(!b)continue;try{const r=measure(b,tuneOf(id),pitchHz(id));if(r)m[id]=r}catch(e){console.warn('even',id,e)}await new Promise(r=>setTimeout(r,0))}
    const got=Object.keys(m);if(got.length<4)return 0;
    // each note against its neighbours (within 4 semitones): low notes are naturally duller than high ones, so a note is
    // only nudged when it stands out from the notes round it, and differences under 2 dB are left as they are
    const mi=id=>midiOf(PITCH[id]),hood=id=>got.filter(j=>j!==id&&Math.abs(mi(j)-mi(id))<=4),dz=x=>Math.abs(x)<2?0:x-Math.sign(x)*2;
    const was=undo[set]||{};let n=0;
    for(const id of got){const T=tuneOf(id),h=hood(id);if(!(id in was))was[id]={tone:+T.tone||0,oct:+T.oct||0};if(h.length<2)continue;
      const mo=med(h.map(j=>m[j].oct)),mt=med(h.map(j=>m[j].top));
      const oct=Math.round(cl2(dz(mo-m[id].oct)*0.6,-8,8)*2)/2,tone=Math.round(cl2(dz(mt-m[id].top)*0.6/0.9,-6,6));
      if(oct||tone)n++;T.oct=oct;T.tone=tone;if(!T.oct)delete T.oct;SAMPLES.tune[id]=T}
    undo[set]=was;put(K,undo);saveTune();ui();
    if(!quiet)say(n?'Evened out: '+n+' of '+got.length+' notes nudged toward the rest of your '+(SETS[set]?SETS[set].name:set)+'.':'Your '+(SETS[set]?SETS[set].name:set)+' is already even.');
    VR_.last={set,n,of:got.length,m};return n}
  const VR_={};
  function back(set){const was=undo[set];if(!was)return;for(const [id,o] of Object.entries(was)){const T=tuneOf(id);T.tone=o.tone;if(o.oct)T.oct=o.oct;else delete T.oct;SAMPLES.tune[id]=T}
    delete undo[set];put(K,undo);saveTune();ui();say('Back to how your notes were.')}
  function setClean(set,on){cl[set]=!!on;if(!on)delete cl[set];put(KC,cl);try{SETUP.render()}catch{}}
  /* Pan sounds → Sound: Even out the song's pan (your recorded sounds) */
  function ui(){const home=$('twSound');if(!home)return;let box=$('evenBox');
    if(!box){box=document.createElement('div');box.id='evenBox';box.className='evenbox';const sb=$('steelBox');if(sb)sb.after(box);else home.prepend(box);
      box.addEventListener('click',async e=>{const b=e.target.closest('[data-even]');if(!b)return;const k=setKey();
        if(b.dataset.even==='undo'){back(k);return}b.disabled=true;b.textContent='Listening to your notes…';try{await run(k)}finally{ui()}})}
    const k=setKey(),name=SETS[k]?SETS[k].name:k,has=Object.keys(SAMPLES.wav).filter(id=>setOf(id)===k).length;
    box.hidden=typeof BANDAPP!=='undefined'||S.panVoice!=='mine'||has<4;if(box.hidden)return;
    box.innerHTML='<h3>Even out my '+esc(name)+'</h3><p class="help">Listens to each note you recorded and gently brings any note that\'s much brighter, duller or more "octave-y" than the rest in line with them. Your recordings aren\'t changed: each note\'s Tone and octave are set, and Undo puts them back.</p>'
      +'<div class="steelfit"><button class="btn" data-even="run">⚖ Even out my '+esc(name)+'</button>'+(undo[k]?'<button class="btn sm" data-even="undo">↶ Undo</button>':'')+'</div>'}
  /* Settings: Clean the rumble, for the tenor (under On the phone speaker) */
  {const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();try{
      const list=$('setList');if(!list||list.querySelector('[data-row=clean]'))return;
      const at=list.querySelector('[data-row=phone]')||list.querySelector('[data-row=feel]');if(!at)return;const on=!!cl.tenor;
      const r=document.createElement('button');r.className='sxrow';r.dataset.row='clean';r.setAttribute('role','switch');r.setAttribute('aria-checked',String(on));
      r.innerHTML='<span class="sxic" style="background:#b8e0c8" aria-hidden="true">🧹</span><span class="sxlab"><b>Clean the rumble</b><small>Takes the low room and handling rumble out from under your tenor\'s notes. Its skirt\'s hum stays.</small></span><span class="sxtog'+(on?' on':'')+'" aria-hidden="true"><i></i></span>';
      r.onclick=e=>{e.stopPropagation();setClean('tenor',!cl.tenor);SETUP.render();say(cl.tenor?'The tenor’s rumble is cleaned out.':'The tenor plays its recordings as they are.');try{strike(SETS.tenor.views[0].fields[0][0],.9)}catch{}};
      at.parentNode.insertBefore(r,at.nextSibling)}catch(e){console.warn(e)}}}
  // Pan sounds: show the box with the Sound tab, and when the pan or voice changes
  if(typeof renderVoice==='function'){const _rv=renderVoice;renderVoice=function(){const r=_rv.apply(this,arguments);try{ui()}catch{}return r}}
  {const _p=applyPanSet;applyPanSet=function(){const r=_p.apply(this,arguments);try{ui()}catch{}return r}}
  setTimeout(()=>{try{ui()}catch{}},0);
  // Panyard Band: even out the band's tenor once, each time the band's sounds change (a band member has no Pan sounds)
  {let tries=0;const band=async()=>{if(typeof BANDAPP==='undefined')return;let v='';try{v=localStorage.getItem('panyard-bandsounds')||''}catch{}
      if(!v||Object.keys(SAMPLES.wav).filter(id=>setOf(id)==='tenor').length<4){if(++tries<60)setTimeout(band,3000);return}
      if(localStorage.getItem(KB)===v)return;try{if(await run('tenor',true))console.log('band tenor evened')}catch(e){console.warn(e)}try{localStorage.setItem(KB,v)}catch{}};
    const go=()=>setTimeout(band,4000);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go()}
  {const c=document.createElement('style');c.textContent='.evenbox{margin:8px 0 12px}.evenbox[hidden]{display:none}';document.head.appendChild(c)}
  return {run,back,clean,setClean,measure,ui,get undo(){return undo},get last(){return VR_.last}};
})();
