"""Exact approved integration bytes and complete runtime delta from v0.2.53."""
from pathlib import Path
import hashlib,json,os,re,subprocess
P=Path('.'); spec=json.loads(Path('tests/pet_room_provenance.json').read_text());base=spec['base_commit'];local=os.environ.get('QA_STABLE_DIR');checks=[]
def ck(n,v):
 assert v,n
 checks.append(n)
def runtime(n):return not n.startswith(('tests/','.github/','artifacts/','AI_QA_','.git/')) and n not in ('.gitignore','hq-integration-qa.html') and not n.startswith(('README','RELEASE_'))
def sha(b):return hashlib.sha256(b).hexdigest()
if local:
 B=Path(local);old={str(p.relative_to(B)) for p in B.rglob('*') if p.is_file() and '.git' not in p.relative_to(B).parts};prior=lambda n:(B/n).read_bytes()
else:
 old=set(subprocess.check_output(['git','ls-tree','-r','--name-only',base],text=True).splitlines());prior=lambda n:subprocess.check_output(['git','show',base+':'+n])
old={n for n in old if runtime(n)};now={str(p) for p in P.rglob('*') if p.is_file() and runtime(str(p))};delta=spec['approved_runtime_delta'];ck('no removed runtime paths',old<=now);ck('only approved new runtime paths',now-old==set(delta)-old)
for n in sorted(now):
 actual=Path(n).read_bytes()
 if n in delta:ck('approved integration SHA256 '+n,sha(actual)==delta[n]);ck('changed or new '+n,n not in old or actual!=prior(n))
 else:ck('stable runtime bytes '+n,actual==prior(n))
ck('QA fixture only version changes',Path('hq-integration-qa.html').read_bytes()==prior('hq-integration-qa.html').replace(b'0253',b'0254c1').replace(b'0.2.53',b'0.2.54-candidate.1'));ck('QA fixture digest',sha(Path('hq-integration-qa.html').read_bytes())==spec['qa_fixture_sha256'])
for n in ['DB_NAME','DB_VERSION','SCHEMA_VERSION']:
 pattern=rb'const '+n.encode()+rb'=[^;]+;';ck(n+' unchanged',re.search(pattern,Path('db.js').read_bytes()).group()==re.search(pattern,prior('db.js')).group())
for n in ['analysis.js','dcard-import.js','styles.css','pet-art.js','teen-art-data.js']:ck('finance/renderer unchanged '+n,Path(n).read_bytes()==prior(n))
sw=Path('service-worker.js').read_text();files=re.findall(r"'([^']+)'",sw.split('const FILES=')[1].split('];')[0]);ck('candidate cache identity',"const CACHE='household-asset-manager-v0.2.54-candidate.1';" in sw);ck('no duplicate keys',len(files)==len(set(files))==149)
for n in files:ck('valid cache '+n,(Path(n.split('?')[0]).exists()) and ('?' not in n or n.endswith('?v=0254c1')))
html=Path('index.html').read_text();urls=re.findall(r'(?:src|href)="([^"]+\.(?:css|js)[^"]*)"',html)
for n in urls:ck('HTML version + cache '+n,n.endswith('?v=0254c1') and './'+n in files)
for n in sorted(Path('assets/habitats').glob('*.webp')):ck('habitat cache '+str(n),'./'+str(n) in files)
for n in sorted(P.glob('*.js')):subprocess.run(['node','--check',str(n)],check=True);ck('syntax '+str(n),True)
Path('AI_QA_0254_room_static.json').write_text(json.dumps({'count':len(checks),'checks':checks},indent=2));print('ROOM STATIC PASS',len(checks))
