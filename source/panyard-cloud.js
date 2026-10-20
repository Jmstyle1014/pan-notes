/* ---------- Cloud backup: every song, recording, pan sound and photo, kept in your own Google Drive ---------- */
// It goes into Panyard's private app folder in your Drive (you won't see it among your files, and Panyard can't see
// anything else there). After you connect once it backs up by itself a little after each change. Google keeps the
// connection for about an hour; after that a "☁ Back up" chip appears on Home, and one tap carries on.
// On a new phone: Setup → Backup → Bring my songs back.
var CLOUD={
  // the Google sign-in key for this app (Google Cloud Console → Credentials → OAuth client ID, type "Web application")
  CID:'',
  SCOPE:'https://www.googleapis.com/auth/drive.appdata',
  MAN:'panyard-backup.json',
  K:'panyard-cloud',
  // settings that belong to this phone, not to you (its speaker and mic timing, which tips you've seen)
  SKIP:/^(panyard-studio|panyard-smooth|panyard-cloud.*|panyard-guide|pan-lastBackup|panyard-subtab|pan-snooze-.*)$/,
  st:null,tok:null,dirty:false,busy:false,
  cid(){try{return localStorage.getItem('panyard-gclient')||this.CID}catch{return this.CID}},
  load(){try{this.st=Object.assign({on:0,email:'',last:0,blobs:{},man:''},JSON.parse(localStorage.getItem(this.K)||'{}'))}catch{this.st={on:0,email:'',last:0,blobs:{},man:''}}
    try{const t=JSON.parse(localStorage.getItem('panyard-cloud-tok')||'null');if(t&&t.exp>Date.now()+60000)this.tok=t}catch{}
    try{this.dirty=localStorage.getItem('panyard-cloud-dirty')==='1'}catch{}},
  save(){try{localStorage.setItem(this.K,JSON.stringify(this.st))}catch{}},
  mark(v){this.dirty=v;try{localStorage.setItem('panyard-cloud-dirty',v?'1':'0')}catch{}this.ui()},
  live(){return !!(this.tok&&this.tok.exp>Date.now()+60000)},

  /* ---- signing in (Google's own sign-in window) ---- */
  gis(){if(window.google&&google.accounts&&google.accounts.oauth2)return Promise.resolve();
    if(this._gis)return this._gis;
    return this._gis=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=()=>res();s.onerror=()=>{this._gis=null;rej(Error('offline'))};document.head.appendChild(s)})},
  // must start from a tap: Google opens its window, and closes it by itself if you've already said yes before
  async auth(ask){if(!this.cid())throw Error('nokey');await this.gis();
    return new Promise((res,rej)=>{
      const tc=google.accounts.oauth2.initTokenClient({client_id:this.cid(),scope:this.SCOPE,hint:this.st.email||undefined,
        callback:r=>{if(r&&r.access_token){this.tok={t:r.access_token,exp:Date.now()+(+r.expires_in||3600)*1000};try{localStorage.setItem('panyard-cloud-tok',JSON.stringify(this.tok))}catch{}res(this.tok)}else rej(Error(r&&r.error||'denied'))},
        error_callback:e=>rej(Error(e&&e.type||'closed'))});
      tc.requestAccessToken({prompt:ask?'consent':''})})},
  async api(url,o={}){if(!this.live())throw Error('expired');
    const r=await fetch(url,Object.assign({},o,{headers:Object.assign({Authorization:'Bearer '+this.tok.t},o.headers||{})}));
    if(r.status===401){this.tok=null;try{localStorage.removeItem('panyard-cloud-tok')}catch{}throw Error('expired')}
    if(!r.ok)throw Error('drive '+r.status);return r},
  D:'https://www.googleapis.com/drive/v3/files',U:'https://www.googleapis.com/upload/drive/v3/files',
  async list(q){let out=[],pt='';do{const r=await(await this.api(this.D+'?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,size,modifiedTime)'+(q?'&q='+encodeURIComponent(q):'')+(pt?'&pageToken='+pt:''))).json();out=out.concat(r.files||[]);pt=r.nextPageToken||''}while(pt);return out},
  async put(name,blob,id){
    // small files in one go; big ones (recordings) as a resumable upload
    const meta=id?{}:{name,parents:['appDataFolder']};
    if(blob.size<4.5e6){const b='pnb'+Math.random().toString(36).slice(2);
      const body=new Blob(['--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+b+'\r\nContent-Type: '+(blob.type||'application/octet-stream')+'\r\n\r\n',blob,'\r\n--'+b+'--']);
      const r=await this.api(this.U+(id?'/'+id:'')+'?uploadType=multipart&fields=id',{method:id?'PATCH':'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body});return (await r.json()).id}
    const r=await this.api(this.U+(id?'/'+id:'')+'?uploadType=resumable&fields=id',{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':blob.type||'application/octet-stream','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify(meta)});
    const loc=r.headers.get('Location');if(!loc)throw Error('noresume');
    const u=await fetch(loc,{method:'PUT',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob});if(!u.ok)throw Error('upload '+u.status);return (await u.json()).id},
  async get(id){return (await this.api(this.D+'/'+id+'?alt=media')).blob()},

  /* ---- what's on this phone, as one manifest plus a file for each recording / sound / photo ---- */
  db(){return new Promise((res,rej)=>{const r=indexedDB.open('pan-notes',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  async all(){const d=await this.db();return new Promise((res,rej)=>{const t=d.transaction('files'),s=t.objectStore('files'),out=[];const c=s.openCursor();c.onsuccess=()=>{const k=c.result;if(!k)return res(out);out.push([k.key,k.value]);k.continue()};c.onerror=()=>rej(c.error)})},
  async fp(b){const n=262144,part=b.size>2*n?new Blob([b.slice(0,n),b.slice(b.size-n)]):b;const h=await crypto.subtle.digest('SHA-256',await part.arrayBuffer());
    return b.size+'-'+[...new Uint8Array(h)].slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('')},
  async enc(v,blobs){
    if(v instanceof Blob){const f=await this.fp(v);blobs.set(f,v);return {$b:f,t:v.type}}
    if(v instanceof ArrayBuffer){const b=new Blob([v]),f=await this.fp(b);blobs.set(f,b);return {$ab:f}}
    if(ArrayBuffer.isView(v)){const b=new Blob([v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)]),f=await this.fp(b);blobs.set(f,b);return {$ta:f,c:v.constructor.name}}
    if(v instanceof Date)return {$d:v.getTime()};
    if(Array.isArray(v)){const o=[];for(const x of v)o.push(await this.enc(x,blobs));return o}
    if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v))o[k]=await this.enc(v[k],blobs);return {$o:o}}
    return v},
  async dec(v,get){
    if(Array.isArray(v)){const o=[];for(const x of v)o.push(await this.dec(x,get));return o}
    if(v&&typeof v==='object'){
      if('$b' in v){const b=await get(v.$b);return v.t&&b.type!==v.t?new Blob([b],{type:v.t}):b}
      if('$ab' in v)return (await get(v.$ab)).arrayBuffer();
      if('$ta' in v){const ab=await (await get(v.$ta)).arrayBuffer(),C=window[v.c]||Uint8Array;return new C(ab)}
      if('$d' in v)return new Date(v.$d);
      if('$o' in v){const o={};for(const k of Object.keys(v.$o))o[k]=await this.dec(v.$o[k],get);return o}}
    return v},

  /* ---- backing up ---- */
  async backup(why){if(this.busy||!this.st.on)return;if(!this.live()){this.ui();return}
    this.busy=true;this.mark(this.dirty);this.ui('Backing up…');
    try{
      const blobs=new Map(),idb={},ls={};this.dirty=false;
      for(const [k,v] of await this.all())idb[k]=await this.enc(v,blobs);
      for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!this.SKIP.test(k))ls[k]=localStorage.getItem(k)}
      const have=this.st.blobs||{},keep={};let n=0;
      for(const [f,b] of blobs){if(have[f]){keep[f]=have[f];continue}this.ui('Backing up… '+(++n)+' file'+(n>1?'s':''));keep[f]=await this.put('b-'+f,b)}
      const man={format:'panyard-cloud',version:1,saved:Date.now(),device:(navigator.userAgentData&&navigator.userAgentData.platform)||(/Android/.test(navigator.userAgent)?'Android':/iPhone|iPad/.test(navigator.userAgent)?'iPhone':'Computer'),
        songs:(()=>{try{return ((JSON.parse(localStorage.getItem('pan-songs')||'{}')||{}).list||[]).length}catch{return 0}})(),blobs:keep,idb,ls};
      const mb=new Blob([JSON.stringify(man)],{type:'application/json'});
      try{this.st.man=await this.put(this.MAN,mb,this.st.man||undefined)}catch(e){if(!this.st.man)throw e;this.st.man=await this.put(this.MAN,mb)}
      // tidy: files no longer used by any song (a recording you replaced)
      const used=new Set(Object.values(keep));used.add(this.st.man);
      const old=Object.entries(have).filter(([f,id])=>!keep[f]&&!used.has(id));
      for(const [,id] of old)try{await this.api(this.D+'/'+id,{method:'DELETE'})}catch{}
      this.st.blobs=keep;this.st.last=Date.now();this.save();try{renderSaveInfo()}catch{}
      try{localStorage.setItem('pan-lastBackup',Date.now())}catch{}try{SAFE.hide('backup')}catch{}
      if(!this.dirty)this.mark(false);if(why==='tap')say('Backed up to Google Drive.')
    }catch(e){this.dirty=true;this.mark(true);
      if(/expired/.test(e.message))this.ui();else{console.warn('cloud',e);if(why==='tap')say(navigator.onLine===false?'No internet. It will back up when you’re online.':'Couldn’t back up just now. It will try again.')}}
    finally{this.busy=false;this.ui()}},
  touch(){if(!this.st||!this.st.on||this.restoring)return;if(!this.dirty)this.mark(true);clearTimeout(this.tt);this.tt=setTimeout(()=>this.backup('auto'),20000)},

  /* ---- the buttons ---- */
  async connect(){if(!this.cid()){this.setupHelp();return}
    try{this.ui('Opening Google…');await this.auth(!this.st.on);
      try{const a=await(await this.api('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)')).json();this.st.email=a.user&&a.user.emailAddress||this.st.email}catch{}
      const first=!this.st.on;this.st.on=1;this.save();
      // a backup already in this Drive (another phone) and nothing here yet: offer to bring it in
      if(first){let f=[];try{f=await this.list("name='"+this.MAN+"'")}catch{}
        if(f.length){this.st.man=f[0].id;this.save();const songs=(()=>{try{return ((JSON.parse(localStorage.getItem('pan-songs')||'{}')||{}).list||[]).length}catch{return 0}})();
          this.ui();this.restoreAsk(f[0],songs>1);return}}
      this.mark(true);await this.backup('tap')}
    catch(e){this.ui();if(e.message==='offline')say('Couldn’t reach Google. Check your internet and try again.');else if(e.message!=='closed'&&e.message!=='popup_closed')say('Google sign-in didn’t finish. Try again.')}},
  async now(){try{if(!this.live())await this.auth(false);this.dirty=true;await this.backup('tap')}catch(e){this.ui();if(e.message==='nokey')this.setupHelp();else say('Google sign-in didn’t finish. Try again.')}},
  off(){this.st.on=0;this.st.man='';this.st.blobs={};this.tok=null;try{localStorage.removeItem('panyard-cloud-tok')}catch{}this.save();this.mark(false);say('Cloud backup is off. What’s already in your Drive stays there.')},
  async restoreStart(){try{if(!this.live())await this.auth(false);const f=await this.list("name='"+this.MAN+"'");
      if(!f.length){say('No Panyard backup in this Google Drive yet.');return}this.restoreAsk(f[0])}catch(e){if(e.message==='nokey')this.setupHelp();else say('Couldn’t reach your Google Drive. Try again.')}},
  // both: a backup in Drive (another phone) and songs on this one; you choose which to keep
  restoreAsk(f,both){const when=esc(new Date(f.modifiedTime||Date.now()).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}));
    if(both){this.sheet('<h2>There’s already a backup in this Drive</h2><p>It’s from <b>'+when+'</b>, maybe from another phone. Which songs do you want to keep?</p>'
      +'<div class="cl-pick"><button class="btn primary" data-cl="restore" data-id="'+esc(f.id)+'">Bring that backup here<small>Replaces the songs on this phone</small></button><button class="btn" data-cl="mine">Keep this phone’s songs<small>They replace the backup in Drive</small></button></div><div class="row"><button class="btn grow" data-cl="close">Decide later</button></div>');return}
    this.sheet('<h2>Bring your songs back?</h2><p>Your backup in Google Drive is from <b>'+when+'</b>.</p><p>It replaces the songs, recordings and pan sounds on this phone with the ones in the backup.</p>'
      +'<div class="row"><button class="btn primary grow" data-cl="restore" data-id="'+esc(f.id)+'">Bring them back</button><button class="btn grow" data-cl="close">Not now</button></div>')},
  async restore(id){this.restoring=true;this.sheet('<h2>Bringing your songs back…</h2><p id="clProg">Getting the list…</p>');
    const prog=t=>{const p=$('clProg');if(p)p.textContent=t};
    try{const man=JSON.parse(await (await this.get(id)).text());if(man.format!=='panyard-cloud')throw Error('format');
      const got=new Map();let n=0;const total=Object.keys(man.blobs||{}).length;
      const get=async f=>{if(got.has(f))return got.get(f);const fid=man.blobs[f];if(!fid)throw Error('missing '+f);prog('Downloading '+(++n)+' of '+total+'…');const b=await this.get(fid);got.set(f,b);return b};
      const vals=[];for(const k of Object.keys(man.idb||{}))vals.push([k,await this.dec(man.idb[k],get)]);
      prog('Saving on this phone…');
      const d=await this.db();await new Promise((res,rej)=>{const t=d.transaction('files','readwrite'),s=t.objectStore('files');s.clear();for(const [k,v] of vals)s.put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)});
      for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(!this.SKIP.test(k)&&!(k in man.ls))localStorage.removeItem(k)}
      for(const [k,v] of Object.entries(man.ls||{}))try{localStorage.setItem(k,v)}catch{}
      this.st.man=id;this.st.blobs=man.blobs||{};this.st.last=man.saved||Date.now();this.st.on=1;this.save();this.mark(false);
      prog('Done. Opening your songs…');setTimeout(()=>location.reload(),700)}
    catch(e){console.warn('restore',e);this.restoring=false;this.sheet('<h2>That didn’t finish</h2><p>'+(navigator.onLine===false?'You’re offline. ':'')+'Nothing on this phone was changed. Try again in a moment.</p><div class="row"><button class="btn grow" data-cl="close">OK</button></div>')}},
  setupHelp(){this.sheet('<h2>Cloud backup needs a one-time setup</h2><p>Panyard needs its own Google sign-in key before it can use Google Drive. Whoever runs this copy of Panyard makes it once in Google Cloud Console (free), and then everyone can connect.</p><div class="row"><button class="btn grow" data-cl="close">OK</button></div>')},
  sheet(h){let ov=$('clSheet');if(!ov){ov=document.createElement('div');ov.id='clSheet';ov.className='sheetov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
      ov.innerHTML='<div class="sheetbox cl-box"></div>';document.body.appendChild(ov);
      ov.addEventListener('click',e=>{const b=e.target.closest('[data-cl]');if(e.target===ov&&!this.restoring){ov.hidden=true;return}if(!b)return;
        if(b.dataset.cl==='close')ov.hidden=true;else if(b.dataset.cl==='restore')this.restore(b.dataset.id);else if(b.dataset.cl==='mine'){ov.hidden=true;this.dirty=true;this.backup('tap')}})}
    if(h===null){ov.hidden=true;return}ov.querySelector('.cl-box').innerHTML=h;ov.hidden=false},

  /* ---- what you see: a card in Setup → Backup, a row value, and a chip on Home when it needs a tap ---- */
  ago(t){if(!t)return 'never';const m=Math.round((Date.now()-t)/60000);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':new Date(t).toLocaleDateString()},
  ui(msg){
    const c=$('clCard');if(c){const on=this.st.on;
      c.innerHTML='<div class="cl-h"><span class="cl-ic" aria-hidden="true">☁</span><div><b>Cloud backup · Google Drive</b><small id="clStat">'+(msg?esc(msg):on?(this.st.email?esc(this.st.email)+' · ':'')+'last backup '+this.ago(this.st.last)+(this.dirty?(this.live()?' · new changes, backing up soon':' · new changes: tap Back up now'):''):'Every song, recording, pan sound and photo, kept safe in your own Google Drive and backed up by itself.')+'</small></div></div>'
        +'<div class="row">'+(on?'<button class="btn primary grow" id="clNow">Back up now</button><button class="btn grow" id="clBack">Bring my songs back</button>':'<button class="btn primary grow" id="clOn">Connect Google Drive</button><button class="btn grow" id="clBack">Bring my songs back</button>')+'</div>'
        +(on?'<button class="cl-off" id="clOff">Turn cloud backup off</button>':'');
      const on1=$('clOn'),nw=$('clNow'),bk=$('clBack'),of=$('clOff');
      if(on1)on1.onclick=()=>this.connect();if(nw)nw.onclick=()=>this.now();if(bk)bk.onclick=()=>this.restoreStart();if(of)of.onclick=()=>this.off()}
    const chip=$('hmCloud');const need=this.st.on&&this.dirty&&!this.live()&&!this.busy;
    if(chip)chip.hidden=!need;
    const row=document.querySelector('#setList [data-row=save] .sxval');if(row&&this.st.on)row.textContent=this.busy?'Backing up…':'☁ '+this.ago(this.st.last)},
  homeChip(){const st=$('roleChip')||$('hmStreak');if(!st||$('hmCloud'))return this.ui();const b=document.createElement('button');b.id='hmCloud';b.className='hm-cloud';b.hidden=true;b.innerHTML='☁ Back up';b.setAttribute('aria-label','Back up your songs to Google Drive');
    b.onclick=e=>{e.stopPropagation();this.now()};st.after(b);this.ui()},

  init(){this.load();
    // anything saved on this phone marks the backup as needing a refresh
    if(typeof idbPut==='function'){const _p=idbPut;idbPut=async function(k,v){const r=await _p(k,v);CLOUD.touch();return r}}
    {const _s=Storage.prototype.setItem;let busy=false;Storage.prototype.setItem=function(k,v){_s.call(this,k,v);if(!busy&&this===window.localStorage&&!CLOUD.SKIP.test(k)){busy=true;try{CLOUD.touch()}finally{busy=false}}}}
    // the card in Setup → Backup
    const sv=$('saveInfo');if(sv&&!$('clCard')){const c=document.createElement('div');c.id='clCard';c.className='cl-card';sv.closest('.panel').insertBefore(c,sv)}
    if(typeof renderSaveInfo==='function'){const _rs=renderSaveInfo;renderSaveInfo=function(){_rs();const el=$('saveInfo');if(el&&CLOUD.st.on)el.textContent='✓ Saving on this phone, and backed up to your Google Drive by itself. A backup file is handy for sending one song to someone.'}}
    if(typeof HOME!=='undefined'){const _r=HOME.render.bind(HOME);HOME.render=function(){_r();CLOUD.homeChip()};this.homeChip()}
    if(typeof SETUP!=='undefined'){const _s=SETUP.render.bind(SETUP);SETUP.render=function(){_s();CLOUD.ui()}}
    // back up before the app goes to the background, and when the internet comes back
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.dirty&&this.live())this.backup('auto')});
    addEventListener('online',()=>{if(this.dirty&&this.live())this.backup('auto')});
    setInterval(()=>{if(this.dirty&&this.live()&&!this.busy)this.backup('auto');else this.ui()},60000);
    this.ui();if(this.dirty&&this.live())setTimeout(()=>this.backup('auto'),4000);
  }
};
{const st=document.createElement('style');st.textContent=`
.cl-card{background:var(--raised);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:0 0 14px}
.cl-h{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
.cl-h small{display:block;color:var(--muted);font-size:13px;margin-top:3px;line-height:1.35}
.cl-ic{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#8fc7ff;color:#0d2236;font-size:20px}
.cl-off{background:none;border:0;color:var(--muted);text-decoration:underline;font:inherit;font-size:13px;padding:10px 0 0;cursor:pointer}
.hm-cloud{display:inline-flex;align-items:center;vertical-align:middle;white-space:nowrap;margin:8px 0 0 6px;height:32px;padding:0 12px;border-radius:99px;border:1.5px solid #8fc7ff;background:rgb(143 199 255/.12);color:#bfe0ff;font-weight:700;font-size:14px;cursor:pointer;flex:none}
.hm-cloud[hidden]{display:none}
.cl-box p{line-height:1.45}
.cl-pick{display:flex;flex-direction:column;gap:8px;margin:6px 0 10px}.cl-pick .btn{display:block;text-align:left;padding:10px 14px;min-height:56px}.cl-pick small{display:block;font-weight:500;font-size:12.5px;opacity:.8;margin-top:2px}
`;document.head.appendChild(st)}
try{CLOUD.init()}catch(e){console.warn('cloud',e)}
