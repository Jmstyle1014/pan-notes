/* ---------- Studio: record in layers (the multi-track recorder from Pocket Band) ---------- */
// Your practice recording is track 1. On top of it go mic takes, pan-tap tracks and a beat. Every track has
// its own volume, left/right, reverb, mute and solo, and the whole song exports as one file. Bars come from
// ♩ Timing in Write, so everything lines up with your notes and sections.
const STUDIO=(()=>{
const q=s=>document.querySelector(s);
const uid=()=>Date.now().toString(36).slice(-4)+Math.random().toString(36).slice(2,7);
let PR={latency:0,micLag:null,zoom:1};
try{Object.assign(PR,JSON.parse(localStorage.getItem('panyard-studio')||'{}'))}catch{}
const savePR=()=>{try{localStorage.setItem('panyard-studio',JSON.stringify(PR))}catch{}};
// each Pan taps track plays one pan set (the song's pan unless you choose another); My part plays the song's
const trSet=tr=>tr&&tr.type==='pan'?(SETS[tr.panSet]?tr.panSet:'guitar'):setKey();
const pidsOf=tr=>SETS[trSet(tr)].views.flatMap(p=>p.fields.map(f=>f[0])).sort((a,b)=>midiOf(PITCH[b])-midiOf(PITCH[a]));   // high to low
// every pan's colours, so a Six bass track still shows its notes in a song written for the tenor
const GCOL={};for(const k in SETS)(SETS[k].groups||[]).forEach(g=>{if(!GCOL[g.key])GCOL[g.key]=g.color});
const gcol=id=>{const g=grpOf(id);return 'var(--'+g+','+(GCOL[g]||'#9d93c9')+')'};
const pname=id=>{const f=FIELDS.get(id);return (f?f.label.replace(/[\u0307\u0308\u0323\u0324]/g,''):id)+PITCH[id].slice(-1)};
const mtof=m=>440*Math.pow(2,(m-69)/12);

/* ---- the studio song: one per Panyard song ---- */
let song=null,songKey=null,loading=null;
function trk(type,extra){
  const t={id:type==='practice'?'practice':uid(),type,vol:.85,pan:0,mute:false,solo:false,mix:null};
  if(type==='pan'){t.notes=[];t.panSet=setKey();t.name=SETS[t.panSet].name}
  if(type==='audio'){t.take=null;t.start=0;t.dur=0;t.peaks=null;t.lagMs=0;t.name='Mic'}
  if(type==='beats'){t.len=16;t.swing=0;t.unit=8;t.off=[];t.rows=[36,38,42,46].map(m=>({m,steps:Array(16).fill(0)}));t.name='Beat'}
  if(type==='practice')t.name='Your recording';
  if(type==='part')t.name='My part';
  return Object.assign(t,extra||{});
}
const blank=()=>{const part=trk('part');part.name='My part (Write)';return{v:1,bpm:100,metro:false,countIn:true,recMode:'add',snap:'off',snapRec:false,cycle:null,master:.85,sel:part.id,minBars:8,tracks:[trk('practice'),part]}};
const MIXDEF={practice:.04,audio:.08,pan:.22,part:.22,beats:.05},DECAY={practice:1.2,audio:1.4,pan:1.9,part:1.9,beats:.9};
const mixOf=tr=>tr.mix==null?MIXDEF[tr.type]:tr.mix;
// each track's own settings (Track settings): tone, echo and room; for pan tracks also quantize and transpose
const FX0={treble:0,bass:0,comp:0,echo:0,echoT:'q',room:0};
const fxOf=tr=>Object.assign({},FX0,tr.fx||{});
const ECHOES={q:{n:'Quarter note',b:1,fb:.32},e:{n:'Eighth note',b:.5,fb:.3},de:{n:'Dotted eighth',b:.75,fb:.35},t:{n:'Triplet',b:2/3,fb:.3},h:{n:'Half note',b:2,fb:.3},amb:{n:'Ambient',b:1.5,fb:.55,dark:1},slap:{n:'Slap back',b:.25,fb:.08}};
const ROOMS=[[0,'Usual'],[.7,'Small room'],[1.4,'Panyard'],[2.6,'Hall'],[4,'Cathedral']];
const QNT={none:'None',straight:'Straight',triplet:'Triplet',swing:'Swing'};
function qBeat(q,t){
  const d=q.div||.5;
  if(q.mode==='triplet'){const g=d*2/3;return Math.round(t/g)*g}
  if(q.mode==='swing'){const pair=d*2,k=Math.floor(t/pair+1e-9),r=t-k*pair,late=d*(1+(q.sw==='heavy'?.5:.25));let best=0;for(const c of[0,late,pair])if(Math.abs(r-c)<Math.abs(r-best))best=c;return k*pair+best}
  return Math.round(t/d)*d;
}
// a pan only has the notes it has: a transposed note that falls off the pan comes back an octave in
const SETMIDI=new Map();
function tpId(sk,id,semi){
  if(!semi||!PITCH[id])return id;let m=SETMIDI.get(sk);
  if(!m){m=new Map();SETS[sk].views.forEach(v=>v.fields.forEach(f=>m.set(midiOf(PITCH[f[0]]),f[0])));SETMIDI.set(sk,m)}
  const ks=[...m.keys()],lo=Math.min(...ks),hi=Math.max(...ks);let x=midiOf(PITCH[id])+semi;
  while(x>hi)x-=12;while(x<lo)x+=12;
  if(m.has(x))return m.get(x);let best=id,bd=99;for(const k of ks)if(Math.abs(k-x)<bd){bd=Math.abs(k-x);best=m.get(k)}return best;
}
// the notes a track actually plays: quantized and transposed on the way out, your recording kept as you played it
const PN=new WeakMap();
function pnotes(tr){
  if(tr.type!=='pan')return notesOf(tr);
  const q=tr.q&&tr.q.mode&&tr.q.mode!=='none'?tr.q:null,semi=tr.tp|0;if(!q&&!semi)return tr.notes;
  let sum=0;for(const n of tr.notes)sum+=n.t*1.37+n.d+(n.p.length||0);
  const sig=JSON.stringify([q,semi,trSet(tr),tr.notes.length,sum]),c=PN.get(tr);if(c&&c.src===tr.notes&&c.sig===sig)return c.out;
  const sk=trSet(tr),last=new Map(),out=[];
  for(const n of [...tr.notes].sort((a,b)=>a.t-b.t)){const t=q&&!n.roll?+Math.max(0,qBeat(q,n.t)).toFixed(4):n.t,p=tpId(sk,n.p,semi);
    if(q&&last.get(p)===t)continue;last.set(p,t);out.push(Object.assign({},n,{t,p}))}
  out.sort((a,b)=>a.t-b.t);PN.set(tr,{src:tr.notes,sig,out});return out;
}
const grid=()=>S.grid&&Number.isFinite(S.grid.bpm)&&S.grid.bpm>=30&&S.grid.bpm<=300?S.grid:null;
const bpm=()=>grid()?grid().bpm:song.bpm;
const BPB=()=>grid()&&grid().perBar>=2?grid().perBar:4;
const spb=()=>60/bpm();
// beat 0 is a bar line from ♩ Timing; the recording itself may begin partway into bar 1
const origin=()=>{const G=grid();if(!G)return 0;let o=+G.offset||0;const bar=spb()*BPB();while(o>1e-6)o-=bar;return o};
const pracStart=()=>-origin()/spb();
const selTr=()=>song.tracks.find(t=>t.id===song.sel)||song.tracks[0];
const trById=id=>song.tracks.find(t=>t.id===id);

/* ---- recordings kept in memory: the practice recording and every take ---- */
const buffers={};let pBuf=null,pKey='',pPeaks=null;
// "My part" is linked to your cues in Write: its notes are worked out from them whenever they change
let partCache=null;
{const _save=save;save=function(){_save();partCache=null}}
function partNotes(){
  if(partCache&&partCache.bpm===bpm()&&partCache.o===origin())return partCache.notes;
  const o=origin(),sp=spb(),notes=[];
  for(const e of BARS.events()){const b=(e.t-o)/sp,d=+Math.min(4,Math.max(.1,e.d/sp)).toFixed(3);if(b<0)continue;
    if(e.fx==='roll'){notes.push({t:+b.toFixed(3),d:Math.max(d,.25),p:e.p,v:.95});for(let k=0,x=.07;x<e.d-.03;x+=.072,k++)notes.push({t:+(b+x/sp).toFixed(3),d:.25,p:e.p,v:+(.55+((k*37)%11)/50).toFixed(2),roll:1})}
    else notes.push({t:+b.toFixed(3),d,p:e.p,v:.95,strum:e.fx==='strum'})}
  // a strum: the notes of a chord fall just after each other, low to high
  const byT=new Map();notes.forEach(n=>{if(n.strum){if(!byT.has(n.t))byT.set(n.t,[]);byT.get(n.t).push(n)}});
  for(const g of byT.values())g.sort((x,y)=>midiOf(PITCH[x.p])-midiOf(PITCH[y.p])).forEach((n,i)=>{n.t=+(n.t+i*.03/sp).toFixed(3)});
  notes.sort((x,y)=>x.t-y.t);partCache={bpm:bpm(),o,notes};return notes;
}
const notesOf=tr=>tr.type==='part'?partNotes():tr.notes||[];
const isPanish=tr=>tr.type==='pan'||tr.type==='part';
const audioOf=tr=>tr.type==='practice'?pBuf:tr.type==='audio'&&tr.take?buffers[tr.take]:null;
const startOf=tr=>tr.type==='practice'?pracStart():tr.start||0;
function contentEnd(){let e=0;
  for(const tr of song.tracks){
    const a=audioOf(tr);if(a)e=Math.max(e,startOf(tr)+a.duration/spb());
    else if(tr.type==='audio'&&tr.dur)e=Math.max(e,tr.start+tr.dur/spb());
    if(isPanish(tr))for(const n of notesOf(tr))e=Math.max(e,n.t+n.d);
  }return e}
const bars=()=>Math.max(song.minBars||8,Math.ceil(contentEnd()/BPB()-1e-6)+1);
const L=()=>bars()*BPB();

/* ---- sound: a mixing desk built on the pans' own audio engine ---- */
let ctx=null,master=null,meterM=null,reverbs=new Map(),noise=null;
const chans=new Map();
function buildMaster(ac){
  const vol=ac.createGain(),comp=ac.createDynamicsCompressor(),lim=ac.createDynamicsCompressor(),an=ac.createAnalyser();
  vol.gain.value=song?song.master:.85;comp.threshold.value=-12;comp.ratio.value=4;
  lim.threshold.value=-1;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.002;lim.release.value=.1;   // keeps loud moments from distorting
  an.fftSize=512;vol.connect(comp);comp.connect(lim);lim.connect(an);an.connect(ac.destination);
  return{vol,an};
}
function AC(){
  if(!ctx){ctx=panCtx();if(!ctx)return null;const m=buildMaster(ctx);master=m.vol;meterM=m.an;
    noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    setTimeout(warmDrums,0)}
  if(ctx.state==='suspended')ctx.resume();
  return ctx;
}
function makeIR(ac,decay){
  const sr=ac.sampleRate,n=Math.max(1,Math.round(sr*decay)),ir=ac.createBuffer(2,n,sr),pre=Math.round(sr*.012);
  for(let c=0;c<2;c++){const d=ir.getChannelData(c);let lp=0;
    for(let i=pre;i<n;i++){const t=(i-pre)/sr,k=.55-.45*Math.min(1,t/decay);lp+=k*((Math.random()*2-1)-lp);d[i]=lp*Math.pow(1-(i-pre)/(n-pre),2)*Math.exp(-t*3/decay)}}
  return ir;
}
function reverbFor(decay){let r=reverbs.get(decay);if(!r){r=ctx.createConvolver();r.buffer=makeIR(ctx,decay);r.connect(master);reverbs.set(decay,r)}return r}
const audible=tr=>song.tracks.some(t=>t.solo)?tr.solo:!tr.mute;
// each track: volume → low cut → left–right → (dry to the master) + (send to its room), with a level meter
function channel(tr){
  let c=chans.get(tr.id);
  if(!c){
    const out=ctx.createGain(),play=ctx.createGain(),hp=ctx.createBiquadFilter(),pan=ctx.createStereoPanner?ctx.createStereoPanner():null,dry=ctx.createGain(),send=ctx.createGain(),meter=ctx.createAnalyser();
    hp.type='highpass';hp.frequency.value=tr.type==='beats'?20:45;hp.Q.value=.6;meter.fftSize=512;
    // tone: bass and treble shelves, then a compressor with a little make-up gain
    const lo=ctx.createBiquadFilter(),hi=ctx.createBiquadFilter(),comp=ctx.createDynamicsCompressor(),mk=ctx.createGain();
    lo.type='lowshelf';lo.frequency.value=220;hi.type='highshelf';hi.frequency.value=3200;comp.attack.value=.005;comp.release.value=.18;comp.knee.value=8;
    play.connect(out);out.connect(hp);hp.connect(lo);lo.connect(hi);hi.connect(comp);comp.connect(mk);const last=pan||mk;if(pan)mk.connect(pan);
    last.connect(dry);dry.connect(master);last.connect(send);last.connect(meter);
    // echo: a delay in time with the song, feeding back on itself, a little darker each time round
    const esend=ctx.createGain(),dl=ctx.createDelay(5),fb=ctx.createGain(),dk=ctx.createBiquadFilter();dk.type='lowpass';dk.frequency.value=4500;
    last.connect(esend);esend.connect(dl);dl.connect(dk);dk.connect(fb);fb.connect(dl);dk.connect(master);
    c={out,play,pan,dry,send,meter,rev:null,lo,hi,comp,mk,esend,dl,fb,dk};chans.set(tr.id,c);
  }
  const fx=fxOf(tr);c.lo.gain.value=fx.bass;c.hi.gain.value=fx.treble;
  c.comp.threshold.value=-fx.comp*32;c.comp.ratio.value=1+fx.comp*7;c.mk.gain.value=1+fx.comp*.9;
  const E=ECHOES[fx.echoT]||ECHOES.q;c.dl.delayTime.value=Math.min(4.9,E.b*spb());c.fb.gain.value=E.fb;c.dk.frequency.value=E.dark?2200:4500;c.esend.gain.value=fx.echo;
  const mx=mixOf(tr);c.out.gain.value=tr.vol;c.play.gain.value=audible(tr)?1:0;if(c.pan)c.pan.pan.value=tr.pan||0;
  c.dry.gain.value=1-mx*.5;c.send.gain.value=mx*1.6;
  const rv=reverbFor(fx.room||DECAY[tr.type]);if(c.rev!==rv){if(c.rev)try{c.send.disconnect(c.rev)}catch{}c.send.connect(rv);c.rev=rv}
  return c;
}
function refreshGains(){if(!ctx)return;song.tracks.forEach(channel);if(master)master.gain.value=song.master}
const hold=(p,t)=>{if(p.cancelAndHoldAtTime)p.cancelAndHoldAtTime(t);else p.cancelScheduledValues(t)};
function osc(type,f,t,end,dest){const o=ctx.createOscillator();o.type=type;o.frequency.value=f;o.connect(dest);o.start(t);o.stop(end);return o}
function filt(type,f,qq){const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;if(qq)b.Q.value=qq;return b}
function noiseSrc(t,dur,dest){const s=ctx.createBufferSource();s.buffer=noise;s.connect(dest);s.start(t,Math.random());s.stop(t+dur);return s}
function env(gn,t,a,dec){gn.gain.setValueAtTime(a,t);gn.gain.exponentialRampToValueAtTime(.001,t+dec)}
function tone(d,t,f,a,dec,type){const gn=ctx.createGain();env(gn,t,a,dec);gn.connect(d);osc(type||'sine',f,t,t+dec+.05,gn)}
// the metronome: a choice of sounds and a level, kept with each song (force: the timing fix always beeps)
const CLICKS=[['wood','Woodblock'],['iron','Iron'],['clave','Clave'],['rim','Rimshot'],['hat','Hi-hat'],['cowbell','Cowbell'],['beep','Beep']];
const CK0={sound:'wood',level:.8,bars:1,visual:true,recOnly:false};
const ck=()=>Object.assign({},CK0,song&&song.click||{});
function click(t,accent,force){
  const k=force?{sound:'beep',level:.8}:ck(),gn=ctx.createGain();gn.gain.value=Math.pow(k.level,1.5)*1.4*(accent?1:.72);gn.connect(master);
  const v=1;switch(k.sound){
    case 'wood':{const g2=ctx.createGain();env(g2,t,.7,.07);g2.connect(gn);const f=accent?1250:950;osc('sine',f,t,t+.09,g2);const g3=ctx.createGain();env(g3,t,.18,.03);g3.connect(gn);osc('triangle',f*2.7,t,t+.05,g3);break}
    case 'iron':playDrum(accent?81:80,gn,t,v);break;
    case 'clave':playDrum(75,gn,t,accent?1:.8);break;
    case 'rim':playDrum(37,gn,t,v);break;
    case 'hat':playDrum(accent?46:42,gn,t,accent?.8:1);break;
    case 'cowbell':playDrum(56,gn,t,v);break;
    default:{const g2=ctx.createGain();env(g2,t,accent?.35:.3,.05);g2.connect(gn);osc('square',accent?1760:1320,t,t+.06,g2)}
  }
}

/* drums (Pocket Band's kit): each sound is built once, then replayed for every hit */
function hat(d,t,v,dec){const gn=ctx.createGain(),hp=filt('highpass',7500);env(gn,t,.32*v,dec);hp.connect(gn);gn.connect(d);noiseSrc(t,dec+.05,hp)}
function tom(d,t,v,f){const gn=ctx.createGain();env(gn,t,.8*v,.4);gn.connect(d);const o=osc('sine',f,t,t+.45,gn);o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*.6,t+.35)}
function metal(d,t,v,freqs,dec,amp,bpf){const gn=ctx.createGain(),bp=filt('bandpass',bpf||3000,.7);env(gn,t,amp*v,dec);bp.connect(gn);gn.connect(d);freqs.forEach(f=>osc('square',f,t,t+dec+.05,bp))}
function click8k(d,t,v){const gn=ctx.createGain(),hp=filt('highpass',8000);env(gn,t,.3*v,.012);hp.connect(gn);gn.connect(d);noiseSrc(t,.02,hp)}
function conga(d,t,v,f,dec){const gn=ctx.createGain();env(gn,t,.8*v,dec);gn.connect(d);const o=osc('sine',f*1.12,t,t+dec+.05,gn);o.frequency.setValueAtTime(f*1.12,t);o.frequency.exponentialRampToValueAtTime(f,t+.03);
  const n=ctx.createGain(),bp=filt('bandpass',1500,1);env(n,t,.12*v,.02);bp.connect(n);n.connect(d);noiseSrc(t,.03,bp)}
let DRIVE=null;
const driveCurve=()=>{if(!DRIVE){DRIVE=new Float32Array(1024);for(let i=0;i<1024;i++)DRIVE[i]=Math.tanh(2.2*(i/511.5-1))}return DRIVE};
const SOUNDS=[{m:36,n:'Kick'},{m:38,n:'Snare'},{m:39,n:'Clap'},{m:37,n:'Rim'},{m:42,n:'Closed hat'},{m:46,n:'Open hat'},{m:45,n:'Low tom'},{m:48,n:'High tom'},{m:49,n:'Crash'},{m:51,n:'Ride'},
  {m:81,n:'Iron'},{m:80,n:'Iron (muted)'},{m:73,n:'Scratcher'},{m:56,n:'Cowbell'},{m:63,n:'Conga high'},{m:64,n:'Conga low'},{m:62,n:'Conga slap'},{m:70,n:'Shaker'},{m:75,n:'Clave'},
  {m:90,n:'Doum'},{m:91,n:'Tek'},{m:92,n:'Ka'},{m:93,n:'Log drum'}];
const DRUM_NAME=Object.fromEntries(SOUNDS.map(s=>[s.m,s.n]));
const DRUMS={
  36:(d,t,v)=>{const gn=ctx.createGain();env(gn,t,1.1*v,.45);gn.connect(d);const o=osc('sine',160,t,t+.5,gn);o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(42,t+.12)},
  38:(d,t,v)=>{const gn=ctx.createGain(),hp=filt('highpass',1400);env(gn,t,.65*v,.2);hp.connect(gn);gn.connect(d);noiseSrc(t,.25,hp);tone(d,t,190,.4*v,.12,'triangle')},
  39:(d,t,v)=>{const gn=ctx.createGain(),bp=filt('bandpass',1500,.8);gn.gain.setValueAtTime(0,t);[0,.012,.024].forEach(o=>{gn.gain.setValueAtTime(.8*v,t+o);gn.gain.exponentialRampToValueAtTime(.1*v,t+o+.01)});gn.gain.setValueAtTime(.6*v,t+.034);gn.gain.exponentialRampToValueAtTime(.001,t+.25);bp.connect(gn);gn.connect(d);noiseSrc(t,.3,bp)},
  42:(d,t,v)=>hat(d,t,v,.05),46:(d,t,v)=>hat(d,t,v,.35),45:(d,t,v)=>tom(d,t,v,110),48:(d,t,v)=>tom(d,t,v,170),
  49:(d,t,v)=>{const gn=ctx.createGain(),hp=filt('highpass',5000);env(gn,t,.32*v,1.7);hp.connect(gn);gn.connect(d);noiseSrc(t,1.8,hp)},
  37:(d,t,v)=>{tone(d,t,820,.35*v,.035,'triangle');const gn=ctx.createGain(),hp=filt('highpass',3000);env(gn,t,.25*v,.02);hp.connect(gn);gn.connect(d);noiseSrc(t,.04,hp)},
  51:(d,t,v)=>{const gn=ctx.createGain(),hp=filt('highpass',7000);env(gn,t,.11*v,.9);hp.connect(gn);gn.connect(d);noiseSrc(t,1,hp);metal(d,t,v,[2950,4100,5300],.9,.05,5000)},
  // the engine room: the iron is a brake drum hit with a steel rod; muted, it's a short clank
  81:(d,t,v)=>{metal(d,t,v,[740,1130,1520,2240],.32,.26,2500);click8k(d,t,v)},
  80:(d,t,v)=>{metal(d,t,v,[740,1130,1520,2240],.06,.3,2500);click8k(d,t,v)},
  73:(d,t,v)=>{const gn=ctx.createGain(),bp=filt('bandpass',3500,1.5);gn.gain.setValueAtTime(0,t);for(let i=0;i<6;i++){gn.gain.setValueAtTime(.55*v,t+i*.024);gn.gain.setValueAtTime(.05*v,t+i*.024+.013)}gn.gain.setValueAtTime(0,t+.15);bp.connect(gn);gn.connect(d);noiseSrc(t,.16,bp)},
  56:(d,t,v)=>metal(d,t,v,[562,845],.35,.3,1000),
  63:(d,t,v)=>conga(d,t,v,330,.35),64:(d,t,v)=>conga(d,t,v,220,.45),
  62:(d,t,v)=>{const gn=ctx.createGain(),bp=filt('bandpass',2200,1);env(gn,t,.55*v,.08);bp.connect(gn);gn.connect(d);noiseSrc(t,.1,bp);tone(d,t,380,.4*v,.06,'sine')},
  70:(d,t,v)=>{const gn=ctx.createGain(),hp=filt('highpass',6000);gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(.28*v,t+.012);gn.gain.exponentialRampToValueAtTime(.001,t+.09);hp.connect(gn);gn.connect(d);noiseSrc(t,.1,hp)},
  75:(d,t,v)=>{const gn=ctx.createGain(),bp=filt('bandpass',2500,8);env(gn,t,.9*v,.06);bp.connect(gn);gn.connect(d);osc('sine',2500,t,t+.08,bp)},
  90:(d,t,v)=>{const gn=ctx.createGain();env(gn,t,1*v,.5);gn.connect(d);const o=osc('sine',115,t,t+.55,gn);o.frequency.setValueAtTime(115,t);o.frequency.exponentialRampToValueAtTime(78,t+.3)},
  91:(d,t,v)=>{const gn=ctx.createGain(),bp=filt('bandpass',3500,1.2);env(gn,t,.55*v,.05);bp.connect(gn);gn.connect(d);noiseSrc(t,.06,bp);tone(d,t,700,.35*v,.04,'triangle')},
  92:(d,t,v)=>{const gn=ctx.createGain(),bp=filt('bandpass',3000,1.2);env(gn,t,.3*v,.04);bp.connect(gn);gn.connect(d);noiseSrc(t,.05,bp);tone(d,t,620,.18*v,.035,'triangle')},
  93:(d,t,v)=>{const f=mtof(36),gn=ctx.createGain(),sh=ctx.createWaveShaper(),lp=filt('lowpass',900);sh.curve=driveCurve();env(gn,t,.75*v,.7);
    const o=osc('sine',f*2,t,t+.75,sh);o.frequency.setValueAtTime(f*2,t);o.frequency.exponentialRampToValueAtTime(f,t+.035);sh.connect(lp);lp.connect(gn);gn.connect(d)}
};
const DRUM_BUF=new Map();let drumWarm=null;
async function cacheDrum(m){
  if(DRUM_BUF.has(m)||!DRUMS[m])return;
  const live=ctx,len=m===49?2:m===51?1.2:.9,off=new OfflineAudioContext(1,Math.ceil(44100*len),44100);
  ctx=off;try{DRUMS[m](off.destination,0,1)}finally{ctx=live}   // the build is synchronous, so live sounds never see the swap
  DRUM_BUF.set(m,await off.startRendering());
}
function warmDrums(){if(!drumWarm)drumWarm=(async()=>{for(const s of SOUNDS)await cacheDrum(s.m)})().finally(()=>{drumWarm=null});return drumWarm}
function playDrum(m,dest,t,v){
  const b=DRUM_BUF.get(m);
  if(b){const s=ctx.createBufferSource(),gn=ctx.createGain();s.buffer=b;gn.gain.value=v;s.connect(gn);gn.connect(dest);s.start(t);return}
  (DRUMS[m]||DRUMS[36])(dest,t,v);if(ctx instanceof AudioContext)cacheDrum(m);
}

/* the pans: your own recorded notes when you have them (Setup → Sound), otherwise the built-in pan tone */
let PV=new Map();
function playBuf(dest,id,b,T,t,v,light){
  const end=Math.min(b.duration,T.end??b.duration),start=Math.max(0,Math.min(T.start,end-.05)),len=end-start,a=v*Math.pow(10,T.db/20)*(light?.7:1);
  const src=ctx.createBufferSource(),gn=ctx.createGain();src.buffer=b;if(src.detune)src.detune.value=(T.cents||0)+refCents();src.connect(gn);gn.connect(dest);
  gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(a,t+.004);   // a 4 ms fade-in keeps it free of clicks
  let stopAt;
  if(light){const e=Math.max(.13,Math.min(len,.45));gn.gain.setValueAtTime(a,t+.12);gn.gain.linearRampToValueAtTime(0,t+e);stopAt=t+e+.01}
  else{gn.gain.setValueAtTime(a,t+Math.max(.01,len-T.fade));gn.gain.linearRampToValueAtTime(0,t+len);stopAt=t+len+.01}
  src.start(t,start);src.stop(stopAt);
  const prev=PV.get(id);   // the same note struck again damps the older ring, like a real pan
  if(prev&&prev.end>t){try{hold(prev.g.gain,t);prev.g.gain.linearRampToValueAtTime(0,t+.03);prev.src.stop(t+.04)}catch{}}
  PV.set(id,{src,g:gn,end:stopAt});
}
function panTone(dest,f,t,v,light){
  const ring=(light?.7:1.7)*Math.pow(261.6/f,.35),out=ctx.createGain();out.connect(dest);
  const lp=filt('lowpass',Math.min(9000,f*14));lp.frequency.setValueAtTime(Math.min(9000,f*14),t);lp.frequency.exponentialRampToValueAtTime(Math.max(900,f*5),t+.35);lp.connect(out);
  const parts=light?[[1,1,1],[2,.5,.6]]:[[1,1,1],[2,.55,.6],[3.003,.18,.35],[4,.08,.22]];
  for(const [mul,amp,dk] of parts){const gn=ctx.createGain(),a=amp*v*.3,end=t+ring*dk;
    gn.gain.setValueAtTime(.0001,t);gn.gain.exponentialRampToValueAtTime(a,t+.004);gn.gain.exponentialRampToValueAtTime(a*.4,t+.07);gn.gain.exponentialRampToValueAtTime(.0001,end);
    gn.connect(lp);osc('sine',f*mul,t,end+.02,gn)}
  const bp=filt('bandpass',Math.min(6000,f*4),1.2),ng=ctx.createGain();ng.gain.value=.05*v;bp.connect(ng);ng.connect(out);noiseSrc(t,.03,bp);
}
const mine=id=>S.panVoice==='mine'&&SAMPLES.wav[id];
function panVoice(dest,id,t,v){
  if(!PITCH[id])return;const light=v<.78;
  if(mine(id)){const b=SAMPLES.buf[id];if(b){playBuf(dest,id,b,tuneOf(id),t,v,light);return}sampleBuf(id)}
  panTone(dest,pitchHz(id),t,v,light);
}
const warmPans=()=>Promise.all(Object.keys(SAMPLES.wav).filter(mine).map(sampleBuf));

/* ---- the beat sequencer (Pocket Band's styles) ---- */
const ALL16=[...Array(16).keys()],EVEN=n=>[...Array(n/2).keys()].map(i=>i*2),ODD=n=>[...Array(n/2).keys()].map(i=>i*2+1),dup=(a,o=16)=>[...a,...a.map(i=>i+o)];
const STYLES={
  soca:{name:'Soca',bpm:140,len:16,unit:16,swing:0,rows:[[81,[0,2,3,4,6,7,8,10,11,12,14,15],[2,6,10,14]],[73,EVEN(16)],[36,[0,4,8,12]],[38,[4,12],[4,12]],[42,[0,4,8,12]],[46,[2,6,10,14]],[63,[3,6,11,14]],[64,[7,15]]]},
  calypso:{name:'Calypso',bpm:112,len:16,unit:8,swing:.35,rows:[[81,[0,3,6,8,11,14],[0,8]],[73,[0,4,8,12]],[36,[0,6,8]],[38,[4,12],[4,12]],[42,EVEN(16)],[63,[2,6,10,14]],[64,[0,8]]]},
  panorama:{name:'Panorama jam',bpm:150,len:32,unit:16,swing:0,rows:[[81,dup([0,2,3,4,6,7,8,10,11,12,14,15]),dup([2,6,10,14])],[80,dup([1,5,9,13])],[73,[...Array(32).keys()]],[56,[0,8,16,24]],[36,dup([0,4,8,12])],[38,[4,12,20,28,30,31],[4,12,20,28]],[63,dup([3,6,11,14])],[64,dup([7,15])],[49,[0],[0]]]},
  salsa:{name:'Latin: salsa (3-2 clave)',bpm:96,len:32,unit:8,swing:0,rows:[[75,[0,6,12,20,24],[0,6,12,20,24]],[56,[0,4,8,12,16,20,24,28],[0,16]],[62,[4,20]],[63,[12,14,28,30]],[70,EVEN(32)]]},
  jazz:{name:'Jazz swing',bpm:140,len:16,unit:8,swing:1,rows:[[51,[0,4,6,8,12,14],[4,12]],[42,[4,12]],[36,[0]],[38,[11]]]},
  funk:{name:'Funk',bpm:98,len:16,unit:16,swing:.15,rows:[[36,[0,3,8,10]],[38,[4,7,9,12,15],[4,12]],[42,ALL16.filter(i=>i!==14),[0,2,4,6,8,10,12]],[46,[14]]]},
  afrobeat:{name:'Afrobeat',bpm:110,len:16,unit:8,swing:.1,rows:[[36,[0,6,10]],[37,[4,12]],[42,EVEN(16)],[70,ODD(16)],[63,[2,7,10,15]],[64,[6,14]],[56,[0,3,6,8,11,14],[0,8]]]},
  amapiano:{name:'Amapiano',bpm:113,len:16,unit:16,swing:.4,rows:[[36,[0,4,8,12]],[93,[3,6,10,14],[6,14]],[39,[4,12]],[70,ALL16,[2,6,10,14]],[37,[7,15]]]},
  pop:{name:'Pop / classics',bpm:100,len:16,unit:8,swing:0,rows:[[36,[0,8,10]],[38,[4,12],[4,12]],[42,EVEN(16)]]}
};
const styleRows=st=>st.rows.map(([m,hits,acc=[]])=>({m,steps:Array.from({length:st.len},(_,i)=>hits.includes(i)?(acc.includes(i)?2:1):0)}));
const swingDelay=(tr,s)=>tr.unit===16?(s%2===1?tr.swing/12:0):(s%4===2?tr.swing/6:0);
function beatHits(tr,a,b){
  const out=[],off=new Set(tr.off||[]),bpb=BPB();
  for(let s=Math.ceil(a*4-1e-9);s/4<b;s++){if(off.has(Math.floor(s/4/bpb)))continue;const st=((s%tr.len)+tr.len)%tr.len;
    for(const r of tr.rows){const v=r.steps[st];if(v)out.push([s/4+swingDelay(tr,s),r.m,v===2?1:.72])}}
  return out;
}

/* ---- the transport ---- */
const T={playing:false,rec:false,t0:0,b0:0,pos:0,schedU:0,timer:0,scheduled:[],sources:[],take:0,recTid:null,mic:null,noCyc:false,raf:0};
const cycOn=()=>!!(song.cycle&&song.cycle.on&&song.cycle.e>song.cycle.s);
const looping=()=>cycOn()&&!T.noCyc;
const loopS=()=>looping()?song.cycle.s*BPB():0;
const loopE=()=>looping()?song.cycle.e*BPB():L();
const uNow=()=>T.b0+(ctx.currentTime-T.t0)/spb();
const wrap=u=>{if(!looping())return u;const s=loopS(),n=loopE()-s;return s+(((u-s)%n)+n)%n};
const beatNow=()=>T.playing?wrap(Math.max(T.b0,uNow())):T.pos;
const u2t=u=>T.t0+(u-T.b0)*spb();
function play(countIn){
  if(T.playing||!AC())return;refreshGains();
  if(looping()&&(T.pos<loopS()||T.pos>=loopE()))T.pos=loopS();
  if(!looping()&&!T.rec&&T.pos>=L()-.01)T.pos=0;
  audio.pause();
  const cin=countIn?(ck().bars===2?2:1)*BPB():0,pre=cin*spb();
  T.playing=true;T.t0=ctx.currentTime+.08+pre;T.b0=T.pos;T.schedU=T.pos;
  for(let i=0;i<cin;i++)click(T.t0-(cin-i)*spb(),i%BPB()===0);   // a bar (or two) of clicks before the take
  T.cin=cin;
  for(const tr of song.tracks){const a=audioOf(tr);if(!a||(T.mic&&T.mic.tr===tr))continue;const off=(T.pos-startOf(tr))*spb();if(off>0&&off<a.duration)startSrc(tr,T.t0,off,looping()?u2t(loopE()):0)}
  T.timer=setInterval(tick,25);tick();renderTransport();frame();
}
function stop(rewind){
  if(T.mic){micStop();return}
  if(!T.playing){T.pos=rewind===false?T.pos:0;renderTransport();updatePlayhead();return}
  T.pos=Math.min(beatNow(),L());T.playing=false;clearInterval(T.timer);cancelAnimationFrame(T.raf);
  const now=ctx.currentTime;T.scheduled.forEach(x=>{try{x.stop(now)}catch{}});T.scheduled=[];
  T.sources.forEach(s=>{try{s.stop()}catch{}});T.sources=[];
  if(T.rec){T.rec=false;if(WR.on)writeRecEnd();else endNoteRec()}
  if(rewind===true)T.pos=looping()?loopS():0;
  renderTransport();updatePlayhead();
}
function restartIfPlaying(){if(T.playing&&!T.rec){stop(false);play(false)}}
function tick(){
  const to=uNow()+.15/spb();
  if(looping()){const s=loopS(),n=loopE()-s;let from=T.schedU;
    while(from<to-1e-9){const k=Math.floor((from-s)/n+1e-9),end=Math.min(to,s+(k+1)*n);scheduleRange(from-k*n,end-k*n,k*n);from=end}}
  else scheduleRange(T.schedU,to,0);
  T.schedU=to;
  if(T.rec&&uNow()>L()-BPB()){song.minBars=bars()+4;renderTimeline()}
  if(!looping()&&!T.rec&&uNow()>=L())stop(true);
}
function scheduleRange(a,b,off){
  const sp=spb(),wrapped=looping()&&off>0&&Math.abs(a-loopS())<1e-6;
  for(const tr of song.tracks){
    const c=channel(tr);
    if(tr.type==='beats'){for(const [bt,m,v] of beatHits(tr,a,b))playDrum(m,c.play,u2t(bt+off),v);continue}
    const buf=audioOf(tr);
    if(buf){if(T.mic&&T.mic.tr===tr)continue;const st=startOf(tr);
      const endT=looping()?u2t(off+loopE()):0;
      if(st>=a&&st<b)startSrc(tr,u2t(st+off),0,endT);
      else if(wrapped&&st<a&&st+buf.duration/sp>a)startSrc(tr,u2t(a+off),(a-st)*sp,endT);   // the loop came round partway into this recording
      continue}
    if(tr.type==='part'){for(const n of partNotes())if(n.t>=a&&n.t<b)panVoice(c.play,n.p,u2t(n.t+off),n.v);continue}
    if(tr.type!=='pan')continue;
    // Replace mode: just before the playhead gets there, older notes on the track being recorded are wiped
    if(T.rec&&(song.recMode==='replace'||song.recMode==='take')&&tr.id===T.recTid)tr.notes=tr.notes.filter(n=>!(n.t>=a&&n.t<b&&n.tk!==T.take));
    for(const n of pnotes(tr))if(n.t>=a&&n.t<b&&n.tk!==T.take)panVoice(c.play,n.p,u2t(n.t+off),n.v);
  }
  if(song.metro&&ck().sound!=='none'&&(!ck().recOnly||T.rec))for(let k=Math.ceil(a-1e-9);k<b;k++)click(u2t(k+off),k%BPB()===0);
}
function startSrc(tr,t,offset,endT){
  const s=ctx.createBufferSource();s.buffer=audioOf(tr);s.connect(channel(tr).play);
  s.start(Math.max(t,ctx.currentTime),offset+Math.max(0,ctx.currentTime-t));
  if(endT&&endT>t)s.stop(endT);   // a loop: this pass ends at the loop's end
  T.sources.push(s);s.onended=()=>{T.sources=T.sources.filter(x=>x!==s)};
}
function seek(b){const was=T.playing&&!T.rec;if(T.playing)stop(false);T.pos=Math.max(0,Math.min(L(),b));if(was)play(false);updatePlayhead()}

/* ---- recording pan taps ---- */
// one tap delay for the whole app: Write's 'Tap delay fix' and Studio's pan-tap timing are the same number
const tapMs=()=>Math.round((Number.isFinite(S.tapLag)?S.tapLag:0)*1000);
const latBeats=()=>tapMs()/1000/spb();
const recBeatAt=t=>wrap(Math.max(T.b0,T.b0+(t-T.t0)/spb()-latBeats()));
function recNote(tr,id,v){
  if(!(T.rec&&T.playing&&tr.id===T.recTid)||ctx.currentTime<T.t0-.05)return null;   // nothing records during the count-in
  const n={t:+recBeatAt(ctx.currentTime).toFixed(3),d:.25,p:id,v:+v.toFixed(2),tk:T.take};tr.notes.push(n);return n;
}
function recOff(n){if(!n)return;let d=recBeatAt(ctx.currentTime)-n.t;if(d<-.5&&looping())d+=loopE()-loopS();n.d=+Math.max(.25,Math.min(4,d)).toFixed(3)}   // a quick tap shows as a quarter beat
function endNoteRec(){
  const tr=trById(T.recTid),take=T.take;T.recTid=null;T.noCyc=false;if(!tr)return;
  const mineN=tr.notes.filter(n=>n.tk===take);
  if(song.snapRec&&song.snap!=='off')mineN.forEach(n=>{n.t=snapBeat(n.t,+song.snap)});
  tr.notes.forEach(n=>{delete n.tk});tr.notes.sort((x,y)=>x.t-y.t);
  if(song.recMode==='take'&&tr.takes){
    if(!mineN.length){if(H.u.length)restore(H.u.pop());else takeDrop(tr);renderUndo();renderAll();say('Nothing was played, so no new take.');return}
    dirty();renderAll();say(tr.takes[tr.tk].name+' recorded on '+tr.name+'. Choose between takes in ⚙ Track settings.');return}
  if(!mineN.length&&song.recMode!=='replace'){H.u.pop();renderUndo();renderAll();return}
  dirty();renderAll();say(song.recMode==='replace'?'Take recorded on '+tr.name+'.':'Recorded '+mineN.length+' note'+(mineN.length===1?'':'s')+' on '+tr.name+'.');
}
function toggleRec(){
  if(T.mic){micStop();return}
  if(T.rec){T.rec=false;if(WR.on)writeRecEnd();else endNoteRec();renderTransport();return}
  const tr=selTr();
  if(tr.type==='audio'){micStart(tr);return}
  if(tr.type==='part'){if(!AC())return;writeRecStart(tr);return}
  if(tr.type!=='pan'){say('Choose a Mic or Pan taps track to record into, or add one with + Add track.');return}
  if(!AC())return;pushHistory();T.take++;T.recTid=tr.id;T.rec=true;
  if(song.recMode==='take')takeBegin(tr);
  if(!T.playing)play(song.countIn);else renderTransport();
  setView('inst');
}
const held=new Map();   // finger → the note it's holding (hold for a roll)
function panDown(e,el){
  e.preventDefault();if(!AC())return;const tr=selTr();
  // My part: the pans play so you can try a line, but notes are written in Write
  if(tr.type==='part'){const id=el.dataset.field,c=channel(tr);panVoice(c.out,id,ctx.currentTime+.003,.95);el.classList.add('hit');
    const r={el,n:null,timer:0,rolls:[],write:writeTap(tr,id),t0:ctx.currentTime};
    const go=()=>{panVoice(c.out,id,ctx.currentTime+.003,.5+Math.random()*.25);r.rolls.push(1);r.timer=setTimeout(go,60+Math.random()*18)};
    r.timer=setTimeout(go,HOLD_MS);held.set(e.pointerId,r);return}
  if(tr.type!=='pan')return;
  const id=el.dataset.field,c=channel(tr);panVoice(c.out,id,ctx.currentTime+.003,.95);const n=recNote(tr,id,.95);
  el.classList.add('hit');
  const r={el,n,timer:0,rolls:[]};
  const go=()=>{const v=.5+Math.random()*.25;panVoice(c.out,id,ctx.currentTime+.003,v);const rn=recNote(tr,id,v);if(rn){rn.d=.25;r.rolls.push(rn)}r.timer=setTimeout(go,60+Math.random()*18)};
  r.timer=setTimeout(go,HOLD_MS);held.set(e.pointerId,r);
}
function panUp(e){const r=held.get(e.pointerId);if(!r)return;clearTimeout(r.timer);setTimeout(()=>r.el.classList.remove('hit'),90);
  if(r.write!==undefined){held.delete(e.pointerId);const c=r.write;if(c&&r.rolls.length){c.fx='roll';c.duration=+Math.max(.3,ctx.currentTime-r.t0).toFixed(3);partCache=null}return}if(!r.rolls.length)recOff(r.n);else if(r.n)r.n.d=.5;held.delete(e.pointerId)}
window.addEventListener('pointerup',panUp);window.addEventListener('pointercancel',panUp);

/* ---- recording straight into Write: My part's taps become your cues ---- */
// The notes land in Write at their place in the song (tap delay fixed), so they're in your chart, the lanes and the
// game too. Notes hit together make a chord; hold a note to roll it. Undo in Write takes the whole take back.
const WR={on:false,last:null,n:0};
function writeRecStart(tr){
  if(T.mic)return;pushUndo();if(isDemo){S.cues=[];isDemo=false;try{renderDemo()}catch{}}
  WR.on=true;WR.last=null;WR.n=0;T.take++;T.recTid=tr.id;T.rec=true;
  if(!T.playing)play(song.countIn);else renderTransport();setView('inst');
}
function writeTap(tr,id){
  if(!(WR.on&&T.rec&&T.playing&&tr.id===T.recTid)||ctx.currentTime<T.t0-.05)return null;
  let b=recBeatAt(ctx.currentTime);if(song.snapRec&&song.snap!=='off')b=snapBeat(b,+song.snap);
  const t=+(origin()+b*spb()).toFixed(3);if(t<0)return null;
  const last=WR.last;
  if(last&&Math.abs(t-last.start)<.06){if(!last.steps.includes(id)){last.steps.push(id);last.mode='together'}return last}   // hit together: a chord
  if(last&&t>last.start&&t<last.start+last.duration)last.duration=Math.max(.05,+(t-last.start).toFixed(3));
  const c={id:uid(),start:t,duration:+(spb()*.5).toFixed(3),steps:[id],mode:'together',note:''};
  S.cues.push(c);S.cues.sort((x,y)=>x.start-y.start);WR.last=c;WR.n++;partCache=null;return c;
}
function writeRecEnd(){
  const n=WR.n;WR.on=false;WR.last=null;T.recTid=null;
  try{normalizeChords()}catch{}save();try{renderCues()}catch{}partCache=null;renderAll();
  say(n?n+' note'+(n===1?'':'s')+' went straight into Write. They\'re on your chart and in the game too. (Undo in Write takes them back.)':'Nothing was played.');
}

/* ---- takes: a track keeps every pass you record, you choose which one plays ---- */
// pan taps: the playing take's notes are tr.notes; the others wait in tr.takes. Each new take starts from the one
// playing, with the bars you record replaced.
function takeBegin(tr){
  if(!tr.takes||!tr.takes.length){tr.takes=[{name:'Take 1',notes:null}];tr.tk=0}
  const prev=tr.tk,copy=JSON.parse(JSON.stringify(tr.notes));tr.takes[prev].notes=tr.notes;
  tr.takes.push({name:'Take '+(tr.takes.length+1),notes:null,from:prev});tr.tk=tr.takes.length-1;tr.notes=copy;
}
function takeDrop(tr){   // a pass with nothing in it
  const k=tr.tk,back=tr.takes[k].from??0;tr.takes.splice(k,1);tr.tk=Math.min(back,tr.takes.length-1);tr.notes=tr.takes[tr.tk].notes||[];tr.takes[tr.tk].notes=null;
  if(tr.takes.length<2){delete tr.takes;delete tr.tk}
}
function takeUse(tr,i){
  if(tr.type==='audio'){if(!tr.alts||!tr.alts[i])return;const cur={take:tr.take,file:tr.file,start:tr.start,dur:tr.dur,peaks:tr.peaks,lagMs:tr.lagMs,name:tr.takeName||'Take'},nx=tr.alts[i];
    tr.alts[i]=cur;Object.assign(tr,{take:nx.take,file:nx.file,start:nx.start,dur:nx.dur,peaks:nx.peaks,lagMs:nx.lagMs||0,takeName:nx.name});
    if(!buffers[tr.take])idbGet('stake:'+tr.take).then(async b=>{if(b instanceof Blob)try{buffers[tr.take]=await decode(b);renderAll()}catch{}});return}
  if(!tr.takes||!tr.takes[i]||i===tr.tk)return;tr.takes[tr.tk].notes=tr.notes;tr.notes=tr.takes[i].notes||[];tr.takes[i].notes=null;tr.tk=i;
}
function takeDel(tr,i){
  if(tr.type==='audio'){const a=tr.alts&&tr.alts[i];if(!a)return;tr.alts.splice(i,1);if(a.take)idbPut('stake:'+a.take,null);return}
  if(!tr.takes||tr.takes.length<2)return;if(i===tr.tk)takeUse(tr,i===0?1:0);tr.takes.splice(i,1);if(tr.tk>i)tr.tk--;
  if(tr.takes.length<2){tr.notes=tr.notes;delete tr.takes;delete tr.tk}
}
// a mic track: recording again keeps the take before it
function keepAlt(tr){if(!tr.take)return;tr.alts=tr.alts||[];const n=tr.alts.length+1;
  tr.alts.unshift({take:tr.take,file:tr.file,start:tr.start,dur:tr.dur,peaks:tr.peaks,lagMs:tr.lagMs,name:tr.takeName||'Take '+n});tr.takeName='Take '+(n+1)}

/* ---- tempo: one tempo per song; everything in bars follows it ---- */
// With no recording, your part in Write is moved with it, so My part, the chart's sections and Studio stay together.
// With a recording, the recording is the tempo: this sets where the bars fall on it (the same as ♩ Timing in Write).
function setTempo(v,opts){
  v=Math.round(Math.max(40,Math.min(240,v))*10)/10;const old=bpm();if(Math.abs(v-old)<.05&&!(opts&&opts.perBar))return;
  const was=T.playing&&!T.rec,beat=beatNow();if(T.playing)stop(false);
  const G=S.grid,perBar=opts&&opts.perBar||(G?G.perBar:4);
  if(!pBuf){const k=old/v;
    S.cues.forEach(c=>{c.start=+(c.start*k).toFixed(4);c.duration=+Math.max(.05,c.duration*k).toFixed(4)});
    if(S.chart&&typeof S.chart.text==='string')S.chart.text=S.chart.text.replace(/@\s*(\d+):(\d{1,2}(?:\.\d+)?)/g,(m,mm,ss)=>{const x=(+mm*60+ +ss)*k;return '@'+Math.floor(x/60)+':'+(x%60).toFixed(2).padStart(5,'0')});
    S.grid={bpm:v,offset:G?+(G.offset*k).toFixed(4):0,perBar};
    if(typeof loop!=='undefined'&&A!==null&&B!==null){A*=k;B*=k}}
  else S.grid={offset:G?G.offset:0,...(G||{}),bpm:v,perBar};
  song.bpm=v;partCache=null;T.pos=beat;
  try{save()}catch{}try{renderGrid()}catch{}try{renderAll()}catch{}dirty();if(SH.kind==='tempo')renderSheet();
  if(was)play(false);
}
const TAP={t:[]};
function tapTempo(){
  const now=performance.now();if(TAP.t.length&&now-TAP.t[TAP.t.length-1]>2000)TAP.t=[];TAP.t.push(now);if(TAP.t.length>8)TAP.t.shift();
  if(AC())click(ctx.currentTime+.005,TAP.t.length===1);
  if(TAP.t.length<3){const el=q('#stTapMsg');if(el)el.textContent='Keep tapping…';return}
  const d=TAP.t.slice(1).map((x,i)=>x-TAP.t[i]).sort((a,b)=>a-b),med=d[Math.floor(d.length/2)];setTempo(60000/med);
  const el=q('#stTapMsg');if(el)el.textContent='Tapped '+(+bpm().toFixed(1))+' bpm';
}

/* ---- recording from the microphone ---- */
// The take is captured inside the same audio clock that plays the song, so it lines up to the sample;
// the mic timing (Timing fix) covers the delay of the speaker or headphones and the mic.
const WORKLET=`registerProcessor('st-cap',class extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(8192);this.n=0;this.f0=-1;this.on=true;
this.port.onmessage=()=>{this.flush();this.on=false;this.port.postMessage({end:1})}}
flush(){if(this.n){this.port.postMessage({f:this.f0,d:this.b.slice(0,this.n)});this.n=0;this.f0=-1}}
process(i){if(!this.on)return false;const c=i[0]&&i[0][0];if(c){if(this.n+c.length>this.b.length)this.flush();if(this.f0<0)this.f0=currentFrame;this.b.set(c,this.n);this.n+=c.length}return true}})`;
let workletReady=null;
async function capture(stream){
  const src=ctx.createMediaStreamSource(stream),mute=ctx.createGain();mute.gain.value=0;mute.connect(ctx.destination);
  const chunks=[];let node,done;
  try{
    if(!ctx.audioWorklet)throw 0;
    if(!workletReady)workletReady=ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET],{type:'application/javascript'})));
    await workletReady;
    node=new AudioWorkletNode(ctx,'st-cap',{numberOfInputs:1,numberOfOutputs:1,channelCount:1,channelCountMode:'explicit'});
    const ended=new Promise(r=>done=r);
    node.port.onmessage=e=>{if(e.data.end)done();else chunks.push(e.data)};
    src.connect(node);node.connect(mute);
    return{chunks,stop:async()=>{node.port.postMessage('stop');await Promise.race([ended,new Promise(r=>setTimeout(r,500))]);try{src.disconnect();node.disconnect()}catch{}return chunks}};
  }catch{
    const sp=ctx.createScriptProcessor(4096,1,1),sr=ctx.sampleRate;
    sp.onaudioprocess=e=>chunks.push({f:Math.round(e.playbackTime*sr)-2*4096,d:e.inputBuffer.getChannelData(0).slice(0)});
    src.connect(sp);sp.connect(mute);
    return{chunks,stop:async()=>{try{src.disconnect();sp.disconnect()}catch{}return chunks}};
  }
}
const micLag=()=>PR.micLag!=null?PR.micLag/1000:(ctx.outputLatency||0)+(ctx.baseLatency||0)+.012;
function joinChunks(chunks){const n=chunks.reduce((a,c)=>a+c.d.length,0),out=new Float32Array(n);let p=0;for(const c of chunks){out.set(c.d,p);p+=c.d.length}return{data:out,f0:chunks.length?chunks[0].f:0}}
let micBusy=false;
async function micStart(tr){
  if(micBusy)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){say("The microphone isn't available here. Open Panyard from your home screen or in Chrome.");return}
  if(!AC())return;micBusy=true;
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
  catch{micBusy=false;say("Panyard can't use the microphone. Allow it in your browser or phone settings, then try again.");return}
  if(T.playing)stop(false);
  const cap=await capture(stream);micBusy=false;
  pushHistory();T.mic={tr,cap,stream};T.rec=true;T.recTid=tr.id;T.noCyc=true;
  play(song.countIn);setView('inst');
}
async function micStop(){
  const m=T.mic;if(!m)return;T.mic=null;T.rec=false;T.recTid=null;
  const startT=T.t0,startB=T.b0;
  const chunks=await m.cap.stop();m.stream.getTracks().forEach(t=>t.stop());
  stop(false);T.noCyc=false;
  const {data,f0}=joinChunks(chunks),sr=ctx.sampleRate,i0=Math.round((startT+micLag())*sr)-f0;
  if(!data.length||data.length-Math.max(0,i0)<sr*.3){H.u.pop();renderUndo();say('That take was too short to keep.');renderAll();return}
  const pcm=data.subarray(Math.max(0,i0)),buf=ctx.createBuffer(1,pcm.length,sr);buf.getChannelData(0).set(pcm);
  const id=uid();buffers[id]=buf;keepAlt(m.tr);
  Object.assign(m.tr,{take:id,start:+(startB+(i0<0?-i0/sr/spb():0)).toFixed(4),dur:+buf.duration.toFixed(3),peaks:peaksOf(buf),file:'Mic take',lagMs:0});
  idbPut('stake:'+id,encodeWav(pcm,sr));
  T.pos=startB;dirty();renderAll();say('Recorded '+buf.duration.toFixed(1)+' s on '+m.tr.name+'.');
}
function peaksOf(buf){
  const d=buf.getChannelData(0),n=Math.max(40,Math.min(2000,Math.round(buf.duration*20))),step=Math.max(1,Math.floor(d.length/n)),p=[];let mx=0;
  for(let i=0;i<n;i++){let m=0;for(let j=i*step;j<Math.min(d.length,(i+1)*step);j+=4)m=Math.max(m,Math.abs(d[j]));p.push(m);if(m>mx)mx=m}
  return p.map(x=>+(mx?Math.sqrt(x/mx):0).toFixed(3));
}
async function decode(blob){const ab=await blob.arrayBuffer();return await new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)})}
async function importFile(tr,f){
  if(!f||!AC())return;
  let buf;try{buf=await decode(f)}catch{say('"'+f.name+'" could not be opened as audio. Try an MP3, M4A or WAV.');return}
  pushHistory();const id=uid();buffers[id]=buf;idbPut('stake:'+id,f);keepAlt(tr);
  const st=T.pos>0?Math.floor(T.pos/BPB())*BPB():0;
  Object.assign(tr,{take:id,start:st,dur:+buf.duration.toFixed(3),peaks:peaksOf(buf),file:f.name,lagMs:0});
  if(tr.name==='Mic')tr.name=f.name.replace(/\.[^.]+$/,'').slice(0,28)||'Audio';
  dirty();renderAll();say('Added "'+f.name+'" from bar '+(st/BPB()+1)+'.');
}

