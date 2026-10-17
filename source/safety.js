/* ---------- keeping your work safe: storage that stays, backup reminders, and a calm message if something breaks ---------- */
const SAFE={
  shown:{},
  ago(t){const d=Math.floor((Date.now()-t)/86400000);return d<1?'today':d===1?'yesterday':d+' days ago'},
  last(){try{return +localStorage.getItem('pan-lastBackup')||0}catch{return 0}},
  // a small card at the top of the screen, clear of the play bar; one at a time, newest wins
  // gentle reminders (inline) sit at the top of Play or Home and never cover a button; urgent ones float at the top
  notice(key,html,btns,inline){
    const id=inline?'safeInline':'safeNote';let n=document.getElementById(id);
    if(!n){n=document.createElement('div');n.id=id;n.setAttribute('role','status');if(inline){n.className='panel';const v=$('view-home')||$('view-play');v.parentNode.insertBefore(n,$('view-home')||$('view-play'))}else document.body.appendChild(n)}
    if(inline)this.hide(key);
    n.dataset.key=key;n.innerHTML='<p>'+html+'</p><div>'+btns.map((b,i)=>'<button class="btn'+(i===0?' primary':'')+'" data-i="'+i+'">'+b[0]+'</button>').join('')+'</div>';
    n.hidden=false;n.onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;n.hidden=true;const f=btns[+b.dataset.i][1];if(f)f()};
  },
  hide(key){for(const id of['safeNote','safeInline']){const n=document.getElementById(id);if(n&&n.dataset.key===key)n.hidden=true}},
  // ask the phone to keep the app's saved songs, even when it's short of space
  persisted:null,
  async keep(){try{if(navigator.storage&&navigator.storage.persist){this.persisted=await navigator.storage.persisted()||await navigator.storage.persist()}}catch{}renderSaveInfo()},
  standalone:()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true,
  ios:()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),
  snoozed(k){try{return +localStorage.getItem('pan-snooze-'+k)>Date.now()}catch{return false}},
  snooze(k,days){try{localStorage.setItem('pan-snooze-'+k,Date.now()+days*86400000)}catch{}},
  // gentle nudges, at most one when the app opens
  nudge(){
    if(isDemo)return;
    const real=S.cues.length>=8,last=this.last();
    if(window.PAN_APP&&this.ios()&&!this.standalone()&&!this.snoozed('home')){
      this.notice('home','<b>Keep your songs safe:</b> tap the Share button in Safari, then <b>Add to Home Screen</b>. iPhones can clear saved data for websites that aren’t on the Home Screen.',[['Got it',()=>this.snooze('home',30)]],true);return}
    if(real&&!this.snoozed('backup')&&(last?Date.now()-last>14*86400000:true)){
      this.notice('backup',(last?'Your last backup was '+this.ago(last)+'.':'You haven’t saved a backup yet.')+' A backup file keeps a copy of your notes somewhere safe.',
        [['Save backup',()=>$('expJson').click()],['Later',()=>this.snooze('backup',3)]],true)}
  },
  // something broke: say so plainly, keep the work, offer a fresh start
  oops(msg){
    if(this.shown.oops&&Date.now()-this.shown.oops<60000)return;this.shown.oops=Date.now();
    try{save()}catch{}
    this.notice('oops','<b>Something went wrong.</b> Your notes are saved. If the app stops responding, reload it.',
      [['Reload',()=>location.reload()],['Copy details',()=>{try{navigator.clipboard.writeText(String(msg).slice(0,2000)).then(()=>say('Details copied. Send them to whoever helps you with the app.'),()=>say(String(msg).slice(0,300)))}catch{}}],['Close',null]]);
  }
};
{const st=document.createElement('style');st.textContent='#safeNote{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:30;max-width:520px;margin:0 auto;background:var(--raised,#222);color:var(--text,#fff);border:1px solid var(--line,#444);border-radius:16px;padding:12px 14px;box-shadow:0 10px 30px rgb(0 0 0 / .4);display:flex;flex-direction:column;gap:10px}#safeNote[hidden]{display:none}#safeNote p{margin:0;font-size:14.5px;line-height:1.4}#safeNote div{display:flex;gap:8px;flex-wrap:wrap}#safeNote .btn{min-height:40px}#safeInline{display:flex;flex-direction:column;gap:10px;margin:0 auto 12px;max-width:760px}#safeInline[hidden]{display:none}#safeInline p{margin:0;font-size:14.5px;line-height:1.4}#safeInline div{display:flex;gap:8px;flex-wrap:wrap}body:not([data-view="play"]):not([data-view="home"]) #safeInline{display:none}';document.head.appendChild(st)}
{const _rsi=renderSaveInfo;renderSaveInfo=function(){_rsi();const el=$('saveInfo');if(!el)return;const last=SAFE.last();
  el.textContent+=(SAFE.persisted===true?' This phone has agreed to keep your songs.':'')+' Last backup: '+(last?SAFE.ago(last):'none yet')+'.'}}
{const _bk=$('expJson').onclick;$('expJson').onclick=async function(e){await _bk.call(this,e);try{localStorage.setItem('pan-lastBackup',Date.now())}catch{}SAFE.hide('backup');renderSaveInfo()}}
window.addEventListener('error',e=>{const m=e&&(e.message||'');if(!m||/ResizeObserver|Script error/i.test(m))return;SAFE.oops(m+(e.filename?' @ '+e.filename.split('/').pop()+':'+e.lineno:''))});
window.addEventListener('unhandledrejection',e=>{const r=e&&e.reason,n=r&&r.name||'';if(/NotAllowedError|AbortError|NotSupportedError|NotFoundError/.test(n))return;SAFE.oops((r&&(r.stack||r.message))||String(r))});
setTimeout(()=>{SAFE.keep();SAFE.nudge()},2500);
