"""Limit runtime changes to history swipe surface, gesture handler, and release identifiers."""
from pathlib import Path
import os,subprocess,re,json,zipfile
base='e56dc3fc269e41b6244a8e5cee589a679259d9b3'
z=zipfile.ZipFile(os.environ['SWIPE_BASE_ZIP']) if os.environ.get('SWIPE_BASE_ZIP') else None
files=[n.removeprefix('household-asset-manager/') for n in z.namelist() if n.startswith('household-asset-manager/') and not n.endswith('/')] if z else subprocess.check_output(['git','ls-tree','-r','--name-only',base],text=True).splitlines()
def before(n):return z.read('household-asset-manager/'+n) if z else subprocess.check_output(['git','show',base+':'+n])
checks=[]
def ck(n,v):assert v,n;checks.append(n)
def version_normalized(b):return b.replace(b'0.2.53',b'0.2.52').replace(b'0253',b'0252')
for n in files:
 if n.startswith(('tests/','.github/')) or n in ['app.js','index.html','styles.css','README.md','README_HUMAN_QA.txt','.gitignore']:continue
 b=Path(n).read_bytes();ck(n+' runtime equal'+(' after version normalize' if n.endswith(('.js','.css','.html')) else ''),(version_normalized(b) if n.endswith(('.js','.css','.html')) else b)==before(n))
ck('Human QA instructions retain old history',Path('README_HUMAN_QA.txt').read_bytes().startswith('v0.2.53 正式版 本番確認'.encode()) and Path('README_HUMAN_QA.txt').read_bytes().endswith(before('README_HUMAN_QA.txt')))
# Full code equality outside the exact shared swipe binder.
a=before('app.js').decode();b=Path('app.js').read_text();start='function bindMonthSwipe(){';end='\nfunction bind(){';ck('app.js outside swipe binder byte-identical',a.split(start)[0]==b.split(start)[0] and a.split(end,1)[1]==b.split(end,1)[1]);ck('reuses shared month transition','void changeSelectedMonth(monthShift(selectedMonth,dx<0?1:-1));' in b.split(start)[1].split(end)[0]);ck('analysis chart allowlist','[data-history-swipe]' in b and 'if(!inAnalysis&&target.closest(\'.bar-list\')' in b)
old=before('styles.css');new=Path('styles.css').read_bytes();ck('CSS existing prefix exact',new.startswith(old));ck('CSS additions scope',new[len(old):].decode().strip()=='''/* Read-only month-relative analysis surfaces: keep native vertical scroll and pinch zoom. */
[data-screen="history"] [data-history-swipe]{touch-action:pan-y pinch-zoom}
.history-swipe-hint{margin:0 2px 10px;font-size:12px}''')
# Removing the added hint and data attributes from history restores all old markup.
a=before('index.html');b=version_normalized(Path('index.html').read_bytes());b=re.sub(rb'\n      <p class="history-swipe-hint muted" data-history-swipe>[^<]+</p>',b'',b,count=1);b=b.replace(b' data-history-swipe',b'');ck('HTML only allowlist/hint and version',a==b)
ck('all JS syntax',all(subprocess.run(['node','--check',str(p)],capture_output=True).returncode==0 for p in Path('.').glob('*.js')))
Path('AI_QA_0253_analysis_static.json').write_text(json.dumps({'count':len(checks),'checks':checks},ensure_ascii=False,indent=2));print('ANALYSIS STATIC PASS',len(checks))