/* ---- timing fix: taps (how late a tap reaches the app) and the mic (measured with the phone speaker) ---- */
const CAL={on:false,clicks:[],taps:[]};
function startTapCal(){
  if(!AC())return;if(T.playing)stop(false);const sp=.6,t0=ctx.currentTime+.6;CAL.on=true;CAL.clicks=[];CAL.taps=[];
  for(let i=0;i<12;i++){const t=t0+i*sp;CAL.clicks.push(t);click(t,i%4===0,true)}
  calMsg('Tap the big button on every click…');setTimeout(finishTapCal,(.6+12*sp+.4)*1000);
}
function finishTapCal(){
  CAL.on=false;const offs=[];
  for(const t of CAL.taps){let best=null;for(const c of CAL.clicks.slice(2)){const d=t-c;if(Math.abs(d)<.3&&(best===null||Math.abs(d)<Math.abs(best)))best=d}if(best!==null)offs.push(best)}
  if(offs.length<5){calMsg('Not enough taps landed near the clicks. Try again and tap along with each click.');return}
  offs.sort((a,b)=>a-b);const ms=Math.round(Math.max(-100,Math.min(350,offs[Math.floor(offs.length/2)]*1000)));S.tapLag=ms/1000;PR.latency=ms;savePR();save();try{renderGrid()}catch{}
  calMsg('Done. Your taps land about '+Math.abs(tapMs())+' ms '+(tapMs()>=0?'late':'early')+'. Pan taps here and Tap along in Write are both shifted to match.');renderSheet();
}
async function measureMic(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!AC()){say("The microphone isn't available here.");return}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}catch{say("Panyard can't use the microphone.");return}
  if(T.playing)stop(false);calMsg('Listening… keep the phone still and quiet.');
  const cap=await capture(stream),t0=ctx.currentTime+.5,clicks=[];
  for(let i=0;i<8;i++){const t=t0+i*.5;clicks.push(t);const gn=ctx.createGain();env(gn,t,.9,.03);gn.connect(ctx.destination);osc('square',1000,t,t+.04,gn)}
  await new Promise(r=>setTimeout(r,(.5+8*.5+.5)*1000));
  const {data,f0}=joinChunks(await cap.stop());stream.getTracks().forEach(t=>t.stop());
  const sr=ctx.sampleRate,lags=[];
  for(const t of clicks){const a=Math.round(t*sr)-f0,b=a+Math.round(.45*sr);if(a<0||b>data.length)continue;
    let mx=0;for(let i=a;i<b;i++)mx=Math.max(mx,Math.abs(data[i]));if(mx<.02)continue;
    for(let i=a;i<b;i++)if(Math.abs(data[i])>mx*.4){lags.push((i-a)/sr);break}}
  if(lags.length<4){calMsg("Couldn't hear the clicks. Take off headphones, turn the volume up and try again, or set it by ear below.");return}
  lags.sort((x,y)=>x-y);PR.micLag=Math.round(lags[Math.floor(lags.length/2)]*1000);savePR();
  calMsg('Measured '+PR.micLag+' ms. New mic takes are moved this much earlier. With headphones it can differ: nudge a take if it sounds late.');renderSheet();
}
const calMsg=t=>{const el=q('#stCalMsg');if(el)el.textContent=t;else say(t)};

