/* ---------- App look: Night, Day, Chrome Day, Chrome Night ---------- */
// Night and Day are the looks the app always had. Chrome Day (a pan in daylight: lavender-silver, champagne, blue glints)
// and Chrome Night (polished steel under amber lights, on black) recolour everything; their colours are made at build
// time by make_themes.py. The ☀/🌙 button on Home switches between the day and night of whichever family you're in.
var THEME={
  K:'panyard-theme',
  LOOKS:[['night','Night','Panyard’s usual purple night'],['day','Day','Light colours for daytime'],['cday','Chrome Day','Lavender silver and champagne, like a pan in the sun'],['cnight','Chrome Night','Polished steel under warm lights']],
  get(){try{return localStorage.getItem(this.K)||''}catch{return ''}},
  look(){const t=this.get();if(t==='cday'||t==='cnight')return t;try{return localStorage.getItem('panyard-day')==='1'?'day':'night'}catch{return 'night'}},
  setLook(k){try{localStorage.setItem(this.K,k==='cday'||k==='cnight'?k:'');localStorage.setItem('panyard-day',k==='day'?'1':'0')}catch{}
    this.apply();try{DAY.apply()}catch{}try{HOME.render()}catch{}try{SETUP.render()}catch{}this.redraw();if($('thSheet')&&!$('thSheet').hidden)this.renderSheet()},
  set(v){this.setLook(v)},
  apply(){const v=this.get();this.cur=v==='cday'||v==='cnight'?v:'';const h=document.documentElement;h.classList.toggle('th-cday',v==='cday');h.classList.toggle('th-cnight',v==='cnight');this.memo={};try{colors=null}catch{}
    const mc=document.querySelector('meta[name=theme-color]');if(mc){if(!mc.dataset.orig)mc.dataset.orig=mc.content;mc.content=v==='cday'?'#e6e3ec':v==='cnight'?'#0b0b0d':mc.dataset.orig}},
  redraw(){for(const f of[()=>drawTL(),()=>GB.drawRuler(),()=>WB.drawRuler(),()=>drawLanes(audio.currentTime||0)])try{f()}catch{}},
  defs(){if(document.getElementById('thDefs'))return;const d=document.createElement('div');d.id='thDefs';d.setAttribute('aria-hidden','true');d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML='<svg width="0" height="0"><defs>'
      // Chrome Day: bright silver with a champagne warmth and a blue glint, like a pan in daylight
      +'<linearGradient id="thDayRim" x1="0" x2="1" y1="0" y2=".4"><stop offset="0" stop-color="#9c98a6"/><stop offset=".22" stop-color="#ffffff"/><stop offset=".45" stop-color="#cfc6b4"/><stop offset=".62" stop-color="#bcd3ea"/><stop offset=".8" stop-color="#fbfaf7"/><stop offset="1" stop-color="#8f8b99"/></linearGradient>'
      +'<radialGradient id="thDayBed" cx=".4" cy=".34" r=".85"><stop offset="0" stop-color="#f4f1ea"/><stop offset=".45" stop-color="#d9d3c6"/><stop offset=".75" stop-color="#b9bfcc"/><stop offset="1" stop-color="#9da2b0"/></radialGradient>'
      +'<radialGradient id="thDayZone" cx=".36" cy=".28" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#ece6d8"/><stop offset=".7" stop-color="#cfd6e2"/><stop offset="1" stop-color="#b4b9c6"/></radialGradient>'
      // a struck note in daylight: polished bright, a cool blue sheen at the edge
      +'<radialGradient id="thDayHit" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#f1f4f9"/><stop offset=".72" stop-color="#c9d9ee"/><stop offset="1" stop-color="#8fb0da"/></radialGradient>'
      // Chrome Night: polished chrome catching warm amber light on black
      +'<linearGradient id="thNightRim" x1="0" x2="1" y1="0" y2=".3"><stop offset="0" stop-color="#3b3c42"/><stop offset=".2" stop-color="#f4f5f7"/><stop offset=".38" stop-color="#8d9098"/><stop offset=".55" stop-color="#f2c06a"/><stop offset=".72" stop-color="#ffffff"/><stop offset="1" stop-color="#2f3036"/></linearGradient>'
      +'<radialGradient id="thNightBed" cx=".42" cy=".3" r=".85"><stop offset="0" stop-color="#6b6e76"/><stop offset=".5" stop-color="#34363c"/><stop offset="1" stop-color="#16171a"/></radialGradient>'
      +'<radialGradient id="thNightZone" cx=".34" cy=".26" r=".9"><stop offset="0" stop-color="#e9ebef"/><stop offset=".3" stop-color="#9ea2ab"/><stop offset=".62" stop-color="#5a5d65"/><stop offset=".86" stop-color="#8a6a3a"/><stop offset="1" stop-color="#3b3d43"/></radialGradient>'
      // a struck note at night: the steel lights up white-hot with a warm edge
      +'<radialGradient id="thNightHit" cx=".36" cy=".28" r=".92"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#f1efea"/><stop offset=".7" stop-color="#c9c6bf"/><stop offset="1" stop-color="#b48b4c"/></radialGradient>'
      +'</defs></svg>';document.body.appendChild(d)},
  // canvas colours (the falling lanes, rulers, timelines) go through the same recolouring as the styles
  memo:{},
  c(col){const v=this.cur;if(!v)return col;const k=v+col;if(k in this.memo)return this.memo[k];return this.memo[k]=this.map(col,v)},
  map(col,v){let r,g,b,a=1;const m=/^#([0-9a-f]{3,8})$/i.exec(col);
    if(m){let h=m[1];if(h.length<6)h=h.split('').map(x=>x+x).join('');r=parseInt(h.slice(0,2),16)/255;g=parseInt(h.slice(2,4),16)/255;b=parseInt(h.slice(4,6),16)/255;if(h.length===8)a=parseInt(h.slice(6,8),16)/255}
    else{const n=(col.match(/[\d.]+%?/g)||[]);if(n.length<3)return col;[r,g,b]=n.slice(0,3).map(x=>parseFloat(x)/255);if(n[3])a=n[3].endsWith('%')?parseFloat(n[3])/100:parseFloat(n[3])}
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;
    if(d){s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6}
    const hls=(H,L,S)=>{L=Math.max(0,Math.min(1,L));S=Math.max(0,Math.min(1,S));if(!S)return[L,L,L];const q=L<.5?L*(1+S):L+S-L*S,p=2*L-q,f=t=>{t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p};return[f(H+1/3),f(H),f(H-1/3)]};
    const out=(c,A)=>{const q=x=>Math.round(Math.max(0,Math.min(1,x))*255);return A>=.999?'rgb('+q(c[0])+','+q(c[1])+','+q(c[2])+')':'rgba('+q(c[0])+','+q(c[1])+','+q(c[2])+','+A.toFixed(3)+')'};
    const neutral=s<.22||(h>.6&&h<.86&&(s<.75||l<.3||l>.8)),gold=h>.09&&h<.16&&s>.6;
    if(v==='cday'){
      if(neutral){if(a<.999&&l>.9)return out(hls(.7,.18,.1),a*.9);if(a<.999&&l<.08)return out([.12,.1,.16],a*.45);let L=1-l*.78;if(l>.82)L=.12+(1-l)*.6;return out(hls(.7,L,L>.5?.16:.14),a)}
      if(gold)return out(hls(.115,l>.5?.6:l*.9,.66),a);return out(hls(h,l>.55?l*.82:l,s*.9),a)}
    if(neutral){if(l>.8)return out(hls(.1,Math.min(.97,l+.02),.08),a);return out(hls(.62,l*.92,Math.min(s,.1)*.5),a)}
    if(gold)return out(hls(.105,l*.98,.9),a);return col},

  /* ---- choosing a look ---- */
  sheet(on){let ov=$('thSheet');
    if(!ov){ov=document.createElement('div');ov.id='thSheet';ov.className='sheetov';ov.hidden=true;ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','thT');
      ov.innerHTML='<div class="sheetbox"><div class="sheethead"><h2 id="thT">App look</h2><button class="btn" id="thClose">Done</button></div><div id="thList" class="th-list"></div><p class="help">The ☀ / 🌙 button on Home switches between day and night in the same family. Each pan’s own look (Setup → Pan look) stays as you set it.</p></div>';
      document.body.appendChild(ov);$('thClose').onclick=()=>this.sheet(false);
      ov.addEventListener('click',e=>{if(e.target===ov){this.sheet(false);return}const b=e.target.closest('[data-th]');if(b)this.setLook(b.dataset.th)});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ov.hidden)this.sheet(false)})}
    if(on)this.renderSheet();ov.hidden=!on},
  renderSheet(){const cur=this.look();
    $('thList').innerHTML=this.LOOKS.map(([k,n,d])=>'<button class="th-card" data-th="'+k+'" aria-pressed="'+(k===cur)+'"><span class="th-sw th-sw-'+k+'" aria-hidden="true"><i></i><i></i></span><span class="th-tx"><b>'+n+'</b><small>'+d+'</small></span>'+(k===cur?'<span class="th-ck" aria-hidden="true">✓</span>':'')+'</button>').join('')},
  setRow(){const l=$('setList');if(!l)return;const old=l.querySelector('[data-row=day]');let r=l.querySelector('[data-row=look]');
    const name=(this.LOOKS.find(x=>x[0]===this.look())||this.LOOKS[0])[1];
    if(!r){if(!old)return;r=document.createElement('button');r.className='sxrow';r.dataset.row='look';old.replaceWith(r)}else if(old)old.remove();
    r.innerHTML='<span class="sxic" style="background:#c9d3e6" aria-hidden="true">◐</span><span class="sxlab"><b>App look</b><small>Night, Day, Chrome Day, Chrome Night</small></span><span class="sxval">'+name+'</span><span class="sxchev" aria-hidden="true">›</span>'},
  init(){this.defs();this.apply();
    if(typeof DAY!=='undefined'){
      // html.day (the old Day) only for Day; the sun/moon flips day and night within the family you're in
      DAY.on=()=>{const L=THEME.look();return L==='day'||L==='cday'};
      const _ap=DAY.apply.bind(DAY);DAY.apply=function(){_ap();document.documentElement.classList.toggle('day',THEME.look()==='day')};
      DAY.set=function(v){const L=THEME.look(),ch=L==='cday'||L==='cnight';THEME.setLook(ch?(v?'cday':'cnight'):(v?'day':'night'));try{say((THEME.LOOKS.find(x=>x[0]===THEME.look())||[])[1]+'.')}catch{}};
      DAY.apply()}
    if(typeof SETUP!=='undefined'){const _s=SETUP.render.bind(SETUP);SETUP.render=function(){_s();THEME.setRow()};this.setRow();
      const l=$('setList');if(l)l.addEventListener('click',e=>{if(e.target.closest('[data-row=look]')){e.stopPropagation();THEME.sheet(true)}},true)}
  }
};
{const st=document.createElement('style');st.textContent=`
.th-list{display:flex;flex-direction:column;gap:8px;margin:4px 0 10px}
.th-card{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:var(--surface);border:1.5px solid var(--line);border-radius:16px;color:inherit;padding:10px 14px;cursor:pointer;font:inherit;min-height:64px}
.th-card[aria-pressed=true]{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.th-tx{flex:1}.th-tx small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
.th-ck{color:var(--gold);font-weight:800;font-size:18px}
.th-sw{flex:none;display:flex;gap:3px;padding:6px;border-radius:12px;border:1px solid rgb(128 128 128/.3)}
.th-sw i{width:24px;height:24px;border-radius:50%;box-shadow:inset 0 0 0 2px rgb(255 255 255/.55)}
.th-sw-night{background:#110c20}.th-sw-night i{background:radial-gradient(circle at 35% 30%,#7d6bd0,#3a2f6a)}
.th-sw-day{background:#f1eef8}.th-sw-day i{background:radial-gradient(circle at 35% 30%,#d9cff8,#9d8fd6)}
.th-sw-cday{background:linear-gradient(160deg,#f3f1f6,#cfd3de)}.th-sw-cday i{background:radial-gradient(circle at 35% 28%,#fff,#ece6d8 40%,#cfd6e2 75%,#a9aec0)}
.th-sw-cnight{background:#0b0b0d}.th-sw-cnight i{background:radial-gradient(circle at 34% 26%,#f0f1f4,#9ea2ab 35%,#5a5d65 65%,#8a6a3a 88%,#3b3d43)}
`;document.head.appendChild(st)}
try{THEME.init()}catch(e){console.warn('themes',e)}
