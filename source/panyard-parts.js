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
    try{ARR.data=typeof STUDIO!=='undefined'&&STUDIO.arrangementData?STUDIO.arrangementData():null}catch{ARR.data=null}
    if(this.cur==='__arr'?!ARR.data:this.cur&&!this.part())this.cur=null;this.renderPick();
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
  sync(fn){if(this.cur==='__arr')return fn();const did=this.swap(this.part());try{return fn()}finally{if(did)this.unswap()}},
  async async(fn){if(this.cur==='__arr')return await fn();const did=this.swap(this.part());try{return await fn()}finally{if(did)this.unswap()}},
  label(p){return p?esc(p.name)+(p.name!==SETS[p.panSet].name?' <small>'+esc(SETS[p.panSet].name)+'</small>':''):'My part <small>'+esc(SETS[setKey()].name)+'</small>'},
  renderPick(){
    let bar=$('partPick');const sheet=$('sheet');if(!sheet)return;
    if(!bar){bar=document.createElement('div');bar.id='partPick';bar.setAttribute('role','group');bar.setAttribute('aria-label','Which part');sheet.parentNode.insertBefore(bar,sheet);
      bar.addEventListener('click',e=>{const b=e.target.closest('[data-part]');if(!b)return;this.pick(b.dataset.part||null)})}
    bar.hidden=!this.list.length&&!ARR.data;if(bar.hidden)return;
    bar.innerHTML=[null,...this.list].map(p=>'<button data-part="'+(p?p.id:'')+'" aria-pressed="'+((p?p.id:null)===this.cur)+'">'+(p?HOME.mini(p.panSet,22):HOME.mini(setKey(),22))+'<span>'+this.label(p)+'</span></button>').join('')
      +(ARR.data?'<button data-part="__arr" class="pp-arr" aria-pressed="'+(this.cur==='__arr')+'"><span class="pp-ic" aria-hidden="true">♫</span><span>Arrangement <small>'+ARR.data.secs.length+' sections</small></span></button>':'');
  },
  pick(id){
    this.cur=id;if(id==='__arr'){this.renderPick();renderCues();say('Showing your arrangement from Studio.');return}
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
      if(PARTS.cur==='__arr'&&document.body.dataset.view==='part'){const r=_rc.apply(this,a);ARR.render();return r}
      if(PARTS.cur==='__arr')return _rc.apply(this,a);
      if(!PARTS.cur||PARTS.on||document.body.dataset.view!=='part')return _rc.apply(this,a);
      const r=PARTS.sync(()=>_rc.apply(this,a));
      const p=PARTS.part(),lab=document.querySelector('#sheet .chartbar .help');if(p&&lab)lab.textContent=p.text!=null?'Your edited '+p.name+' part':'Made from the '+p.name+' track in Studio';
      return r};
    const _oe=openChartEditor;openChartEditor=function(...a){if(PARTS.cur==='__arr')return;return PARTS.cur?PARTS.sync(()=>_oe.apply(this,a)):_oe.apply(this,a)};
    const _sr=sectionRange;sectionRange=function(...a){return PARTS.cur?PARTS.sync(()=>_sr.apply(this,a)):_sr.apply(this,a)};
    const _sc=sheetCanvases;sheetCanvases=function(...a){if(PARTS.cur==='__arr'&&ARR.data)return ARR.canvases(a[0]);return PARTS.cur&&PARTS.cur!=='__arr'?PARTS.async(()=>_sc.apply(this,a)):_sc.apply(this,a)};
    // the key line under the title was written for the Double Guitar: other pans get their own
    const key=txt=>{if(isGuitar())return txt;const L=txt.split('\n');if(/^Double guitar/.test(L[1]||''))L[1]=SETS[setKey()].name+' · a dot above = an octave up, below = an octave down · x2 = repeat · r = roll';return L.join('\n')};
    const _cp=chartPlainText;chartPlainText=function(...a){if(PARTS.cur==='__arr')return ARR.text();return PARTS.cur?PARTS.sync(()=>key(_cp.apply(this,a))):key(_cp.apply(this,a))};
    const _pt=partText;partText=function(...a){if(PARTS.cur==='__arr')return ARR.text();return PARTS.cur?PARTS.sync(()=>_pt.apply(this,a)):_pt.apply(this,a)};
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

