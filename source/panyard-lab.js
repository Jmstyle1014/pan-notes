
/* ---------- Mallet Lab: play the pans with a game controller (test & calibration) ---------- */
// Left stick = left mallet over the left pan, right stick = right mallet over the right pan.
// "Aim + strike": point with the stick, hit with a shoulder button or trigger (analog triggers = how hard).
// "Flick": push the stick out quickly and the mallet strikes where you flicked; no buttons needed.
// Holding a strike button rolls. Everything is tuned here and saved on this device.
const LAB_STD=['A','B','X','Y','L1','R1','L2','R2','Select','Start','L3','R3','↑','↓','←','→','Home'];
const LAB_DEF={mode:'aim',dz:0.14,reach:0.9,flick:0.9,center:[0,0,0,0],range:[[-1,1],[-1,1],[-1,1],[-1,1]],
  map:{left:{type:'button',index:4},right:{type:'button',index:5}},axes:{left:[0,1],right:[2,3]},invertY:false};
let LAB=(()=>{try{return Object.assign({},LAB_DEF,JSON.parse(localStorage.getItem('panyard-lab')||'{}'))}catch{return {...LAB_DEF}}})();
const labSave=()=>{try{localStorage.setItem('panyard-lab',JSON.stringify(LAB))}catch{}};
const LS_SIDE={left:{},right:{}};   // live state per hand
let labRaf=0,labPadIdx=null,labWiz=null,labVirtual={left:null,right:null},labHits=0;
function labPad(){
  const pads=navigator.getGamepads?[...navigator.getGamepads()].filter(Boolean):[];
  if(labPadIdx!==null){const p=pads.find(q=>q.index===labPadIdx);if(p)return p}
  const p=pads.find(q=>q.buttons.some(b=>b.pressed)||q.axes.some(a=>Math.abs(a)>0.3))||pads[0]||null;
  if(p)labPadIdx=p.index;return p;
}
// raw stick → calibrated vector: re-centred, stretched to the stick's real range, dead zone removed
function labStick(pad,side){
  const [ax,ay]=LAB.axes[side];
  if(labVirtual[side])return {raw:labVirtual[side],v:labShape(labVirtual[side].x,labVirtual[side].y)};
  if(!pad)return {raw:{x:0,y:0},v:{x:0,y:0,m:0}};
  const rx=(pad.axes[ax]||0),ry=(pad.axes[ay]||0);
  const nx=labNorm(rx-LAB.center[ax],LAB.range[ax]),ny=labNorm(ry-LAB.center[ay],LAB.range[ay])*(LAB.invertY?-1:1);
  return {raw:{x:rx,y:ry},v:labShape(nx,ny)};
}
const labNorm=(d,r)=>d<0?-Math.min(1,d/(r[0]||-1)):Math.min(1,d/(r[1]||1));
function labShape(x,y){
  const m=Math.hypot(x,y);if(m<LAB.dz)return {x:0,y:0,m:0};
  const k=Math.min(1,(m-LAB.dz)/(1-LAB.dz))/m;return {x:x*k,y:y*k,m:Math.min(1,m*k)};
}
// how far a strike button is pressed (0..1), for buttons or analog triggers
function labPress(pad,side){
  if(labVirtual[side+'Hit'])return 1;
  const m=LAB.map[side];if(!pad||!m)return 0;
  if(m.type==='button'){const b=pad.buttons[m.index];return b?Math.max(b.value,b.pressed?1:0):0}
  const v=pad.axes[m.index]||0,rest=m.rest||0,dir=m.dir||1;return Math.max(0,Math.min(1,(v-rest)*dir/(m.span||1)));
}
// which note the mallet is over: inside a note's shape, else the nearest one
function labAim(side,v){
  const host=$('lab-'+side),svg=host&&host.querySelector('svg');if(!svg)return null;
  const p=PANS.find(q=>q.key===host.dataset.pan),reach=LAB.reach;
  const x=p.cx+v.x*p.rx*reach,y=p.cy+v.y*p.ry*reach;
  let best=null,bd=1e9;
  for(const f of p.fields){
    const el=host.querySelector('.field[data-field="'+f[0]+'"] .zone');
    try{if(el&&el.isPointInFill&&el.isPointInFill(new DOMPoint(x,y))){best=f[0];bd=0;break}}catch{}
    const d=Math.hypot(f[4]-x,f[5]-y);if(d<bd){bd=d;best=f[0]}
  }
  const cur=svg.querySelector('.labcur');if(cur){cur.setAttribute('cx',x);cur.setAttribute('cy',y)}
  return best;
}
function labStrike(side,id,vel,light){
  if(!id)return;strike(id,vel,light);labHits++;
  const el=document.querySelector('#lab-'+side+' .field[data-field="'+id+'"]');
  if(el){el.classList.remove('hit');void el.getBBox();el.classList.add('hit');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('hit'),light?90:180)}
  const s=LS_SIDE[side];s.last=FIELDS.get(id).label+' · '+Math.round(vel*100)+'%';
}
function labTick(){
  const pad=labPad(),now=performance.now();
  $('labPad').textContent=pad?(pad.id.replace(/\(.*?\)/g,'').trim()||'Controller')+(pad.mapping==='standard'?'':' (non-standard layout)'):(labVirtual.left||labVirtual.right?'On-screen sticks':'Press any button on your controller');
  $('labPad').classList.toggle('on',!!pad);
  if(labWiz)labWizTick(pad,now);
  for(const side of ['left','right']){
    const st=labStick(pad,side),s=LS_SIDE[side],press=labPress(pad,side),aimId=labAim(side,st.v);
    // hover highlight
    if(s.aim!==aimId){const host=$('lab-'+side);host.querySelectorAll('.field.aim').forEach(e=>e.classList.remove('aim'));const el=host.querySelector('.field[data-field="'+aimId+'"]');if(el)el.classList.add('aim');s.aim=aimId}
    if(!labWiz){
      if(LAB.mode==='aim'){
        // a strike starts when the button goes down; analog triggers give the strength from how fast they're pulled
        if(press>0.45&&!s.down){s.down=true;s.downAt=now;const sp=Math.min(1,(press-(s.prevPress||0))*4);labStrike(side,aimId,Math.max(0.35,Math.min(1,0.55+0.45*Math.max(sp,press>0.95?0.6:0))),false);s.nextRoll=now+HOLD_MS}
        else if(press<0.25&&s.down){s.down=false}
        else if(s.down&&now>=s.nextRoll){labStrike(side,aimId,0.5+Math.random()*0.25,true);s.nextRoll=now+60+Math.random()*18}
      }else{
        // flick: from near the middle to near the edge within 140 ms
        if(st.v.m<0.35){s.armed=true;s.armAt=now}
        if(s.armed&&st.v.m>=LAB.flick){s.armed=false;const dt=now-(s.armAt||now);if(dt<220){labStrike(side,aimId,Math.max(0.4,Math.min(1,1.1-dt/250)),false)}}
      }
    }
    s.prevPress=press;
    labDrawStick(side,st,press);
    $('lab'+(side==='left'?'L':'R')+'Info').textContent=(s.last||'—');
  }
  // every button, so you can see what the controller sends
  const bl=$('labBtns');
  if(pad){
    if(bl.childElementCount!==pad.buttons.length)bl.innerHTML=pad.buttons.map((b,i)=>'<span class="lbtn">'+(pad.mapping==='standard'&&LAB_STD[i]?LAB_STD[i]:'#'+i)+'</span>').join('');
    pad.buttons.forEach((b,i)=>{const e=bl.children[i];if(e){e.classList.toggle('on',b.pressed||b.value>0.4);e.style.setProperty('--v',b.value.toFixed(2))}});
    const extra=pad.axes.map((a,i)=>i>3?'axis '+i+': '+a.toFixed(2):'').filter(Boolean).join(' · ');$('labAxes').textContent=extra;
  }else{bl.innerHTML='';$('labAxes').textContent=''}
  labRaf=requestAnimationFrame(labTick);
}
function labDrawStick(side,st,press){
  const cv=$('labStick'+(side==='left'?'L':'R'));if(!cv)return;
  const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;if(!W)return;
  if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const cx=W/2,cy=H/2,R=Math.min(W,H)/2-8,col=side===(S.swapped?'right':'left')?'#ff8a5c':'#3fd0d4';
  g.strokeStyle='#30275a';g.lineWidth=2;g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.stroke();
  g.fillStyle='rgba(239,234,255,.06)';g.beginPath();g.arc(cx,cy,R*LAB.dz,0,Math.PI*2);g.fill();
  if(LAB.mode==='flick'){g.setLineDash([4,4]);g.strokeStyle='rgba(255,209,102,.5)';g.beginPath();g.arc(cx,cy,R*LAB.flick,0,Math.PI*2);g.stroke();g.setLineDash([])}
  g.fillStyle='rgba(157,147,201,.6)';g.beginPath();g.arc(cx+st.raw.x*R,cy+st.raw.y*R,4,0,Math.PI*2);g.fill();
  g.fillStyle=col;g.shadowColor=col;g.shadowBlur=12;g.beginPath();g.arc(cx+st.v.x*R,cy+st.v.y*R,9,0,Math.PI*2);g.fill();g.shadowBlur=0;
  // strike button as a ring that fills
  g.strokeStyle='#ffd166';g.lineWidth=4;g.beginPath();g.arc(cx,cy,R+4,-Math.PI/2,-Math.PI/2+Math.PI*2*press);g.stroke();
}
/* calibration wizard */
const WIZ=[
  {t:'Let go of both sticks and don\'t touch anything.',ms:1500},
  {t:'Roll both sticks slowly around their edges, two or three full circles.',ms:5000},
  {t:'Press the button or trigger you want for your LEFT mallet.',learn:'left'},
  {t:'Press the button or trigger you want for your RIGHT mallet.',learn:'right'}
];
function labWizStart(){
  const pad=labPad();if(!pad){labMsg('Press any button on your controller first so the app can see it.');return}
  labWiz={step:0,t0:performance.now(),samples:[],min:[0,0,0,0],max:[0,0,0,0],base:pad.axes.slice(),noise:0};labWizShow();
}
function labWizShow(){
  const w=labWiz;$('labWiz').hidden=!w;if(!w)return;const s=WIZ[w.step];
  $('labWizStep').textContent='Step '+(w.step+1)+' of '+WIZ.length;$('labWizText').textContent=s.t;$('labWizBar').style.width='0';
}
function labWizTick(pad,now){
  const w=labWiz,s=WIZ[w.step];if(!pad){return}
  if(w.step===0){w.samples.push(pad.axes.slice(0,4));$('labWizBar').style.width=Math.min(100,(now-w.t0)/s.ms*100)+'%';
    if(now-w.t0>=s.ms){const n=w.samples.length;const c=[0,1,2,3].map(i=>w.samples.reduce((a,v)=>a+(v[i]||0),0)/n);
      let dev=0;for(const v of w.samples)for(let i=0;i<4;i++)dev=Math.max(dev,Math.abs((v[i]||0)-c[i]));
      LAB.center=c;w.noise=dev;w.step=1;w.t0=now;labWizShow()}}
  else if(w.step===1){for(let i=0;i<4;i++){const d=(pad.axes[i]||0)-LAB.center[i];w.min[i]=Math.min(w.min[i],d);w.max[i]=Math.max(w.max[i],d)}
    $('labWizBar').style.width=Math.min(100,(now-w.t0)/s.ms*100)+'%';
    if(now-w.t0>=s.ms){LAB.range=[0,1,2,3].map(i=>[w.min[i]<-0.3?w.min[i]:-1,w.max[i]>0.3?w.max[i]:1]);
      LAB.dz=Math.max(0.06,Math.min(0.3,+(w.noise*2+0.05).toFixed(2)));w.step=2;w.t0=now;w.base=pad.axes.slice();w.wait=true;labWizShow()}}
  else{
    // wait until everything is let go, then take the first button or extra axis that moves
    const anyDown=pad.buttons.some(b=>b.pressed||b.value>0.3);
    if(w.wait){if(!anyDown&&now-w.t0>300){w.wait=false;w.base=pad.axes.slice()}return}
    let got=null;
    pad.buttons.forEach((b,i)=>{if(!got&&(b.pressed||b.value>0.5))got={type:'button',index:i}});
    if(!got)pad.axes.forEach((a,i)=>{if(!got&&i>3&&Math.abs(a-(w.base[i]||0))>0.5)got={type:'axis',index:i,rest:w.base[i]||0,dir:a>(w.base[i]||0)?1:-1,span:Math.max(0.5,Math.abs(a-(w.base[i]||0))*1.1)}});
    if(got){LAB.map[s.learn]=got;$('labWizBar').style.width='100%';w.step++;w.t0=now;w.wait=true;
      if(w.step>=WIZ.length){labWiz=null;labSave();labRender();labMsg('Calibrated. Dead zone '+Math.round(LAB.dz*100)+'%, left mallet '+labName(LAB.map.left,pad)+', right mallet '+labName(LAB.map.right,pad)+'. Aim and strike!');$('labWiz').hidden=true}
      else labWizShow()}
  }
}
const labName=(m,pad)=>!m?'—':m.type==='button'?((pad&&pad.mapping==='standard'&&LAB_STD[m.index])||'button '+m.index):'trigger (axis '+m.index+')';
const labMsg=t=>{$('labMsg').textContent=t};
function labRender(){
  const order=panOrder();
  ['left','right'].forEach((side,i)=>{const host=$('lab-'+side);if(host.dataset.pan!==order[i].key||!host.firstChild){host.dataset.pan=order[i].key;host.innerHTML=panSVG(order[i],false);
    const svg=host.querySelector('svg'),c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('class','labcur');c.setAttribute('r','46');svg.appendChild(c)}});
  $('labMode').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===LAB.mode)));
  $('labDz').value=LAB.dz;$('labDzV').textContent=Math.round(LAB.dz*100)+'%';
  $('labReach').value=LAB.reach;$('labReachV').textContent=Math.round(LAB.reach*100)+'%';
  $('labFlick').value=LAB.flick;$('labFlickV').textContent=Math.round(LAB.flick*100)+'%';$('labFlickRow').hidden=LAB.mode!=='flick';
  $('labInv').setAttribute('aria-pressed',String(!!LAB.invertY));
  const pad=labPad();$('labMapL').textContent=labName(LAB.map.left,pad);$('labMapR').textContent=labName(LAB.map.right,pad);
}
function labOpen(on){
  $('labSheet').hidden=!on;cancelAnimationFrame(labRaf);
  if(on){panCtx();labRender();labMsg(navigator.getGamepads?'Connect your controller (or use the Retroid\'s built-in one), then press any button. No controller? Drag inside the stick circles and tap Hit.':"This browser can't read game controllers. Use Chrome.");labTick()}
  else{labWiz=null;$('labWiz').hidden=true}
}
window.addEventListener('gamepadconnected',e=>{labPadIdx=e.gamepad.index;if(!$('labSheet').hidden)labRender()});
window.addEventListener('gamepaddisconnected',e=>{if(labPadIdx===e.gamepad.index)labPadIdx=null});
$('labOpen').onclick=()=>{if(!isGuitar()){say('Mallet Lab works with the double guitar for now. Switch this song to the double guitar in Setup → Your pan to try it.');return}labOpen(true)};$('labClose').onclick=()=>labOpen(false);
$('labCal').onclick=labWizStart;$('labWizCancel').onclick=()=>{labWiz=null;$('labWiz').hidden=true;labMsg('Calibration stopped.')};
$('labMode').querySelectorAll('button').forEach(b=>b.onclick=()=>{LAB.mode=b.dataset.m;labSave();labRender();labMsg(LAB.mode==='aim'?'Aim with the sticks, strike with your mallet buttons. Hold to roll.':'Flick a stick out quickly to strike where it points. Let it come back to the middle before the next hit.')});
$('labDz').oninput=e=>{LAB.dz=+e.target.value;labSave();labRender()};
$('labReach').oninput=e=>{LAB.reach=+e.target.value;labSave();labRender()};
$('labFlick').oninput=e=>{LAB.flick=+e.target.value;labSave();labRender()};
$('labInv').onclick=()=>{LAB.invertY=!LAB.invertY;labSave();labRender()};
$('labReset').onclick=()=>{LAB=JSON.parse(JSON.stringify(LAB_DEF));labSave();labRender();labMsg('Back to the default settings.')};
// on-screen sticks: drag inside a circle, hold Hit to strike
['L','R'].forEach(k=>{
  const side=k==='L'?'left':'right',cv=$('labStick'+k);
  const set=e=>{const r=cv.getBoundingClientRect(),R=Math.min(r.width,r.height)/2-8;let x=(e.clientX-r.left-r.width/2)/R,y=(e.clientY-r.top-r.height/2)/R;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m}labVirtual[side]={x,y}};
  cv.addEventListener('pointerdown',e=>{e.preventDefault();cv.setPointerCapture(e.pointerId);set(e)});
  cv.addEventListener('pointermove',e=>{if(labVirtual[side])set(e)});
  const up=()=>{labVirtual[side]=null};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  const hb=$('labHit'+k);
  hb.addEventListener('pointerdown',e=>{e.preventDefault();labVirtual[side+'Hit']=true});
  const hu=()=>{labVirtual[side+'Hit']=false};hb.addEventListener('pointerup',hu);hb.addEventListener('pointercancel',hu);hb.addEventListener('pointerleave',hu);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('labSheet').hidden)labOpen(false)});
