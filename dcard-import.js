(function(global){
  'use strict';
  const HAM=global.HAM=global.HAM||{};
  const DB=()=>HAM.DB;

  function parseCsv(text){
    text=String(text||'').replace(/^\uFEFF/,'');
    const rows=[];let row=[],cell='',q=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(q){
        if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}
        else if(c==='"')q=false;
        else cell+=c;
      }else{
        if(c==='"')q=true;
        else if(c===','){row.push(cell);cell='';}
        else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
        else cell+=c;
      }
    }
    if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
    return rows;
  }
  function blankRow(r){return !r.some(x=>String(x||'').trim());}
  function normText(v){return String(v??'').normalize('NFKC').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();}
  function parseMoney(v){const s=normText(v).replace(/,/g,'').replace(/[￥¥円]/g,'');if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null;}
  function parseDate(v){const s=normText(v);const m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T]+\d{1,2}:\d{2}(?::\d{2})?)?$/);if(!m)return null;const y=Number(m[1]),mo=Number(m[2]),day=Number(m[3]);const dt=new Date(y,mo-1,day);if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==day)return null;return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;}
  function parseTime(v){const s=normText(v);const m=s.match(/(?:^|[ T])(\d{1,2}):(\d{2})(?::\d{2})?$/);if(!m)return null;const h=Number(m[1]),mi=Number(m[2]);if(h>23||mi>59)return null;return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;}
  function inferPaymentMethod(raw){const s=normText(raw);if(/^d払いB?\//i.test(s))return 'dbarai';if(/\/iD(?:\s|$)/i.test(s)||/／ｉＤ/.test(String(raw)))return 'id';return 'dcard';}
  function normalizeMerchant(raw){let s=normText(raw);s=s.replace(/^d払いB?\//i,'');s=s.replace(/\/iD(?:\s|$)/i,'');return s.trim();}
  function basicCategory(merchant){
    const m=normText(merchant).toLowerCase();
    const has=(arr)=>arr.some(k=>m.includes(k.toLowerCase()));
    if(has(['ファミリーマート','ローソン','セブン','マクドナルド','オフィスグリコ','松屋','吉野家','すき家','モスバーガー','ケンタッキー','スターバックス','ドトール','自販機'])) return '食費';
    // Narrow keywords only: generic marketplaces, department stores and drugstores stay unclassified.
    if(has(['病院','クリニック','歯科','医院','調剤薬局'])) return '医療';
    if(has(['ユニクロ','uniqlo','ジーユー','guオンラインストア','しまむら','無印良品 衣料'])) return '衣料費';
    if(has(['美容室','ヘアサロン','理容室','ヘアカット','qbハウス'])) return '美容費';
    if(has(['ヤマダデンキ','ケーズデンキ','エディオン','ノジマ電気'])) return '家電';
    if(has(['book☆walker','book walker','bookwalker','コミック','ebookjapan'])) return '漫画・本';
    if(has(['放送大学','模試','受験料','受講料','検定料'])) return '教育費';
    if(has(['chatgpt','openai','u-next','unext','netflix','dアニメ','lemino','spotify','youtube premium','amazon prime','prime video'])) return 'サブスク';
    if(has(['ドコモご利用料金','nttファイナンス','東京電力','東京ガス','水道料金'])) return '通信・光熱費';
    if(has(['suicaチャージ','モバイルsuica'])) return '交通費';
    if(has(['コインランドリー'])) return '洗濯';
    return '未分類';
  }
  function basicMealType(merchant){return /自販機|オフィスグリコ/i.test(normText(merchant))?'snack':null;}
  function headerIndex(rows){
    const req=['ご利用年月日','利用店名','利用金額','支払い金額','支払区分','今回回数','摘要'];
    for(let i=0;i<Math.min(rows.length,15);i++){const n=rows[i].map(normText);if(req.every(x=>n.includes(x)))return {row:i,header:n};}
    return null;
  }
  function summaryRow(obj){return !obj.date&&!obj.merchantRaw&&obj.useAmount==null&&obj.paymentAmount!=null;}
  function detectPaymentDate(filename){const m=String(filename||'').match(/(?:^|_)(20\d{6})(?:\D|$)/);if(!m)return null;const s=m[1],y=+s.slice(0,4),mo=+s.slice(4,6),d=+s.slice(6,8);const dt=new Date(y,mo-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return null;return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;}
  async function fingerprint(row){return DB().sha256Text([row.date||'',row.time||'',row.merchantRaw||'',row.useAmount??'',row.paymentAmount??'',row.paymentType||'',row.installmentCount||'',row.note||''].join('\u241F'));}

  async function normalizeCsv(text,filename=''){
    const rows=parseCsv(text);const hi=headerIndex(rows);if(!hi)throw new Error('dカードCSVのヘッダーを確認できませんでした。');
    const idx={};hi.header.forEach((h,i)=>idx[h]=i);
    const timeHeader=['利用時刻','ご利用時刻','時刻'].find(h=>idx[h]!=null);
    const raw=[],excludedRows=[];let statementAmount=null,inCashAdvanceSection=false;
    for(let i=hi.row+1;i<rows.length;i++){
      if(blankRow(rows[i]))continue;
      const r=rows[i],joined=r.map(normText).join(' ');
      if(joined.includes('キャッシングご返済明細')){inCashAdvanceSection=true;excludedRows.push({sourceLine:i+1,reason:'キャッシング返済明細'});continue;}
      if(inCashAdvanceSection){excludedRows.push({sourceLine:i+1,reason:'キャッシング返済明細'});continue;}
      // Statement tax notes are informational, not card transactions.
      const compact=joined.replace(/\s+/g,'');
      if(!parseDate(r[idx['ご利用年月日']]) && /カードご利用以外での(?:消費税10%対象の合計|10%消費税額)/.test(compact)){
        excludedRows.push({sourceLine:i+1,reason:'カード利用以外の消費税参考情報'});continue;
      }
      // Card-plan guidance line; not a transaction or a tax/payment total.
      if(!parseDate(r[idx['ご利用年月日']])
        && !normText(r[idx['利用店名']])
        && parseMoney(r[idx['利用金額']])==null
        && /dカードGOLDまたはdカード/i.test(compact)){
        excludedRows.push({sourceLine:i+1,reason:'dカードに関する案内文'});continue;
      }
      const obj={
        sourceLine:i+1,
        date:parseDate(r[idx['ご利用年月日']]),
        time:parseTime(timeHeader?r[idx[timeHeader]]:r[idx['ご利用年月日']]),
        merchantRaw:normText(r[idx['利用店名']]),
        useAmount:parseMoney(r[idx['利用金額']]),
        paymentAmount:parseMoney(r[idx['支払い金額']]),
        paymentType:normText(r[idx['支払区分']]),
        installmentCount:normText(r[idx['今回回数']]),
        note:normText(r[idx['摘要']])
      };
      if(summaryRow(obj)){statementAmount=obj.paymentAmount;continue;}
      if(!obj.date||!obj.merchantRaw||obj.useAmount==null){raw.push({...obj,invalid:true,reason:'必須項目不足'});continue;}
      obj.paymentMethod=inferPaymentMethod(obj.merchantRaw);
      obj.merchantNormalized=normalizeMerchant(obj.merchantRaw);
      obj.category=basicCategory(obj.merchantNormalized);
      obj.mealType=basicMealType(obj.merchantNormalized);
      obj.kind=obj.useAmount<0?'refund':'expense';
      obj.amount=Math.abs(obj.useAmount);
      raw.push(obj);
    }
    const occurrence=new Map();
    for(const r of raw){
      if(r.invalid)continue;
      r.rowFingerprint=await fingerprint(r);
      const n=(occurrence.get(r.rowFingerprint)||0)+1;occurrence.set(r.rowFingerprint,n);r.occurrence=n;r.sourceRowKey=`dcard:${r.rowFingerprint}:${n}`;
    }
    return {rows:raw,excludedRows,statementAmount,paymentDate:detectPaymentDate(filename),headerRow:hi.row+1};
  }

  async function prepareFile(file,rules=[]){
    const buf=await file.arrayBuffer();const fileHash=await DB().sha256Bytes(buf);let parsed=null,lastErr=null;
    for(const enc of ['utf-8','shift_jis']){try{const text=new TextDecoder(enc).decode(buf);parsed=await normalizeCsv(text,file.name);break;}catch(e){lastErr=e;}}
    if(!parsed)throw lastErr||new Error('CSVを解析できませんでした。');
    const ruleMap=new Map((rules||[]).filter(x=>x.enabled!==false&&x.matchType==='merchant_exact').map(x=>[normText(x.pattern),x]));
    for(const r of parsed.rows){if(r.invalid)continue;const rule=ruleMap.get(r.merchantNormalized);if(rule){r.category=rule.category||r.category;r.mealType=rule.mealType||r.mealType;r.categorySource='rule';}else r.categorySource=r.category==='未分類'?'none':'heuristic';}
    return {...parsed,fileHash,fileName:file.name,fileSize:file.size};
  }

  HAM.DCard={parseCsv,normalizeCsv,prepareFile,normText,parseMoney,parseDate,parseTime,inferPaymentMethod,normalizeMerchant,basicCategory,basicMealType,detectPaymentDate};
})(window);
