from pathlib import Path
import numpy as np,hashlib,json,zipfile,base64,io,re
from PIL import Image
from scipy.ndimage import distance_transform_edt
from playwright.sync_api import sync_playwright
root=Path('assets'); out=Path('deliverable');reports={}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
# Rebuild source frames from accepted stable assets; inference is never repeated.
src=Path('experiments/sr_other_babies.py').read_text()
for species in ['dino','fantasy','yokai','fairy']:
 p=out/species
 if not p.exists():continue
 env=dict(root=root,a=Image.open(root/'pet-unified-atlas.webp').convert('RGBA'),species=species,np=np,Image=Image,hashlib=hashlib,io=io,sync_playwright=sync_playwright)
 def checked(name,expected):
  f=root/name;assert hashlib.sha1(b'blob '+str(f.stat().st_size).encode()+b'\0'+f.read_bytes()).hexdigest()==expected
  return f
 env['checked']=checked
 code=src[src.index('spec={'):src.index('def infer(im):')]
 
 exec(code,env)
 original=env['original'];refs=env['refs'];qa=json.loads((p/'qa.json').read_text());hq={};packed={};checks=[]
 assert qa['weights_sha256']=='f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da'
 assert qa['source_sha256']==sha(root/'pet-unified-atlas.webp')
 for group,v in qa['sprites'].items():
  for which in ['hq','original']:
   desc=v if which=='hq' else v['original']; f=p/desc['file']
   assert sha(f)==desc['sha256'] and f.stat().st_size==desc['bytes']
   sheet=Image.open(f).convert('RGBA');assert list(sheet.size)==desc['size'];scale=2 if which=='hq' else 1
   for i,n in enumerate(desc['frames']):
    x=(i%desc['cols'])*320*scale;y=(i//desc['cols'])*360*scale
    im=sheet.crop((x,y,x+320*scale,y+360*scale))
    if which=='hq':hq[n]=im
    else:
     ar=np.asarray(im);expected=np.asarray(original[n]);assert np.array_equal(ar[:,:,3],expected[:,:,3]),(species,n,'source alpha')
     assert np.array_equal(ar[ar[:,:,3]>0,:3],expected[ar[:,:,3]>0,:3]),(species,n,'source rgb')
  packed[group]={'bytes':v['bytes'],'decoded_rgba_bytes':np.prod(v['size']).item()*4}
 static=[]
 for n,im in original.items():
  ar=np.asarray(hq[n]);assert np.array_equal(ar[:,:,3],np.asarray(im.getchannel('A').resize((640,720),Image.Resampling.LANCZOS))),n
  ref=refs.get(n)
  if ref:
   x=np.asarray(im).astype(np.int16);y=np.asarray(original[ref]).astype(np.int16)
   diff=(np.max(np.abs(x-y),axis=2)>2)&((x[:,:,3]>8)|(y[:,:,3]>8))
   if diff.any():
    w=np.clip((14-distance_transform_edt(~diff))/7,0,1);locked=np.asarray(Image.fromarray(np.rint(w*255).astype(np.uint8)).resize((640,720),Image.Resampling.BILINEAR))==0
   else:locked=np.ones((720,640),bool)
   other=np.asarray(hq[ref]);locked&=(ar[:,:,3]>245)&(other[:,:,3]>245)
   assert np.array_equal(ar[locked,:3],other[locked,:3]),(species,n,'static')
   static.append({'frame':n,'reference':ref,'visible_locked_pixels':int(locked.sum())})
 sources=[root/'pet-unified-atlas.webp',root/env['facefile'],root/env['motionfile'],root/'pet-baby-chew-closed-q95.webp']
 reports[species]={'frames':len(original),'alpha_matches':len(original),'source_frames_match':len(original),'static':static,'source_hashes':{f.name:sha(f) for f in sources},'sprites':packed,'hq_total_bytes':sum(v['bytes'] for v in packed.values()),'decoded_rgba_bytes':sum(v['decoded_rgba_bytes'] for v in packed.values())}
 print(species,len(original),'alpha/source PASS; static',len(static),flush=True)
(out/'independent_asset_qa.json').write_text(json.dumps(reports,indent=2))
