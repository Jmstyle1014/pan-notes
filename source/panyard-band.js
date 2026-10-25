
/* ---------- Band sounds: how your pans sound for this song (Pan sounds → Sound) ----------
   A band sound bends your recordings for one song without changing them: the pitch centre (A 432…446), Sweet ↔ Sharp
   (the top notes a hair sharp, the way bright Panorama pans are tuned), Tone, Ring, Stick (soft rubber ↔ hard), the room,
   and three effects: Shimmer (a second player a few cents away), Lo-fi (tape warmth, wobble, hiss) and Punch (evens
   out loud and soft). Start from a preset and shape it. When the song has a band recording its pitch follows the
   recording (Setup → Tuning) instead. Saved per song in localStorage 'panyard-band' (backed up with everything else).
   Per note (Play, the tuning pan, Studio): pitch, Sweet ↔ Sharp, Tone, Ring, Stick, Shimmer, and soft hits darker.
   Room, Lo-fi and Punch work on the tap sound (Studio has its own room and effects per track). While you tune
   (Pan sounds → Record & tune) notes play as recorded, so you hear the real thing. */
var BAND=(()=>{
  const PRESETS=[
    {id:'kitchen',name:'Kitchen session',em:'🏠',sub:'Your plain, honest pan',a:440,stretch:0,tone:0,ring:0,stick:0,shimmer:0,lofi:0,punch:0,room:'room'},
    {id:'panorama',name:'Panorama',em:'🏆',sub:'High, bright and sparkly, made to cut',a:442,stretch:5,tone:4,ring:-3,stick:6,shimmer:1,lofi:0,punch:1,room:'yard'},
    {id:'classical',name:'Classical',em:'🎻',sub:'Dead-centre, long and singing',a:440,stretch:0,tone:-1,ring:5,stick:-4,shimmer:0,lofi:0,punch:0,room:'hall'},
    {id:'lofi',name:'Lo-fi',em:'📼',sub:'Warm, soft, a little worn',a:432,stretch:0,tone:-6,ring:1,stick:-6,shimmer:0,lofi:1,punch:0,room:'dry'},
    {id:'tempo',name:'High tempo',em:'⚡',sub:'Short, punchy, in your face',a:440,stretch:3,tone:5,ring:-6,stick:5,shimmer:0,lofi:0,punch:1,room:'room'},
    {id:'rock',name:'Rock',em:'🎸',sub:'Hard stick, bright, pushed',a:440,stretch:2,tone:6,ring:-2,stick:8,shimmer:1,lofi:0,punch:1,room:'room'},
    // measured from the band's own practice recordings (tenor and seconds, the full band, the background pans):
    // tuned a hair sharp (A 441), long-singing notes, a warm top, the yard's long ring, and the hum of the other pans
    {id:'ouryard',name:'Our yard',em:'🇹🇹',sub:'The hum and air of your own panyard',a:441,stretch:1,tone:-2,ring:4,stick:-1,shimmer:1,lofi:0,punch:0,hum:1,air:1,body:6,room:'ouryard'},
  ];
  const KEYS=['a','stretch','tone','ring','stick','shimmer','lofi','punch','hum','air','body','room'];
  const ROOMS={dry:'Dry',room:'Room',yard:'Panyard',ouryard:'Our yard',hall:'Hall'};
  // the yard in those recordings rings on for about three seconds after the band stops
  SPACES.ouryard=SPACES.ouryard||{name:'Our yard',mix:0.3,decay:2.8,lowcut:100,bright:0};
  const K='panyard-band';let st={songs:{},own:[]};
  try{const x=JSON.parse(localStorage.getItem(K)||'null');if(x&&typeof x==='object'){if(x.songs&&typeof x.songs==='object')st.songs=x.songs;if(Array.isArray(x.own))st.own=x.own}}catch{}
  const keep=()=>{try{localStorage.setItem(K,JSON.stringify(st))}catch{}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function clean(b){if(!b||typeof b!=='object')return null;const o={};
    o.a=clamp(Math.round((+b.a||440)*10)/10,432,446);for(const k of['stretch'])o[k]=clamp(Math.round(+b[k]||0),-6,8);
    for(const k of['tone','ring','stick'])o[k]=clamp(Math.round(+b[k]||0),-10,10);o.body=clamp(Math.round(+b.body||0),0,10);for(const k of['shimmer','lofi','punch','hum','air'])o[k]=b[k]?1:0;
    o.room=ROOMS[b.room]?b.room:'room';o.from=String(b.from||'');o.name=String(b.name||'').slice(0,40);if(Number.isFinite(+b.prevA))o.prevA=+b.prevA;return o}
  const sid=()=>{try{return isDemo?'demo':songNow().id}catch{return 'demo'}};
  const forSong=()=>{const b=st.songs[sid()];return b?clean(b):null};
  const cards=()=>PRESETS.concat(st.own.map(o=>({...clean(o),id:o.id,name:o.name||'My band sound',em:'🥁',sub:'Your own',own:1})));
  // while you tune, a note plays as recorded
  const tuning=()=>typeof TW!=='undefined'&&TW.isOpen&&TW.tab==='tune';
  const now=()=>tuning()?null:forSong();
  // Sweet ↔ Sharp: notes above the middle of the pans a little sharp, the low ones a touch flat
  function cents(id){const b=now();if(!b||!b.stretch||!PITCH[id])return 0;return b.stretch*clamp((midiOf(PITCH[id])-66)/12,-1,2)*1.2}
  // the note's own fine-tuning with the band's Tone and Ring on top (and a slower attack for a soft stick)
  function tune(T){const b=now();if(!b)return T;const o=Object.assign({},T);
    o.ring=clamp((+T.ring||0)+b.ring,-10,10);o.tone=clamp((+T.tone||0)+b.tone,-10,10);if(b.stick<0)o.att=0.004+(-b.stick/10)*0.012;return o}

  /* one note's path: Tone (a shelf), then a lowpass for a soft stick or a soft hit, then a hard stick's bite that fades */
  function chain(ac,T,id,v,t,light){
    const b=now(),f=pitchHz(id)||440,nodes=[];
    const tn=toneNode(ac,T,id);if(tn)nodes.push(tn);
    const stick=b?b.stick:0;
    let fc=20000;if(v<0.9&&FEEL.s.sens)fc=Math.min(fc,f*(3+30*v*v));   // a soft hit is darker too, as on a real pan
    if(stick<0)fc=Math.min(fc,Math.max(f*3,18000*Math.pow(0.18,-stick/10)));
    if(fc<16000){const lp=ac.createBiquadFilter();lp.type='lowpass';lp.Q.value=0.5;lp.frequency.value=fc;nodes.push(lp)}
    if(stick>0&&!light){const pk=ac.createBiquadFilter();pk.type='peaking';pk.Q.value=0.9;pk.frequency.value=clamp(f*5,2500,7000);
      pk.gain.setValueAtTime(stick*0.7,t);pk.gain.setTargetAtTime(stick*0.2,t+0.03,0.08);nodes.push(pk)}
    // Drum body: the air in the barrel hums at f = v / 4(L + 0.3d) (a tube closed at the playing surface, open at the
    // bottom; G-Pan patent, US 7,750,220), and at 3 times that. A long bass skirt hums low, a short tenor skirt high.
    // Each note gets a lift round its own pan's body note.
    const bd=b&&b.body?BODY[(FIELDS.get(id)||{}).set||'guitar']:0;
    if(bd&&!light){const amt=b.body/10;for(const [fq,gn] of [[bd,5.5*amt],[bd*3,2.5*amt]]){const pk=ac.createBiquadFilter();pk.type='peaking';pk.Q.value=2.2;pk.frequency.value=fq;pk.gain.value=gn;nodes.push(pk)}}
    // Note covers (How you play): a thin soft pad on the outer and middle rings, as in the G-Pan patent, so the low
    // notes start rounder (no clang) while the centre notes stay crisp
    if(covered(id)&&!light){const lp=ac.createBiquadFilter(),g=ac.createGain();lp.type='lowpass';lp.Q.value=0.4;
      lp.frequency.setValueAtTime(Math.min(16000,f*5),t);lp.frequency.exponentialRampToValueAtTime(18000,t+0.09);
      g.gain.setValueAtTime(0.45,t);g.gain.linearRampToValueAtTime(1,t+0.03);nodes.push(lp,g)}
    for(let i=1;i<nodes.length;i++)nodes[i-1].connect(nodes[i]);
    return nodes.length?{in:nodes[0],out:nodes[nodes.length-1]}:null;
  }
  const COVER_SETS=['tenor','dten','dsec'];
  // each pan's body note in Hz, from its skirt length (inches) and a 22.5 in drum: 343 / (4 (L + 0.3 d))
  const SKIRT_IN={tenor:6,dten:7,dsec:9,guitar:16,fcello:18,six:34,seven:34};   // a four cello's skirt is about a guitar's, a little longer
  const BODY=Object.fromEntries(Object.entries(SKIRT_IN).map(([k,L])=>[k,Math.round(343/(4*(L*.0254+0.3*22.5*.0254)))]));
  function covered(id){if(!FEEL.s.covers)return false;const F=FIELDS.get(id);return !!(F&&COVER_SETS.includes(F.set)&&/\b(outer|middle)\b/.test(F.pos||''))}
  const shimmerOn=light=>{const b=now();return !!(b&&b.shimmer&&!light)};

  /* Room, Lo-fi and Punch on the tap sound: they sit between the pans and the room (your sound profile's chain) */
  const G={};
  function route(){
    if(!FX.ac||!pBus)return;const ac=FX.ac,b=forSong(),t=ac.currentTime;
    if(!G.lp){G.lp=ac.createBiquadFilter();G.lp.type='lowpass';G.lp.frequency.value=3200;G.lp.Q.value=0.4;
      G.dl=ac.createDelay(0.05);G.dl.delayTime.value=0.004;G.lfo=ac.createOscillator();G.lfo.frequency.value=0.7;G.lfoG=ac.createGain();G.lfoG.gain.value=0.0009;G.lfo.connect(G.lfoG);G.lfoG.connect(G.dl.delayTime);G.lfo.start();
      G.cp=ac.createDynamicsCompressor();G.cp.threshold.value=-24;G.cp.ratio.value=5;G.cp.attack.value=0.003;G.cp.release.value=0.12;G.cp.knee.value=6;G.mk=ac.createGain();G.mk.gain.value=1.6;G.cp.connect(G.mk);
      G.lp.connect(G.dl);G.sig=''}
    if(!G.a0){   // Yard air: the warm, soft top of the recordings (a little low-mid body, a little presence, the top rolled off)
      const mk=(ty,fr,gn,q)=>{const x=ac.createBiquadFilter();x.type=ty;x.frequency.value=fr;x.gain.value=gn;if(q)x.Q.value=q;return x};
      G.a0=mk('lowshelf',220,2);G.a1=mk('peaking',1100,2,1);G.a2=mk('highshelf',3000,-6);G.a0.connect(G.a1);G.a1.connect(G.a2);
      G.hc=ac.createConvolver();G.hc.normalize=false;G.hg=ac.createGain();G.hg.gain.value=0;G.hc.connect(G.hg);G.key=''}
    const lofi=!!(b&&b.lofi),punch=!!(b&&b.punch),air=!!(b&&b.air),hum=!!(b&&b.hum),sig=lofi+','+punch+','+air+','+hum;
    if(sig!==G.sig){G.sig=sig;
      try{pBus.disconnect()}catch{}try{G.dl.disconnect()}catch{}try{G.mk.disconnect()}catch{}try{G.a2.disconnect()}catch{}try{G.hg.disconnect()}catch{}
      let head=pBus;if(air){head.connect(G.a0);head=G.a2}
      if(hum){head.connect(G.hc);G.hg.connect(FX.hp)}
      if(lofi){head.connect(G.lp);head=G.dl}if(punch){head.connect(G.cp);head=G.mk}head.connect(FX.hp)}
    // Yard hum: the pans around you ring along, in the song's key
    if(hum){const k=keyOf(),ks=k.map(v=>v.toFixed(2)).join(',');if(ks!==G.key){G.key=ks;G.hc.buffer=humIR(ac,k)}}
    G.hg.gain.setTargetAtTime(hum?0.9:0,t,0.08);
    // tape hiss, only while Lo-fi is on
    if(lofi&&!G.hiss){const n=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      const s=ac.createBufferSource(),hp=ac.createBiquadFilter(),g=ac.createGain();s.buffer=n;s.loop=true;hp.type='highpass';hp.frequency.value=3000;g.gain.value=0;g.gain.setTargetAtTime(0.004,t,0.1);
      s.connect(hp);hp.connect(g);g.connect(FX.dry);s.start();G.hiss={s,g}}
    else if(!lofi&&G.hiss){const h=G.hiss;G.hiss=null;h.g.gain.setTargetAtTime(0,t,0.05);try{h.s.stop(t+0.3)}catch{}}
  }
  /* Yard hum. In the recordings the yard never goes quiet: between hits it's only 6 to 9 dB below the loud
     moments, and what keeps ringing are the song's key notes (the other pans answering what's played). Here every
     note you play passes through a set of quiet, slowly fading tones on the song's key notes, so a note in the key
     sets them humming and a note outside it barely does, like the pans around you. */
  // the song's key notes, weighted by how much they're played; a song with few notes uses the recordings' own
  const YARD=[1,.85,.1,.7,.1,.55,.1,.2,.85,.1,.75,.5];
  function keyOf(){
    const w=new Array(12).fill(0);let n=0;
    try{for(const c of S.cues||[])for(const id of c.steps||[]){const p=PITCH[id];if(!p)continue;const m=midiOf(p);if(!Number.isFinite(m))continue;w[((m%12)+12)%12]+=Math.min(2,c.duration||0.5)+0.3;n++}}catch(e){}
    if(n<8)return YARD.slice();const mx=Math.max(...w)||1;return w.map(v=>Math.round(v/mx*20)/20);
  }
  function humIR(ac,w){
    const sr=ac.sampleRate,L=Math.round(sr*4.5),ir=ac.createBuffer(2,L,sr);let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    const ps=[];for(let pc=0;pc<12;pc++){if(w[pc]<0.3)continue;for(let m=36+pc;m<=84;m+=12){const ow=Math.exp(-Math.pow((m-60)/12,2));if(ow<0.05)continue;ps.push({m,a:w[pc]*ow})}}
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);
      for(const p of ps){const f=440*Math.pow(2,(p.m-69)/12+(rnd()-0.5)*8/1200),tau=1+rnd()*1.3,ph=rnd()*6.283,att=0.03+rnd()*0.05,step=6.283*f/sr;
        for(let i=0;i<L;i++){const t=i/sr;d[i]+=p.a*Math.min(1,t/att)*Math.exp(-t/tau)*Math.sin(ph+step*i)}}}
    // about as loud overall as the note that sets it off
    let e=0;const d0=ir.getChannelData(0);for(let i=0;i<L;i++)e+=d0[i]*d0[i];const g=e>0?0.03/Math.sqrt(e):0;
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<L;i++)d[i]*=g}
    return ir;
  }
  // the band's room takes the place of the sound profile's room for this song
  const _ap=applyFx;applyFx=function(){_ap.apply(this,arguments);if(!FX.ac)return;route();const b=forSong();if(!b)return;
    const R=SPACES[b.room]||SPACES.room,t=FX.ac.currentTime;
    FX.dry.gain.setTargetAtTime(1-R.mix*0.5,t,0.03);FX.wet.gain.setTargetAtTime(R.mix*1.6,t,0.03);
    if(R.mix>0&&FX.decay!==R.decay){FX.conv.buffer=makeIR(FX.ac,R.decay);FX.decay=R.decay}};
  const apply=()=>{try{applyFx()}catch{}};
  // another song may have another band sound
  {const _so=songOpen;songOpen=async function(){const r=await _so.apply(this,arguments);apply();if(open)render();return r}}

  /* choosing and shaping */
  const hasRec=()=>typeof hasAudio!=='undefined'&&!!hasAudio&&curName!=='Your part';
  function setA(a){if(hasRec())return;S.refA=a;save_();try{TUNE_A.render()}catch{}}
  function save_(){try{window.save()}catch{}}
  function use(card){
    const cur=st.songs[sid()],prevA=cur&&Number.isFinite(+cur.prevA)?+cur.prevA:REF_A();
    if(!card){if(cur){delete st.songs[sid()];keep();if(!hasRec())setA(prevA)}apply();render();return}
    const b=clean({...card,from:card.id,name:card.name,prevA});st.songs[sid()]=b;keep();setA(b.a);apply();render();riff();
  }
  function edit(k,v){const b=forSong();if(!b)return;b[k]=v;st.songs[sid()]=b;keep();if(k==='a')setA(b.a);apply()}
  const cardOf=id=>cards().find(c=>c.id===id);
  function resetCard(){const b=forSong();if(!b)return;const c=cardOf(b.from);if(!c){msg('This band sound has nothing to go back to.');return}use(c);msg('Back to '+c.name+' as it started.')}
  function saveOwn(){const b=forSong();if(!b)return;const id='own'+Date.now().toString(36);const name=(b.name&&!PRESETS.some(p=>p.name===b.name)?b.name:'My band sound '+(st.own.length+1));
    const o={id,name};KEYS.forEach(k=>o[k]=b[k]);st.own.push(o);b.from=id;b.name=name;st.songs[sid()]=b;keep();render();msg('Saved as “'+name+'”. Pick it for any song.')}
  function dropOwn(id){st.own=st.own.filter(o=>o.id!==id);for(const b of Object.values(st.songs))if(b&&b.from===id)b.from='';keep();render();msg('Band sound deleted. Songs using it keep their sound.')}

  // hear it: a short line on this song's pan, low to high and back, then a rolled chord
  let rt=[];
  function riff(){
    rt.forEach(clearTimeout);rt=[];
    const set=SETS[setKey()];if(!set)return;
    const ids=set.views.flatMap(v=>v.fields.map(f=>f[0])).filter(id=>PITCH[id]).sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b]));if(!ids.length)return;
    const mid=Math.floor(ids.length*0.35),pick=k=>ids[clamp(mid+k,0,ids.length-1)],bt=300;
    const L=[[0,0],[2,1],[4,2],[5,3],[4,4],[2,5.5],[3,6],[4,7],[7,8]];
    L.forEach(([k,b])=>rt.push(setTimeout(()=>{try{strike(pick(k),0.9)}catch{}},b*bt/2)));
    const ch=[0,2,4];for(let r=0;r<8;r++)ch.forEach((k,i)=>rt.push(setTimeout(()=>{try{strike(pick(k),0.45+((r*7+i)%5)/20,r>0)}catch{}},9*bt/2+400+r*75+i*12)));
  }

  /* the card in Pan sounds → Sound */
  let open=false;
  const msg=t=>{const m=$('bandMsg');if(m){m.textContent=t;clearTimeout(msg.t);msg.t=setTimeout(()=>{if(m.textContent===t)m.textContent=''},4000)}};
  const CTL=[['a','Pitch centre','A in hertz: 440 is standard',432,446,1,v=>'A '+v,['lower','higher']],['stretch','Sweet ↔ Sharp','top notes a hair sharp, like a bright Panorama pan',-6,8,1,v=>(v>0?'+':'')+v,['sweet','sharp']],
    ['tone','Tone','',-10,10,1,v=>(v>0?'+':'')+v,['darker','brighter']],['ring','Ring','how long notes sing',-10,10,1,v=>(v>0?'+':'')+v,['shorter','longer']],['stick','Stick','soft rubber ↔ hard',-10,10,1,v=>v<-3?'soft':v>3?'hard':'medium',['soft','hard']],
    ['body','Drum body','the air inside the barrel: a fuller bass, a tighter tenor',0,10,1,v=>v?v:'off',['off','strong']]];
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function html(){
    const b=forSong(),cs=cards();
    let h='<div class="twsh"><h3>Band sound for this song</h3><p>Shape how your pans sound for <b>'+esc(S.title||'this song')+'</b>: bright for Panorama, soft for a ballad, in tune with a band. Your recordings stay as they are.</p></div>'
      +'<div class="bandcards" role="group" aria-label="Band sounds">'
      +'<button class="bcard" data-b="" aria-pressed="'+!b+'"><span class="em">🎙</span><b>As recorded</b><small>No band sound</small></button>'
      +cs.map(c=>'<button class="bcard" data-b="'+esc(c.id)+'" aria-pressed="'+!!(b&&b.from===c.id)+'"><span class="em">'+c.em+'</span><b>'+esc(c.name)+'</b><small>'+esc(c.sub)+'</small><span class="hz">A '+c.a+'</span></button>').join('')
      +'</div>';
    if(b){const rec=hasRec(),src=cardOf(b.from);
      h+='<div class="bandctl"><div class="bandnow"><b>'+esc(b.name||(src&&src.name)||'Band sound')+'</b>'+(src?'':'<small> (shaped for this song)</small>')+'<button class="btn" id="bandHear">▶ Hear it</button></div>'
        +'<div class="grp">Tuning</div>'
        +(rec?'<div class="bandrec">🎧 <span><b>Pitch follows your band recording</b> (A = '+(+REF_A().toFixed(1))+'), so you stay in tune with it. Change it in Setup → Tuning.</span></div>':sl(CTL[0],b))
        +sl(CTL[1],b)+'<div class="grp">Sound</div>'+CTL.slice(2).map(c=>sl(c,b)).join('')
        +'<div class="grp">Room</div><div class="seg" id="bandRoom">'+Object.entries(ROOMS).map(([k,n])=>'<button data-room="'+k+'" aria-pressed="'+(b.room===k)+'">'+n+'</button>').join('')+'</div>'
        +'<div class="grp">Effects</div>'+[['hum','Yard hum','the pans around you ring along, in the song\'s key'],['air','Yard air','the warm, soft top of a real yard'],['shimmer','Shimmer','a second player, slightly detuned'],['lofi','Lo-fi','tape warmth, wobble and hiss'],['punch','Punch','evens out loud and soft notes']].map(([k,l,s])=>'<div class="tog"><span><b>'+l+'</b><small>'+s+'</small></span><button class="sw" role="switch" data-tog="'+k+'" aria-checked="'+!!b[k]+'" aria-label="'+l+'"></button></div>').join('')
        +'<p class="bandnote">Room, Yard hum, Yard air, Lo-fi and Punch shape the tap sound. Studio tracks keep their own room and effects.</p>'
        +'<div class="bandbtns"><button class="btn" id="bandReset"'+(src?'':' disabled')+'>↺ Reset</button><button class="btn" id="bandOwn">＋ Save as my own</button>'+(src&&src.own?'<button class="btn" id="bandDrop">Delete “'+esc(src.name)+'”</button>':'')+'</div></div>'}
    return h+'<p class="twmsg" id="bandMsg" aria-live="polite"></p>';
  }
  function sl([k,l,sb,mn,mx,stp,fm,ends],b){return '<div class="sl"><label for="band-'+k+'">'+l+(sb?'<small>'+sb+'</small>':'')+'</label><input type="range" id="band-'+k+'" data-k="'+k+'" min="'+mn+'" max="'+mx+'" step="'+stp+'" value="'+b[k]+'"><output id="bando-'+k+'">'+fm(b[k])+'</output><div class="ends"><span>'+ends[0]+'</span><span>'+ends[1]+'</span></div></div>'}
  function render(){const box=$('bandBox');if(!box)return;box.innerHTML=html()}
  function mount(){
    const snd=$('twSound');if(!snd)return;open=true;
    if(!$('bandBox')){const box=document.createElement('section');box.className='bandbox';box.id='bandBox';
      snd.prepend(box);   // above the sound profile (which is for every song)
      if(!$('feelBox')){box.insertAdjacentHTML('afterend',FEEL.card());FEEL.wire($('feelBox'))}
      box.addEventListener('click',e=>{
        const c=e.target.closest('[data-b]');if(c){const id=c.dataset.b;use(id?cardOf(id):null);if(!id)msg('As recorded: your pans with no band sound.');return}
        const r=e.target.closest('[data-room]');if(r){edit('room',r.dataset.room);render();riff();return}
        const t=e.target.closest('[data-tog]');if(t){const b=forSong();if(!b)return;edit(t.dataset.tog,b[t.dataset.tog]?0:1);render();riff();return}
        if(e.target.closest('#bandHear')){riff();return}
        if(e.target.closest('#bandReset')){resetCard();return}
        if(e.target.closest('#bandOwn')){saveOwn();return}
        if(e.target.closest('#bandDrop')){const b=forSong();if(b&&b.from)dropOwn(b.from)}});
      box.addEventListener('input',e=>{const k=e.target.dataset.k;if(!k)return;const v=+e.target.value;edit(k,v);const c=CTL.find(x=>x[0]===k);const o=$('bando-'+k);if(o&&c)o.textContent=c[6](v)});
      box.addEventListener('change',e=>{if(e.target.dataset.k)riff()})}
    render();
  }
  // Pan sounds opens: the card is there (and up to date) on the Sound tab
  setTimeout(()=>{if(typeof TW==='undefined')return;const _o=TW.open;TW.open=function(){const r=_o.apply(this,arguments);try{mount()}catch(e){console.error(e)}return r}},0);
  // backup files carry this song's band sound (Google Drive backup has all of them)
  setTimeout(()=>{const be=window.backupExtra;window.backupExtra=async()=>{const o=be?await be():{};const b=forSong();if(b)o.band=b;return o};
    const bi=window.backupIn;window.backupIn=async p=>{const m=bi?await bi(p):'';const b=p&&clean(p.band);if(b){st.songs[sid()]=b;keep();apply();return m+' Band sound added.'}return m}},0);
  return {PRESETS,keyOf,covered,BODY,now,forSong,cents,tune,chain,shimmerOn,use:id=>use(id?cardOf(id):null),edit,riff,mount,apply,get open(){return open}};
})();

