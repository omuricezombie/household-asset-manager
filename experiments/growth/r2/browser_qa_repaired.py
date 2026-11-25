from pathlib import Path
import json,base64,hashlib
from playwright.sync_api import sync_playwright
checks=[]
def ck(n,v):
 assert v,n
 checks.append(n)
out=Path('growth-r2-deliverable')
with sync_playwright()as pw:
 b=pw.chromium.launch(args=['--no-sandbox']);p=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2.5);errors=[];net=[]
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:net.append(r.url)if r.url.startswith('http')else None)
 p.goto((out/'pet_growth_hq_comparison_r2.html').resolve().as_uri());p.wait_for_function('qaReady===true')
 ck('r2 visible','r2'in p.locator('h1').inner_text());ck('no body overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 for s in ['dino','yokai']:
  p.select_option('#species',s);p.select_option('#stage','adult');p.wait_for_function('qaReady===true')
  expected=Path('growth-r2-output')/s/(s+'-adult.webp');embedded=base64.b64decode(p.evaluate('(k)=>payload[k]',s+'-adult'));ck(s+' byte exact embedded',embedded==expected.read_bytes())
  for context in ['0.8','1.12','1']:
   p.select_option('#context',context);p.wait_for_function('qaReady===true');scale=float(context)
   for direction in ['front','left','back','right']:
    els=p.locator('#directions [data-direction="'+direction+'"] .pet-art-image:first-child');v=els.evaluate_all('es=>es.map(e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,position:getComputedStyle(e).backgroundPosition,size:getComputedStyle(e).backgroundSize}})')
    ck(s+context+direction+' same width/scale',all(abs(x['w']-160*scale)<.02 for x in v))
    ck(s+context+direction+' foot anchor preserved',abs((v[0]['y']+v[0]['h'])-(v[1]['y']+v[1]['h']))<.02)
    ck(s+context+direction+' upper extension',abs((v[0]['y']-v[1]['y'])-8*scale)<.02)
   p.select_option('#zoom','2');p.wait_for_function('qaReady===true');w=p.locator('#directions .enhanced .pet-art-image:first-child').first.evaluate('e=>e.getBoundingClientRect().width');ck(s+context+' enlarged width',abs(w-320*scale)<.02);p.select_option('#zoom','1');p.wait_for_function('qaReady===true')
  p.select_option('#context','0.8');p.wait_for_function('qaReady===true');p.screenshot(path=str(out/(s+'-adult-mobile.png')),full_page=True)
  p.select_option('#mode','hq');p.wait_for_function('qaReady===true');ck(s+' HQ only',p.locator('#directions .enhanced').count()==4 and p.locator('#directions .original').count()==0);p.select_option('#mode','compare');p.wait_for_function('qaReady===true')
  for d in ['0','1','2','3']:
   p.select_option('#growth-direction',d);p.wait_for_function('qaReady===true');ck(s+' growth '+d,p.locator('#growth .sample').count()==3)
 for s in ['animal','fantasy','fairy','yokai','dino']:
  p.select_option('#species',s);p.select_option('#stage','teen');p.wait_for_function('qaReady===true');ck(s+' teen unaffected',p.locator('#directions .enhanced .pet-art-image:first-child').first.evaluate('e=>getComputedStyle(e).height')=='180px')
  for stage in ['baby','teen','adult']:
   if stage=='adult'and s in ['dino','yokai']:continue
   original=Path('assets/hq-baby')/(s+'-base.webp')if stage=='baby'else Path('assets/hq-growth')/(s+'-'+stage+'.webp')
   ck(s+stage+' unchanged embedded',base64.b64decode(p.evaluate('(k)=>payload[k]',s+'-'+stage))==original.read_bytes())
 p.context.set_offline(True);p.reload();p.wait_for_function('qaReady===true');p.select_option('#species','yokai');p.select_option('#stage','adult');p.wait_for_function('qaReady===true');ck('offline repaired adult switch',p.locator('#directions .enhanced').count()==4)
 ck('no JS errors',not errors);ck('no HTTP requests',not net);version=b.version;b.close()
(out/'browser-qa.json').write_text(json.dumps({'count':len(checks),'checks':checks,'errors':errors,'network':net,'chromium':version},indent=2));print('browser PASS',len(checks))
