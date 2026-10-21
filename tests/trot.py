import os,sys,base64
from playwright.sync_api import sync_playwright
# Write: turning the phone sideways and back upright keeps the timeline (it once came back empty)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
wav=base64.b64encode(open('beat118.wav','rb').read()).decode()
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
TL="(()=>{const p=$('tlPanel'),c=p.querySelector('canvas');return [p.parentNode.id,Math.round(p.getBoundingClientRect().height),c?c.clientWidth:0]})()"
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2,has_touch=True).new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg.goto('https://pan.test/');pg.wait_for_timeout(1200)
    pg.evaluate("""w=>{const raw=atob(w),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);isDemo=false;S.cues=[];loadAudio(new Blob([u],{type:'audio/wav'}),'Beat');renderAll()}""",wav)
    pg.wait_for_timeout(500);pg.evaluate("showView('cues')");pg.wait_for_timeout(800)
    a=pg.evaluate(TL);check(a[0]=='wbTL' and a[1]>100,f'upright: the timeline is on the board {a}')
    for i in range(2):
        pg.set_viewport_size({'width':892,'height':412});pg.wait_for_timeout(800)
        pg.set_viewport_size({'width':412,'height':892});pg.wait_for_timeout(800)
        a=pg.evaluate(TL);check(a[0]=='wbTL' and a[1]>100 and a[2]>300,f'turned sideways and back ({i+1}): the timeline is back {a}')
    pg.screenshot(path=os.environ['WORK']+'/trot.png');check(not errs,f'no errors {errs[:2]}')
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
