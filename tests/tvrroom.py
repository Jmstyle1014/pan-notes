import os,sys,json,io,base64
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
# Panyard VR rooms: a 360° picture round you instead of the plain yard. Built-in rooms come from ../rooms/rooms.json; your
# own pictures are added on the page (kept on the headset), cut to at most 4096 wide; a picture that isn't 2:1 gets a
# warning; the sky, floor and the yard's roof step aside while a picture shows; the menu's Room button switches; the
# choice is kept; removing your picture goes back to the yard.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrroom/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def pano(w,h,c1,c2):   # a stand-in panorama: sky, horizon, floor, and marks round the walls
    im=Image.new('RGB',(w,h),c1);d=ImageDraw.Draw(im);d.rectangle([0,h//2,w,h],fill=c2)
    for i in range(8):x=int(w*i/8);d.rectangle([x+w//32,h//2-h//6,x+w//16,h//2],fill=(240,190,70));d.text((x+w//40,h//2-h//5),'N E S W'.split()[i%4],fill=(255,255,255))
    b=io.BytesIO();im.save(b,'JPEG');return b.getvalue()
BUILT=pano(2048,1024,(40,90,160),(150,110,60));MINE=pano(1000,400,(20,20,40),(90,60,30))
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    if u=='rooms/rooms.json':return r.fulfill(body=json.dumps([{'k':'deck','name':'Sunset deck','file':'deck.jpg'}]),content_type='application/json')
    if u=='rooms/deck.jpg':return r.fulfill(body=BUILT,content_type='image/jpeg')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':720});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    load=lambda:pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0&&VR.room.list().length>1",timeout=90000)
    pg.goto('https://pan.test/vr/');load()
    R=lambda js:pg.evaluate("VR.room."+js)
    check(R("k()")=='yard' and not R("bg()") and R("sky()") and R("list()")==['yard','deck'],'starts in the yard; the built-in room is offered')
    check(pg.locator('#roomSeg button').count()==2,'the page lists the rooms')
    pg.evaluate("hudShow('#roomSeg')");pg.locator('#roomSeg button',has_text='Sunset deck').click();pg.wait_for_function("VR.room.active()",timeout=20000)
    check(R("bg()") and not R("sky()") and not R("shed()") and R("sizes()")==[2048,1024],'a built-in room wraps round you; the sky and the yard\'s roof step aside')
    fl=R("floorAt()");check(fl is not None and abs(fl)<.03,f'grounded: the picture\'s floor lies at the real floor (y {fl}), not at infinity')
    e=pg.evaluate("VR.room.eye(.2)");fl2=R("floorAt()");check(abs(e-1.8)<.01 and abs(fl2)<.03 and pg.evaluate("VR.room.eye(-.2)")==1.6,f'Floor lower / higher changes how far below your eyes the picture\'s floor is ({e} m), the floor staying at your feet')
    pg.evaluate("document.getElementById('hud').hidden=true;VR.camera.position.set(0,1.6,1.5);VR.camera.lookAt(0,1.2,-3)");pg.wait_for_timeout(600);pg.screenshot(path=D+'1-room.png')
    pg.evaluate("document.getElementById('hud').hidden=false")
    # your own picture, not 2:1, wider than the headset can hold is cut down
    url='data:image/jpeg;base64,'+base64.b64encode(MINE).decode()
    w=pg.evaluate(f"VR.room.add('{url}','My yard.jpg')")
    check('not 2:1' in w and R("active()") and R("k()").startswith('my') and R("list()")[-1]==R("k()"),f'adding your own picture shows it, with a warning when it isn\'t 2:1 ("{w}")')
    big=pano(6000,3000,(10,10,10),(80,80,80));w2=pg.evaluate("VR.room.add('data:image/jpeg;base64,"+base64.b64encode(big).decode()+"','Big.jpg')")
    check(w2=='' and R("sizes()")==[4096,2048],f'a big picture is cut to 4096 × 2048 {R("sizes()")}')
    mine=R("k()")
    pg.reload();load()
    check(R("k()")==mine and R("active()") and len(R("list()"))==4,'after reopening, your picture is still there and chosen')
    # the menu switches rooms
    pg.evaluate("VR.act('mroom')");pg.wait_for_timeout(400);check(R("k()")=='yard' and not R("bg()") and R("sky()"),'the menu\'s Room button goes round the rooms (back to the yard)')
    pg.evaluate(f"VR.room.set('{mine}')");pg.wait_for_function("VR.room.active()",timeout=20000);R("remove()");pg.wait_for_timeout(300)
    check(R("k()")=='yard' and len(R("list()"))==3 and R("sky()"),'removing your picture goes back to the yard')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
