import os
from playwright.sync_api import sync_playwright
import json
D=os.environ['WORK']+'/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
AUD=open(os.environ['SRC']+'/drums/kit.json').read() if False else None
CHECK="""(()=>{const W=innerWidth,out={over:[],small:[]};
 for(const e of document.querySelectorAll('body *')){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')continue;
  if(r.right>W+2&&cs.position!=='fixed'&&!e.closest('[style*=overflow],.st-lanes,.tl,canvas'))out.over.push((e.id||e.className||e.tagName).toString().slice(0,30)+'@'+Math.round(r.right));
  if(e.matches('button,a,[role=button],input[type=checkbox],select')&&(r.width<32||r.height<32)&&r.top>=0&&r.top<innerHeight)out.small.push(((e.id?'#'+e.id:'')||e.getAttribute('aria-label')||e.textContent.trim().slice(0,14)||e.className).toString().slice(0,26)+' '+Math.round(r.width)+'x'+Math.round(r.height))}
 out.hscroll=document.documentElement.scrollWidth>W+1;out.over=[...new Set(out.over)].slice(0,8);out.small=[...new Set(out.small)].slice(0,14);return out})()"""
def go(vw,vh,tag,fresh):
  errs=[];cons=[]
  with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':vw,'height':vh},has_touch=True,is_mobile=True)
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]));pg.on('console',lambda m:cons.append(m.text[:160]) if m.type=='error' else None)
    if not fresh:pg.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}))")
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(2200);pg.screenshot(path=D+tag+'_0start.png')
    if fresh:
      # what a brand new person sees, then pick producer
      print(tag,'first screen buttons:',pg.evaluate("[...document.querySelectorAll('#roleSheet button')].filter(b=>b.offsetWidth).map(b=>b.textContent.trim().slice(0,30))"))
    for v in ['home','play','cues','studio','part','notes','setup']:
      pg.evaluate("document.querySelectorAll('.sheetov').forEach(s=>s.hidden=true);document.getElementById('gdToast')&&(gdToast.hidden=true)")
      pg.evaluate(f"showView('{v}')");pg.wait_for_timeout(900);pg.screenshot(path=D+f'{tag}_{v}.png')
      print(tag,v,json.dumps(pg.evaluate(CHECK)))
    print(tag,'ERR',errs,cons[:6]);b.close()
go(390,844,'fresh',True)
go(390,844,'p',False);go(844,390,'l',False);go(1180,820,'ipad',False)
