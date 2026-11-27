"""Chromium real candidate DOM/rendering + transient QA DB. URL navigation restricted environments can use set_content."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys,os,time
checks=[];errors=[];warnings=[]
def ck(n,v):
 if not v:raise AssertionError(n)
 checks.append(n); print('PASS',n,flush=True)
html=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/household_v0252_teen_human_qa.html').read_text()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox']);p=b.new_page(viewport={'width':390,'height':844});p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:warnings.append(m.text) if m.type in ['error','warning'] else None)
 p.clock.install();p.set_content(html,wait_until='domcontentloaded',timeout=30000);p.wait_for_function('window.__qaReady===true');
 def snap():return p.evaluate('HAM.PetGame._test.sleepSnapshot()')
 def save():return p.evaluate('__qa.save()')
 def seed(k,pts=250):
  p.evaluate('async({k,pts})=>{await __qa.reset(k,pts)}',{'k':k,'pts':pts});p.wait_for_function('document.querySelector("#petAvatar .pet-character")?.dataset.type===\''+k+'\'')
  if 250<=pts<1000:p.wait_for_function('document.querySelector("#petAvatar .pet-illustration")?.dataset.teenLive==="true"')
 def advance(ms):p.clock.fast_forward(int(ms)+30)
 def state(s):p.wait_for_function('(s)=>HAM.PetGame._test.sleepSnapshot()?.state===s',arg=s,timeout=5000)
 def click(a):p.evaluate('(a)=>document.querySelector(`[data-pet-action=${a}]`).click()',a)
 def idle():p.wait_for_function('document.querySelector("#petAvatar .teen-live")?.dataset.action==="idle"',timeout=5000)
 def action(a):
  click(a);p.wait_for_function('(a)=>document.querySelector("#petAvatar .teen-live")?.dataset.action===a',arg=a,timeout=5000)
 def nav(n):p.evaluate('__qa.nav('+json.dumps(n)+')')
 for k in ['animal','fantasy','fairy','dino','yokai']:
  seed(k);c=p.locator('#petAvatar .teen-live canvas');ch=p.locator('#petAvatar .pet-character');layer=ch.locator('.teen-live');before=save()
  ck(k+' Lv3 teen',ch.get_attribute('data-growth')=='teen' and p.locator('#petLevel').inner_text()=='Lv. 3');ck(k+' adopted room size',120<=c.bounding_box()['width']<=138);ck(k+' nonempty canvas',c.evaluate('c=>c.getContext("2d").getImageData(0,0,640,720).data.some((v,i)=>i%4===3&&v>0)'))
  ck(k+' locked later action',p.locator('[data-pet-action=feast]').is_disabled());ck(k+' brush ball unlocked',p.locator('[data-pet-action=brush]').is_enabled() and p.locator('[data-pet-action=ball]').is_enabled());
  for a,d in [('pet',1700),('feed',1700),('rest',3200),('brush',2700),('ball',4100)]:
   action(a);ck(k+' '+a+' active',layer.get_attribute('data-action')==a);ck(k+' '+a+' parent paused',ch.evaluate('e=>getComputedStyle(e).animationPlayState')=='paused');
   if a in ['ball','brush']:
    prop=layer.locator('.teen-ball' if a=='ball' else '.teen-brush-prop');ck(k+' '+a+' prop visible',prop.evaluate('e=>getComputedStyle(e).display')=='block');ck(k+' '+a+' animation',prop.evaluate('e=>getComputedStyle(e).animationName').startswith('teen-'))
   if a=='ball':advance(800);ck(k+' ball faces right',c.get_attribute('data-direction')=='right');advance(d-800)
   else:advance(d)
   idle();state('idle');ck(k+' '+a+' return',layer.get_attribute('data-action')=='idle')
  ck(k+' original reward total cap',save()['activePet']['affection']==40 and save()['activePet']['daily']['used']==10);ck(k+' points unchanged',save()['awards']==before['awards']);
  # sleep / home sharing: same normal state machine with shortened QA idle/sleep durations.
  before=save();advance(snap()['remaining']);state('drowsy');ck(k+' drowsy',ch.get_attribute('data-sleep-state')=='drowsy');advance(3600);state('sleep');ck(k+' sleep marker',ch.get_attribute('data-sleep-state')=='sleep');ck(k+' zzz',ch.locator('.pet-sleep-zzz').evaluate('e=>getComputedStyle(e).display')=='block');ck(k+' accepted sleep pose',c.get_attribute('data-sleep-pose')==str(k in ['animal','fairy']).lower());ck(k+' sleep renderer no interval',p.evaluate('!HAM.PetTeen._test.running()'))
  remain=snap()['remaining'];nav('home');p.wait_for_function('document.querySelector("#petVisitor .pet-illustration")?.dataset.teenLive==="true"');ck(k+' home same sleep',p.locator('#petVisitor .pet-character').get_attribute('data-sleep-state')=='sleep' and abs(snap()['remaining']-remain)<2000);ck(k+' home size',p.locator('#petVisitor .teen-live canvas').bounding_box()['width']<128)
  nav('input');ck(k+' input pauses',snap()['paused']);r=snap()['remaining'];advance(20000);ck(k+' no timer in input',not p.evaluate('HAM.PetTeen._test.running()') and snap()['remaining']==r);nav('pet');p.wait_for_function('document.querySelector("#petAvatar .pet-illustration")?.dataset.teenLive==="true"');ck(k+' return resumes',snap()['state']=='sleep' and not snap()['paused']);ck(k+' navigation no reward',save()==before)
  click('brush');state('wake');advance(750);p.wait_for_function('document.querySelector("#petAvatar .teen-live")?.dataset.action==="brush"');advance(2700);idle();state('idle');ck(k+' queued brush after wake',True)
 # repeated action, interrupt, leave screen, reduce, adult and baby boundaries
 seed('animal');action('ball');advance(700);action('ball');advance(700);ck('repeat ball remains active',p.locator('#petAvatar .teen-live').get_attribute('data-action')=='ball');action('brush');ck('ball interrupted by brush',p.locator('#petAvatar .teen-ball').evaluate('e=>getComputedStyle(e).display')=='none');nav('input');ck('exit cancels transient renderer',not p.evaluate('HAM.PetTeen._test.running()'));nav('pet');p.wait_for_function('document.querySelector("#petAvatar .teen-live")?.dataset.action==="idle"');ck('return idle',True)
 p.emulate_media(reduced_motion='reduce');action('ball');ck('reduced ball no animation',p.locator('#petAvatar .teen-ball').evaluate('e=>getComputedStyle(e).animationName')=='none');advance(4100);idle();p.emulate_media(reduced_motion='no-preference');
 seed('dino',1000);ck('adult unchanged renderer',p.locator('#petAvatar .pet-character').get_attribute('data-growth')=='adult' and not p.locator('#petAvatar .teen-live').count() and snap() is None)
 seed('animal',100);ck('baby renderer unchanged',p.locator('#petAvatar .pet-character').get_attribute('data-growth')=='baby' and not p.locator('#petAvatar .teen-live').count() and snap()['state']=='idle');click('ball');ck('baby ball class',p.locator('#petAvatar .pet-character').get_attribute('data-action')=='ball');advance(4100);state('idle')
 ck('no JS errors',not errors);ck('no console errors/warnings',not warnings);b.close()
report={'count':len(checks),'checks':checks,'errors':errors,'warnings':warnings,'scope':'real Chromium; actual candidate PetGame + CSS + asset bytes, in-memory synthetic DB, accelerated clocks; no real IndexedDB/SW/URL'}
Path('AI_QA_0252_teen_live_browser.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print('TEEN LIVE BROWSER PASS',len(checks))
