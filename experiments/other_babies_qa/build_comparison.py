from pathlib import Path
import base64,re,json,hashlib
root=Path('.'); out=Path('deliverable')
S=['dino','fantasy','yokai','fairy']
def uri(p):return 'data:image/'+('svg+xml' if p.suffix=='.svg' else 'webp')+';base64,'+base64.b64encode(p.read_bytes()).decode()
css=(root/'pet-game.css').read_text()
# Exact stylesheet and renderer from stable; only the HQ copy substitutes sprite sources.
assert (root/'pet-game.css').read_bytes()==__import__('subprocess').check_output(['git','show','3d7933e1cbb87f81765801d723a36c5e8fe07a34:pet-game.css'])
orig_css=re.sub(r'url\([\'\"]?([^\)\'\"]+)[\'\"]?\)',lambda m:'url("'+uri(root/m[1].split('?')[0])+'")' if (root/m[1].split('?')[0]).exists() else 'none',css)
hq=css
mapping={'pet-unified-atlas.webp':'base','pet-blink-dino-baby.webp':'face','pet-blink-fantasy-baby.webp':'face','pet-blink-fairy-baby.webp':'face','pet-gaze-yokai-baby.svg':'face','pet-baby-tail-sides.webp':'motion','pet-fantasy-baby-wings.webp':'motion','pet-fairy-baby-wing-axis.webp':'motion','pet-yokai-baby-tail-swing-fixed.webp':'motion'}
hq=re.sub(r'url\([\'\"]?([^\)\'\"]+)[\'\"]?\)',lambda m:'var(--hq-'+mapping[Path(m[1].split('?')[0]).name]+')' if Path(m[1].split('?')[0]).name in mapping else 'url("'+uri(root/m[1].split('?')[0])+'")' if (root/m[1].split('?')[0]).exists() else 'none',hq)
hq=hq.replace('400% 1500%','400% 100%').replace('0% var(--food-row)','0% 0%')
hq=re.sub(r'(\.pet-character \.pet-unified\.pet-art-\w+\.pet-art-baby \.pet-art-image\{background-position-y:)[^}]+',r'\g<1>0%',hq)
hq=hq.replace('.pet-art-dino.pet-art-baby.pet-art-left > .pet-art-image:first-child{background-position-y:66.66666666666667%}', '.pet-art-dino.pet-art-baby.pet-art-left > .pet-art-image:first-child{background-position-y:0%}')
# Dino output omits two animal rows; remap that strip only.
hq=hq.replace('background-size:300% 400%;\n  background-position-x:0%;\n  animation:pet247-tail-sway','background-size:300% 200%;\n  background-position-x:0%;\n  animation:pet247-tail-sway')
for name in set(re.findall(r'@keyframes\s+([\w-]+)',hq)):hq=re.sub(r'\b'+re.escape(name)+r'\b','hq-'+name,hq)
# Scope the cloned stylesheet without changing the selectors or keyframe timings.
def split_selectors(s):
 arr=[];start=0;depth=0
 for i,c in enumerate(s):
  if c=='(':depth+=1
  if c==')':depth-=1
  if c==',' and depth==0:arr.append(s[start:i]);start=i+1
 return arr+[s[start:]]
def scope(s,frames=False):
 s=re.sub(r'/\*.*?\*/','',s,flags=re.S);parts=[];i=0
 while i<len(s):
  a=s.find('{',i)
  if a<0:break
  pre=s[i:a].strip();depth=1;b=a+1;quote=None
  while depth:
   c=s[b]
   if quote:
    if c==quote and s[b-1]!='\\':quote=None
   elif c in '\"\'':quote=c
   elif c=='{':depth+=1
   elif c=='}':depth-=1
   b+=1
  content=s[a+1:b-1]
  if pre.startswith('@media') or pre.startswith('@supports'):content=scope(content)
  elif pre.startswith('@keyframes'):pass
  else:pre=','.join('.qa-hq '+v.strip() for v in split_selectors(pre))
  parts.append(pre+'{'+content+'}');i=b
 return '\n'.join(parts)
