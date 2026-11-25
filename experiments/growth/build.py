from pathlib import Path
import base64,json,re,shutil,hashlib
root=Path('.');out=Path('growth-deliverable');out.mkdir(exist_ok=True)
def b64(p):return base64.b64encode(p.read_bytes()).decode()
payload={'original':b64(root/'assets/pet-unified-atlas.webp')};manifest={}
for species in ['animal','fantasy','fairy','yokai','dino']:
 for stage in ['baby','teen','adult']:
  p=root/'assets/hq-baby'/f'{species}-base.webp' if stage=='baby' else root/'growth-output'/species/f'{species}-{stage}.webp'
  payload[f'{species}-{stage}']=b64(p)
  dest=out/'assets'/('hq-baby' if stage=='baby' else 'hq-growth')/p.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
  manifest[str(dest.relative_to(out))]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
css=re.sub(r'url\([^)]*\)','none',(root/'pet-game.css').read_text())
html=(root/'experiments/growth/template.html').read_text().replace('/*PRODUCTION_CSS*/',css).replace('/*RENDERER*/',(root/'pet-illustration.js').read_text()).replace('/*PAYLOAD*/',json.dumps(payload,separators=(',',':')))
(out/'pet_growth_hq_comparison_r1.html').write_text(html)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
shutil.copyfile(root/'assets/pet-unified-atlas.webp',out/'assets/pet-unified-atlas.webp')
print('HTML bytes',len(html.encode()),'HQ growth bytes',sum(v['bytes']for k,v in manifest.items()if 'hq-growth' in k))
