from pathlib import Path
import hashlib,json,subprocess,re
manifest=json.loads(Path('hq-baby-manifest.json').read_text())
for n,v in manifest.items():
 p=Path(n);assert p.stat().st_size==v['bytes'];assert hashlib.sha256(p.read_bytes()).hexdigest()==v['sha256']
for n in ['app.js','analysis.js','pet-game.js','dcard-import.js']:
 assert Path(n).read_bytes()==subprocess.check_output(['git','show','91e533ddd0f8934478536480e1cf0f207465d9c4:'+n]),n
s=Path('db.js').read_text().replace('0.2.48','0.2.47');assert s.encode()==subprocess.check_output(['git','show','91e533ddd0f8934478536480e1cf0f207465d9c4:db.js'])
css=Path('pet-game.css').read_text().replace('v=0248','v=0247');assert css.encode()==subprocess.check_output(['git','show','91e533ddd0f8934478536480e1cf0f207465d9c4:pet-game.css'])
for n in Path('.').glob('*.js'):subprocess.run(['node','--check',str(n)],check=True)
sw=Path('service-worker.js').read_text();assert 'household-asset-manager-v0.2.48' in sw
for n in manifest:assert './'+n+'?v=0248' in sw
print('PASS: 20 byte-identical assets, unchanged finance/state/reward logic, cache/version, JavaScript syntax')