/* ---- undo / redo: a snapshot of the studio song before each change ---- */
const H={u:[],r:[]};
function pushHistory(){H.u.push(JSON.stringify(song));if(H.u.length>60)H.u.shift();H.r=[];renderUndo()}
function restore(json){const keep=song.sel;song=JSON.parse(json);if(trById(keep))song.sel=keep;chans.clear();SEL=null;refreshGains();dirty();renderAll()}
function undo(){if(!H.u.length||T.playing&&T.rec)return;H.r.push(JSON.stringify(song));restore(H.u.pop());renderUndo()}
function redo(){if(!H.r.length||T.playing&&T.rec)return;H.u.push(JSON.stringify(song));restore(H.r.pop());renderUndo()}
function renderUndo(){const u=q('#stUndo'),r=q('#stRedo');if(u)u.disabled=!H.u.length;if(r)r.disabled=!H.r.length}

/* ---- saving: the studio song with each Panyard song, takes as audio files on this phone ---- */
let saveT=0;
function dirty(){clearTimeout(saveT);saveT=setTimeout(()=>{if(song&&songKey)idbPut('studio:'+songKey,JSON.parse(JSON.stringify(song)))},400)}
const keyNow=()=>{try{return songNow().id}catch{return 'main'}};
/* ---- backups carry the Studio tracks too (pan taps, My part, beats, the mix). Mic takes stay on this device. ---- */
window.backupExtra=async()=>{
  const k=keyNow();let sg=song&&songKey===k?song:await idbGet('studio:'+k);
  if(!sg||!Array.isArray(sg.tracks))return{};
  sg=JSON.parse(JSON.stringify(sg));sg.tracks=sg.tracks.filter(t=>t.type!=='audio');
  return sg.tracks.some(t=>t.type!=='practice')?{studio:sg}:{};
};
window.backupIn=async p=>{
  const st=p&&p.studio;if(!st||!Array.isArray(st.tracks))return'';
  const num=(v,a,b,d)=>Number.isFinite(+v)?Math.max(a,Math.min(b,+v)):d;
  const tracks=st.tracks.filter(t=>t&&['practice','part','pan','beats'].includes(t.type)).slice(0,24).map(t=>{
    const o=trk(t.type,{name:String(t.name||'').slice(0,28)||trk(t.type).name,vol:num(t.vol,0,1.5,.85),pan:num(t.pan,-1,1,0),mute:!!t.mute,solo:!!t.solo,mix:t.mix==null?null:num(t.mix,0,1,null)});
    const cleanN=arr=>(Array.isArray(arr)?arr:[]).filter(n=>n&&PITCH[n.p]&&Number.isFinite(+n.t)&&n.t>=0).slice(0,20000).map(n=>({t:+n.t,d:num(n.d,.02,64,.5),p:n.p,v:num(n.v,0,1,.9),...(n.roll?{roll:1}:{})}));
    if(t.fx&&typeof t.fx==='object')o.fx={treble:num(t.fx.treble,-12,12,0),bass:num(t.fx.bass,-12,12,0),comp:num(t.fx.comp,0,1,0),echo:num(t.fx.echo,0,.6,0),echoT:ECHOES[t.fx.echoT]?t.fx.echoT:'q',room:ROOMS.some(r=>r[0]===+t.fx.room)?+t.fx.room:0};
    if(t.type==='pan'){o.panSet=SETS[t.panSet]?t.panSet:'guitar';o.notes=cleanN(t.notes);
      if(t.q&&QNT[t.q.mode])o.q={mode:t.q.mode,div:[1,.5,.25].includes(+t.q.div)?+t.q.div:.5,sw:t.q.sw==='heavy'?'heavy':'light'};
      if(Number.isInteger(t.tp)&&t.tp&&Math.abs(t.tp)<=24)o.tp=t.tp;
      if(Array.isArray(t.takes)&&t.takes.length>1&&Number.isInteger(t.tk)&&t.takes[t.tk]){o.takes=t.takes.slice(0,50).map((k,i)=>({name:String(k&&k.name||'Take '+(i+1)).slice(0,28),notes:i===t.tk?null:cleanN(k&&k.notes)}));o.tk=Math.min(t.tk,o.takes.length-1)}}
    if(t.type==='beats'){o.len=Number.isInteger(t.len)&&t.len>=1&&t.len<=64?t.len:16;o.unit=Number.isInteger(t.unit)&&t.unit>=1&&t.unit<=32?t.unit:8;o.swing=num(t.swing,0,.75,0);o.off=(Array.isArray(t.off)?t.off:[]).filter(Number.isInteger);if(typeof t.style==='string')o.style=t.style.slice(0,30);
      o.rows=(Array.isArray(t.rows)?t.rows:[]).filter(r=>r&&Number.isFinite(+r.m)&&Array.isArray(r.steps)).slice(0,16).map(r=>({m:+r.m,steps:r.steps.slice(0,o.len).map(v=>num(v,0,2,0))}))}
    return o});
  if(!tracks.some(t=>t.type==='practice'))tracks.unshift(trk('practice'));
  const C=st.click&&typeof st.click==='object'?st.click:{};
  const sg=Object.assign(blank(),{click:{sound:CLICKS.some(c=>c[0]===C.sound)?C.sound:CK0.sound,level:num(C.level,0,1,CK0.level),bars:C.bars===2?2:1,visual:C.visual!==false,recOnly:!!C.recOnly},recMode:['add','replace','take'].includes(st.recMode)?st.recMode:'add',bpm:num(st.bpm,30,300,100),metro:!!st.metro,countIn:st.countIn!==false,master:num(st.master,0,1.5,.85),minBars:num(st.minBars,1,999,8),tracks,sel:tracks[0].id});
  if(st.cycle&&Number.isFinite(+st.cycle.s)&&Number.isFinite(+st.cycle.e))sg.cycle={on:!!st.cycle.on,s:+st.cycle.s,e:+st.cycle.e};
  if(T.playing)stop(false);await idbPut('studio:'+keyNow(),sg);song=null;songKey=null;
  return ' '+(tracks.length-1)+' Studio tracks added.';
};
async function load(){
  const k=keyNow();if(song&&songKey===k)return;
  if(loading)return loading;
  loading=(async()=>{
    if(T.playing)stop(false);
    songKey=k;const saved=await idbGet('studio:'+k);
    song=saved&&Array.isArray(saved.tracks)?saved:blank();
    if(!song.tracks.some(t=>t.type==='practice'))song.tracks.unshift(trk('practice'));
    song.tracks.forEach(t=>{if(t.type==='beats'&&!Array.isArray(t.off))t.off=[]});
    chans.clear();H.u=[];H.r=[];SEL=null;T.pos=0;
    AC();
    for(const tr of song.tracks)if(tr.type==='audio'&&tr.take&&!buffers[tr.take]){
      const b=await idbGet('stake:'+tr.take);if(b instanceof Blob)try{buffers[tr.take]=await decode(b)}catch{}}
  })().finally(()=>{loading=null});
  return loading;
}
async function practiceLoad(){
  if(!hasAudio||!curBlob||curName==='Example tones'){pBuf=null;pKey='';pPeaks=null;return}
  const k=curName+'|'+curBlob.size;if(k===pKey&&pBuf)return;
  pKey=k;try{pBuf=await decode(curBlob);pPeaks=peaksOf(pBuf)}catch{pBuf=null;pPeaks=null}
}

