
/* ---------- songs, auto tempo, sections everywhere, and the get-ready checklist ---------- */
/* Your songs: the open song uses the usual storage; the others wait on this device until you open them */
const SONG_KEYS=['title','cues','grid','chart','audioRef'];
let SONGS=null;
const newSongId=()=>'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
function songsInit(){
  if(SONGS)return SONGS;
  try{const x=JSON.parse(localStorage.getItem('pan-songs')||'null');if(x&&Array.isArray(x.list)&&x.list.length)SONGS=x}catch{}
  if(!SONGS){const id=newSongId();SONGS={active:id,list:[{id,title:S.title||'My song',n:isDemo?0:S.cues.length,rec:!!hasAudio,updated:Date.now(),done:{}}]};songsSave()}
  return SONGS;
}
const songsSave=()=>{try{localStorage.setItem('pan-songs',JSON.stringify(SONGS))}catch{}};
const songNow=()=>{songsInit();return SONGS.list.find(s=>s.id===SONGS.active)||SONGS.list[0]};
function songTouch(){if(isDemo)return;const s=songNow();if(!s)return;s.title=S.title||s.title||'Untitled song';s.n=S.cues.length;s.rec=!!hasAudio;s.updated=Date.now();songsSave()}
{const _save=save;save=function(){_save();songTouch()}}
function unloadAudio(){
  audio.pause();if(objUrl){URL.revokeObjectURL(objUrl);objUrl=null}
  audio.removeAttribute('src');try{audio.load()}catch{}
  hasAudio=false;curBlob=null;curName='';peakToken++;peaks=null;onsets=null;A=B=null;loop=false;renderLoop();
  $('playBtn').disabled=true;$('seek').disabled=true;$('recName').textContent='No recording';$('audioInfo').textContent='No recording yet.';tick();
}
async function songStash(){
  const cur={};SONG_KEYS.forEach(k=>cur[k]=S[k]);
  const a=await idbGet('audio');
  await idbPut('song:'+SONGS.active,{data:JSON.parse(JSON.stringify(cur)),audio:a&&a.blob?a:null});
}
async function songOpen(id,fresh){
  songsInit();if(id===SONGS.active&&!fresh)return;
  audio.pause();if(!isDemo)await songStash();
  const st=fresh?null:await idbGet('song:'+id);
  const d=(st&&st.data)||{};
  S.title=String(d.title||(SONGS.list.find(s=>s.id===id)||{}).title||'');S.cues=Array.isArray(d.cues)?d.cues:[];S.grid=d.grid||null;S.chart=d.chart||null;S.audioRef=d.audioRef||null;
  SONGS.active=id;songsSave();
  isDemo=false;undoStack=[];if(typeof selIds!=='undefined')selIds.clear();chartEditing=false;
  if(st&&st.audio&&st.audio.blob){await idbPut('audio',st.audio);loadAudio(st.audio.blob,st.audio.name)}
  else{await idbPut('audio',null);unloadAudio();if(S.audioRef&&typeof loadRecordingFromAccount==='function')loadRecordingFromAccount()}
  renderAll();renderDemo();save();renderSongs();renderChecklist();
  say(fresh?'New song. Add its recording to get started.':'Opened '+(S.title||'your song')+'.');
}
async function songNew(){songsInit();const id=newSongId();SONGS.list.unshift({id,title:'New song',n:0,rec:false,updated:Date.now(),done:{}});songsSave();await songOpen(id,true);S.title='New song';$('title').value=S.title;save();showView('setup')}
async function songDelete(id){
  songsInit();if(SONGS.list.length<2){say('This is your only song.');return}
  if(id===SONGS.active){const other=SONGS.list.find(s=>s.id!==id);await songOpen(other.id)}
  SONGS.list=SONGS.list.filter(s=>s.id!==id);songsSave();await idbPut('song:'+id,null);renderSongs();say('Song deleted.');
}
function renderSongs(){
  const box=$('songList');if(!box||$('songsSheet').hidden)return;songsInit();songTouch();
  box.innerHTML=SONGS.list.slice().sort((a,b)=>(b.id===SONGS.active)-(a.id===SONGS.active)||b.updated-a.updated).map(s=>
    '<div class="songrow'+(s.id===SONGS.active?' cur':'')+'"><button class="songopen" data-song="'+esc(s.id)+'"><b>'+esc(s.title||'Untitled song')+'</b><span>'+(s.n||0)+' cues · '+(s.rec?'recording ✓':'no recording')+(s.id===SONGS.active?' · open now':'')+'</span></button>'
    +'<button class="mini songdel" data-del="'+esc(s.id)+'" aria-label="Delete '+esc(s.title||'song')+'">🗑</button></div>').join('');
}
function openSongs(on){$('songsSheet').hidden=!on;if(on){songsInit();renderSongs()}}
$('songList').addEventListener('click',e=>{
  const o=e.target.closest('[data-song]');if(o){openSongs(false);songOpen(o.dataset.song);return}
  const d=e.target.closest('[data-del]');if(d){if(d.dataset.armed!=='1'){d.dataset.armed='1';d.textContent='Delete?';setTimeout(()=>{d.dataset.armed='';d.textContent='🗑'},3000);return}songDelete(d.dataset.del)}
});
$('songNew').onclick=()=>{openSongs(false);songNew()};
$('songsClose').onclick=()=>openSongs(false);
$('songsSheet').addEventListener('click',e=>{if(e.target===$('songsSheet'))openSongs(false)});
document.querySelectorAll('[data-open-songs]').forEach(b=>b.addEventListener('click',()=>openSongs(true)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('songsSheet').hidden)openSongs(false)});

