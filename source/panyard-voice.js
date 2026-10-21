
/* ---------- your recorded pan notes: Ring and Tone for each note, 24-bit takes, longer bass notes ---------- */
// Ring bends how a note dies away, −10…+10: shorter (it fades faster) or longer (the fade is held back a little).
// Tone tilts it darker or brighter, −10…+10, with a gentle shelf above the note (about ±9 dB).
// Both sit with the note's other fine-tuning (SAMPLES.tune: trim, volume, fade, pitch), so they follow sound
// profiles and backups, and every note made from the recording (Fill the gaps) gets them too.
const RING_UP=0.09,RING_DOWN=0.4,RING_MAX=4;   // per second: ×2^(ring·0.09) longer, ×2^(ring·0.4) shorter; never more than ×4 (+12 dB)
const ringRate=T=>{const r=+T.ring||0;return r?Math.pow(2,r*(r>0?RING_UP:RING_DOWN)):1};
function toneNode(ac,T,id){
  const k=+T.tone||0;if(!k)return null;
  const f=ac.createBiquadFilter();f.type='highshelf';f.frequency.value=Math.max(1200,Math.min(6000,pitchHz(id)*3));f.gain.value=k*0.9;return f;
}
// a whole note's volume over time: the 4 ms fade-in, the ring bent shorter or longer, then the fade at the end
function noteEnvelope(gp,a,t,len,fade,T){
  const t1=t+Math.max(0.01,len-fade),r=ringRate(T);
  gp.setValueAtTime(0,t);gp.linearRampToValueAtTime(a,t+(T.att||0.004));   // a soft stick (Band sounds) comes in a little slower
  if(r!==1)gp.exponentialRampToValueAtTime(Math.max(1e-4,a*Math.min(RING_MAX,Math.pow(r,t1-t-0.004))),t1);else gp.setValueAtTime(a,t1);
  gp.linearRampToValueAtTime(0,t+len);
}
// the same player as before, with Tone in the path and Ring in the volume, plus this song's band sound (BAND) and how hard you hit (FEEL)
const holdAt=(p,t)=>{if(p.cancelAndHoldAtTime)p.cancelAndHoldAtTime(t);else{p.cancelScheduledValues(t);p.setValueAtTime(p.value,t)}};
playSample=function(id,vel,light,shift,key){
  const ac=panCtx(),b=SAMPLES.buf[id];if(!ac||!b)return false;shift=shift||0;key=key||id;
  const t=ac.currentTime+0.003,T=BAND.tune(tuneOf(id)),vin=Math.min(1,vel||1);
  // a borrowed note plays faster or slower, so it also lasts shorter or longer
  const end=Math.min(b.duration,T.end??b.duration),start=Math.min(T.start,end-0.05),len=(end-start)/Math.pow(2,shift/1200),v=(vel||1)*Math.pow(10,T.db/20)*(light?0.7:1);
  const det=T.cents+refCents()+shift+BAND.cents(id),ch=BAND.chain(ac,T,id,vin,t,light);
  const one=(d,a,at)=>{const src=ac.createBufferSource(),g=ac.createGain();src.buffer=b;if(src.detune)src.detune.value=d;else src.playbackRate.value=Math.pow(2,d/1200);
    src.connect(g);g.connect(ch?ch.in:pBus);
    let stopAt;
    if(light){g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(a,at+0.004);const e=Math.min(len,0.45);g.gain.setValueAtTime(a,at+0.12);g.gain.linearRampToValueAtTime(0,at+e);stopAt=at+e+0.01}
    else{noteEnvelope(g.gain,a,at,len,T.fade,T);stopAt=at+len+0.01}
    src.start(at,start);src.stop(stopAt);return {src,g,end:stopAt}};
  if(ch)ch.out.connect(pBus);
  const main=one(det,v,t),vs=[main];
  if(BAND.shimmerOn(light))vs.push(one(det+9,v*0.5,t+0.012));   // Shimmer: a second player a few cents away
  // the same note hit again: the older ring is damped quickly (like a real pan), never cut off
  const prev=VOICES.get(key);
  if(prev&&prev.end>t){for(const p of prev.vs||[prev])try{holdAt(p.g.gain,t);p.g.gain.linearRampToValueAtTime(0,t+0.03);p.src.stop(t+0.04)}catch{}}
  VOICES.set(key,{src:main.src,g:main.g,end:Math.max(...vs.map(x=>x.end)),vs});
  return true;
};
// backups: the base restore keeps trim, volume, fade and pitch; Ring and Tone come back here
setTimeout(()=>{const bi=window.backupIn;window.backupIn=async p=>{const m=bi?await bi(p):'';
  if(p&&p.soundTune&&typeof p.soundTune==='object'){for(const [id,v] of Object.entries(p.soundTune)){const T=SAMPLES.tune[id];if(!T||!v||typeof v!=='object')continue;
    for(const k of['ring','tone'])if(Number.isFinite(+v[k])&&+v[k])T[k]=Math.max(-10,Math.min(10,Math.round(+v[k])))}saveTune()}
  return m}},0);

