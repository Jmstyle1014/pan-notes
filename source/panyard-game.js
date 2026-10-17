/* ---------- Panyard: falling lanes + play-along scoring ---------- */
// Two lanes, one per pan (in the order they sit on screen). Each note falls and lands on the glowing
// line at the moment it's played. Tap the right note on the pans while the song plays to score:
// Perfect / Great / Good, with a streak that keeps counting until you miss one.
const GAME={judged:new Set(),hitKeys:new Set(),streak:0,best:0,hits:0,notes:0,pops:[],lastTap:-1e9,lastT:0};
try{GAME.best=+localStorage.getItem('panyard-best')||0}catch{}
const LANE_COL={ec:'#ff8a5c',bf:'#3fd0d4'};
const NOTE_W=54;   // how wide a falling note is, in pixels
// one lane per pan, ring or drum of this song's pan, in screen order
const laneKeys=()=>groupsNow().map(g=>g.key);
const laneCol=k=>LANE_COL[k]||grpColor(k);
function laneOf(id){return Math.max(0,laneKeys().indexOf(grpOf(id)))}
function drawLanes(t){
  const cv=$('lanes');if(!cv||!cv.offsetParent)return;
  const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const FF=getComputedStyle(document.body).fontFamily,DF='Unbounded, '+FF;
  const keys=laneKeys(),NL=keys.length,gap=NL>3?4:8,lw=(W-gap*(NL-1))/NL,hitY=H-16,P=(hitY-10)/2.2;   // 2.2 seconds of notes on screen
  // lane floors
  for(let L=0;L<NL;L++){const x=L*(lw+gap);
    g.fillStyle='#1a1430';g.beginPath();g.roundRect?g.roundRect(x,0,lw,H,[18,18,6,6]):g.rect(x,0,lw,H);g.fill();
    g.fillStyle=laneCol(keys[L]);g.globalAlpha=.07;g.fillRect(x,hitY-60,lw,60);g.globalAlpha=1;
    g.fillStyle=laneCol(keys[L]);g.globalAlpha=.55;g.font='700 10px '+DF;g.textAlign='center';g.textBaseline='top';g.fillText(groupsNow()[L].short,x+lw/2,10,lw-4);g.globalAlpha=1}
  // notes
  const from=t-0.35,to=t+(hitY+40)/P;
  let lo=0,hi=hwItems.length;while(lo<hi){const m=(lo+hi)>>1;if(hwItems[m].t+hwItems[m].d<from)lo=m+1;else hi=m}
  g.textBaseline='middle';
  for(let i=lo;i<hwItems.length;i++){
    const n=hwItems[i];if(n.t>to)break;
    const yHit=hitY-(n.t-t)*P,len=30,tail=Math.min(n.d*P,220),on=n.t<=t&&t<n.t+n.d,past=n.t+n.d<=t;
    const perLane=keys.map(()=>[]);n.ids.forEach(id=>perLane[laneOf(id)].push(id));
    const xs=[];
    perLane.forEach((ids,L)=>ids.forEach((id,k)=>{
      // notes are a fixed size, centred in their lane (side by side when a pan plays two at once)
      const w=Math.max(10,Math.min(NOTE_W,(lw-(NL>3?6:16))/ids.length-(NL>3?2:6))),x=L*(lw+gap)+(lw-(ids.length*w+(ids.length-1)*6))/2+k*(w+6),y=yHit-len;
      const col=laneCol(keys[L]),done=GAME.judged.has(i+':'+id);
      g.globalAlpha=past?.18:1;
      // how long it lasts: a thin trail behind the note (wavy for a roll)
      if(tail>len+6){g.strokeStyle=col;g.lineWidth=n.fx==='roll'?3:4;g.globalAlpha=(past?.12:.45);g.beginPath();
        for(let yy=y;yy>=yHit-tail;yy-=3){const xx=x+w/2+(n.fx==='roll'?Math.sin(yy/5)*4:0);yy===y?g.moveTo(xx,yy):g.lineTo(xx,yy)}g.stroke();g.globalAlpha=past?.18:1}
      g.beginPath();g.roundRect?g.roundRect(x,y,w,len,10):g.rect(x,y,w,len);
      if(on||done){g.fillStyle=col;g.shadowColor=col;g.shadowBlur=on?22:0;g.fill();g.shadowBlur=0}
      else{g.fillStyle='rgba(26,20,48,.9)';g.fill();g.lineWidth=2.5;g.strokeStyle=col;g.stroke()}
      g.fillStyle=on||done?'#1a1030':col;g.font='700 '+(ids.length>1?13:16)+'px '+DF;g.textAlign='center';
      g.fillText(FIELDS.get(id).label,x+w/2,yHit-15);
      if(n.fx){g.font='700 11px '+FF;g.fillStyle='#ffd166';g.fillText(MARKS[n.fx],x+w-8,y+10)}
      xs.push(x+w/2);g.globalAlpha=1;
    }));
    if(xs.length>1&&perLane[0].length&&perLane[1].length){g.globalAlpha=past?.15:.6;g.strokeStyle='#efeaff';g.lineWidth=2;g.beginPath();g.moveTo(Math.min(...xs),yHit-2);g.lineTo(Math.max(...xs),yHit-2);g.stroke();g.globalAlpha=1}
  }
  // the line you play on
  g.shadowColor='#efeaff';g.shadowBlur=14;g.fillStyle='#efeaff';g.fillRect(0,hitY-1.5,W,3);g.shadowBlur=0;
  // ratings floating up from the line, and the streak
  const now=performance.now();GAME.pops=GAME.pops.filter(p=>now-p.at<700);
  for(const p of GAME.pops){const a=(now-p.at)/700;g.globalAlpha=1-a;g.fillStyle=p.col;g.font='700 '+(p.big?20:15)+'px '+DF;g.textAlign='center';g.fillText(p.text,p.x,hitY-34-a*40);g.globalAlpha=1}
  if(GM.state!=='run'&&(GAME.streak>1||GAME.best)){g.textAlign='center';g.textBaseline='top';
    if(GAME.streak>1){g.font='700 15px '+DF;const tw=g.measureText('×'+GAME.streak).width+18;g.fillStyle='rgba(17,12,32,.85)';g.beginPath();g.roundRect?g.roundRect(W/2-tw/2,6,tw,24,12):g.rect(W/2-tw/2,6,tw,24);g.fill();
      g.fillStyle='#ffd166';g.fillText('×'+GAME.streak,W/2,10)}
    g.font='600 10px '+FF;g.fillStyle='#9d93c9';g.fillText('best '+GAME.best,W/2,GAME.streak>1?34:10)}
  if(!hwItems.length){g.fillStyle='#9d93c9';g.font='14px '+FF;g.textAlign='center';g.fillText('Your notes will fall here as the song plays',W/2,H/2)}
  // notes that went past while you were playing along count as missed (in a challenge, always)
  if(!audio.paused&&(GM.state==='run'||now-GAME.lastTap<4000)){
    const late=win().ok+0.04;
    for(let i=lo;i<hwItems.length;i++){const n=hwItems[i];if(n.t>t-late)break;
      for(const id of n.ids){const k=i+':'+id;if(!GAME.judged.has(k)&&n.t>GAME.lastT-1){GAME.judged.add(k);GAME.streak=0;GAME.notes++;pop('miss',laneOf(id),'#7d73ad')}}}
  }
  if(t<GAME.lastT-0.5){GAME.judged.clear();GAME.hitKeys.clear();GAME.streak=0}   // jumped back: start counting again
  GAME.lastT=t;
}
function pop(text,L,col,big){const cv=$('lanes');const W=cv?cv.clientWidth:300,NL=laneKeys().length,gap=NL>3?4:8,lw=(W-gap*(NL-1))/NL;GAME.pops.push({text,col,big,at:performance.now(),x:L*(lw+gap)+lw/2})}
// how close a tap has to be (seconds) for each rating; Relaxed timing in a challenge gives more leeway
function win(){return GM.state==='run'&&GM.timing==='relaxed'?{perfect:0.12,great:0.22,ok:0.35}:{perfect:0.08,great:0.16,ok:0.26}}
document.addEventListener('pointerdown',e=>{
  const el=e.target.closest&&e.target.closest('#playPans .field');if(!el||audio.paused||!hasAudio)return;
  const id=el.dataset.field,t=playTime()-(S.tapLag||0),W=win();GAME.lastTap=performance.now();
  el.classList.add('hit');setTimeout(()=>el.classList.remove('hit'),160);
  let best=null,bd=1e9;
  for(let i=0;i<hwItems.length;i++){const n=hwItems[i];if(n.t>t+W.ok+0.1)break;if(n.t<t-W.ok-0.1||!n.ids.includes(id)||GAME.judged.has(i+':'+id))continue;
    const d=Math.abs(n.t-t);if(d<bd){bd=d;best=i}}
  const L=laneOf(id);
  if(best===null||bd>W.ok){GAME.streak=0;pop('✕',L,'#7d73ad');return}
  GAME.judged.add(best+':'+id);GAME.hitKeys.add(best+':'+id);GAME.notes++;GAME.hits++;GAME.streak++;
  if(GAME.streak>GAME.best){GAME.best=GAME.streak;try{localStorage.setItem('panyard-best',GAME.best)}catch{}}
  const early=hwItems[best].t>t,kind=bd<=W.perfect?'perfect':bd<=W.great?'great':'ok';
  if(kind==='perfect')pop('Perfect',L,'#ffd166',true);else if(kind==='great')pop('Great',L,laneCol(grpOf(id)));else pop(early?'Early':'Late',L,'#cfc6f2');
  if(GAME.streak&&GAME.streak%10===0)pop(GAME.streak+' streak!',L===0?1:0,'#ff6fae',true);
  if(GM.state==='run')gameHit(kind);
},true);

