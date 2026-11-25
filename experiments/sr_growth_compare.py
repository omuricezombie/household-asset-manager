"""Build and browser-test offline comparison; no app/DB access."""
import base64,hashlib,json
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
species=["animal","fantasy","fairy","yokai","dino"]
stages=["baby","teen","adult"]
out=Path("growth-result");out.mkdir(exist_ok=True)
src=Path("assets/pet-unified-atlas.webp")
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(src)=="5c82c1a5ec5d671daaea600ea1ff6d114e0e7e121f8c31748148850289f2f0e6"
original=Image.open(src).convert("RGBA");assert original.size==(1280,5400)
baby=json.loads(Path("hq-baby-manifest.json").read_text())
assert len(baby)==20 and sum(m["bytes"] for m in baby.values())==19504652
for f,m in baby.items():
    p=Path(f);assert p.stat().st_size==m["bytes"] and sha(p)==m["sha256"]
def enc(p):return base64.b64encode(p.read_bytes()).decode()
data={"atlas":enc(src)};manifest={};count=0
for r,sp in enumerate(species):
    d=Path("sr-growth")/sp;q=json.loads((d/"qa.json").read_text())
    assert q["source_sha256"]==sha(src) and q["weights_sha256"]=="f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da"
    assert len(q["frames"])==8
    data[sp+"-baby"]=enc(Path("assets/hq-baby")/(sp+"-base.webp"))
    for offset,stage in [(1,"teen"),(2,"adult")]:
        p=d/(sp+"-"+stage+".webp");m=q["sprites"][stage]
        assert sha(p)==m["sha256"] and p.stat().st_size==m["bytes"]
        hq=Image.open(p).convert("RGBA");assert hq.size==(2560,720)
        for i in range(4):
            a=original.crop((i*320,(r*3+offset)*360,(i+1)*320,(r*3+offset+1)*360))
            b=hq.crop((i*640,0,(i+1)*640,720))
            assert a.getchannel("A").resize((640,720),Image.Resampling.LANCZOS).tobytes()==b.getchannel("A").tobytes()
            count+=1
        data[sp+"-"+stage]=enc(p);manifest[sp+"-"+stage]=m
