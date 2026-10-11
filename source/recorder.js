
/* ---------- your own pan sounds: record each note once, then the app plays your real pans ---------- */
// Each note's recording is kept on this phone (and in backup files). Notes you haven't recorded
// keep using the built-in tone, so you can record a few at a time.
const SAMPLES={wav:{},buf:{},warm:false};
const PC_NAMES=['C','C♯','D','E♭','E','F','F♯','G','G♯','A','B♭','B'];
async function loadSamples(){
  const all=await idbGet('samples');
  if(all&&typeof all==='object')for(const [id,b] of Object.entries(all))if(FIELDS.has(id)&&b instanceof Blob)SAMPLES.wav[id]=b;
  renderVoice();
}
const saveSamples=()=>idbPut('samples',{...SAMPLES.wav});
async function sampleBuf(id){
  if(SAMPLES.buf[id])return SAMPLES.buf[id];
  const w=SAMPLES.wav[id],ac=panCtx();if(!w||!ac)return null;
  try{const ab=await w.arrayBuffer();const b=await new Promise((res,rej)=>{const p=ac.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)});SAMPLES.buf[id]=b;return b}catch{return null}
}
function playSample(id,vel,light){
  const ac=panCtx(),b=SAMPLES.buf[id];if(!ac||!b)return false;
  const src=ac.createBufferSource(),g=ac.createGain(),t=ac.currentTime+0.003;
  src.buffer=b;src.connect(g);g.connect(pBus);g.gain.setValueAtTime((vel||1)*(light?0.7:1),t);
  if(light){g.gain.setTargetAtTime(0.0001,t+0.16,0.07);src.start(t);src.stop(t+0.6)}else src.start(t);
  return true;
}
// strike() asks this first: true means your recording played
function strikeMine(id,vel,light){
  if(S.panVoice!=='mine'||!SAMPLES.wav[id])return false;
  if(!SAMPLES.warm){SAMPLES.warm=true;Object.keys(SAMPLES.wav).forEach(sampleBuf)}
  if(SAMPLES.buf[id])return playSample(id,vel,light);
  sampleBuf(id);return false;   // still getting it ready: the built-in tone covers this one hit
}
function encodeWav(x,sr){
  const b=new ArrayBuffer(44+x.length*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');v.setUint32(4,36+x.length*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,x.length*2,true);
  for(let i=0;i<x.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,x[i]))*32767,true);
  return new Blob([b],{type:'audio/wav'});
}
// what note a recording sounds like (pitch class only: a pan note rings its octave strongly)
function detectPitch(x,sr){
  const N=Math.min(x.length,4096);if(N<1024)return 0;
  const minL=Math.floor(sr/1000),maxL=Math.floor(sr/90),r=new Float32Array(maxL+2);let mx=0;
  for(let l=minL;l<=maxL;l++){let s=0;for(let i=0;i<N-l;i++)s+=x[i]*x[i+l];r[l]=s;if(s>mx)mx=s}
  if(mx<=0)return 0;
  for(let l=minL+1;l<maxL;l++)if(r[l]>0.85*mx&&r[l]>=r[l-1]&&r[l]>=r[l+1]){const a=r[l-1],b=r[l],c=r[l+1],d=a-2*b+c;return sr/(l+(d?0.5*(a-c)/d:0))}
  return 0;
}
const pcOfHz=f=>((Math.round(12*Math.log2(f/440))+9)%12+12)%12;
const pcOfId=id=>midiOf(PITCH[id])%12;
// trim to the hit, keep the ring, level it, fade the tail
function storeTake(id,x,sr){
  let peak=0;for(const v of x)peak=Math.max(peak,Math.abs(v));
  if(peak<0.01){recMsg("That was too quiet to use. Hold the phone closer to the pan and try again.");return false}
  let on=0;while(on<x.length&&Math.abs(x[on])<peak*0.25)on++;
  const start=Math.max(0,on-Math.round(sr*0.004));
  let end=x.length-1;while(end>start&&Math.abs(x[end])<peak*0.003)end--;
  end=Math.min(x.length,end+Math.round(sr*0.05),start+Math.round(sr*2.5));
  const y=x.slice(start,end),gain=0.9/peak,fade=Math.min(Math.round(sr*0.2),Math.round(y.length*0.2)),fin=Math.round(sr*0.001);
  for(let i=0;i<y.length;i++){let g=gain;if(i<fin)g*=i/fin;if(i>y.length-fade)g*=(y.length-i)/fade;y[i]*=g}
  SAMPLES.wav[id]=encodeWav(y,sr);delete SAMPLES.buf[id];saveSamples();
  const first=S.panVoice!=='mine';if(first){S.panVoice='mine';save()}
  const f=detectPitch(y.subarray(Math.min(y.length-1,Math.round(sr*0.06))),sr),want=FIELDS.get(id).label;
  const heard=f?PC_NAMES[pcOfHz(f)]:'',ok=f&&pcOfHz(f)===pcOfId(id);
  recMsg('Saved '+want+'.'+(f?(ok?' It sounds like '+heard+' ✓':' It sounds closer to '+heard+'. If you hit '+want+', that\'s fine; if not, tap Record to redo it.'):'')+(first?' Your pans will now use your recordings.':''));
  sampleBuf(id).then(()=>playSample(id,1,false));
  renderRec();renderVoice();return true;
}
/* recording sheet */
let recSel=null,recLive=null;
const REC_ORDER=PANS.flatMap(p=>p.fields.map(f=>f[0]));
const recMsg=t=>{$('recMsg').textContent=t};
function renderVoice(){
  const n=Object.keys(SAMPLES.wav).length;
  $('voiceSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===S.panVoice)));
  $('voiceInfo').textContent=n?n+' of 20 notes recorded'+(n<20?'. The others use the built-in tone until you record them.':'. All your notes are your real pans.'):'Record each note on your own pans once and the app will play your real sound when you tap.';
}
function renderRec(){
  const order=S.swapped?[PANS[1],PANS[0]]:PANS;
  if(!$('recPans').children.length||$('recPans').dataset.sw!==String(S.swapped)||$('recPans').dataset.look!==S.look){
    $('recPans').innerHTML=order.map(p=>panSVG(p,true)).join('');$('recPans').dataset.sw=String(S.swapped);$('recPans').dataset.look=S.look;
    $('recPans').querySelectorAll('.field').forEach(el=>el.addEventListener('click',()=>{if(recLive)return;recSel=el.dataset.field;recMsg('');renderRec();if(SAMPLES.wav[recSel])sampleBuf(recSel).then(()=>playSample(recSel,1,false))}));
  }
  $('recPans').querySelectorAll('.field').forEach(el=>{const id=el.dataset.field;el.classList.toggle('recorded',!!SAMPLES.wav[id]);el.classList.toggle('chosen',id===recSel)});
  const n=Object.keys(SAMPLES.wav).length,has=recSel&&SAMPLES.wav[recSel];
  $('recDone').textContent=n+' of 20 recorded';
  $('recNote').textContent=recSel?FIELDS.get(recSel).label+(has?' ✓':''):'Tap a note';
  $('recWhere').textContent=recSel?FIELDS.get(recSel).pos+' · '+FIELDS.get(recSel).pan+' · '+PITCH[recSel].replace('#','♯').replace(/([A-G])b/,'$1♭'):'';
  $('recGo').disabled=!recSel;$('recPlay').disabled=!has||!!recLive;$('recDel').disabled=!has||!!recLive;$('recFile').disabled=!recSel||!!recLive;
  $('recGo').textContent=recLive?'■ Stop':(has?'● Record again':'● Record');$('recGo').classList.toggle('on',!!recLive);
}
function openRec(on){
  if(!on&&recLive)recLive.stop(false);
  $('recSheet').hidden=!on;
  if(on){if(!recSel)recSel=REC_ORDER.find(id=>!SAMPLES.wav[id])||REC_ORDER[0];recMsg('');renderRec();$('recLevel').style.width='0'}
}
async function recordNote(){
  if(recLive){recLive.stop(false);return}
  const id=recSel;if(!id)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){recMsg("The microphone isn't available here. Open Pan Notes from your home screen or in Chrome, or use Choose a file instead.");return}
  const ac=panCtx();if(!ac)return;
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
  catch(e){recMsg(e&&e.name==='NotAllowedError'?'Pan Notes needs the microphone to record. Allow it when your phone asks (or in Chrome\'s site settings), then try again.':"Couldn't start the microphone. Try again, or use Choose a file.");return}
  try{await ac.resume()}catch{}
  const sr=ac.sampleRate,src=ac.createMediaStreamSource(stream),sp=ac.createScriptProcessor(2048,1,1),mute=ac.createGain();mute.gain.value=0;
  src.connect(sp);sp.connect(mute);mute.connect(ac.destination);
  const pre=[],take=[];let state='listen',noise=0.002,chunks=0,got=0;const need=Math.round(sr*2.7),began=performance.now();
  const stop=ok=>{if(!recLive)return;sp.onaudioprocess=null;try{src.disconnect();sp.disconnect();mute.disconnect()}catch{}
    stream.getTracks().forEach(t=>t.stop());recLive=null;$('recLevel').style.width='0';
    if(ok){const all=new Float32Array(got);let o=0;for(const c of take){all.set(c,o);o+=c.length}storeTake(id,all,sr)}
    else if(ok===null)recMsg("Didn't hear a note. Tap Record and hit "+FIELDS.get(id).label+" again, with the phone a little closer.");
    else recMsg('Stopped.');
    renderRec()};
  recLive={stop};
  sp.onaudioprocess=e=>{
    const x=new Float32Array(e.inputBuffer.getChannelData(0));let s=0;for(let i=0;i<x.length;i++)s+=x[i]*x[i];const rms=Math.sqrt(s/x.length);
    $('recLevel').style.width=Math.min(100,rms*400)+'%';
    if(state==='listen'){
      pre.push(x);if(pre.length>3)pre.shift();chunks++;
      if(chunks<5){noise=Math.max(noise,rms);return}
      if(rms>Math.max(0.015,noise*5)){state='take';for(const c of pre){take.push(c);got+=c.length}return}
      noise=noise*0.97+rms*0.03;
      if(performance.now()-began>12000)stop(null);
      return;
    }
    take.push(x);got+=x.length;if(got>=need)stop(true);
  };
  recMsg('Listening… hit '+FIELDS.get(id).label+' once and let it ring.');renderRec();
}
$('recGo').onclick=recordNote;
$('recPlay').onclick=()=>{if(recSel)sampleBuf(recSel).then(()=>playSample(recSel,1,false))};
$('recNext').onclick=()=>{if(recLive)return;const i=REC_ORDER.indexOf(recSel),nx=REC_ORDER.slice(i+1).concat(REC_ORDER.slice(0,i+1)).find(id=>!SAMPLES.wav[id]);recSel=nx||REC_ORDER[(i+1)%REC_ORDER.length];recMsg('');renderRec()};
$('recDel').onclick=()=>{if(!recSel||!SAMPLES.wav[recSel])return;delete SAMPLES.wav[recSel];delete SAMPLES.buf[recSel];saveSamples();recMsg('Deleted. '+FIELDS.get(recSel).label+' uses the built-in tone again.');renderRec();renderVoice()};
$('recFile').onchange=async e=>{
  const f=e.target.files&&e.target.files[0];e.target.value='';if(!f||!recSel)return;
  const ac=panCtx();if(!ac)return;
  try{const ab=await f.arrayBuffer();const b=await new Promise((res,rej)=>{const p=ac.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)});
    const n=Math.min(b.length,Math.round(b.sampleRate*8)),x=new Float32Array(n);
    for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)x[i]+=d[i]/b.numberOfChannels}
    storeTake(recSel,x,b.sampleRate)}
  catch{recMsg("Couldn't read that file. Try an MP3, M4A or WAV.")}
};
$('recOpen').onclick=()=>openRec(true);$('recClose').onclick=()=>openRec(false);
$('voiceSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{S.panVoice=b.dataset.v;renderVoice();save();
  if(S.panVoice==='mine'&&!Object.keys(SAMPLES.wav).length){say('No recordings yet. Tap Record your pans to make some.')}else strike(S.panVoice==='mine'?(Object.keys(SAMPLES.wav)[0]||'c'):'c',0.9)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('recSheet').hidden)openRec(false)});
loadSamples();
