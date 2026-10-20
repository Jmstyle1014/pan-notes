import os
from playwright.sync_api import sync_playwright
import sys
D=os.environ['WORK']+'/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
errs=[]
def run(vw,vh,tag):
  with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':vw,'height':vh})
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))")
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(2500)
    print(tag,'toast:',pg.evaluate("(()=>{const t=document.getElementById('gdToast');return t&&!t.hidden?t.textContent:null})()"))
    pg.screenshot(path=D+f'g_{tag}_home.png')
    pg.click('#hmGuide');pg.wait_for_timeout(400);pg.screenshot(path=D+f'g_{tag}_sheet.png')
    pg.fill('#gdQ','add track');pg.wait_for_timeout(200);print('search add track:',pg.evaluate("[...document.querySelectorAll('#gdList b,#gdList .gd-tp')].map(e=>e.textContent).join(' | ')"))
    pg.fill('#gdQ','recording');pg.wait_for_timeout(200);pg.screenshot(path=D+f'g_{tag}_search.png')
    pg.click('#gdSClose')
    for t in pg.evaluate("GUIDE.TOURS.map(t=>t.id)"):
      pg.evaluate(f"GUIDE.start('{t}')");pg.wait_for_timeout(700)
      n=pg.evaluate("GUIDE.run.T.steps.length");res=[]
      for i in range(n):
        if not pg.evaluate("!!GUIDE.run"):res.append('ENDED');break
        pg.wait_for_timeout(500)
        st=pg.evaluate("(()=>{const r=GUIDE.run;if(!r)return 'ended';return r.i+':'+(GUIDE.cur?'ok':'MISSING')+':'+document.getElementById('gdT').textContent})()")
        res.append(st)
        if i in (0,1) or 'MISSING' in st:pg.screenshot(path=D+f'g_{tag}_{t}_{i}.png')
        if pg.evaluate("!!GUIDE.run"):pg.click('#gdNext')
      pg.wait_for_timeout(300);pg.evaluate("GUIDE.stop()")
      print(t,res)
    # tap-advance test: studio pan tour, really tap + Track
    pg.evaluate("GUIDE.start('pan')");pg.wait_for_timeout(900)
    pg.locator('[data-st=addsheet]').first.click(force=True);pg.wait_for_timeout(1000)
    print('after tap +Track ->',pg.evaluate("GUIDE.run&&GUIDE.run.i"),pg.evaluate("GUIDE.cur&&GUIDE.cur.className"))
    pg.screenshot(path=D+f'g_{tag}_pan_pick.png')
    pg.locator('.st-addp button').first.click(force=True);pg.wait_for_timeout(1000)
    print('after pick pan ->',pg.evaluate("GUIDE.run&&GUIDE.run.i"));pg.screenshot(path=D+f'g_{tag}_pan_rec.png')
    pg.evaluate("GUIDE.stop()")
    pg.evaluate("showView('setup')");pg.wait_for_timeout(500);print('setup row:',pg.evaluate("!!document.querySelector('[data-row=guide]')"))
    b.close()
run(390,844,'p');run(844,390,'l')
print('errors',errs)
