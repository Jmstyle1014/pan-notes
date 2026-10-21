
/* ---------- My notes on screen: the full-screen notebook, the Chart's Notes tab, and the panels in Play and Write ---------- */
{
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const st=NOTES.st;
  const TOOLS=[['pen','✎','Pen'],['marker','🖍','Marker'],['eraser','⌫','Eraser'],['text','Aa','Text'],['select','⬚','Select'],['section','🏷','Section'],['page','▦','Page']];
  // the section chips (and Follow), the same everywhere
  function chips(box){
    const n=NOTES.chipNames(),now=NOTES.nowSec();
    box.innerHTML=n.map(x=>'<button data-chip="'+esc(x)+'" class="'+(now&&now.toLowerCase()===x.toLowerCase()?'on':'')+'">'+esc(x)+'</button>').join('')
      +(n.length?'':'<span class="nb-hint">Tag the parts of the song with 🏷 Section</span>')
      +'<button class="nb-follow" data-follow aria-pressed="'+st.follow+'"><i></i>Follow</button>';
  }
  document.addEventListener('click',e=>{const c=e.target.closest&&e.target.closest('[data-chip]');if(c){NOTES.jump(c.dataset.chip,false);return}
    const f=e.target.closest&&e.target.closest('[data-follow]');if(f){st.follow=!st.follow;NOTES.keepTools();NOTES.all();if(st.follow)NOTES.follow();say(st.follow?'Your notes follow the song.':'Follow off: your notes stay where you leave them.')}});

  /* ---- the notebook with every tool: full screen, or in the Chart's Notes tab ---- */
  function editor(host,overlay){
    host.classList.add('nbe');
    host.innerHTML='<div class="nbe-top">'+(overlay?'<button class="nbe-btn" data-e="close" aria-label="Back">‹</button>':'')
        +'<div class="nbe-tt"><b>My notes</b><small class="nbe-sub"></small></div><span class="nbe-sp"></span>'
        +'<button class="nbe-btn" data-e="undo" aria-label="Undo">↶</button><button class="nbe-btn" data-e="redo" aria-label="Redo">↷</button>'
        +(overlay?'<button class="nbe-btn nbe-done" data-e="close">Done</button>':'<button class="nbe-btn" data-e="full" aria-label="Full screen">⤢</button>')+'</div>'
      +'<div class="nbe-tools" role="toolbar" aria-label="Notes tools">'+TOOLS.map(([k,i,n])=>'<button data-t="'+k+'"><span aria-hidden="true">'+i+'</span>'+n+'</button>').join('')+'</div>'
      +'<div class="nbe-row2"><span class="nbe-cols">'+NOTES.COLS.map((c,i)=>'<button class="nbe-sw" data-c="'+i+'" style="background:'+c+'" aria-label="Colour '+(i+1)+'"></button>').join('')+'</span>'
        +'<span class="nbe-szs">'+NOTES.SIZES.map((s,i)=>'<button data-s="'+i+'" aria-label="Size '+(i+1)+'"><i style="width:'+(5+i*5)+'px;height:'+(5+i*5)+'px"></i></button>').join('')+'</span>'
        +'<button class="nbe-sty" data-e="stylus" aria-pressed="false">✋<small></small></button></div>'
      +'<div class="nb-chips nbe-chips"></div><div class="nbe-host"></div>';
    const v=NOTES.makeView(host.querySelector('.nbe-host'),'full');
    function ui(){
      host.querySelectorAll('[data-t]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.t===st.tool)));
      host.querySelectorAll('[data-c]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.c===st.color)));
      host.querySelectorAll('[data-s]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.s===st.size)));
      const sb=host.querySelector('[data-e=stylus]');sb.setAttribute('aria-pressed',String(st.stylus));sb.querySelector('small').textContent=st.stylus?'stylus':'off';
      host.querySelector('[data-e=undo]').disabled=!NOTES.canUndo;host.querySelector('[data-e=redo]').disabled=!NOTES.canRedo;
      const n=NOTES.songPages().length;host.querySelector('.nbe-sub').textContent=(S.title||'This song')+' · page '+(NOTES.curIdx()+1)+' of '+n;
      chips(host.querySelector('.nbe-chips'));host.classList.toggle('nbe-sel',st.tool==='select');host.dataset.tool=st.tool;
    }
    NOTES.hooks.add(ui);
    host.addEventListener('click',e=>{
      const t=e.target.closest('[data-t]');if(t){const k=t.dataset.t;if(k==='page'){pagePop(host);return}st.tool=k;NOTES.sel.clear();NOTES.all();NOTES.menu(v);
        if(k==='text')say('Tap the page where you want to type.');else if(k==='section')say('Tap the page where the tag goes.');else if(k==='select')say('Circle what you want to move, copy or delete.');return}
      const c=e.target.closest('[data-c]');if(c){st.color=+c.dataset.c;if(['eraser','select','section','page'].includes(st.tool))st.tool='pen';NOTES.keepTools();ui();return}
      const s=e.target.closest('[data-s]');if(s){st.size=+s.dataset.s;NOTES.keepTools();ui();return}
      const b=e.target.closest('[data-e]');if(!b)return;const k=b.dataset.e;
      if(k==='undo')NOTES.undoDo();else if(k==='redo')NOTES.redoDo();
      else if(k==='stylus'){st.stylus=!st.stylus;NOTES.keepTools();ui();say(st.stylus?'Stylus only: your stylus writes, fingers scroll.':'Fingers write too. Two fingers scroll.')}
      else if(k==='close')full(false);else if(k==='full')full(true)});
    setTimeout(ui,0);return {v,ui};
  }
  // Page: the background, and the pages of this song
  function pagePop(host){
    let pop=$('nbPagePop');if(pop){pop.remove();return}
    pop=document.createElement('div');pop.id='nbPagePop';pop.className='nb-pop nb-pagepop';const d=NOTES.load(NOTES.curPg().id),n=NOTES.songPages().length,i=NOTES.curIdx();
    pop.innerHTML='<b>Page background</b><div class="nb-bgs">'+NOTES.BGS.map(([k,nm])=>'<button data-bg="'+k+'" class="nb-bg-'+k+'" aria-pressed="'+(d.bg===k)+'"><small>'+nm+'</small></button>').join('')+'</div>'
      +'<b>Pages</b><div class="nb-pgs"><button data-p="prev"'+(i<=0?' disabled':'')+'>‹</button><span>Page '+(i+1)+' of '+n+'</span><button data-p="next"'+(i>=n-1?' disabled':'')+'>›</button><button data-p="add">＋ New page</button></div>'
      +'<div class="nb-pgs2"><button data-p="pic">Save as picture</button><button data-p="clear" class="nb-danger">Clear page</button>'+(n>1?'<button data-p="del" class="nb-danger">Delete page</button>':'')+'</div>';
    document.body.appendChild(pop);
    const close=()=>{pop.remove();document.removeEventListener('pointerdown',out,true)},out=e=>{if(!pop.contains(e.target)&&!e.target.closest('[data-t=page]'))close()};
    setTimeout(()=>document.addEventListener('pointerdown',out,true),0);
    let armed='';
    pop.onclick=e=>{const b=e.target.closest('[data-bg]');if(b){NOTES.setBg(b.dataset.bg);close();return}
      const p=e.target.closest('[data-p]');if(!p)return;const k=p.dataset.p;
      if(k==='prev'){NOTES.goPage(i-1);close()}else if(k==='next'){NOTES.goPage(i+1);close()}else if(k==='add'){NOTES.addPage();close()}else if(k==='pic'){NOTES.savePicture();close()}
      else if(k==='clear'||k==='del'){if(armed!==k){armed=k;p.textContent='Tap again to '+(k==='del'?'delete':'clear');return}close();if(k==='del')NOTES.delPage();else NOTES.clearPage()}};
  }
  // full screen
  let fullEd=null;
  function full(on){
    let ov=$('nbFull');
    if(on){if(!ov){ov=document.createElement('div');ov.id='nbFull';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','My notes');document.body.appendChild(ov);fullEd=editor(ov,true)}
      ov.hidden=false;document.body.classList.add('nb-full-on');if(st.tool==='page')st.tool='pen';NOTES.all();setTimeout(NOTES.all,60)}
    else if(ov){ov.hidden=true;document.body.classList.remove('nb-full-on');const p=$('nbPagePop');if(p)p.remove();NOTES.sel.clear();NOTES.all()}
  }
  NOTES.full=full;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('nbFull')&&!$('nbFull').hidden&&!e.target.isContentEditable)full(false)});
  // the phone's back button closes full screen first
  window.addEventListener('popstate',()=>{if($('nbFull')&&!$('nbFull').hidden)full(false)});

  /* ---- Chart → Notes: the same notebook, every tool, on the page ---- */
  {const vw=$('view-notes');if(vw){const h=document.createElement('div');h.id='nbChart';vw.appendChild(h);editor(h,false);vw.classList.add('nb-chart')
    const _sv=showView;showView=function(x){_sv(x);if(x==='notes')setTimeout(()=>{fit();NOTES.all()},30)};
    const fit=()=>{const r=h.getBoundingClientRect(),dock=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dockH'))||120;h.style.height=Math.max(320,innerHeight-r.top-dock-10)+'px'};
    window.addEventListener('resize',()=>{if(document.body.dataset.view==='notes')fit()})}}

  /* ---- a panel: tabs (what was there | My notes), chips, the page; ✎ writes in it, ⤢ opens full screen ---- */
  function panel(first,key){
    const el=document.createElement('div');el.className='nb-panel';
    el.innerHTML='<div class="nb-tabs" role="tablist"><button role="tab" data-tab="a">'+first+'</button><button role="tab" data-tab="n">✎ My notes</button><span class="nb-grow"></span><button class="nb-ic" data-e="full" aria-label="My notes full screen">⤢</button></div><div class="nb-body"><div class="nb-chips"></div><div class="nb-vh"></div></div>';
    const v=NOTES.makeView(el.querySelector('.nb-vh'),'panel');
    let tab='a';try{tab=localStorage.getItem('panyard-notes-tab-'+key)||'a'}catch{}
    const set=t=>{tab=t;try{localStorage.setItem('panyard-notes-tab-'+key,t)}catch{}el.dataset.tab=t;el.querySelectorAll('button[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===t)));el.dispatchEvent(new Event('nbtab'));if(t==='n')setTimeout(()=>NOTES.render(v),0)};
    el.addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b){set(b.dataset.tab);return}if(e.target.closest('[data-e=full]'))full(true)});
    NOTES.hooks.add(()=>chips(el.querySelector('.nb-chips')));   // drawn once the app has loaded (NOTES.all)
    set(tab);return {el,v,set,get tab(){return tab}};
  }
  /* Play: under the pans, where the next note shows */
  {const now=document.querySelector('#playStage>.now');if(now){
    const p=panel('Next note','play');now.after(p.el);p.el.id='nbPlay';
    const sync=()=>{now.classList.toggle('nb-hide',p.tab==='n');p.el.classList.toggle('nb-open',p.tab==='n')};
    p.el.addEventListener('nbtab',sync);sync()}}
  /* Write: where Coming up shows */
  {const tryWb=()=>{const nx=$('wbNext');if(!nx||nx.querySelector('.nb-panel'))return;
    const p=panel('Coming up','write');p.el.id='nbWrite';nx.prepend(p.el);
    const sync=()=>{nx.classList.toggle('nb-notes',p.tab==='n')};p.el.addEventListener('nbtab',sync);sync()};
    tryWb();setTimeout(tryWb,500);const _sv=showView;showView=function(x){_sv(x);if(x==='cues')setTimeout(()=>{tryWb();NOTES.all()},120);if(x==='play')setTimeout(NOTES.all,60)}}
  setTimeout(NOTES.all,300);
}