/* ---------- the arrangement: every pan in the song, section by section, written the way your chart is ---------- */
// Each section is written in lines of bars (8 a line where there's room, 4 on a phone): one row per pan, the pans
// from the highest (tenor) down to the bass. Drums and the engine room are left off. An empty bar shows a dash.
// A section that's note-for-note the same as an earlier one just says "Same as …".
var ARR={
  data:null,
  // the tokens for one pan in one bar, read against that pan (its letters, octave dots and colours)
  bars(tr,a,b){
    const g=this.data.geo,bar=g.spb*g.bpb,keep=S.cues,out=[];
    try{PARTS.panCtx(tr.panSet);
      for(let k=a;k<b;k++){const t0=g.origin+k*bar,t1=t0+bar;S.cues=tr.cues.filter(c=>c.start>=t0-1e-3&&c.start<t1-1e-3);
        const toks=S.cues.length?lineTokens(chartEvents()):[];const ann=t=>{if(t.type==='note')t.k=NOTE_PAN[t.lab];if(t.type==='chord')t.ks=t.labs.map(l=>NOTE_PAN[l]);if(t.items)t.items.forEach(ann)};toks.forEach(ann);
        out.push({toks,html:toks.map(tokHTML).join('')})}}
    finally{S.cues=keep;PARTS.panCtx(setKey())}
    return out;
  },
  perLine(){const w=($('sheet')&&$('sheet').clientWidth)||innerWidth;return w>=640?8:4},
  css(){if($('arrCss'))return;const st=document.createElement('style');st.id='arrCss';let c='';
    for(const k in SETS)for(const gr of SETS[k].groups||[])if(gr.color)c+='.arrv .cn.'+gr.key+',.arrv .cst b.'+gr.key+'{color:'+gr.color+'}';
    st.textContent=c;document.head.appendChild(st)},
  render(){
    const box=$('sheet'),D=this.data;if(!box||!D)return;this.css();
    const per=this.perLine();this.lastPer=per;
    let h='<div class="chartbar arrbar"><b class="arrt">Arrangement</b><span class="help">From the Song tab in Studio · drums left off</span><span class="arrsp"></span><button class="btn" data-arr="pdf">Share as PDF</button><button class="btn" data-arr="png">Share as picture</button></div><div class="arrv">';
    D.secs.forEach((x,i)=>{
      h+='<section class="arrsec"><div class="arrh"><b>'+esc(x.name)+'</b><small>'+(x.b-x.a>1?'bars '+(x.a+1)+'–'+x.b:'bar '+(x.a+1))+'</small></div>';
      if(x.same>=0){h+='<p class="arrsame">Same as '+esc(D.secs[x.same].name)+'</p></section>';return}
      const rows=D.tracks.map(tr=>({tr,bars:this.bars(tr,x.a,x.b)}));
      if(!rows.some(r=>r.bars.some(b=>b.toks.length))){h+='<p class="arrsame">Not filled yet</p></section>';return}
      for(let s0=0;s0<x.b-x.a;s0+=per){
        h+='<div class="arrsys" style="--per:'+per+'"><div class="arrnum"><span></span>'+Array.from({length:Math.min(per,x.b-x.a-s0)},(_,k)=>'<i>'+(x.a+s0+k+1)+'</i>').join('')+'</div>';
        for(const r of rows){h+='<div class="arrrow"><span class="arrpn"><b>'+esc(r.tr.name)+'</b>'+(r.tr.role?'<small>'+esc(r.tr.role)+'</small>':'')+'</span>'
          +r.bars.slice(s0,s0+per).map(b=>'<div class="arrbar1">'+(b.toks.length?b.html:'<span class="arrdash">–</span>')+'</div>').join('')+'</div>'}
        h+='</div>'}
      h+='</section>'});
    box.innerHTML=h+'</div><p class="help arrkey">A dot above a letter is an octave up, below is an octave down. Letters in a box play together. ×2 means play it twice; r is a roll.</p>';
    box.querySelectorAll('[data-arr]').forEach(b=>b.onclick=()=>this.share(b.dataset.arr,b));
  },
  // as plain text, for sharing as text
  text(){
    const D=this.data;if(!D)return '';const tl=t=>t.type==='note'?toAsc(t.lab)+(t.n>1?' x'+t.n:''):t.type==='chord'?t.labs.map(toAsc).join('/')+(t.n>1?' x'+t.n:''):t.type==='group'?'('+t.items.map(tl).join(' ')+') x'+t.n:t.type==='rest'?'-':'';
    const out=[D.title+' · arrangement',''];
    D.secs.forEach(x=>{out.push('# '+x.name+' (bars '+(x.a+1)+'–'+x.b+')');if(x.same>=0){out.push('Same as '+D.secs[x.same].name,'');return}
      const all=D.tracks.map(tr=>this.bars(tr,x.a,x.b));if(!all.some(bs=>bs.some(b=>b.toks.length))){out.push('Not filled yet','');return}
      for(const [ti,tr] of D.tracks.entries()){const bs=all[ti];out.push(tr.name+': | '+bs.map(b=>b.toks.length?b.toks.map(tl).join(' '):'-').join(' | ')+' |')}out.push('')});
    return out.join('\n');
  },
  // drawn for the PDF and the picture: US letter turned sideways, 8 bars a line
  async canvases(mode){
    try{await document.fonts.ready}catch{}
    const D=this.data,W=1650,H=1275,M=56,F=sheetFont(),DF='"Bricolage Grotesque", system-ui, sans-serif',LW=170,per=8,bw=(W-2*M-LW)/per,FS=26,LH=30,mg=document.createElement('canvas').getContext('2d');
    const COL={};for(const k in SETS)for(const gr of SETS[k].groups||[])if(gr.color)COL[gr.key]=gr.color;COL.ec=COL.ec||'#b8561c';COL.bf=COL.bf||'#1d64ad';
    const col=k=>k&&COL[k]?shade(COL[k]):INK;
    function shade(hex){const m=/^#([0-9a-f]{6})$/i.exec(hex);if(!m)return hex;const n=parseInt(m[1],16);return 'rgb('+[(n>>16)&255,(n>>8)&255,n&255].map(v=>Math.round(v*.55)).join(',')+')'}
    const size=(t,s)=>{const f=FS*s,lh=LH*s;mg.font='700 '+f+'px '+F;
      if(t.type==='note'){let w=mg.measureText(t.lab).width;if(t.n>1){mg.font='700 '+16*s+'px '+F;w+=mg.measureText('×'+t.n).width+3}if(t.fx)w+=10*s;return{w,h:lh}}
      if(t.type==='chord'){let w=Math.max(...t.labs.map(l=>mg.measureText(l).width))+10*s;let h=t.labs.length*lh+4;if(t.n>1)h+=18*s;return{w,h}}
      if(t.type==='group'){let w=0,h=lh;t.items.forEach((x,i)=>{const z=size(x,s);w+=z.w+(i?8*s:0);h=Math.max(h,z.h)});if(t.n>1){mg.font='700 '+16*s+'px '+F;w+=mg.measureText('×'+t.n).width+6}return{w:w+4,h:h+8}}
      return{w:10*s,h:lh}};
    const draw=(g,t,x,y,s)=>{const f=FS*s,lh=LH*s;g.textAlign='left';g.textBaseline='alphabetic';
      if(t.type==='note'){g.font='700 '+f+'px '+F;g.fillStyle=col(t.k);g.fillText(t.lab,x,y+lh-5*s);let w=g.measureText(t.lab).width;
        if(t.fx){g.font='700 '+14*s+'px '+F;g.fillStyle=ACCENT;g.fillText(MARKS[t.fx]||'',x+w+1,y+lh);w+=10*s}
        if(t.n>1){g.font='700 '+16*s+'px '+F;g.fillStyle=ACCENT;g.fillText('×'+t.n,x+w+3,y+lh-5*s)}return}
      if(t.type==='chord'){const z=size(t,s);g.strokeStyle=CHORDLINE;g.lineWidth=1.5;g.setLineDash([4,3]);g.strokeRect(x,y-2,z.w,t.labs.length*lh+4);g.setLineDash([]);
        g.font='700 '+f+'px '+F;t.labs.forEach((l,i)=>{g.fillStyle=col(t.ks&&t.ks[i]);g.textAlign='center';g.fillText(l,x+z.w/2,y+(i+1)*lh-5*s)});
        if(t.n>1){g.font='700 '+15*s+'px '+F;g.fillStyle=ACCENT;g.textAlign='center';g.fillText('×'+t.n,x+z.w/2,y+t.labs.length*lh+16*s)}g.textAlign='left';return}
      if(t.type==='group'){let gx=x+2;t.items.forEach((it,i)=>{if(i)gx+=8*s;draw(g,it,gx,y,s);gx+=size(it,s).w});
        g.strokeStyle=ACCENT;g.lineWidth=2;g.beginPath();g.moveTo(x,y+lh+2);g.lineTo(x,y+lh+6);g.lineTo(gx,y+lh+6);g.lineTo(gx,y+lh+2);g.stroke();
        if(t.n>1){g.font='700 '+16*s+'px '+F;g.fillStyle=ACCENT;g.fillText('×'+t.n,gx+5,y+lh-5*s)}return}
      g.fillStyle=SUB;g.beginPath();g.arc(x+5*s,y+lh*.6,3,0,Math.PI*2);g.fill()};
    // blocks: the title, then per section its heading and its lines of bars (one row per pan)
    const blocks=[];
    blocks.push({h:96,draw:(g,y)=>{g.fillStyle=INK;g.font='800 38px '+DF;g.textAlign='left';g.fillText(D.title,M,y+44);g.fillStyle=SUB;g.font='18px '+F;
      g.fillText('Arrangement · '+D.tracks.map(t=>t.name).join(', ')+' · '+Math.round(D.bpm)+' bpm · drums left off',M,y+74);g.fillStyle=RULE;g.fillRect(M,y+88,W-2*M,2)}});
    D.secs.forEach(x=>{
      blocks.push({h:54,draw:(g,y)=>{g.fillStyle=INK;g.font='800 24px '+DF;g.textAlign='left';const nm=x.name.toUpperCase();g.fillText(nm,M,y+38);const w=g.measureText(nm).width;
        g.fillStyle=SUB;g.font='16px '+F;g.fillText(x.b-x.a>1?'bars '+(x.a+1)+'–'+x.b:'bar '+(x.a+1),M+w+12,y+38)}});
      if(x.same>=0){blocks.push({h:44,draw:(g,y)=>{g.fillStyle=SUB;g.font='italic 22px '+F;g.fillText('Same as '+D.secs[x.same].name,M+8,y+28)}});return}
      const rows=D.tracks.map(tr=>({tr,bars:this.bars(tr,x.a,x.b)}));
      if(!rows.some(r=>r.bars.some(b=>b.toks.length))){blocks.push({h:44,draw:(g,y)=>{g.fillStyle=SUB;g.font='italic 22px '+F;g.fillText('Not filled yet',M+8,y+28)}});return}
      for(let s0=0;s0<x.b-x.a;s0+=per){
        const n=Math.min(per,x.b-x.a-s0);
        blocks.push({h:22,draw:(g,y)=>{g.fillStyle=SUB;g.font='13px '+F;for(let k=0;k<n;k++)g.fillText(String(x.a+s0+k+1),M+LW+k*bw+4,y+16)}});
        for(const r of rows){
          const cells=r.bars.slice(s0,s0+n).map(b=>{const ws=b.toks.map(t=>size(t,1)),tw=ws.reduce((a,z)=>a+z.w,0)+Math.max(0,ws.length-1)*8,sc=tw>bw-14?Math.max(.5,(bw-14)/tw):1;
            return{b,sc,h:b.toks.length?Math.max(...b.toks.map(t=>size(t,sc).h)):LH}});
          const rh=Math.max(LH,...cells.map(c=>c.h))+16;
          blocks.push({h:rh,draw:(g,y)=>{
            g.fillStyle=INK;g.font='700 17px '+F;g.textAlign='left';g.fillText(r.tr.name,M,y+24);if(r.tr.role){g.fillStyle=SUB;g.font='13px '+F;g.fillText(r.tr.role,M,y+42)}
            g.fillStyle='#7f9596';for(let k=0;k<=n;k++)g.fillRect(M+LW+k*bw-1,y+4,2,rh-8);
            g.fillStyle=RULE;g.fillRect(M,y+rh-1,LW+n*bw,1);
            cells.forEach((c,k)=>{let cx=M+LW+k*bw+8;if(!c.b.toks.length){g.fillStyle=SUB;g.font='22px '+F;g.textAlign='center';g.fillText('–',M+LW+k*bw+bw/2,y+LH);g.textAlign='left';return}
              c.b.toks.forEach(t=>{draw(g,t,cx,y+8,c.sc);cx+=size(t,c.sc).w+8*c.sc})})}})
        }
        blocks.push({h:16,draw:()=>{}});
      }
    });
    blocks.push({h:40,draw:(g,y)=>{g.fillStyle=SUB;g.font='15px '+F;g.textAlign='left';g.fillText('A dot above a letter is an octave up, below is an octave down · letters in a box play together · ×2 = twice · r = roll',M,y+26)}});
    const pages=[];let page=[],y=M;
    for(const b of blocks){if(y+b.h>H-M-24&&page.length){pages.push(page);page=[];y=M}page.push({b,y});y+=b.h}
    if(page.length)pages.push(page);
    const cvs=pages.map((pg,i)=>{const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');g.fillStyle='#ffffff';g.fillRect(0,0,W,H);
      for(const {b,y} of pg)b.draw(g,y);g.fillStyle=SUB;g.font='15px '+F;g.textAlign='left';if(i)g.fillText(D.title+' · arrangement',M,H-28);g.textAlign='right';g.fillText('Page '+(i+1)+' of '+pages.length,W-M,H-28);return cv});
    if(mode==='pdf')return cvs;
    const GAPY=24,cv=document.createElement('canvas');cv.width=W;cv.height=Math.min(16000,cvs.length*H+(cvs.length-1)*GAPY);
    const g=cv.getContext('2d');g.fillStyle='#d5dddd';g.fillRect(0,0,cv.width,cv.height);cvs.forEach((c,i)=>{if((i+1)*H+i*GAPY<=cv.height)g.drawImage(c,0,i*(H+GAPY))});
    return[cv];
  },
  async share(kind,btn){
    const t=btn.textContent;btn.disabled=true;btn.textContent='Preparing…';
    try{
      if(kind==='pdf'){if(!(window.jspdf&&window.jspdf.jsPDF)){try{await loadScript(window.PAN_APP?'jspdf.umd.min.js':'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')}catch{say('Could not prepare the PDF. Check your connection, or share it as a picture.');return}}
        const pages=await this.canvases('pdf'),pdf=new window.jspdf.jsPDF({unit:'pt',format:'letter',orientation:'landscape'}),pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight();
        pages.forEach((cv,i)=>{if(i)pdf.addPage();pdf.addImage(cv.toDataURL('image/jpeg',0.92),'JPEG',0,0,pw,ph)});
        await offerFile(fileBase()+' - arrangement.pdf',pdf.output('blob'))}
      else{const [cv]=await this.canvases('png'),blob=await new Promise(r=>cv.toBlob(r,'image/png'));if(!blob){say('Could not draw the picture. Try the PDF instead.');return}
        if(cv.height>=16000)say('This arrangement is long, so the picture stops partway. Share it as a PDF to get all of it.');
        await offerFile(fileBase()+' - arrangement.png',blob)}
    }finally{btn.disabled=false;btn.textContent=t}
  }
};
addEventListener('resize',()=>{if(PARTS.cur==='__arr'&&document.body.dataset.view==='part'&&ARR.lastPer!==ARR.perLine())ARR.render()});
PARTS.init();
