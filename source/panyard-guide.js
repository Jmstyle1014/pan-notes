/* ---------- Guides: search the help, and walk-throughs that take you to the right spot and show you what to tap ---------- */
// The ? button opens "Guides & help". A guide moves you to the right screen, puts a ring round the button to tap, and
// moves on by itself when you tap it (or press Next). Tips (on/off) offer a guide the first time you open a screen.
var GUIDE={   // var: other parts can ask about it early
  K:'panyard-guide',
  st:null,
  load(){try{this.st=Object.assign({tips:1,seen:{}},JSON.parse(localStorage.getItem(this.K)||'{}'))}catch{this.st={tips:1,seen:{}}}return this.st},
  save(){try{localStorage.setItem(this.K,JSON.stringify(this.st))}catch{}},
  q:s=>document.querySelector(s),
  vis(el){if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'},
  find(sel){if(!sel)return null;if(typeof sel==='function')return sel();for(const e of document.querySelectorAll(sel))if(this.vis(e))return e;return null},
  closeAll(){try{openHelp(false)}catch{}try{if(!$('shareSheet').hidden)openShare(false)}catch{}try{if(!$('recSheet').hidden)openRec(false)}catch{}
    try{GB.menu(false)}catch{}try{WB.pop(null)}catch{}try{if(!$('songsSheet').hidden)openSongs(false)}catch{}},
  studio(view){if(document.body.dataset.view!=='studio')showView('studio');
    setTimeout(()=>{const cur=STUDIO.view?STUDIO.view():(document.body.classList.contains('st-inst')?'inst':'tracks');if(view&&view!==cur){const b=document.querySelector('#gbView [data-v="'+view+'"]');if(b)b.click()}},120)},
  closeStudioSheet(){const s=$('stSheet');if(s&&!s.hidden){const d=s.querySelector('[data-st=close]');if(d)d.click()}},

  /* the walk-throughs. Each step: where to go (go), what to ring (el), what to say, and what moves it on (tap / change) */
  TOURS:[
    {id:'app',title:'Find your way round',blurb:'The Home screen and the five tabs, in a minute.',kw:'start begin tour overview tabs home navigate menu new',steps:[
      {go:()=>showView('home'),el:'#hmNew',t:'New song',x:'Start a song here. Give it a name, then add the band’s recording.'},
      {go:()=>showView('home'),el:'#hmRec',t:'Record your pans',x:'Record each note of your real pan, so the app plays with your pan’s sound.'},
      {go:()=>showView('home'),el:'#hmJust',t:'Just play',x:'Jump straight to the pans and play, no song needed.'},
      {go:()=>showView('home'),el:'[data-tab=play]',t:'Play',x:'Practise along with the song: your notes fall down to the line as they’re played.'},
      {go:()=>showView('home'),el:'[data-tab=write]',t:'Write',x:'Put your notes in: tap the pans along with the recording, then tidy them up.'},
      {go:()=>showView('home'),el:'[data-tab=studio]',t:'Studio',x:'Record in layers over the song: mic takes, pan taps, beats.'},
      {go:()=>showView('home'),el:'[data-tab=chart]',t:'Chart',x:'Your part written out like a notebook, ready to share as a PDF.'},
      {go:()=>showView('home'),el:'#hmSetup',t:'Setup',x:'Your pan, its look and sounds, the recording, and backups.'},
      {go:()=>showView('home'),el:'#hmGuide',t:'Guides live here',x:'Search the help or start another walk-through from here, or from ? at the top of Play and Chart, and the ⋯ menus in Write and Studio.'}]},
    {id:'load',title:'Load your first recording',blurb:'Bring in the band’s recording from your phone.',kw:'recording load audio mp3 file import song upload add first',steps:[
      {go:()=>showView('home'),el:'#hmNew',t:'Start a song (optional)',x:'Making a new song? Tap New song and name it. Already in the right song? Press Next.',tap:1,after:900},
      {el:'#roleSheet .role-sh',skipIf:()=>{const r=$('roleSheet');return !r||r.hidden},t:'Name it',x:'Type the song’s name, choose its pan, then tap Create song.',wait:()=>{const r=$('roleSheet');return !r||r.hidden}},
      {go:()=>{showView('setup');SETUP.show('rec')},el:()=>{const f=$('audioFile');return f&&f.closest('label')},t:'Choose a recording',x:'Tap here and pick the recording from your Files or Downloads: MP3, M4A, WAV, or a video of the rehearsal.',change:'#audioFile'},
      {go:()=>{showView('setup');SETUP.show('rec')},el:'#playBtn',t:'Have a listen',x:'Your recording is in. Tap ▶ to hear it.',tap:1},
      {go:()=>showView('home'),el:'[data-tab=write]',t:'Next: your notes',x:'Open Write to find the tempo and tap in your part. The “Find the tempo” guide shows you how.',end:'tempo'}]},
    {id:'tempo',title:'Find the tempo',blurb:'Get the bars lined up with the music.',kw:'tempo bpm bars beat timing metronome snap',steps:[
      {go:()=>{GUIDE.closeAll();showView('cues');setTimeout(()=>WB.sheet('timing'),150)},el:'#autoTempo',t:'Find the tempo for me',x:'Tap this. The app listens to the drums in your recording and puts the bar lines on the beat.',tap:1,after:1500},
      {go:()=>{showView('cues');setTimeout(()=>WB.sheet('timing'),150)},el:'#wbSheet',t:'Check it',x:'Play the song: the click should sit on the beat. If it’s a little off, nudge the bar line with ◀ ▶.'},
      {go:()=>{WB.sheet(null)},el:'#wbLcd,#wbMore',t:'Your tempo',x:'Come back to Timing any time: tap the tempo in the top bar, or ⋯ → Tempo & timing.'}]},
    {id:'write',title:'Write your part',blurb:'Tap along on the pans and every hit becomes a note.',kw:'write cues notes tap along part record notes timeline undo clear',steps:[
      {go:()=>{GUIDE.closeAll();showView('cues')},el:'#wbRec',t:'Tap along',x:'Tap this: the song starts. Play the pans on screen as you hear each note. Hold a note for a roll, two fingers for a chord.',tap:1},
      {go:()=>showView('cues'),el:'#wbPlay',t:'Stop',x:'Tap to stop. The notes you played are now on the timeline.',tap:1},
      {go:()=>showView('cues'),el:'#wbUndo',t:'Undo',x:'Made a mistake? Undo takes it back, one step at a time.'},
      {go:()=>showView('cues'),skipIf:()=>!GUIDE.find('#wbView'),el:'#wbView',t:'See the timeline',x:'Switch between the pans and the timeline to drag notes, or change how long they last.'},
      {go:()=>showView('cues'),el:'#wbMore',t:'More',x:'Speed, snapping, Edit in bars, Clear all cues, and sharing are all in here.'}]},
    {id:'studio',title:'How Studio works',blurb:'Tracks, playing, the click, loops and the mixer.',kw:'studio tracks layers how it works mixer metronome click loop overview daw',steps:[
      {go:()=>{GUIDE.closeAll();GUIDE.studio('tracks')},el:'.st-row[data-tid]',t:'Tracks',x:'Each row is a track. Track 1 is your recording; add more on top (a mic take, pans, a beat), and they all play together.'},
      {go:()=>GUIDE.studio('tracks'),el:'#stPlay',t:'Play',x:'Plays every track from the playhead. Tap the ruler to move it.'},
      {go:()=>GUIDE.studio('tracks'),el:'#stRec',t:'Record',x:'Records onto the selected track. A bar of clicks counts you in first.'},
      {go:()=>GUIDE.studio('tracks'),el:'#gbMetro',t:'The click',x:'Tap for the metronome on or off. Hold it for the tempo.'},
      {go:()=>GUIDE.studio('tracks'),el:'#gbLoop',t:'Loop',x:'Loops the bars you select, so you can go over one bit again and again.'},
      {go:()=>GUIDE.studio('tracks'),el:'#gbView',t:'Pans or Tracks',x:'Switch between the instrument you play (the pans, or the mic) and the list of tracks. The one you\'re on is lit.'},
      {go:()=>GUIDE.studio('tracks'),el:'#gbMix,#gbMore',t:'Mixer',x:'Each track’s volume, left/right, and reverb (in ⋯ on a narrow screen).'},
      {go:()=>GUIDE.studio('tracks'),el:'#gbMore',t:'More',x:'Count-in, undo, Export / share, and ⏱ Timing fix. Run Timing fix once so your taps land on the beat.'},
      {go:()=>GUIDE.studio('tracks'),el:'[data-st=addsheet]',t:'Add a track',x:'Ready for more? Try the “Add a pan track” or “Record yourself” guides.'}]},
    {id:'build',title:'Build a song',blurb:'Start from a template: sections, a track for each part of the band, and a groove.',kw:'build song template arrangement panorama road march calypso bomb jam sections verse chorus intro structure producer',steps:[
      {go:()=>{GUIDE.closeAll();GUIDE.closeStudioSheet();GUIDE.studio('tracks');setTimeout(()=>STUDIO.templates(),250)},el:'.st-tplc',t:'Pick a template',x:'Each template is a song shape bands really use. Panorama runs intro, verse, chorus, then variations, a jam, a minor section and a big recap. Road march and calypso alternate verses and choruses. Tap one.',tapIn:'.st-tplc'},
      {go:()=>{GUIDE.closeStudioSheet();GUIDE.studio('song')},el:'.st-songb',t:'The Song tab',x:'Your song has its own tab. Each section is a block, with a little stripe for each layer that lights up once it has notes. Play here plays only what\u2019s in the sections.'},
      {go:()=>GUIDE.studio('song'),el:'#stSongBar',t:'Section tools',x:'Tap a block to loop it. The bar above then has Fill from takes, Move, Duplicate, Rename and Delete for that section. ＋ Section adds a new one at the end.'},
      {go:()=>{GUIDE.closeStudioSheet();GUIDE.studio('tracks')},el:'#gbView [data-v="tracks"]',t:'Takes',x:'Record your ideas on Takes. Play there plays only your takes and the band recording, so you can try things without touching the song.'},
      {go:()=>GUIDE.studio('tracks'),el:'#stRec',t:'Build it up',x:'Record a few bars on a take, pick the best ones, then ＋ Add to… a section. Or, on the Song tab, loop a section and use Fill from takes.'},
      {go:()=>GUIDE.studio('song'),el:'#stPlay',t:'Hear the song',x:'On the Song tab, turn the loop off and play from the start to hear your arrangement. Undo takes back any step.'}]},
    {id:'pan',title:'Add a pan track and play it',blurb:'Pick your pan, then play it on screen into Studio.',kw:'add track pick pan choose pan tenor guitar cello bass six dsec double second play record pans studio',steps:[
      {go:()=>{GUIDE.closeAll();GUIDE.closeStudioSheet();GUIDE.studio('tracks')},el:'[data-st=addsheet]',t:'+ Track',x:'Tap + Track to add a new layer.',tap:1},
      {go:()=>{if(!$('stSheet')||$('stSheet').hidden){GUIDE.studio('tracks');setTimeout(()=>{const b=GUIDE.find('[data-st=addsheet]');if(b)b.click()},250)}},el:'.st-addpans',t:'Pick your pan',x:'Under Pan taps, tap the pan you play: tenor, double second, guitar, cello or bass.',tapIn:'.st-addp button'},
      {go:()=>GUIDE.studio(),el:'#stRec',t:'Record',x:'Tap Record. After the count-in, play the pans on screen with the song.',tap:1},
      {go:()=>GUIDE.studio(),el:'#stRec',t:'Stop',x:'Tap again to stop. Every hit is now a note you can move or edit.',tap:1},
      {go:()=>GUIDE.studio('tracks'),el:'#gbView',t:'See your take',x:'Switch to Tracks to see it. Tap a lane to select bars, then move, copy, loop or Edit notes.'}]},
    {id:'mic',title:'Record yourself',blurb:'A mic take in Studio: you, a singer, or another pan.',kw:'record mic microphone voice singer take audio studio headphones first recording',steps:[
      {go:()=>{GUIDE.closeAll();GUIDE.closeStudioSheet();GUIDE.studio('tracks')},el:'[data-st=addsheet]',t:'+ Track',x:'Tap + Track.',tap:1},
      {go:()=>{if(!$('stSheet')||$('stSheet').hidden){GUIDE.studio('tracks');setTimeout(()=>{const b=GUIDE.find('[data-st=addsheet]');if(b)b.click()},250)}},el:'[data-st=addk][data-v=audio]',t:'Mic',x:'Choose Mic or audio file.',tap:1},
      {go:()=>GUIDE.studio(),el:'#stRec',t:'Headphones on, then Record',x:'Use headphones so the song doesn’t leak into the mic. Tap Record; a bar of clicks counts you in. The first time, it may ask for a quick timing check: do it once.',tap:1},
      {go:()=>GUIDE.studio(),el:'#stRec',t:'Stop',x:'Tap again to stop. Your take lands on its own track, in time with the song.',tap:1},
      {go:()=>GUIDE.studio(),el:'#gbMix,#gbMore',t:'Balance it',x:'Open the Mixer (in ⋯ on a narrow screen) to set its volume against the band.'}]},
    {id:'sounds',title:'Record your real pan sounds',blurb:'Make the app sound like your own pan.',kw:'record sounds my pan notes samples tuning sound profile make my pans sound',steps:[
      {go:()=>{GUIDE.closeAll();showView('home')},el:'#hmRec',t:'Record your pans',x:'Tap here.',tap:1,after:500},
      {go:()=>{if($('recSheet').hidden)openRec(true)},el:'#recSheet .sheetbox',t:'One note at a time',x:'Tap a note on the drawing, tap Record, and hit that note once on your real pan. Let it ring. Next ▶ goes to the next one. Then ✨ Make my pans sound their best tidies them all up.'}]},
    {id:'share',title:'Share your chart',blurb:'Send the band a PDF, a picture or a video.',kw:'share chart pdf send band arrangement export video whatsapp',steps:[
      {go:()=>{GUIDE.closeAll();showView('part')},el:'#sheet',t:'Your chart',x:'Your part written out: stacks are notes played together, ×2 means play it twice.'},
      {go:()=>showView('part'),skipIf:()=>!GUIDE.find('#shareBtnTop'),el:'#shareBtnTop',t:'Share',x:'Tap Share.',tap:1,after:500},
      {go:()=>{if($('shareSheet').hidden)openShare(true)},el:'#shareSheet .sheetbox',t:'Pick what to send',x:'The chart as a PDF or picture, the whole arrangement, the audio, or a video of the pans lighting up.'}]},
    {id:'look',title:'Change how your pan looks',blurb:'Night, Steel, Painted, or your own photos.',kw:'look style colour color photo picture theme pan look note names day night',steps:[
      {go:()=>{GUIDE.closeAll();showView('setup');SETUP.show(null)},el:'[data-row=photos]',t:'Pan look',x:'Tap Pan look.',tap:1},
      {go:()=>{showView('setup');SETUP.show('photos')},el:'#view-setup .panel.sx-on',t:'Pick a style',x:'Choose a style, the note names and the hit colour. My photos uses your own pictures of the pan.'},
      {go:()=>showView('home'),el:'#dayBtn',t:'Day or night',x:'This button switches the whole app between night and day colours.'}]},
    {id:'backup',title:'Back up your songs',blurb:'Save a file so nothing is lost.',kw:'backup save restore file phone move export import lose',steps:[
      {go:()=>{GUIDE.closeAll();showView('setup');SETUP.show(null)},el:'[data-row=save]',t:'Backup',x:'Tap Backup.',tap:1},
      {go:()=>{showView('setup');SETUP.show('save')},el:'#expJson',t:'Save a backup',x:'Saves everything to one file. Keep it somewhere safe, like Google Drive. Open it on any phone to bring it all back.'}]}
  ],

  /* ---- running a guide ---- */
  run:null,
  start(id){const T=this.TOURS.find(t=>t.id===id);if(!T)return;{const t=$('gdToast');if(t)t.hidden=true}this.sheet(false);this.stop();this.run={T,i:0};this.mount();this.enter()},
  stop(){if(this.tick)clearInterval(this.tick);this.tick=null;const o=$('gdLayer');if(o)o.hidden=true;this.run=null;document.body.classList.remove('gd-on')},
  mount(){if($('gdLayer'))return;const L=document.createElement('div');L.id='gdLayer';L.hidden=true;
    L.innerHTML='<div id="gdRing" aria-hidden="true"></div><div id="gdCard" role="dialog" aria-live="polite" aria-labelledby="gdT"><div class="gd-top"><span id="gdN"></span><button id="gdX" aria-label="Close the guide">✕</button></div><h3 id="gdT"></h3><p id="gdP"></p><div class="gd-act"><button class="btn" id="gdBack">Back</button><button class="btn" id="gdGo" hidden>Take me there</button><button class="btn primary" id="gdNext">Next</button></div></div>';
    document.body.appendChild(L);
    $('gdX').onclick=()=>this.stop();$('gdBack').onclick=()=>this.step(-1);$('gdNext').onclick=()=>this.step(1);$('gdGo').onclick=()=>this.enter();
    // tapping the ringed button moves the guide on
    document.addEventListener('click',e=>{const r=this.run;if(!r)return;const s=r.T.steps[r.i];if(e.target.closest('#gdLayer'))return;
      const hit=s.tapIn?e.target.closest(s.tapIn):(s.tap&&this.cur&&(this.cur===e.target||this.cur.contains(e.target)));
      if(hit){const i=r.i;setTimeout(()=>{if(this.run===r&&r.i===i)this.step(1)},s.after||400)}},true);
    document.addEventListener('change',e=>{const r=this.run;if(!r)return;const s=r.T.steps[r.i];if(s.change&&e.target.matches(s.change)){const i=r.i;setTimeout(()=>{if(this.run===r&&r.i===i)this.step(1)},700)}},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.run)this.stop()});
  },
  step(d){const r=this.run;if(!r)return;let i=r.i+d;
    while(i>=0&&i<r.T.steps.length&&r.T.steps[i].skipIf&&r.T.steps[i].skipIf())i+=d;
    if(i>=r.T.steps.length){const nx=r.T.steps[r.T.steps.length-1].end;this.stop();this.done(r.T,nx);return}
    r.i=Math.max(0,i);this.enter()},
  enter(){const r=this.run;if(!r)return;const s=r.T.steps[r.i];try{s.go&&s.go()}catch(e){console.warn('guide',e)}
    $('gdLayer').hidden=false;document.body.classList.add('gd-on');
    $('gdN').textContent=r.T.title+' · '+(r.i+1)+' of '+r.T.steps.length;$('gdT').textContent=s.t;$('gdP').textContent=s.x;
    $('gdBack').hidden=r.i===0;$('gdNext').textContent=r.i===r.T.steps.length-1?'Done':(s.tap||s.tapIn||s.change?'Skip':'Next');
    this.since=Date.now();if(!this.tick)this.tick=setInterval(()=>this.place(),200);setTimeout(()=>this.place(),60);setTimeout(()=>this.place(),400)},
  place(){const r=this.run;if(!r)return;const s=r.T.steps[r.i];
    if(s.wait&&s.wait()){this.step(1);return}
    const el=this.find(s.el);this.cur=el;const ring=$('gdRing'),card=$('gdCard');
    $('gdGo').hidden=!!el||Date.now()-this.since<1500;
    const W=innerWidth,H=innerHeight,cw=Math.min(340,W-24);card.style.width=cw+'px';
    if(!el){ring.style.display='none';card.style.left=((W-cw)/2)+'px';card.style.top=Math.max(12,(H-card.offsetHeight)/2)+'px';card.classList.add('gd-mid');return}
    card.classList.remove('gd-mid');
    let b=el.getBoundingClientRect();
    // off the screen (a long page): bring it into view once
    if((b.bottom>H||b.top<0)&&this.scrolled!==el){this.scrolled=el;try{el.scrollIntoView({block:'center'})}catch{}b=el.getBoundingClientRect()}
    // a big target (a sheet or a panel): ring it, and put the card over its top edge
    const big=b.height>H*.55;
    const pad=6,x=Math.max(2,b.left-pad),y=Math.max(2,b.top-pad),w=Math.min(W-4,b.right+pad)-x,h=Math.min(H-4,b.bottom+pad)-y;
    Object.assign(ring.style,{display:'block',left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
    const ch=card.offsetHeight,cx=b.left+b.width/2-cw/2;let top,left=cx;
    const sideL=x-12-cw>=6,sideR=W-(x+w)-12-cw>=6,mid=Math.max(6,Math.min(H-ch-6,b.top+b.height/2-ch/2));
    if(!big&&y+h+10+ch<H-6)top=y+h+10;
    else if(!big&&y-10-ch>6)top=y-10-ch;
    else if(sideL){left=x-12-cw;top=mid}
    else if(sideR){left=x+w+12;top=mid}
    else top=big?y+12:H-ch-6;
    top=Math.max(6,Math.min(top,H-ch-6));
    left=Math.min(W-cw-12,Math.max(12,left));
    card.style.left=left+'px';card.style.top=top+'px'},
  done(T,nx){const n=nx&&this.TOURS.find(t=>t.id===nx);
    this.toast('✓ '+T.title+' done.',n?['Next: '+n.title,()=>this.start(n.id)]:['More guides',()=>this.sheet(true)])},
  toast(msg,act,more){this.mount();let b=$('gdToast');if(!b){b=document.createElement('div');b.id='gdToast';b.setAttribute('role','status');document.body.appendChild(b)}
    b.innerHTML='<span class="gd-tm">'+msg+(more?more.map((m,i)=>' <button class="gd-link" data-a="m'+i+'">'+m[0]+'</button>').join(''):'')+'</span>'+(act?'<button class="btn primary" data-a="go">'+act[0]+'</button>':'')+'<button class="gd-tx" data-a="x" aria-label="Close">✕</button>';
    b.hidden=false;clearTimeout(this.tt);this.tt=setTimeout(()=>{b.hidden=true},14000);
    b.onclick=e=>{const a=(e.target.closest('[data-a]')||{}).dataset;if(!a||!a.a)return;b.hidden=true;if(a.a==='go')act[1]();else if(a.a[0]==='m')more[+a.a.slice(1)][1]()}},

  /* ---- the Guides & help sheet ---- */
  topics(){if(this._top)return this._top;const out=[];
    document.querySelectorAll('#helpSheet details').forEach(d=>{const s=d.querySelector('summary');if(!s)return;const body=[...d.children].filter(c=>c!==s).map(c=>c.outerHTML).join('');out.push({t:s.textContent.trim(),h:body,x:(d.textContent||'').toLowerCase()})});
    return this._top=out},
  sheet(on){this.mount();let ov=$('gdSheet');
    if(!ov){ov=document.createElement('div');ov.id='gdSheet';ov.className='sheetov';ov.hidden=true;ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','gdST');
      ov.innerHTML='<div class="sheetbox gd-box"><div class="sheethead"><h2 id="gdST">Guides &amp; help</h2><button class="btn" id="gdSClose">Close</button></div>'
        +'<input id="gdQ" type="search" placeholder="Search: record, tempo, add a track, share…" autocomplete="off" aria-label="Search the guides and help">'
        +'<button class="gd-tips" id="gdTips" role="switch"><span><b>Tips</b><small>Offer a guide the first time you open a screen</small></span><span class="sxtog"><i></i></span></button>'
        +'<div id="gdList"></div></div>';
      document.body.appendChild(ov);
      $('gdSClose').onclick=()=>this.sheet(false);ov.addEventListener('click',e=>{if(e.target===ov){this.sheet(false);return}
        const g=e.target.closest('[data-gd]');if(g){this.start(g.dataset.gd);return}
        const t=e.target.closest('[data-tp]');if(t){const d=t.nextElementSibling;const op=d.hidden;d.hidden=!op;t.setAttribute('aria-expanded',String(op))}});
      $('gdQ').oninput=()=>this.list();
      $('gdTips').onclick=()=>{this.st.tips=this.st.tips?0:1;if(this.st.tips)this.st.seen={};this.save();this.list();try{say(this.st.tips?'Tips on: you’ll get an offer of a guide on each screen.':'Tips off. Guides are still here under ?.')}catch{}};
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ov.hidden)this.sheet(false)})}
    if(on){this.closeAll();{const t=$('gdToast');if(t)t.hidden=true}$('gdQ').value='';this.list()}
    ov.hidden=!on;if(on)setTimeout(()=>{if(matchMedia('(pointer:fine)').matches)$('gdQ').focus()},50)},
  list(){const raw=($('gdQ').value||'').trim().toLowerCase(),w=raw.split(/\s+/).filter(Boolean);
    const tg=$('gdTips');tg.setAttribute('aria-checked',String(!!this.st.tips));tg.querySelector('.sxtog').classList.toggle('on',!!this.st.tips);
    const ok=txt=>w.every(x=>txt.includes(x)||(x.length>3&&txt.includes(x.slice(0,-1))));
    const tours=this.TOURS.filter(t=>ok((t.title+' '+t.blurb+' '+t.kw+' '+t.steps.map(s=>s.t+' '+s.x).join(' ')).toLowerCase()));
    const tops=this.topics().filter(t=>ok(t.t.toLowerCase()+' '+t.x));
    let h='';
    if(tours.length)h+='<div class="sxgt">Walk me through it</div><div class="gd-tours">'+tours.map(t=>'<button class="gd-tour" data-gd="'+t.id+'"><span class="gd-play" aria-hidden="true">▶</span><span><b>'+esc(t.title)+'</b><small>'+esc(t.blurb)+'</small></span><span class="gd-n">'+t.steps.length+' steps</span></button>').join('')+'</div>';
    if(tops.length)h+='<div class="sxgt">How it works</div><div class="gd-tops">'+tops.map(t=>'<button class="gd-tp" data-tp aria-expanded="'+(w.length&&tops.length<=2)+'">'+esc(t.t)+'<span aria-hidden="true">›</span></button><div class="gd-tb helpbody"'+(w.length&&tops.length<=2?'':' hidden')+'>'+t.h+'</div>').join('')+'</div>';
    if(!h)h='<p class="help">Nothing found for “'+esc(raw)+'”. Try a simpler word, like record, tempo, track or share.</p>';
    $('gdList').innerHTML=h},

  /* ---- tips: offer a guide the first time you open a screen ---- */
  OFFER:{home:['app','New here? Take a quick look round.'],studio:['studio','First time in Studio? See how it works.'],cues:['write','First time in Write? See how to put your notes in.'],part:['share','This is your chart. See how to share it with the band.']},
  offer(v){if(!this.st.tips||this.run||this.st.seen[v])return;const o=this.OFFER[v];if(!o)return;
    // wait until nothing else is asking for attention (the welcome, a name, a sheet)
    if([...document.querySelectorAll('.sheetov')].some(s=>!s.hidden)){clearTimeout(this.ot);this.ot=setTimeout(()=>{if(document.body.dataset.view===v)this.offer(v)},1500);return}
    this.st.seen[v]=1;this.save();
    this.toast(o[1],['Show me',()=>this.start(o[0])],[['Turn tips off',()=>{this.st.tips=0;this.save();try{say('Tips off. Guides are still under ?.')}catch{}}]])},

  init(){this.load();this.mount();
    // ? opens Guides & help (it holds every help topic too)
    const hb=$('helpBtn');if(hb){hb.onclick=()=>this.sheet(true);hb.setAttribute('aria-label','Guides and help')}
    // Studio's ⋯ menu
    const gl=document.querySelector('#gbMenu .gbmlist');if(gl&&!$('gbGuide')){const b=document.createElement('button');b.className='btn';b.id='gbGuide';b.textContent='? Guides & help';b.onclick=()=>{try{GB.menu(false)}catch{}this.sheet(true)};gl.appendChild(b)}
    const wh=$('wbmHelp');if(wh)wh.innerHTML='? Guides &amp; help <small>walk-throughs, search</small>';
    // Home: a Guides card under the big buttons; Setup: a row at the bottom of the list
    if(typeof HOME!=='undefined'){const _r=HOME.render.bind(HOME);HOME.render=function(){_r();GUIDE.homeCard()};this.homeCard()}
    if(typeof SETUP!=='undefined'){const _s=SETUP.render.bind(SETUP);SETUP.render=function(){_s();GUIDE.setRow()};this.setRow()}
    $('setList')&&$('setList').addEventListener('click',e=>{if(e.target.closest('[data-row=guide]')){e.stopPropagation();this.sheet(true)}},true);
    const _v=showView;showView=function(v){const was=document.body.dataset.view;_v(v);if(v!==was)setTimeout(()=>GUIDE.offer(v),900)};
    setTimeout(()=>this.offer(document.body.dataset.view),1800);
  },
  homeCard(){const v=$('view-home');if(!v||v.querySelector('#hmGuide'))return;const acts=v.querySelector('#hmJust');const sec=acts&&acts.closest('section');if(!sec)return;
    const b=document.createElement('button');b.id='hmGuide';b.className='gd-home';b.innerHTML='<span class="gd-play" aria-hidden="true">?</span><span><b>Guides &amp; help</b><small>Step-by-step: load a recording, Studio, record, share</small></span><span aria-hidden="true">›</span>';
    b.onclick=e=>{e.stopPropagation();this.sheet(true)};sec.after(b)},
  setRow(){const l=$('setList');if(!l||l.querySelector('[data-row=guide]'))return;
    l.insertAdjacentHTML('beforeend','<div class="sxgroup"><div class="sxgt">Help</div><div class="sxbox"><button class="sxrow" data-row="guide"><span class="sxic" style="background:#ffd166" aria-hidden="true">?</span><span class="sxlab"><b>Guides &amp; help</b><small>Walk-throughs and search</small></span><span class="sxval">'+(this.st.tips?'Tips on':'Tips off')+'</span><span class="sxchev" aria-hidden="true">›</span></button></div></div>')}
};
{const st=document.createElement('style');st.textContent=`
#gdLayer{position:fixed;inset:0;z-index:100000;pointer-events:none}
#gdLayer[hidden]{display:none}
#gdRing{position:fixed;border-radius:14px;border:2.5px solid var(--gold,#ffd166);box-shadow:0 0 0 200vmax rgb(6 3 16/.58),0 0 22px 4px rgb(255 209 102/.55);transition:left .25s,top .25s,width .25s,height .25s;animation:gdPulse 1.6s ease-in-out infinite}
@keyframes gdPulse{50%{box-shadow:0 0 0 200vmax rgb(6 3 16/.58),0 0 34px 10px rgb(255 209 102/.35)}}
#gdCard{position:fixed;pointer-events:auto;background:var(--surface,#221a3d);color:var(--ink,#fff);border:1px solid var(--gold,#ffd166);border-radius:16px;padding:12px 14px 12px;box-shadow:0 16px 44px rgb(0 0 0/.55);transition:top .25s,left .25s;max-height:70vh;overflow:auto}
#gdCard.gd-mid{box-shadow:0 0 0 200vmax rgb(6 3 16/.5),0 16px 44px rgb(0 0 0/.55)}
.gd-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#b3a9d6)}
#gdX{background:none;border:0;color:inherit;font-size:16px;min-width:36px;min-height:36px;cursor:pointer}
#gdT{margin:2px 0 4px;font-size:17px;color:var(--gold,#ffd166)}
#gdP{margin:0 0 10px;font-size:15px;line-height:1.4}
.gd-act{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.gd-act .btn{min-height:40px}
#gdToast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(132px + env(safe-area-inset-bottom));width:min(440px,calc(100vw - 24px));box-sizing:border-box;z-index:99999;display:flex;align-items:center;gap:8px;background:var(--surface,#221a3d);border:1px solid var(--gold,#ffd166);border-radius:14px;padding:6px 4px 6px 12px;box-shadow:0 10px 30px rgb(0 0 0/.45);font-size:13.5px;line-height:1.3}
#gdToast .btn{min-height:38px;padding:0 14px;white-space:nowrap}
.gd-tm{flex:1}
.gd-link{background:none;border:0;padding:2px 0;color:var(--muted,#b3a9d6);font:inherit;font-size:12.5px;text-decoration:underline;cursor:pointer;display:block}
@media (max-height:500px){#gdToast{left:auto;right:12px;transform:none;top:auto;bottom:12px;width:min(380px,calc(100vw - 24px))}}
#gdToast[hidden]{display:none}
.gd-tx{background:none;border:0;color:var(--muted,#b3a9d6);font-size:15px;min-width:36px;min-height:36px;cursor:pointer}
#gdSheet{z-index:90}
.gd-box{max-height:88vh;overflow:auto}
#gdQ{width:100%;box-sizing:border-box;font:16px var(--body,system-ui);padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--bg,#140f26);color:inherit;margin:4px 0 10px}
.gd-tips{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:14px;color:inherit;padding:10px 12px;margin-bottom:12px;cursor:pointer;font:inherit}
.gd-tips small,.gd-tour small,.gd-home small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
#gdList .sxgt{margin:6px 0 2px}
.gd-tours,.gd-tops{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.gd-tour,.gd-home{display:flex;align-items:center;gap:12px;text-align:left;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:14px;color:inherit;padding:10px 12px;cursor:pointer;font:inherit;min-height:56px}
.gd-tour>span:nth-child(2),.gd-home>span:nth-child(2){flex:1}
.gd-play{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--gold,#ffd166);color:#1a1230;font-weight:800;font-size:14px}
.gd-n{font-size:11.5px;color:var(--muted);white-space:nowrap}
.gd-tp{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);color:inherit;font:600 15px var(--body,system-ui);padding:12px 4px;cursor:pointer}
.gd-tp[aria-expanded=true] span{transform:rotate(90deg)}
.gd-tb{padding:4px 4px 10px;font-size:14.5px;line-height:1.45}
.gd-home{margin:12px 0 0}
`;document.head.appendChild(st)}
try{GUIDE.init()}catch(e){console.warn('guides',e)}
