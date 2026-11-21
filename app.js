(function(global){
'use strict';
const HAM=global.HAM, DB=HAM.DB, A=HAM.Analysis, DC=HAM.DCard;
const $=id=>document.getElementById(id);
const $$=sel=>[...document.querySelectorAll(sel)];
const n=v=>Number(v)||0;
/* Money is shown with separators; IndexedDB continues to store integer numbers. */
function formatAmount(value){
  if(value==null||value==='')return '';
  const raw=String(value);
  return /^\d+$/.test(raw)?raw.replace(/\B(?=(\d{3})+(?!\d))/g,','):raw;
}
function formatSignedAmount(value){
  return value<0?'-'+formatAmount(Math.abs(value)):formatAmount(value);
}
function parseAmount(value){
  const raw=String(value??'').trim();
  if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw))return NaN;
  const result=Number(raw.replace(/,/g,''));
  return Number.isSafeInteger(result)&&result>=0?result:NaN;
}
function formatAmountInput(input){
  if(!input||input.isComposing)return;
  const raw=input.value;
  if(!/^[\d,]*$/.test(raw)||!raw)return;
  const formatted=formatAmount(raw.replace(/,/g,''));
  if(formatted===raw)return;
  const start=input.selectionStart,end=input.selectionEnd;
  const before=pos=>(raw.slice(0,pos).match(/\d/g)||[]).length;
  const locate=count=>{
    if(!count)return 0;
    let n=0;
    for(let i=0;i<formatted.length;i++){
      if(/\d/.test(formatted[i]))n++;
      if(n===count)return i+1;
    }
    return formatted.length;
  };
  input.value=formatted;
  if(start!=null&&end!=null&&typeof input.setSelectionRange==='function'){
    input.setSelectionRange(locate(before(start)),locate(before(end)));
  }
}
function setupAmountInput(input,onEdit){
  input.addEventListener('compositionstart',()=>{input.isComposing=true;});
  input.addEventListener('input',()=>{formatAmountInput(input);if(onEdit)onEdit();});
  input.addEventListener('compositionend',()=>{input.isComposing=false;formatAmountInput(input);if(onEdit)onEdit();});
}

const categories=['未分類','食費','日用品','衣料費','交通費','医療','教育費','サブスク','交際費','通信・光熱費','家電','美容費','娯楽費','趣味費','漫画・本','リフレッシュ費','仕送り','洗濯','貸本','家賃','その他'];
const mealOptions=[['','未分類'],['breakfast','朝'],['lunch','昼'],['dinner','夜'],['snack','間食・飲料'],['other','その他']];
let selectedMonth=DB.currentMonth();
let preparedCsv=null;
let csvImportInProgress=false;
const CSV_DRAFT_KEY='dcardCsvDraft';
let csvDraftSaveChain=Promise.resolve();
let csvDraftGeneration=0;
let csvDraftSaveTimer=null;
let toastTimer=null;
let currentScreen='home';
let currentPanel=null;
let historyReady=false;
let monthEndWriteQueue=Promise.resolve();
let assetBreakdownMode='compact';
let assetBreakdownRequestId=0;
const BREAKDOWN_MODE_KEY='ham-asset-breakdown-mode-v1';
const LOCK_KEY='ham-app-lock-v1';
const LOCK_ITERATIONS=150000;
const LOCK_SESSION_KEY='ham-lock-session-v1';
const LOCK_IDLE_MS=15*60*1000;
let unlockFailures=0,unlockDelayUntil=0,lockIdleTimer=null,lastRecordedActivity=0;

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200);}
function formatYen(v){return A.formatYen(v);}
function dateForSelected(){const today=DB.ymd();return today.startsWith(selectedMonth)?today:DB.monthEndDate(selectedMonth);}
function resetInputToCurrentMonth(){
  selectedMonth=DB.currentMonth();
  $('globalMonth').value=selectedMonth;
  const today=DB.ymd();
  for(const id of ['cashDate','incomeDate','rentDate','advanceDate'])$(id).value=today;
}
function confirmNonCurrentEntry(date){
  const month=DB.monthOfDate(date);
  if(month===DB.currentMonth())return true;
  return confirm(`入力日が当月ではありません（${monthLabel(month)}）。\nこの日付で登録しますか？`);
}
function monthLabel(m){const [y,mo]=m.split('-');return `${y}年${Number(mo)}月`;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function selectOptions(values,current=''){return values.map(v=>{const [value,label]=Array.isArray(v)?v:[v,v];return `<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`}).join('');}

async function showScreen(name,{push=true,panel=null}={}){
  if(currentScreen==='monthend' && !(await flushMonthEndEdits())){
    if(!push&&historyReady)history.pushState({hamNav:'screen',screen:currentScreen,panel:currentPanel},'',location.href);
    return false;
  }
  if(name==='input'&&currentScreen!=='input'&&push)resetInputToCurrentMonth();
  if(name!=='home'){assetBreakdownRequestId++;closeInlineBreakdown();if($('assetBreakdownDialog').open)$('assetBreakdownDialog').close();}
  currentScreen=name;
  currentPanel=name==='input'?panel:null;
  $$('.screen').forEach(x=>x.classList.toggle('active',x.dataset.screen===name));
  $$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===name));
  $$('.input-panel').forEach(x=>x.classList.add('hidden'));
  if(currentPanel){
    const p=$(`input-${currentPanel}`);
    if(p)p.classList.remove('hidden');
  }
  if(name!=='data'&&$('lockRecoveryNotice')&&!$('lockRecoveryNotice').classList.contains('hidden'))clearVisibleRecovery();
  if(currentPanel==='cash')$('cashAmount').focus();
  if(currentPanel==='advance'){renderAdvanceCardTransactions();renderManualAdvancePaymentEdits();}
  if(name==='home')renderHome();if(name==='monthend')renderMonthEnd();if(name==='history')renderHistory();if(name==='data')renderData();
  if(push&&historyReady) history.pushState({hamNav:'screen',screen:currentScreen,panel:currentPanel},'',location.href);
  return true;
}
function openInputPanel(name,{push=true}={}){
  const panel=$(`input-${name}`)?name:null;
  showScreen('input',{push,panel});
}
function setupNavigationHistory(){
  history.replaceState({hamNav:'exit-guard'},'',location.href);
  history.pushState({hamNav:'screen',screen:'home',panel:null},'',location.href);
  historyReady=true;
  window.addEventListener('popstate',async e=>{
    const st=e.state;
    if(st?.hamNav==='screen'){
      showScreen(st.screen||'home',{push:false,panel:st.panel||null});
      return;
    }
    if(st?.hamNav==='exit-guard'){
      if(currentScreen==='monthend'&&!(await flushMonthEndEdits())){
        history.pushState({hamNav:'screen',screen:currentScreen,panel:currentPanel},'',location.href);
        return;
      }
      const exit=confirm('家計・資産管理を終了しますか？');
      if(exit){
        historyReady=false;
        history.back();
      }else{
        showScreen('home',{push:false});
        history.pushState({hamNav:'screen',screen:'home',panel:null},'',location.href);
      }
    }
  });
}
function fillCategorySelect(el,current='未分類'){el.innerHTML=selectOptions(categories,current);}
function fillMealSelect(el,current=''){el.innerHTML=selectOptions(mealOptions,current);}

