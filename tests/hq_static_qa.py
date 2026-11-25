from pathlib import Path
import hashlib,json,subprocess,re
checks=[]
def ck(n,v):
 assert v,n
 checks.append(n)
def prior(n):return subprocess.check_output(['git','show','3d6100c0789db0b7376e83671f5797c07f31eb1d:'+n])
for name in ['hq-baby-manifest.json','hq-growth-manifest.json']:
 for n,v in json.loads(Path(name).read_text()).items():
  p=Path(n);ck(n+' SHA/bytes',p.stat().st_size==v['bytes']and hashlib.sha256(p.read_bytes()).hexdigest()==v['sha256'])
  if 'hq-growth'in n:ck(n+' approved Git bytes',p.read_bytes()==subprocess.check_output(['git','show','8727b3444d364315f909294c3d16e5f72bea29a7:'+n]))
for n in ['app.js','analysis.js','pet-game.js','dcard-import.js','manifest.webmanifest','assets/pet-unified-atlas.webp']:
 ck(n+' unchanged',Path(n).read_bytes()==prior(n))
ck('DB only version changed',Path('db.js').read_text().replace('0.2.49','0.2.48').encode()==prior('db.js'))
ck('pet-game CSS only asset version changed',Path('pet-game.css').read_text().replace('v=0249','v=0248').encode()==prior('pet-game.css'))
ck('baby HQ CSS unchanged prefix',Path('pet-hq.css').read_bytes().startswith(prior('pet-hq.css')))
for p in Path('.').glob('*.js'):subprocess.run(['node','--check',str(p)],check=True)
ck('JavaScript syntax',True)
sw=Path('service-worker.js').read_text();ck('cache version',"household-asset-manager-v0.2.49"in sw)
files=re.findall(r"'([^']+)'",sw.split('const FILES=')[1].split('];')[0]);ck('cache duplicates absent',len(files)==len(set(files)))
for f in files:ck('cache file '+f,(Path(f.split('?')[0]).is_file()or f=='./')and('?'not in f or'?v=0249'in f))
ck('all30 HQ assets cached',sum('/hq-baby/'in f or'/hq-growth/'in f for f in files)==30)
ck('HTML asset versions',all('v=0249'in u for u in re.findall(r'(?:src|href)="([^"]+\.(?:css|js)[^"]*)"',Path('index.html').read_text())))
# Byte-exact baby markup after normalizing the resource-version query; invalid-input defaults are preserved.
node='''const fs=require('fs'),vm=require('vm');function run(code){let c={window:{}};vm.runInNewContext(code,c);return c.window.HAM.PetIllustration;}let before=run(process.argv[1]),after=run(fs.readFileSync('pet-illustration.js','utf8'));for(let type of before.types)for(let direction of ['front','left','back','right'])for(let mood of ['idle','pet','food','calm']){let o={type,direction,mood,stage:'baby',affection:72};if(before.draw(o)!==after.draw(o).replaceAll('0249','0248'))throw Error('baby markup changed');}if(before.draw({type:'invalid',stage:'invalid',direction:'invalid'})!==after.draw({type:'invalid',stage:'invalid',direction:'invalid'}).replaceAll('0249','0248'))throw Error('default changed');'''
subprocess.run(['node','-e',node,prior('pet-illustration.js').decode()],check=True);ck('80 baby paths and defaults unchanged',True)
Path('AI_QA_0249_static.json').write_text(json.dumps({'count':len(checks),'checks':checks},indent=2));print('STATIC PASS',len(checks))
