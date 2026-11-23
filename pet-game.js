/* Optional local-only pet game. Never mutates transactions or finance calculations. */
(function(global){
  'use strict';
  const HAM=global.HAM, DB=HAM.DB, A=HAM.Analysis;
  const KEY='petGameStateV1', DAILY_CAP=10;
  const CATEGORY_LIST=['食費','日用品','衣料費','交通費','通信・光熱費','サブスク','美容費','娯楽費','趣味費','漫画・本','リフレッシュ費','交際費','洗濯','貸本','家電','医療','教育費','仕送り','家賃','その他'];
  const DEFAULT_CATEGORIES=['食費','日用品','衣料費','交通費','通信・光熱費','サブスク','美容費','娯楽費','趣味費','漫画・本','リフレッシュ費','交際費','洗濯','貸本'];
  const LEVEL_THRESHOLDS=[0,100,250,450,700,1000,1400,1900,2500,3200,4000,5000];
  const ACTIONS=[
    {id:'pet',label:'なでる',icon:'♡',level:1,type:'pet',gain:2,reply:'うれしそうに目を細めた！'},
    {id:'feed',label:'ごはん',icon:'●',level:1,type:'food',gain:2,reply:'おいしそうにもぐもぐしている。'},
    {id:'rest',label:'見守る',icon:'☾',level:1,type:'calm',gain:1,reply:'安心したように、のんびりしている。'},
    {id:'brush',label:'ブラッシング',icon:'✧',level:2,type:'pet',gain:2,reply:'毛並みがふわふわになった！'},
    {id:'ball',label:'ボール',icon:'◯',level:2,type:'play',gain:3,reply:'ボールを追いかけて跳ね回った！'},
    {id:'snack',label:'おやつ',icon:'✿',level:3,type:'food',gain:2,reply:'おやつに大喜び！'},
    {id:'dance',label:'ダンス',icon:'♪',level:4,type:'play',gain:3,reply:'くるくる踊ってみせてくれた！'},
    {id:'hide',label:'かくれんぼ',icon:'?',level:5,type:'play',gain:3,reply:'見つけた！ ちょっと得意げ。'},
    {id:'blanket',label:'おふとん',icon:'☁',level:5,type:'calm',gain:1,reply:'ふかふかのおふとんで、うとうと。'},
    {id:'feast',label:'ごちそう',icon:'★',level:6,type:'food',gain:2,reply:'特別なごちそうを味わっている。'},
    {id:'fruit',label:'くだもの',icon:'♧',level:1,type:'food',gain:2,categories:['食費'],reply:'旬のくだものを食べてごきげん！'},
    {id:'storybook',label:'絵本遊び',icon:'▣',level:1,type:'calm',gain:2,categories:['趣味費','漫画・本','娯楽費'],reply:'物語に夢中になっている。'}
  ];
  let state=null, navigate=null, current='home', mood='idle', redrawBusy=false, rerender=false;
  let visitTimer=null, lastVisit=0, actionTimer=null, saveChain=Promise.resolve(), initialized=false;
  const $=id=>document.getElementById(id);
  const safeText=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const thisDay=()=>DB.ymd();
  function fresh(){
    return {version:1,enabled:false,startedMonth:null,affection:0,
      traits:{pet:0,food:0,play:0,calm:0},daily:{date:'',used:0,traitsUsed:0},
      awards:{},categories:DEFAULT_CATEGORIES.slice(),lastAction:null};
  }
  function normalize(value){
    const s=fresh();
    if(!value||typeof value!=='object')return s;
    s.enabled=value.enabled===true;
    if(/^\d{4}-\d{2}$/.test(String(value.startedMonth||'')))s.startedMonth=value.startedMonth;
    s.affection=Math.max(0,Math.min(100,Number(value.affection)||0));
    for(const k of Object.keys(s.traits))s.traits[k]=Math.max(0,Math.min(10000,Number(value.traits&&value.traits[k])||0));
    if(value.daily&&typeof value.daily==='object'){
      s.daily={date:String(value.daily.date||''),used:Math.max(0,Math.min(DAILY_CAP,Number(value.daily.used)||0)),
        traitsUsed:Math.max(0,Math.min(12,Number(value.daily.traitsUsed)||0))};
    }
    if(Array.isArray(value.categories))s.categories=[...new Set(value.categories.filter(x=>CATEGORY_LIST.includes(x)))];
    if(value.awards&&typeof value.awards==='object'&&!Array.isArray(value.awards)){
      for(const [k,v] of Object.entries(value.awards)){
        if(!/^\d{4}-\d{2}$/.test(k)||!v||typeof v!=='object')continue;
        const items=Array.isArray(v.items)?v.items.filter(x=>x&&CATEGORY_LIST.includes(x.category)).map(x=>({
          category:x.category,points:Math.max(0,Number(x.points)||0),
          target:Math.max(0,Number(x.target)||0),best:Math.max(0,Number(x.best==null?x.target:x.best)||0),kind:x.kind==='maintain'?'maintain':'new'
        })):[];
        s.awards[k]={points:Math.max(0,Number(v.points)||0),bonus:Math.max(0,Number(v.bonus)||0),
          items,earnedAt:String(v.earnedAt||'')};
      }
    }
    s.lastAction=typeof value.lastAction==='string'?value.lastAction:null;
    return s;
  }
  function persist(){
    const snapshot=JSON.parse(JSON.stringify(state));
    saveChain=saveChain.catch(()=>{}).then(()=>DB.put('settings',{key:KEY,value:snapshot}));
    return saveChain;
  }
  function setVisible(){
    document.body.classList.toggle('pet-game-enabled',!!state.enabled);
    const nav=$('petNav');
    if(nav)nav.classList.toggle('hidden',!state.enabled);
    const button=$('petEnabled');
    if(button)button.checked=state.enabled;
    const hint=$('petEnableHint');
    if(hint)hint.textContent=state.enabled?'育成中です。家計の集計は変わりません。':'OFF中は相棒の画面や訪問を表示しません。育成記録は保持されます。';
  }
  async function setEnabled(flag){
    state.enabled=!!flag;
    if(state.enabled&&!state.startedMonth)state.startedMonth=DB.currentMonth();
    setVisible();
    await persist();
    if(!state.enabled){hideVisitor();if(current==='pet'&&navigate)void navigate('home');}
  }
  function isEnabled(){return !!(state&&state.enabled);}
  function points(){return Object.values(state.awards).reduce((sum,x)=>sum+(Number(x.points)||0),0);}
  function level(p=points()){
    let lv=1;while(lv<LEVEL_THRESHOLDS.length&&p>=LEVEL_THRESHOLDS[lv])lv++;
    return lv;
  }
  function personality(){
    const sum=Object.values(state.traits).reduce((a,b)=>a+b,0);
    if(sum<3)return {id:'curious',name:'まだ探検中'};
    const top=Object.keys(state.traits).sort((a,b)=>state.traits[b]-state.traits[a])[0];
    return {id:top,name:({pet:'甘えんぼ',food:'食いしんぼ',play:'元気いっぱい',calm:'のんびり'})[top]};
  }
  function hasCategoryAward(categories){
    return Object.values(state.awards).some(a=>a.items.some(x=>categories.includes(x.category)));
  }
  function actionAvailable(action){
    return level()>=action.level&&(!action.categories||hasCategoryAward(action.categories));
  }
  function todayReset(){if(state.daily.date!==thisDay())state.daily={date:thisDay(),used:0,traitsUsed:0};}
  function affectionTier(){return state.affection>=70?'bonded':state.affection>=30?'friendly':'shy';}
  function characterHtml(small=false){
    const trait=personality().id, tier=affectionTier();
    const decorate=hasCategoryAward(['衣料費','美容費']), room=hasCategoryAward(['日用品','家電']);
    return '<span class="pet-character '+(small?'pet-small ':'')+'pet-mood-'+safeText(mood)+'" data-trait="'+safeText(trait)+'" data-bond="'+tier+'" role="img" aria-label="相棒のキャラクター">'+
      '<span class="pet-shadow"></span><span class="pet-tail"></span>'+
      '<span class="pet-ear pet-ear-left"></span><span class="pet-ear pet-ear-right"></span>'+
      '<span class="pet-body"><span class="pet-face"><span class="pet-eye pet-eye-left"></span><span class="pet-eye pet-eye-right"></span>'+
      '<span class="pet-cheek pet-cheek-left"></span><span class="pet-cheek pet-cheek-right"></span><span class="pet-mouth"></span></span>'+
      '<span class="pet-decor">'+(decorate?'✿':tier==='bonded'?'♥':'')+'</span></span>'+
      '<span class="pet-foot pet-foot-left"></span><span class="pet-foot pet-foot-right"></span>'+
      (room&&!small?'<span class="pet-sparkle">✧</span>':'')+'</span>';
  }
  function moodMessage(){
    if(mood==='pet')return 'もっとなでてほしそう。';
    if(mood==='food')return 'おいしいものが大好き！';
    if(mood==='play')return 'まだまだ遊べそう！';
    if(mood==='calm')return 'まったり過ごしている。';
    if(state.affection>=70)return 'あなたを見つけると、嬉しそうに近づいてくる。';
    if(state.affection>=30)return '少しずつ仲良くなってきたね。';
    return 'のんびり過ごしている。';
  }
  function paintCharacter(){
    if(!state.enabled)return;
    if($('petAvatar'))$('petAvatar').innerHTML=characterHtml();
    const room=$('petRoom');
    if(room)room.classList.toggle('pet-room-decorated',hasCategoryAward(['日用品','家電']));
  }
  function speak(text){
    const el=$('petSpeech');
    if(el)el.textContent=text||moodMessage();
  }
  async function interact(id){
    if(!isEnabled())return;
    const item=ACTIONS.find(x=>x.id===id);
    if(!item||!actionAvailable(item))return;
    todayReset();
    const gained=Math.min(item.gain,Math.max(0,DAILY_CAP-state.daily.used),Math.max(0,100-state.affection));
    state.daily.used+=gained;state.affection+=gained;
    if(state.daily.traitsUsed<12){
      for(const k of Object.keys(state.traits))state.traits[k]=Math.round(state.traits[k]*0.985*100)/100;
      state.traits[item.type]+=1;
      state.daily.traitsUsed++;
    }
    state.lastAction=DB.now();mood=item.type;
    await persist();
    paintCharacter();speak(item.reply+(gained?' 愛情度 +'+gained:''));
    renderStats();
    clearTimeout(actionTimer);
    actionTimer=setTimeout(()=>{mood='idle';paintCharacter();speak(moodMessage());},1700);
  }
  // Pointer events cover a tap or a sliding finger gesture on the character.
  // One gesture triggers exactly one "pet" action; dragging does not farm affection.
  function bindDirectPetting(){
    const stage=$('petAvatar');
    if(!stage)return;
    stage.setAttribute('role','button');
    stage.setAttribute('tabindex','0');
    stage.setAttribute('aria-label','キャラクターを直接なでる');
    let activePointer=null;
    stage.addEventListener('pointerdown',e=>{
      if(!isEnabled()||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
      if(!e.target.closest('.pet-character'))return;
      activePointer=e.pointerId;
      e.preventDefault();
      stage.classList.add('pet-stroking');
      try{stage.setPointerCapture(e.pointerId);}catch(err){/* capture may be unavailable */ }
      void interact('pet');
    });
    const release=e=>{
      if(e.pointerId!==activePointer)return;
      activePointer=null;
      stage.classList.remove('pet-stroking');
    };
    for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,release);
    stage.addEventListener('keydown',e=>{
      if(isEnabled()&&!e.repeat&&(e.key==='Enter'||e.key===' ')){
        e.preventDefault();
        void interact('pet');
      }
    });
  }
  function prepareMonthlyRecords(all,imports){
    const byMonth={};
    for(const tx of all){
      const month=tx.month||String(tx.date||'').slice(0,7);
      if(!/^\d{4}-\d{2}$/.test(month)||month>DB.currentMonth())continue;
      if(!byMonth[month])byMonth[month]=[];
      byMonth[month].push(tx);
    }
    return Object.keys(byMonth).sort().map(month=>{
      const tx=byMonth[month];let income=0,expense=0,normalExpense=0,unclassified=false,hasExpense=false;
      const cats={};
      for(const row of tx){
        const cat=row.category||'未分類';
        if(row.kind==='income')income+=Number(row.amount)||0;
        if(row.kind==='expense'){
          const v=A.effExpense(row);
          expense+=v;
          if(!row.isOtherPersonExpense&&cat==='未分類')unclassified=true;
          if(v>0)hasExpense=true;
          if(!row.isTemporaryExpense){normalExpense+=v;cats[cat]=(cats[cat]||0)+v;}
        }
        if(row.kind==='refund'){
          const v=Number(row.amount)||0;
          expense-=v;normalExpense-=v;cats[cat]=(cats[cat]||0)-v;
          if(cat==='未分類')unclassified=true;
        }
      }
      for(const key of Object.keys(cats))cats[key]=Math.max(0,cats[key]);
      return {month,income,expense,normalExpense,cats,quality:A.cardCoverage(month,imports).complete&&!unclassified,
        hasExpense};
    });
  }
  function createAward(rec,past,prev){
    const items=[];
    if(past.length===3){
      for(const cat of state.categories){
        const values=past.map(x=>x.cats[cat]||0),average=values.reduce((a,b)=>a+b,0)/3;
        const amount=rec.cats[cat]||0;
        if(values.filter(v=>v>0).length<2||average<1500)continue;
        const old=prev&&prev.items.find(x=>x.category===cat);
        if(old&&amount<=old.target*1.05){
          const previousBest=Number.isFinite(old.best)?old.best:old.target;
          const better=amount<=previousBest*0.92&&previousBest-amount>=500;
          items.push({category:cat,points:better?150:100,target:old.target,best:Math.min(previousBest,amount),kind:'maintain'});
        }else if(average-amount>=500&&amount<=average*0.92){
          items.push({category:cat,points:100,target:amount,best:amount,kind:'new'});
        }
      }
    }
    const bonus=rec.income>0&&rec.income-rec.expense>0?150:0;
    return {earnedAt:DB.now(),items,bonus,points:bonus+items.reduce((s,x)=>s+x.points,0)};
  }
  async function syncRewards(){
    if(!state.enabled||!state.startedMonth)return;
    const [tx,imports,statuses]=await Promise.all([DB.getAll('transactions'),DB.getAll('cardImports'),DB.getAll('monthStatus')]);
    const done=new Set(statuses.filter(x=>x.completedAt).map(x=>x.month));
    const records=prepareMonthlyRecords(tx,imports);
    let changed=false;
    for(const r of records){
      if(r.month<state.startedMonth||!done.has(r.month)||!r.quality||state.awards[r.month])continue;
      const past=records.filter(x=>x.month<r.month&&x.quality&&x.hasExpense).slice(-3);
      const prev=state.awards[DB.prevMonth(r.month)]||null;
      state.awards[r.month]=createAward(r,past,prev);
      changed=true;
    }
    if(changed)await persist();
  }
  async function rebuildRewards(){
    if(!confirm('記録済みの月次報酬を最新の家計データで再計算します。修正内容によってはポイントや解放済み項目が減る場合があります。実行しますか？'))return;
    state.awards={};
    await persist();
    await render();
  }
  function renderStats(){
    const total=points(),lv=level(total),next=LEVEL_THRESHOLDS[lv]||null;
    if($('petLevel'))$('petLevel').textContent='Lv. '+lv;
    if($('petScore'))$('petScore').textContent=total.toLocaleString('ja-JP')+' pt';
    if($('petAffection'))$('petAffection').textContent=Math.floor(state.affection)+'/100';
    if($('petAffectionBar'))$('petAffectionBar').style.width=state.affection+'%';
    if($('petProgressBar'))$('petProgressBar').style.width=next?((total-(LEVEL_THRESHOLDS[lv-1]||0))/(next-(LEVEL_THRESHOLDS[lv-1]||0))*100)+'%':'100%';
    if($('petProgressText'))$('petProgressText').textContent=next?'次のLvまで '+(next-total)+' pt':'現在の最高レベル';
    if($('petPersonality'))$('petPersonality').textContent=personality().name;
    todayReset();
    if($('petDailyCap'))$('petDailyCap').textContent='愛情度（今日の加算） '+state.daily.used+'/'+DAILY_CAP+'。上限後も自由に遊べます。';
    if($('petActions'))$('petActions').innerHTML=ACTIONS.map(a=>{
      const unlocked=actionAvailable(a);
      const detail=a.categories?'（'+a.categories.join('・')+'の節約報酬）':('（Lv.'+a.level+'）');
      return '<button type="button" data-pet-action="'+a.id+'" '+(unlocked?'':'disabled')+' class="pet-action">'+
        '<span class="pet-action-icon">'+a.icon+'</span><span>'+a.label+'</span>'+
        (unlocked?'':'<small>'+safeText(detail)+'</small>')+'</button>';
    }).join('');
    if($('petCatalog'))$('petCatalog').innerHTML=ACTIONS.map(a=>'<span class="pet-catalog-item '+(actionAvailable(a)?'is-open':'')+'">'+safeText(a.label)+(actionAvailable(a)?' ✓':' 🔒')+'</span>').join('');
    if($('petAwards')){
      const rows=Object.entries(state.awards).sort((a,b)=>b[0].localeCompare(a[0]));
      $('petAwards').innerHTML=rows.length?rows.slice(0,8).map(([month,r])=>{
        const titles=r.items.map(x=>safeText(x.category)+(x.kind==='maintain'?' 維持':' 節約')+' +'+x.points);
        if(r.bonus)titles.push('実収支プラス +'+r.bonus);
        return '<div class="pet-award-row"><strong>'+safeText(month)+'</strong><div>'+
          (titles.length?titles.join(' / '):'報酬条件に該当する分類なし')+'</div><b>+'+r.points+' pt</b></div>';
      }).join(''):'<p class="muted">対象月の月末更新とカードCSV・分類の確認が揃うと、月1回の成果がここに記録されます。</p>';
    }
  }
  async function render(){
    if(!isEnabled())return;
    if(redrawBusy){rerender=true;return;}
    redrawBusy=true;
    try{
      await syncRewards();
      paintCharacter();
      renderStats();
      speak(moodMessage());
      if($('petStartMonth'))$('petStartMonth').textContent=state.startedMonth||'-';
      if($('petCategoryOptions'))$('petCategoryOptions').innerHTML=CATEGORY_LIST.map(cat=>
        '<label class="pet-category-choice"><input type="checkbox" data-pet-category="'+safeText(cat)+'" '+
        (state.categories.includes(cat)?'checked':'')+'><span>'+safeText(cat)+'</span></label>').join('');
    }catch(err){
      console.error('Pet game render failed',err);
      if($('petSpeech'))$('petSpeech').textContent='育成データを確認できませんでした。家計データは変更していません。';
    }finally{
      redrawBusy=false;
      if(rerender){rerender=false;void render();}
    }
  }
  function hideVisitor(){
    if(visitTimer){clearTimeout(visitTimer);visitTimer=null;}
    const el=$('petVisitor');if(el)el.remove();
  }
  function maybeVisit(name){
    hideVisitor();
    if(!state.enabled||!['home','history'].includes(name))return;
    if(document.body.classList.contains('app-locked')||document.querySelector('dialog[open]'))return;
    const homeCompanion=name==='home';
    // Keep a small, background-free companion on Home. Visits to History stay rare.
    if(!homeCompanion&&(Date.now()-lastVisit<30*60*1000||Math.random()>0.22))return;
    if(!homeCompanion)lastVisit=Date.now();
    const visitor=document.createElement('button');
    visitor.type='button';visitor.id='petVisitor';
    visitor.className='pet-visitor '+(homeCompanion?'pet-home-companion':'pet-guest-companion');
    visitor.setAttribute('aria-label','相棒の部屋へ移動');
    visitor.setAttribute('title','相棒の部屋へ');
    visitor.innerHTML=characterHtml(true);
    visitor.onclick=()=>{hideVisitor();if(navigate)void navigate('pet');};
    document.body.appendChild(visitor);
    if(!homeCompanion)visitTimer=setTimeout(hideVisitor,6500);
  }
  function onScreen(name){
    current=name;
    if(name==='pet'){hideVisitor();void render();}
    else maybeVisit(name);
  }
  async function init(onNavigate){
    if(initialized)return;
    initialized=true;navigate=onNavigate;
    const stored=await DB.get('settings',KEY);
    state=normalize(stored&&stored.value);
    setVisible();
    if($('petEnabled'))$('petEnabled').addEventListener('change',e=>{void setEnabled(e.target.checked);});
    bindDirectPetting();
    if($('petActions'))$('petActions').addEventListener('click',e=>{
      const b=e.target.closest('[data-pet-action]');if(b)void interact(b.dataset.petAction);
    });
    if($('petCategoryOptions'))$('petCategoryOptions').addEventListener('change',e=>{
      const input=e.target.closest('[data-pet-category]');
      if(!input)return;
      const cat=input.dataset.petCategory;
      if(!CATEGORY_LIST.includes(cat))return;
      state.categories=CATEGORY_LIST.filter(k=>k===cat?input.checked:state.categories.includes(k));
      void persist();
    });
    if($('petRecalculate'))$('petRecalculate').onclick=()=>void rebuildRewards();
    if($('petRefresh'))$('petRefresh').onclick=()=>void render();
    // Defaults are intentionally OFF; no extra persistent data is written until enabled.
  }
  HAM.PetGame={init,onScreen,render,isEnabled,setEnabled,
    _test:{prepareMonthlyRecords,createAward,level,normalize}};
})(window);
