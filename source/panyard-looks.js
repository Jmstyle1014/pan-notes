/* ---------- Pan look: every pan its own style, photos, note names and hit colour ---------- */
// Kept on this phone (and in backups), one look per kind of pan. Only the look changes: the notes keep their
// shapes and places, so taps land exactly as before. Photos sit behind the notes; Line up moves, turns and sizes a
// photo until your real notes sit under the outlines. The Double Guitar's photos are the ones it already had.
var LOOK={   // var: Setup can ask about it before this part has run
  KEYS:['guitar','tenor','dten','dsec','fcello','six','seven'],
  STYLES:[['night','App look'],   // the usual style: it takes the app look's colours (Night, Chrome Night, Trinidad & Tobago...)
  ['steel','Steel'],['painted','Painted'],['photo','My photos']],
  NAMES:[['oct','Letters + octaves'],['plain','Letters'],['none','Hidden']],
  HITS:['','#ffd166','#7be07b','#ff8fc7','#8fc7ff','#ffffff'],
  GUITAR_COL:{ec:'#e0824f',bf:'#3c9fa6'},
  d:{},urls:{},tab:null,n:0,
  of(k){const x=this.d[k]||{};return{style:this.STYLES.some(s=>s[0]===x.style)?x.style:'night',names:this.NAMES.some(s=>s[0]===x.names)?x.names:'oct',hit:this.HITS.includes(x.hit)?x.hit:'',al:x.al&&typeof x.al==='object'?x.al:{}}},
  load(){try{const x=JSON.parse(localStorage.getItem('pan-looks')||'{}');this.d=x&&typeof x==='object'?x:{}}catch{this.d={}}},
  save(){try{localStorage.setItem('pan-looks',JSON.stringify(this.d))}catch{}},
  set(k,patch){this.d[k]=Object.assign(this.of(k),patch);this.save();this.apply();this.renderPanel()},
  drums(k){
    if(k==='guitar')return[{pk:'ec',name:'E / C pan'},{pk:'bf',name:'B / F pan'}];
    const v=SETS[k].views[0];return v.drums.map((d,i)=>({i,name:v.drums.length===1?SETS[k].name:(k==='six'||k==='seven'?d.name+' drum':/pan$/.test(d.name)?d.name:d.name+' pan')}));
  },
  slot(k,dr){return k==='guitar'?dr.pk:String(dr.i)},
  src(k,slot){return k==='guitar'?photoSrc(slot):(this.urls[k+':'+slot]||null)},
  async loadPhotos(){
    for(const k of this.KEYS){if(k==='guitar')continue;for(const dr of this.drums(k)){const b=await idbGet('look:'+k+':'+dr.i);if(b instanceof Blob)this.urls[k+':'+dr.i]=URL.createObjectURL(b)}}
    this.paintAll(true);this.renderPanel();
  },
  // the guitar's own photo switch follows its look, so every screen that draws the guitar agrees
  syncGuitar(){const want=this.of('guitar').style==='photo'?'photo':'diagram';if(S.look!==want){S.look=want;try{renderLook()}catch{}try{renderPans()}catch{}}},
  apply(){this.syncGuitar();this.paintAll(true)},
  keyOf(svg){const f=svg.querySelector('.field');if(!f)return null;const id=f.dataset.field;return /^(\w+):/.test(id)?id.split(':')[0]:'guitar'},
  strip:s=>s.replace(/[̣̤̇̈]/g,''),
  paintAll(force){document.querySelectorAll('.pan svg').forEach(svg=>{if(svg.closest('#lkAlign'))return;this.paint(svg,force)})},
  paint(svg,force){
    const k=this.keyOf(svg);if(!k||!SETS[k])return;const L=this.of(k),wrap=svg.closest('.pan');
    const sig=[L.style,L.names,L.hit,JSON.stringify(L.al),L.style==='photo'?this.drums(k).map(dr=>this.src(k,this.slot(k,dr))||'').join(','):''].join('|');
    // a field moved in from somewhere else keeps its old letters: check those every time
    svg.querySelectorAll('.field text').forEach(t=>{if(t.dataset.l==null)t.dataset.l=t.textContent;const want=L.names==='plain'?this.strip(t.dataset.l):t.dataset.l;if(t.textContent!==want)t.textContent=want});
    if(!force&&svg.dataset.lk===sig)return;svg.dataset.lk=sig;
    if(wrap){wrap.dataset.lk=L.style;wrap.dataset.lkn=L.names;if(L.hit)wrap.style.setProperty('--lkhit',L.hit);else wrap.style.removeProperty('--lkhit');wrap.classList.toggle('lkhit',!!L.hit)}
    // painted: each note takes its group's colour (each drum, or each ring of the tenor)
    svg.querySelectorAll('.field').forEach(f=>{
      if(L.style!=='painted'){f.style.removeProperty('--gc');return}
      const x=FIELDS.get(f.dataset.field);let c=null;
      if(k==='guitar')c=this.GUITAR_COL[x&&x.grp]||null;else{const g=(SETS[k].groups||[]).find(g=>g.key===(x&&x.grp));c=g&&g.color}
      if(c)f.style.setProperty('--gc',c)});
    // photos behind the notes
    svg.querySelectorAll('.lk-photo,.lk-clip').forEach(e=>e.remove());
    if(L.style!=='photo')return;
    if(svg.querySelector('image:not(.lk-photo)'))return;   // the guitar's photo already drawn the classic way
    const NS='http://www.w3.org/2000/svg',add=(bed,rim,slot,base)=>{
      const src=this.src(k,slot);if(!src||!bed)return;
      const id='lkc'+(++this.n),cp=document.createElementNS(NS,'clipPath');cp.setAttribute('id',id);cp.setAttribute('class','lk-clip');
      const sh=bed.cloneNode(false);sh.removeAttribute('class');cp.appendChild(sh);bed.parentNode.insertBefore(cp,bed.nextSibling);
      const im=document.createElementNS(NS,'image');im.setAttribute('class','lk-photo');im.setAttribute('href',src);
      im.setAttribute('x',base.x);im.setAttribute('y',base.y);im.setAttribute('width',base.w);im.setAttribute('height',base.h);im.setAttribute('preserveAspectRatio','xMidYMid slice');
      const a=Object.assign({x:0,y:0,s:1,r:0},L.al[slot]||{}),cx=base.x+base.w/2,cy=base.y+base.h/2;
      im.setAttribute('transform','translate('+(cx+a.x)+' '+(cy+a.y)+') rotate('+a.r+') scale('+a.s+') translate('+(-cx)+' '+(-cy)+')');
      const g=document.createElementNS(NS,'g');g.setAttribute('class','lk-photo');g.setAttribute('clip-path','url(#'+id+')');g.appendChild(im);
      cp.parentNode.insertBefore(g,cp.nextSibling)};
    const groups=[...svg.querySelectorAll('g[data-drum]')];
    if(groups.length){groups.forEach(g=>{const pk=g.dataset.pk,slot=k==='guitar'?pk:g.dataset.drum;add(g.querySelector('.bed'),g.querySelector('.rim'),slot,this.base(k,slot,g.querySelector('.rim')))});return}
    if(k==='guitar'){const pk=wrap&&wrap.classList.contains('pan-bf')?'bf':'ec';add(svg.querySelector('.bed'),svg.querySelector('.rim'),pk,this.base(k,pk))}
    else{const rims=[...svg.querySelectorAll('.rim')];[...svg.querySelectorAll('.bed')].forEach((b,i)=>add(b,rims[i],String(i),this.base(k,String(i),rims[i])))}
  },
  // the box a photo fills before lining up: the guitar's whole picture, or the drum's rim
  base(k,slot,rim){
    if(k==='guitar'){const p=GUITAR_PANS.find(p=>p.key===slot)||GUITAR_PANS[0],[x,y,w,h]=p.view.split(' ').map(Number);return{x,y,w,h}}
    const d=SETS[k].views[0].drums[+slot]||SETS[k].views[0].drums[0],r=Math.max(d.rx,d.ry);return{x:d.cx-r,y:d.cy-r,w:2*r,h:2*r};
  },
  /* ---- the Setup page ---- */
  panel(){
    if($('lkPanel'))return;
    const p=document.createElement('div');p.className='panel';p.id='lkPanel';p.dataset.sk='photos';
    p.innerHTML='<h2>Pan look</h2><p class="help">Each pan keeps its own look. This song\'s pan is chosen.</p><div class="lk-tabs" id="lkTabs"></div><div class="lk-grid" id="lkStyles"></div>'
      +'<div id="lkPhotos"></div>'
      +'<div class="lab">Note names<div class="seg" id="lkNames"></div></div>'
      +'<div class="lab">Colour when a note plays<div class="lk-sw" id="lkHit"></div></div>'
      +'<input type="file" id="lkFile" accept="image/jpeg,image/png,image/webp" hidden>';
    const old=$('lookSeg')&&$('lookSeg').closest('.panel');
    if(old){old.parentNode.insertBefore(p,old);old.style.display='none';old.dataset.off='1';old.removeAttribute('data-sk')}else $('view-setup').appendChild(p);
    p.addEventListener('click',e=>{const b=e.target.closest('[data-lk]');if(!b)return;const k=this.tab,v=b.dataset.v;
      switch(b.dataset.lk){
        case 'tab':this.tab=v;this.renderPanel();this.preview();break;
        case 'style':this.set(k,{style:v});if(v==='photo'&&!this.drums(k).some(dr=>this.src(k,this.slot(k,dr))))say('Add a photo for each drum below.');break;
        case 'names':this.set(k,{names:v});break;
        case 'hit':this.set(k,{hit:v});break;
        case 'pick':if(k==='guitar'){const i=$('photo-'+v);if(i)i.click()}else{this.pickSlot=v;$('lkFile').click()}break;
        case 'line':this.align(k,v);break;
        case 'del':this.delPhoto(k,v);break;
      }});
    $('lkFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await this.addPhoto(this.tab,this.pickSlot,f)};
    // the guitar's photo pickers already exist: when one finishes, show it here too
    for(const pk of['ec','bf']){const i=$('photo-'+pk);if(i)i.addEventListener('change',()=>setTimeout(()=>{if(this.of('guitar').style!=='photo')this.set('guitar',{style:'photo'});else{this.apply();this.renderPanel()}},400))}
  },
  renderPanel(){
    const p=$('lkPanel');if(!p)return;if(!this.tab||!SETS[this.tab])this.tab=setKey();const k=this.tab,L=this.of(k);
    $('lkTabs').innerHTML=this.KEYS.map(x=>'<button data-lk="tab" data-v="'+x+'" aria-pressed="'+(x===k)+'">'+esc(SETS[x].name)+'</button>').join('');
    $('lkStyles').innerHTML=this.STYLES.map(([v,n])=>'<button class="lk-t lk-'+v+'" data-lk="style" data-v="'+v+'" aria-pressed="'+(L.style===v)+'"><span class="lk-mini"><i></i><i></i><i></i></span>'+n+'</button>').join('');
    const ph=$('lkPhotos');
    if(L.style==='photo'){
      ph.innerHTML='<h3 class="sub">Photos</h3><p class="help">One photo for each drum. Then Line up, so your real notes sit under the outlines.</p>'+this.drums(k).map(dr=>{const sl=this.slot(k,dr),src=this.src(k,sl);
        return '<div class="lk-row"><span class="lk-th" style="'+(src?'background-image:url(&quot;'+esc(src)+'&quot;)':'')+'"></span><b>'+esc(dr.name)+'</b><button class="btn sm" data-lk="pick" data-v="'+sl+'">'+(src?'Change':'Choose')+'</button>'
          +(src?'<button class="btn sm" data-lk="line" data-v="'+sl+'">Line up</button>':'')+(src&&k!=='guitar'?'<button class="btn sm lk-x" data-lk="del" data-v="'+sl+'" aria-label="Remove this photo">✕</button>':'')+'</div>'}).join('');
    }else ph.innerHTML='';
    $('lkNames').innerHTML=this.NAMES.map(([v,n])=>'<button data-lk="names" data-v="'+v+'" aria-pressed="'+(L.names===v)+'">'+n+'</button>').join('');
    $('lkHit').innerHTML=this.HITS.map(c=>'<button data-lk="hit" data-v="'+c+'" aria-pressed="'+(L.hit===c)+'" aria-label="'+(c?'Colour '+c:'Usual colour')+'" style="'+(c?'background:'+c:'')+'">'+(c?'':'Usual')+'</button>').join('');
    // Pan order (swap left and right) is only for the Double Guitar
    const op=$('swap')&&$('swap').closest('.panel');if(op)op.style.display=isGuitar()?'':'none';
    try{SETUP.render()}catch{}
  },
  preview(){},
  async addPhoto(k,slot,f){
    if(!['image/jpeg','image/png','image/webp'].includes(f.type)){say('Choose a JPG, PNG or WebP photo.');return}
    say('Adding photo…');
    try{
      // made smaller first: a pan photo doesn't need more than this, and it keeps backups small
      const bmp=await createImageBitmap(f),M=1400,sc=Math.min(1,M/Math.max(bmp.width,bmp.height)),cv=document.createElement('canvas');
      cv.width=Math.round(bmp.width*sc);cv.height=Math.round(bmp.height*sc);cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);
      const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',.86));if(!blob)throw 0;
      await idbPut('look:'+k+':'+slot,blob);const key=k+':'+slot;if(this.urls[key])URL.revokeObjectURL(this.urls[key]);this.urls[key]=URL.createObjectURL(blob);
      const al=Object.assign({},this.of(k).al);delete al[slot];this.set(k,{style:'photo',al});
      say('Photo added. Now line it up.');this.align(k,slot);
    }catch{say('Could not add that photo. Try another, or a JPG.')}
  },
  async delPhoto(k,slot){await idbPut('look:'+k+':'+slot,null);const key=k+':'+slot;if(this.urls[key])URL.revokeObjectURL(this.urls[key]);delete this.urls[key];const al=Object.assign({},this.of(k).al);delete al[slot];this.set(k,{al});say('Photo removed.')},
  /* ---- Line up: one drum, big, the photo under the note outlines; drag, pinch and turn ---- */
  align(k,slot){
    const src=this.src(k,slot);if(!src)return;
    let ov=$('lkAlign');if(!ov){ov=document.createElement('div');ov.id='lkAlign';ov.className='sheetov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');document.body.appendChild(ov)}
    const base=this.base(k,slot),cx=base.x+base.w/2,cy=base.y+base.h/2,half=Math.max(base.w,base.h)/2*1.04;
    // the drum's own notes, drawn the usual way, then just their outlines kept
    const view=k==='guitar'?GUITAR_PANS.find(p=>p.key===slot):SETS[k].views[0],tmp=document.createElement('div');tmp.innerHTML=panSVG(view,false);
    const ids=k==='guitar'?view.fields.map(f=>f[0]):(STAGE.drumsOf(k)[+slot]||{ids:[]}).ids;
    let defs='';tmp.querySelectorAll('defs').forEach(d=>defs+=d.innerHTML);
    const fl=ids.map(id=>{const e=tmp.querySelector('.field[data-field="'+CSS.escape(id)+'"]');return e?e.outerHTML:''}).join('');
    const d=k==='guitar'?null:view.drums[+slot],clip=d?'<circle cx="'+d.cx+'" cy="'+d.cy+'" r="'+(Math.max(d.rx,d.ry)*.97)+'"/>':'<rect x="'+base.x+'" y="'+base.y+'" width="'+base.w+'" height="'+base.h+'"/>';
    const name=(this.drums(k).find(dr=>this.slot(k,dr)===slot)||{}).name||'';
    ov.innerHTML='<div class="sheet lk-al"><div class="lk-alh"><b>Line up · '+esc(name)+'</b><button class="btn primary sm" data-a="done">Done</button></div>'
      +'<p class="help">Drag to move. Pinch to size. Turn with two fingers, or use the buttons.</p>'
      +'<div class="lk-alstage pan"><svg viewBox="'+(cx-half)+' '+(cy-half)+' '+2*half+' '+2*half+'" id="lkAlSvg"><defs>'+defs+'<clipPath id="lkAlClip">'+clip+'</clipPath></defs>'
      +'<rect x="'+(cx-half)+'" y="'+(cy-half)+'" width="'+2*half+'" height="'+2*half+'" fill="#0d0a1a"/>'
      +'<g clip-path="url(#lkAlClip)"><image id="lkAlImg" href="'+esc(src)+'" x="'+base.x+'" y="'+base.y+'" width="'+base.w+'" height="'+base.h+'" preserveAspectRatio="xMidYMid slice"/></g>'
      +(d?'<circle cx="'+d.cx+'" cy="'+d.cy+'" r="'+Math.max(d.rx,d.ry)*.97+'" fill="none" stroke="#ffd166" stroke-width="'+half*.012+'" stroke-dasharray="'+half*.04+' '+half*.03+'"/>':'')
      +'<g class="lk-alnotes">'+fl+'</g></svg></div>'
      +'<div class="row lk-alb"><button class="btn" data-a="rl" aria-label="Turn left">⟲</button><button class="btn" data-a="rr" aria-label="Turn right">⟳</button><button class="btn" data-a="zo" aria-label="Smaller">−</button><button class="btn" data-a="zi" aria-label="Bigger">+</button><button class="btn" data-a="reset">Reset</button></div></div>';
    ov.hidden=false;
    const L=this.of(k),a=Object.assign({x:0,y:0,s:1,r:0},L.al[slot]||{}),img=ov.querySelector('#lkAlImg'),sv=ov.querySelector('#lkAlSvg');
    const draw=()=>img.setAttribute('transform','translate('+(cx+a.x)+' '+(cy+a.y)+') rotate('+a.r+') scale('+a.s+') translate('+(-cx)+' '+(-cy)+')');draw();
    const keep=()=>{const al=Object.assign({},this.of(k).al);al[slot]={x:+a.x.toFixed(1),y:+a.y.toFixed(1),s:+a.s.toFixed(4),r:+a.r.toFixed(2)};this.d[k]=Object.assign(this.of(k),{al});this.save()};
    const unit=()=>2*half/sv.getBoundingClientRect().width;   // screen pixels to drawing units
    const P=new Map();let g0=null;
    const geo=()=>{const [p1,p2]=[...P.values()];return{d:Math.hypot(p2.x-p1.x,p2.y-p1.y),ang:Math.atan2(p2.y-p1.y,p2.x-p1.x)*180/Math.PI,mx:(p1.x+p2.x)/2,my:(p1.y+p2.y)/2}};
    sv.onpointerdown=e=>{e.preventDefault();sv.setPointerCapture(e.pointerId);P.set(e.pointerId,{x:e.clientX,y:e.clientY});g0=P.size===2?Object.assign(geo(),{s:a.s,r:a.r,ax:a.x,ay:a.y}):null};
    sv.onpointermove=e=>{const q=P.get(e.pointerId);if(!q)return;const u=unit();
      if(P.size===1){a.x+=(e.clientX-q.x)*u;a.y+=(e.clientY-q.y)*u;q.x=e.clientX;q.y=e.clientY;draw();return}
      q.x=e.clientX;q.y=e.clientY;if(!g0)return;const g=geo();a.s=Math.max(.3,Math.min(4,g0.s*g.d/Math.max(1,g0.d)));a.r=g0.r+(g.ang-g0.ang);a.x=g0.ax+(g.mx-g0.mx)*u;a.y=g0.ay+(g.my-g0.my)*u;draw()};
    const up=e=>{P.delete(e.pointerId);g0=P.size===2?Object.assign(geo(),{s:a.s,r:a.r,ax:a.x,ay:a.y}):null;keep()};
    sv.onpointerup=up;sv.onpointercancel=up;
    sv.onwheel=e=>{e.preventDefault();a.s=Math.max(.3,Math.min(4,a.s*(e.deltaY<0?1.05:1/1.05)));draw();keep()};
    const close=()=>{keep();ov.hidden=true;ov.innerHTML='';this.apply();this.renderPanel()};
    ov.onclick=e=>{const b=e.target.closest('[data-a]');if(e.target===ov){close();return}if(!b)return;
      ({rl:()=>a.r-=3,rr:()=>a.r+=3,zo:()=>a.s=Math.max(.3,a.s/1.05),zi:()=>a.s=Math.min(4,a.s*1.05),reset:()=>Object.assign(a,{x:0,y:0,s:1,r:0}),done:close}[b.dataset.a]||(()=>{}))();if(b.dataset.a!=='done'){draw();keep()}};
    this.alignClose=close;
  },
  defs(){
    if($('lookDefs'))return;const d=document.createElement('div');d.id='lookDefs';d.setAttribute('aria-hidden','true');d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML='<svg width="0" height="0" focusable="false"><defs>'
      +'<linearGradient id="lkSteelRim" x1="0" x2="1"><stop offset="0" stop-color="#7c818c"/><stop offset=".25" stop-color="#ffffff"/><stop offset=".5" stop-color="#b7bcc6"/><stop offset=".78" stop-color="#f6f8fb"/><stop offset="1" stop-color="#7c818c"/></linearGradient>'
      +'<radialGradient id="lkSteelBed" cx=".42" cy=".36" r=".8"><stop offset="0" stop-color="#5d626d"/><stop offset=".6" stop-color="#3a3e47"/><stop offset="1" stop-color="#25282e"/></radialGradient>'
      +'<radialGradient id="lkSteelZone" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#9aa0ab"/><stop offset=".55" stop-color="#6e7480"/><stop offset="1" stop-color="#555a65"/></radialGradient>'
      +'<linearGradient id="lkSandRim" x1="0" x2="1"><stop offset="0" stop-color="#a8956c"/><stop offset=".3" stop-color="#fff2d2"/><stop offset=".6" stop-color="#d9c493"/><stop offset="1" stop-color="#a8956c"/></linearGradient>'
      +'</defs></svg>';document.body.appendChild(d);
  },
  init(){
    this.defs();this.load();this.panel();this.renderPanel();this.syncGuitar();
    // anything drawn later (a new screen, a turn of the phone, another track's pans) gets its look too
    let q=0;new MutationObserver(()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;this.paintAll(false)})}).observe(document.body,{childList:true,subtree:true});
    this.loadPhotos();
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('lkAlign')&&!$('lkAlign').hidden&&this.alignClose)this.alignClose()});
    // a new song, or another pan for this one: the page follows it
    PAN_HOOKS.push(()=>{this.tab=setKey();this.syncGuitar();this.renderPanel();requestAnimationFrame(()=>this.paintAll(true))});
    // backups carry the looks and the photos too
    const be=window.backupExtra;window.backupExtra=async()=>{const o=be?await be():{};const ph={};
      for(const [key,u] of Object.entries(this.urls)){try{ph[key]=await readData(await (await fetch(u)).blob())}catch{}}
      return Object.assign(o,{panLooks:{d:this.d,photos:ph}})};
    const bi=window.backupIn;window.backupIn=async p=>{let m=bi?await bi(p):'';const pl=p&&p.panLooks;
      if(pl&&typeof pl==='object'){if(pl.d&&typeof pl.d==='object')for(const k of this.KEYS)if(pl.d[k]&&typeof pl.d[k]==='object'){const x=pl.d[k];this.d[k]={style:x.style,names:x.names,hit:x.hit,al:{}};
          if(x.al&&typeof x.al==='object')for(const [s,v] of Object.entries(x.al))if(v&&typeof v==='object')this.d[k].al[String(s).slice(0,4)]={x:+v.x||0,y:+v.y||0,s:Math.max(.3,Math.min(4,+v.s||1)),r:+v.r||0};this.d[k]=this.of(k)}
        this.save();let n=0;
        if(pl.photos&&typeof pl.photos==='object')for(const [key,du] of Object.entries(pl.photos)){const [k,sl]=key.split(':');if(!SETS[k]||k==='guitar'||!/^\d+$/.test(sl)||typeof du!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(du))continue;
          const b=dataUrlToBlob(du,du.slice(5,du.indexOf(';')));await idbPut('look:'+k+':'+sl,b);if(this.urls[key])URL.revokeObjectURL(this.urls[key]);this.urls[key]=URL.createObjectURL(b);n++}
        this.apply();this.renderPanel();m+=' Pan looks added'+(n?' with '+n+' photo'+(n===1?'':'s'):'')+'.'}
      return m};
  }
};
LOOK.init();
