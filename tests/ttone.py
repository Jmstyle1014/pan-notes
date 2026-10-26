import os
# Studio's suggested tone per pan: a new Six Bass track starts with more bass and less treble, a tenor with more shine
# and less boom, without touching anything; moving a slider makes it your own (the switch goes off), the switch puts
# the suggestion back, ↶ Undo works, and a track set up before this keeps the tone you gave it.
import json,sys
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/ttone/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,msg):
    print(('ok   ' if ok else 'FAIL ')+msg)
    if not ok:fails.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}))")
    # every shelf filter the app makes, so we can see what each track really sounds like
    pg.add_init_script("window._sh=[];const cb=BaseAudioContext.prototype.createBiquadFilter;BaseAudioContext.prototype.createBiquadFilter=function(){const f=cb.apply(this,arguments);window._sh.push(f);return f}")
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(300);pg.evaluate("showView('studio')");pg.wait_for_timeout(1000)
    if pg.evaluate("document.body.classList.contains('st-inst')"):pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(500)
    for k in ['tenor','six']:
        pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click(f'[data-st=addk][data-v=pan][data-set={k}]');pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(300)
    fx=lambda k:pg.evaluate(f"STUDIO.fxOf(STUDIO.song.tracks.find(t=>t.type==='pan'&&t.panSet==='{k}'))")
    t,s=fx('tenor'),fx('six')
    check(s['bass']>0 and s['treble']<0 and not s['own'],f'a new Six Bass starts with more bass, less treble {s}')
    check(t['treble']>0 and t['bass']<0 and not t['own'],f'a new tenor starts with more shine, less boom {t}')
    # what you hear: the shelves really are set that way, and at each pan's own place
    pg.evaluate("STUDIO.seek(0);STUDIO.play(false)");pg.wait_for_timeout(500);pg.evaluate("STUDIO.stop(true)")
    sh=pg.evaluate("window._sh.filter(f=>f.type==='lowshelf').map(f=>[Math.round(f.frequency.value),f.gain.value])")
    check([140,4] in sh and [420,-2] in sh,f'the sound follows: Six Bass bass lift at 140 Hz, tenor trim at 420 Hz {sh}')
    # open the six bass's settings
    pg.evaluate("document.querySelector('.st-row[data-tid=\"'+STUDIO.song.tracks.find(t=>t.panSet==='six').id+'\"] [data-st=tset]').click()");pg.wait_for_timeout(400)
    sw=pg.evaluate("(()=>{const b=document.querySelector('#stSheet [data-st=tone]');return b&&[b.getAttribute('aria-pressed'),b.textContent]})()")
    check(sw and sw[0]=='true' and 'Six' in sw[1],f'the Tone panel shows Suggested is on {sw}')
    vals=pg.evaluate("['treble','bass','comp'].map(k=>+document.querySelector('#stSheet [data-fx='+k+']').value)")
    check(vals[0]==s['treble'] and vals[1]==s['bass'],f'the sliders show the suggested tone {vals}')
    pg.evaluate("document.querySelector('#stSheet [data-st=tone]').scrollIntoView({block:'center'})");pg.wait_for_timeout(150)
    pg.screenshot(path=D+'1-suggested.png')
    # move Treble: it's your own now
    pg.evaluate("()=>{const i=document.querySelector('#stSheet [data-fx=treble]');i.value=2;i.dispatchEvent(new Event('input',{bubbles:true}))}");pg.wait_for_timeout(200)
    s2=fx('six')
    check(s2['own'] and s2['treble']==2 and s2['bass']==s['bass'] and pg.evaluate("document.querySelector('#stSheet [data-st=tone]').getAttribute('aria-pressed')")=='false',f'moving Treble makes it your own, the rest stays where it was {s2}')
    pg.screenshot(path=D+'2-own.png')
    # the switch back on puts the suggestion back; off again is flat
    pg.evaluate("document.querySelector('#stSheet [data-st=tone]').click()");pg.wait_for_timeout(200)
    s3=fx('six');check(not s3['own'] and s3['treble']==s['treble'],f'Suggested on: back to the suggested tone {s3}')
    pg.evaluate("document.querySelector('#stSheet [data-st=tone]').click()");pg.wait_for_timeout(200)
    s4=fx('six');check(s4['own'] and s4['treble']==0 and s4['bass']==0 and s4['comp']==0,f'Suggested off: flat {s4}')
    pg.evaluate("STUDIO.undo()");pg.wait_for_timeout(200)
    check(not fx('six')['own'],'↶ Undo turns the suggestion back on')
    # a track set up before this keeps its tone; a flat old one gets the suggestion
    o=pg.evaluate("(()=>{const ts=STUDIO.song.tracks;const a=ts.find(t=>t.panSet==='six'),c=ts.find(t=>t.panSet==='tenor');a.fx={treble:0,bass:3,comp:0,echo:.1,echoT:'q',room:0};c.fx={treble:0,bass:0,comp:0,echo:.2,echoT:'q',room:0};return[STUDIO.fxOf(a),STUDIO.fxOf(c)]})()")
    check(o[0]['own'] and o[0]['bass']==3 and o[0]['treble']==0,f'an older track you set yourself keeps its tone {o[0]}')
    check(not o[1]['own'] and o[1]['treble']==2 and o[1]['echo']==.2,f'an older flat track gets the suggestion and keeps its echo {o[1]}')
    # echo doesn't switch the suggestion off
    pg.evaluate("document.querySelector('#stSheet [data-st=tsetpick][data-v=\"'+STUDIO.song.tracks.find(t=>t.panSet==='tenor').id+'\"]').click()");pg.wait_for_timeout(300)
    pg.evaluate("()=>{const i=document.querySelector('#stSheet [data-fx=echo]');i.value=.3;i.dispatchEvent(new Event('input',{bubbles:true}))}");pg.wait_for_timeout(150)
    check(not fx('tenor')['own'],'moving Echo leaves Suggested on')
    # drums and the recording have no suggestion
    has=pg.evaluate("(()=>{const t=STUDIO.song.tracks.find(t=>t.type!=='pan'&&t.type!=='part');if(!t)return null;document.querySelector('#stSheet [data-st=tsetpick][data-v=\"'+t.id+'\"]').click();return !!document.querySelector('#stSheet [data-st=tone]')})()")
    pg.wait_for_timeout(200)
    check(has is None or not has,'a drum or recording track has no pan suggestion')
    check(not errs,f'no errors {errs[:2]}');ctx.close();b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
