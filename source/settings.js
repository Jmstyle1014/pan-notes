/* ---------- Setup as one short list: each row shows its setting, the bigger ones open their own page ---------- */
// The panels underneath are the same as before; this only decides which ones show. On a phone you see the list,
// tap a row and that page opens with a ‹ Setup button. On a wide screen (iPad) the list sits on the left and the
// chosen page on the right.
const SETUP={
  page:null,ready:false,
  KEYS:{'Recording':'rec','Your pan':'pan','Pan photos':'photos','Pan order':'photos','Share with your band':'share','Play along':'play','Your pan sounds':'sound','Saving':'save'},
  TITLES:{rec:'Recording',pan:'Your pan',photos:'Pan photos & order',share:'Share with your band',play:'Play along',sound:'Pan sounds',save:'Backup & saving'},
  wide:()=>matchMedia('(min-width: 900px)').matches,
  panels(){return [...$('view-setup').children].filter(e=>e.classList.contains('panel')&&e.dataset.sk)},
  vis(k){return this.panels().some(p=>p.dataset.sk===k&&!p.dataset.off)},
  init(){
    const v=$('view-setup');if(!v)return;
    [...v.children].filter(e=>e.classList.contains('panel')).forEach((p,i)=>{const h=p.querySelector('h2');const t=h?h.textContent.trim():'';p.dataset.sk=this.KEYS[t]||('x'+i);if(!this.TITLES[p.dataset.sk])this.TITLES[p.dataset.sk]=t||'More'});
    const head=document.createElement('div');head.id='setHead';head.innerHTML='<button class="setback" id="setBack">‹ Setup</button><h2 id="setTitle"></h2>';
    const list=document.createElement('div');list.id='setList';
    v.prepend(head);v.prepend(list);v.classList.add('sx');
    $('setBack').onclick=()=>this.show(null);
    list.addEventListener('click',e=>{const r=e.target.closest('[data-row]');if(!r)return;const k=r.dataset.row;
      if(k==='fs'){const b=$('fsBtn2')||$('fsBtn');if(b)b.click();setTimeout(()=>this.render(),300);return}
      if(k==='wake'){$('wakeBtn').click();this.render();return}
      if(k==='lab'){$('labOpen').click();return}
      this.show(k)});
    // anything that scrolls to a Setup panel (the checklist, Home, Share) opens that panel's page first
    const siv=Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView=function(...a){const p=this.closest&&this.closest('#view-setup .panel');if(p&&p.dataset.sk&&SETUP.ready&&document.body.dataset.view==='setup')SETUP.show(p.dataset.sk,true);return siv.apply(this,a)};
    document.addEventListener('fullscreenchange',()=>this.render());
    // keep the list's values fresh while you change things on a page (both show at once on an iPad)
    v.addEventListener('click',e=>{if(!e.target.closest('#setList'))setTimeout(()=>this.render(),50)});v.addEventListener('change',()=>setTimeout(()=>this.render(),50));
    matchMedia('(min-width: 900px)').addEventListener('change',()=>this.show(this.page));
    const _show=showView;showView=function(v){const was=document.body.dataset.view;_show(v);if(v==='setup'&&was!=='setup')SETUP.show(null)};
    this.ready=true;this.show(null);
  },
  show(k,keepScroll){
    if(!k&&this.wide())k=this.page&&this.vis(this.page)?this.page:'rec';
    this.page=k;const v=$('view-setup');v.classList.toggle('sx-page',!!k);v.classList.toggle('sx-wide',this.wide());
    for(const p of this.panels())p.classList.toggle('sx-on',p.dataset.sk===k);
    $('setTitle').textContent=k?this.TITLES[k]:'';
    this.render();if(!keepScroll)window.scrollTo({top:0});
  },
  val(k){
    const lb=(()=>{try{return +localStorage.getItem('pan-lastBackup')||0}catch{return 0}})(),ago=t=>{const d=Math.floor((Date.now()-t)/86400000);return d<1?'Today':d===1?'Yesterday':d+' days ago'};
    switch(k){
      case 'rec':return hasAudio?esc(curName||'Recording'):'None yet';
      case 'pan':return esc(curSet().name);
      case 'photos':return S.look==='photo'?'Photos':'Diagram';
      case 'play':return ({off:'No hints',subtle:'Subtle hints',bold:'Bold hints'})[S.hint]||'';
      case 'sound':return S.panVoice==='mine'?'My recordings':'Built-in';
      case 'save':return lb?ago(lb):'No backup yet';
      case 'share':return 'Chart, picture, video';
    }return'';
  },
  render(){
    if(!this.ready)return;
    const ICON={rec:['♫','#f2b38a'],pan:['◉','#8fc7ff'],photos:['⇄','#c9a2ff'],share:['⤴','#9be38f'],play:['✦','#ffd166'],sound:['🔊','#f2b38a'],save:['⤓','#9be38f'],fs:['⛶','#8fc7ff'],wake:['☀','#f2b38a'],lab:['🎮','#c9a2ff']};
    const row=(k,label,value,sub,end)=>{const [ic,col]=ICON[k]||['•','#9d93c9'];const on=this.page===k;
      return '<button class="sxrow'+(on?' on':'')+'" data-row="'+k+'"'+(end==='tog'?' role="switch" aria-checked="'+value+'"':'')+'><span class="sxic" style="background:'+col+'" aria-hidden="true">'+ic+'</span><span class="sxlab"><b>'+label+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</span>'
        +(end==='tog'?'<span class="sxtog'+(value?' on':'')+'" aria-hidden="true"><i></i></span>':'<span class="sxval">'+value+'</span><span class="sxchev" aria-hidden="true">›</span>')+'</button>'};
    const group=(t,rows)=>rows.filter(Boolean).length?'<div class="sxgroup"><div class="sxgt">'+t+'</div><div class="sxbox">'+rows.join('')+'</div></div>':'';
    const fsOn=!!document.fullscreenElement,extra=this.panels().filter(p=>/^x/.test(p.dataset.sk));
    $('setList').innerHTML=group('This song'+(S.title?' · '+esc(S.title):''),[row('rec','Recording',this.val('rec')),row('pan','Your pan',this.val('pan')),this.vis('photos')&&isGuitar()?row('photos','Pan photos & order',this.val('photos')):''])
      +group('Playing',[row('play','Play along',this.val('play'),'Hints and tap sounds'),($('fsBtn2')||$('fsBtn'))?row('fs','Full screen',fsOn,null,'tog'):'',$('wakeBtn')?row('wake','Keep screen awake',!!S.wake,null,'tog'):'',$('labOpen')?row('lab','Mallet Lab','Try it','Play with a game controller'):''])
      +group('Sound & saving',[this.vis('sound')?row('sound','Pan sounds',this.val('sound'),'Record your pans, room, brightness'):'',this.vis('share')?row('share','Share with your band',this.val('share')):'',row('save','Backup',this.val('save'),'Save or open a backup file')])
      +(extra.length?group('More',extra.map(p=>row(p.dataset.sk,this.TITLES[p.dataset.sk],''))):'');
  }
};
{const st=document.createElement('style');st.textContent=`
#view-setup.sx>.panel{display:none}
#view-setup.sx>.panel.sx-on{display:block}
#view-setup.sx>.panel.sx-on[hidden]{display:none}
/* the page title already names it */
#view-setup.sx>.panel:not([data-sk=photos])>h2:first-child,#view-setup.sx>.panel:not([data-sk=photos])>.row:first-child>h2{display:none}
#view-setup.sx #setHead{display:none;align-items:center;gap:8px;margin:0 0 10px}
#view-setup.sx.sx-page #setHead{display:flex}
#view-setup.sx.sx-page:not(.sx-wide) #setList{display:none}
#setHead h2{margin:0;flex:1;font-size:18px}
.setback{background:none;border:0;color:var(--gold);font:700 16px var(--body,system-ui);padding:10px 8px 10px 0;cursor:pointer;min-height:44px}
#setList{display:flex;flex-direction:column;gap:14px;margin-bottom:12px}
.sxgt{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:0 4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sxbox{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.sxrow{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:6px 14px;background:none;border:0;border-top:1px solid var(--line);color:var(--text);text-align:left;cursor:pointer;font:inherit}
.sxbox .sxrow:first-child{border-top:0}
.sxrow.on{background:var(--raised)}
.sxrow.on .sxlab b{color:var(--gold)}
.sxic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;font-size:16px;flex:none;color:#1a1030}
.sxlab{flex:1;min-width:0;display:flex;flex-direction:column}
.sxlab b{font-size:15px}
.sxlab small{font-size:12px;color:var(--muted)}
.sxval{font-size:14px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}
.sxchev{color:var(--muted);font-size:20px;line-height:1}
.sxtog{width:46px;height:28px;border-radius:99px;background:var(--line);position:relative;flex:none;transition:background .2s}
.sxtog i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--muted);transition:left .2s}
.sxtog.on{background:var(--gold)}.sxtog.on i{left:21px;background:var(--gold-ink,#2a1a00)}
/* the buttons that now live in the list are hidden inside Play along */
#view-setup.sx #labOpen,#view-setup.sx #fsBtn2,#view-setup.sx #wakeBtn{display:none}
/* iPad and other wide screens: list on the left, the page on the right */
#view-setup.sx.sx-wide{display:grid;grid-template-columns:minmax(280px,340px) 1fr;gap:0 24px;align-items:start}
#view-setup.sx.sx-wide #setList{grid-column:1;grid-row:1 / span 20;position:sticky;top:12px}
#view-setup.sx.sx-wide>*:not(#setList){grid-column:2}
#view-setup.sx.sx-wide .setback{display:none}
#view-setup.sx.sx-wide #setHead h2{font-size:20px}
`;document.head.appendChild(st)}
SETUP.init();
{const _rsp=renderSetPick;renderSetPick=function(){_rsp();try{SETUP.render()}catch{}}}
