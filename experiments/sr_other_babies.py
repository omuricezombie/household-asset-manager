"""Isolated super-resolution QA. Public v0.2.47 art only; no app/DB access."""
import argparse, hashlib, json, time, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt
import cv2
from collections import OrderedDict
p=argparse.ArgumentParser(); p.add_argument("--model",choices=["realesrgan"],required=True); p.add_argument("--species",choices=["dino","fantasy","fairy","yokai"],required=True); args=p.parse_args()
out=Path("sr-"+args.species+"-full"); out.mkdir(exist_ok=True)
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


# Four-species rollout. Inference algorithm identical to animal trial.
import base64, io, re
assert args.model=="realesrgan"
species=args.species
def checked(name,expected):
    p=root/name
    assert hashlib.sha1(b"blob "+str(p.stat().st_size).encode()+b"\0"+p.read_bytes()).hexdigest()==expected,name
    return p
spec={
"dino":(4,"pet-blink-dino-baby.webp","70cf5ee5009421bae4f1b8f5ad05f6d8a21d3cfd","pet-baby-tail-sides.webp","02e058ac4d4f3ef7d619848b6faaaf43adec7e0f",130,150),
"fantasy":(1,"pet-blink-fantasy-baby.webp","22cd2573a7f4b399ca94844980ded534c858400f","pet-fantasy-baby-wings.webp","ba32052228e3b4c64c48e007519b4064b48d5202",130,204),
"fairy":(2,"pet-blink-fairy-baby.webp","80d4f7e1640227ae3493681d522bb459fb9038b0","pet-fairy-baby-wing-axis.webp","9604153f8d5dd616402a55304ff730ba6fe716e0",138,155),
"yokai":(3,"pet-gaze-yokai-baby.svg","9070d22093dad6cff9a4cb29c07ae9dde204c51a","pet-yokai-baby-tail-swing-fixed.webp","e207d30ec17b9d38c768ce704cdc70dfc27fdebf",130,210)}
row,facefile,facesha,motionfile,motionsha,cx,cy=spec[species]
directions=["front","left","back","right"]; original={}; refs={}; sheets={}
for i,d in enumerate(directions):
    original[d]=a.crop((i*320,row*1080,(i+1)*320,row*1080+360))
sheets["base"]=(directions,4)
fp=checked(facefile,facesha)
if species=="yokai":
    # Render accepted SVG in Chromium, not reconstruct or redraw eye.
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
        pg=browser.new_page(viewport={"width":960,"height":360},device_scale_factor=1)
        pg.set_content('<style>html,body{margin:0;background:transparent}svg{display:block}</style>'+fp.read_text())
        pg.wait_for_function("document.querySelector('svg').getBoundingClientRect().width===960")
        pg.wait_for_timeout(350)
        raw_svg=pg.screenshot(omit_background=True)
        browser.close()
    face=Image.open(io.BytesIO(raw_svg)).convert("RGBA")
else:
    face=Image.open(fp).convert("RGBA")
assert face.size==(960,360)
face_names=[]
for i in range(3):
    name="face"+str(i); original[name]=face.crop((i*320,0,(i+1)*320,360)); refs[name]="front" if i==0 else "face0"; face_names.append(name)
sheets["face"]=(face_names,3)
mot=Image.open(checked(motionfile,motionsha)).convert("RGBA")
cols=5 if species=="yokai" else 3
assert mot.size==(320*cols,1440),mot.size
motion_names=[]
rows=[(2,"left"),(3,"right")] if species=="dino" else list(enumerate(directions))
for r,d in rows:
    for i in range(cols):
        name=d+"_motion"+str(i); original[name]=mot.crop((i*320,r*360,(i+1)*320,(r+1)*360));refs[name]=("face0" if d=="front" else d) if i==0 else d+"_motion0";motion_names.append(name)
sheets["motion"]=(motion_names,cols)
chew=Image.open(checked("pet-baby-chew-closed-q95.webp","51b5539952bba85eeecd46d33d7daaf508e53fc0")).convert("RGBA")
assert chew.size==(120,220)
for i in range(2):
    px=np.asarray(chew.crop((i*60,row*44,(i+1)*60,(row+1)*44))).copy()
    yy,xx=np.mgrid[:44,:60];feather=np.minimum(np.minimum((xx+.5)/2,(59.5-xx)/2),np.minimum((yy+.5)/2,(43.5-yy)/2)).clip(0,1)
    px[:,:,3]=np.rint(px[:,:,3]*feather).astype(np.uint8)
    im=original["front"].copy();im.alpha_composite(Image.fromarray(px),(cx,cy));name="chew"+str(i);original[name]=im;refs[name]="front"
