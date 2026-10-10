/* ---------- Panyard: falling lanes + play-along scoring ---------- */
// Two lanes, one per pan (in the order they sit on screen). Each note falls and lands on the glowing
// line at the moment it's played. Tap the right note on the pans while the song plays to score:
// Perfect / Great / Good, with a streak that keeps counting until you miss one.
const GAME={judged:new Set(),streak:0,best:0,hits:0,notes:0,pops:[],lastTap:-1e9,lastT:0};
try{GAME.best=+localStorage.getItem('panyard-best')||0}catch{}
const LANE_COL={ec:'#ff8a5c',bf:'#3fd0d4'};
function laneOf(id){const k=EC_IDS.has(id)?'ec':'bf';return (S.swapped?(k==='ec'?1:0):(k==='ec'?0:1))}
function drawLanes(t){
  const cv=$('lanes');if(!cv||!cv.offsetParent)return;
  const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const FF=getComputedStyle(document.body).fontFamily,DF='Unbounded, '+FF;
  const gap=8,lw=(W-gap)/2,hitY=H-16,P=(hitY-10)/2.2;   // 2.2 seconds of notes on screen
  const keys=S.swapped?['bf','ec']:['ec','bf'];
  // lane floors
  for(let L=0;L<2;L++){const x=L*(lw+gap);
    g.fillStyle='#1a1430';g.beginPath();g.roundRect?g.roundRect(x,0,lw,H,[18,18,6,6]):g.rect(x,0,lw,H);g.fill();
    g.fillStyle=LANE_COL[keys[L]];g.globalAlpha=.07;g.fillRect(x,hitY-60,lw,60);g.globalAlpha=1;
    g.fillStyle=LANE_COL[keys[L]];g.globalAlpha=.55;g.font='700 10px '+DF;g.textAlign='center';g.textBaseline='top';g.fillText(keys[L]==='ec'?'E / C':'B / F',x+lw/2,10);g.globalAlpha=1}
  // notes
  const from=t-0.35,to=t+(hitY+40)/P;
  let lo=0,hi=hwItems.length;while(lo<hi){const m=(lo+hi)>>1;if(hwItems[m].t+hwItems[m].d<from)lo=m+1;else hi=m}
  g.textBaseline='middle';
  for(let i=lo;i<hwItems.length;i++){
    const n=hwItems[i];if(n.t>to)break;
    const yHit=hitY-(n.t-t)*P,len=30,tail=Math.min(n.d*P,220),on=n.t<=t&&t<n.t+n.d,past=n.t+n.d<=t;
    const perLane=[[],[]];n.ids.forEach(id=>perLane[laneOf(id)].push(id));
    const xs=[];
    perLane.forEach((ids,L)=>ids.forEach((id,k)=>{
      const sub=(lw-16)/ids.length,x=L*(lw+gap)+8+k*sub+2,w=sub-4,y=yHit-len;
      const col=LANE_COL[keys[L]],done=GAME.judged.has(i+':'+id);
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
  if(GAME.streak>1||GAME.best){g.textAlign='center';g.textBaseline='top';
    if(GAME.streak>1){g.font='700 15px '+DF;const tw=g.measureText('×'+GAME.streak).width+18;g.fillStyle='rgba(17,12,32,.85)';g.beginPath();g.roundRect?g.roundRect(W/2-tw/2,6,tw,24,12):g.rect(W/2-tw/2,6,tw,24);g.fill();
      g.fillStyle='#ffd166';g.fillText('×'+GAME.streak,W/2,10)}
    g.font='600 10px '+FF;g.fillStyle='#9d93c9';g.fillText('best '+GAME.best,W/2,GAME.streak>1?34:10)}
  if(!hwItems.length){g.fillStyle='#9d93c9';g.font='14px '+FF;g.textAlign='center';g.fillText('Your notes will fall here as the song plays',W/2,H/2)}
  // notes that went past while you were playing along count as missed
  if(!audio.paused&&now-GAME.lastTap<4000){
    for(let i=lo;i<hwItems.length;i++){const n=hwItems[i];if(n.t>t-0.3)break;
      for(const id of n.ids){const k=i+':'+id;if(!GAME.judged.has(k)&&n.t>GAME.lastT-1){GAME.judged.add(k);GAME.streak=0;GAME.notes++;pop('miss',laneOf(id),'#7d73ad')}}}
  }
  if(t<GAME.lastT-0.5){GAME.judged.clear();GAME.streak=0}   // jumped back: start counting again
  GAME.lastT=t;
}
function pop(text,L,col,big){const cv=$('lanes');const W=cv?cv.clientWidth:300,lw=(W-8)/2;GAME.pops.push({text,col,big,at:performance.now(),x:L*(lw+8)+lw/2})}
document.addEventListener('pointerdown',e=>{
  const el=e.target.closest&&e.target.closest('#playPans .field');if(!el||audio.paused||!hasAudio)return;
  const id=el.dataset.field,t=playTime()-(S.tapLag||0);GAME.lastTap=performance.now();
  el.classList.add('hit');setTimeout(()=>el.classList.remove('hit'),160);
  let best=null,bd=1e9;
  for(let i=0;i<hwItems.length;i++){const n=hwItems[i];if(n.t>t+0.4)break;if(n.t<t-0.4||!n.ids.includes(id)||GAME.judged.has(i+':'+id))continue;
    const d=Math.abs(n.t-t);if(d<bd){bd=d;best=i}}
  const L=laneOf(id);
  if(best===null||bd>0.26){GAME.streak=0;pop('✕',L,'#7d73ad');return}
  GAME.judged.add(best+':'+id);GAME.notes++;GAME.hits++;GAME.streak++;
  if(GAME.streak>GAME.best){GAME.best=GAME.streak;try{localStorage.setItem('panyard-best',GAME.best)}catch{}}
  const early=hwItems[best].t>t;
  if(bd<=0.08)pop('Perfect',L,'#ffd166',true);else if(bd<=0.16)pop('Great',L,LANE_COL[EC_IDS.has(id)?'ec':'bf']);else pop(early?'Early':'Late',L,'#cfc6f2');
  if(GAME.streak&&GAME.streak%10===0)pop(GAME.streak+' streak!',L===0?1:0,'#ff6fae',true);
},true);
{const _drawHW=drawHW;drawHW=function(t){_drawHW(t);drawLanes(t)}}
window.addEventListener('resize',()=>drawLanes(viewT));
