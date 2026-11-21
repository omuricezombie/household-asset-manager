(function(global){
  'use strict';
  const HAM=global.HAM=global.HAM||{};
  const DB=()=>HAM.DB;
  const num=v=>Number(v)||0;
  const effExpense=t=>t.kind==='expense'?(t.isOtherPersonExpense?0:(t.ownShare==null?num(t.amount):num(t.ownShare))):0;
  const refundAmount=t=>t.kind==='refund'?num(t.amount):0;

  function cashMovementAmount(t){
    if(!t||t.paymentMethod!=='cash')return 0;
    if(t.kind==='expense')return -num(t.amount);
    if(['refund','income','advance_repayment'].includes(t.kind))return num(t.amount);
    if(t.kind==='transfer'){
      if(t.toAccountId==='cash-wallet')return num(t.amount);
      if(t.fromAccountId==='cash-wallet')return -num(t.amount);
    }
    return 0;
  }
  async function liveCashBalance(month=DB().currentMonth(),accountId='cash-wallet'){
    const snapshot=await DB().latestSnapshot(accountId,month);
    if(!snapshot)return {value:null,baseValue:null,movement:0,snapshot:null,movements:[],isEstimated:false};
    const baseValue=num(snapshot.value);
    if(month!==DB().currentMonth())return {value:baseValue,baseValue,movement:0,snapshot,movements:[],isEstimated:false};
    const cutoff=snapshot.updatedAt||snapshot.confirmedAt||'';
    if(!cutoff)return {value:baseValue,baseValue,movement:0,snapshot,movements:[],isEstimated:false};
    // Past-month entries added today must not be deducted from the current wallet.
    // A snapshot for the current month represents cash actually confirmed on its
    // recorded day; earlier dated entries are already included in that balance.
    // For a prior-month snapshot the next month's cash activity starts afresh.
    const confirmedDate=snapshot.month===month?DB().ymd(new Date(cutoff)):null;
    const all=await DB().getAll('transactions');
    const movements=all.filter(t=>{
      const amount=cashMovementAmount(t);
      if(!amount||t.month!==month||!t.date)return false;
      if(!t.createdAt||t.createdAt<=cutoff)return false;
      if(confirmedDate&&t.date<confirmedDate)return false;
      return true;
    }).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
    const movement=movements.reduce((s,t)=>s+cashMovementAmount(t),0);
    return {value:baseValue+movement,baseValue,movement,snapshot,movements,isEstimated:movement!==0};
  }

  async function monthTransactions(month){return (await DB().getAllByIndex('transactions','month',month)).sort((a,b)=>(a.date||'').localeCompare(b.date||''));}
  async function summary(month){
    const tx=await monthTransactions(month);
    let income=0,expense=0,normal=0,temporary=0,refund=0,transfer=0;
    const categories={},merchants={},meals={breakfast:0,lunch:0,dinner:0,snack:0,other:0,unclassified:0};
    for(const t of tx){
      if(t.kind==='income') income+=num(t.amount);
      if(t.kind==='expense'){
        const e=effExpense(t);expense+=e;if(t.isTemporaryExpense)temporary+=e;else normal+=e;
        const c=t.category||'未分類';categories[c]=(categories[c]||0)+e;
        const m=t.merchantNormalized||t.merchantRaw||'';if(m)merchants[m]=(merchants[m]||0)+e;
        if(c==='食費'){const key=t.mealType||'unclassified';meals[key]=(meals[key]||0)+e;}
      }
      if(t.kind==='refund'){refund+=refundAmount(t);expense-=refundAmount(t);normal-=refundAmount(t);const c=t.category||'未分類';categories[c]=(categories[c]||0)-refundAmount(t);}
      if(t.kind==='transfer')transfer+=num(t.amount);
    }
    const assets=await assetSummary(month);
    return {month,income,expense,normal,temporary,refund,transfer,saving:income-expense,categories,merchants,meals,assets,transactions:tx};
  }
  async function assetSummary(month){
    const accounts=(await DB().getAll('accounts')).filter(x=>x.active!==false);let total=0,liquid=0;const rows=[];
    for(const a of accounts){
      const s=await DB().latestSnapshot(a.id,month);
      const live=a.id==='cash-wallet'?await liveCashBalance(month,a.id):null;
      const value=live&&live.value!=null?num(live.value):(s?num(s.value):0);
      rows.push({account:a,snapshot:s,value,liveCash:live});
      total+=value;if(['bank','cash'].includes(a.category))liquid+=value;
    }
    return {total,liquid,rows};
  }
  async function outstandingAdvances(){
    const all=await DB().getAll('transactions');
    const advances=all.filter(x=>['expense','advance_pending','advance_linked'].includes(x.kind)&&num(x.advanceShare)>0&&!(x.kind==='expense'&&x.advanceRecordId));
    const repayments=all.filter(x=>x.kind==='advance_repayment');
    return advances.map(a=>{const paid=repayments.filter(r=>r.linkedTransactionId===a.id).reduce((s,r)=>s+num(r.amount),0);return {...a,repaidAmount:paid,outstanding:Math.max(0,num(a.advanceShare)-paid)};}).filter(x=>x.outstanding>0);
  }
  async function pointTotal(month){const pa=(await DB().getAll('pointAccounts')).filter(x=>x.active!==false);let total=0;const rows=[];for(const p of pa){const s=await DB().latestPointSnapshot(p.id,month);const value=s?num(s.value):0;total+=value;rows.push({account:p,snapshot:s,value});}return {total,rows};}
  async function paymentPlansUpcoming(fromDate=DB().ymd()){const all=await DB().getAll('paymentPlans');return all.filter(x=>['planned','reserved'].includes(x.status)&&(!x.dueDate||x.dueDate>=fromDate)).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));}
  function objDiff(cur,prev){const keys=new Set([...Object.keys(cur||{}),...Object.keys(prev||{})]);return [...keys].map(k=>({key:k,current:num(cur?.[k]),previous:num(prev?.[k]),delta:num(cur?.[k])-num(prev?.[k])})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));}
  async function threeMonthAverage(month,field='expense'){
    const months=[];let m=DB().prevMonth(month);for(let i=0;i<3;i++){months.push(m);m=DB().prevMonth(m);}
    const sums=[];
    for(const x of months){
      const s=await summary(x);
      const hasData=['expense','normal','temporary'].includes(field)
        ? s.transactions.some(t=>t.kind==='expense'||t.kind==='refund')
        : s.transactions.length>0;
      if(hasData)sums.push(num(s[field]));
    }
    return sums.length===3?sums.reduce((a,b)=>a+b,0)/3:null;
  }
  async function insights(month){
    const cur=await summary(month),prev=await summary(DB().prevMonth(month));const avg=await threeMonthAverage(month,'normal');const out=[];
    const nd=cur.normal-prev.normal;
    if(prev.expense||prev.income) out.push({tone:nd<=0?'good':'warn',text:`通常支出は前月比 ${formatSigned(nd)} です。`});
    if(avg!=null){const d=cur.normal-avg;out.push({tone:d<=0?'good':'warn',text:`通常支出は直近3か月平均比 ${formatSigned(d)} です。`});}
    const cats=objDiff(cur.categories,prev.categories).filter(x=>x.key!=='未分類'&&x.delta!==0).slice(0,2);
    cats.forEach(x=>out.push({tone:x.delta<=0?'good':'warn',text:`${x.key}は前月比 ${formatSigned(x.delta)} です。`}));
    const merch=objDiff(cur.merchants,prev.merchants).filter(x=>x.delta>0).slice(0,1);merch.forEach(x=>out.push({tone:'warn',text:`${x.key}の利用が前月より ${formatYen(x.delta)} 増えています。`}));
    return out.slice(0,5);
  }
  function formatYen(n){return new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(num(n));}
  function formatSigned(n){const v=num(n);return `${v>0?'+':''}${formatYen(v)}`;}

  HAM.Analysis={monthTransactions,summary,assetSummary,liveCashBalance,cashMovementAmount,outstandingAdvances,pointTotal,paymentPlansUpcoming,objDiff,threeMonthAverage,insights,formatYen,formatSigned,effExpense};
})(window);
