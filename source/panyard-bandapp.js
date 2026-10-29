/* ---------- Panyard Band: the band members' version (built by make_band.py, at /pan-notes/band/) ----------
   Always Band member: a player picks their section and pan, and never sees Studio, recording, Pan sounds, the band
   sound, the pan picker or tuning. The pan sounds are the band's own (source/band-sounds/, put in the first time it
   opens), every song plays at A = 441, and a sounds file can't replace them. Songs, song recordings, Write, My notes,
   Play, the Game, looks and backup all work as in Panyard. Its saved things are kept apart from Panyard's on the same
   phone (BANDSHIM, the first script), and its Google Drive backup is its own file. */
var BANDAPP=(()=>{
  const A=441,VK='panyard-bandsounds';
  let installing=false;
  // the tuning and the pan sound are fixed for every song: whatever a song (or a shared song) says is ignored
  Object.defineProperty(S,'refA',{get:()=>A,set(){},enumerable:true,configurable:true});
  Object.defineProperty(S,'panVoice',{get:()=>'mine',set(){},enumerable:true,configurable:true});
  try{CLOUD.MAN='panyard-band-backup.json'}catch{}
  document.body.classList.add('bandapp');
  /* always a band member: no Producer card, no way back to it */
  const _open=ROLE.open.bind(ROLE);ROLE.open=function(step){return _open(step==='who'||step==='new'&&!ROLE.band()?'section':step)};
  ROLE.toProducer=function(){};
  const _band=ROLE.band.bind(ROLE);
  /* Studio, Pan sounds and the band sound are for the Producer's Panyard */
  const _sv=showView;showView=function(v){return _sv.call(this,v==='studio'?'home':v)};
  try{TW.open=function(){say('Panyard Band plays the band’s own pan sounds.')}}catch{}
  {const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();['pan','tune','sound','band'].forEach(k=>{const x=document.querySelector('#setList [data-row="'+k+'"]');if(x)x.remove()})}}
  {const _so=SHARE.open.bind(SHARE);SHARE.open=async function(p,ask){if(installing)return _so(p,ask);if(p&&p.format===SHARE.FMT){say('Panyard Band plays the band’s own pan sounds, so a sounds file can’t change them.');return true}return _so(p,ask)}}
  {const _r=HOME.render.bind(HOME);HOME.render=function(){_r();const h=document.querySelector('#view-home .hm-top h1');if(h)h.textContent='Panyard Band';
    // the guides card: no Studio here
    setTimeout(()=>{const g=document.querySelector('#hmGuide small');if(g&&/Studio/.test(g.textContent))g.textContent='Step-by-step: load a recording, play along, write your part, share'},0)}}
  /* the band's pan sounds, put in the first time (and again when the band's sounds are updated) */
  function cover(on,txt){let d=$('bandInst');if(!d&&on){d=document.createElement('div');d.id='bandInst';d.className='band-inst';d.setAttribute('role','status');document.body.appendChild(d)}if(!d)return;d.hidden=!on;if(on)d.innerHTML='<div><b>Panyard Band</b><p>'+txt+'</p></div>'}
  const asUrl=b=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(b)});
  async function install(){
    let m;try{m=await (await fetch('band-sounds/manifest.json',{cache:'no-cache'})).json()}catch{return false}
    let have='';try{have=localStorage.getItem(VK)||''}catch{}
    if(have===m.version&&Object.keys(SAMPLES.wav).length)return true;
    const ids=Object.keys(m.files||{}),sounds={};let n=0;
    cover(true,'Getting the band’s pan sounds ready… (just this once)');
    try{
      for(const id of ids){const r=await fetch('band-sounds/'+m.files[id]);if(!r.ok)throw Error('missing '+id);const b=await r.blob();
        sounds[id]=(await asUrl(new Blob([b],{type:'audio/flac'})));if(++n%5===0)cover(true,'Getting the band’s pan sounds ready… '+n+' of '+ids.length)}
      installing=true;await SHARE.open({format:SHARE.FMT,version:1,name:m.name||'Band pans',sounds,tune:m.tune,fx:m.fx,borrow:m.borrow},false);
      try{localStorage.setItem(VK,m.version)}catch{}
      say('The band\u2019s pan sounds are ready.');   // in place of "… as the sound profile …"
      return true}
    catch(e){console.warn('band sounds',e);say('The pan sounds couldn’t be fetched. Check the internet and open Panyard Band again.');return false}
    finally{installing=false;cover(false)}
  }
  const ready=(async()=>{
    // let Panyard read its saved notes first, then add the band's
    await new Promise(r=>setTimeout(r,900));
    const ok=await install();
    if(!_band())ROLE.open('section');
    return ok})();
  {const c=document.createElement('style');c.textContent=`
body.bandapp [data-r=producer],body.bandapp [data-rs=p],body.bandapp .role-ov [data-to=who],body.bandapp .tabs [data-tab=studio]{display:none!important}
.band-inst{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgb(6 8 14/.86);color:#fff;text-align:center;padding:24px}
.band-inst[hidden]{display:none}.band-inst b{font-size:22px}.band-inst p{margin:10px 0 0;opacity:.85}`;document.head.appendChild(c)}
  return {A,ready,install,get installing(){return installing}};
})();
