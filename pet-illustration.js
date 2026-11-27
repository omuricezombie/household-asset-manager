/* Illustration-first companion renderer. No persistence or household calculations.
   Unified 60-cut illustrated atlas for 5 species × 3 growth stages × 4 directions.
   Cells are upsampled from a roughly 162px source, not native 2x artwork. */
(function(global){
  'use strict';
  const HAM=global.HAM=global.HAM||{};
  const species=['animal','fantasy','fairy','yokai','dino'];
  const stages=['baby','teen','adult'];
  const directions=['front','left','right','back'];
  const moods=['idle','pet','food','play','calm'];
  const typeMap={animal:'animal',fantasy:'fantasy',fairy:'fairy',yokai:'yokai',dino:'dino'};
  function draw({type='fantasy',stage='baby',direction='front',mood='idle',affection=0,trait='curious'}={}){
    if(!species.includes(type))type='fantasy';
    if(!stages.includes(stage))stage='baby';
    if(!directions.includes(direction))direction='front';
    if(!moods.includes(mood))mood='idle';
    const pos=direction,older=stage!=='baby';
    const classes=['pet-art','pet-illustration','pet-unified','pet-art-'+type,'pet-art-'+stage,'pet-art-'+pos];
    if(stage==='baby')classes.push('pet-hq');
    else{classes.push('pet-hq-growth');if(stage==='adult'&&['dino','yokai'].includes(type))classes.push('pet-hq-extended');}
    const hqStyle=stage==='baby'?' style="'+['base','face','motion','food'].map(k=>'--hq-'+k+':url(assets/hq-baby/'+type+'-'+k+'.webp?v=0253)').join(';')+';--hq-face-cols:'+(type==='animal'?'500%':'300%')+';--hq-motion-rows:'+(['animal','dino'].includes(type)?'200%':'400%')+';--hq-left-row:'+(['animal','dino'].includes(type)?'0%':'33.333333%')+'"':' style="--hq-growth:url(assets/hq-growth/'+type+'-'+stage+'.webp?v=0253)"';
    // Right is an independent sprite in the unified atlas, not a flipped left view.
    const bond=Number(affection)>=70?'bonded':Number(affection)>=30?'friendly':'shy';
    return '<span class="'+classes.join(' ')+'" data-art-stage="'+stage+'" data-art-facing="'+direction+'" data-art-bond="'+bond+
      '"'+hqStyle+' aria-hidden="true"><span class="pet-art-image"></span><span class="pet-art-image pet-part-wing pet-part-wing-left"></span><span class="pet-art-image pet-part-wing pet-part-wing-right"></span><span class="pet-art-image pet-part-ear"></span><span class="pet-art-image pet-part-tail"></span><span class="pet-care-chew" aria-hidden="true"></span><span class="pet-care-food" aria-hidden="true"></span><span class="pet-care-brush" aria-hidden="true"></span><span class="pet-art-emote" aria-hidden="true"></span></span>';
  }
  function careReply(type){return ({animal:'毛並みがふわふわになった！',fantasy:'毛並みがふわふわになった！',fairy:'髪をとかしてもらって、うれしそう。',yokai:'ほっぺをふいてもらって、ごきげん。',dino:'やさしくふいてもらって、気持ちよさそう。'})[type]||'きれいにお手入れできた！';}
  function ballReply(type){return ({animal:'ボールをくわえて戻ってきた！',fantasy:'弾むボールをくわえて戻ってきた！',fairy:'小さなボールを浮かせて運んだ！',yokai:'不思議な力でボールを返した！',dino:'鼻先でボールを弾いて返した！'})[type]||'ボールを追いかけて跳ね回った！';}
  HAM.PetIllustration={draw,careReply,ballReply,types:species.slice(),stages:stages.slice()};
})(window);
