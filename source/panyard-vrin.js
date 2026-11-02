/* ---------- Songs from VR: songs sent from Panyard VR (☁ Send to Panyard) open here as Studio songs ----------
   Panyard VR signs in to the same hidden Google Drive folder this app backs up to (drive.appdata, CLOUD.CID) and keeps
   the songs you send in one file there, panyard-vr-inbox.json ({format:'panyard-vr-inbox', songs:[{id, title, at, song}]},
   song as VR keeps it: bpm, L in beats, tracks {name, set, vol, pan, mute, solo, notes:[{id, v, b}]}). Here they're listed
   (Settings → Backup card, and a chip on Home when one is new); Open makes a new song with each pan or drum track as a
   Studio track (the recording stays on the headset). Which ones you've opened: localStorage 'panyard-vrin' {id: at}.
   Panyard only: Panyard Band has no Studio. Nothing is made while the app starts: only from a tap. */
var VRIN=(()=>{
  const NAME='panyard-vr-inbox.json',K='panyard-vrin';
  let seen={};try{seen=JSON.parse(localStorage.getItem(K)||'{}')||{}}catch{}
  let songs=null,busy=false;
  const off=()=>typeof BANDAPP!=='undefined'||typeof STUDIO==='undefined'||typeof CLOUD==='undefined';
  const fresh=()=>(songs||[]).filter(e=>!(seen[e.id]>=e.at));
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  async function fetchList(ask){
    if(!CLOUD.live()){if(!ask)return null;await CLOUD.auth(false)}
    const f=await CLOUD.list("name='"+NAME+"'");
    if(!f.length){songs=[];return songs}
    const j=JSON.parse(await (await CLOUD.get(f.sort((a,b)=>(b.modifiedTime||'').localeCompare(a.modifiedTime||''))[0].id)).text());
    songs=(j&&j.format==='panyard-vr-inbox'&&Array.isArray(j.songs)?j.songs:[]).filter(e=>e&&e.id&&e.song&&Array.isArray(e.song.tracks)).sort((a,b)=>b.at-a.at);
    chip();return songs}
  // a VR song as Studio's own song (the shape a backup file's Studio tracks come in, so backupIn checks every value)
  function studioOf(s){const bpm=Math.max(30,Math.min(300,+s.bpm||100)),tracks=[];
    for(const t of s.tracks){if(!t||t.rec||!Array.isArray(t.notes)||!t.notes.length)continue;
      const base={name:String(t.name||'').slice(0,28),vol:Math.min(1.5,+t.vol||1),pan:+t.pan||0,mute:!!t.mute,solo:!!t.solo};
      if(t.set==='kit')tracks.push({...base,type:'drums',kit:'real',notes:t.notes.filter(n=>/^drum:\d+$/.test(n.id)).map(n=>({t:+n.b,d:.25,p:+n.id.slice(5),v:+n.v||.9}))});
      else if(SETS[t.set])tracks.push({...base,type:'pan',panSet:t.set,notes:t.notes.filter(n=>PITCH[n.id]).map(n=>({t:+n.b,d:.5,p:n.id,v:+n.v||.9}))})}
    return {bpm,minBars:Math.max(1,Math.ceil((+s.L||16)/4)),metro:false,countIn:true,tracks:[{type:'practice'},{type:'part',name:'My part'},...tracks]}}
  async function open(id){const e=(songs||[]).find(x=>x.id===id);if(!e||busy)return;busy=true;
    try{const st=studioOf(e.song),n=st.tracks.length-1;if(!n){say('That song has no pan or drum notes yet.');return}
      await (typeof ROLE!=='undefined'&&ROLE.songNew0?ROLE.songNew0():songNew());
      const title=String(e.title||'Song from VR').slice(0,60);S.title=title;try{$('title').value=title}catch{}
      const first=st.tracks.find(t=>t.type==='pan');if(first&&SETS[first.panSet]){S.panSet=first.panSet;try{applyPanSet()}catch{}}
      save();try{songTouch()}catch{}
      await window.backupIn({studio:st});
      seen[e.id]=e.at;try{localStorage.setItem(K,JSON.stringify(seen))}catch{}
      CLOUD.sheet(null);chip();showView('studio');say(title+' from VR is in Studio: '+n+(n===1?' track':' tracks')+'.')}
    catch(err){console.warn('vrin',err);say('That song couldn’t open: '+(err.message||err))}finally{busy=false}}
  function sheetList(){const L=songs||[];
    CLOUD.sheet('<h2>🥽 Songs from VR</h2>'+(L.length?'<p>Songs you sent from Panyard VR. Open one to make it a new song here, with each pan as a Studio track.</p><div class="vrin-l">'+L.map(e=>{const n=e.song.tracks.filter(t=>!t.rec&&t.notes&&t.notes.length).length;
        return '<div class="vrin-r"><span><b>'+esc(e.title||'Song')+(seen[e.id]>=e.at?'':' <i class="vrin-new">new</i>')+'</b><small>'+new Date(e.at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})+' · '+n+(n===1?' track':' tracks')+' · '+Math.round(+e.song.bpm||100)+' bpm</small></span><button class="btn primary" data-vrin="'+esc(e.id)+'">Open</button></div>'}).join('')+'</div>'
      :'<p>No songs from VR yet. In Panyard VR, off the headset: Saved in VR → Share → 📱 Send to Panyard.</p>')+'<div class="row"><button class="btn grow" data-cl="close">Close</button></div>');
    const box=$('clSheet');box.querySelectorAll('[data-vrin]').forEach(b=>b.onclick=()=>{b.disabled=true;b.textContent='Opening…';open(b.dataset.vrin)})}
  async function show(){if(off())return;CLOUD.sheet('<h2>🥽 Songs from VR</h2><p>Looking in your Google Drive…</p>');
    try{await fetchList(true);sheetList()}catch(e){CLOUD.sheet('<h2>🥽 Songs from VR</h2><p>'+({offline:'Couldn’t reach Google. Check the internet.',closed:'Google sign-in was closed.',nokey:'Google Drive isn’t set up in this app.'}[e.message]||'Couldn’t look in your Google Drive ('+esc(e.message||e)+').')+'</p><div class="row"><button class="btn grow" data-cl="close">Close</button></div>')}}
  // Home: a chip when a song you haven't opened is waiting (looked for only while Google is already signed in)
  function chip(){if(off())return;let c=$('hmVR');const n=fresh().length,at=$('hmCloud')||$('roleChip')||$('hmStreak');
    if(!c&&at){c=document.createElement('button');c.id='hmVR';c.className='hm-cloud';c.onclick=e=>{e.stopPropagation();songs?sheetList():show()};at.after(c)}
    if(c){c.hidden=!n;c.textContent='🥽 '+(n===1?'A song':n+' songs')+' from VR';c.setAttribute('aria-label',c.textContent+': open')}}
  async function peek(){if(off()||!CLOUD.live())return;try{await fetchList(false)}catch(e){console.warn('vrin',e)}}
  // set up once every module has loaded (Panyard Band's BANDAPP is a later script, and this stays out of the Band app)
  const init=()=>{if(off())return;
    // the Backup card: a button under it
    {const _u=CLOUD.ui.bind(CLOUD);CLOUD.ui=function(m){_u(m);const c=$('clCard');if(c&&!c.querySelector('#vrinGo')){const b=document.createElement('button');b.id='vrinGo';b.className='btn grow vrin-go';b.textContent='🥽 Songs from VR';b.onclick=()=>show();c.appendChild(b)}}}
    if(typeof HOME!=='undefined'){const _r=HOME.render.bind(HOME);HOME.render=function(){_r();chip()}}
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)peek()});
    setTimeout(peek,5000);try{CLOUD.ui()}catch{}
    const st=document.createElement('style');st.textContent=`.vrin-go{width:100%;margin-top:8px}
.vrin-l{display:flex;flex-direction:column;gap:8px;margin:10px 0 14px}
.vrin-r{display:flex;align-items:center;gap:10px;background:var(--raised);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.vrin-r span{flex:1;min-width:0}.vrin-r b{display:block;overflow-wrap:anywhere}.vrin-r small{display:block;color:var(--muted);font-size:13px;margin-top:2px}
.vrin-new{font-style:normal;font-size:11px;background:var(--accent,#ffd479);color:#1a1300;border-radius:8px;padding:1px 6px;margin-left:4px;vertical-align:2px}`;document.head.appendChild(st)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else setTimeout(init,0);
  return {show,open,peek,studioOf,fresh,get songs(){return songs},NAME};
})();
