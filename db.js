(function(global){
  'use strict';
  const HAM=global.HAM=global.HAM||{};
  const APP_VERSION='0.2.17-candidate.3';
  const SCHEMA_VERSION=2;
  const DB_NAME='householdAssetManagerDB_v2';
  const DB_VERSION=1;
  const STORES=['meta','settings','accounts','assetSnapshots','transactions','cardImports','paymentPlans','pointAccounts','pointSnapshots','categoryRules','monthStatus'];
  let db=null;

  function reqP(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  function txP(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));});}
  function uid(prefix='id'){return (crypto.randomUUID?crypto.randomUUID():`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);}
  function now(){return new Date().toISOString();}
  function ymd(d=new Date()){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;}
  function monthOfDate(s){return String(s||'').slice(0,7);}
  function currentMonth(){return ymd().slice(0,7);}
  function prevMonth(m){const [y,mo]=m.split('-').map(Number);const d=new Date(y,mo-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  function monthEndDate(m){const [y,mo]=m.split('-').map(Number);const d=new Date(y,mo,0);return ymd(d);}
  function stableSortObject(v){if(Array.isArray(v))return v.map(stableSortObject);if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>o[k]=stableSortObject(v[k]));return o;}return v;}
  function stableStringify(v){return JSON.stringify(stableSortObject(v));}
  async function sha256Text(text){if(!crypto.subtle)throw new Error('SHA-256を利用できません。');const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  async function sha256Bytes(buf){if(!crypto.subtle)throw new Error('SHA-256を利用できません。');const hash=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}

  function open(){return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=e=>{
      const d=e.target.result;
      if(!d.objectStoreNames.contains('meta')) d.createObjectStore('meta',{keyPath:'key'});
      if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings',{keyPath:'key'});
      if(!d.objectStoreNames.contains('accounts')){const s=d.createObjectStore('accounts',{keyPath:'id'});s.createIndex('category','category');s.createIndex('active','active');}
      if(!d.objectStoreNames.contains('assetSnapshots')){const s=d.createObjectStore('assetSnapshots',{keyPath:['month','accountId']});s.createIndex('month','month');s.createIndex('accountId','accountId');}
      if(!d.objectStoreNames.contains('transactions')){const s=d.createObjectStore('transactions',{keyPath:'id'});['date','month','kind','category','merchantNormalized','paymentMethod','sourceImportId','advanceStatus'].forEach(k=>s.createIndex(k,k));s.createIndex('sourceRowKey','sourceRowKey',{unique:true});}
      if(!d.objectStoreNames.contains('cardImports')){const s=d.createObjectStore('cardImports',{keyPath:'id'});s.createIndex('importedAt','importedAt');s.createIndex('fileHash','fileHash',{unique:true});s.createIndex('paymentDate','paymentDate');}
      if(!d.objectStoreNames.contains('paymentPlans')){const s=d.createObjectStore('paymentPlans',{keyPath:'id'});s.createIndex('dueDate','dueDate');s.createIndex('status','status');s.createIndex('type','type');}
      if(!d.objectStoreNames.contains('pointAccounts')){const s=d.createObjectStore('pointAccounts',{keyPath:'id'});s.createIndex('active','active');}
      if(!d.objectStoreNames.contains('pointSnapshots')){const s=d.createObjectStore('pointSnapshots',{keyPath:['month','pointAccountId']});s.createIndex('month','month');s.createIndex('pointAccountId','pointAccountId');}
      if(!d.objectStoreNames.contains('categoryRules')){const s=d.createObjectStore('categoryRules',{keyPath:'id'});s.createIndex('matchType','matchType');s.createIndex('enabled','enabled');}
      if(!d.objectStoreNames.contains('monthStatus')) d.createObjectStore('monthStatus',{keyPath:'month'});
    };
    r.onsuccess=()=>{db=r.result;resolve(db);};r.onerror=()=>reject(r.error);
  });}
  function ensure(){if(!db)throw new Error('DB未初期化');return db;}
  function store(name,mode='readonly'){return ensure().transaction(name,mode).objectStore(name);}
  function get(name,key){return reqP(store(name).get(key));}
  function getAll(name){return reqP(store(name).getAll());}
  function put(name,value){return reqP(store(name,'readwrite').put(value));}
  function del(name,key){return reqP(store(name,'readwrite').delete(key));}
  function clear(name){return reqP(store(name,'readwrite').clear());}
  function getAllByIndex(name,indexName,key){return reqP(store(name).index(indexName).getAll(key));}
  function getByIndex(name,indexName,key){return reqP(store(name).index(indexName).get(key));}

  async function bulkPut(name,values){if(!values.length)return;const tx=ensure().transaction(name,'readwrite');const s=tx.objectStore(name);values.forEach(v=>s.put(v));await txP(tx);}
  async function bulkDelete(name,keys){if(!keys.length)return;const tx=ensure().transaction(name,'readwrite');const s=tx.objectStore(name);keys.forEach(k=>s.delete(k));await txP(tx);}

  async function seed(){
    const m=await get('meta','app');
    if(!m) await put('meta',{key:'app',schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,createdAt:now(),updatedAt:now()});
    else if(m.schemaVersion!==SCHEMA_VERSION) throw new Error(`schemaVersion ${m.schemaVersion} は未対応です。`);
    if(!await get('settings','cashPresets')) await put('settings',{key:'cashPresets',value:[
      {label:'コインランドリー',category:'洗濯'},
      {label:'貸本',category:'貸本'},
      {label:'リフレッシュ費',category:'リフレッシュ費'},
      {label:'食費',category:'食費'},
      {label:'その他',category:'未分類'}
    ]});
    if(!await get('settings','reminderDay')) await put('settings',{key:'reminderDay',value:10});
    if(!(await getAll('accounts')).length){await bulkPut('accounts',[
      {id:'cash-wallet',name:'財布現金',category:'cash',active:true,sortOrder:20,createdAt:now()},
      {id:'stock-total',name:'株式',category:'stock',active:true,sortOrder:30,createdAt:now()},
      {id:'dc-total',name:'DC',category:'dc',active:true,sortOrder:40,createdAt:now()}
    ]);}
    if(!(await getAll('pointAccounts')).length) await put('pointAccounts',{id:'dpoint',name:'dポイント',active:true,sortOrder:10,createdAt:now()});
  }

  async function touchMeta(){const m=await get('meta','app')||{key:'app',createdAt:now()};m.schemaVersion=SCHEMA_VERSION;m.appVersion=APP_VERSION;m.updatedAt=now();await put('meta',m);}

  async function readAllStores(){const out={};for(const s of STORES)out[s]=await getAll(s);return out;}
  async function buildBackup(){
    await touchMeta();
    const stores=await readAllStores();
    const counts={};STORES.forEach(s=>counts[s]=stores[s].length);
    const dataHash=await sha256Text(stableStringify(stores));
    return {format:'household-asset-manager-backup',backupFormatVersion:1,schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,exportedAt:now(),stores,counts,integrity:{algorithm:'SHA-256',dataHash}};
  }
  async function validateBackup(p){
    if(!p||p.format!=='household-asset-manager-backup')throw new Error('バックアップ形式が違います。');
    if(p.backupFormatVersion!==1)throw new Error('backupFormatVersionが未対応です。');
    if(p.schemaVersion!==SCHEMA_VERSION)throw new Error(`schemaVersion ${p.schemaVersion} は未対応です。`);
    for(const s of STORES) if(!Array.isArray(p.stores?.[s])) throw new Error(`${s} がありません。`);
    for(const s of STORES) if(Number(p.counts?.[s])!==p.stores[s].length) throw new Error(`${s} の件数が一致しません。`);
    const hash=await sha256Text(stableStringify(p.stores));
    if(hash!==p.integrity?.dataHash) throw new Error('バックアップの整合性確認に失敗しました。');
    return true;
  }
  async function replaceAllStores(storesData){
    const tx=ensure().transaction(STORES,'readwrite');
    for(const name of STORES){const s=tx.objectStore(name);s.clear();for(const row of storesData[name])s.put(row);}
    await txP(tx);
  }
  async function restoreBackup(payload){await validateBackup(payload);await replaceAllStores(payload.stores);await touchMeta();}

  async function latestSnapshot(accountId,upToMonth){const all=await getAllByIndex('assetSnapshots','accountId',accountId);return all.filter(x=>!upToMonth||x.month<=upToMonth).sort((a,b)=>b.month.localeCompare(a.month))[0]||null;}
  async function latestPointSnapshot(pointAccountId,upToMonth){const all=await getAllByIndex('pointSnapshots','pointAccountId',pointAccountId);return all.filter(x=>!upToMonth||x.month<=upToMonth).sort((a,b)=>b.month.localeCompare(a.month))[0]||null;}
  async function getMonthStatus(month){return await get('monthStatus',month)||{month,completionItems:{dcard:false,bank:false,cash:false,stock:false,dc:false,points:false,rent:false,income:false},completionRate:0,createdAt:now()};}
  async function saveMonthStatus(status){const vals=Object.values(status.completionItems||{});status.completionRate=vals.length?Math.round(vals.filter(Boolean).length/vals.length*100):0;status.updatedAt=now();await put('monthStatus',status);return status;}

  HAM.DB={APP_VERSION,SCHEMA_VERSION,DB_NAME,STORES,open,seed,get,getAll,put,del,clear,getAllByIndex,getByIndex,bulkPut,bulkDelete,uid,now,ymd,currentMonth,prevMonth,monthEndDate,monthOfDate,sha256Text,sha256Bytes,stableStringify,buildBackup,validateBackup,restoreBackup,readAllStores,latestSnapshot,latestPointSnapshot,getMonthStatus,saveMonthStatus,touchMeta};
})(window);
