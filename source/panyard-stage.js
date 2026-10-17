/* ---------- Play, pans first: on a sideways phone or iPad the pans fill the screen ---------- */
// Every drum of a set is drawn the same size, as big as the screen allows, and the falling notes sit in a slim strip
// between the pans (or either side of the tenor), in the top three quarters so they never cover what you're hitting.
// Loop, speed and the rest open from the ⋯ button. The notes, their places on each pan and the taps are unchanged.
const STAGE={
  on:false,
  wanted(){
    if(document.body.dataset.view!=='play')return false;
    if(document.body.classList.contains('gametab')&&!(GM&&(GM.state==='run'||GM.state==='count')))return false;   // the Game's start and results panels show as usual
    const W=innerWidth,H=innerHeight-(this.dockH()||0);return W/H>=1.15||setKey()==='six';
  },
  dockH(){const d=$('dock');return d?d.offsetHeight:0},
  // which drum each field belongs to
  drumsOf(){
    const out=[];
    for(const v of PANS){
      if(v.drums&&v.drums.length){v.drums.forEach((d,i)=>out.push({cx:d.cx,cy:d.cy,r:d.rx,key:v.key,ids:v.fields.filter(f=>(f[8]!=null?f[8]:+(String(f[7]).replace(/\D/g,'')||0))===i).map(f=>f[0])}))}
      else out.push({cx:v.cx,cy:v.cy,r:Math.max(v.rx,v.ry),key:v.key,ids:v.fields.map(f=>f[0]),own:true});
    }
    if(isGuitar()&&S.swapped)out.reverse();
    return out;
  },
  horseshoe(bx,by,bw,bh,gap,strip){
    // the biggest equal drums that fit, then the tightest arch for that size: the bottom drums as close as the note strip allows
    const fits=pts=>{for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)if(Math.hypot(pts[i][0]-pts[j][0],(pts[i][1]-pts[j][1])/1.06)<2*pts.R+gap)return false;return true};
    for(let R=Math.floor(bh/2);R>20;R-=2){let best=null;
      for(let S_=180;S_<=300;S_+=6){const a0=90+S_/2,angs=[0,1,2,3,4,5].map(i=>a0-S_/5*i),sn=angs.map(a=>Math.sin(a*Math.PI/180)),cs=angs.map(a=>Math.cos(a*Math.PI/180)),lo=Math.min(...sn);
        const Ry=(bh-2.12*R)/(1-lo);if(Ry<=0)continue;
        for(let Rx=R*1.2;Rx<=bw/2-R;Rx+=4){const cx=bx+bw/2,cy=by+R+Ry,pts=cs.map((c,i)=>[cx+Rx*c,cy-Ry*sn[i]]);pts.R=R;
          const inner=(pts[5][0]-R)-(pts[0][0]+R);if(inner<strip+10)continue;
          if(fits(pts)){const span=pts[5][0]-pts[0][0];if(!best||span<best.span)best={R,pts,cx,inner,span};break}}}
      if(best)return best}
    return null;
  },
  // where each drum goes and where the two lanes go, for a stage W × H (CSS pixels)
  layout(W,H){
    const k=setKey(),ds=this.drumsOf(),pad=8,side=Math.max(14,Math.min(44,W*.04)),hitB=H*.75;
    const place=[],lanes=[];let top=pad;
    if(ds.length===2){   // double guitar, double seconds: the strip between the two pans
      const strip=Math.min(150,W*.15),R=Math.min((H-2*pad)/2.12,(W-2*side-strip-24)/4),cy=H/2-R*.06;
      place.push([W/2-strip/2-12-R,cy,R],[W/2+strip/2+12+R,cy,R]);
      lanes.push({x:W/2-strip/2,w:strip/2-2},{x:W/2+2,w:strip/2-2});top=pad+6;
    }else if(ds.length===1){   // tenor: left-hand lane on the left of the pan, right-hand lane on the right
      const R=(H-2*pad)/2.12,lw=Math.max(48,Math.min(80,(W-2*R)/2-side-14));
      place.push([W/2,H/2-R*.06,R]);lanes.push({x:W/2-R-14-lw,w:lw},{x:W/2+R+14,w:lw});top=pad+6;
    }else if(k==='six'&&W/H>=1.15){   // six bass: a tight arch, notes inside it between the two bottom drums
      const strip=Math.min(116,W*.13),hs=this.horseshoe(side,pad,W-2*side,H-2*pad,4,strip);
      hs.pts.forEach(p=>place.push([p[0],p[1],hs.R]));
      const sw=Math.min(strip,hs.inner-10),topGap=(hs.pts[3][0]-hs.R)-(hs.pts[2][0]+hs.R);
      // the strip runs from the top when it fits between the two top drums, otherwise it starts just under them
      top=topGap>=sw+8?pad+4:Math.max(pad,Math.min(...hs.pts.map(p=>p[1]))+hs.R*1.08);
      lanes.push({x:hs.cx-sw/2,w:sw/2-2},{x:hs.cx+2,w:sw/2-2});
    }else if(k==='six'){   // six bass upright: left-hand drums down the left, right-hand drums down the right
      const strip=Math.min(96,W*.24),R=Math.min((W-strip-28)/4,(H-2*pad)/6.3),gy=R*2.08,used=gy*2+2.1*R,y0=(H-used)/2+R;
      [[2,0],[1,1],[0,2],[3,0],[4,1],[5,2]].forEach(([di,row])=>{const left=di<3;place[di]=[W/2+(left?-1:1)*(strip/2+6+R+(row===1?6:0)),y0+row*gy,R]});
      lanes.push({x:W/2-strip/2,w:strip/2-2},{x:W/2+2,w:strip/2-2});top=y0-R;
    }else{   // four cello: the top two pans either side of the strip, the bottom two close together underneath
      const strip=Math.min(130,W*.14),R=Math.min((H-2*pad)/4.25,(W-2*side-strip-30)/4),y1=pad+R*1.02,y2=H-pad-R*1.15;
      place.push([W/2-strip/2-8-R,y1,R],[W/2+strip/2+8+R,y1,R],[W/2-R-8,y2,R],[W/2+R+8,y2,R]);
      lanes.push({x:W/2-strip/2,w:strip/2-2},{x:W/2+2,w:strip/2-2});top=pad+4;
      return{ds,place,lanes,top,bottom:y1+R*.95};
    }
    return{ds,place,lanes,top,bottom:Math.max(top+120,hitB)};
  },
  svg(L,W,H){
    // take the app's own drawing of each note (shape, letter, everything the highlighting looks for) and move it into place
    const tmp=document.createElement('div');tmp.innerHTML=PANS.map(p=>panSVG(p,false)).join('');
    const fieldEl=id=>tmp.querySelector('.field[data-field="'+CSS.escape(id)+'"]');
    let defs='';tmp.querySelectorAll('defs').forEach(d=>{defs+=d.innerHTML.replace(/id="cp-/g,'id="pfcp-')});
    const t=.94,parts=[];
    L.ds.forEach((d,i)=>{const p=L.place[i];if(!p)return;const [nx,ny,R]=p,s=R/d.r,sk=R*.13;
      parts.push('<ellipse cx="'+f1(nx)+'" cy="'+f1(ny+R*t+sk*1.3)+'" rx="'+f1(R*.9)+'" ry="'+f1(R*.08)+'" fill="url(#hgShadow)"/>'
        +'<path d="M'+f1(nx-R)+' '+f1(ny)+' V'+f1(ny+sk)+' A'+f1(R)+' '+f1(R*t)+' 0 0 0 '+f1(nx+R)+' '+f1(ny+sk)+' V'+f1(ny)+' Z" fill="url(#hgSkirt)"/>'
        +'<g class="'+(d.own?'pan-'+d.key:'')+'" transform="translate('+f1(nx)+' '+f1(ny)+') scale('+s.toFixed(4)+' '+(s*t).toFixed(4)+') translate('+(-d.cx)+' '+(-d.cy)+')">'
        +'<circle class="rim" cx="'+d.cx+'" cy="'+d.cy+'" r="'+d.r+'"/><circle class="bed" cx="'+d.cx+'" cy="'+d.cy+'" r="'+f1(d.r*.965)+'"/>'
        +d.ids.map(id=>{const el=fieldEl(id);return el?el.outerHTML.replace(/url\(#cp-/g,'url(#pfcp-'):''}).join('')
        +'<circle class="hg-gloss" cx="'+d.cx+'" cy="'+d.cy+'" r="'+f1(d.r*.97)+'" fill="url(#hgGloss)"/></g>')});
    const k=setKey();
    return '<div class="pan p3d stage pfsvg pan-'+k+(isGuitar()?' pan-ec':'')+'"><svg viewBox="0 0 '+f1(W)+' '+f1(H)+'" width="'+f1(W)+'" height="'+f1(H)+'" role="img" aria-label="'+esc(curSet().name)+'">'+(defs?'<defs>'+defs+'</defs>':'')+parts.join('')+'</svg></div>';
  },
  render(){
    const want=this.wanted(),st=$('playStage');
    document.body.classList.toggle('pfmode',want);st.classList.toggle('pf',want);
    const cv=$('lanes');
    if(!want){if(this.on){this.on=false;cv._geo=null;cv.style.cssText='';document.body.classList.remove('pf-tools');renderPans()}return}
    this.on=true;HANG.defs();
    const W=innerWidth,H=Math.max(200,innerHeight-this.dockH());
    st.style.setProperty('--pfH',H+'px');
    const L=this.layout(W,H);
    $('playPans').innerHTML=this.svg(L,W,H);$('playPans').classList.add('one');
    cv._geo={lanes:L.lanes,top:L.top,bottom:L.bottom};
    try{tick()}catch{}try{drawLanes(viewT)}catch{}
  }
};
{
  // the ⋯ button: loop, speed and the other practice tools, on top of the pans only when you ask for them
  const b=document.createElement('button');b.id='pfMore';b.className='pfbtn';b.setAttribute('aria-label','Practice tools: loop, speed and more');b.textContent='•••';
  b.onclick=()=>document.body.classList.toggle('pf-tools');$('playStage').appendChild(b);
  const _rp=renderPans;renderPans=function(){_rp();if(STAGE.wanted()||STAGE.on)STAGE.render()};
  const _show=showView;showView=function(v){_show(v);STAGE.render()};
  let rz=0;window.addEventListener('resize',()=>{cancelAnimationFrame(rz);rz=requestAnimationFrame(()=>STAGE.render())});
  PAN_HOOKS.push(()=>{if(STAGE.on)requestAnimationFrame(()=>STAGE.render())});
  // the Game's countdown and run switch to the pans-first stage, and back when it ends
  let lastGM='';setInterval(()=>{const s=typeof GM!=='undefined'?GM.state:'';if(s!==lastGM){lastGM=s;STAGE.render()}},250);
  document.addEventListener('click',e=>{if(document.body.classList.contains('pf-tools')&&!e.target.closest('#practicePanel,#pfMore'))document.body.classList.remove('pf-tools')});
}
