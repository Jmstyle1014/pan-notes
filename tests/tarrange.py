import os,sys
from playwright.sync_api import sync_playwright
# Bigger pans: a slimmer note strip sideways, the four cello's and six bass's top pair touching, skirts by pan type
# (tenor shortest, bass a full oil drum), the notebook tabs off the sideways stage, and Arrange pans (move, size,
# skirt, reset) that Play, Studio and Write follow, with every note still tapping to itself.
D=os.environ['WORK']+'/tarrange/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
TAPS="""sel=>{let ok=0,n=0;for(const f of document.querySelectorAll(sel+' .field')){const t=f.querySelector('text');if(!t)continue;const r=t.getBoundingClientRect();if(!r.width||r.bottom>innerHeight-70||r.top<0)continue;n++;const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(e&&e.closest('.field')===f)ok++}return [ok,n]}"""
DRUMS="""sel=>[...document.querySelectorAll(sel+' g[data-drum]')].sort((a,b)=>a.dataset.drum-b.dataset.drum).map(g=>{const r=g.querySelector('.rim').getBoundingClientRect();return[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})"""
CUES="""()=>{const ids=[...document.querySelectorAll('#editPans .field')].map(e=>e.dataset.field);S.cues=[];for(let i=0;i<14;i++)S.cues.push({id:uid(),start:0.4+i*0.35,duration:0.3,steps:[ids[(i*7)%ids.length]],mode:'together',note:''});normalizeChords();renderAll();save()}"""
def page(b,W,H):
    pg=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2,has_touch=True).new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}));if(!localStorage.getItem('panyard-theme'))localStorage.setItem('panyard-theme','cnight')")
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}');pg.errs=errs
    return pg
