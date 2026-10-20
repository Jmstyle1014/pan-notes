/* ---------- the phone's back button ----------
   The Android app is Panyard running in Chrome, and back there means "go back a page". Panyard is one page, so
   without this, back left the app from any screen. Now back closes what's open, then goes back to Home, and on
   Home it asks for a second press before leaving. It works by keeping one spare history entry on top. */
var BACK={
  armed:false,
  // Chrome ignores history entries a page adds before you've touched it, so the spare one is added after a tap
  arm(){if(this.armed)return;try{history.pushState({panBack:1},'');this.armed=true}catch(e){}},
  open(){return[...document.querySelectorAll('.sheetov,.labov,#stSheet,#wbSheet,#wbMenu,#gbMenu')].find(e=>!e.hidden&&e.getClientRects().length>0)},
  // one press of back: true when it did something inside the app
  step(){
    const o=this.open();
    if(o){
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      if(!o.hidden&&o.getClientRects().length){const x=o.querySelector('[data-st=close],.close,[aria-label=Close]');if(x)x.click()}
      return true}
    if(currentView!=='home'){const b=$('wbBack');if(b&&b.getClientRects().length)b.click();else showView('home');return true}
    return false},
  init(){
    addEventListener('click',e=>{if(e.isTrusted)this.arm()},true);
    addEventListener('keyup',e=>{if(e.isTrusted&&e.key!=='Escape')this.arm()},true);
    addEventListener('popstate',()=>{
      this.armed=false;
      if(this.step())this.arm();
      // on Home with nothing open: the next back press leaves (unless you tap something first)
      else say('Press back again to leave Panyard');
    });
  }
};
BACK.init();