/* ---- the screen ---- */
let SEL=null;   // selected bars on one track: {tid,anchor,a,b}, b exclusive
const zoomPx=()=>Math.round((innerWidth<560?64:92)*(PR.zoom||1));
const HDW=()=>innerWidth<560?112:150;
const KIND={practice:'Your recording',audio:'Mic / audio',pan:'Pan taps',part:'My part · linked to Write',beats:'Beat'};
const ICON={practice:'♪',audio:'🎙',pan:'◉',part:'✎',beats:'▦'};
function renderTransport(){
  const p=q('#stPlay'),r=q('#stRec');if(!p)return;
  p.textContent=T.playing?'■':'▶';p.setAttribute('aria-label',T.playing?'Stop':'Play');
  r.setAttribute('aria-pressed',String(T.rec));r.classList.toggle('live',T.rec);
  q('#stMetro').setAttribute('aria-pressed',String(!!song.metro));q('#stCount').setAttribute('aria-pressed',String(song.countIn!==false));q('#stLoop').setAttribute('aria-pressed',String(cycOn()));
  q('#stTempo').textContent=(+bpm().toFixed(1))+' bpm';
  document.body.classList.toggle('st-recording',T.rec);
  updatePlayhead();
}
function sections(){
  if(typeof sectionsNow!=='function')return[];
  return sectionsNow().map(s=>({name:s.name,a:(s.t-origin())/spb(),b:(s.end-origin())/spb()}));
}
function renderSecs(){
  const el=q('#stSecs'),ss=sections();el.hidden=!ss.length;if(!ss.length)return;
  el.innerHTML='<span class="help">Loop</span>'+ss.map((s,i)=>{const a=Math.max(0,Math.floor(s.a/BPB()+.02)),b=Math.max(a+1,Math.ceil(s.b/BPB()-.02)),on=cycOn()&&song.cycle.s===a&&song.cycle.e===b;
    return '<button class="chip'+(on?' on':'')+'" data-sec="'+a+','+b+'" aria-pressed="'+on+'">'+esc(s.name)+'</button>'}).join('');
}
function trackRegions(tr){
  const n=bars();
  if(tr.type==='beats'){if(!tr.rows.some(r=>r.steps.some(Boolean)))return[];const off=new Set(tr.off||[]),out=[];for(let b=0;b<n;b++){if(off.has(b))continue;if(out.length&&out[out.length-1][1]===b)out[out.length-1][1]=b+1;else out.push([b,b+1])}return out}
  const a=audioOf(tr);
  if(tr.type==='practice'||tr.type==='audio'){const dur=a?a.duration:tr.dur;if(!dur)return[];const s=startOf(tr)/BPB();return[[s,Math.min(n,s+dur/spb()/BPB())]]}
  const used=new Set(notesOf(tr).map(x=>Math.floor(x.t/BPB()))),out=[];
  for(let b=0;b<n;b++)if(used.has(b)){if(out.length&&out[out.length-1][1]===b)out[out.length-1][1]=b+1;else out.push([b,b+1])}
  return out;
}
function regionsHTML(tr,bar){
  const regs=trackRegions(tr),beat=bar/BPB();
  if(!regs.length)return '<div class="st-empty">'+(tr.type==='practice'?'Add your recording in Setup':tr.type==='audio'?'Select, then ● Rec or import a file':tr.type==='beats'?'Tap steps below to make a beat':'Select, then ● Rec and tap the pans')+'</div>';
  return regs.map(([s,e])=>{
    let inner='';
    if(tr.type==='practice'||tr.type==='audio')inner='<canvas data-peaks="'+tr.id+'" width="'+Math.max(1,Math.round((e-s)*bar))+'" height="64"></canvas>';
    else if(isPanish(tr)){const ps=pidsOf(tr),sc=44/Math.max(1,ps.length);for(const n of pnotes(tr))if(n.t>=s*BPB()&&n.t<e*BPB()){const y=ps.indexOf(n.p);inner+='<i style="background:'+gcol(n.p)+';left:'+((n.t-s*BPB())*beat).toFixed(1)+'px;top:'+(16+y*sc).toFixed(1)+'px;width:'+Math.max(3,Math.min(n.d,e*BPB()-n.t)*beat-1).toFixed(1)+'px"></i>'}}
    else{const rh=Math.min(7,42/Math.max(1,tr.rows.length));for(let b=s;b<e;b++){const base=(b*BPB()*4)%tr.len;tr.rows.forEach((row,r)=>{for(let i=0;i<BPB()*4;i++)if(row.steps[(base+i)%tr.len])inner+='<i style="left:'+((b-s)*bar+i*beat/4+1).toFixed(1)+'px;top:'+(16+r*rh).toFixed(1)+'px;width:'+Math.max(2,beat/4-2).toFixed(1)+'px"></i>'})}}
    return '<div class="st-region" style="left:'+(s*bar+1)+'px;width:'+Math.max(4,(e-s)*bar-2)+'px">'+inner+'</div>';
  }).join('');
}
function drawPeaks(c,tr){
  const p=tr.type==='practice'?pPeaks:tr.peaks;if(!p)return;const gx=c.getContext('2d'),w=c.width,h=c.height;gx.clearRect(0,0,w,h);
  gx.fillStyle=tr.type==='practice'?'#9d93c9':'#3fd0d4';
  for(let x=0;x<w;x++){const v=p[Math.floor(x/w*p.length)]||0,ph=Math.max(1,v*h*.86);gx.fillRect(x,(h-ph)/2+6,1,ph)}
}
function renderTimeline(){
  const tl=q('#stTl');if(!tl||!song)return;
  const bar=zoomPx(),n=bars(),W=bar*n,hd=HDW(),keep=[tl.scrollLeft,tl.scrollTop];
  if(SEL&&!trById(SEL.tid))SEL=null;
  let h='<div class="st-inner" style="--hdw:'+hd+'px;--bar:'+bar+'px;width:'+(hd+W)+'px">';
  // the corner of the timeline holds + Track and zoom, so the tracks get the whole screen
  h+='<div class="st-row st-ruler"><div class="st-hd st-corner"><button class="st-addt" data-st="addsheet" aria-label="Add a track">+ Track</button><span class="st-zm"><button data-st="zout" aria-label="Zoom out">−</button><button data-st="zin" aria-label="Zoom in">+</button></span></div><div class="st-lane" id="stRuler" style="width:'+W+'px">';
  if(song.cycle&&song.cycle.e>song.cycle.s)h+='<span class="st-cyc'+(cycOn()?'':' off')+'" style="left:'+song.cycle.s*bar+'px;width:'+(song.cycle.e-song.cycle.s)*bar+'px"></span>';
  for(let b=0;b<n;b++)h+='<span class="st-barn" style="left:'+b*bar+'px">'+(b+1)+'</span>';
  for(const s of sections())if(s.a<n*BPB())h+='<span class="st-secl" style="left:'+Math.max(0,s.a/BPB()*bar)+'px">'+esc(s.name)+'</span>';
  h+='</div></div>';
  for(const tr of song.tracks){
    const sel=tr.id===song.sel;
    h+='<div class="st-row k-'+tr.type+(sel?' sel':'')+'" data-tid="'+tr.id+'"><div class="st-hd"><button class="st-name" data-st="pick" aria-pressed="'+sel+'"><span class="st-ic" aria-hidden="true">'+ICON[tr.type]+'</span><span>'+esc(tr.name)+'</span></button>'
      +'<span class="st-ms"><button class="m" data-st="mute" aria-pressed="'+tr.mute+'" aria-label="Mute '+esc(tr.name)+'">M</button><button class="s" data-st="solo" aria-pressed="'+tr.solo+'" aria-label="Solo '+esc(tr.name)+'">S</button><button class="g" data-st="tset" aria-label="Settings for '+esc(tr.name)+'">⚙</button></span></div>'
      +'<div class="st-lane" data-st="lane" style="width:'+W+'px">'+regionsHTML(tr,bar)+(SEL&&SEL.tid===tr.id?'<span class="st-bsel" style="left:'+SEL.a*bar+'px;width:'+(SEL.b-SEL.a)*bar+'px"></span>':'')+'</div></div>';
  }
  h+='<div class="st-ph" id="stPh" style="left:'+hd+'px"></div></div>';
  tl.innerHTML=h;tl.scrollLeft=keep[0];tl.scrollTop=keep[1];
  tl.querySelectorAll('canvas[data-peaks]').forEach(c=>drawPeaks(c,trById(c.dataset.peaks)));
  const sb=q('#stSel');sb.innerHTML=SEL?selBarHTML():'';sb.hidden=!SEL||VIEW!=='tracks';
  updatePlayhead();
}
function updatePlayhead(){
  if(!song)return;const b=beatNow(),pos=q('#stPos');if(pos)pos.textContent=(Math.floor(b/BPB())+1)+'.'+(Math.floor(b%BPB())+1);
  const ph=q('#stPh'),tl=q('#stTl');if(!ph)return;const x=HDW()+b*zoomPx()/BPB();ph.style.left=x+'px';
  if(T.playing){const vis=tl.clientWidth-HDW();if(x-HDW()<tl.scrollLeft||x-HDW()>tl.scrollLeft+vis-24)tl.scrollLeft=Math.max(0,x-HDW()-40)}
}
// while it plays, the chosen track's notes light up on the pans
let litKey='';
function lightPans(){
  const box=q('#stPans');let ids=[];
  if(box&&T.playing&&VIEW==='inst'){const tr=selTr();if(isPanish(tr)){const b=beatNow();for(const n of pnotes(tr))if(n.t<=b+.02&&b<n.t+Math.max(.22,Math.min(n.d,1)))ids.push(n.p)}}
  const k=ids.join();if(k===litKey)return;litKey=k;if(!box)return;const on=new Set(ids);
  box.querySelectorAll('.field').forEach(f=>f.classList.toggle('play-hit',on.has(f.dataset.field)));
}
// the visual count-in (big 1 2 3 4 over the pans) and a flash on the bar counter with every beat
let visB=null;
function beatVis(){
  let el=q('#stCountVis');if(!el){el=document.createElement('div');el.id='stCountVis';el.setAttribute('aria-hidden','true');document.body.appendChild(el)}
  let show='',acc=false;
  if(T.playing&&ctx&&T.cin&&ck().visual&&ctx.currentTime<T.t0){const left=(T.t0-ctx.currentTime)/spb(),k=T.cin-Math.ceil(left-1e-6);if(k>=0){show=String(k%BPB()+1);acc=k%BPB()===0}}
  if(show&&!el.dataset.n){const pans=q('#stPans');const r=pans&&pans.offsetParent?pans.getBoundingClientRect():null;
    el.style.left=r?(r.left+r.width/2)+'px':'50%';el.style.top=r?(r.top+Math.min(r.height,innerHeight-r.top)/2)+'px':'52%'}
  if(el.dataset.n!==show){el.dataset.n=show;el.textContent=show;el.classList.toggle('on',!!show);el.classList.toggle('acc',acc);if(show){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}}
  const lcd=document.querySelector('.st-lcd');
  if(lcd){const b=T.playing&&ctx&&ctx.currentTime>=T.t0?Math.floor(beatNow()+1e-6):null;
    if(b!==visB){visB=b;if(b!==null&&song.metro){lcd.classList.remove('tick','tick1');void lcd.offsetWidth;lcd.classList.add(b%BPB()===0?'tick1':'tick')}}}
}
{const lp=()=>{if(document.body.dataset.view==='studio'||litKey)lightPans();if(document.body.dataset.view==='studio')beatVis();requestAnimationFrame(lp)};requestAnimationFrame(lp)}
function frame(){if(!T.playing)return;updatePlayhead();if(seqGridOpen())renderSeqNow();if(q('#stSheet')&&!q('#stSheet').hidden&&SH.kind==='mixer')meters();T.raf=requestAnimationFrame(frame)}
function selBarHTML(){
  const tr=trById(SEL.tid);if(!tr)return '';const range=SEL.b-SEL.a>1?'Bars '+(SEL.a+1)+'–'+SEL.b:'Bar '+(SEL.a+1);
  const b=(act,label)=>'<button class="btn sm" data-st="r-'+act+'">'+label+'</button>';
  const n=isPanish(tr)?' · '+selNotes(tr).filter(x=>!x.roll).length+' notes':'';
  let tools=b('loop','⟲ Loop');
  if(isPanish(tr))tools=b('left','◀ Move')+b('right','Move ▶')+b('copy','Copy after')+b('repeat','Repeat to end')+b('snap','Snap')+b('notes','Edit notes')+tools+'<button class="btn sm danger" data-st="r-delete">Delete</button>';
  if(tr.type==='audio'&&tr.take)tools=b('left','◀ Bar')+b('right','Bar ▶')+tools+'<button class="btn sm danger" data-st="r-delete">Remove take</button>';
  if(tr.type==='beats')tools=b('silence',(tr.off||[]).includes(SEL.a)?'Play these bars':'Silence these bars')+tools;
  return '<div class="st-selin" role="toolbar" aria-label="Edit '+esc(range)+' of '+esc(tr.name)+'"><span class="st-selinfo"><b>'+range+'</b> · '+esc(tr.name)+n+'</span>'+tools+'<button class="btn sm" data-st="r-close" aria-label="Clear selection">✕</button></div>';
}
const SNAPS=[['off','Free'],['0.25','¼ beat'],['0.5','½ beat'],['1','Beat']];
const snapBeat=(t,gq)=>Math.max(0,Math.round(t/gq)*gq);
const gridOf=()=>song.snap&&song.snap!=='off'?+song.snap:.25;
const selNotes=tr=>{const A=SEL.a*BPB(),B=SEL.b*BPB();return notesOf(tr).filter(n=>n.t>=A&&n.t<B)};
function regionOp(op){
  const tr=trById(SEL.tid);if(!tr)return;const len=SEL.b-SEL.a,bpb=BPB(),A=SEL.a*bpb,B=SEL.b*bpb;
  if(op==='close'){SEL=null;renderTimeline();return}
  if(op==='loop'){pushHistory();song.cycle={on:true,s:SEL.a,e:SEL.b};dirty();restartIfPlaying();renderTimeline();renderTransport();renderSecs();say('Looping bars '+(SEL.a+1)+'–'+SEL.b+'.');return}
  if(op==='notes'){if(tr.type==='part'){BARS.open({a:origin()+A*spb(),b:origin()+B*spb()-1e-3,grid:true});return}openNotes(tr,SEL.a,SEL.b);return}
  if(tr.type==='beats'&&op==='silence'){pushHistory();const off=new Set(tr.off||[]),on=off.has(SEL.a);for(let b=SEL.a;b<SEL.b;b++)on?off.delete(b):off.add(b);tr.off=[...off].sort((x,y)=>x-y);dirty();renderTimeline();return}
  if(tr.type==='audio'){
    if(op==='left'||op==='right'){const d=op==='left'?-1:1;if(tr.start+d*bpb<0){say("That's the start of the song.");return}pushHistory();tr.start=+(tr.start+d*bpb).toFixed(4);SEL.a+=d;SEL.b+=d;SEL.anchor+=d}
    else if(op==='delete'){pushHistory();Object.assign(tr,{take:null,dur:0,peaks:null,file:''});SEL=null;say('Removed the take from '+tr.name+'. Undo brings it back.')}
    dirty();renderAll();return;
  }
  if(tr.type==='part'){
    const sa=origin()+A*spb(),sb=origin()+B*spb(),bs=bpb*spb();let msg='';
    if(op==='left'||op==='right'){const d=op==='left'?-1:1;if(SEL.a+d<0){say("That's the start of the song.");return}if(BARS.shift(sa,sb,d*bs)){SEL.a+=d;SEL.b+=d;SEL.anchor+=d;msg='Moved. Your cues in Write moved too.'}else msg='There are no notes in those bars.'}
    else if(op==='copy'){if(!BARS.copyTo(sa,sb,sb)){say('There are no notes in those bars to copy.');return}SEL={tid:tr.id,anchor:SEL.b,a:SEL.b,b:SEL.b+len};msg='Copied, in Write too. The copy is selected.'}
    else if(op==='repeat'){const k=BARS.repeat(sa,sb,origin()+bars()*bs);msg=k?'Repeated to the end of the song ('+k+' time'+(k===1?'':'s')+'), in Write too.':'There are no notes in those bars to repeat.'}
    else if(op==='snap'){const k=BARS.snap(sa,sb,gridOf()*spb());msg=k?'Snapped '+k+' cue'+(k===1?'':'s')+'.':'There are no notes in those bars.'}
    else if(op==='delete'){const k=BARS.del(sa,sb);msg=k?'Deleted '+k+' cue'+(k===1?'':'s')+'. Undo is in ▦ Edit in bars.':'There are no notes in those bars.'}
    renderAll();if(msg)say(msg);return;
  }
  if(tr.type!=='pan')return;
  const inSel=selNotes(tr);
  if(op==='left'||op==='right'){const d=op==='left'?-1:1;if(SEL.a+d<0){say("That's the start of the song.");return}pushHistory();inSel.forEach(n=>{n.t=+(n.t+d*bpb).toFixed(3)});SEL.a+=d;SEL.b+=d;SEL.anchor+=d}
  else if(op==='copy'){if(!inSel.length){say('There are no notes in those bars to copy.');return}pushHistory();inSel.forEach(n=>tr.notes.push({...n,t:+(n.t+len*bpb).toFixed(3)}));SEL={tid:tr.id,anchor:SEL.b,a:SEL.b,b:SEL.b+len};song.minBars=Math.max(song.minBars||8,SEL.b+1);say('Copied. The copy is selected.')}
  else if(op==='repeat'){if(!inSel.length){say('There are no notes in those bars to repeat.');return}pushHistory();const end=Math.max(bars(),SEL.b)*bpb;let k=1;
    for(;A+k*len*bpb<end;k++){const off=k*len*bpb;tr.notes=tr.notes.filter(n=>!(n.t>=A+off&&n.t<Math.min(B+off,end)));inSel.forEach(n=>{if(n.t+off<end)tr.notes.push({...n,t:+(n.t+off).toFixed(3)})})}
    say('Repeated to the end of the song ('+(k-1)+' time'+(k===2?'':'s')+').')}
  else if(op==='snap'){if(!inSel.length)return;const gq=gridOf();pushHistory();inSel.forEach(n=>{n.t=+snapBeat(n.t,gq).toFixed(3)});say('Snapped '+inSel.length+' notes to the '+(SNAPS.find(s=>+s[0]===gq)||[0,'¼ beat'])[1]+'.')}
  else if(op==='delete'){if(!inSel.length){SEL=null;renderTimeline();return}pushHistory();tr.notes=tr.notes.filter(n=>!inSel.includes(n));say('Deleted '+inSel.length+' notes.')}
  tr.notes.sort((x,y)=>x.t-y.t);dirty();renderAll();
}

