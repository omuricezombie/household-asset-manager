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
  p.wait_for_function('HAM.PetGame._test.sleepSnapshot()?.state==="idle"' if pts<250 else 'HAM.PetGame._test.sleepSnapshot()===null')
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
 seed('animal',100);go_sleep();p.evaluate("()=>{for(const id of ['ball','feed','brush'])document.querySelector('[data-pet-action='+id+']').click()}");state('wake');advance(750);p.wait_for_function('document.querySelector("#petAvatar .pet-character").dataset.action==="brush"');ck('latest action only after wake',save()['activePet']['daily']['used']==2);advance(2700);state('idle');go_sleep();p.click('[data-nav=home]');ck('leave room clears timer',snap() is None);p.click('[data-nav=pet]');state('idle');ck('no stale sleep state',p.locator('#petAvatar .pet-character').get_attribute('data-sleep-state') is None)
 go_sleep();advance(snap()['remaining']);state('wake');advance(750);state('idle');ck('natural wake',True)
 go_sleep();seed('dino',450);ck('teen never starts sleep',snap() is None);advance(150000);ck('teen unchanged',snap() is None)
 seed('fairy');p.emulate_media(reduced_motion='reduce');go_sleep();ck('reduced motion zzz static',p.locator('#petAvatar .pet-sleep-zzz').evaluate('e=>getComputedStyle(e).animationName')=='none');p.emulate_media(reduced_motion='no-preference')
 cache=p.evaluate("async()=>{let c=await caches.open('household-asset-manager-v0.2.51-candidate.1');return(await c.keys()).map(r=>r.url)}")
 for n,meta in json.loads(Path('sleep-manifest.json').read_text()).items():
  ck('cache '+n,any(n+'?v=0251c1' in u for u in cache));actual=p.evaluate('''async url=>{const a=await(await fetch(url)).arrayBuffer();return {size:a.byteLength,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a))).map(x=>x.toString(16).padStart(2,'0')).join('')}}''',n+'?v=0251c1');ck('exact '+n,actual['size']==meta['bytes'] and actual['hash']==meta['sha256'])
 ck('SW controller and CSS',all(any(n in u for u in cache) for n in ['pet-sleep.css?v=0251c1','sleep-controller.js?v=0251c1']));ck('no errors',not errors);ck('no missing resources',not bad);b.close()
server.shutdown();Path('AI_QA_0251c1_sleep_browser.json').write_text(json.dumps({'count':len(checks),'checks':checks,'errors':errors,'bad':bad},indent=2));print('SLEEP BROWSER PASS',len(checks))
