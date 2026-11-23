/* SVG character artwork: five genuinely different species, three ages, three drawings.
   Both side directions share an actual profile drawing, mirrored as appropriate.
   No household or pet progress data is written from this module. */
(function(global){
'use strict';
const HAM=global.HAM=global.HAM||{};
const palette={
 animal:{main:'#e8b083',light:'#ffe5c2',dark:'#a66e59',detail:'#f8dbc4',ink:'#654e48'},
 fantasy:{main:'#7ad9bb',light:'#c5f7df',dark:'#408e83',detail:'#a0e6df',ink:'#285e5a'},
 fairy:{main:'#c6a1e9',light:'#ffe4cb',dark:'#8667ac',detail:'#9fe1e4',ink:'#5f4b83'},
 yokai:{main:'#a8a2e9',light:'#ded8ff',dark:'#686aa4',detail:'#f3add6',ink:'#4e4784'},
 dino:{main:'#8bbd79',light:'#c8eb9f',dark:'#507e61',detail:'#eadc90',ink:'#375d4e'}
};
function path(d,fill,stroke,width=3.5,extra=''){
 return '<path d="'+d+'" fill="'+fill+'" stroke="'+(stroke||'none')+'" stroke-width="'+width+
   '" stroke-linecap="round" stroke-linejoin="round" '+extra+'/>';
}
function ell(x,y,rx,ry,fill,stroke='none',w=3){
 return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'"/>';
}
function circ(x,y,r,fill,stroke='none',w=3){return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'"/>';}
function line(d,color,width=3){return path(d,'none',color,width);}
function eye(x,y,mood,scale=1){
 if(mood==='pet'||mood==='calm')return line('M'+(x-4*scale)+' '+y+' Q'+x+' '+(y-6*scale)+' '+(x+4*scale)+' '+y,'#39545a',3);
 return '<g class="pet-svg-eye">'+ell(x,y,4.4*scale,6.3*scale,'#354b4c')+ell(x-1.4*scale,y-2*scale,1.25*scale,1.7*scale,'#fff')+'</g>';
}
function eyes(x1,x2,y,mood,s=1){return eye(x1,y,mood,s)+eye(x2,y,mood,s);}
function blush(x,y,rx=8){return ell(x,y,rx,4.3,'#f4a3b3')+ell(200-x,y,rx,4.3,'#f4a3b3');}
function smile(x,y,mood){
 if(mood==='food')return ell(x,y+4,6,8,'#9a526b','#6e565a',2)+ell(x,y+9,2.8,2.2,'#eaaaad');
 return line('M'+(x-7)+' '+y+' Q'+x+' '+(y+10)+' '+(x+7)+' '+y,'#5d5653',2.7);
}
function sparkle(x,y,color){return path('M'+x+' '+(y-9)+' L'+(x+3)+' '+(y-2)+' L'+(x+10)+' '+y+' L'+(x+3)+' '+(y+2)+' L'+x+' '+(y+9)+' L'+(x-3)+' '+(y+2)+' L'+(x-10)+' '+y+' L'+(x-3)+' '+(y-2)+' Z',color,'none',0);}
function heart(x,y){return path('M'+x+' '+(y+8)+' C'+(x-26)+' '+(y-5)+','+(x-10)+' '+(y-18)+','+x+' '+(y-7)+' C'+(x+10)+' '+(y-18)+','+(x+26)+' '+(y-5)+','+x+' '+(y+8)+'Z','#f29cbd','none',0);}
function animal(age,view,mood){
 const baby=age===0,adult=age===2,P=palette.animal;
 let s='';
 if(view==='front'){
  s+=path(adult?'M129 130 Q166 84 177 105 Q182 124 153 140 L139 150 Z':'M135 133 Q164 111 168 124 Q167 140 140 146Z',P.main,P.dark);
  s+=ell(100,133,adult?53: baby?38:46,adult?44:35,P.main,P.dark);
  s+=ell(100,144,adult?27:20,adult?27:18,P.light);
  s+=path(adult?'M48 69 L45 19 Q51 9 62 23 L79 48 Q100 40 121 48 L142 23 Q156 9 158 21 L151 71Z':'M49 73 L43 34 Q45 18 59 30 L77 53 Q100 46 123 53 L143 30 Q157 20 158 37 L151 73Z',P.main,P.dark);
  s+=path('M55 59 L52 32 Q60 37 67 59 Z','#f7bdba','none',0)+path('M145 59 L148 32 Q140 38 134 59 Z','#f7bdba','none',0);
  s+=ell(100,adult?82: baby?80:78,adult?43:baby?46:44,adult?38:baby?43:40,P.light,P.dark);
  s+=ell(100,103,adult?22:25,13,P.detail);
  s+=eyes(82,118,80,mood,1.08)+ell(82,94,6,3,'#eea9a8')+ell(118,94,6,3,'#eea9a8');
  s+=path('M95 99 Q100 94 105 99 L100 104 Z','#885d59','none',0)+line('M100 104 L100 109 M100 109 Q93 117 88 110 M100 109 Q107 117 112 110',P.ink,2);
  s+=ell(64,166,16,9,P.main,P.dark)+ell(136,166,16,9,P.main,P.dark);
  if(adult)s+=path('M65 115 Q67 138 100 155 Q133 138 135 115', 'none','#fff2db',7)+path('M65 43 Q100 23 135 43', 'none','#f5d0a3',5);
 }else if(view==='side'){
  s+=path(adult?'M127 110 Q161 50 184 66 Q181 114 142 137L130 135Z':'M122 123 Q154 77 177 92 Q177 128 142 141Z',P.main,P.dark);
  s+=ell(106,121,adult?54:44,adult?39:34,P.main,P.dark);
  s+=path(adult?'M66 81 L49 23 Q54 12 68 36 L76 53 L104 45 L119 18 Q132 6 132 29 L124 89Z':'M63 85 L54 35 Q60 25 73 54 L95 58 L114 34 Q125 31 125 49 L124 91Z',P.main,P.dark);
  s+=ell(adult?78:81,81,adult?43:39,adult?38:40,P.light,P.dark);
  s+=path('M53 91 Q32 89 20 105 Q21 119 44 120 L68 105Z',P.detail,P.dark,3);
  s+=eye(70,80,mood,1.1)+ell(36,106,5,3,'#875e55')+line('M28 116 Q39 122 49 115',P.ink,2);
  s+=ell(83,155,14,11,P.main,P.dark)+ell(134,156,14,11,P.main,P.dark);
  if(adult)s+=path('M100 94 Q120 107 139 113', 'none','#fff0d1',6);
 }else{
  s+=path(adult?'M110 126 Q165 91 177 68 Q187 120 151 146Z':'M112 131 Q149 99 166 113 Q166 139 147 149Z',P.main,P.dark);
  s+=ell(100,128,adult?53:43,adult?46:37,P.main,P.dark);
  s+=ell(100,81,adult?43:45,adult?42:40,P.light,P.dark);
  s+=path('M51 66 L45 22 Q52 8 67 29 L78 56 M149 66 L155 22 Q148 8 133 29 L122 56',P.main,P.dark,3);
  s+=path('M74 111 Q100 142 126 111','none','#f6dfbe',8)+ell(80,163,14,9,P.main,P.dark)+ell(123,163,14,9,P.main,P.dark);
  if(adult)s+=path('M79 64 Q100 46 121 64 M87 76 L113 76','none','#cf9876',5);
 }
 return s;
}
function fantasy(age,view,mood){
 const baby=age===0,adult=age===2,P=palette.fantasy;let s='';
 if(view==='front'){
  if(!baby){
   s+=path(adult?'M71 97 Q12 22 16 109 Q29 155 79 132Z':'M65 111 Q24 82 33 127 Q43 140 78 135Z','#bceff4',P.dark);
   s+=path(adult?'M129 97 Q188 22 184 109 Q171 155 121 132Z':'M135 111 Q176 82 167 127 Q157 140 122 135Z','#bceff4',P.dark);
  }
  s+=path(adult?'M133 128 Q155 118 167 89 Q180 91 165 144 L148 161Z':'M139 125 Q170 107 166 138 Q155 150 140 146Z',P.main,P.dark);
  s+=path(adult?'M66 69 Q41 12 57 5 Q74 5 82 53 L119 53 Q130 2 146 7 Q160 20 133 78Z':'M57 76 Q39 28 54 23 Q72 22 80 63 L120 63 Q130 24 146 24 Q163 35 143 81Z',P.main,P.dark);
  s+=path('M59 63 Q50 36 64 38 L76 67Z','#f9b9d0','none',0)+path('M141 63 Q150 36 136 38 L124 67Z','#f9b9d0','none',0);
  s+=path(adult?'M44 94 Q41 56 81 53 Q127 40 153 80 Q171 124 145 149 Q116 181 76 158 Q40 146 44 94Z':baby?'M53 97 Q53 59 98 58 Q146 58 148 99 Q153 150 102 155 Q52 155 53 97Z':'M49 97 Q46 53 97 55 Q158 50 154 104 Q160 157 103 162 Q48 156 49 97Z',P.main,P.dark,3.9);
  s+=ell(85,82,adult?25:23,19,P.light)+ell(100,126,34,22,'#aef1dd');
  s+=eyes(adult?82:83,adult?121:117,99,mood,1.14)+blush(70,117)+smile(100,121,mood);
  if(adult)s+=path('M83 55 L96 29 L108 55 L114 38 L126 58Z','#f6f1bc',P.dark,2)+
    ell(53,138,15,13,P.detail,P.dark)+ell(146,138,15,13,P.detail,P.dark);
  s+=ell(75,161,17,9,P.main,P.dark)+ell(125,161,17,9,P.main,P.dark);
 }else if(view==='side'){
  if(!baby)s+=path(adult?'M120 106 Q161 22 182 47 Q184 123 132 146Z':'M120 116 Q159 69 171 93 Q168 130 128 140Z','#bceff4',P.dark);
  s+=path(adult?'M126 118 Q171 102 184 151 Q171 170 132 143Z':'M124 123 Q153 115 165 139 L138 151Z',P.main,P.dark);
  s+=path(adult?'M61 76 Q53 4 75 13 Q89 30 89 71 L108 69 Q119 18 136 19 Q147 34 118 87Z':'M66 85 Q52 31 70 29 Q88 38 90 81 L111 80 Q120 33 139 39 L125 93Z',P.main,P.dark);
  s+=path(adult?'M45 90 Q40 52 85 54 Q139 55 143 103 Q151 157 96 158 Q43 153 45 90Z':'M53 94 Q55 63 94 63 Q143 66 146 111 Q147 158 93 155 Q50 148 53 94Z',P.main,P.dark,4);
  s+=path('M61 102 Q35 95 23 115 Q37 127 63 120Z',P.detail,P.dark,2.5);
  s+=eye(64,91,mood,1.2)+ell(42,113,5,3,P.dark)+line('M35 122 Q47 130 61 120',P.ink,2.5)+
  ell(81,160,14,9,P.main,P.dark)+ell(127,160,14,9,P.main,P.dark);
  if(adult)s+=path('M107 65 L118 36 L125 67Z','#f7efc5',P.dark,2);
 }else{
  if(!baby)s+=path(adult?'M76 95 Q10 36 17 127 Q39 165 79 135Z':'M69 106 Q31 78 37 136 Q51 143 79 133Z','#b6eaf3',P.dark)+
    path(adult?'M124 95 Q190 36 183 127 Q161 165 121 135Z':'M131 106 Q169 78 163 136 Q149 143 121 133Z','#b6eaf3',P.dark);
  s+=path('M67 80 Q44 14 61 18 Q78 26 84 73 L116 73 Q122 22 139 18 Q157 30 133 83Z',P.main,P.dark);
  s+=ell(100,113,adult?53:45,adult?49:42,P.main,P.dark,4);
  s+=path('M87 84 Q102 62 117 84 Q106 95 99 110 Q92 92 87 84Z','#d9ffe8','none')+ell(100,126,20,25,'#54bba9');
  s+=path('M128 129 Q173 121 168 163 Q144 163 136 148Z',P.main,P.dark);
  s+=ell(71,162,14,9,P.main,P.dark)+ell(130,162,14,9,P.main,P.dark);
  if(adult)s+=path('M83 61 L100 33 L116 61Z','#f0f5cc',P.dark,2);
 }
 return s;
}
function fairy(age,view,mood){
 const baby=age===0,adult=age===2,P=palette.fairy;let s='';
 const wingY=adult?47:63;
 if(view==='front'){
  s+=path(adult?'M83 87 Q12 7 17 104 Q19 144 84 130Z':'M79 98 Q24 33 30 111 Q47 134 83 125Z','#b3e6f3','#7d9fc6',3.1);
  s+=path(adult?'M117 87 Q188 7 183 104 Q181 144 116 130Z':'M121 98 Q176 33 170 111 Q153 134 117 125Z','#b3e6f3','#7d9fc6',3.1);
  s+=ell(52,90,adult?21:17,adult?35:26,'#d7b9f3','#9b89c8',2)+ell(148,90,adult?21:17,adult?35:26,'#d7b9f3','#9b89c8',2);
  s+=line('M51 64 Q45 91 65 111 M149 64 Q155 91 135 111','#ffffffa8',2);
  s+=path(adult?'M81 111 Q70 128 62 157 Q100 180 138 157 Q130 124 119 111Z':'M85 112 Q75 137 70 156 Q100 168 130 156 Q123 132 116 112Z',adult?'#b4d7d0':'#c7e7d9',P.dark);
  if(adult)s+=path('M76 144 Q100 158 124 144 L130 162 Q101 173 69 162Z','#7cacae','none');
  s+=line(adult?'M85 114 L65 132 M115 114 L135 132':'M82 121 L70 137 M118 121 L130 137',P.dark,7);
  s+=line('M88 157 L86 173 M112 157 L114 173',P.dark,7);
  s+=ell(85,176,8,4,'#f7d6c7')+ell(115,176,8,4,'#f7d6c7');
  // Hair and two distinct human-like facial regions.
  s+=path(adult?'M63 68 Q58 21 93 14 Q129 8 140 51 Q146 83 130 95 L127 60Z':'M70 62 Q63 31 94 27 Q125 23 133 62 L130 92Z',adult?'#73557c':'#986d91',P.dark);
  s+=ell(101,adult?66:74,adult?29:28,adult?33:30,'#ffe7ce','#d7b69f',3);
  s+=path(adult?'M73 54 Q88 25 108 32 Q113 49 134 49 L134 57 Q119 53 108 45 Q89 65 73 58Z':'M77 60 Q89 43 101 45 Q114 43 124 61 Q109 57 102 54 Q89 65 77 60Z',adult?'#73557c':'#986d91','none');
  s+=eyes(88,115,75,mood,.9)+smile(101,90,mood)+ell(79,88,5,3,'#f7b6b9')+ell(123,88,5,3,'#f7b6b9');
  if(adult)s+=path('M128 43 Q153 51 146 102 Q134 97 134 84Z','#74567c',P.dark,2)+sparkle(145,32,'#fff5bf');
  s+=circ(98,118,4,'#fff6df');
 }else if(view==='side'){
  // A real chibi human profile facing left, rather than a head facing sideways on a front-facing stick body.
  // Draw from rear to front: wings -> far limbs -> slender side-view outfit -> hair -> neck/face -> near arm.
  const hair=adult?'#73547d':'#986d91';
  const skin='#ffe7ce',skinLine='#d2b5a5',dress=adult?'#a9d6cf':'#c7e7d9';
  // Wings emerge at the shoulder blades (x118,y111); do not float alongside the head.
  s+=path(adult?
    'M117 110 Q138 63 166 67 Q172 102 148 126 Q133 141 118 120Z':
    baby?'M116 112 Q132 87 148 95 Q150 117 126 132 L115 122Z':
    'M116 110 Q140 74 159 83 Q164 113 137 135 L116 121Z',
    '#b8e8f4','#82a5c9',3);
  s+=path(adult?'M122 112 Q149 91 159 85 M121 119 Q139 124 146 130':
    'M122 111 Q133 108 143 99','none','#ffffffb5',2);
  if(adult)s+=path('M118 108 Q149 92 147 67 Q169 89 150 130Z','#e6c0f6','#a68ec9',2);
  // Far leg and arm are behind the dress.
  s+=line(adult?'M111 148 L117 169':'M108 148 L113 167',P.dark,6);
  s+=ell(adult?119:115,172,7,4,'#f5d9c8');
  s+=line(adult?'M115 112 Q125 122 122 139':'M113 113 Q125 122 119 136',P.dark,6);
  s+=circ(120,138,4.1,skin);
  // Torso is narrow in profile, with a side-view skirt extending toward the back.
  s+=path(adult?
    'M89 108 Q99 103 113 109 L119 130 Q120 144 130 159 Q105 169 82 160 Q89 142 88 127Z':
    baby?'M89 111 Q101 107 112 113 L116 138 Q122 150 119 156 Q102 163 83 155 Q90 139 87 127Z':
    'M89 109 Q102 105 115 111 L118 131 Q121 145 125 158 Q103 165 82 156 Q88 139 87 125Z',
    dress,P.dark,3.2);
  s+=path(adult?'M90 142 Q107 149 120 143':'M91 144 Q106 151 116 144','none','#f7f5e5',3.2);
  if(adult)s+=path('M84 157 Q106 167 132 158','none','#82bdb9',4);
  // Near leg falls from the forward edge of the skirt, not from the middle of a front-facing body.
  s+=line(adult?'M92 157 L88 173':'M94 156 L91 172',P.dark,7);
  s+=ell(adult?88:91,175,9,4.3,'#f5d9c8');
  // Layered hair creates the back of the skull; the neck connects the profile to the torso.
  s+=path(adult?
    'M63 71 Q60 28 91 19 Q124 16 127 55 Q137 87 121 118 Q111 117 105 104 L85 98Z':
    baby?'M66 70 Q65 36 92 31 Q124 30 125 64 Q131 95 113 109 L89 101Z':
    'M64 70 Q63 32 91 25 Q127 23 129 62 Q133 95 115 113 L89 103Z',
    hair,P.dark,3.2);
  s+=path('M91 93 Q92 109 102 113 L109 105 L107 91Z',skin,skinLine,2.5);
  // Continuous forehead -> small nose -> mouth -> chin -> cheek -> ear-side profile.
  s+=path(adult?
    'M78 48 Q94 42 105 51 Q115 63 107 84 Q103 96 91 102 Q76 105 66 96 Q60 89 57 83 L52 79 Q57 74 62 71 Q62 57 78 48Z':
    baby?'M79 52 Q94 46 105 56 Q112 66 105 85 Q101 95 90 100 Q75 102 65 94 Q60 88 59 82 L55 79 Q61 75 63 71 Q64 57 79 52Z':
    'M78 50 Q96 43 107 54 Q116 68 106 87 Q101 98 89 102 Q74 104 64 94 Q60 88 57 83 L54 80 Q60 75 63 71 Q63 58 78 50Z',
    skin,skinLine,2.8);
  // Fringe bends with the cranium and never forms a protruding beak.
  s+=path(adult?
    'M63 70 Q65 43 87 37 Q104 35 111 54 Q96 48 88 47 Q77 57 65 59Z':
    baby?'M63 71 Q65 47 88 43 Q104 44 108 57 Q91 50 82 54 Q75 65 63 65Z':
    'M63 71 Q65 43 88 39 Q104 38 110 57 Q95 49 86 52 Q77 64 63 63Z',
    hair,'none',0);
  s+=eye(adult?78:79,adult?74:75,mood,.96);
  s+=ell(67,87,5.5,3.2,'#f2b1b9');
  // Tiny human nose and subtle smile: face never becomes a large protruding muzzle.
  s+=circ(55,80,1.6,'#c18f83');
  s+=line('M60 90 Q66 96 72 91','#956f78',2);
  // Small ear and an identifiable, near-side shoulder/arm.
  s+=ell(104,79,5,7,skin,skinLine,1.6);
  s+=path(adult?'M91 112 Q82 125 79 137':'M92 113 Q84 124 82 136','none',P.dark,7);
  s+=circ(adult?78:81,138,4.4,skin);
  if(adult){
    s+=path('M119 60 Q134 91 115 121','none',hair,8);
    s+=sparkle(158,58,'#fff6bd');
  }
 }else{
  s+=path(adult?'M86 94 Q17 18 16 126 Q49 156 84 135Z':'M83 101 Q26 43 29 126 Q48 142 83 135Z','#b5eaf5','#8295c8',3)+
    path(adult?'M114 94 Q183 18 184 126 Q151 156 116 135Z':'M117 101 Q174 43 171 126 Q152 142 117 135Z','#b5eaf5','#8295c8',3);
  s+=path(adult?'M81 114 Q69 135 64 158 Q101 183 139 157 Q128 130 119 114Z':'M84 115 Q74 134 72 157 Q100 171 128 157 Q126 133 117 115Z','#b4d4d2',P.dark);
  s+=line('M90 161 L88 178 M112 161 L114 178',P.dark,7);
  s+=ell(100,74,32,36,adult?'#775a88':'#9c729b',P.dark);
  s+=path('M79 58 Q100 40 122 58 L120 94 Q99 112 79 94Z','#886b96','none');
  if(adult)s+=path('M72 58 Q63 97 73 128 L86 102 M126 58 Q139 95 128 125 L114 98','#765785',P.dark,4);
  s+=line('M94 148 Q103 153 112 148','#fff4db',2);
 }
 return s;
}
function yokai(age,view,mood){
 const baby=age===0,adult=age===2,P=palette.yokai;let s='';
 if(view==='front'){
  s+=path(adult?'M60 54 Q26 11 59 5 Q79 5 86 43 Q115 10 136 6 Q164 16 143 61Z':'M81 62 Q60 32 78 27 Q90 27 103 57Z',P.main,P.dark);
  s+=path(adult?'M54 77 Q55 35 99 30 Q156 30 150 97 Q166 138 141 149 Q126 140 113 157 Q98 142 79 157 Q67 143 52 150 Q40 138 50 115Z':'M66 86 Q65 54 101 49 Q138 51 138 91 Q150 131 132 144 Q114 137 102 152 Q89 137 72 147 Q58 138 64 119Z',P.main,P.dark,3.8);
  s+=path('M75 65 Q91 55 108 61','none','#f4eaff',8);
  // A true one-eyed spirit, not a two-eyed mascot.
  s+=ell(101,91,adult?23:21,adult?24:22,'#fff7f2',P.dark,3);
  s+=eye(101,91,mood,1.95);
  s+=ell(77,118,8,4,'#ef9fce')+ell(130,117,8,4,'#ef9fce');
  s+=path('M84 122 Q108 137 124 122 Q111 146 98 133Z','#65558b','none');
  s+=path('M92 125 L97 134 L100 126Z','#fff7f5','none');
  if(!baby){s+=path('M60 132 Q30 116 30 99 Q18 103 25 126 Q45 149 63 141Z','#e7b8ed',P.dark,2)+
    path('M143 130 Q169 113 173 93 Q186 106 177 134 Q162 145 141 143Z','#e7b8ed',P.dark,2);}
  if(adult){s+=ell(101,55,10,6,'#fff7bd');s+=sparkle(33,52,'#f2a5d9')+sparkle(166,65,'#f2a5d9');}
 }else if(view==='side'){
  s+=path(adult?'M82 47 Q82 10 99 8 Q107 34 119 42 Q143 23 145 47Z':'M94 57 Q80 38 89 28 Q107 40 113 59Z',P.main,P.dark);
  s+=path(adult?'M55 77 Q61 36 108 40 Q152 47 150 97 Q162 124 142 145 Q123 137 119 157 Q96 143 78 154 Q62 139 58 134 Q45 119 55 77Z':'M62 85 Q65 50 107 54 Q144 58 145 103 Q149 128 129 148 Q107 137 94 149 Q67 135 60 115Z',P.main,P.dark);
  s+=path('M62 94 Q45 90 36 106 Q49 117 63 112Z',P.light,P.dark,2);
  s+=ell(77,90,16,20,'#fff7f2',P.dark,2.5)+eye(76,89,mood,1.25);
  s+=line('M55 119 Q70 125 80 117','#554d7c',2.5);
  if(adult)s+=path('M138 99 Q178 74 179 119 Q167 153 137 142Z','#d99ed7',P.dark);
 }else{
  s+=path(adult?'M67 56 Q38 10 66 6 L91 47 L117 22 Q142 12 143 63Z':'M84 64 Q74 36 92 29 L108 60Z',P.main,P.dark);
  s+=path(adult?'M52 79 Q58 33 100 30 Q155 37 147 91 Q166 139 143 151 Q125 141 112 159 Q97 143 78 157 Q65 144 51 153 Q41 132 52 79Z':'M61 82 Q72 48 99 48 Q142 52 142 90 Q160 132 132 149 Q115 136 101 153 Q85 137 70 147 Q58 126 61 82Z',P.main,P.dark);
  s+=circ(101,96,adult?25:18,'#d9cfff')+path('M111 86 Q84 75 87 98 Q90 112 105 105 Q114 98 102 92', 'none','#8077ba',5);
  if(adult)s+=path('M71 124 Q100 138 128 120', 'none','#f7d7ee',5);
 }
 s+=ell(100,173,30,5,'#6d7ac14c');
 return s;
}
function dino(age,view,mood){
 const baby=age===0,adult=age===2,P=palette.dino;let s='';
 if(view==='front'){
  s+=path(adult?'M73 84 Q62 62 78 36 L101 6 L124 36 Q139 56 129 82Z':'M79 71 L83 44 L100 25 L117 44 L124 73Z',P.detail,P.dark);
  s+=path(adult?'M51 129 Q56 83 101 82 Q150 84 153 129 L146 157 Q125 169 100 169 Q73 170 54 156Z':'M67 124 Q65 91 102 91 Q135 92 138 129 Q132 159 101 160 Q73 155 67 124Z',P.main,P.dark);
  s+=ell(100,adult?130:132,adult?29:20,adult?28:19,P.light);
  s+=path(adult?'M58 73 Q57 34 105 36 Q153 37 146 77 Q162 91 149 105 Q130 118 102 113 Q74 117 53 101 Q43 90 58 73Z':'M65 79 Q65 43 101 46 Q138 46 138 79 Q149 92 137 100 Q113 112 85 104 Q62 107 59 92Z',P.main,P.dark);
  s+=ell(101,adult?94:92,adult?35:29,adult?15:12,'#bde49b',P.dark,2.5);
  s+=eyes(80,122,76,mood,1.2)+ell(88,94,4,3,P.dark)+ell(116,94,4,3,P.dark);
  s+=line('M82 106 Q100 113 121 105',P.dark,3);
  if(adult)s+=path('M81 107 L87 115 L93 109 L99 116 L105 109 L113 114 L117 108Z','#fff7e8','none',0);
  s+=line('M66 119 L48 132 M137 119 L151 131',P.dark,adult?11:8);
  s+=ell(75,166,adult?21:16,adult?12:9,P.main,P.dark)+ell(128,166,adult?21:16,adult?12:9,P.main,P.dark);
  if(baby)s+=path('M71 145 L82 139 L91 148 L99 141 L109 149 L117 140 L132 145 L123 160 L79 161Z','#f6edd2','#e1c89a',2);
 }else if(view==='side'){
  // True theropod profile with horizontal skull, long snout, separate hind legs and a large tail.
  s+=path(adult?'M125 114 Q160 94 184 91 Q178 115 151 133 L124 138Z':'M121 121 Q152 107 170 115 Q157 135 129 142Z',P.main,P.dark);
  s+=path(adult?'M99 90 L115 58 L132 78 L141 44 L153 76 L162 66 L151 112Z':'M97 95 L112 68 L122 92 L135 72 L139 112Z',P.detail,P.dark);
  s+=path(adult?'M84 90 Q125 82 143 123 Q137 156 106 154 Q79 153 72 122Z':'M85 103 Q123 95 130 125 Q130 155 100 155 Q79 153 74 128Z',P.main,P.dark);
  s+=path(adult?'M65 74 Q63 45 91 35 Q121 31 127 55 L112 80 Q102 97 83 113 L58 103Z':'M68 82 Q63 52 94 50 Q122 51 123 78 L100 109 L61 105Z',P.main,P.dark);
  s+=path(adult?'M66 75 Q44 63 24 81 Q20 99 44 103 L78 97Z':'M71 83 Q46 68 28 88 Q24 105 51 108 L82 97Z',P.light,P.dark,3.2);
  s+=path('M30 103 Q47 114 68 107', 'none',P.dark,3);
  s+=eye(68,76,mood,1.25)+ell(38,93,4.7,3,P.dark);
  if(adult)s+=path('M36 104 L43 112 L49 107 L55 114 L61 108Z','#fff9ed','none',0);
  s+=path(adult?'M102 132 L98 166 L78 171 M126 128 L129 166 L148 170':'M93 132 L90 164 L78 169 M120 134 L125 166 L140 170','none',P.dark,12);
  s+=line('M83 113 L72 124 M110 112 L114 126',P.dark,adult?8:6);
  if(baby)s+=path('M91 140 L105 147 L117 139 L126 149 L125 157 L91 158Z','#f6edd3','#e1c89a',2);
 }else{
  s+=path(adult?'M91 48 L107 5 L123 48 L139 33 L141 89Z':'M88 62 L103 30 L118 62 L129 49 L130 89Z',P.detail,P.dark);
  s+=path(adult?'M58 80 Q73 47 99 48 Q126 44 144 80 L151 137 Q133 160 117 163 L109 174 L91 174 L84 163 Q62 158 51 137Z':'M69 85 Q76 60 100 59 Q127 61 132 83 L140 136 Q129 151 115 158 L109 172 L90 172 L84 158 Q72 152 62 133Z',P.main,P.dark,4);
  s+=path('M86 68 Q100 54 114 69 L108 113 Q102 126 98 126 Q89 114 86 68Z','#c3e7a4',P.dark,2.5);
  s+=path(adult?'M91 139 Q98 160 100 186 Q107 161 111 139Z':'M92 140 Q98 160 101 174 Q107 157 109 140Z',P.main,P.dark);
  s+=ell(67,164,18,11,P.main,P.dark)+ell(135,164,18,11,P.main,P.dark);
  s+=line('M62 115 L44 131 M139 114 L154 130',P.dark,8);
 }
 return s;
}
const makers={animal,fantasy,fairy,yokai,dino};
function draw(input={}){
 const type=Object.prototype.hasOwnProperty.call(makers,input.type)?input.type:'fantasy';
 const age=input.stage==='adult'?2:input.stage==='teen'?1:0;
 const face=['front','left','right','back'].includes(input.direction)?input.direction:'front';
 const view=(face==='left'||face==='right')?'side':face;
 const mood=input.mood||'idle', P=palette[type];
 let art=makers[type](age,view,mood);
 if(face==='right')art='<g transform="translate(200 0) scale(-1 1)">'+art+'</g>';
 const love=Number(input.affection)||0;
 const aura=love>=75?heart(166,25):love>=30?sparkle(163,22,P.detail):'';
 return '<svg class="pet-art" viewBox="0 0 200 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'+
   '<ellipse cx="100" cy="178" rx="55" ry="6" fill="#3c657438" />'+
   art+aura+'</svg>';
}
HAM.PetArt={draw,types:Object.keys(makers)};
})(window);
