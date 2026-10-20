/* ---------- Polish: the Play screen fits above the play bar, messages stay out of the way, bigger finger targets ---------- */
var POLISH={
  // upright phone, Play: shorten the falling-note lanes just enough that the note you're on sits above the play bar
  fit(){const ln=$('lanes');if(!ln)return;
    const up=innerWidth<innerHeight&&innerWidth<700,v=document.body.dataset.view==='play';
    if(!up||!v||document.body.classList.contains('pfmode')){if(ln.style.height){ln.style.removeProperty('height');ln.style.removeProperty('flex')}return}
    ln.style.removeProperty('height');
    const dock=document.querySelector('.dock');if(!dock)return;
    // whichever sits lowest: the note you're on, or the pans themselves
    const low=[document.querySelector('#playStage .now'),$('playPans')].filter(e=>e&&e.offsetHeight).map(e=>e.getBoundingClientRect().bottom);if(!low.length)return;
    const over=Math.max(...low)+scrollY-(dock.getBoundingClientRect().top-10);
    if(over>0){const h=Math.max(120,ln.offsetHeight-over);ln.style.height=h+'px'}},
  init(){
    const go=()=>{clearTimeout(this.t);this.t=setTimeout(()=>this.fit(),120)};
    const _v=showView;showView=function(v){_v(v);go();setTimeout(()=>POLISH.fit(),500)};
    addEventListener('resize',go);addEventListener('orientationchange',go);
    try{new ResizeObserver(go).observe(document.querySelector('.dock'))}catch{}
    go();
  }
};
{const st=document.createElement('style');st.textContent=`
/* messages: at the top of Play and Home, clear of the note you're on and the big Play button */
body:is([data-view=play],[data-view=home]):not(.pfmode) #status{top:calc(env(safe-area-inset-top,0px) + 10px);bottom:auto;transform:translate(-50%,-10px)}
body:is([data-view=play],[data-view=home]):not(.pfmode) #status.show{transform:translate(-50%,0)}
/* bigger finger targets */
.swatches .sw{width:40px;height:40px}
.st-zm button{position:relative;min-width:30px}
.st-zm button::after{content:'';position:absolute;inset:-8px -3px}
.st-secl{position:relative}
.st-secl::after{content:'';position:absolute;inset:-9px -3px}
`;document.head.appendChild(st)}
try{POLISH.init()}catch(e){console.warn('polish',e)}