def studio(pg,k):
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(300);pg.evaluate("showView('studio')");pg.wait_for_timeout(1000)
    pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(300);pg.click(f'[data-st=addk][data-v=pan][data-set={k}]');pg.wait_for_timeout(900)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    # sideways Play, double guitar: big pans, slim strip, no notebook tabs over Practice / Game
    pg=page(b,892,412);pg.evaluate("()=>{isDemo=false;S.panSet='guitar';applyPanSet();renderAll()}");pg.evaluate("showView('cues')");pg.wait_for_timeout(300);pg.evaluate(CUES)
    pg.evaluate("showView('play')");pg.wait_for_timeout(600);pg.evaluate("audio.currentTime=1.2;try{tick();drawLanes(1.2)}catch(e){}")
    d=pg.evaluate(DRUMS,'#playPans');geo=pg.evaluate("$('lanes')._geo.lanes.map(l=>Math.round(l.w))")
    check(len(d)==2 and d[0][2]>=320,f'sideways guitar pans are big ({d})');check(sum(geo)<=100,f'the note strip is slim ({geo})')
    check(pg.evaluate("!$('nbPlay')||getComputedStyle($('nbPlay')).display==='none'"),'no notebook tabs on the sideways stage')
    t=pg.evaluate(TAPS,'#playPans');check(t[1]>10 and t[0]==t[1],f'every guitar note taps to itself {t}')
    pg.screenshot(path=D+'1-play-guitar.png')
    sk=pg.evaluate("['tenor','dsec','guitar','fcello','six'].map(k=>STAGE.skf(k))");check(sk==sorted(sk) and sk[-1]==1,f'skirts: tenor shortest, bass a full drum {sk}')
    # Arrange pans from Settings: drag the left pan, make it bigger, longer skirts, then Play follows
    pg.evaluate("showView('setup')");pg.wait_for_timeout(300);pg.evaluate("SETUP.show(null)");pg.wait_for_timeout(300)
    check(pg.locator('#setList [data-row=arrange]').count()==1,'Settings has Pan layout');pg.click('#setList [data-row=arrange]');pg.wait_for_timeout(500)
    check(pg.evaluate("!$('arOv').hidden&&$('arOv').classList.contains('ar-land')"),'Arrange pans opens, sideways')
    pg.screenshot(path=D+'2-arrange-land.png')
    r=pg.evaluate("(()=>{const r=document.querySelector('#arStage g[data-drum=\"0\"] .rim').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/3]})()")
    pg.mouse.move(r[0],r[1]);pg.mouse.down();pg.mouse.move(r[0]+30,r[1]+10,steps=5);pg.mouse.move(r[0]+60,r[1]+20,steps=5);pg.mouse.up();pg.wait_for_timeout(300)
    o=pg.evaluate("STAGE.lay().guitar.land.p[0]");check(o[0]>0.05 and o[1]>0.03,f'dragging moves the pan ({o})')
    pg.evaluate("()=>{const s=$('arOne');s.value=120;s.dispatchEvent(new Event('input'))}");pg.evaluate("()=>{const s=$('arSk');s.value=150;s.dispatchEvent(new Event('input'))}")
    check(abs(pg.evaluate("STAGE.lay().guitar.land.p[0][2]")-1.2)<1e-6 and pg.evaluate("STAGE.lay().guitar.skirt")==1.5,'This pan and Skirt sliders are kept')
    pg.screenshot(path=D+'3-arrange-moved.png')
    pg.click('[data-ar=done]');pg.wait_for_timeout(300);pg.evaluate("showView('play')");pg.wait_for_timeout(600)
    d2=pg.evaluate(DRUMS,'#playPans');check(d2[0][0]+d2[0][2]/2>d[0][0]+d[0][2]/2+40 and d2[0][2]>d[0][2]*1.15,f'Play follows: the left pan moved and grew ({d[0]} -> {d2[0]})')
    t=pg.evaluate(TAPS,'#playPans');check(t[1]>8 and t[0]>=t[1]-2,f'notes still tap to themselves after arranging {t}')
    pg.screenshot(path=D+'4-play-arranged.png')
    pg.reload();pg.wait_for_timeout(1300);check(pg.evaluate("STAGE.lay().guitar.land.p[0][2]")==1.2,'kept after reopening the app')
    pg.evaluate("ARRANGE.open()");pg.wait_for_timeout(300);pg.click('[data-ar=reset]');pg.wait_for_timeout(200);check(pg.evaluate("!STAGE.lay().guitar"),'Reset puts the set back')
    pg.click('[data-ar=done]');print('errors',pg.errs[:3]);check(not pg.errs,'no errors (sideways)');pg.close()
    # Studio, four cello sideways: the top pair touching, all four bigger than before (radius was about 74)
    pg=page(b,892,412);studio(pg,'fcello');d=pg.evaluate(DRUMS,'#stPans')
    gap=d[1][0]-(d[0][0]+d[0][2]);check(len(d)==4 and -2<=gap<=6,f'four cello: top pair touching (gap {gap})');check(d[0][2]>=190,f'four cello pans bigger ({d[0][2]}px wide)')
    t=pg.evaluate(TAPS,'#stPans');check(t[0]==t[1]>20,f'four cello notes tap to themselves {t}');pg.screenshot(path=D+'5-studio-fcello.png');check(not pg.errs,'no errors');pg.close()
    # Studio, six bass upright: no gap down the middle, the top pair almost touching
    pg=page(b,412,892);studio(pg,'six');d=pg.evaluate(DRUMS,'#stPans')
    gap=d[3][0]-(d[2][0]+d[2][2]);check(-2<=gap<=8,f'six bass: top pair almost touching (gap {gap})');check(d[2][2]>=170,f'six bass pans bigger ({d[2][2]}px wide)')
    t=pg.evaluate(TAPS,'#stPans');check(t[1]>=12 and t[0]==t[1],f'six bass notes tap to themselves {t}');pg.screenshot(path=D+'6-studio-six.png')
    pg.evaluate("ARRANGE.open()");pg.wait_for_timeout(400);check(pg.evaluate("ARRANGE.key")=='six','Arrange opens on the set you play');pg.screenshot(path=D+'7-arrange-up.png')
    pg.evaluate("()=>{const s=$('arAll');s.value=90;s.dispatchEvent(new Event('input'))}");check(pg.evaluate("STAGE.lay().six.up.all")==0.9 and pg.evaluate("!STAGE.lay().six.land"),'upright keeps its own arrangement')
    pg.click('[data-ar=done]');pg.wait_for_timeout(500);d3=pg.evaluate(DRUMS,'#stPans');check(d3[2][2]<d[2][2]*.95,f'Studio follows All pans ({d[2][2]} -> {d3[2][2]})')
    check(not pg.errs,'no errors (upright)');pg.close()
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
