
/* ---------- Mix: the song's recording against your pans, in Play ----------
   🎚 on the play bar opens a little mixer: Recording (the song's recording, 0–100%), Your pans (the notes you tap and
   your written part's pans, 0–200%; the limiter keeps it from clipping) and whether you hear your pans while the
   song plays (the same as Settings → Play along → Pan sounds: Always, or When paused). Each song keeps its own mix
   (localStorage 'panyard-mix', songs[songId] = {rec, pan}). */
var MIX=(()=>{
  const K='panyard-mix',D={rec:100,pan:100};
  let st={songs:{}};try{const x=JSON.parse(localStorage.getItem(K)||'null');if(x&&x.songs&&typeof x.songs==='object')st.songs=x.songs}catch{}
  const keep=()=>{try{localStorage.setItem(K,JSON.stringify(st))}catch{}};
  const sid=()=>{try{return isDemo?'demo':songNow().id}catch{return 'demo'}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const get=()=>{const m=st.songs[sid()]||{};return {rec:clamp(Number.isFinite(+m.rec)?+m.rec:D.rec,0,100),pan:clamp(Number.isFinite(+m.pan)?+m.pan:D.pan,0,200)}};
  // the pans' bus starts at its own level (headroom), and Your pans scales that
  function apply(){const m=get();
    try{audio.volume=m.rec/100}catch{}
    if(typeof pBus!=='undefined'&&pBus){if(pBus._base==null)pBus._base=pBus.gain.value;const v=pBus._base*m.pan/100;if(Math.abs(pBus.gain.value-v)>1e-4)pBus.gain.value=v}}
  function set(k,v){const m=get();m[k]=v;st.songs[sid()]=m;keep();apply()}
  {const _p=panCtx;panCtx=function(){const r=_p.apply(this,arguments);apply();return r}}
  ['loadedmetadata','play'].forEach(e=>audio.addEventListener(e,apply));
  const over=()=>S.tapSound==='always';
  function setOver(on){S.tapSound=on?'always':'paused';try{renderSound()}catch{}save()}
  /* the button and the mixer */
  const pct=v=>Math.round(v)+'%';
  function render(){const m=get(),box=$('mixBox');if(!box)return;
    box.innerHTML='<div class="mix-hd"><b>Mix</b><button class="mix-x" data-mx="close" aria-label="Close the mixer">✕</button></div>'
      +'<label class="mix-row"><span>🎵 Recording <b id="mixRecV">'+pct(m.rec)+'</b></span><input type="range" id="mixRec" min="0" max="100" step="1" value="'+m.rec+'" aria-label="Recording volume"></label>'
      +'<label class="mix-row"><span>🥁 Your pans <b id="mixPanV">'+pct(m.pan)+'</b></span><input type="range" id="mixPan" min="0" max="200" step="5" value="'+m.pan+'" aria-label="Your pans volume"></label>'
      +'<button class="mix-sw" data-mx="over" role="switch" aria-checked="'+over()+'"><span><b>Hear my pans while the song plays</b><small>'+(over()?'On: your taps sound over the recording.':'Off: your taps only sound while the song is stopped.')+'</small></span><span class="sxtog'+(over()?' on':'')+'" aria-hidden="true"><i></i></span></button>'
      +'<button class="mix-reset" data-mx="reset">Back to even (100% / 100%)</button>';
    $('mixRec').oninput=e=>{set('rec',+e.target.value);$('mixRecV').textContent=pct(+e.target.value)};
    $('mixPan').oninput=e=>{set('pan',+e.target.value);$('mixPanV').textContent=pct(+e.target.value)};
  }
  function open(on){const box=$('mixBox');if(!box)return;box.hidden=!on;$('mixBtn').setAttribute('aria-expanded',String(on));if(on)render()}
  function mount(){
    if($('mixBtn'))return;const tr=document.querySelector('#dock .transport');if(!tr)return;
    const b=document.createElement('button');b.id='mixBtn';b.className='mixbtn';b.setAttribute('aria-label','Mix: recording and pans volume');b.setAttribute('aria-expanded','false');b.textContent='🎚';
    const lp=$('loopPill');tr.insertBefore(b,lp&&lp.parentNode===tr?lp:null);
    const box=document.createElement('div');box.id='mixBox';box.className='mixbox';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-label','Mix');
    $('dock').appendChild(box);
    b.onclick=e=>{e.stopPropagation();open(box.hidden)};
    box.addEventListener('click',e=>{e.stopPropagation();const x=e.target.closest('[data-mx]');if(!x)return;const k=x.dataset.mx;
      if(k==='close')open(false);
      else if(k==='over'){setOver(!over());render();say(over()?'You’ll hear your pans over the song.':'Your pans only sound while the song is stopped.')}
      else if(k==='reset'){st.songs[sid()]={...D};keep();apply();render()}});
    document.addEventListener('click',e=>{if(!box.hidden&&!box.contains(e.target)&&e.target!==b)open(false)});
  }
  mount();
  {const _sv=showView;showView=function(){open(false);return _sv.apply(this,arguments)}}
  {const c=document.createElement('style');c.textContent=`
.mixbtn{flex:none;width:40px;height:40px;border-radius:50%;border:1px solid rgb(255 255 255/.16);background:rgb(255 255 255/.06);color:inherit;font-size:19px;line-height:1;display:grid;place-items:center;margin-left:6px;padding:0}
.mixbtn[aria-expanded=true]{background:var(--gold);border-color:var(--gold)}
.mixbox{position:absolute;left:12px;right:12px;bottom:calc(100% + 8px);z-index:60;background:var(--raised,#1d1638);border:1px solid rgb(255 255 255/.14);border-radius:18px;padding:12px 14px 14px;box-shadow:0 14px 36px rgb(0 0 0/.5);max-width:460px;margin:0 auto}
.mixbox[hidden]{display:none}
.mix-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}.mix-hd b{font-size:17px}
.mix-x{width:40px;height:40px;border:0;background:none;color:inherit;font-size:18px;border-radius:50%}
.mix-row{display:block;margin:10px 0}.mix-row span{display:flex;justify-content:space-between;font-size:15px;margin-bottom:6px}.mix-row input{width:100%;min-height:32px}
.mix-sw{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:0;color:inherit;padding:8px 0;min-height:48px}
.mix-sw>span:first-child{flex:1}.mix-sw small{display:block;opacity:.75;font-size:13px;margin-top:2px}
.mix-reset{width:100%;min-height:44px;margin-top:6px;border-radius:12px;border:1px solid rgb(255 255 255/.16);background:rgb(255 255 255/.06);color:inherit;font-size:14px}`;document.head.appendChild(c)}
  return {get,set,apply,open,over,setOver};
})();
