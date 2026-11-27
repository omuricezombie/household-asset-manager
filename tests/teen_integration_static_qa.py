"""Verify exact stable baseline and new teen asset/cache integrity. Optional stable archive for local QA."""
from pathlib import Path
import hashlib,json,re,subprocess,zipfile,os
checks=[]
def ck(n,v):
 assert v,n
 checks.append(n)
archive=os.environ.get('STABLE_ZIP')
z=zipfile.ZipFile(archive) if archive else None
base='d7b4ea1d819b7da9ba6d02b42e077de3da62e358'
def prior(n):return z.read('household-asset-manager/'+n) if z else subprocess.check_output(['git','show',base+':'+n])
for n in ['app.js','analysis.js','dcard-import.js','styles.css','manifest.webmanifest','pet-hq.css','pet-ball.css','pet-brush.css','sleep-controller.js','pet-art.js','hq-baby-manifest.json','hq-growth-manifest.json','sleep-manifest.json']:
 ck(n+' stable bytes',Path(n).read_bytes()==prior(n))
for n in ['pet-game.css','pet-sleep.css','pet-illustration.js']:
 ck(n+' query version only',Path(n).read_bytes().replace(b'0252c1',b'0251')==prior(n))
ck('db version only',Path('db.js').read_bytes().replace(b'0.2.52-candidate.1',b'0.2.51')==prior('db.js'))
old=prior('pet-game.js').decode();new=Path('pet-game.js').read_text()
for start,end in [('const KEY=','let state='),('function fresh()','async function replaceStoredData'),('todayReset();\n    const p=active();','p.lastAction=DB.now()'),('function points()','function characterHtml'),('function createAward(','function startPet(')]:
 if start in old and end in old:
  ck('stable logic '+start,old.split(start,1)[1].split(end,1)[0]==new.split(start,1)[1].split(end,1)[0])
for p in Path('assets').rglob('*'):
 if p.is_file() and 'hq-teen' not in p.parts:ck(str(p)+' stable bytes',p.read_bytes()==prior(str(p)))
manifest=json.loads(Path('teen-art-manifest.json').read_text());sw=Path('service-worker.js').read_text();files=re.findall(r"'([^']+)'",sw.split('const FILES=')[1].split('];')[0]);ck('cache version',"household-asset-manager-v0.2.52-candidate.1" in sw);ck('no duplicate cache keys',len(files)==len(set(files)))
for n,meta in manifest.items():
 b=Path(n).read_bytes();ck(n+' approved bytes/hash',len(b)==meta['bytes'] and hashlib.sha256(b).hexdigest()==meta['sha256']);ck(n+' cached','./'+n+'?v=0252c1' in files)
for n in files:ck('cache exists '+n,Path(n.split('?')[0]).exists())
for n in ['pet-teen.css','teen-art-data.js','pet-teen.js']:
 ck(n+' cached and loaded','./'+n+'?v=0252c1' in files and n+'?v=0252c1' in Path('index.html').read_text())
for p in Path('.').glob('*.js'):subprocess.run(['node','--check',str(p)],check=True);ck(str(p)+' syntax',True)
Path('AI_QA_0252c1_teen_static.json').write_text(json.dumps({'count':len(checks),'checks':checks},indent=2));print('TEEN STATIC PASS',len(checks))
