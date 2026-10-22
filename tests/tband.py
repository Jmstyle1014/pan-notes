import os,sys,json
from playwright.sync_api import sync_playwright
# Band sounds (per song, Pan sounds → Sound) and How you play: dynamics, when a held note rolls, keeping the sound awake.
D=os.environ['WORK']+'/tband/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
MAKE="""([ids,sr])=>{for(let k=0;k<ids.length;k++){const id=ids[k],f=440*Math.pow(2,(midiOf(PITCH[id])-69)/12),n=Math.round(sr*1.6),x=new Float32Array(n);
  for(let i=0;i<n;i++){const t=i/sr,e=Math.exp(-t*2.5)*Math.min(1,t*500);x[i]=e*(.55*Math.sin(2*Math.PI*f*t)+.3*Math.sin(2*Math.PI*2*f*t)+.1*Math.sin(2*Math.PI*3*f*t))}
  storeTake(id,x,sr)}return Object.keys(SAMPLES.wav).length}"""
# every sound the pans make: which notes, how loud, how they're tuned
SPY="""()=>{window.__src=[];const cb=AudioContext.prototype.createBufferSource;AudioContext.prototype.createBufferSource=function(){const s=cb.call(this);const st=s.start.bind(s);s.start=(t,o)=>{window.__src.push({det:s.detune.value,buf:!!s.buffer&&s.buffer.duration>0.5});return st(t,o)};return s};
  window.__g=[];const sp=window.playSample;window.playSample=function(id,v,l){window.__g.push([id,v,!!l]);return sp.apply(this,arguments)}}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W,H,name in [(820,1180,'ipad'),(390,844,'phone')]:
        ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2 if W<800 else 1,has_touch=W<800);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1200);pg.add_style_tag(content='#status{visibility:hidden!important}')
        pg.click('[data-r=producer]');pg.wait_for_timeout(300);pg.click('#hmNew');pg.wait_for_timeout(300);pg.click('[data-r=npan][data-v=tenor]');pg.fill('#nsName','Band test');pg.click('[data-r=create]');pg.wait_for_timeout(1000)
        ids=E(pg,"()=>SETS.tenor.views.flatMap(v=>v.fields.map(f=>f[0]))")
        E(pg,MAKE,[ids,44100]);E(pg,"async()=>{S.panVoice='mine';await Promise.all(Object.keys(SAMPLES.wav).map(sampleBuf))}");E(pg,SPY)
        # the roll starts sooner now, and follows the setting
        check(E(pg,"HOLD_MS")==170,name+': a held note rolls after 0.17 s (was 0.28)')
        # open Pan sounds → Sound
        E(pg,"TW.open(true)");pg.wait_for_timeout(1500);pg.click('.twtabs [data-tab=sound]');pg.wait_for_timeout(300)
        check(E(pg,"!!$('bandBox')&&!!$('feelBox')&&$('bandBox').compareDocumentPosition(document.querySelector('#twSound .profbox'))&4"),name+': Band sound and How you play come first, the sound profile after')
        n=E(pg,"document.querySelectorAll('#bandBox .bcard').length");check(n==8,name+f': As recorded and 7 band sounds (Our yard too) ({n})')
        check(E(pg,"BAND.forSong()===null&&document.querySelector('#bandBox [data-b=\"\"]').getAttribute('aria-pressed')==='true'"),name+': a song starts As recorded')
        pg.screenshot(path=D+name+'-1-off.png',full_page=False)
        # pick Panorama: A 442 for the song, bright, shimmer, punch, the panyard room
        a0=E(pg,"REF_A()");pg.click('#bandBox [data-b=panorama]');pg.wait_for_timeout(2500)
        st=E(pg,"[REF_A(),BAND.forSong().from,BAND.forSong().room,FX.decay,document.querySelectorAll('#bandBox .sl').length]")
        check(st[0]==442 and st[1]=='panorama' and st[2]=='yard',name+f': Panorama sets the song to A 442 and the panyard room {st}')
        check(st[4]==5,name+': Pitch, Sweet ↔ Sharp, Tone, Ring and Stick sliders')
        E(pg,"$('twSheet').querySelector('.twbox').scrollTop=0");pg.screenshot(path=D+name+'-2-panorama.png',full_page=False)
        E(pg,"$('bandBox').scrollIntoView({block:'start'});document.querySelector('#bandBox .bandctl').scrollIntoView({block:'start'})");pg.wait_for_timeout(200);pg.screenshot(path=D+name+'-3-controls.png',full_page=False)
        # per note: the top notes sharper than the low ones, shimmer adds a second player, tone and ring add on
        hi,lo=E(pg,"()=>{const s=Object.keys(SAMPLES.wav).sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b]));return [s[s.length-1],s[0]]}")
        c=E(pg,"([h,l])=>[BAND.cents(h),BAND.cents(l)]",[hi,lo]);check(c[0]>3 and c[1]<=0,name+f': Sweet ↔ Sharp: top note {c[0]:.1f}¢, lowest {c[1]:.1f}¢')
        E(pg,"window.__src=[]");E(pg,"id=>strike(id,1)",hi);pg.wait_for_timeout(100)
        src=E(pg,"window.__src.filter(x=>x.buf)");check(len(src)==2 and abs(src[1]['det']-src[0]['det']-9)<0.01,name+f': Shimmer plays a second player 9 cents away ({len(src)})')
        T=E(pg,"id=>{const T=BAND.tune(tuneOf(id));return [T.ring,T.tone]}",hi);check(T==[-3,4],name+f': the band\'s Ring and Tone add to the note\'s ({T})')
        # punch and lo-fi are in the tap sound's path
        E(pg,"BAND.edit('lofi',1)");pg.wait_for_timeout(200);check(E(pg,"BAND.forSong().lofi===1"),name+': Lo-fi turns on')
        # while tuning, notes play as recorded
        pg.click('.twtabs [data-tab=tune]');pg.wait_for_timeout(300)
        check(E(pg,"id=>BAND.cents(id)===0&&(BAND.tune(tuneOf(id)).ring||0)===(tuneOf(id).ring||0)",hi),name+': on Record & tune the notes play as recorded')
        pg.click('.twtabs [data-tab=sound]');pg.wait_for_timeout(300)
        # slider: Ring
        E(pg,"()=>{const s=$('band-ring');s.value=6;s.dispatchEvent(new Event('input',{bubbles:true}))}");check(E(pg,"BAND.forSong().ring")==6 and E(pg,"$('bando-ring').textContent")=='+6',name+': the Ring slider shapes this song')
        # save as my own, then back to As recorded: A goes back
        pg.click('#bandOwn');pg.wait_for_timeout(300);check(E(pg,"document.querySelectorAll('#bandBox .bcard').length")==9,name+': Save as my own adds a card')
        pg.click('#bandBox [data-b=""]');pg.wait_for_timeout(300)
        check(E(pg,"BAND.forSong()===null")and E(pg,"REF_A()")==a0,name+f': As recorded takes it off and puts A back ({E(pg,"REF_A()")})')
        # it's per song: another song has none, coming back brings it
        pg.click('#bandBox [data-b=classical]');pg.wait_for_timeout(500)
        sid=E(pg,"songNow().id");E(pg,"TW.open(false)");E(pg,"SONGS.list.unshift({id:'sbandtest',title:'New song',n:0,rec:false,updated:Date.now(),done:{}});songOpen('sbandtest',true)");pg.wait_for_timeout(1200)
        check(E(pg,"BAND.forSong()===null"),name+': a new song starts with no band sound')
        E(pg,"id=>songOpen(id)",sid);pg.wait_for_timeout(1200);check(E(pg,"(BAND.forSong()||{}).from")=='classical',name+': its own song keeps Classical')
        check(E(pg,"FX.decay")==E(pg,"SPACES.hall.decay"),name+': with the hall room')
        # a band recording: pitch follows it
        E(pg,"hasAudio=true");E(pg,"TW.open(true)");pg.wait_for_timeout(800);pg.click('.twtabs [data-tab=sound]');pg.wait_for_timeout(300)
        check(E(pg,"!!document.querySelector('#bandBox .bandrec')&&!$('band-a')"),name+': with a band recording, the pitch follows it');E(pg,"hasAudio=false")
        # How you play: dynamics
        E(pg,"TW.open(true)");pg.wait_for_timeout(500);pg.click('.twtabs [data-tab=sound]');E(pg,"$('feelBox').scrollIntoView()");pg.wait_for_timeout(200);pg.screenshot(path=D+name+'-4-feel.png',full_page=False)
        E(pg,"TW.open(false)");E(pg,"showView('play')");pg.wait_for_timeout(800)
        fid=E(pg,"()=>{const f=[...document.querySelectorAll('#playPans .field')].find(f=>{const r=f.getBoundingClientRect();return r.width>20&&r.top>0&&r.bottom<innerHeight});return f?f.dataset.field:null}")
        if fid:
            hitAt="([id,fx,fy])=>{const f=document.querySelector('#playPans .field[data-field=\"'+id+'\"]');const r=f.getBoundingClientRect();window.__g=[];const o={bubbles:true,clientX:r.left+r.width*fx,clientY:r.top+r.height*fy,pointerId:7};f.dispatchEvent(new PointerEvent('pointerdown',o));window.dispatchEvent(new PointerEvent('pointerup',o));return window.__g.map(x=>x[1])}"
            mid=E(pg,hitAt,[fid,.5,.5]);edge=E(pg,hitAt,[fid,.5,.04])
            check(mid and edge and mid[0]>0.95 and edge[0]<0.75,name+f': the middle of a note is a full hit ({mid}), the edge softer ({edge})')
            E(pg,"FEEL.set('sens',0)");same=E(pg,hitAt,[fid,.5,.04]);check(same and same[0]==1,name+f': Dynamics off: every hit the same ({same})');E(pg,"FEEL.set('sens',5)")
            # hold: the roll starts after the set time and keeps the hit's strength
            E(pg,"FEEL.set('roll',120)")
            E(pg,"([id])=>{const f=document.querySelector('#playPans .field[data-field=\"'+id+'\"]');const r=f.getBoundingClientRect();window.__g=[];window.__t0=performance.now();f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+r.width*.5,clientY:r.top+r.height*.1,pointerId:9}))}",[fid])
            pg.wait_for_timeout(400);E(pg,"window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:9}))")
            g=E(pg,"window.__g");rolls=[x for x in g if x[2]]
            check(len(rolls)>=3 and all(x[1]<g[0][1] for x in rolls),name+f': holding rolls sooner ({len(rolls)} roll strikes in 0.4 s), softer than the first hit')
            E(pg,"FEEL.set('roll',170)")
        else:check(False,name+': found a pan note on Play')
        # keep the sound awake
        check(E(pg,"FEEL.awake"),name+': the sound is kept awake while the app is open')
        check(E(pg,"CLOUD.SKIP.test('panyard-feel')&&!CLOUD.SKIP.test('panyard-band')"),name+': How you play stays on this phone; band sounds are backed up')
        # backup file carries it
        bx=E(pg,"async()=>(await backupExtra()).band");check(bx and bx['from']=='classical',name+': the backup file has this song\'s band sound')
        check(not errs,name+': no errors '+str(errs[:3]))
        ctx.close()
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