/* Find the tempo: line a beat grid up with the drum hits in your recording */
function findTempo(){
  const on=(onsets||[]).filter(t=>t>0.2);if(on.length<16)return null;
  const N=on.length,SIG=0.025,G2=2*SIG*SIG;
  // louder hits count more, so the beat lands on the drums rather than the light off-beat sounds
  const lvl=t=>{if(!peaks)return 1;let m=0;const i=Math.round(t*peakRate);for(let j=i-2;j<=i+2;j++)if(peaks[j]>m)m=peaks[j];return 0.2+m*m};
  const W=on.map(lvl),WS=W.reduce((a,b)=>a+b,0);
  const fit=(bpm,step)=>{const b=60/bpm;let best=-1,ph=0;for(let p=0;p<b;p+=step){let s=0;for(let k=0;k<N;k++){const t=on[k],d=((t-p)%b+b)%b,e=Math.min(d,b-d);s+=W[k]*Math.exp(-e*e/G2)}if(s>best){best=s;ph=p}}
    // compared with what random hits would score, so faster tempos don't win just by having more beats
    return {s:best/WS/(SIG*2.5066/b),ph}};
  let top=null;
  for(let bpm=70;bpm<=180;bpm+=0.5){const f=fit(bpm,0.01),prior=Math.exp(-Math.pow(Math.log2(bpm/112),2)/0.5),v=f.s*prior;if(!top||v>top.v)top={bpm,v,ph:f.ph}}
  for(let bpm=top.bpm-0.6;bpm<=top.bpm+0.6;bpm+=0.05){const f=fit(bpm,0.004),v=f.s*Math.exp(-Math.pow(Math.log2(bpm/112),2)/0.5);if(v>top.v)top={bpm,v,ph:f.ph}}
  const b=60/top.bpm;
  // the bar line: of the four beats, the one where the music is loudest
  const loud=t=>{if(!peaks)return 0;let m=0;const i=Math.round(t*peakRate);for(let j=i-3;j<=i+3;j++)if(peaks[j]>m)m=peaks[j];return m};
  let bestJ=0,bestL=-1;
  for(let j=0;j<4;j++){let L=0;for(let t=top.ph+j*b;t<(peaks?peaks.length/peakRate:on[N-1]);t+=4*b)L+=loud(t);if(L>bestL){bestL=L;bestJ=j}}
  const bar=4*b,off=((top.ph+bestJ*b)%bar+bar)%bar;
  return {bpm:Math.round(top.bpm*10)/10,offset:+off.toFixed(4),perBar:4,conf:top.v};
}
function runAutoTempo(){
  if(!hasAudio){say('Add the recording first, then the app can find its tempo.');return}
  if(!onsets){say('Still listening to your recording. Try again in a moment.');return}
  const g=findTempo();if(!g){say("Couldn't hear a steady beat in this recording. Tap the tempo in by hand instead.");return}
  S.grid={bpm:g.bpm,offset:g.offset,perBar:g.perBar};renderGrid();renderCues();drawTL();save();renderChecklist();
  say('Found about '+g.bpm+' BPM and set the bar lines. If they look off, nudge them with ◀ ▶ or Move bar line in Timing.');
}

