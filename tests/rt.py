import os
import base64,json,time
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/rt/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
log=[]
def note(s):print(s);log.append(s)
NN={'C':0,'C#':1,'D':2,'Eb':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'Bb':10,'B':11}
def midi(n):return 12*(int(n[-1])+1)+NN[n[:-1]]
CH=[('C',['E3','G3','C4'],['C2','G2','C2','E2']),('C',['E3','G3','C4'],['C2','G2','C3','B2']),('Am',['E3','A3','C4'],['A2','E2','A2','C3']),('Am',['E3','A3','C4'],['A2','E2','G2','E2']),
    ('F',['F3','A3','C4'],['F2','C3','F2','A2']),('F',['F3','A3','C4'],['F2','C3','A2','F2']),('G',['D4','G3','B3'],['G2','D3','G2','B2']),('G',['D4','G3','B3'],['G2','D3','B2','D3'])]
MEL=[[('E5',0),('D5',1),('C5',2),('E5',3)],[('G5',0),('E5',2),('D5',3.5)],[('A5',0),('G5',1),('E5',2),('C5',3)],[('A4',0),('C5',2)],
     [('F5',0),('E5',1),('D5',2),('C5',3)],[('A4',0),('C5',1),('D5',2)],[('D5',0),('E5',1),('F5',2),('D5',3)],[('G5',0),('B4',2.5),('C5',3.5)]]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':844,'height':390},device_scale_factor=2,has_touch=False);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1500);pg.add_style_tag(content='#status{visibility:hidden!important}')
    # 1. who's playing, then a new song with its name
    pg.click('[data-r=producer]');pg.wait_for_timeout(300)
    pg.click('#hmNew');pg.wait_for_timeout(300);pg.click('[data-r=npan][data-v=tenor]');pg.fill('#nsName','Sunday Lime');pg.screenshot(path=D+'01-new-song.png');pg.click('[data-r=create]');pg.wait_for_timeout(1200)
    note('New song: '+json.dumps(E(pg,"[S.title,S.panSet]")))
    E(pg,"window._f=[];downloads={save:async o=>{const r=new FileReader();r.onload=()=>window._f.push([o.filename,r.result]);r.readAsDataURL(o.data instanceof Blob?o.data:new Blob([o.data]))}};renderShare()")
    # 2. Studio, tempo 104
    E(pg,"showView('studio')");pg.wait_for_timeout(1500)
    note('Studio opens with: '+json.dumps(E(pg,"STUDIO.song.tracks.map(t=>t.name)")))
    E(pg,"STUDIO.setTempo(104)");E(pg,"STUDIO.song.minBars=8;STUDIO.song.countIn=true;STUDIO.song.metro=true;STUDIO.song.recMode='add'")
    def tracksview():
        if E(pg,"document.body.classList.contains('st-inst')"):pg.click('#gbView');pg.wait_for_timeout(500)
    def add(kind):
        tracksview();pg.click('[data-st=addsheet]');pg.wait_for_timeout(300);pg.click(f'[data-st=addk][data-v={kind}]');pg.wait_for_timeout(600)
    def setpan(k):
        E(pg,"k=>{const s=document.querySelector('[data-st-set]');s.value=k;s.dispatchEvent(new Event('change',{bubbles:true}))}",k);pg.wait_for_timeout(500)
    # 3. a calypso beat
    add('beats');E(pg,"()=>{const s=document.querySelector('#stStyle');s.value='calypso';s.dispatchEvent(new Event('change',{bubbles:true}))}");pg.wait_for_timeout(400)
    pg.screenshot(path=D+'02-beat.png')
    spb=60/104
    def record(k,events,label):
        # events: (beat, [note names]) on that pan; the pans on screen, ● Rec, count-in, then tap along
        E(pg,"STUDIO.seek(0)");
        if not E(pg,"document.body.classList.contains('st-inst')"):pg.click('#gbView');pg.wait_for_timeout(600)
        ids={}
        for _,ns in events:
            for n in ns:
                if n not in ids:ids[n]=E(pg,"([k,m])=>{const id=k==='guitar'?Object.keys(PITCH).find(i=>!i.includes(':')&&midiOf(PITCH[i])===m):k+':'+m;return PITCH[id]?id:null}",[k,midi(n)])
        miss=[n for n,i in ids.items() if not i]
        if miss:note('  missing notes on '+k+': '+str(miss))
        boxes={n:pg.locator(f'#stPans .field[data-field="{i}"]').bounding_box() for n,i in ids.items() if i}
        pg.click('#stRec');pg.wait_for_timeout(int((0.12+4*spb)*1000)-40)   # the count-in bar
        # wait for the count-in to finish
        E(pg,"new Promise(r=>{const go=()=>{if(STUDIO.beatNow()>=0&&panCtx().currentTime>=0&&document.querySelector('#stRec')&&STUDIO.beatNow()>-.001&&panCtx().currentTime>0)r();else requestAnimationFrame(go)};go()})")
        late=[]
        for bt,ns in events:
            E(pg,"b=>new Promise(r=>{const go=()=>{if(STUDIO.beatNow()>=b-0.015&&STUDIO.beatNow()<b+4)r();else requestAnimationFrame(go)};go()})",bt)
            for n in ns:
                bx=boxes.get(n)
                if bx:pg.mouse.click(bx['x']+bx['width']/2,bx['y']+bx['height']/2,delay=40)
        pg.wait_for_timeout(int(spb*2000));pg.click('#stPlay');pg.wait_for_timeout(500)
        nn=E(pg,"STUDIO.song.tracks.find(t=>t.id===STUDIO.song.sel).notes.length")
        note(f'  {label}: tapped {sum(len(n) for _,n in events)} notes, the track has {nn}')
    # 4. six bass
    add('pan');setpan('six');pg.screenshot(path=D+'03-bass-pans.png')
    ev=[]
    for bar,(c,ch,bs) in enumerate(CH):
        for i,n in enumerate(bs):ev.append((bar*4+[0,1.5,2,3][i],[n]))
    record('six',ev,'Six Bass')
    # 5. double guitar strums on the offbeats
    add('pan');setpan('guitar')
    ev=[]
    for bar,(c,ch,bs) in enumerate(CH):
        for k in [0.5,1.5,2.5,3.5]:ev.append((bar*4+k,ch))
    record('guitar',ev,'Double Guitar')
    # 6. the tenor melody
    add('pan');setpan('tenor')
    ev=[(bar*4+bt,[n]) for bar,ms in enumerate(MEL) for n,bt in ms]
    record('tenor',ev,'Low C Tenor')
    pg.screenshot(path=D+'04-tenor-pans.png')
    # 7. tidy up: quantize the strums and the melody, echo on the tenor, a mix
    tidy=E(pg,"""(()=>{const T=STUDIO.song.tracks,g=T.find(t=>t.panSet==='guitar'),te=T.find(t=>t.panSet==='tenor'&&t.type==='pan'),bs=T.find(t=>t.panSet==='six'),bt=T.find(t=>t.type==='beats');
      const off=n=>{const r=n.t*2-Math.round(n.t*2);return Math.abs(r)/2*60/STUDIO.bpm*1000};const err=t=>Math.round(t.notes.reduce((a,n)=>a+off(n),0)/t.notes.length);
      const before={bass:err(bs),guitar:err(g),tenor:err(te)};
      g.q={mode:'straight',div:.5,sw:'light'};te.q={mode:'straight',div:.5,sw:'light'};bs.q={mode:'straight',div:.5,sw:'light'};
      te.fx=Object.assign({treble:2,bass:0,comp:.3,echo:.18,echoT:'de',room:0},te.fx||{},{echo:.18,echoT:'de'});
      g.vol=.55;g.pan=-.35;bs.vol=1;te.vol=.85;te.pan=.15;bt.vol=.6;
      const prac=T.find(t=>t.type==='practice');
      return {before,names:T.map(t=>t.name)}})()""")
    note('How far off the 1/8 grid the taps landed before quantize (average ms): '+json.dumps(tidy['before']))
    note('Tracks: '+', '.join(tidy['names']))
    E(pg,"STUDIO.seek(0)");tracksview();pg.wait_for_timeout(400);pg.screenshot(path=D+'05-tracks.png')
    pg.click('#stPlay');pg.wait_for_timeout(3500);pg.screenshot(path=D+'06-playing-tracks.png');pg.click('#stPlay')
    E(pg,"STUDIO.seek(16)");pg.click('#gbView');pg.wait_for_timeout(500);pg.click('#stPlay');pg.wait_for_timeout(1800);pg.screenshot(path=D+'07-playing-pans.png');pg.click('#stPlay')
    # 8. export the mix, and a backup with every track
    pg.click('#gbMore');pg.wait_for_timeout(200);pg.click('#stExp');pg.wait_for_timeout(300);pg.click('#expStudio');pg.wait_for_timeout(500);pg.click('#stExFmt button[data-v=wav]');pg.click('[data-st=expgo]')
    for i in range(90):
        pg.wait_for_timeout(1000)
        if E(pg,"window._f.length"):break
    for n,d in E(pg,"window._f"):open(D+'Sunday Lime.wav','wb').write(base64.b64decode(d.split(',',1)[1]));note('Exported '+n)
    E(pg,"window._f=[];if(!$('stSheet').hidden)document.querySelector('#stSheetBox [data-st=close]').click();showView('setup');$('expJson').click()");pg.wait_for_timeout(2500)
    for n,d in E(pg,"window._f"):open(D+'Sunday Lime - backup.json','wb').write(base64.b64decode(d.split(',',1)[1]));note('Saved '+n)
    # 9. upright phone too
    pg.set_viewport_size({'width':390,'height':844});E(pg,"showView('studio')");pg.wait_for_timeout(1200);pg.screenshot(path=D+'08-upright.png')
    note('errors: '+str(errs))
    b.close()
open(D+'log.txt','w').write('\n'.join(log))