assert count==40 and len(manifest)==10
html="""<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>中間体・成体 HQ 比較 r1</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf2f3;color:#18303b;font:15px system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:12px}h1{font-size:20px}p{line-height:1.55}section{background:white;padding:12px;border-radius:12px;margin:12px 0}.controls{display:flex;flex-wrap:wrap;gap:10px}label{display:grid;gap:4px;font-size:13px}select{font:inherit;padding:8px;max-width:100%}.pair{margin:12px 0;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.tile{text-align:center;max-width:100%;overflow:auto}.sprite{width:160px;height:180px;background-repeat:no-repeat;background-color:#e3eee3;margin:4px auto}.zoom .sprite{width:320px;height:360px}.pair h2{font-size:14px;flex-basis:100%;margin:0;text-align:center}.status{font-size:13px}footer{font-size:12px}
</style><main><h1>中間体・成体 Real-ESRGAN 比較 r1</h1><p>v0.2.48原画と比較。幼体の高画質素材は採用済みの基本4方向をそのまま使用。160×180 CSS pxが本番の基本画像枠です。データ保存・通信なし。</p><section class="controls">
<label>種族<select id="sp"><option value="animal">動物風</option><option value="fantasy">架空の生き物</option><option value="fairy">妖精風</option><option value="yokai">妖怪</option><option value="dino">恐竜</option></select></label>
<label>成長<select id="stage"><option value="teen">中間体</option><option value="adult">成体</option><option value="all">全3段階</option><option value="baby">幼体（採用済み）</option></select></label>
<label>向き<select id="dir"><option value="all">全4方向</option><option value="0">正面</option><option value="1">左</option><option value="2">背面</option><option value="3">右</option></select></label>
<label>比較<select id="mode"><option value="both">並べる</option><option value="hq">高画質のみ</option><option value="old">現行のみ</option></select></label>
<label>倍率<select id="zoom"><option value="normal">本番画像枠</option><option value="zoom">2倍</option></select></label></section><p class="status" id="status" aria-live="polite"></p><section id="gallery"></section><footer>高画質素材は未採用。アニメーション・家計・育成状態・保存形式は変更していません。</footer></main><script>
const payload=__DATA__, species=['animal','fantasy','fairy','yokai','dino'],stages=['baby','teen','adult'],stageLabels=['幼体','中間体','成体'],dirs=['正面','左','背面','右'];
const $=id=>document.getElementById(id);let urls={};
function url(k){if(!urls[k]){const raw=atob(payload[k]);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));urls[k]=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}))}return urls[k]}
function draw(){let sp=$('sp').value,stage=$('stage').value,dir=$('dir').value,mode=$('mode').value,zoom=$('zoom').value,ss=stage==='all'?stages:[stage],ds=dir==='all'?[0,1,2,3]:[+dir],need=new Set();$('gallery').replaceChildren();$('gallery').className=zoom;
for(let s of ss)for(let d of ds){let pair=document.createElement('div');pair.className='pair';let heading=document.createElement('h2');heading.textContent=stageLabels[stages.indexOf(s)]+'・'+dirs[d];pair.append(heading);
for(let m of (mode==='both'?['old','hq']:[mode])){let k=m==='old'?'atlas':sp+'-'+s;need.add(k);let tile=document.createElement('div');tile.className='tile';let caption=document.createElement('div');caption.textContent=m==='old'?'現行原画':s==='baby'?'採用済みHQ':'新HQ';let el=document.createElement('div');el.className='sprite';el.dataset.key=k;el.dataset.direction=d;el.dataset.stage=s;el.style.backgroundImage='url("'+url(k)+'")';el.style.backgroundSize=m==='old'?'400% 1500%':'400% 100%';el.style.backgroundPosition=(d/3*100)+'% '+(m==='old'?(species.indexOf(sp)*3+stages.indexOf(s))/14*100:0)+'%';tile.append(caption,el);pair.append(tile)}$('gallery').append(pair)}
for(let k of Object.keys(urls))if(!need.has(k)){URL.revokeObjectURL(urls[k]);delete urls[k]}$('status').textContent=ss.length*ds.length+'コマ表示'}
document.querySelectorAll('select').forEach(e=>e.addEventListener('change',draw));draw();
</script></html>"""
html=html.replace("__DATA__",json.dumps(data,separators=(",",":")))
pagefile=out/"pet_growth_hq_qa.html";pagefile.write_text(html)
checks=0
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
    page=browser.new_page(viewport={"width":412,"height":850},device_scale_factor=2.5)
    errors=[];requests=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.on("request",lambda r:requests.append(r.url) if r.url.startswith(("https://","http://")) else None)
    page.goto(pagefile.resolve().as_uri())
    for sp in species:
        page.select_option("#sp",sp)
        for stage in stages+["all"]:
            page.select_option("#stage",stage)
            page.select_option("#dir","all")
            for mode in ["both","hq","old"]:
                page.select_option("#mode",mode)
                for zoom in ["normal","zoom"]:
                    page.select_option("#zoom",zoom)
                    actual=page.locator(".sprite").evaluate_all("""async els=>Promise.all(els.map(async e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),url=s.backgroundImage.slice(5,-2),im=new Image();im.src=url;await im.decode();return {key:e.dataset.key,stage:e.dataset.stage,dir:+e.dataset.direction,w:r.width,h:r.height,iw:im.naturalWidth,ih:im.naturalHeight,x:parseFloat(s.backgroundPositionX),y:parseFloat(s.backgroundPositionY)}}))""")
                    assert len(actual)==(12 if stage=="all" else 4)*(2 if mode=="both" else 1)
                    for a in actual:
                        assert (a["w"],a["h"])==((160,180) if zoom=="normal" else (320,360))
                        assert abs(a["x"]-a["dir"]/3*100)<.001
                        if a["key"]=="atlas":
                            assert (a["iw"],a["ih"])==(1280,5400)
                            assert abs(a["y"]-(species.index(sp)*3+stages.index(a["stage"]))/14*100)<.001
                        else:
                            assert a["key"]==sp+"-"+a["stage"] and (a["iw"],a["ih"])==(2560,720) and a["y"]==0
                        checks+=1
                    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        page.select_option("#stage","all");page.select_option("#mode","hq");page.select_option("#zoom","normal")
        page.screenshot(path=str(out/(sp+"-growth-mobile.png")),full_page=True)
    page.select_option("#stage","teen");page.select_option("#dir","2");assert page.locator(".sprite").count()==1
    assert not errors and not requests,(errors,requests)
    browser.close()
summary={"frames":count,"sprites":manifest,"baby_assets_verified":len(baby),"new_bytes":sum(m["bytes"] for m in manifest.values()),"decoded_rgba_bytes_per_strip":2560*720*4,"decoded_rgba_bytes_all_new":10*2560*720*4,"browser_checks":checks,"js_errors":errors,"external_requests":requests,"comparison_sha256":sha(pagefile)}
(out/"qa.json").write_text(json.dumps(summary,indent=2))
print(json.dumps(summary),flush=True)
