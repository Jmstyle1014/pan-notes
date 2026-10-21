import os,sys,json
from playwright.sync_api import sync_playwright
# Tune my pans: the new tuning screen, Ring/Tone/Volume per note, 24-bit takes, and the sound editor.
D=os.environ['WORK']+'/ttw/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
# a pretend recording of each note: the note, its octave and twelfth, ringing down, a few cents off, some hiss
MAKE="""([ids,cents,sr])=>{for(let k=0;k<ids.length;k++){const id=ids[k],f=440*Math.pow(2,(midiOf(PITCH[id])-69+cents[k]/100)/12),n=Math.round(sr*2.2),x=new Float32Array(n);let s=k+3;
  for(let i=0;i<n;i++){const t=i/sr,e=Math.exp(-t*2.2)*Math.min(1,t*500);s=(s*16807)%2147483647;x[i]=e*(.55*Math.sin(2*Math.PI*f*t)+.3*Math.sin(2*Math.PI*2*f*t)+.1*Math.sin(2*Math.PI*3*f*t))+((s/2147483647)-.5)*.01}
  storeTake(id,x,sr)}return Object.keys(SAMPLES.wav).length}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W,H,name in [(1280,860,'desktop'),(820,1180,'ipad'),(390,844,'phone')]:
        ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=1 if W>800 else 2,has_touch=W<800);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1200);pg.add_style_tag(content='#status{visibility:hidden!important}')
        pg.click('[data-r=producer]');pg.wait_for_timeout(300);pg.click('#hmNew');pg.wait_for_timeout(300);pg.click('[data-r=npan][data-v=tenor]');pg.fill('#nsName','Tune test');pg.click('[data-r=create]');pg.wait_for_timeout(1000)
        ids=E(pg,"()=>SETS.tenor.views.flatMap(v=>v.fields.map(f=>f[0])).sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b])).filter((_,i)=>i%4===0)")
        cents=[(-22,3,14,-2,30,-8,1,-15)[i%8] for i in range(len(ids))]
        n=E(pg,MAKE,[ids,cents,48000]);check(n==len(ids),name+f': made {n} recordings')
        # the takes are 24-bit now
        bits=E(pg,"async id=>{const ab=await SAMPLES.wav[id].arrayBuffer();return new DataView(ab).getUint16(34,true)}",ids[0]);check(bits==24,name+f': new takes are saved 24-bit ({bits})')
        # open it from Settings
        E(pg,"showView('setup')");pg.wait_for_timeout(400);E(pg,"SETUP.show(null)");pg.wait_for_timeout(200)
        row=pg.locator('#setList [data-row=tunemy]')
        check(row.count()==1,name+': Settings has a Tune my pans row')
        if row.count():row.first.click()
        else:E(pg,"TW.open(true)")
        pg.wait_for_timeout(2500)
        check(E(pg,"TW.isOpen"),name+': it opens')
        st=E(pg,"()=>({fields:document.querySelectorAll('#twPanBox .field').length,ok:document.querySelectorAll('#twPanBox .field.tws-ok').length,off:document.querySelectorAll('#twPanBox .field.tws-off').length,fill:document.querySelectorAll('#twPanBox .field.tws-fill').length,sel:(document.querySelector('#twPanBox .field.twsel')||{}).dataset,hs:document.documentElement.scrollWidth>innerWidth+1})")
        print(name,json.dumps(st))
        check(st['fields']>=29,name+': the whole tenor is drawn ('+str(st['fields'])+' notes)')
        check(st['off']>0 and st['ok']>0,name+': notes are coloured in tune / needs a touch')
        pg.screenshot(path=D+name+'-1.png')
        # pick a note that needs a touch, Fix it
        off=E(pg,"()=>{const f=document.querySelector('#twPanBox .field.tws-off');return f&&f.dataset.field}")
        if off:
            pg.locator(f'#twPanBox .field[data-field="{off}"]').first.dispatch_event('pointerdown')
            pg.wait_for_timeout(300)
            pg.click('#twEd [data-a=fix]');pg.wait_for_timeout(400)
            c=E(pg,"id=>{const T=tuneOf(id);return T.cents}",off);check(abs(c)>1,name+f': Fix it set a pitch correction ({c})')
            check(E(pg,"id=>document.querySelector('#twPanBox .field[data-field=\"'+id+'\"]').classList.contains('tws-ok')",off),name+': and the note turns green')
        # sliders: volume, ring, tone
        for k,v in (('db','4'),('ring','-6'),('tone','5')):
            E(pg,"([k,v])=>{const s=document.querySelector('#twS-'+k);s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}))}",[k,v])
        T=E(pg,"()=>tuneOf(document.querySelector('#twPanBox .field.twsel').dataset.field)")
        check(T.get('db')==4 and T.get('ring')==-6 and T.get('tone')==5,name+': Volume, Ring and Tone are kept with the note '+json.dumps({k:T.get(k) for k in ('db','ring','tone','cents')}))
        # it still plays (Ring and Tone in the path)
        played=E(pg,"()=>{const id=document.querySelector('#twPanBox .field.twsel').dataset.field;return playSample(id,1,false)}")
        check(played,name+': the note plays with them')
        pg.screenshot(path=D+name+'-2.png')
        # More menu
        pg.click('#twMoreBtn');pg.wait_for_timeout(200);check(E(pg,"!$('twMenu').hidden"),name+': More opens');pg.screenshot(path=D+name+'-3-more.png');pg.click('#twMoreBtn')
        # switch pan by the tabs and by swiping
        pg.click('#twSwitch [data-k=guitar]');pg.wait_for_timeout(600)
        check(E(pg,"document.querySelector('#twPName').textContent")=='Double Guitar',name+': the tabs switch to the Double Guitar')
        pg.screenshot(path=D+name+'-4-guitar.png')
        bx=pg.locator('#twPanArea').bounding_box();y=bx['y']+bx['height']*0.85
        pg.mouse.move(bx['x']+bx['width']*0.85,y);pg.mouse.down();pg.mouse.move(bx['x']+bx['width']*0.15,y,steps=8);pg.mouse.up();pg.wait_for_timeout(500)
        check(E(pg,"document.querySelector('#twPName').textContent")!='Double Guitar',name+': swiping the pan moves to the next one ('+E(pg,"document.querySelector('#twPName').textContent")+')')
        # Reset
        pg.click('#twSwitch [data-k=tenor]');pg.wait_for_timeout(600)
        sid=E(pg,"document.querySelector('#twPanBox .field.twsel').dataset.field")
        E(pg,"id=>{const f=document.querySelector('#twPanBox .field[data-field=\"'+id+'\"]');f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))}",sid)
        if E(pg,"!!document.querySelector('#twEd [data-a=reset]:not([disabled])')"):
            pg.click('#twEd [data-a=reset]');pg.wait_for_timeout(300);check(not E(pg,"id=>!!SAMPLES.tune[id]",sid),name+': Reset takes the changes off')
        # ---- the sound editor ----
        eid=E(pg,"()=>document.querySelector('#twPanBox .field.twsel').dataset.field")
        E(pg,"id=>{const f=document.querySelector('#twPanBox .field[data-field=\"'+id+'\"]');f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))}",eid);pg.wait_for_timeout(200)
        pg.click('#twEd [data-a=edit]');pg.wait_for_timeout(800)
        check(E(pg,"WAVE.isOpen&&!$('wvSheet').hidden"),name+': Edit the sound opens')
        n0=E(pg,"id=>SAMPLES.buf[id].length",eid)
        mn=pg.locator('#wvMain').bounding_box()
        pg.mouse.move(mn['x']+mn['width']*.5,mn['y']+mn['height']/2);pg.mouse.down();pg.mouse.move(mn['x']+mn['width']*.9,mn['y']+mn['height']/2,steps=5);pg.mouse.up();pg.wait_for_timeout(200)
        check('–' in E(pg,"$('wvSel').textContent"),name+': dragging selects a part: '+E(pg,"$('wvSel').textContent"))
        pg.screenshot(path=D+name+'-5-editor.png')
        pg.click('.wvview [data-v=spec]');pg.wait_for_timeout(300);pg.screenshot(path=D+name+'-6-spectrum.png')
        for k in ['fout','undo','redo','noise','clicks','level','start','zin','zout','all','mute','undo']:
            pg.click(f'#wvSheet [data-w={k}]');pg.wait_for_timeout(120)
        pg.click('#wvSheet [data-w=del]') if E(pg,"!document.querySelector('#wvSheet [data-w=del]').disabled") else None
        pg.click('#wvSave');pg.wait_for_timeout(800)
        check(not E(pg,"WAVE.isOpen"),name+': Save closes the editor')
        check(E(pg,"TW.isOpen"),name+': and the tuning screen is still open')
        check(E(pg,"id=>WAVE.edited(id)",eid),name+': the original take is kept')
        bits=E(pg,"async id=>{const ab=await SAMPLES.wav[id].arrayBuffer();return new DataView(ab).getUint16(34,true)}",eid);check(bits==24,name+': the edit is saved 24-bit')
        pg.click('#twEd [data-a=edit]');pg.wait_for_timeout(600)
        check(E(pg,"!$('wvOrig').hidden"),name+': Back to the original is offered')
        pg.on('dialog',lambda d:d.accept())
        pg.click('#wvOrig');pg.wait_for_timeout(800)
        check(E(pg,"id=>SAMPLES.buf[id]&&SAMPLES.buf[id].length",eid)==n0 and not E(pg,"id=>WAVE.edited(id)",eid),name+': Back to the original restores the take')
        # Escape closes only the editor
        pg.click('#twEd [data-a=edit]');pg.wait_for_timeout(600);pg.keyboard.press('Escape');pg.wait_for_timeout(200)
        check(not E(pg,"WAVE.isOpen") and E(pg,"TW.isOpen"),name+': Escape closes the editor, not the tuning screen')
        if name=='desktop':
            # how well the noise remover works: a note with hiss under it, and a hiss-only tail to learn from
            r=E(pg,"""()=>{const sr=48000,n=sr*2,x=new Float32Array(n),f=392;let s=9;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647-.5};
              for(let i=0;i<n;i++){const t=i/sr,e=t<1.6?Math.exp(-t*2)*Math.min(1,t*500):0;x[i]=e*.6*Math.sin(2*Math.PI*f*t)+rnd()*.03}
              const rms=(y,a,b)=>{let q=0;for(let i=a;i<b;i++)q+=y[i]*y[i];return Math.sqrt(q/(b-a))};
              const note=(y)=>{let re=0,im=0;for(let i=4800;i<24000;i++){const t=i/sr;re+=y[i]*Math.cos(2*Math.PI*f*t);im+=y[i]*Math.sin(2*Math.PI*f*t)}return Math.hypot(re,im)};
              const out=WAVE.denoise(x,null,sr).y;
              return {hissBefore:20*Math.log10(rms(x,sr*1.7,sr*1.95)),hissAfter:20*Math.log10(rms(out,sr*1.7,sr*1.95)),noteChange:20*Math.log10(note(out)/note(x))}}""")
            print('noise remover',json.dumps(r))
            check(r['hissBefore']-r['hissAfter']>12,'noise remover: hiss down %.1f dB'%(r['hissBefore']-r['hissAfter']))
            check(abs(r['noteChange'])<1.5,'noise remover: the note itself changes by only %.2f dB'%r['noteChange'])
        if name=='desktop':
            # ---- every take is kept ----
            tid=ids[1];E(pg,"TW.open(false)");pg.wait_for_timeout(200)
            before=E(pg,"id=>TAKES.count(id)",tid)
            E(pg,MAKE,[[tid,tid],[25,-3],48000]);pg.wait_for_timeout(300)
            check(E(pg,"id=>TAKES.count(id)",tid)==before+2 and E(pg,"id=>TAKES.cur(id)",tid)==before+1,'takes: recording again keeps the earlier takes (%d)'%E(pg,"id=>TAKES.count(id)",tid))
            check(E(pg,"id=>SAMPLES.wav[id]===TAKES.curTake(id).b",tid),'takes: the newest take is in use')
            E(pg,"TW.open(true)");pg.wait_for_timeout(1500)
            E(pg,"id=>{const f=document.querySelector('#twPanBox .field[data-field=\"'+id+'\"]');f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))}",tid);pg.wait_for_timeout(2500)
            rows=E(pg,"document.querySelectorAll('#twEd .twtk').length");check(rows==before+2,'takes: the note panel lists %d takes'%rows)
            pg.screenshot(path=D+'takes-1.png')
            el=pg.locator('#twEd .twtakes');el.scroll_into_view_if_needed();pg.screenshot(path=D+'takes-2.png')
            pg.click('#twEd [data-a=tuse][data-v="0"]');pg.wait_for_timeout(600)
            check(E(pg,"id=>TAKES.cur(id)===0&&SAMPLES.wav[id]===TAKES.list(id)[0].b",tid),'takes: Use puts take 1 back in use')
            pg.click('#twEd [data-a=tbest]');pg.wait_for_timeout(2500)
            print('  best ->',E(pg,"$('twMsg').textContent"))
            check(E(pg,"id=>TAKES.cur(id)",tid) in (0,1,2),'takes: Pick the best chose a take')
            n=E(pg,"id=>TAKES.count(id)",tid);pg.click('#twEd [data-a=tdel][data-v="%d"]'%(n-1 if E(pg,"id=>TAKES.cur(id)",tid)!=n-1 else 0));pg.wait_for_timeout(500)
            check(E(pg,"id=>TAKES.count(id)",tid)==n-1,'takes: a take can be deleted')
            # edits are takes too, and Back to the original returns to the take it came from
            cur0=E(pg,"id=>TAKES.cur(id)",tid);pg.click('#twEd [data-a=edit]');pg.wait_for_timeout(600);pg.click('#wvSheet [data-w=level]');pg.click('#wvSave');pg.wait_for_timeout(800)
            check(E(pg,"id=>TAKES.curTake(id).how",tid)=='edit','takes: a saved edit is a new take')
            pg.click('#twEd [data-a=edit]');pg.wait_for_timeout(600);pg.click('#wvOrig');pg.wait_for_timeout(800)
            check(E(pg,"id=>TAKES.cur(id)",tid)==cur0,'takes: Back to the original goes back to the take the edit came from')
            # they survive closing the app
            n=E(pg,"id=>TAKES.count(id)",tid);E(pg,"TW.open(false)");pg.wait_for_timeout(800);pg.reload();pg.wait_for_timeout(2500)
            check(E(pg,"id=>TAKES.ready&&TAKES.count(id)",tid)==n,'takes: still there after reopening the app (%s)'%E(pg,"id=>TAKES.count(id)",tid))
            E(pg,"TW.open(true)");pg.wait_for_timeout(300)
        E(pg,"TW.open(false)");pg.wait_for_timeout(200)
        check(not errs,name+': no errors '+str(errs[:3]))
        ctx.close()
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