/* the instrument for the chosen track */
function renderInst(){
  const el=q('#stInst');if(!el||!song)return;const tr=selTr(),recNow=T.mic&&T.mic.tr===tr;
  let h='<div class="st-tchips" role="group" aria-label="Choose a track">'+song.tracks.map(t=>'<button class="chip'+(t.id===tr.id?' on':'')+'" data-st="ipick" data-tid="'+t.id+'" aria-pressed="'+(t.id===tr.id)+'">'+ICON[t.type]+' '+esc(t.name)+'</button>').join('')+'<button class="chip st-addchip" data-st="addsheet">+ Add</button></div>';
  const headAt=h.length;
  h+='<div class="st-ihead"><span class="eyebrow">'+KIND[tr.type]+'</span>'+(tr.type==='practice'?'<h2>'+esc(tr.name)+'</h2>':'<input class="st-rename" value="'+esc(tr.name)+'" maxlength="28" aria-label="Track name"><button class="btn sm danger" data-st="deltrack">Delete track</button>')+'</div>';
  if(tr.type==='practice'){
    h+=pBuf?'<p class="help"><b>'+esc(curName)+'</b> · '+fmt(pBuf.duration)+'. It plays from bar 1 in time with ♩ Timing'+(grid()?'':', which isn\'t set yet: set it in Write → ♩ Timing (or ✨ Find the tempo for me) so the bars match your song')+'.</p>'
      :'<p class="help">Add your song\'s recording in <b>Setup</b> and it appears here as track 1, so you can record over it.</p>';
    h+='<p class="help">Then add a <b>Mic</b> track to record yourself over it, a <b>Pan taps</b> track to play the pans, or a <b>Beat</b>.</p>';
  }else if(tr.type==='audio'){
    h+='<p class="help">'+(recNow?'Recording… tap ■ or ● Rec to stop.':tr.take?'<b>'+esc(tr.file||'Take')+'</b> · '+(tr.dur||0).toFixed(1)+' s · starts at bar '+(Math.floor(tr.start/BPB())+1)+'.':'Tap <b>● Rec</b> to record from the microphone. Everything else plays while you record, after a bar of clicks. Headphones stop the song leaking into your take.')+'</p>';
    if(!recNow)h+='<div class="row"><button class="btn primary" data-st="mic">● '+(tr.take?'Record a new take':'Record from the mic')+'</button><button class="btn" data-st="import">'+(tr.take?'Replace with a file':'Import an audio file')+'</button></div>';
    if(tr.take&&!recNow)h+='<div class="row st-nudge"><span class="help">Timing</span><button class="btn sm" data-st="nudge" data-v="-10">◀ 10 ms earlier</button><button class="btn sm" data-st="nudge" data-v="10">10 ms later ▶</button><span class="help">'+(tr.lagMs?(tr.lagMs>0?'+':'')+tr.lagMs+' ms':'')+'</span></div>';
  }else if(tr.type==='part'){
    const n=BARS.events().length;
    // pans first here too: your part lights up on them as it plays
    const sk=setKey(),views=SETS[sk].views,order=sk==='guitar'&&S.swapped?[views[1],views[0]]:views;
    const phead=h.slice(headAt);h=h.slice(0,headAt)+'<div class="pair st-pans'+(order.length===1?' one':'')+'" id="stPans">'+order.map(p=>panSVG(p,true)).join('')+'</div>';
    // the words and buttons live in the Options menu, so the pans keep the room
    h+='<div class="st-popts" id="stPopts" role="dialog" aria-label="My part options"><p class="help"><b>● Rec</b> and play the pans: every note goes straight into Write, so it\'s on your chart and in the game too. '+(n?'Your part has '+n+' notes now; change it here or in Write and both follow.':'')+'</p>'
      +'<div class="row"><button class="btn primary" data-st="bars">▦ Edit in bars</button><button class="btn" data-st="towrite">Go to Write</button></div>'
      +'<button class="btn sm" data-st="snaprec" aria-pressed="'+!!song.snapRec+'">'+(song.snapRec?'✓ ':'')+'Snap new notes</button>'
      +'<div class="seg st-snap" role="group" aria-label="Snap to">'+SNAPS.map(([v,l])=>'<button data-st="snap" data-v="'+v+'" aria-pressed="'+((song.snap||'off')===v)+'">'+l+'</button>').join('')+'</div>'
      +'<p class="help">Select bars on its lane to move, copy, repeat, snap or delete them. Undo for your part is in ▦ Edit in bars or in Write.</p>'+phead.replace('st-ihead','st-ihead st-iend')+'</div>';
  }else if(tr.type==='pan'){
    const sk=trSet(tr),views=SETS[sk].views,order=sk==='guitar'&&S.swapped?[views[1],views[0]]:views;
    const pick='<label class="lab st-setpick">Pan<select data-st-set>'+Object.entries(SETS).map(([k,x])=>'<option value="'+k+'"'+(k===sk?' selected':'')+'>'+x.name+'</option>').join('')+'</select></label>';
    const head=h.slice(headAt);h=h.slice(0,headAt)+'<div class="pair st-pans'+(order.length===1?' one':'')+'" id="stPans">'+order.map(p=>panSVG(p,true)).join('')+'</div>'
      // the pan picker, recording choices and track name live in an Options menu, so the pans keep their room
      +'<div class="st-popts" id="stPopts" role="dialog" aria-label="Pan taps options">'+pick;
    h+='<p class="help">Tap <b>● Rec</b> and play along on the pans. Hold a note to roll. '+(mine('c')||Object.keys(SAMPLES.wav).some(mine)?'Your recorded pan sounds are used.':'Record your own pan sounds in Setup to hear your real pans here.')+'</p>';
    h+='<div class="row"><div class="seg st-mode" role="group" aria-label="Recording"><button data-st="mode" data-v="add" aria-pressed="'+(!song.recMode||song.recMode==='add')+'">Merge</button><button data-st="mode" data-v="replace" aria-pressed="'+(song.recMode==='replace')+'">Replace</button><button data-st="mode" data-v="take" aria-pressed="'+(song.recMode==='take')+'">New take</button></div>'+(tr.takes&&tr.takes.length>1?'<button class="btn sm" data-st="tset">'+esc(tr.takes[tr.tk].name)+' of '+tr.takes.length+' ›</button>':'')
      +'<button class="btn sm" data-st="snaprec" aria-pressed="'+!!song.snapRec+'">'+(song.snapRec?'✓ ':'')+'Snap new notes</button>'
      +'<div class="seg st-snap" role="group" aria-label="Snap to">'+SNAPS.map(([v,l])=>'<button data-st="snap" data-v="'+v+'" aria-pressed="'+((song.snap||'off')===v)+'">'+l+'</button>').join('')+'</div></div>'+head.replace('st-ihead','st-ihead st-iend')+'</div>';
  }else h+=seqHTML(tr);
  el.innerHTML=h;
  requestAnimationFrame(fitPans);
  el.querySelectorAll('#stPans .field').forEach(f=>f.addEventListener('pointerdown',e=>panDown(e,f)));
}
function seqHTML(tr){
  const len=tr.len,lab=n=>BPB()===4?(n/16===1?'1 bar':'2 bars'):(n/4)+' beats';
  let g='<div class="row st-seqtools"><label class="lab">Style<select id="stStyle"><option value="">Choose a style…</option>'+Object.entries(STYLES).map(([k,s])=>'<option value="'+k+'"'+(tr.style===k?' selected':'')+'>'+esc(s.name)+' · '+s.bpm+' bpm</option>').join('')+'</select></label>'
    +'<div class="seg" role="group" aria-label="Pattern length"><button data-st="seqlen" data-v="16" aria-pressed="'+(len===16)+'">'+lab(16)+'</button><button data-st="seqlen" data-v="32" aria-pressed="'+(len===32)+'">'+lab(32)+'</button></div>'
    +'<label class="lab">Swing<input id="stSwing" type="range" min="0" max="1" step=".05" value="'+tr.swing+'"></label></div>';
  g+='<div class="st-seq"><div class="st-grid" id="stGrid" style="grid-template-columns:64px repeat('+len+',minmax(15px,1fr)) 26px;min-width:'+(64+len*18+26)+'px">';
  tr.rows.forEach((row,r)=>{const nm=DRUM_NAME[row.m]||'Sound';g+='<span class="st-seqlab">'+esc(nm)+'</span>';
    for(let i=0;i<len;i++){const v=row.steps[i];g+='<button class="stc'+(i%4===0?' q':'')+(i%16===0&&i?' b2':'')+(v?' on':'')+(v===2?' acc':'')+'" data-r="'+r+'" data-c="'+i+'" aria-label="'+esc(nm)+' step '+(i+1)+(v===2?', accented':'')+'" aria-pressed="'+!!v+'"></button>'}
    g+='<button class="st-x" data-st="rowdel" data-v="'+r+'" aria-label="Remove '+esc(nm)+'">✕</button>'});
  const free=SOUNDS.filter(s=>!tr.rows.some(r=>r.m===s.m));
  return g+'</div></div><div class="row"><label class="lab">Add a sound<select id="stAddRow"><option value="">Choose…</option>'+free.map(s=>'<option value="'+s.m+'">'+esc(s.n)+'</option>').join('')+'</select></label><button class="btn sm" data-st="seqclear">Clear</button></div>'
    +'<p class="help">Tap a step for a hit, again for an accent, again to clear. The pattern repeats through the song; select bars on its lane to silence them (for an intro, say).</p>';
}
const seqGridOpen=()=>!!q('#stGrid');let lastCol=-1;
function renderSeqNow(){const tr=selTr();if(tr.type!=='beats')return;const col=T.playing?((Math.floor(beatNow()*4)%tr.len)+tr.len)%tr.len:-1;if(col===lastCol)return;lastCol=col;
  q('#stGrid').querySelectorAll('.stc.now').forEach(c=>c.classList.remove('now'));if(col>=0)q('#stGrid').querySelectorAll('.stc[data-c="'+col+'"]').forEach(c=>c.classList.add('now'))}
