/* Live teen renderer, using accepted r1 assets and timing. No persistence, independent sleep timer, or reward logic. */
(function(global){
'use strict';
const HAM=global.HAM, DATA=HAM.TeenArtData, dirs=['front','left','back','right'];
const cache=new Map(); let target=null, layer=null, read=null, timer=0, generation=0, last='', phaseStart=0,nextBlink=0,blinkAt=-1,actionKey='',loaded=null;
const media=global.matchMedia('(prefers-reduced-motion: reduce)');
function load(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error(url));im.src=url+'?v=0253';});}
function sources(d){const result=new Set();function walk(v){if(typeof v==='string'&&v.startsWith('assets/'))result.add(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(d);return [...result];}
function loadSpecies(k){for(const key of cache.keys())if(key!==k)cache.delete(key);if(!cache.has(k)){const promise=Promise.all(sources(DATA[k]).map(async p=>[p,await load(p)])).then(Object.fromEntries);cache.set(k,promise);promise.catch(()=>cache.delete(k));}return cache.get(k);}
function halt(){clearTimeout(timer);timer=0;}
function stop(){halt();generation++;if(layer){layer.remove();if(target){const a=target.querySelector('.pet-illustration');if(a)delete a.dataset.teenLive;delete target.dataset.teenAction;}}target=layer=read=loaded=null;last=actionKey='';}
function available(){return target?.isConnected&&layer?.isConnected&&!document.hidden&&!document.body.classList.contains('app-locked')&&!!read?.();}
function mount(ch,getState){const art=ch?.querySelector('.pet-illustration');if(!art||!DATA[ch.dataset.type]){stop();return;}if(ch===target&&layer?.parentNode===art){read=getState;refresh();return;}stop();target=ch;read=getState;const k=ch.dataset.type,token=++generation;layer=document.createElement('span');layer.className='teen-live';layer.dataset.species=k;layer.dataset.action='idle';layer.innerHTML='<canvas width="640" height="720" aria-hidden="true"></canvas><span class="teen-ball-shadow"></span><span class="teen-ball"></span><span class="teen-ball-heart">♥</span><span class="teen-brush-prop"></span><span class="teen-brush-heart">♥</span><span class="teen-animal-food"></span>';layer.hidden=true;art.append(layer);phaseStart=performance.now();nextBlink=phaseStart+3000+Math.random()*2000;blinkAt=-1;loadSpecies(k).then(img=>{if(token!==generation||!layer?.isConnected)return;loaded=img;layer.hidden=false;art.dataset.teenLive='true';refresh();}).catch(e=>{if(token===generation){console.warn('Teen art fallback',e.message);stop();}});}
function frameIndex(n){return n<0?(n===-2?0:1):n>0?(n===1?2:3):-1;}
function refresh(){halt();if(!available()||!loaded)return;draw();}
function draw(){if(!available()||!loaded){halt();return;}const s=read(),k=target.dataset.type,d=DATA[k],c=layer.querySelector('canvas'),ctx=c.getContext('2d'),now=performance.now(),reduced=media.matches,action=s.action||'',sleep=s.sleep?.state||'',elapsed=sleep==='drowsy'?3600-s.sleep.remaining:sleep==='wake'?750-s.sleep.remaining:0,t=Math.max(0,now-s.started),aKey=[action,s.sequence,sleep].join(':');
 if(aKey!==actionKey){actionKey=aKey;last='';layer.dataset.action='none';delete layer.dataset.sleep;void layer.offsetWidth;layer.dataset.action=action||(!sleep?'idle':'none');if(sleep)layer.dataset.sleep=sleep;else delete layer.dataset.sleep;target.toggleAttribute('data-teen-action',!!action);layer.style.setProperty('--teen-delay',`-${Math.max(0,action?t:sleep==='drowsy'?elapsed:0)}ms`);phaseStart=now;nextBlink=now+3000+Math.random()*2000;blinkAt=-1;}
 layer.dataset.paused=String(!!s.sleep?.paused||!!s.held);let direction=action||sleep?'front':target.dataset.facing||'front',f=-1,m=-1,ear=0,tail=0,mouth='',offer=false,heart=false,pose=false;
 const img=n=>loaded[n];const base=()=>{ctx.clearRect(0,0,640,720);ctx.drawImage(img(d.base),Math.max(0,dirs.indexOf(direction))*640,0,640,720,0,0,640,720);};
 const patch=(p,i)=>{if(!p||i<0)return;const [x,y,x1,y1]=p.rect,w=x1-x,h=y1-y;ctx.clearRect(x,y,w,h);ctx.drawImage(img(p.src),w*i,0,w,h,x,y,w,h);};
 if(sleep){f=sleep==='sleep'?2:sleep==='drowsy'?(reduced?2:elapsed<650?-1:elapsed<1260?0:elapsed<1690?2:elapsed<2200?1:2):(reduced?-1:elapsed<260?2:elapsed<560?0:-1);pose=!!d.pose&&(sleep==='sleep'||(sleep==='wake'&&elapsed<230&&!reduced));mouth=sleep==='wake'&&f<0?'':'closed';}
 else if(action==='ball'){const tracks={animal:[56.275,59.775],fantasy:[56.275,59.775],fairy:[56.25,60],dino:[55.5,58.75],yokai:[56.25,60]},p=t/40,[r,l]=tracks[k];direction=dirs[reduced?3:p<6.125?0:p<r?3:p<l?0:p<87.5?1:0];}
 else if(action){
 if(action==='feed'){offer=!reduced&&t<480;mouth=offer?'':!reduced&&t>=650&&Math.floor((t-650)/160)%2===0&&t<1450?'chew':'closed';}
 else if(action==='brush'){f=k==='yokai'?(reduced?1:t<312?0:t<1976?2:t<2340?1:-1):(reduced?2:t<312?-1:t<468?0:t<1976?2:t<2184?1:t<2340?0:-1);mouth=k==='yokai'?'':'closed';if(k==='animal')f=reduced?2:t<468?0:t<1976?2:t<2340?0:-1;}
 else if(k==='yokai'){f=reduced?1:action==='pet'?(t<300?1:t<1280?2:-1):(t<610?1:t<2530?2:-1);mouth='closed';}
 else {f=reduced?2:action==='pet'?(t<145?0:t<300?1:t<1280?2:t<1450?1:t<1550?0:-1):(t<380?0:t<610?1:t<2530?2:t<2800?1:t<3000?0:-1);mouth='closed';if(k==='animal')f=reduced?2:action==='pet'?(t<300?0:t<1280?2:t<1450?0:-1):(t<610?0:t<2530?2:t<2800?0:-1);}
 heart=action==='pet'&&!reduced&&t>190&&t<1550;
 }else if(!reduced&&!s.held){const p=(now-phaseStart)/1000,parts=d.dirs[direction];if(k==='animal'){let ph=p%4.8;ear=ph<.85?Math.round(4*Math.sin(Math.PI*ph/.85)):0;if(parts.tail)tail=direction==='back'?Math.round(4*Math.sin(p*2*Math.PI/2.8)):Math.round(4*(1-Math.cos(p*2*Math.PI/2.6))/2);}
 else if(parts.motion)m=frameIndex(Math.round(2*Math.sin(p*2*Math.PI/(k==='fairy'?1.8:k==='fantasy'?2.4:2.8))));
 if(direction==='front'){if(k==='yokai')f=frameIndex(Math.round(2*Math.sin(p*2*Math.PI/5.1)));else{if(blinkAt<0&&now>=nextBlink)blinkAt=now;const e=blinkAt<0?-1:now-blinkAt;f=e<0?-1:k==='animal'?(e<70?0:e<185?2:e<255?0:-1):(e<75?0:e<140?1:e<250?2:e<315?1:e<390?0:-1);if(e>=(k==='animal'?255:390)){blinkAt=-1;nextBlink=now+3000+Math.random()*2000;}}}}
 const key=[direction,f,m,ear,tail,mouth,pose,action,offer?Math.floor(t/25):'',heart?Math.floor(t/25):''].join(':');
 if(key!==last){last=key;if(pose){ctx.clearRect(0,0,640,720);ctx.drawImage(img(d.pose),0,0,640,720);}else{base();const parts=d.dirs[direction];if(k==='animal'){patch(parts.ears,ear-1);if(tail!==0)patch(parts.tail,direction==='back'?(tail<0?tail+4:tail+3):tail-1);if(direction==='front'&&f>=0)ctx.drawImage(img(f===2?d.closed:d.half),0,0);if(mouth)ctx.drawImage(img(mouth==='chew'?d.mouthChew:d.mouthClosed),0,0);}else{patch(parts.motion,m);if(k==='yokai'&&sleep&&f>=0){ctx.clearRect(211,213,208,185);ctx.drawImage(img(d.eyes[f===2?'closed':'half']),211,213);}else patch(parts.face,f);if(mouth)ctx.drawImage(img(d.care[mouth]),0,0);}
 if(offer&&k!=='animal'){const p=t/480,[x,y]=k==='animal'?[320,374]:d.care.mouth,scale=p<.6?1:Math.max(.1,1-(p-.6)*2.25),w=84*scale;ctx.globalAlpha=p>.85?(1-p)/.15:1;ctx.drawImage(img(k==='animal'?d.food:d.care.food),x-w/2,y-w/2+85*(1-p),w,w);ctx.globalAlpha=1;}
 if(heart){const p=(t-190)/1360;ctx.save();ctx.globalAlpha=Math.min(1,p*6,(1-p)*3);ctx.font='60px sans-serif';ctx.fillStyle='#c85d76';ctx.fillText('♥',500,200-50*p);ctx.restore();}}}
 layer.dataset.offer=String(offer);c.dataset.direction=direction;c.dataset.face=String(f);c.dataset.motion=String(m);c.dataset.sleepPose=String(pose);c.dataset.mouth=mouth;
 if(!s.sleep?.paused&&!s.held&&sleep!=='sleep'&&(!reduced||!!action||!!sleep))timer=setTimeout(draw,action||sleep?25:k==='animal'?70:40);
}
function update(ch,getState){if(!ch||!getState){stop();return;}mount(ch,getState);}
media.addEventListener?.('change',refresh);document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();else refresh();});
HAM.PetTeen={update,stop,_test:{running:()=>!!timer}};
})(window);
