/* ---------- Arrangement charts: every part on the Chart ---------- */
// A pan track in Studio with "Show on Chart" on gets its own part here, beside yours: the same sections as your
// chart (or every 8 bars when there are none), its notes in its pan's letters and octave dots, two bars a line.
// Pick a part at the top of the Chart tab to see it, edit it, or share it (PDF, picture, text) with its player;
// "Whole arrangement" in Share puts every part in one PDF. Your own part, Write and the game are untouched:
// while a part is drawn or shared, the song briefly wears that part's notes, then goes straight back.
var PARTS={   // var: other parts of the app can ask about it before this has run
  list:[],cur:null,on:false,saved:null,pend:false,
  part(){return this.cur?this.list.find(p=>p.id===this.cur)||null:null},
  async refresh(){
    try{this.list=typeof STUDIO!=='undefined'&&STUDIO.parts?await STUDIO.parts():[]}catch{this.list=[]}
    if(this.cur&&!this.part())this.cur=null;this.renderPick();
  },
  // the song's sections, from your own chart; every 8 bars when there aren't any
  sections(){
    let secs=[];try{secs=sectionsNow()}catch{}
    const g=STUDIO.songGeo&&STUDIO.songGeo();
    if(!secs.length&&g){const bar=g.spb*g.bpb;for(let b=0;b<g.bars;b+=8)secs.push({name:'Bars '+(b+1)+'–'+Math.min(g.bars,b+8),t:Math.max(0,g.origin+b*bar),end:g.origin+Math.min(g.bars,b+8)*bar})}
    return secs.map(s=>({name:s.name,t:s.t,end:s.end}));
  },
  // a part's chart, written the way yours is: a section heading with its time, then two bars a line
  autoText(p,secs){
    const g=STUDIO.songGeo&&STUDIO.songGeo(),two=g?g.spb*g.bpb*2:4,all=p.cues,keep=S.cues,out=[];
    if(!all.length)return '';
    const list=secs.length?secs.slice():[{name:'Part',t:0,end:1e9}];
    const lastEnd=list[list.length-1].end,tailStart=Math.max(lastEnd,0);
    if(all.some(c=>c.start>=tailStart-1e-3))list.push({name:'More',t:tailStart,end:1e9});
    if(all.some(c=>c.start<list[0].t-1e-3))list.unshift({name:'Pickup',t:Math.min(...all.map(c=>c.start)),end:list[0].t});
    try{for(const s of list){const lines=[],to=Math.min(s.end,Math.max(...all.map(c=>c.start))+two);
        for(let a=s.t;a<Math.min(s.end,to)-1e-3;a+=two){S.cues=all.filter(c=>c.start>=a-1e-3&&c.start<Math.min(a+two,s.end)-1e-3);if(!S.cues.length)continue;
          const t=autoChart().split('\n').filter(l=>l.trim()&&!/^#/.test(l.trim())).join('  ');if(t)lines.push(t)}
        if(lines.length)out.push('# '+s.name+' @'+tShort(s.t)+'\n'+lines.join('\n'))}}
    finally{S.cues=keep}
    return out.join('\n\n');
  },
  // the song wears this part for a moment (nothing is saved while it does)
  swap(p){
    if(this.on||!p)return false;const secs=this.sections();
    this.saved={cues:S.cues,chart:S.chart,panSet:S.panSet,title:S.title,swapped:S.swapped};
    S.panSet=p.panSet;if(p.panSet!=='guitar')S.swapped=false;S.cues=p.cues;this.panCtx(p.panSet);
    S.chart={text:p.text!=null?p.text:this.autoText(p,secs),edited:true};
    S.title=(this.saved.title||'Song')+' · '+p.name;this.on=true;return true;
  },
  unswap(){if(!this.on)return;Object.assign(S,this.saved);this.saved=null;this.panCtx(setKey());this.on=false;
    // the song's own name back on top
    const at=$('appTitle');if(at&&S.title&&at.textContent!==S.title)at.textContent=S.title;
    try{renderChecklist()}catch{}
    if(this.pend){this.pend=false;save();try{songTouch()}catch{}}},
  // the pan the letters are read against (and drawn and coloured with): like choosing the pan, without telling the rest of the app
  panCtx(k){PANS=SETS[k].views;ORD.clear();PANS.forEach((p,pi)=>p.fields.forEach((f,fi)=>ORD.set(f[0],[pi,fi])));
    for(const x in NOTE_PAN)delete NOTE_PAN[x];for(const p of PANS)for(const f of p.fields)NOTE_PAN[FIELDS.get(f[0]).label]=f[7];
    try{groupCss()}catch{}},
  sync(fn){const did=this.swap(this.part());try{return fn()}finally{if(did)this.unswap()}},
  async async(fn){const did=this.swap(this.part());try{return await fn()}finally{if(did)this.unswap()}},
  label(p){return p?esc(p.name)+(p.name!==SETS[p.panSet].name?' <small>'+esc(SETS[p.panSet].name)+'</small>':''):'My part <small>'+esc(SETS[setKey()].name)+'</small>'},
  renderPick(){
    let bar=$('partPick');const sheet=$('sheet');if(!sheet)return;
    if(!bar){bar=document.createElement('div');bar.id='partPick';bar.setAttribute('role','group');bar.setAttribute('aria-label','Which part');sheet.parentNode.insertBefore(bar,sheet);
      bar.addEventListener('click',e=>{const b=e.target.closest('[data-part]');if(!b)return;this.pick(b.dataset.part||null)})}
    bar.hidden=!this.list.length;if(!this.list.length)return;
    bar.innerHTML=[null,...this.list].map(p=>'<button data-part="'+(p?p.id:'')+'" aria-pressed="'+((p?p.id:null)===this.cur)+'">'+(p?HOME.mini(p.panSet,22):HOME.mini(setKey(),22))+'<span>'+this.label(p)+'</span></button>').join('');
  },
  pick(id){
    this.cur=id;
    // a part is shown as a chart (Letters and Pan tab are for your own part)
    if(id&&S.sheetView!=='chart'){S.sheetView='chart'}
    try{chartEditing=false}catch{}
    this.renderPick();renderCues();
    const p=this.part();say(p?'Showing the '+p.name+' part. Share sends this part.':'Showing your part.');
  },
  async allPdf(btn){
    const keep=this.cur,t=btn.querySelector('b').textContent;btn.disabled=true;btn.querySelector('b').textContent='Preparing…';
    try{
      if(!(window.jspdf&&window.jspdf.jsPDF)){try{await loadScript(window.PAN_APP?'jspdf.umd.min.js':'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')}catch{say('Could not prepare the PDF. Check your connection.');return}}
      await this.refresh();
      const pdf=new window.jspdf.jsPDF({unit:'pt',format:'letter'}),pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight();let n=0;
      for(const p of [null,...this.list]){this.cur=p?p.id:null;const pages=await sheetCanvases('pdf');
        pages.forEach(cv=>{if(n++)pdf.addPage();pdf.addImage(cv.toDataURL('image/jpeg',0.92),'JPEG',0,0,pw,ph)})}
      this.cur=keep;await offerFile(fileBase()+' - arrangement.pdf',pdf.output('blob'));
    }finally{this.cur=keep;btn.disabled=!downloads;btn.querySelector('b').textContent=t;this.renderPick()}
  },
  init(){
    // nothing is saved while the song wears a part
    const _save=save;save=function(...a){if(PARTS.on){PARTS.pend=true;return}return _save.apply(this,a)};
    const _touch=songTouch;songTouch=function(...a){if(PARTS.on){PARTS.pend=true;return}return _touch.apply(this,a)};
    // the Chart tab, a part's chart in it, the editor, and sharing all follow the part you picked
    const _rc=renderCues;renderCues=function(...a){
      if(!PARTS.cur||PARTS.on||document.body.dataset.view!=='part')return _rc.apply(this,a);
      const r=PARTS.sync(()=>_rc.apply(this,a));
      const p=PARTS.part(),lab=document.querySelector('#sheet .chartbar .help');if(p&&lab)lab.textContent=p.text!=null?'Your edited '+p.name+' part':'Made from the '+p.name+' track in Studio';
      return r};
    const _oe=openChartEditor;openChartEditor=function(...a){return PARTS.cur?PARTS.sync(()=>_oe.apply(this,a)):_oe.apply(this,a)};
    const _sr=sectionRange;sectionRange=function(...a){return PARTS.cur?PARTS.sync(()=>_sr.apply(this,a)):_sr.apply(this,a)};
    const _sc=sheetCanvases;sheetCanvases=function(...a){return PARTS.cur?PARTS.async(()=>_sc.apply(this,a)):_sc.apply(this,a)};
    // the key line under the title was written for the Double Guitar: other pans get their own
    const key=txt=>{if(isGuitar())return txt;const L=txt.split('\n');if(/^Double guitar/.test(L[1]||''))L[1]=SETS[setKey()].name+' · a dot above = an octave up, below = an octave down · x2 = repeat · r = roll';return L.join('\n')};
    const _cp=chartPlainText;chartPlainText=function(...a){return PARTS.cur?PARTS.sync(()=>key(_cp.apply(this,a))):key(_cp.apply(this,a))};
    const _pt=partText;partText=function(...a){return PARTS.cur?PARTS.sync(()=>_pt.apply(this,a)):_pt.apply(this,a)};
    // saving or rebuilding a part's chart writes to that track, never to your own chart
    $('sheet').addEventListener('click',e=>{
      const p=PARTS.part();if(!p)return;const b=e.target.closest('[data-ch]');if(!b)return;const act=b.dataset.ch;
      if(act==='save'){e.stopImmediatePropagation();const v=$('chartIn').value,secs=PARTS.sections(),auto=PARTS.sync(()=>PARTS.autoText(p,secs));
        STUDIO.setPartText(p.id,v.trim()===auto.trim()?null:v);chartEditing=false;PARTS.refresh().then(()=>renderCues());say('Saved the '+p.name+' part.');return}
      if(act==='rebuild'){e.stopImmediatePropagation();
        if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Tap again to replace';setTimeout(()=>{b.dataset.armed='';b.textContent='Rebuild from cues'},3000);return}
        const secs=PARTS.sections();$('chartIn').value=PARTS.sync(()=>PARTS.autoText(p,secs));$('chartIn').dispatchEvent(new Event('input'));say('Rebuilt from the '+p.name+' track. Save to keep it, or Cancel.');return}
    },true);
    // the parts are looked up each time the Chart tab opens (and when Studio changes them)
    const _show=showView;showView=function(v){const r=_show(v);if(v==='part')PARTS.refresh().then(()=>{if(PARTS.cur)renderCues()});return r};
    PAN_HOOKS.push(()=>{PARTS.cur=null;PARTS.list=[];PARTS.renderPick()});
    // Share: the whole arrangement in one PDF
    const tiles=document.querySelector('#shareSheet .tiles');
    if(tiles){const b=document.createElement('button');b.className='tile';b.id='expAll';b.hidden=true;
      b.innerHTML='<b>Whole arrangement</b><span>Every part in one PDF</span>';b.onclick=()=>this.allPdf(b);tiles.insertBefore(b,tiles.children[1]||null);
      const _os=openShare;openShare=function(on,...a){const r=_os.call(this,on,...a);if(on)PARTS.refresh().then(()=>{b.hidden=!PARTS.list.length;b.disabled=!downloads;
        const t=$('shareTitle');if(t)t.textContent=PARTS.part()?'Share the '+PARTS.part().name+' part':'Share with your band'});return r}}
  }
};
PARTS.init();
