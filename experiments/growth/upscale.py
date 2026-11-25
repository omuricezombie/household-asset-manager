"""40 basic growth frames; inference copied from approved sr_other_babies.py."""
import argparse, hashlib, json, time, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt
p=argparse.ArgumentParser();p.add_argument('--species',required=True,choices=['animal','fantasy','fairy','yokai','dino']);args=p.parse_args()
out=Path('growth-output')/args.species;out.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
src=Path('assets/pet-unified-atlas.webp')
assert sha(src)=='5c82c1a5ec5d671daaea600ea1ff6d114e0e7e121f8c31748148850289f2f0e6'
assert hashlib.sha1(b'blob '+str(src.stat().st_size).encode()+b'\0'+src.read_bytes()).hexdigest()=='2a030296cf12b0dc701991f63e801fe64ec5646e'
a=Image.open(src).convert('RGBA');assert a.size==(1280,5400)
def dl(url,name):
    dest=out/name;urllib.request.urlretrieve(url,dest);return dest
import torch
from torch import nn
from torch.nn import functional as F
torch.set_num_threads(2)
# RRDBNet x4, 6 blocks, official RealESRGAN anime_6B architecture.
class Dense(nn.Module):
    def __init__(self):
        super().__init__()
        for i in range(1,6): setattr(self,"conv"+str(i),nn.Conv2d(64+32*(i-1),32 if i<5 else 64,3,1,1))
    def forward(self,x):
        xs=[x]
        for i in range(1,5): xs.append(F.leaky_relu(getattr(self,"conv"+str(i))(torch.cat(xs,1)),.2))
        return x+.2*self.conv5(torch.cat(xs,1))
class RRDB(nn.Module):
    def __init__(self):
        super().__init__();self.rdb1=Dense();self.rdb2=Dense();self.rdb3=Dense()
    def forward(self,x):return x+.2*self.rdb3(self.rdb2(self.rdb1(x)))
class Net(nn.Module):
    def __init__(self):
        super().__init__(); self.conv_first=nn.Conv2d(3,64,3,1,1);self.body=nn.Sequential(*(RRDB() for _ in range(6)));self.conv_body=nn.Conv2d(64,64,3,1,1);self.conv_up1=nn.Conv2d(64,64,3,1,1);self.conv_up2=nn.Conv2d(64,64,3,1,1);self.conv_hr=nn.Conv2d(64,64,3,1,1);self.conv_last=nn.Conv2d(64,3,3,1,1)
    def forward(self,x):
        f=self.conv_first(x);f=f+self.conv_body(self.body(f));f=F.leaky_relu(self.conv_up1(F.interpolate(f,scale_factor=2,mode="nearest")),.2);f=F.leaky_relu(self.conv_up2(F.interpolate(f,scale_factor=2,mode="nearest")),.2);return self.conv_last(F.leaky_relu(self.conv_hr(f),.2))
weights=dl("https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth","RealESRGAN_x4plus_anime_6B.pth")
assert sha(weights)=="f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da"
model=Net().eval(); state=torch.load(weights,map_location="cpu",weights_only=True); model.load_state_dict(state.get("params_ema",state.get("params",state)),strict=True)
@torch.inference_mode()
def upscale(rgb):
    x=torch.from_numpy(rgb.copy()).permute(2,0,1).unsqueeze(0).float()/255
    # Tiled 4x inference with 32px overlap to bound CPU memory.
    h,w=rgb.shape[:2]; y=torch.empty((1,3,h*4,w*4))
    for y0 in range(0,h,128):
        for x0 in range(0,w,128):
            y1=min(h,y0+128);x1=min(w,x0+128);t=max(0,y0-32);l=max(0,x0-32);bb=min(h,y1+32);r=min(w,x1+32)
            z=model(x[:,:,t:bb,l:r])
            y[:,:,y0*4:y1*4,x0*4:x1*4]=z[:,:,(y0-t)*4:(y1-t)*4,(x0-l)*4:(x1-l)*4]
    rgb4=(y.clamp(0,1)[0].permute(1,2,0).numpy()*255).round().astype(np.uint8)
    return np.asarray(Image.fromarray(rgb4).resize((w*2,h*2),Image.Resampling.LANCZOS))
def infer(im):
    arr=np.asarray(im);valid=arr[:,:,3]>24
    coords=distance_transform_edt(~valid,return_distances=False,return_indices=True)
    rgb=arr[coords[0],coords[1],:3].copy();rgb[valid]=arr[valid,:3]
    result=upscale(rgb)
    assert result.shape==(720,640,3)
    ai=Image.fromarray(result).convert("RGBA");ai.putalpha(im.getchannel("A").resize((640,720),Image.Resampling.LANCZOS))
    return ai

row=['animal','fantasy','fairy','yokai','dino'].index(args.species)
qa={'species':args.species,'source_sha256':sha(src),'weights_sha256':sha(weights),'sprites':[],'frames':[]}
t0=time.time()
for stage,offset in [('teen',1),('adult',2)]:
    sheet=Image.new('RGBA',(2560,720));contact=Image.new('RGB',(1280,720),'#e4eddf')
    for direction in range(4):
        y=row*1080+offset*360
        original=a.crop((direction*320,y,(direction+1)*320,y+360))
        hq=infer(original)
        alpha=original.getchannel('A').resize((640,720),Image.Resampling.LANCZOS)
        assert hq.getchannel('A').tobytes()==alpha.tobytes()
        sheet.paste(hq,(direction*640,0))
        for j,im in enumerate([original,hq]):
            bg=Image.new('RGBA',(320,360),'#e4eddf');bg.alpha_composite(im.resize((320,360),Image.Resampling.LANCZOS));contact.paste(bg.convert('RGB'),(direction*320,j*360))
        qa['frames'].append({'stage':stage,'direction':direction,'alpha_match':True,'source_bbox':original.getbbox(),'hq_bbox':hq.getbbox()})
        print(args.species,stage,direction,round(time.time()-t0,1),flush=True)
    dest=out/(args.species+'-'+stage+'.webp')
    sheet.save(dest,format='WEBP',lossless=True,method=4,exact=True)
    decoded=np.asarray(Image.open(dest).convert('RGBA'));expected=np.asarray(sheet)
    assert np.array_equal(decoded[:,:,3],expected[:,:,3])
    assert np.array_equal(decoded[expected[:,:,3]>0,:3],expected[expected[:,:,3]>0,:3])
    qa['sprites'].append({'file':dest.name,'bytes':dest.stat().st_size,'sha256':sha(dest),'size':sheet.size,'stage':stage})
    contact.save(out/(stage+'-contact.png'))
qa['elapsed_seconds']=time.time()-t0
(out/'qa.json').write_text(json.dumps(qa,indent=2));weights.unlink()
