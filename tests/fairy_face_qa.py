"""Reproduce c2 cheek overlap, then check c3 SVG pixels against a conservative face box.
Coordinates are in the unchanged 160x180 art space. No actual user data is opened.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess,json
checks=[]
def ck(n,v):assert v,n;checks.append(n)
def css_at(ref):return '\n'.join(subprocess.check_output(['git','show',ref+':'+n]).decode()for n in ['pet-game.css','pet-hq.css','pet-brush.css'])
current_css='\n'.join(Path(n).read_text()for n in ['pet-game.css','pet-hq.css','pet-brush.css'])
scan='''async reduced=>{
 const e=document.querySelector('.pet-care-brush'),art=e.parentElement;
 const tool=new Image();tool.src=urls['assets/pet-care-hairbrush.svg'];await tool.decode();
 const c=document.createElement('canvas');c.width=100;c.height=140;const g=c.getContext('2d');g.drawImage(tool,0,0,100,140);const rgba=g.getImageData(0,0,100,140).data,pixels=[];
 for(let y=0;y<140;y++)for(let x=0;x<100;x++)if(rgba[(y*100+x)*4+3]>24)pixels.push([(x+.5)/4,(y+.5)/4]);
 const head=new Image();head.src=urls['assets/hq-baby/fairy-base.webp'];await head.decode();
 const h=document.createElement('canvas');h.width=160;h.height=180;const hg=h.getContext('2d');hg.drawImage(head,0,0,640,720,0,0,160,180);const hr=hg.getImageData(0,0,160,180).data;
 function hair(x,y){if(x<100||x>=150||y<20||y>=70)return false;const i=(Math.floor(y)*160+Math.floor(x))*4;return hr[i+3]>128&&hr[i]>hr[i+1]*1.1&&hr[i+2]>hr[i+1]*1.15;}
 let faceHitFrames=0,maxFacePixels=0,contacts={};
 const times=reduced?[1000]:Array.from({length:131},(_,i)=>i*20).concat([442,936,1430,1924]);
 for(const t of times){
  for(const a of art.getAnimations({subtree:true})){a.pause();a.currentTime=t;}
  const s=getComputedStyle(e);if(+s.opacity<.01)continue;
  const m=new DOMMatrix(s.transform),[ox,oy]=s.transformOrigin.split(' ').map(parseFloat),left=parseFloat(s.left),top=parseFloat(s.top);let face=0,touch=0;
  for(const [x,y]of pixels){const p=m.transformPoint(new DOMPoint(x-ox,y-oy)),px=p.x+ox+left,py=p.y+oy+top;
   // Conservative exclusion covers forehead, eyes, cheeks, mouth and chin, including a margin.
   if(px>=48&&px<=121&&py>=47&&py<=104)face++;
   if(x<=18.4&&y<=21.7&&hair(px,py))touch++;
  }
  if(face)faceHitFrames++;maxFacePixels=Math.max(maxFacePixels,face);
  if(reduced||[442,936,1430,1924].includes(t))contacts[t]=touch;
 }
 return {faceHitFrames,maxFacePixels,contacts,samples:times.length,faceBox:[48,47,121,104]};
}'''
with sync_playwright()as pw:
 b=pw.chromium.launch(args=['--no-sandbox']);p=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2.5);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(Path('artifacts/pet_brushing_5_babies_v0250c4.html').resolve().as_uri());p.select_option('#species','fairy')
 p.evaluate('s=>{style.textContent=mapUrls(s)}',css_at('8a4245db7ca70d56bcef9e4558237d00f0805192'));p.click('#brushBtn');old=p.evaluate(scan,False);ck('c2 cheek overlap reproduced',old['faceHitFrames']>0)
 p.evaluate('s=>{style.textContent=mapUrls(s)}',current_css);p.click('#brushBtn');new=p.evaluate(scan,False);print('face scan',json.dumps({'old':old,'new':new}),flush=True);ck('c3 all visible SVG pixels avoid face for 20ms samples',new['faceHitFrames']==0);ck('c3 two stroke start/end heads touch opaque hair',len(new['contacts'])==4 and all(n>0 for n in new['contacts'].values()))
 for t in [442,936,1430,1924]:
  p.click('#brushBtn');p.evaluate('t=>{for(const a of document.querySelector(".pet-illustration").getAnimations({subtree:true})){a.pause();a.currentTime=t}}',t);p.locator('.pet-room').screenshot(path=f'artifacts/fairy-hair-only-{t}.png')
 p.emulate_media(reduced_motion='reduce');p.click('#brushBtn');reduced=p.evaluate(scan,True);ck('reduced pose avoids face',reduced['faceHitFrames']==0);ck('reduced pose on hair',all(n>0 for n in reduced['contacts'].values()))
 ck('no page errors',not errors);b.close()
# Other four species must retain the exact species rules and keyframes, not merely similar poses.
prior=css_at('8a4245db7ca70d56bcef9e4558237d00f0805192').split('/* v0.2.50:')[1]
now=Path('pet-brush.css').read_text().split('/* v0.2.50:')[1]
for name in ['stroke','lean','eyes','happy','cloth','sponge']:
 def frames(s):
  x=s.index('@keyframes brush250-'+name+'{');i=s.index('{',x);level=1;j=i+1
  while level:
   level+=(s[j]=='{')-(s[j]=='}');j+=1
  return s[x:j]
 ck('unchanged other reactions '+name,frames(prior)==frames(now))
Path('AI_QA_0250c4_fairy_face.json').write_text(json.dumps({'count':len(checks),'checks':checks,'prior_c2':old,'candidate_c3':new,'reduced':reduced},indent=2));print('FAIRY FACE PASS',len(checks),json.dumps({'old':old,'new':new,'reduced':reduced}))
