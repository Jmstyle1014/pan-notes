
/* ---------- App look: Trinidad & Tobago, with a background you choose ----------
   Chrome Night underneath (its colours and canvases), with mirror-chrome pans on red enamel skirts, a glass play bar
   with a red glow, and a background behind everything: one of the built-in ones (drawn here, no picture files) or a
   picture of your own (made smaller and kept in IndexedDB 'bgPics', so the Google Drive backup has it too).
   The choice is kept per look in localStorage 'panyard-bg', so other looks can have backgrounds later. */
var TT=(()=>{
  const K='panyard-bg',MAXPICS=8;
  let st={};try{st=JSON.parse(localStorage.getItem(K)||'{}')||{}}catch{st={}}
  const keep=()=>{try{localStorage.setItem(K,JSON.stringify(st))}catch{}};
  const cfg=()=>Object.assign({bg:'flag',dim:20},st.tt||{});
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
  const BGS={
    flag:['Flag','repeating-linear-gradient(100deg,rgb(0 0 0/0) 0 6%,rgb(0 0 0/.22) 9%,rgb(255 255 255/.07) 12%,rgb(0 0 0/0) 15%),repeating-linear-gradient(75deg,rgb(0 0 0/0) 0 11%,rgb(0 0 0/.18) 15%,rgb(255 255 255/.06) 18%,rgb(0 0 0/0) 22%),linear-gradient(to top right,'+SASH+')'],
    islands:['Islands','radial-gradient(60% 30% at 40% 25%,rgb(206 17 38/.22),rgb(0 0 0/0) 70%),'+islands+' top center/100% auto no-repeat,radial-gradient(120% 80% at 50% 40%,#1a1214,#070506)'],
    ribbon:['Ribbon','radial-gradient(70% 35% at 50% 45%,rgb(206 17 38/.28),rgb(0 0 0/0) 70%),'+ribbon+' center/cover no-repeat,#0a0a0c'],
    sash:['Sash of light','radial-gradient(40% 25% at 15% 20%,rgb(206 17 38/.45),transparent),radial-gradient(40% 25% at 90% 85%,rgb(206 17 38/.45),transparent),linear-gradient(to top right,rgb(0 0 0/0) 0 40%,rgb(206 17 38/.6) 40% 43%,rgb(255 255 255/.32) 43% 45%,rgb(0 0 0/.9) 45% 55%,rgb(255 255 255/.32) 55% 57%,rgb(206 17 38/.6) 57% 60%,rgb(0 0 0/0) 60%),#050506'],
    night:['Red night','radial-gradient(80% 45% at 50% 45%,rgb(150 12 28/.55),rgb(0 0 0/0) 70%),radial-gradient(120% 80% at 50% 0%,#24080c,#070506)'],
  };
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
  async function dropPic(id){await loadPics();if(!pics[id])return;if(urls[id]){URL.revokeObjectURL(urls[id]);delete urls[id]}delete pics[id];await idbPut('bgPics',{...pics});if(cfg().bg==='pic:'+id)pick('flag');else render()}
  /* showing it */
  function layer(){let d=$('ttBg');if(!d){d=document.createElement('div');d.id='ttBg';d.setAttribute('aria-hidden','true');document.body.prepend(d)}return d}
  async function apply(){
    const on=document.documentElement.classList.contains('th-tt'),d=layer();d.hidden=!on;if(!on)return;
    const c=cfg();let bg=c.bg;
    if(bg.startsWith('pic:')){await loadPics();const u=urlOf(bg.slice(4));if(u){d.style.background='url("'+u+'") center/cover no-repeat,#070506';d.dataset.bg='pic'}else bg='flag'}
    if(!bg.startsWith('pic:')){d.style.background=(BGS[bg]||BGS.flag)[1];d.dataset.bg=BGS[bg]?bg:'flag'}
    d.style.setProperty('--ttdim',String(Math.max(0,Math.min(.8,c.dim/100))));
  }
  function pick(bg){st.tt=Object.assign(cfg(),{bg});keep();apply();render()}
  function dim(v){st.tt=Object.assign(cfg(),{dim:+v});keep();apply()}
  /* the chooser, under the looks in App look */
  async function render(){
    const box=$('ttBgBox');if(!box)return;const on=THEME.look()==='tt';box.hidden=!on;if(!on)return;await loadPics();const c=cfg();
    box.innerHTML='<h3>Background</h3><div class="tt-grid" role="group" aria-label="Background">'
      +Object.entries(BGS).map(([k,[n,css]])=>'<button class="tt-tile" data-bg="'+k+'" aria-pressed="'+(c.bg===k)+'"><span class="tt-sw" style=\''+('background:'+css).replace(/'/g,'&#39;')+'\'></span><b>'+n+'</b></button>').join('')
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
      +'<linearGradient id="ttPole" x1="0" x2="1"><stop offset="0" stop-color="#5b5f67"/><stop offset=".35" stop-color="#ffffff"/><stop offset=".6" stop-color="#9da1a9"/><stop offset="1" stop-color="#3b3e45"/></linearGradient>'
      +'</defs></svg>';document.body.appendChild(d)}
  setTimeout(()=>{apply();if(typeof LOOK!=='undefined')document.querySelectorAll('.pan svg').forEach(glare)},0);
  return {apply,pick,dim,addPic,BGS,get cfg(){return cfg()},render};
})();
