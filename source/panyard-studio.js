/* ---------- Studio: record in layers (the multi-track recorder from Pocket Band) ---------- */
// Your practice recording is track 1. On top of it go mic takes, pan-tap tracks and a beat. Every track has
// its own volume, left/right, reverb, mute and solo, and the whole song exports as one file. Bars come from
// ♩ Timing in Write, so everything lines up with your notes and sections.
const STUDIO=(()=>{
const q=s=>document.querySelector(s);
const uid=()=>Date.now().toString(36).slice(-4)+Math.random().toString(36).slice(2,7);
let PR={latency:0,micLag:null,zoom:1};
try{Object.assign(PR,JSON.parse(localStorage.getItem('panyard-studio')||'{}'))}catch{}
if(PR.cal==null&&PR.latency)PR.cal=1;   // set before this was remembered
const savePR=()=>{try{localStorage.setItem('panyard-studio',JSON.stringify(PR))}catch{}};
// each Pan taps track plays one pan set (the song's pan unless you choose another); My part plays the song's
const trSet=tr=>tr&&tr.type==='pan'?(SETS[tr.panSet]?tr.panSet:'guitar'):setKey();
const pidsOf=tr=>SETS[trSet(tr)].views.flatMap(p=>p.fields.map(f=>f[0])).sort((a,b)=>midiOf(PITCH[b])-midiOf(PITCH[a]));   // high to low
// every pan's colours, so a Six bass track still shows its notes in a song written for the tenor
const GCOL={};for(const k in SETS)(SETS[k].groups||[]).forEach(g=>{if(!GCOL[g.key])GCOL[g.key]=g.color});
const gcol=id=>{const g=grpOf(id);return 'var(--'+g+','+(GCOL[g]||'#9d93c9')+')'};
const pname=id=>{const f=FIELDS.get(id);return (f?f.label.replace(/[\u0307\u0308\u0323\u0324]/g,''):id)+PITCH[id].slice(-1)};
const mtof=m=>440*Math.pow(2,(m-69)/12);
/* ---- drum kits: the Real kit is in drums/, each other kit in its own folder, loaded the first time it's used ----
   lay: how the kit is drawn to play (a drum kit seen from above, the engine room, or drum machine pads) */
const KITS={
  real:{name:'Panyard Real kit',feel:'Steelband drums and percussion',dir:'drums/',lay:'kit',by:'Versilian Community Sample Library (CC0)'},
  engine:{name:'Engine Room',feel:'Iron, scratcher, cowbell, shak-shak, congas',dir:'drums/',lay:'engine',by:'Versilian Community Sample Library (CC0)'},
  rusty:{name:'Big Rusty',feel:'1980s rock kit, big and roomy',dir:'drums/rusty/',lay:'kit',by:'Big Rusty Drums by Karoryfer Samples (CC0)'},
  jazz:{name:'Virtuosity Jazz',feel:'Jazz kit for calypso and kaiso',dir:'drums/jazz/',lay:'kit',by:'Virtuosity Drums by Versilian Studios and Karoryfer Samples (CC0)'},
  pearl:{name:'Black Pearl',feel:'Clean studio kit for pop and rock',dir:'drums/pearl/',lay:'kit',by:'Black Pearl from AVL Drumkits by Glen MacArthur (CC BY-SA 3.0)'},
  machine:{name:'Drum Machine',feel:'TR-808 electronic drums',dir:'drums/machine/',lay:'pads',by:'Roland TR-808 samples by Michael Fischer, given away free'}
};

/* ---- the studio song: one per Panyard song ---- */
let song=null,songKey=null,loading=null;
function trk(type,extra){
  const t={id:type==='practice'?'practice':uid(),type,vol:.85,pan:0,mute:false,solo:false,mix:null};
  if(type==='pan'){t.notes=[];t.panSet=setKey();t.name=SETS[t.panSet].name}
  if(type==='audio'){t.take=null;t.start=0;t.dur=0;t.peaks=null;t.lagMs=0;t.name='Mic'}
  if(type==='beats'){t.len=16;t.swing=0;t.unit=8;t.off=[];t.rows=[36,38,42,46].map(m=>({m,steps:Array(16).fill(0)}));t.name='Beat'}
  // a drum track: a kit you play with your fingers; every hit is a note (p = the drum's number) on the track
  if(type==='drums'){t.notes=[];t.kit='rusty';t.name=KITS.rusty.name}
  if(type==='practice')t.name='Your recording';
  if(type==='part')t.name='My part';
  return Object.assign(t,extra||{});
}
const blank=()=>{const part=trk('part');part.name='My part';return{v:1,bpm:100,metro:false,countIn:true,recMode:'add',snap:'off',snapRec:false,cycle:null,master:.85,sel:part.id,minBars:8,tracks:[trk('practice'),part]}};
const MIXDEF={practice:.04,audio:.08,pan:.22,part:.22,beats:.05,drums:.06},DECAY={practice:1.2,audio:1.4,pan:1.9,part:1.9,beats:.9,drums:.9};
const mixOf=tr=>tr.mix==null?MIXDEF[tr.type]:tr.mix;
// each track's own settings (Track settings): tone, echo and room; for pan tracks also quantize and transpose
const FX0={treble:0,bass:0,comp:0,echo:0,echoT:'q',room:0};
// a suggested tone for each pan, on until you move Treble, Bass or Compressor yourself (fx.own): the basses get more
// bottom and less stick click, the tenors more shine and less boom. Tracks set before this kept what you'd moved.
const TONE={tenor:{bass:-2,treble:2,comp:.2},dten:{bass:-1,treble:2,comp:.2},dsec:{bass:-1,treble:1,comp:.2},guitar:{bass:0,treble:0,comp:.2},
  fcello:{bass:1,treble:-1,comp:.2},tcello:{bass:1,treble:-1,comp:.2},six:{bass:4,treble:-3,comp:.35},seven:{bass:4,treble:-3,comp:.35}};
// where each pan's Bass and Treble take hold, so Bass on a tenor (lowest note about 260 Hz) still does something
const SHELF={tenor:[420,5000],dten:[360,4500],dsec:[330,4200],guitar:[260,3600],fcello:[220,3200],tcello:[220,3200],six:[140,2400],seven:[140,2400]};
const toneSet=tr=>tr&&(tr.type==='pan'||tr.type==='part')?trSet(tr):null;
const toneOf=tr=>TONE[toneSet(tr)]||null;
const ownTone=tr=>{const f=tr.fx;if(!f)return false;return f.own!==undefined?!!f.own:!!(f.treble||f.bass||f.comp)};
const fxOf=tr=>{const o=Object.assign({},FX0,tr.fx||{}),s=toneOf(tr);o.own=ownTone(tr);if(s&&!o.own)Object.assign(o,s);return o};
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
const isNotey=tr=>isPanish(tr)||tr.type==='drums';   // tracks made of hits you play: pans, your part, drums
const audioOf=tr=>tr.type==='practice'?pBuf:tr.type==='audio'&&tr.take?buffers[tr.take]:null;
const startOf=tr=>tr.type==='practice'?pracStart():tr.start||0;
function contentEnd(){let e=0;
  for(const tr of song.tracks){
    const a=audioOf(tr);if(a)e=Math.max(e,startOf(tr)+a.duration/spb());
    else if(tr.type==='audio'&&tr.dur)e=Math.max(e,tr.start+tr.dur/spb());
    if(isNotey(tr))for(const n of notesOf(tr))e=Math.max(e,n.t+n.d);
  }return e}
const bars=()=>Math.max(song.minBars||8,Math.ceil(contentEnd()/BPB()-.1));   // a last note ringing a moment past the bar line doesn't add a bar
const L=()=>bars()*BPB();

/* ---- sound: a mixing desk built on the pans' own audio engine ---- */
let ctx=null,master=null,meterM=null,reverbs=new Map(),noise=null;
const chans=new Map();
function buildMaster(ac){
  const vol=ac.createGain(),comp=ac.createDynamicsCompressor(),lim=ac.createDynamicsCompressor(),an=ac.createAnalyser();
  vol.gain.value=song?song.master:.85;comp.threshold.value=-12;comp.ratio.value=4;
  lim.threshold.value=-1;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.002;lim.release.value=.1;   // keeps loud moments from distorting
  an.fftSize=512;vol.connect(comp);comp.connect(lim);const sc=softClip(ac);lim.connect(sc);sc.connect(an);an.connect(ac.destination);   // a soft limit last: no crackle on loud moments
  return{vol,an};
}
function AC(){
  if(!ctx){ctx=panCtx();if(!ctx)return null;const m=buildMaster(ctx);master=m.vol;meterM=m.an;
    noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    setTimeout(warmDrums,0)}
  if(ctx.state==='suspended')ctx.resume();
  return ctx;
}
function makeIR(ac,decay,chs=2){
  const sr=ac.sampleRate,n=Math.max(1,Math.round(sr*decay)),ir=ac.createBuffer(chs,n,sr),pre=Math.round(sr*.012);
  for(let c=0;c<chs;c++){const d=ir.getChannelData(c);let lp=0;
    for(let i=pre;i<n;i++){const t=(i-pre)/sr,k=.55-.45*Math.min(1,t/decay);lp+=k*((Math.random()*2-1)-lp);d[i]=lp*Math.pow(1-(i-pre)/(n-pre),2)*Math.exp(-t*3/decay)}}
  return ir;
}
// On an Android phone reverb is the heaviest thing the sound does, and several at once make playback stutter:
// there every track shares one shorter reverb (mono). Computers, iPads and exports keep a reverb for each room.
const LITE=!!(window.PAN_ANDROID||/Android/i.test(navigator.userAgent||''));
function reverbFor(decay){if(LITE&&ctx instanceof AudioContext)decay='lite';let r=reverbs.get(decay);if(!r){r=ctx.createConvolver();r.buffer=decay==='lite'?makeIR(ctx,1.3,1):makeIR(ctx,decay);r.connect(master);reverbs.set(decay,r)}return r}
/* two zones once a song has its own tracks: Takes (your raw recordings, never changed by section edits)
   and Song (the arrangement: the tracks Add to… copies into, the template's layers, the groove) */
const inSong=t=>t.type==='beats'||t.song===true||(!!t.role&&t.song!==false);
const zoneOn=()=>!!song&&song.tracks.some(t=>t.type!=='beats'&&inSong(t));
const songZone=t=>!zoneOn()||inSong(t);   // which tracks section edits move
// Song tab: only the song (and the band recording if you switch it on). Takes tab: only the takes.
// Pans: whichever the track you're playing belongs to.
const playMode=()=>!zoneOn()?'all':VIEW==='song'?'song':VIEW==='tracks'?'takes':inSong(selTr())?'song':'takes';
const inMode=tr=>{const m=playMode();if(m==='all'||tr.id===song.sel)return true;if(m==='song')return inSong(tr)||(tr.type==='practice'&&!!song.band);return!inSong(tr)};
const zoneMuted=tr=>!inMode(tr);
const audible=tr=>{if(!inMode(tr))return false;return song.tracks.some(t=>t.solo&&inMode(t))?!!tr.solo:!tr.mute};
// each track: volume → low cut → left–right → (dry to the master) + (send to its room), with a level meter
function channel(tr){
  let c=chans.get(tr.id);
  if(!c){
    const out=ctx.createGain(),play=ctx.createGain(),hp=ctx.createBiquadFilter(),pan=ctx.createStereoPanner?ctx.createStereoPanner():null,dry=ctx.createGain(),send=ctx.createGain(),meter=ctx.createAnalyser();
    hp.type='highpass';hp.frequency.value=tr.type==='beats'||tr.type==='drums'?20:45;hp.Q.value=.6;meter.fftSize=512;
    // tone: bass and treble shelves, then a compressor with a little make-up gain
    const lo=ctx.createBiquadFilter(),hi=ctx.createBiquadFilter(),comp=ctx.createDynamicsCompressor(),mk=ctx.createGain();
    lo.type='lowshelf';lo.frequency.value=220;hi.type='highshelf';hi.frequency.value=3200;comp.attack.value=.005;comp.release.value=.18;comp.knee.value=8;
    play.connect(out);out.connect(hp);hp.connect(lo);lo.connect(hi);hi.connect(comp);comp.connect(mk);const last=pan||mk;if(pan)mk.connect(pan);
    last.connect(dry);dry.connect(master);last.connect(send);last.connect(meter);
    // echo: a delay in time with the song, feeding back on itself, a little darker each time round
    const esend=ctx.createGain(),dl=ctx.createDelay(5),fb=ctx.createGain(),dk=ctx.createBiquadFilter();dk.type='lowpass';dk.frequency.value=4500;
    last.connect(esend);esend.connect(dl);dl.connect(dk);dk.connect(fb);fb.connect(dl);dk.connect(master);
    c={out,play,pan,dry,send,meter,rev:null,hp,lo,hi,comp,mk,esend,dl,fb,dk,last,compOn:true,echoOn:true};chans.set(tr.id,c);
  }
  const fx=fxOf(tr);
  // parts that are switched off are taken out of the way, so a phone doesn't spend effort on them for every track
  {const on=fx.comp>.001;if(c.compOn!==on){try{c.hi.disconnect()}catch{}c.hi.connect(on?c.comp:c.mk);c.compOn=on}}
  {const on=fx.echo>.001;if(c.echoOn!==on){if(on)c.last.connect(c.esend);else try{c.last.disconnect(c.esend)}catch{}c.echoOn=on}}c.lo.gain.value=fx.bass;c.hi.gain.value=fx.treble;{const sf=SHELF[toneSet(tr)]||[220,3200];c.lo.frequency.value=sf[0];c.hi.frequency.value=sf[1]}
  // On the phone speaker (Settings): a bass track's overtones brought out, between the low cut and the tone shelves
  {const on=typeof PHONE!=='undefined'&&PHONE.on&&PHONE.bassSet(toneSet(tr));if(!!c.phOn!==on){if(on&&!c.ph)c.ph=PHONE.make(ctx);try{c.hp.disconnect()}catch{}try{if(c.ph)c.ph.out.disconnect()}catch{}
    if(on){c.hp.connect(c.ph.in);c.ph.out.connect(c.lo)}else c.hp.connect(c.lo);c.phOn=on}}
  c.comp.threshold.value=-fx.comp*32;c.comp.ratio.value=1+fx.comp*7;c.mk.gain.value=1+fx.comp*.9;
  const E=ECHOES[fx.echoT]||ECHOES.q;c.dl.delayTime.value=Math.min(4.9,E.b*cspb());c.fb.gain.value=E.fb;c.dk.frequency.value=E.dark?2200:4500;c.esend.gain.value=fx.echo;
  const sm=stageMix(tr),mx=Math.min(1,mixOf(tr)+(sm?sm.wet:0));c.out.gain.value=tr.vol*(sm?sm.gain:1);c.play.gain.value=audible(tr)?1:0;if(c.pan)c.pan.pan.value=sm?sm.pan:(tr.pan||0);
  c.dry.gain.value=1-mx*.5;c.send.gain.value=mx*1.6;
  const rv=mx>.001?reverbFor(fx.room||(sm?1.9:DECAY[tr.type])):null;if(c.rev!==rv){if(c.rev)try{c.send.disconnect(c.rev)}catch{}if(rv)c.send.connect(rv);c.rev=rv}
  return c;
}
function refreshGains(){if(!ctx)return;song.tracks.forEach(channel);if(master)master.gain.value=song.master;
  const sig=song.tracks.filter(audible).map(t=>t.id).join(',');
  if(T.playing&&!T.rec&&T.audSig!=null&&sig!==T.audSig){T.audSig=sig;setTimeout(restartIfPlaying,0)}else T.audSig=sig}
const hold=(p,t)=>{if(p.cancelAndHoldAtTime)p.cancelAndHoldAtTime(t);else p.cancelScheduledValues(t)};
let SCHED=false;   // true while the transport lines up sounds ahead of time, so Stop can call them off
const lineUp=(x,t)=>{if(SCHED)T.scheduled.push([x,t])};
function osc(type,f,t,end,dest){const o=ctx.createOscillator();o.type=type;o.frequency.value=f;o.connect(dest);o.start(t);o.stop(end);lineUp(o,t);return o}
function filt(type,f,qq){const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;if(qq)b.Q.value=qq;return b}
function noiseSrc(t,dur,dest){const s=ctx.createBufferSource();s.buffer=noise;s.connect(dest);s.start(t,Math.random());s.stop(t+dur);lineUp(s,t);return s}
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
  {m:60,n:'Bongo high'},{m:61,n:'Bongo low'},{m:67,n:'Agogo high'},{m:68,n:'Agogo low'},{m:54,n:'Tambourine'},{m:76,n:'Woodblock'},{m:94,n:'Cajon'},
  {m:90,n:'Doum'},{m:91,n:'Tek'},{m:92,n:'Ka'},{m:93,n:'Log drum'}];
const DRUM_NAME=Object.fromEntries(SOUNDS.map(s=>[s.m,s.n]));
/* ---- playing a drum track: a kit seen from above, the engine room's percussion, or drum machine pads ---- */
// [drum, name, x %, y %, width %, kind]: kind is a drum head, a kick, a cymbal or a small block
const KIT_LAY=[[49,'Crash',6,3,19,'cym'],[51,'Ride',72,3,21,'cym'],[42,'Hi-hat',1,38,15,'cym'],[46,'Open hat',1,78,15,'blk'],
  [48,'High tom',30,5,13,'drum'],[45,'Low tom',45,6,14,'drum'],[38,'Snare',17,40,17,'drum'],[37,'Rim',19,82,13,'blk'],
  [36,'Kick',36,34,22,'kick'],[43,'Floor tom',60,42,17,'drum']];
// held upright the kit stands taller (a 9:13 stage): cymbals on top, then toms, then hi-hat, snare and floor tom, the kick at the bottom
const KIT_TALL=[[49,'Crash',2,2,36,'cym'],[51,'Ride',62,2,36,'cym'],[48,'High tom',25,23,24,'drum'],[45,'Low tom',51,24,25,'drum'],
  [42,'Hi-hat',1,42,30,'cym'],[38,'Snare',30,45,29,'drum'],[43,'Floor tom',63,44,34,'drum'],[36,'Kick',29,65,38,'kick'],
  [46,'Open hat',1,66,24,'blk'],[37,'Rim',1,75,24,'blk']];
const KIT_TALL_EXTRA={real:[[81,'Iron',74,70,25,'blk'],[73,'Scratcher',74,79,25,'blk']],other:[[53,'Ride bell',74,70,25,'blk'],[44,'Hat pedal',74,79,25,'blk']]};
const tallStage=()=>innerHeight>innerWidth*1.1;
const KIT_EXTRA={real:[[81,'Iron',82,60,15,'blk'],[73,'Scratcher',82,78,15,'blk']],
  other:[[53,'Ride bell',82,60,15,'blk'],[44,'Hat pedal',82,78,15,'blk']]};
const PADS={
  engine:[[81,'Iron','#9fb0c0'],[80,'Iron muted','#9fb0c0'],[73,'Scratcher','#7ee2a8'],[70,'Shak-shak','#7ee2a8'],
    [56,'Cowbell','#ffd166'],[67,'Agogo high','#ffd166'],[68,'Agogo low','#ffd166'],[75,'Clave','#ffd166'],
    [63,'Conga high','#ff8a5c'],[62,'Conga slap','#ff8a5c'],[64,'Conga low','#ff8a5c'],[54,'Tambourine','#c792ff'],
    [60,'Bongo high','#ff7ab8'],[61,'Bongo low','#ff7ab8'],[76,'Woodblock','#c792ff'],[39,'Clap','#6fb7ff']],
  pads:[[49,'Cymbal','#ffd166'],[46,'Open hat','#6fb7ff'],[42,'Closed hat','#6fb7ff'],[56,'Cowbell','#9fe07a'],
    [48,'High tom','#c792ff'],[47,'Mid tom','#c792ff'],[45,'Low tom','#c792ff'],[75,'Clave','#9fe07a'],
    [39,'Clap','#ff7ab8'],[37,'Rim','#ff8a5c'],[40,'Snare 2','#ff8a5c'],[38,'Snare','#ff8a5c'],
    [70,'Maraca','#9fe07a'],[63,'Conga','#9fe07a'],[35,'Boom','#4fd6d6'],[36,'Kick','#4fd6d6']]};
// a drum track's lane: cymbals on top, kick at the bottom
const DRUM_ROW=m=>[49,51,52,53,55,57,59].includes(m)?0:[42,44,46].includes(m)?1:[41,43,45,47,48,50].includes(m)?2:[37,38,39,40].includes(m)?3:[35,36].includes(m)?4:5;
const ROW_COL=['#ffd166','#6fb7ff','#c792ff','#ff8a5c','#4fd6d6','#9fe07a'];
function kitHTML(tr){
  const id=realKit(tr)||'real',K=KITS[id]||KITS.real;
  const tall=tallStage();
  let h='<div class="st-kitstage lay-'+K.lay+(tall?' tall':'')+'" id="stKit">';
  if(K.lay==='kit')for(const [m,n,x,y,w,k] of tall?KIT_TALL.concat(KIT_TALL_EXTRA[id]||KIT_TALL_EXTRA.other):KIT_LAY.concat(KIT_EXTRA[id]||KIT_EXTRA.other))
    h+='<button class="st-dp k-'+k+'" data-m="'+m+'" style="left:'+x+'%;top:'+y+'%;width:'+w+'%" aria-label="'+n+'"><span>'+n+'</span></button>';
  else h+='<div class="st-pads">'+PADS[K.lay].map(([m,n,c])=>'<button class="st-dp k-pad" data-m="'+m+'" style="--pc:'+c+'"><span>'+n+'</span></button>').join('')+'</div>';
  return h+'<button class="st-kitname" data-st="kitsheet" aria-label="Change kit: '+esc(K.name)+'">'+esc(K.name)+' ▾</button></div>';
}
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
Object.assign(DRUMS,{
  60:(d,t,v)=>conga(d,t,v,520,.18),61:(d,t,v)=>conga(d,t,v,400,.22),
  67:(d,t,v)=>metal(d,t,v,[920,1380],.25,.35,1500),68:(d,t,v)=>metal(d,t,v,[690,1030],.3,.35,1200),
  54:(d,t,v)=>{DRUMS[70](d,t,v);metal(d,t,.6*v,[5200,6800,8100],.12,.2,6000)},
  76:(d,t,v)=>{const gn=ctx.createGain(),bp=filt('bandpass',1800,6);env(gn,t,.9*v,.05);bp.connect(gn);gn.connect(d);osc('sine',1800,t,t+.06,bp)},
  94:(d,t,v)=>{DRUMS[36](d,t,.8*v);DRUMS[37](d,t,.3*v)}});
/* ---- the Real kit: recorded drums and percussion (CC0, from the Versilian Community Sample Library) ----
   Each sound has one to three recorded hits; the app picks among them so a run of the same note never sounds
   like a machine. If the files can't load (or a beat is set to Classic), the built-in tones play instead. */
// one set of sounds per folder (the Engine Room shares the Real kit's)
const KITBUF=new Map();
const kitBuf=id=>{const dir=(KITS[id]||KITS.real).dir;let k=KITBUF.get(dir);if(!k){k={buf:new Map(),loading:null,ok:false};KITBUF.set(dir,k)}return k};
const KIT=kitBuf('real');
function loadKit(id){
  const K=kitBuf(id),dir=(KITS[id]||KITS.real).dir;
  if(K.loading)return K.loading;
  K.loading=(async()=>{try{
    const meta=await (await fetch(dir+'kit.json')).json(),ac=panCtx();
    await Promise.all(Object.entries(meta).map(async([m,k])=>{const bs=[];
      for(const f of k.f){try{const ab=await (await fetch(dir+f)).arrayBuffer();bs.push(await new Promise((res,rej)=>{const p=ac.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)}))}catch{}}
      if(bs.length)K.buf.set(+m,{b:bs,lv:+k.lv||1,last:-1})}));
    K.ok=K.buf.size>0;
  }catch{K.ok=false}
    if(!K.ok)K.loading=null;   // offline the first time: try again next time it's chosen
  })();
  return K.loading;
}
// which kit a beat or drum track plays: a kit's id, or false for the Classic (made-in-the-app) sounds
const realKit=tr=>!tr||tr.kit!=='synth'?(tr&&KITS[tr.kit]?tr.kit:'real'):false;
// a drum a kit doesn't have borrows the nearest one it does (a floor tom from the low tom, a pedal hi-hat from the closed one)
const DRUM_ALT={35:36,40:38,41:45,43:45,47:48,50:48,44:42,53:51,59:51,52:49,55:49,57:49,82:70,69:70};
const DRUM_BUF=new Map();let drumWarm=null;
async function cacheDrum(m){
  if(DRUM_BUF.has(m)||!DRUMS[m])return;
  const live=ctx,len=m===49?2:m===51?1.2:.9,off=new OfflineAudioContext(1,Math.ceil(44100*len),44100);
  ctx=off;try{DRUMS[m](off.destination,0,1)}finally{ctx=live}   // the build is synchronous, so live sounds never see the swap
  DRUM_BUF.set(m,await off.startRendering());
}
function warmDrums(){if(!drumWarm)drumWarm=(async()=>{const ids=new Set(['real']);if(song)for(const t of song.tracks){const k=realKit(t);if((t.type==='beats'||t.type==='drums')&&k)ids.add(k)}
  await Promise.all([...ids].map(loadKit));for(const s of SOUNDS)await cacheDrum(s.m)})().finally(()=>{drumWarm=null});return drumWarm}
// the recorded hit for drum m in this kit: its own, else a stand-in from the same kit, else the Real kit's
function kitHit(m,kit){
  const id=kit===true?'real':kit;if(!id)return null;const K=kitBuf(id);
  if(!K.ok&&!K.loading)loadKit(id);
  return K.buf.get(m)||K.buf.get(DRUM_ALT[m])||(id!=='real'?KIT.buf.get(m)||KIT.buf.get(DRUM_ALT[m]):null)||null;
}
function playDrum(m,dest,t,v,real=true){
  if(!DRUMS[m]&&DRUM_ALT[m]&&!kitHit(m,real))m=DRUM_ALT[m];
  const k=kitHit(m,real);
  if(k){let i=Math.floor(Math.random()*k.b.length);if(k.b.length>1&&i===k.last)i=(i+1)%k.b.length;k.last=i;   // never the same recorded hit twice in a row
    const s=ctx.createBufferSource(),gn=ctx.createGain();s.buffer=k.b[i];gn.gain.value=v*k.lv*1.5;s.connect(gn);gn.connect(dest);s.start(Math.max(t,ctx.currentTime));lineUp(s,t);return}
  const b=DRUM_BUF.get(m);
  if(b){const s=ctx.createBufferSource(),gn=ctx.createGain();s.buffer=b;gn.gain.value=v;s.connect(gn);gn.connect(dest);s.start(t);lineUp(s,t);return}
  (DRUMS[m]||DRUMS[36])(dest,t,v);if(ctx instanceof AudioContext)cacheDrum(m);
}

