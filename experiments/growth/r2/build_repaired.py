from pathlib import Path
from PIL import Image
import base64,json,re,hashlib,shutil
out=Path('growth-r2-deliverable');out.mkdir(exist_ok=True);payload={};manifest={}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def embed(key,path):
 payload[key]=base64.b64encode(path.read_bytes()).decode();dest=out/'assets'/path.name;dest.parent.mkdir(exist_ok=True);shutil.copyfile(path,dest);manifest[key]={'file':path.name,'bytes':path.stat().st_size,'sha256':sha(path),'size':Image.open(path).size}
embed('original',Path('assets/pet-unified-atlas.webp'))
for s in ['animal','fantasy','fairy','yokai','dino']:
 for stage in ['baby','teen','adult']:
  p=Path('assets/hq-baby')/(s+'-base.webp') if stage=='baby' else Path('assets/hq-growth')/(s+'-'+stage+'.webp')
  if stage=='adult'and s in ['yokai','dino']:p=Path('growth-r2-output')/s/(s+'-adult.webp')
  embed(s+'-'+stage,p)
template=Path('experiments/growth/template.html').read_text().replace('比較 r1','比較 r2').replace('比較 r1','比較 r2')
template=template.replace('基本イラストのみの静止比較です。','恐竜・妖怪の成体上部を元イラストから復元した修正版です。基本イラストのみの静止比較です。')
template=template.replace("box.style.setProperty('--sheet'", "if(hq&&stage==='adult'&&['dino','yokai'].includes(type)){const image=box.querySelector('.pet-art-image');image.style.height='188px';image.style.top='-8px';image.style.bottom='auto';image.style.width='160px';}\n box.style.setProperty('--sheet'")
template=template.replace('HQ640×720px。','HQ640×720px（恐竜・妖怪の成体のみ上部余白を追加して640×752px、表示時に上へ8px補正。身体の倍率と足元の位置は維持）。')
css=re.sub(r'url\([^)]*\)','none',Path('pet-game.css').read_text())
html=template.replace('/*PRODUCTION_CSS*/',css).replace('/*RENDERER*/',Path('pet-illustration.js').read_text()).replace('/*PAYLOAD*/',json.dumps(payload,separators=(',',':')))
(out/'pet_growth_hq_comparison_r2.html').write_text(html);(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('HTML bytes',len(html.encode()))
