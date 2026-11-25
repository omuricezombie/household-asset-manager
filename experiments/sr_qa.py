"""Isolated super-resolution QA. Public v0.2.47 art only; no app/DB access."""
import argparse, hashlib, json, time, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt
import cv2
from collections import OrderedDict
p=argparse.ArgumentParser(); p.add_argument("--model",choices=["fsrcnn","realesrgan"],required=True); args=p.parse_args()
out=Path("sr-qa-"+args.model); out.mkdir(exist_ok=True)
root=Path("assets"); src=root/"pet-unified-atlas.webp"; blink=root/"pet-animal-baby-blink-ear.webp"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(src)=="5c82c1a5ec5d671daaea600ea1ff6d114e0e7e121f8c31748148850289f2f0e6"
assert hashlib.sha1(b"blob "+str(blink.stat().st_size).encode()+b"\0"+blink.read_bytes()).hexdigest()=="cfeaf0399b4fc02d7e655ae1a3e49b675d9a760f"
a=Image.open(src).convert("RGBA"); b=Image.open(blink).convert("RGBA")
frames=[a.crop((i*320,0,(i+1)*320,360)) for i in range(4)]+[b.crop((i*320,0,(i+1)*320,360)) for i in range(5)]
def dl(url,name):
    dest=out/name
    urllib.request.urlretrieve(url,dest)
    return dest
if args.model=="fsrcnn":
    weights=dl("https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x2.pb","FSRCNN_x2.pb")
    assert hashlib.sha1(b"blob "+str(weights.stat().st_size).encode()+b"\0"+weights.read_bytes()).hexdigest()=="2509b0e19b8a45ebce2ba50128e2fcb43ce8589c"
    sr=cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(str(weights)); sr.setModel("fsrcnn",2)
    def upscale(rgb):
        return cv2.cvtColor(sr.upsample(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR)),cv2.COLOR_BGR2RGB)
else:
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
def boost(im):
    arr=np.asarray(im);rgb=arr[:,:,:3].astype(np.float32);alpha=arr[:,:,3].astype(np.float32)/255
    yy=rgb@np.array([.2126,.7152,.0722],np.float32)
    blur=cv2.GaussianBlur(yy*alpha,(0,0),1.15)/np.maximum(cv2.GaussianBlur(alpha,(0,0),1.15),1e-6)
    diff=yy-blur; delta=np.clip(np.sign(diff)*np.maximum(np.abs(diff)-1,0)*1.5,-19,19)*np.minimum(alpha*2,1)
    return Image.fromarray(np.dstack([np.rint(np.clip(rgb+delta[:,:,None],0,255)).astype(np.uint8),arr[:,:,3]]),"RGBA").resize((640,720),Image.Resampling.LANCZOS)
names=["front","left","back","right","blink1","blink2","blink3","ear1","ear2"]
# Only front + blink pair for the heavier model in the first trial.
indices=[0,4,6] if args.model=="realesrgan" else list(range(9))
t0=time.time();stats=[]; variants=[]
for i in indices:
    im=frames[i]; arr=np.asarray(im); alpha=arr[:,:,3]; valid=alpha>24
    coords=distance_transform_edt(~valid,return_distances=False,return_indices=True)
    rgb=arr[coords[0],coords[1],:3].copy()
    rgb[valid]=arr[valid,:3]
    result=upscale(rgb)
    assert result.shape==(720,640,3), result.shape
    mask=im.getchannel("A").resize((640,720),Image.Resampling.LANCZOS)
    ai=Image.fromarray(result).convert("RGBA"); ai.putalpha(mask)
    B=boost(im); assert ai.getchannel("A").tobytes()==B.getchannel("A").tobytes()
    mask2=np.asarray(mask)>245; base=np.asarray(im.resize((640,720),Image.Resampling.LANCZOS)).astype(float)
    stats.append({"frame":names[i],"AI_mean_RGB_delta":float(np.abs(np.asarray(ai).astype(float)[:,:,:3]-base[:,:,:3])[mask2].mean()),"B_mean_RGB_delta":float(np.abs(np.asarray(B).astype(float)[:,:,:3]-base[:,:,:3])[mask2].mean())})
    for name,img in [("original",im),("B",B),("AI",ai)]:img.save(out/f"{names[i]}-{name}.png")
    variants.append((names[i],im,B,ai))
    print("frame",names[i], "complete",round(time.time()-t0,1),flush=True)
# Compare original, B and AI at same display size; enlarged front crop in second row.
sheet=Image.new("RGB",(1260,1080),"#f7f8f5"); d=ImageDraw.Draw(sheet)
font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",24)
d.text((24,16),f"Animal baby | {args.model} | original vs B vs AI",font=font,fill="#273b37")
for j,(name,im) in enumerate(zip(["Original","B - sharpen","AI - "+args.model],variants[0][1:])):
    x=j*420+10;d.text((x,64),name,font=font,fill="#273b37")
    for y,crop in [(104,False),(590,True)]:
        v=im.crop(tuple(round(k*im.width/320) for k in (50,10,250,235))) if crop else im
        bg=Image.new("RGBA",(400,450),"#e4efdf");bg.alpha_composite(v.resize((400,450),Image.Resampling.LANCZOS));sheet.paste(bg.convert("RGB"),(x,y))
sheet.save(out/"comparison.png")
(out/"qa.json").write_text(json.dumps({"model":args.model,"weight_sha256":sha(weights),"source_sha256":sha(src),"frames":stats,"alpha_identical_to_B":True,"elapsed_seconds":time.time()-t0},indent=2))
weights.unlink()  # no third-party weights in artifact
print((out/"qa.json").read_text(),flush=True)