let VIEW='tracks';
function fitPans(){
  const pans=q('#stPans');if(!pans||VIEW!=='inst'||!pans.offsetParent)return;
  // in the full-screen Studio the stage fits the pans itself (STAGE.fitStudio); a height cap here only shrinks them
  if(document.body.classList.contains('gbmode')){pans.querySelectorAll('svg').forEach(s=>{s.style.maxHeight='none'});return}
  const tp=q('.st-tp'),tpTop=tp&&getComputedStyle(tp).position==='fixed'?tp.getBoundingClientRect().top:1e9,dk=$('dock'),dock=Math.min(dk&&dk.offsetParent?dk.getBoundingClientRect().top:innerHeight,tpTop),svgs=pans.querySelectorAll('svg');if(!svgs.length)return;
  const top=svgs[0].getBoundingClientRect().top,room=Math.max(140,Math.floor(dock-top-10));
  svgs.forEach(s=>{s.style.maxHeight=room+'px'});
}
const INST_LABEL={practice:'♪ Recording',audio:'🎙 Mic',pan:'◉ Pans',part:'✎ My part',beats:'▦ Beat'};
function setView(v){VIEW=v;document.body.classList.toggle('st-inst',v==='inst');renderViews();window.scrollTo({top:0});if(v==='inst')renderInst();else renderTimeline()}
function renderViews(){
  const t=q('#stViews');if(!t||!song)return;const tr=selTr();
  t.querySelector('[data-sv="inst"]').textContent=INST_LABEL[tr.type];
  t.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.sv===VIEW)));
  q('.st-tlp').hidden=VIEW!=='tracks';q('#stInst').hidden=VIEW!=='inst';q('#stSel').hidden=VIEW!=='tracks'||!SEL;
}
function renderAll(){if(!song||!q('#stTl'))return;renderTransport();renderSecs();renderTimeline();renderInst();renderUndo();renderViews()}

/* ---- sheets: add a track, mixer, export, timing fix, note editor ---- */
const SH={kind:null,arg:null};
function openSheet(kind,arg){SH.kind=kind;SH.arg=arg;q('#stSheet').hidden=false;renderSheet()}
function closeSheet(){q('#stSheet').hidden=true;SH.kind=null;renderAll()}
function renderSheet(){
  const box=q('#stSheetBox');if(!SH.kind||!box)return;
  const head=t=>'<div class="sheethead"><h2>'+t+'</h2><button class="btn" data-st="close">Done</button></div>';
  let h='';
  if(SH.kind==='add'){
    const cues=S.cues.filter(c=>c.steps&&c.steps.length).length;
    h=head('Add a track')+'<div class="st-addlist">'
      +'<button class="st-add" data-st="addk" data-v="audio"><b>🎙 Mic or audio file</b><span>Record yourself, a singer, or another pan. Or bring in a file.</span></button>'
      +'<button class="st-add" data-st="addk" data-v="pan"><b>◉ Pan taps</b><span>Play the two pans on screen; every hit is recorded as a note you can edit.</span></button>'
      +'<button class="st-add" data-st="addk" data-v="beats"><b>▦ Beat</b><span>A drum pattern: soca, calypso, panorama jam and more, or build your own.</span></button>'
      +'<button class="st-add" data-st="addk" data-v="part"><b>✎ Your part from Write</b><span>'+(cues?'Your '+cues+' cues as a pan track, linked: edit it here or in Write and both follow.':'Linked to your cues in Write; write some cues and they play here.')+'</span></button></div>';
  }else if(SH.kind==='mixer'){
    h=head('Mixer')+'<div class="st-mix">'+song.tracks.map(tr=>'<div class="st-mrow k-'+tr.type+'" data-tid="'+tr.id+'"><div class="st-mname"><b>'+esc(tr.name)+'</b><span class="st-ms"><button class="m" data-st="mute" aria-pressed="'+tr.mute+'">M</button><button class="s" data-st="solo" aria-pressed="'+tr.solo+'">S</button></span></div>'
      +'<button class="btn sm tsetb" data-st="tset">⚙ Settings</button><label class="lab">Volume<input type="range" data-mk="vol" min="0" max="1.2" step=".01" value="'+tr.vol+'"></label>'
      +'<label class="lab">Left · Right<input type="range" data-mk="pan" min="-1" max="1" step=".05" value="'+(tr.pan||0)+'"></label>'
      +'<label class="lab">Reverb<input type="range" data-mk="mix" min="0" max=".6" step=".02" value="'+mixOf(tr)+'"></label>'
      +'<div class="st-meter" aria-hidden="true"><i data-meter="'+tr.id+'"></i></div></div>').join('')
      +'<div class="st-mrow master"><div class="st-mname"><b>Master</b><span class="help">A limiter keeps loud moments from distorting.</span></div><label class="lab">Volume<input type="range" data-mk="master" min="0" max="1" step=".01" value="'+song.master+'"></label><div class="st-meter" aria-hidden="true"><i data-meter="master"></i></div></div></div>'
      +'<p class="help">Press play with the mixer open to watch the levels.</p><div class="row"><button class="btn primary" data-st="play">'+(T.playing?'■ Stop':'▶ Play')+'</button></div>';
  }else if(SH.kind==='export'){
    const secs=Math.round(L()*spb());
    h=head('Export audio')+'<div class="lab">What<div class="seg" id="stExWhat"><button data-v="mix" aria-pressed="'+(EXP.what==='mix')+'">Whole song</button><button data-v="stems" aria-pressed="'+(EXP.what==='stems')+'">Each track</button></div></div>'
      +'<div class="lab">Format<div class="seg" id="stExFmt"><button data-v="mp3" aria-pressed="'+(EXP.fmt==='mp3')+'">MP3 · small, for WhatsApp</button><button data-v="wav" aria-pressed="'+(EXP.fmt==='wav')+'">WAV · best quality</button></div></div>'
      +'<p class="help">'+bars()+' bars at '+(+bpm().toFixed(1))+' bpm, about '+fmt(secs).replace(/\.\d$/,'')+'. Muted tracks are left out of the whole song. Each track comes as a .zip of separate files.</p>'
      +'<p class="help" id="stExBusy" role="status" hidden></p><div class="row"><button class="btn primary grow" data-st="expgo">Save the audio</button></div>';
  }else if(SH.kind==='timing'){
    const lag=PR.micLag!=null?PR.micLag:Math.round(((ctx&&ctx.outputLatency)||0)*1000+((ctx&&ctx.baseLatency)||0)*1000+12);
    h=head('Timing fix')+'<p class="help">Phones add a small delay between you and the sound. Fix it once and your recordings land on the beat.</p>'
      +'<div class="panel st-cal"><b>Pan taps</b><p class="help">Tap Start, then tap the big button on every click. Now: '+tapMs()+' ms (the same as Tap delay fix in Write).</p><div class="row"><button class="btn" data-st="tapcal">Start</button><button class="btn primary grow st-calbtn" id="stCalTap">Tap on the click</button></div></div>'
      +'<div class="panel st-cal"><b>Mic</b><p class="help">Take off headphones and keep it quiet: the phone plays clicks and listens for them. '+(PR.micLag!=null?'Set to '+PR.micLag+' ms.':'Using the phone\'s own estimate ('+lag+' ms).')+'</p>'
      +'<div class="row"><button class="btn" data-st="miccal">Measure with the speaker</button>'+(PR.micLag!=null?'<button class="btn sm" data-st="micauto">Use the estimate</button>':'')+'</div>'
      +'<label class="lab"><span>Set by ear: <b id="stLagV">'+lag+'</b> ms</span><input type="range" id="stLag" min="0" max="400" step="5" value="'+lag+'"></label></div>'
      +'<p class="help" id="stCalMsg" role="status" aria-live="polite"></p>';
  }else if(SH.kind==='tempo'){
    const k=ck(),v=+bpm().toFixed(1),rec=!!pBuf;
    const tog=(key,label,on,sub)=>'<button class="trow tog" data-st="ctog" data-v="'+key+'" role="switch" aria-checked="'+!!on+'"><span class="tl"><b>'+label+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</span><span class="sw" aria-hidden="true"><i></i></span></button>';
    h=head('Tempo &amp; metronome')
      +'<div class="tsec"><div class="tbig"><button class="tstep" data-st="tempo" data-v="-1" aria-label="Slower">−</button><div class="tval"><b id="stBpmV">'+v+'</b><span>bpm</span></div><button class="tstep" data-st="tempo" data-v="1" aria-label="Faster">+</button></div>'
      +'<input type="range" id="stBpmR" min="40" max="240" step="1" value="'+Math.round(v)+'" aria-label="Tempo">'
      +'<div class="row"><button class="btn grow" data-st="taptempo">Tap tempo</button><span class="help" id="stTapMsg" role="status" aria-live="polite">Tap along 4 times</span></div>'
      +'<div class="lab">Beats in a bar<div class="seg">'+[2,3,4].map(n=>'<button data-st="sig" data-v="'+n+'" aria-pressed="'+(BPB()===n)+'">'+n+'/4</button>').join('')+'</div></div>'
      +'<p class="help">'+(rec?'Your recording sets this song\'s tempo. Changing it here moves the bars to fit the recording (the same as ♩ Timing in Write).':'This song\'s own tempo. Your part in Write, the beat and every pan track speed up or slow down with it.')+'</p></div>'
      +'<div class="tsec"><h3>Metronome</h3><div class="tlist">'+tog('metro','Click',song.metro,'Plays on every beat')+tog('recOnly','Only while recording',k.recOnly)+'</div>'
      +'<div class="tlist">'+CLICKS.map(([id,n])=>'<button class="trow" data-st="csound" data-v="'+id+'" aria-pressed="'+(k.sound===id)+'"><span class="tl"><b>'+n+'</b></span><span class="tcheck" aria-hidden="true">✓</span></button>').join('')+'</div>'
      +'<label class="lab">Metronome level<input type="range" id="stClickLv" min="0" max="1" step=".02" value="'+k.level+'"></label></div>'
      +'<div class="tsec"><h3>Count-in</h3><div class="tlist">'+tog('countIn','Count in before recording',song.countIn!==false)+tog('visual','Visual count-in',k.visual,'Big numbers over the pans: 1, 2, 3, 4')+'</div>'
      +'<div class="lab">Count-in length<div class="seg"><button data-st="cbars" data-v="1" aria-pressed="'+(k.bars!==2)+'">1 bar</button><button data-st="cbars" data-v="2" aria-pressed="'+(k.bars===2)+'">2 bars</button></div></div></div>'
      +'<div class="row"><button class="btn primary grow" data-st="play">'+(T.playing?'■ Stop':'▶ Try it')+'</button></div>';
  }else if(SH.kind==='track'){
    const tr=trById(SH.arg)||selTr(),fx=fxOf(tr),pan=tr.type==='pan';SH.arg=tr.id;
    const sec=(t,body)=>'<div class="tsec"><h3>'+t+'</h3>'+body+'</div>';
    const sl=(key,label,min,max,step,val,shown,attr)=>'<label class="lab tsl"><span>'+label+' <b data-show="'+key+'">'+shown+'</b></span><input type="range" '+(attr||'data-fx')+'="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"></label>';
    const db=x=>(x>0?'+':'')+Math.round(x)+' dB',pct=x=>Math.round(x*100)+'%';
    h=head('Track settings')+'<div class="tchips" role="group" aria-label="Choose a track">'+song.tracks.map(t=>'<button class="chip'+(t.id===tr.id?' on':'')+'" data-st="tsetpick" data-v="'+t.id+'" aria-pressed="'+(t.id===tr.id)+'">'+ICON[t.type]+' '+esc(t.name)+'</button>').join('')+'</div>'
      +'<div data-tid="'+tr.id+'" class="tset">'
      +sec('Output',sl('vol','Volume',0,1.2,.01,tr.vol,pct(tr.vol/1.2),'data-mk')+sl('pan','Left · Right',-1,1,.05,tr.pan||0,lr(tr.pan||0),'data-mk')
        +'<div class="row st-ms tms"><button class="m" data-st="mute" aria-pressed="'+tr.mute+'">Mute</button><button class="s" data-st="solo" aria-pressed="'+tr.solo+'">Solo</button></div>')
      +sec('Tone',sl('treble','Treble',-12,12,1,fx.treble,db(fx.treble))+sl('bass','Bass',-12,12,1,fx.bass,db(fx.bass))+sl('comp','Compressor',0,1,.05,fx.comp,fx.comp?pct(fx.comp):'Off')+'<p class="help">Compressor evens out loud and soft hits, so the track sits steady in the mix.</p>')
      +sec('Echo',sl('echo','Echo',0,.6,.02,fx.echo,fx.echo?pct(fx.echo/.6):'Off')+'<div class="tlist">'+Object.entries(ECHOES).map(([k,e])=>'<button class="trow" data-st="echoT" data-v="'+k+'" aria-pressed="'+(fx.echoT===k)+'"><span class="tl"><b>'+e.n+'</b></span><span class="tcheck" aria-hidden="true">✓</span></button>').join('')+'</div><p class="help">Echoes land in time with the song\'s tempo.</p>')
      +sec('Reverb',sl('mix','Reverb',0,.6,.02,mixOf(tr),pct(mixOf(tr)/.6),'data-mk')+'<div class="seg tseg">'+ROOMS.map(([d,n])=>'<button data-st="room" data-v="'+d+'" aria-pressed="'+((fx.room||0)===d)+'">'+n+'</button>').join('')+'</div>')
      +(pan?sec('Quantize','<div class="seg tseg">'+Object.entries(QNT).map(([k,n])=>'<button data-st="qmode" data-v="'+k+'" aria-pressed="'+((tr.q&&tr.q.mode||'none')===k)+'">'+n+'</button>').join('')+'</div>'
          +(tr.q&&tr.q.mode&&tr.q.mode!=='none'?'<div class="seg tseg">'+[[1,'1/4'],[.5,'1/8'],[.25,'1/16']].map(([d,n])=>'<button data-st="qdiv" data-v="'+d+'" aria-pressed="'+((tr.q.div||.5)===d)+'">'+n+'</button>').join('')+'</div>'
            +(tr.q.mode==='swing'?'<div class="seg tseg"><button data-st="qsw" data-v="light" aria-pressed="'+(tr.q.sw!=='heavy')+'">Light swing</button><button data-st="qsw" data-v="heavy" aria-pressed="'+(tr.q.sw==='heavy')+'">Heavy swing</button></div>':''):'')
          +'<p class="help">Moves this track\'s notes onto the beat as it plays. Straight is tight, Triplet and Swing give it a looser feel. Your notes are kept as you played them: choose None to hear them that way again.</p>'):'')
      +(pan?sec('Transpose','<div class="tsteps"><div class="tstp"><span>Octaves</span><button data-st="tp" data-v="-12" aria-label="Octave down">−</button><b>'+Math.trunc((tr.tp|0)/12)+'</b><button data-st="tp" data-v="12" aria-label="Octave up">+</button></div><div class="tstp"><span>Semitones</span><button data-st="tp" data-v="-1" aria-label="Semitone down">−</button><b>'+((tr.tp|0)%12)+'</b><button data-st="tp" data-v="1" aria-label="Semitone up">+</button></div></div>'
          +'<p class="help">'+(tr.tp?'Every note plays '+Math.abs(tr.tp)+' semitone'+(Math.abs(tr.tp)===1?'':'s')+' '+(tr.tp>0?'higher':'lower')+'. Notes that fall off the '+esc(SETS[trSet(tr)].name)+' come back an octave in.':'Move the whole track up or down. The notes you played stay as they are.')+'</p>'):'')
      +(pan||tr.type==='audio'?sec('Recording &amp; takes',takesHTML(tr)):'')
      +'</div>';
  }else if(SH.kind==='notes')h=notesHTML();
  box.innerHTML=h;box.classList.toggle('st-wide',SH.kind==='notes');
  if(SH.kind==='notes')afterNotes();
}
const lr=v=>Math.abs(v)<.03?'Centre':(v<0?'Left ':'Right ')+Math.round(Math.abs(v)*100);
function takesHTML(tr){
  let h='';
  if(tr.type==='pan'){
    h+='<div class="seg tseg"><button data-st="mode" data-v="add" aria-pressed="'+(!song.recMode||song.recMode==='add')+'">Merge</button><button data-st="mode" data-v="replace" aria-pressed="'+(song.recMode==='replace')+'">Replace</button><button data-st="mode" data-v="take" aria-pressed="'+(song.recMode==='take')+'">New take</button></div>'
      +'<p class="help">'+(song.recMode==='take'?'Each time you record, you get a new take. Pick the best one below.':song.recMode==='replace'?'Recording replaces what was there in the bars you play over.':'Recording adds your new notes on top of the old ones.')+'</p>';
    const list=tr.takes&&tr.takes.length>1?tr.takes.map((t,i)=>({name:t.name,on:i===tr.tk,n:i===tr.tk?tr.notes.length:(t.notes||[]).length,i})):[];
    if(list.length)h+='<div class="tlist">'+list.map(t=>'<div class="trow ttake'+(t.on?' on':'')+'"><button class="tl" data-st="takeuse" data-v="'+t.i+'" aria-pressed="'+t.on+'"><b>'+esc(t.name)+'</b><small>'+t.n+' notes'+(t.on?' · playing':'')+'</small></button><button class="tx" data-st="takedel" data-v="'+t.i+'" aria-label="Delete '+esc(t.name)+'">✕</button></div>').join('')+'</div>';
  }else{
    const alts=tr.alts||[];
    h+='<p class="help">Every time you record again, the take before is kept here.</p>';
    if(tr.take)h+='<div class="tlist"><div class="trow ttake on"><span class="tl"><b>'+esc(tr.takeName||'Take')+'</b><small>'+(tr.dur||0).toFixed(1)+' s · playing</small></span></div>'
      +alts.map((a,i)=>'<div class="trow ttake"><button class="tl" data-st="takeuse" data-v="'+i+'"><b>'+esc(a.name||'Take')+'</b><small>'+(a.dur||0).toFixed(1)+' s</small></button><button class="tx" data-st="takedel" data-v="'+i+'" aria-label="Delete '+esc(a.name||'take')+'">✕</button></div>').join('')+'</div>';
  }
  return h;
}
function meters(){
  const buf=new Float32Array(512);
  q('#stSheetBox').querySelectorAll('[data-meter]').forEach(el=>{const id=el.dataset.meter,an=id==='master'?meterM:chans.get(id)&&chans.get(id).meter;if(!an)return;
    an.getFloatTimeDomainData(buf);let pk=0;for(const v of buf)pk=Math.max(pk,Math.abs(v));el.style.width=Math.min(100,Math.round(Math.sqrt(pk)*100))+'%';el.classList.toggle('hot',pk>.95)});
}
function addTrack(kind){
  pushHistory();let tr;
  if(kind==='part'){const ex=song.tracks.find(t=>t.type==='part');if(ex){H.u.pop();song.sel=ex.id;closeSheet();say('My part is already here, linked to Write.');return}tr=trk('part')}
  else tr=trk(kind);
  const same=song.tracks.filter(t=>t.type===tr.type).length;if(same&&kind!=='part')tr.name+=' '+(same+1);
  song.tracks.push(tr);song.sel=tr.id;dirty();closeSheet();setView('inst');
  if(kind==='beats')AC()&&warmDrums();
  say(kind==='part'?'Added My part, linked to your cues in Write.':'Added '+tr.name+'.');
}
// your cues (Write) as pan notes, on the studio's bars
function partTrack(){
  const ev=[];
  for(const c of S.cues){if(!c||!Array.isArray(c.steps))continue;const steps=c.steps.filter(id=>PITCH[id]);if(!steps.length)continue;
    if(c.mode==='together')ev.push({t:c.start,d:c.duration,ids:steps,fx:c.fx});
    else steps.forEach((id,i)=>ev.push({t:c.start+i*c.duration/steps.length,d:c.duration/steps.length,ids:[id],fx:c.fx}))}
  if(!ev.length)return null;
  const o=origin(),sp=spb(),notes=[];
  for(const e of ev){const b=(e.t-o)/sp,d=+Math.min(4,Math.max(.1,e.d/sp)).toFixed(3);
    if(e.fx==='roll')e.ids.forEach(id=>{notes.push({t:+b.toFixed(3),d:.5,p:id,v:.95});for(let s=.07,k=0;s<e.d-.03;s+=.072,k++)notes.push({t:+(b+s/sp).toFixed(3),d:.25,p:id,v:+(.55+((k*37)%11)/50).toFixed(2)})});
    else e.ids.forEach((id,i)=>notes.push({t:+(b+(e.fx==='strum'?i*.03/sp:0)).toFixed(3),d,p:id,v:.95}))}
  notes.sort((x,y)=>x.t-y.t);
  return trk('pan',{name:'My part',notes:notes.filter(n=>n.t>=0)});
}