/* Sections everywhere: from your chart, each with its start and end */
function sectionsNow(){
  const all=parseChart(chartText()).filter(s=>s.t!==null),d=Number.isFinite(audio.duration)?audio.duration:totalLen();
  return all.map((s,i)=>({name:s.name||'Section '+(i+1),t:s.t,end:all[i+1]?all[i+1].t:d}));
}
function loopSection(sec){
  if(!hasAudio){say('Add your recording in Setup to loop sections.');return}
  const on=loop&&A!==null&&Math.abs(A-sec.t)<0.05&&Math.abs(B-sec.end)<0.05;
  if(on){loop=false;renderLoop();say('Loop off.');return}
  A=sec.t;B=sec.end;loop=true;renderLoop();audio.currentTime=A;audio.play().catch(()=>{});
  markDone('practised');say('Looping '+sec.name+' ('+tShort(A)+'–'+tShort(B)+').');
}
function renderSecChips(){
  const box=$('secChips');if(!box)return;const secs=sectionsNow();
  $('secLab').hidden=!secs.length;
  box.innerHTML=secs.map((s,i)=>{const on=loop&&A!==null&&Math.abs(A-s.t)<0.05&&Math.abs(B-s.end)<0.05;
    return '<button class="secchip'+(on?' on':'')+'" data-sec="'+i+'" aria-pressed="'+on+'">'+(on?'⟲ ':'')+esc(s.name)+'<small>'+tShort(s.t)+'</small></button>'}).join('');
}
$('secChips').addEventListener('click',e=>{const b=e.target.closest('[data-sec]');if(!b)return;const s=sectionsNow()[+b.dataset.sec];if(s)loopSection(s)});
{const _rl=renderLoop;renderLoop=function(){_rl();try{renderSecChips()}catch{}}}
{const _rc=renderCues;renderCues=function(){_rc();try{renderSecChips();renderChecklist()}catch{}}}
// section names along the top of the timeline
{const _dt=drawTL;drawTL=function(){_dt();try{
  const cv=$('tl');if(!cv||!cv.offsetParent)return;const secs=sectionsNow();if(!secs.length)return;
  const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight,g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
  const P=pps(),cur=audio.paused?(audio.currentTime||0):viewT,X=t=>W/2+(t-cur)*P;if(!colors)colors=tokens();
  g.font='700 11px '+getComputedStyle(document.body).fontFamily;g.textBaseline='top';g.textAlign='left';
  for(const s of secs){const x=X(s.t);if(x>W||X(s.end)<0)continue;
    g.fillStyle=colors.gold;g.globalAlpha=.85;g.fillRect(x,0,2,H);g.globalAlpha=1;
    const lab=s.name.toUpperCase(),w=g.measureText(lab).width+10,lx=Math.max(x,Math.min(X(s.end)-w,2));
    g.fillStyle='rgba(0,0,0,.55)';g.fillRect(lx,2,w,15);g.fillStyle=colors.gold;g.fillText(lab,lx+5,4)}
}catch{}}}

/* Getting a song ready: five steps, each ticks itself off */
function markDone(k){const s=songNow();if(!s)return;s.done=s.done||{};if(!s.done[k]){s.done[k]=Date.now();songsSave();renderChecklist()}}
function checkSteps(){
  const secs=parseChart(chartText()),named=S.chart&&S.chart.edited&&secs.some(s=>s.name&&!/^(Section \d+|New section)/.test(s.name));
  const s=songNow()||{};
  return [
    {k:'rec',t:'Add the recording',ok:hasAudio,go:'Choose',act:()=>{showView('setup');setTimeout(()=>$('audioFile').closest('.panel').scrollIntoView({behavior:'smooth',block:'start'}),60)}},
    {k:'tempo',t:'Find the tempo',ok:!!S.grid,go:'Find it',act:runAutoTempo},
    {k:'cues',t:'Tap in your notes',ok:!isDemo&&S.cues.length>=8,go:'Write',act:()=>showView('cues')},
    {k:'secs',t:'Name your sections',ok:!!named,go:'Chart',act:()=>{showView($('view-part')?'part':'play');S.sheetView='chart';renderCues();setTimeout(()=>{openChartEditor();$('sheet').scrollIntoView({behavior:'smooth'})},60)}},
    {k:'practised',t:'Practise a section',ok:!!(s.done&&s.done.practised),go:'Practise',act:()=>{showView('play');setTimeout(()=>{const c=$('secChips');if(c)c.scrollIntoView({behavior:'smooth',block:'center'})},60)}}
  ];
}
function renderChecklist(){
  const box=$('checklist');if(!box)return;const s=songNow();
  if(isDemo||!s){box.hidden=true;return}
  const steps=checkSteps(),n=steps.filter(x=>x.ok).length;
  if(n===steps.length||(s.done&&s.done.hideList)){box.hidden=true;return}
  box.hidden=false;
  box.innerHTML='<div class="ckhead"><div><span class="eyebrow">Get this song ready</span><b>'+esc(S.title||'Your song')+' · '+n+' of '+steps.length+'</b></div><button class="mini" data-ck="hide" aria-label="Hide the checklist">Hide</button></div>'
    +'<div class="vidprog"><div style="height:100%;width:'+(n/steps.length*100)+'%;background:var(--gold)"></div></div>'
    +steps.map((x,i)=>'<div class="ckrow'+(x.ok?' ok':'')+'"><span class="ckmark" aria-hidden="true">'+(x.ok?'✓':i+1)+'</span><span class="cktxt">'+x.t+'</span>'+(x.ok?'':'<button class="btn" data-ck="'+i+'">'+x.go+'</button>')+'</div>').join('');
}
$('checklist').addEventListener('click',e=>{
  const b=e.target.closest('[data-ck]');if(!b)return;
  if(b.dataset.ck==='hide'){markDone('hideList');say('Checklist hidden for this song.');return}
  const st=checkSteps()[+b.dataset.ck];if(st)st.act();
});
audio.addEventListener('loadedmetadata',()=>{renderChecklist();renderSecChips()});
{const _rg=renderGrid;renderGrid=function(){_rg();try{renderChecklist()}catch{}}}
$('autoTempo').onclick=runAutoTempo;
setTimeout(()=>{songsInit();songTouch();renderChecklist();renderSecChips()},1500);
