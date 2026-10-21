
/* ---------- how you play: dynamics (softer near a note's edge), when a held note starts to roll, and keeping the sound awake ----------
   Dynamics: a hit in the middle of a note is a full one, nearer the edge a softer and darker one, like a real pan
   (and like the drum pads in Studio). A bigger finger contact counts as a harder hit on phones that report it.
   Sensitivity 0 is off: every hit is full. These belong to this phone (localStorage 'panyard-feel', not backed up). */
var FEEL=(()=>{
  const K='panyard-feel',D0={sens:5,roll:170,awake:true};
  let s={...D0};try{Object.assign(s,JSON.parse(localStorage.getItem(K)||'{}'))}catch{}
  s.sens=Math.max(0,Math.min(10,Math.round(+s.sens||0)));s.roll=Math.max(100,Math.min(300,Math.round(+s.roll||D0.roll)));s.awake=s.awake!==false;
  const save=()=>{try{localStorage.setItem(K,JSON.stringify(s))}catch{}};
  HOLD_MS=s.roll;
  let avgA=0;   // the usual size of a finger's contact, so only a bigger-than-usual one counts as harder
  function vel(e,el){
    if(!s.sens||!e||!el||!el.getBoundingClientRect)return 1;
    const r=el.getBoundingClientRect();if(!r.width||!r.height)return 1;
    const dx=(e.clientX-(r.left+r.width/2))/(r.width/2),dy=(e.clientY-(r.top+r.height/2))/(r.height/2);
    let hit=0.25+0.75*(1-Math.pow(Math.min(1,Math.hypot(dx,dy)),1.6));   // 1 in the middle, 0.25 at the edge
    if(e.pointerType==='touch'&&e.width>1&&e.height>1){const a=e.width*e.height;
      if(avgA)hit+=Math.max(-0.3,Math.min(0.3,(a/avgA-1)*0.5));avgA=avgA?avgA*0.85+a*0.15:a}
    hit=Math.max(0,Math.min(1,hit));
    return +Math.max(0.15,1-(s.sens/10)*0.8*(1-hit)).toFixed(3);
  }
  // a tap on any pan note sets how hard this hit is; a held note's roll keeps it
  const held=new Map();let live=null;
  window.addEventListener('pointerdown',e=>{const el=e.target.closest&&e.target.closest('.field');if(!el||!el.dataset.field)return;
    live={id:el.dataset.field,v:vel(e,el)};held.set(e.pointerId,live);setTimeout(()=>{live=null},0)},true);
  const up=e=>held.delete(e.pointerId);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',up,true);
  function now(id,light){if(live&&live.id===id)return live.v;if(light)for(const h of held.values())if(h.id===id)return h.v;return 1}
  // the tap sound everywhere (Play, Write, the tuning pan, the game) goes through strike()
  const _strike=strike;strike=function(id,v,light){return _strike(id,(v||1)*now(id,light),light)};

  /* Keep the sound awake: many phones (and most Bluetooth speakers and earbuds) switch their sound off after a quiet
     moment and switch it back on with a small tick when the next note comes. A 20 Hz hum far too quiet to hear
     keeps them on while the app is open. */
  let hum=null;
  function wake(){
    const ac=pac;if(!ac)return;const on=s.awake&&!document.hidden;
    if(on&&!hum){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=20;g.gain.value=0;g.gain.setTargetAtTime(0.0018,ac.currentTime,0.3);o.connect(g);g.connect(ac.destination);o.start();hum={o,g}}
    else if(!on&&hum){const h=hum;hum=null;try{h.g.gain.setTargetAtTime(0,ac.currentTime,0.05);h.o.stop(ac.currentTime+0.4)}catch{}}
  }
  const _pc=panCtx;panCtx=function(){const had=!!pac,a=_pc.apply(this,arguments);if(a&&!had)setTimeout(wake,0);return a};
  document.addEventListener('visibilitychange',wake);

  function set(k,v){s[k]=v;save();if(k==='roll')HOLD_MS=v;if(k==='awake')wake()}
  const sensName=v=>!v?'Off':v<=3?'A little':v<=6?'Some':v<=8?'A lot':'Very';
  // the "How you play" card in Pan sounds → Sound
  function card(){
    return '<section class="bandbox" id="feelBox"><div class="twsh"><h3>How you play</h3><p>These belong to this phone.</p></div>'
      +'<div class="sl"><label for="feelSens">Dynamics<small>hit the middle of a note for a full sound, nearer the edge for a softer one</small></label><input type="range" id="feelSens" min="0" max="10" step="1" value="'+s.sens+'"><output id="feelSensO">'+sensName(s.sens)+'</output><div class="ends"><span>every hit the same</span><span>very sensitive</span></div></div>'
      +'<div class="sl"><label for="feelRoll">Roll starts<small>how long you hold a note before it rolls</small></label><input type="range" id="feelRoll" min="100" max="300" step="10" value="'+s.roll+'"><output id="feelRollO">'+(s.roll/1000).toFixed(2)+' s</output><div class="ends"><span>sooner</span><span>later</span></div></div>'
      +'<div class="tog"><span><b>Keep the sound awake</b><small>stops the little tick some phones and Bluetooth speakers make when a note comes after a quiet moment</small></span><button class="sw" role="switch" id="feelAwake" aria-checked="'+s.awake+'" aria-label="Keep the sound awake"></button></div>'
      +'</section>';
  }
  function wire(box){
    box.querySelector('#feelSens').oninput=e=>{set('sens',+e.target.value);$('feelSensO').textContent=sensName(s.sens)};
    box.querySelector('#feelRoll').oninput=e=>{set('roll',+e.target.value);$('feelRollO').textContent=(s.roll/1000).toFixed(2)+' s'};
    box.querySelector('#feelAwake').onclick=e=>{set('awake',!s.awake);e.currentTarget.setAttribute('aria-checked',String(s.awake));
      say(s.awake?'The sound stays awake while the app is open.':'The sound can sleep when nothing plays.')};
  }
  return {vel,now,card,wire,wake,get s(){return {...s}},set,get awake(){return !!hum}};
})();
