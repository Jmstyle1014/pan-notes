// Panyard icon: a chrome pan seen from a little above, its skirt below, dents for notes, one note lit.
// One function, four colour looks. Output: an SVG string at 1024×1024.
const LOOKS={
  night:{name:'Night',bg:['#2a1e55','#110c20'],rim:'#efeaff',glow:'#ff8a5c',glow2:'#3fd0d4',accent:'#ffd166',chrome:['#ffffff','#c9c3e6','#5d5590','#efeaff','#2a2350'],bowl:['#dcd7f3','#7a72aa','#3a3266'],shadow:'#05030c'},
  day:{name:'Day',bg:['#ffffff','#e9e5f3'],rim:'#ffffff',glow:'#ff8a5c',glow2:'#2fb8bc',accent:'#e0a83a',chrome:['#ffffff','#dedbe9','#8e88a8','#f6f5fb','#6f6a88'],bowl:['#ffffff','#c4bfd6','#8a84a3'],shadow:'#8e88a8'},
  cday:{name:'Chrome Day',bg:['#f4f3f8','#cfcbdc'],rim:'#ffffff',glow:'#f5388a',glow2:'#dcb356',accent:'#dcb356',chrome:['#ffffff','#e5e2ee','#9a93b4','#fbf3df','#6d6788'],bowl:['#ffffff','#d6d1e4','#8f88aa'],shadow:'#7d769c'},
  cnight:{name:'Chrome Night',bg:['#2a2b2f','#0b0b0d'],rim:'#ffffff',glow:'#f4b13d',glow2:'#f7c267',accent:'#f7c267',chrome:['#ffffff','#c9ccd2','#55585f','#f1f1f1','#26272b'],bowl:['#e9eaee','#83868e','#2f3034'],shadow:'#000000'},
};
function icon(k,opt={}){
  const L=LOOKS[k],S=1024,cx=512,top=440,rx=380,ry=300,sk=150;   // bowl centre, radii, skirt height
  const id=s=>k+'-'+s;
  const notes0=[ // dents on the bowl: [x,y,rx,ry] in bowl coordinates (-1..1)
    [-.55,-.45,.25,.22],[0,-.66,.24,.2],[.55,-.45,.25,.22],[-.74,.08,.22,.24],[.74,.08,.22,.24],
    [-.42,.5,.24,.2],[.42,.5,.24,.2],[0,.72,.2,.16],[-.2,-.08,.15,.15],[.2,-.08,.15,.15],[0,.28,.14,.14]];
  const notes=notes0.map(([x,y,w,h])=>[x,y+.06,w,h]);const lit=opt.lit??[1,4,7];   // which dents glow
  const P=([x,y])=>[cx+x*rx*.86,top+y*ry*.86];
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><defs>
  <radialGradient id="${id('bg')}" cx=".5" cy=".3" r=".85"><stop offset="0" stop-color="${L.bg[0]}"/><stop offset="1" stop-color="${L.bg[1]}"/></radialGradient>
  <linearGradient id="${id('skirt')}" x1="0" x2="1"><stop offset="0" stop-color="${L.chrome[4]}"/><stop offset=".12" stop-color="${L.chrome[2]}"/><stop offset=".3" stop-color="${L.chrome[0]}"/><stop offset=".42" stop-color="${L.chrome[1]}"/><stop offset=".62" stop-color="${L.chrome[2]}"/><stop offset=".8" stop-color="${L.chrome[3]}"/><stop offset=".93" stop-color="${L.chrome[1]}"/><stop offset="1" stop-color="${L.chrome[4]}"/></linearGradient>
  <linearGradient id="${id('rim')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${L.chrome[0]}"/><stop offset=".5" stop-color="${L.chrome[2]}"/><stop offset="1" stop-color="${L.chrome[3]}"/></linearGradient>
  <radialGradient id="${id('bowl')}" cx=".5" cy=".62" r=".72"><stop offset="0" stop-color="${L.bowl[0]}"/><stop offset=".6" stop-color="${L.bowl[1]}"/><stop offset="1" stop-color="${L.bowl[2]}"/></radialGradient>
  <linearGradient id="${id('dent')}" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${L.bowl[2]}"/><stop offset=".55" stop-color="${L.bowl[1]}"/><stop offset="1" stop-color="${L.chrome[0]}"/></linearGradient>
  ${[L.glow,L.glow2,L.accent].map((c,i)=>`<radialGradient id="${id('g'+i)}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".85"/></radialGradient><radialGradient id="${id('h'+i)}"><stop offset="0" stop-color="${c}" stop-opacity=".75"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')}
  <radialGradient id="${id('sh')}"><stop offset="0" stop-color="${L.shadow}" stop-opacity=".55"/><stop offset="1" stop-color="${L.shadow}" stop-opacity="0"/></radialGradient>
  <clipPath id="${id('bc')}"><ellipse cx="${cx}" cy="${top}" rx="${rx-16}" ry="${ry-12}"/></clipPath>
  </defs>`;
  if(!opt.noBg)s+=`<rect width="${S}" height="${S}" rx="${opt.square?0:228}" fill="url(#${id('bg')})"/>`;
  // floor shadow
  s+=`<ellipse cx="${cx}" cy="${top+sk+ry*.62}" rx="${rx*1.05}" ry="${ry*.28}" fill="url(#${id('sh')})"/>`;
  // skirt: the side of the drum, with a hoop near the bottom
  s+=`<path d="M${cx-rx} ${top} L${cx-rx*.93} ${top+sk} A${rx*.93} ${ry*.93} 0 0 0 ${cx+rx*.93} ${top+sk} L${cx+rx} ${top} Z" fill="url(#${id('skirt')})"/>`;
  s+=`<path d="M${cx-rx*.95} ${top+sk*.72} A${rx*.95} ${ry*.95} 0 0 0 ${cx+rx*.95} ${top+sk*.72}" fill="none" stroke="${L.chrome[0]}" stroke-opacity=".55" stroke-width="10"/>`;
  s+=`<path d="M${cx-rx*.95} ${top+sk*.72+12} A${rx*.95} ${ry*.95} 0 0 0 ${cx+rx*.95} ${top+sk*.72+12}" fill="none" stroke="${L.chrome[4]}" stroke-opacity=".5" stroke-width="6"/>`;
  // rim and bowl
  s+=`<ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="url(#${id('rim')})"/>`;
  s+=`<ellipse cx="${cx}" cy="${top}" rx="${rx-16}" ry="${ry-12}" fill="url(#${id('bowl')})"/>`;
  s+=`<g clip-path="url(#${id('bc')})"><ellipse cx="${cx}" cy="${top-ry*.55}" rx="${rx*1.1}" ry="${ry*.7}" fill="${L.bowl[2]}" opacity=".55"/><ellipse cx="${cx}" cy="${top+ry*.62}" rx="${rx*.8}" ry="${ry*.38}" fill="#fff" opacity=".18"/>`;
  // a soft reflection band across the bowl, like the photo
  s+=`<path d="M${cx-rx} ${top-ry*.15} Q${cx} ${top-ry*.75} ${cx+rx} ${top-ry*.25} L${cx+rx} ${top-ry*.05} Q${cx} ${top-ry*.5} ${cx-rx} ${top+ry*.1} Z" fill="#fff" opacity=".22"/>`;
  notes.forEach((n,i)=>{const [x,y]=P(n),w=n[2]*rx,h=n[3]*ry,g=lit.indexOf(i);
    if(g>=0)s+=`<ellipse cx="${x}" cy="${y}" rx="${w*1.9}" ry="${h*1.9}" fill="url(#${id('h'+g)})"/>`;
    s+=`<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" fill="url(#${g>=0?id('g'+g):id('dent')})" stroke="${g>=0?'#fff':L.bowl[2]}" stroke-opacity="${g>=0?.7:.45}" stroke-width="5"/>`;
    if(g>=0)s+=`<ellipse cx="${x-w*.25}" cy="${y-h*.35}" rx="${w*.32}" ry="${h*.18}" fill="#fff" opacity=".75"/>`;else s+=`<path d="M${x-w*.7} ${y+h*.55} Q${x} ${y+h*1.02} ${x+w*.7} ${y+h*.55}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="6" stroke-linecap="round"/>`});
  s+=`</g>`;
  // rim highlight
  s+=`<path d="M${cx-rx*.97} ${top+ry*.25} A${rx} ${ry} 0 0 0 ${cx-rx*.2} ${top+ry*.98}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".9"/>`;
  return s+'</svg>';
}
if(typeof module!=='undefined')module.exports={icon,LOOKS};
