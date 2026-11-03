import os,sys,json,math
from playwright.sync_api import sync_playwright
# Panyard VR's four cello sound: the band's recordings from middle C up were mostly the note an octave below, so it sounded
# like a bass. Cleaned (the default) plays the nearest recording at its own pitch, retuned, with nothing under the note;
# From guitar plays the nearest double guitar recording, retuned; As recorded is the old way. A switch on the page and in
# the menu, remembered.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrfcello/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
song={'bpm':60,'L':4,'loop':{'on':False,'s':0,'e':1},'sel':0,'click':False,'title':'C','tracks':[{'id':'a','name':'Four Cello','set':'fcello','vol':1,'pan':0,'mute':False,'solo':False,'col':'#f6ba45','notes':[{'id':'fcello:48','v':.8,'b':0}]}]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':720});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');localStorage.setItem('panyard-vr-yard','0');localStorage.setItem('panyard-vr-song',"+json.dumps(json.dumps(song))+");sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    load=lambda:pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=90000)
    pg.goto('https://pan.test/vr/');load();pg.evaluate("VR.fcello.load()");pg.wait_for_timeout(500)
    check(pg.evaluate("VR.fcello.mode()")=='clean','Cleaned is the four cello\'s sound to start with')
    src=lambda i:pg.evaluate(f"VR.fcello.src('{i}')")
    check(src('fcello:40')=={'id':'fcello:40','shift':0},f'a note recorded at its own pitch plays itself {src("fcello:40")}')
    check(src('fcello:48')=={'id':'fcello:47','shift':100},f'middle C (recorded an octave low) plays the B below it, raised a semitone {src("fcello:48")}')
    check(src('fcello:55')['id'] in ('fcello:57','fcello:52') and abs(src('fcello:55')['shift'])<=300,f'G (recorded an octave high) plays a good neighbour {src("fcello:55")}')
    # how much is under middle C: the rendered note's energy an octave below against the note itself
    def under():
        pg.evaluate("VR.render()");pg.wait_for_function("VR.lastBuf",timeout=30000)
        r=pg.evaluate("""(()=>{const x=VR.lastBuf.getChannelData(0),sr=VR.lastBuf.sampleRate;let a=0;for(let i=0;i<x.length;i++)if(Math.abs(x[i])>Math.abs(x[a]))a=i;
          const g=f=>{const n=Math.round(.8*sr),w=2*Math.cos(2*Math.PI*f/sr);let s1=0,s2=0;for(let i=0;i<n;i++){const s0=(x[a+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/(n-1)))+w*s1-s2;s2=s1;s1=s0}return s1*s1+s2*s2-w*s1*s2};
          let lo=0,hi=0;for(let k=-3;k<=3;k++){lo=Math.max(lo,g(130.81*(1+k*.004)));hi=Math.max(hi,g(261.63*(1+k*.004)))}return 10*Math.log10((lo+1e-12)/(hi+1e-12))})()""");pg.evaluate("VR.lastBuf=null");return r
    pg.evaluate("VR.fcello.set('raw')");raw=under()
    pg.evaluate("VR.fcello.set('clean')");cl=under()
    check(raw>-6,f'as recorded, middle C has nearly as much (or more) an octave below as at C ({raw:.1f} dB)')
    check(cl<-20,f'cleaned, the octave below is gone ({cl:.1f} dB under the note)')
    pg.evaluate("VR.fcello.set('guitar')");g=src('fcello:48');gu=under()
    check(g=={'id':'c','shift':0},f'From guitar: middle C plays the guitar\'s C {g}');check(gu<-15,f'and it sits at its pitch ({gu:.1f} dB below)')
    lo=src('fcello:34');check(lo['id']=='cs-low' and lo['shift']==-300,f'the lowest B flat uses the guitar\'s low C sharp, lowered {lo}')
    pg.reload();load();check(pg.evaluate("VR.fcello.mode()")=='guitar','the choice is remembered')
    pg.evaluate("document.querySelector('#fcSeg [data-fc=clean]').click()");check(pg.evaluate("VR.fcello.mode()")=='clean','the page\'s switch changes it')
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
