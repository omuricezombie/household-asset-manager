from pathlib import Path
from PIL import Image
import numpy as np,json
from scipy.ndimage import map_coordinates
from scipy.optimize import differential_evolution,least_squares
src=np.asarray(Image.open(next(Path('source-recovery').rglob('成長する*.png'))).convert('RGBA'),dtype=float)
a=Image.open('repo/assets/pet-unified-atlas.webp').convert('RGBA');rows=[]
for name,row,rawrow in [('yokai',11,3),('dino',14,4)]:
 for di in range(4):
  target=np.asarray(a.crop((di*320,row*360,(di+1)*320,(row+1)*360)),dtype=float)
  yy,xx=np.mgrid[0:360:4,0:320:4];mask=(target[yy,xx,3]>245)&(yy>65)&(yy<315)
  yy=yy[mask].astype(float);xx=xx[mask].astype(float);ref=target[yy.astype(int),xx.astype(int),:3];xbase=(8+di)*1942/12;ybase=rawrow*809/5
  def residual(p):
   ix=xx*p[0]+xbase+p[2];iy=yy*p[1]+ybase+p[3]
   col=np.stack([map_coordinates(src[:,:,c],[iy,ix],order=1,mode='nearest')for c in range(3)],axis=1)
   return ((col-ref)/255).ravel()
  bounds=[(.38,.62),(.38,.62),(-25,25),(-35,10)]
  opt=differential_evolution(lambda p:np.mean(residual(p)**2),bounds,popsize=9,maxiter=100,tol=.001,seed=44,polish=True)
  fit=least_squares(residual,opt.x,loss='soft_l1',f_scale=.04,max_nfev=100)
  info={'species':name,'direction':di,'inverse_x':fit.x[0],'inverse_y':fit.x[1],'source_x0':xbase+fit.x[2],'source_y0':ybase+fit.x[3],'rmse':float(np.sqrt(np.mean(residual(fit.x)**2)))};print(info,flush=True);rows.append(info)
Path('repair-work/registration.json').write_text(json.dumps(rows,indent=2))
