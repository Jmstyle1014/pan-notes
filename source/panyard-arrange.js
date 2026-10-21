/* ---------- Arrange pans: move and size each drum, and choose how long the skirts hang ----------
   Opens from Settings (Pan layout). It shows the pans as Play draws them sideways, or as Studio and Write draw them
   upright, whichever way the phone is held, and each way up keeps its own arrangement. Drag a drum to move it, pinch
   it or drag its ⤡ corner to size it. The notes ride along with their drum, so taps land the same afterwards.
   Saved in localStorage panyard-layout (STAGE.lay). Reset puts this set back as it comes. */
var ARRANGE={
  key:null,sel:-1,
  SETS:['guitar','dsec','tenor','fcello','six'],
  box(){   // the room the pans get: the screen above Play's play bar sideways (68px tall), the screen above this sheet upright
    const land=STAGE.orient()==='land',sh=$('arSheet');
    return land?{W:innerWidth,H:Math.max(200,innerHeight-68)}:{W:innerWidth,H:Math.max(240,innerHeight-(sh?sh.offsetHeight:300)-8)};
  },
  L(){const {W,H}=this.box();return{W,H,L:STAGE.orient()==='land'?STAGE.layout(W,H,this.key):STAGE.portrait(W,H,this.key)}},
  // this set's entry for the way the phone is held
  cur(make){
    const all=JSON.parse(JSON.stringify(STAGE.lay())),k=this.key,o=STAGE.orient();
    if(make){all[k]=all[k]||{};all[k][o]=all[k][o]||{all:1,p:{}};all[k][o].p=all[k][o].p||{}}
    return{all,a:all[k]&&all[k][o]};
  },
  drum(i){const {all,a}=this.cur(true);a.p[i]=a.p[i]||[0,0,1];return{all,a,o:a.p[i]}},
  // the set on screen (Studio can show a track's pans, not the song's), else the song's
  shown(){const f=[...document.querySelectorAll('#stPans .field,#editPans .field,#playPans .field')].find(x=>x.getClientRects().length);
    const k=f&&/^(\w+):/.test(f.dataset.field)?f.dataset.field.split(':')[0]:setKey();return this.SETS.includes(k)?k:'guitar'},
  open(key){
    this.key=key||this.shown();this.sel=-1;
    let ov=$('arOv');
    if(!ov){
      ov=document.createElement('div');ov.id='arOv';ov.className='labov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Arrange pans');
      ov.innerHTML='<div id="arStage"></div><div id="arRing" hidden><span id="arSize" aria-label="Drag to size this pan">⤡</span></div>'
        +'<div id="arSheet"><div class="ar-top"><b>Arrange pans</b><div class="ar-sets" role="tablist"></div></div>'
        +'<div class="ar-hint">Drag a pan to move it. Pinch it, or drag ⤡, to size it.</div>'
        +'<div class="ar-sl"><label for="arOne">This pan</label><input id="arOne" type="range" min="60" max="150" step="1"></div>'
        +'<div class="ar-sl"><label for="arAll">All pans</label><input id="arAll" type="range" min="60" max="140" step="1"></div>'
        +'<div class="ar-sl"><label for="arSk">Skirt</label><input id="arSk" type="range" min="0" max="200" step="5"></div>'
        +'<div class="ar-btns"><button class="ar-reset" data-ar="reset">Reset</button><button class="ar-done" data-ar="done">Done</button></div></div>';
      document.body.appendChild(ov);this.wire(ov);
    }
    ov.hidden=false;document.body.classList.add('ar-on');this.render();
  },
  close(){const ov=$('arOv');if(!ov||ov.hidden)return;ov.hidden=true;document.body.classList.remove('ar-on');this.refresh();try{if(currentView==='setup')SETUP.render()}catch(e){}},
  // the app's own pans pick up the new arrangement
  refresh(){document.querySelectorAll('[data-pf]').forEach(b=>b.dataset.pf='');try{renderPans()}catch(e){}requestAnimationFrame(()=>{try{STAGE.render();STAGE.fitWrite();STAGE.fitStudio()}catch(e){}})},
  render(){
    const ov=$('arOv');if(!ov||ov.hidden)return;
    ov.classList.toggle('ar-land',STAGE.orient()==='land');
    ov.querySelector('.ar-sets').innerHTML=this.SETS.map(k=>'<button role="tab" data-ark="'+k+'" aria-selected="'+(k===this.key)+'">'+esc(SETS[k].name)+'</button>').join('');
    const {W,H,L}=this.L(),st=$('arStage');st.style.height=H+'px';
    st.innerHTML=STAGE.svg(L,W,H,this.key);
    const {a}=this.cur(),ent=STAGE.lay()[this.key]||{};
    $('arAll').value=Math.round((a&&a.all||1)*100);$('arSk').value=Math.round((ent.skirt!=null?ent.skirt:1)*100);
    const one=$('arOne');one.disabled=this.sel<0;one.value=Math.round(((a&&a.p&&a.p[this.sel])||[0,0,1])[2]*100);
    this.ring();
  },
  ring(){
    const r=$('arRing'),g=this.sel>=0&&$('arStage').querySelector('g[data-drum="'+this.sel+'"] .rim');
    if(!g){r.hidden=true;return}
    const b=g.getBoundingClientRect();r.hidden=false;Object.assign(r.style,{left:(b.left-4)+'px',top:(b.top-4)+'px',width:(b.width+8)+'px',height:(b.height+8)+'px'});
  },
  save(all){STAGE.setLay(all);this.render()},
  wire(ov){
    const st=ov.querySelector('#arStage'),pts=new Map();let drag=null,raf=0;
    const later=all=>{STAGE._lay=all;STAGE.lv++;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>this.render())};
    ov.addEventListener('click',e=>{
      const k=e.target.closest('[data-ark]');if(k){this.key=k.dataset.ark;this.sel=-1;this.render();return}
      const b=e.target.closest('[data-ar]');if(!b)return;
      if(b.dataset.ar==='done')this.close();
      else{const all=JSON.parse(JSON.stringify(STAGE.lay()));delete all[this.key];this.sel=-1;this.save(all);say('Back to the standard layout')}
    });
    $('arAll').oninput=e=>{const {all,a}=this.cur(true);a.all=e.target.value/100;this.save(all)};
    $('arSk').oninput=e=>{const all=JSON.parse(JSON.stringify(STAGE.lay()));all[this.key]=all[this.key]||{};all[this.key].skirt=e.target.value/100;this.save(all)};
    $('arOne').oninput=e=>{if(this.sel<0)return;const {all,o}=this.drum(this.sel);o[2]=e.target.value/100;this.save(all)};
    // drag to move; a second finger pinches the drum you're holding
    st.addEventListener('pointerdown',e=>{
      pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pts.size===2&&drag){const [p,q]=[...pts.values()];drag.pinch=Math.hypot(p.x-q.x,p.y-q.y);drag.s0=this.drum(drag.i).o[2];return}
      const g=e.target.closest('g[data-drum]');if(!g){this.sel=-1;this.ring();$('arOne').disabled=true;return}
      e.preventDefault();this.sel=+g.dataset.drum;const {o}=this.drum(this.sel);
      drag={i:this.sel,x:e.clientX,y:e.clientY,o0:o.slice()};try{st.setPointerCapture(e.pointerId)}catch(_){}
      this.render();
    });
    st.addEventListener('pointermove',e=>{
      if(!pts.has(e.pointerId)||!drag)return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const {W,H}=this.box(),{all,o}=this.drum(drag.i);
      if(pts.size>=2&&drag.pinch){const [p,q]=[...pts.values()];o[2]=Math.max(.5,Math.min(1.6,drag.s0*Math.hypot(p.x-q.x,p.y-q.y)/drag.pinch))}
      else{o[0]=drag.o0[0]+(e.clientX-drag.x)/W;o[1]=drag.o0[1]+(e.clientY-drag.y)/H}
      drag.all=all;later(all);
    });
    const up=e=>{pts.delete(e.pointerId);if(pts.size)return;if(drag&&drag.all)this.save(drag.all);drag=null};
    st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up);
    // the ⤡ corner: the drum's size follows your finger's distance from its middle
    const sz=ov.querySelector('#arSize');let rs=null;
    sz.addEventListener('pointerdown',e=>{if(this.sel<0)return;e.preventDefault();e.stopPropagation();const b=$('arRing').getBoundingClientRect(),c={x:b.left+b.width/2,y:b.top+b.height/2};
      rs={c,d0:Math.hypot(e.clientX-c.x,e.clientY-c.y),s0:this.drum(this.sel).o[2]};try{sz.setPointerCapture(e.pointerId)}catch(_){}});
    sz.addEventListener('pointermove',e=>{if(!rs)return;const {all,o}=this.drum(this.sel);o[2]=Math.max(.5,Math.min(1.6,rs.s0*Math.hypot(e.clientX-rs.c.x,e.clientY-rs.c.y)/rs.d0));rs.all=all;later(all)});
    const sup=()=>{if(rs&&rs.all)this.save(rs.all);rs=null};sz.addEventListener('pointerup',sup);sz.addEventListener('pointercancel',sup);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ov.hidden)this.close()});
    let rz=0;addEventListener('resize',()=>{if(ov.hidden)return;cancelAnimationFrame(rz);rz=requestAnimationFrame(()=>this.render())});
  }
};
{
  // Settings: a Pan layout row under the pan rows
  const row='<button class="sxrow" data-row="arrange"><span class="sxic" style="background:#ffd84a" aria-hidden="true">✥</span><span class="sxlab"><b>Pan layout</b><small>Move and size your pans, skirt length</small></span><span class="sxval">'
  const add=()=>{const list=$('setList');if(!list||list.querySelector('[data-row=arrange]'))return;const g=list.querySelectorAll('.sxgroup .sxbox');if(!g.length)return;
    const n=Object.keys(STAGE.lay()).length;const at=list.querySelector('[data-row=photos]');const h=row+(n?'Your own':'Standard')+'</span><span class="sxchev" aria-hidden="true">›</span></button>';
    if(at)at.insertAdjacentHTML('afterend',h);else g[0].insertAdjacentHTML('beforeend',h)};
  const _sr=SETUP.render.bind(SETUP);SETUP.render=function(){_sr();try{add()}catch(e){console.warn(e)}};
  document.addEventListener('click',e=>{const r=e.target.closest&&e.target.closest('#setList [data-row=arrange]');if(!r)return;e.stopPropagation();e.preventDefault();ARRANGE.open()},true);
}
