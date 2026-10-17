/* ---------- 3D pans: the tenor hangs between two stand poles; the others stand as shiny drums ---------- */
// Only the look changes: every note keeps the shape and place measured from the real pan, so taps land the same.
const HANG={
  on:()=>setKey()==='tenor',
  tilt:.94,                       // a gentle lean back, so it reads as 3D without squashing the notes
  defs(){
    if(document.getElementById('hangDefs'))return;
    const d=document.createElement('div');d.id='hangDefs';d.setAttribute('aria-hidden','true');
    d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML='<svg width="0" height="0" focusable="false"><defs>'
      +'<linearGradient id="hgRim" x1="0" x2="1"><stop offset="0" stop-color="#6d678f"/><stop offset=".22" stop-color="#f4f1ff"/><stop offset=".5" stop-color="#aaa3cc"/><stop offset=".78" stop-color="#f4f1ff"/><stop offset="1" stop-color="#6d678f"/></linearGradient>'
      +'<linearGradient id="hgSkirt" x1="0" x2="1"><stop offset="0" stop-color="#1c1733"/><stop offset=".28" stop-color="#8d87b0"/><stop offset=".55" stop-color="#433c69"/><stop offset=".8" stop-color="#6b6492"/><stop offset="1" stop-color="#16122a"/></linearGradient>'
      +'<radialGradient id="hgBed" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#3b3266"/><stop offset=".6" stop-color="#1f1839"/><stop offset="1" stop-color="#130e26"/></radialGradient>'
      +'<radialGradient id="hgZone" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#5a4e98"/><stop offset=".55" stop-color="#3a3170"/><stop offset="1" stop-color="#2a2254"/></radialGradient>'
      +'<linearGradient id="hgPole" x1="0" x2="1"><stop offset="0" stop-color="#3a3556"/><stop offset=".35" stop-color="#d9d4f2"/><stop offset=".6" stop-color="#8a84ab"/><stop offset="1" stop-color="#2a2642"/></linearGradient>'
      +'<radialGradient id="hgGloss" cx=".3" cy=".22" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      +'<radialGradient id="hgGold" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="#fff3c2"/><stop offset=".5" stop-color="#ffd166"/><stop offset="1" stop-color="#e6a238"/></radialGradient>'
      +'<radialGradient id="hgShadow"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
      +'</defs></svg>';
    document.body.appendChild(d);
  },
  // the stand, the drum's side (the skirt) and the floor shadow, all behind the playing face
  stage(p){
    const {cx,cy,rx}=p,ry=p.ry*this.tilt,drop=rx*.15,L=cx-rx,R=cx+rx,pw=rx*.05,gap=rx*.07,top=cy-p.ry-rx*.05,floor=cy+ry+drop+rx*.1;
    const pole=x=>'<rect x="'+f1(x-pw/2)+'" y="'+f1(top)+'" width="'+f1(pw)+'" height="'+f1(floor-top)+'" rx="'+f1(pw/2)+'" fill="url(#hgPole)"/>'
      +'<circle cx="'+f1(x)+'" cy="'+f1(top)+'" r="'+f1(pw*.8)+'" fill="url(#hgPole)"/>'
      +'<ellipse cx="'+f1(x)+'" cy="'+f1(floor)+'" rx="'+f1(pw*2.2)+'" ry="'+f1(pw*.55)+'" fill="#2a2546"/>';
    const arm=(x0,x1)=>'<rect x="'+f1(Math.min(x0,x1))+'" y="'+f1(cy-pw*.35)+'" width="'+f1(Math.abs(x1-x0))+'" height="'+f1(pw*.7)+'" rx="'+f1(pw*.3)+'" fill="url(#hgPole)"/>'
      +'<circle cx="'+f1(x1)+'" cy="'+f1(cy)+'" r="'+f1(pw*.55)+'" fill="#efeaff" stroke="#3a3556" stroke-width="'+f1(pw*.2)+'"/>';
    return '<ellipse cx="'+cx+'" cy="'+f1(floor)+'" rx="'+f1(rx*.85)+'" ry="'+f1(rx*.07)+'" fill="url(#hgShadow)"/>'
      +pole(L-gap)+pole(R+gap)
      +'<path d="M'+L+' '+cy+' V'+f1(cy+drop)+' A'+rx+' '+f1(ry)+' 0 0 0 '+R+' '+f1(cy+drop)+' V'+cy+' Z" fill="url(#hgSkirt)"/>'
      +'<path d="M'+f1(L+rx*.02)+' '+f1(cy+drop*.5)+' A'+f1(rx*.98)+' '+f1(ry)+' 0 0 0 '+f1(R-rx*.02)+' '+f1(cy+drop*.5)+'" fill="none" stroke="#efeaff" stroke-opacity=".18" stroke-width="'+f1(rx*.01)+'"/>'
      +arm(L-gap,L+rx*.01)+arm(R+gap,R-rx*.01);
  },
  view(p){const {cx,cy,rx}=p,ry=p.ry*this.tilt,pad=rx*.07+rx*.09,top=cy-p.ry-rx*.1,bot=cy+ry+rx*.15+rx*.18;
    return [cx-rx-pad,top,2*(rx+pad),bot-top].map(Math.round).join(' ')},
  wrap(html,p){
    const m=/^([\s\S]*?<svg viewBox=")([^"]*)("[^>]*>)([\s\S]*)(<\/svg><\/div>)$/.exec(html);if(!m)return html;
    const {cx,cy}=p,t='translate(0 '+cy+') scale(1 '+this.tilt+') translate(0 '+(-cy)+')';
    const gloss='<ellipse class="hg-gloss" cx="'+cx+'" cy="'+cy+'" rx="'+f1(p.rx*.97)+'" ry="'+f1(p.ry*.97)+'" fill="url(#hgGloss)"/>';
    return m[1].replace('class="pan ','class="pan hang ')+this.view(p)+m[3]+'<g class="sway" style="transform-origin:'+cx+'px '+f1(cy-p.ry)+'px">'+this.stage(p)+'<g class="face" transform="'+t+'">'+m[4]+gloss+'</g></g>'+m[5];
  }
};
// every other pan: the same chrome rim, shaded notes and the side of the drum below, without the stand
const P3D={
  tilt:.94,
  wrap(html,p){
    const m=/^([\s\S]*?<svg viewBox=")([^"]*)("[^>]*>)([\s\S]*)(<\/svg><\/div>)$/.exec(html);if(!m)return html;
    const ds=p.drums||[{cx:p.cx,cy:p.cy,rx:p.rx,ry:p.ry}],[vx,vy,vw,vh]=m[2].split(' ').map(Number),c=vy+vh/2;
    const drop=d=>d.rx*.13,maxDrop=Math.max(...ds.map(drop));
    const t='translate(0 '+f1(c)+') scale(1 '+this.tilt+') translate(0 '+f1(-c)+')';
    // behind each drum: a soft floor shadow and its chrome side
    const back=ds.map(d=>{const L=d.cx-d.rx,R=d.cx+d.rx,dr=drop(d);
      return '<ellipse cx="'+d.cx+'" cy="'+f1(d.cy+d.ry+dr*1.3)+'" rx="'+f1(d.rx*.9)+'" ry="'+f1(d.rx*.08)+'" fill="url(#hgShadow)"/>'
        +'<path d="M'+L+' '+d.cy+' V'+f1(d.cy+dr)+' A'+d.rx+' '+d.ry+' 0 0 0 '+R+' '+f1(d.cy+dr)+' V'+d.cy+' Z" fill="url(#hgSkirt)"/>'
        +'<path d="M'+f1(L+d.rx*.02)+' '+f1(d.cy+dr*.5)+' A'+f1(d.rx*.98)+' '+d.ry+' 0 0 0 '+f1(R-d.rx*.02)+' '+f1(d.cy+dr*.5)+'" fill="none" stroke="#efeaff" stroke-opacity=".18" stroke-width="'+f1(Math.max(3,d.rx*.012))+'"/>'}).join('');
    const gloss=ds.map(d=>'<ellipse class="hg-gloss" cx="'+d.cx+'" cy="'+d.cy+'" rx="'+f1(d.rx*.97)+'" ry="'+f1(d.ry*.97)+'" fill="url(#hgGloss)"/>').join('');
    const view=[vx,vy,vw,f1(vh+maxDrop*1.6)].join(' ');
    return m[1].replace('class="pan ','class="pan p3d ')+view+m[3]+'<g class="face" transform="'+t+'">'+back+m[4]+gloss+'</g>'+m[5];
  }
};
{
  const plain=panSVG;
  panSVG=function(p,interactive){const h=plain(p,interactive);if(/class="pan [^"]*\bphoto\b/.test(h))return h;HANG.defs();
    return HANG.on()&&p.drums&&p.drums.length===1?HANG.wrap(h,p):P3D.wrap(h,p)};
}
