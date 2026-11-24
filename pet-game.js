/* Optional local-only pet game. Never mutates transactions or finance calculations. */
(function(global){
  'use strict';
  const HAM=global.HAM, DB=HAM.DB, A=HAM.Analysis;
  const KEY='petGameStateV1', DAILY_CAP=10, MATURITY_LEVEL=6;
  let starterPreviewFacing='front'; // local UI-only control; never written to settings
  const PET_TYPES=[{id:'animal',label:'動物風',hint:'人なつっこい小動物'},{id:'fantasy',label:'架空の生き物',hint:'不思議な耳と小さな翼'},{id:'fairy',label:'妖精風',hint:'羽と光をまとった子'},{id:'yokai',label:'妖怪',hint:'少し不思議で愛嬌たっぷり'},{id:'dino',label:'恐竜',hint:'小さなトゲと大きなしっぽ'}];
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
  let visitTimer=null, lastVisit=0, actionTimer=null, facingTimer=null, faceStep=0, saveChain=Promise.resolve(), initialized=false;
  const $=id=>document.getElementById(id);
  const safeText=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const thisDay=()=>DB.ymd();
  function fresh(){
    return {version:2,enabled:false,startedMonth:null,activePet:null,collection:[],
      awards:{},categories:DEFAULT_CATEGORIES.slice()};
  }
  function newPet(type){
    if(!PET_TYPES.some(x=>x.id===type))throw new Error('不明なキャラクタータイプ');
    return {id:DB.uid?DB.uid('pet'):'pet-'+Date.now()+'-'+Math.random().toString(36).slice(2),
      type,name:PET_TYPES.find(x=>x.id===type).label+'の相棒',
      startedMonth:DB.currentMonth(),bornAt:DB.now(),affection:0,
      traits:{pet:0,food:0,play:0,calm:0},
      daily:{date:'',used:0,traitsUsed:0},lastAction:null};
  }
  const cap=(value,max)=>Math.max(0,Math.min(max,Number(value)||0));
  function normalizePet(p){
    if(!p||typeof p!=='object')return null;
    const type=PET_TYPES.some(x=>x.id===p.type)?p.type:'fantasy';
    const traits={pet:0,food:0,play:0,calm:0};
    for(const k of Object.keys(traits))traits[k]=cap(p.traits?.[k],10000);
    return {id:String(p.id||('pet-'+Date.now())),type,
      name:String(p.name||PET_TYPES.find(x=>x.id===type).label+'の相棒').slice(0,30),
      startedMonth:/^\d{4}-\d{2}$/.test(String(p.startedMonth||''))?p.startedMonth:DB.currentMonth(),
      bornAt:String(p.bornAt||DB.now()),affection:cap(p.affection,100),traits,
      daily:{date:String(p.daily?.date||''),used:cap(p.daily?.used,DAILY_CAP),
        traitsUsed:cap(p.daily?.traitsUsed,12)},lastAction:typeof p.lastAction==='string'?p.lastAction:null};
  }
  function normalize(value){
    const s=fresh();
    if(!value||typeof value!=='object')return s;
    s.enabled=value.enabled===true;
    if(/^\d{4}-\d{2}$/.test(String(value.startedMonth||'')))s.startedMonth=value.startedMonth;
    if(Array.isArray(value.categories))s.categories=[...new Set(value.categories.filter(x=>CATEGORY_LIST.includes(x)))];
    if(value.awards&&typeof value.awards==='object'&&!Array.isArray(value.awards)){
      for(const [k,v] of Object.entries(value.awards)){
        if(!/^\d{4}-\d{2}$/.test(k)||!v||typeof v!=='object')continue;
        const items=Array.isArray(v.items)?v.items.filter(x=>x&&CATEGORY_LIST.includes(x.category)).map(x=>({
          category:x.category,points:cap(x.points,100000),
          target:cap(x.target,1000000000),best:cap(x.best==null?x.target:x.best,1000000000),
          kind:x.kind==='maintain'?'maintain':'new'
        })):[];
        s.awards[k]={points:cap(v.points,1000000),bonus:cap(v.bonus,1000000),
          items,earnedAt:String(v.earnedAt||''),petId:typeof v.petId==='string'?v.petId:null};
      }
    }
    if(Number(value.version)>=2){
      s.activePet=normalizePet(value.activePet);
      s.collection=Array.isArray(value.collection)?value.collection.filter(x=>x&&typeof x==='object'&&PET_TYPES.some(t=>t.id===x.type)).map(x=>({
        ...normalizePet(x),earnedPoints:cap(x.earnedPoints,100000000),
        finalLevel:cap(x.finalLevel,1000),completedAt:String(x.completedAt||''),
        finalPersonality:String(x.finalPersonality||'')
      })):[];
    }else{
      // Preserve the actual candidate.1-3 companion and its awarded points.
      if(s.startedMonth||cap(value.affection,100)>0||Object.keys(s.awards).length){
        s.activePet=normalizePet({id:'legacy-companion',type:'fantasy',
          startedMonth:s.startedMonth||DB.currentMonth(),bornAt:DB.now(),
          affection:value.affection,traits:value.traits,daily:value.daily,lastAction:value.lastAction});
        for(const reward of Object.values(s.awards))reward.petId=s.activePet.id;
      }
    }
    return s;
  }
  function active(){return state?.activePet||null;}
  function petPoints(pet=active()){
    if(!pet)return 0;
    return Object.values(state.awards).reduce((sum,a)=>sum+(a.petId===pet.id?cap(a.points,1000000):0),0);
  }
  function stageForLevel(lv){return lv>=MATURITY_LEVEL?'adult':lv>=3?'teen':'baby';}
  function petStage(pet=active()){
    if(!pet)return 'baby';
    return stageForLevel(level(petPoints(pet)));
  }
  function petPersonality(pet){
    if(!pet)return {id:'curious',name:'まだ探検中'};
    const sum=Object.values(pet.traits).reduce((a,b)=>a+b,0);
    if(sum<3)return {id:'curious',name:'まだ探検中'};
    const top=Object.keys(pet.traits).sort((a,b)=>pet.traits[b]-pet.traits[a])[0];
    return {id:top,name:({pet:'甘えんぼ',food:'食いしんぼ',play:'元気いっぱい',calm:'のんびり'})[top]};
  }
  function activeRewardFor(categories,pet=active()){
    return !!pet&&Object.values(state.awards).some(a=>a.petId===pet.id&&a.items.some(x=>categories.includes(x.category)));
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
    // No companion is created just by switching the optional game ON.
    setVisible();
    await persist();
    if(!state.enabled){hideVisitor();stopFacing();if(current==='pet'&&navigate)void navigate('home');}
    else{setFacingTimer();if(current==='home')maybeVisit('home');}
  }
  function isEnabled(){return !!(state&&state.enabled);}
  function points(){return petPoints();}
  function level(p=points()){
    let lv=1;while(lv<LEVEL_THRESHOLDS.length&&p>=LEVEL_THRESHOLDS[lv])lv++;
    return lv;
  }
  function personality(){return petPersonality(active());}
  function hasCategoryAward(categories){return activeRewardFor(categories);}
  function actionAvailable(action){
    return !!active()&&level()>=action.level&&(!action.categories||hasCategoryAward(action.categories));
  }
  function todayReset(){
    const p=active();
    if(p&&p.daily.date!==thisDay())p.daily={date:thisDay(),used:0,traitsUsed:0};
  }
  function affectionTier(pet=active()){return (pet?.affection||0)>=70?'bonded':(pet?.affection||0)>=30?'friendly':'shy';}
  // Until the rear atlas matches the adopted illustrations, avoid the old-SVG rear in automatic turns.
  // Direct draw(direction='back') remains available for QA and future rear-art integration.
  const FACING=['front','left','back','right','front'];
  function facing(){return FACING[faceStep%FACING.length];}
  function characterHtml(small=false,pet=active(),direction=facing()){
    if(!pet)return '';
    const trait=petPersonality(pet).id,tier=affectionTier(pet),type=pet.type;
    const stage=petStage(pet);
    const art=HAM.PetIllustration.draw({type,stage,direction,mood,affection:pet.affection,trait});
    return '<span class="pet-character '+(small?'pet-small ':'')+'pet-mood-'+safeText(mood)+
      '" data-trait="'+safeText(trait)+'" data-bond="'+tier+
      '" data-type="'+safeText(type)+'" data-growth="'+stage+
      '" data-facing="'+safeText(direction)+'" role="img" aria-label="'+safeText(pet.name)+'">'+
      art+'</span>';
  }
  function moodMessage(){
    if(mood==='pet')return 'もっとなでてほしそう。';
    if(mood==='food')return 'おいしいものが大好き！';
    if(mood==='play')return 'まだまだ遊べそう！';
    if(mood==='calm')return 'まったり過ごしている。';
    if(!active())return 'まずは一緒に過ごす相棒を選ぼう。';
    if(active().affection>=70)return 'あなたを見つけると、嬉しそうに近づいてくる。';
    if(active().affection>=30)return '少しずつ仲良くなってきたね。';
    return 'のんびり過ごしている。';
  }
  function paintCharacter(){
    if(!state.enabled)return;
    const container=$('petAvatar'),pet=active();
    if(container&&pet){
      const existing=container.querySelector('.pet-character');
      const stage=petStage(pet);
      // Keep the node (and its running wander animation) when an action changes mood.
      // Replacing innerHTML restarts the 15s wander at the center on every tap.
      if(existing&&existing.dataset.type===pet.type&&existing.dataset.growth===stage){
        for(const kind of ['idle','pet','food','play','calm'])
          existing.classList.toggle('pet-mood-'+kind,kind===mood);
        const bond=affectionTier(pet),trait=petPersonality(pet).id;
        existing.dataset.bond=bond;
        existing.dataset.trait=trait;
        const art=existing.querySelector('.pet-illustration');
        if(art)art.dataset.artBond=bond;
      }else container.innerHTML=characterHtml();
    }
    const room=$('petRoom');
    if(room)room.classList.toggle('pet-room-decorated',hasCategoryAward(['日用品','家電']));
  }
  function speak(text){
    const el=$('petSpeech');
    if(el)el.textContent=text||moodMessage();
  }
  async function interact(id){
    if(!isEnabled()||!active())return;
    const item=ACTIONS.find(x=>x.id===id);
    if(!item||!actionAvailable(item))return;
    todayReset();
    const p=active();
    const gained=Math.min(item.gain,Math.max(0,DAILY_CAP-p.daily.used),Math.max(0,100-p.affection));
    p.daily.used+=gained;p.affection+=gained;
    if(p.daily.traitsUsed<12){
      for(const k of Object.keys(p.traits))p.traits[k]=Math.round(p.traits[k]*0.985*100)/100;
      p.traits[item.type]+=1;
      p.daily.traitsUsed++;
    }
    p.lastAction=DB.now();mood=item.type;
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
    if(!state.enabled||!active())return;
    const [tx,imports,statuses]=await Promise.all([DB.getAll('transactions'),DB.getAll('cardImports'),DB.getAll('monthStatus')]);
    const done=new Set(statuses.filter(x=>x.completedAt).map(x=>x.month));
    const records=prepareMonthlyRecords(tx,imports);
    let changed=false;
    for(const r of records){
      if(r.month<active().startedMonth||!done.has(r.month)||!r.quality||state.awards[r.month])continue;
      const past=records.filter(x=>x.month<r.month&&x.quality&&x.hasExpense).slice(-3);
      const prev=state.awards[DB.prevMonth(r.month)]||null;
      state.awards[r.month]={...createAward(r,past,prev),petId:active().id};
      changed=true;
    }
    if(changed)await persist();
  }
  async function rebuildRewards(){
    const p=active();if(!p)return;
    if(!confirm('現在の相棒に付与済みの月次報酬を再判定します。他の相棒の報酬履歴は変更しません。現在のポイントや解放項目が減る場合があります。実行しますか？'))return;
    const [tx,imports,statuses]=await Promise.all([DB.getAll('transactions'),DB.getAll('cardImports'),DB.getAll('monthStatus')]);
    const done=new Set(statuses.filter(x=>x.completedAt).map(x=>x.month));
    const records=prepareMonthlyRecords(tx,imports);
    const updated={...state.awards};
    const owned=Object.keys(updated).filter(m=>updated[m].petId===p.id).sort();
    for(const month of owned){
      const r=records.find(x=>x.month===month);
      const prior=updated[month];
      if(!r||!done.has(month)||!r.quality){
        updated[month]={...prior,items:[],bonus:0,points:0}; // Preserve ownership even after a data correction.
        continue;
      }
      const past=records.filter(x=>x.month<month&&x.quality&&x.hasExpense).slice(-3);
      const prev=updated[DB.prevMonth(month)]||null;
      updated[month]={...createAward(r,past,prev),earnedAt:prior.earnedAt,petId:p.id};
    }
    state.awards=updated;
    await persist();
    await render();
  }
  async function choosePet(type){
    if(!state.enabled||active()||!PET_TYPES.some(t=>t.id===type))return;
    const p=newPet(type);
    const name=$('petNameInput')?.value.trim();
    if(name)p.name=name.slice(0,30);
    state.activePet=p;
    if($('petNameInput'))$('petNameInput').value='';
    if(!state.startedMonth)state.startedMonth=p.startedMonth;
    faceStep=0;mood='idle';
    await persist();
    setFacingTimer();
    await render();
  }
  async function restartPet(){
    if(!active())return;
    if(!confirm('育成中の相棒とお別れして、最初から育て直しますか？ この子の愛情度・個性は保存されません。過去の月次報酬や図鑑は残り、同じ月の報酬は再取得できません。'))return;
    state.activePet=null;faceStep=0;mood='idle';
    hideVisitor();stopFacing();
    await persist();await render();
  }
  async function archivePet(){
    const p=active();
    if(!p||level()<MATURITY_LEVEL)return;
    if(!confirm('成長した相棒を図鑑に保存して、新しい相棒を迎えられる状態にしますか？ 保存後はこの子との育成を続けられません。'))return;
    state.collection.push({...JSON.parse(JSON.stringify(p)),earnedPoints:petPoints(),
      finalLevel:level(),completedAt:DB.now(),finalPersonality:personality().name});
    state.activePet=null;faceStep=0;mood='idle';
    hideVisitor();stopFacing();
    await persist();await render();
  }
  function renderCompanionChoices(){
    const p=active();
    if($('petChooser'))$('petChooser').classList.toggle('hidden',!!p);
    if($('petActiveArea'))$('petActiveArea').classList.toggle('hidden',!p);
    if($('petArchive'))$('petArchive').classList.toggle('hidden',!p||level()<MATURITY_LEVEL);
    if($('petRestart'))$('petRestart').classList.toggle('hidden',!p);
    if($('petRecalculate'))$('petRecalculate').disabled=!p;
    if($('petCurrentType'))$('petCurrentType').textContent=p?
      p.name+'｜'+PET_TYPES.find(x=>x.id===p.type).label+'｜'+({baby:'幼体',teen:'中間体',adult:'成体'})[petStage()]:'';
    if($('petTypeChoices'))$('petTypeChoices').innerHTML=p?'':PET_TYPES.map(t=>
      '<button type="button" class="pet-choice" data-pet-type="'+t.id+'">'+
      '<span class="pet-choice-preview">'+characterHtml(false,{type:t.id,name:t.label,traits:{pet:0,food:0,play:0,calm:0},affection:0},'front')+'</span>'+
      '<strong>'+t.label+'</strong><small>'+t.hint+'</small></button>').join('');
  }
  function renderStarterGallery(){
    const container=$('petStarterGallery');if(!container)return;
    for(const [id,view] of [['petPreviewFront','front'],['petPreviewSide','left']]){
      const button=$(id);if(!button)continue;
      button.classList.toggle('is-active',starterPreviewFacing===view);
      button.setAttribute('aria-pressed',String(starterPreviewFacing===view));
    }
    container.innerHTML=PET_TYPES.map(t=>'<div class="pet-choice pet-starter-card">'+
      '<span class="pet-choice-preview">'+characterHtml(false,{
        type:t.id,name:t.label,traits:{pet:0,food:0,play:0,calm:0},affection:0
      },starterPreviewFacing)+'</span><strong>'+safeText(t.label)+'</strong></div>').join('');
  }
  function renderArchives(){
    if(!$('petArchiveList'))return;
    if(!state.collection.length){
      $('petArchiveList').innerHTML='<p class="muted">成体まで育てて図鑑に保存すると、ここに歴代の相棒が並びます。</p>';return;
    }
    $('petArchiveList').innerHTML=state.collection.map((p,i)=>
      '<div class="pet-archive-entry"><span class="pet-archive-preview">'+characterHtml(false,p,'front')+'</span>'+
      '<div><strong>'+safeText(p.name)+'</strong><small>'+safeText(PET_TYPES.find(t=>t.id===p.type)?.label||'相棒')+
      '・Lv.'+Number(p.finalLevel||1)+'・愛情度'+Math.floor(p.affection)+'/100</small>'+
      '<small>'+safeText(p.finalPersonality||petPersonality(p).name)+'｜'+safeText(String(p.completedAt||'').slice(0,10))+'</small></div></div>').join('');
  }
  function prefersReducedMotion(){return typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function stopFacing(){if(facingTimer){clearInterval(facingTimer);facingTimer=null;}}
  function setFacingTimer(){
    stopFacing();
    if(!state?.enabled||!active()||!['home','pet','history'].includes(current)||document.hidden||document.body.classList.contains('app-locked')||prefersReducedMotion())return;
    facingTimer=setInterval(()=>{
      if(mood!=='idle'||prefersReducedMotion())return;
      faceStep=(faceStep+1)%FACING.length;
      document.querySelectorAll('#petAvatar .pet-character,#petVisitor .pet-character')
        .forEach(el=>{
          el.dataset.facing=facing();
          // Animate only the new illustration layer, not saved pet state.
          const oldArt=el.querySelector('.pet-art');
          if(oldArt&&active()){
            oldArt.outerHTML=HAM.PetIllustration.draw({
              type:active().type,stage:petStage(),direction:facing(),
              mood,affection:active().affection,trait:personality().id
            });
            const newArt=el.querySelector('.pet-illustration');
            if(newArt){
              newArt.classList.add('pet-turning');
              newArt.addEventListener('animationend',event=>{
                if(event.target===newArt)newArt.classList.remove('pet-turning');
              },{once:true});
            }
          }
        });
    },3500);
  }
  function renderStats(){
    const p=active(),total=points(),lv=level(total),next=LEVEL_THRESHOLDS[lv]||null;
    if($('petLevel'))$('petLevel').textContent='Lv. '+lv;
    if($('petScore'))$('petScore').textContent=total.toLocaleString('ja-JP')+' pt';
    if($('petAffection'))$('petAffection').textContent=Math.floor(p?.affection||0)+'/100';
    if($('petAffectionBar'))$('petAffectionBar').style.width=(p?.affection||0)+'%';
    if($('petProgressBar'))$('petProgressBar').style.width=next?((total-(LEVEL_THRESHOLDS[lv-1]||0))/(next-(LEVEL_THRESHOLDS[lv-1]||0))*100)+'%':'100%';
    if($('petProgressText'))$('petProgressText').textContent=next?'次のLvまで '+(next-total)+' pt':'成体まで成長しました。';
    if($('petPersonality'))$('petPersonality').textContent=personality().name;
    todayReset();
    if($('petDailyCap'))$('petDailyCap').textContent='愛情度（今日の加算） '+(p?.daily.used||0)+'/'+DAILY_CAP+'。上限後も自由に遊べます。';
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
      renderCompanionChoices();
      renderStarterGallery();
      renderArchives();
      speak(moodMessage());
      if($('petStartMonth'))$('petStartMonth').textContent=active()?.startedMonth||'-';
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
    if(!state.enabled||!active()||!['home','history'].includes(name))return;
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
    setFacingTimer();
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
    if($('petPreviewFront'))$('petPreviewFront').onclick=()=>{starterPreviewFacing='front';renderStarterGallery();};
    if($('petPreviewSide'))$('petPreviewSide').onclick=()=>{starterPreviewFacing='left';renderStarterGallery();};
    if($('petTypeChoices'))$('petTypeChoices').addEventListener('click',e=>{
      const b=e.target.closest('[data-pet-type]');
      if(b)void choosePet(b.dataset.petType);
    });
    if($('petRestart'))$('petRestart').onclick=()=>void restartPet();
    if($('petArchive'))$('petArchive').onclick=()=>void archivePet();
    document.addEventListener('visibilitychange',()=>setFacingTimer());
    // Defaults are intentionally OFF; no extra persistent data is written until enabled.
  }
  HAM.PetGame={init,onScreen,render,isEnabled,setEnabled,
    _test:{prepareMonthlyRecords,createAward,level,normalize,newPet,petStage,petPoints,stageForLevel,petPersonality}};
})(window);
