from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,base64,hashlib,time
out=Path('deliverable');checks=[];failures=[]
def ck(n,b):
 if not b:
  failures.append(n);print('FAIL',n,flush=True)
 checks.append(n)
with sync_playwright() as pw:
 browser=pw.chromium.launch(args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':412,'height':850},device_scale_factor=2.5)
 errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:external.append(r.url) if r.url.startswith('http') else None)
 page.goto((out/'pet_other_babies_hq_motion_qa.html').resolve().as_uri());page.wait_for_timeout(400)
 def css(which,selector='.pet-art-image:first-child'):
  return page.locator(which+' '+selector).evaluate('''el=>{let s=getComputedStyle(el);return {image:s.backgroundImage,size:s.backgroundSize,x:s.backgroundPositionX,y:s.backgroundPositionY,name:s.animationName,duration:s.animationDuration,timing:s.animationTimingFunction,w:s.width,h:s.height,opacity:s.opacity,left:s.left,top:s.top,display:s.display}}''')
 def sample(ms):
  page.locator('.pet-character').evaluate_all('(els,ms)=>{for(const el of els)for(const a of el.getAnimations({subtree:true})){a.pause();a.currentTime=ms}}',ms)
 def sha(c):
  m=re.search('base64,([A-Za-z0-9+/=]+)',c['image']);return hashlib.sha256(base64.b64decode(m[1])).hexdigest() if m else ''
 for species in ['dino','fantasy','yokai','fairy']:
  page.select_option('#species',species);page.locator('[data-dir=front]').click()
  hashes={g:hashlib.sha256((out/species/f'{species}-{g}-hq.webp').read_bytes()).hexdigest() for g in ['base','face','motion','food']}
  for direction in ['front','left','back','right']:
   page.locator('[data-dir='+direction+']').click();sample(0)
   h=css('.qa-hq');o=css('.qa-old')
   expected='face' if direction=='front' else 'base' if species=='dino' and direction=='back' else 'motion'
   ck(f'{species}/{direction}/source',sha(h)==hashes[expected]);ck(f'{species}/{direction}/size',(h['w'],h['h'])==(o['w'],o['h'])==('160px','180px'))
   ck(f'{species}/{direction}/animation',h['name'].removeprefix('hq-')==o['name'] and h['duration']==o['duration'] and h['timing']==o['timing'])
   if direction!='front':ck(f'{species}/{direction}/row',abs(float(h['y'].strip('%'))-({'left':0,'back':0,'right':100}[direction] if species=='dino' else {'left':100/3,'back':200/3,'right':100}[direction]))<.001)
   # Every animated phase keeps existing position/timing, with intended atlas packing changes only.
   for ms in [0,100,260,340,420,510,720,850,1050,1260,1400,1700,2000,2500]:
    sample(ms);h=css('.qa-hq');o=css('.qa-old');ck(f'{species}/{direction}/{ms}/x',h['x']==o['x'])
    ck(f'{species}/{direction}/{ms}/image',sha(h) in [hashes['face'],hashes['motion'],hashes['base']]);
    if sha(h) not in hashes.values():print('IMAGE_DIAGNOSTIC',species,direction,ms,h['image'][:60],sha(h),h['name'],flush=True)
    if species=='fairy' and direction=='front' and sha(h)==hashes['face']:ck(f'fairy/no-half/{ms}',h['x']!='50%')
  for mood in ['pet','food','calm']:
   page.locator('[data-dir=left]').click();page.locator('[data-mood='+mood+']').click();sample(0)
   ck(f'{species}/{mood}/front',page.locator('.qa-hq .pet-character').get_attribute('data-facing')=='front')
   for ms in ([0,200,450,550,700,900,1000,1200,1350,1650] if mood=='food' else [0,200,400,650,1100,1450,1650]):
    sample(ms);h=css('.qa-hq');o=css('.qa-old')
    if mood=='food':
     ck(f'{species}/food/{ms}/single',sha(h)==hashes['food'] and css('.qa-hq','.pet-care-chew')['display']=='none')
     ck(f'{species}/food/{ms}/frame',h['x']==('0%' if ms<478.5 else '100%' if (643.5<=ms<808.5 or 973.5<=ms<1138.5 or 1303.5<=ms<1468.5) else '50%'))
     a=css('.qa-hq','.pet-care-food');b=css('.qa-old','.pet-care-food')
     ck(f'{species}/food/{ms}/prop',all(a[k]==b[k] for k in ['x','y','left','top','w','h','opacity','duration']))
    else:
     ck(f'{species}/{mood}/{ms}/sprite',sha(h)==hashes['motion' if species=='yokai' and mood=='pet' else 'face'])
     ck(f'{species}/{mood}/{ms}/phase',all(h[k]==o[k] for k in ['x','y','size','duration']))
     if species=='fairy':ck(f'fairy/{mood}/no-half/{ms}',h['x']!='50%')
   # Start timers afresh, allow real-time return and action replacement.
   page.locator('[data-mood=food]').click();page.locator('[data-mood=pet]').click();ck(species+'/switch',page.locator('.qa-hq .pet-mood-pet').count()==1)
   page.wait_for_timeout(1800);ck(species+'/idle-return/'+mood,page.locator('.qa-hq .pet-mood-idle').count()==1)
  page.locator('[data-dir=front]').click();sample(0);page.screenshot(path='artifacts/'+species+'-browser.png',full_page=True)
  page.emulate_media(reduced_motion='reduce')
  for d in ['front','left','back','right']:
   page.locator('[data-dir='+d+']').click();ck(species+'/reduce/'+d,css('.qa-hq')['name']=='none')
  page.locator('[data-mood=food]').click();ck(species+'/reduce/food',css('.qa-hq')['name']=='none' and css('.qa-hq')['x']=='50%' and css('.qa-hq','.pet-care-food')['opacity']=='0')
  page.emulate_media(reduced_motion='no-preference')
 page.locator('#zoom').click();ck('zoom',page.locator('body').evaluate("e=>e.classList.contains('zoom')"));page.locator('#view').click();ck('hq only',not page.locator('.qa-old').is_visible());page.locator('#view').click();ck('old only',not page.locator('.qa-hq').is_visible());page.locator('#view').click();ck('both',page.locator('.qa-old').is_visible() and page.locator('.qa-hq').is_visible())
 # Decode all embedded assets once, tracking timings. Doesn't estimate Android GPU speed.
 html=(out/'pet_other_babies_hq_motion_qa.html').read_text();urls=list(set(re.findall(r'data:image/[^;]+;base64,[A-Za-z0-9+/=]+',html)))
 decoded=page.evaluate('''async urls=>{let t=performance.now();let a=await Promise.all(urls.map(async u=>{let im=new Image();im.src=u;await im.decode();return [im.naturalWidth,im.naturalHeight]}));return {ms:performance.now()-t,sizes:a}}''',urls)
 ck('all images decode',len(decoded['sizes'])==len(urls));ck('no JS errors',not errors);ck('no network',not external)
 (out/'browser_qa.json').write_text(json.dumps({'count':len(checks),'checks':checks,'failures':failures,'decoded':decoded,'errors':errors,'network':external},indent=2))
 browser.close()
print('checks',len(checks),'failures',len(failures));assert not failures,failures
