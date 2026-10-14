
/* ---------- Chart: your part written the way you write it on paper ---------- */
// Chords stack (left pan's note on top) with ×N under them for how many beats they're played;
// ×N after a run of notes means repeat that run. Sections (Intro, Verse…) carry the time they start,
// so you can jump to or loop a section. The chart is made from your cues, and you can edit it as text.
const NOTE_PAN={};for(const p of PANS)for(const f of p.fields)NOTE_PAN[f[1]]=p.key;
const toSym=s=>s.replace(/^([A-G])#/,'$1♯').replace(/^([A-G])b/,'$1♭');
const toAsc=s=>s.replace('♯','#').replace('♭','b');
const SECTION_NAMES=['Intro','Verse','Chorus','Bridge','Arrangement','Jam','Outro'];
const MARK_KEYS={roll:'r',strum:'s',drop:'d'},MARK_BACK={r:'roll',s:'strum',d:'drop'};
const tShort=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=Math.floor(t-m*60);return m+':'+String(s).padStart(2,'0')};
let chartEditing=false,chartModel=null;
function chartEvents(){
  const out=[];
  for(const c of S.cues){
    if(c.note)out.push({t:c.start,note:c.note});
    if(!c.steps.length)continue;
    if(c.mode==='sequence'){const n=c.steps.length;c.steps.forEach((id,i)=>out.push({t:c.start+i*c.duration/n,d:c.duration/n,ids:[id],fx:markOf(c)}))}
    else out.push({t:c.start,d:c.duration,ids:[...c.steps].sort(byScreen),fx:markOf(c)});
  }
  return out.sort((a,b)=>a.t-b.t||(a.note?-1:1));
}
// repeated phrases in a run of single notes: E G B G E E G B G E → (E G B G E) x2
function compressRun(run){
  const out=[],eq=(a,b)=>a.lab===b.lab&&a.fx===b.fx;
  for(let i=0;i<run.length;){
    let best={L:1,r:1};
    for(let L=1;L<=8&&i+2*L<=run.length;L++){
      let r=1;while(i+(r+1)*L<=run.length&&run.slice(i+r*L,i+(r+1)*L).every((x,k)=>eq(x,run[i+k])))r++;
      if(r>=2&&L*r>best.L*best.r)best={L,r};
    }
    if(best.r>=2){out.push(best.L===1?{type:'note',...run[i],n:best.r}:{type:'group',items:run.slice(i,i+best.L).map(x=>({type:'note',...x,n:1})),n:best.r});i+=best.L*best.r}
    else{out.push({type:'note',...run[i],n:1});i++}
  }
  return out;
}
function lineTokens(evs){
  const toks=[];let run=[];
  const flush=()=>{if(run.length)toks.push(...compressRun(run));run=[]};
  for(let i=0;i<evs.length;i++){
    const e=evs[i];
    if(e.note){flush();toks.push({type:'com',text:e.note});continue}
    const labs=e.ids.map(id=>FIELDS.get(id).label);
    if(labs.length===1){run.push({lab:labs[0],fx:e.fx});continue}
    flush();
    let n=1;const key=labs.join('/')+e.fx;
    while(i+1<evs.length&&evs[i+1].ids&&evs[i+1].ids.map(id=>FIELDS.get(id).label).join('/')+evs[i+1].fx===key){n++;i++}
    toks.push({type:'chord',labs,fx:e.fx,n});
  }
  flush();return toks;
}
function autoChart(){
  const ev=chartEvents();if(!ev.length)return '';
  const beat=S.grid?60/S.grid.bpm:0.5,bar=S.grid?beat*S.grid.perBar:2;
  const lineGap=Math.max(0.9,beat*2.2),secGap=Math.max(2.6,bar*1.4);
  const secs=[];let sec=null,line=null,prevEnd=-1e9;
  for(const e of ev){
    const gap=e.t-prevEnd;
    if(!sec||gap>=secGap){sec={t:e.t,lines:[]};secs.push(sec);line=null}
    if(!line||gap>=lineGap||line.filter(x=>!x.note).length>=16){line=[];sec.lines.push(line)}
    line.push(e);if(!e.note)prevEnd=Math.max(prevEnd,e.t+(e.fx==='roll'?e.d:Math.min(e.d,0.35)));
  }
  const tokText=t=>t.type==='com'?'['+t.text.replace(/[\[\]]/g,'')+']':t.type==='chord'?t.labs.map(toAsc).join('/')+(MARK_KEYS[t.fx]||'')+(t.n>1?' x'+t.n:''):t.type==='group'?'('+t.items.map(tokText).join(' ')+') x'+t.n:toAsc(t.lab)+(MARK_KEYS[t.fx]||'')+(t.n>1?' x'+t.n:'');
  const bodies=secs.map(s=>s.lines.map(l=>lineTokens(l).map(tokText).join('  ')).join('\n'));
  // the first part is the intro; a part that's the same as an earlier one gets that one's name
  let k=1;const names=[];
  return secs.map((s,i)=>{const same=bodies.findIndex(b=>b===bodies[i]);names[i]=i===0?'Intro':same<i?names[same]:'Section '+(++k);
    return '# '+names[i]+' @'+tShort(s.t)+'\n'+bodies[i]}).join('\n\n');
}
const chartText=()=>S.chart&&S.chart.edited&&typeof S.chart.text==='string'?S.chart.text:autoChart();
/* reading the text back */
function parseChart(text){
  const secs=[];let sec=null;
  for(const raw of String(text||'').split('\n')){
    const ln=raw.trim();if(!ln)continue;
    const h=/^#\s*(.*?)\s*(?:@\s*(\d+):(\d{1,2}(?:\.\d+)?))?\s*$/.exec(ln);
    if(h){sec={name:h[1]||'Section',t:h[2]!==undefined?(+h[2])*60+(+h[3]):null,lines:[]};secs.push(sec);continue}
    if(!sec){sec={name:'',t:null,lines:[]};secs.push(sec)}
    sec.lines.push(parseLine(ln));
  }
  return secs;
}
function parseLine(ln){
  const parts=ln.match(/\[[^\]]*\]?|\(|\)|\||[x×]\d+|[^\s()\[\]|]+/g)||[];
  const root=[],stack=[root];
  const cur=()=>stack[stack.length-1];
  for(const p of parts){
    const list=cur();
    if(p[0]==='['){list.push({type:'com',text:p.replace(/^\[|\]$/g,'')});continue}
    if(p==='('){const g={type:'group',items:[],n:1};list.push(g);stack.push(g.items);continue}
    if(p===')'){if(stack.length>1)stack.pop();continue}
    if(p==='|'){list.push({type:'bar'});continue}
    if(p==='-'||p==='·'||p==='.'){list.push({type:'rest'});continue}
    const rep=/^[x×](\d+)$/.exec(p);
    if(rep){const n=Math.min(99,+rep[1]),last=list[list.length-1];
      if(!last){list.push({type:'text',text:p});continue}
      if(last.type==='chord'||last.type==='group'){last.n=n;continue}
      if(last.type==='note'){
        // "E G B G E x2": the run of single notes since the last chord, bar line or comment repeats
        let j=list.length-1;while(j>0&&list[j-1].type==='note'&&list[j-1].n===1)j--;
        const run=list.splice(j);list.push(run.length===1?{...run[0],n}:{type:'group',items:run,n});continue}
      list.push({type:'text',text:p});continue}
    const m=/^([A-G](?:#|b|♯|♭)?(?:\/[A-G](?:#|b|♯|♭)?)*)([rsd])?$/.exec(p);
    if(m){const labs=m[1].split('/').map(toSym),fx=MARK_BACK[m[2]]||'',bad=labs.some(l=>!NOTE_PAN[l]);
      list.push(labs.length>1?{type:'chord',labs,fx,n:1,bad}:{type:'note',lab:labs[0],fx,n:1,bad});continue}
    list.push({type:'text',text:p});
  }
  return root;
}
/* drawing it on screen */
function tokHTML(t){
  const mk=t.fx?'<i class="cm" title="'+MARK_NAMES[t.fx]+'">'+MARKS[t.fx]+'</i>':'';
  if(t.type==='note')return '<span class="cn '+(NOTE_PAN[t.lab]||'bad')+'">'+esc(t.lab)+mk+(t.n>1?'<small class="cxr">×'+t.n+'</small>':'')+'</span>';
  if(t.type==='chord')return '<span class="cch'+(t.bad?' bad':'')+'"><span class="cst">'+t.labs.map(l=>'<b class="'+(NOTE_PAN[l]||'bad')+'">'+esc(l)+'</b>').join('')+'</span>'+mk+(t.n>1?'<small class="cxb">×'+t.n+'</small>':'')+'</span>';
  if(t.type==='group')return '<span class="cgrp"><span class="cgi">'+t.items.map(tokHTML).join('')+'</span>'+(t.n>1?'<small class="cxr">×'+t.n+'</small>':'')+'</span>';
  if(t.type==='com')return '<span class="ccom">['+esc(t.text)+']</span>';
  if(t.type==='bar')return '<span class="cbar" aria-hidden="true"></span>';
  if(t.type==='rest')return '<span class="crest">·</span>';
  return '<span class="ctext">'+esc(t.text)+'</span>';
}
function chartHTML(secs,live){
  if(!secs.length)return '<p class="empty">No notes yet. Tap along in Write, or tap ✎ Edit chart and write your part.</p>';
  return '<div class="chart">'+secs.map((s,i)=>'<section class="csec" data-i="'+i+'">'+(s.name||s.t!==null?'<div class="csech"><b>'+esc(s.name||'Section')+'</b>'+(s.t!==null?'<span class="ct">'+tShort(s.t)+'</span>'+(live?'<span class="cact"><button class="mini" data-ch="go" data-i="'+i+'" aria-label="Play from '+esc(s.name)+'">▶</button><button class="mini" data-ch="loop" data-i="'+i+'" aria-label="Loop '+esc(s.name)+'">⟲ Loop</button></span>':''):'')+'</div>':'')
    +s.lines.map(l=>'<div class="cline">'+l.map(tokHTML).join('')+'</div>').join('')+'</section>').join('')+'</div>';
}
function renderChartView(){
  const box=$('sheet');if(chartEditing)return;
  const text=chartText(),secs=parseChart(text);
  box.innerHTML='<div class="chartbar"><button class="btn" data-ch="edit">✎ Edit chart</button><span class="help">'+(S.chart&&S.chart.edited?'Your edited chart':'Made from your cues')+(S.grid?'':' · set the tempo for tidier counts')+'</span></div>'+chartHTML(secs,true);
  chartModel={secs:secs.map((s,i)=>({t:s.t,el:box.querySelector('.csec[data-i="'+i+'"]')})).filter(x=>x.t!==null),cur:null};
}
function chartLive(t){
  const M=chartModel;if(!M||!M.secs.length)return;
  let cur=null;for(const s of M.secs)if(t>=s.t-0.05)cur=s;
  if(cur!==M.cur){if(M.cur&&M.cur.el)M.cur.el.classList.remove('cur');M.cur=cur;if(cur&&cur.el){cur.el.classList.add('cur');
    const box=$('sheet');if(!audio.paused&&box.scrollHeight>box.clientHeight)box.scrollTo({top:Math.max(0,cur.el.offsetTop-box.offsetTop-8),behavior:'smooth'})}}
}
function sectionRange(i){
  const secs=parseChart(chartText()).filter(s=>s.t!==null),all=parseChart(chartText()),s=all[i];if(!s||s.t===null)return null;
  const nx=secs.find(x=>x.t>s.t+0.01),d=Number.isFinite(audio.duration)?audio.duration:totalLen();
  return [s.t,nx?nx.t:d];
}
/* editing as text */
function openChartEditor(){
  chartEditing=true;const box=$('sheet');
  box.innerHTML='<div class="cedit">'
   +'<div class="cchips" role="group" aria-label="Add a section at the playhead">'+SECTION_NAMES.map(n=>'<button class="mini" data-ch="sec" data-n="'+n+'">+ '+n+'</button>').join('')+'<button class="mini" data-ch="sec" data-n="">+ Other…</button></div>'
   +'<p class="help ckey"><b>E/B</b> together (left pan on top) · <b>E/B x2</b> for 2 beats · <b>E G B G E x2</b> repeat · <b>F#r</b> roll (s strum, d drop) · <b>|</b> bar line · <b>-</b> rest · <b>[note]</b> comment · <b># Verse @0:20</b> section</p>'
   +'<textarea id="chartIn" rows="10" spellcheck="false" autocapitalize="characters" aria-label="Your chart"></textarea>'
   +'<div class="row"><button class="btn primary grow" data-ch="save">Save chart</button><button class="btn" data-ch="cancel">Cancel</button><button class="btn" data-ch="rebuild">Rebuild from cues</button></div>'
   +'<p class="help">Preview</p><div id="chartPrev"></div></div>';
  const ta=$('chartIn');ta.value=chartText();
  const prev=()=>{$('chartPrev').innerHTML=chartHTML(parseChart(ta.value),false)};
  ta.addEventListener('input',()=>{clearTimeout(ta._t);ta._t=setTimeout(prev,150)});prev();
}
$('sheet').addEventListener('click',e=>{
  const b=e.target.closest('[data-ch]');if(!b)return;const act=b.dataset.ch;
  if(act==='edit'){openChartEditor();return}
  if(act==='cancel'){chartEditing=false;renderCues();return}
  if(act==='save'){S.chart={text:$('chartIn').value.slice(0,40000),edited:true};chartEditing=false;save();renderCues();say('Chart saved. It will stay as you wrote it.');return}
  if(act==='rebuild'){
    if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Tap again to replace';setTimeout(()=>{b.dataset.armed='';b.textContent='Rebuild from cues'},3000);return}
    $('chartIn').value=autoChart();$('chartIn').dispatchEvent(new Event('input'));say('Rebuilt from your cues. Save to keep it, or Cancel.');return}
  if(act==='sec'){
    const n=b.dataset.n||'New section';
    const ta=$('chartIn'),t=hasAudio?audio.currentTime:0,ins=(ta.selectionStart>0&&ta.value[ta.selectionStart-1]!=='\n'?'\n':'')+'# '+n+' @'+tShort(t)+'\n';
    const at=ta.selectionStart;ta.setRangeText(ins,at,ta.selectionEnd,'end');ta.focus();ta.dispatchEvent(new Event('input'));
    if(!b.dataset.n)say('Added a section. Rename it by changing the word after #.');return}
  if(act==='go'||act==='loop'){
    if(!hasAudio){say('Add your recording in Setup to jump to sections.');return}
    const r=sectionRange(+b.dataset.i);if(!r)return;
    if(act==='loop'){A=r[0];B=r[1];loop=true;renderLoop();say('Looping '+(parseChart(chartText())[+b.dataset.i].name||'this section')+'. Turn the loop off in Practice.')}
    audio.currentTime=r[0];audio.play().catch(()=>{});return}
});
/* the chart on paper (PDF / picture) */
function layoutChart(W){
  const M=60,CW=W-2*M,F=sheetFont(),D='"Bricolage Grotesque", system-ui, sans-serif',mg=document.createElement('canvas').getContext('2d');
  const ink=v=>{const c=getComputedStyle(document.documentElement).getPropertyValue(v).trim(),m=/^#([0-9a-f]{6})$/i.exec(c);if(!m)return v==='--ec'?'#b8561c':'#1d64ad';const n=parseInt(m[1],16);return 'rgb('+[(n>>16)&255,(n>>8)&255,n&255].map(x=>Math.round(x*.68)).join(',')+')'};
  const COL={ec:ink('--ec'),bf:ink('--bf'),bad:'#c0392b'},FS=34,LH=36;
  const secs=parseChart(chartText()),blocks=layoutSheet(W).blocks.slice(0,1);
  blocks.push({h:46,draw:(g,y)=>{g.fillStyle=RULE;g.fillRect(M,y+4,CW,2);g.font='16px '+F;g.textAlign='left';g.textBaseline='alphabetic';let x=M;
    const seg=(t,c)=>{g.fillStyle=c;g.fillText(t,x,y+32);x+=g.measureText(t).width};
    seg('E / C pan ●  ',COL.ec);seg('B / F pan ●   ',COL.bf);seg('Stacked = together, ×N under = beats · ×N after a run = repeat · r roll · s strum · d drop',SUB)}});
  // size of a token: width and how far it reaches below the letter line
  const size=t=>{
    if(t.type==='note'){mg.font='700 '+FS+'px '+F;let w=mg.measureText(t.lab).width;if(t.fx)w+=12;if(t.n>1){mg.font='700 18px '+F;w+=mg.measureText('×'+t.n).width+4}return{w,h:LH}}
    if(t.type==='chord'){mg.font='700 '+FS+'px '+F;let w=Math.max(...t.labs.map(l=>mg.measureText(l).width));if(t.fx)w+=12;return{w:w+6,h:t.labs.length*LH+(t.n>1?22:0)}}
    if(t.type==='group'){let w=0,h=LH;t.items.forEach((x,i)=>{const z=size(x);w+=z.w+(i?14:0);h=Math.max(h,z.h)});if(t.n>1){mg.font='700 18px '+F;w+=mg.measureText('×'+t.n).width+6}return{w:w+4,h:h+8}}
    if(t.type==='com'){mg.font='italic 20px '+F;return{w:mg.measureText('['+t.text+']').width,h:LH}}
    if(t.type==='bar')return{w:4,h:LH};if(t.type==='rest')return{w:12,h:LH};
    mg.font='20px '+F;return{w:mg.measureText(t.text).width,h:LH};
  };
  const draw=(g,t,x,y)=>{   // y = top of the letter line
    g.textAlign='left';g.textBaseline='alphabetic';
    if(t.type==='note'){g.font='700 '+FS+'px '+F;g.fillStyle=COL[NOTE_PAN[t.lab]||'bad'];g.fillText(t.lab,x,y+LH-6);let w=g.measureText(t.lab).width;
      if(t.fx){g.font='700 16px '+F;g.fillStyle=ACCENT;g.fillText(MARKS[t.fx],x+w+1,y+LH+2);w+=12}
      if(t.n>1){g.font='700 18px '+F;g.fillStyle=ACCENT;g.fillText('×'+t.n,x+w+3,y+LH-6)}return}
    if(t.type==='chord'){g.font='700 '+FS+'px '+F;const w=Math.max(...t.labs.map(l=>g.measureText(l).width));
      t.labs.forEach((l,i)=>{g.fillStyle=COL[NOTE_PAN[l]||'bad'];g.textAlign='center';g.fillText(l,x+w/2+3,y+(i+1)*LH-6)});
      if(t.fx){g.font='700 16px '+F;g.fillStyle=ACCENT;g.textAlign='left';g.fillText(MARKS[t.fx],x+w+6,y+14)}
      if(t.n>1){g.font='700 17px '+F;g.fillStyle=SUB;g.textAlign='center';g.fillText('×'+t.n,x+w/2+3,y+t.labs.length*LH+14)}g.textAlign='left';return}
    if(t.type==='group'){let gx=x;t.items.forEach((it,i)=>{if(i)gx+=14;draw(g,it,gx,y);gx+=size(it).w});
      g.strokeStyle=ACCENT;g.lineWidth=2;g.beginPath();g.moveTo(x,y+LH+2);g.lineTo(x,y+LH+6);g.lineTo(gx,y+LH+6);g.lineTo(gx,y+LH+2);g.stroke();
      if(t.n>1){g.font='700 18px '+F;g.fillStyle=ACCENT;g.fillText('×'+t.n,gx+6,y+LH-6)}return}
    if(t.type==='com'){g.font='italic 20px '+F;g.fillStyle=SUB;g.fillText('['+t.text+']',x,y+LH-8);return}
    if(t.type==='bar'){g.fillStyle='#7f9596';g.fillRect(x+1,y+2,2,LH);return}
    if(t.type==='rest'){g.fillStyle=SUB;g.beginPath();g.arc(x+6,y+LH*0.6,3,0,Math.PI*2);g.fill();return}
    g.font='20px '+F;g.fillStyle=SUB;g.fillText(t.text,x,y+LH-8);
  };
  const GAP=22;
  for(const s of secs){
    if(s.name||s.t!==null)blocks.push({h:52,draw:(g,y)=>{g.fillStyle=INK;g.font='800 24px '+D;g.textAlign='left';g.textBaseline='alphabetic';g.fillText((s.name||'Section').toUpperCase(),M,y+36);
      const w=g.measureText((s.name||'Section').toUpperCase()).width;if(s.t!==null){g.fillStyle=SUB;g.font='16px '+F;g.fillText(tShort(s.t),M+w+12,y+36)}g.fillStyle=RULE;g.fillRect(M,y+46,CW,1.5)}});
    for(const line of s.lines){
      // wrap long lines across the page width
      let row=[],rw=0;const rows=[];
      for(const t of line){const z=size(t);if(row.length&&rw+z.w>CW){rows.push(row);row=[];rw=0}row.push(t);rw+=z.w+GAP}
      if(row.length)rows.push(row);
      for(const r of rows){const h=Math.max(...r.map(t=>size(t).h))+18;
        blocks.push({h,draw:(g,y)=>{let x=M;for(const t of r){draw(g,t,x,y+6);x+=size(t).w+GAP}}})}
    }
    blocks.push({h:14,draw:()=>{}});
  }
  if(!secs.length)blocks.push({h:60,draw:(g,y)=>{g.fillStyle=SUB;g.font='22px '+F;g.textAlign='left';g.fillText('No notes yet.',M,y+36)}});
  return{blocks,M};
}
// the chart as plain text for group chats
function chartPlainText(){
  const secs=parseChart(chartText()),out=[(S.title||'My part').toUpperCase(),'Double guitar · stacked = together (left pan first), x2 under a chord = beats, x2 after notes = repeat, r = roll',''];
  const tt=t=>t.type==='note'?t.lab+(t.fx?MARKS[t.fx]:'')+(t.n>1?' ×'+t.n:''):t.type==='chord'?t.labs.join('/')+(t.fx?MARKS[t.fx]:'')+(t.n>1?' ×'+t.n:''):t.type==='group'?'('+t.items.map(tt).join(' ')+')'+(t.n>1?' ×'+t.n:''):t.type==='com'?'['+t.text+']':t.type==='bar'?'|':t.type==='rest'?'·':t.text;
  for(const s of secs){if(s.name||s.t!==null)out.push((s.name||'Section').toUpperCase()+(s.t!==null?' ('+tShort(s.t)+')':''));for(const l of s.lines)out.push('  '+l.map(tt).join('  '));out.push('')}
  out.push('Made with Pan Notes');return out.join('\n');
}
