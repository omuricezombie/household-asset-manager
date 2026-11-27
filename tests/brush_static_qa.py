from pathlib import Path
import subprocess,hashlib,json
checks=[]
def ck(n,v):assert v,n;checks.append(n)
prior=lambda n:subprocess.check_output(['git','show','047dab29dbd89e1c801d2aece576510d07b3a05b:'+n])
# Literal fingerprints from the downloaded and SHA-256-verified approved r1.
ck('r1 brush SVG',hashlib.sha256(Path('assets/pet-care-brush.svg').read_bytes()).hexdigest()=='408d0b96abf8b74de316fcb05a9a37121d9d45c9ce8ca6c4d8db255fc86d7585')
old=prior('pet-game.js').decode();new=Path('pet-game.js').read_text().replace("label:'お手入れ'","label:'ブラッシング'").replace("reply:'きれいにお手入れできた！'","reply:'毛並みがふわふわになった！'")
for start,end in [('const ACTIONS=','let state='),('function fresh()','function normalizePet'),('function normalizePet','async function replaceStoredData'),('function points()','function characterHtml'),('todayReset();\n    const p=active();','p.lastAction=DB.now()')]:
 ck('unchanged '+start,old.split(start,1)[1].split(end,1)[0]==new.split(start,1)[1].split(end,1)[0])
ck('db version only',Path('db.js').read_text().replace('0.2.53','0.2.49').encode()==prior('db.js'))
ck('ball action unchanged',old.split("{id:'ball'",1)[1].split('\n',1)[0]==new.split("{id:'ball'",1)[1].split('\n',1)[0])

c1css=subprocess.check_output(['git','show','9113e2d943294f977e1459fe78c5393303dc4fcf:pet-brush.css']).decode()
css=Path('pet-brush.css').read_text()
for key in ['stroke','lean','happy']:
 def block(t):return t.split('@keyframes brush250-'+key,1)[1].split('@',1)[0].strip()
 ck('approved shared '+key,block(css)==block(c1css))
ck('existing HQ CSS byte exact',Path('pet-hq.css').read_bytes()==subprocess.check_output(['git','show','9113e2d943294f977e1459fe78c5393303dc4fcf:pet-hq.css']))

Path('AI_QA_0253_provenance.json').write_text(json.dumps({'count':len(checks),'checks':checks},indent=2));print('PROVENANCE PASS',len(checks))
