/* ---------- Share your pan sounds: a file with just your recorded notes and how they're tuned ----------
   Pan sounds → Sound. "Save my sounds file" writes every note you've recorded (the take in use), its trim, volume,
   pitch fix, ring and tone, and the room of your sound profile. No songs, no song recordings, no notes. Someone
   who opens it gets those sounds as a new take on each note and a new sound profile, so their own takes and
   profiles stay: they can pick them again any time. */
var SHARE={
  FMT:'panyard-sounds',
  async save(){
    const ids=Object.keys(SAMPLES.wav).filter(id=>FIELDS.has(id));
    if(!ids.length){say('Record some pan notes first: there are no sounds to share yet.');return}
    const sounds={},tune={};
    let bytes=0;
    for(const id of ids){const T=SAMPLES.tune[id]?{...SAMPLES.tune[id]}:null;let w=SAMPLES.wav[id];
      // only the part you kept when trimming goes in the file (it plays the same, and the file is smaller)
      if(T&&(T.start>0.02||T.end!=null))try{const b=await sampleBuf(id);if(b){const a=Math.max(0,Math.round((T.start||0)*b.sampleRate)),e=Math.min(b.length,T.end!=null?Math.round(T.end*b.sampleRate):b.length);
        if(e-a>b.sampleRate*.05&&(a>0||e<b.length)){w=encodeWav24(b.getChannelData(0).slice(a,e),b.sampleRate);T.start=0;delete T.end}}}catch(e){}
      try{sounds[id]=await readData(w);bytes+=sounds[id].length}catch(e){continue}
      if(T)tune[id]=T}
    const p=profNow(),name=(prompt('A name for these sounds (others see it when they open the file):',p&&p.name&&p.name!=='My sound'?p.name:'My pan sounds')||'').trim().slice(0,40)||'Pan sounds';
    const sets=[...new Set(ids.map(id=>(FIELDS.get(id)||{}).set).filter(Boolean))];
    const data=JSON.stringify({format:this.FMT,version:1,name,sets,sounds,tune,fx:p&&p.fx?{...p.fx}:null,borrow:{...BORROW},savedAt:new Date().toISOString()});
    await offerFile(name.replace(/[\\/:*?"<>|]+/g,' ')+' - Panyard sounds.json',data);
    say(ids.length+' pan notes saved to the file ('+Math.max(1,Math.round(bytes/1048576))+' MB). No songs or recordings are in it.');
  },
  // a sounds file, already read: true when it was one
  async open(p,ask){
    if(!p||p.format!==this.FMT||!p.sounds||typeof p.sounds!=='object')return false;
    const ok=Object.entries(p.sounds).filter(([id,d])=>FIELDS.has(id)&&typeof d==='string'&&/^data:audio\/[a-z0-9.+-]+;base64,/i.test(d));
    if(!ok.length){say('That sounds file has no pan notes this app knows.');return true}
    const name=String(p.name||'Shared sounds').slice(0,40);
    if(ask!==false&&!confirm('Use "'+name+'" ('+ok.length+' pan notes)?\n\nEach note gets these as a new take, with a new sound profile. Your own takes and profiles stay, so you can switch back in Pan sounds.'))return true;
    const num=(v,lo,hi,d)=>Number.isFinite(+v)?Math.max(lo,Math.min(hi,+v)):d,tune={};
    for(const [id,d] of ok){const b=dataUrlToBlob(d,'audio/wav');SAMPLES.wav[id]=b;delete SAMPLES.buf[id];if(typeof TAKES!=='undefined')TAKES.add(id,b,'shared');
      const v=p.tune&&p.tune[id];if(v&&typeof v==='object'){const T={};
        if(v.start!=null)T.start=num(v.start,0,30,0);if(v.end!=null)T.end=num(v.end,0,30,null);
        for(const [k,lo,hi] of [['db',-12,12],['fade',.05,1.2],['cents',-100,100],['ring',-10,10],['tone',-10,10]])if(v[k]!=null)T[k]=num(v[k],lo,hi,0);
        tune[id]=T}}
    // the sounds come with their own profile: the sender's room and tuning, on top of what this phone already has
    const cur=profNow(),base=cur?JSON.parse(JSON.stringify(cur.tune||{})):{};
    for(const id of Object.keys(tune))base[id]=tune[id];for(const [id] of ok)if(!tune[id])delete base[id];
    const id='p'+Date.now().toString(36);PROF.list.push({id,name,fx:{...FX0,...(p.fx&&typeof p.fx==='object'?p.fx:(cur&&cur.fx)||{})},tune:base});
    PROF.active=id;SAMPLES.tune=profNow().tune;
    if(p.borrow&&typeof p.borrow==='object')for(const [a,b] of Object.entries(p.borrow))if(SETS[a]&&(SETS[b]||b==='*')&&a!==b&&!BORROW[a])BORROW[a]=b;
    saveBorrow();saveSamples();saveTune();saveProfiles();try{applyFx();renderProfiles()}catch(e){}
    S.panVoice='mine';try{renderVoice()}catch(e){}
    for(const [i] of ok)try{sampleBuf(i)}catch(e){}
    try{if(typeof TW!=='undefined')TW.refresh()}catch(e){}
    say(ok.length+' pan sounds from "'+name+'" are in use, as the sound profile "'+name+'".');
    return true;
  },
  // a song backup's pan sounds never replace this phone's: drop every note this phone has recorded (and its tuning),
  // and the backup's sound profiles and borrowing when this phone has sounds of its own
  guard(p){
    const mine=Object.keys(SAMPLES.wav).filter(id=>FIELDS.has(id));let kept=0;
    if(!mine.length||!p.sounds||typeof p.sounds!=='object')return{kept};
    for(const id of Object.keys(p.sounds))if(SAMPLES.wav[id]){delete p.sounds[id];kept++}
    if(p.soundTune&&typeof p.soundTune==='object')for(const id of Object.keys(p.soundTune))if(!p.sounds[id])delete p.soundTune[id];
    delete p.soundProfiles;delete p.soundBorrow;
    if(!Object.keys(p.sounds).length){delete p.sounds;delete p.soundTune}
    return{kept};
  },
  // the open song has something in it (notes, a recording, a name, or Studio tracks): a backup opens beside it
  busySong(){
    if(typeof isDemo!=='undefined'&&isDemo)return true;
    if(S.cues&&S.cues.length)return true;if(typeof hasAudio!=='undefined'&&hasAudio)return true;
    try{if(STUDIO.song&&STUDIO.song.tracks.some(t=>(t.notes&&t.notes.length)||t.type==='audio'))return true}catch(e){}
    return !!(S.title&&S.title!=='New song');
  },
  // notes whose sound in use isn't their newest take (an old backup put an older recording back in place)
  stale(){
    if(typeof TAKES==='undefined')return[];const out=[];
    for(const id of Object.keys(SAMPLES.wav)){const L=TAKES.list(id);if(!L.length)continue;
      let ni=0;L.forEach((t,i)=>{if((t.at||0)>=(L[ni].at||0))ni=i});const w=SAMPLES.wav[id],nb=L[ni].b;
      if(w&&nb&&(w.size!==nb.size||w.type!==nb.type))out.push([id,ni])}
    return out;
  },
  newest(){
    const st=this.stale();if(!st.length){say('Every note already plays your newest recording.');return}
    if(!confirm(st.length+' notes are playing an older recording than your newest one (an old backup put it back).\n\nUse your newest recording on all of them? The older ones stay in each note\'s takes. Their trim and pitch fix start fresh, so Tune all for me may be worth running after.'))return;
    for(const [id,i] of st)try{TAKES.pick(id,i)}catch(e){}
    try{if(typeof TW!=='undefined')TW.refresh()}catch(e){}
    this.place();say(st.length+' notes are back on your newest recordings.');
  },
  card(){
    const n=Object.keys(SAMPLES.wav).filter(id=>FIELDS.has(id)).length;
    return '<section class="bandbox" id="shareBox"><div class="twsh"><h3>Share your pan sounds</h3><p>A file with just your recorded notes and how they\'re tuned. No songs or recordings. Send it to your band, or open one someone sent you.</p></div>'
      +'<div class="sharebtns"><button class="btn primary" data-share="save"'+(n?'':' disabled')+'>Save my sounds file</button><button class="btn" data-share="open">Open a sounds file</button></div>'
      +'<p class="sharenote">'+(n?n+' recorded notes ready to share.':'Record some notes first.')+'</p><input type="file" id="shareIn" accept=".json,application/json" hidden>'
      +(()=>{const k=this.stale().length;return k?'<div class="sharestale"><p><b>'+k+' notes</b> are playing an older recording than your newest one.</p><button class="btn" data-share="newest">Use my newest recordings</button></div>':''})()+'</section>';
  },
  place(){
    const snd=$('twSound');if(!snd)return;const old=$('shareBox');if(old)old.remove();
    snd.insertAdjacentHTML('beforeend',this.card());const box=$('shareBox');
    box.addEventListener('click',e=>{const b=e.target.closest('[data-share]');if(!b)return;if(b.dataset.share==='save')this.save();else if(b.dataset.share==='newest')this.newest();else $('shareIn').click()});
    $('shareIn').onchange=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
      try{const p=JSON.parse(await f.text());if(!(await this.open(p)))say("That isn't a Panyard sounds file. Choose a file saved with Save my sounds file.")}
      catch(err){say("That isn't a Panyard sounds file. Choose a file saved with Save my sounds file.")}}
  }
};
{
  // the card goes at the end of the Sound tab each time it opens (after Band sounds and How you play)
  if(typeof TW!=='undefined'&&TW.tabTo){const _t=TW.tabTo;TW.tabTo=function(t){_t(t);if(t==='sound')try{SHARE.place()}catch(e){console.warn(e)}}}
  document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.twtabs [data-tab=sound]'))setTimeout(()=>{try{SHARE.place()}catch(err){}},0)});
  // Open backup file, made safe. It used to pour the backup into whatever song was open (that song's notes and
  // Studio tracks were gone) and put the backup's older pan sounds and sound profiles in place of the phone's own.
  // Now: a sounds file opens as sounds; a song backup opens as a song of its own (unless the open song is a blank
  // new one), and the phone's own recorded notes, sound profiles and borrowing stay exactly as they are. Only notes
  // this phone has never recorded take their sound from the backup.
  const inp=$('impJson');
  if(inp){const _ch=inp.onchange;inp.onchange=async function(e){const f=e.target.files&&e.target.files[0];
    if(!f||f.size>=200e6)return _ch.call(this,e);
    let p;try{p=JSON.parse(await f.text())}catch(err){return _ch.call(this,e)}
    if(p&&p.format===SHARE.FMT){e.target.value='';await SHARE.open(p);return}
    if(!p||!/^pan-notes/.test(p.format||''))return _ch.call(this,e);
    e.target.value='';const r=SHARE.guard(p);
    if(SHARE.busySong()){songsInit();const id=newSongId();SONGS.list.unshift({id,title:String(p.title||'Opened song').slice(0,200),n:0,rec:false,updated:Date.now(),done:{}});songsSave();await songOpen(id,true)}
    const file=new File([JSON.stringify(p)],f.name,{type:'application/json'});
    await _ch.call(this,{target:{files:[file],value:''}});
    if(r.kept)setTimeout(()=>say('Opened '+(S.title||'the song')+' as its own song. Your own recordings of '+r.kept+' notes stayed as they are.'),400);
  }}
}
