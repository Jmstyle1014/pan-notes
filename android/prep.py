#!/usr/bin/env python3
"""Copies the Panyard web app (../panyard) into the Android app's assets, with two small changes:
the offline helper (service worker) is left out, since the app is already on the phone, and a
bridge is added so saved files (backups, charts, recordings) go to the phone's Downloads folder."""
import os, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'panyard')
OUT = os.path.join(HERE, 'app', 'src', 'main', 'assets')
shutil.rmtree(OUT, ignore_errors=True)
shutil.copytree(SRC, OUT, ignore=shutil.ignore_patterns('sw.js', 'manifest.webmanifest'))
p = os.path.join(OUT, 'index.html')
s = open(p, encoding='utf-8').read()
a = "'serviceWorker' in navigator"
assert s.count(a) == 1, 'service worker line not found'
s = s.replace(a, "false&&" + a)
BRIDGE = r"""<script>(function(){if(!window.PanAndroid)return;window.PAN_ANDROID=true;
// a link that saves a file (how the app downloads) hands the file to Android instead
async function send(blob,name){const id=Date.now()+'_'+Math.random().toString(36).slice(2),N=786432,buf=new Uint8Array(await blob.arrayBuffer());
  try{for(let i=0;i<buf.length;i+=N){const c=buf.subarray(i,i+N);let s='';for(let j=0;j<c.length;j+=8192)s+=String.fromCharCode.apply(null,c.subarray(j,j+8192));PanAndroid.chunk(id,btoa(s))}
    if(!buf.length)PanAndroid.chunk(id,'');return PanAndroid.done(id,name,blob.type||'')}catch(e){try{PanAndroid.cancel(id)}catch(_){}}}
const click=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download&&/^(blob|data):/.test(this.href)){const n=this.download;fetch(this.href).then(r=>r.blob()).then(b=>send(b,n));return}return click.call(this)};
// the phone's back button: close what's open, then go back to Home, then leave
window.panBack=function(){try{
  const open=[...document.querySelectorAll('.sheetov,#stSheet,#labSheet,#wbSheet,#wbMenu,#gbMenu')].find(e=>!e.hidden&&e.getClientRects().length>0);
  if(open){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));if(!open.hidden&&open.getClientRects().length){const x=open.querySelector('[data-st=close],.close,[aria-label=Close]');if(x)x.click()}return true}
  if(typeof currentView!=='undefined'&&currentView!=='home'){const b=document.getElementById('wbBack');if(b&&b.getClientRects().length){b.click();return true}showView('home');return true}
}catch(e){}return false};
})()</script>"""
a = '<script>window.PAN_APP=true</script>'
assert s.count(a) == 1, 'app marker not found'
s = s.replace(a, a + BRIDGE)
open(p, 'w', encoding='utf-8').write(s)
print('assets ready:', sum(len(f) for _, _, f in os.walk(OUT)), 'files')
