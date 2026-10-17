/* ---------- Home: what you see when you open Panyard ---------- */
// Pick up where you left off, start something new, or jump to another song. It reads what the app already keeps
// about each song (its checklist, sections and pan) and adds three small things: where you stopped, which
// sections you've practised, and which nights you played.
const HOME={
  PAN_NAME:{guitar:'Double Guitar',tenor:'Low C Tenor',six:'Six Bass',fcello:'Four Cello'},
  ACC:['#f2b38a','#8fc7ff','#c9a2ff','#9be38f'],
  day:(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),
  days(){try{const x=JSON.parse(localStorage.getItem('panyard-days')||'[]');return Array.isArray(x)?x:[]}catch{return[]}},
  markDay(){const d=this.days(),t=this.day();if(d[d.length-1]===t)return;d.push(t);try{localStorage.setItem('panyard-days',JSON.stringify(d.slice(-400)))}catch{}},
  streak(){const set=new Set(this.days());let n=0;const d=new Date();if(!set.has(this.day(d)))d.setDate(d.getDate()-1);
    while(set.has(this.day(d))){n++;d.setDate(d.getDate()-1)}return n},
  // a small drawing of a pan, coloured by its groups, for cards and lists
  mini(k,size){const set=SETS[k]||SETS.guitar,cols={};(set.groups||[]).forEach((g,i)=>cols[g.key]=g.color||this.ACC[i%4]);
    if(k==='guitar'){cols.ec='#f2b38a';cols.bf='#8fc7ff'}
    return '<span class="hm-mini" style="--s:'+size+'px">'+set.views.map(v=>{
      const rims=(v.drums||[{cx:v.cx,cy:v.cy,rx:v.rx,ry:v.ry}]).map(d=>'<ellipse cx="'+d.cx+'" cy="'+d.cy+'" rx="'+d.rx+'" ry="'+d.ry+'" fill="#120d24" stroke="#cfc6f2" stroke-width="'+Math.max(8,d.rx*.05)+'"/>').join('');
      const z=v.fields.map(f=>'<path d="'+f[3]+'" fill="'+(cols[f[7]]||'#8fc7ff')+'" fill-opacity=".85" stroke="#120d24" stroke-width="'+(v.drums?6:10)+'"/>').join('');
      return '<svg viewBox="'+v.view+'" aria-hidden="true" focusable="false">'+rims+z+'</svg>'}).join('')+'</span>'},
  secAt(secs,t){return secs.find(s=>t>=s.t&&t<s.end)||null},
  barAt(t){const g=S.grid;if(!g||!g.bpm)return null;const b=60/g.bpm,pb=g.perBar||4,k=Math.max(0,(t-(g.offset||0))/b);return Math.floor(k/pb)+1},
  pos(){const s=songNow();return s&&Number.isFinite(s.pos)?s.pos:0},
  render(){
    const box=$('view-home');if(!box||box.hidden)return;songsInit();songTouch();
    const cur=songNow()||{},secs=hasAudio?sectionsNow():[],pos=this.pos(),at=this.secAt(secs,pos),done=cur.secDone||{},n=this.streak();
    const panK=setKey(),stopped=isDemo?'Press play to see how the notes light up':hasAudio?'Stopped at '+(at?'<b>'+esc(at.name)+'</b>':'<b>'+tShort(pos)+'</b>')+(at&&this.barAt(pos)?' · bar '+this.barAt(pos):''):'No recording yet';
    // the section steps: done, where you are, still to do (at most five, around where you stopped)
    let steps='';
    if(secs.length){const i0=Math.max(0,Math.min(secs.indexOf(at)-2,secs.length-5));
      steps='<div class="hm-steps" role="list">'+secs.slice(Math.max(0,i0),Math.max(0,i0)+5).map(s=>{const st=s===at?'now':done[s.name]?'done':'todo';
        return '<button class="hm-step '+st+'" role="listitem" data-sec="'+secs.indexOf(s)+'" aria-label="Practise '+esc(s.name)+(st==='done'?', practised':st==='now'?', where you stopped':'')+'"><i aria-hidden="true">'+(st==='done'?'✓':'')+'</i><span>'+esc(s.name)+'</span></button>'}).join('')+'</div>'}
    const go=isDemo?'Play the example song':!hasAudio?'Add your recording':at?'Practise the '+at.name:'Keep practising';
    const others=SONGS.list.filter(s=>s.id!==SONGS.active).sort((a,b)=>b.updated-a.updated);
    const row=(s,i)=>{const pct=Math.round((s.pct||0)*100),c=this.ACC[i%4];
      return '<button class="hm-song" data-song="'+esc(s.id)+'">'+this.mini(s.pan||'guitar',34)+'<span class="hm-sn"><b>'+esc(s.title||'Untitled song')+'</b><span>'+esc(this.PAN_NAME[s.pan]||'Pan not set')+'</span></span>'
        +'<span class="hm-bar" aria-hidden="true"><i style="width:'+pct+'%;background:'+c+'"></i></span><span class="hm-pct" style="color:'+c+'">'+pct+'%</span><span class="hm-chev" aria-hidden="true">›</span></button>'};
    box.innerHTML='<div class="hm-decor" aria-hidden="true"></div>'
      +'<header class="hm-top"><div><h1>Panyard</h1><p>'+(isDemo?'Welcome to the yard':hasAudio?'Your next groove is ready':'Let’s get a song ready')+'</p></div>'
      +'<button class="hm-streak'+(n?'':' zero')+'" id="hmStreak" aria-label="'+(n?n+' nights in a row':'No streak yet')+'">'+this.mini(panK,22)+(n?n+' night'+(n>1?'s':''):'Start a streak')+'</button>'
      +'<button class="iconbtn" id="hmSetup" aria-label="Setup"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg></button></header>'
      +'<section class="hm-card" aria-label="Pick up where you left off">'
        +'<div class="hm-cardtop">'+this.mini(panK,76)+'<div class="hm-ct"><span class="hm-eyebrow">'+(isDemo?'Try it out':'Pick up where you left off')+'</span><h2>'+esc(isDemo?'Example song':S.title||'Your song')+'</h2><p>'+esc(this.PAN_NAME[panK])+'</p><p>'+stopped+'</p></div></div>'
        +steps+'<button class="hm-go" id="hmGo"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>'+esc(go)+'</button></section>'
      +'<section class="hm-acts" aria-label="Start something">'
        +'<button id="hmNew"><span class="hm-ic" style="background:#f2b38a"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/></svg></span>New song</button>'
        +'<button id="hmRec"><span class="hm-ic" style="background:#8fc7ff"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg></span>Record</button>'
        +'<button id="hmJust"><span class="hm-ic" style="background:#c9a2ff"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg></span>Just play</button></section>'
      +(others.length?'<section class="hm-songs" aria-label="Recent songs"><div class="hm-sh"><h3>Recent songs</h3>'+(others.length>3?'<button class="mini" data-open-all>See all '+(others.length+1)+'</button>':'')+'</div>'+others.slice(0,3).map(row).join('')+'</section>':'');
    // songs we haven't seen the pan for yet: look it up once, then draw again
    const miss=others.slice(0,3).filter(s=>!s.pan);
    if(miss.length&&!this._looking){this._looking=true;Promise.all(miss.map(async s=>{try{const st=await idbGet('song:'+s.id);s.pan=(st&&st.data&&st.data.panSet)||'guitar'}catch{s.pan='guitar'}})).then(()=>{songsSave();this._looking=false;this.render()})}
  },
  go(sec){
    if(isDemo){showView('play');audio.play().catch(()=>{});return}
    if(!hasAudio){showView('setup');setTimeout(()=>{const f=$('audioFile');if(f)f.closest('.panel').scrollIntoView({behavior:'smooth',block:'start'})},60);return}
    showView('play');
    if(sec){loopSection(sec);return}
    audio.currentTime=Math.min(this.pos(),Math.max(0,(audio.duration||0)-1));audio.play().catch(()=>{});
  },
  init(){
    const v=document.createElement('section');v.className='view home';v.id='view-home';v.hidden=true;v.setAttribute('aria-label','Home');
    $('view-play').before(v);
    v.addEventListener('click',e=>{
      const st=e.target.closest('[data-sec]');if(st){this.go(sectionsNow()[+st.dataset.sec]);return}
      const so=e.target.closest('[data-song]');if(so){songOpen(so.dataset.song).then(()=>this.render());return}
      if(e.target.closest('[data-open-all]')){openSongs(true);return}
      const id=(e.target.closest('button')||{}).id;
      if(id==='hmGo'){const secs=sectionsNow();this.go(this.secAt(secs,this.pos()))}
      else if(id==='hmNew')songNew();
      else if(id==='hmRec')openRec(true);
      else if(id==='hmJust'){showView('studio');try{STUDIO.enter&&document.querySelector('#stViews [data-sv="inst"]').click()}catch{}}
      else if(id==='hmSetup')showView('setup');
      else if(id==='hmStreak'){const n=this.streak(),all=this.days().length;say(n?n+' night'+(n>1?'s':'')+' in a row. You’ve played on '+all+' day'+(all>1?'s':'')+' in all.':'Play any song tonight to start a streak.')}
    });
    // a home button sits at the start of the top bar
    const hb=document.createElement('button');hb.className='iconbtn';hb.id='homeBtn';hb.setAttribute('aria-label','Home');
    hb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>';
    hb.onclick=()=>showView('home');document.querySelector('.appbar .acts').prepend(hb);
    // remember where you stopped, which sections you've practised, and the nights you played
    const keepPos=()=>{if(isDemo||!hasAudio)return;const s=songNow();if(!s)return;s.pos=+audio.currentTime||0;songsSave()};
    audio.addEventListener('pause',keepPos);document.addEventListener('visibilitychange',()=>{if(document.hidden)keepPos()});
    let lastKeep=0;audio.addEventListener('timeupdate',()=>{const t=Date.now();if(t-lastKeep>5000){lastKeep=t;keepPos()}});
    audio.addEventListener('play',()=>{if(!isDemo)this.markDay()});
    const _loop=loopSection;loopSection=function(sec){_loop(sec);if(loop&&!isDemo){const s=songNow();if(s){s.secDone=s.secDone||{};s.secDone[sec.name]=Date.now();songsSave()}}};
    const _touch=songTouch;songTouch=function(){_touch();if(isDemo)return;const s=songNow();if(!s)return;s.pan=S.panSet||'guitar';try{const st=checkSteps();s.pct=st.filter(x=>x.ok).length/st.length}catch{}songsSave()};
    const _show=showView;showView=function(v){
      if(v!=='home'){$('view-home').hidden=true;return _show(v)}
      _show('play');$('view-play').hidden=true;$('view-home').hidden=false;currentView='home';document.body.dataset.view='home';
      document.querySelectorAll('.tabs button[data-view]').forEach(b=>b.setAttribute('aria-selected','false'));HOME.render();window.scrollTo({top:0})};
  }
};
HOME.init();