/* the pans: your own recorded notes when you have them (Setup → Sound), otherwise the built-in pan tone */
let PV=new Map();
function playBuf(dest,id,b,T,t,v,light){
  const end=Math.min(b.duration,T.end??b.duration),start=Math.max(0,Math.min(T.start,end-.05)),len=(end-start)/(T.rate||1),a=v*Math.pow(10,T.db/20)*(light?.7:1);
  // the note's Tone (a shelf) and Ring (its fade bent shorter or longer) from Tune my pans, with this song's band sound on top
  T=BAND.tune(T);const det=(T.cents||0)+refCents()+BAND.cents(id),ch=BAND.chain(ctx,T,id,Math.min(1,v),t,light);if(ch)ch.out.connect(dest);
  const one=(d,a,at)=>{const src=ctx.createBufferSource(),gn=ctx.createGain();src.buffer=b;if(src.detune)src.detune.value=d;gn.connect(ch?ch.in:dest);src.connect(gn);
    let stopAt;
    if(light){gn.gain.setValueAtTime(0,at);gn.gain.linearRampToValueAtTime(a,at+.004);const e=Math.max(.13,Math.min(len,.45));gn.gain.setValueAtTime(a,at+.12);gn.gain.linearRampToValueAtTime(0,at+e);stopAt=at+e+.01}
    else{noteEnvelope(gn.gain,a,at,len,T.fade,T);stopAt=at+len+.01}   // a 4 ms fade-in keeps it free of clicks
    src.start(at,start);src.stop(stopAt);lineUp(src,at);return {src,g:gn,end:stopAt}};
  const main=one(det,a,t),vs=[main];if(BAND.shimmerOn(light))vs.push(one(det+9,a*.5,t+.012));const src=main.src,gn=main.g,stopAt=Math.max(...vs.map(x=>x.end));
  // the same note struck again on the same pan damps the older ring, like a real pan. Only that pan's own
  // ring, and only one that has already started: another track (a take of the same pan, say) never cuts it off
  let pv=PV.get(dest);if(!pv){pv=new Map();PV.set(dest,pv)}
  const prev=pv.get(id);
  if(prev&&prev.start<t-.001&&prev.end>t){for(const p of prev.vs||[prev])try{hold(p.g.gain,t);p.g.gain.linearRampToValueAtTime(0,t+.03);p.src.stop(t+.04)}catch{}}
  if(!prev||prev.start<=t)pv.set(id,{src,g:gn,start:t,end:stopAt,vs});
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
// light: a roll's quick strike. Notes recorded before dynamics don't say, so a soft one counts as a roll's
function panVoice(dest,id,t,v,light){
  if(!PITCH[id])return;if(light===undefined)light=v<.78;
  // Tuned steel (panyard-steel.js): its ready note, played like a recording (Stop, loops and damping included); until
  // it's ready, made live, with every part lined up so Stop can still cancel it
  if(S.panVoice==='steel'&&typeof STEEL!=='undefined'){const b=STEEL.ready(id);if(b){playBuf(dest,id,b,STEEL.T(b),t,v,light);return}
    STEEL.make(id);(STEEL.one(ctx,dest,id,t,v,light)||[]).forEach(x=>lineUp(x,t));return}
  if(S.panVoice==='mine'){
    // your recording of this note, or (Advanced tuning) another pan's recording retuned to it
    let src=id,sh=0;if(!SAMPLES.wav[id]||(typeof TW!=='undefined'&&TW.skip(id))){const bw=typeof borrowOf==='function'&&borrowOf(id);if(bw){src=bw.src;sh=bw.cents}else src=null}
    const go=b=>{const T=tuneOf(src);playBuf(dest,id,b,sh?Object.assign({},T,{cents:(T.cents||0)+sh,rate:Math.pow(2,sh/1200)}):T,t,v,light)};
    if(src){const b=SAMPLES.buf[src];if(b){go(b);return}
      // not ready yet: your recording as soon as it is, never the built-in tone (unless it can't be read)
      if(!(SAMPLES.bad&&SAMPLES.bad[src])){if(typeof warmSamples==='function')warmSamples();sampleBuf(src).then(b=>{if(!b){if(SAMPLES.bad)SAMPLES.bad[src]=1;return}if(ctx.currentTime<t+.3){t=Math.max(t,ctx.currentTime+.003);go(b)}});return}}}
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
  pop:{name:'Pop / classics',bpm:100,len:16,unit:8,swing:0,rows:[[36,[0,8,10]],[38,[4,12],[4,12]],[42,EVEN(16)]]},
  engine:{name:'Engine room (panyard)',bpm:132,len:16,unit:16,swing:0,rows:[[81,[0,2,3,4,6,7,8,10,11,12,14,15],[0,4,8,12]],[80,[1,5,9,13]],[73,ALL16,[2,6,10,14]],[56,[2,6,10,14]],[36,[0,4,8,12]],[63,[3,7,11,15]],[64,[6,14]],[62,[10]]]},
  roadmarch:{name:'Road march',bpm:128,len:16,unit:16,swing:0,rows:[[36,[0,4,8,12]],[38,[4,12],[4,12]],[81,[0,3,6,8,11,14],[0,8]],[54,EVEN(16),[4,12]],[56,[2,6,10,14]],[42,ODD(16)],[64,[7,15]]]},
  kaiso:{name:'Old-time kaiso',bpm:108,len:16,unit:8,swing:.3,rows:[[36,[0,6,8,14]],[75,[0,3,6,10,12],[0,6]],[81,[0,4,8,12],[0]],[70,EVEN(16)],[60,[2,10]],[61,[6,14]],[37,[4,12]]]},
  chutney:{name:'Chutney soca',bpm:148,len:16,unit:16,swing:0,rows:[[90,[0,6,8,14],[0,8]],[91,[3,4,11,12]],[92,[2,10]],[81,[0,2,4,6,8,10,12,14],[4,12]],[36,[0,4,8,12]],[54,ODD(16)]]},
  bouyon:{name:'Bouyon',bpm:160,len:16,unit:16,swing:0,rows:[[36,[0,3,6,8,11,14]],[38,[4,12],[4,12]],[42,EVEN(16)],[67,[2,6,10]],[68,[14]],[81,[0,4,8,12]],[39,[12]]]},
  dancehall:{name:'Dancehall',bpm:96,len:16,unit:16,swing:0,rows:[[36,[0,8]],[38,[3,6,11,14],[6,14]],[42,EVEN(16)],[76,[2,10]],[54,[4,12]]]},
  reggae:{name:'Reggae one drop',bpm:74,len:16,unit:8,swing:.25,rows:[[36,[8]],[37,[8],[8]],[42,EVEN(16)],[46,[14]],[56,[4,12]]]},
  zouk:{name:'Zouk',bpm:118,len:16,unit:16,swing:0,rows:[[36,[0,4,8,12]],[37,[3,6,10,14]],[70,ALL16,[0,4,8,12]],[63,[7,15]],[64,[2,10]]]}
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
/* ---- playback speed: ¾ or ½ speed to learn a hard passage. The beats stay where they are in the song; only the
   clock runs slower, and the recordings are stretched to match without dropping in pitch (WSOLA: overlapping slices of
   the sound, each one lined up with the last so they join smoothly). ---- */
const SPD={rate:1,cache:new WeakMap(),busy:null};
const cspb=()=>spb()/SPD.rate;   // seconds per beat on the clock (spb() is in the song's own seconds)
async function stretched(buf,rate){
  if(rate===1||!buf)return buf;let m=SPD.cache.get(buf);if(!m){m={};SPD.cache.set(buf,m)}if(m[rate])return m[rate];
  const N=2048,Hs=1024,Ha=Hs*rate,D=8,TOL=512,ch=buf.numberOfChannels,len=buf.length,out=Math.ceil(len/rate)+N;
  const ins=[...Array(ch)].map((_,c)=>buf.getChannelData(c)),outs=[...Array(ch)].map(()=>new Float32Array(out)),norm=new Float32Array(out);
  const w=new Float32Array(N);for(let i=0;i<N;i++)w[i]=.5-.5*Math.cos(2*Math.PI*i/N);
  // a quiet copy for lining the slices up, every 8th sample of the mix
  const mono=new Float32Array(Math.ceil(len/D));for(let i=0;i<mono.length;i++){let v=0;for(let c=0;c<ch;c++)v+=ins[c][i*D]||0;mono[i]=v}
  let prev=0,k=0;
  for(let o=0;o+N<out;o+=Hs,k++){
    const want=Math.round(k*Ha);let best=want;
    if(k>0){const nat=prev+Hs;let bc=-Infinity;const n=N/D;
      for(let d=-TOL;d<=TOL;d+=D*2){const c0=want+d;if(c0<0||c0+N>=len)continue;let sum=0;const a=c0/D|0,b=nat/D|0;
        for(let i=0;i<n;i++)sum+=(mono[a+i]||0)*(mono[b+i]||0);if(sum>bc){bc=sum;best=c0}}}
    if(best+N>=len)break;prev=best;
    for(let c=0;c<ch;c++){const I=ins[c],O=outs[c];for(let i=0;i<N;i++)O[o+i]+=I[best+i]*w[i]}
    for(let i=0;i<N;i++)norm[o+i]+=w[i];
    if(k%400===399)await new Promise(r=>setTimeout(r,0));   // let the screen keep up
  }
  const res=ctx.createBuffer(ch,Math.ceil(len/rate),buf.sampleRate);
  for(let c=0;c<ch;c++){const O=outs[c],R=res.getChannelData(c);for(let i=0;i<R.length;i++)R[i]=norm[i]>.1?O[i]/norm[i]:O[i]}
  m[rate]=res;return res;
}
// ⏩ 1× → ¾ → ½ → 1×: the recordings are made ready first (a second or two for a whole song), then it plays on
async function setSpeed(r){
  if(T.rec||T.mic){say('Change the speed when you\'ve stopped recording.');return}
  r=[1,.75,.5].includes(r)?r:1;if(r===SPD.rate)return;const was=T.playing;if(was)stop(false);
  if(r!==1){const bufs=song.tracks.map(audioOf).filter(Boolean);if(bufs.some(b=>!(SPD.cache.get(b)||{})[r]))say('Getting the '+(r===.5?'half':'¾')+' speed version ready…');
    SPD.busy=r;for(const b of bufs)await stretched(b,r);if(SPD.busy!==r)return;SPD.busy=null}
  SPD.rate=r;chans.clear();refreshGains();renderTransport();try{renderSheet()}catch{}
  say(r===1?'Back to full speed.':'Playing at '+(r===.5?'half':'¾')+' speed. The pitch stays the same.');
  if(was)play(false);
}
const speedLab=()=>SPD.rate===1?'1×':SPD.rate===.5?'½×':'¾×';
const T={playing:false,rec:false,t0:0,b0:0,pos:0,schedU:0,timer:0,scheduled:[],sources:[],take:0,recTid:null,mic:null,noCyc:false,raf:0};
const cycOn=()=>!!(song.cycle&&song.cycle.on&&song.cycle.e>song.cycle.s);
const looping=()=>cycOn()&&!T.noCyc;
const loopS=()=>looping()?song.cycle.s*BPB():0;
const loopE=()=>looping()?song.cycle.e*BPB():L();
const uNow=()=>T.b0+(ctx.currentTime-T.t0)/cspb();
const wrap=u=>{if(!looping())return u;const s=loopS(),n=loopE()-s;return s+(((u-s)%n)+n)%n};
const beatNow=()=>T.playing?wrap(Math.max(T.b0,uNow())):T.pos;
// what you're hearing right now: the speaker plays a moment after the sound is made, so the playhead, the count and
// the lights wait for it (with Bluetooth that's up to a third of a second, half a beat at 120 bpm)
const heardNow=()=>T.playing?wrap(Math.max(T.b0,uNow()-spkLag()/cspb())):T.pos;
const u2t=u=>T.t0+(u-T.b0)*cspb();
function play(countIn){
  if(T.playing||!AC())return;
  // slowed down, and a recording isn't stretched yet (a new take, a new song recording): get it ready, then play
  if(SPD.rate!==1){const miss=song.tracks.map(audioOf).filter(b=>b&&!(SPD.cache.get(b)||{})[SPD.rate]);
    if(miss.length){if(SPD.busy)return;const r=SPD.rate;SPD.busy=r;say('Getting the slower version ready…');Promise.all(miss.map(b=>stretched(b,r))).then(()=>{SPD.busy=null;if(SPD.rate===r)play(countIn)});return}}refreshGains();
  if(S.panVoice==='steel'&&typeof STEEL!=='undefined'){const miss=steelIds().filter(id=>!STEEL.ready(id));
    if(miss.length){if(T.steelBusy)return;T.steelBusy=1;say('Getting Tuned steel ready…');STEEL.warm(miss).then(()=>{T.steelBusy=0;play(countIn)});return}}
  if(looping()&&(T.pos<loopS()||T.pos>=loopE()))T.pos=loopS();
  if(!looping()&&!T.rec&&T.pos>=L()-.01)T.pos=0;
  audio.pause();
  const cin=countIn?(ck().bars===2?2:1)*BPB():0,pre=cin*cspb();
  T.playing=true;T.t0=ctx.currentTime+.12+pre;T.b0=T.pos;T.schedU=T.pos;
  SCHED=true;try{for(let i=0;i<cin;i++)click(T.t0-(cin-i)*cspb(),i%BPB()===0)}finally{SCHED=false}   // a bar (or two) of clicks before the take
  T.cin=cin;
  for(const tr of song.tracks){const a=audioOf(tr);if(!a||(T.mic&&T.mic.tr===tr))continue;const off=(T.pos-startOf(tr))*spb();if(off>0&&off<a.duration)startSrc(tr,T.t0,off,looping()?u2t(loopE()):0)}
  T.timer=setInterval(tick,25);tick();renderTransport();frame();
}
function stop(rewind){
  if(T.mic){micStop();return}
  if(!T.playing){T.pos=rewind===false?T.pos:0;renderTransport();updatePlayhead();return}
  // it stops where you heard it stop
  T.pos=Math.min(heardNow(),L());T.playing=false;clearInterval(T.timer);cancelAnimationFrame(T.raf);
  // sounds lined up for the next moment are called off; notes already ringing ring on
  const now=ctx.currentTime;T.scheduled.forEach(([x,t])=>{if(t>now)try{x.stop(now)}catch{}});T.scheduled=[];
  T.sources.forEach(s=>{try{s.stop()}catch{}});T.sources=[];
  if(T.rec){T.rec=false;if(WR.on)writeRecEnd();else endNoteRec()}
  if(rewind===true)T.pos=looping()?loopS():0;
  renderTransport();updatePlayhead();
}
const GL={n:0,log:[],last:null};
setInterval(()=>{if(!ctx||!(ctx instanceof AudioContext)||!T.playing){GL.last=null;return}
  const now=performance.now()/1000,a=ctx.currentTime;
  if(GL.last){const dw=now-GL.last[0],da=a-GL.last[1];if(dw>.05&&dw-da>.04){GL.n++;GL.log.push(Date.now())}}
  GL.last=[now,a];GL.log=GL.log.filter(t=>Date.now()-t<60000)},250);
function restartIfPlaying(){if(T.playing&&!T.rec){stop(false);play(false)}}
function tick(){
  const to=uNow()+.35/cspb();   // sounds are lined up 0.35 s ahead, so a busy moment on the phone can't make them late
  if(looping()){const s=loopS(),n=loopE()-s;let from=T.schedU;
    while(from<to-1e-9){const k=Math.floor((from-s)/n+1e-9),end=Math.min(to,s+(k+1)*n);scheduleRange(from-k*n,end-k*n,k*n);from=end}}
  else scheduleRange(T.schedU,to,0);
  T.schedU=to;
  if(T.rec&&uNow()>L()-BPB()){song.minBars=bars()+4;renderTimeline()}
  if(!looping()&&!T.rec&&uNow()>=L())stop(true);
}
function scheduleRange(a,b,off){
  const now=ctx.currentTime;if(T.scheduled.length>400)T.scheduled=T.scheduled.filter(([,t])=>t>now);
  SCHED=true;try{scheduleRange1(a,b,off)}finally{SCHED=false}
}
function scheduleRange1(a,b,off){
  const sp=spb(),wrapped=looping()&&off>0&&Math.abs(a-loopS())<1e-6;
  for(const tr of song.tracks){
    if(!audible(tr)&&tr.id!==T.recTid)continue;
    const c=channel(tr);
    if(tr.type==='beats'){const rk=realKit(tr);for(const [bt,m,v] of beatHits(tr,a,b))playDrum(m,c.play,u2t(bt+off),v,rk);continue}
    if(tr.type==='drums'){const rk=realKit(tr),hush=T.rec&&(song.recMode==='replace'||song.recMode==='take')&&tr.id===T.recTid;
      for(const n of tr.notes)if(n.t>=a&&n.t<b&&n.tk!==T.take&&!(hush&&n.t>=T.recFrom-1e-6))playDrum(+n.p,c.play,u2t(n.t+off),n.v,rk);continue}
    const buf=audioOf(tr);
    if(buf){if(T.mic&&T.mic.tr===tr)continue;const st=startOf(tr);
      const endT=looping()?u2t(off+loopE()):0;
      if(st>=a&&st<b)startSrc(tr,u2t(st+off),0,endT);
      else if(wrapped&&st<a&&st+buf.duration/sp>a)startSrc(tr,u2t(a+off),(a-st)*sp,endT);   // the loop came round partway into this recording
      continue}
    if(tr.type==='part'){for(const n of partNotes())if(n.t>=a&&n.t<b)panVoice(c.play,n.p,u2t(n.t+off),n.v,n.r===undefined?undefined:!!n.r);continue}
    if(tr.type!=='pan')continue;
    // Replace mode: just before the playhead gets there, older notes on the track being recorded are wiped
    // Replace / New take: while you record, the old notes from where you started are silent (they're only
    // removed when you stop, and only in the bars you recorded over)
    const hush=T.rec&&(song.recMode==='replace'||song.recMode==='take')&&tr.id===T.recTid;
    for(const n of pnotes(tr))if(n.t>=a&&n.t<b&&n.tk!==T.take&&!(hush&&n.t>=T.recFrom-1e-6))panVoice(c.play,n.p,u2t(n.t+off),n.v,n.r===undefined?undefined:!!n.r);
  }
  if(song.metro&&ck().sound!=='none'&&(!ck().recOnly||T.rec))for(let k=Math.ceil(a-1e-9);k<b;k++)click(u2t(k+off),k%BPB()===0);
}
function startSrc(tr,t,offset,endT){
  // offset is in the recording's own seconds; at ¾ or ½ speed the stretched copy plays, and it's that much longer
  const r=SPD.rate,b=r===1?audioOf(tr):(SPD.cache.get(audioOf(tr))||{})[r];if(!b)return;
  const s=ctx.createBufferSource();s.buffer=b;s.connect(channel(tr).play);
  s.start(Math.max(t,ctx.currentTime),offset/r+Math.max(0,ctx.currentTime-t));
  if(endT&&endT>t)s.stop(endT);   // a loop: this pass ends at the loop's end
  T.sources.push(s);s.onended=()=>{T.sources=T.sources.filter(x=>x!==s)};
}
function seek(b){const was=T.playing&&!T.rec;if(T.playing)stop(false);T.pos=Math.max(0,Math.min(L(),b));if(was)play(false);updatePlayhead()}

/* ---- recording pan taps ---- */
// one tap delay for the whole app: Write's 'Tap delay fix' and Studio's pan-tap timing are the same number
const tapMs=()=>Math.round((Number.isFinite(S.tapLag)?S.tapLag:0)*1000);
const latBeats=()=>tapMs()/1000/cspb();
const recBeatAt=t=>wrap(Math.max(T.b0,T.b0+(t-T.t0)/cspb()-latBeats()));
// How far behind the app's audio clock the speaker is. A computer is about 0.01-0.045 s; an Android phone can be
// 0.1-0.3 s. The tap delay fix was set up on the computer-sized delay, so only the extra beyond that is taken off.
let spkC={t:-1,v:0};
function spkLag(){
  if(!ctx)return 0;if(ctx.currentTime-spkC.t<.5)return spkC.v;
  let l=(ctx.outputLatency||0)+(ctx.baseLatency||0);
  try{const o=ctx.getOutputTimestamp&&ctx.getOutputTimestamp();if(o&&o.contextTime>0&&o.performanceTime>0){const m=ctx.currentTime-(o.contextTime+(performance.now()-o.performanceTime)/1000);if(m>l&&m<.6)l=m}}catch{}
  spkC={t:ctx.currentTime,v:l};return l;
}
const SPK_BASE=.045;
// the audio-clock time of a tap: when your finger landed (a busy phone can take a while to pass the tap on),
// lined up with what you were hearing at that moment
function tapT(e){
  const late=e&&e.timeStamp>0?Math.max(0,Math.min(.3,(performance.now()-e.timeStamp)/1000)):0;
  return ctx.currentTime-late-Math.max(0,spkLag()-SPK_BASE);
}
function recNote(tr,id,v,at){
  const when=at!=null?at:tapT(null);
  if(!(T.rec&&T.playing&&tr.id===T.recTid)||when<T.t0-Math.min(.25,cspb()*.4))return null;   // nothing records during the count-in, but a hair early on beat 1 counts as beat 1
  const n={t:+recBeatAt(when).toFixed(3),d:.25,p:id,v:+v.toFixed(2),tk:T.take};tr.notes.push(n);return n;
}
function recOff(n,at){if(!n)return;let d=recBeatAt(at!=null?at:tapT(null))-n.t;if(d<-.5&&looping())d+=loopE()-loopS();n.d=+Math.max(.25,Math.min(4,d)).toFixed(3)}   // a quick tap shows as a quarter beat
// while recording the song keeps 4 bars of room ahead; afterwards it's as long as what you played again
function fitBars(){if(T.mb0!=null){song.minBars=T.mb0;T.mb0=null}}
function endNoteRec(){
  fitBars();
  const tr=trById(T.recTid),take=T.take;T.recTid=null;T.noCyc=false;if(!tr)return;
  // Replace / New take: the old notes go only where you recorded (all of the loop if it came round)
  if(song.recMode==='replace'||song.recMode==='take'){
    const to=T.playing?beatNow():T.pos,from=T.recFrom||0,went=(ctx.currentTime-(T.recT||0))/cspb();
    const lp=looping(),all=lp&&went>=loopE()-loopS()-1e-3;
    const over=t=>all?(t>=loopS()-1e-6&&t<loopE()-1e-6):lp&&to<from?(t>=from-1e-6&&t<loopE()-1e-6)||(t>=loopS()-1e-6&&t<to-1e-6):(t>=from-1e-6&&t<to-1e-6);
    tr.notes=tr.notes.filter(n=>n.tk===take||!over(n.t));
  }
  const mineN=tr.notes.filter(n=>n.tk===take);
  if(song.snapRec&&song.snap!=='off')mineN.forEach(n=>{n.t=snapBeat(n.t,+song.snap)});
  tr.notes.forEach(n=>{delete n.tk});tr.notes.sort((x,y)=>x.t-y.t);
  if(song.recMode==='take'&&tr.takes){
    if(!mineN.length){if(H.u.length)restore(H.u.pop());else takeDrop(tr);renderUndo();renderAll();say('Nothing was played, so no new take.');return}
    dirty();renderAll();say(tr.takes[tr.tk].name+' recorded on '+tr.name+'. Choose between takes in the Mixer: Sound › on this track.');return}
  if(!mineN.length&&song.recMode!=='replace'){H.u.pop();renderUndo();renderAll();return}
  dirty();renderAll();say(song.recMode==='replace'?'Take recorded on '+tr.name+'.':'Recorded '+mineN.length+' note'+(mineN.length===1?'':'s')+' on '+tr.name+'.');
}
function toggleRec(){
  if(T.mic){micStop();return}
  if(T.rec){T.rec=false;if(WR.on)writeRecEnd();else endNoteRec();renderTransport();return}
  const tr=selTr();
  if(tr&&(tr.type==='pan'||tr.type==='part'||tr.type==='drums')&&!PR.cal&&!PR.askTap){PR.askTap=1;savePR();AC();openSheet('timing','first');return}
  if(tr&&tr.type==='audio'&&PR.micLag==null&&!PR.askMic){PR.askMic=1;savePR();AC();openSheet('timing','firstmic');return}
  if(tr.type==='audio'){micStart(tr);return}
  if(tr.type==='part'){if(!AC())return;writeRecStart(tr);return}
  if(tr.type!=='pan'&&tr.type!=='drums'){say('Choose a Mic, Pan taps or Drum kit track to record into, or add one with + Add track.');return}
  if(!AC())return;pushHistory();T.take++;T.recTid=tr.id;T.rec=true;T.mb0=song.minBars;
  if(song.recMode==='take')takeBegin(tr);
  T.recFrom=T.playing?beatNow():T.pos;
  if(!T.playing)play(song.countIn);else renderTransport();
  T.recT=Math.max(ctx.currentTime,T.t0);
  setView('inst');
}
const held=new Map();   // finger → the note it's holding (hold for a roll)
function panDown(e,el){
  e.preventDefault();if(!AC())return;const tr=selTr();
  // My part: the pans play so you can try a line, but notes are written in Write
  if(STEP.on&&!T.playing&&(tr.type==='part'||tr.type==='pan')){const id=el.dataset.field,c=channel(tr);panVoice(c.out,id,ctx.currentTime+.003,.9,false);el.classList.add('hit');stepAdd(tr,id);
    held.set(e.pointerId,{el,n:null,timer:0,rolls:[]});return}
  if(tr.type==='part'){const id=el.dataset.field,c=channel(tr),hv=FEEL.now(id);panVoice(c.out,id,ctx.currentTime+.003,.95*hv,false);el.classList.add('hit');
    const r={el,n:null,timer:0,rolls:[],write:writeTap(tr,id,tapT(e)),t0:ctx.currentTime};
    const go=()=>{panVoice(c.out,id,ctx.currentTime+.003,(.5+Math.random()*.25)*hv,true);r.rolls.push(1);r.timer=setTimeout(go,60+Math.random()*18)};
    r.timer=setTimeout(go,HOLD_MS);held.set(e.pointerId,r);return}
  if(tr.type!=='pan')return;
  // how hard you hit (Pan sounds → Sound → Dynamics) is played and recorded; a roll keeps it
  const id=el.dataset.field,c=channel(tr),hv=FEEL.now(id),v0=+(.95*hv).toFixed(3);panVoice(c.out,id,ctx.currentTime+.003,v0,false);const n=recNote(tr,id,v0,tapT(e));if(n)n.r=0;
  el.classList.add('hit');
  const r={el,n,timer:0,rolls:[]};
  const go=()=>{const v=+((.5+Math.random()*.25)*hv).toFixed(3);panVoice(c.out,id,ctx.currentTime+.003,v,true);const rn=recNote(tr,id,v);if(rn){rn.d=.25;rn.r=1;r.rolls.push(rn)}r.timer=setTimeout(go,60+Math.random()*18)};
  r.timer=setTimeout(go,HOLD_MS);held.set(e.pointerId,r);
}
{let wasTall=null;addEventListener('resize',()=>{const t=tallStage();if(t===wasTall)return;wasTall=t;if(song&&VIEW==='inst'&&selTr().type==='drums')renderInst()})}
function drumDown(e,el){
  e.preventDefault();if(!AC())return;const tr=selTr();if(tr.type!=='drums')return;
  const m=+el.dataset.m,c=channel(tr),rk=realKit(tr),bx=el.getBoundingClientRect();let v=.95;
  // on a drum or cymbal, the middle is a full hit and the edge a softer one
  if(!el.classList.contains('k-blk')&&!el.classList.contains('k-pad')){const dx=(e.clientX-bx.left)/bx.width-.5,dy=(e.clientY-bx.top)/bx.height-.5;v=+(1-.45*Math.min(1,Math.hypot(dx,dy)*2)).toFixed(2)}
  playDrum(m,c.out,ctx.currentTime+.003,v,rk);const n=recNote(tr,m,v,tapT(e));
  el.classList.add('hit');
  const r={el,n,timer:0,rolls:[]};
  const go=()=>{const vv=.45+Math.random()*.25;playDrum(m,c.out,ctx.currentTime+.003,vv,rk);const rn=recNote(tr,m,vv);if(rn){rn.d=.25;r.rolls.push(rn)}r.timer=setTimeout(go,55+Math.random()*15)};
  r.timer=setTimeout(go,HOLD_MS);held.set(e.pointerId,r);
}
function panUp(e){const r=held.get(e.pointerId);if(!r)return;clearTimeout(r.timer);setTimeout(()=>r.el.classList.remove('hit'),90);
  if(r.write!==undefined){held.delete(e.pointerId);const c=r.write;if(c&&r.rolls.length){c.fx='roll';c.duration=+Math.max(.3,ctx.currentTime-r.t0).toFixed(3);partCache=null}return}if(!r.rolls.length)recOff(r.n,tapT(e));else if(r.n)r.n.d=.5;held.delete(e.pointerId)}
window.addEventListener('pointerup',panUp);window.addEventListener('pointercancel',panUp);

/* ---- recording straight into Write: My part's taps become your cues ---- */
// The notes land in Write at their place in the song (tap delay fixed), so they're in your chart, the lanes and the
// game too. Notes hit together make a chord; hold a note to roll it. Undo in Write takes the whole take back.
// Merge adds to your part, but a note already there (the same note, at the same moment) isn't written twice.
// Replace and New take clear your old notes from where you start; when you stop, the ones after that come back,
// so only what you played over is replaced. My part keeps one take: New take works like Replace, and ↶ Undo
// brings the old notes back.
const WR={on:false,last:null,n:0,mine:new Set(),hid:[],from:0};
function writeRecStart(tr){
  if(T.mic)return;pushUndo();pushHistory();if(isDemo){S.cues=[];isDemo=false;try{renderDemo()}catch{}}
  WR.on=true;WR.last=null;WR.n=0;WR.mine=new Set();WR.hid=[];T.take++;T.recTid=tr.id;T.rec=true;T.mb0=song.minBars;
  T.recFrom=T.playing?beatNow():T.pos;
  if(song.recMode==='replace'||song.recMode==='take'){const lp=looping(),a=origin()+(lp?Math.min(T.recFrom,loopS()):T.recFrom)*spb()-.02,b=lp?origin()+loopE()*spb()-.02:Infinity;
    WR.hid=S.cues.filter(c=>c.start>=a&&c.start<b);if(WR.hid.length){S.cues=S.cues.filter(c=>!WR.hid.includes(c));partCache=null}}
  if(!T.playing)play(song.countIn);else renderTransport();
  T.recT=Math.max(ctx.currentTime,T.t0);setView('inst');
}
function writeTap(tr,id,at){
  const when=at!=null?at:tapT(null);
  if(!(WR.on&&T.rec&&T.playing&&tr.id===T.recTid)||when<T.t0-Math.min(.25,cspb()*.4))return null;
  let b=recBeatAt(when);if(song.snapRec&&song.snap!=='off')b=snapBeat(b,+song.snap);
  const t=+(origin()+b*spb()).toFixed(3);if(t<0)return null;
  const last=WR.last;
  if(last&&Math.abs(t-last.start)<.06){if(!last.steps.includes(id)){last.steps.push(id);last.mode='together'}return last}   // hit together: a chord
  if(song.recMode!=='replace'&&song.recMode!=='take'){const tw=S.cues.find(c=>!WR.mine.has(c.id)&&Math.abs(c.start-t)<.09&&c.steps.includes(id));if(tw){WR.last=tw;return null}}   // already there: not twice
  if(last&&t>last.start&&t<last.start+last.duration)last.duration=Math.max(.05,+(t-last.start).toFixed(3));
  const c={id:uid(),start:t,duration:+(spb()*.5).toFixed(3),steps:[id],mode:'together',note:''};
  S.cues.push(c);S.cues.sort((x,y)=>x.start-y.start);WR.last=c;WR.mine.add(c.id);WR.n++;partCache=null;return c;
}
function writeRecEnd(){
  fitBars();
  const n=WR.n,rep=WR.hid.length&&(song.recMode==='replace'||song.recMode==='take');WR.on=false;WR.last=null;T.recTid=null;
  // Replace: the old notes past where you stopped come back (all of the loop stays new if it came round)
  if(WR.hid.length){const to=T.pos,went=(ctx.currentTime-(T.recT||0))/cspb(),lp=looping(),all=lp&&went>=loopE()-loopS()-1e-3;
    const toT=origin()+to*spb()-.02,back=WR.hid.filter(c=>all?false:lp&&to<T.recFrom?(c.start>=toT&&c.start<origin()+T.recFrom*spb()-.02):c.start>=toT);
    if(!n){S.cues=S.cues.concat(WR.hid)}else S.cues=S.cues.concat(back);S.cues.sort((x,y)=>x.start-y.start);WR.hid=[];partCache=null}
  if(!n&&H.u.length){H.u.pop();renderUndo()}
  try{normalizeChords()}catch{}save();try{renderCues()}catch{}partCache=null;renderAll();
  say(n?n+' note'+(n===1?'':'s')+(rep?' replaced what was there':' went into your part')+'. They\'re on your chart and in the game too. (↶ Undo takes them back.)':'Nothing was played.');
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
  if(SPD.rate!==1){say('Mic takes record at full speed: set ⏩ Speed back to 1× first.');return}
  if(micBusy)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){say("The microphone isn't available here. Open Panyard from your home screen or in Chrome.");return}
  if(!AC())return;micBusy=true;
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
  catch{micBusy=false;say("Panyard can't use the microphone. Allow it in your browser or phone settings, then try again.");return}
  if(T.playing)stop(false);
  const cap=await capture(stream);micBusy=false;
  pushHistory();T.mic={tr,cap,stream};T.rec=true;T.recTid=tr.id;T.noCyc=true;T.mb0=song.minBars;
  play(song.countIn);setView('inst');
}
async function micStop(){
  fitBars();
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
  T.pos=startB;dirty();renderAll();say('Recorded '+buf.duration.toFixed(1)+' s on '+m.tr.name+'.'+(PR.micLag==null?' Tip: do ⋯ → ⏱ Timing fix → Measure once on this phone, so mic takes land right on the beat.':''));
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
  offs.sort((a,b)=>a-b);const ms=Math.round(Math.max(-100,Math.min(350,offs[Math.floor(offs.length/2)]*1000)));S.tapLag=ms/1000;PR.latency=ms;PR.cal=1;savePR();save();try{renderGrid()}catch{}
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
// each step keeps the tracks, your part (My part's notes are your cues) and the song's pan, so ↶ Undo takes back any of them
const snapNow=()=>JSON.stringify({s:song,c:S.cues,ps:setKey()});
function pushHistory(){H.u.push(snapNow());if(H.u.length>60)H.u.shift();H.r=[];renderUndo()}
function clearTk(sg){if(sg&&Array.isArray(sg.tracks))for(const t of sg.tracks)if(Array.isArray(t.notes))for(const n of t.notes)if('tk' in n)delete n.tk}
function restore(json){const keep=song.sel,o=JSON.parse(json);song=o&&o.s&&o.s.tracks?o.s:o;
  if(o&&o.ps&&SETS[o.ps]&&o.ps!==setKey()){S.panSet=o.ps;applyPanSet();try{save();renderVoice()}catch{}}
  if(o&&Array.isArray(o.c)&&JSON.stringify(o.c)!==JSON.stringify(S.cues)){S.cues=o.c;partCache=null;try{save();renderCues()}catch{}}if(trById(keep))song.sel=keep;chans.clear();SEL=null;refreshGains();dirty();renderAll()}
function undo(){if(!H.u.length||T.playing&&T.rec)return;H.r.push(snapNow());restore(H.u.pop());renderUndo()}
function redo(){if(!H.r.length||T.playing&&T.rec)return;H.u.push(snapNow());restore(H.r.pop());renderUndo()}
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
  const tracks=st.tracks.filter(t=>t&&['practice','part','pan','beats','drums'].includes(t.type)).slice(0,24).map(t=>{
    const o=trk(t.type,{...(typeof t.role==='string'?{role:t.role.slice(0,20)}:{}),...(typeof t.song==='boolean'?{song:t.song}:{}),name:String(t.name||'').slice(0,28)||trk(t.type).name,vol:num(t.vol,0,1.5,.85),pan:num(t.pan,-1,1,0),mute:!!t.mute,solo:!!t.solo,mix:t.mix==null?null:num(t.mix,0,1,null)});
    const cleanN=arr=>(Array.isArray(arr)?arr:[]).filter(n=>n&&PITCH[n.p]&&Number.isFinite(+n.t)&&n.t>=0).slice(0,20000).map(n=>({t:+n.t,d:num(n.d,.02,64,.5),p:n.p,v:num(n.v,0,1,.9),...(n.roll?{roll:1}:{})}));
    if(t.fx&&typeof t.fx==='object')o.fx={treble:num(t.fx.treble,-12,12,0),bass:num(t.fx.bass,-12,12,0),comp:num(t.fx.comp,0,1,0),echo:num(t.fx.echo,0,.6,0),echoT:ECHOES[t.fx.echoT]?t.fx.echoT:'q',room:ROOMS.some(r=>r[0]===+t.fx.room)?+t.fx.room:0,...(t.fx.own!==undefined?{own:!!t.fx.own}:{})};
    if(t.type==='pan'){o.panSet=SETS[t.panSet]?t.panSet:'guitar';o.notes=cleanN(t.notes);if(t.chart)o.chart=true;if(typeof t.chartText==='string')o.chartText=t.chartText.slice(0,40000);
      if(t.q&&QNT[t.q.mode])o.q={mode:t.q.mode,div:[1,.5,.25].includes(+t.q.div)?+t.q.div:.5,sw:t.q.sw==='heavy'?'heavy':'light'};
      if(Number.isInteger(t.tp)&&t.tp&&Math.abs(t.tp)<=24)o.tp=t.tp;
      if(Array.isArray(t.takes)&&t.takes.length>1&&Number.isInteger(t.tk)&&t.takes[t.tk]){o.takes=t.takes.slice(0,50).map((k,i)=>({name:String(k&&k.name||'Take '+(i+1)).slice(0,28),notes:i===t.tk?null:cleanN(k&&k.notes)}));o.tk=Math.min(t.tk,o.takes.length-1)}}
    if(t.type==='drums'){o.kit=KITS[t.kit]?t.kit:'rusty';o.notes=(Array.isArray(t.notes)?t.notes:[]).filter(n=>n&&Number.isInteger(+n.p)&&+n.p>=27&&+n.p<=94&&Number.isFinite(+n.t)&&n.t>=0).slice(0,20000).map(n=>({t:+n.t,d:num(n.d,.02,64,.25),p:+n.p,v:num(n.v,0,1,.9)}))}
    if(t.type==='beats'){if(t.kit==='synth'||KITS[t.kit])o.kit=t.kit;o.len=Number.isInteger(t.len)&&t.len>=1&&t.len<=64?t.len:16;o.unit=Number.isInteger(t.unit)&&t.unit>=1&&t.unit<=32?t.unit:8;o.swing=num(t.swing,0,.75,0);o.off=(Array.isArray(t.off)?t.off:[]).filter(Number.isInteger);if(typeof t.style==='string')o.style=t.style.slice(0,30);
      o.rows=(Array.isArray(t.rows)?t.rows:[]).filter(r=>r&&Number.isFinite(+r.m)&&Array.isArray(r.steps)).slice(0,16).map(r=>({m:+r.m,steps:r.steps.slice(0,o.len).map(v=>num(v,0,2,0))}))}
    if(t.st&&typeof t.st==='object')o.st={x:num(t.st.x,0,1,.5),y:num(t.st.y,0,1,.5),n:Math.round(num(t.st.n,1,12,1))};
    return o});
  if(!tracks.some(t=>t.type==='practice'))tracks.unshift(trk('practice'));
  const C=st.click&&typeof st.click==='object'?st.click:{};
  const sg=Object.assign(blank(),{click:{sound:CLICKS.some(c=>c[0]===C.sound)?C.sound:CK0.sound,level:num(C.level,0,1,CK0.level),bars:C.bars===2?2:1,visual:C.visual!==false,recOnly:!!C.recOnly},recMode:['add','replace','take'].includes(st.recMode)?st.recMode:'add',bpm:num(st.bpm,30,300,100),metro:!!st.metro,countIn:st.countIn!==false,master:num(st.master,0,1.5,.85),minBars:num(st.minBars,1,999,8),tracks,sel:tracks[0].id});
  if(Array.isArray(st.secs)){const ok=st.secs.filter(x=>x&&typeof x.name==='string'&&Number.isInteger(+x.a)&&Number.isInteger(+x.b)&&+x.a>=0&&+x.b>+x.a).slice(0,64);
    if(ok.length){sg.secs=ok.map(x=>({name:x.name.slice(0,30),a:+x.a,b:+x.b,en:num(x.en,1,5,3)}));if(typeof st.tpl==='string')sg.tpl=st.tpl.slice(0,12)}}
  if(st.band)sg.band=true;
  if(st.stage&&['judges','middle','off'].includes(st.stage.hear))sg.stage={hear:st.stage.hear};
  if(st.cycle&&Number.isFinite(+st.cycle.s)&&Number.isFinite(+st.cycle.e))sg.cycle={on:!!st.cycle.on,s:+st.cycle.s,e:+st.cycle.e};
  if(T.playing)stop(false);await idbPut('studio:'+keyNow(),sg);song=null;songKey=null;
  return ' '+(tracks.length-1)+' Studio tracks added.';
};
/* ---- arrangement charts: a pan track can show on the Chart as its own part ---- */
// its notes (as they play: quantized and transposed) become cues at their place in the song, notes together a chord
function partCues(tr){
  const sp=spb(),o=origin(),out=[];let last=null;
  for(const n of pnotes(tr)){const t=+(o+n.t*sp).toFixed(3);if(t<0)continue;
    if(last&&Math.abs(t-last.start)<.03){if(!last.steps.includes(n.p))last.steps.push(n.p);continue}
    last={id:'pt'+out.length,start:t,duration:+Math.max(.05,n.d*sp).toFixed(3),steps:[n.p],mode:'together',note:''};out.push(last)}
  return out;
}
function chartParts(){
  if(!song)return[];
  return song.tracks.filter(t=>t.type==='pan'&&t.chart).map(t=>({id:t.id,name:t.name,panSet:trSet(t),cues:partCues(t),text:typeof t.chartText==='string'?t.chartText:null}));
}
const songGeo=()=>({spb:spb(),bpb:BPB(),origin:origin(),bars:bars()});
/* the arrangement for the Chart tab: the song's sections, and each pan in the song with its notes as cues.
   Drums and the engine room are left off. A section that's note-for-note the same as an earlier one says so. */
const PAN_RANK=k=>({tenor:0,dten:.5,dsec:1,guitar:2,fcello:3,tcello:3,six:5,seven:5}[k]??4);
function arrangementData(){
  if(!song)return null;const ss=ownSecs(),bpb=BPB();
  const trs=song.tracks.filter(t=>t.type==='pan'&&(zoneOn()?inSong(t):(t.notes||[]).length)).sort((x,y)=>PAN_RANK(trSet(x))-PAN_RANK(trSet(y)));
  if(!ss.length||!trs.length)return null;
  const sig=x=>trs.map(t=>pnotes(t).filter(n=>n.t>=x.a*bpb-1e-6&&n.t<x.b*bpb-1e-6).map(n=>(n.t-x.a*bpb).toFixed(2)+':'+n.p).join(',')).join('|')+'#'+(x.b-x.a);
  const sigs=ss.map(sig);
  return{title:(typeof S!=='undefined'&&S.title)||(typeof curName==='string'&&curName)||'My song',bpm:bpm(),
    secs:ss.map((x,i)=>{const j=sigs[i].replace(/[|#\d]/g,'')?sigs.findIndex(g=>g===sigs[i]):-1;return{name:x.name,a:x.a,b:x.b,same:j>=0&&j<i?j:-1}}),
    tracks:trs.map(t=>({id:t.id,name:SETS[trSet(t)]?SETS[trSet(t)].name:t.name,role:t.role||'',panSet:trSet(t),cues:partCues(t)})),geo:songGeo()};
}
function setPartText(id,text){const tr=trById(id);if(!tr)return;if(text==null)delete tr.chartText;else tr.chartText=String(text).slice(0,40000);dirty()}
async function load(){
  const k=keyNow();if(song&&songKey===k)return;
  if(loading)return loading;
  loading=(async()=>{
    if(T.playing)stop(false);
    songKey=k;const saved=await idbGet('studio:'+k);
    song=saved&&Array.isArray(saved.tracks)?saved:blank();
    clearTk(song);
    if(!song.tracks.some(t=>t.type==='practice'))song.tracks.unshift(trk('practice'));
    song.tracks.forEach(t=>{if(t.type==='beats'&&!Array.isArray(t.off))t.off=[];if(t.type==='part'&&t.name==='My part (Write)')t.name='My part'});   // Write is part of Studio now
    chans.clear();H.u=[];H.r=[];SEL=null;T.pos=0;
    AC();
    for(const tr of song.tracks)if(tr.type==='audio'&&tr.take&&!buffers[tr.take]){
      const b=await idbGet('stake:'+tr.take);if(b instanceof Blob)try{buffers[tr.take]=await decode(b)}catch{}}
  })().finally(()=>{loading=null});
  return loading;
}
async function practiceLoad(){
  if(!hasAudio||!curBlob||curName==='Example tones'||curName==='Your part'){pBuf=null;   // your part (no recording) isn't a recording
    pKey='';pPeaks=null;return}
  const k=curName+'|'+curBlob.size;if(k===pKey&&pBuf)return;
  pKey=k;try{pBuf=await decode(curBlob);pPeaks=peaksOf(pBuf)}catch{pBuf=null;pPeaks=null}
}

/* ---- the screen ---- */
let SEL=null;   // selected bars on one track: {tid,anchor,a,b}, b exclusive
let SELMORE=false;   // the edit bar's More row is open
const zoomPx=()=>Math.round((innerWidth<560?64:92)*(PR.zoom||1));
const HDW=()=>innerWidth<560?112:150;
const KIND={practice:'Your recording',audio:'Mic / audio',pan:'Pan taps',part:'My part · linked to Write',beats:'Beat',drums:'Drum kit'};
const ICON={practice:'♪',audio:'🎙',pan:'◉',part:'✎',beats:'▦',drums:'🥁'};
// a pan track shows a little drawing of its pans (one for the tenor, six for the bass) and a short name, so you can
// tell them apart in the narrow track column; a name you gave it yourself stays as you wrote it
const SHORT={tenor:'Tenor',dten:'Dbl Tenor',guitar:'Guitar',dsec:'Seconds',fcello:'Cello',tcello:'3 Cello',six:'Bass',seven:'7 Bass'};
const trIcon=tr=>tr.type==='pan'&&SETS[tr.panSet]&&typeof HOME!=='undefined'?'<span class="st-ic st-icpan" aria-hidden="true">'+HOME.mini(tr.panSet,28)+'</span>':'<span class="st-ic" aria-hidden="true">'+ICON[tr.type]+'</span>';
const trName=tr=>tr.type==='pan'&&SETS[tr.panSet]&&tr.name===SETS[tr.panSet].name&&SHORT[tr.panSet]?SHORT[tr.panSet]:tr.name;
function renderTransport(){
  const p=q('#stPlay'),r=q('#stRec');if(!p)return;
  p.textContent=T.playing?'■':'▶';p.setAttribute('aria-label',T.playing?'Stop':'Play');
  r.setAttribute('aria-pressed',String(T.rec));r.classList.toggle('live',T.rec);
  q('#stMetro').setAttribute('aria-pressed',String(!!song.metro));q('#stCount').setAttribute('aria-pressed',String(song.countIn!==false));q('#stLoop').setAttribute('aria-pressed',String(cycOn()));
  q('#stTempo').textContent=(+bpm().toFixed(1))+' bpm'+(SPD.rate===1?'':' · '+speedLab());
  document.body.classList.toggle('st-recording',T.rec);
  updatePlayhead();
}
/* ---- song templates: a band's arrangement laid out as named sections, with a track for each layer of the band ----
   [section name, bars, energy 1–5]; the energy is what the beat dice will follow */
const TEMPLATES=[
  {id:'pano',name:'Panorama, full',feel:'The whole journey: variations, jam, minor, recap',bpm:128,style:'engine',
   secs:[['Intro',8,3],['Verse',16,3],['Chorus',16,4],['Bridge',16,3],['Variation',32,4],['Jam',32,5],['Key change and bass solo',16,3],['Minor',24,2],['Recap',32,5],['Ending',8,5]]},
  {id:'panop',name:'Panorama, practice',feel:'A shorter panorama to learn the shape',bpm:128,style:'engine',
   secs:[['Intro',8,3],['Verse',16,3],['Chorus',16,4],['Variation',16,4],['Jam',16,5],['Recap',16,5],['Ending',4,5]]},
  {id:'road',name:'Road march',feel:'Soca for the road: verses, builds and big choruses',bpm:155,style:'roadmarch',
   secs:[['Intro',8,3],['Verse 1',16,3],['Build',8,4],['Chorus',16,5],['Verse 2',16,3],['Build 2',8,4],['Chorus 2',16,5],['Breakdown',8,2],['Last chorus',32,5],['Outro',8,4]]},
  {id:'calypso',name:'Calypso',feel:'Four verses, each with its chorus',bpm:112,style:'calypso',
   secs:[['Intro',8,3],['Verse 1',16,2],['Chorus',8,4],['Verse 2',16,2],['Chorus 2',8,4],['Verse 3',16,2],['Chorus 3',8,4],['Verse 4',16,2],['Last chorus',8,4],['Ending',4,4]]},
  {id:'bomb',name:'Bomb tune',feel:'Any song (pop, a film theme) at calypso tempo, for J\'Ouvert',bpm:120,style:'calypso',
   secs:[['Intro',4,3],['Theme A',16,3],['Theme B',16,4],['Jam',16,5],['Theme A again',16,4],['Ending',4,5]]},
  {id:'jam',name:'Jam loop',feel:'One 8-bar loop to practise over',bpm:140,style:'panorama',loop:true,secs:[['Jam',8,4]]}];
const tplBars=tp=>tp.secs.reduce((n,x)=>n+x[1],0);
const tplTime=tp=>{const sec=Math.round(tplBars(tp)*4*60/tp.bpm);return Math.floor(sec/60)+' min '+String(sec%60).padStart(2,'0')+' s'};
const LAYERS=[['Front line','tenor'],['Middle','guitar'],['Bass','six']];
function applyTemplate(id){
  const tp=TEMPLATES.find(x=>x.id===id);if(!tp)return;pushHistory();
  let a=0;song.secs=tp.secs.map(([name,n,en])=>{const x={name,a,b:a+n,en};a+=n;return x});
  song.minBars=Math.max(8,a);song.tpl=tp.id;
  // the song's own track for each layer of the band; the tracks you already have stay as your takes
  for(const [role,set] of LAYERS){if(!SETS[set]||song.tracks.some(t=>t.role===role&&inSong(t)))continue;
    const t=trk('pan',{panSet:set,role,song:true});t.name=role+' · '+SETS[set].name;song.tracks.push(t)}
  const st=STYLES[tp.style],eng=song.tracks.find(t=>t.role==='Engine room');
  if(eng&&eng.type==='beats')Object.assign(eng,{rows:styleRows(st),len:st.len,swing:st.swing,unit:st.unit,style:tp.style});
  else if(!eng){const t=trk('beats',{role:'Engine room'});Object.assign(t,{rows:styleRows(st),len:st.len,swing:st.swing,unit:st.unit,style:tp.style});t.name='Engine room · '+st.name;song.tracks.push(t)}
  song.cycle=tp.loop?{on:true,s:0,e:a}:song.cycle&&{...song.cycle,on:false};
  const kept=!!pBuf;if(!kept)setTempo(tp.bpm);   // with your recording loaded, its tempo stays
  dirty();closeSheet();setView('tracks');renderAll();AC()&&warmDrums();
  say(tp.name+': '+tp.secs.length+' section'+(tp.secs.length===1?'':'s')+' over '+a+' bars, with front line, middle, bass and engine room tracks.'+(kept?' Your recording sets the tempo, so it stays at '+Math.round(bpm())+' bpm.':''));
}
/* whole sections, for the whole band: duplicate one (everything after it moves along) or delete one (everything closes up) */
function shiftFrom(atBar,dBars){
  const at=atBar*BPB(),d=dBars*BPB();
  for(const tr of song.tracks){if(!songZone(tr))continue;
    if((tr.type==='pan'||tr.type==='drums')&&tr.notes)tr.notes.forEach(n=>{if(n.t>=at-1e-6)n.t=+(n.t+d).toFixed(3)});
    if(tr.type==='beats'&&tr.off)tr.off=tr.off.map(b=>b>=atBar?b+dBars:b);
    if(tr.type==='audio'&&tr.take&&tr.start>=at-1e-6)tr.start=+(tr.start+d).toFixed(4);
  }
  song.secs.forEach(x=>{if(x.a>=atBar){x.a+=dBars;x.b+=dBars}});
}
function secOp(op,i){
  const x=song.secs&&song.secs[i];if(!x)return;const n=x.b-x.a,A=x.a*BPB(),B=x.b*BPB(),bpb=BPB();
  const fixed=zoneOn()?' Your takes stay where they are.':pBuf||song.tracks.some(t=>t.type==='part'&&notesOf(t).length)?' Your recording and My part stay where they are.':'';
  if(op==='ren'){const v=prompt('Name this section',x.name);if(v==null||!v.trim())return;pushHistory();x.name=v.trim().slice(0,30);dirty();renderAll();return}
  pushHistory();
  if(op==='dup'){
    const copies=[];for(const tr of song.tracks)if(songZone(tr)&&(tr.type==='pan'||tr.type==='drums')&&tr.notes)for(const nt of tr.notes)if(nt.t>=A-1e-6&&nt.t<B-1e-6)copies.push([tr,{...nt,t:+(nt.t+n*bpb).toFixed(3)}]);
    const offs=song.tracks.filter(t=>songZone(t)&&t.type==='beats'&&t.off).map(t=>[t,t.off.filter(b=>b>=x.a&&b<x.b).map(b=>b+n)]);
    shiftFrom(x.b,n);copies.forEach(([tr,nt])=>tr.notes.push(nt));offs.forEach(([t,o])=>{t.off=[...new Set(t.off.concat(o))].sort((p,q)=>p-q)});
    song.secs.splice(i+1,0,{...x,a:x.b,b:x.b+n,name:/ again$/.test(x.name)?x.name:x.name+' again'});song.minBars=(song.minBars||8)+n;
    song.tracks.forEach(t=>t.notes&&t.notes.sort((p,q)=>p.t-q.t));
    say('Copied '+x.name+' ('+n+' bars) right after it, for every track.'+fixed);
  }else if(op==='up'||op==='down'){
    const j=op==='up'?i-1:i+1;if(j<0||j>=song.secs.length){H.u.pop();say(op==='up'?'That\'s already the first section.':'That\'s already the last section.');return}
    const P=song.secs[Math.min(i,j)],Q=song.secs[Math.max(i,j)];if(P.b!==Q.a){H.u.pop();say('Those sections aren\'t side by side.');return}
    const lp=P.b-P.a,lq=Q.b-Q.a,pa=P.a*bpb,pb=P.b*bpb,qb=Q.b*bpb;
    for(const tr of song.tracks){if(!songZone(tr))continue;
      if((tr.type==='pan'||tr.type==='drums')&&tr.notes){tr.notes.forEach(m=>{if(m.t>=pa-1e-6&&m.t<pb-1e-6)m.t=+(m.t+lq*bpb).toFixed(3);else if(m.t>=pb-1e-6&&m.t<qb-1e-6)m.t=+(m.t-lp*bpb).toFixed(3)});tr.notes.sort((u,v)=>u.t-v.t)}
      if(tr.type==='beats'&&tr.off)tr.off=tr.off.map(b=>b>=P.a&&b<P.b?b+lq:b>=Q.a&&b<Q.b?b-lp:b).sort((u,v)=>u-v)}
    const a0=P.a;Q.a=a0;Q.b=a0+lq;P.a=Q.b;P.b=P.a+lp;song.secs.splice(Math.min(i,j),2,Q,P);
    const mv=song.secs[j];song.cycle={on:true,s:mv.a,e:mv.b};restartIfPlaying();
    say('Moved '+x.name+(op==='up'?' earlier.':' later.')+fixed);
  }else if(op==='del'){
    if(song.secs.length===1){H.u.pop();say('That\'s the only section. Pick a new template to start over.');return}
    for(const tr of song.tracks)if(songZone(tr)&&(tr.type==='pan'||tr.type==='drums')&&tr.notes)tr.notes=tr.notes.filter(nt=>!(nt.t>=A-1e-6&&nt.t<B-1e-6));
    song.tracks.forEach(t=>{if(songZone(t)&&t.type==='beats'&&t.off)t.off=t.off.filter(b=>b<x.a||b>=x.b)});
    song.secs.splice(i,1);shiftFrom(x.b,-n);song.minBars=Math.max(8,(song.minBars||8)-n);
    if(song.cycle)song.cycle.on=false;
    say('Deleted '+x.name+' and closed the gap. Undo brings it back.'+fixed);
  }
  dirty();renderAll();
}
/* ---- Add to…: send the bars you picked into a section of your arrangement ----
   The notes are copied (your take stays where it is), and replace what that track had in the section. */
const ownSecs=()=>song.secs&&song.secs.length?song.secs:sections().map(s=>({name:s.name,a:Math.max(0,Math.round(s.a/BPB())),b:Math.max(1,Math.round(s.b/BPB())),en:3})).filter(x=>x.b>x.a);
const addSrc=(a,b)=>{const A=a*BPB(),B=b*BPB();return song.tracks.filter(t=>(t.type==='pan'||t.type==='drums'||t.type==='part')&&notesOf(t).some(n=>n.t>=A&&n.t<B))};
// My part's notes as a pan track's: a roll's quick strikes are marked the way a recorded roll is
const asPan=n=>{const o={t:n.t,d:n.d,p:n.p,v:n.v};if(n.roll)o.r=1;return o};
const LAYER_OF={tenor:'Front line',dten:'Front line',dsec:'Front line',guitar:'Middle',fcello:'Middle',tcello:'Middle',six:'Bass',seven:'Bass'};
function songTwin(tr){
  if(tr.type==='part')tr={type:'pan',panSet:setKey(),vol:tr.vol,pan:tr.pan,fx:tr.fx};   // My part goes onto the song's track for its pan
  if(inSong(tr))return tr;
  let t=song.tracks.find(x=>inSong(x)&&x.type===tr.type&&(tr.type!=='pan'||x.panSet===tr.panSet));
  if(!t){const role=tr.type==='drums'?'Drums':LAYER_OF[tr.panSet]||(SETS[tr.panSet]?SETS[tr.panSet].name:'Pans');
    t=trk(tr.type,{song:true,role,...(tr.type==='pan'?{panSet:tr.panSet}:{}),...(tr.kit?{kit:tr.kit}:{}),vol:tr.vol,pan:tr.pan,...(tr.fx?{fx:{...tr.fx}}:{}),...(tr.tp?{tp:tr.tp}:{})});
    t.name=role+(tr.type==='pan'&&SETS[tr.panSet]?' · '+SETS[tr.panSet].name:'');song.tracks.push(t)}
  return t;
}
function addTracks(){const ad=SH.add,me=trById(ad.tid);if(ad.scope==='all'){const all=addSrc(ad.a,ad.b).filter(t=>!zoneOn()||!me||inSong(t)===inSong(me));if(me&&!all.includes(me))all.unshift(me);return all}return me?[me]:[]}
function addTo(target){
  const ad=SH.add;if(!ad)return;const bpb=BPB(),L=ad.b-ad.a,trs=addTracks();if(!trs.length)return;
  pushHistory();if(!song.secs||!song.secs.length)song.secs=ownSecs().map(x=>({...x}));
  let x;
  if(target==='new'){const v=prompt('Name the new section (it goes at the end of the song)','Section '+(song.secs.length+1));if(v==null||!v.trim()){H.u.pop();return}
    const end=song.secs.length?Math.max(...song.secs.map(z=>z.b)):bars();x={name:v.trim().slice(0,30),a:end,b:end+Math.max(1,Math.ceil(L-1e-6)),en:3};song.secs.push(x)}
  else{x=song.secs[+target];if(!x){H.u.pop();return}}
  const XA=x.a*bpb,XB=x.b*bpb,SA=ad.a*bpb,SB=ad.b*bpb;let put=0;
  const into=[];
  for(const st of trs){
    const src=st.type==='part'?notesOf(st).filter(n=>n.t>=SA&&n.t<SB).map(asPan):st.notes.filter(n=>n.t>=SA&&n.t<SB).map(n=>({...n})),tr=songTwin(st);if(!into.includes(tr))into.push(tr);
    tr.notes=tr.notes||[];tr.notes=tr.notes.filter(n=>!(n.t>=XA&&n.t<XB));
    for(let k=0;x.a+k*L<x.b;k++){const off=XA-SA+k*L*bpb;for(const n of src){const t=+(n.t+off).toFixed(3);if(t<XB){tr.notes.push({...n,t});put++}}if(ad.fill==='once')break}
    tr.notes.sort((p,q2)=>p.t-q2.t)}
  song.minBars=Math.max(song.minBars||8,x.b);   // your pick stays picked, so it can go into more sections
  
  dirty();closeSheet();seek(XA);renderAll();
  const times=ad.fill==='once'?1:Math.ceil((x.b-x.a)/L-1e-6);
  say('Put '+lenLab(L)+' into '+x.name+(times>1?' (×'+times+')':'')+' on '+(into.length===1?into[0].name:into.length+' song tracks')+'. Undo takes it back.');
}
/* ---- the arrangement: one row per track, one box per section, lit where there's something playing ---- */
const ARR_T=t=>['pan','drums','beats','part'].includes(t.type)&&(!zoneOn()||inSong(t));
function arrCell(tr,x){
  const bpb=BPB(),n=x.b-x.a;
  if(tr.type==='beats'){const off=new Set(tr.off||[]);let on=0;for(let b=x.a;b<x.b;b++)if(!off.has(b))on++;return{kind:'beat',fill:on/n,notes:0}}
  const ns=notesOf(tr).filter(m=>m.t>=x.a*bpb&&m.t<x.b*bpb),used=new Set(ns.map(m=>Math.floor(m.t/bpb)));
  return{kind:'notes',fill:used.size/n,notes:ns.length}
}
function arrHTML(){
  const ss=ownSecs(),trs=song.tracks.filter(ARR_T),sel=SH.arr||{},cyc=cycOn()?song.cycle:null;
  if(!ss.length)return '<p class="help">Your song has no sections yet. Start from a template (⋯ → New song from a template), or pick some bars on a track and use ＋ Add to… → New section.</p>';
  if(!trs.length)return '<p class="help">Add a pan or drum track first (+ Track).</p>';
  let h='<div class="st-arr" style="--n:'+ss.length+'"><div class="st-arrg" role="grid" aria-label="Arrangement"><span class="st-arrc0"></span>'
    +ss.map((x,i)=>{const on=cyc&&cyc.s===x.a&&cyc.e===x.b;return '<button class="st-arrh'+(on?' on':'')+'" data-st="arrsec" data-v="'+i+'" aria-pressed="'+!!on+'" title="Loop '+esc(x.name)+'"><b>'+esc(x.name)+'</b><small>'+(x.b-x.a)+' bars</small></button>'}).join('');
  for(const tr of trs){
    h+='<span class="st-arrc0'+(tr.mute?' mute':'')+'" title="'+esc(tr.name)+'">'+ICON[tr.type]+' '+esc(tr.name.split(' · ')[0].replace(/ \(Write\)$/,''))+'</span>';
    ss.forEach((x,i)=>{const c=arrCell(tr,x),on=sel.tid===tr.id&&sel.i===i,pct=Math.round(c.fill*100);
      h+='<button class="st-arrb k-'+c.kind+(pct?'':' empty')+(on?' sel':'')+(tr.mute?' mute':'')+'" data-st="arrbox" data-tid="'+tr.id+'" data-v="'+i+'" style="--f:'+pct+'%" aria-label="'+esc(tr.name)+', '+esc(x.name)+': '+(pct?(c.kind==='beat'?'groove playing':c.notes+' notes')+(pct<100?', '+pct+'% of the bars':''):'empty')+'">'+(c.notes?'<i>'+c.notes+'</i>':'')+'</button>'})
  }
  h+='</div></div><div class="st-arrlg"><span><em class="k-notes"></em>Notes</span><span><em class="k-beat"></em>Groove playing</span><span><em class="empty"></em>Empty</span><span>Half lit: only some bars</span></div>';
  // what the tapped box can do
  const tr=sel.tid&&trById(sel.tid),x=tr&&ss[sel.i];
  if(tr&&x){
    const c=arrCell(tr,x),full=c.fill>0,b=(k,l,cls)=>'<button class="btn sm'+(cls?' '+cls:'')+'" data-st="arrdo" data-v="'+k+'">'+l+'</button>',noteT=tr.type==='pan'||tr.type==='drums';
    const st=tr.type==='beats'?(full?'the groove plays in '+Math.round(c.fill*(x.b-x.a))+' of '+(x.b-x.a)+' bars':'the groove is silenced here'):(full?c.notes+' note'+(c.notes===1?'':'s')+(c.fill<1?', in '+Math.round(c.fill*(x.b-x.a))+' of '+(x.b-x.a)+' bars':''):'empty');
    h+='<div class="st-arrdet"><p><b>'+esc(tr.name)+' · '+esc(x.name)+'</b>: '+st+'.</p><div class="row">'
      +b('loop','⟲ Loop it')+b('play','▶ Play from here')+b('solo',tr.solo?'Solo off':'Solo this track')
      +(full||tr.type==='part'?b('show','Show on tracks'):'')
      +(!full&&noteT?b('rec','● Record here'):'')
      +(noteT?b('from','Copy from…'):'')
      +(tr.type==='beats'?b(full?'silence':'unsilence',full?'Silence the groove here':'Play the groove here'):'')
      +(full&&noteT?b('clear','Clear','danger'):'')
      +'</div>';
    if(SH.arrFrom&&noteT){const src=ss.map((y,j)=>[y,j,arrCell(tr,y)]).filter(([y,j,cc])=>j!==sel.i&&cc.notes);
      h+='<div class="st-arrfrom"><p class="help">Copy '+esc(tr.name)+' from which section into '+esc(x.name)+'? It repeats to fill and replaces what\'s there.</p>'+(src.length?src.map(([y,j,cc])=>'<button class="chip" data-st="arrcopy" data-v="'+j+'">'+esc(y.name)+' · '+cc.notes+' notes</button>').join(''):'<p class="help">No other section has notes on this track yet.</p>')+'</div>'}
    h+='</div>';
  }else h+='<p class="help st-arrtip">Tap a box to loop it, play from it, record into it or copy into it. Tap a section name to loop the whole band there.</p>';
  return h;
}
const arrKeep=fn=>{const bx=q('#stSheet .sheetbox'),y=bx?bx.scrollTop:0,ax=q('.st-arr'),x=ax?ax.scrollLeft:0;fn();const b2=q('#stSheet .sheetbox'),a2=q('.st-arr');if(b2)b2.scrollTop=y;if(a2)a2.scrollLeft=x};
function arrDo(k){
  const sel=SH.arr||{},tr=trById(sel.tid),ss=ownSecs(),x=ss[sel.i];if(!tr||!x)return;const bpb=BPB();
  const loopIt=()=>{song.cycle={on:true,s:x.a,e:x.b};restartIfPlaying();renderTransport();renderSecs()};
  if(k==='loop'){pushHistory();loopIt();dirty();say('Looping '+x.name+'.')}
  else if(k==='play'){seek(x.a*bpb);if(!T.playing)play(false)}
  else if(k==='solo'){pushHistory();tr.solo=!tr.solo;refreshGains();dirty()}
  else if(k==='show'||k==='rec'){song.sel=tr.id;SEL={tid:tr.id,anchor:x.a,a:x.a,b:x.b};if(k==='rec'){pushHistory();loopIt()}seek(x.a*bpb);dirty();closeSheet();setView(k==='rec'?'inst':'tracks');
    requestAnimationFrame(()=>{const tl=q('#stTl');if(tl)tl.scrollLeft=Math.max(0,x.a*zoomPx()-40)});
    if(k==='rec')say(x.name+' is looping on '+tr.name+'. Tap ● to record into it.');return}
  else if(k==='from'){SH.arrFrom=!SH.arrFrom}
  else if(k==='clear'){pushHistory();const n=tr.notes.length;tr.notes=tr.notes.filter(m=>!(m.t>=x.a*bpb&&m.t<x.b*bpb));dirty();say('Cleared '+(n-tr.notes.length)+' notes from '+x.name+'. Undo brings them back.')}
  else if(k==='silence'||k==='unsilence'){pushHistory();const off=new Set(tr.off||[]);for(let b=x.a;b<x.b;b++)k==='silence'?off.add(b):off.delete(b);tr.off=[...off].sort((p,q2)=>p-q2);dirty();restartIfPlaying()}
  arrKeep(()=>{renderSheet();renderTimeline()});
}
/* the Song tab's bar: the tools for the section you're looping, or adding sections and the band recording */
function renderSongBar(){
  const el=q('#stSongBar');if(!el||!song)return;el.hidden=VIEW!=='song';if(el.hidden)return;
  const ss=ownSecs(),cyc=cycOn()?song.cycle:null,i=cyc?ss.findIndex(x=>x.a===cyc.s&&x.b===cyc.e):-1,b=(k,l,v,cls)=>'<button class="btn sm'+(cls?' '+cls:'')+'" data-st="'+k+'"'+(v!=null?' data-v="'+v+'"':'')+'>'+l+'</button>';
  let h;
  if(i>=0){const x=ss[i];h='<b class="st-sbn">⟲ '+esc(x.name)+'</b>'+b('songplay','▶ From here',i)+b('songfill','＋ Fill from takes…',i,'st-addto')+b('secup','◀ Move',i)+b('secdown','Move ▶',i)+b('secdup','⧉ Duplicate',i)+b('secren','✎ Rename',i)+b('secdel','✕ Delete',i,'danger')
    +'<button class="btn sm" data-sec="'+x.a+','+x.b+'" aria-label="Stop looping">Loop off</button>'}
  else h='<span class="st-sbh">'+(ss.length?'Tap a section to loop it and see its tools.':'Add a section to start your song.')+'</span>'+b('songadd','＋ Section')+b('songgrid','▦ Grid')
    +'<button class="btn sm'+(song.band?' on':'')+'" data-st="songband" aria-pressed="'+!!song.band+'">'+(song.band?'♪ Band recording on':'♪ Band recording off')+'</button>';
  if(el.dataset.h!==h){el.dataset.h=h;el.innerHTML=h}
}
function sections(){
  if(song&&Array.isArray(song.secs)&&song.secs.length)return song.secs.map(x=>({name:x.name,a:x.a*BPB(),b:x.b*BPB(),en:x.en}));
  if(typeof sectionsNow!=='function')return[];
  return sectionsNow().map(s=>({name:s.name,a:(s.t-origin())/spb(),b:(s.end-origin())/spb()}));
}
function renderSecs(){renderSongBar();
  const el=q('#stSecs'),ss=sections();el.hidden=!ss.length;if(!ss.length)return;
  const own=!!(song.secs&&song.secs.length);let pick=-1;
  el.innerHTML='<span class="help">'+(own?'Sections':'Loop')+'</span>'+ss.map((s,i)=>{const a=Math.max(0,Math.floor(s.a/BPB()+.02)),b=Math.max(a+1,Math.ceil(s.b/BPB()-.02)),on=cycOn()&&song.cycle.s===a&&song.cycle.e===b;if(on)pick=i;
    return '<button class="chip'+(on?' on':'')+'" data-sec="'+a+','+b+'" aria-pressed="'+on+'">'+esc(s.name)+'</button>'}).join('')
    +(own&&pick>=0&&!zoneOn()&&VIEW!=='song'?'<span class="st-sectools" role="group" data-name="'+esc(ss[pick].name)+':" aria-label="'+esc(ss[pick].name)+', for the whole band"><button class="chip" data-st="secup" data-v="'+pick+'" aria-label="Move this section earlier">◀ Move</button><button class="chip" data-st="secdown" data-v="'+pick+'" aria-label="Move this section later">Move ▶</button><button class="chip" data-st="secdup" data-v="'+pick+'">⧉ Duplicate</button><button class="chip" data-st="secren" data-v="'+pick+'">✎ Rename</button><button class="chip" data-st="secdel" data-v="'+pick+'">✕ Delete</button></span>':'');
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
  if(!regs.length)return tr.id!==song.sel?'':'<div class="st-empty">'+(tr.type==='practice'?'Add your recording in Setup':tr.type==='audio'?'● Rec, or import a file':tr.type==='beats'?'Tap steps below to make a beat':tr.type==='drums'?'● Rec, then play the kit':'● Rec, then tap the pans')+'</div>';
  return regs.map(([s,e])=>{
    let inner='';
    if(tr.type==='practice'||tr.type==='audio')inner='<canvas data-peaks="'+tr.id+'" width="'+Math.max(1,Math.round((e-s)*bar))+'" height="64"></canvas>';
    else if(tr.type==='drums'){for(const n of tr.notes)if(n.t>=s*BPB()&&n.t<e*BPB()){const rw=DRUM_ROW(+n.p);inner+='<i style="background:'+ROW_COL[rw]+';left:'+((n.t-s*BPB())*beat).toFixed(1)+'px;top:'+(14+rw*7.5).toFixed(1)+'px;width:'+Math.max(2,beat/4-2).toFixed(1)+'px;height:5px"></i>'}}
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
  // count lines through every track, finer as you zoom in (like GarageBand): bars, then beats, then ½ and ¼ beats
  const bt=bar/BPB(),gl=(bt>=9?' gb':'')+(bt/2>=TICK_PX?' g2':'')+(bt/4>=TICK_PX?' g4':'');
  let h='<div class="st-inner'+gl+'" style="--hdw:'+hd+'px;--bar:'+bar+'px;--bt:'+bt+'px;width:'+(hd+W)+'px">';
  // the corner of the timeline holds + Track and zoom, so the tracks get the whole screen
  h+='<div class="st-row st-ruler"><div class="st-hd st-corner"><button class="st-addt" data-st="addsheet" aria-label="Add a track">+ Track</button><span class="st-zm"><button data-st="zout" aria-label="Zoom out">−</button><button data-st="zin" aria-label="Zoom in">+</button></span></div><div class="st-lane" id="stRuler" style="width:'+W+'px">';
  if(song.cycle&&song.cycle.e>song.cycle.s)h+='<span class="st-cyc'+(cycOn()?'':' off')+'" style="left:'+song.cycle.s*bar+'px;width:'+(song.cycle.e-song.cycle.s)*bar+'px"></span>';
  h+=rulerHTML(bar,n);
  {const zs=zoomStep(),bt=bar/BPB();if(zs<1){h+='<span class="st-tk st-tk1" style="--tk:'+bt+'px"></span>';if(zs<=1/(2*BPB()))h+='<span class="st-tk st-tk2" style="--tk:'+bt/2+'px"></span>';if(zs<=1/(4*BPB()))h+='<span class="st-tk st-tk4" style="--tk:'+bt/4+'px"></span>'}}
  for(const s of sections())if(s.a<n*BPB()){const A=Math.max(0,Math.floor(s.a/BPB()+.02)),B=Math.max(A+1,Math.ceil(s.b/BPB()-.02)),on=cycOn()&&song.cycle.s===A&&song.cycle.e===B;h+='<button class="st-secl'+(on?' on':'')+'" data-sec="'+A+','+B+'" aria-pressed="'+on+'" aria-label="Loop '+esc(s.name)+'" style="left:'+Math.max(0,s.a/BPB()*bar)+'px;max-width:'+Math.max(24,(s.b-s.a)/BPB()*bar-4)+'px">'+esc(s.name)+'</button>'}
  h+='</div></div>';
  const zones=zoneOn(),songV=VIEW==='song',order=songV?song.tracks.filter(t=>zones&&inSong(t)):zones?song.tracks.filter(t=>!inSong(t)):song.tracks;
  let firstSong=songV;
  if(songV&&!order.length)order.push(null);
  for(const tr of order){
    if(firstSong){firstSong=false;
      const ss=ownSecs(),lay=song.tracks.filter(t=>inSong(t)&&ARR_T(t)),cyc=cycOn()?song.cycle:null;
      h+='<div class="st-row st-zone st-zsong"><div class="st-hd"><span class="st-zt"><b>Song</b><small>'+ss.length+' section'+(ss.length===1?'':'s')+'</small></span></div><div class="st-lane" style="width:'+W+'px">'
        +ss.map(x=>{const on=cyc&&cyc.s===x.a&&cyc.e===x.b;return '<button class="st-songb'+(on?' on':'')+'" data-sec="'+x.a+','+x.b+'" aria-pressed="'+!!on+'" aria-label="Loop '+esc(x.name)+'" style="left:'+(x.a*bar+1)+'px;width:'+Math.max(20,(x.b-x.a)*bar-3)+'px"><b>'+esc(x.name)+'</b><span class="st-stripes">'
          +lay.map(t=>'<i class="'+(arrCell(t,x).fill>0?'f k-'+t.type:'')+'" title="'+esc(t.name)+'"></i>').join('')+'</span></button>'}).join('')
        +(ss.length?'':'<span class="st-zhint">No sections yet: tap ＋ Section, or ⋯ → New song from a template.</span>')+'</div></div>'}
    if(!tr){h+='<div class="st-row st-zone"><div class="st-hd"></div><div class="st-lane" style="width:'+W+'px"><span class="st-zhint">The song\'s own tracks show here. Start from a template, or pick bars on a take and ＋ Add to… a section.</span></div></div>';continue}
    const sel=tr.id===song.sel;
    h+='<div class="st-row k-'+tr.type+(zoneMuted(tr)?' zmuted':'')+(sel?' sel':'')+(!hasContent(tr)?' empty':'')+'" data-tid="'+tr.id+'"><div class="st-hd"><button class="st-name" data-st="pick" aria-pressed="'+sel+'">'+trIcon(tr)+'<span>'+esc(trName(tr))+'</span></button>'
      +'<span class="st-ms"><button class="m" data-st="mute" aria-pressed="'+tr.mute+'" aria-label="Mute '+esc(tr.name)+'">M</button><button class="s" data-st="solo" aria-pressed="'+tr.solo+'" aria-label="Solo '+esc(tr.name)+'">S</button><button class="g" data-st="tset" aria-label="Settings for '+esc(tr.name)+'">⚙</button></span></div>'
      +'<div class="st-lane" data-st="lane" style="width:'+W+'px">'+regionsHTML(tr,bar)+(SEL&&SEL.tid===tr.id?'<span class="st-bsel" id="stBsel" style="left:'+SEL.a*bar+'px;width:'+(SEL.b-SEL.a)*bar+'px"><span class="st-hdl l" data-hdl="a" aria-hidden="true"></span><span class="st-hdl r" data-hdl="b" aria-hidden="true"></span></span>':'')+'</div></div>';
  }
  h+='<div class="st-ph" id="stPh" style="left:'+hd+'px"></div></div>';
  tl.innerHTML=h;tl.scrollLeft=keep[0];tl.scrollTop=keep[1];
  tl.querySelectorAll('canvas[data-peaks]').forEach(c=>drawPeaks(c,trById(c.dataset.peaks)));
  const sb=q('#stSel');sb.innerHTML=SEL?selBarHTML():'';sb.hidden=!SEL||VIEW==='inst';if(!SEL)SELMORE=false;placeSel();renderSongBar();
  updatePlayhead();
}
// the ruler's numbers follow the zoom: every bar (every 2nd or 4th when zoomed far out), then each beat (1.2, 1.3…),
// then each ¼ beat (1.2.2…) when there's room for them
function rulerHTML(bar,n){
  const B=BPB(),bt=bar/B,every=bar>=28?1:bar>=14?2:4;let h='';
  for(let b=0;b<n;b++){
    if(b%every===0)h+='<span class="st-barn" style="left:'+b*bar+'px">'+(b+1)+'</span>';
    if(bt>=30)for(let k=0;k<B;k++){
      if(k)h+='<span class="st-btn" style="left:'+(b*bar+k*bt)+'px">'+(b+1)+'.'+(k+1)+'</span>';
      if(bt/4>=34)for(let j=1;j<4;j++)h+='<span class="st-btn st-btq" style="left:'+(b*bar+(k+j/4)*bt)+'px">'+(b+1)+'.'+(k+1)+'.'+(j+1)+'</span>'}}
  return h;
}
const PH={w:0,sl:0,t:0};
function updatePlayhead(){
  if(!song)return;const b=heardNow(),pos=q('#stPos');if(pos){const s=(Math.floor(b/BPB())+1)+'.'+(Math.floor(b%BPB())+1);if(pos.textContent!==s)pos.textContent=s}
  const ph=q('#stPh'),tl=q('#stTl');if(!ph)return;const hd=HDW(),x=b*zoomPx()/BPB();
  if(ph.style.left!==hd+'px')ph.style.left=hd+'px';ph.style.transform='translateX('+x.toFixed(1)+'px)';
  if(T.playing){const now=performance.now();if(!PH.w||now-PH.t>1000){PH.w=tl.clientWidth;PH.sl=tl.scrollLeft;PH.t=now}
    const vis=PH.w-hd;if(x<PH.sl||x>PH.sl+vis-24){PH.sl=Math.max(0,x-40);tl.scrollLeft=PH.sl}}
  else PH.w=0;
}
// while it plays, the chosen track's notes light up on the pans
let litKey='';
function lightPans(){
  const box=q('#stPans');let ids=[];
  if(box&&T.playing&&VIEW==='inst'){const tr=selTr();if(isPanish(tr)){const b=heardNow();for(const n of pnotes(tr))if(n.t<=b+.02&&b<n.t+Math.max(.22,Math.min(n.d,1)))ids.push(n.p)}}
  const k=ids.join();if(k===litKey)return;litKey=k;if(!box)return;const on=new Set(ids);
  box.querySelectorAll('.field').forEach(f=>f.classList.toggle('play-hit',on.has(f.dataset.field)));
}
let litDrums='';
function lightDrums(){
  const box=q('#stKit');if(!box)return;let ms=[];
  if(T.playing&&VIEW==='inst'){const tr=selTr();if(tr.type==='drums'){const b=heardNow();for(const n of tr.notes)if(n.t<=b+.02&&b<n.t+.18)ms.push(+n.p)}}
  const k=ms.join();if(k===litDrums)return;litDrums=k;const on=new Set(ms);
  box.querySelectorAll('.st-dp').forEach(d=>d.classList.toggle('play-hit',on.has(+d.dataset.m)));
}
// the visual count-in (big 1 2 3 4 over the pans) and a flash on the bar counter with every beat
let visB=null;
function beatVis(){
  let el=q('#stCountVis');if(!el){el=document.createElement('div');el.id='stCountVis';el.setAttribute('aria-hidden','true');document.body.appendChild(el)}
  let show='',acc=false;
  const hT=ctx?ctx.currentTime-spkLag():0;
  if(T.playing&&ctx&&T.cin&&ck().visual&&hT<T.t0){const left=(T.t0-hT)/cspb(),k=T.cin-Math.ceil(left-1e-6);if(k>=0){show=String(k%BPB()+1);acc=k%BPB()===0}}
  if(show&&!el.dataset.n){const pans=q('#stPans');const r=pans&&pans.offsetParent?pans.getBoundingClientRect():null;
    el.style.left=r?(r.left+r.width/2)+'px':'50%';el.style.top=r?(r.top+Math.min(r.height,innerHeight-r.top)/2)+'px':'52%'}
  if(el.dataset.n!==show){el.dataset.n=show;el.textContent=show;el.classList.toggle('on',!!show);el.classList.toggle('acc',acc);if(show){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}}
  const lcd=document.querySelector('.st-lcd');
  if(lcd){const b=T.playing&&ctx&&hT>=T.t0?Math.floor(heardNow()+1e-6):null;
    if(b!==visB){visB=b;if(b!==null&&song.metro){lcd.classList.remove('tick','tick1');void lcd.offsetWidth;lcd.classList.add(b%BPB()===0?'tick1':'tick')}}}
}
// Write: Studio with My part on the pans (made if the song doesn't have it yet)
async function writePart(){
  if(document.body.dataset.view!=='studio')showView('studio');await load();if(!song)return;
  let tr=song.tracks.find(t=>t.type==='part');if(!tr){tr=trk('part');song.tracks.push(tr);dirty()}
  song.sel=tr.id;setView('inst');renderAll();try{GB.sync()}catch{}
}
/* ---- Coming up: the next notes of the track on the pans, as it plays (from Write). Tap one to go there.
   ✚ Step (Write's Build a cue): stopped, each pan you tap goes in at the playhead (tap several for a chord), and
   → moves on by the snap amount (¼ beat with Snap off). ---- */
const STEP={on:false};
const stepLen=()=>song.snap&&song.snap!=='off'?+song.snap:.5;
// where a note is, the way the ruler counts: 3.2 is bar 3, beat 2; 3.2½ is half a beat after it
const bbLab=b=>{const x=b+1e-6,f=x%1,fr=f<.002?'':Math.abs(f-.5)<.01?'½':Math.abs(f-.25)<.01?'¼':Math.abs(f-.75)<.01?'¾':'+';return (Math.floor(x/BPB())+1)+'.'+(Math.floor(x%BPB())+1)+fr};
let nextKey='';
function nextTick(){
  const box=q('#stNext'),inst=q('#stInst');if(!box||!inst||!inst.offsetParent)return;const tr=selTr();if(!tr||!isPanish(tr))return;
  if(!box.querySelector('.st-nxl'))nextKey='';   // the pans were just redrawn
  const ns=pnotes(tr).filter(n=>!n.roll),b=heardNow(),G=[];
  for(const n of ns){const g=G[G.length-1];if(g&&Math.abs(g.t-n.t)<.06){if(!g.ids.includes(n.p))g.ids.push(n.p);g.d=Math.max(g.d,n.d)}else G.push({t:n.t,d:n.d,ids:[n.p]})}
  let i=G.findIndex(g=>g.t+Math.min(g.d,1)>b-.02);if(i<0)i=G.length;
  const now=G[i]&&G[i].t<=b+.02,show=G.slice(i,i+6);
  const key=[i,now,ns.length,STEP.on,T.playing,stepLen(),STEP.on?T.pos:0].join();if(key===nextKey)return;nextKey=key;
  const chips=show.map((g,k)=>'<button class="st-nx'+(k===0&&now?' now':'')+'" data-st="nextat" data-v="'+g.t+'"><b>'+g.ids.map(id=>pname(id).replace(/\d$/,'')).join(' + ')+'</b><i>'+bbLab(g.t)+'</i></button>').join('');
  // the first slot holds the track picker on a sideways phone (Studio's top bar has no room for its name); it stays put
  if(!box.querySelector('.st-nxl'))box.innerHTML='<span class="st-nxp"></span><span class="st-nxh">Coming up</span><div class="st-nxl"></div><span class="st-nxs"></span>';
  box.querySelector('.st-nxl').innerHTML=chips||'<span class="st-nxe">'+(ns.length?'That\'s the last note.':'No notes yet: ● Rec and play, or ✚ Step to put them in one by one.')+'</span>';
  box.querySelector('.st-nxs').innerHTML=(STEP.on?'<button data-st="stepgo" data-v="-1" aria-label="Back">←</button><b>'+bbLab(T.pos)+'</b><button data-st="stepgo" data-v="1" aria-label="Next">→</button>':'')
    +'<button class="st-stepb" data-st="step" aria-pressed="'+STEP.on+'" title="Put notes in one at a time at the playhead">✚ Step</button>';
  try{GB.place()}catch{}
}
// a note put in by hand at the playhead: into your part as a cue (a chord if one is already there), or onto the pan track
function stepAdd(tr,id){
  if(T.playing||!STEP.on)return false;pushHistory();const b=T.pos,len=stepLen();
  if(tr.type==='part'){const t=+(origin()+b*spb()).toFixed(3);if(t<0){H.u.pop();return true}if(isDemo){S.cues=[];isDemo=false;try{renderDemo()}catch{}}
    const c=S.cues.find(x=>Math.abs(x.start-t)<.03);
    if(c){if(c.steps.includes(id)){H.u.pop();return true}c.steps.push(id);c.mode='together'}
    else S.cues.push({id:uid(),start:t,duration:+(len*spb()).toFixed(3),steps:[id],mode:'together',note:''});
    S.cues.sort((x,y)=>x.start-y.start);partCache=null;try{normalizeChords();save();renderCues()}catch{}}
  else{if(tr.notes.some(n=>Math.abs(n.t-b)<.01&&n.p===id)){H.u.pop();return true}tr.notes.push({t:+b.toFixed(3),d:len,p:id,v:.9});tr.notes.sort((x,y)=>x.t-y.t);dirty()}
  nextKey='';return true;
}
{const lp=()=>{if(document.body.dataset.view==='studio'){try{nextTick()}catch(e){}}if(document.body.dataset.view==='studio'||litKey)lightPans();if(document.body.dataset.view==='studio')lightDrums();if(document.body.dataset.view==='studio')beatVis();requestAnimationFrame(lp)};requestAnimationFrame(lp)}
function frame(){if(!T.playing)return;updatePlayhead();if(seqGridOpen())renderSeqNow();if(q('#stSheet')&&!q('#stSheet').hidden&&SH.kind==='mixer')meters();T.raf=requestAnimationFrame(frame)}
/* the edit bar for picked bars floats just above them, pointing at them (like GarageBand). The tools you use most sit in one
   row; the rest are under More. Every tool is the same data-st="r-…" button as before, so regionOp does the work. */
function selBarHTML(){
  const tr=trById(SEL.tid);if(!tr)return '';const whole=Math.abs(SEL.a-Math.round(SEL.a))<1e-6&&Math.abs(SEL.b-Math.round(SEL.b))<1e-6;
  const range=whole?(SEL.b-SEL.a>1?'Bars '+(SEL.a+1)+'–'+SEL.b:'Bar '+(SEL.a+1)):posLab(SEL.a).replace(/^b/,'B')+' · '+lenLab(SEL.b-SEL.a);
  const b=(act,ic,label,cls)=>'<button class="st-fb'+(cls?' '+cls:'')+'" data-st="r-'+act+'"><i aria-hidden="true">'+ic+'</i>'+label+'</button>';
  const m=(act,label)=>'<button class="btn sm" data-st="r-'+act+'">'+label+'</button>';
  const n=isNotey(tr)?' · '+selNotes(tr).filter(x=>!x.roll).length+' notes':'';
  let main=b('loop','⟲','Loop'),more='';
  if(tr.type==='drums'){main+=b('left','◀','Move')+b('right','▶','Move')+b('copy','⧉','Copy after')+b('delete','🗑','Delete','danger');more=m('repeat','Repeat to end')+m('snap','Snap')}
  if(isPanish(tr)){main+=b('left','◀','Move')+b('right','▶','Move')+b('copy','⧉','Copy after')+b('notes','✎','Notes')+b('delete','🗑','Delete','danger');more=m('repeat','Repeat to end')+m('snap','Snap')}
  if(tr.type==='audio'&&tr.take)main+=b('left','◀','Bar')+b('right','▶','Bar')+b('delete','🗑','Remove','danger');
  if(tr.type==='pan'||tr.type==='drums'||tr.type==='part')more='<button class="btn sm st-addto" data-st="r-addto">＋ Add to…</button>'+more;
  if(tr.type==='beats')main=b('silence',(tr.off||[]).includes(SEL.a)?'▶':'🔇',(tr.off||[]).includes(SEL.a)?'Play':'Silence')+main;
  if(more)main+='<button class="st-fb" data-selmore aria-expanded="'+SELMORE+'"><i aria-hidden="true">⋯</i>More</button>';
  return '<div class="st-selin" role="toolbar" aria-label="Edit '+esc(range)+' of '+esc(tr.name)+'">'
    +(more?'<div class="st-selmore"'+(SELMORE?'':' hidden')+'>'+more+'</div>':'')
    +'<span class="st-selinfo"><b>'+range+'</b> · '+esc(tr.name)+n+'<button class="st-selx" data-st="r-close" aria-label="Clear selection">✕</button></span>'
    +'<div class="st-selrow">'+main+'</div><span class="st-selarrow" aria-hidden="true"></span></div>';
}
// keeps the edit bar just above the pick (or just below it when there's no room above), inside the screen
function placeSel(){
  const sb=q('#stSel'),bx=q('#stBsel'),tl=q('#stTl');if(!sb)return;
  if(!SEL||sb.hidden||!bx||!tl||!tl.offsetParent){sb.classList.remove('st-float');return}
  sb.classList.add('st-float');
  const R=bx.getBoundingClientRect(),T=tl.getBoundingClientRect(),hd=HDW(),L=T.left+hd,Rt=T.right,ruler=42;
  const x0=Math.max(R.left,L),x1=Math.min(R.right,Rt),vis=x1>x0+4&&R.bottom>T.top+ruler&&R.top<T.bottom;
  sb.classList.toggle('st-off',!vis);if(!vis)return;
  const w=sb.offsetWidth,h=sb.offsetHeight,mid=(x0+x1)/2,left=Math.max(6,Math.min(innerWidth-w-6,mid-w/2));
  let top=R.top-h-6,below=false;if(top<Math.max(6,T.top+ruler-h*.35)){top=R.bottom+6;below=true}
  top=Math.max(6,Math.min(innerHeight-h-6,top));
  sb.style.left=left+'px';sb.style.top=top+'px';sb.classList.toggle('below',below);
  sb.style.setProperty('--ax',Math.max(16,Math.min(w-16,mid-left))+'px');
}
// the pink handles: drag one to stretch or shrink the pick; it lands on the ruler's ticks
const HDL={on:null};
function hdlDown(e,el){
  const tr=trById(SEL&&SEL.tid);if(!tr)return;e.preventDefault();e.stopPropagation();
  const lane=el.closest('.st-lane'),st=stepOf(tr);HDL.on={k:el.dataset.hdl,lane,st,id:e.pointerId};
  try{el.setPointerCapture(e.pointerId)}catch{}
  el.onpointermove=ev=>{if(!HDL.on)return;const bar=zoomPx(),x=(ev.clientX-lane.getBoundingClientRect().left)/bar,v=r6(Math.round(x/st)*st);
    if(HDL.on.k==='a')SEL.a=r6(Math.max(0,Math.min(SEL.b-st,v)));else SEL.b=r6(Math.min(bars(),Math.max(SEL.a+st,v)));
    SEL.anchor=SEL.a;SEL.st=st;const bx=q('#stBsel');if(bx){bx.style.left=SEL.a*bar+'px';bx.style.width=(SEL.b-SEL.a)*bar+'px'}placeSel()};
  el.onpointerup=el.onpointercancel=()=>{el.onpointermove=el.onpointerup=el.onpointercancel=null;HDL.on=null;renderTimeline()};
}
const SNAPS=[['off','Free'],['0.25','¼ beat'],['0.5','½ beat'],['1','Beat']];
const snapBeat=(t,gq)=>Math.max(0,Math.round(t/gq)*gq);
const gridOf=()=>song.snap&&song.snap!=='off'?+song.snap:.25;
const selNotes=tr=>{const A=SEL.a*BPB(),B=SEL.b*BPB();return notesOf(tr).filter(n=>n.t>=A&&n.t<B)};
function regionOp(op){
  const tr=trById(SEL.tid);if(!tr)return;const len=r6(SEL.b-SEL.a),bpb=BPB(),A=SEL.a*bpb,B=SEL.b*bpb,ST=tr.type==='audio'?1:(SEL.st||1);
  if(op==='close'){SEL=null;renderTimeline();return}
  if(op==='addto'){if(!selNotes(tr).length&&!addSrc(SEL.a,SEL.b).length){say('There are no notes in those bars yet. Record something first.');return}
    SH.add={tid:tr.id,a:SEL.a,b:SEL.b,scope:SH.add&&SH.add.scope||'one',fill:SH.add&&SH.add.fill||'repeat'};openSheet('addto');return}
  if(op==='loop'){pushHistory();song.cycle={on:true,s:SEL.a,e:SEL.b};dirty();restartIfPlaying();renderTimeline();renderTransport();renderSecs();say('Looping '+(Math.abs(SEL.a-Math.round(SEL.a))<1e-6&&Math.abs(SEL.b-Math.round(SEL.b))<1e-6?'bars '+(SEL.a+1)+'–'+SEL.b:posLab(SEL.a)+', '+lenLab(len))+'.');return}
  if(op==='notes'){if(tr.type==='part'){BARS.open({a:origin()+A*spb(),b:origin()+B*spb()-1e-3,grid:true});return}openNotes(tr,Math.floor(SEL.a+1e-6),Math.max(Math.floor(SEL.a+1e-6)+1,Math.ceil(SEL.b-1e-6)));return}
  if(tr.type==='beats'&&op==='silence'){pushHistory();const off=new Set(tr.off||[]),on=off.has(SEL.a);for(let b=SEL.a;b<SEL.b;b++)on?off.delete(b):off.add(b);tr.off=[...off].sort((x,y)=>x-y);dirty();renderTimeline();return}
  if(tr.type==='audio'){
    if(op==='left'||op==='right'){const d=op==='left'?-1:1;if(tr.start+d*bpb<0){say("That's the start of the song.");return}pushHistory();tr.start=+(tr.start+d*bpb).toFixed(4);SEL.a+=d;SEL.b+=d;SEL.anchor+=d}
    else if(op==='delete'){pushHistory();Object.assign(tr,{take:null,dur:0,peaks:null,file:''});SEL=null;say('Removed the take from '+tr.name+'. Undo brings it back.')}
    dirty();renderAll();return;
  }
  if(tr.type==='part'){
    const sa=origin()+A*spb(),sb=origin()+B*spb(),bs=bpb*spb();let msg='';pushHistory();const c0=JSON.stringify(S.cues);
    if(op==='left'||op==='right'){const d=(op==='left'?-1:1)*ST;if(SEL.a+d<-1e-6){say("That's the start of the song.");return}if(BARS.shift(sa,sb,d*bs)){SEL.a=r6(SEL.a+d);SEL.b=r6(SEL.b+d);SEL.anchor=r6(SEL.anchor+d);msg='Moved. Your cues in Write moved too.'}else msg='There are no notes in those bars.'}
    else if(op==='copy'){if(!BARS.copyTo(sa,sb,sb)){say('There are no notes in those bars to copy.');return}SEL={tid:tr.id,anchor:SEL.b,a:SEL.b,b:r6(SEL.b+len),st:SEL.st};msg='Copied, in Write too. The copy is selected.'}
    else if(op==='repeat'){const k=BARS.repeat(sa,sb,origin()+bars()*bs);msg=k?'Repeated to the end of the song ('+k+' time'+(k===1?'':'s')+'), in Write too.':'There are no notes in those bars to repeat.'}
    else if(op==='snap'){const k=BARS.snap(sa,sb,gridOf()*spb());msg=k?'Snapped '+k+' cue'+(k===1?'':'s')+'.':'There are no notes in those bars.'}
    else if(op==='delete'){const k=BARS.del(sa,sb);msg=k?'Deleted '+k+' note'+(k===1?'':'s')+'. ↶ Undo brings them back.':'There are no notes in those bars.'}
    if(JSON.stringify(S.cues)===c0){H.u.pop();renderUndo()}
    renderAll();if(msg)say(msg);return;
  }
  if(tr.type!=='pan'&&tr.type!=='drums')return;
  const inSel=selNotes(tr);
  if(op==='left'||op==='right'){const d=(op==='left'?-1:1)*ST;if(SEL.a+d<-1e-6){say("That's the start of the song.");return}pushHistory();inSel.forEach(n=>{n.t=+(n.t+d*bpb).toFixed(3)});SEL.a=r6(SEL.a+d);SEL.b=r6(SEL.b+d);SEL.anchor=r6(SEL.anchor+d)}
  else if(op==='copy'){if(!inSel.length){say('There are no notes in those bars to copy.');return}pushHistory();inSel.forEach(n=>tr.notes.push({...n,t:+(n.t+len*bpb).toFixed(3)}));SEL={tid:tr.id,anchor:SEL.b,a:SEL.b,b:r6(SEL.b+len),st:SEL.st};song.minBars=Math.max(song.minBars||8,Math.ceil(SEL.b)+1);say('Copied. The copy is selected.')}
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
    const phead=h.slice(headAt);h=h.slice(0,headAt)+'<div class="st-next" id="stNext"></div><div class="pair st-pans'+(order.length===1?' one':'')+'" id="stPans">'+order.map(p=>panSVG(p,true)).join('')+'</div>';
    // the words and buttons live in the Options menu, so the pans keep the room
    const pick='<label class="lab st-setpick">Pan<select data-st-set>'+Object.entries(SETS).map(([k,x])=>'<option value="'+k+'"'+(k===sk?' selected':'')+'>'+x.name+'</option>').join('')+'</select></label>';
    h+='<div class="st-popts" id="stPopts" role="dialog" aria-label="My part options">'+pick+'<p class="help"><b>● Rec</b> and play the pans: every note goes into your part, so it\'s on your chart and in the game too. '+(n?'Your part has '+n+' notes now.':'')+'</p>'
      +'<div class="row"><div class="seg st-mode" role="group" aria-label="Recording"><button data-st="mode" data-v="add" aria-pressed="'+(!song.recMode||song.recMode==='add')+'">Merge</button><button data-st="mode" data-v="replace" aria-pressed="'+(song.recMode==='replace'||song.recMode==='take')+'">Replace</button></div></div>'
      +'<div class="row"><button class="btn primary" data-st="bars">▦ Edit in bars</button><button class="btn" data-st="towrite">The old Write screen</button></div>'
      +'<button class="btn sm" data-st="snaprec" aria-pressed="'+!!song.snapRec+'">'+(song.snapRec?'✓ ':'')+'Snap new notes</button>'
      +'<div class="seg st-snap" role="group" aria-label="Snap to">'+SNAPS.map(([v,l])=>'<button data-st="snap" data-v="'+v+'" aria-pressed="'+((song.snap||'off')===v)+'">'+l+'</button>').join('')+'</div>'
      +'<p class="help">Select bars on its lane to move, copy, repeat, snap or delete them. Undo for your part is in ▦ Edit in bars or in Write.</p>'+phead.replace('st-ihead','st-ihead st-iend')+'</div>';
  }else if(tr.type==='pan'){
    const sk=trSet(tr),views=SETS[sk].views,order=sk==='guitar'&&S.swapped?[views[1],views[0]]:views;
    const pick='<label class="lab st-setpick">Pan<select data-st-set>'+Object.entries(SETS).map(([k,x])=>'<option value="'+k+'"'+(k===sk?' selected':'')+'>'+x.name+'</option>').join('')+'</select></label>';
    const head=h.slice(headAt);h=h.slice(0,headAt)+'<div class="st-next" id="stNext"></div><div class="pair st-pans'+(order.length===1?' one':'')+'" id="stPans">'+order.map(p=>panSVG(p,true)).join('')+'</div>'
      // the pan picker, recording choices and track name live in an Options menu, so the pans keep their room
      +'<div class="st-popts" id="stPopts" role="dialog" aria-label="Pan taps options">'+pick;
    h+='<p class="help">Tap <b>● Rec</b> and play along on the pans. Hold a note to roll. '+(mine('c')||Object.keys(SAMPLES.wav).some(mine)?'Your recorded pan sounds are used.':'Record your own pan sounds in Setup to hear your real pans here.')+'</p>';
    h+='<div class="row"><div class="seg st-mode" role="group" aria-label="Recording"><button data-st="mode" data-v="add" aria-pressed="'+(!song.recMode||song.recMode==='add')+'">Merge</button><button data-st="mode" data-v="replace" aria-pressed="'+(song.recMode==='replace')+'">Replace</button><button data-st="mode" data-v="take" aria-pressed="'+(song.recMode==='take')+'">New take</button></div>'+(tr.takes&&tr.takes.length>1?'<button class="btn sm" data-st="tset">'+esc(tr.takes[tr.tk].name)+' of '+tr.takes.length+' ›</button>':'')
      +'<button class="btn sm" data-st="snaprec" aria-pressed="'+!!song.snapRec+'">'+(song.snapRec?'✓ ':'')+'Snap new notes</button>'
      +'<div class="seg st-snap" role="group" aria-label="Snap to">'+SNAPS.map(([v,l])=>'<button data-st="snap" data-v="'+v+'" aria-pressed="'+((song.snap||'off')===v)+'">'+l+'</button>').join('')+'</div></div>'+head.replace('st-ihead','st-ihead st-iend')+'</div>';
  }else if(tr.type==='drums'){
    const K=KITS[realKit(tr)||'real']||KITS.real,head=h.slice(headAt);
    h=h.slice(0,headAt)+kitHTML(tr)+'<div class="st-popts" id="stPopts" role="dialog" aria-label="Drum kit options">'
      +'<p class="help">Tap <b>● Rec</b> and play the kit. '+(K.lay==='kit'?'Tap the middle of a drum for a full hit, near the edge for a softer one. ':'')+'Hold a drum to roll.</p>'
      +'<div class="row"><button class="btn" data-st="kitsheet">Kit: '+esc(K.name)+' ▾</button></div>'
      +'<div class="row"><div class="seg st-mode" role="group" aria-label="Recording"><button data-st="mode" data-v="add" aria-pressed="'+(!song.recMode||song.recMode==='add')+'">Merge</button><button data-st="mode" data-v="replace" aria-pressed="'+(song.recMode==='replace')+'">Replace</button><button data-st="mode" data-v="take" aria-pressed="'+(song.recMode==='take')+'">New take</button></div>'
      +'<button class="btn sm" data-st="snaprec" aria-pressed="'+!!song.snapRec+'">'+(song.snapRec?'✓ ':'')+'Snap new notes</button>'
      +'<div class="seg st-snap" role="group" aria-label="Snap to">'+SNAPS.map(([v,l])=>'<button data-st="snap" data-v="'+v+'" aria-pressed="'+((song.snap||'off')===v)+'">'+l+'</button>').join('')+'</div></div>'
      +head.replace('st-ihead','st-ihead st-iend')+'</div>';
  }else h+=seqHTML(tr);
  {const ps=document.getElementById('gbPills'),home=q('#gbBar .gbl');if(ps&&home&&el.contains(ps))home.appendChild(ps)}   // the track picker (in the Coming up row) isn't redrawn away with the pans
  el.innerHTML=h;
  requestAnimationFrame(fitPans);
  el.querySelectorAll('#stPans .field').forEach(f=>f.addEventListener('pointerdown',e=>panDown(e,f)));
  el.querySelectorAll('#stKit .st-dp').forEach(f=>f.addEventListener('pointerdown',e=>drumDown(e,f)));
  if(tr.type==='drums'&&realKit(tr))loadKit(realKit(tr));
}
function seqHTML(tr){
  const len=tr.len,lab=n=>BPB()===4?(n/16===1?'1 bar':'2 bars'):(n/4)+' beats';
  let g='<div class="row st-seqtools"><label class="lab">Style<select id="stStyle"><option value="">Choose a style…</option>'+Object.entries(STYLES).map(([k,s])=>'<option value="'+k+'"'+(tr.style===k?' selected':'')+'>'+esc(s.name)+' · '+s.bpm+' bpm</option>').join('')+'</select></label>'
    +'<div class="seg" role="group" aria-label="Pattern length"><button data-st="seqlen" data-v="16" aria-pressed="'+(len===16)+'">'+lab(16)+'</button><button data-st="seqlen" data-v="32" aria-pressed="'+(len===32)+'">'+lab(32)+'</button></div>'
    +'<label class="lab">Swing<input id="stSwing" type="range" min="0" max="1" step=".05" value="'+tr.swing+'"></label>'
    +'<button class="btn sm" data-st="kitsheet">Kit: '+(realKit(tr)?esc(KITS[realKit(tr)].name):'Classic')+' ▾</button></div>';
  g+='<div class="st-seq"><div class="st-grid" id="stGrid" style="grid-template-columns:64px repeat('+len+',minmax(15px,1fr)) 26px;min-width:'+(64+len*18+26)+'px">';
  tr.rows.forEach((row,r)=>{const nm=DRUM_NAME[row.m]||'Sound';g+='<span class="st-seqlab">'+esc(nm)+'</span>';
    for(let i=0;i<len;i++){const v=row.steps[i];g+='<button class="stc'+(i%4===0?' q':'')+(i%16===0&&i?' b2':'')+(v?' on':'')+(v===2?' acc':'')+'" data-r="'+r+'" data-c="'+i+'" aria-label="'+esc(nm)+' step '+(i+1)+(v===2?', accented':'')+'" aria-pressed="'+!!v+'"></button>'}
    g+='<button class="st-x" data-st="rowdel" data-v="'+r+'" aria-label="Remove '+esc(nm)+'">✕</button>'});
  const free=SOUNDS.filter(s=>!tr.rows.some(r=>r.m===s.m));
  return g+'</div></div><div class="row"><label class="lab">Add a sound<select id="stAddRow"><option value="">Choose…</option>'+free.map(s=>'<option value="'+s.m+'">'+esc(s.n)+'</option>').join('')+'</select></label><button class="btn sm" data-st="seqclear">Clear</button></div>'
    +'<p class="help">Tap a step for a hit, again for an accent, again to clear. The pattern repeats through the song; select bars on its lane to silence them (for an intro, say).</p>';
}
const seqGridOpen=()=>!!q('#stGrid');let lastCol=-1;
function renderSeqNow(){const tr=selTr();if(tr.type!=='beats')return;const col=T.playing?((Math.floor(heardNow()*4)%tr.len)+tr.len)%tr.len:-1;if(col===lastCol)return;lastCol=col;
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
const INST_LABEL={practice:'♪ Recording',audio:'🎙 Mic',pan:'◉ Pans',part:'✎ My part',beats:'▦ Beat',drums:'🥁 Drums'};
function setView(v){
  if(v==='song'&&song&&zoneOn()&&!inSong(selTr())){const t=song.tracks.find(x=>inSong(x)&&(x.type==='pan'||x.type==='drums'));if(t){song.sel=t.id;SEL=null}}
  if(v==='tracks'&&song&&zoneOn()&&inSong(selTr())){const t=song.tracks.find(x=>!inSong(x)&&x.type!=='practice')||song.tracks[0];if(t){song.sel=t.id;SEL=null}}
  VIEW=v;document.body.classList.toggle('st-inst',v==='inst');document.body.classList.toggle('st-song',v==='song');document.body.classList.toggle('st-stage',v==='stage');if(v==='stage'){song.tracks.filter(STG_ON).forEach(stPlace);stageWire()}refreshGains();renderViews();window.scrollTo({top:0});if(v==='inst')renderInst();else renderTimeline();renderStage()}
function renderViews(){
  const t=q('#stViews');if(!t||!song)return;const tr=selTr();
  t.querySelector('[data-sv="inst"]').textContent=INST_LABEL[tr.type];
  t.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.sv===VIEW)));
  q('.st-tlp').hidden=VIEW==='inst'||VIEW==='stage';q('#stInst').hidden=VIEW!=='inst';q('#stSel').hidden=VIEW==='inst'||VIEW==='stage'||!SEL;{const sg=q('#stStage');if(sg)sg.hidden=VIEW!=='stage'}
  const tt=t.querySelector('[data-sv="tracks"]');if(tt)tt.textContent=zoneOn()?'☰ Takes':'☰ Tracks';
}
function renderAll(){if(!song||!q('#stTl'))return;renderTransport();renderSecs();renderTimeline();renderInst();renderUndo();renderViews();if(VIEW==='stage')renderStage()}

/* ---- Stage side: the band set up on a stage, like Panorama ----
   Each track is a section of the band (lead tenors at the front by the judges, seconds and double tenors behind
   them, guitars and cellos in the middle, the basses at the back and the sides, the engine room at the back in the
   middle). Drag a section to move it: where it stands is how you hear it from the judges' seat (left or right, near
   or far, more of the yard's ring further back). Sections light up as they play. Tap one to mute, solo, change its
   volume or number of players, or copy it. Kept per track in tr.st={x,y,n} (x left→right, y back→front, 0…1) and the
   listening seat in song.stage.hear ('judges', 'middle' or 'off': the mix as it is). */
const STG_ON=tr=>['pan','part','drums','beats','audio'].includes(tr.type);
const STG_SET=tr=>tr.type==='drums'||tr.type==='beats'?'engine':tr.type==='audio'?'mic':tr.type==='part'?'me':trSet(tr);
const STG_HOME={tenor:[.5,.86,4],dsec:[.72,.66,3],guitar:[.32,.47,3],fcello:[.68,.47,2],tcello:[.5,.5,2],six:[.12,.18,2],seven:[.88,.18,2],dten:[.28,.66,3],engine:[.5,.12,1],mic:[.9,.62,1],me:[.16,.8,1]};
const STG_R={tenor:.82,dsec:.86,guitar:.92,fcello:.98,tcello:.95,six:1.08,seven:1.08,dten:.84,engine:.9,mic:.7,me:.85};
const STG_NAME={tenor:'Tenors',dsec:'Double seconds',guitar:'Guitars',fcello:'Cellos',tcello:'Three cellos',six:'Basses',seven:'Seven bass',dten:'Double tenors',engine:'Engine room',mic:'Mic'};
// a section with no place yet stands where its kind stands on a Panorama stage (the second of a kind beside the first)
function stPlace(tr){
  if(tr.st&&Number.isFinite(tr.st.x))return tr.st;
  const k=STG_SET(tr),h=STG_HOME[k]||[.5,.5,2],same=song.tracks.filter(t=>STG_ON(t)&&STG_SET(t)===k&&t.st&&Number.isFinite(t.st.x)).length;
  const side=same?(same%2?1:-1)*Math.ceil(same/2):0;let x=h[0]+side*.2;if((k==='six'||k==='seven')&&same%2)x=1-h[0];
  tr.st={x:Math.max(.06,Math.min(.94,x)),y:h[1],n:tr.type==='part'?1:h[2]};
  const lh=layHome(stLay(),tr);if(lh){tr.st.x=lh.x;tr.st.y=lh.y}
  return tr.st;
}
const stHear=()=>(song.stage&&song.stage.hear)||'judges';
// how a section sounds from the seat: left or right by where it stands, softer and roomier further away, a little
// louder with more players
function stageMix(tr){
  if(!song||!STG_ON(tr)||stHear()==='off')return null;const p=stPlace(tr),L=stHear()==='middle'?[.5,.5]:[.5,1.12];
  const dx=p.x-L[0],dy=p.y-L[1],d=Math.hypot(dx*1.1,dy);
  return{pan:Math.max(-.85,Math.min(.85,dx*1.7)),gain:Math.max(.4,Math.min(1.25,1/(.55+d*.9)))*(1+.1*Math.min(8,(p.n||1)-1)),wet:Math.min(.4,d*.3)};
}
let STGSEL=null;
/* ---- stage layouts: where the band stands, and the scene round them. A Panorama stage (curtain, spotlights, three
   curved risers), a pan yard (galvanize roof, string lights, the band in a circle round the engine room) and the road
   (the band on a truck in the street). Each has its own place for every section; Layout ▾ moves the band there. ---- */
const LAYOUTS=[['stage','Panorama stage','Risers, curtain and lights: frontline at the front, the basses up at the back'],
  ['yard','Pan yard','Under the galvanize: the band in a circle round the engine room'],
  ['road','On the road','On the truck for the road march: rows along the deck']];
const stLay=()=>{const l=song&&song.stage&&song.stage.layout;return LAYOUTS.some(x=>x[0]===l)?l:'stage'};
// how far down the scene a section's y (0 back … 1 front) sits, and how big things look there (further back, smaller)
const LAY_Y={stage:[.37,.5],yard:[.22,.64],road:[.44,.36]};
const stY=(y,S)=>{const m=LAY_Y[stLay()];return S.H*(m[0]+y*m[1])};
const stDepth=y=>stLay()==='stage'?.74+.3*y:stLay()==='yard'?.8+.24*y:.88+.14*y;
// where each section goes in a layout: the stage keeps STG_HOME; the yard and the road share the band out by rank
function layHome(lay,tr){
  const k=STG_SET(tr),h=STG_HOME[k]||[.5,.5,2];if(lay==='stage')return null;
  const all=song.tracks.filter(STG_ON),rk=t=>{const s=STG_SET(t);return s==='engine'?9:s==='me'?PAN_RANK(trSet(t)):s==='mic'?8:PAN_RANK(s)};
  const pans=all.filter(t=>STG_SET(t)!=='engine').sort((a,b)=>rk(a)-rk(b)),i=pans.indexOf(tr),n=Math.max(1,pans.length);
  if(lay==='yard'){if(k==='engine')return{x:.5,y:.42};const half=Math.max(1,Math.ceil((n-1)/2)),a=Math.PI/2+(i?(i%2?1:-1)*Math.ceil(i/2)*Math.PI/(half+.4):0);return{x:.5+Math.cos(a)*.36,y:.45+Math.sin(a)*.42}}
  // the road: two rows along the deck, frontline nearest the street; the engine room in the middle of the back row
  if(k==='engine')return{x:.08,y:.5};const row=i%2,col=Math.floor(i/2),cols=Math.ceil(n/2);return{x:.18+(col+.5)/cols*.66,y:row?.16:.82}
}
function layApply(lay){
  pushHistory();song.stage={...(song.stage||{}),layout:lay};
  // everyone goes to their place in the new layout, with the same number of players
  const ns=new Map(song.tracks.filter(STG_ON).map(t=>[t.id,t.st&&t.st.n]));song.tracks.filter(STG_ON).forEach(t=>{delete t.st});
  song.tracks.filter(STG_ON).forEach(t=>{const p=stPlace(t);if(ns.get(t.id))p.n=ns.get(t.id)});
  refreshGains();dirty();CAM.z=0;renderStage();say('The band is set up '+(lay==='stage'?'on a Panorama stage':lay==='yard'?'in the pan yard':'on the truck')+'. ↶ Undo puts them back.');
}
// the scene, in stage units: everything behind the band
// ox/ow: where the stage itself sits in a scene drawn wider than it (so zooming out never shows an edge)
function stScene(lay,W,H,u,pre,ox,ow){
  const id=s=>(pre||'sc')+s,X=f=>(ox||0)+(ow||W)*f;let s='<defs>'
    +'<filter id="'+id('gl')+'" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="'+(u*.18).toFixed(1)+'"/></filter>'
    +'<filter id="'+id('bl')+'" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="'+(u*.6).toFixed(1)+'"/></filter>';
  const bow=(y,b,x0,x1)=>{let d='';for(let i=0;i<=24;i++){const x=x0+(x1-x0)*i/24,t=(x-W/2)/(W/2);d+=(i?'L':'M')+x.toFixed(1)+' '+(y+b*(1-t*t)).toFixed(1)}return d};
  const palm=(x,y,sc)=>{let p='<ellipse cx="'+x+'" cy="'+(y+u*.5*sc)+'" rx="'+u*1.1*sc+'" ry="'+u*.35*sc+'" fill="#ffb45a" opacity=".25" filter="url(#'+id('bl')+')"/>'
    +'<path d="M'+(x-u*.45*sc)+' '+(y-u*.1*sc)+'L'+(x+u*.45*sc)+' '+(y-u*.1*sc)+'L'+(x+u*.32*sc)+' '+(y+u*.55*sc)+'L'+(x-u*.32*sc)+' '+(y+u*.55*sc)+'Z" fill="#3a2a1c"/>';
    for(let i=0;i<9;i++){const a=-Math.PI*(.08+.84*i/8),L=u*(1.5+(i%3)*.35)*sc,ex=x+Math.cos(a)*L,ey=y-u*.1*sc+Math.sin(a)*L*.9;
      p+='<path d="M'+x+' '+(y-u*.1*sc)+'Q'+(x+Math.cos(a)*L*.5+Math.sin(a)*u*.25*sc)+' '+(y-u*.1*sc+Math.sin(a)*L*.6-u*.3*sc)+' '+ex+' '+ey+'" fill="none" stroke="'+(i%2?'#2f8a4a':'#1f6b38')+'" stroke-width="'+(u*.22*sc).toFixed(1)+'" stroke-linecap="round"/>'}
    return p};
  if(lay==='stage'){
    s+='<linearGradient id="'+id('fold')+'" x1="0" x2="1"><stop offset="0" stop-color="#050d26"/><stop offset=".35" stop-color="#1a3f9a"/><stop offset=".55" stop-color="#0b1c4c"/><stop offset=".8" stop-color="#16348a"/><stop offset="1" stop-color="#050d26"/></linearGradient>'
      +'<pattern id="'+id('cur')+'" width="'+(u*1.6).toFixed(1)+'" height="10" patternUnits="userSpaceOnUse"><rect width="'+(u*1.6).toFixed(1)+'" height="10" fill="url(#'+id('fold')+')"/></pattern>'
      +'<linearGradient id="'+id('curD')+'" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>'
      +'<linearGradient id="'+id('top')+'" x2="0" y2="1"><stop offset="0" stop-color="#1b2440"/><stop offset="1" stop-color="#2b3655"/></linearGradient>'
      +'<linearGradient id="'+id('face')+'" x2="0" y2="1"><stop offset="0" stop-color="#0d1222"/><stop offset="1" stop-color="#05070e"/></linearGradient>'
      +'<linearGradient id="'+id('aud')+'" x2="0" y2="1"><stop offset="0" stop-color="#05060b" stop-opacity="0"/><stop offset="1" stop-color="#05060b"/></linearGradient>'
      +['#ffb45a','#5b93ff'].map((c,i)=>'<linearGradient id="'+id('beam'+i)+'" x2="0" y2="1"><stop offset="0" stop-color="'+c+'" stop-opacity=".55"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></linearGradient>').join('')+'</defs>';
    s+='<rect width="'+W+'" height="'+H+'" fill="#05070f"/><rect width="'+W+'" height="'+H*.5+'" fill="url(#'+id('cur')+')"/><rect width="'+W+'" height="'+H*.5+'" fill="url(#'+id('curD')+')"/>';
    // the truss and its lights
    const ty=H*.04;s+='<rect x="0" y="'+ty+'" width="'+W+'" height="'+u*.42+'" fill="#1a1c22"/>';
    for(let x=0;x<W;x+=u*.42)s+='<path d="M'+x+' '+ty+'L'+(x+u*.21)+' '+(ty+u*.42)+'L'+(x+u*.42)+' '+ty+'" fill="none" stroke="#3a3e48" stroke-width="1.5"/>';
    const nl=Math.max(5,Math.round(W/(u*4)));
    for(let i=0;i<nl;i++){const x=(i+.5)*W/nl,c=i%2;
      s+='<path d="M'+(x-u*.25)+' '+(ty+u*.6)+'L'+(x+u*.25)+' '+(ty+u*.6)+'L'+(x+u*2.4)+' '+(H*.66)+'L'+(x-u*2.4)+' '+(H*.66)+'Z" fill="url(#'+id('beam'+c)+')" style="mix-blend-mode:screen"/>'
        +'<rect x="'+(x-u*.22)+'" y="'+(ty+u*.2)+'" width="'+u*.44+'" height="'+u*.45+'" rx="'+u*.08+'" fill="#2a2d35"/><circle cx="'+x+'" cy="'+(ty+u*.62)+'" r="'+u*.16+'" fill="'+(c?'#cfe0ff':'#fff1d6')+'"/>'}
    // three curved risers, back to front, each with a glowing front edge
    const tiers=[[H*.33,H*.47,H*.03],[H*.47,H*.65,H*.045],[H*.65,H*.87,H*.06]],face=u*.55;
    tiers.forEach(([yb,yf,b],i)=>{const x0=-W*.02,x1=W*1.02;
      s+='<path d="'+bow(yb,b*.8,x0,x1)+'L'+x1+' '+(yf+b)+bow(yf,b,x1,x0).replace(/^M/,'L')+'Z" fill="url(#'+id('top')+')"/>'
        +'<path d="'+bow(yf,b,x0,x1)+'L'+x1+' '+(yf+face)+bow(yf+face,b,x1,x0).replace(/^M/,'L')+'Z" fill="url(#'+id('face')+')"/>'
        +'<path d="'+bow(yf+1,b,x0,x1)+'" fill="none" stroke="#ffd28a" stroke-width="'+(u*.16).toFixed(1)+'" filter="url(#'+id('gl')+')" opacity=".9"/>'
        +'<path d="'+bow(yf+1,b,x0,x1)+'" fill="none" stroke="#fff3d6" stroke-width="1.2" opacity=".85"/>'});
    s+=palm(X(.04),H*.4,1.1)+palm(X(.96),H*.4,1.1)+palm(X(.02),H*.62,1.3)+palm(X(.98),H*.62,1.3);
    s+='<rect y="'+H*.9+'" width="'+W+'" height="'+H*.1+'" fill="url(#'+id('aud')+')"/>';
    return s;
  }
  if(lay==='yard'){
    s+='<linearGradient id="'+id('sky')+'" x2="0" y2="1"><stop offset="0" stop-color="#03050b"/><stop offset="1" stop-color="#121a2a"/></linearGradient>'
      +'<pattern id="'+id('gal')+'" width="'+(u*.5).toFixed(1)+'" height="10" patternUnits="userSpaceOnUse"><rect width="'+(u*.5).toFixed(1)+'" height="10" fill="#6b7078"/><rect width="'+(u*.18).toFixed(1)+'" height="10" fill="#9aa0a8"/><rect x="'+(u*.18).toFixed(1)+'" width="'+(u*.06).toFixed(1)+'" height="10" fill="#4a4e55"/></pattern>'
      +'<pattern id="'+id('blk')+'" width="'+(u*1.6).toFixed(1)+'" height="'+(u*.8).toFixed(1)+'" patternUnits="userSpaceOnUse"><rect width="'+(u*1.6).toFixed(1)+'" height="'+(u*.8).toFixed(1)+'" fill="#3a332c"/><path d="M0 0H'+(u*1.6).toFixed(1)+'M0 '+(u*.4).toFixed(1)+'H'+(u*1.6).toFixed(1)+'M'+(u*.8).toFixed(1)+' 0V'+(u*.4).toFixed(1)+'M0 '+(u*.4).toFixed(1)+'V'+(u*.8).toFixed(1)+'" stroke="#241f1a" stroke-width="2"/></pattern>'
      +'<radialGradient id="'+id('fl')+'" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#4a4844"/><stop offset=".7" stop-color="#2a2927"/><stop offset="1" stop-color="#151514"/></radialGradient></defs>';
    s+='<rect width="'+W+'" height="'+H+'" fill="url(#'+id('sky')+')"/><rect y="'+H*.1+'" width="'+W+'" height="'+H*.2+'" fill="url(#'+id('blk')+')"/>'
      +(()=>{const bx=X(.36),by=H*.14,bw=X(.64)-X(.36),bh=H*.11,band=(a,b)=>'<path d="M'+(bx+bw*a)+' '+by+'L'+(bx+bw*(a+b))+' '+by+'L'+(bx+bw*(a+b+.3))+' '+(by+bh)+'L'+(bx+bw*(a+.3))+' '+(by+bh)+'Z"';
        return '<rect x="'+bx+'" y="'+by+'" width="'+bw+'" height="'+bh+'" fill="#ce1126"/>'+band(.25,.2)+' fill="#fff"/>'+band(.28,.14)+' fill="#000"/>'})()
      +'<path d="M0 '+H*.3+'L'+W+' '+H*.3+'L'+W+' '+H+'L0 '+H+'Z" fill="url(#'+id('fl')+')"/>';
    for(let i=1;i<6;i++)s+='<path d="M'+W*i/6+' '+H*.3+'L'+(W/2+(W*i/6-W/2)*1.6)+' '+H+'" stroke="#00000033" stroke-width="2"/>';
    s+='<path d="M-'+W*.02+' 0L'+W*1.02+' 0L'+W*1.02+' '+H*.07+'L-'+W*.02+' '+H*.11+'Z" fill="url(#'+id('gal')+')"/>';
    [X(.02),X(.98)].forEach(x=>{s+='<rect x="'+(x-u*.2)+'" y="0" width="'+u*.4+'" height="'+H*.95+'" fill="#2a2c30"/>'});
    for(let j=0;j<3;j++){const y0=H*(.1+j*.06),sag=H*(.07+j*.02);let d='',b='';for(let i=0;i<=20;i++){const x=W*i/20,t=(i/20-.5)*2,y=y0+sag*(1-t*t);d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);if(i%2)b+='<circle cx="'+x.toFixed(1)+'" cy="'+(y+u*.14).toFixed(1)+'" r="'+(u*.11).toFixed(1)+'" fill="#ffe2a0"/>'}
      s+='<path d="'+d+'" fill="none" stroke="#111" stroke-width="1.5"/><g filter="url(#'+id('gl')+')" opacity=".9">'+b+'</g>'+b}
    return s;
  }
  // the road: a street at night and the flatbed truck
  s+='<linearGradient id="'+id('sky')+'" x2="0" y2="1"><stop offset="0" stop-color="#05060d"/><stop offset="1" stop-color="#1a1d2e"/></linearGradient>'
    +'<linearGradient id="'+id('deck')+'" x2="0" y2="1"><stop offset="0" stop-color="#4a3a2a"/><stop offset="1" stop-color="#6b5038"/></linearGradient>'
    +'<pattern id="'+id('plank')+'" width="'+(u*2.2).toFixed(1)+'" height="'+(u*.5).toFixed(1)+'" patternUnits="userSpaceOnUse"><path d="M0 '+(u*.5).toFixed(1)+'H'+(u*2.2).toFixed(1)+'M'+(u*1.1).toFixed(1)+' 0V'+(u*.5).toFixed(1)+'" stroke="#2c2016" stroke-width="1.5"/></pattern></defs>';
  s+='<rect width="'+W+'" height="'+H+'" fill="url(#'+id('sky')+')"/>';
  for(let i=0;i<9;i++){const x=W*i/9,bw=W/9*.92,bh=H*(.12+((i*37)%5)*.03);s+='<rect x="'+x+'" y="'+(H*.3-bh)+'" width="'+bw+'" height="'+bh+'" fill="#0e1018"/>';
    for(let r=0;r<3;r++)for(let c=0;c<3;c++)if((i+r*3+c)%3)s+='<rect x="'+(x+bw*(.15+c*.28))+'" y="'+(H*.3-bh+bh*(.15+r*.27))+'" width="'+bw*.14+'" height="'+bh*.12+'" fill="#ffd27a" opacity="'+(.25+((i+r+c)%3)*.2)+'"/>'}
  s+='<rect y="'+H*.3+'" width="'+W+'" height="'+H*.7+'" fill="#17181c"/><rect y="'+H*.3+'" width="'+W+'" height="'+H*.04+'" fill="#2a2b30"/>';
  for(let x=0;x<W;x+=u*3)s+='<rect x="'+x+'" y="'+H*.92+'" width="'+u*1.5+'" height="'+u*.2+'" fill="#e8d36a" opacity=".6"/>';
  [X(.12),X(.5),X(.88)].forEach(x=>{s+='<rect x="'+(x-u*.08)+'" y="'+H*.06+'" width="'+u*.16+'" height="'+H*.26+'" fill="#2a2c33"/><ellipse cx="'+x+'" cy="'+H*.07+'" rx="'+u*1.6+'" ry="'+u*.9+'" fill="#ffd89a" opacity=".35" filter="url(#'+id('bl')+')"/><circle cx="'+x+'" cy="'+H*.07+'" r="'+u*.22+'" fill="#fff2cc"/>'});
  // the truck: the deck, its rails and wheels, a speaker stack at the back and the cab at the front
  const x0=X(.03),x1=X(.86),y0=H*.4,y1=H*.83;
  s+='<rect x="'+x0+'" y="'+(y1)+'" width="'+(x1-x0)+'" height="'+u*.7+'" fill="#20232a"/>';
  [.1,.22,.7,.82].forEach(f=>{const x=x0+(x1-x0)*f;s+='<circle cx="'+x+'" cy="'+(y1+u*.8)+'" r="'+u*.75+'" fill="#0b0b0d" stroke="#3a3c42" stroke-width="3"/>'});
  s+='<rect x="'+x0+'" y="'+y0+'" width="'+(x1-x0)+'" height="'+(y1-y0)+'" fill="url(#'+id('deck')+')"/><rect x="'+x0+'" y="'+y0+'" width="'+(x1-x0)+'" height="'+(y1-y0)+'" fill="url(#'+id('plank')+')"/>'
    +'<rect x="'+x0+'" y="'+(y1-u*.1)+'" width="'+(x1-x0)+'" height="'+u*.25+'" fill="#c8ccd4"/><rect x="'+x0+'" y="'+(y0-u*.1)+'" width="'+(x1-x0)+'" height="'+u*.18+'" fill="#9a9ea6"/>';
  for(let x=x0;x<=x1;x+=u*1.6)s+='<rect x="'+(x-u*.06)+'" y="'+(y1-u*.9)+'" width="'+u*.12+'" height="'+u*.9+'" fill="#c8ccd4" opacity=".8"/>';
  s+='<rect x="'+(x1+u*.3)+'" y="'+(y0+H*.05)+'" width="'+(X(.97)-x1-u*.3)+'" height="'+(y1-y0-H*.02)+'" rx="'+u*.5+'" fill="#7a1018"/><rect x="'+(x1+u*.8)+'" y="'+(y0+H*.09)+'" width="'+(X(.97)-x1-u*1.4)+'" height="'+H*.12+'" rx="'+u*.3+'" fill="#9fc3e6" opacity=".55"/>'
    +'<rect x="'+(x0+u*.2)+'" y="'+(y0-H*.16)+'" width="'+u*2.2+'" height="'+H*.16+'" fill="#111"/><circle cx="'+(x0+u*1.3)+'" cy="'+(y0-H*.11)+'" r="'+u*.6+'" fill="#2a2a2e" stroke="#555"/><circle cx="'+(x0+u*1.3)+'" cy="'+(y0-H*.04)+'" r="'+u*.45+'" fill="#2a2a2e" stroke="#555"/>';
  return s;
}

/* ---- the stage: every player with their own set of pans, on a stage that fills the screen. Pinch (or + / −) to zoom,
   drag the floor to look round, drag a section to move it, hold a player's pans and drag to move just that player. ---- */
// each player's set: where their drums stand (in drum radii, left/right and back/front), how big, how long the skirts
const RIG={
  tenor:{r:1,sk:.18,p:[[0,0]]},
  dten:{r:.92,sk:.25,p:[[-1,0],[1,0]]},
  dsec:{r:.95,sk:.3,p:[[-1,0],[1,0]]},
  guitar:{r:1.02,sk:.5,p:[[-1.05,0],[1.05,0]]},
  fcello:{r:.92,sk:.58,p:[[-1.45,-.35],[-.5,-.75],[.5,-.75],[1.45,-.35]]},
  six:{r:1,sk:1.1,p:[[-2.2,.15],[-1.55,-.9],[-.5,-1.35],[.6,-1.35],[1.65,-.9],[2.25,.15]]},
  tcello:{r:.95,sk:.55,p:[[-1.1,-.15],[0,-.75],[1.1,-.15]]},
  seven:{r:.95,sk:1.1,p:[[-2.5,.35],[-2.05,-.7],[-1.15,-1.35],[0,-1.55],[1.15,-1.35],[2.05,-.7],[2.5,.35]]}
};
const rigOf=k=>RIG[k]||RIG.tenor;
const rigHW=k=>Math.max(...rigOf(k).p.map(q=>Math.abs(q[0])))*1.02+1;   // half a set's width, in drum radii
// the stage's own size: wide when the phone is sideways, tall when it's upright (a section's x/y is a share of it)
// (its shape follows the floor on screen, so the whole band fills it when you fit it)
let STA=0;
const STW=()=>{const land=innerWidth>innerHeight,a=STA||(land?.5:1.45);return land?{W:1000,H:Math.round(1000*Math.max(.36,Math.min(.9,a)))}:{W:620,H:Math.round(620*Math.max(1,Math.min(2,a)))}};
const stU=()=>{const s=STW();return s.W>s.H?s.W/40:s.W/24};
// where each player of a section stands (stage units), front rows last so they cover the ones behind
function stPlayers(tr){
  const S=STW(),p=stPlace(tr),k=STG_SET(tr),pk=k==='me'?trSet(tr):k,n=Math.max(1,Math.min(12,p.n||1)),cy=stY(p.y,S),dp=stDepth(p.y);let cx=p.x*S.W;
  if(k==='engine'||k==='mic'){const r=stU()*(k==='mic'?.7:.9)*dp,out=[];for(let i=0;i<n;i++){const o=(p.pp&&p.pp[i])||[0,0];out.push({i,x:cx+(i-(n-1)/2)*r*2.3+o[0]*S.W,y:cy+o[1]*S.H,r,k,pk})}return{list:out,cx,cy,r,top:cy-r}}
  const R=rigOf(pk),r=stU()*(STG_R[k]||.9)*R.r*(n>6?.88:1)*dp,w=(2*rigHW(pk)+.4)*r,h=(R.p.length>4?3.4:R.p.length>2?2.2:1.45)*r;
  const per=Math.max(1,Math.min(n,Math.floor(S.W*.62/w)||1,R.p.length>4?2:R.p.length>2?3:4)),rows=Math.ceil(n/per),list=[];
  {const half=(per*w)/2+r*.3;cx=Math.max(half,Math.min(S.W-half,cx))}   // the whole set stays on the stage
  for(let j=0;j<rows;j++){const cnt=Math.min(per,n-j*per);for(let i=0;i<cnt;i++){const ix=j*per+i,o=(p.pp&&p.pp[ix])||[0,0];list.push({i:ix,x:cx+(i-(cnt-1)/2)*w+(j%2?w*.15:0)+o[0]*S.W,y:cy+(j-(rows-1)/2)*h+o[1]*S.H,r,k,pk})}}
  return{list,cx,cy,r,top:cy-(rows-1)/2*h-r*(R.p.length>4?1.6:1)};
}
// a chrome pan: its skirt, and (for the shorter ones) the stand it hangs in; basses stand on the floor
function stDrum(x,y,r,sk){
  const sh=r*sk*1.6,stand=sk<.9,leg=stand?r*.85:0,fy=y+sh+r*.5+leg;
  let s='<ellipse cx="'+x+'" cy="'+(fy+r*.05)+'" rx="'+r*.95+'" ry="'+r*.17+'" fill="#000" opacity=".5"/>';
  if(stand)s+='<path d="M'+(x-r*.55)+' '+(y+sh+r*.3)+'L'+(x-r*.85)+' '+fy+'M'+(x+r*.55)+' '+(y+sh+r*.3)+'L'+(x+r*.85)+' '+fy+'M'+x+' '+(y+sh+r*.45)+'L'+x+' '+(fy-r*.05)+'M'+(x-r*.72)+' '+(fy-leg*.35)+'L'+(x+r*.72)+' '+(fy-leg*.35)+'" stroke="#8d939c" stroke-width="'+Math.max(1.2,r*.07).toFixed(1)+'" stroke-linecap="round" fill="none"/>';
  return s+'<path d="M'+(x-r)+' '+y+' V'+(y+sh)+' A'+r+' '+r*.5+' 0 0 0 '+(x+r)+' '+(y+sh)+' V'+y+' Z" fill="url(#stgSk)"/>'
   +'<ellipse class="stg-face" cx="'+x+'" cy="'+y+'" rx="'+r+'" ry="'+r*.5+'" fill="url(#stgCh)"/>'
   +'<ellipse cx="'+x+'" cy="'+y+'" rx="'+r*.8+'" ry="'+r*.38+'" fill="none" stroke="#5d626b" stroke-opacity=".55" stroke-width="'+Math.max(.8,r*.04).toFixed(1)+'"/>'
   +'<ellipse cx="'+(x-r*.3)+'" cy="'+(y-r*.05)+'" rx="'+r*.2+'" ry="'+r*.1+'" fill="#8a9099" opacity=".35"/><ellipse cx="'+(x+r*.28)+'" cy="'+(y+r*.08)+'" rx="'+r*.17+'" ry="'+r*.09+'" fill="#8a9099" opacity=".3"/>';
}
function stPlayerSVG(pl){
  const {x,y,r,k,pk}=pl;let s='<g class="stg-pl stg-p" data-i="'+pl.i+'">';
  if(k==='engine')s+='<ellipse cx="'+x+'" cy="'+(y+r*.55)+'" rx="'+r*.95+'" ry="'+r*.4+'" fill="#2a2a30" stroke="#888"/><circle cx="'+(x-r*.45)+'" cy="'+(y-r*.1)+'" r="'+r*.35+'" fill="#c9a24a"/><circle cx="'+(x+r*.45)+'" cy="'+(y-r*.05)+'" r="'+r*.35+'" fill="#c9a24a"/><rect x="'+(x+r*.7)+'" y="'+(y-r*.5)+'" width="'+r*.18+'" height="'+r*.9+'" fill="#bbb" transform="rotate(20 '+(x+r*.8)+' '+y+')"/>';
  else if(k==='mic')s+='<circle cx="'+x+'" cy="'+y+'" r="'+r*.5+'" fill="#ddd"/><rect x="'+(x-r*.08)+'" y="'+(y+r*.4)+'" width="'+r*.16+'" height="'+r*1.1+'" fill="#999"/>';
  else{const R=rigOf(pk);R.p.map(([a,b])=>[x+a*r*1.02,y+b*r*.55]).sort((p,q)=>p[1]-q[1]).forEach(([px,py])=>{s+=stDrum(px,py,r,R.sk)})}
  return s+'</g>';
}
// the camera: how far in you've zoomed and where you're looking (for this visit; Fit puts the whole stage in view)
const CAM={z:0,x:0,y:0,fit:1,vw:0,vh:0};
function camFit(vw,vh){const S=STW(),bw=vw,bh=vh-(stFloat()?56:0),z=Math.min(bw/S.W,bh/S.H);Object.assign(CAM,{z,fit:z,x:(bw-S.W*z)/2,y:(bh-S.H*z)/2,vw,vh})}
const stFloat=()=>innerWidth>innerHeight&&innerHeight<=520;   // sideways phone: the card floats over the stage
function camClamp(){const S=STW();CAM.z=Math.max(CAM.fit*.8,Math.min(CAM.fit*5,CAM.z));
  const w=S.W*CAM.z,h=S.H*CAM.z;CAM.x=w<CAM.vw?(CAM.vw-w)/2:Math.min(40,Math.max(CAM.vw-w-40,CAM.x));CAM.y=h<CAM.vh?(CAM.vh-h)/2:Math.min(40,Math.max(CAM.vh-h-40,CAM.y))}
// the names stay the same size on screen however far you zoom
function camApply(){const g=q('#stgW');if(g){g.setAttribute('transform','translate('+CAM.x.toFixed(1)+' '+CAM.y.toFixed(1)+') scale('+CAM.z.toFixed(4)+')');g.style.setProperty('--stz',CAM.z.toFixed(4));
  const k=(1/CAM.z).toFixed(4);g.querySelectorAll('.stg-lbl').forEach(l=>l.setAttribute('transform','translate('+l.dataset.x+' '+l.dataset.y+') scale('+k+')'))}stMini()}
function camZoom(f,px,py){const z0=CAM.z;CAM.z*=f;camClamp();const k=CAM.z/z0;CAM.x=px-(px-CAM.x)*k;CAM.y=py-(py-CAM.y)*k;camClamp();camApply()}
// the little map in the corner, once you've zoomed in
function stMini(){
  const m=q('#stgMini');if(!m)return;const S=STW(),on=CAM.z>CAM.fit*1.15;m.hidden=!on;if(!on)return;
  const sc=Math.min(110/S.W,80/S.H),v=m.querySelector('.stg-mv');m.setAttribute('viewBox','0 0 '+S.W*sc+' '+S.H*sc);m.style.width=S.W*sc+'px';m.style.height=S.H*sc+'px';
  if(v){v.setAttribute('x',(-CAM.x/CAM.z*sc).toFixed(1));v.setAttribute('y',(-CAM.y/CAM.z*sc).toFixed(1));v.setAttribute('width',(CAM.vw/CAM.z*sc).toFixed(1));v.setAttribute('height',(CAM.vh/CAM.z*sc).toFixed(1))}
}
function renderStage(){
  const box=q('#stStage');if(!box||!song)return;if(VIEW!=='stage'){box.hidden=true;return}box.hidden=false;
  // a fixed screen: the stage takes what's left between the top bar and the bottom of the phone
  const top=box.getBoundingClientRect().top,dock=(typeof STAGE!=='undefined'&&STAGE.dockH)?STAGE.dockH():0;
  box.style.height=Math.max(260,innerHeight-Math.max(0,top)-dock-8)+'px';
  const S=STW(),secs=song.tracks.filter(STG_ON),hear=stHear();
  let s='<svg class="stg-svg" role="img" aria-label="The band on stage"><defs>'
    +'<radialGradient id="stgCh" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#c9c9cf"/><stop offset=".8" stop-color="#7d7d86"/><stop offset="1" stop-color="#3a3a40"/></radialGradient>'
    +'<linearGradient id="stgSk" x1="0" x2="1"><stop offset="0" stop-color="#2e3138"/><stop offset=".22" stop-color="#9aa0aa"/><stop offset=".42" stop-color="#eef1f6"/><stop offset=".62" stop-color="#8e949e"/><stop offset=".85" stop-color="#c3c8d0"/><stop offset="1" stop-color="#2a2d33"/></linearGradient>'
    +'</defs><rect class="stg-bg" width="100%" height="100%" fill="#05070f"/><g id="stgW"><g class="stg-bg" transform="translate('+(-S.W*.45)+' 0)">'+stScene(stLay(),S.W*1.9,S.H,stU(),'sc',S.W*.45,S.W)+'</g>'
    +(stLay()==='road'?'':'<text class="stg-tag" x="'+S.W/2+'" y="'+(S.H-12)+'" text-anchor="middle">⭐ '+(stLay()==='stage'?'JUDGES · AUDIENCE':'JUDGES')+' ⭐</text>');
  if(hear!=='off'){const ly=hear==='middle'?S.H*.5:S.H-58;s+='<text x="'+S.W/2+'" y="'+ly+'" text-anchor="middle" font-size="30">🎧</text>'}
  const mini=[];
  for(const tr of secs.map(t=>[t,stPlace(t)]).sort((a,b)=>a[1].y-b[1].y).map(a=>a[0])){
    const P=stPlayers(tr),p=stPlace(tr),n=P.list.length,on=audible(tr),sel=tr.id===song.sel,name=trName(tr)+(n>1?' ×'+n:'');
    const xs=P.list.map(o=>o.x),ys=P.list.map(o=>o.y),hw=(P.list[0].k==='engine'||P.list[0].k==='mic'?1.1:rigHW(P.list[0].pk))*P.r,sk=(rigOf(P.list[0].pk).sk||.2)*1.6*P.r;
    const x0=Math.min(...xs)-hw-8,x1=Math.max(...xs)+hw+8,y1=Math.max(...ys)+sk+P.r*.9,ly=Math.min(...ys)-P.r*(P.list[0].pk==='six'||P.list[0].pk==='seven'?1.7:1.05)-6;
    s+='<g class="stg-sec'+(on?'':' off')+(sel?' sel':'')+'" data-tid="'+tr.id+'" data-k="'+STG_SET(tr)+'"><rect class="stg-hit" x="'+x0+'" y="'+(ly-22)+'" width="'+(x1-x0)+'" height="'+(y1-ly+22)+'" rx="14"/>';
    s+=P.list.slice().sort((a,b)=>a.y-b.y).map(stPlayerSVG).join('');
    {const lw=Math.round(name.length*6.6+18);s+='<g class="stg-lbl" data-x="'+((x0+x1)/2).toFixed(1)+'" data-y="'+(ly-4).toFixed(1)+'"><rect x="'+(-lw/2)+'" y="-11" width="'+lw+'" height="20" rx="6"/><text class="stg-name" x="0" y="3.5" text-anchor="middle">'+esc(name)+'</text></g></g>'}
    mini.push([P.cx,P.cy,sel]);
  }
  s+='</g></svg>';
  const sc=Math.min(110/S.W,80/S.H);
  const mm='<svg class="stg-mini" id="stgMini" hidden aria-hidden="true"><rect width="100%" height="100%" fill="#0d0a0c"/>'+mini.map(([x,y,sel])=>'<circle cx="'+(x*sc).toFixed(1)+'" cy="'+(y*sc).toFixed(1)+'" r="3" fill="'+(sel?'#ffd84a':'#e3263a')+'"/>').join('')+'<rect class="stg-mv" fill="none" stroke="#ffd84a" stroke-width="1.5"/></svg>';
  const cur=selTr(),cp=STG_ON(cur)?stPlace(cur):null;
  const ck=STG_SET(cur),cpk=ck==='me'?trSet(cur):ck,np=ck==='engine'||ck==='mic'?0:rigOf(cpk).p.length;
  const card=cp?'<div class="stg-card" data-tid="'+cur.id+'"><div class="stg-cn"><b>'+esc(trName(cur))+'</b><small>'+(np?(cp.n||1)+' complete instrument'+((cp.n||1)>1?'s':'')+' · '+np+' pan'+(np>1?'s':'')+' per instrument':(cp.n||1)+' player'+((cp.n||1)>1?'s':''))+' · '+stWhere(cp)+'. Hold a set of pans to move just that one.</small></div>'
    +'<div class="stg-cb"><button class="btn sm" data-stg="less" aria-label="One instrument less">−</button><button class="btn sm" data-stg="more" aria-label="One instrument more">＋</button>'
    +'<button class="btn sm'+(cur.mute?' on':'')+'" data-st="mute" aria-pressed="'+!!cur.mute+'">Mute</button><button class="btn sm'+(cur.solo?' on':'')+'" data-st="solo" aria-pressed="'+!!cur.solo+'">Solo</button>'
    +(cp.pp&&Object.keys(cp.pp).length?'<button class="btn sm" data-stg="line" title="Put the players back in line">⇆ In line</button>':'')
    +'<button class="btn sm" data-stg="dup">Copy section</button><button class="btn sm" data-st="tset">Settings</button></div>'
    +'<label class="stg-vol">Volume<input type="range" data-stg="vol" min="0" max="1.2" step=".01" value="'+cur.vol+'"></label></div>'
    :'<div class="stg-card"><span class="help">Tap a section to change it. Drag it to move it; pinch to zoom.</span></div>';
  box.innerHTML='<div class="stg-top"><div class="seg stg-hear" role="group" aria-label="Hear it from">'+[['judges','🎧 '+(stLay()==='stage'?'Audience':'Crowd')],['middle','In the band'],['off','As mixed']].map(([v,l])=>'<button data-stg="hear" data-v="'+v+'" aria-pressed="'+(hear===v)+'">'+l+'</button>').join('')+'</div>'
    +'<button class="btn" data-stg="add">＋ Section</button><button class="btn stg-layb" data-stg="lay">▦ '+LAYOUTS.find(x=>x[0]===stLay())[1]+' ▾</button>'
    +'<span class="stg-zm" role="group" aria-label="Zoom"><button data-stg="zout" aria-label="Zoom out">−</button><button data-stg="fit" aria-label="Fit the whole stage">Fit</button><button data-stg="zin" aria-label="Zoom in">＋</button></span></div>'
    +'<div class="stg-floor" id="stgFloor">'+s+mm+'</div>'+card;
  {const over=document.scrollingElement.scrollHeight-innerHeight;if(over>0)box.style.height=Math.max(220,box.offsetHeight-over)+'px'}   // the page's own padding below: nothing to scroll
  const fl=q('#stgFloor'),vw=fl.clientWidth,vh=fl.clientHeight;
  {const a=(vh-(stFloat()?56:0))/Math.max(1,vw);if(vw&&Math.abs(a-STA)>.03){STA=a;CAM.z=0;renderStage();return}}   // drawn again in the floor's own shape
  const sz=STW();
  if(!CAM.z||CAM.vw!==vw||CAM.vh!==vh||CAM.sw!==sz.W){const keep=CAM.z&&CAM.sw===sz.W?CAM.z/CAM.fit:1;camFit(vw,vh);CAM.sw=sz.W;if(keep>1.01){camZoom(keep,vw/2,vh/2);return}}
  camApply();
}
const stWhere=p=>(p.y>.75?'front line':p.y>.55?'second row':p.y>.32?'middle':'back')+(p.x<.38?', left':p.x>.62?', right':', centre');
// which sections are sounding right now
function stageLights(){
  const box=q('#stStage');if(!box||VIEW!=='stage'||box.hidden)return;const b=T.playing?heardNow():-1;
  box.querySelectorAll('.stg-sec').forEach(g=>{const tr=trById(g.dataset.tid);if(!tr)return;let lit=false;
    if(b>=0&&audible(tr)){if(tr.type==='beats'||tr.type==='audio')lit=true;else for(const n of pnotes(tr)){if(n.t>b+.05)break;if(n.t<=b+.02&&b<n.t+Math.max(.2,Math.min(n.d||.3,.6))){lit=true;break}}}
    if(g.classList.contains('lit')!==lit)g.classList.toggle('lit',lit)});
}
{const lp=()=>{try{stageLights()}catch(e){}requestAnimationFrame(lp)};requestAnimationFrame(lp)}
function stageWire(){
  const box=q('#stStage');if(!box||box.dataset.w)return;box.dataset.w='1';
  // one finger: on a section it moves the section (held still first: just that player); on the floor it looks round.
  // Two fingers: pinch to zoom. A double tap on the floor fits the whole stage.
  const pts=new Map();let dr=null,pinch=null,lastTap=0;
  const local=e=>{const r=q('#stgFloor').getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
  box.addEventListener('pointerdown',e=>{
    if(!e.target.closest('#stgFloor')||e.target.closest('.stg-zm'))return;e.preventDefault();
    pts.set(e.pointerId,local(e));try{box.setPointerCapture(e.pointerId)}catch(_){}
    if(pts.size===2){if(dr&&dr.timer)clearTimeout(dr.timer);if(dr&&dr.moved){dirty();renderStage()}dr=null;const [a,b]=[...pts.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),m:[(a[0]+b[0])/2,(a[1]+b[1])/2]};return}
    if(pts.size>2)return;
    const g=e.target.closest('.stg-sec'),pl=e.target.closest('.stg-pl'),tr=g&&trById(g.dataset.tid),[x,y]=local(e);
    dr={tr,sx:x,sy:y,cx:CAM.x,cy:CAM.y,p0:tr?JSON.parse(JSON.stringify(stPlace(tr))):null,i:pl?+pl.dataset.i:null,one:false,moved:false,pushed:false,g,pl};
    // hold a player still for a moment: then only that player moves
    if(tr&&pl)dr.timer=setTimeout(()=>{if(dr&&!dr.moved){dr.one=true;pl.classList.add('stg-lift');if(navigator.vibrate)try{navigator.vibrate(15)}catch(_){}}},380);
  });
  box.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId))return;pts.set(e.pointerId,local(e));
    if(pinch&&pts.size>=2){const [a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      CAM.x+=m[0]-pinch.m[0];CAM.y+=m[1]-pinch.m[1];camZoom(d/Math.max(1,pinch.d),m[0],m[1]);pinch={d,m};return}
    if(!dr)return;const [x,y]=local(e),dx=x-dr.sx,dy=y-dr.sy;if(!dr.moved&&Math.hypot(dx,dy)<7)return;
    if(dr.timer&&!dr.moved){clearTimeout(dr.timer);dr.timer=0}dr.moved=true;
    if(!dr.tr){CAM.x=dr.cx+dx;CAM.y=dr.cy+dy;camClamp();camApply();return}
    if(!dr.pushed){pushHistory();dr.pushed=true;song.sel=dr.tr.id}
    const S=STW(),wx=dx/CAM.z/S.W,wy=dy/CAM.z/S.H;
    if(dr.one){const pp={...(dr.p0.pp||{})},o=pp[dr.i]||[0,0];pp[dr.i]=[+(o[0]+wx).toFixed(4),+(o[1]+wy).toFixed(4)];dr.tr.st={...dr.tr.st,pp};dr.pl.setAttribute('transform','translate('+(dx/CAM.z).toFixed(1)+' '+(dy/CAM.z).toFixed(1)+')');return}
    dr.tr.st={...dr.tr.st,x:Math.max(.03,Math.min(.97,dr.p0.x+wx)),y:Math.max(0,Math.min(1,dr.p0.y+wy/LAY_Y[stLay()][1]))};
    dr.g.setAttribute('transform','translate('+(dx/CAM.z).toFixed(1)+' '+(dy/CAM.z).toFixed(1)+')');
  });
  const up=e=>{
    pts.delete(e.pointerId);if(pinch){if(pts.size<2)pinch=null;return}
    if(!dr)return;const d=dr;dr=null;if(d.timer)clearTimeout(d.timer);
    if(!d.moved){
      if(!d.tr){const now=Date.now();if(now-lastTap<320){const fl=q('#stgFloor');camFit(fl.clientWidth,fl.clientHeight);camApply()}lastTap=now;return}
      song.sel=d.tr.id;renderStage();renderViews();return}
    if(d.tr){refreshGains();dirty();renderStage();if(d.one)say('Moved one '+trName(d.tr).replace(/s$/,'')+' player. ⇆ In line puts them back.')}
  };
  box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
  box.addEventListener('wheel',e=>{if(!e.target.closest('#stgFloor'))return;e.preventDefault();const [x,y]=local(e);camZoom(Math.exp(-e.deltaY*.0015),x,y)},{passive:false});
  addEventListener('resize',()=>{if(VIEW==='stage')requestAnimationFrame(renderStage)});
  box.addEventListener('input',e=>{if(e.target.dataset.stg==='vol'){const tr=selTr();tr.vol=+e.target.value;refreshGains();dirty()}});
  box.addEventListener('change',e=>{if(e.target.dataset.stg==='vol')pushHistory()});
  box.addEventListener('click',e=>{const b=e.target.closest('[data-stg]');if(!b||b.tagName==='INPUT')return;const a=b.dataset.stg,tr=selTr();
    if(a==='zin'||a==='zout'){camZoom(a==='zin'?1.35:1/1.35,CAM.vw/2,CAM.vh/2);return}
    if(a==='fit'){camFit(CAM.vw,CAM.vh);camApply();return}
    if(a==='hear'){song.stage={...(song.stage||{}),hear:b.dataset.v};refreshGains();dirty();renderStage();say(b.dataset.v==='off'?'Hearing the mix as it is.':b.dataset.v==='middle'?'Hearing it from the middle of the band.':'Hearing it from '+(stLay()==='stage'?'the audience':'the crowd')+'.');return}
    if(a==='add'){openSheet('add');return}
    if(a==='lay'){openSheet('stglay');return}
    if(a==='reset'){if(!confirm('Put every section back where it stands on a Panorama stage?'))return;pushHistory();song.tracks.forEach(t=>{delete t.st});song.tracks.filter(STG_ON).forEach(stPlace);refreshGains();dirty();renderStage();return}
    if(!STG_ON(tr))return;
    if(a==='line'){pushHistory();const p=stPlace(tr);delete p.pp;dirty();renderStage();return}
    if(a==='more'||a==='less'){pushHistory();const p=stPlace(tr);p.n=Math.max(1,Math.min(12,(p.n||1)+(a==='more'?1:-1)));if(p.pp)for(const k of Object.keys(p.pp))if(+k>=p.n)delete p.pp[k];refreshGains();dirty();renderStage();return}
    if(a==='dup'){pushHistory();const c=JSON.parse(JSON.stringify(tr));c.id=uid();c.name=(trName(tr)+' 2').slice(0,28);c.solo=false;const p=stPlace(tr);const off=Math.min(.45,Math.min(p.n||1,4)*.1+.06);c.st={...p,x:Math.max(.06,Math.min(.94,p.x+(p.x>.5?-off:off)))};delete c.st.pp;
      song.tracks.splice(song.tracks.indexOf(tr)+1,0,c);song.sel=c.id;refreshGains();dirty();renderStage();say('Copied '+trName(tr)+': same notes, its own place on the stage.');return}
  });
}

