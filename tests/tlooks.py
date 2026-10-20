import os
from playwright.sync_api import sync_playwright
from PIL import Image
D=os.environ['WORK']+'/'
import os;os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
errs=[]
E=lambda pg,j:pg.evaluate(j)
with sync_playwright() as p:
  b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
  pg=b.new_page(viewport={'width':390,'height':844});pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
  pg.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
  pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  pg.goto('https://pan.test/');pg.wait_for_timeout(1500)
  st=lambda:E(pg,"[THEME.look(),document.documentElement.className,$('dayBtn')&&$('dayBtn').textContent]")
  print('start',st())
  pg.click('#dayBtn');pg.wait_for_timeout(200);print('sun ->',st())
  pg.click('#dayBtn');pg.wait_for_timeout(200);print('moon ->',st())
  E(pg,"showView('setup')");pg.wait_for_timeout(400);print('setup row',E(pg,"$('setList').querySelector('[data-row=look]').textContent"),'old day row',E(pg,"!!$('setList').querySelector('[data-row=day]')"))
  pg.click('[data-row=look]');pg.wait_for_timeout(300);pg.screenshot(path=D+'sheet_night.png')
  pg.click('[data-th=cday]');pg.wait_for_timeout(300);pg.screenshot(path=D+'sheet_cday.png');print('chose cday',st())
  pg.click('#thClose');E(pg,"showView('home')");pg.wait_for_timeout(300)
  pg.click('#dayBtn');pg.wait_for_timeout(200);print('sun in chrome ->',st())
  pg.click('#dayBtn');pg.wait_for_timeout(200);print('again ->',st())
  pg.reload();pg.wait_for_timeout(1500);print('after reload',st())
  # play: fit + status position + glow
  for th in ['cday','cnight','night']:
    E(pg,f"THEME.setLook('{th}')");E(pg,"showView('play')");pg.wait_for_timeout(800)
    fit=E(pg,"(()=>{const n=document.querySelector('#playStage .now').getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect(),l=$('lanes');return [Math.round(n.bottom),Math.round(d.top),l.offsetHeight]})()")
    E(pg,"say('Showing example cues. Press play to try it.')");pg.wait_for_timeout(400)
    sr=E(pg,"(()=>{const r=$('status').getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom)]})()")
    E(pg,"$('playBtn').click()");pg.wait_for_timeout(2300);pg.screenshot(path=D+f'play_{th}.png');E(pg,"audio.pause();audio.currentTime=0")
    print(th,'now-card bottom / dock top / lanes h',fit,'status',sr)
  # landscape home status
  pg.set_viewport_size({'width':844,'height':390});E(pg,"showView('home')");pg.wait_for_timeout(500);E(pg,"say('Showing example cues. Press play to try it.')");pg.wait_for_timeout(400)
  print('home side status',E(pg,"(()=>{const r=$('status').getBoundingClientRect(),g=$('hmGo').getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom),'play btn',Math.round(g.top)]})()"))
  pg.screenshot(path=D+'home_side.png')
  # sideways play glow
  for th in ['cday','cnight']:
    E(pg,f"THEME.setLook('{th}')");E(pg,"showView('play')");pg.wait_for_timeout(600);E(pg,"$('playBtn').click()");pg.wait_for_timeout(2300);pg.screenshot(path=D+f'side_{th}.png');E(pg,"audio.pause();audio.currentTime=0")
  b.close()
print('errors',errs)
