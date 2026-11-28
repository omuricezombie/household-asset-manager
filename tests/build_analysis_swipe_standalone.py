"""Standalone Human QA: candidate markup/styles/scripts; only DB I/O and boot seed replaced. No real DB or SW."""
from pathlib import Path
import re,sys
out=Path(sys.argv[1]) if len(sys.argv)>1 else Path('artifacts/household_v0254c1_analysis_swipe_qa.html')
out.parent.mkdir(parents=True,exist_ok=True)
html=Path('index.html').read_text();css='\n'.join(Path(n).read_text() for n in re.findall(r'<link rel="stylesheet" href="([^?]+)\?[^\"]+">',html))
# No production assets or real data needed for analysis-only confirmation.
css=re.sub(r'url\([^)]*assets/[^)]*\)', 'none',css)
html=re.sub(r'<link rel="(?:stylesheet|manifest)"[^>]+>','',html)
storage='''<script>(()=>{for(const k of ['localStorage','sessionStorage']){const d=new Map();Object.defineProperty(window,k,{value:{getItem:x=>d.get(String(x))??null,setItem:(x,v)=>d.set(String(x),String(v)),removeItem:x=>d.delete(String(x)),clear:()=>d.clear()},configurable:true});}})();</script>'''
html=html.replace('</head>',storage+'<style>'+css+'\n.qa-note{max-width:760px;margin:8px auto;padding:8px 12px;background:var(--card);font-size:12px;border:1px solid var(--line)}</style></head>')
html=html.replace('</header>','</header><div class="qa-note">確認用・合成データのみ（保存はメモリ内）。履歴・分析を選択して左右スワイプをお試しください。育成・PWA・実データ保存は確認対象外です。</div>')
mem='''const mem=Object.fromEntries(STORES.map(n=>[n,[]]));
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const keyOf=(n,v)=>({meta:v.key,settings:v.key,assetSnapshots:[v.month,v.accountId],pointSnapshots:[v.month,v.pointAccountId],monthStatus:v.month}[n]??v.id);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function open(){return null;}
async function get(n,k){return clone(mem[n].find(v=>same(keyOf(n,v),k)));}
async function getAll(n){return clone(mem[n]);}
async function put(n,v){const i=mem[n].findIndex(x=>same(keyOf(n,x),keyOf(n,v)));if(i<0)mem[n].push(clone(v));else mem[n][i]=clone(v);return keyOf(n,v);}
async function del(n,k){mem[n]=mem[n].filter(v=>!same(keyOf(n,v),k));}
async function clear(n){mem[n]=[];}
async function getAllByIndex(n,i,k){return clone(mem[n].filter(v=>same(v[i],k)));}
async function getByIndex(n,i,k){return (await getAllByIndex(n,i,k))[0];}
async function bulkPut(n,vs){for(const v of vs)await put(n,v);}
async function bulkDelete(n,ks){for(const k of ks)await del(n,k);}
async function atomicChanges(puts,deletes={}){for(const n of Object.keys(puts))await bulkPut(n,puts[n]);for(const n of Object.keys(deletes))await bulkDelete(n,deletes[n]);}
'''
fixture=Path('tests/analysis_swipe_fixture.js').read_text()
def inline(m):
 n=m.group(1).split('?')[0];s=Path(n).read_text()
 if n=='db.js':
  a=s.index('  function open(){');b=s.index('  async function seed(){');s=s[:a]+mem+s[b:];s=s.replace("const DB_NAME='householdAssetManagerDB_v2'","const DB_NAME='analysisQA-memory-only'");s+='\n'+fixture
 if n=='app.js':
  s=s.replace('await DB.open();await DB.seed();','await DB.open();await DB.seed();await seedAnalysisQA();',1)
  s=s.replace("if(location.protocol==='https:'||location.hostname==='localhost') navigator.serviceWorker?.register('service-worker.js',{updateViaCache:'none'}).catch(()=>{});", "if(document.getElementById('petEnabled'))document.getElementById('petEnabled').disabled=true;")
  # Explicitly keep this QA document off session/history persistent settings (if file URL disallows pushState).
  # Actual application gesture and render paths remain unmodified.
 return '<script>'+s.replace('</script','<\\/script')+'</script>'
html=re.sub(r'<script src="([^\"]+)"\s*></script>',inline,html)
out.write_text(html);print(out,out.stat().st_size)