hq=scope(hq)
food='''
.qa-hq .pet-stage .pet-character.pet-mood-food[data-growth="baby"] .pet-unified.pet-art-baby.pet-art-front > .pet-art-image:first-child{background-image:var(--hq-food);background-size:300% 100%;background-position:0% 0%;animation:hq-pet247-care-food-frames 1.65s steps(1,end) both!important}
.qa-hq .pet-stage .pet-character.pet-mood-food[data-growth="baby"] .pet-care-chew{display:none!important;animation:none!important}
@keyframes hq-pet247-care-food-frames{0%,27%{background-position-x:0%}29%,49%,69%,89%,100%{background-position-x:50%}39%,59%,79%{background-position-x:100%}}
@media(prefers-reduced-motion:reduce){.qa-hq .pet-stage .pet-character.pet-mood-food[data-growth="baby"] .pet-unified.pet-art-baby.pet-art-front > .pet-art-image:first-child{animation:none!important;background-position-x:50%!important}}
'''
prev=Path('experiments/other_babies_qa/template.html').read_text()
ui=prev[prev.index('*{box-sizing'):prev.index('.qa-hq .pet-stage .pet-character.pet-mood-food',prev.index('*{box-sizing'))]
# strip any data-dependent HQ rules, keep UI only
ui=ui[:ui.find('\n\n')] if '\n\n' in ui else ui
ui+=' .qa-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.qa-old,.qa-hq{min-width:0}.only-hq .qa-old,.only-old .qa-hq{display:none}.only-hq .qa-grid,.only-old .qa-grid{grid-template-columns:1fr}@media(max-width:370px){.qa-grid{grid-template-columns:1fr}}select{font:inherit;padding:9px;border-radius:8px}button{min-height:42px}'
body=prev[prev.index('<main>'):prev.index('<script>')]
body=body.replace('動物風幼体｜高画質 動作比較','幼体4種族｜高画質 動作比較').replace('<nav id="dirs">','<nav><label>種族 <select id="species"><option value="dino">恐竜</option><option value="fantasy">架空の生き物</option><option value="yokai">妖怪</option><option value="fairy">妖精</option></select></label><span>試作 r1・v0.2.47基準</span></nav><nav id="dirs">').replace('data-room-type="animal"','data-room-type="dino"')
script=prev[prev.index("let facing="):prev.index('</script>')]
script='const sprites='+json.dumps({s:{k:uri(out/s/f'{s}-{k}-hq.webp') for k in ['base','face','motion','food']} for s in S})+';let species="dino";\n'+script
script=script.replace('data-type="animal"','data-type="\'+species+\'"').replace("type:'animal'","type:species")
script=script.replace("startsWith('pet247-care-')","match(/^(hq-)?pet247-care-/)")
script=script.replace("if(ch.dataset.facing!==dir||!ch.querySelector('.pet-illustration'))", "if(ch.dataset.type!==species||ch.dataset.facing!==dir||!ch.querySelector('.pet-illustration'))")
script=script.replace('ch.dataset.facing=dir;', 'ch.dataset.type=species;ch.dataset.facing=dir;')
script+='''
function selectSpecies(){species=document.querySelector('#species').value;clearTimeout(timer);mood='idle';facing=mode==='auto'?'front':mode;for(const [k,u] of Object.entries(sprites[species]))document.querySelector('.qa-hq').style.setProperty('--hq-'+k,'url("'+u+'")');document.querySelectorAll('.pet-room').forEach(x=>x.dataset.roomType=species);paint()}
document.querySelector('#species').onchange=selectSpecies;selectSpecies();
'''
page='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>幼体4種族｜Real-ESRGAN 動作比較 r1</title><style>'+orig_css+'\n'+hq+'\n'+food+ui+'</style>'+body+'<script>'+(root/'pet-illustration.js').read_text()+'\n'+script+'</script>'
(out/'pet_other_babies_hq_motion_qa.html').write_text(page)
(out/'comparison.css').write_text(hq+food)
print('comparison bytes',len(page.encode()))
