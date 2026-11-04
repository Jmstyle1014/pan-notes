/* ---------- Four cello from the guitar (as Panyard VR's "From guitar") ----------
   The band's four cello recordings were measured in VR: many of them ring mostly an octave below (the drum booming into the
   mic) or above, so the four cello sounded like a bass. With this on (the default), every four cello note plays the closest
   of your Double Guitar recordings instead, retuned to the right note (the guitar's C♯3–G♯4 sits right in the four cello's
   B♭2–C♯5), through Panyard's own borrowing (`borrowOf`, `TW.skip`), so Play, Studio, My part and their Band sound all
   follow. Off: your four cello recordings again. Only with your recorded sounds, and only while the phone has guitar
   recordings. Per phone (localStorage 'panyard-fcguitar', '0' = off). */
var FCG=(()=>{
  const K='panyard-fcguitar',MAX=15;let on=true;try{on=localStorage.getItem(K)!=='0'}catch{}
  function src(id){
    if(!on||S.panVoice!=='mine')return null;const f=FIELDS.get(id);if(!f||f.set!=='fcello'||!PITCH[id])return null;
    const m=midiOf(PITCH[id]);let best=null;
    for(const s of Object.keys(SAMPLES.wav)){const g=FIELDS.get(s);if(!g||g.set!=='guitar'||!PITCH[s])continue;
      const d=m-midiOf(PITCH[s]),cost=Math.abs(d)+(d>0?.1:0);if(!best||cost<best.cost)best={src:s,st:d,cost}}
    return best&&Math.abs(best.st)<=MAX?{src:best.src,st:best.st,cents:best.st*100}:null}
  {const _b=borrowOf;borrowOf=function(id){return src(id)||_b(id)}}
  // a four cello note you recorded counts as "use another recording" while this is on, so every player takes the guitar's
  if(typeof TW!=='undefined'&&TW.skip){const _s=TW.skip;TW.skip=function(id){return !!src(id)||_s.apply(this,arguments)}}
  function set(v){on=!!v;try{localStorage.setItem(K,on?'1':'0')}catch{}try{SAMPLES.warm=false}catch{}try{STUDIO.refresh()}catch{}}
  /* the switch in Settings, under How you play */
  {const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();try{
      const list=$('setList');if(!list||list.querySelector('[data-row=fcguitar]'))return;
      const at=list.querySelector('[data-row=phone]')||list.querySelector('[data-row=feel]')||list.querySelector('[data-row=play]');if(!at)return;
      const r=document.createElement('button');r.className='sxrow';r.dataset.row='fcguitar';r.setAttribute('role','switch');r.setAttribute('aria-checked',String(on));
      r.innerHTML='<span class="sxic" style="background:#f6ba45" aria-hidden="true">🎸</span><span class="sxlab"><b>Four cello from the guitar</b><small>The four cello plays your Double Guitar recordings, retuned, as in Panyard VR. Off: your own four cello recordings.</small></span><span class="sxtog'+(on?' on':'')+'" aria-hidden="true"><i></i></span>';
      r.onclick=e=>{e.stopPropagation();set(!on);SETUP.render();say(on?'Four cello: from your guitar recordings, retuned.':'Four cello: your own four cello recordings.')};
      at.parentNode.insertBefore(r,at.nextSibling)}catch(e){console.warn(e)}}}
  return {get on(){return on},set,src};
})();
