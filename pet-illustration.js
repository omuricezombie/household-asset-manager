/* Illustration-first companion renderer. No persistence or household calculations.
   Front and angled: adopted baby sprites, new teen/adult illustrations.
   Back view: separate atlas for five families and three growth stages. */
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
    const pos=direction==='back'?'back':direction==='front'?'front':'side',older=stage!=='baby';
    const classes=['pet-art','pet-illustration','pet-art-'+type,'pet-art-'+stage,'pet-art-'+pos];
    if(older&&pos!=='back')classes.push('pet-art-growth');
    if(direction==='right')classes.push('pet-art-mirror');
    const bond=Number(affection)>=70?'bonded':Number(affection)>=30?'friendly':'shy';
    return '<span class="'+classes.join(' ')+'" data-art-stage="'+stage+'" data-art-facing="'+direction+'" data-art-bond="'+bond+
      '" aria-hidden="true"><span class="pet-art-image"></span><span class="pet-art-emote" aria-hidden="true"></span></span>';
  }
  HAM.PetIllustration={draw,types:species.slice(),stages:stages.slice()};
})(window);
