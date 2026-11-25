from pathlib import Path
from PIL import Image
import io,time,json,numpy as np
rows=[]
for p in Path('deliverable').glob('*/*-hq.webp'):
 im=Image.open(p).convert('RGBA');orig=np.asarray(im);b=io.BytesIO();t=time.perf_counter();im.save(b,format='WEBP',lossless=True,method=6,exact=True);encoded=b.getvalue();dec=np.asarray(Image.open(io.BytesIO(encoded)).convert('RGBA'))
 assert np.array_equal(orig[:,:,3],dec[:,:,3]) and np.array_equal(orig[orig[:,:,3]>0,:3],dec[orig[:,:,3]>0,:3])
 rows.append({'file':str(p.relative_to('deliverable')),'original_bytes':p.stat().st_size,'lossless_method6_bytes':len(encoded),'save_seconds':round(time.perf_counter()-t,3),'visible_pixels_identical':True})
 print(rows[-1],flush=True)
Path('deliverable/compression_probe.json').write_text(json.dumps({'adopted':False,'note':'Separate in-memory experiment only. Original files never replaced. Lossy compression deliberately not adopted before Human QA.','results':rows},indent=2))
