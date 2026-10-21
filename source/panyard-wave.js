
/* ---------- the sound editor (Tune my pans → Edit the sound): edit one recorded note ----------
   Wave and Spectrum views of the take; drag to select, pinch or − + to zoom. Keep, delete, silence or fade a part,
   start right on the hit, level it, take out clicks, and reduce noise: the noise is learned from a quiet part (the one
   you select, or the quietest stretch it can find) and turned down across the whole take, bin by bin, the way a noise
   gate works on each pitch separately. Save writes a new 24-bit take for the note; the untouched take is kept on this
   phone (not in backups) so "Back to the original" can always undo it. A new recording of the note forgets it. */
var WAVE=(()=>{
  let id=null,x=null,sr=48000,hist=[],fut=[],a=null,b=null,v0=0,v1=1,view='wave',src=null,ph=null,open=false,orig={},origLoaded=false;
  const col=c=>typeof THEME!=='undefined'&&THEME.c?THEME.c(c):c;
  const loadOrig=async()=>{if(origLoaded)return;origLoaded=true;try{const o=await idbGet('samplesOrig');if(o&&typeof o==='object')for(const [k,v] of Object.entries(o))if(v instanceof Blob)orig[k]=v}catch{}};
  const saveOrig=()=>idbPut('samplesOrig',{...orig});
  setTimeout(loadOrig,0);
  const T=i=>(i/sr).toFixed(2)+' s';
  const selR=()=>a==null?[0,x.length]:[Math.min(a,b),Math.max(a,b)];
  const hasSel=()=>a!=null&&Math.abs(a-b)>=sr*0.005;
  const note=t=>{const m=$('wvMsg');if(m)m.textContent=t||''};

  function build(){
    if($('wvSheet'))return;
    const sh=document.createElement('div');sh.id='wvSheet';sh.className='sheetov wv';sh.hidden=true;sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.setAttribute('aria-labelledby','wvTitle');
    const B=(k,ic,t)=>'<button class="wvb" data-w="'+k+'"><i aria-hidden="true">'+ic+'</i>'+t+'</button>';
    sh.innerHTML='<div class="sheetbox wvbox">'
      +'<div class="wvhead"><div class="wvtt"><h2 id="wvTitle">Edit the sound</h2><p id="wvSub"></p></div>'
        +'<div class="wvview" role="group" aria-label="View"><button data-v="wave" aria-pressed="true">Wave</button><button data-v="spec" aria-pressed="false">Spectrum</button></div></div>'
      +'<canvas class="wvmini" id="wvMini" aria-label="The whole take; tap to move the zoomed view there"></canvas>'
      +'<div class="wvmain" id="wvMain"><canvas id="wvCv" aria-label="The take. Drag across it to select a part."></canvas></div>'
      +'<div class="wvtime"><span>Selected <b id="wvSel">nothing</b></span><span id="wvZoom"></span><span>Length <b id="wvLen"></b></span></div>'
      +'<p class="wvtip" id="wvTip">Drag across the wave to select a part. In Spectrum, the note shows as bright lines; buzz, hiss and knocks show as haze or upright streaks.</p>'
      +'<div class="wvgrp"><div class="wvlab">Listen and zoom</div><div class="wvrow">'+B('play','▶','Play')+B('playsel','⏵','Play selected')+B('zout','−','Zoom out')+B('zin','+','Zoom in')+B('all','⤢','Select all')+'</div></div>'
      +'<div class="wvgrp"><div class="wvlab">Edit</div><div class="wvrow">'+B('keep','✂','Keep selected')+B('del','🗑','Delete')+B('mute','🔇','Silence')+B('fin','◢','Fade in')+B('fout','◣','Fade out')+B('undo','↶','Undo')+B('redo','↷','Redo')+'</div></div>'
      +'<div class="wvgrp"><div class="wvlab">Clean up</div><div class="wvrow">'+B('start','⇤','Start on the hit')+B('level','⇕','Level it')+B('clicks','⌁','Remove clicks')+B('noise','✧','Reduce noise')+'</div></div>'
      +'<div class="wvgain"><label for="wvGain">Volume of selected</label><input type="range" id="wvGain" min="-12" max="12" step="1" value="0"><output id="wvGainO">0 dB</output></div>'
      +'<p class="wvmsg" id="wvMsg" aria-live="polite"></p>'
      +'<div class="wvfoot"><button class="btn" id="wvOrig" hidden>↺ Back to the original</button><span class="wvgrow"></span><button class="btn" id="wvCancel">Cancel</button><button class="btn primary" id="wvSave">Save to this note</button></div>'
      +'</div>';
    document.body.insertBefore(sh,document.body.firstChild);   // first in the page, so the back button closes it before the tuning screen under it
    sh.addEventListener('click',e=>{if(e.target===sh){close();return}
      const w=e.target.closest('[data-w]');if(w&&!w.disabled){act(w.dataset.w);return}
      const v=e.target.closest('.wvview [data-v]');if(v){view=v.dataset.v;sh.querySelectorAll('.wvview [data-v]').forEach(z=>z.setAttribute('aria-pressed',String(z===v)));draw()}});
    $('wvCancel').onclick=close;$('wvSave').onclick=save;$('wvOrig').onclick=backToOrig;
    $('wvGain').oninput=e=>{$('wvGainO').textContent=(e.target.value>0?'+':'')+e.target.value+' dB'};
    $('wvGain').onchange=e=>{const g=Math.pow(10,e.target.value/20),[p,q]=selR();push();const y=x.slice();for(let i=p;i<q;i++)y[i]=Math.max(-1,Math.min(1,y[i]*g));x=y;
      note((hasSel()?'The selected part':'The whole take')+' is '+(g>1?'louder':'softer')+' by '+Math.abs(e.target.value)+' dB.');e.target.value=0;$('wvGainO').textContent='0 dB';draw()};
    // drag to select; two fingers pinch to zoom
    const main=$('wvMain'),pts=new Map();let drag=null,pinch=null;
    const at=e=>{const r=main.getBoundingClientRect();return Math.round((v0+(v1-v0)*Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)))*x.length)};
    main.addEventListener('pointerdown',e=>{if(!x)return;pts.set(e.pointerId,e.clientX);try{main.setPointerCapture(e.pointerId)}catch{}
      if(pts.size===2){const [p1,p2]=[...pts.values()];pinch={d:Math.abs(p1-p2)||1,v0,v1};drag=null;return}
      drag=at(e);a=b=drag;draw()});
    main.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,e.clientX);
      if(pinch&&pts.size===2){const [p1,p2]=[...pts.values()],d=Math.abs(p1-p2)||1,span=Math.max(.01,Math.min(1,(pinch.v1-pinch.v0)*pinch.d/d)),c=(pinch.v0+pinch.v1)/2;v0=Math.max(0,c-span/2);v1=Math.min(1,v0+span);v0=Math.max(0,v1-span);draw();return}
      if(drag!=null){b=at(e);draw()}});
    const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(drag!=null){drag=null;if(!hasSel())a=b=null;draw()}};
    main.addEventListener('pointerup',up);main.addEventListener('pointercancel',up);
    main.addEventListener('wheel',e=>{if(!e.ctrlKey&&Math.abs(e.deltaY)<Math.abs(e.deltaX))return;e.preventDefault();zoom(e.deltaY<0?.8:1.25)},{passive:false});
    $('wvMini').addEventListener('click',e=>{const r=e.target.getBoundingClientRect(),c=(e.clientX-r.left)/r.width,h=(v1-v0)/2;v0=Math.max(0,Math.min(1-2*h,c-h));v1=v0+2*h;draw()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){e.stopImmediatePropagation();close()}},true);
    window.addEventListener('resize',()=>{if(open)draw()});
  }
  async function openFor(nid){
    build();await loadOrig();const buf=await sampleBuf(nid);if(!buf){say('That recording isn\'t ready yet. Try again in a moment.');return}
    id=nid;sr=buf.sampleRate;x=new Float32Array(buf.length);for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=0;i<x.length;i++)x[i]+=d[i]/buf.numberOfChannels}
    hist=[];fut=[];a=b=null;v0=0;v1=1;open=true;$('wvSheet').hidden=false;
    $('wvSub').textContent=PITCH[id].replace('#','♯').replace(/([A-G])b/,'$1♭')+' · '+((FIELDS.get(id)||{}).pan||'')+' · your recording';
    $('wvOrig').hidden=!orig[id];note('');requestAnimationFrame(draw);
  }
  function close(){stopPlay();open=false;if($('wvSheet'))$('wvSheet').hidden=true}
  function push(){hist.push(x);fut=[];if(hist.length>40)hist.shift()}
  function zoom(f){const c=a!=null&&hasSel()&&f<1?(Math.min(a,b)+Math.max(a,b))/2/x.length:(v0+v1)/2,h=Math.max(.005,Math.min(.5,(v1-v0)*f/2));v0=Math.max(0,c-h);v1=Math.min(1,c+h);if(v1-v0>=.999){v0=0;v1=1}draw()}

  /* ---- drawing ---- */
  function fftR(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bt=n>>1;for(;j&bt;bt>>=1)j^=bt;j^=bt;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
    for(let L=2;L<=n;L<<=1){const h=L>>1,an=-2*Math.PI/L;for(let k=0;k<h;k++){const wr=Math.cos(an*k),wi=Math.sin(an*k);for(let i=k;i<n;i+=L){const j=i+h,tr=re[j]*wr-im[j]*wi,ti=re[j]*wi+im[j]*wr;re[j]=re[i]-tr;im[j]=im[i]-ti;re[i]+=tr;im[i]+=ti}}}}
  function canvas(cv){const w=cv.clientWidth,h=cv.clientHeight,d=devicePixelRatio||1;if(cv.width!==Math.round(w*d)||cv.height!==Math.round(h*d)){cv.width=Math.round(w*d);cv.height=Math.round(h*d)}const g=cv.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,h);return [g,w,h]}
  function waveInto(g,w,h,i0,i1,fill){const N=x.length,per=(i1-i0)/w,m=h/2;g.fillStyle=fill;
    for(let px=0;px<w;px++){let lo=0,hi=0;const p=Math.floor(i0+px*per),q=Math.max(p+1,Math.floor(i0+(px+1)*per));for(let i=p;i<q&&i<N;i++){const v=x[i];if(v<lo)lo=v;if(v>hi)hi=v}g.fillRect(px,m-hi*m*.95,1,Math.max(1,(hi-lo)*m*.95))}}
  function specInto(g,w,h,i0,i1){
    const F=1024,cols=Math.max(1,Math.min(w,360)),rows=140,img=g.createImageData(cols,rows),lo=Math.log(60),hi=Math.log(Math.min(12000,sr/2)),win=new Float64Array(F);
    for(let k=0;k<F;k++)win[k]=.5-.5*Math.cos(2*Math.PI*k/(F-1));
    for(let c=0;c<cols;c++){const at=Math.floor(i0+(i1-i0)*c/cols)-F/2,re=new Float64Array(F),im=new Float64Array(F);for(let k=0;k<F;k++)re[k]=(x[at+k]||0)*win[k];fftR(re,im);
      for(let r=0;r<rows;r++){const f=Math.exp(lo+(hi-lo)*(rows-1-r)/(rows-1)),bin=Math.max(1,Math.min(F/2-1,Math.round(f*F/sr))),db=20*Math.log10(Math.hypot(re[bin],im[bin])+1e-9),v=Math.max(0,Math.min(1,(db+50)/60)),p=(r*cols+c)*4;
        img.data[p]=Math.round(40+215*Math.min(1,v*1.5));img.data[p+1]=Math.round(20+200*v*v);img.data[p+2]=Math.round(70+120*(1-v)*v*2);img.data[p+3]=255}}
    const t=document.createElement('canvas');t.width=cols;t.height=rows;t.getContext('2d').putImageData(img,0,0);g.imageSmoothingEnabled=true;g.drawImage(t,0,0,w,h);
    g.fillStyle='rgba(255,255,255,.55)';g.font='10px system-ui,sans-serif';for(const f of[100,1000,10000]){if(Math.log(f)<lo||Math.log(f)>hi)continue;const y=(hi-Math.log(f))/(hi-lo)*h;g.fillRect(0,y,6,1);g.fillText(f>=1000?f/1000+'k':String(f),8,y+3)}
  }
  function draw(){
    if(!open||!x)return;const N=x.length;
    {const [g,w,h]=canvas($('wvMini'));waveInto(g,w,h,0,N,col('#6a5bb0'));g.strokeStyle=col('#efeaff');g.lineWidth=1.5;g.strokeRect(v0*w+1,1,Math.max(3,(v1-v0)*w-2),h-2);
      if(a!=null){g.fillStyle='rgba(255,111,174,.35)';g.fillRect(Math.min(a,b)/N*w,0,Math.abs(b-a)/N*w,h)}}
    const [g,w,h]=canvas($('wvCv')),i0=Math.floor(v0*N),i1=Math.max(i0+2,Math.ceil(v1*N)),X=i=>(i-i0)/(i1-i0)*w;
    if(view==='spec')specInto(g,w,h,i0,i1);else{waveInto(g,w,h,i0,i1,col('#ff8a5c'));g.fillStyle=col('#30275a');g.fillRect(0,h/2,w,1)}
    if(a!=null){const p=X(Math.min(a,b)),q=X(Math.max(a,b));g.fillStyle='rgba(255,111,174,.22)';g.fillRect(p,0,q-p,h);g.fillStyle=col('#ff6fae');g.fillRect(p,0,2,h);g.fillRect(q-2,0,2,h)}
    if(ph!=null){g.fillStyle=col('#ffd166');g.fillRect(X(ph),0,2,h)}
    $('wvSel').textContent=hasSel()?T(Math.min(a,b))+' – '+T(Math.max(a,b))+' ('+((Math.abs(b-a))/sr).toFixed(2)+' s)':'nothing (tools work on the whole take)';$('wvLen').textContent=T(N);
    $('wvZoom').textContent=v1-v0<.999?'Zoomed ×'+(1/(v1-v0)).toFixed(1):'Pinch or − + to zoom';
    const s=hasSel();$('wvSheet').querySelectorAll('[data-w]').forEach(bt=>{const k=bt.dataset.w;bt.disabled=k==='undo'?!hist.length:k==='redo'?!fut.length:['keep','del','playsel'].includes(k)?!s:false});
  }
  /* ---- listening ---- */
  function stopPlay(){if(src){try{src.stop()}catch{}src=null}ph=null}
  function play(p,q){const ac=panCtx();if(!ac||q-p<10)return;stopPlay();const seg=x.subarray(p,q),buf=ac.createBuffer(1,seg.length,sr);buf.copyToChannel(seg,0);
    const s=ac.createBufferSource();s.buffer=buf;s.connect(pBus);s.start();src=s;const t0=ac.currentTime;
    s.onended=()=>{if(src===s){src=null;ph=null;draw()}};
    (function f(){if(src!==s||!open)return;ph=p+Math.round((ac.currentTime-t0)*sr);if(ph>=q){ph=null;draw();return}draw();requestAnimationFrame(f)})()}

  /* ---- the tools ---- */
  const onsetOf=y=>{let pk=0;for(const v of y)pk=Math.max(pk,Math.abs(v));let i=0;while(i<y.length&&Math.abs(y[i])<pk*.25)i++;return i};
  function act(k){
    const N=x.length,[p,q]=selR();
    if(k==='play'){play(0,N);return}if(k==='playsel'){play(p,q);return}
    if(k==='zin'){zoom(.5);return}if(k==='zout'){zoom(2);return}
    if(k==='all'){a=0;b=N;draw();return}
    if(k==='undo'){if(!hist.length)return;fut.push(x);x=hist.pop();a=b=null;fit();note('Undone.');draw();return}
    if(k==='redo'){if(!fut.length)return;hist.push(x);x=fut.pop();a=b=null;fit();note('Redone.');draw();return}
    stopPlay();let y=x,m='';
    if(k==='keep'){if(!hasSel())return;push();y=x.slice(p,q);a=b=null;v0=0;v1=1;m='Kept the selected part ('+((q-p)/sr).toFixed(2)+' s).'}
    else if(k==='del'){if(!hasSel())return;push();y=new Float32Array(N-(q-p));y.set(x.subarray(0,p));y.set(x.subarray(q),p);
      const j=Math.min(p,y.length-1),r=Math.min(64,j,y.length-j-1);for(let i=-r;i<r;i++){const t=(i+r)/(2*r);y[j+i]=y[j+i]*(i<0?1-.5*t:.5+.5*t)}   // smooth the join
      a=b=null;fit();m='Deleted, and the join smoothed so it doesn\'t click.'}
    else if(k==='mute'){push();y=x.slice();const e=Math.max(1,Math.min(Math.round(sr*.006),(q-p)>>2));for(let i=p;i<q;i++){const g=Math.min(1,(i-p)/e,(q-1-i)/e);y[i]*=1-Math.max(0,g)}m=(hasSel()?'The selected part is':'The whole take is')+' silent, with soft edges.'}
    else if(k==='fin'||k==='fout'){push();y=x.slice();for(let i=p;i<q;i++){const t=(i-p)/Math.max(1,q-p);y[i]*=k==='fin'?t*t:(1-t)*(1-t)}if(k==='fout')for(let i=q;i<N;i++)y[i]=0;m=k==='fin'?'Faded in.':'Faded out.'}
    else if(k==='start'){const on=onsetOf(x),s=Math.max(0,on-Math.round(sr*.004));if(s<sr*.002){note('It already starts on the hit.');return}push();y=x.slice(s);for(let i=0;i<Math.min(48,y.length);i++)y[i]*=i/48;a=b=null;fit();m='Starts right on the hit now ('+(s/sr).toFixed(2)+' s cut).'}
    else if(k==='level'){let pk=0;for(const v of x)pk=Math.max(pk,Math.abs(v));if(pk<1e-4)return;push();const g=.9/pk;y=x.map(v=>v*g);m='Levelled: the loudest moment now sits just under full volume.'}
    else if(k==='clicks'){push();y=x.slice();const n=declick(y,sr,onsetOf(y));if(!n){x=hist.pop();note('No clicks found.');draw();return}m='Removed '+n+' click'+(n===1?'':'s')+'.'}
    else if(k==='noise'){push();const r=denoise(x,hasSel()?[p,q]:null);if(!r){x=hist.pop();note('Couldn\'t find a quiet part to learn the noise from. Select a part with only hiss in it and try again.');draw();return}
      y=r.y;m='Noise turned down by about '+r.db+' dB, learned from '+T(r.from)+'–'+T(r.to)+'. Press again for more.'}
    x=y instanceof Float32Array?y:Float32Array.from(y);note(m);draw();
  }
  function fit(){if(v1-v0<.999){v0=0;v1=1}}

  /* noise reduction: learn the noise's level at each pitch from a quiet part, then turn every part of the take down at
     the pitches where it's no louder than that noise (and leave the note's own pitches alone). STFT, 2048 points, 75% overlap. */
  function denoise(x,range){
    const F=2048,H=512,N=x.length;if(N<F*2)return null;
    let from,to;
    if(range&&range[1]-range[0]>=F){from=range[0];to=range[1]}
    else{const L=Math.min(N>>2,Math.round(sr*.15)),step=Math.round(L/4);let best=Infinity,bi=-1;const on=onsetOf(x);
      for(let i=0;i+L<=N;i+=step){if(i<on+sr*.05&&i+L>on)continue;let s=0;for(let j=i;j<i+L;j++)s+=x[j]*x[j];if(s<best){best=s;bi=i}}
      if(bi<0||L<F)return null;from=bi;to=bi+L}
    const win=new Float64Array(F);for(let k=0;k<F;k++)win[k]=Math.sqrt(.5-.5*Math.cos(2*Math.PI*k/F));
    const B=F/2+1,prof=new Float64Array(B);let nf=0;
    for(let s=from;s+F<=to;s+=H/2){const re=new Float64Array(F),im=new Float64Array(F);for(let k=0;k<F;k++)re[k]=x[s+k]*win[k];fftR(re,im);for(let k=0;k<B;k++)prof[k]+=Math.hypot(re[k],im[k]);nf++}
    if(!nf)return null;for(let k=0;k<B;k++)prof[k]/=nf;
    const pad=F,y=new Float64Array(N+2*pad),wsum=new Float64Array(N+2*pad),over=1.6,floor=.08;let prev=null,cut=0,cutN=0;
    for(let s=-pad;s<N+pad-F;s+=H){const re=new Float64Array(F),im=new Float64Array(F);for(let k=0;k<F;k++){const i=s+k;re[k]=(i>=0&&i<N?x[i]:0)*win[k]}fftR(re,im);
      const gain=new Float64Array(B);for(let k=0;k<B;k++){const m=Math.hypot(re[k],im[k]);gain[k]=m>0?Math.max(floor,Math.min(1,(m-over*prof[k])/m)):floor}
      // smooth across neighbouring pitches and over time, so it doesn't warble ("musical noise")
      const sm=new Float64Array(B);for(let k=0;k<B;k++){let s2=0,c=0;for(let d=-2;d<=2;d++){const j=k+d;if(j>=0&&j<B){s2+=gain[j];c++}}sm[k]=s2/c}
      if(prev)for(let k=0;k<B;k++)sm[k]=sm[k]<prev[k]?prev[k]*.55+sm[k]*.45:sm[k];prev=sm;
      for(let k=0;k<B;k++){re[k]*=sm[k];im[k]*=sm[k];if(k&&k<B-1){re[F-k]*=sm[k];im[F-k]*=sm[k]}cut+=sm[k];cutN++}
      for(let k=0;k<F;k++)im[k]=-im[k];fftR(re,im);   // inverse: conjugate, forward, conjugate, divide by F
      for(let k=0;k<F;k++){const i=s+k+pad;y[i]+=re[k]/F*win[k];wsum[i]+=win[k]*win[k]}}
    const out=new Float32Array(N);for(let i=0;i<N;i++){const w=wsum[i+pad];out[i]=w>1e-6?y[i+pad]/w:0}
    return {y:out,from,to,db:Math.round(-20*Math.log10(Math.max(floor,cut/Math.max(1,cutN))))};
  }

  /* ---- saving ---- */
  async function save(){
    if(!id||!x)return;stopPlay();
    if(!hist.length){close();return}
    if(!orig[id]&&SAMPLES.wav[id]){orig[id]=SAMPLES.wav[id];saveOrig()}
    SAMPLES.wav[id]=encodeWav24(x,sr);delete SAMPLES.buf[id];saveSamples();
    // the old trim points belong to the old take; pitch, volume, ring and tone stay
    const t=SAMPLES.tune[id];if(t){delete t.start;delete t.end;saveTune()}
    await sampleBuf(id);close();try{changedTW()}catch{}say('Saved your edit of '+PITCH[id].replace('#','♯')+'. Back to the original is in Edit the sound.');
    try{strike(id,.95)}catch{}
  }
  async function backToOrig(){
    if(!id||!orig[id])return;if(!confirm('Put back the recording as it was before any editing? Your edits are lost.'))return;
    SAMPLES.wav[id]=orig[id];delete orig[id];saveOrig();delete SAMPLES.buf[id];saveSamples();await sampleBuf(id);close();try{changedTW()}catch{}say('The original recording is back.');try{strike(id,.95)}catch{}
  }
  const changedTW=()=>{if(typeof TW!=='undefined'&&TW.isOpen&&TW.refresh)TW.refresh()};
  return {open:openFor,get isOpen(){return open},edited:k=>!!orig[k],forget:k=>{if(orig[k]){delete orig[k];saveOrig()}},denoise:(y,r,s)=>{const o=x,os=sr;x=y;sr=s||sr;try{return denoise(y,r)}finally{x=o;sr=os}}};
})();
