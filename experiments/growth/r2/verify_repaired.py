from pathlib import Path
import hashlib,json,numpy as np
from PIL import Image
checks=[]
def ck(n,v):
 assert v,n
 checks.append(n)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for path,info in json.loads(Path('hq-baby-manifest.json').read_text()).items():ck('baby unchanged '+path,sha(Path(path))==info['sha256'])
manifest=json.loads(Path('experiments/growth/manifest.json').read_text())
for key,info in manifest.items():
 if 'hq-growth' in key:ck('r1 baseline '+key,sha(Path(key))==info['sha256'])
for s in ['dino','yokai']:
 original=Image.open('assets/hq-growth/'+s+'-adult.webp').convert('RGBA');hq=Image.open('growth-r2-output/'+s+'/'+s+'-adult.webp').convert('RGBA');source=Image.open('experiments/growth/r2/'+s+'-adult-source.webp').convert('RGBA')
 ck(s+' dimensions',hq.size==(2560,752));qa=json.loads(Path('growth-r2-output/'+s+'/qa.json').read_text());ck(s+' model',qa['model_sha256']=='f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da')
 for d in range(4):
  im=hq.crop((d*640,0,(d+1)*640,752));src=source.crop((d*320,0,(d+1)*320,376));old=original.crop((d*640,0,(d+1)*640,720))
  ck(s+str(d)+' alpha exact',im.getchannel('A').tobytes()==src.getchannel('A').resize((640,752),Image.Resampling.LANCZOS).tobytes())
  ck(s+str(d)+' unchanged lower body',im.crop((0,292,640,752)).tobytes()==old.crop((0,260,640,720)).tobytes())
  ck(s+str(d)+' top transparent margin',np.asarray(im)[:12,:,3].max()<=8)
  ck(s+str(d)+' bottom transparent margin',np.asarray(im)[-12:,:,3].max()<=8)
  ck(s+str(d)+' head pixels',np.asarray(im)[20:140,:,3].max()>240)
Path('growth-r2-deliverable/integrity-qa.json').write_text(json.dumps({'count':len(checks),'checks':checks},indent=2));print('integrity PASS',len(checks))
