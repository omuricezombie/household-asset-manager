/* Transient sleep state machine. No storage, no finance logic. */
function createSleepController({schedule=setTimeout,cancel=clearTimeout,now=()=>performance.now(),random=Math.random,onChange=()=>{},short=true}={}){
 let state='idle',timer=null,deadline=0,remaining=0,paused=false,disposed=false,epoch=0,queued=null,mode=short?'short':'normal';
 const actions={pet:1700,feed:1700,brush:2700,ball:4100,rest:3200};
 const duration=(a,b)=>a+Math.max(0,Math.min(0.999999,random()))*(b-a);
 function stop(){epoch++;if(timer!==null)cancel(timer);timer=null;}
 function arm(ms){stop();remaining=Math.max(0,ms);if(paused||disposed)return;deadline=now()+remaining;const token=epoch;timer=schedule(()=>{if(token!==epoch||paused||disposed)return;timer=null;advance()},remaining);}
 function enter(s,ms){if(disposed)return;state=s;arm(ms);onChange(snapshot());}
 function idle(){queued=null;enter('idle',mode==='short'?duration(5000,9000):duration(60000,120000));}
 function sleep(){enter('sleep',mode==='short'?duration(12000,18000):duration(120000,300000));}
 function wake(action=null){queued=action;enter('wake',750);}
 function advance(){if(state==='idle')enter('drowsy',3600);else if(state==='drowsy')sleep();else if(state==='sleep')wake();else if(state==='wake'){const a=queued;queued=null;if(a)enter(a,actions[a]);else idle();}else idle();}
 function snapshot(){return {state,mode,paused,remaining:paused?remaining:Math.max(0,deadline-now()),queued};}
 function act(a){if(disposed||!(a in actions))return;if(['sleep','drowsy','wake'].includes(state))wake(a);else enter(a,actions[a]);}
 function touch(){if(disposed)return;if(['sleep','drowsy'].includes(state))wake();else if(state==='wake')return;else act('pet');}
 function wakeOnly(){if(!disposed&&['sleep','drowsy'].includes(state))wake();}
 function pause(){if(paused||disposed)return;remaining=Math.max(0,deadline-now());paused=true;stop();onChange(snapshot());}
 function resume(){if(!paused||disposed)return;paused=false;arm(remaining);onChange(snapshot());}
 function setMode(m){if(disposed||!['short','normal'].includes(m))return;mode=m;idle();}
 function forceSleep(){if(disposed)return;queued=null;enter('drowsy',3600);}
 function dispose(){disposed=true;stop();}
 idle();return{snapshot,act,touch,wakeOnly,pause,resume,setMode,forceSleep,reset:idle,dispose};
}
if(typeof module!=='undefined')module.exports={createSleepController};