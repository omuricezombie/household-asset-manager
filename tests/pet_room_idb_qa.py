"""Real Chromium IndexedDB + actual DB backup code. Synthetic data, isolated origin.
Run on GitHub Actions or a machine permitting loopback HTTP. Not a UI test.
"""
import functools, http.server, threading, json, pathlib, subprocess, os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OLD='e0907a4502d78375610df88d8c66626a772876f8'
checks=[]
old_db=pathlib.Path(os.environ['QA_STABLE_DB']).read_bytes() if os.environ.get('QA_STABLE_DB') else subprocess.check_output(['git','show',OLD+':db.js'],cwd=ROOT)
class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ('/qa-room','/qa-room-old'):
            old=self.path.endswith('-old'); data=b'<!doctype html><meta charset=utf-8><script src="'+(b'/qa-old-db.js' if old else b'/db.js')+b'"></script>'+ (b'' if old else b'<script src="/pet-room-store.js"></script>')
            self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(data);return
        if self.path=='/qa-old-db.js':
            self.send_response(200);self.send_header('Content-Type','application/javascript');self.end_headers();self.wfile.write(old_db);return
        super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}'
def ck(name,value):
    assert value,name
    checks.append(name);print('PASS',name,flush=True)
try:
    with sync_playwright() as pw:
        kwargs={'headless':True,'args':['--no-sandbox']}
        if os.environ.get('CHROMIUM_BIN'):kwargs['executable_path']=os.environ['CHROMIUM_BIN']
        browser=pw.chromium.launch(**kwargs);ctx=browser.new_context(service_workers='block');p=ctx.new_page();p.goto(url+'/qa-room-old');p.evaluate('HAM.DB.open()')
        p.evaluate('''async()=>{await HAM.DB.seed();await HAM.DB.put('settings',{key:'qaSentinel',value:'old retained'});await HAM.DB.put('transactions',{id:'qa-synthetic-income',date:'2026-01-01',month:'2026-01',kind:'income',category:'給与',amount:1234});await HAM.DB.put('settings',{key:'petGameStateV1',value:{version:2,enabled:true,activePet:{id:'a',affection:100},awards:{'2026-01':{points:500,petId:'a'},'2026-02':{points:500,petId:'b'},'2026-03':{points:500,petId:'b'}}}})}''')
        old_backup=p.evaluate('HAM.DB.buildBackup()');p.goto(url+'/qa-room');p.evaluate('''async()=>{window.s=PetRoomStore.create(await HAM.DB.open());}''')
        ck('old DB unchanged, new key missing',p.evaluate('''async()=>!(await HAM.DB.get('settings',PetRoomStore.KEY))&&(await s.load()).wallet.balance===300&&(await HAM.DB.get('transactions','qa-synthetic-income')).amount===1234'''))
        q=ctx.new_page();q.goto(url+'/qa-room');q.evaluate('''async()=>{window.s=PetRoomStore.create(await HAM.DB.open());const ch=new BroadcastChannel('qa-purchase');ch.onmessage=async e=>{const r=await s.purchase(e.data,'a');ch.postMessage({ok:r.ok,reason:r.reason});};window.ch=ch;}''')
        ck('concurrent tabs duplicate guard',p.evaluate('''async()=>{const ch=new BroadcastChannel('qa-purchase');const remote=new Promise(r=>ch.onmessage=e=>r(e.data));ch.postMessage('stars');const a=await Promise.all([s.purchase('stars','a'),remote]);ch.close();return a.filter(x=>x.ok).length===1&&(await s.load()).wallet.balance===150;}'''))
        ck('concurrent tabs cannot overspend',p.evaluate('''async()=>{const ch=new BroadcastChannel('qa-purchase');const remote=new Promise(r=>ch.onmessage=e=>r(e.data));ch.postMessage('box');const a=await Promise.all([s.purchase('plant','a'),remote]);ch.close();return a.filter(x=>x.ok).length===1&&(await s.load()).wallet.balance>=0;}'''))
        room={'version':1,'rest':'bed','item':'none','bg':'stars','positions':[{'x':.1,'y':.9},{'x':.9,'y':.9}]};p.evaluate('(room)=>s.saveRoom("a",room,null)',room)
        ck('other tab reads committed placement',q.evaluate('async()=> (await s.load()).state.rooms.a.bg==="stars"'))
        p.evaluate('(room)=>s.saveRoom("a",{...room,rest:"none"},room)',room)
        ck('other tab stale compare-and-set rejected',q.evaluate('''async room=>{try{await s.saveRoom('a',room,room);return false}catch{return (await s.load()).state.rooms.a.rest==='none'}}''',room))
        ck('aborted actual transaction leaves committed placement',p.evaluate('''async room=>{const old=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,...args){const req=old.call(this,v,...args);if(v.key===PetRoomStore.KEY)this.transaction.abort();return req};try{await s.saveRoom('a',room);return false}catch{return (await s.load()).state.rooms.a.rest==='none'}finally{IDBObjectStore.prototype.put=old}}''',room))
        q.close();backup=p.evaluate('HAM.DB.buildBackup()');ck('JSON backup includes room and finance records',any(x['key']=='petRoomRewardsV1' for x in backup['stores']['settings']) and any(x['id']=='qa-synthetic-income' for x in backup['stores']['transactions']))
        p.reload();p.evaluate('async()=>{window.s=PetRoomStore.create(await HAM.DB.open())}');ck('reload preserves purchases and placement',p.evaluate('async()=> (await s.load()).state.rooms.a.bg==="stars"'))
        p.evaluate('b=>HAM.DB.restoreBackup(b)',old_backup);ck('old JSON restores without creating room key',p.evaluate('async()=>!(await HAM.DB.get("settings",PetRoomStore.KEY))&&(await s.load()).wallet.balance===300'))
        p.evaluate('b=>HAM.DB.restoreBackup(b)',backup);ck('new JSON restores exact room',p.evaluate('async()=> (await s.load()).state.rooms.a.bg==="stars"'))
        ck('invalid furniture backup rejected before writes',p.evaluate('''async b=>{b=structuredClone(b);b.stores.settings.find(x=>x.key===PetRoomStore.KEY).value.version=99;b.integrity.dataHash=await HAM.DB.sha256Text(HAM.DB.stableStringify(b.stores));try{await HAM.DB.restoreBackup(b);return false}catch{return (await s.load()).state.version===1&&(await HAM.DB.get('transactions','qa-synthetic-income')).amount===1234}}''',backup))
        p.goto(url+'/qa-room-old');p.evaluate('HAM.DB.open()');ck('rollback old code reads finance and exports room key',p.evaluate('''async()=>{const b=await HAM.DB.buildBackup();return b.appVersion==='0.2.53'&&b.stores.settings.some(x=>x.key==='petRoomRewardsV1')&&(await HAM.DB.get('transactions','qa-synthetic-income')).amount===1234}'''))
        p.evaluate('HAM.DB.put("settings",{key:"qaSentinel",value:"rollback edited"})');old_after=p.evaluate('HAM.DB.buildBackup()');p.goto(url+'/qa-room');p.evaluate('async()=>{window.s=PetRoomStore.create(await HAM.DB.open())}');p.evaluate('b=>HAM.DB.restoreBackup(b)',old_after);ck('upgrade again retains room and old-version edits',p.evaluate('''async()=> (await s.load()).state.rooms.a.bg==='stars'&&(await HAM.DB.get('settings','qaSentinel')).value==='rollback edited' '''))
        browser.close()
finally:
    server.shutdown();server.server_close()
    (ROOT/'AI_QA_0254_room_idb.json').write_text(json.dumps({'checks':checks,'environment':'real Chromium IndexedDB; actual old/new db.js; synthetic data'},ensure_ascii=False,indent=2))
print('TOTAL',len(checks))
