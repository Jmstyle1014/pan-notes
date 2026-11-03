import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR: the sticks feel heavier. Stick weight Light / Real (default) / Heavy: a full-strength hit needs a fuller swing,
# the stick's tip trails the hand on fast moves (drawn only), and each hit buzzes the controller: a thump and two fading taps
# like the rubber bouncing, stronger for harder hits and longer for heavier sticks. Soft hits sound soft (Panyard's measured
# octave / third / sparkle drop), not just darker.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrfeel/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
song={'bpm':60,'L':8,'loop':{'on':False,'s':0,'e':1},'sel':0,'click':False,'title':'S','tracks':[{'id':'a','name':'Tenor','set':'tenor','vol':1,'pan':0,'mute':False,'solo':False,'col':'#f6ba45','notes':[{'id':'tenor:72','v':.2,'b':0}]}]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':720});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');localStorage.setItem('panyard-vr-yard','0');localStorage.setItem('panyard-vr-song',"+json.dumps(json.dumps(song))+");sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    load=lambda:pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=90000)
    pg.goto('https://pan.test/vr/');load()
    check(pg.evaluate("VR.weight.get()")=='real','Real is the stick weight to start with')
    def hit(speed,kind='tenor',nid='tenor:72'):
        pg.evaluate(f"VR.set('{kind}')");pg.evaluate(f"VR.swing('{nid}',{speed})");h=pg.evaluate("VR.hits.slice(-1)[0]");z=pg.evaluate("VR.buzzes.slice(-1)[0]");return h['v'],z
    v={}
    for w in ['light','real','heavy']:
        pg.evaluate(f"VR.weight.set('{w}')");v[w]=hit(3.0)[0]
    check(v['light']>v['real']>v['heavy'],f'the same swing is a little softer with heavier sticks: light {v["light"]}, real {v["real"]}, heavy {v["heavy"]}')
    pg.evaluate("VR.weight.set('real')")
    _,zs=hit(1.0);_,zh=hit(3.5)
    check(zh['a']>zs['a'],f'a harder hit buzzes harder ({zs["a"]} → {zh["a"]})')
    _,zb=hit(3.0,'six','six:40');_,zt=hit(3.0)
    check(zb['ms']>zt['ms'],f'a bass stick\'s thump lasts longer than a tenor stick\'s ({zt["ms"]} vs {zb["ms"]} ms)')
    lag={}
    for w in ['light','real','heavy']:
        pg.evaluate(f"VR.weight.set('{w}')");lag[w]=pg.evaluate("VR.weight.swingLag(0,0,-3)")
    check(lag['light']['x']==0 and 0<lag['real']['x']<lag['heavy']['x']<=.12,f'swinging down, the tip trails behind: light {lag["light"]}, real {lag["real"]}, heavy {lag["heavy"]}')
    s=pg.evaluate("VR.weight.swingLag(0,3,0)");check(s['y']>0,f'and sideways too {s}')
    pg.evaluate("VR.weight.set('real')")
    check(pg.evaluate("[VR.soft('top',.15),VR.soft('oct',.43),VR.soft('top',1)]")==[-22,-6,0],'soft hits use Panyard\'s measured drop')
    # render a soft and a firm C: the soft one has much less octave against its note
    def octave(vel):
        pg.evaluate(f"(()=>{{const s=JSON.parse(localStorage.getItem('panyard-vr-song'));return s}})()")
        pg.evaluate(f"VR.lastBuf=null;VR.songSet&&VR.songSet()");r=pg.evaluate(f"""(async()=>{{const sg=VR.song();sg.tracks[0].notes[0].v={vel};await VR.render();const x=VR.lastBuf.getChannelData(0),sr=VR.lastBuf.sampleRate;let a=0;for(let i=0;i<x.length;i++)if(Math.abs(x[i])>Math.abs(x[a]))a=i;
          const g=f=>{{let best=0;for(let k=-3;k<=3;k++){{const ff=f*(1+k*.004),n=Math.round(.5*sr),w=2*Math.cos(2*Math.PI*ff/sr);let s1=0,s2=0;for(let i=0;i<n;i++){{const s0=(x[a+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/(n-1)))+w*s1-s2;s2=s1;s1=s0}}best=Math.max(best,s1*s1+s2*s2-w*s1*s2)}}return best}};
          const f=523.25*Math.pow(2,0);return 10*Math.log10(g(f*2)/g(f))}})()""");return r
    so,fi=octave(.2),octave(1)
    check(fi-so>6,f'a soft hit has much less octave than a firm one ({so:.1f} vs {fi:.1f} dB against the note)')
    pg.evaluate("document.querySelector('#wtSeg [data-wt=heavy]').click()");pg.reload();load()
    check(pg.evaluate("VR.weight.get()")=='heavy','the page\'s switch sets it, and it\'s remembered')
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