/* 24-bit recordings: a take keeps the quiet end of its ring (and any editing) cleaner than 16-bit. Older 16-bit takes play as before. */
function encodeWav24(x,sr){
  const n=x.length,b=new ArrayBuffer(44+n*3),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');v.setUint32(4,36+n*3,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*3,true);v.setUint16(32,3,true);v.setUint16(34,24,true);w(36,'data');v.setUint32(40,n*3,true);
  for(let i=0,o=44;i<n;i++,o+=3){const s=Math.round(Math.max(-1,Math.min(1,x[i]))*8388607),u=s<0?s+16777216:s;v.setUint8(o,u&255);v.setUint8(o+1,(u>>8)&255);v.setUint8(o+2,(u>>16)&255)}
  return new Blob([b],{type:'audio/wav'});
}
// how long a take may ring: low notes ring much longer than high ones, so the basses keep more of theirs
const takeCap=id=>{const m=midiOf(PITCH[id]||'C4');return m<48?6:m<60?4:2.5};

/* Settings → Pan sounds opens the Pan sounds screen (record, tune, sound), which is Tune my pans */
document.addEventListener('click',e=>{const r=e.target.closest&&e.target.closest('#setList [data-row=sound]');if(!r||typeof TW==='undefined')return;e.stopPropagation();e.preventDefault();TW.open(true)},true);
// the old "Make my pans sound their best" (if anything still calls it) does the new clean-up on every recording
makeBest=async function(){if(typeof TW==='undefined')return;const r=await TW.cleanAll(Object.keys(SAMPLES.wav),true);say(r.n?'Tidied '+r.n+' recordings.':'Record some notes first, then try this.')};

/* ---------- every take of every note is kept: pick the best one later (Tune my pans → Takes) ----------
   A new recording (or a file, or a sound-editor edit) is added as a take and becomes the one in use; earlier takes
   stay. The one in use is always SAMPLES.wav[id], so playing, tuning and backups work as before. Up to TAKES_MAX per
   note: past that the oldest take not in use goes. Kept in IndexedDB 'sampleTakes' (Google Drive backup copies it). */
const TAKES_MAX=6;
var TAKES=(()=>{
  const all={};let ready=false;
  const save=()=>idbPut('sampleTakes',all);
  const ofId=id=>all[id]||null;
  // loaded straight from storage, so recordings made before takes were kept become take 1
  (async()=>{try{const t=await idbGet('sampleTakes');if(t&&typeof t==='object')for(const [k,v] of Object.entries(t))if(FIELDS.has(k)&&v&&Array.isArray(v.list)){
      const list=v.list.filter(x=>x&&x.b instanceof Blob),prev=all[k];   // a take recorded while this was loading goes after the stored ones
      if(list.length)all[k]=prev?{list:list.concat(prev.list),cur:list.length+prev.cur}:{list,cur:Math.max(0,Math.min(list.length-1,+v.cur||0))}}
    const s=await idbGet('samples');let add=false;
    if(s&&typeof s==='object')for(const [k,b] of Object.entries(s))if(FIELDS.has(k)&&b instanceof Blob&&!all[k]){all[k]={list:[{b,at:0,how:'rec'}],cur:0};add=true}
    if(add)save()}catch{}ready=true})();
  function add(id,b,how,from){
    const t=all[id]||(all[id]={list:[],cur:0});t.list.push({b,at:Date.now(),how:how||'rec',...(from?{from}:{})});t.cur=t.list.length-1;
    if((how||'rec')==='rec'&&typeof TW!=='undefined'&&TW.unrough)TW.unrough(id);
    while(t.list.length>TAKES_MAX){const i=t.list.findIndex((_,j)=>j!==t.cur);if(i<0)break;t.list.splice(i,1);if(i<t.cur)t.cur--}
    save();return t.cur+1;
  }
  // use another take: its own trim and pitch fix start fresh (they belonged to the old take); volume, ring and tone stay
  function pick(id,i){
    const t=all[id];if(!t||!t.list[i])return false;t.cur=i;save();if(typeof TW!=='undefined'&&TW.unrough)TW.unrough(id);
    SAMPLES.wav[id]=t.list[i].b;delete SAMPLES.buf[id];saveSamples();
    const T=SAMPLES.tune[id];if(T){delete T.start;delete T.end;delete T.cents;if(!Object.keys(T).length)delete SAMPLES.tune[id];saveTune()}
    sampleBuf(id);return true;
  }
  function drop(id,i){
    const t=all[id];if(!t||!t.list[i])return;const was=i===t.cur;t.list.splice(i,1);
    if(!t.list.length){delete all[id];save();delete SAMPLES.wav[id];delete SAMPLES.buf[id];delete SAMPLES.tune[id];saveSamples();saveTune();return}
    if(i<t.cur)t.cur--;if(was){t.cur=t.list.length-1;pick(id,t.cur)}else save();
  }
  // a clean-up (smoothing clicks) changes the take in use itself, not a new take
  function replaceCur(id,b){const t=all[id];if(!t||!t.list[t.cur])return;t.list[t.cur].b=b;save()}
  return {add,pick,drop,replaceCur,list:id=>(ofId(id)||{list:[]}).list,cur:id=>(ofId(id)||{cur:-1}).cur,count:id=>(ofId(id)||{list:[]}).list.length,
    curTake:id=>{const t=ofId(id);return t?t.list[t.cur]:null},get ready(){return ready}};
})();
