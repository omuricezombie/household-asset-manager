from pathlib import Path
from playwright.sync_api import sync_playwright
import json,threading,http.server,hashlib
checks=[];errors=[];bad=[]
def ck(n,v):
 assert v,n
 checks.append(n)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8767),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
 b=pw.chromium.launch(args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2.5);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:bad.append([r.url,r.status])if r.status>=400 else None)
 # Actual app: real public API, synthetic IndexedDB in isolated browser context only.
 p.goto('http://localhost:8767/index.html');p.wait_for_function('window.HAM?.PetGame&&!document.body.classList.contains("app-booting")')
 def seed(species,pts=100):
  p.evaluate('''async({species,pts})=>{const D=HAM.DB;await HAM.PetGame.replaceStoredData(async()=>{await D.put('settings',{key:'petGameStateV1',value:{version:2,enabled:true,startedMonth:'2026-11',activePet:{id:'qa-only',type:species,name:'QA synthetic',startedMonth:'2026-11',bornAt:D.now(),affection:30,traits:{pet:0,food:0,play:0,calm:0},daily:{date:D.ymd(),used:0,traitsUsed:0}},collection:[],awards:{'2026-11':{points:pts,bonus:0,items:[],petId:'qa-only'}}}})})}''',{'species':species,'pts':pts})
 seed('animal');p.click('[data-nav=pet]');p.wait_for_selector('[data-pet-action=ball]')
 for s in ['animal','fantasy','fairy','yokai','dino']:
  seed(s);p.wait_for_timeout(80);p.click('[data-pet-action=ball]');p.wait_for_timeout(60)
  ck('app '+s+' dedicated ball',p.locator('#petAvatar .pet-character').get_attribute('data-action')=='ball')
  ck('app '+s+' care button label',p.locator('[data-pet-action=ball]').inner_text().find('ボール')>=0)
  ck('app '+s+' reply',p.locator('#petSpeech').inner_text().startswith(p.evaluate('s=>HAM.PetIllustration.ballReply(s)',s)))
  ck('app '+s+' prop visible',p.locator('#petAvatar .pet-play-ball').evaluate('e=>getComputedStyle(e).display')=='block')
  for t in [0,245,840,1855,2700,3650,4000]:
   v=p.evaluate("""t=>{const ch=document.querySelector('#petAvatar .pet-character'),art=ch.querySelector('.pet-illustration'),im=art.firstChild,ball=ch.querySelector('.pet-play-ball');for(const a of ch.getAnimations({subtree:true}))if(a.animationName?.startsWith('ball250-')){a.pause();a.currentTime=t}return {pause:getComputedStyle(ch).animationPlayState,face:getComputedStyle(im).backgroundPositionX,op:+getComputedStyle(ball).opacity,x:getComputedStyle(art).translate,src:getComputedStyle(im).backgroundImage}}""",t)
   ck(s+' paused '+str(t),v['pause']=='paused');ck(s+' base '+str(t),'/hq-baby/'+s+'-base.webp' in v['src']);ck(s+' direction '+str(t),t not in [840,2700,4000] or (v['face']=='100%' if t==840 else v['face'].startswith('33.333') if t==2700 else v['face']=='0%'));ck(s+' prop '+str(t),v['op']==0 if t in [0,4000] else v['op']>.9);ck(s+' moves '+str(t),t!=1855 or v['x'] not in ['0px','0px 0px'])
  saved=p.evaluate("async()=>(await HAM.DB.get('settings','petGameStateV1')).value")
  ck('app '+s+' gain3 cap retained',saved['activePet']['affection']==33 and saved['activePet']['daily']['used']==3)
  ck('app '+s+' no visual saved',not any(x in json.dumps(saved)for x in ['visualAction','actionSequence','data-action']))
  # Dispatch without waiting, exercise concurrent async persist and stale timers.
  p.evaluate("()=>{for(const id of ['ball','feed','ball','pet','ball'])document.querySelector('[data-pet-action='+id+']').click()}");p.wait_for_timeout(100)
  ck('app '+s+' rapid final ball',p.locator('#petAvatar .pet-character').get_attribute('data-action')=='ball')
  p.click('[data-pet-action=brush]');p.wait_for_timeout(60);ck(s+' care switching',p.locator('#petAvatar .pet-care-brush').evaluate('e=>getComputedStyle(e).display')=='block');
  p.click('[data-pet-action=feed]');p.wait_for_timeout(40);ck('app '+s+' switch hides',p.locator('#petAvatar .pet-play-ball').evaluate('e=>getComputedStyle(e).display')=='none')
  p.click('[data-pet-action=ball]');p.wait_for_timeout(60);p.click('[data-pet-action=ball]');p.wait_for_timeout(60);ck(s+' repeat restarts',p.locator('#petAvatar .pet-play-ball').evaluate('e=>e.getAnimations()[0].currentTime<350'));p.wait_for_timeout(4200);ck('app '+s+' idle return',p.locator('#petAvatar .pet-mood-idle').count()==1 and p.locator('#petAvatar .pet-character').get_attribute('data-action')=='')
  ck(s+' daily cap',p.evaluate("async()=>(await HAM.DB.get('settings','petGameStateV1')).value.activePet.daily.used")==10)
  p.emulate_media(reduced_motion='reduce');p.click('[data-pet-action=ball]');p.wait_for_timeout(60);ck(s+' reduced motion',p.locator('#petAvatar .pet-play-ball').evaluate('e=>getComputedStyle(e).animationName==="none"&&getComputedStyle(e).opacity==="1"'));p.emulate_media(reduced_motion='no-preference');
 seed('dino',0);p.wait_for_timeout(50);ck('Lv1 ball locked',p.locator('[data-pet-action=ball]').is_disabled())
 seed('dino',450);p.wait_for_timeout(50);p.click('[data-pet-action=ball]');p.wait_for_timeout(50);ck('teen unchanged shared pet reaction',p.locator('#petAvatar .pet-character').get_attribute('data-action')=='' and p.locator('#petAvatar .pet-character').get_attribute('data-growth')=='teen')
 seed('fairy');p.wait_for_timeout(50);p.click('[data-pet-action=ball]');p.click('[data-nav=home]');p.click('[data-nav=pet]');p.wait_for_timeout(100);ck('navigation returns idle',p.locator('#petAvatar .pet-mood-idle').count()==1)
 seed('animal');p.wait_for_timeout(80);p.click('[data-pet-action=ball]');p.wait_for_timeout(100);p.reload();p.wait_for_function('window.HAM?.PetGame&&!document.body.classList.contains("app-booting")');p.click('[data-nav=pet]');p.wait_for_timeout(100);ck('reload clears ball',p.locator('#petAvatar .pet-character').get_attribute('data-action')=='');ck('reload affection',p.evaluate("async()=>(await HAM.DB.get('settings','petGameStateV1')).value.activePet.affection")==33)
 p.evaluate('async()=>{await navigator.serviceWorker.ready}');p.wait_for_function('navigator.serviceWorker.controller')
 cache=p.evaluate("async()=>{let c=await caches.open('household-asset-manager-v0.2.51');return(await c.keys()).map(x=>x.url)}")
 ck('SW ball CSS and SVG cached',all(any(n in u for u in cache)for n in ['pet-ball.css?v=0251','assets/pet-ball.svg']))
 ck('all30 HQ cached',sum('/hq-baby/'in u or'/hq-growth/'in u for u in cache)==30)
 ck('app version',p.evaluate('HAM.DB.APP_VERSION')=='0.2.51')
 ctx.set_offline(True);p.reload(wait_until='domcontentloaded');p.wait_for_function('window.HAM?.PetGame&&!document.body.classList.contains("app-booting")');p.click('[data-nav=pet]');p.click('[data-pet-action=ball]');p.wait_for_timeout(350);ck('offline ball visible',p.locator('#petAvatar .pet-play-ball').evaluate('e=>getComputedStyle(e).display==="block"&&+getComputedStyle(e).opacity>.9'));ck('no JS errors',not errors);ck('no missing requests',not bad)
 b.close()
server.shutdown()

Path('AI_QA_0251_ball.json').write_text(json.dumps({'count':len(checks),'checks':checks,'errors':errors,'bad':bad},indent=2));print('BALL PASS',len(checks))
