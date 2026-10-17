/* ---------- four tabs: Home, Play, Make, Chart ---------- */
// Play holds Practice and Game, Make holds Write and Studio, Chart holds the chart and your stylus Notes.
// A switch at the top flips between the two; each tab remembers which one you used last.
const TABS={
  groups:{
    home:{label:'Home',views:['home'],icon:'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'},
    play:{label:'Play',views:['play','game'],names:['Practice','Game'],icon:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor"/>'},
    make:{label:'Make',views:['cues','studio'],names:['Write','Studio'],icon:'<path d="M5 4v16M12 4v16M19 4v16"/><rect x="3" y="13" width="4" height="3" rx="1" fill="currentColor"/><rect x="10" y="7" width="4" height="3" rx="1" fill="currentColor"/><rect x="17" y="11" width="4" height="3" rx="1" fill="currentColor"/>'},
    chart:{label:'Chart',views:['part','notes'],names:['Chart','Notes'],icon:'<path d="M4 5h16v14H4z"/><path d="M9 5v14M14 5v14"/>'}
  },
  cur:'home',
  last(){try{return JSON.parse(localStorage.getItem('panyard-subtab')||'{}')}catch{return{}}},
  remember(g,v){const l=this.last();l[g]=v;try{localStorage.setItem('panyard-subtab',JSON.stringify(l))}catch{}},
  groupOf(v){for(const [k,g] of Object.entries(this.groups))if(g.views.includes(v))return k;return null},
  open(g){const G=this.groups[g],l=this.last()[g];showView(G.views.includes(l)?l:G.views[0])},
  render(){
    const g=this.groupOf(this.cur);
    document.querySelectorAll('.tabs button[data-tab]').forEach(b=>{const on=b.dataset.tab===g;b.setAttribute('aria-selected',String(on));b.setAttribute('aria-current',on?'page':'false')});
    const bar=$('subTabs'),G=g&&this.groups[g];
    if(!G||!G.names){bar.hidden=true;return}
    bar.hidden=false;bar.setAttribute('aria-label',G.label);
    bar.innerHTML=G.views.map((v,i)=>'<button data-sub="'+v+'" aria-pressed="'+(v===this.cur)+'">'+G.names[i]+'</button>').join('');
  },
  init(){
    const nav=document.querySelector('.tabs');
    nav.innerHTML=Object.entries(this.groups).map(([k,g])=>'<button role="tab" data-tab="'+k+'" aria-selected="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+g.icon+'</svg>'+g.label+'</button>').join('');
    nav.classList.add('four');
    nav.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)this.open(b.dataset.tab)});
    const bar=document.createElement('div');bar.id='subTabs';bar.className='seg subtabs';bar.hidden=true;bar.setAttribute('role','group');
    document.querySelector('main').prepend(bar);
    bar.addEventListener('click',e=>{const b=e.target.closest('[data-sub]');if(b&&b.dataset.sub!==this.cur)showView(b.dataset.sub)});
    // the Home button in the top bar isn't needed now Home has its own tab
    const hb=$('homeBtn');if(hb)hb.remove();
    const _show=showView;showView=function(v){_show(v);TABS.cur=v;const g=TABS.groupOf(v);if(g)TABS.remember(g,v);TABS.render()};
  }
};
TABS.init();
