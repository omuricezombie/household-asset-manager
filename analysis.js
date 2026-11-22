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


  async function annualCumulative(month){
    const year=String(month||'').slice(0,4),end=Number(String(month||'').slice(5,7));
    if(!/^\d{4}$/.test(year)||!Number.isInteger(end)||end<1||end>12)throw new Error('対象月が正しくありません。');
    const months=Array.from({length:end},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
    let income=0,expense=0,normal=0,temporary=0;
    const categories={},incomeCategories={},monthRows=[];
    for(const m of months){
      const data=await monthTransactions(m);
      let monthIncome=0,monthExpense=0,hasEntries=data.some(t=>t.kind==='income'||t.kind==='expense'||t.kind==='refund');
      for(const t of data){
        if(t.kind==='income'){const amount=num(t.amount);income+=amount;monthIncome+=amount;const kind=t.subCategory||t.category||'その他';incomeCategories[kind]=(incomeCategories[kind]||0)+amount;}
        else if(t.kind==='expense'){
          const amount=effExpense(t);expense+=amount;monthExpense+=amount;
          if(t.isTemporaryExpense)temporary+=amount;else normal+=amount;
          const cat=t.category||'未分類';categories[cat]=(categories[cat]||0)+amount;
        }else if(t.kind==='refund'){
          const amount=refundAmount(t);expense-=amount;normal-=amount;monthExpense-=amount;
          const cat=t.category||'未分類';categories[cat]=(categories[cat]||0)-amount;
        }
      }
      monthRows.push({month:m,income:monthIncome,expense:monthExpense,hasEntries});
    }
    return {year,throughMonth:month,income,expense,normal,temporary,saving:income-expense,categories,incomeCategories,monthRows,
      monthsWithEntries:monthRows.filter(m=>m.hasEntries).length,monthsCount:months.length};
  }
  // A d-card billing cycle closes on the 15th, covering the prior 16th through
  // that day. Statements are identified by the actual paymentDate supplied in CSV.
  // These are coverage indicators, not proof that every individual transaction posted.
  function cardCycleForClose(closeMonth){
    const [y,m]=closeMonth.split('-').map(Number);
    const payment=new Date(y,m,10); // month after the close month, day 10
    const paymentMonth=payment.getFullYear()+'-'+String(payment.getMonth()+1).padStart(2,'0');
    return {closeMonth,paymentMonth,paymentDate:paymentMonth+'-10'};
  }
  function nextMonth(month){
    const [year,mon]=month.split('-').map(Number),d=new Date(year,mon,1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  }
  function cardCoverage(month,imports,today=DB().ymd()){
    const periods=[month,nextMonth(month)].map(cardCycleForClose);
    const checks=periods.map(x=>{
      const imported=(imports||[]).some(i=>String(i.paymentDate||'').slice(0,7)===x.paymentMonth);
      // Even after the 15th, the billing CSV may not yet have been issued.
      const closed=today>=x.closeMonth+'-15';
      return {...x,imported,closed,phase:imported?'imported':closed?'not-imported':'not-closed'};
    });
    return {month,checks,complete:checks.every(x=>x.imported),pending:checks.some(x=>!x.imported&&!x.closed),
      missing:checks.some(x=>!x.imported&&x.closed)};
  }
  async function householdQualityReport(throughMonth){
    const year=String(throughMonth).slice(0,4),last=Number(String(throughMonth).slice(5,7));
    const all=await DB().getAll('transactions'),imports=await DB().getAll('cardImports');
    const today=DB().ymd(),results=[];
    for(let m=1;m<=last;m++){
      const month=year+'-'+String(m).padStart(2,'0'),tx=all.filter(t=>t.month===month);
      const coverage=cardCoverage(month,imports,today);
      const unclassified=tx.filter(t=>(t.kind==='refund'||(t.kind==='expense'&&!t.isOtherPersonExpense))&&(!t.category||t.category==='未分類'));
      const income=tx.some(t=>t.kind==='income'),rent=tx.some(t=>t.kind==='expense'&&t.category==='家賃');
      const expense=tx.filter(t=>t.kind==='expense').reduce((sum,t)=>sum+effExpense(t),0)
        -tx.filter(t=>t.kind==='refund').reduce((sum,t)=>sum+refundAmount(t),0);
      const remittance=tx.filter(t=>t.kind==='expense'&&t.category==='仕送り').reduce((sum,t)=>sum+effExpense(t),0)
        -tx.filter(t=>t.kind==='refund'&&t.category==='仕送り').reduce((sum,t)=>sum+refundAmount(t),0);
      const refresh=tx.filter(t=>t.kind==='expense'&&t.category==='リフレッシュ費').reduce((sum,t)=>sum+effExpense(t),0)
        -tx.filter(t=>t.kind==='refund'&&t.category==='リフレッシュ費').reduce((sum,t)=>sum+refundAmount(t),0);
      const rentAmount=tx.filter(t=>t.kind==='expense'&&t.category==='家賃').reduce((sum,t)=>sum+effExpense(t),0);
      const valid=coverage.complete&&income&&rent&&!unclassified.length;
      results.push({month,coverage,unclassified:unclassified.length,income,rent,expense,remittance,refresh,rentAmount,
        otherExpense:expense-remittance-refresh,
        sampleEligible:valid,transactionCount:tx.length});
    }
    return {throughMonth,rows:results,sample:results.filter(r=>r.sampleEligible)};
  }
  function livingExpenseAnalysis(report){
    const sample=report.sample||[],size=sample.length;
    const mean=key=>size?sample.reduce((s,r)=>s+num(r[key]),0)/size:null;
    const median=key=>{
      if(!size)return null;
      const values=sample.map(r=>num(r[key])).sort((a,b)=>a-b);
      return size%2?values[(size-1)/2]:(values[size/2-1]+values[size/2])/2;
    };
    return {months:size,monthsList:sample.map(r=>r.month),average:mean('expense'),median:median('expense'),
      otherAverage:mean('otherExpense'),otherMedian:median('otherExpense'),
      rentAverage:mean('rentAmount'),remittanceAverage:mean('remittance'),refreshAverage:mean('refresh')};
  }

  async function bankBalanceDelta(month){
    const previous=DB().prevMonth(month);
    const accounts=(await DB().getAll('accounts')).filter(a=>a.active!==false&&a.category==='bank');
    const rows=[];
    for(const account of accounts){
      const current=await DB().get('assetSnapshots',[month,account.id]);
      const prior=await DB().get('assetSnapshots',[previous,account.id]);
      // Missing snapshots cannot be counted as zero or as a completed comparison.
      rows.push({id:account.id,name:account.name,current:current?.confirmed?num(current.value):null,previous:prior?.confirmed?num(prior.value):null});
    }
    // The same registered bank accounts must have confirmed balances at both month ends.
    // Carried-forward balances never qualify as evidence of actual savings.
    const complete=rows.length>0&&rows.every(x=>x.current!==null&&x.previous!==null);
    const current=complete?rows.reduce((v,x)=>v+x.current,0):null;
    const prior=complete?rows.reduce((v,x)=>v+x.previous,0):null;
    return {month,previous,available:complete,current,prior,delta:complete?current-prior:null,rows,
      reason:rows.length?'前月と当月の両方で銀行月末残高の確認が必要です。':'比較できる銀行の月末残高がありません。'};
  }

  async function stockYearComparison(month){
    const year=Number(month.slice(0,4)),mon=month.slice(5,7);
    const previous=String(year-1)+'-'+mon;
    const accounts=(await DB().getAll('accounts')).filter(a=>a.active!==false&&a.category==='stock');
    if(!accounts.length)return {available:false,previous,reason:'株式の資産項目がありません。'};
    let current=0,prior=0;
    for(const account of accounts){
      const now=await DB().get('assetSnapshots',[month,account.id]);
      const before=await DB().get('assetSnapshots',[previous,account.id]);
      if(!now?.confirmed||!before?.confirmed)return {available:false,previous,reason:'当月と前年同月の株式評価額の両方を確認済みにすると比較できます。'};
      current+=num(now.value);prior+=num(before.value);
    }
    return {available:true,previous,current,prior,delta:current-prior,rate:prior>0?(current-prior)/prior*100:null};
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
  // Forward-looking insights use comparable historical full-month data, not
  // simple day-of-month multiplication of imported card transactions.
  // CSV files can arrive weeks after purchase: never imply a green forecast
  // unless the card cycle through today is represented by an imported file.
  async function spendingOutlook(month){
    const currentMonth=DB().currentMonth();
    const cur=await summary(month);
    const out={month,actual:cur.normal,baseline:null,forecast:null,remaining:null,
      sampleMonths:[],coveredToDate:false,reason:null,isCurrent:month===currentMonth};
    const imports=await DB().getAll('cardImports');
    const today=DB().ymd();
    const sample=[];
    let cursor=DB().prevMonth(month);
    for(let i=0;i<12&&sample.length<3;i++){
      const m=cursor;
      const tx=await monthTransactions(m);
      const complete=cardCoverage(m,imports,today).complete;
      // Keep the existing household data-quality safeguards but do not require
      // a salary (e.g. after retirement) to compare expense patterns.
      const unclassified=tx.some(t=>t.kind==='expense'&&!t.isOtherPersonExpense&&(!t.category||t.category==='未分類'));
      if(complete&&tx.some(t=>t.kind==='expense')&&!unclassified){
        const normal=tx.filter(t=>t.kind==='expense'&&!t.isTemporaryExpense)
          .reduce((v,t)=>v+effExpense(t),0)
          -tx.filter(t=>t.kind==='refund').reduce((v,t)=>v+refundAmount(t),0);
        sample.push({month:m,normal,tx});
      }
      cursor=DB().prevMonth(cursor);
    }
    if(sample.length<3){out.reason='比較可能な過去月が3か月未満です。';return out;}
    out.sampleMonths=sample.map(x=>x.month);
    out.baseline=sample.reduce((v,x)=>v+x.normal,0)/sample.length;
    out.remaining=out.baseline-cur.normal;
    if(!out.isCurrent)return out;
    const day=Number(today.slice(8,10));
    const lastDay=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
    // No "future days" after month-end; the remaining-data issue still applies.
    const cut=Math.min(day,lastDay);
    const remainingAvg=sample.reduce((v,x)=>{
      const after=x.tx.filter(t=>Number(String(t.date||'').slice(8,10))>cut);
      const future=after.filter(t=>t.kind==='expense'&&!t.isTemporaryExpense)
        .reduce((sum,t)=>sum+effExpense(t),0)
        -after.filter(t=>t.kind==='refund').reduce((sum,t)=>sum+refundAmount(t),0);
      return v+future;
    },0)/sample.length;
    // The forecast is a *conditional* scenario, not a full-coverage total.
    out.forecast=cur.normal+remainingAvg;
    const cc=cardCoverage(month,imports,today);
    out.coveredToDate=cc.checks.slice(0,day<=15?1:2).every(x=>x.imported);
    if(!out.coveredToDate)out.reason='当日までのdカード利用を含む請求CSVが未登録です。';
    return out;
  }
  async function insights(month){
    const outlook=await spendingOutlook(month);
    const cur=await summary(month);
    const out=[];
    if(outlook.baseline!=null){
      const baseline=formatYen(Math.round(outlook.baseline));
      const delta=outlook.actual-outlook.baseline;
      out.push({tone:'neutral',text:`通常支出の比較基準は直近の比較可能な3か月平均 ${baseline} です（${outlook.sampleMonths.join('・')}）。`});
      if(outlook.actual>outlook.baseline){
        out.push({tone:'warn',text:`登録済み通常支出は、既に基準平均を ${formatYen(Math.round(delta))} 上回っています。`});
      }else{
        out.push({tone:'neutral',text:`登録済み通常支出は基準平均まであと ${formatYen(Math.round(-delta))} です。未登録の支出があれば実際の余裕は小さくなります。`});
      }
      if(outlook.isCurrent&&outlook.forecast!=null){
        const estimate=formatYen(Math.round(outlook.forecast));
        if(outlook.coveredToDate){
          const gap=outlook.forecast-outlook.baseline;
          const result=gap>0?`基準平均を約 ${formatYen(Math.round(gap))} 上回る`:`基準平均を約 ${formatYen(Math.round(-gap))} 下回る`;
          out.push({tone:gap>0?'warn':'good',text:`月末の参考見込みは ${estimate}、${result} 計算です。過去3か月の同日以降の支出を使用した推計です。`});
        }else{
          const change=outlook.forecast-outlook.baseline;
          const comparison=change>0?`平均より約 ${formatYen(Math.round(change))} 高い`:`平均より約 ${formatYen(Math.round(-change))} 低い`;
          out.push({tone:'neutral',text:`月末の条件付き試算は ${estimate}（${comparison}計算）です。ただし、${outlook.reason} 平均を超える・超えないの見通しは未確定です。`});
        }
      }else if(!outlook.isCurrent){
        out.push({tone:'neutral',text:'過去月のため予測は行わず、登録済み実績を表示しています。'});
      }
    }else{
      out.push({tone:'neutral',text:outlook.reason||'比較可能な月が不足しています。'});
    }
    const prev=await summary(DB().prevMonth(month));
    // Historical facts are context, never an end-of-month prediction.
    if(!outlook.isCurrent){
      const delta=cur.normal-prev.normal;
      if(prev.transactions.some(t=>t.kind==='expense'))
        out.push({tone:delta<=0?'good':'warn',text:`通常支出の前月比は ${formatSigned(delta)} です。`});
    }
    return out;
  }
  function formatYen(n){return new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(num(n));}
  function formatSigned(n){const v=num(n);return `${v>0?'+':''}${formatYen(v)}`;}

  HAM.Analysis={monthTransactions,summary,annualCumulative,householdQualityReport,livingExpenseAnalysis,cardCoverage,assetSummary,bankBalanceDelta,stockYearComparison,liveCashBalance,cashMovementAmount,outstandingAdvances,pointTotal,paymentPlansUpcoming,objDiff,threeMonthAverage,spendingOutlook,insights,formatYen,formatSigned,effExpense};
})(window);
