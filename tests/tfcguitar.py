import os,sys
from playwright.sync_api import sync_playwright
# Four cello from the guitar (Settings, as Panyard VR's "From guitar"): with it on (the default) a four cello note plays the
# closest Double Guitar recording, retuned to the right note, even when the phone has a four cello recording of that note;
# off, the four cello's own recording plays again. The switch is in Settings and stays as set after reopening.
D=os.environ['WORK']+'/tfcguitar/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
# pretend recordings: a short tone for every guitar note and for two four cello notes, ready to play
FAKE="""(()=>{S.panVoice='mine';const ac=panCtx(),ids=[...SETS.guitar.views.flatMap(v=>v.fields.map(f=>f[0])),'fcello:43','fcello:48'];
  for(const id of ids){const b=ac.createBuffer(1,8820,44100),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=.3*Math.sin(i/44100*2*Math.PI*220)*Math.exp(-i/4000);
    SAMPLES.wav[id]=SAMPLES.wav[id]||{fake:1};SAMPLES.buf[id]=b}SAMPLES.warm=true;
  window._ps=[];const _p=playSample;playSample=function(src,v,l,sh,id){window._ps.push({src,sh,id});return _p.apply(this,arguments)};return ids.length})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2)
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300)
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(400)
    check(pg.evaluate("FCG.on"),'four cello from the guitar is on to start with')
    pg.evaluate(FAKE)
    bw=pg.evaluate("borrowOf('fcello:48')");pit=pg.evaluate("[PITCH['fcello:48'],PITCH[borrowOf('fcello:48').src]]")
    check(bw and pg.evaluate(f"FIELDS.get('{bw['src']}').set")=='guitar',f'a four cello note takes a Double Guitar recording ({bw}, {pit})')
    check(bw and abs(bw['st'])<=1,f'the closest one, retuned to the right note ({bw and bw["st"]} semitones)')
    check(pg.evaluate("TW.skip('fcello:48')"),'even though the phone has a four cello recording of that note')
    pg.evaluate("_ps.length=0;S.panSet='fcello';applyPanSet()");pg.wait_for_timeout(200);pg.evaluate("strike('fcello:48',.9)");pg.wait_for_timeout(200)
    ps=pg.evaluate("_ps");check(ps and pg.evaluate(f"FIELDS.get('{ps[-1]['src']}').set")=='guitar' and ps[-1]['id']=='fcello:48',f'Play\'s tap sound plays the guitar recording ({ps[-1:] })')
    top=pg.evaluate("SETS.fcello.views.flatMap(v=>v.fields.map(f=>f[0])).sort((a,b)=>midiOf(PITCH[b])-midiOf(PITCH[a]))[0]")
    check(pg.evaluate(f"!!borrowOf('{top}')"),f'the top note ({top}, {pg.evaluate(f"PITCH[{chr(39)+top+chr(39)}]")}) still finds a guitar note close enough')
    check(pg.evaluate("borrowOf('tenor:60')")!=pg.evaluate("borrowOf('fcello:48')"),'other pans are left alone')
    pg.evaluate("SETUP.render()");row=pg.evaluate("!!document.querySelector('#setList [data-row=fcguitar]')")
    check(row,'the switch is in Settings')
    if row:
        pg.evaluate("document.querySelector('#setList [data-row=fcguitar]').click()")
    else:pg.evaluate("FCG.set(false)")
    check(not pg.evaluate("FCG.on"),'switched off')
    check(not pg.evaluate("TW.skip('fcello:48')") and not pg.evaluate("borrowOf('fcello:48')"),'off: the four cello\'s own recording plays again')
    pg.evaluate("_ps.length=0;strike('fcello:48',.9)");pg.wait_for_timeout(200);ps=pg.evaluate("_ps")
    check(ps and ps[-1]['src']=='fcello:48','and Play uses it')
    pg.reload();pg.wait_for_timeout(1300);check(not pg.evaluate("FCG.on"),'it stays off after reopening')
    pg.evaluate("FCG.set(true)")
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