async function renderHome(){
  await renderHomeAlerts();
  const cur=await A.summary(selectedMonth),prev=await A.summary(DB.prevMonth(selectedMonth));
  $('homeMonthlySummary').innerHTML=[
    metric('実収入',cur.income,A.formatSigned(cur.income-prev.income)),
    metric('通常支出',cur.normal,A.formatSigned(cur.normal-prev.normal),cur.normal<=prev.normal?'good':'warn'),
    metric('臨時支出',cur.temporary,''),
    metric(selectedMonth===DB.currentMonth()?'今月の収支':'対象月の収支',cur.saving,A.formatSigned(cur.saving-prev.saving),cur.saving>=prev.saving?'good':'warn')
  ].join('');
  const monthStatus=await DB.getMonthStatus(selectedMonth);
  $('homeBalanceNote').textContent=monthStatus?.completedAt?'登録済みの収入・支出による集計（更新完了月）':'暫定（登録済みの収入・支出による集計）';
  renderExpenseDonut(cur.categories);
  const points=await A.pointTotal(selectedMonth),adv=(await A.outstandingAdvances()).reduce((s,x)=>s+x.outstanding,0);const plans=await A.paymentPlansUpcoming();const reserved=plans.reduce((s,x)=>s+n(x.reservedAmount),0);
  const wallet=cur.assets.rows.find(x=>x.account.id==='cash-wallet');
  const walletValue=wallet?.liveCash?.value??(wallet?.snapshot?wallet.value:null);
  const walletText=walletValue==null?'未登録':formatYen(walletValue);
  const walletDetail=walletValue==null?'月末更新で残高を登録':wallet?.liveCash?.isEstimated?'現金移動を自動反映':'最終確認残高';
  const pointText=points.rows.some(x=>x.snapshot)?points.total.toLocaleString('ja-JP')+' pt':'未登録';
  $('homeAssetSummary').innerHTML=[metric('財布現金',walletText,walletDetail,'','wallet'),metric('ポイント合計',pointText,points.rows.some(x=>!x.snapshot)?'未登録のポイントあり':'','','points'),metric('総資産',cur.assets.total,A.formatSigned(cur.assets.total-prev.assets.total),cur.assets.total>=prev.assets.total?'good':'warn','total'),metric('流動資産',cur.assets.liquid,'','','liquid'),metric('支払確保済',reserved,'','','reserved')].join('')+(adv?'<p class="muted">未回収立替 '+formatYen(adv)+'</p>':'');
  const ins=await A.insights(selectedMonth);$('homeInsights').innerHTML=ins.length?ins.map(x=>`<div class="insight ${x.tone}">${esc(x.text)}</div>`).join(''):'<p class="muted">比較データがたまると、前月比や3か月平均との差を表示します。</p>';
  const up=plans.slice(0,4);$('homePayments').innerHTML=up.length?up.map(p=>`<div class="status-row"><div><strong>${esc(p.name)}</strong><div class="status-meta">${esc(p.dueDate||'日付未設定')}</div></div><div>${formatYen(p.amount)}</div></div>`).join(''):'<p class="muted">登録済みの支払予定はありません。</p>';
}
/* Read-only SVG/HTML summaries. All money values come from existing Analysis.summary. */
const CHART_PALETTE=['#60a5fa','#fbbf24','#34d399','#a78bfa','#fb7185','#94a3b8'];
function chartColor(index){return CHART_PALETTE[index%CHART_PALETTE.length];}
function renderExpenseDonut(categories){
  const rows=Object.entries(categories||{}).filter(([,v])=>Number.isFinite(v)&&v>0).sort((a,b)=>b[1]-a[1]);
  const total=rows.reduce((sum,[,v])=>sum+v,0);
  if(!total){
    $('homeExpenseDonut').innerHTML='<p class="muted">この月の支出内訳データはありません。</p>';
    return;
  }
  const top=rows.slice(0,5);
  const other=rows.slice(5).reduce((sum,[,v])=>sum+v,0);
  if(other>0)top.push(['その他（複数カテゴリ）',other]);
  let cumulative=0;
  const circles=top.map(([label,value],i)=>{
    const share=value/total;
    const circle=`<circle r="42" cx="50" cy="50" fill="none" stroke="${chartColor(i)}" stroke-width="16" stroke-dasharray="${share*263.8938} 263.8938" stroke-dashoffset="${-cumulative*263.8938}" transform="rotate(-90 50 50)"><title>${esc(label)} ${formatYen(value)}</title></circle>`;
    cumulative+=share;
    return circle;
  }).join('');
  const legend=top.map(([label,value],i)=>`<div class="donut-legend-row"><i style="background:${chartColor(i)}" aria-hidden="true"></i><span>${esc(label)}</span><strong>${formatYen(value)}</strong><span class="donut-percent">${(100*value/total).toFixed(1)}%</span></div>`).join('');
  const hasNegative=Object.values(categories||{}).some(v=>v<0);
  $('homeExpenseDonut').innerHTML=`<div class="donut-layout"><div class="donut-figure"><svg viewBox="0 0 100 100" role="img" aria-label="支出カテゴリの構成比。合計 ${esc(formatYen(total))}"><circle r="42" cx="50" cy="50" fill="none" stroke="var(--line)" stroke-width="16"></circle>${circles}<text x="50" y="47" text-anchor="middle" class="donut-center-label">カテゴリ別</text><text x="50" y="60" text-anchor="middle" class="donut-center-total">100%</text></svg></div><div class="donut-legend">${legend}</div></div>${hasNegative?'<p class="finance-note">返金などで差引がマイナスとなったカテゴリは構成比の対象外です。</p>':''}<p class="finance-note">登録済みのプラスの支出をカテゴリ別に表示しています。立替の他人負担分は含みません。</p>`;
}
function renderMonthlyCashflow(summaries){
  const rows=[...summaries].reverse();
  const max=Math.max(1,...rows.flatMap(x=>[x.income,x.expense]).filter(Number.isFinite));
  const html=rows.map(x=>`<div class="cashflow-month"><div class="cashflow-month-label">${esc(monthLabel(x.month))}</div><div class="cashflow-bar-row"><span>収入</span><div class="cashflow-track"><div class="cashflow-fill income" style="width:${Math.max(0,Math.min(100,x.income/max*100))}%"></div></div><strong>${formatYen(x.income)}</strong></div><div class="cashflow-bar-row"><span>支出</span><div class="cashflow-track"><div class="cashflow-fill expense" style="width:${Math.max(0,Math.min(100,x.expense/max*100))}%"></div></div><strong>${formatYen(x.expense)}</strong></div></div>`).join('');
  $('historyCashflowChart').innerHTML=html+'<p class="finance-note">選択月を含む直近6か月。収入・支出は同じ尺度で比較しています（登録済みデータ）。</p>';
}
function metric(label,value,delta='',tone='',breakdown=''){
  const tag=breakdown?'button':'div';
  const attrs=breakdown?` type="button" class="metric metric-tappable" data-asset-breakdown="${esc(breakdown)}" aria-label="${esc(label)}の内訳を表示"`:' class="metric"';
  return `<${tag}${attrs}><div class="label">${esc(label)}</div><div class="value">${typeof value==='number'?formatYen(value):esc(value)}</div>${delta?`<div class="delta ${tone}">${esc(delta)}</div>`:''}</${tag}>`;
}
function closeInlineBreakdown(){
  $('assetBreakdownInline').classList.add('hidden');
  $('assetBreakdownInlineRows').innerHTML='';
}
function readBreakdownMode(){
  try{
    const saved=localStorage.getItem(BREAKDOWN_MODE_KEY);
    return saved==='dialog'?'dialog':'compact';
  }catch(e){console.warn('内訳表示設定を読み込めませんでした。',e);return 'compact';}
}
function saveBreakdownMode(mode){
  try{localStorage.setItem(BREAKDOWN_MODE_KEY,mode);}
  catch(e){console.warn('内訳表示設定を保存できませんでした。',e);}
}
function selectBreakdownMode(mode,{remember=false}={}){

  if(!['compact','dialog'].includes(mode))return;
  assetBreakdownMode=mode;
  if(remember)saveBreakdownMode(mode);
  assetBreakdownRequestId++;
  closeInlineBreakdown();
  if($('assetBreakdownDialog').open)$('assetBreakdownDialog').close();
  $$('[data-breakdown-mode]').forEach(button=>{
    const selected=button.dataset.breakdownMode===mode;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}
function breakdownRow(label,value,note='',unit='yen'){
  const amount=unit==='pt'?n(value).toLocaleString('ja-JP')+' pt':formatYen(value);
  return `<div class="breakdown-row"><div><strong>${esc(label)}</strong>${note?`<div class="muted">${esc(note)}</div>`:''}</div><strong class="breakdown-amount">${esc(amount)}</strong></div>`;
}
async function openAssetBreakdown(kind){
  const month=selectedMonth;
  const names={wallet:'財布現金',points:'ポイント合計',total:'総資産',liquid:'流動資産',reserved:'支払確保済'};
  if(!names[kind])return;
  const requestId=++assetBreakdownRequestId;
  const compact=assetBreakdownMode==='compact';
  const dialog=$('assetBreakdownDialog');
  const title=names[kind]+'の内訳';
  if(compact){
    if(dialog.open)dialog.close();
    $('assetBreakdownInlineTitle').textContent=title;
    $('assetBreakdownInlineMonth').textContent=monthLabel(month);
    $('assetBreakdownInlineRows').innerHTML='<p class="muted">読み込み中...</p>';
    $('assetBreakdownInline').classList.remove('hidden');
  }else{
    closeInlineBreakdown();
    $('assetBreakdownTitle').textContent=title;
    $('assetBreakdownMonth').textContent=monthLabel(month);
    $('assetBreakdownRows').innerHTML='<p class="muted">読み込み中...</p>';
    if(!dialog.open)dialog.showModal();
  }
  try{
    let rows=[],total=0,unit='yen',foot='';
    if(kind==='points'){
      const data=await A.pointTotal(month);
      total=data.total;unit='pt';
      rows=data.rows.map(r=>breakdownRow(r.account.name,r.value,r.snapshot?'':'残高未登録','pt'));
      foot='各ポイントの登録残高を合計しています。';
    }else if(kind==='reserved'){
      const plans=await A.paymentPlansUpcoming();
      total=plans.reduce((sum,p)=>sum+n(p.reservedAmount),0);
      rows=plans.filter(p=>n(p.reservedAmount)!==0).map(p=>breakdownRow(p.name,n(p.reservedAmount),p.dueDate||'支払日未設定'));
      foot='支払予定に登録された確保済み金額です。';
    }else{
      const data=await A.assetSummary(month);
      if(kind==='wallet'){
        const wallet=data.rows.find(r=>r.account.id==='cash-wallet');
        const live=wallet?.liveCash;
        total=wallet?.value||0;
        if(wallet?.snapshot){
          rows=[breakdownRow('最終確認残高',live?.baseValue??wallet.snapshot.value)];
          if(live?.movement)rows.push(breakdownRow('確認後の現金増減',live.movement,'入力済み現金取引を反映'));
        }else rows=[`<p class="muted">財布現金の残高は未登録です。</p>`];
        foot='現在の表示残高は登録された残高と現金取引から計算しています。';
      }else{
        const source=kind==='liquid'?data.rows.filter(r=>['bank','cash'].includes(r.account.category)):data.rows;
        total=kind==='liquid'?data.liquid:data.total;
        rows=source.map(r=>breakdownRow(r.account.name,r.value,r.snapshot?'':'残高未登録'));
        foot=kind==='liquid'?'銀行・現金の残高合計です。株式・DC・ポイントは含みません。':'登録された資産残高の合計です。ポイントは含みません。';
      }
    }
    if(requestId!==assetBreakdownRequestId||selectedMonth!==month)return;
    if(compact?$('assetBreakdownInline').classList.contains('hidden'):!dialog.open)return;
    const sum=unit==='pt'?total.toLocaleString('ja-JP')+' pt':formatYen(total);
    const body=(rows.length?rows.join(''):'<p class="muted">内訳は登録されていません。</p>')+
      `<div class="breakdown-total"><strong>合計</strong><strong>${esc(sum)}</strong></div>`+
      (compact?'':`<p class="muted">${esc(foot)}</p>`);
    $(compact?'assetBreakdownInlineRows':'assetBreakdownRows').innerHTML=body;
  }catch(e){
    console.error(e);
    if(requestId===assetBreakdownRequestId)$((compact?'assetBreakdownInlineRows':'assetBreakdownRows')).innerHTML='<p class="muted">内訳を読み込めませんでした。再度お試しください。</p>';
  }
}
async function renderHomeAlerts(){
  const alerts=[];const today=new Date(),day=today.getDate(),reminder=(await DB.get('settings','reminderDay'))?.value||10;const pm=DB.prevMonth(DB.currentMonth());
  if(day>=reminder){const st=await recomputeMonthStatus(pm,false);if(st.completionRate<100){const missing=Object.entries(st.completionItems).filter(([,v])=>!v).map(([k])=>itemLabel(k));alerts.push(`<div class="alert warn"><strong>${monthLabel(pm)}分の更新が残っています</strong><div class="muted">未確認：${esc(missing.join(' / '))}</div><button data-reminder-month="${pm}">月末更新を開く</button></div>`);}}
  const adv=(await A.outstandingAdvances()).reduce((s,x)=>s+x.outstanding,0);if(adv>0)alerts.push(`<div class="alert"><strong>未回収立替 ${formatYen(adv)}</strong><div class="muted">返金を受け取ったら「入力 → 立替・返金」から登録できます。</div></div>`);
  const wallet=await A.liveCashBalance(DB.currentMonth());if(wallet.value!=null&&wallet.value<0)alerts.push(`<div class="alert warn"><strong>財布現金の推定残高がマイナスです</strong><div class="muted">未登録の現金補充や入力漏れの可能性があります。月末更新で実残高を確認してください。</div></div>`);
  $('homeAlerts').innerHTML=alerts.join('');$$('[data-reminder-month]').forEach(b=>b.onclick=()=>{$('globalMonth').value=b.dataset.reminderMonth;selectedMonth=b.dataset.reminderMonth;showScreen('monthend');});
}

async function renderCashPresets(){const p=(await DB.get('settings','cashPresets'))?.value||[];$('cashPresets').innerHTML=p.map((x,i)=>`<button type="button" data-preset="${i}">${esc(x.label)}</button>`).join('');$$('[data-preset]').forEach(b=>b.onclick=()=>{$$('[data-preset]').forEach(x=>x.classList.remove('active'));b.classList.add('active');const x=p[+b.dataset.preset];$('cashCategory').value=x.category;$('cashMealWrap').classList.toggle('hidden',x.category!=='食費');$('cashMerchant').value=x.label==='その他'?'':x.label;});}
async function saveCash(){const amount=parseAmount($('cashAmount').value);if(!Number.isSafeInteger(amount)||amount<=0)return toast('金額を入力してください。');const category=$('cashCategory').value||'未分類';const date=$('cashDate').value||dateForSelected();if(!confirmNonCurrentEntry(date))return;await DB.put('transactions',{id:DB.uid('tx'),date,month:DB.monthOfDate(date),kind:'expense',amount,paymentMethod:'cash',merchantRaw:$('cashMerchant').value.trim(),merchantNormalized:$('cashMerchant').value.trim(),category,mealType:category==='食費'?($('cashMealType').value||null):null,isTemporaryExpense:$('cashTemporary').checked,sourceType:'manual',createdAt:DB.now(),updatedAt:DB.now()});$('cashAmount').value='';$('cashMerchant').value='';$('cashTemporary').checked=false;$$('[data-preset]').forEach(x=>x.classList.remove('active'));toast('現金支出を保存しました。');await renderHome();}
async function saveIncome(){const amount=parseAmount($('incomeAmount').value);if(!Number.isSafeInteger(amount)||amount<=0)return toast('金額を入力してください。');const date=$('incomeDate').value||dateForSelected();if(!confirmNonCurrentEntry(date))return;await DB.put('transactions',{id:DB.uid('tx'),date,month:DB.monthOfDate(date),kind:'income',amount,paymentMethod:'bank_transfer',category:$('incomeType').value,subCategory:$('incomeType').value,sourceType:'manual',createdAt:DB.now(),updatedAt:DB.now()});const st=await DB.getMonthStatus(DB.monthOfDate(date));st.completionItems.income=true;await DB.saveMonthStatus(st);$('incomeAmount').value='';toast('収入を保存しました。');}
async function saveRent(){const amount=parseAmount($('rentAmount').value);if(!Number.isSafeInteger(amount)||amount<=0)return toast('家賃を入力してください。');const date=$('rentDate').value||dateForSelected();if(!confirmNonCurrentEntry(date))return;const accountId=$('rentAccount').value;await DB.put('transactions',{id:DB.uid('tx'),date,month:DB.monthOfDate(date),kind:'expense',amount,paymentMethod:'bank_transfer',category:'家賃',merchantRaw:'家賃',merchantNormalized:'家賃',isTemporaryExpense:false,sourceType:'manual',accountId,createdAt:DB.now(),updatedAt:DB.now()});await DB.put('settings',{key:'rentLast',value:{amount,accountId}});await DB.put('paymentPlans',{id:`rent:${DB.monthOfDate(date)}`,name:'家賃',dueDate:date,amount,type:'rent',status:'paid',paymentSource:accountId,paidAt:date,createdAt:DB.now(),updatedAt:DB.now()});const st=await DB.getMonthStatus(DB.monthOfDate(date));st.completionItems.rent=true;await DB.saveMonthStatus(st);toast('家賃を登録しました。');}
async function renderRentDefaults(){const ac=(await DB.getAll('accounts')).filter(x=>x.active!==false&&x.category==='bank');$('rentAccount').innerHTML=`<option value="">未指定</option>`+ac.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');const last=(await DB.get('settings','rentLast'))?.value;if(last){$('rentAmount').value=last.amount?formatAmount(last.amount):'';$('rentAccount').value=last.accountId||'';}}

async function renderAdvanceCardTransactions(){
  const all=(await DB.getAll('transactions')).filter(x=>x.kind==='expense'&&x.sourceType==='dcard_csv');
  const outstanding=(await A.outstandingAdvances()).filter(x=>x.sourceType==='dcard_csv');
  const labels={dbarai:'d払い',id:'iD',dcard:'dカード'};

  const configuredHtml=outstanding.length
    ? '<h4>設定済みのカード立替</h4>'+outstanding
        .sort((a,b)=>(b.date||'').localeCompare(a.date||''))
        .map(x=>`<div class="status-row"><div><strong>${esc(x.merchantNormalized||x.merchantRaw||'カード利用')}</strong><div class="status-meta">${esc(x.date)} / ${esc(labels[x.paymentMethod]||'カード')} / 支払 ${formatYen(x.amount)} / 未回収 ${formatYen(x.outstanding)}</div></div><button data-card-advance="${x.id}">変更</button></div>`).join('')
    : '<p class="muted">現在、カード明細から設定した未回収の立替はありません。</p>';

  const months=[];let m=selectedMonth;for(let i=0;i<3;i++){months.push(m);m=DB.prevMonth(m);}
  const candidates=all.filter(x=>!n(x.advanceShare));
  const groups=months.map(month=>({
    month,
    rows:candidates.filter(x=>x.month===month).sort((a,b)=>(b.date||'').localeCompare(a.date||''))
  })).filter(g=>g.rows.length);

  const candidateHtml=groups.length
    ? `<details><summary>カード明細から立替を追加</summary><p class="muted">以下は立替ではなく通常のカード利用明細です。家族分を立て替えた明細だけ「立替設定」を押してください。</p>${groups.map(g=>`<details><summary>${esc(monthLabel(g.month))}のカード利用明細（${g.rows.length}件）</summary><div class="advance-card-group">${g.rows.map(x=>`<div class="status-row"><div><strong>${esc(x.merchantNormalized||x.merchantRaw||'カード利用')}</strong><div class="status-meta">${esc(x.date)} / ${esc(labels[x.paymentMethod]||'カード')} / ${formatYen(x.amount)}</div></div><button data-card-advance="${x.id}">立替設定</button></div>`).join('')}</div></details>`).join('')}</details>`
    : '<p class="muted">直近3か月に立替設定できるカード明細はありません。</p>';

  $('advanceCardList').innerHTML=configuredHtml+candidateHtml;
  $$('[data-card-advance]').forEach(b=>b.onclick=()=>setCardAdvance(b.dataset.cardAdvance));
}
async function setCardAdvance(id){
  const t=await DB.get('transactions',id);if(!t)return toast('対象明細が見つかりません。');
  const all=await DB.getAll('transactions');if(t.advanceRecordId)return toast('事前立替と紐づいたCSV明細の立替額は変更できません。');if(all.some(x=>x.kind==='advance_repayment'&&x.linkedTransactionId===id))return toast('返金登録済みの立替は変更できません。');
  const current=n(t.advanceShare);
  const v=prompt(`支払総額 ${formatYen(t.amount)}\n立替額（家族分）を入力してください。\n全額が家族分なら ${formatAmount(n(t.amount))} を入力します。`,current>0?formatAmount(current):'');
  if(v==null)return;
  const raw=String(v).trim();if(raw==='')return toast('立替額（家族分）を入力してください。');const advance=parseAmount(raw);
  if(!Number.isSafeInteger(advance)||advance<0||advance>n(t.amount))return toast('立替額（家族分）を確認してください。');
  const own=n(t.amount)-advance;
  t.ownShare=own;t.advanceShare=advance;t.advanceStatus=advance>0?'unpaid':null;t.updatedAt=DB.now();await DB.put('transactions',t);
  toast(advance>0?`立替 ${formatYen(advance)}（自分負担 ${formatYen(own)}）を設定しました。`:'立替設定を解除しました。');
  await renderAdvanceCardTransactions();await renderOutstanding();await renderHome();
}
function isCardAdvanceMethod(method){return ['dbarai','id','dcard'].includes(method);}
function isManualAdvanceCandidate(t){return t.sourceType==='manual'&&n(t.advanceShare)>0&&isCardAdvanceMethod(t.paymentMethod)&&!t.linkedCsvTransactionId&&['expense','advance_pending'].includes(t.kind);}
function updateAdvanceCalc(){const total=parseAmount($('advanceTotal').value),own=$('advanceOwn').value.trim()===''?0:parseAmount($('advanceOwn').value);$('advanceOther').value=Number.isSafeInteger(total)&&Number.isSafeInteger(own)&&total>own?formatAmount(total-own):'';}
async function saveAdvance(){const total=parseAmount($('advanceTotal').value),own=$('advanceOwn').value.trim()===''?0:parseAmount($('advanceOwn').value);if(!Number.isSafeInteger(total)||!Number.isSafeInteger(own)||total<=0||own<0||own>total)return toast('金額を確認してください。');const date=$('advanceDate').value||dateForSelected();if(!confirmNonCurrentEntry(date))return;await DB.put('transactions',{id:DB.uid('tx'),date,month:DB.monthOfDate(date),kind:isCardAdvanceMethod($('advancePayment').value)?'advance_pending':'expense',amount:total,ownShare:own,advanceShare:total-own,advanceStatus:(total-own)>0?'unpaid':null,paymentMethod:$('advancePayment').value,merchantRaw:$('advanceMerchant').value.trim(),merchantNormalized:$('advanceMerchant').value.trim(),category:'未分類',sourceType:'manual',createdAt:DB.now(),updatedAt:DB.now()});$('advanceTotal').value='';$('advanceOwn').value='';$('advanceOther').value='';$('advanceMerchant').value='';toast(isCardAdvanceMethod($('advancePayment').value)?'カード立替をCSV照合待ちで保存しました。':'立替を登録しました。');await renderOutstanding();await renderManualAdvancePaymentEdits();}

async function renderManualAdvancePaymentEdits(){
  const holder=$('manualAdvancePaymentEditList');
  if(!holder)return;
  const options=[['cash','現金'],['bank_transfer','銀行振込'],['dbarai','d払い'],['id','iD'],['dcard','dカード'],['other','その他']];
  const all=(await DB.getAll('transactions')).filter(t=>['expense','advance_pending'].includes(t.kind)&&t.sourceType==='manual'&&t.ownShare!=null)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,50);
  holder.innerHTML=all.length?all.map(t=>`
    <div class="review-row" data-manual-advance-payment="${esc(t.id)}">
      <div class="review-main"><div><strong>${esc(t.merchantNormalized||t.merchantRaw||'手動立替')}</strong><span class="muted">${esc(t.date)} / ${formatYen(t.amount)} / 家族分 ${formatYen(t.advanceShare)}</span></div></div>
      <label>支払方法<select data-manual-advance-method>${selectOptions(options,t.paymentMethod)}</select></label>
      <button type="button" data-manual-advance-save>変更を保存</button>
    </div>`).join(''):'<p class="muted">修正できる手動立替はありません。</p>';
  holder.querySelectorAll('[data-manual-advance-save]').forEach(button=>button.onclick=async()=>{
    const row=button.closest('[data-manual-advance-payment]');
    const id=row?.dataset.manualAdvancePayment;
    const method=row?.querySelector('[data-manual-advance-method]')?.value;
    if(!options.some(([value])=>value===method))return toast('支払方法を選択してください。');
    const t=await DB.get('transactions',id);
    if(!t||!['expense','advance_pending'].includes(t.kind)||t.sourceType!=='manual'||t.ownShare==null)return toast('対象立替を確認できません。');
    if(t.paymentMethod===method)return toast('支払方法は変更されていません。');
    if(isCardAdvanceMethod(method)&&!confirm('カード支払としてCSV照合待ちに変更します。すでにCSVへ登録済みの支払いなら二重になるため、取込済み明細から立替設定してください。続けますか？'))return;
    button.disabled=true;
    try{
      t.paymentMethod=method;
      t.kind=isCardAdvanceMethod(method)?'advance_pending':'expense';
      t.updatedAt=DB.now();
      await DB.put('transactions',t);
      await renderManualAdvancePaymentEdits();
      await renderOutstanding();
      await renderHome();
      toast('支払方法を修正しました。財布残高への反映も確認してください。');
    }catch(e){button.disabled=false;toast('変更を保存できませんでした。');}
  });
}

async function renderOutstanding(){
  const rows=await A.outstandingAdvances();
  const labels={dbarai:'d払い',id:'iD',dcard:'dカード',cash:'現金',bank_transfer:'銀行振込',other:'その他'};
  $('advanceOutstanding').innerHTML=rows.length?rows.map(x=>{
    const source=x.sourceType==='dcard_csv'?'カード立替':x.kind==='advance_pending'?'CSV照合待ち立替':x.kind==='advance_linked'?'CSV照合済み立替':'手動立替';
    const method=labels[x.paymentMethod]||x.paymentMethod||'';
    return `<div class="review-row"><div class="review-main"><div><strong>${esc(x.merchantNormalized||x.merchantRaw||'立替')}</strong><span class="muted">${esc(x.date)} / ${esc(source)}${method?` / ${esc(method)}`:''}</span></div><strong>${formatYen(x.outstanding)}</strong></div><button data-repay-id="${x.id}" data-repay-max="${x.outstanding}">現金で返金を受けた</button></div>`;
  }).join(''):'<p class="muted">未回収の立替はありません。</p>';
  $$('[data-repay-id]').forEach(b=>b.onclick=async()=>{const max=n(b.dataset.repayMax);const v=prompt('返金額',formatAmount(max));if(v==null)return;const amount=parseAmount(v);if(!Number.isSafeInteger(amount)||amount<=0||amount>max)return toast('返金額を確認してください。');await DB.put('transactions',{id:DB.uid('tx'),date:DB.ymd(),month:DB.monthOfDate(DB.ymd()),kind:'advance_repayment',amount,paymentMethod:'cash',linkedTransactionId:b.dataset.repayId,sourceType:'manual',createdAt:DB.now(),updatedAt:DB.now()});toast('返金を登録しました。');await renderOutstanding();await renderHome();});
}

/* CSV draft uses the existing settings store, so schemaVersion and backup format stay unchanged.
   Draft rows are excluded from all normal transactions / monthly summaries. */
function csvDraftMessage(message){const el=$('csvDraftSaveStatus');el.textContent=message;el.classList.toggle('hidden',!message);}
function draftRecordFromPrepared(p){
  return {key:CSV_DRAFT_KEY,draftVersion:1,fileHash:p.fileHash,fileName:p.fileName,fileSize:p.fileSize,
    savedAt:DB.now(),payload:{rows:p.rows,matchIds:p.matchIds||{},excludedRows:p.excludedRows||[],statementAmount:p.statementAmount,
      paymentDate:p.paymentDate,headerRow:p.headerRow,fileHash:p.fileHash,fileName:p.fileName,fileSize:p.fileSize}};
}
function scheduleCsvDraftSave({immediate=false}={}){
  if(!preparedCsv)return csvDraftSaveChain;
  clearTimeout(csvDraftSaveTimer);
  csvDraftMessage('下書きを保存中…');
  if(!immediate){
    csvDraftSaveTimer=setTimeout(()=>{csvDraftSaveTimer=null;void scheduleCsvDraftSave({immediate:true});},350);
    return csvDraftSaveChain;
  }
  const snapshot=draftRecordFromPrepared(preparedCsv);
  const generation=csvDraftGeneration;
  csvDraftSaveChain=csvDraftSaveChain.catch(()=>{}).then(async()=>{
    if(generation!==csvDraftGeneration)return;
    await DB.put('settings',snapshot);
    if(generation===csvDraftGeneration)csvDraftMessage('下書き保存済み（正式な収支には未反映）');
  }).catch(error=>{
    console.error('CSV下書き保存失敗',error);
    csvDraftMessage('下書き保存に失敗しました。更新・終了前に再試行してください。');
  });
  return csvDraftSaveChain;
}
async function flushCsvDraftSave(){
  if(csvDraftSaveTimer){clearTimeout(csvDraftSaveTimer);csvDraftSaveTimer=null;await scheduleCsvDraftSave({immediate:true});}
  await csvDraftSaveChain;
}
async function refreshCsvDraftControls(){
  const draft=await DB.get('settings',CSV_DRAFT_KEY);
  const valid=!!(draft?.draftVersion===1&&draft.payload?.fileHash===draft.fileHash&&Array.isArray(draft.payload.rows));
  $('csvDraftControls').classList.toggle('hidden',!valid);
  $('csvDraftNotice').classList.toggle('hidden',!valid);
  $('csvDraftNotice').textContent=valid?`編集中のCSV下書き：${draft.fileName||'名称未設定'}（${draft.savedAt?new Date(draft.savedAt).toLocaleString('ja-JP'):'保存日時不明'}）。正式な家計収支には未反映です。`:'';
  return valid?draft:null;
}
async function discardCsvDraft(){
  clearTimeout(csvDraftSaveTimer);csvDraftSaveTimer=null;
  ++csvDraftGeneration;
  await csvDraftSaveChain.catch(()=>{});
  await DB.del('settings',CSV_DRAFT_KEY);
  preparedCsv=null;
  $('dcardFile').value='';
  $('csvPreview').classList.add('hidden');
  $('csvReview').classList.add('hidden');
  $('csvMeals').classList.add('hidden');
  $('csvMerchantEditWrap').classList.add('hidden');
  $('csvImportButton').classList.add('hidden');
  csvDraftMessage('');
  await refreshCsvDraftControls();
}
async function reconcileCsvDraftRows(p){
  const old=await DB.getByIndex('cardImports','fileHash',p.fileHash);
  if(old)return {alreadyImported:true};
  const allTx=await DB.getAll('transactions');
  const keys=new Set(allTx.map(x=>x.sourceRowKey).filter(Boolean));
  for(const r of p.rows)r.isDuplicate=!!r.sourceRowKey&&keys.has(r.sourceRowKey);
  p.newRows=p.rows.filter(r=>!r.invalid&&!r.isDuplicate);
  p.invalidRows=p.rows.filter(r=>r.invalid);
  p.duplicateRows=p.rows.filter(r=>r.isDuplicate);
  return {alreadyImported:false};
}
async function resumeCsvDraft(){
  await flushCsvDraftSave();
  const draft=await refreshCsvDraftControls();
  if(!draft)return toast('保存済みのCSV下書きがありません。');
  const p=draft.payload;
  if(!p||p.fileHash!==draft.fileHash||!Array.isArray(p.rows))return toast('下書きの内容を確認できません。');
  const result=await reconcileCsvDraftRows(p);
  if(result.alreadyImported){
    csvDraftMessage('このCSVはすでに正式登録済みです。下書きは破棄できます。');
    return toast('このCSVはすでに取込済みです。');
  }
  ++csvDraftGeneration;
  preparedCsv=p;
  $('csvPreview').classList.remove('hidden');
  $('csvMerchantEditWrap').open=false;
  renderCsvPrepared();
  csvDraftMessage('保存済みの下書きを再開しました（正式な収支には未反映）');
}
async function handleCsvFile(file){
  try{
    await flushCsvDraftSave();
    $('csvPreview').classList.remove('hidden');
    $('csvPreview').innerHTML='<p>解析中...</p>';
    const rules=await DB.getAll('categoryRules');
    const p=await DC.prepareFile(file,rules);
    if((await reconcileCsvDraftRows(p)).alreadyImported){
      $('csvPreview').innerHTML='<div class="alert">このCSVは取込済みです。</div>';
      if(preparedCsv)renderCsvPrepared();
      return;
    }
    const currentDraft=await refreshCsvDraftControls();
    if(currentDraft?.fileHash===p.fileHash){
      await resumeCsvDraft();
      return;
    }
    if(currentDraft&&!confirm(`保存済みの下書き「${currentDraft.fileName}」があります。新しいCSVを読み込むと下書きが置き換わります。続けますか？`)){
      if(preparedCsv)renderCsvPrepared();
      else $('csvPreview').innerHTML='<p class="muted">下書きは保持しています。「保存済み下書きを再開」を選んでください。</p>';
      $('dcardFile').value='';
      return;
    }
    ++csvDraftGeneration;
    preparedCsv=p;
    $('csvMerchantEditWrap').open=false;
    renderCsvPrepared();
    await scheduleCsvDraftSave({immediate:true});
    await refreshCsvDraftControls();
  }catch(e){
    console.error('CSV準備失敗',e);
    $('csvPreview').innerHTML=`<div class="alert warn"><strong>CSVを解析できませんでした</strong><div class="muted">${esc(e.message)}</div></div>`;
    if(preparedCsv)renderCsvPrepared();
  }
}
function applyCsvMerchantName(input,{final=false}={}){
  if(!preparedCsv)return;
  const holder=input.closest('[data-review-key], [data-csv-merchant-row]');
  const key=holder?.getAttribute('data-review-key')||holder?.getAttribute('data-csv-merchant-row');
  const entry=preparedCsv.newRows.find(r=>r.sourceRowKey===key);
  if(!entry)return;
  const next=cleanMerchantDisplayName(input.value);
  if(!next||next.length>120){
    if(final){toast('店名を1〜120文字で入力してください。');input.value=entry.merchantNormalized;}
    return;
  }
  entry.merchantNormalized=next;
  const review=$('csvReview').querySelector('[data-review-key="'+CSS.escape(key)+'"]');
  const heading=review?.querySelector('.review-main strong');
  if(heading)heading.textContent=next;
  for(const peer of [
    review?.querySelector('[data-review-merchant-name]'),
    $('csvMerchantEditList').querySelector('[data-csv-merchant-row="'+CSS.escape(key)+'"] [data-csv-merchant-name]')
  ]){if(peer&&peer!==input)peer.value=next;}
  if(final){input.value=next;scheduleCsvDraftSave({immediate:true});}
  else scheduleCsvDraftSave();
}
function cleanMerchantDisplayName(value){
  return String(value??'').normalize('NFKC').replace(/\\s+/g,' ').trim();
}
function renderCsvMerchantEdits(){
  const rows=preparedCsv?.newRows||[];
  const wrap=$('csvMerchantEditWrap');
  wrap.classList.toggle('hidden',rows.length===0);
  $('csvMerchantEditList').innerHTML=rows.map(r=>`
    <div class="merchant-edit-row" data-csv-merchant-row="${esc(r.sourceRowKey)}">
      <div class="merchant-edit-label"><strong>${esc(r.date)}</strong><span>${formatYen(r.amount)}</span></div>
      <div class="muted">元のCSV店名：${esc(r.merchantRaw)}</div>
      <label>表示用の店名<input type="text" maxlength="120" autocomplete="off" value="${esc(r.merchantNormalized)}" data-csv-merchant-name></label>
    </div>`).join('');
}
async function renderHistoryMerchantEdits(){
  const filter=$('historyMerchantFilter').value.trim().toLowerCase();
  const transactions=(await A.monthTransactions(selectedMonth)).filter(t=>t.sourceType==='dcard_csv');
  const rows=transactions.filter(t=>!filter||[t.date,t.merchantRaw,t.merchantNormalized,String(t.amount)].some(x=>String(x||'').toLowerCase().includes(filter)));
  $('historyMerchantEditList').innerHTML=rows.slice().reverse().map(t=>`
    <div class="merchant-edit-row" data-history-merchant-row="${esc(t.id)}">
      <div class="merchant-edit-label"><strong>${esc(t.date)}</strong><span>${formatYen(t.amount)}</span></div>
      <div class="muted">元のCSV店名：${esc(t.merchantRaw)}</div>
      <div class="merchant-edit-actions">
        <input type="text" maxlength="120" autocomplete="off" aria-label="表示用の店名" value="${esc(t.merchantNormalized||DC.normalizeMerchant(t.merchantRaw))}" data-history-merchant-name>
        <button type="button" data-history-merchant-save>保存</button>
      </div>
    </div>`).join('')||'<p class="muted">対象明細がありません。</p>';
}
async function saveHistoryMerchantName(button){
  if(button.disabled)return false;
  const row=button.closest('[data-history-merchant-row]');
  const id=row?.getAttribute('data-history-merchant-row');
  const input=row?.querySelector('[data-history-merchant-name]');
  const name=cleanMerchantDisplayName(input?.value);
  if(!id||!name||name.length>120){toast('店名を1〜120文字で入力してください。');return false;}
  const tx=await DB.get('transactions',id);
  if(!tx||tx.sourceType!=='dcard_csv'||tx.month!==selectedMonth){toast('対象のdカード明細が見つかりません。');return false;}
  if(name===(tx.merchantNormalized||DC.normalizeMerchant(tx.merchantRaw))){toast('店名は変更されていません。');return false;}
  button.disabled=true;
  try{
    await DB.put('transactions',{...tx,merchantNormalized:name,updatedAt:DB.now()});
    const stored=await DB.get('transactions',id);
    if(stored?.merchantNormalized!==name)throw new Error('保存結果を確認できませんでした。');
    await renderHistory();
    await renderHome();
    toast('表示用の店名を更新しました。');
    return true;
  }catch(error){
    console.error(error);
    toast('店名を保存できません: '+error.message);
    return false;
  }finally{button.disabled=false;}
}

async function renderCsvAdvanceMatches(){
  const p=preparedCsv,el=$('csvAdvanceMatches');if(!p||!el)return;
  p.matchIds=p.matchIds||{};
  const all=await DB.getAll('transactions'),candidates=all.filter(isManualAdvanceCandidate);
  const rows=p.newRows.filter(r=>r.kind==='expense'&&isCardAdvanceMethod(r.paymentMethod)),html=[];
  for(const r of rows){
    const choices=candidates.filter(t=>t.paymentMethod===r.paymentMethod&&n(t.amount)===n(r.amount)&&
      Math.abs((Date.parse(t.date+'T00:00:00')-Date.parse(r.date+'T00:00:00'))/86400000)<=31);
    if(!choices.length&&!p.matchIds[r.sourceRowKey])continue;
    html.push(`<div class="review-row"><div class="review-main"><div><strong>${esc(r.merchantNormalized||r.merchantRaw)}</strong><span class="muted">${esc(r.date)} / ${formatYen(r.amount)}</span></div></div>
    <label>事前立替との照合<select data-advance-match="${esc(r.sourceRowKey)}">
      <option value="">紐づけしない</option>
      ${p.matchIds[r.sourceRowKey]&&!choices.some(t=>t.id===p.matchIds[r.sourceRowKey])?'<option value="INVALID" selected disabled>前回の照合候補が見つかりません。別の候補か「紐づけしない」を選択してください。</option>':''}
      ${choices.map(t=>`<option value="${esc(t.id)}" ${p.matchIds[r.sourceRowKey]===t.id?'selected':''}>${esc(t.date)} / ${esc(t.merchantNormalized||t.merchantRaw||'立替')} / 家族分 ${formatYen(t.advanceShare)}${t.kind==='expense'?'（旧登録）':''}</option>`).join('')}
    </select></label></div>`);
  }
  el.classList.toggle('hidden',html.length===0);
  el.innerHTML=html.length?'<h3>事前立替との照合候補</h3><p class="muted">金額・支払方法・日付前後31日の候補です。自動確定はしません。実際に同じ利用か確認してください。</p>'+html.join(''):'';
  el.querySelectorAll('[data-advance-match]').forEach(select=>select.onchange=()=>{
    if(select.value)p.matchIds[select.dataset.advanceMatch]=select.value;
    else delete p.matchIds[select.dataset.advanceMatch];
    scheduleCsvDraftSave();
  });
}
function validateAdvanceMatches(p,all){
  const candidates=new Map(all.filter(isManualAdvanceCandidate).map(t=>[t.id,t]));
  const seen=new Set(),out=new Map();
  for(const r of p.newRows){
    const id=(p.matchIds||{})[r.sourceRowKey];if(!id)continue;
    const t=candidates.get(id),delta=t?Math.abs((Date.parse(t.date+'T00:00:00')-Date.parse(r.date+'T00:00:00'))/86400000):Infinity;
    if(!t||r.kind!=='expense'||t.paymentMethod!==r.paymentMethod||n(t.amount)!==n(r.amount)||delta>31||seen.has(id))
      throw new Error('立替照合が無効です。同じ取引を二重選択していないか確認してください。');
    seen.add(id);out.set(r.sourceRowKey,t);
  }
  return out;
}
function renderCsvPrepared(){const p=preparedCsv;if(!p)return;const excludedRows=p.excludedRows||[],excluded=excludedRows.length,invalid=p.invalidRows.length;const review=p.newRows.filter(r=>r.category==='未分類'||r.kind==='refund').concat(p.invalidRows);const suggestions=p.newRows.filter(r=>r.category!=='未分類'&&(r.categorySource==='rule'||r.categorySource==='heuristic')).length;const excludedSummary=excluded?`<div class="muted">対象外：${esc(excludedRows[0]?.reason||'対象外行')} ${excluded}件</div>`:'';$('csvPreview').innerHTML=`<div class="summary-strip"><div>新規<b>${p.newRows.length}</b></div><div>重複<b>${p.duplicateRows.length}</b></div><div>除外・不正<b>${invalid}</b></div><div>要確認<b>${review.length}</b></div></div><p class="muted">対象期間：${esc(rangeText(p.newRows))}${p.statementAmount!=null?` / 請求合計候補 ${formatYen(p.statementAmount)}`:''}${p.paymentDate?` / 支払日候補 ${esc(p.paymentDate)}`:''}</p><p class="muted">自動分類候補：${suggestions}件（店舗名による推定です。商品内容が異なる場合は分類を変更してください）</p>${excludedSummary}`;
  if(review.length){$('csvReview').classList.remove('hidden');$('csvReview').innerHTML='<h3>要確認</h3>'+review.map((r,i)=>r.invalid?`<div class="review-row warn"><strong>${esc(r.reason)}</strong><div class="muted">CSV ${r.sourceLine}行目</div></div>`:`<div class="review-row" data-review-key="${esc(r.sourceRowKey)}"><div class="review-main"><div><strong>${esc(r.merchantNormalized)}</strong><span class="muted">${esc(r.date)} / ${r.kind==='refund'?'返金候補':'カテゴリ未分類'}</span></div><strong>${formatYen(r.amount)}</strong></div><select data-category-key="${esc(r.sourceRowKey)}">${selectOptions(categories,r.category)}</select><details class="review-merchant-edit"><summary>店名も修正（必要な場合のみ）</summary><label>表示用の店舗名<input type="text" maxlength="120" autocomplete="off" value="${esc(r.merchantNormalized)}" data-review-merchant-name></label><div class="muted">元のCSV店名：${esc(r.merchantRaw)}</div></details></div>`).join('');$$('[data-category-key]').forEach(s=>s.onchange=()=>{const r=p.newRows.find(x=>x.sourceRowKey===s.dataset.categoryKey);if(r){r.category=s.value;r.categoryConfirmed=true;if(r.category!=='食費')r.mealType=null;renderCsvMeals();scheduleCsvDraftSave();}});}else $('csvReview').classList.add('hidden');
  const proposed=p.newRows.filter(r=>r.category!=='未分類'&&(r.categorySource==='rule'||r.categorySource==='heuristic'));
  const reviewSuggestion=$('csvSuggestedReview');
  if(reviewSuggestion){
    reviewSuggestion.classList.toggle('hidden',proposed.length===0);
    $('csvSuggestedCount').textContent=String(proposed.length);
    $('csvSuggestedList').innerHTML=proposed.map(r=>`<div class="review-row" data-suggest-key="${esc(r.sourceRowKey)}"><div class="review-main"><div><strong>${esc(r.merchantNormalized)}</strong><span class="muted">${esc(r.categorySource==='rule'?'前回の分類候補':'店舗名からの推定')} / ${esc(r.date)}</span></div><strong>${formatYen(r.amount)}</strong></div><select aria-label="分類候補の修正" data-suggest-category="${esc(r.sourceRowKey)}">${selectOptions(categories,r.category)}</select></div>`).join('');
    $$('[data-suggest-category]').forEach(select=>select.onchange=()=>{
      const r=p.newRows.find(x=>x.sourceRowKey===select.dataset.suggestCategory);
      if(!r)return;
      r.category=select.value;r.categoryConfirmed=true;r.mealType=r.category==='食費'?r.mealType:null;
      renderCsvMeals();scheduleCsvDraftSave();
    });
  }
  void renderCsvAdvanceMatches();renderCsvMerchantEdits();renderCsvMeals();$('csvImportButton').classList.toggle('hidden',p.newRows.length===0);
}
function renderCsvMeals(){const p=preparedCsv;if(!p)return;const food=p.newRows.filter(r=>r.category==='食費');if(!food.length){$('csvMeals').classList.add('hidden');return;}$('csvMeals').classList.remove('hidden');$('csvMeals').innerHTML='<h3>食費だけ確認</h3><p class="muted">未分類のままでも登録できます。</p>'+food.map(r=>`<div class="review-row"><div class="review-main"><div><strong>${esc(r.merchantNormalized)}</strong><span class="muted">${esc(r.date)}${r.time?` ${esc(r.time)}`:''}</span></div><strong>${formatYen(r.amount)}</strong></div><div class="meal-buttons">${mealOptions.slice(1).map(([v,l])=>`<button type="button" data-meal-key="${esc(r.sourceRowKey)}" data-meal="${v}" class="${r.mealType===v?'active':''}">${l}</button>`).join('')}<button type="button" data-meal-key="${esc(r.sourceRowKey)}" data-meal="none" class="${!r.mealType?'active':''}">後で</button><button type="button" data-food-off="${esc(r.sourceRowKey)}">食費ではない</button></div></div>`).join('');$$('[data-meal-key]').forEach(b=>b.onclick=()=>{const r=p.newRows.find(x=>x.sourceRowKey===b.dataset.mealKey);if(r){r.mealType=b.dataset.meal==='none'?null:b.dataset.meal;if(b.dataset.meal!=='none')r.categoryConfirmed=true;renderCsvMeals();scheduleCsvDraftSave();}});$$('[data-food-off]').forEach(b=>b.onclick=()=>{const r=p.newRows.find(x=>x.sourceRowKey===b.dataset.foodOff);if(r){r.category='未分類';r.mealType=null;r.categoryConfirmed=true;renderCsvPrepared();scheduleCsvDraftSave();}});}
function rangeText(rows){const ds=rows.map(x=>x.date).filter(Boolean).sort();return ds.length?`${ds[0]}〜${ds[ds.length-1]}`:'—';}
async function importPreparedCsv(){
  if(csvImportInProgress)return;
  const p=preparedCsv;if(!p||!p.newRows.length)return;
  csvImportInProgress=true;$('csvImportButton').disabled=true;
  try{
    await flushCsvDraftSave();
    if((await reconcileCsvDraftRows(p)).alreadyImported)throw new Error('このCSVはすでに取込済みです。');
    if(!p.newRows.length){renderCsvPrepared();throw new Error('未登録の明細はありません。');}
    const matches=validateAdvanceMatches(p,await DB.getAll('transactions'));
    if(matches.size&&!confirm(matches.size+'件のCSVと事前立替を紐づけます。同じ取引であることを確認しましたか？'))return;
    const at=DB.now(),importId=DB.uid('dcard'),manualUpdates=[];
    const txs=p.newRows.map(r=>{
      const t={id:DB.uid('tx'),date:r.date,time:r.time||null,month:DB.monthOfDate(r.date),kind:r.kind,
        amount:r.amount,paymentMethod:r.paymentMethod,merchantRaw:r.merchantRaw,merchantNormalized:r.merchantNormalized,
        category:r.category,mealType:r.mealType||null,isTemporaryExpense:false,sourceType:'dcard_csv',sourceImportId:importId,
        sourceRowKey:r.sourceRowKey,sourceLine:r.sourceLine,paymentType:r.paymentType,note:r.note,createdAt:at,updatedAt:at};
      const manual=matches.get(r.sourceRowKey);
      if(manual){t.ownShare=n(manual.ownShare);t.advanceShare=n(manual.advanceShare);t.advanceRecordId=manual.id;
        manualUpdates.push({...manual,kind:'advance_linked',linkedCsvTransactionId:t.id,updatedAt:at});}
      return t;
    });
    const cardImport={id:importId,importedAt:at,fileName:p.fileName,fileSize:p.fileSize,fileHash:p.fileHash,
      rowCount:p.rows.length+(p.excludedRows||[]).length,importedCount:txs.length,
      skippedCount:p.invalidRows.length+(p.excludedRows||[]).length,duplicateCount:p.duplicateRows.length,
      targetRange:rangeText(p.newRows),paymentDate:p.paymentDate||null,statementAmount:p.statementAmount,createdAt:at};
    const plans=p.statementAmount!=null?[{id:`dcard:${p.paymentDate||p.fileHash.slice(0,12)}`,
      name:'dカード引落',dueDate:p.paymentDate||null,amount:p.statementAmount,type:'card',status:'planned',
      reservedAmount:0,sourceImportId:importId,createdAt:at,updatedAt:at}]:[];
    const months=[...new Set(txs.map(t=>t.month))],statuses=[];
    for(const m of months){const st=await DB.getMonthStatus(m);
      if(st.completedAt){st.postCompletionUpdatedAt=at;st.postCompletionChangeCount=n(st.postCompletionChangeCount)+txs.filter(t=>t.month===m).length;}
      st.completionItems.dcard=true;st.cardCsvUpdatedAt=at;
      const vals=Object.values(st.completionItems||{});st.completionRate=vals.length?Math.round(vals.filter(Boolean).length/vals.length*100):0;
      st.updatedAt=at;statuses.push(st);
    }
    const oldRules=(await DB.getAll('categoryRules')).filter(x=>x.matchType==='merchant_exact'),confirmed=new Map(),rules=[];
    for(const r of p.newRows)if(r.categoryConfirmed&&r.category&&r.category!=='未分類'&&r.merchantRaw)confirmed.set(DC.normalizeMerchant(r.merchantRaw),r);
    for(const [pattern,r] of confirmed){
      const prior=oldRules.find(x=>x.pattern===pattern);
      if(prior)rules.push({...prior,category:r.category,mealType:r.category==='食費'?(r.mealType||null):null,enabled:true,updatedAt:at});
      else rules.push({id:DB.uid('rule'),matchType:'merchant_exact',pattern,category:r.category,mealType:r.category==='食費'?(r.mealType||null):null,enabled:true,createdAt:at});
    }
    await DB.atomicChanges({transactions:[...txs,...manualUpdates],cardImports:[cardImport],
      paymentPlans:plans,monthStatus:statuses,categoryRules:rules},{settings:[CSV_DRAFT_KEY]});
    clearTimeout(csvDraftSaveTimer);csvDraftSaveTimer=null;++csvDraftGeneration;
    await csvDraftSaveChain.catch(()=>{});await refreshCsvDraftControls();csvDraftMessage('');
    $('csvMerchantEditWrap').classList.add('hidden');$('csvMerchantEditList').innerHTML='';
    $('csvPreview').innerHTML=`<div class="alert good"><strong>${txs.length}件を登録しました</strong><div class="muted">事前立替との紐づけ ${matches.size}件 / ${months.map(monthLabel).join(' / ')}</div></div>`;
    for(const id of ['csvReview','csvMeals','csvAdvanceMatches','csvImportButton'])$(id).classList.add('hidden');
    $('dcardFile').value='';preparedCsv=null;toast('dカードCSVを取り込みました。');await renderHome();
  }catch(e){console.error(e);toast('取込に失敗しました: '+e.message);}
  finally{csvImportInProgress=false;$('csvImportButton').disabled=false;}
}
async function renderMonthEnd(){
  const walletLive=await A.liveCashBalance(selectedMonth);
  const walletDirty=!!(walletLive&&walletLive.value!=null&&walletLive.movement!==0&&selectedMonth===DB.currentMonth());
  $('walletMovementNotice').classList.toggle('hidden',!walletDirty);
  if(walletDirty)$('walletMovementNotice').innerHTML=`<div class="alert warn"><strong>財布に現金移動があります</strong><div class="muted">現在残高 ${formatYen(walletLive.value)}（確認時 ${formatYen(walletLive.baseValue)} / 自動反映 ${A.formatSigned(walletLive.movement)}）。実際の財布残高を確認してください。</div></div>`;
  const accounts=(await DB.getAll('accounts')).filter(x=>x.active!==false).sort((a,b)=>n(a.sortOrder)-n(b.sortOrder));const rows=[];
  $('monthEndBankPrompt').classList.toggle('hidden',accounts.some(x=>x.category==='bank'));
  for(const a of accounts){
    const cur=await DB.get('assetSnapshots',[selectedMonth,a.id]),prev=await DB.latestSnapshot(a.id,DB.prevMonth(selectedMonth));
    const live=a.id==='cash-wallet'?walletLive:null;
    const liveDirty=!!(live&&live.value!=null&&live.movement!==0&&selectedMonth===DB.currentMonth());
    const val=live&&live.value!=null?live.value:(cur?cur.value:(prev?prev.value:''));
    const diff=prev&&val!==''?n(val)-n(prev.value):'';
    const meta=liveDirty?`確認時 ${formatYen(live.baseValue)} / 自動反映 ${A.formatSigned(live.movement)}`:`前回 ${prev?formatYen(prev.value):'—'}`;
    const badge=liveDirty?'要確認（現金移動あり）':(cur?.confirmed?'確認済':'未確認');
    const sameDisabled=!prev||liveDirty?'disabled':'';
    rows.push(`<div class="asset-row" data-asset="${a.id}"><div class="asset-head"><div><strong>${esc(a.name)}</strong><div class="status-meta">${meta}</div></div><span class="badge">${badge}</span></div><div class="asset-values"><label>今月値<input data-asset-value="${a.id}" type="text" inputmode="numeric" autocomplete="off" value="${formatAmount(val)}"></label><label>差額<input type="text" value="${diff===''?'':formatSignedAmount(diff)}" readonly></label></div><div class="inline-actions"><button data-asset-same="${a.id}" ${sameDisabled}>変更なし</button></div></div>`);
  }
  $('monthEndAccounts').innerHTML=rows.join('');bindMonthEndAutoSave('asset');$$('[data-asset-same]').forEach(b=>b.onclick=()=>saveAsset(b.dataset.assetSame,true));
  const points=(await DB.getAll('pointAccounts')).filter(x=>x.active!==false).sort((a,b)=>n(a.sortOrder)-n(b.sortOrder));const prows=[];for(const p of points){const cur=await DB.get('pointSnapshots',[selectedMonth,p.id]),prev=await DB.latestPointSnapshot(p.id,DB.prevMonth(selectedMonth));const val=cur?cur.value:(prev?prev.value:'');const diff=prev&&val!==''?n(val)-n(prev.value):'';prows.push(`<div class="asset-row"><div class="asset-head"><div><strong>${esc(p.name)}</strong><div class="status-meta">前回 ${prev?n(prev.value).toLocaleString('ja-JP')+' pt':'—'}</div></div><span class="badge">${cur?.confirmed?'確認済':'未確認'}</span></div><div class="asset-values"><label>今月<input data-point-value="${p.id}" type="text" inputmode="numeric" autocomplete="off" value="${formatAmount(val)}"></label><label>差額<input type="text" value="${diff===''?'':formatSignedAmount(diff)}" readonly></label></div><div class="inline-actions"><button data-point-same="${p.id}" ${prev?'':'disabled'}>変更なし</button></div></div>`);}
  $('monthEndPoints').innerHTML=prows.join('');bindMonthEndAutoSave('point');$$('[data-point-same]').forEach(b=>b.onclick=()=>savePoint(b.dataset.pointSame,true));await renderChecklist();
}

function monthEndInputs(){return $$('[data-asset-value],[data-point-value]');}
function markMonthEndDirty(input){
  input.dataset.dirty='true';
  const badge=input.closest('.asset-row')?.querySelector('.asset-head .badge');
  if(badge)badge.textContent='未保存';
}
function markMonthEndStatus(input,status){
  const badge=input.closest('.asset-row')?.querySelector('.asset-head .badge');
  if(badge)badge.textContent=status;
}
function bindMonthEndAutoSave(type){
  const attr=type==='asset'?'data-asset-value':'data-point-value';
  $$('['+attr+']').forEach(input=>{
    input.dataset.dirty='false';
    input.oncompositionstart=()=>{input.isComposing=true;};
    input.oninput=()=>{formatAmountInput(input);markMonthEndDirty(input);};
    input.oncompositionend=()=>{input.isComposing=false;formatAmountInput(input);markMonthEndDirty(input);};
    input.onchange=()=>{if(input.dataset.dirty==='true')void persistMonthEndInput(input);};
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}};
  });
}
function persistMonthEndInput(input,same=false){
  if(!input)return Promise.resolve(false);
  if(input._monthEndSave){
    return input._monthEndSave.then(ok=>{
      if(!ok)return false;
      if(same||input.dataset.dirty==='true')return persistMonthEndInput(input,same);
      return true;
    });
  }
  const isAsset=input.hasAttribute('data-asset-value');
  const id=input.getAttribute(isAsset?'data-asset-value':'data-point-value');
  const month=selectedMonth,raw=input.value.trim();
  const task=monthEndWriteQueue.catch(()=>{}).then(async()=>{
    try{
      const previous=isAsset?await DB.latestSnapshot(id,DB.prevMonth(month)):await DB.latestPointSnapshot(id,DB.prevMonth(month));
      if(same&&!previous)throw new Error('前月値がありません。');
      if(isAsset&&same&&id==='cash-wallet'&&month===DB.currentMonth()){
        const live=await A.liveCashBalance(month,id);
        if(live.movement!==0)throw new Error('現金移動が反映されています。現在残高を確認してください。');
      }
      if(!same&&raw==='')throw new Error('残高を入力してください。');
      const value=same?Number(previous.value):parseAmount(raw);
      if(!Number.isSafeInteger(value)||value<0)throw new Error('0以上の整数で入力してください。');
      const at=DB.now();
      if(isAsset){
        await DB.put('assetSnapshots',{month,accountId:id,value,confirmed:true,confirmedAt:at,updatedAt:at});
      }else{
        await DB.put('pointSnapshots',{month,pointAccountId:id,value,confirmed:true,updatedAt:at});
      }
      if(same)input.value=formatAmount(value);
      if(same||input.value.trim()===raw){
        input.dataset.dirty='false';
        markMonthEndStatus(input,'保存済・確認済');
      }else{
        input.dataset.dirty='true';
        markMonthEndStatus(input,'未保存');
      }
      const delta=input.closest('.asset-row')?.querySelector('input[readonly]');
      if(delta)delta.value=previous?formatSignedAmount(value-Number(previous.value)):'';
      await renderChecklist();
      return true;
    }catch(err){
      input.dataset.dirty='true';
      markMonthEndStatus(input,'保存失敗');
      toast('保存できません: '+err.message);
      return false;
    }
  });
  monthEndWriteQueue=task.catch(()=>{});
  input._monthEndSave=task;
  void task.finally(()=>{if(input._monthEndSave===task)input._monthEndSave=null;});
  return task;
}
async function flushMonthEndEdits(){
  for(let i=0;i<3;i++){
    const pending=monthEndInputs().filter(input=>input.dataset.dirty==='true'||input._monthEndSave);
    if(!pending.length)return true;
    const completed=await Promise.all(pending.map(input=>persistMonthEndInput(input)));
    if(completed.some(ok=>!ok)){
      toast('未保存の項目があります。入力を確認してください。');
      return false;
    }
  }
  const clean=!monthEndInputs().some(input=>input.dataset.dirty==='true'||input._monthEndSave);
  if(!clean)toast('保存中です。少ししてから操作してください。');
  return clean;
}
async function saveAsset(id,same){
  const input=document.querySelector(`[data-asset-value="${CSS.escape(id)}"]`);
  const ok=await persistMonthEndInput(input,same);
  if(ok)toast('資産残高を保存しました。');
}
async function savePoint(id,same){
  const input=document.querySelector(`[data-point-value="${CSS.escape(id)}"]`);
  const ok=await persistMonthEndInput(input,same);
  if(ok)toast('ポイント残高を保存しました。');
}
function itemLabel(k){return ({dcard:'dカードCSV',bank:'銀行',cash:'現金',stock:'株式',dc:'DC',points:'ポイント',rent:'家賃',income:'主要収入'})[k]||k;}
async function recomputeMonthStatus(month,save=true){const st=await DB.getMonthStatus(month);const builtins=new Set(['cash-wallet','stock-total','dc-total','dpoint']);const allAccounts=(await DB.getAll('accounts')).filter(x=>x.active!==false);const ac=[];for(const x of allAccounts){if(builtins.has(x.id)||!x.createdAt||String(x.createdAt).slice(0,7)<=month||await DB.get('assetSnapshots',[month,x.id]))ac.push(x);}for(const cat of ['bank','cash','stock','dc']){const list=ac.filter(x=>x.category===cat);if(!list.length){st.completionItems[cat]=true;continue;}const checks=[];for(const x of list){const snap=await DB.get('assetSnapshots',[month,x.id]);let ok=!!snap?.confirmed;if(ok&&x.id==='cash-wallet'&&month===DB.currentMonth()){const live=await A.liveCashBalance(month,x.id);if(live.movement!==0)ok=false;}checks.push(ok);}st.completionItems[cat]=checks.every(Boolean);}const pts=(await DB.getAll('pointAccounts')).filter(x=>x.active!==false&&applies(x));st.completionItems.points=pts.length?(await Promise.all(pts.map(x=>DB.get('pointSnapshots',[month,x.id])))).every(x=>x?.confirmed):true;const tx=await A.monthTransactions(month);if(tx.some(x=>x.kind==='income'))st.completionItems.income=true;if(tx.some(x=>x.kind==='expense'&&x.category==='家賃'))st.completionItems.rent=true;return save?await DB.saveMonthStatus(st):({...st,completionRate:Math.round(Object.values(st.completionItems).filter(Boolean).length/Object.values(st.completionItems).length*100)});}
async function renderChecklist(){const st=await recomputeMonthStatus(selectedMonth);const bankAccounts=[];for(const x of (await DB.getAll('accounts')).filter(x=>x.active!==false&&x.category==='bank')){if(!x.createdAt||String(x.createdAt).slice(0,7)<=selectedMonth||await DB.get('assetSnapshots',[selectedMonth,x.id]))bankAccounts.push(x);}$('monthEndProgress').textContent=`${st.completionRate}%`;const keys=['dcard','bank','cash','stock','dc','points','rent','income'];$('monthEndChecklist').innerHTML=keys.map(k=>`<div class="status-row"><div><strong>${itemLabel(k)}</strong>${k==='dcard'&&st.cardCsvUpdatedAt?`<div class="status-meta">最終取込 ${new Date(st.cardCsvUpdatedAt).toLocaleString('ja-JP')}</div>`:''}</div><div>${k==='bank'&&!bankAccounts.length?'<span class="badge">対象なし</span>':st.completionItems[k]?'<span class="badge">確認済</span>':(['dcard','rent','income'].includes(k)?`<button data-check-item="${k}">確認済みにする</button>`:'<span class="badge">未確認</span>')}</div></div>`).join('');$$('[data-check-item]').forEach(b=>b.onclick=async()=>{const s=await DB.getMonthStatus(selectedMonth);s.completionItems[b.dataset.checkItem]=true;await DB.saveMonthStatus(s);await renderChecklist();});$('completeMonthButton').disabled=st.completionRate<100;$('completeMonthButton').title=st.completionRate<100?'未確認項目があります':'';}
async function completeMonth(){if(!(await flushMonthEndEdits()))return;const st=await recomputeMonthStatus(selectedMonth);if(st.completionRate<100)return toast('未確認項目があります。');st.completedAt=DB.now();await DB.saveMonthStatus(st);toast(`${monthLabel(selectedMonth)}の更新を完了しました。`);await renderHome();}

