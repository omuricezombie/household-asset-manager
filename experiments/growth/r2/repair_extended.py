"""Recover clipped upper pixels from the verified pre-atlas source; no synthesis."""
from PIL import Image,ImageDraw
from pathlib import Path
from scipy.ndimage import label,binary_dilation,gaussian_filter
import numpy as np,json,hashlib,shutil
srcpath=next(Path('source-recovery').rglob('成長する*.png'));src=Image.open(srcpath).convert('RGBA')
a=Image.open('repo/assets/pet-unified-atlas.webp').convert('RGBA');checks=[];sheets={s:Image.new('RGBA',(1280,376)) for s in ['dino','yokai']}
contact=Image.new('RGB',(1280,800),'#e4eddf');draw=ImageDraw.Draw(contact)
for i,p in enumerate(json.load(open('repair-work/registration.json'))):
 s=p['species'];di=p['direction'];row=11 if s=='yokai' else 14
 oldcell=a.crop((di*320,row*360,(di+1)*320,(row+1)*360));original=Image.new('RGBA',(320,376));original.paste(oldcell,(0,16))
 rec=src.transform((320,376),Image.Transform.AFFINE,(p['inverse_x'],0,p['source_x0'],0,p['inverse_y'],p['source_y0']-16*p['inverse_y']),Image.Resampling.BICUBIC)
 raw=np.asarray(rec).copy();old=np.asarray(original);yy,xx=np.mgrid[:376,:320]
 # Restrict to the halo / top spike. Body, facial features, flames and ears outside this ROI are unchanged.
 floor=max(0,original.getbbox()[1]-(16 if s=='yokai' else 32))
 roi=(xx>=90)&(xx<235)&(yy>=floor)&(yy<101)
 valid=(raw[:,:,3]>40)&roi
 labs,n=label(valid);counts=np.bincount(labs.ravel());counts[0]=0;component=labs==int(counts.argmax())
 bbox=Image.fromarray(component.astype('uint8')*255).getbbox();assert bbox is not None
 # Keep original antialiasing only within a narrow dilation of the recovered glyph.
 region=binary_dilation(component,iterations=3)&roi
 # Full source replacement at the missing upper tip, feather into old pixels well below it.
 end=96;weight=region.astype(float)*np.clip((end-yy)/15,0,1)
 # Discard disconnected semi-transparent background artifacts outside the component.
 raw[~binary_dilation(component,iterations=2),3]=0
 # Blend complete RGBA in premultiplied space to avoid a colored seam.
 w=weight[:,:,None];oa=old[:,:,3:4]/255;ra=raw[:,:,3:4]/255
 na=oa*(1-w)+ra*w;rgb=np.divide(old[:,:,:3]*oa*(1-w)+raw[:,:,:3]*ra*w,na,out=np.zeros_like(old[:,:,:3],dtype=float),where=na>0)
 result=np.dstack([np.rint(rgb).clip(0,255).astype('uint8'),np.rint(na[:,:,0]*255).clip(0,255).astype('uint8')]);result[weight==0]=old[weight==0]
 im=Image.fromarray(result);sheets[s].paste(im,(di*320,0));im.save('repair-work/'+s+str(di)+'-restored.png')
 assert np.array_equal(result[~region],old[~region])
 info={'species':s,'direction':di,'source_roi_bbox':bbox,'changed_pixels':int(np.any(result!=old,axis=2).sum()),'outside_roi_identical':True};checks.append(info);print(info)
 for j,view in enumerate([original,im]):
  bg=Image.new('RGBA',view.size,'#e4eddf');bg.alpha_composite(view);x=di*320;y=(i//4)*400+j*190
  contact.paste(bg.convert('RGB').resize((160,180)),(x+j*160,(i//4)*400+30));draw.text((x+j*160+4,(i//4)*400+4),s+str(di)+(' current'if j==0 else' restored'),fill='#20382e')
# Preserve original pixels of the other 52 cells exactly in lossless intermediate PNG.
for species,sheet in sheets.items():
 sheet.save('repair-work/'+species+'-adult-source-restored-r2.webp',format='WEBP',lossless=True,method=4,exact=True)
 assert Image.open('repair-work/'+species+'-adult-source-restored-r2.webp').convert('RGBA').getchannel('A').tobytes()==sheet.getchannel('A').tobytes()
contact.crop((0,0,1280,610)).save('/tmp/restored-full.png')
Path('repair-work/repair-qa.json').write_text(json.dumps({'pre_atlas_sha256':hashlib.sha256(srcpath.read_bytes()).hexdigest(),'atlas_sha256':hashlib.sha256(Path('repo/assets/pet-unified-atlas.webp').read_bytes()).hexdigest(),'frames':checks,'note':'Only original-image recovery of clipped halo/spike; original atlas remains unchanged.'},indent=2))
