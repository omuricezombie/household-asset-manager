from pathlib import Path
import os,json,base64,hashlib
from playwright.sync_api import sync_playwright
checks=[]
def ck(n,v):
 assert v,n
 checks.append(n)
root=Path('growth-deliverable');html=root/'pet_growth_hq_comparison_r1.html'
with sync_playwright() as pw:
 kwargs={'args':['--no-sandbox']}
 if os.getenv('QA_CHROMIUM'):kwargs['executable_path']=os.environ['QA_CHROMIUM']
 b=pw.chromium.launch(**kwargs);p=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2.5)
 errors=[];requests=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url) if r.url.startswith('http')else None)
 p.goto(html.resolve().as_uri());p.wait_for_function('window.qaReady===true')
 ck('no body overflow mobile',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 for s in ['animal','fantasy','fairy','yokai','dino']:
  p.select_option('#species',s);p.wait_for_function('window.qaReady===true')
  # Embedded material is byte identical, including adopted baby HQ.
  for stage in ['baby','teen','adult']:
   key=s+'-'+stage;data=p.evaluate('(k)=>payload[k]',key)
   path=Path('assets/hq-baby')/(s+'-base.webp') if stage=='baby' else Path('growth-output')/s/(key+'.webp')
   ck(key+' embedded exact',hashlib.sha256(base64.b64decode(data)).digest()==hashlib.sha256(path.read_bytes()).digest())
  for stage in ['teen','adult']:
   p.select_option('#stage',stage);p.wait_for_function('window.qaReady===true')
   ck(s+stage+' 4 directions',p.locator('#directions .card').count()==4)
   for d in ['front','left','back','right']:
    items=p.locator('#directions [data-direction="'+d+'"]')
    v=items.evaluate_all('els=>els.map(e=>{const im=e.querySelector(".pet-art-image");const g=e.querySelector(".geometry");const r=im.getBoundingClientRect(),q=g.getBoundingClientRect(),s=getComputedStyle(im);return {w:r.width,h:r.height,x:r.x-q.x,y:r.y-q.y,bg:s.backgroundImage,size:s.backgroundSize,px:s.backgroundPositionX,py:s.backgroundPositionY}})')
    ck(s+stage+d+' dimensions',len(v)==2 and all(abs(x['w']-128)<.01 and abs(x['h']-144)<.01 for x in v) and all(abs(v[0][k]-v[1][k])<.01 for k in ['x','y','w','h']))
    ck(s+stage+d+' HQ row',v[1]['size']=='400% 100%' and v[1]['py']=='0%')
    ck(s+stage+d+' same facing',v[0]['px']==v[1]['px'])
   for zoom in ['2','3','1']:
    p.select_option('#zoom',zoom);p.wait_for_function('window.qaReady===true');w=p.locator('#directions .enhanced .pet-art-image:first-child').first.evaluate('e=>e.getBoundingClientRect().width');ck(s+stage+' zoom'+zoom,abs(w-128*int(zoom))<.01)
   p.select_option('#mode','hq');p.wait_for_function('window.qaReady===true');ck(s+stage+' HQ only',p.locator('#directions .original').count()==0 and p.locator('#directions .enhanced').count()==4)
   p.select_option('#mode','compare');p.wait_for_function('window.qaReady===true')
  for direction in ['0','1','2','3']:
   p.select_option('#growth-direction',direction);p.wait_for_function('window.qaReady===true');ck(s+' growth direction '+direction,p.locator('#growth .sample').count()==3 and p.locator('#growth [data-direction="'+['front','left','back','right'][int(direction)]+'"]').count()==3)
  ck(s+' selected species only',p.evaluate('urls.size')==4)
  p.select_option('#growth-direction','0');p.wait_for_function('window.qaReady===true')
  # Internal screenshot only, not a Library deliverable.
  p.screenshot(path=str(root/(s+'-mobile.png')),full_page=True)
 for context in ['1.12','1','0.8']:
  p.select_option('#context',context);p.wait_for_function('window.qaReady===true');w=p.locator('#directions .enhanced .pet-art-image:first-child').first.evaluate('e=>e.getBoundingClientRect().width');ck('context '+context,abs(w-160*float(context))<.01)
 p.select_option('#background','#29473f');p.wait_for_function('window.qaReady===true');ck('background switch',p.evaluate('getComputedStyle(document.body).getPropertyValue("--surface").trim()')=='#29473f')
 p.emulate_media(reduced_motion='reduce');ck('static art has no animations',p.locator('.geometry .pet-character').first.evaluate('e=>e.getAnimations({subtree:true}).every(a=>a.playState!=="running")'))
 p.set_viewport_size({'width':1440,'height':1000});ck('no desktop overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 p.screenshot(path=str(root/'desktop.png'),full_page=True)
 # Offline standalone reload and switching: never depends on remote assets.
 p.context.set_offline(True);p.reload();p.wait_for_function('window.qaReady===true');p.select_option('#species','fairy');p.wait_for_function('window.qaReady===true');ck('standalone offline switch',p.locator('#directions .card').count()==4)
 # Fast switching race guards.
 p.evaluate('()=>{for(const s of ["animal","dino","fantasy","yokai"]){document.getElementById("species").value=s;render();}}');p.wait_for_function('window.qaReady===true');ck('rapid switch uses latest',all('pet-art-yokai' in x for x in p.locator('#directions .pet-unified').evaluate_all('es=>es.map(e=>e.className)')))
 ck('no JavaScript errors',not errors);ck('no external requests',not requests)
 version=b.version;b.close()
(root/'browser-qa.json').write_text(json.dumps({'count':len(checks),'checks':checks,'errors':errors,'requests':requests,'chromium':version,'viewports':['390x844 DPR2.5','1440x1000']},indent=2));print('browser PASS',len(checks))
