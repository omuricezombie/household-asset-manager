from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
import json,threading,http.server,hashlib,base64,subprocess
checks=[];errors=[];bad=[]
def ck(n,v):
 assert v,n
 checks.append(n)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8766),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
 b=pw.chromium.launch(args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2.5);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:bad.append([r.url,r.status])if r.status>=400 else None)
 p.goto(Path('artifacts/pet_brushing_5_babies_v0252.html').resolve().as_uri());p.wait_for_timeout(150)
 ck('care action label',p.locator('#brushBtn').inner_text()=='お手入れ')
 ck('all offline assets decode',p.evaluate('''async()=>{for(const u of Object.values(urls)){let i=new Image();i.src=u;await i.decode()}return true}'''))
 for s in ['fantasy','fairy','yokai','dino','animal']:
  p.select_option('#species',s);p.click('#brushBtn');p.wait_for_timeout(50)
  ck(s+' brush displayed',p.locator('.pet-care-brush').evaluate('e=>getComputedStyle(e).display')=='block')
  expected_tool={'fairy':'pet-care-hairbrush.svg','yokai':'pet-care-cloth.svg','dino':'pet-care-sponge.svg'}.get(s,'pet-care-brush.svg')
  ck(s+' correct tool',p.locator('.pet-care-brush').evaluate('(e,url)=>getComputedStyle(e).backgroundImage.includes(url)',p.evaluate('k=>urls[k]','assets/'+expected_tool)))
  ck(s+' correct path',p.locator('.pet-care-brush').evaluate('e=>getComputedStyle(e).animationName')=={'fairy':'brush250-hair','yokai':'brush250-cloth','dino':'brush250-sponge'}.get(s,'brush250-stroke'))
  ck(s+' correct reply',p.locator('#petSpeech').inner_text()==p.evaluate('s=>HAM.PetIllustration.careReply(s)',s))
  ck(s+' unchanged 160x180',p.locator('.pet-illustration').evaluate('e=>e.offsetWidth===160&&e.offsetHeight===180'))
  ck(s+' wander paused',p.locator('.pet-character').evaluate('e=>getComputedStyle(e).animationPlayState')=='paused')
  for t in [430,870,1450,1870,2260]:
   p.evaluate('''t=>{for(const a of document.querySelector('.pet-illustration').getAnimations({subtree:true})){a.pause();a.currentTime=t}}''',t);p.wait_for_timeout(20)
   if t in [870,1450,1870]and s!='yokai':ck(s+f' closed at {t}',p.locator('.pet-art-image').first.evaluate('e=>getComputedStyle(e).backgroundPositionX')==('50%'if s=='animal'else'100%'))
   if s=='yokai':ck('yokai uses adopted tail '+str(t),p.locator('.pet-art-image').first.evaluate('e=>getComputedStyle(e).backgroundSize')=='500% 400%')
   p.locator('.pet-room').screenshot(path=f'artifacts/brush-{s}-{t}.png')
  p.click('#brushBtn');p.wait_for_timeout(60);ck(s+' repeat restart',p.locator('.pet-care-brush').evaluate('e=>e.getAnimations()[0].currentTime')<350)
  for action,name in [('pet','pet247-care-pet-eyes'if s!='yokai'else'pet247-care-pet-yokai'),('feed','pet247-care-food-hq-frames'),('rest','pet247-care-calm-eyes'if s!='yokai'else'none')]:
   p.click('[data-action='+action+']');p.wait_for_timeout(30);ck(s+' switch '+action,p.locator('.pet-care-brush').evaluate('e=>getComputedStyle(e).display')=='none');ck(s+' existing '+action,p.locator('.pet-art-image').first.evaluate('e=>getComputedStyle(e).animationName')==name);p.click('#brushBtn')
  p.wait_for_timeout(2800);ck(s+' idle return',p.locator('.pet-character').get_attribute('data-action')=='');ck(s+' no residual brush',p.locator('.pet-care-brush').evaluate('e=>getComputedStyle(e).display')=='none')
  p.emulate_media(reduced_motion='reduce');p.click('#brushBtn');p.wait_for_timeout(30);ck(s+' reduced prop static',p.locator('.pet-care-brush').evaluate('e=>getComputedStyle(e).animationName==="none"&&getComputedStyle(e).opacity==="1"'));ck(s+' reduced correct face',p.locator('.pet-art-image').first.evaluate('e=>getComputedStyle(e).backgroundPositionX')==('0%'if s=='yokai'else'50%'if s=='animal'else'100%'));p.emulate_media(reduced_motion='no-preference');p.click('[data-action=idle]')
 ck('offline no overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 # Actual app: real public API, synthetic IndexedDB in isolated browser context only.
 p.goto('http://localhost:8766/index.html');p.wait_for_function('window.HAM?.PetGame&&!document.body.classList.contains("app-booting")')
 def seed(species,pts=100):
  p.evaluate('''async({species,pts})=>{const D=HAM.DB;await HAM.PetGame.replaceStoredData(async()=>{await D.put('settings',{key:'petGameStateV1',value:{version:2,enabled:true,startedMonth:'2026-11',activePet:{id:'qa-only',type:species,name:'QA synthetic',startedMonth:'2026-11',bornAt:D.now(),affection:30,traits:{pet:0,food:0,play:0,calm:0},daily:{date:D.ymd(),used:0,traitsUsed:0}},collection:[],awards:{'2026-11':{points:pts,bonus:0,items:[],petId:'qa-only'}}}})})}''',{'species':species,'pts':pts})
 seed('animal');p.click('[data-nav=pet]');p.wait_for_selector('[data-pet-action=brush]')
 for s in ['animal','fantasy','fairy','yokai','dino']:
  seed(s);p.wait_for_timeout(80);p.click('[data-pet-action=brush]');p.wait_for_timeout(60)
  ck('app '+s+' dedicated brush',p.locator('#petAvatar .pet-character').get_attribute('data-action')=='brush')
  ck('app '+s+' care button label',p.locator('[data-pet-action=brush]').inner_text().find('お手入れ')>=0)
  ck('app '+s+' reply',p.locator('#petSpeech').inner_text().startswith(p.evaluate('s=>HAM.PetIllustration.careReply(s)',s)))
  ck('app '+s+' prop visible',p.locator('#petAvatar .pet-care-brush').evaluate('e=>getComputedStyle(e).display')=='block')
  saved=p.evaluate("async()=>(await HAM.DB.get('settings','petGameStateV1')).value")
  ck('app '+s+' gain2 cap retained',saved['activePet']['affection']==32 and saved['activePet']['daily']['used']==2)
  ck('app '+s+' no visual saved',not any(x in json.dumps(saved)for x in ['visualAction','actionSequence','data-action']))
  # Dispatch without waiting, exercise concurrent async persist and stale timers.
  p.evaluate("()=>{for(const id of ['brush','feed','brush','pet','brush'])document.querySelector('[data-pet-action='+id+']').click()}");p.wait_for_timeout(100)
  ck('app '+s+' rapid final brush',p.locator('#petAvatar .pet-character').get_attribute('data-action')=='brush')
  p.click('[data-pet-action=feed]');p.wait_for_timeout(40);ck('app '+s+' switch hides',p.locator('#petAvatar .pet-care-brush').evaluate('e=>getComputedStyle(e).display')=='none')
  p.click('[data-pet-action=brush]');p.wait_for_timeout(2800);ck('app '+s+' idle return',p.locator('#petAvatar .pet-mood-idle').count()==1 and p.locator('#petAvatar .pet-character').get_attribute('data-action')=='')
 seed('dino',0);p.wait_for_timeout(50);ck('Lv1 brush locked',p.locator('[data-pet-action=brush]').is_disabled())
 seed('dino',450);p.wait_for_function('document.querySelector("#petAvatar .pet-illustration")?.dataset.teenLive==="true"');p.click('[data-pet-action=brush]');p.wait_for_function('document.querySelector("#petAvatar .teen-live")?.dataset.action==="brush"');ck('teen dedicated brush',p.locator('#petAvatar .pet-character').get_attribute('data-action')=='brush' and p.locator('#petAvatar .pet-character').get_attribute('data-growth')=='teen')
 seed('fairy');p.wait_for_timeout(50);p.click('[data-pet-action=brush]');p.click('[data-nav=home]');p.click('[data-nav=pet]');p.wait_for_timeout(2850);ck('navigation returns idle',p.locator('#petAvatar .pet-mood-idle').count()==1)
 p.evaluate('async()=>{await navigator.serviceWorker.ready}');p.wait_for_function('navigator.serviceWorker.controller')
 cache=p.evaluate("async()=>{let c=await caches.open('household-asset-manager-v0.2.52');return(await c.keys()).map(x=>x.url)}")
 ck('SW brush CSS and SVG cached',all(any(n in u for u in cache)for n in ['pet-brush.css?v=0252','pet-care-brush.svg','pet-care-hairbrush.svg','pet-care-cloth.svg','pet-care-sponge.svg']))
 ck('all30 HQ cached',sum('/hq-baby/'in u or'/hq-growth/'in u for u in cache)==30)
 ck('app version',p.evaluate('HAM.DB.APP_VERSION')=='0.2.52')
 ck('no JS errors',not errors);ck('no missing requests',not bad)
 b.close()
server.shutdown()
# Internal contact sheet for visual review, not a deliverable.
canvas=Image.new('RGB',(1500,1250),'#17212a');d=ImageDraw.Draw(canvas)
for row,s in enumerate(['animal','fantasy','fairy','yokai','dino']):
 for col,t in enumerate([430,870,1450,1870,2260]):
  im=Image.open(f'artifacts/brush-{s}-{t}.png').convert('RGB');im.thumbnail((298,225));x=col*300;y=row*250;canvas.paste(im,(x,y+20));d.text((x+4,y+3),f'{s} {t}ms',fill='white')
canvas.save('artifacts/brush-contact-internal.png')
Path('AI_QA_0252_brush.json').write_text(json.dumps({'count':len(checks),'checks':checks,'errors':errors,'bad':bad},indent=2));print('BRUSH PASS',len(checks))
