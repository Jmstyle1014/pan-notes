import os,sys
from playwright.sync_api import sync_playwright
# The Vincy Mas look (St. Vincent and the Grenadines): in App look next to Trinidad & Tobago, three backgrounds (the gems,
# the Grenadines, the flag), the pans' skirts and glow follow the background, its choice is kept apart from Trinidad &
# Tobago's, ☀ / 🌙 come back to it, and the T&T look is unchanged.
D=os.environ['WORK']+'/tvincy/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
SK="(()=>{const s=document.querySelectorAll('#vmSkirt stop');return s[1].getAttribute('stop-color')})()"
WANT={'gems':'#007a4a','gren':'#0047ab','flag':'#c79a00'}
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2,has_touch=True);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1200);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.click('[data-r=producer]');pg.wait_for_timeout(300)
    E(pg,"THEME.sheet(true)");pg.wait_for_timeout(300)
    check(pg.locator('#thList [data-th=vm]').count()==1 and 'Vincy Mas' in E(pg,"$('thList').querySelector('[data-th=vm]').textContent"),'Vincy Mas is in App look')
    pg.click('#thList [data-th=vm]');pg.wait_for_timeout(500)
    cl=E(pg,"[...document.documentElement.classList].join(' ')")
    check(all(c in cl for c in ['th-vm','th-tt','th-cnight']),'it is built on the Trinidad & Tobago look ('+cl+')')
    tiles=E(pg,"[...document.querySelectorAll('#ttBgBox [data-bg]')].map(b=>b.dataset.bg)")
    check(tiles==['gems','gren','flag'],f'three backgrounds: the gems, the Grenadines, the flag {tiles}')
    check(E(pg,"$('ttBg').dataset.bg")=='gems' and E(pg,SK)==WANT['gems'],'the gems come first, with green skirts')
    pg.screenshot(path=D+'1-sheet.png')
    for k in ['gems','gren','flag']:
        E(pg,"THEME.sheet(true)");pg.wait_for_timeout(200);pg.click(f'#ttBgBox [data-bg={k}]');pg.wait_for_timeout(300)
        g=E(pg,"getComputedStyle(document.documentElement).getPropertyValue('--vmg').trim()")
        check(E(pg,"$('ttBg').dataset.bg")==k and E(pg,SK)==WANT[k],f'{k}: the background shows and the skirts match ({E(pg,SK)}, glow {g})')
        E(pg,"THEME.sheet(false);showView('play')");pg.wait_for_timeout(600)
        st=E(pg,"(()=>{const f=document.querySelector('#playPans .field:not(:is(.active,.hit,.play-hit))');const sk=document.querySelector('#playPans svg path[fill=\"url(#hgSkirt)\"]');return [getComputedStyle(f.querySelector('.zone')).fill,sk?getComputedStyle(sk).fill:'none',getComputedStyle(document.querySelector('#dock .transport')).borderColor]})()")
        check('vmZone' in st[0] and ('vmSkirt' in st[1] or st[1]=='none') and '255, 58, 79' not in st[2],f'{k}: Vincy pans and play bar, no T&T red {st}')
        E(pg,"document.querySelectorAll('#playPans .field').forEach((f,i)=>{if(i===2||i===3)f.classList.add('hit')})");pg.wait_for_timeout(250)
        pg.screenshot(path=D+f'2-play-{k}.png')
        E(pg,"document.querySelectorAll('#playPans .field.hit').forEach(f=>f.classList.remove('hit'))");E(pg,"showView('home')");pg.wait_for_timeout(300);pg.screenshot(path=D+f'3-home-{k}.png')
    # kept after reopening; T&T keeps its own background
    pg.reload();pg.wait_for_timeout(1800)
    check(E(pg,"THEME.look()")=='vm' and E(pg,"$('ttBg').dataset.bg")=='flag' and E(pg,SK)==WANT['flag'],'after reopening the app: still Vincy Mas, the flag and gold skirts')
    E(pg,"THEME.setLook('tt')");pg.wait_for_timeout(400)
    check(E(pg,"$('ttBg').dataset.bg")=='silk' and not E(pg,"document.documentElement.classList.contains('th-vm')"),'Trinidad & Tobago still has its own background (silk flag)')
    st=E(pg,"getComputedStyle(document.querySelector('#playPans .field .zone')||document.body).fill")
    E(pg,"THEME.setLook('vm')");pg.wait_for_timeout(400)
    # ☀ and 🌙
    E(pg,"DAY.set(true)");check(E(pg,"THEME.look()")=='cday' and E(pg,"$('ttBg').hidden"),'☀ goes to Chrome Day')
    E(pg,"DAY.set(false)");check(E(pg,"THEME.look()")=='vm','🌙 comes back to Vincy Mas')
    E(pg,"THEME.setLook('tt');DAY.set(true);DAY.set(false)");check(E(pg,"THEME.look()")=='tt','and from Trinidad & Tobago it still comes back to Trinidad & Tobago')
    E(pg,"localStorage.setItem('panyard-ttday','1');THEME.setLook('cday');DAY.set(false)");check(E(pg,"THEME.look()")=='tt','an older phone that went to day from Trinidad & Tobago comes back to it')
    E(pg,"THEME.setLook('vm');showView('setup')");pg.wait_for_timeout(400)
    row=E(pg,"$('setList').querySelector('[data-row=look]').textContent")
    check('Vincy Mas' in row and 'Background' in row,'Settings shows App look: Vincy Mas, and its background '+row)
    E(pg,"THEME.setLook('night')");check(E(pg,"$('ttBg').hidden&&!document.documentElement.classList.contains('th-vm')"),'another look has no Vincy background')
    check(not errs,'no errors '+str(errs[:3]))
    ctx.close();b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
