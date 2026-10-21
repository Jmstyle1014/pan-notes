import os,sys
from playwright.sync_api import sync_playwright
# The Trinidad & Tobago look: chrome pans on red, its backgrounds, adding and removing your own picture.
D=os.environ['WORK']+'/ttt/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
# a picture to add: a red-to-black gradient made here
MKPIC="""async()=>{const c=document.createElement('canvas');c.width=600;c.height=1300;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,1300);gr.addColorStop(0,'#ff7a00');gr.addColorStop(1,'#200008');g.fillStyle=gr;g.fillRect(0,0,600,1300);
  const b=await new Promise(r=>c.toBlob(r,'image/png'));const a=new Uint8Array(await b.arrayBuffer());let s='';for(const x of a)s+=String.fromCharCode(x);return btoa(s)}"""
with sync_playwright() as p:
    b=p.chromium.launch()
    for W,H,name in [(390,844,'phone'),(820,1180,'ipad')]:
        ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2 if W<800 else 1,has_touch=W<800);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept())
        pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1200);pg.add_style_tag(content='#status{visibility:hidden!important}')
        pg.click('[data-r=producer]');pg.wait_for_timeout(300)
        # choose it in App look
        E(pg,"THEME.sheet(true)");pg.wait_for_timeout(300)
        check(pg.locator('#thList [data-th=tt]').count()==1,name+': Trinidad & Tobago is in App look')
        check(E(pg,"$('ttBgBox').hidden"),name+': no background choice for the other looks')
        pg.click('#thList [data-th=tt]');pg.wait_for_timeout(400)
        cl=E(pg,"[...document.documentElement.classList].join(' ')");check('th-tt' in cl and 'th-cnight' in cl,name+': it is Chrome Night with the Trinidad touches ('+cl+')')
        check(not E(pg,"$('ttBgBox').hidden")and E(pg,"document.querySelectorAll('#ttBgBox [data-bg]').length")==8,name+': 8 built-in backgrounds to choose from (3 pictures, 5 drawn)')
        check(E(pg,"!$('ttBg').hidden&&$('ttBg').dataset.bg")=='silk',name+': the silk flag is the first background')
        pg.screenshot(path=D+name+'-1-sheet.png')
        pg.click('#ttBgBox [data-bg=islands]');pg.wait_for_timeout(300);check(E(pg,"$('ttBg').dataset.bg")=='islands',name+': picking Islands shows it')
        # your own picture
        import base64,tempfile
        f=tempfile.NamedTemporaryFile(suffix='.png',delete=False);f.write(base64.b64decode(E(pg,MKPIC)));f.close()
        pg.set_input_files('#ttPic',f.name);pg.wait_for_timeout(1500)
        check(E(pg,"$('ttBg').dataset.bg")=='pic' and 'blob:' in E(pg,"$('ttBg').style.background"),name+': an added picture becomes the background')
        check(E(pg,"document.querySelectorAll('#ttBgBox .tt-own').length")==1,name+': and has its own tile')
        sz=E(pg,"async()=>{const x=await idbGet('bgPics');const v=Object.values(x)[0];const bm=await createImageBitmap(v.b);return [v.b.type,bm.width,bm.height]}")
        check(sz[0]=='image/jpeg' and max(sz[1],sz[2])<=2000,name+f': kept as a phone-sized JPEG {sz}')
        E(pg,"()=>{const s=$('ttDim');s.value=45;s.dispatchEvent(new Event('input',{bubbles:true}))}");check(E(pg,"$('ttBg').style.getPropertyValue('--ttdim')")=='0.45',name+': Dim the background works')
        pg.screenshot(path=D+name+'-2-own.png')
        # after reopening the app it's all still there
        pg.reload();pg.wait_for_timeout(1800)
        check(E(pg,"document.documentElement.classList.contains('th-tt')&&$('ttBg').dataset.bg")=='pic',name+': still your picture after reopening the app')
        E(pg,"showView('play')");pg.wait_for_timeout(600);pg.screenshot(path=D+name+'-3-play.png')
        # delete it: back to the flag
        E(pg,"THEME.sheet(true)");pg.wait_for_timeout(400);pg.click('#ttBgBox [data-del]');pg.wait_for_timeout(600)
        check(E(pg,"$('ttBg').dataset.bg")=='silk' and E(pg,"document.querySelectorAll('#ttBgBox .tt-own').length")==0,name+': deleting the picture goes back to the silk flag')
        # the pans are chrome with letters you can read
        E(pg,"THEME.sheet(false);showView('play')");pg.wait_for_timeout(500)
        st=E(pg,"()=>{const f=document.querySelector('#playPans .field:not(:is(.active,.hit,.play-hit))');const z=f.querySelector('.zone'),t=f.querySelector('text');return [getComputedStyle(z).fill,getComputedStyle(t).fill,!!document.querySelector('#playPans .ttgl')]}")
        check('ttZone' in st[0] and st[1]=='rgb(20, 20, 24)' and st[2],name+f': chrome notes, dark letters, a reflection on the bowl {st}')
        # sun button: day, and back to Trinidad at night
        E(pg,"DAY.set(true)");check(E(pg,"THEME.look()")=='cday' and E(pg,"$('ttBg').hidden"),name+': ☀ goes to Chrome Day (no background)')
        E(pg,"DAY.set(false)");check(E(pg,"THEME.look()")=='tt' and not E(pg,"$('ttBg').hidden"),name+': 🌙 comes back to Trinidad & Tobago')
        E(pg,"THEME.setLook('night')");check(E(pg,"$('ttBg').hidden&&!document.documentElement.classList.contains('th-cnight')"),name+': another look has no background')
        check(not errs,name+': no errors '+str(errs[:3]))
        ctx.close()
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