/* the note editor: fix pan notes by hand on a grid */
const NE={tid:null,a:0,b:1,sel:null,top:null,left:0};
function openNotes(tr,a,b){NE.tid=tr.id;NE.a=a;NE.b=b;NE.sel=null;NE.top=null;NE.left=0;openSheet('notes')}
const RH=28;
function notesHTML(){
  const tr=trById(NE.tid);if(!tr)return '';
  const gq=gridOf(),A=NE.a*BPB(),B=NE.b*BPB(),cols=Math.round((B-A)/gq),cw=Math.max(18,Math.min(34,Math.round(28*Math.sqrt(.25/gq)))),W=cols*cw;
  const PIDS=pidsOf(tr);let gr='';PIDS.forEach((id,i)=>{gr+='<div class="ne-r pn-'+grpOf(id)+'" style="top:'+i*RH+'px;width:'+W+'px"></div>'});
  for(let c=0;c<=cols;c++){const bt=A+c*gq;if(Math.abs(bt-Math.round(bt))<1e-6)gr+='<div class="ne-l'+(Math.round(bt)%BPB()===0?' bar':'')+'" style="left:'+c*cw+'px;height:'+PIDS.length*RH+'px"></div>'}
  const nh=tr.notes.map((n,i)=>({n,i})).filter(({n})=>n.t>=A&&n.t<B&&PIDS.includes(n.p)).map(({n,i})=>'<button class="ne-n pn-'+grpOf(n.p)+(NE.sel===i?' on':'')+'" style="background:'+gcol(n.p)+'" data-i="'+i+'" style="left:'+((n.t-A)/gq*cw).toFixed(1)+'px;top:'+(PIDS.indexOf(n.p)*RH+3)+'px;width:'+Math.max(10,Math.min(n.d,B-n.t)/gq*cw-2).toFixed(1)+'px;height:'+(RH-6)+'px" aria-label="'+esc(pname(n.p))+' at beat '+(n.t+1).toFixed(2)+'"></button>').join('');
  const labels=PIDS.map(id=>'<div class="ne-lab pn-'+grpOf(id)+'" style="height:'+RH+'px;color:'+gcol(id)+'">'+esc(pname(id))+'</div>').join('');
  const range=NE.b-NE.a>1?'Bars '+(NE.a+1)+'–'+NE.b:'Bar '+(NE.a+1),has=NE.sel!=null&&tr.notes[NE.sel];
  return '<div class="sheethead"><h2>'+esc(tr.name)+' · '+range+'</h2><button class="btn" data-st="close">Done</button></div>'
    +'<div class="row"><div class="seg" role="group" aria-label="Snap">'+SNAPS.map(([v,l])=>'<button data-st="ne-snap" data-v="'+v+'" aria-pressed="'+((song.snap||'off')===v)+'">'+l+'</button>').join('')+'</div>'
    +'<button class="btn sm" data-st="undo" '+(H.u.length?'':'disabled')+'>↶ Undo</button></div>'
    +'<div class="ne-wrap"><div class="ne-labels" id="neLabels">'+labels+'</div><div class="ne-scroll" id="neScroll"><div class="ne-grid" id="neGrid" style="width:'+W+'px;height:'+PIDS.length*RH+'px">'+gr+nh+'</div></div></div>'
    +'<div class="row ne-tools"><span class="help">'+(has?esc(pname(tr.notes[NE.sel].p))+' selected:':'Tap an empty spot to add a note. Tap a note to select it.')+'</span>'
    +(has?'<button class="btn sm" data-st="ne-nudge" data-v="-1" aria-label="Earlier">◀</button><button class="btn sm" data-st="ne-nudge" data-v="1" aria-label="Later">▶</button><button class="btn sm" data-st="ne-pitch" data-v="1" aria-label="Higher">▲</button><button class="btn sm" data-st="ne-pitch" data-v="-1" aria-label="Lower">▼</button><button class="btn sm" data-st="ne-len" data-v="-1">Shorter</button><button class="btn sm" data-st="ne-len" data-v="1">Longer</button><button class="btn sm danger" data-st="ne-del">Delete</button>':'')+'</div>';
}
function afterNotes(){
  const sc=q('#neScroll'),lab=q('#neLabels'),tr=trById(NE.tid);if(!sc||!tr)return;
  const PIDS=pidsOf(tr);if(NE.top==null){const idx=tr.notes.filter(n=>n.t>=NE.a*BPB()&&n.t<NE.b*BPB()).map(n=>PIDS.indexOf(n.p));NE.top=idx.length?Math.max(0,Math.min(...idx)*RH-RH):0}
  sc.scrollTop=NE.top;sc.scrollLeft=NE.left;lab.scrollTop=sc.scrollTop;
  sc.onscroll=()=>{lab.scrollTop=sc.scrollTop;NE.top=sc.scrollTop;NE.left=sc.scrollLeft};
}
function audition(tr,id){if(!AC())return;panVoice(channel(tr).out,id,ctx.currentTime+.003,.85)}
function neTap(e){
  const tr=trById(NE.tid);if(!tr)return;const note=e.target.closest('.ne-n');
  if(note){NE.sel=+note.dataset.i;const n=tr.notes[NE.sel];if(n)audition(tr,n.p);renderSheet();return}
  const gridEl=q('#neGrid'),r=gridEl.getBoundingClientRect(),gq=gridOf(),cols=Math.round((NE.b-NE.a)*BPB()/gq),cw=parseFloat(gridEl.style.width)/cols;
  const PIDS=pidsOf(tr),id=PIDS[Math.floor((e.clientY-r.top)/RH)],col=Math.floor((e.clientX-r.left)/cw);if(!id||col<0||col>=cols)return;
  pushHistory();const t=+(NE.a*BPB()+col*gq).toFixed(3);tr.notes.push({t,d:Math.max(.25,gq),p:id,v:.9});tr.notes.sort((x,y)=>x.t-y.t);
  NE.sel=tr.notes.findIndex(n=>n.p===id&&Math.abs(n.t-t)<1e-6);audition(tr,id);dirty();renderSheet();
}
function neAct(act,v){
  const tr=trById(NE.tid);if(!tr)return;
  if(act==='ne-snap'){pushHistory();song.snap=v;dirty();renderSheet();return}
  const n=NE.sel!=null?tr.notes[NE.sel]:null,gq=gridOf();if(!n)return;pushHistory();
  if(act==='ne-del'){tr.notes.splice(NE.sel,1);NE.sel=null}
  else if(act==='ne-nudge')n.t=+Math.max(NE.a*BPB(),Math.min(NE.b*BPB()-gq,n.t+(+v)*gq)).toFixed(3);
  else if(act==='ne-len')n.d=+Math.max(gq/2,n.d+(+v)*gq).toFixed(3);
  else if(act==='ne-pitch'){const PIDS=pidsOf(tr),i=PIDS.indexOf(n.p);n.p=PIDS[Math.max(0,Math.min(PIDS.length-1,i-(+v)))]}
  if(act!=='ne-del'){tr.notes.sort((x,y)=>x.t-y.t);NE.sel=tr.notes.indexOf(n);audition(tr,n.p)}
  dirty();renderSheet();
}

/* ---- export: the whole song, or each track, as MP3 or WAV ---- */
const EXP={fmt:'mp3',what:'mix'};
const hasContent=tr=>tr.type==='beats'?tr.rows.some(r=>r.steps.some(Boolean)):isPanish(tr)?notesOf(tr).length>0:!!audioOf(tr);
async function renderSong(only,onProgress){
  AC();await warmDrums();await warmPans();
  const live={ctx,master,meterM,reverbs,PV},saved=new Map(chans);
  const sr=44100,sp=spb(),Lb=L(),T0=.05,off=new OfflineAudioContext(2,Math.ceil(sr*(Lb*sp+T0+3)),sr);
  try{
    ctx=off;chans.clear();PV=new Map();reverbs=new Map();const m=buildMaster(off);master=m.vol;meterM=m.an;
    const ev=[];
    for(const tr of song.tracks){
      if(only?tr!==only:!audible(tr)||!hasContent(tr))continue;
      const c=channel(tr).play;c.gain.value=1;
      if(tr.type==='beats'){for(const [bt,mm,v] of beatHits(tr,0,Lb)){const t=T0+bt*sp;ev.push({t,fn:()=>playDrum(mm,c,t,v)})}}
      else if(isPanish(tr)){for(const n of pnotes(tr))if(n.t<Lb){const t=T0+n.t*sp;ev.push({t,fn:()=>panVoice(c,n.p,t,n.v)})}}
      else{const b=audioOf(tr);if(b){let t=T0+startOf(tr)*sp,o=0;if(t<0){o=-t;t=0}ev.push({t,fn:()=>{const s=off.createBufferSource();s.buffer=b;s.connect(c);s.start(t,o);s.stop(T0+Lb*sp)}})}}
    }
    ev.sort((x,y)=>x.t-y.t);
    const CH=4,total=off.length/sr;let i=0;
    const runUntil=lim=>{while(i<ev.length&&ev[i].t<lim){try{ev[i].fn()}catch{}i++}};
    runUntil(CH);
    for(let k=1;k*CH<total-.01;k++)off.suspend(k*CH).then(()=>{runUntil((k+1)*CH);if(onProgress)onProgress(k*CH/total);off.resume()});
    const out=await off.startRendering();
    let peak=0;for(let c=0;c<out.numberOfChannels;c++){const d=out.getChannelData(c);for(let j=0;j<d.length;j++){const a=Math.abs(d[j]);if(a>peak)peak=a}}
    const gain=peak>0?(only?Math.min(1,.89/peak):.89/peak):1;
    if(gain!==1)for(let c=0;c<out.numberOfChannels;c++){const d=out.getChannelData(c);for(let j=0;j<d.length;j++)d[j]*=gain}
    return out;
  }finally{ctx=live.ctx;master=live.master;meterM=live.meterM;reverbs=live.reverbs;PV=live.PV;chans.clear();saved.forEach((v,k)=>chans.set(k,v))}
}
function wavBytes(buf){
  const nc=buf.numberOfChannels,n=buf.length,sr=buf.sampleRate,b=new ArrayBuffer(44+n*nc*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');v.setUint32(4,36+n*nc*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,nc,true);v.setUint32(24,sr,true);v.setUint32(28,sr*nc*2,true);v.setUint16(32,nc*2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*nc*2,true);
  const d=[...Array(nc)].map((_,c)=>buf.getChannelData(c));let o=44;
  for(let i=0;i<n;i++)for(let c=0;c<nc;c++){const x=Math.max(-1,Math.min(1,d[c][i]));v.setInt16(o,x<0?x*32768:x*32767,true);o+=2}
  return new Uint8Array(b);
}
const loadScript=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)});
async function mp3Bytes(buf){
  if(!window.lamejs){try{await loadScript('lame.min.js')}catch{}if(!window.lamejs){try{await loadScript('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js')}catch{}}if(!window.lamejs)throw Error('mp3')}
  const I16=x=>{const o=new Int16Array(x.length);for(let i=0;i<x.length;i++){const s=Math.max(-1,Math.min(1,x[i]));o[i]=s<0?s*32768:s*32767}return o};
  const l=I16(buf.getChannelData(0)),r=I16(buf.getChannelData(buf.numberOfChannels>1?1:0)),enc=new lamejs.Mp3Encoder(2,buf.sampleRate,192),parts=[];
  for(let i=0;i<l.length;i+=1152){const c=enc.encodeBuffer(l.subarray(i,i+1152),r.subarray(i,i+1152));if(c.length)parts.push(new Uint8Array(c));if(i%(1152*200)===0)await new Promise(z=>setTimeout(z,0))}
  const f=enc.flush();if(f.length)parts.push(new Uint8Array(f));
  return new Blob(parts,{type:'audio/mpeg'});
}
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC_T[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
function zipStore(files){   // an uncompressed .zip: audio barely compresses anyway
  const enc=new TextEncoder(),locals=[],central=[];let off=0;
  for(const f of files){const name=enc.encode(f.name),d=f.data,crc=crc32(d),h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(8,0,true);h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,name.length,true);
    locals.push(new Uint8Array(h.buffer),name,d);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,name.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),name);off+=30+name.length+d.length}
  const cs=central.reduce((a,x)=>a+x.length,0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob([...locals,...central,new Uint8Array(e.buffer)],{type:'application/zip'});
}
const safe=s=>String(s||'song').replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,60)||'song';
async function runExport(){
  const busy=q('#stExBusy'),go=q('[data-st="expgo"]');const base=safe(S.title||'Panyard song')+' - studio';
  const encode=async b=>EXP.fmt==='mp3'?mp3Bytes(b):new Blob([wavBytes(b)],{type:'audio/wav'});
  if(T.playing)stop(false);busy.hidden=false;go.disabled=true;
  try{
    if(EXP.what==='mix'){
      if(!song.tracks.some(t=>audible(t)&&hasContent(t))){say("There's nothing to export yet. Record something first.");return}
      const data=await encode(await renderSong(null,p=>{busy.textContent='Exporting your song… '+Math.round(p*100)+'%'}));
      busy.textContent='Ready.';await offerFile(base+'.'+EXP.fmt,data);
    }else{
      const todo=song.tracks.filter(hasContent),files=[];if(!todo.length){say("There's nothing to export yet. Record something first.");return}
      for(const [k,tr] of todo.entries()){const b=await encode(await renderSong(tr,p=>{busy.textContent='Exporting '+tr.name+' ('+(k+1)+' of '+todo.length+')… '+Math.round(p*100)+'%'}));files.push({name:safe(tr.name)+' '+(k+1)+'.'+EXP.fmt,data:new Uint8Array(await b.arrayBuffer())})}
      busy.textContent='Ready.';await offerFile(base+' - tracks.zip',zipStore(files));
    }
  }catch(e){say(e&&e.message==='mp3'?'MP3 needs an internet connection the first time. Try WAV, or connect and try again.':"The export didn't finish. Try again, or try WAV.")}
  finally{if(busy.isConnected)busy.hidden=true;if(go.isConnected)go.disabled=false}
}

