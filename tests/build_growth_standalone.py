"""Offline diagnostic only; uses actual candidate renderer/CSS; never opens user DB."""
from pathlib import Path
import re,base64,json,subprocess
out=Path('artifacts');out.mkdir(exist_ok=True)
paths=list(Path('assets/hq-growth').glob('*.webp'))+list(Path('assets').glob('pet-room-*.svg'))+[Path('assets/pet-unified-atlas.webp')]
assets={str(p):{'type':'image/svg+xml'if p.suffix=='.svg'else'image/webp','data':base64.b64encode(p.read_bytes()).decode()}for p in paths}
css=Path('pet-game.css').read_text()+'\n'+Path('pet-hq.css').read_text()
bootstrap='''<script>const embeddedAssets=/*ASSETS_DATA*/;const blobPaths={};for(const[k,v]of Object.entries(embeddedAssets)){const t=atob(v.data),a=new Uint8Array(t.length);for(let i=0;i<t.length;i++)a[i]=t.charCodeAt(i);blobPaths[k]=URL.createObjectURL(new Blob([a],{type:v.type}));}function mapArtUrls(text){return text.replace(/url\\((['"]?)(?:\\.\\/)?(assets\\/[^)'"\\s]+)\\1\\)/g,(whole,q,path)=>blobPaths[path.split('?')[0]]?'url('+blobPaths[path.split('?')[0]]+')':whole);}let style=document.createElement('style');style.textContent=mapArtUrls(/*CSS_DATA*/);document.head.append(style);</script>'''.replace('/*ASSETS_DATA*/',json.dumps(assets,separators=(',',':'))).replace('/*CSS_DATA*/',json.dumps(css))
html=Path('hq-integration-qa.html').read_text();html=re.sub(r'<link rel="stylesheet"[^>]+>','',html);html=html.replace('<style>',''+bootstrap+'<style>',1)
renderer=Path('pet-illustration.js').read_text()+"\nconst actualDraw=HAM.PetIllustration.draw;HAM.PetIllustration.draw=options=>mapArtUrls(actualDraw(options));"
html=re.sub(r'<script src="pet-illustration.js[^>]+></script>',lambda m:'<script>'+renderer.replace('</script','<\\/script')+'</script>',html)
html=html.replace('<option value="baby">幼体（採用済み）</option>','')
html=re.sub(r'<p><a href="index.html[^<]+</a></p>','<p>保存なしの統合確認画面です。幼体の専用動作・家計入力の再確認は不要です。</p>',html)
embedded=json.loads(html.split('const embeddedAssets=',1)[1].split(';const blobPaths',1)[0])
for key,value in embedded.items():assert base64.b64decode(value['data'])==Path(key).read_bytes()
for script in re.findall(r'<script>(.*?)</script>',html,re.S):subprocess.run(['node','--check'],input=script.encode(),check=True,capture_output=True)
(out/'household_v0_2_49_stable_growth_QA.html').write_text(html)
print('standalone bytes',len(html.encode()))
