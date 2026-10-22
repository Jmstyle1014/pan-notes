import os
import base64,os,wave,numpy as np,io
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/'
KD=os.environ['SRC']+'/drums/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
def serve(r):
    u=r.request.url.split('pan.test/',1)[1].split('?')[0]
    if u.startswith('drums/'):
        f=KD+u[6:]
        if os.path.exists(f):return r.fulfill(path=f)
        return r.fulfill(status=404,body='')
    r.fulfill(body=html,content_type='text/html')
E=lambda pg,js,*a:pg.evaluate(js,*a)
STY=['engine','soca','roadmarch','calypso','kaiso','chutney','bouyon','dancehall','reggae','zouk']
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);errs=[]
    pg=b.new_page(viewport={'width':844,'height':390});pg.on('pageerror',lambda e:errs.append(str(e)+' @ '+str(e.stack)[:300]))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}")
    pg.route('https://pan.test/**',serve);pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1000);E(pg,"(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(500)
    E(pg,"window._f=[];downloads={save:async o=>{const r=new FileReader();r.onload=()=>window._f.push([o.filename,r.result]);r.readAsDataURL(o.data instanceof Blob?o.data:new Blob([o.data]))}};renderShare()")
    E(pg,"showView('studio')");pg.wait_for_timeout(1300)
    if E(pg,"document.body.classList.contains('st-inst')"):pg.click('#gbView [data-v=tracks]');pg.wait_for_timeout(400)
    pg.click('[data-st=addsheet]');pg.wait_for_timeout(300);pg.click('[data-st=addk][data-v=beats]');pg.wait_for_timeout(2500)
    print('kit loaded',E(pg,"STUDIO.kit()"))
    def setstyle(k):E(pg,"k=>{const s=document.querySelector('#stStyle');s.value=k;s.dispatchEvent(new Event('change',{bubbles:true}))}",k);pg.wait_for_timeout(300)
    def export():
        E(pg,"window._f=[]");E(pg,"STUDIO.exportSheet()");pg.wait_for_timeout(300);pg.click('#stExFmt button[data-v=wav]');pg.click('[data-st=expgo]')
        for i in range(60):
            pg.wait_for_timeout(400)
            if E(pg,"window._f.length"):break
        d=E(pg,"window._f[0][1]");pg.click('#stSheetBox [data-st=close]') if E(pg,"!$('stSheet').hidden") else None
        w=wave.open(io.BytesIO(base64.b64decode(d.split(',',1)[1])));sr=w.getframerate();a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).reshape(-1,w.getnchannels()).astype(float)/32768
        return a,sr
    E(pg,"STUDIO.song.tracks.filter(t=>t.type!=='beats').forEach(t=>t.mute=true)")
    pg.screenshot(path=D+'kit-seq.png')
    setstyle('soca');E(pg,"STUDIO.setTempo(140);STUDIO.song.minBars=2")
    a,sr=export();rms=lambda a:20*np.log10(np.sqrt((a**2).mean())+1e-9)
    c=a
    print('soca real %.1f dB peak %.2f | classic %.1f dB peak %.2f'%(rms(a),abs(a).max(),rms(c),abs(c).max()))
    pass
    out=[]
    for k in STY:
        setstyle(k);bpm=E(pg,"k=>STUDIO&&0",k);E(pg,"k=>{STUDIO.setTempo({engine:132,soca:140,roadmarch:128,calypso:112,kaiso:108,chutney:148,bouyon:160,dancehall:96,reggae:74,zouk:118}[k]);STUDIO.song.minBars=4}",k)
        x,sr=export();n=int(sr*4*4*60/E(pg,"STUDIO.bpm"));x=x[:n]
        out.append(x);out.append(np.zeros((int(sr*.7),x.shape[1])));print(k,'%.1f dB'%rms(x),'peak %.2f'%abs(x).max())
    y=np.concatenate(out);y=y/max(1,abs(y).max()/.95)
    w=wave.open(D+'Panyard beats - real kit.wav','wb');w.setnchannels(y.shape[1]);w.setsampwidth(2);w.setframerate(sr);w.writeframes((y*32767).astype(np.int16).tobytes());w.close()
    print('errors',errs);b.close()