/* ---- taps and clicks ---- */
function laneTap(e,row){
  const tr=trById(row.dataset.tid),lane=row.querySelector('.st-lane'),bar=Math.floor((e.clientX-lane.getBoundingClientRect().left)/zoomPx());
  if(bar<0||bar>=bars())return;
  if(song.sel!==tr.id){song.sel=tr.id;SEL={tid:tr.id,anchor:bar,a:bar,b:bar+1};renderAll();return}
  if(SEL&&SEL.tid===tr.id&&bar!==SEL.anchor&&!(SEL.b-SEL.a===1&&bar===SEL.a))SEL={tid:tr.id,anchor:SEL.anchor,a:Math.min(SEL.anchor,bar),b:Math.max(SEL.anchor,bar)+1};
  else if(SEL&&SEL.tid===tr.id&&SEL.b-SEL.a===1&&bar===SEL.a)SEL=null;
  else SEL={tid:tr.id,anchor:bar,a:bar,b:bar+1};
  renderTimeline();
}
function onClick(e){
  const b=e.target.closest('[data-st],[data-sec],.stc');if(!b||!song)return;
  if(b.classList.contains('stc')&&b.closest('#stGrid')){const tr=selTr(),r=+b.dataset.r,c=+b.dataset.c;pushHistory();tr.rows[r].steps[c]=(tr.rows[r].steps[c]+1)%3;tr.style='';
    if(tr.rows[r].steps[c]&&AC())playDrum(tr.rows[r].m,channel(tr).out,ctx.currentTime+.003,tr.rows[r].steps[c]===2?1:.72);dirty();renderInst();renderTimeline();return}
  if(b.dataset.sec){const [a,z]=b.dataset.sec.split(',').map(Number);pushHistory();const on=cycOn()&&song.cycle.s===a&&song.cycle.e===z;song.cycle={on:!on,s:a,e:z};dirty();
    if(!on){T.pos=a*BPB();restartIfPlaying()}renderAll();say(on?'Loop off.':'Looping '+b.textContent+'.');return}
  const act=b.dataset.st,row=b.closest('[data-tid]'),tr=row?trById(row.dataset.tid):null;
  switch(act){
    case 'pick':if(song.sel===tr.id){setView('inst');break}song.sel=tr.id;SEL=null;dirty();renderAll();break;
    case 'ipick':song.sel=b.dataset.tid;dirty();renderInst();renderViews();break;
    case 'lane':break;
    case 'mute':case 'solo':pushHistory();tr[act]=!tr[act];refreshGains();dirty();if(SH.kind==='mixer'||SH.kind==='track')renderSheet();renderTimeline();break;
    case 'tset':openSheet('track',tr?tr.id:selTr().id);break;
    case 'tsetpick':SH.arg=b.dataset.v;song.sel=b.dataset.v;renderSheet();break;
    case 'tempo':setTempo(Math.round(bpm())+(+b.dataset.v));break;
    case 'taptempo':tapTempo();break;
    case 'sig':setTempo(bpm(),{perBar:+b.dataset.v});break;
    case 'ctog':{const k=b.dataset.v;if(k==='metro'||k==='countIn'){if(k==='metro')song.metro=!song.metro;else song.countIn=song.countIn===false}else song.click={...ck(),[k]:!ck()[k]};dirty();renderTransport();renderSheet();break}
    case 'csound':song.click={...ck(),sound:b.dataset.v};dirty();if(AC()){const t0=ctx.currentTime+.02;for(let i=0;i<4;i++)click(t0+i*.32,i===0)}renderSheet();break;
    case 'cbars':song.click={...ck(),bars:+b.dataset.v};dirty();renderSheet();break;
    case 'echoT':pushHistory();tr.fx={...fxOf(tr),echoT:b.dataset.v};if(!tr.fx.echo)tr.fx.echo=.22;refreshGains();dirty();renderSheet();break;
    case 'room':pushHistory();tr.fx={...fxOf(tr),room:+b.dataset.v};if(tr.mix===0)tr.mix=.2;refreshGains();dirty();renderSheet();break;
    case 'qmode':pushHistory();tr.q={div:.5,sw:'light',...(tr.q||{}),mode:b.dataset.v};dirty();renderTimeline();renderSheet();say(b.dataset.v==='none'?'Quantize off: your notes play as you played them.':'Quantize: '+QNT[b.dataset.v]+'.');break;
    case 'qdiv':pushHistory();tr.q={...tr.q,div:+b.dataset.v};dirty();renderTimeline();renderSheet();break;
    case 'qsw':pushHistory();tr.q={...tr.q,sw:b.dataset.v};dirty();renderTimeline();renderSheet();break;
    case 'tp':{pushHistory();tr.tp=Math.max(-24,Math.min(24,(tr.tp|0)+(+b.dataset.v)));if(!tr.tp)delete tr.tp;dirty();renderTimeline();renderSheet();if(AC()){const n=pnotes(tr)[0];if(n)audition(tr,n.p)}break}
    case 'takeuse':pushHistory();takeUse(tr,+b.dataset.v);dirty();restartIfPlaying();renderAll();if(SH.kind)renderSheet();break;
    case 'takedel':{if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Delete?';setTimeout(()=>{if(b.isConnected){b.dataset.armed='';b.textContent='✕'}},3000);break}pushHistory();takeDel(tr,+b.dataset.v);dirty();renderAll();renderSheet();break}
    case 'close':closeSheet();break;
    case 'addk':addTrack(b.dataset.v);break;
    case 'deltrack':{const t=selTr();if(t.type==='practice')break;if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Tap again to delete';setTimeout(()=>{if(b.isConnected){b.dataset.armed='';b.textContent='Delete track'}},3000);break}
      pushHistory();song.tracks=song.tracks.filter(x=>x!==t);song.sel='practice';SEL=null;dirty();renderAll();say('Deleted '+t.name+'. Undo brings it back.');break}
    case 'addsheet':openSheet('add');break;
    case 'zin':PR.zoom=Math.min(3,(PR.zoom||1)*1.25);savePR();renderTimeline();break;
    case 'zout':PR.zoom=Math.max(.4,(PR.zoom||1)/1.25);savePR();renderTimeline();break;
    case 'mic':micStart(selTr());break;
    case 'bars':BARS.open(SEL&&SEL.tid===selTr().id?{a:origin()+SEL.a*BPB()*spb(),b:origin()+SEL.b*BPB()*spb()-1e-3}:null);break;
    case 'towrite':showView('cues');break;
    case 'import':q('#stFile').click();break;
    case 'nudge':{const t=selTr(),ms=+b.dataset.v;pushHistory();t.lagMs=(t.lagMs||0)+ms;t.start=+(t.start+ms/1000/spb()).toFixed(5);if(t.start<0)t.start=0;dirty();restartIfPlaying();renderInst();renderTimeline();break}
    case 'mode':pushHistory();song.recMode=b.dataset.v;dirty();renderInst();if(SH.kind==='track')renderSheet();break;
    case 'snaprec':pushHistory();song.snapRec=!song.snapRec;if(song.snapRec&&song.snap==='off')song.snap='0.25';dirty();renderInst();break;
    case 'snap':pushHistory();song.snap=b.dataset.v;dirty();renderInst();break;
    case 'seqlen':{const t=selTr(),n=+b.dataset.v;pushHistory();t.rows.forEach(r=>{r.steps=Array.from({length:n},(_,i)=>r.steps[i%t.len]||0)});t.len=n;dirty();renderInst();renderTimeline();break}
    case 'rowdel':{const t=selTr();pushHistory();t.rows.splice(+b.dataset.v,1);dirty();renderInst();renderTimeline();break}
    case 'seqclear':{const t=selTr();pushHistory();t.rows.forEach(r=>r.steps.fill(0));t.style='';dirty();renderInst();renderTimeline();break}
    case 'play':T.playing?stop(false):play(false);if(SH.kind==='mixer'||SH.kind==='tempo')renderSheet();break;
    case 'expgo':runExport();break;
    case 'tapcal':startTapCal();break;
    case 'miccal':measureMic();break;
    case 'micauto':PR.micLag=null;savePR();renderSheet();break;
    case 'undo':undo();if(SH.kind)renderSheet();break;
    default:
      if(act&&act.startsWith('r-'))regionOp(act.slice(2));
      else if(act&&act.startsWith('ne-'))neAct(act,b.dataset.v);
  }
}
function onInput(e){
  const t=e.target;if(!song)return;
  if(t.matches('.st-rename')){const tr=selTr();tr.name=t.value.trim().slice(0,28)||KIND[tr.type];dirty();clearTimeout(t._r);t._r=setTimeout(renderTimeline,300);return}
  if(t.id==='stSwing'){selTr().swing=+t.value;dirty();return}
  if(t.id==='stLag'){PR.micLag=+t.value;savePR();q('#stLagV').textContent=t.value;return}
  if(t.id==='stBpmR'){const v=+t.value;q('#stBpmV').textContent=v;clearTimeout(t._r);t._r=setTimeout(()=>setTempo(v),250);return}
  if(t.id==='stClickLv'){song.click={...ck(),level:+t.value};dirty();clearTimeout(t._r);t._r=setTimeout(()=>{if(AC())click(ctx.currentTime+.02,true)},120);return}
  if(t.dataset.fx){const tr=trById(t.closest('[data-tid]').dataset.tid),k=t.dataset.fx,v=+t.value;tr.fx={...fxOf(tr),[k]:v};if(ctx)channel(tr);dirty();
    const sh=t.closest('.tsl')&&t.closest('.tsl').querySelector('[data-show]');if(sh)sh.textContent=k==='comp'?(v?Math.round(v*100)+'%':'Off'):k==='echo'?(v?Math.round(v/.6*100)+'%':'Off'):(v>0?'+':'')+Math.round(v)+' dB';return}
  if(t.dataset.mk){{const sh=t.closest('.tsl')&&t.closest('.tsl').querySelector('[data-show]'),v=+t.value,k=t.dataset.mk;if(sh)sh.textContent=k==='pan'?lr(v):k==='vol'?Math.round(v/1.2*100)+'%':Math.round(v/.6*100)+'%'}const k=t.dataset.mk,v=+t.value;if(k==='master'){song.master=v;if(master)master.gain.value=v}else{const tr=trById(t.closest('[data-tid]').dataset.tid);if(k==='mix')tr.mix=v;else tr[k]=k==='pan'&&Math.abs(v)<.03?0:v;if(ctx)channel(tr)}dirty()}
}
function onChange(e){
  const t=e.target;if(!song)return;
  if(t.id==='stStyle'&&t.value){const tr=selTr(),st=STYLES[t.value];pushHistory();Object.assign(tr,{rows:styleRows(st),len:st.len,swing:st.swing,unit:st.unit,style:t.value});dirty();renderInst();renderTimeline();
    say('Loaded '+st.name+'.'+(Math.abs(bpm()-st.bpm)>8?' It usually sits around '+st.bpm+' bpm; here it plays at your song\'s tempo.':''));AC()&&warmDrums()}
  if(t.id==='stAddRow'&&t.value){const tr=selTr();pushHistory();tr.rows.push({m:+t.value,steps:Array(tr.len).fill(0)});dirty();renderInst()}
  if(t.matches('[data-st-set]')){const tr=selTr(),k=t.value;if(tr.type!=='pan'||k===trSet(tr))return;
    if(tr.notes.length&&!confirm(tr.name+' has '+tr.notes.length+' notes on the '+SETS[trSet(tr)].name+'. Switch to the '+SETS[k].name+' and clear them? (Undo brings them back.)')){t.value=trSet(tr);return}
    pushHistory();const old=SETS[trSet(tr)].name;tr.panSet=k;tr.notes=[];if(tr.name===old||/^Pan taps/.test(tr.name))tr.name=SETS[k].name;dirty();renderAll();say(tr.name+' now plays the '+SETS[k].name+'.');return}
  if(t.id==='stFile'){const f=t.files&&t.files[0];t.value='';if(f)importFile(selTr(),f)}
}
function init(){
  BARS.onChange(()=>{partCache=null;if(song&&document.body.dataset.view==='studio')renderAll()});
  const v=q('#view-studio');if(!v)return;
  v.addEventListener('click',onClick);
  q('#stViews').addEventListener('click',e=>{const b=e.target.closest('[data-sv]');if(b)setView(b.dataset.sv)});v.addEventListener('input',onInput);v.addEventListener('change',onChange);
  v.addEventListener('pointerdown',e=>{const row=e.target.closest('.st-row[data-tid]');if(row&&e.target.closest('.st-lane')&&!e.target.closest('button'))laneTap(e,row)});
  q('#stRuler')||0;
  v.addEventListener('click',e=>{const r=e.target.closest('#stRuler');if(r){const x=e.clientX-r.getBoundingClientRect().left;seek(Math.floor(x/zoomPx())*BPB())}});
  const sh=document.createElement('div');sh.id='stSheet';sh.className='sheetov st-sheet';sh.hidden=true;sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');
  sh.innerHTML='<div class="sheetbox" id="stSheetBox"></div>';document.body.appendChild(sh);
  sh.addEventListener('click',e=>{if(e.target===sh){closeSheet();return}if(e.target.closest('#neGrid')){neTap(e);return}onClick(e)});
  sh.addEventListener('input',onInput);
  sh.addEventListener('pointerdown',e=>{if(e.target.closest('#stCalTap')){e.preventDefault();if(CAL.on)CAL.taps.push(ctx.currentTime)}});
  sh.addEventListener('click',e=>{const b=e.target.closest('#stExWhat button,#stExFmt button');if(!b)return;if(b.closest('#stExWhat'))EXP.what=b.dataset.v;else EXP.fmt=b.dataset.v;renderSheet()},true);
  q('#stPlay').onclick=()=>{T.playing?stop(false):play(false)};
  q('#stHome').onclick=()=>seek(looping()?loopS():0);
  q('#stRec').onclick=toggleRec;
  q('#stMetro').onclick=()=>{song.metro=!song.metro;dirty();renderTransport()};
  q('#stCount').onclick=()=>{song.countIn=song.countIn===false;dirty();renderTransport()};
  q('#stLoop').onclick=()=>{pushHistory();if(cycOn())song.cycle.on=false;else song.cycle=SEL?{on:true,s:SEL.a,e:SEL.b}:song.cycle&&song.cycle.e>song.cycle.s?{...song.cycle,on:true}:{on:true,s:0,e:Math.min(4,bars())};dirty();restartIfPlaying();renderAll()};
  q('#stUndo').onclick=undo;q('#stRedo').onclick=redo;
  q('#stAdd').onclick=()=>openSheet('add');q('#stMix').onclick=()=>{AC();openSheet('mixer')};q('#stExp').onclick=()=>{if(typeof openShare==='function'){openShare(true);const t=$('expStudio');if(t)t.focus()}else openSheet('export')};q('#stTime').onclick=()=>{AC();openSheet('timing')};
  q('#stZin').onclick=()=>{PR.zoom=Math.min(3,(PR.zoom||1)*1.25);savePR();renderTimeline()};q('#stZout').onclick=()=>{PR.zoom=Math.max(.4,(PR.zoom||1)/1.25);savePR();renderTimeline()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!q('#stSheet').hidden)closeSheet()});
  window.addEventListener('resize',()=>{if(document.body.dataset.view==='studio'){renderTimeline();fitPans()}});
  // a different song opened from the songs list: its own studio comes with it
  if(typeof songOpen==='function'){const _o=songOpen;songOpen=async function(id,fresh){const r=await _o(id,fresh);if(document.body.dataset.view==='studio')enter();else{song=null;songKey=null}return r}}
}
// one loop: Studio's loop and the play bar's loop are the same thing, kept in step as you come and go
function loopFromApp(){if(!grid()||!song)return;const bb=spb()*BPB(),o=origin();
  if(loop&&A!==null&&B!==null&&B>A){song.cycle={on:true,s:Math.max(0,Math.floor((A-o)/bb+1e-6)),e:Math.max(1,Math.ceil((B-o)/bb-1e-6))};LOOP_IN={s:song.cycle.s,e:song.cycle.e,A,B}}
  else{if(song.cycle)song.cycle.on=false;LOOP_IN=null}}
let LOOP_IN=null;   // the loop as it came in, so an untouched loop goes back out exactly (a section, not rounded to bars)
function loopToApp(){if(!grid()||!song)return;const bb=spb()*BPB(),o=origin();
  if(cycOn()){const same=LOOP_IN&&LOOP_IN.s===song.cycle.s&&LOOP_IN.e===song.cycle.e;A=same?LOOP_IN.A:Math.max(0,o+song.cycle.s*bb);B=same?LOOP_IN.B:o+song.cycle.e*bb;loop=true}else loop=false;renderLoop()}
async function enter(){
  audio.pause();await load();await practiceLoad();loopFromApp();
  // keep only the takes this song still uses
  renderAll();
}
function leave(){if(song&&T.playing)stop(false);if(song)loopToApp()}
init();
return{tempoSheet:()=>{AC();openSheet('tempo')},trackSheet:id=>{AC();openSheet('track',id)},setTempo,get bpm(){return bpm()},pnotes,ck,BPB:()=>BPB(),enter,leave,exportSheet:()=>openSheet('export'),timingSheet:()=>{AC();openSheet('timing')},get song(){return song},T,play,stop,toggleRec,addTrack,openSheet,closeSheet,renderSong,partTrack,undo,redo,buffers,micStart,micStop,seek,beatNow,bars};
})();
// Studio is its own tab; the play bar's own transport hides while it's open
{const lp=$('lagPlus');if(lp){const m=document.createElement('button');m.type='button';m.className='mini';m.id='lagMeasure';m.textContent='Measure';
  m.onclick=()=>{showView('studio');let n=0;const go=()=>{if(STUDIO.song)STUDIO.timingSheet();else if(n++<40)setTimeout(go,100)};go()};lp.after(m)}}
// the Studio mix lives in the one Share sheet, next to the chart, picture and video
{const tiles=document.querySelector('#shareSheet .tiles');if(tiles){const b=document.createElement('button');b.className='tile';b.id='expStudio';
  b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4v16M12 4v16M19 4v16"/><rect x="3" y="13" width="4" height="3" rx="1" fill="currentColor"/><rect x="10" y="7" width="4" height="3" rx="1" fill="currentColor"/><rect x="17" y="11" width="4" height="3" rx="1" fill="currentColor"/></svg><b>Studio mix</b><span>Your tracks as MP3 or WAV</span>';
  b.onclick=()=>{openShare(false);if(document.body.dataset.view!=='studio')showView('studio');let n=0;const go=()=>{if(STUDIO.song)STUDIO.exportSheet();else if(n++<40)setTimeout(go,100)};go()};tiles.appendChild(b)}}
{const _show=showView;showView=function(v){
  const st=v==='studio';if(!st)STUDIO.leave();
  _show(st?'setup':v);
  $('view-studio').hidden=!st;
  if(st){$('view-setup').hidden=true;document.body.dataset.view='studio';$('setupBtn').setAttribute('aria-current','false');
    document.querySelectorAll('.tabs button[data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view==='studio')));STUDIO.enter()}
  try{setDockH()}catch{}
}}
document.querySelector('.tabs button[data-view="studio"]').onclick=()=>showView('studio');