/* ---------- Panyard: the Game tab (play a whole song for a score) ---------- */
// Pick a speed and how strict the timing is, count in 3-2-1, play the song through, get a score and stars.
// Points: Perfect 100, Great 70, Early/Late 30, multiplied by your streak (x2 at 10, x3 at 25, x4 at 50).
// Stars: 1 at 60% of notes hit, 2 at 80%, 3 at 95%. Best scores are kept on this phone, per song and speed.
const GM={sec:-1,start:0,state:'ready',speed:'normal',timing:'strict',score:0,counts:{perfect:0,great:0,ok:0},maxStreak:0,total:0,end:0,countAt:0,prevRate:1,result:null,hard:null};
const PTS={perfect:100,great:70,ok:30};
try{const o=JSON.parse(localStorage.getItem('panyard-game-opts')||'{}');if(o.speed==='slow')GM.speed='slow';if(o.timing==='relaxed')GM.timing='relaxed'}catch{}
const mult=s=>s>=50?4:s>=25?3:s>=10?2:1;
function gameBests(){try{return JSON.parse(localStorage.getItem('panyard-game-best')||'{}')||{}}catch{return{}}}
const songName=()=>S.title||(isDemo?'Example tones':'Untitled song');
const gmSecs=()=>{try{return sectionsNow()}catch{return []}};
const bestKey=()=>songName()+'|'+GM.speed+(GM.sec>=0&&gmSecs()[GM.sec]?'|'+gmSecs()[GM.sec].name:'');
const starsFor=pct=>pct>=0.95?3:pct>=0.8?2:pct>=0.6?1:0;
const starTxt=n=>'★'.repeat(n)+'☆'.repeat(3-n);
function setGameState(st){GM.state=st;document.body.dataset.game=st;renderGame()}
function renderGame(){
  const b=gameBests()[bestKey()];
  $('gmSong').textContent=songName();
  $('gmBest').textContent=b?'Best: '+b.score.toLocaleString()+' · '+starTxt(b.stars):'No score yet at this speed';
  $('gmSpeed').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===GM.speed)));
  $('gmTiming').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===GM.timing)));
  // play the whole song, or just one of your sections
  const secs=gmSecs();if(GM.sec>=secs.length)GM.sec=-1;
  $('gmSecLab').hidden=!secs.length;
  $('gmSecs').innerHTML='<button class="secchip'+(GM.sec<0?' on':'')+'" data-gs="-1">Whole song</button>'+secs.map((x,i)=>'<button class="secchip'+(GM.sec===i?' on':'')+'" data-gs="'+i+'">'+esc(x.name)+'<small>'+tShort(x.t)+'</small></button>').join('');
  const ok=hasAudio&&hwItems.length;$('gmStart').disabled=!ok;
  $('gmNeed').hidden=!!ok;$('gmNeed').textContent=!hasAudio?'Choose your recording in Setup first, then come back to play.':'Write some cues for this song first, then come back to play.';
  if(GM.state==='done'&&GM.result){const r=GM.result;
    $('gmScore').textContent=r.score.toLocaleString();
    $('gmStars').innerHTML=[0,1,2].map(i=>'<span class="'+(i<r.stars?'lit':'')+'">★</span>').join('');
    $('gmPct').textContent=Math.round(r.pct*100)+'% of notes hit'+(GM.speed==='slow'?' · slow speed':'');
    $('gmPerfect').textContent=r.counts.perfect;$('gmGreat').textContent=r.counts.great;$('gmOk').textContent=r.counts.ok;$('gmMiss').textContent=r.miss;
    $('gmPB').textContent=r.pb?'★ New personal best! Longest streak '+r.maxStreak:'Longest streak '+r.maxStreak;$('gmPB').classList.toggle('pb',!!r.pb);
    $('gmHard').hidden=!GM.hard;
  }
}
function gameHud(t){
  if(GM.state!=='run')return;
  $('gmLive').textContent=GM.score.toLocaleString();
  $('gmMult').textContent='×'+mult(GAME.streak)+' · streak '+GAME.streak;
  $('gmBar').style.width=Math.max(0,Math.min(100,(t-GM.start)/Math.max(0.1,GM.end-GM.start)*100))+'%';
}
function gameHit(kind){
  GM.counts[kind]++;GM.score+=PTS[kind]*mult(GAME.streak);GM.maxStreak=Math.max(GM.maxStreak,GAME.streak);
}
function startGame(){
  if(!hasAudio||!hwItems.length){renderGame();return}
  try{localStorage.setItem('panyard-game-opts',JSON.stringify({speed:GM.speed,timing:GM.timing}))}catch{}
  audio.pause();loop=false;renderLoop();
  GM.prevRate=audio.playbackRate||1;setRate(GM.speed==='slow'?0.75:1);
  GM.score=0;GM.counts={perfect:0,great:0,ok:0};GM.maxStreak=0;GM.result=null;GM.hard=null;
  const sec=GM.sec>=0?gmSecs()[GM.sec]:null,inR=n=>!sec||(n.t>=sec.t-0.05&&n.t<sec.end-0.05);
  GM.start=sec?sec.t:0;GM.inR=inR;
  GM.total=hwItems.filter(inR).reduce((a,n)=>a+n.ids.length,0);
  GM.end=sec?Math.min(sec.end,audio.duration||1e9):Math.min(audio.duration||1e9,Math.max(...hwItems.map(n=>n.t+n.d))+1.5);
  GAME.judged.clear();GAME.hitKeys.clear();GAME.streak=0;GAME.pops=[];
  audio.currentTime=GM.start;GAME.lastT=GM.start;
  setGameState('run');gameHud(0);
  GM.countAt=performance.now();countIn();
}
// 3, 2, 1: the first notes fall in while you count, so they land on the line right as the song starts
function countIn(){
  if(GM.state!=='run'||!GM.countAt)return;
  const left=3-(performance.now()-GM.countAt)/1000;
  if(left<=0){GM.countAt=0;$('gmCount').hidden=true;audio.play().catch(()=>say('Tap play to start.'));return}
  $('gmCount').hidden=false;$('gmCount').textContent=Math.ceil(left);
  drawLanes(GM.start-left*(audio.playbackRate||1));requestAnimationFrame(countIn);
}
function finishGame(){
  if(GM.state!=='run')return;
  audio.pause();
  const hits=GM.counts.perfect+GM.counts.great+GM.counts.ok,pct=GM.total?hits/GM.total:0,stars=starsFor(pct);
  // the hard part: the 8 seconds with the most missed notes
  const missed=[];hwItems.forEach((n,i)=>{if(GM.inR&&!GM.inR(n))return;n.ids.forEach(id=>{if(!GAME.hitKeys.has(i+':'+id))missed.push(n.t)})});
  if(typeof markDone==='function')markDone('practised');
  let hard=null,most=0;for(const m of missed){const c=missed.filter(x=>x>=m&&x<m+8).length;if(c>most){most=c;hard=m}}
  GM.hard=most>=2?hard:null;
  const all=gameBests(),k=bestKey(),old=all[k],pb=!old||GM.score>old.score;
  if(pb){all[k]={score:GM.score,stars,streak:GM.maxStreak};try{localStorage.setItem('panyard-game-best',JSON.stringify(all))}catch{}}
  GM.result={score:GM.score,stars,pct,counts:{...GM.counts},miss:GM.total-hits,maxStreak:GM.maxStreak,pb:pb&&GM.score>0&&!!old};
  setRate(GM.prevRate);setGameState('done');window.scrollTo({top:0});
}
function quitGame(){GM.countAt=0;$('gmCount').hidden=true;if(GM.state==='run'){audio.pause();setRate(GM.prevRate)}setGameState('ready')}
function practiseHard(){
  if(GM.hard===null)return;
  A=Math.max(0,GM.hard-1);B=Math.min(audio.duration||GM.hard+9,GM.hard+8);loop=true;renderLoop();
  setRate(0.75);setGameState('ready');showView('play');audio.currentTime=A;audio.play().catch(()=>{});
  say('Looping '+fmt(A)+' → '+fmt(B)+' at 0.75×, where you missed the most notes.');
}
$('gmSpeed').querySelectorAll('button').forEach(b=>b.onclick=()=>{GM.speed=b.dataset.v;renderGame()});
$('gmTiming').querySelectorAll('button').forEach(b=>b.onclick=()=>{GM.timing=b.dataset.v;renderGame()});
$('gmStart').onclick=startGame;$('gmAgain').onclick=startGame;$('gmQuit').onclick=quitGame;$('gmHard').onclick=practiseHard;
$('gmBack').onclick=()=>setGameState('ready');
$('gmSecs').addEventListener('click',e=>{const b=e.target.closest('[data-gs]');if(!b)return;GM.sec=+b.dataset.gs;renderGame()});
// the song reaching its end (or the last note going by) finishes the challenge
audio.addEventListener('ended',finishGame);
// Game is its own tab, but it uses the Play screen's lanes and pans
{const _show=showView;showView=function(v){
  const game=v==='game';if(!game)quitGame();
  _show(game?'play':v);document.body.classList.toggle('gametab',game);
  document.querySelectorAll('.tabs button[data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));
  if(game)renderGame();
}}
document.querySelector('.tabs button[data-view="game"]').onclick=()=>showView('game');
{const _drawHW=drawHW;drawHW=function(t){_drawHW(t);drawLanes(t);if(GM.state==='run'&&!audio.paused){gameHud(t);if(t>=GM.end)finishGame()}}}
window.addEventListener('resize',()=>drawLanes(viewT));
setGameState('ready');
