"""Isolated super-resolution QA. Public v0.2.47 art only; no app/DB access."""
import argparse, hashlib, json, time, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt
import cv2
from collections import OrderedDict
p=argparse.ArgumentParser(); p.add_argument("--model",choices=["fsrcnn","realesrgan"],required=True); args=p.parse_args()
out=Path("sr-animal-full"); out.mkdir(exist_ok=True)
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

# Full animal baby set: base 4, blink/ears 5, left/right tail 3 each,
# two closed-mouth frames assembled from the accepted patch before inference.
import base64, re, html
assert args.model=="realesrgan"
def blob(p):
    return hashlib.sha1(b"blob "+str(p.stat().st_size).encode()+b"\0"+p.read_bytes()).hexdigest()
tail=root/"pet-baby-tail-sides.webp"; chew=root/"pet-baby-chew-closed-q95.webp"
assert blob(tail)=="02e058ac4d4f3ef7d619848b6faaaf43adec7e0f"
assert blob(chew)=="51b5539952bba85eeecd46d33d7daaf508e53fc0"
t=Image.open(tail).convert("RGBA"); c=Image.open(chew).convert("RGBA")
assert a.size==(1280,5400) and b.size==(1600,360) and t.size==(960,1440) and c.size==(120,220)
original={}
for i,name in enumerate(["front","left","back","right"]): original[name]=frames[i]
for i in range(5): original["blink"+str(i)]=frames[4+i]
for row,direction in enumerate(["left","right"]):
    for i in range(3):original[direction+"_tail"+str(i)]=t.crop((320*i,360*row,320*(i+1),360*(row+1)))
# Same mask geometry and coordinates as CSS: 30x22 CSS px = 60x44 source px, x65 y92.5.
for i in range(2):
    patch=c.crop((i*60,0,(i+1)*60,44))
    px=np.asarray(patch).copy()
    yy,xx=np.mgrid[:44,:60]; feather=np.minimum(np.minimum((xx+.5)/2,(59.5-xx)/2),np.minimum((yy+.5)/2,(43.5-yy)/2)).clip(0,1)
    px[:,:,3]=np.rint(px[:,:,3]*feather).astype(np.uint8)
    im=original["front"].copy(); im.alpha_composite(Image.fromarray(px),(130,185));original["chew"+str(i)]=im
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
# Base directions first; shared reference for exact duplicate and quiet areas.
for name,im in original.items():
    key=hashlib.sha256(im.tobytes()).hexdigest()
    if key not in cache:cache[key]=infer(im)
    raw[name]=cache[key]
    print("infer",name,"unique",len(cache),"elapsed",round(time.time()-t0,1),flush=True)
for name,im in original.items():
    refname=None
    if name.startswith("blink"):refname="front" if name=="blink0" else "blink0"
    elif "_tail" in name:refname=name.split("_tail")[0] if name.endswith("0") else name.split("_tail")[0]+"_tail0"
    elif name.startswith("chew"):refname="front"
    hq=raw[name]
    change=locked=0
    if refname:
        hq,change,locked=stabilize(im,original[refname],hq,enhanced[refname])
    assert hq.getchannel("A").tobytes()==im.getchannel("A").resize((640,720),Image.Resampling.LANCZOS).tobytes()
    enhanced[name]=hq
    metrics.append({"frame":name,"reference":refname,"changed_source_pixels":change,"locked_hq_rgb_pixels":locked})
