"""Independent source/alpha/pixels/bytes integrity checks; no inference."""
from pathlib import Path
import json,hashlib,numpy as np
from PIL import Image
checks=[]
def ck(n,v):
 assert v,n
 checks.append(n)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
a=Image.open('assets/pet-unified-atlas.webp').convert('RGBA')
ck('atlas SHA-256',sha(Path('assets/pet-unified-atlas.webp'))=='5c82c1a5ec5d671daaea600ea1ff6d114e0e7e121f8c31748148850289f2f0e6')
manifest=json.loads(Path('hq-baby-manifest.json').read_text())
for p,v in manifest.items():ck('unchanged baby '+p,sha(Path(p))==v['sha256'] and Path(p).stat().st_size==v['bytes'])
files=[]
for row,s in enumerate(['animal','fantasy','fairy','yokai','dino']):
 q=json.loads((Path('growth-output')/s/'qa.json').read_text())
 ck(s+' model SHA',q['weights_sha256']=='f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da')
 ck(s+' count',len(q['frames'])==8)
 for offset,stage in [(1,'teen'),(2,'adult')]:
  p=Path('growth-output')/s/f'{s}-{stage}.webp';im=Image.open(p).convert('RGBA')
  info=next(x for x in q['sprites']if x['stage']==stage)
  ck(s+stage+' size',im.size==(2560,720));ck(s+stage+' SHA',sha(p)==info['sha256']);ck(s+stage+' bytes',p.stat().st_size==info['bytes'])
  for d in range(4):
   src=a.crop((d*320,row*1080+offset*360,(d+1)*320,row*1080+(offset+1)*360))
   hq=im.crop((d*640,0,(d+1)*640,720))
   ck(f'{s}/{stage}/{d} alpha',hq.getchannel('A').tobytes()==src.getchannel('A').resize((640,720),Image.Resampling.LANCZOS).tobytes())
   ck(f'{s}/{stage}/{d} visible',hq.getchannel('A').getextrema()[1]>0)
  files.append({'species':s,'stage':stage,'bytes':p.stat().st_size,'sha256':sha(p),'rgba_bytes':2560*720*4})
ck('10 sprites/40 frames',len(files)==10)
result={'count':len(checks),'checks':checks,'files':files,'new_bytes':sum(x['bytes']for x in files),'existing_baby_bytes':sum(v['bytes']for v in manifest.values()),'new_rgba_all_bytes':10*2560*720*4,'new_rgba_one_sheet_bytes':2560*720*4,'note':'RGBA lower bound, excludes browser/GPU/encoded bytes. One selected growth sheet per app surface; offline CacheStorage holds all encoded assets.'}
Path('growth-deliverable/integrity-qa.json').write_text(json.dumps(result,indent=2));print('integrity PASS',len(checks),result['new_bytes'])
