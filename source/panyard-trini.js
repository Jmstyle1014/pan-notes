
/* ---------- App look: Trinidad & Tobago, with a background you choose ----------
   Chrome Night underneath (its colours and canvases), with mirror-chrome pans on red enamel skirts, a glass play bar
   with a red glow, and a background behind everything: one of the built-in ones (drawn here, no picture files) or a
   picture of your own (made smaller and kept in IndexedDB 'bgPics', so the Google Drive backup has it too).
   The choice is kept per look in localStorage 'panyard-bg' (tt, vm).
   Vincy Mas (St. Vincent and the Grenadines) is the same look in blue, gold and green (html.th-vm): its own backgrounds,
   and the pans' skirts, rims and glow follow the background you pick (the gradients' colours are set in apply()). */
var TT=(()=>{
  const K='panyard-bg',MAXPICS=8;
  let st={};try{st=JSON.parse(localStorage.getItem(K)||'{}')||{}}catch{st={}}
  const keep=()=>{try{localStorage.setItem(K,JSON.stringify(st))}catch{}};
  const LK=()=>{try{return THEME.look()==='vm'?'vm':'tt'}catch{return 'tt'}};
  const DEF={tt:{bg:'silk',dim:20},vm:{bg:'gems',dim:20}};
  const cfg=()=>Object.assign({},DEF[LK()],st[LK()]||{});
  const svgUrl=s=>'url("data:image/svg+xml,'+encodeURIComponent(s)+'")';
  // the islands, from their real outlines (simplified)
  const TRI='M108 207 L135 195 L165 189 L210 183 L255 177 L294 171 L324 168 L315 195 L300 240 L291 285 L291 330 L300 369 L303 381 L270 390 L225 396 L180 402 L135 402 L90 402 L51 405 L24 408 L36 393 L60 381 L90 372 L114 366 L135 357 L156 342 L159 321 L156 294 L159 264 L153 240 L144 225 L126 219 Z',
    TOB='M342 75 L360 69 L390 54 L420 36 L444 21 L447 15 L432 15 L405 30 L375 42 L348 60 L339 69 Z';
  const islands=svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 892" preserveAspectRatio="xMidYMin slice"><defs>'
    +'<clipPath id="i"><path d="'+TRI+'"/><path d="'+TOB+'"/></clipPath><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>'
    +'<radialGradient id="r" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#ff2a3d"/><stop offset="1" stop-color="#8e0a16"/></radialGradient></defs>'
    +'<g transform="translate(-10 120) scale(.92)"><g filter="url(#g)" opacity=".95"><path d="'+TRI+'" fill="none" stroke="#ff1f35" stroke-width="9"/><path d="'+TOB+'" fill="none" stroke="#ff1f35" stroke-width="9"/></g>'
    +'<g clip-path="url(#i)"><rect width="480" height="440" fill="url(#r)"/><path d="M20 120 L470 470 L470 520 L20 170 Z" fill="#f4f0ee"/><path d="M20 140 L470 490 L470 500 L20 150 Z" fill="#0b0b0b"/></g>'
    +'<path d="'+TRI+'" fill="none" stroke="#ff8c97" stroke-width="1.6"/><path d="'+TOB+'" fill="none" stroke="#ff8c97" stroke-width="1.6"/></g></svg>');
  const wave='M-40 420 C 50 350, 140 480, 220 410 S 360 360, 460 430';
  const ribbon=svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 892" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".3" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#000" stop-opacity=".35"/><stop offset=".72" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient></defs>'
    +'<g fill="none"><path d="'+wave+'" stroke="#ce1126" stroke-width="150"/><path d="'+wave+'" stroke="#fff" stroke-width="60"/><path d="'+wave+'" stroke="#0b0b0b" stroke-width="42"/><path d="'+wave+'" stroke="url(#s)" stroke-width="150"/></g></svg>');
  const SASH='#ce1126 0 41%,#f4f0ee 41% 44.5%,#0a0a0a 44.5% 55.5%,#f4f0ee 55.5% 59%,#ce1126 59% 100%';
  // built in: name, and the CSS that draws it
  const pic=f=>"url('backgrounds/"+f+"') center/cover no-repeat,#120406";
  const BGS={
    silk:['Silk flag',pic('tt-silk.jpg')],
    sunset:['Sunset',pic('tt-sunset.jpg')],
    glow:['Island glow',pic('tt-glow.jpg')],
    flag:['Flag','repeating-linear-gradient(100deg,rgb(0 0 0/0) 0 6%,rgb(0 0 0/.22) 9%,rgb(255 255 255/.07) 12%,rgb(0 0 0/0) 15%),repeating-linear-gradient(75deg,rgb(0 0 0/0) 0 11%,rgb(0 0 0/.18) 15%,rgb(255 255 255/.06) 18%,rgb(0 0 0/0) 22%),linear-gradient(to top right,'+SASH+')'],
    islands:['Islands','radial-gradient(60% 30% at 40% 25%,rgb(206 17 38/.22),rgb(0 0 0/0) 70%),'+islands+' top center/100% auto no-repeat,radial-gradient(120% 80% at 50% 40%,#1a1214,#070506)'],
    ribbon:['Ribbon','radial-gradient(70% 35% at 50% 45%,rgb(206 17 38/.28),rgb(0 0 0/0) 70%),'+ribbon+' center/cover no-repeat,#0a0a0c'],
    sash:['Sash of light','radial-gradient(40% 25% at 15% 20%,rgb(206 17 38/.45),transparent),radial-gradient(40% 25% at 90% 85%,rgb(206 17 38/.45),transparent),linear-gradient(to top right,rgb(0 0 0/0) 0 40%,rgb(206 17 38/.6) 40% 43%,rgb(255 255 255/.32) 43% 45%,rgb(0 0 0/.9) 45% 55%,rgb(255 255 255/.32) 55% 57%,rgb(206 17 38/.6) 57% 60%,rgb(0 0 0/0) 60%),#050506'],
    night:['Red night','radial-gradient(80% 45% at 50% 45%,rgb(150 12 28/.55),rgb(0 0 0/0) 70%),radial-gradient(120% 80% at 50% 0%,#24080c,#070506)'],
  };
  /* Vincy Mas: the three gems of the flag, the Grenadines, the flag (drawn here, no picture files) */
  const gems=(cx,cy,w,h,fill,stroke,sw)=>{const g=w*.62;return [[cx-g,cy-h*.28],[cx+g,cy-h*.28],[cx,cy+h*.3]].map(([x,y])=>'<path d="M'+x+' '+(y-h/2)+' L'+(x+w/2)+' '+y+' L'+x+' '+(y+h/2)+' L'+(x-w/2)+' '+y+' Z" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>').join('')};
  // St. Vincent and the Grenadines, simplified from the map (north at the top): St. Vincent, Bequia, Mustique, Canouan, Mayreau, Union, Petit St. Vincent
  const SVG_='M268 70 C292 64 312 84 318 112 C326 150 322 196 306 228 C292 254 270 262 252 252 C232 240 222 210 220 178 C218 140 236 82 268 70 Z|M226 330 C238 318 256 316 262 326 C258 336 244 340 232 344 C224 344 220 338 226 330 Z|M282 356 C290 350 298 354 296 362 C292 368 284 368 282 356 Z|M252 392 C260 386 268 390 266 400 C262 410 254 410 252 392 Z|M212 462 C222 452 234 456 232 468 C228 480 214 480 212 462 Z|M196 500 C202 496 208 500 206 506 C202 510 196 508 196 500 Z|M160 538 C170 528 188 530 190 540 C186 550 168 552 160 538 Z|M206 568 C210 564 214 566 213 571 C210 574 206 573 206 568 Z';
  const isl=SVG_.split('|').map(d=>'<path d="'+d+'"/>').join('');
  const VM={
    gems:['The gems','radial-gradient(60% 32% at 50% 30%,rgb(0 158 96/.35),rgb(0 0 0/0) 70%),'+svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 892" preserveAspectRatio="xMidYMid slice"><defs><filter id="g"><feGaussianBlur stdDeviation="10"/></filter><linearGradient id="d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3ff0a0"/><stop offset=".5" stop-color="#009e60"/><stop offset="1" stop-color="#00422a"/></linearGradient></defs>'
      +'<g filter="url(#g)" opacity=".9">'+gems(206,470,190,330,'none','#fcd116',12)+'</g>'+gems(206,470,190,330,'url(#d)','#fcd116',4)
      +'<rect width="10" height="892" fill="#0047ab"/><rect x="10" width="5" height="892" fill="#fcd116"/><rect x="402" width="10" height="892" fill="#009e60"/><rect x="397" width="5" height="892" fill="#fcd116"/></svg>')+' center/cover no-repeat,radial-gradient(120% 80% at 50% 30%,#06223a,#03080d)'],
    gren:['The Grenadines',svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 892" preserveAspectRatio="xMidYMin slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fe3e0"/><stop offset=".35" stop-color="#0ab3c9"/><stop offset=".7" stop-color="#0567a8"/><stop offset="1" stop-color="#02254f"/></linearGradient>'
      +'<radialGradient id="u" cx=".75" cy=".06" r=".35"><stop offset="0" stop-color="#fcd116" stop-opacity=".85"/><stop offset="1" stop-color="#fcd116" stop-opacity="0"/></radialGradient><filter id="b"><feGaussianBlur stdDeviation="6"/></filter></defs>'
      +'<rect width="412" height="892" fill="url(#s)"/><rect width="412" height="892" fill="url(#u)"/><g transform="translate(-150 -60) scale(1.62)"><g fill="#bff6ee" filter="url(#b)" opacity=".9">'+isl+'</g><g fill="#f3e2b0">'+isl+'</g><g fill="#1f8a3e" transform="translate(205 300) scale(.975) translate(-205 -298)">'+isl+'</g></g></svg>')+' top center/100% auto no-repeat,#02254f'],
    flag:['Flag',svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 892" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="f" x1="0" x2="1" y1="0" y2=".15"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".18" stop-color="#000" stop-opacity=".25"/><stop offset=".3" stop-color="#fff" stop-opacity=".12"/><stop offset=".5" stop-color="#000" stop-opacity=".22"/><stop offset=".68" stop-color="#fff" stop-opacity=".1"/><stop offset=".85" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>'
      +'<rect width="103" height="892" fill="#0047ab"/><rect x="103" width="206" height="892" fill="#fcd116"/><rect x="309" width="103" height="892" fill="#009e60"/>'+gems(206,300,70,110,'#009e60','none',0)+'<rect width="412" height="892" fill="url(#f)"/></svg>')+' center/cover no-repeat,#0b0b0b'],
  };
  // the pans in each Vincy background: [skirt stops, the rim's and bowl's colour, a struck note, the play bar's glow (r g b)]; your own picture gets gold
  const VMPAN={
    gems:[['#013a22','#007a4a','#5fe3a6','#00a565','#006b40','#2ed88a','#012b19'],'#009e60','#00c46f','0 200 110'],
    gren:[['#00163d','#0047ab','#6fb6ff','#0a5fd0','#003a8c','#3d93f0','#001233'],'#0047ab','#2fd6e0','40 210 225'],
    flag:[['#5a4200','#c79a00','#fff2a0','#f2c400','#a37d00','#ffe066','#3d2c00'],'#fcd116','#fcd116','252 209 22'],
  };
  const bgs=()=>LK()==='vm'?VM:BGS,first=()=>LK()==='vm'?'gems':'silk';
  function vmPaint(k){const P=VMPAN[k]||VMPAN.flag,set=(id,cols)=>{const g=document.getElementById(id);if(g)g.querySelectorAll('stop').forEach((s,i)=>{if(cols[i])s.setAttribute('stop-color',cols[i])})};
    set('vmSkirt',P[0]);set('vmRim',[0,0,0,0,0,P[1]]);set('vmBed',[0,0,0,0,0,P[1]]);set('vmHit',[0,0,P[2],P[2]]);document.documentElement.style.setProperty('--vmg',P[3])}
  /* your own pictures */
  let pics=null;const urls={};
  async function loadPics(){if(pics)return pics;pics={};try{const x=await idbGet('bgPics');if(x&&typeof x==='object')for(const [id,v] of Object.entries(x))if(v&&v.b instanceof Blob)pics[id]=v}catch{}return pics}
  const urlOf=id=>pics&&pics[id]?(urls[id]||(urls[id]=URL.createObjectURL(pics[id].b))):null;
  async function addPic(file){
    await loadPics();if(Object.keys(pics).length>=MAXPICS){say('You have '+MAXPICS+' pictures. Delete one to add another.');return}
    try{const bm=await createImageBitmap(file),sc=Math.min(1,2000/Math.max(bm.width,bm.height)),w=Math.round(bm.width*sc),h=Math.round(bm.height*sc);
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(bm,0,0,w,h);
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.86));if(!b)throw Error('blob');
      const id='p'+Date.now().toString(36);pics[id]={b,at:Date.now()};await idbPut('bgPics',{...pics});pick('pic:'+id);say('Picture added. It\'s your background now.')}
    catch{say('That picture couldn\'t be opened. Try a JPEG or PNG.')}
  }
  async function dropPic(id){await loadPics();if(!pics[id])return;if(urls[id]){URL.revokeObjectURL(urls[id]);delete urls[id]}delete pics[id];await idbPut('bgPics',{...pics});if(cfg().bg==='pic:'+id)pick(first());else render()}
  /* showing it */
  function layer(){let d=$('ttBg');if(!d){d=document.createElement('div');d.id='ttBg';d.setAttribute('aria-hidden','true');document.body.prepend(d)}return d}
  async function apply(){
    const on=document.documentElement.classList.contains('th-tt'),d=layer();d.hidden=!on;if(!on)return;
    const c=cfg(),B=bgs(),f=first();let bg=c.bg;
    if(bg.startsWith('pic:')){await loadPics();const u=urlOf(bg.slice(4));if(u){d.style.background='url("'+u+'") center/cover no-repeat,#070506';d.dataset.bg='pic'}else bg=f}
    if(!bg.startsWith('pic:')){d.style.background=(B[bg]||B[f])[1];d.dataset.bg=B[bg]?bg:f}
    if(LK()==='vm')vmPaint(d.dataset.bg);
    d.style.setProperty('--ttdim',String(Math.max(0,Math.min(.8,c.dim/100))));
  }
  function pick(bg){st[LK()]=Object.assign(cfg(),{bg});keep();apply();render();try{THEME.setRow()}catch{}}
  function dim(v){st[LK()]=Object.assign(cfg(),{dim:+v});keep();apply()}
  /* the chooser, under the looks in App look */
  async function render(){
    const box=$('ttBgBox');if(!box)return;const on=THEME.look()==='tt'||THEME.look()==='vm';box.hidden=!on;if(!on)return;await loadPics();const c=cfg();
    box.innerHTML='<h3>Background</h3><div class="tt-grid" role="group" aria-label="Background">'
      +Object.entries(bgs()).map(([k,[n,css]])=>'<button class="tt-tile" data-bg="'+k+'" aria-pressed="'+(c.bg===k)+'"><span class="tt-sw" style=\''+('background:'+css).replace(/'/g,'&#39;')+'\'></span><b>'+n+'</b></button>').join('')
      +Object.keys(pics).sort((a,b)=>pics[a].at-pics[b].at).map((id,i)=>'<div class="tt-own"><button class="tt-tile" data-bg="pic:'+id+'" aria-pressed="'+(c.bg==='pic:'+id)+'"><span class="tt-sw" style="background:url(\''+urlOf(id)+'\') center/cover"></span><b>Picture '+(i+1)+'</b></button><button class="tt-del" data-del="'+id+'" aria-label="Delete picture '+(i+1)+'">✕</button></div>').join('')
      +'<label class="tt-tile tt-add"><span class="tt-sw">＋</span><b>Add a picture</b><input type="file" id="ttPic" accept="image/*"></label></div>'
      +'<label class="tt-dim"><span>Dim the background</span><input type="range" id="ttDim" min="0" max="70" step="5" value="'+c.dim+'"><output>'+c.dim+'%</output></label>'
      +'<p class="help">Make your own with an image generator, then tap <b>Add a picture</b>. A darker middle keeps the notes easy to see.</p>';
  }
  function mount(){
    const list=$('thList');if(!list||$('ttBgBox'))return;const box=document.createElement('div');box.id='ttBgBox';box.className='tt-bgs';list.after(box);
    box.addEventListener('click',e=>{const d=e.target.closest('[data-del]');if(d){e.preventDefault();if(confirm('Delete this picture?'))dropPic(d.dataset.del);return}
      const t=e.target.closest('[data-bg]');if(t)pick(t.dataset.bg)});
    box.addEventListener('change',e=>{if(e.target.id==='ttPic'&&e.target.files&&e.target.files[0]){const f=e.target.files[0];e.target.value='';addPic(f)}});
    box.addEventListener('input',e=>{if(e.target.id==='ttDim'){dim(e.target.value);const o=e.target.nextElementSibling;if(o)o.textContent=e.target.value+'%'}});
  }
  {const _rs=THEME.renderSheet.bind(THEME);THEME.renderSheet=function(){_rs();mount();render()}}
  /* the pans: a soft reflection across each bowl (shown only in this look) */
  const NS='http://www.w3.org/2000/svg';
  function glare(svg){if(!svg||svg.querySelector('.ttgl'))return;svg.querySelectorAll('ellipse.bed').forEach(b=>{const cx=+b.getAttribute('cx'),cy=+b.getAttribute('cy'),rx=+b.getAttribute('rx')*.9,ry=+(b.getAttribute('ry')||rx)*.9;
    const p=document.createElementNS(NS,'path');p.setAttribute('class','ttgl');p.setAttribute('aria-hidden','true');
    p.setAttribute('d','M'+(cx-rx)+' '+(cy-ry*.1)+' Q'+cx+' '+(cy-ry*.95)+' '+(cx+rx)+' '+(cy-ry*.35)+' L'+(cx+rx)+' '+(cy-ry*.12)+' Q'+cx+' '+(cy-ry*.62)+' '+(cx-rx)+' '+(cy+ry*.15)+' Z');b.after(p)})}
  if(typeof LOOK!=='undefined'){const _p=LOOK.paint.bind(LOOK);LOOK.paint=function(svg,force){_p(svg,force);try{glare(svg)}catch{}}}
  // the gradients the pans use in this look
  {const d=document.createElement('div');d.setAttribute('aria-hidden','true');d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML='<svg width="0" height="0"><defs>'
      +'<linearGradient id="ttRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".18" stop-color="#8e939c"/><stop offset=".34" stop-color="#f6f7f9"/><stop offset=".5" stop-color="#3f434b"/><stop offset=".66" stop-color="#eceef1"/><stop offset=".84" stop-color="#a3242f"/><stop offset="1" stop-color="#ffffff"/></linearGradient>'
      +'<radialGradient id="ttBed" cx=".44" cy=".38" r=".72"><stop offset="0" stop-color="#ffffff"/><stop offset=".2" stop-color="#e3e5e9"/><stop offset=".42" stop-color="#7e838c"/><stop offset=".58" stop-color="#2b2d33"/><stop offset=".74" stop-color="#c8cbd1"/><stop offset=".9" stop-color="#8f1d27"/><stop offset="1" stop-color="#f1f2f4"/></radialGradient>'
      +'<linearGradient id="ttZone" x1=".1" y1="0" x2=".45" y2="1"><stop offset="0" stop-color="#2c2e34"/><stop offset=".28" stop-color="#8d929b"/><stop offset=".52" stop-color="#f7f8fa"/><stop offset=".7" stop-color="#ffffff"/><stop offset=".88" stop-color="#e2a3aa"/><stop offset="1" stop-color="#c9ccd2"/></linearGradient>'
      +'<radialGradient id="ttHit" cx=".4" cy=".32" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#fbeff0"/><stop offset=".8" stop-color="#ff9aa4"/><stop offset="1" stop-color="#e3172c"/></radialGradient>'
      +'<linearGradient id="ttSkirt" x1="0" x2="1"><stop offset="0" stop-color="#4a040c"/><stop offset=".16" stop-color="#b30d20"/><stop offset=".3" stop-color="#ff6b78"/><stop offset=".38" stop-color="#e01b31"/><stop offset=".7" stop-color="#a50c1d"/><stop offset=".86" stop-color="#ef3a4b"/><stop offset="1" stop-color="#3a0309"/></linearGradient>'
      // Vincy Mas: the same chrome, with colours set by vmPaint() for the background you pick
      +'<linearGradient id="vmRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".18" stop-color="#8e939c"/><stop offset=".34" stop-color="#f6f7f9"/><stop offset=".5" stop-color="#3f434b"/><stop offset=".66" stop-color="#eceef1"/><stop offset=".84" stop-color="#009e60"/><stop offset="1" stop-color="#ffffff"/></linearGradient>'
      +'<radialGradient id="vmBed" cx=".44" cy=".38" r=".72"><stop offset="0" stop-color="#ffffff"/><stop offset=".2" stop-color="#e3e5e9"/><stop offset=".42" stop-color="#7e838c"/><stop offset=".58" stop-color="#2b2d33"/><stop offset=".74" stop-color="#c8cbd1"/><stop offset=".9" stop-color="#009e60"/><stop offset="1" stop-color="#f1f2f4"/></radialGradient>'
      +'<linearGradient id="vmZone" x1=".1" y1="0" x2=".45" y2="1"><stop offset="0" stop-color="#2c2e34"/><stop offset=".28" stop-color="#8d929b"/><stop offset=".52" stop-color="#f7f8fa"/><stop offset=".7" stop-color="#ffffff"/><stop offset=".88" stop-color="#f3e7b0"/><stop offset="1" stop-color="#c9ccd2"/></linearGradient>'
      +'<radialGradient id="vmHit" cx=".4" cy=".32" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#f4fff8"/><stop offset=".8" stop-color="#00c46f"/><stop offset="1" stop-color="#00c46f"/></radialGradient>'
      +'<linearGradient id="vmSkirt" x1="0" x2="1"><stop offset="0" stop-color="#013a22"/><stop offset=".16" stop-color="#007a4a"/><stop offset=".3" stop-color="#5fe3a6"/><stop offset=".38" stop-color="#00a565"/><stop offset=".7" stop-color="#006b40"/><stop offset=".86" stop-color="#2ed88a"/><stop offset="1" stop-color="#012b19"/></linearGradient>'
      +'<linearGradient id="ttPole" x1="0" x2="1"><stop offset="0" stop-color="#5b5f67"/><stop offset=".35" stop-color="#ffffff"/><stop offset=".6" stop-color="#9da1a9"/><stop offset="1" stop-color="#3b3e45"/></linearGradient>'
      +'</defs></svg>';document.body.appendChild(d)}
  setTimeout(()=>{apply();if(typeof LOOK!=='undefined')document.querySelectorAll('.pan svg').forEach(glare)},0);
  const bgName=()=>{const b=cfg().bg;if(b.startsWith('pic:')){const i=pics?Object.keys(pics).sort((a,c)=>pics[a].at-pics[c].at).indexOf(b.slice(4)):-1;return i>=0?'Picture '+(i+1):'Your picture'}const B=bgs();return (B[b]||B[first()])[0]};
  return {apply,pick,dim,addPic,BGS,VM,bgName,get cfg(){return cfg()},render};
})();