def sprite(names,cols,filename):
    rows=(len(names)+cols-1)//cols
    canvas=Image.new("RGBA",(640*cols,720*rows))
    for i,n in enumerate(names):canvas.paste(enhanced[n],(640*(i%cols),720*(i//cols)))
    path=out/filename;canvas.save(path,format="WEBP",lossless=True,method=4)
    with Image.open(path) as q:assert q.size==canvas.size and q.convert("RGBA").tobytes()==canvas.tobytes() or np.array_equal(np.asarray(q.convert("RGBA"))[:,:,3],np.asarray(canvas)[:,:,3])
    return path
sprites={}
sprites["base"]=sprite(["front","left","back","right"],4,"animal-base-hq.webp")
sprites["blink"]=sprite(["blink"+str(i) for i in range(5)],5,"animal-blink-ear-hq.webp")
sprites["tail"]=sprite([d+"_tail"+str(i) for d in ["left","right"] for i in range(3)],3,"animal-tail-hq.webp")
sprites["chew"]=sprite(["chew0","chew1"],2,"animal-chew-hq.webp")
# Use original production CSS & illustrator with local embedded assets. No DB/service worker.
def uri(path):
    ext=path.suffix.lower();mime={".webp":"image/webp",".svg":"image/svg+xml"}.get(ext,"image/png")
    return "data:"+mime+";base64,"+base64.b64encode(path.read_bytes()).decode()
needed=["pet-unified-atlas.webp","pet-animal-baby-blink-ear.webp","pet-baby-tail-sides.webp","pet-baby-chew-closed-q95.webp","pet-baby-food-types.svg","pet-room-animal.svg"]
css=Path("pet-game.css").read_text()
# Other species are outside the QA scope; prevent any unneeded external asset requests.
def embed(m):
    filename=m.group(1)
    return 'url("'+uri(root/filename)+'")' if filename in needed else 'none'
css=re.sub(r"""url\(['"]?\./assets/([^?'")]+)(?:\?[^'")]+)?['"]?\)""",embed,css)
hq_css="""
.qa-hq .pet-character .pet-unified.pet-art-animal.pet-art-baby > .pet-art-image:first-child{
 background-image:url(BASE);background-size:400% 100%;background-position-y:0%;
}
.qa-hq .pet-stage .pet-character .pet-unified.pet-art-animal.pet-art-baby.pet-art-front > .pet-art-image:first-child{
 background-image:url(BLINK);background-size:500% 100%;background-position-y:0%;
}
.qa-hq .pet-stage .pet-character .pet-unified.pet-art-animal.pet-art-baby:is(.pet-art-left,.pet-art-right) > .pet-art-image:first-child{
 background-image:url(TAIL);background-size:300% 200%;
}
.qa-hq .pet-stage .pet-character .pet-unified.pet-art-animal.pet-art-baby.pet-art-left > .pet-art-image:first-child{background-position-y:0%}
.qa-hq .pet-stage .pet-character .pet-unified.pet-art-animal.pet-art-baby.pet-art-right > .pet-art-image:first-child{background-position-y:100%}
.qa-hq .pet-stage .pet-character.pet-mood-food[data-growth="baby"] .pet-unified.pet-art-animal.pet-art-baby.pet-art-front > .pet-art-image:first-child{
 background-image:url(BASE);background-size:400% 100%;background-position:0 0;
}
.qa-hq .pet-stage .pet-character.pet-mood-food[data-growth="baby"] .pet-unified.pet-art-animal.pet-art-baby.pet-art-front .pet-care-chew{
 left:0;top:0;width:160px;height:180px;background:url(CHEW) no-repeat 0 0/320px 180px;
 -webkit-mask-image:none;mask-image:none;
 animation:pet247-care-food-hq 1.65s steps(1,end) both;
}
@keyframes pet247-care-food-hq{
 0%,27%{opacity:0;background-position-x:0}
 29%,49%,69%,89%,100%{opacity:1;background-position-x:0}
 39%,59%,79%{opacity:1;background-position-x:-160px}
}
"""
for name,path in sprites.items():hq_css=hq_css.replace("url("+name.upper()+")",'url("'+uri(path)+'")')
qa_css="""
*{box-sizing:border-box}body{margin:0;padding:16px;background:#101824;color:#f4f7fc;font:15px system-ui,sans-serif}
main{max-width:800px;margin:auto}h1{font-size:20px;margin:0 0 8px}p{line-height:1.55;color:#bcc8d6}button{font:inherit;color:inherit;background:#253348;border:1px solid #53627a;border-radius:9px;padding:10px;cursor:pointer}button.active{background:#386a69}nav{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0}.qa-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.qa-label{text-align:center;font-weight:700}.pet-room{margin:6px 0 14px;min-height:245px}.pet-stage{min-height:170px}.qa-status{font-size:12px;color:#b8ccc7} .zoom .qa-grid{grid-template-columns:1fr}.zoom .pet-stage{min-height:255px}.zoom .pet-character{scale:1.5;transform-origin:50% 95%}.zoom .pet-room{min-height:320px} @media(max-width:480px){body{padding:10px}.qa-grid{gap:6px}.pet-room{min-width:0}.pet-stage{overflow:visible}.pet-speech{font-size:11px;padding:6px}} 
"""
art=Path("pet-illustration.js").read_text()
page="""<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>動物風幼体｜Real-ESRGAN 動作比較</title><style>"""+css+hq_css+qa_css+"""</style><main><h1>動物風幼体｜高画質 動作比較</h1><p>左：本番v0.2.47　右：Real-ESRGAN候補。実際の育成データは変更しません。</p><nav id="dirs"><button data-dir="auto" class="active">自動</button><button data-dir="front">正面</button><button data-dir="left">左</button><button data-dir="back">背面</button><button data-dir="right">右</button></nav><nav id="actions"><button data-mood="idle">待機</button><button data-mood="pet">なでる</button><button data-mood="food">ごはん</button><button data-mood="calm">見守る</button><button id="zoom">拡大表示</button></nav><div class="qa-grid"><section class="qa-old"><div class="qa-label">現行</div><div class="pet-room" data-room-type="animal"><div class="pet-stage"></div><p class="pet-speech">のんびり過ごしている。</p></div></section><section class="qa-hq"><div class="qa-label">高画質候補</div><div class="pet-room" data-room-type="animal"><div class="pet-stage"></div><p class="pet-speech">のんびり過ごしている。</p></div></section></div><p class="qa-status" id="status">確認用・保存なし</p></main><script>"""+art+"""
let facing='front',mode='auto',mood='idle',step=0,timer;const sequence=['front','left','back','right','front'];
const stages=[...document.querySelectorAll('.pet-stage')];
function paint(restart=false){for(const el of stages){let ch=el.querySelector('.pet-character');if(!ch){el.innerHTML='<span class="pet-character pet-mood-idle" data-type="animal" data-growth="baby" data-facing="front"></span>';ch=el.firstChild}const dir=mood==='idle'?facing:'front';for(const m of ['idle','pet','food','play','calm'])ch.classList.toggle('pet-mood-'+m,m===mood);if(ch.dataset.facing!==dir||!ch.querySelector('.pet-illustration')){ch.dataset.facing=dir;ch.innerHTML=HAM.PetIllustration.draw({type:'animal',stage:'baby',direction:dir,mood})}if(restart){for(const anim of ch.querySelector('.pet-illustration').getAnimations({subtree:true})){if(anim.animationName?.startsWith('pet247-care-')){anim.currentTime=0;anim.play()}}}el.nextElementSibling.textContent={idle:'のんびり過ごしている。',pet:'うれしそうに目を細めた！',food:'おいしそうにもぐもぐしている。',calm:'安心してくつろいでいる。'}[mood]||''}document.querySelector('#status').textContent='向き：'+(mood==='idle'?facing:'front')+' / '+mood}
document.querySelector('#dirs').onclick=e=>{const b=e.target.closest('[data-dir]');if(!b)return;mode=b.dataset.dir;facing=mode==='auto'?'front':mode;step=0;document.querySelectorAll('[data-dir]').forEach(x=>x.classList.toggle('active',x===b));clearTimeout(timer);mood='idle';paint()};
document.querySelector('#actions').onclick=e=>{const b=e.target.closest('[data-mood]');if(!b)return;clearTimeout(timer);mood=b.dataset.mood;paint(true);if(mood!=='idle')timer=setTimeout(()=>{mood='idle';paint()},mood==='calm'?3200:1700)};
document.querySelector('#zoom').onclick=()=>document.body.classList.toggle('zoom');setInterval(()=>{if(mode==='auto'&&mood==='idle'){step=(step+1)%sequence.length;facing=sequence[step];paint()}},3500);paint();
</script>"""
(out/"comparison.html").write_text(page)
qa={"source_sha256":sha(src),"weights_sha256":sha(weights),"frame_count":len(original),"unique_inference_count":len(cache),"alpha_matches":len(original),"metrics":metrics,"sprites":{k:{"file":v.name,"sha256":sha(v),"bytes":v.stat().st_size,"size":Image.open(v).size} for k,v in sprites.items()},"elapsed_seconds":time.time()-t0}
(out/"qa.json").write_text(json.dumps(qa,indent=2))
weights.unlink()
print(json.dumps(qa,indent=2),flush=True)
