"""Touch regression using Chromium CDP. CI: actual app with temporary IndexedDB, local fallback: standalone memory fixture."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import http.server,threading,os,sys,json,datetime
checks=[];errors=[]
standalone='--standalone' in sys.argv
root=Path('.').resolve()
def ck(n,v):
 assert v,n
 checks.append(n)
 print('PASS',n,flush=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root),**kwargs)
 def log_message(self,*args):pass
server=None
if not standalone:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
 launch={'args':['--no-sandbox']}
 if os.environ.get('CHROMIUM_BIN'):launch['executable_path']=os.environ['CHROMIUM_BIN']
 b=pw.chromium.launch(**launch);ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=1)
 p=ctx.new_page();p.set_default_timeout(10000);p.on('pageerror',lambda e:errors.append(str(e)))
 if standalone:
  p.set_content(Path(os.environ.get('QA_HTML','artifacts/household_v0253_analysis_swipe_qa.html')).read_text(),wait_until='domcontentloaded')
 else:
  p.goto(f'http://localhost:{server.server_port}/index.html?v=0253',wait_until='domcontentloaded')
 p.wait_for_function('!!window.HAM?.DB&&!document.body.classList.contains("app-booting")');ck('boot expected version',p.evaluate('HAM.DB.APP_VERSION')=='0.2.53-candidate.1')
 if not standalone:
  p.add_script_tag(content=Path('tests/analysis_swipe_fixture.js').read_text());p.evaluate('seedAnalysisQA()')
  ck('isolated test IndexedDB schema',p.evaluate('HAM.DB.SCHEMA_VERSION')==2)
 p.locator('[data-nav=history]').click();p.wait_for_function('document.querySelector("#historyMerchants").textContent.includes("確認用食堂")')
 current=p.evaluate('HAM.DB.currentMonth()');prior=p.evaluate('HAM.DB.prevMonth(HAM.DB.currentMonth())');prior2=p.evaluate('HAM.DB.prevMonth(HAM.DB.prevMonth(HAM.DB.currentMonth()))')
 month=lambda:p.locator('#globalMonth').input_value()
 cdp=ctx.new_cdp_session(p)
 def place(sel):
  loc=p.locator(sel).first;loc.evaluate("e=>e.scrollIntoView({block:'center',inline:'nearest'})");p.wait_for_timeout(70);r=loc.bounding_box();assert r,sel
  return loc,max(40,min(350,r['x']+r['width']/2)),max(110,min(740,r['y']+min(25,r['height']/2)))
 def gesture(sel,dx,dy,stop='touchEnd',edge=False):
  loc,x,y=place(sel)
  if edge:x=20
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':0}]})
  for i in range(1,8):
   cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*i/7,'y':y+dy*i/7,'id':0}]});p.wait_for_timeout(12)
  cdp.send('Input.dispatchTouchEvent',{'type':stop,'touchPoints':[]});p.wait_for_timeout(130)
 def waitmonth(m):
  p.wait_for_function('m=>document.getElementById("globalMonth").value===m&&document.querySelector("#historyMonthly tr td")?.textContent===m',arg=m)
  p.wait_for_timeout(150)
 def pick(m):
  p.locator('#globalMonth').fill(m);p.locator('#globalMonth').dispatch_event('change');waitmonth(m)
 def readonly_data():
  return p.evaluate('async()=>JSON.stringify(await Promise.all(["transactions","assetSnapshots","pointSnapshots","settings"].map(s=>HAM.DB.getAll(s))))')
 ck('selected month current',month()==current);before=readonly_data();ck('initial test expense rendered','12,000' in p.locator('#historyCategories').inner_text())
 gesture('#historyCategories .bar-item',130,0);waitmonth(prior);ck('native chart right -> previous',month()==prior);ck('previous chart recalculated','13,000' in p.locator('#historyCategories').inner_text());ck('merchant changed to previous','確認用食堂 2' in p.locator('#historyMerchants').inner_text());ck('same history screen',p.locator('[data-screen=history]').get_attribute('class').endswith('active'))
 gesture('#historyMerchants .bar-item',130,0);waitmonth(prior2);ck('native merchant right -> previous',month()==prior2)
 gesture('#historyMeals .bar-item',-130,0);waitmonth(prior);ck('native meal left -> next',month()==prior)
 gesture('#historyCashflowChart .cashflow-month',-130,0);waitmonth(current);ck('native cashflow left -> next',month()==current)
 gesture('#historyCategories .bar-item',-130,0);ck('future month blocked',month()==current)
 gesture('#historyStockYoY',130,0);waitmonth(prior);ck('stock previous-year comparison swipe',month()==prior)
 gesture('#historyBankDeltaCard h2',-130,0);waitmonth(current);ck('bank delta heading swipe',month()==current)
 gesture('.history-swipe-hint',130,0);waitmonth(prior);ck('top analysis hint swipe',month()==prior)
 gesture('h2[data-history-swipe]',-130,0);waitmonth(current);ck('monthly table heading swipe',month()==current)
 loc,x,y=place('#historyCategories .bar-item');before_y=p.evaluate('scrollY');gesture('#historyCategories .bar-item',0,-180);ck('vertical scroll keeps month',month()==current);ck('vertical scroll actually scrolls',p.evaluate('scrollY')>before_y)
 gesture('#historyCategories .bar-item',45,0);ck('short gesture no month change',month()==current)
 gesture('#historyCategories .bar-item',100,-130);ck('diagonal scroll no month change',month()==current)
 gesture('#historyCategories .bar-item',130,0,stop='touchCancel');ck('cancel no month change',month()==current)
 # Native table horizontal movement must not be interpreted as month movement.
 table=p.locator('#historyMonthly').locator('xpath=../..');table.evaluate('e=>e.scrollLeft=0');gesture('#historyMonthly',-130,0);ck('horizontal table no month change',month()==current);ck('horizontal table still scrolls',table.evaluate('e=>e.scrollLeft')>0)
 gesture('#annualExpenseTotals',130,0);ck('annual totals excluded',month()==current)
 gesture('#livingCostCard',130,0);ck('annual quality analysis excluded',month()==current)
 gesture('#historyCashEditList .cash-date-edit-row',130,0);ck('editable card excluded',month()==current)
 p.locator('#historyMerchantEditWrap summary').click();p.locator('#historyMerchantFilter').fill('確認用');p.locator('#historyMerchantFilter').evaluate('e=>e.blur()');p.wait_for_timeout(150);gesture('#historyCategories .bar-item',130,0);waitmonth(prior);ck('merchant filter retained',p.locator('#historyMerchantFilter').input_value()=='確認用');ck('merchant details open retained',p.locator('#historyMerchantEditWrap').evaluate('e=>e.open'))
 ck('swipes did not modify finance or settings',readonly_data()==before)
 pick(current);ck('global picker still works',month()==current)
 pick('2000-01');gesture('.history-swipe-hint',130,0);ck('lower month boundary',month()=='2000-01')
 pick(current[:4]+'-01');gesture('.history-swipe-hint',130,0);waitmonth(str(int(current[:4])-1)+'-12');ck('December-January rollover',month()==str(int(current[:4])-1)+'-12')
 pick(current);p.locator('[data-nav=home]').click();p.wait_for_timeout(250)
 gesture('#homeAssetSummary button[data-asset-breakdown]',130,0);p.wait_for_function('m=>document.getElementById("globalMonth").value===m',arg=prior);p.wait_for_timeout(200);ck('existing home asset swipe',month()==prior);ck('swipe did not open breakdown',p.locator('#assetBreakdownInline').evaluate('e=>e.classList.contains("hidden")') and not p.locator('#assetBreakdownDialog').evaluate('e=>e.open'))
 p.locator('#homeAssetSummary button[data-asset-breakdown]').first.click();p.wait_for_timeout(200);ck('normal asset tap still works',not p.locator('#assetBreakdownInline').evaluate('e=>e.classList.contains("hidden")') or p.locator('#assetBreakdownDialog').evaluate('e=>e.open'))
 ck('no browser page errors',not errors)
 b.close()
if server:server.shutdown()
Path('AI_QA_0253_analysis_swipe.json').write_text(json.dumps({'mode':'standalone memory DB' if standalone else 'actual localhost IndexedDB','count':len(checks),'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print('ANALYSIS SWIPE PASS',len(checks))