/* ---- sheets: add a track, mixer, export, timing fix, note editor ---- */
const SH={kind:null,arg:null};
function openSheet(kind,arg){SH.kind=kind;SH.arg=arg;q('#stSheet').hidden=false;renderSheet()}
function closeSheet(){{const g=$('gridBox'),box=q('#stSheet');if(g&&box&&box.contains(g)){$('tlTools').appendChild(g);g.hidden=true}}q('#stSheet').hidden=true;SH.kind=null;renderAll()}
function renderSheet(){
  const box=q('#stSheetBox');if(!SH.kind||!box)return;
  const head=t=>'<div class="sheethead"><h2>'+t+'</h2><button class="btn" data-st="close">Done</button></div>';
  let h='';
  if(SH.kind==='stglay'){
    const cur=stLay(),tw=320,th=190,tu=Math.min(tw,th)/14;
    h=head('Stage layout')+'<p class="help">Where the band stands. Picking one moves every section to its place there (↶ Undo puts them back); you can still drag them round after.</p><div class="stg-lays">'
      +LAYOUTS.map(([k,n,d],i)=>'<button class="stg-lay'+(k===cur?' on':'')+'" data-st="stglay" data-v="'+k+'" aria-pressed="'+(k===cur)+'"><svg viewBox="0 0 '+tw+' '+th+'" aria-hidden="true">'+stScene(k,tw,th,tu,'th'+i)+'</svg><b>'+n+(k===cur?' ✓':'')+'</b><span>'+d+'</span></button>').join('')
      +'</div><div class="row"><button class="btn" data-st="stglay" data-v="'+cur+'">↺ Put everyone back in place</button></div>';
  }else if(SH.kind==='add'){
    const cues=S.cues.filter(c=>c.steps&&c.steps.length).length;
    h=head('Add a track')+'<div class="st-addlist">'
      +'<button class="st-add" data-st="addk" data-v="audio"><b>🎙 Mic or audio file</b><span>Record yourself, a singer, or another pan. Or bring in a file.</span></button>'
      +'<div class="st-add st-addpans"><b>◉ Pan taps</b><span>Choose the pan, then play it on screen; every hit is a note you can edit.</span><div class="st-addp">'+Object.keys(SETS).map(k=>'<button data-st="addk" data-v="pan" data-set="'+k+'">'+(typeof HOME!=='undefined'?HOME.mini(k,34):'')+'<span>'+esc(SETS[k].name)+'</span></button>').join('')+'</div></div>'
      +'<button class="st-add st-addnew" data-st="addk" data-v="drums" data-set="rusty"><b>🥁 Drum kit</b><span>Play a real drum kit with your fingers. Pick from '+Object.keys(KITS).length+' kits.</span></button>'
      +'<button class="st-add" data-st="addk" data-v="drums" data-set="engine"><b>⛓ Engine room</b><span>Iron, scratcher, cowbell, shak-shak and congas to tap.</span></button>'
      +'<button class="st-add" data-st="addk" data-v="beats"><b>▦ Beat</b><span>A drum pattern: soca, calypso, panorama jam and more, or build your own.</span></button>'
      +'<button class="st-add" data-st="addk" data-v="part"><b>✎ Your part from Write</b><span>'+(cues?'Your '+cues+' cues as a pan track, linked: edit it here or in Write and both follow.':'Linked to your cues in Write; write some cues and they play here.')+'</span></button></div>';
  }else if(SH.kind==='addto'){
    const ad=SH.add,L=ad.b-ad.a,trs=addTracks(),me=trById(ad.tid),all=addSrc(ad.a,ad.b).filter(t=>!zoneOn()||!me||inSong(t)===inSong(me)),ss=ownSecs(),bpb=BPB();
    const opt=(k,v,label)=>'<button class="chip'+(ad[k]===v?' on':'')+'" data-st="addopt" data-k="'+k+'" data-v="'+v+'" aria-pressed="'+(ad[k]===v)+'">'+label+'</button>';
    const whole=Math.abs(ad.a-Math.round(ad.a))<1e-6&&Math.abs(ad.b-Math.round(ad.b))<1e-6;
    h=head('Add '+(whole?(L>1?'bars '+(ad.a+1)+'–'+ad.b:'bar '+(ad.a+1)):lenLab(L)+' from '+posLab(ad.a))+' to…')
      +'<div class="st-addopts"><div class="row">'+opt('scope','one','Only '+esc(me?me.name:'this track'))+(all.length>1||(all.length===1&&all[0]!==me)?opt('scope','all','Every track here ('+Math.max(all.length,1)+')'):'')+'</div>'
      +'<div class="row">'+opt('fill','repeat','Repeat to fill the section')+opt('fill','once','Just once')+'</div></div>'
      +(ss.length?'':'<p class="help">Your song has no sections yet. Make one below, or start from a template (⋯ → New song from a template).</p>')
      +'<div class="st-addsecs">'+ss.map((x,i)=>{const n=trs.reduce((k,t)=>k+notesOf(t).filter(m=>m.t>=x.a*bpb&&m.t<x.b*bpb).length,0),len=x.b-x.a,cover=ad.fill==='once'?Math.min(L,len):len,rep=ad.fill==='once'?'':(len>L?' · plays ×'+Math.ceil(len/L):'');
        const over=x.a<ad.b&&x.b>ad.a;
        return '<button class="st-addsec" data-st="addsec" data-v="'+i+'"><b>'+esc(x.name)+'</b><small>'+len+' bar'+(len===1?'':'s')+rep+' · '+(n?n+' note'+(n===1?'':'s')+' will be replaced':'empty')+(over?' · your pick is in here':'')+(cover<len?' · fills the first '+cover:'')+'</small></button>'}).join('')
      +'<button class="st-addsec st-addnew" data-st="addsec" data-v="new"><b>＋ New section</b><small>'+lenLab(Math.max(1,Math.ceil(L-1e-6)))+', at the end of the song</small></button></div>'
      +'<p class="help">'+(me&&!inSong(me)?'Your take stays as it is: the notes are copied into the Song\'s '+esc(LAYER_OF[me.panSet]||(me.type==='drums'?'Drums':'own'))+' track, made for you if it isn\'t there yet.':'Your notes are copied, so the bars you picked stay where they are.')+' Your band recording isn\'t copied.</p>';
  }else if(SH.kind==='fill'){
    const F=SH.fill,x=ownSecs()[F.i],bpb=BPB(),takes=song.tracks.filter(t=>!inSong(t)&&(t.type==='pan'||t.type==='drums')&&(t.notes||[]).length);
    const runs=t=>{const used=[...new Set(t.notes.map(m=>Math.floor(m.t/bpb)))].sort((u,v)=>u-v),out=[];for(const b of used){const r=out[out.length-1];if(r&&b===r[1])r[1]=b+1;else out.push([b,b+1])}return out};
    const opt=(v,l)=>'<button class="chip'+(F.mode===v?' on':'')+'" data-st="fillopt" data-v="'+v+'" aria-pressed="'+(F.mode===v)+'">'+l+'</button>';
    h=head('Fill '+(x?esc(x.name):'')+' from your takes')+'<div class="st-addopts"><div class="row">'+opt('repeat','Repeat to fill')+opt('once','Just once')+'</div></div>'
      +(takes.length?takes.map(t=>'<div class="st-fillt"><b>'+ICON[t.type]+' '+esc(t.name)+'</b><div class="row">'+runs(t).map(([a,z])=>'<button class="chip" data-st="fillrun" data-v="'+t.id+','+a+','+z+'">'+(z-a>1?'Bars '+(a+1)+'–'+z:'Bar '+(a+1))+' · '+t.notes.filter(m=>m.t>=a*bpb&&m.t<z*bpb).length+' notes</button>').join('')+'</div></div>').join('')
        :'<p class="help">You have no takes with notes yet. Go to Takes, record on a pan or drum track, then come back.</p>')
      +'<p class="help">Each run of bars with notes is listed. It\'s copied into the song\'s track for that layer and replaces what was there. To pick exact bars, use ＋ Add to… on the Takes tab.</p>';
  }else if(SH.kind==='arr'){
    h=head('Arrangement')+arrHTML();
  }else if(SH.kind==='tpl'){
    h=head('New song from a template')+'<p class="help">Lays out the sections on the ruler and adds a track for each part of the band: front line, middle, bass and an engine room already playing a groove. Your notes stay; undo takes it back.</p><div class="st-kits">'
      +TEMPLATES.map(tp=>'<button class="st-kitc st-tplc'+(song.tpl===tp.id?' on':'')+'" data-st="tplpick" data-v="'+tp.id+'"><b>'+esc(tp.name)+'</b><span>'+esc(tp.feel)+'</span><small>'+tp.bpm+' bpm · '+tplBars(tp)+' bars'+(tp.loop?', looping':', about '+tplTime(tp))+' · '+esc(tp.secs.map(x=>x[0]).join(', '))+'</small></button>').join('')+'</div>'
      +(pBuf?'<p class="help">Your recording is loaded, so its tempo stays as it is.</p>':'');
  }else if(SH.kind==='kits'){
    const tr=trById(SH.arg)||selTr(),cur=realKit(tr)||'synth',beat=tr.type==='beats';
    h=head('Kits')+'<p class="help">Every kit is free to use. Kits other than the Real kit download the first time you choose them, then work offline.</p><div class="st-kits">'
      +Object.entries(KITS).filter(([k,K])=>beat||k!=='engine'||tr.kit==='engine').map(([k,K])=>'<button class="st-kitc'+(k===cur?' on':'')+'" data-st="setkit" data-v="'+k+'" aria-pressed="'+(k===cur)+'"><b>'+esc(K.name)+'</b><span>'+esc(K.feel)+'</span><small>'+esc(K.by)+'</small></button>').join('')
      +(beat?'<button class="st-kitc'+(cur==='synth'?' on':'')+'" data-st="setkit" data-v="synth" aria-pressed="'+(cur==='synth')+'"><b>Classic</b><span>The built-in drum tones</span><small>Made in the app</small></button>':'')+'</div>';
  }else if(SH.kind==='mixer'){
    h=head('Mixer')+'<p class="help st-mixhint">Every track\'s level here. Tap <b>Sound ›</b> on a track for its tone, echo, quantize and takes.</p><div class="st-mix">'+song.tracks.map(tr=>'<div class="st-mrow k-'+tr.type+'" data-tid="'+tr.id+'"><div class="st-mname"><b>'+esc(tr.name)+'</b><button class="btn sm tsetb" data-st="tset" aria-label="Sound settings for '+esc(tr.name)+'">Sound ›</button><span class="st-ms"><button class="m" data-st="mute" aria-pressed="'+tr.mute+'">M</button><button class="s" data-st="solo" aria-pressed="'+tr.solo+'">S</button></span></div>'
      +'<label class="lab">Volume<input type="range" data-mk="vol" min="0" max="1.2" step=".01" value="'+tr.vol+'"></label>'
      +'<label class="lab">Left · Right<input type="range" data-mk="pan" min="-1" max="1" step=".05" value="'+(tr.pan||0)+'"></label>'
      +'<label class="lab">Reverb<input type="range" data-mk="mix" min="0" max=".6" step=".02" value="'+mixOf(tr)+'"></label>'
      +'<div class="st-meter" aria-hidden="true"><i data-meter="'+tr.id+'"></i></div></div>').join('')
      +'<div class="st-mrow master"><div class="st-mname"><b>Master</b><span class="help">A limiter keeps loud moments from distorting.</span></div><label class="lab">Volume<input type="range" data-mk="master" min="0" max="1" step=".01" value="'+song.master+'"></label><div class="st-meter" aria-hidden="true"><i data-meter="master"></i></div></div></div>'
      +'<p class="help">Press play with the mixer open to watch the levels.</p><div class="row"><button class="btn primary" data-st="play">'+(T.playing?'■ Stop':'▶ Play')+'</button></div>';
  }else if(SH.kind==='export'){
    const rg=expRange(),secs=Math.round((rg.b-rg.a)*spb()),songV=VIEW==='song'&&zoneOn(),nb=Math.round((rg.b-rg.a)/BPB());
    h=head('Export audio')+(songV&&rg.sec?'<div class="lab">How much<div class="seg" id="stExPart"><button data-v="all" aria-pressed="'+(EXP.part!=='sec')+'">The whole song</button><button data-v="sec" aria-pressed="'+(EXP.part==='sec')+'">Just '+esc(rg.sec.name)+'</button></div></div>':'')
      +'<div class="lab">What<div class="seg" id="stExWhat"><button data-v="mix" aria-pressed="'+(EXP.what==='mix')+'">All mixed together</button><button data-v="stems" aria-pressed="'+(EXP.what==='stems')+'">Each track</button></div></div>'
      +'<div class="lab">Format<div class="seg" id="stExFmt"><button data-v="mp3" aria-pressed="'+(EXP.fmt==='mp3')+'">MP3 · small, for WhatsApp</button><button data-v="wav" aria-pressed="'+(EXP.fmt==='wav')+'">WAV · best quality</button></div></div>'
      +'<p class="help">'+(songV?'Your song: only the song\'s tracks'+(song.band?' and the band recording':'')+', '+(rg.name?rg.name+', ':'to the end of the last section, ')
        :zoneOn()&&VIEW==='tracks'?'Your takes and the band recording, ':'')+nb+' bars at '+(+bpm().toFixed(1))+' bpm, about '+fmt(secs).replace(/\.\d$/,'')+'. Muted tracks are left out. Each track comes as a .zip of separate files.</p>'
      +'<p class="help" id="stExBusy" role="status" hidden></p><div class="row"><button class="btn primary grow" data-st="expgo">Save the audio</button></div>';
  }else if(SH.kind==='timing'){
    const lag=PR.micLag!=null?PR.micLag:Math.round(((ctx&&ctx.outputLatency)||0)*1000+((ctx&&ctx.baseLatency)||0)*1000+12);
    const first=SH.arg==='first'||SH.arg==='firstmic',ol=ctx?Math.round(((ctx.outputLatency||0)+(ctx.baseLatency||0))*1000):0,sl=ctx?Math.round(spkLag()*1000):0,smooth=(()=>{try{return localStorage.getItem('panyard-smooth')==='1'}catch{return false}})();
    h=head('Timing fix')+(first?'<div class="st-first"><b>'+(SH.arg==='firstmic'?'Before your first mic take on this phone':'Before your first recording on this phone')+'</b><p>'+(SH.arg==='firstmic'?'Measure the mic once (8 clicks, about 5 seconds) so your takes line up with the band.':'Tap along with 12 clicks once (about 10 seconds) so your notes land right on the beat.')+'</p><div class="row"><button class="btn sm" data-st="recnow">Skip, record now</button></div></div>':'')
      +'<p class="help">Phones add a small delay between you and the sound. Fix it once and your recordings land on the beat.</p>'
      +'<div class="panel st-cal"><b>Pan taps</b><p class="help">Tap Start, then tap the big button on every click. Now: '+tapMs()+' ms (the same as Tap delay fix in Write).</p><div class="row"><button class="btn" data-st="tapcal">Start</button><button class="btn primary grow st-calbtn" id="stCalTap">Tap on the click</button></div></div>'
      +'<div class="panel st-cal"><b>Mic</b><p class="help">Take off headphones and keep it quiet: the phone plays clicks and listens for them. '+(PR.micLag!=null?'Set to '+PR.micLag+' ms.':'Using the phone\'s own estimate ('+lag+' ms).')+'</p>'
      +'<div class="row"><button class="btn" data-st="miccal">Measure with the speaker</button>'+(PR.micLag!=null?'<button class="btn sm" data-st="micauto">Use the estimate</button>':'')+'</div>'
      +'<label class="lab"><span>Set by ear: <b id="stLagV">'+lag+'</b> ms</span><input type="range" id="stLag" min="0" max="400" step="5" value="'+lag+'"></label></div>'
      +'<p class="help" id="stCalMsg" role="status" aria-live="polite"></p>'
      +'<div class="panel st-cal"><b>Smoother playback</b><p class="help">For a phone that stutters: the sound gets a bigger cushion. Taps answer a touch later, so run Pan taps again after switching. Panyard restarts to switch.</p>'
        +'<div class="seg"><button data-st="smooth" data-v="0" aria-pressed="'+!smooth+'">Quickest</button><button data-st="smooth" data-v="1" aria-pressed="'+smooth+'">Smoother</button></div></div>'
      +'<p class="help st-diag">This phone: speaker delay '+ol+' ms reported'+(sl>ol+5?', '+sl+' ms measured':'')+' · tap fix '+tapMs()+' ms'+(PR.cal?'':' (not set yet)')+' · mic '+(PR.micLag!=null?PR.micLag+' ms':'not measured')+' · sound '+(ctx?Math.round(ctx.sampleRate/100)/10+' kHz':'off')+(LITE?' · light reverb':'')+' · hiccups while playing (last minute): '+GL.log.length+'</p>';
  }else if(SH.kind==='tempo'){
    const k=ck(),v=+bpm().toFixed(1),rec=!!pBuf;
    const tog=(key,label,on,sub)=>'<button class="trow tog" data-st="ctog" data-v="'+key+'" role="switch" aria-checked="'+!!on+'"><span class="tl"><b>'+label+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</span><span class="sw" aria-hidden="true"><i></i></span></button>';
    h=head('Tempo &amp; metronome')
      +'<div class="tsec"><div class="tbig"><button class="tstep" data-st="tempo" data-v="-1" aria-label="Slower">−</button><div class="tval"><b id="stBpmV">'+v+'</b><span>bpm</span></div><button class="tstep" data-st="tempo" data-v="1" aria-label="Faster">+</button></div>'
      +'<input type="range" id="stBpmR" min="40" max="240" step="1" value="'+Math.round(v)+'" aria-label="Tempo">'
      +'<div class="row"><button class="btn grow" data-st="taptempo">Tap tempo</button><span class="help" id="stTapMsg" role="status" aria-live="polite">Tap along 4 times</span></div>'
      +'<div class="lab">Beats in a bar<div class="seg">'+[2,3,4].map(n=>'<button data-st="sig" data-v="'+n+'" aria-pressed="'+(BPB()===n)+'">'+n+'/4</button>').join('')+'</div></div>'
      +'<p class="help">'+(rec?'Your recording sets this song\'s tempo. Changing it here moves the bars to fit the recording.':'This song\'s own tempo. Your part, the beat and every pan track speed up or slow down with it.')+'</p></div>'
      +'<div class="tsec"><h3>Playback speed</h3><div class="seg st-speed">'+[[1,'Full'],[.75,'¾'],[.5,'½']].map(([r,l])=>'<button data-st="speed" data-v="'+r+'" aria-pressed="'+(SPD.rate===r)+'">'+l+'</button>').join('')+'</div>'
      +'<p class="help">Slow everything down to learn a hard passage. The pitch stays the same, and the bars and your notes stay where they are.</p></div>'
      // Write's ♩ Timing, here: find the tempo in your recording and line the bars up with it
      +'<div class="tsec"><h3>'+(rec?'Line the bars up with your recording':'Find the tempo')+'</h3><div id="stGridHome"></div></div>'
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
    // part of the Mixer: one panel for all the sound settings, with a way back to every track
    h='<div class="sheethead st-tsethead"><button class="btn sm" data-st="tomix" aria-label="Back to the Mixer">‹ Mixer</button><h2>'+esc(tr.name)+'</h2><button class="btn" data-st="close">Done</button></div>'+'<div class="tchips" role="group" aria-label="Choose a track">'+song.tracks.map(t=>'<button class="chip'+(t.id===tr.id?' on':'')+'" data-st="tsetpick" data-v="'+t.id+'" aria-pressed="'+(t.id===tr.id)+'">'+ICON[t.type]+' '+esc(t.name)+'</button>').join('')+'</div>'
      +'<div data-tid="'+tr.id+'" class="tset">'
      +sec('Output',sl('vol','Volume',0,1.2,.01,tr.vol,pct(tr.vol/1.2),'data-mk')+sl('pan','Left · Right',-1,1,.05,tr.pan||0,lr(tr.pan||0),'data-mk')
        +'<div class="row st-ms tms"><button class="m" data-st="mute" aria-pressed="'+tr.mute+'">Mute</button><button class="s" data-st="solo" aria-pressed="'+tr.solo+'">Solo</button></div>')
      +sec('Tone',(toneOf(tr)?'<div class="tlist"><button class="trow" data-st="tone" aria-pressed="'+!fx.own+'"><span class="tl"><b>✨ Suggested for the '+esc(SETS[toneSet(tr)].name)+'</b><small>'+(fx.own?'Off: your own tone. Tap to go back to the suggested one.':'On: set for this pan. Move a slider to make it your own.')+'</small></span><span class="tcheck" aria-hidden="true">✓</span></button></div>':'')+sl('treble','Treble',-12,12,1,fx.treble,db(fx.treble))+sl('bass','Bass',-12,12,1,fx.bass,db(fx.bass))+sl('comp','Compressor',0,1,.05,fx.comp,fx.comp?pct(fx.comp):'Off')+'<p class="help">Compressor evens out loud and soft hits, so the track sits steady in the mix.</p>')
      +sec('Echo',sl('echo','Echo',0,.6,.02,fx.echo,fx.echo?pct(fx.echo/.6):'Off')+'<div class="tlist">'+Object.entries(ECHOES).map(([k,e])=>'<button class="trow" data-st="echoT" data-v="'+k+'" aria-pressed="'+(fx.echoT===k)+'"><span class="tl"><b>'+e.n+'</b></span><span class="tcheck" aria-hidden="true">✓</span></button>').join('')+'</div><p class="help">Echoes land in time with the song\'s tempo.</p>')
      +sec('Reverb',sl('mix','Reverb',0,.6,.02,mixOf(tr),pct(mixOf(tr)/.6),'data-mk')+'<div class="seg tseg">'+ROOMS.map(([d,n])=>'<button data-st="room" data-v="'+d+'" aria-pressed="'+((fx.room||0)===d)+'">'+n+'</button>').join('')+'</div>')
      +(pan?sec('Quantize','<div class="seg tseg">'+Object.entries(QNT).map(([k,n])=>'<button data-st="qmode" data-v="'+k+'" aria-pressed="'+((tr.q&&tr.q.mode||'none')===k)+'">'+n+'</button>').join('')+'</div>'
          +(tr.q&&tr.q.mode&&tr.q.mode!=='none'?'<div class="seg tseg">'+[[1,'1/4'],[.5,'1/8'],[.25,'1/16']].map(([d,n])=>'<button data-st="qdiv" data-v="'+d+'" aria-pressed="'+((tr.q.div||.5)===d)+'">'+n+'</button>').join('')+'</div>'
            +(tr.q.mode==='swing'?'<div class="seg tseg"><button data-st="qsw" data-v="light" aria-pressed="'+(tr.q.sw!=='heavy')+'">Light swing</button><button data-st="qsw" data-v="heavy" aria-pressed="'+(tr.q.sw==='heavy')+'">Heavy swing</button></div>':''):'')
          +'<p class="help">Moves this track\'s notes onto the beat as it plays. Straight is tight, Triplet and Swing give it a looser feel. Your notes are kept as you played them: choose None to hear them that way again.</p>'):'')
      +(pan?sec('Transpose','<div class="tsteps"><div class="tstp"><span>Octaves</span><button data-st="tp" data-v="-12" aria-label="Octave down">−</button><b>'+Math.trunc((tr.tp|0)/12)+'</b><button data-st="tp" data-v="12" aria-label="Octave up">+</button></div><div class="tstp"><span>Semitones</span><button data-st="tp" data-v="-1" aria-label="Semitone down">−</button><b>'+((tr.tp|0)%12)+'</b><button data-st="tp" data-v="1" aria-label="Semitone up">+</button></div></div>'
          +'<p class="help">'+(tr.tp?'Every note plays '+Math.abs(tr.tp)+' semitone'+(Math.abs(tr.tp)===1?'':'s')+' '+(tr.tp>0?'higher':'lower')+'. Notes that fall off the '+esc(SETS[trSet(tr)].name)+' come back an octave in.':'Move the whole track up or down. The notes you played stay as they are.')+'</p>'):'')
      +(pan?sec('Chart','<div class="tlist"><button class="trow tog" data-st="tchart" role="switch" aria-checked="'+!!tr.chart+'"><span class="tl"><b>Show on Chart</b><small>This track gets its own part in the Chart tab, with your song\'s sections, to share with its player</small></span><span class="sw" aria-hidden="true"><i></i></span></button></div>'):'')
      +(pan||tr.type==='audio'?sec('Recording &amp; takes',takesHTML(tr)):'')
      +'</div>';
  }else if(SH.kind==='notes')h=notesHTML();
  {const g=$('gridBox');if(g&&box.contains(g)){$('tlTools').appendChild(g);g.hidden=true}}   // Write's timing panel goes home before the sheet is redrawn
  box.innerHTML=h;box.classList.toggle('st-wide',SH.kind==='notes');
  {const gh=q('#stGridHome'),g=$('gridBox');if(gh&&g){gh.appendChild(g);g.hidden=false;try{renderGrid()}catch{}}}
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
function addTrack(kind,set){
  pushHistory();let tr;
  if(kind==='part'){const ex=song.tracks.find(t=>t.type==='part');if(ex){H.u.pop();song.sel=ex.id;closeSheet();say('My part is already here, linked to Write.');return}tr=trk('part')}
  else tr=trk(kind);
  if(kind==='pan'&&SETS[set]){tr.panSet=set;tr.name=SETS[set].name}
  if(kind==='drums'&&KITS[set]){tr.kit=set;tr.name=KITS[set].name}
  // numbered among its own kind: a second Six Bass is "Six Bass 2", a first tenor is just "Low C Tenor"
  const same=song.tracks.filter(t=>t.type===tr.type&&(tr.type!=='pan'||t.panSet===tr.panSet)&&(tr.type!=='drums'||t.kit===tr.kit)).length;if(same&&kind!=='part')tr.name+=' '+(same+1);
  song.tracks.push(tr);song.sel=tr.id;dirty();closeSheet();setView('inst');
  if(kind==='beats'||kind==='drums')AC()&&warmDrums();
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
const EXP={fmt:'mp3',what:'mix',part:'all'};
// what Export covers: on the Song tab, the song up to the end of its last section (or just the looped section)
function expRange(){
  const songV=VIEW==='song'&&zoneOn(),ss=ownSecs(),bpb=BPB(),cyc=cycOn()?song.cycle:null;
  const sec=songV&&cyc?ss.find(x=>x.a===cyc.s&&x.b===cyc.e):null;
  if(sec&&EXP.part==='sec')return{a:sec.a*bpb,b:sec.b*bpb,name:sec.name,sec};
  if(songV&&ss.length)return{a:0,b:Math.max(...ss.map(x=>x.b))*bpb,name:'',sec};
  return{a:0,b:L(),name:'',sec};
}
// every pan note the song plays (for Tuned steel to get ready)
function steelIds(){const ids=new Set();for(const tr of song.tracks){if(tr.type==='part')partNotes().forEach(n=>ids.add(n.p));else if(tr.type==='pan')pnotes(tr).forEach(n=>ids.add(n.p))}return [...ids]}
const hasContent=tr=>tr.type==='beats'?tr.rows.some(r=>r.steps.some(Boolean)):isNotey(tr)?notesOf(tr).length>0:!!audioOf(tr);
async function renderSong(only,onProgress,RG){
  AC();await warmDrums();await warmPans();if(S.panVoice==='steel'&&typeof STEEL!=='undefined')await STEEL.warm(steelIds());
  const live={ctx,master,meterM,reverbs,PV},saved=new Map(chans);
  const RA=RG?RG.a:0,RB=RG?RG.b:L(),sr=44100,sp=spb(),Lb=RB,T0=.05-RA*sp,off=new OfflineAudioContext(2,Math.ceil(sr*((RB-RA)*sp+.05+3)),sr);
  try{
    ctx=off;chans.clear();PV=new Map();reverbs=new Map();const m=buildMaster(off);master=m.vol;meterM=m.an;
    const ev=[];
    for(const tr of song.tracks){
      if(only?tr!==only:!audible(tr)||!hasContent(tr))continue;
      const c=channel(tr).play;c.gain.value=1;
      if(tr.type==='beats'){const rk=realKit(tr);for(const [bt,mm,v] of beatHits(tr,RA,Lb)){if(bt<RA)continue;const t=T0+bt*sp;ev.push({t,fn:()=>playDrum(mm,c,t,v,rk)})}}
      else if(tr.type==='drums'){const rk=realKit(tr);for(const n of tr.notes)if(n.t<Lb&&n.t>=RA){const t=T0+n.t*sp;ev.push({t,fn:()=>playDrum(+n.p,c,t,n.v,rk)})}}
      else if(isPanish(tr)){for(const n of pnotes(tr))if(n.t<Lb&&n.t>=RA){const t=T0+n.t*sp;ev.push({t,fn:()=>panVoice(c,n.p,t,n.v,n.r===undefined?undefined:!!n.r)})}}
      else{const b=audioOf(tr);if(b){let t=T0+startOf(tr)*sp,o=0;if(t<0){o=-t;t=0}ev.push({t,fn:()=>{const s=off.createBufferSource();s.buffer=b;s.connect(c);s.start(t,o);s.stop(Math.max(t,T0+Lb*sp))}})}}
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
  const rg=expRange(),tail=VIEW==='song'&&zoneOn()?(rg.name?' - '+safe(rg.name):' - song'):'';
  if(T.playing)stop(false);busy.hidden=false;go.disabled=true;
  try{
    if(EXP.what==='mix'){
      if(!song.tracks.some(t=>audible(t)&&hasContent(t))){say("There's nothing to export yet. Record something first.");return}
      const data=await encode(await renderSong(null,p=>{busy.textContent='Exporting your song… '+Math.round(p*100)+'%'},rg));
      busy.textContent='Ready.';await offerFile(base+tail+'.'+EXP.fmt,data);
    }else{
      const todo=song.tracks.filter(t=>hasContent(t)&&inMode(t)&&(!rg.name||t.type!=='practice'||song.band)),files=[];if(!todo.length){say("There's nothing to export yet. Record something first.");return}
      for(const [k,tr] of todo.entries()){const b=await encode(await renderSong(tr,p=>{busy.textContent='Exporting '+tr.name+' ('+(k+1)+' of '+todo.length+')… '+Math.round(p*100)+'%'},rg));files.push({name:safe(tr.name)+' '+(k+1)+'.'+EXP.fmt,data:new Uint8Array(await b.arrayBuffer())})}
      busy.textContent='Ready.';await offerFile(base+tail+' - tracks.zip',zipStore(files));
    }
  }catch(e){say(e&&e.message==='mp3'?'MP3 needs an internet connection the first time. Try WAV, or connect and try again.':"The export didn't finish. Try again, or try WAV.")}
  finally{if(busy.isConnected)busy.hidden=true;if(go.isConnected)go.disabled=false}
}

/* ---- taps and clicks ---- */
/* picking finer than a bar: Bar, Beat, ½ beat or ¼ beat (a 16th). Beats and recordings stay whole bars. */
const SELG=[['1','Bar'],['b','Beat'],['h','½ beat'],['q','¼ beat']];
const gStep=g=>g==='b'?1/BPB():g==='h'?1/(2*BPB()):g==='q'?1/(4*BPB()):1;
// how finely you pick follows the zoom: the finest ruler ticks that sit at least TICK_PX apart (¼ beat, ½ beat, beat), else whole bars
const TICK_PX=22;
function zoomStep(){const bar=zoomPx(),b=BPB();for(const k of[4,2,1])if(bar/(b*k)>=TICK_PX)return 1/(b*k);return 1}
const stepOf=tr=>tr.type==='pan'||tr.type==='drums'||tr.type==='part'?zoomStep():1;
const r6=x=>Math.round(x*1e6)/1e6;
function posLab(x){const bar=Math.floor(x+1e-6),bt=r6((x-bar)*BPB()),b0=Math.floor(bt+1e-6),fr=r6(bt-b0);
  return 'bar '+(bar+1)+(bt>1e-6?' beat '+(b0+1)+(fr>1e-6?({0.25:'¼',0.5:'½',0.75:'¾'}[fr]||''):''):'')}
function lenLab(L){const beats=r6(L*BPB());if(Math.abs(L-Math.round(L))<1e-6&&L>=1)return Math.round(L)+' bar'+(Math.round(L)===1?'':'s');
  const w=Math.floor(beats+1e-6),fr=r6(beats-w),f=fr>1e-6?({0.25:'¼',0.5:'½',0.75:'¾'}[fr]||''):'';return (w||!f?w:'')+f+' beat'+(beats<=1?'':'s')}
function laneTap(e,row){
  const tr=trById(row.dataset.tid),lane=row.querySelector('.st-lane'),st=stepOf(tr),pos=(e.clientX-lane.getBoundingClientRect().left)/zoomPx(),bar=r6(Math.floor(pos/st+1e-9)*st);
  if(bar<0||bar>=bars())return;
  const eq=(x,y)=>Math.abs(x-y)<1e-6,one=SEL&&eq(SEL.b-SEL.a,st);
  if(song.sel!==tr.id){song.sel=tr.id;SEL={tid:tr.id,anchor:bar,a:bar,b:r6(bar+st),st};renderAll();return}
  if(SEL&&SEL.fresh&&SEL.tid===tr.id)SEL={tid:tr.id,anchor:bar,a:bar,b:r6(bar+st),st};
  else if(SEL&&SEL.tid===tr.id&&!eq(bar,SEL.anchor)&&!(one&&eq(bar,SEL.a)))SEL={tid:tr.id,anchor:SEL.anchor,a:Math.min(SEL.anchor,bar),b:r6(Math.max(SEL.anchor,bar)+st),st};
  else if(SEL&&SEL.tid===tr.id&&one&&eq(bar,SEL.a))SEL=null;
  else SEL={tid:tr.id,anchor:bar,a:bar,b:r6(bar+st),st};
  renderTimeline();
}
function onClick(e){
  const b=e.target.closest('[data-st],[data-sec],.stc');if(!b||!song)return;
  if(b.classList.contains('stc')&&b.closest('#stGrid')){const tr=selTr(),r=+b.dataset.r,c=+b.dataset.c;pushHistory();tr.rows[r].steps[c]=(tr.rows[r].steps[c]+1)%3;tr.style='';
    if(tr.rows[r].steps[c]&&AC())playDrum(tr.rows[r].m,channel(tr).out,ctx.currentTime+.003,tr.rows[r].steps[c]===2?1:.72,realKit(tr));dirty();renderInst();renderTimeline();return}
  if(b.dataset.sec){const [a,z]=b.dataset.sec.split(',').map(Number);pushHistory();const on=cycOn()&&song.cycle.s===a&&song.cycle.e===z;song.cycle={on:!on,s:a,e:z};dirty();
    if(!on){T.pos=a*BPB();restartIfPlaying()}renderAll();say(on?'Loop off.':'Looping '+b.textContent+'.');return}
  const act=b.dataset.st,row=b.closest('[data-tid]'),tr=row?trById(row.dataset.tid):null;
  switch(act){
    case 'pick':if(song.sel===tr.id){setView('inst');break}song.sel=tr.id;SEL=null;dirty();renderAll();break;
    case 'ipick':song.sel=b.dataset.tid;dirty();renderInst();renderViews();break;
    case 'lane':break;
    case 'mute':case 'solo':pushHistory();tr[act]=!tr[act];refreshGains();dirty();if(SH.kind==='mixer'||SH.kind==='track')renderSheet();renderTimeline();if(VIEW==='stage')renderStage();break;
    case 'tset':openSheet('track',tr?tr.id:selTr().id);break;
    case 'tomix':openSheet('mixer');break;
    case 'tsetpick':SH.arg=b.dataset.v;song.sel=b.dataset.v;renderSheet();break;
    case 'tempo':setTempo(Math.round(bpm())+(+b.dataset.v));break;
    case 'step':STEP.on=!STEP.on;nextKey='';if(STEP.on){if(T.playing)stop(false);say('✚ Step: tap the pans to put notes in at '+bbLab(T.pos)+' (several for a chord). → moves on by '+(SNAPS.find(x=>+x[0]===stepLen())||[0,'½ beat'])[1]+'.')}break;
    case 'stepgo':{const d=+b.dataset.v*stepLen();T.pos=Math.max(0,r6(T.pos+d));if(T.pos>=bars()*BPB()-1e-6)song.minBars=bars()+4;nextKey='';updatePlayhead();break}
    case 'nextat':seek(+b.dataset.v);nextKey='';break;
    case 'stglay':closeSheet();layApply(b.dataset.v);break;
    case 'speed':setSpeed(+b.dataset.v).then(()=>{if(SH.kind==='tempo')renderSheet()});break;
    case 'taptempo':tapTempo();break;
    case 'sig':setTempo(bpm(),{perBar:+b.dataset.v});break;
    case 'ctog':{const k=b.dataset.v;if(k==='metro'||k==='countIn'){if(k==='metro')song.metro=!song.metro;else song.countIn=song.countIn===false}else song.click={...ck(),[k]:!ck()[k]};dirty();renderTransport();renderSheet();break}
    case 'csound':song.click={...ck(),sound:b.dataset.v};dirty();if(AC()){const t0=ctx.currentTime+.02;for(let i=0;i<4;i++)click(t0+i*.32,i===0)}renderSheet();break;
    case 'cbars':song.click={...ck(),bars:+b.dataset.v};dirty();renderSheet();break;
    case 'arrsec':{const x=ownSecs()[+b.dataset.v];if(!x)break;pushHistory();const on=cycOn()&&song.cycle.s===x.a&&song.cycle.e===x.b;song.cycle={on:!on,s:x.a,e:x.b};if(!on)seek(x.a*BPB());restartIfPlaying();dirty();renderTransport();renderSecs();renderTimeline();arrKeep(renderSheet);say(on?'Loop off.':'Looping '+x.name+', every track.');break}
    case 'arrbox':{const v={tid:b.dataset.tid,i:+b.dataset.v},same=SH.arr&&SH.arr.tid===v.tid&&SH.arr.i===v.i;SH.arr=same?null:v;SH.arrFrom=false;arrKeep(renderSheet);break}
    case 'arrdo':arrDo(b.dataset.v);break;
    case 'arrcopy':{const sel=SH.arr,tr=trById(sel.tid),y=ownSecs()[+b.dataset.v];if(!tr||!y)break;SH.add={tid:tr.id,a:y.a,b:y.b,scope:'one',fill:'repeat'};SH.arrFrom=false;addTo(String(sel.i));openSheet('arr');{const a2=q('.st-arr');if(a2)a2.scrollLeft=Math.max(0,(sel.i-1)*66)}break}
    case 'addopt':if(SH.add){SH.add[b.dataset.k]=b.dataset.v;renderSheet()}break;
    case 'addsec':addTo(b.dataset.v);break;
    case 'tplpick':applyTemplate(b.dataset.v);break;
    case 'secdup':secOp('dup',+b.dataset.v);break;
    case 'secdel':secOp('del',+b.dataset.v);break;
    case 'secren':secOp('ren',+b.dataset.v);break;
    case 'secup':secOp('up',+b.dataset.v);break;
    case 'secdown':secOp('down',+b.dataset.v);break;
    case 'songadd':{const name=prompt('Name the new section (it goes at the end of the song)','Section '+(ownSecs().length+1));if(name==null||!name.trim())break;
      const nb=Math.round(+prompt('How many bars?','8'));if(!(nb>=1&&nb<=128)){say('Pick between 1 and 128 bars.');break}
      pushHistory();if(!song.secs||!song.secs.length)song.secs=ownSecs().map(x=>({...x}));const end=song.secs.length?Math.max(...song.secs.map(z=>z.b)):0;
      song.secs.push({name:name.trim().slice(0,30),a:end,b:end+nb,en:3});song.minBars=Math.max(song.minBars||8,end+nb);song.cycle={on:true,s:end,e:end+nb};seek(end*BPB());dirty();renderAll();
      requestAnimationFrame(()=>{const tl=q('#stTl');if(tl)tl.scrollLeft=Math.max(0,end*zoomPx()-40)});say('Added '+name.trim()+' ('+nb+' bars). Fill it from your takes.');break}
    case 'songgrid':openSheet('arr');break;
    case 'songband':{pushHistory();song.band=!song.band;refreshGains();dirty();renderSongBar();say(song.band?'The band recording plays with the song.':'Only your song plays.');break}
    case 'songplay':{const x=ownSecs()[+b.dataset.v];if(!x)break;seek(x.a*BPB());if(!T.playing)play(false);break}
    case 'songfill':{SH.fill={i:+b.dataset.v,mode:SH.fill&&SH.fill.mode||'repeat'};openSheet('fill');break}
    case 'fillopt':{if(SH.fill){SH.fill.mode=b.dataset.v;renderSheet()}break}
    case 'fillrun':{const [tid,a,z]=b.dataset.v.split(',');SH.add={tid,a:+a,b:+z,scope:'one',fill:SH.fill.mode};addTo(String(SH.fill.i));break}
    case 'zmute':{pushHistory();song.zm=song.zm||{};const k=b.dataset.v;song.zm[k]=!song.zm[k];refreshGains();dirty();renderTimeline();say((k==='s'?'Song':'Takes')+(song.zm[k]?' muted.':' playing.'));break}
    case 'kitsheet':{const t=selTr();openSheet('kits',t.id);break}
    case 'setkit':{const t=trById(SH.arg)||selTr(),v=b.dataset.v;if(!t||(t.type!=='drums'&&t.type!=='beats'))break;pushHistory();
      const was=KITS[realKit(t)]?KITS[realKit(t)].name:'';if(v==='synth'&&t.type==='beats')t.kit='synth';else if(KITS[v])t.kit=v;
      if(t.type==='drums'&&(t.name===was||/^(Big Rusty|Virtuosity Jazz|Black Pearl|Drum Machine|Panyard Real kit|Engine Room)( \d+)?$/.test(t.name))&&KITS[v])t.name=KITS[v].name;
      dirty();closeSheet();setView('inst');
      if(KITS[v]&&AC())loadKit(v).then(()=>playDrum(t.type==='beats'&&t.rows&&t.rows[0]?t.rows[0].m:KITS[v].lay==='engine'?81:38,channel(t).out,ctx.currentTime+.01,.95,v));
      say(v==='synth'?'Classic: the built-in drum tones.':KITS[v].name+': '+KITS[v].feel.toLowerCase()+'.');break}
    case 'kit':{const tr=selTr();if(!tr||tr.type!=='beats')break;pushHistory();if(b.dataset.v==='synth')tr.kit='synth';else delete tr.kit;dirty();renderInst();
      if(AC()){warmDrums();const r=tr.rows&&tr.rows.find(x=>x.steps.some(Boolean));if(r)setTimeout(()=>playDrum(r.m,channel(tr).out,ctx.currentTime+.003,1,realKit(tr)),b.dataset.v==='real'&&!KIT.ok?400:0)}
      say(b.dataset.v==='synth'?'Classic: the built-in drum tones.':'Real kit: recorded drums and percussion.');break}
    case 'tchart':pushHistory();tr.chart=!tr.chart;dirty();renderSheet();say(tr.chart?tr.name+' now has its own part in the Chart tab.':tr.name+' is off the Chart.');break;
    case 'tone':{pushHistory();const f=fxOf(tr);tr.fx=f.own?{...f,own:false}:{...f,treble:0,bass:0,comp:0,own:true};refreshGains();dirty();renderSheet();break}
    case 'echoT':pushHistory();tr.fx={...fxOf(tr),echoT:b.dataset.v};if(!tr.fx.echo)tr.fx.echo=.22;refreshGains();dirty();renderSheet();break;
    case 'room':pushHistory();tr.fx={...fxOf(tr),room:+b.dataset.v};if(tr.mix===0)tr.mix=.2;refreshGains();dirty();renderSheet();break;
    case 'qmode':pushHistory();tr.q={div:.5,sw:'light',...(tr.q||{}),mode:b.dataset.v};dirty();renderTimeline();renderSheet();say(b.dataset.v==='none'?'Quantize off: your notes play as you played them.':'Quantize: '+QNT[b.dataset.v]+'.');break;
    case 'qdiv':pushHistory();tr.q={...tr.q,div:+b.dataset.v};dirty();renderTimeline();renderSheet();break;
    case 'qsw':pushHistory();tr.q={...tr.q,sw:b.dataset.v};dirty();renderTimeline();renderSheet();break;
    case 'tp':{pushHistory();tr.tp=Math.max(-24,Math.min(24,(tr.tp|0)+(+b.dataset.v)));if(!tr.tp)delete tr.tp;dirty();renderTimeline();renderSheet();if(AC()){const n=pnotes(tr)[0];if(n)audition(tr,n.p)}break}
    case 'takeuse':pushHistory();takeUse(tr,+b.dataset.v);dirty();restartIfPlaying();renderAll();if(SH.kind)renderSheet();break;
    case 'takedel':{if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Delete?';setTimeout(()=>{if(b.isConnected){b.dataset.armed='';b.textContent='✕'}},3000);break}pushHistory();takeDel(tr,+b.dataset.v);dirty();renderAll();renderSheet();break}
    case 'close':closeSheet();break;
    case 'addk':addTrack(b.dataset.v,b.dataset.set);break;
    case 'deltrack':{const t=selTr();if(t.type==='practice')break;if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Tap again to delete';setTimeout(()=>{if(b.isConnected){b.dataset.armed='';b.textContent='Delete track'}},3000);break}
      pushHistory();song.tracks=song.tracks.filter(x=>x!==t);song.sel='practice';SEL=null;dirty();renderAll();say('Deleted '+t.name+'. Undo brings it back.');break}
    case 'addsheet':openSheet('add');break;
    case 'selg':{const v=b.dataset.v,st=gStep(v);PR.selg=v;const base=innerWidth<560?64:92,need=30/(base*st);if((PR.zoom||1)<need)PR.zoom=Math.min(8,need);savePR();
      if(SEL){const tr=trById(SEL.tid);if(tr){SEL.st=stepOf(tr);SEL.fresh=true}}
      renderTimeline();if(SEL)requestAnimationFrame(()=>{const tl=q('#stTl');if(tl)tl.scrollLeft=Math.max(0,SEL.a*zoomPx()-40)});
      say(v==='1'?'Tap a lane to pick whole bars.':'Tap a lane to pick by the '+SELG.find(x=>x[0]===v)[1].toLowerCase()+'. Move steps by that much too.');break}
    case 'zin':PR.zoom=Math.min(8,(PR.zoom||1)*1.25);savePR();renderTimeline();break;
    case 'zout':PR.zoom=Math.max(.4,(PR.zoom||1)/1.25);savePR();renderTimeline();break;
    case 'mic':micStart(selTr());break;
    case 'bars':BARS.open(SEL&&SEL.tid===selTr().id?{a:origin()+SEL.a*BPB()*spb(),b:origin()+SEL.b*BPB()*spb()-1e-3}:null);break;
    case 'towrite':showView('cues');break;   // the old Write screen
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
    case 'recnow':closeSheet();toggleRec();break;
    case 'smooth':{try{localStorage.setItem('panyard-smooth',b.dataset.v)}catch{}say('Restarting to switch…');setTimeout(()=>location.reload(),600);break}
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
    if(['treble','bass','comp'].includes(k)&&!tr.fx.own){tr.fx.own=true;const b=t.closest('.tset').querySelector('[data-st=tone]');if(b){b.setAttribute('aria-pressed','false');b.querySelector('small').textContent='Off: your own tone. Tap to go back to the suggested one.'}}
    const sh=t.closest('.tsl')&&t.closest('.tsl').querySelector('[data-show]');if(sh)sh.textContent=k==='comp'?(v?Math.round(v*100)+'%':'Off'):k==='echo'?(v?Math.round(v/.6*100)+'%':'Off'):(v>0?'+':'')+Math.round(v)+' dB';return}
  if(t.dataset.mk){{const sh=t.closest('.tsl')&&t.closest('.tsl').querySelector('[data-show]'),v=+t.value,k=t.dataset.mk;if(sh)sh.textContent=k==='pan'?lr(v):k==='vol'?Math.round(v/1.2*100)+'%':Math.round(v/.6*100)+'%'}const k=t.dataset.mk,v=+t.value;if(k==='master'){song.master=v;if(master)master.gain.value=v}else{const tr=trById(t.closest('[data-tid]').dataset.tid);if(k==='mix')tr.mix=v;else tr[k]=k==='pan'&&Math.abs(v)<.03?0:v;if(ctx)channel(tr)}dirty()}
}
function onChange(e){
  const t=e.target;if(!song)return;
  if(t.id==='stStyle'&&t.value){const tr=selTr(),st=STYLES[t.value];pushHistory();Object.assign(tr,{rows:styleRows(st),len:st.len,swing:st.swing,unit:st.unit,style:t.value});dirty();renderInst();renderTimeline();
    say('Loaded '+st.name+'.'+(Math.abs(bpm()-st.bpm)>8?' It usually sits around '+st.bpm+' bpm; here it plays at your song\'s tempo.':''));AC()&&warmDrums()}
  if(t.id==='stAddRow'&&t.value){const tr=selTr();pushHistory();tr.rows.push({m:+t.value,steps:Array(tr.len).fill(0)});dirty();renderInst()}
  if(t.matches('[data-st-set]')&&selTr().type==='part'){partSet(t);return}
  if(t.matches('[data-st-set]')){const tr=selTr(),k=t.value;if(tr.type!=='pan'||k===trSet(tr))return;
    if(tr.notes.length&&!confirm(tr.name+' has '+tr.notes.length+' notes on the '+SETS[trSet(tr)].name+'. Switch to the '+SETS[k].name+' and clear them? (Undo brings them back.)')){t.value=trSet(tr);return}
    pushHistory();const old=SETS[trSet(tr)].name;tr.panSet=k;tr.notes=[];
    // a name the app gave it ("Low C Tenor", "Low C Tenor 2", "Pan taps") follows the pan; a name you typed stays
    if(tr.name===old||/^Pan taps/.test(tr.name)||(tr.name.startsWith(old+' ')&&/^\d+$/.test(tr.name.slice(old.length+1)))){let nm=SETS[k].name,i=1;while(song.tracks.some(t=>t!==tr&&t.name===nm))nm=SETS[k].name+' '+(++i);tr.name=nm}dirty();renderAll();say(tr.name+' now plays the '+SETS[k].name+'.');return}
  if(t.id==='stFile'){const f=t.files&&t.files[0];t.value='';if(f)importFile(selTr(),f)}
}
// My part plays the song's pan. Choosing another one changes the song's pan, and your notes go across by pitch:
// a note the new pan has stays, one it doesn't have is dropped (↶ Undo brings them back).
function partSet(sel){
  const k=sel.value,old=setKey();if(k===old||!SETS[k])return;
  const ids=new Map();for(const v of SETS[k].views)for(const f of v.fields)if(PITCH[f[0]])ids.set(midiOf(PITCH[f[0]]),f[0]);
  const to=id=>PITCH[id]?ids.get(midiOf(PITCH[id])):null;
  let all=0,kept=0;S.cues.forEach(c=>(c.steps||[]).forEach(id=>{all++;if(to(id))kept++}));
  if(all&&!confirm('Your part has '+all+' notes on the '+SETS[old].name+'. Switch the song to the '+SETS[k].name+'?\n\n'+(kept===all?'They all fit on it.':kept+' of them fit on it; the other '+(all-kept)+' are dropped.')+' (↶ Undo takes it back.)')){sel.value=old;return}
  pushHistory();
  S.cues=S.cues.map(c=>({...c,steps:(c.steps||[]).map(to).filter(Boolean)})).filter(c=>c.steps.length);
  S.panSet=k;applyPanSet();partCache=null;try{save();renderCues();if(typeof renderVoice==='function')renderVoice()}catch{}
  dirty();renderAll();say('Your part now plays the '+SETS[k].name+(all?' ('+kept+' of '+all+' notes kept).':'.'));
}
// a change made in the timing panel (now in Studio's Tempo sheet too) moves Studio's bars at once
{const _rg=renderGrid;renderGrid=function(){_rg.apply(this,arguments);if(song&&document.body.dataset.view==='studio'){partCache=null;try{renderTimeline();renderTransport()}catch{}}}}
function init(){
  BARS.onChange(()=>{partCache=null;if(song&&document.body.dataset.view==='studio')renderAll()});
  const v=q('#view-studio');if(!v)return;
  v.addEventListener('click',onClick);
  q('#stViews').addEventListener('click',e=>{const b=e.target.closest('[data-sv]');if(b)setView(b.dataset.sv)});v.addEventListener('input',onInput);v.addEventListener('change',onChange);
  v.addEventListener('pointerdown',e=>{const hd=e.target.closest('.st-hdl');if(hd){hdlDown(e,hd);return}const row=e.target.closest('.st-row[data-tid]');if(row&&e.target.closest('.st-lane')&&!e.target.closest('button'))laneTap(e,row)});
  v.addEventListener('click',e=>{const mb=e.target.closest('[data-selmore]');if(!mb)return;SELMORE=!SELMORE;const box=q('#stSel .st-selmore');if(box)box.hidden=!SELMORE;mb.setAttribute('aria-expanded',String(SELMORE));placeSel()});
  q('#stTl').addEventListener('scroll',()=>{if(SEL)placeSel()},{passive:true});
  window.addEventListener('scroll',()=>{if(SEL)placeSel()},{passive:true});
  q('#stRuler')||0;
  v.addEventListener('click',e=>{const r=e.target.closest('#stRuler');if(r){const x=e.clientX-r.getBoundingClientRect().left;seek(Math.floor(x/zoomPx())*BPB())}});
  const sh=document.createElement('div');sh.id='stSheet';sh.className='sheetov st-sheet';sh.hidden=true;sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');
  sh.innerHTML='<div class="sheetbox" id="stSheetBox"></div>';document.body.appendChild(sh);
  sh.addEventListener('click',e=>{if(e.target===sh){closeSheet();return}if(e.target.closest('#neGrid')){neTap(e);return}onClick(e)});
  sh.addEventListener('input',onInput);
  sh.addEventListener('pointerdown',e=>{if(e.target.closest('#stCalTap')){e.preventDefault();if(CAL.on)CAL.taps.push(tapT(e))}});
  sh.addEventListener('click',e=>{const b=e.target.closest('#stExWhat button,#stExFmt button,#stExPart button');if(!b)return;if(b.closest('#stExWhat'))EXP.what=b.dataset.v;else if(b.closest('#stExPart'))EXP.part=b.dataset.v;else EXP.fmt=b.dataset.v;renderSheet()},true);
  q('#stPlay').onclick=()=>{T.playing?stop(false):play(false)};
  q('#stHome').onclick=()=>seek(looping()?loopS():0);
  q('#stRec').onclick=toggleRec;
  q('#stMetro').onclick=()=>{song.metro=!song.metro;dirty();renderTransport()};
  q('#stCount').onclick=()=>{song.countIn=song.countIn===false;dirty();renderTransport()};
  q('#stLoop').onclick=()=>{pushHistory();if(cycOn())song.cycle.on=false;else song.cycle=SEL?{on:true,s:SEL.a,e:SEL.b}:song.cycle&&song.cycle.e>song.cycle.s?{...song.cycle,on:true}:{on:true,s:0,e:Math.min(4,bars())};dirty();restartIfPlaying();renderAll()};
  q('#stUndo').onclick=undo;q('#stRedo').onclick=redo;
  q('#stAdd').onclick=()=>openSheet('add');q('#stMix').onclick=()=>{AC();openSheet('mixer')};q('#stExp').onclick=()=>{if(typeof openShare==='function'){openShare(true);const t=$('expStudio');if(t)t.focus()}else openSheet('export')};q('#stTime').onclick=()=>{AC();openSheet('timing')};
  q('#stZin').onclick=()=>{PR.zoom=Math.min(8,(PR.zoom||1)*1.25);savePR();renderTimeline()};q('#stZout').onclick=()=>{PR.zoom=Math.max(.4,(PR.zoom||1)/1.25);savePR();renderTimeline()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!q('#stSheet').hidden)closeSheet()});
  window.addEventListener('resize',()=>{if(document.body.dataset.view==='studio'){renderTimeline();fitPans()}});
  window.addEventListener('resize',()=>requestAnimationFrame(placeSel));
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
return{arrangementData,refresh:()=>refreshGains(),stageMix:tr=>stageMix(tr),fxOf:tr=>fxOf(tr),zones:()=>zoneOn(),view:()=>VIEW,hearing:()=>song.tracks.filter(audible).map(t=>t.name),templates:()=>{AC();openSheet('tpl')},arrangement:()=>{AC();if(SH.kind==='arr'){closeSheet();return}openSheet('arr')},kit:id=>{const K=id?kitBuf(id):KIT;return{ok:K.ok,sounds:K.buf.size}},drumTracks:()=>song?song.tracks.filter(t=>t.type==='drums'||t.type==='beats').map(t=>({type:t.type,name:t.name,kit:t.kit||'real',notes:(t.notes||[]).map(n=>[n.p,n.t,n.v])})):[],parts:async()=>{await load();return chartParts()},songGeo:()=>song?songGeo():null,setPartText,tempoSheet:()=>{AC();openSheet('tempo')},trackSheet:id=>{AC();openSheet('track',id)},setTempo,get bpm(){return bpm()},pnotes,ck,BPB:()=>BPB(),enter,leave,exportSheet:()=>openSheet('export'),timingSheet:()=>{AC();openSheet('timing')},get song(){return song},T,play,stop,toggleRec,addTrack,openSheet,closeSheet,renderSong,partTrack,undo,redo,buffers,micStart,micStop,seek,beatNow,heardNow,pDur:()=>pBuf?pBuf.duration:null,writePart:()=>writePart(),selType:()=>song&&selTr()?selTr().type:null,setSpeed:r=>setSpeed(r),speed:()=>SPD.rate,bars};
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