sheets["food"]=(["front","chew0","chew1"],3)
def infer(im):
    arr=np.asarray(im);valid=arr[:,:,3]>24
    coords=distance_transform_edt(~valid,return_distances=False,return_indices=True)
    rgb=arr[coords[0],coords[1],:3].copy();rgb[valid]=arr[valid,:3]
    result=upscale(rgb)
    assert result.shape==(720,640,3)
    ai=Image.fromarray(result).convert("RGBA");ai.putalpha(im.getchannel("A").resize((640,720),Image.Resampling.LANCZOS))
    return ai
def stabilize(src,ref,ai,ai_ref):
    # Keep identical source pixels from the same reference inference. Only permit
    # changes around actual animated pixels, with soft transition outside that region.
    x=np.asarray(src).astype(np.int16);y=np.asarray(ref).astype(np.int16)
    visible=(x[:,:,3]>8)|(y[:,:,3]>8)
    diff=(np.max(np.abs(x-y),axis=2)>2)&visible
    if not diff.any():
        if src.tobytes()==ref.tobytes():return ai_ref.copy(),0,0
        return ai,0,0
    dist=distance_transform_edt(~diff)
    w=np.clip((14-dist)/7,0,1)
    weight=np.asarray(Image.fromarray(np.rint(w*255).astype(np.uint8)).resize((640,720),Image.Resampling.BILINEAR),dtype=np.float32)/255
    ar=np.asarray(ai).copy();refar=np.asarray(ai_ref)
    ar[:,:,:3]=np.rint(ar[:,:,:3]*weight[:,:,None]+refar[:,:,:3]*(1-weight[:,:,None])).astype(np.uint8)
    assert np.array_equal(ar[weight==0,:3],refar[weight==0,:3])
    return Image.fromarray(ar),int(diff.sum()),int((weight==0).sum())

t0=time.time(); raw={}; enhanced={}; cache={}; metrics=[]
for name,im in original.items():
    key=hashlib.sha256(im.tobytes()).hexdigest()
    if key not in cache:cache[key]=infer(im)
    raw[name]=cache[key]
    print("infer",species,name,"unique",len(cache),"elapsed",round(time.time()-t0,1),flush=True)
for name,im in original.items():
    ref=refs.get(name); hq=raw[name]; change=locked=0
    if ref:
        hq,change,locked=stabilize(im,original[ref],hq,enhanced[ref])
    assert hq.getchannel("A").tobytes()==im.getchannel("A").resize((640,720),Image.Resampling.LANCZOS).tobytes(),name
    enhanced[name]=hq
    metrics.append({"frame":name,"reference":ref,"changed_source_pixels":change,"locked_hq_rgb_pixels":locked})
def pack(images,names,cols,filename,scale=2):
    w,h=320*scale,360*scale
    canvas=Image.new("RGBA",(w*cols,h*((len(names)+cols-1)//cols)))
    for i,n in enumerate(names):canvas.paste(images[n],(w*(i%cols),h*(i//cols)))
    path=out/filename;canvas.save(path,format="WEBP",lossless=True,method=4,exact=True)
    with Image.open(path) as q:
        decoded=np.asarray(q.convert("RGBA"));expected=np.asarray(canvas)
        assert decoded.shape==expected.shape
        assert np.array_equal(decoded[:,:,3],expected[:,:,3])
        assert np.array_equal(decoded[expected[:,:,3]>0,:3],expected[expected[:,:,3]>0,:3])
    return {"file":path.name,"sha256":sha(path),"bytes":path.stat().st_size,"size":canvas.size,"frames":names,"cols":cols}
qa={"species":species,"source_sha256":sha(src),"weights_sha256":sha(weights),"frame_count":len(original),"unique_inference_count":len(cache),"alpha_matches":len(original),"metrics":metrics,"sprites":{}}
for group,(names,cols) in sheets.items():
    qa["sprites"][group]=pack(enhanced,names,cols,species+"-"+group+"-hq.webp")
    qa["sprites"][group]["original"]=pack(original,names,cols,species+"-"+group+"-original.webp",1)
# contact sheet for every group, at exact same display dimensions.
for group,(names,cols) in sheets.items():
    width=180*cols;rows=(len(names)+cols-1)//cols
    canvas=Image.new("RGB",(width,rows*440),"#edf1e9");d=ImageDraw.Draw(canvas)
    for i,name in enumerate(names):
        x=i%cols*180;y=i//cols*440
        d.text((x+8,y+4),name+" original",fill="#293638")
        for j,im in enumerate([original[name],enhanced[name]]):
            bg=Image.new("RGBA",(160,180),"#dbe8d7");bg.alpha_composite(im.resize((160,180),Image.Resampling.LANCZOS));canvas.paste(bg.convert("RGB"),(x+10,y+24+j*207))
            if j==0:d.text((x+8,y+208),name+" HQ",fill="#293638")
    canvas.save(out/("contact-"+group+".png"))
qa["elapsed_seconds"]=time.time()-t0
(out/"qa.json").write_text(json.dumps(qa,indent=2));weights.unlink()
print(json.dumps(qa,indent=2),flush=True)
