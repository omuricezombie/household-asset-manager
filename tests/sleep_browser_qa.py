from pathlib import Path
import json,threading,http.server,hashlib
from playwright.sync_api import sync_playwright
checks=[];errors=[];bad=[]
def ck(n,v):
 assert v,n
 checks.append(n)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8769),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
 b=pw.chromium.launch(args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844});p=ctx.new_page()
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:bad.append([r.url,r.status]) if r.status>=400 else None)
 p.clock.install();p.goto('http://localhost:8769/index.html');p.wait_for_function('window.HAM?.PetGame&&!document.body.classList.contains("app-booting")');p.evaluate('async()=>{await navigator.serviceWorker.ready}');p.wait_for_function('navigator.serviceWorker.controller')
 def seed(species,pts=0):
  p.evaluate('''async({species,pts})=>{const D=HAM.DB;await HAM.PetGame.replaceStoredData(async()=>{await D.put('settings',{key:'petGameStateV1',value:{version:2,enabled:true,startedMonth:'2026-11',activePet:{id:'qa-only',type:species,name:'QA synthetic',startedMonth:'2026-11',bornAt:D.now(),affection:30,traits:{pet:0,food:0,play:0,calm:0},daily:{date:D.ymd(),used:0,traitsUsed:0}},collection:[],awards:{'2026-11':{points:pts,bonus:0,items:[],petId:'qa-only'}}}})})}''',{'species':species,'pts':pts})
  p.evaluate("HAM.PetGame.onScreen('pet')") if p.locator('#petAvatar').is_visible() else p.click('[data-nav=pet]')
  p.wait_for_function('HAM.PetGame._test.sleepSnapshot()?.state==="idle"' if pts<1000 else 'HAM.PetGame._test.sleepSnapshot()===null')
 def snap():return p.evaluate('HAM.PetGame._test.sleepSnapshot()')
 def state(s):p.wait_for_function('(s)=>HAM.PetGame._test.sleepSnapshot()?.state===s',arg=s)
 def advance(ms):p.clock.fast_forward(int(ms)+10)
 def go_sleep():
  n=snap()['remaining'];ck('idle remaining within bounds',0<n<=120000);advance(n);state('drowsy');advance(3600);state('sleep')
 def save():return p.evaluate("async()=>(await HAM.DB.get('settings','petGameStateV1')).value")
 for s in ['animal','fantasy','fairy','yokai','dino']:
  seed(s);before=save();ch=p.locator('#petAvatar .pet-character');im=ch.locator('.pet-art-image').first;zzz=ch.locator('.pet-sleep-zzz')
  ck(s+' Lv1 ball locked',p.locator('[data-pet-action=ball]').is_disabled());ck(s+' no idle zzz',zzz.evaluate('e=>getComputedStyle(e).display')=='none')
  advance(snap()['remaining']);state('drowsy');ck(s+' front and pause',ch.get_attribute('data-facing')=='front' and ch.evaluate('e=>getComputedStyle(e).animationPlayState')=='paused')
  ck(s+' drowsy state',ch.get_attribute('data-sleep-state')=='drowsy');ck(s+' drowsy zzz hidden',zzz.evaluate('e=>getComputedStyle(e).display')=='none')
  if s!='yokai':ck(s+' closed mouth overlay','mouth.webp' in im.evaluate('e=>getComputedStyle(e,"::after").backgroundImage'))
  advance(3600);state('sleep');ck(s+' sleep marker',ch.get_attribute('data-sleep-state')=='sleep');ck(s+' zzz visible',zzz.evaluate('e=>getComputedStyle(e).display')=='block');ck(s+' sleep no data change',save()==before)
  url=im.evaluate('e=>getComputedStyle(e).backgroundImage');expected={'animal':'animal-sleep.webp','fairy':'fairy-sleep.webp','yokai':'yokai-sleep-face.webp','fantasy':'fantasy-face.webp','dino':'dino-face.webp'}[s];ck(s+' accepted sleep source',expected in url)
  ck(s+' sleep duration',119000<=snap()['remaining']<=300000);p.evaluate("document.body.classList.add('app-locked')");p.wait_for_function('HAM.PetGame._test.sleepSnapshot()?.paused');remain=snap()['remaining'];advance(300000);ck(s+' locked timer paused',snap()['state']=='sleep' and snap()['remaining']==remain);p.evaluate("document.body.classList.remove('app-locked')");p.wait_for_function('HAM.PetGame._test.sleepSnapshot()?.paused===false')
  p.evaluate("document.getElementById('petAvatar').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");state('wake');ck(s+' wake zzz hidden',zzz.evaluate('e=>getComputedStyle(e).display')=='none');advance(750);state('idle');ck(s+' wake no data change',save()==before);ck(s+' normal wander resumes',ch.evaluate('e=>getComputedStyle(e).animationPlayState')=='running')
 seed('animal',100);go_sleep();p.evaluate("()=>{for(const id of ['ball','feed','brush'])document.querySelector('[data-pet-action='+id+']').click()}");state('wake');advance(750);p.wait_for_function('document.querySelector("#petAvatar .pet-character").dataset.action==="brush"');ck('latest action only after wake',save()['activePet']['daily']['used']==2);advance(2700);state('idle');go_sleep();p.click('[data-nav=home]');state('sleep');ck('home preserves room sleep',p.locator('#petVisitor .pet-character').get_attribute('data-sleep-state')=='sleep');p.click('[data-nav=pet]');state('sleep');ck('room preserves shared sleep',p.locator('#petAvatar .pet-character').get_attribute('data-sleep-state')=='sleep');advance(snap()['remaining']);state('wake');advance(750);state('idle')
 go_sleep();advance(snap()['remaining']);state('wake');advance(750);state('idle');ck('natural wake',True)
 go_sleep();seed('dino',1000);ck('adult never starts sleep',snap() is None);advance(150000);ck('adult unchanged',snap() is None)
 seed('fairy');p.emulate_media(reduced_motion='reduce');go_sleep();ck('reduced motion zzz static',p.locator('#petAvatar .pet-sleep-zzz').evaluate('e=>getComputedStyle(e).animationName')=='none');p.emulate_media(reduced_motion='no-preference')
 # Real Home visitor (not a clone): same state, approved image, no new reward.
 for s in ['animal','fantasy','fairy','yokai','dino']:
  seed(s);before=save();p.click('[data-nav=home]');home=p.locator('#petVisitor');ch=home.locator('.pet-character');im=ch.locator('.pet-art-image').first;zzz=ch.locator('.pet-sleep-zzz')
  ck(s+' home idle',snap()['state']=='idle' and zzz.evaluate('e=>getComputedStyle(e).display')=='none');advance(snap()['remaining']);state('drowsy');ck(s+' home drowsy front',ch.get_attribute('data-sleep-state')=='drowsy' and ch.get_attribute('data-facing')=='front');advance(3600);state('sleep')
  ck(s+' home sleep zzz',zzz.evaluate('e=>getComputedStyle(e).display')=='block');ck(s+' home sleep paused',ch.evaluate('e=>getComputedStyle(e).animationPlayState')=='paused');expected={'animal':'animal-sleep.webp','fairy':'fairy-sleep.webp','yokai':'yokai-sleep-face.webp','fantasy':'fantasy-face.webp','dino':'dino-face.webp'}[s];ck(s+' home approved sleep source',expected in im.evaluate('e=>getComputedStyle(e).backgroundImage'))
  if s in ['animal','fairy']:ck(s+' home full sleep sprite',im.evaluate('e=>getComputedStyle(e).backgroundSize')=='100% 100%')
  if s in ['fantasy','dino']:ck(s+' home closed mouth overlay','mouth.webp' in im.evaluate('e=>getComputedStyle(e,"::after").backgroundImage'))
  remain=snap()['remaining'];p.evaluate("window.__qaHome=document.getElementById('petVisitor');HAM.PetGame.onScreen('home')");ck(s+' home redraw keeps node',p.evaluate("window.__qaHome===document.getElementById('petVisitor')"));ck(s+' home redraw keeps deadline',abs(snap()['remaining']-remain)<2000)
  p.click('[data-nav=pet]');state('sleep');ck(s+' room sleep retained',p.locator('#petAvatar .pet-character').get_attribute('data-sleep-state')=='sleep' and abs(snap()['remaining']-remain)<3000);p.click('[data-nav=home]');state('sleep');ck(s+' home again same sleep',ch.get_attribute('data-sleep-state')=='sleep' and abs(snap()['remaining']-remain)<5000)
  p.click('[data-nav=input]');p.wait_for_function('HAM.PetGame._test.sleepSnapshot()?.paused');remain=snap()['remaining'];advance(300000);ck(s+' finance pause',snap()['state']=='sleep' and snap()['remaining']==remain);p.click('[data-nav=home]');state('sleep');ck(s+' finance return',not snap()['paused'] and ch.get_attribute('data-sleep-state')=='sleep')
  home.click();state('wake');ck(s+' home tap stays home',home.is_visible() and zzz.evaluate('e=>getComputedStyle(e).display')=='none');advance(750);state('idle');ck(s+' home wake no saved change',save()==before);ck(s+' home wander resumes',ch.evaluate('e=>getComputedStyle(e).animationPlayState')=='running');home.click();p.wait_for_function('document.querySelector("[data-screen=pet]").classList.contains("active")');ck(s+' awake tap navigates',not home.count())
 seed('animal');p.click('[data-nav=home]');go_sleep();home=p.locator('#petVisitor');box=home.bounding_box();p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);p.mouse.down();p.mouse.move(box['x']+box['width']/2-50,box['y']+box['height']/2-50,steps=4);p.mouse.up();state('wake');ck('home drag position',home.evaluate('e=>e.style.left!==""') and home.is_visible());advance(750);state('idle');ck('home drag no navigation',home.is_visible())
 go_sleep();advance(snap()['remaining']);state('wake');advance(750);state('idle');ck('home natural wake',home.is_visible());seed('dino',1000);p.click('[data-nav=home]');advance(300000);ck('older home never sleeps',snap() is None and p.locator('#petVisitor .pet-character').get_attribute('data-sleep-state') is None)
 cache=p.evaluate("async()=>{let c=await caches.open('household-asset-manager-v0.2.52');return(await c.keys()).map(r=>r.url)}")
 for n,meta in json.loads(Path('sleep-manifest.json').read_text()).items():
  ck('cache '+n,any(n+'?v=0252' in u for u in cache));actual=p.evaluate('''async url=>{const a=await(await fetch(url)).arrayBuffer();return {size:a.byteLength,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a))).map(x=>x.toString(16).padStart(2,'0')).join('')}}''',n+'?v=0252');ck('exact '+n,actual['size']==meta['bytes'] and actual['hash']==meta['sha256'])
 ck('SW controller and CSS',all(any(n in u for u in cache) for n in ['pet-sleep.css?v=0252','sleep-controller.js?v=0252']));ck('no errors',not errors);ck('no missing resources',not bad);b.close()
server.shutdown();Path('AI_QA_0252_sleep_browser.json').write_text(json.dumps({'count':len(checks),'checks':checks,'errors':errors,'bad':bad},indent=2));print('SLEEP BROWSER PASS',len(checks))