/* ---------- Settings: Band sound (this song) and How you play, one tap from the list ----------
   Each opens Pan sounds on its Sound tab, at its own card. */
{
  const row=(k,ic,col,label,val,sub)=>'<button class="sxrow" data-row="'+k+'"><span class="sxic" style="background:'+col+'" aria-hidden="true">'+ic+'</span><span class="sxlab"><b>'+label+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</span><span class="sxval">'+val+'</span><span class="sxchev" aria-hidden="true">›</span></button>';
  const esc2=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function add(){
    const list=$('setList');if(!list||typeof TW==='undefined')return;const g=list.querySelectorAll('.sxgroup .sxbox');if(g.length<2)return;
    const b=BAND.forSong(),f=FEEL.s,sens=['Off','A little','A little','A little','Some','Some','Some','A lot','A lot','Very','Very'][f.sens];
    if(!list.querySelector('[data-row=band]'))g[0].insertAdjacentHTML('beforeend',row('band','🥁','#ff8fa3','Band sound',b?esc2(b.name||'Shaped'):'As recorded','How your pans sound in this song'));
    if(!list.querySelector('[data-row=feel]')){const after=g[1].querySelector('[data-row=play]');const h=row('feel','👆','#7be0c3','How you play','Dynamics: '+sens,'Hit strength, roll, sound awake');if(after)after.insertAdjacentHTML('afterend',h);else g[1].insertAdjacentHTML('afterbegin',h)}
  }
  const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();try{add()}catch(e){console.warn(e)}};
  function openAt(id){TW.open(true);TW.tabTo('sound');setTimeout(()=>{const x=$(id);if(x)x.scrollIntoView({block:'start',behavior:'smooth'})},120)}
  document.addEventListener('click',e=>{const r=e.target.closest&&e.target.closest('#setList [data-row=band],#setList [data-row=feel]');if(!r)return;e.stopPropagation();e.preventDefault();openAt(r.dataset.row==='band'?'bandBox':'feelBox')},true);
}
