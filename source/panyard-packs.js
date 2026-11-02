/* ---------- Studio sound packs: a library's recorded pans, a few loudness layers per note ----------
   A pack (packs/<name>/, made by make_sound_pack.py, served at /pan-notes/packs/) is one pan set's notes, each recorded
   soft to hard (pack.json: files[id] soft→hard, tune[id].cents to A 440, credit, licence). With a pack on for a pan,
   Play's taps and Studio's tracks for that pan play the layer for how hard the note is hit, tuned to the song's A, with
   the song's band sound on top; your own recordings of that pan stay on the phone and come back when it's off.
   Settings has a switch per pack, with its credit. Kept per phone (localStorage 'panyard-packs', not backed up).
   The study tenor (SASS-E) is CC BY-NC: non-commercial only, so take it out (PACKS.LIST) before charging. */
var PACKS=(()=>{
  const LIST={dsec:{dir:'dunleavy-dsec',def:true,short:'Dunleavy studio double seconds'},
              tenor:{dir:'sasse-tenor',def:false,short:'Study tenor (SASS-E)'}};
  const K='panyard-packs',BASE='../packs/';
  let pick0={};try{pick0=JSON.parse(localStorage.getItem(K)||'{}')||{}}catch{}
  const on=k=>!!LIST[k]&&(k in pick0?!!pick0[k]:LIST[k].def);
  const man={},buf={},state={};   // state[k]: 'loading' | 'ready' | 'fail'
  const setOf=id=>/^(\w+):/.test(id)?id.split(':')[0]:'guitar';
  async function load(k){
    if(state[k]||!LIST[k])return;state[k]='loading';
    try{
      const ac=panCtx();if(!ac){state[k]=0;return}
      const url=BASE+LIST[k].dir+'/',m=await (await fetch(url+'pack.json',{cache:'no-cache'})).json();man[k]=m;
      const jobs=[];for(const [id,fs] of Object.entries(m.files))fs.forEach((f,i)=>jobs.push([id,i,url+f+'?v='+m.version]));
      const got={};let n=0;
      const one=async()=>{while(n<jobs.length){const [id,i,u]=jobs[n++];
        try{const r=await fetch(u);if(!r.ok)continue;const b=await ac.decodeAudioData(await r.arrayBuffer());(got[id]=got[id]||[])[i]=b}catch(e){console.warn('pack',u,e)}}};
      await Promise.all([one(),one(),one(),one()]);
      for(const id in got)if(got[id].length===m.files[id].length&&got[id].every(Boolean))buf[id]=got[id];
      state[k]=Object.keys(buf).some(id=>setOf(id)===k)?'ready':'fail';
      try{SETUP.render()}catch{}
    }catch(e){console.warn('pack',k,e);state[k]='fail'}
  }
  // the layer for this hit: soft hits the soft recording; the recordings carry their own loudness, so the volume only
  // leans a little with the hit (like VR's), set against the note's own A and the pack's measured tuning
  function pick(id,vel){
    const k=setOf(id);if(!on(k))return null;
    const L=buf[id];if(!L){load(k);return null}
    const v=Math.max(0,Math.min(1,vel==null?1:vel)),x=v*L.length*.999,i=Math.min(L.length-1,Math.floor(x)),within=x-i;
    const a=.78*(.8+.2*within),T=Object.assign({},typeof TUNE0!=='undefined'?TUNE0:{start:0,end:null,db:0,fade:.15},{layered:true,cents:(man[k].tune[id]||{}).cents||0,db:20*Math.log10(a/Math.max(.05,vel==null?1:vel)),fade:.25});
    return {b:L[i],T,layer:i};
  }
  function set(k,val){pick0[k]=!!val;try{localStorage.setItem(K,JSON.stringify(pick0))}catch{}if(val)load(k);try{STUDIO.refresh()}catch{}}
  // Play: a tap on a pan with its pack on plays the pack (after How you play's hit strength)
  {const _sm=strikeMine;strikeMine=function(id,vel,light){
    if(S.panVoice==='mine'){const pk=pick(id,vel);if(pk)return playSample(id,vel,light,0,id,pk)}
    return _sm.apply(this,arguments)}}
  // get the song's pan ready when the app opens and when the pan changes
  const warm=()=>{try{const k=setKey();if(on(k))load(k)}catch{}};
  {const _p=applyPanSet;applyPanSet=function(){const r=_p.apply(this,arguments);setTimeout(warm,300);return r}}
  {let n=0;const go=()=>{if(panCtx())warm();else if(++n<40)setTimeout(go,500)};setTimeout(go,1200)}
  /* Settings: a switch per pack, under How you play, with its credit and licence */
  {const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();try{
      const list=$('setList');if(!list||list.querySelector('[data-row^=pack-]'))return;
      let at=list.querySelector('[data-row=phone]')||list.querySelector('[data-row=feel]')||list.querySelector('[data-row=play]');if(!at)return;
      for(const k of Object.keys(LIST)){const P=LIST[k],o=on(k),m=man[k],st=state[k];
        const r=document.createElement('button');r.className='sxrow';r.dataset.row='pack-'+k;r.setAttribute('role','switch');r.setAttribute('aria-checked',String(o));
        const name=(SETS[k]&&SETS[k].name)||k,note=o&&st==='loading'?' Getting the sounds ready…':o&&st==='fail'?' Couldn\'t get the sounds (no internet?). Your own sounds play for now.':'';
        r.innerHTML='<span class="sxic" style="background:#ffd479" aria-hidden="true">🎙</span><span class="sxlab"><b>'+P.short+'</b><small>'+(o?'On: ':'Off: ')+(o?'your '+name+' plays the studio recording, soft to hard.':'your '+name+' plays your own sounds.')+note+
          (m?'<br><i>'+m.credit+' · '+m.licence+'</i>':'')+'</small></span><span class="sxtog'+(o?' on':'')+'" aria-hidden="true"><i></i></span>';
        r.onclick=e=>{e.stopPropagation();set(k,!on(k));SETUP.render();say(on(k)?P.short+' on for the '+name+'.':'The '+name+' plays your own sounds again.')};
        at.parentNode.insertBefore(r,at.nextSibling);at=r}
      // credits show once a pack's details are in, even before it's switched on
      for(const k of Object.keys(LIST))if(!man[k]&&!state[k])fetch(BASE+LIST[k].dir+'/pack.json').then(r=>r.json()).then(m=>{if(!man[k]){man[k]=m;SETUP.render()}}).catch(()=>{});
    }catch(e){console.warn(e)}}}
  return {LIST,on,set,pick,load,state,get man(){return man},has:id=>!!buf[id]};
})();
