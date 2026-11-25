from pathlib import Path
import json,threading,http.server,functools,hashlib
from playwright.sync_api import sync_playwright
root=Path('.');checks=[]
def ck(name,ok):
 assert ok,name
 checks.append(name)
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
 b=pw.chromium.launch(args=['--no-sandbox']);p=b.new_page(viewport={'width':412,'height':850},device_scale_factor=2.5);errors=[];bad=[]
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:bad.append(r.url) if r.status>=400 else None)
 p.goto('http://127.0.0.1:8765/hq-integration-qa.html')
 def css():return p.locator('.pet-art-image:first-child').evaluate('e=>{let s=getComputedStyle(e);return {image:s.backgroundImage,size:s.backgroundSize,x:s.backgroundPositionX,y:s.backgroundPositionY,w:s.width,h:s.height,name:s.animationName,duration:s.animationDuration}}')
 def sample(ms):p.locator('.pet-character').evaluate('(el,t)=>{for(let a of el.getAnimations({subtree:true})){a.pause();a.currentTime=t}}',ms)
 for s in ['animal','dino','fantasy','yokai','fairy']:
  p.select_option('#species',s)
  for d in ['front','left','back','right']:
   p.click('[data-dir='+d+']');sample(0);v=css();g='face' if d=='front' else 'base' if d=='back' and s in ['animal','dino'] else 'motion'
   ck(s+'/'+d+'/asset',f'/hq-baby/{s}-{g}.webp' in v['image']);ck(s+'/'+d+'/size',(v['w'],v['h'])==('160px','180px'))
   expectedY=0 if d=='front' or (s in ['animal','dino'] and d!='right') else 100 if d=='right' else 100/3 if d=='left' else 200/3
   ck(s+'/'+d+'/row',abs(float(v['y'].strip('%'))-expectedY)<.001)
   if d=='front':
    for ms in [340,420,510,850,1260,1400,1700]:
     sample(ms);v=css();g='motion' if (s in ['fantasy'] and ms in [340,420,510]) or (s=='fairy' and ms in [340,420]) or (s=='yokai' and ms in [340,420,510]) else None
     ck(s+'/front/'+str(ms)+'/hq',f'/hq-baby/{s}-' in v['image'])
     if g:ck(s+'/front/'+str(ms)+'/motion',f'{s}-{g}.webp' in v['image'])
  for mood in ['pet','food','calm']:
   p.click('[data-dir=left]');p.click('[data-mood='+mood+']');sample(600);v=css();g='food' if mood=='food' else 'motion' if s=='yokai' and mood=='pet' else 'face'
   ck(s+'/'+mood+'/asset',f'{s}-{g}.webp' in v['image']);ck(s+'/'+mood+'/front',p.locator('.pet-character').get_attribute('data-facing')=='front')
   if mood=='food':ck(s+'/single-food',p.locator('.pet-care-chew').evaluate('e=>getComputedStyle(e).display')=='none')
   p.click('[data-mood='+mood+']');p.wait_for_timeout(3300 if mood=='calm' else 1800);ck(s+'/'+mood+'/idle',p.locator('.pet-mood-idle').count()==1)
  p.emulate_media(reduced_motion='reduce');p.click('[data-mood=food]');ck(s+'/reduced-food',css()['name']=='none' and css()['x']=='50%');p.emulate_media(reduced_motion='no-preference')
 # Older stages must not opt into HQ paths.
 ck('teen/adult unchanged',p.evaluate("['teen','adult'].every(stage=>HAM.PetIllustration.types.every(type=>!HAM.PetIllustration.draw({type,stage}).includes('pet-hq')))"))
 p.goto('http://127.0.0.1:8765/index.html?v=0248c1');p.wait_for_timeout(1800)
 ck('app boot',p.locator('body.app-booting').count()==0);ck('app version','v0.2.48-candidate.1' in p.locator('.app-header .sub').inner_text());ck('DB schema',p.evaluate('HAM.DB.SCHEMA_VERSION')==2)
 ck('no JS errors',not errors);ck('no missing assets',not bad)
 b.close()
Path('AI_QA_0248c1.json').write_text(json.dumps({'count':len(checks),'checks':checks,'errors':errors,'bad_http':bad},indent=2));print('PASS',len(checks))
server.shutdown()
