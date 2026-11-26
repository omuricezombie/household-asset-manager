from pathlib import Path
import json,threading,http.server,functools,tempfile,tarfile,io,subprocess,time,hashlib
from playwright.sync_api import sync_playwright
checks=[];errors=[];bad=[]
def ck(n,v):
 assert v,n
 checks.append(n)
root=Path('.').resolve();base=tempfile.TemporaryDirectory();tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','c0b89eed408a9698e7525e774c932fe1e0bedc10'])),mode='r:').extractall(base.name,filter='data')
class Handler(http.server.SimpleHTTPRequestHandler):
 current=root
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(self.current),**kwargs)
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright()as pw:
 b=pw.chromium.launch(args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2.5);p=ctx.new_page();images=[]
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:bad.append((r.url,r.status))if r.status>=400 else None);p.on('request',lambda r:images.append(r.url)if'/hq-growth/'in r.url else None)
 p.goto('http://localhost:8765/hq-integration-qa.html');p.wait_for_timeout(300)
 ck('only selected growth sheet requested initially',len(images)==1 and'animal-teen.webp'in images[0]);ck('diagnostic mobile overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 def pause():p.locator('.pet-character').evaluate('e=>{for(const a of e.getAnimations({subtree:true})){a.pause();a.currentTime=0}}')
 for s in ['animal','fantasy','fairy','yokai','dino']:
  p.select_option('#species',s)
  for stage in ['teen','adult']:
   p.select_option('#stage',stage)
   for direction in ['front','left','back','right']:
    p.click('[data-dir='+direction+']');pause()
    v=p.locator('.pet-art-image:first-child').evaluate('e=>{let s=getComputedStyle(e);return {image:s.backgroundImage,w:s.width,h:s.height,y:s.backgroundPositionY,x:s.backgroundPositionX,size:s.backgroundSize,top:s.top}}')
    ext=stage=='adult'and s in ['dino','yokai'];key=s+'/'+stage+'/'+direction
    ck(key+' correct HQ',f'/hq-growth/{s}-{stage}.webp?v=0251c1'in v['image']);ck(key+' correct layout',v['w']=='160px'and v['h']==('188px'if ext else'180px')and v['size']=='400% 100%'and v['y']=='0%')
    ck(key+' correct facing',abs(float(v['x'].strip('%'))-['front','left','back','right'].index(direction)*100/3)<.0001)
    # Check actual room/home/choice CSS against a cloned old-layout node.
    for context in ['room','home','choice']:
     result=p.evaluate('''({s,stage,direction,context})=>{let host=document.createElement('div');host.className=context==='room'?'pet-stage':context==='home'?'pet-visitor':'pet-choice';const art=HAM.PetIllustration.draw({type:s,stage,direction});host.innerHTML='<span class="pet-character">'+art+'</span><span class="pet-character">'+art+'</span>';for(const el of host.querySelectorAll('*'))el.style.setProperty('animation','none','important');host.style.setProperty('animation','none','important');document.body.append(host);const [a,z]=host.querySelectorAll('.pet-unified');z.classList.remove('pet-hq-growth','pet-hq-extended');for(let an of host.getAnimations({subtree:true})){an.pause();an.currentTime=0}let data=[a,z].map(el=>{let r=el.querySelector('.pet-art-image').getBoundingClientRect(),c=el.parentElement.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x-c.x,bottom:r.bottom-c.y,top:r.top-c.y,scale:getComputedStyle(el.parentElement).scale}});host.remove();return data}''',{'s':s,'stage':stage,'direction':direction,'context':context})
     a,z=result;
     if ext and abs(z['top']-a['top']-8*a['w']/160)>=.03:print('geometry details',key,context,result,flush=True)
     ck(key+'/'+context+' body width/x/foot unchanged',all(abs(a[k]-z[k])<.03 for k in ['w','x','bottom']));ck(key+'/'+context+' extra top correct',abs(z['top']-a['top']-(8*a['w']/160 if ext else 0))<.03)
     if context=='home':ck(key+'/actual home1.24',a['scale']=='1.24')
 # Representative older-stage interactions share unchanged pet-game/CSS logic.
 p.select_option('#species','dino');p.select_option('#stage','adult')
 for mood in ['pet','food','calm']:
  p.click('[data-dir=left]');p.click('[data-mood='+mood+']');pause();ck('older '+mood+' stays facing left',p.locator('.pet-character').get_attribute('data-facing')=='left');ck('older '+mood+' HQ retained','dino-adult.webp'in p.locator('.pet-art-image:first-child').evaluate('e=>getComputedStyle(e).backgroundImage'))
  p.wait_for_timeout(3300 if mood=='calm'else 1800);ck('older '+mood+' returns idle',p.locator('.pet-mood-idle').count()==1)
 p.emulate_media(reduced_motion='reduce');ck('reduced motion applies',p.locator('.pet-character').evaluate('e=>e.getAnimations({subtree:true}).every(a=>a.playState!=="running")'));p.emulate_media(reduced_motion='no-preference')
 p.select_option('#stage','baby');p.select_option('#species','animal');p.click('[data-dir=front]');pause();ck('baby still uses approved face','hq-baby/animal-face.webp'in p.locator('.pet-art-image:first-child').evaluate('e=>getComputedStyle(e).backgroundImage'))
 # Validate standalone artifact is the same candidate renderer/CSS and fully offline.
 p.goto((root/'artifacts/household_v0_2_51_candidate_1_growth_QA.html').as_uri());p.wait_for_timeout(300);ck('standalone candidate version','0.2.51-candidate.1'in p.locator('h1').inner_text());p.select_option('#species','yokai');p.select_option('#stage','adult');p.click('[data-dir=right]');pause();ck('standalone extended height',p.locator('.pet-art-image:first-child').evaluate('e=>getComputedStyle(e).height')=='188px');p.screenshot(path='artifacts/integration-mobile.png',full_page=True)
 # Stable -> candidate SW upgrade at the same origin; no DB deletion or PWA reinstall.
 fresh=b.new_context();fp=fresh.new_page();fp.goto('http://localhost:8765/index.html?v=0251c1');fp.wait_for_function('window.HAM?.DB&& !document.body.classList.contains("app-booting")');fp.evaluate('async()=>{await navigator.serviceWorker.ready}');fp.wait_for_function('navigator.serviceWorker.controller!==null');fresh_cache=fp.evaluate("async()=>{let result={};for(let k of await caches.keys()){result[k]=(await(await caches.open(k)).keys()).map(r=>r.url)}return result}");print('fresh cache sizes',{k:len(v)for k,v in fresh_cache.items()},flush=True);fresh.close()
 upgrade=b.new_context(viewport={'width':390,'height':844});pg=upgrade.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));sw_events=[];cdp=upgrade.new_cdp_session(pg);cdp.on('ServiceWorker.workerVersionUpdated',lambda e:sw_events.append(e));cdp.send('ServiceWorker.enable');Handler.current=Path(base.name)
 pg.goto('http://localhost:8765/index.html?v=0250');pg.wait_for_function('window.HAM?.DB&& !document.body.classList.contains("app-booting")');pg.evaluate('async()=>{await navigator.serviceWorker.ready}');pg.wait_for_function('navigator.serviceWorker.controller!==null');ck('baseline stable boot','v0.2.50'in pg.locator('.app-header .sub').inner_text())
 pg.evaluate("async()=>{await HAM.DB.put('settings',{key:'qaSyntheticUpgradeSentinel',value:'synthetic-only-keep'});await HAM.DB.put('transactions',{id:'qa-synthetic-income',date:'2026-11-01',month:'2026-11',kind:'income',amount:1234,paymentMethod:'bank_transfer',category:'その他',subCategory:'その他',sourceType:'manual',createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z',qaSynthetic:true});}")
 before_update=pg.evaluate("async()=>{let result={};for(let k of await caches.keys()){result[k]=(await(await caches.open(k)).keys()).map(r=>r.url)}return result}")
 Handler.current=root
 pg.evaluate('async()=>{window.__previousController=navigator.serviceWorker.controller;let r=await navigator.serviceWorker.getRegistration();await r.update()}')
 pg.evaluate("""async()=>{const deadline=performance.now()+90000;while(performance.now()<deadline){const r=await navigator.serviceWorker.getRegistration();const keys=await caches.keys();if(r?.active?.state==='activated'&&!r.installing&&!r.waiting&&navigator.serviceWorker.controller!==window.__previousController&&keys.includes('household-asset-manager-v0.2.51-candidate.1')&&!keys.includes('household-asset-manager-v0.2.50')){const c=await caches.open('household-asset-manager-v0.2.51-candidate.1');const n=(await c.keys()).filter(x=>x.url.includes('/hq-baby/')||x.url.includes('/hq-growth/')).length;if(n>=30)return true;}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Candidate SW activation and cache completion timeout');}""")
 after_update=pg.evaluate("async()=>{let result={};for(let k of await caches.keys()){result[k]=(await(await caches.open(k)).keys()).map(r=>r.url)}return result}")
 pg.reload();pg.wait_for_function('window.HAM?.DB&& !document.body.classList.contains("app-booting")');ck('candidate version after update','v0.2.51-candidate.1'in pg.locator('.app-header .sub').inner_text());ck('sentinel preserved',pg.evaluate("async()=>(await HAM.DB.get('settings','qaSyntheticUpgradeSentinel')).value")=='synthetic-only-keep');ck('synthetic transaction preserved',pg.evaluate("async()=>(await HAM.DB.get('transactions','qa-synthetic-income')).amount")==1234)
 after_reload=pg.evaluate("async()=>{let result={};for(let k of await caches.keys()){result[k]=(await(await caches.open(k)).keys()).map(r=>r.url)}return result}");sw_source=pg.evaluate("async()=>(await(await fetch('service-worker.js',{cache:'reload'})).text()).slice(0,130)");Path('artifacts/cache-diagnostics.json').write_text(json.dumps({'fresh':fresh_cache,'before':before_update,'afterUpdate':after_update,'afterReload':after_reload,'servedSW':sw_source,'workerEvents':sw_events},indent=2));print('cache diagnostics',{phase:{k:len(v)for k,v in val.items()}for phase,val in [('before',before_update),('afterUpdate',after_update),('afterReload',after_reload)]},sw_source,flush=True)
 urls=pg.evaluate("async()=>{let c=await caches.open('household-asset-manager-v0.2.51-candidate.1');return (await c.keys()).filter(r=>r.url.includes('/hq-baby/')||r.url.includes('/hq-growth/')).map(r=>r.url)}");current_urls=[u for u in urls if '?v=0251c1'in u];old_client_urls=[u for u in urls if '?v=0251c1'not in u];print('cache current/old-client',len(current_urls),len(old_client_urls),flush=True);ck('all30 current-version HQ cache',len(current_urls)==30);ck('current page CSS/JS versions',pg.evaluate("performance.getEntriesByType('resource').filter(r=>/\\.(js|css)(\\?|$)/.test(r.name)&&!r.name.includes('service-worker.js')).every(r=>r.name.includes('v=0251c1'))"));ck('old cache removed only after activation',pg.evaluate("async()=>!(await caches.keys()).includes('household-asset-manager-v0.2.50')"));ck('schema unchanged',pg.evaluate('HAM.DB.SCHEMA_VERSION')==2)
 upgrade.set_offline(True);pg.reload(wait_until='domcontentloaded');pg.wait_for_function('window.HAM?.DB&& !document.body.classList.contains("app-booting")');ck('candidate offline boot','v0.2.51-candidate.1'in pg.locator('.app-header .sub').inner_text());ck('sentinel after offline reload',pg.evaluate("async()=>(await HAM.DB.get('settings','qaSyntheticUpgradeSentinel')).value")=='synthetic-only-keep')
 for n,info in json.loads(Path('hq-growth-manifest.json').read_text()).items():
  result=pg.evaluate("async url=>{let r=await fetch(url);let b=await r.arrayBuffer();let digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');return{ok:r.ok,bytes:b.byteLength,sha:digest}}",n+'?v=0251c1');ck('offline exact '+n,result['ok']and result['bytes']==info['bytes']and result['sha']==info['sha256'])
 upgrade.close();ck('no JS errors',not errors);ck('no missing diagnostic assets',not bad);version=b.version;b.close()
Path('AI_QA_0251c1.json').write_text(json.dumps({'count':len(checks),'checks':checks,'errors':errors,'bad_http':bad,'chromium':version,'cachedCurrentHQ':len(current_urls),'cachedOldClientHQ':old_client_urls},indent=2));print('BROWSER PASS',len(checks));server.shutdown();base.cleanup()