async function renderHistory(){const months=[];let m=selectedMonth;for(let i=0;i<6;i++){months.push(m);m=DB.prevMonth(m);}const sums=[];for(const x of months)sums.push(await A.summary(x));$('historyMonthly').innerHTML=sums.map(s=>`<tr><td>${esc(s.month)}</td><td>${formatYen(s.income)}</td><td>${formatYen(s.expense)}</td><td>${formatYen(s.saving)}</td><td>${formatYen(s.assets.total)}</td></tr>`).join('');const cur=sums[0],prev=sums[1];renderMonthlyCashflow(sums);renderBars('historyCategories',A.objDiff(cur.categories,prev.categories).slice(0,8),true);const merch=Object.entries(cur.merchants).map(([key,value])=>({key,current:value,delta:value-(prev.merchants[key]||0)})).sort((a,b)=>b.current-a.current).slice(0,8);renderBars('historyMerchants',merch,false);const ml={breakfast:'朝',lunch:'昼',dinner:'夜',snack:'間食・飲料',other:'その他',unclassified:'未分類'};const meal=Object.entries(cur.meals).map(([k,v])=>({key:ml[k]||k,current:v,delta:v-(prev.meals[k]||0)})).filter(x=>x.current||x.delta);renderBars('historyMeals',meal,false);await renderManualCashDateEdits();await renderHistoryMerchantEdits();}
async function renderManualCashDateEdits(){
  const transactions=(await A.monthTransactions(selectedMonth)).filter(t=>
    t.kind==='expense'&&t.paymentMethod==='cash'&&t.sourceType==='manual'&&
    !(n(t.advanceShare)>0)&&t.ownShare==null
  );
  $('historyCashEditList').innerHTML=transactions.length?transactions.slice().reverse().map(t=>`
    <div class="cash-date-edit-row" data-cash-edit-row="${esc(t.id)}">
      <div class="cash-date-edit-meta"><strong>${esc(t.merchantNormalized||t.merchantRaw||t.category||'現金支出')}</strong><span>${formatYen(t.amount)}</span></div>
      <div class="muted">${esc(t.category||'未分類')} / 登録月 ${esc(t.month)}</div>
      <div class="cash-date-edit-actions">
        <input type="date" aria-label="${esc(t.merchantNormalized||t.category||'現金支出')}の日付" value="${esc(t.date||'')}" data-cash-edit-date>
        <button type="button" data-cash-edit-save>日付を修正</button>
      </div>
    </div>`).join(''):'<p class="muted">この月に日付修正できる手入力の現金支出はありません。</p>';
}
function isValidCashEditDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
async function saveManualCashDateEdit(button){
  if(button.disabled)return false;
  const row=button.closest('[data-cash-edit-row]');
  const id=row?.getAttribute('data-cash-edit-row');
  const input=row?.querySelector('[data-cash-edit-date]');
  const newDate=input?.value||'';
  if(!id||!isValidCashEditDate(newDate))return toast('正しい日付を指定してください。'),false;
  const t=await DB.get('transactions',id);
  if(!t||t.month!==selectedMonth||t.kind!=='expense'||t.paymentMethod!=='cash'||t.sourceType!=='manual'||n(t.advanceShare)>0||t.ownShare!=null){
    toast('対象取引が変更されています。再読み込みしてください。');return false;
  }
  if(newDate===t.date){toast('日付は変更されていません。');return false;}
  const oldMonth=t.month,newMonth=DB.monthOfDate(newDate);
  if(!confirm(`${formatYen(t.amount)}（${t.merchantNormalized||t.merchantRaw||t.category||'現金支出'}）の取引日を ${t.date} から ${newDate} へ修正しますか？\n月次収支は ${oldMonth} から ${newMonth} に移動します。残高確認済みの資産スナップショットは変更しません。`))return false;
  button.disabled=true;
  try{
    await DB.put('transactions',{...t,date:newDate,month:newMonth,updatedAt:DB.now()});
    const verified=await DB.get('transactions',id);
    if(!verified||verified.date!==newDate||verified.month!==newMonth)throw new Error('保存内容の確認に失敗しました');
    if(oldMonth!==newMonth){
      selectedMonth=newMonth;
      $('globalMonth').value=newMonth;
      $('cashDate').value=dateForSelected();
      $('incomeDate').value=dateForSelected();
      $('rentDate').value=dateForSelected();
      $('advanceDate').value=dateForSelected();
    }
    await renderAll();
    toast('取引日を修正しました。');
    return true;
  }catch(e){
    console.error(e);
    toast('日付の修正に失敗しました: '+e.message);
    return false;
  }finally{button.disabled=false;}
}
function renderBars(id,rows,showDelta){const max=Math.max(1,...rows.map(x=>Math.abs(x.current)));$(id).innerHTML=rows.length?`<div class="bar-list">${rows.map(x=>`<div class="bar-item"><span>${esc(x.key)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.min(100,Math.abs(x.current)/max*100)}%"></span></span><span>${formatYen(x.current)}${showDelta?`<small class="${x.delta<=0?'good':'warn'}"> ${A.formatSigned(x.delta)}</small>`:''}</span></div>`).join('')}</div>`:'<p class="muted">表示できるデータがありません。</p>';}

async function renderData(){const im=(await DB.getAll('cardImports')).sort((a,b)=>(b.importedAt||'').localeCompare(a.importedAt||''));$('importHistory').innerHTML=im.length?im.slice(0,10).map(x=>`<div class="status-row"><div><strong>${esc(x.fileName)}</strong><div class="status-meta">${new Date(x.importedAt).toLocaleString('ja-JP')} / ${esc(x.targetRange||'')}</div></div><div>${x.importedCount}件</div></div>`).join(''):'<p class="muted">取込履歴はありません。</p>';$('appInfo').innerHTML=`<p>App ${DB.APP_VERSION}<br>schemaVersion ${DB.SCHEMA_VERSION}<br>DB ${DB.DB_NAME}</p>`;let info='';try{if(navigator.storage?.estimate){const e=await navigator.storage.estimate();info=`使用量 約${Math.round((e.usage||0)/1024)} KB / 利用可能枠 約${Math.round((e.quota||0)/1024/1024)} MB`;}}catch{}$('storageInfo').textContent=info;}
async function exportBackup(){try{const p=await DB.buildBackup();const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`household_asset_backup_v2_${DB.ymd()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast('バックアップを作成しました。');}catch(e){toast('バックアップ失敗: '+e.message);}}
async function importBackup(file){try{const p=JSON.parse(await file.text());await DB.validateBackup(p);if(!confirm('v0.2の現在データをバックアップ内容で置き換えます。よろしいですか？'))return;await DB.restoreBackup(p);toast('復元しました。');await renderAll();}catch(e){toast('復元できません: '+e.message);}finally{$('backupImport').value='';}}

function openAccountDialog(category='bank'){$('accountCategory').value=category;$('accountDialog').showModal();}
async function addAccountFromDialog(e){e.preventDefault();if(!(await flushMonthEndEdits()))return;const name=$('accountName').value.trim();if(!name)return;const cat=$('accountCategory').value;const all=await DB.getAll('accounts');await DB.put('accounts',{id:DB.uid('acct'),name,category:cat,active:true,sortOrder:Math.max(0,...all.map(x=>n(x.sortOrder)))+10,createdAt:DB.now()});$('accountDialog').close();$('accountName').value='';await renderMonthEnd();await renderHome();}
async function addPointFromDialog(e){e.preventDefault();if(!(await flushMonthEndEdits()))return;const name=$('pointName').value.trim();if(!name)return toast('ポイント名を入力してください。');const all=await DB.getAll('pointAccounts');if(all.some(x=>x.active!==false&&x.name===name))return toast('同じ名前のポイント項目があります。');await DB.put('pointAccounts',{id:DB.uid('point'),name,active:true,sortOrder:Math.max(0,...all.map(x=>n(x.sortOrder)))+10,createdAt:DB.now()});$('pointDialog').close();$('pointName').value='';toast('ポイント項目を追加しました。');await renderMonthEnd();}
async function clearAll(){if(!confirm('v0.2の家計・資産データを全削除します。v0.1旧DBは削除しません。実行しますか？'))return;if(!confirm('元に戻せません。JSONバックアップは保存しましたか？'))return;for(const s of DB.STORES)await DB.clear(s);await DB.seed();toast('v0.2データを削除しました。');await renderAll();}

async function renderAll(){await renderHome();await renderMonthEnd();await renderHistory();await renderData();}
function bind(){
  for(const [id,attr] of [['csvReview','data-review-merchant-name'],['csvMerchantEditList','data-csv-merchant-name']]){
    $(id).oninput=e=>{const input=e.target.closest('['+attr+']');if(input)applyCsvMerchantName(input);};
    $(id).onchange=e=>{const input=e.target.closest('['+attr+']');if(input)applyCsvMerchantName(input,{final:true});};
  }
  $('historyMerchantFilter').oninput=()=>void renderHistoryMerchantEdits();
  $('historyMerchantEditList').onclick=e=>{
    const button=e.target.closest('[data-history-merchant-save]');
    if(button)void saveHistoryMerchantName(button);
  };
  $('historyCashEditList').onclick=e=>{
    const button=e.target.closest('[data-cash-edit-save]');
    if(button)void saveManualCashDateEdit(button);
  };
  $('homeAssetSummary').onclick=e=>{const target=e.target.closest('[data-asset-breakdown]');if(target)void openAssetBreakdown(target.dataset.assetBreakdown);};
  $$('[data-breakdown-mode]').forEach(button=>button.onclick=()=>selectBreakdownMode(button.dataset.breakdownMode,{remember:true}));
  $('assetBreakdownInlineClose').onclick=()=>{assetBreakdownRequestId++;closeInlineBreakdown();};
  selectBreakdownMode(readBreakdownMode());
  $('assetBreakdownClose').onclick=()=>$('assetBreakdownDialog').close();
  $('assetBreakdownDialog').onclick=e=>{if(e.target===$('assetBreakdownDialog'))$('assetBreakdownDialog').close();};
  $$('[data-nav]').forEach(b=>b.onclick=()=>showScreen(b.dataset.nav));$$('[data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.subview)openInputPanel(b.dataset.subview);else showScreen(b.dataset.go);});$$('[data-quick]').forEach(b=>b.onclick=()=>openInputPanel(b.dataset.quick));$$('[data-input-panel]').forEach(b=>b.onclick=()=>openInputPanel(b.dataset.inputPanel));$$('[data-close-panel]').forEach(b=>b.onclick=()=>{if(currentScreen==='input'&&currentPanel)history.back();else b.closest('.input-panel')?.classList.add('hidden');});
  $('globalMonth').onchange=async()=>{assetBreakdownRequestId++;closeInlineBreakdown();if($('assetBreakdownDialog').open)$('assetBreakdownDialog').close();if(currentScreen==='monthend'&&!(await flushMonthEndEdits())){$('globalMonth').value=selectedMonth;return;}selectedMonth=$('globalMonth').value||DB.currentMonth();$('cashDate').value=dateForSelected();$('incomeDate').value=dateForSelected();$('rentDate').value=dateForSelected();$('advanceDate').value=dateForSelected();await renderAll();};
  for(const id of ['cashAmount','incomeAmount','rentAmount'])setupAmountInput($(id));
  setupAmountInput($('advanceTotal'),updateAdvanceCalc);
  setupAmountInput($('advanceOwn'),updateAdvanceCalc);
  $('cashSave').onclick=saveCash;$('incomeSave').onclick=saveIncome;$('rentSave').onclick=saveRent;$('advanceSave').onclick=saveAdvance;
  $$('[data-advance-mode]').forEach(b=>b.onclick=()=>{$$('[data-advance-mode]').forEach(x=>x.classList.toggle('active',x===b));$('advanceNew').classList.toggle('hidden',b.dataset.advanceMode!=='new');$('advanceRepay').classList.toggle('hidden',b.dataset.advanceMode!=='repay');if(b.dataset.advanceMode==='repay')renderOutstanding();else renderManualAdvancePaymentEdits();});
  $('cashCategory').onchange=()=>{$('cashMealWrap').classList.toggle('hidden',$('cashCategory').value!=='食費');};
  $('dcardFile').onchange=e=>{if(e.target.files[0])void handleCsvFile(e.target.files[0]);};$('csvImportButton').onclick=importPreparedCsv;
  $('csvDraftResume').onclick=()=>void resumeCsvDraft();
  $('csvDraftDiscard').onclick=()=>{if(confirm('CSV取込の下書きを破棄しますか？ 正式登録済みの家計データは削除されません。'))void discardCsvDraft();};
  $('addAccountButton').onclick=()=>openAccountDialog('bank');$('addBankButton').onclick=()=>openAccountDialog('bank');$('accountDialog').addEventListener('close',()=>{});$('accountCreate').onclick=addAccountFromDialog;
  $('addPointButton').onclick=()=>$('pointDialog').showModal();$('pointDialog').addEventListener('close',()=>{});$('pointCreate').onclick=addPointFromDialog;
  window.addEventListener('beforeunload',e=>{if(currentScreen==='monthend'&&monthEndInputs().some(x=>x.dataset.dirty==='true'||x._monthEndSave)){e.preventDefault();e.returnValue='';}});
  $('completeMonthButton').onclick=completeMonth;$('backupExport').onclick=exportBackup;$('backupImport').onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);};$('clearAll').onclick=clearAll;
}


/* Optional local screen lock; does not encrypt IndexedDB or JSON backups. */
function lockConfig(){
  try{const raw=localStorage.getItem(LOCK_KEY);return raw?JSON.parse(raw):null;}
  catch(e){console.error('Lock config unreadable',e);return {invalid:true};}
}
function byteHex(bytes){return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function pinDigest(pin,salt,iterations=LOCK_ITERATIONS){
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt.match(/.{2}/g).map(x=>parseInt(x,16))),iterations},key,256);
  return byteHex(new Uint8Array(bits));
}
function secureEquals(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
function clearVisibleRecovery(){
  $('lockRecoveryNotice').classList.add('hidden');
  $('lockRecoveryCode').textContent='';
}
function showNewRecoveryCode(code){
  $('lockRecoveryCode').textContent=code.match(/.{1,6}/g).join('-');
  $('lockRecoveryNotice').classList.remove('hidden');
}
function updateLockSettings(){
  const enabled=!!lockConfig();
  $('lockSettingsStatus').textContent=enabled?'起動ロック：有効（15分間操作がなければ再ロック。保存データの暗号化ではありません）':'起動ロック：無効';
  $('lockEnablePanel').classList.toggle('hidden',enabled);
  $('lockDisablePanel').classList.toggle('hidden',!enabled);
  $('lockNowButton').classList.toggle('hidden',!enabled);
}
function clearUnlockSession(){
  try{sessionStorage.removeItem(LOCK_SESSION_KEY);}catch(e){console.warn('ロック解除状態の削除に失敗',e);}
}
function readUnlockSession(){
  try{
    const session=JSON.parse(sessionStorage.getItem(LOCK_SESSION_KEY)||'null');
    const cfg=lockConfig();
    const now=Date.now();
    if(!cfg||cfg.invalid||!session||session.hash!==cfg.hash||
       !Number.isFinite(session.lastActive)||session.lastActive>now||
       now-session.lastActive>=LOCK_IDLE_MS)return null;
    return session;
  }catch{return null;}
}
function recordUnlockActivity({force=false}={}){
  if(document.hidden||document.body.classList.contains('app-locked')||!lockConfig())return;
  const now=Date.now();
  if(!force&&now-lastRecordedActivity<10000)return;
  if(!force&&!readUnlockSession()){showLock();return;}
  try{
    sessionStorage.setItem(LOCK_SESSION_KEY,JSON.stringify({hash:lockConfig().hash,lastActive:now}));
    lastRecordedActivity=now;
  }catch(e){console.warn('ロック解除状態の保存に失敗',e);}
}
function checkUnlockIdle(){
  if(!lockConfig()||document.body.classList.contains('app-locked'))return;
  if(!readUnlockSession())showLock();
}
function showLock(){
  if(!lockConfig())return;
  clearUnlockSession();
  document.body.classList.add('app-locked');
  $('lockOverlay').classList.remove('hidden');
  $('lockPin').value='';
  $('lockRecoveryInput').value='';
  $('lockRecoveryForm').classList.add('hidden');
  clearVisibleRecovery();
  $('lockError').textContent='';
  $('lockPin').focus();
}
function hideLock(){
  unlockFailures=0;unlockDelayUntil=0;
  document.body.classList.remove('app-locked');
  $('lockOverlay').classList.add('hidden');
  $('lockPin').value='';
  recordUnlockActivity({force:true});
}
async function unlockApp(e){
  e.preventDefault();
  if(Date.now()<unlockDelayUntil)return $('lockError').textContent='しばらくしてから再試行してください。';
  const cfg=lockConfig();
  if(!cfg||cfg.invalid||!cfg.salt||!cfg.hash)return $('lockError').textContent='ロック設定を読み込めません。';
  try{
    const candidate=await pinDigest($('lockPin').value,cfg.salt,cfg.iterations);
    if(secureEquals(candidate,cfg.hash)){hideLock();return;}
    unlockFailures++;
    if(unlockFailures>=5){unlockDelayUntil=Date.now()+30000;unlockFailures=0;}
    $('lockError').textContent='PINが違います。'+(unlockDelayUntil>Date.now()?'30秒後に再試行できます。':'');
    $('lockPin').value='';
  }catch(err){$('lockError').textContent='認証処理に失敗しました。';console.error(err);}
}
async function enableLock(e){
  e.preventDefault();
  const pin=$('lockNewPin').value,confirmation=$('lockConfirmPin').value;
  if(!/^\d{6,12}$/.test(pin))return toast('PINは数字6〜12桁で入力してください。');
  if(pin!==confirmation)return toast('確認用PINが一致しません。');
  if(!crypto.subtle||!crypto.getRandomValues)return toast('この環境では安全なPIN設定ができません。');
  try{
    const salt=byteHex(crypto.getRandomValues(new Uint8Array(16)));
    const hash=await pinDigest(pin,salt);
    const recoveryCode=byteHex(crypto.getRandomValues(new Uint8Array(12)));
    const recoverySalt=byteHex(crypto.getRandomValues(new Uint8Array(16)));
    const recoveryHash=await pinDigest(recoveryCode,recoverySalt);
    localStorage.setItem(LOCK_KEY,JSON.stringify({salt,hash,iterations:LOCK_ITERATIONS,recoverySalt,recoveryHash}));
    clearUnlockSession();
    showNewRecoveryCode(recoveryCode);
    $('lockNewPin').value='';$('lockConfirmPin').value='';
    updateLockSettings();toast('起動ロックを有効にしました。');
  }catch(err){toast('設定に失敗しました: '+err.message);}
}
async function disableLock(e){
  e.preventDefault();
  const cfg=lockConfig();
  if(!cfg||cfg.invalid)return toast('ロック設定を確認できません。');
  try{
    if(!secureEquals(await pinDigest($('lockDisablePin').value,cfg.salt,cfg.iterations),cfg.hash))return toast('PINが違います。');
    localStorage.removeItem(LOCK_KEY);clearUnlockSession();$('lockDisablePin').value='';
    clearVisibleRecovery();
    updateLockSettings();toast('起動ロックを解除しました。');
  }catch(err){toast('解除に失敗しました。');}
}
async function regenerateRecovery(e){
  e.preventDefault();
  const cfg=lockConfig();
  if(!cfg?.salt||!cfg.hash||!cfg.iterations)return toast('ロック設定が読み込めません。');
  if(Date.now()<unlockDelayUntil)return toast('しばらくしてから再試行してください。');
  try{
    const entered=$('lockRegeneratePin').value;
    const digest=await pinDigest(entered,cfg.salt,cfg.iterations);
    $('lockRegeneratePin').value='';
    if(!secureEquals(digest,cfg.hash)){
      unlockFailures++;
      if(unlockFailures>=5){unlockDelayUntil=Date.now()+30000;unlockFailures=0;}
      return toast('PINが違います。');
    }
    const recoveryCode=byteHex(crypto.getRandomValues(new Uint8Array(12)));
    const recoverySalt=byteHex(crypto.getRandomValues(new Uint8Array(16)));
    const recoveryHash=await pinDigest(recoveryCode,recoverySalt,cfg.iterations);
    localStorage.setItem(LOCK_KEY,JSON.stringify({...cfg,recoverySalt,recoveryHash}));
    unlockFailures=0;unlockDelayUntil=0;
    showNewRecoveryCode(recoveryCode);
    $('lockRecoveryNotice').scrollIntoView({behavior:'smooth',block:'center'});
    toast('復旧コードを再発行しました。必ず控えてください。');
  }catch(err){toast('復旧コードの再発行に失敗しました。');console.error(err);}
}
async function recoverLock(e){
  e.preventDefault();
  const cfg=lockConfig();
  if(!cfg?.recoveryHash||!cfg.recoverySalt)return $('lockError').textContent='復旧コードが設定されていません。';
  if(Date.now()<unlockDelayUntil)return $('lockError').textContent='しばらくしてから再試行してください。';
  const code=$('lockRecoveryInput').value.replace(/[^0-9a-f]/gi,'').toLowerCase();
  try{
    if(!secureEquals(await pinDigest(code,cfg.recoverySalt,cfg.iterations),cfg.recoveryHash)){
      unlockFailures++;
      if(unlockFailures>=5){unlockDelayUntil=Date.now()+30000;unlockFailures=0;}
      $('lockError').textContent='復旧コードが違います。';
      return;
    }
    if(!confirm('起動ロックのみ解除します。家計データは削除されません。よろしいですか？'))return;
    localStorage.removeItem(LOCK_KEY);clearUnlockSession();
    $('lockRecoveryInput').value='';
    $('lockRecoveryForm').classList.add('hidden');
    hideLock();updateLockSettings();toast('起動ロックを解除しました。必要なら新しいPINを設定してください。');
  }catch(err){$('lockError').textContent='復旧処理に失敗しました。';console.error(err);}
}
function setupLock(){
  $('lockUnlockForm').onsubmit=unlockApp;
  $('lockEnableForm').onsubmit=enableLock;
  $('lockDisableForm').onsubmit=disableLock;
  $('lockNowButton').onclick=showLock;
  $('lockRecoveryForm').onsubmit=recoverLock;
  $('lockRegenerateForm').onsubmit=regenerateRecovery;
  $('lockRecoveryAcknowledged').onclick=clearVisibleRecovery;
  $('lockRecoveryToggle').onclick=()=>{const form=$('lockRecoveryForm');form.classList.toggle('hidden');if(!form.classList.contains('hidden'))$('lockRecoveryInput').focus();};
  for(const type of ['pointerdown','keydown']){
    document.addEventListener(type,()=>recordUnlockActivity(),{passive:true});
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUnlockIdle();});
  window.addEventListener('pageshow',()=>checkUnlockIdle());
  lockIdleTimer=setInterval(checkUnlockIdle,15000);
  updateLockSettings();
  if(lockConfig()){
    if(readUnlockSession()){
      document.body.classList.remove('app-locked');
      $('lockOverlay').classList.add('hidden');
    }else showLock();
  }else clearUnlockSession();
}

async function init(){
  try{
    await DB.open();await DB.seed();selectedMonth=DB.currentMonth();$('globalMonth').value=selectedMonth;fillCategorySelect($('cashCategory'));fillMealSelect($('cashMealType'));$('cashDate').value=dateForSelected();$('incomeDate').value=dateForSelected();$('rentDate').value=dateForSelected();$('advanceDate').value=dateForSelected();await renderCashPresets();await renderRentDefaults();bind();setupNavigationHistory();await renderAll();await refreshCsvDraftControls();setupLock();document.body.classList.remove('app-booting');
    if(location.protocol==='https:'||location.hostname==='localhost') navigator.serviceWorker?.register('service-worker.js',{updateViaCache:'none'}).catch(()=>{});
  }catch(e){console.error(e);document.body.classList.remove('app-booting');document.body.innerHTML=`<main><div class="card"><h1>起動エラー</h1><p>${esc(e.message)}</p></div></main>`;}
}
init();
})(window);
