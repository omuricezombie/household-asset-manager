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

/* Cartoon 3/4 left-looking poses: short snouts, rounded shapes and smaller far-side eyes.
   Intentionally not anatomically strict profiles. Right faces are mirrored. */
function animalThreeQuarter(age,mood){
 const P=palette.animal,adult=age===2,baby=age===0;let s='';
 s+=path(adult?'M141 128 Q181 84 181 114 Q180 142 149 154Z':'M141 130 Q170 104 176 120 Q177 141 148 150Z',P.main,P.dark);
 s+=ell(109,130,adult?50:baby?41:46,adult?43:35,P.main,P.dark)+ell(106,139,24,23,P.light);
 s+=ell(77,162,16,10,P.main,P.dark)+ell(135,162,17,10,P.main,P.dark);
 s+=path(adult?'M76 69 L59 15 Q69 5 82 34 L97 57 L116 39 Q139 10 142 37 L132 82Z':'M77 72 L63 28 Q70 17 83 39 L98 59 L119 46 Q140 23 137 45 L130 81Z',P.main,P.dark);
 s+=path('M73 55 L68 34 Q78 39 85 58Z','#f7bdba','none',0);
 s+=ell(93,82,adult?44:41,adult?40:38,P.light,P.dark,3.5);
 s+=ell(72,98,21,14,P.detail);
 s+=eye(77,79,mood,1.06)+eye(106,81,mood,.62)+ell(64,100,7,4,'#efaab0');
 s+=circ(61,96,3.2,'#885d59')+line('M66 108 Q78 118 87 108',P.ink,2.4);
 s+=ell(138,130,13,9,P.main,P.dark);
 if(adult)s+=path('M107 117 Q123 130 133 140','none','#fff0d8',5);
 return s;
}
function fantasyThreeQuarter(age,mood){
 const P=palette.fantasy,adult=age===2,baby=age===0;let s='';
 if(!baby)s+=path(adult?'M118 106 Q161 16 182 49 Q182 118 144 141 L116 129Z':'M119 117 Q149 62 171 90 Q171 128 135 140Z','#b6ecf2',P.dark);
 s+=path(adult?'M136 128 Q176 102 175 137 Q169 155 142 151Z':'M136 132 Q162 111 167 132 Q160 146 141 150Z',P.main,P.dark);
 s+=path(adult?'M80 69 Q53 10 68 15 Q85 23 92 59 L117 55 Q134 9 147 23 Q157 39 134 81Z':'M79 77 Q57 29 71 24 Q87 32 94 66 L117 61 Q129 25 139 31 Q151 45 131 86Z',P.main,P.dark);
 s+=path('M75 61 L71 38 Q84 44 86 64Z','#f5bbd0','none',0);
 s+=path(adult?'M51 92 Q48 46 94 51 Q149 44 153 104 Q154 154 102 160 Q49 156 51 92Z':'M54 96 Q51 56 96 58 Q151 55 148 106 Q150 151 101 157 Q54 152 54 96Z',P.main,P.dark,4);
 s+=ell(84,87,24,20,P.light)+ell(93,123,27,19,'#a6f0de');
 s+=eye(78,98,mood,1.12)+eye(110,99,mood,.64);
 s+=ell(68,117,8,4,'#f3a2be')+smile(91,121,mood);
 s+=ell(77,162,16,10,P.main,P.dark)+ell(128,161,16,10,P.main,P.dark);
 if(adult)s+=path('M106 59 L118 34 L126 60Z','#f2efba',P.dark,2);
 return s;
}
function fairyThreeQuarter(age,mood){
 const P=palette.fairy,adult=age===2,baby=age===0,skin='#ffe7ce',hair=adult?'#755680':'#986e94';let s='';
 s+=path(adult?'M115 108 Q148 39 178 65 Q178 117 132 147Z':'M118 115 Q148 72 163 90 Q167 127 133 141Z','#b7e9f2','#829fc9',3);
 s+=path('M130 117 Q146 111 154 95','none','#fff9ef',2.5);
 s+=line('M122 118 L131 141',P.dark,6)+line('M116 152 L122 171',P.dark,6)+ell(122,174,8,4,skin);
 s+=path(adult?'M81 110 Q98 106 117 112 Q122 137 136 160 Q100 177 72 160Z':baby?'M82 113 Q100 110 118 115 Q122 137 126 157 Q100 169 73 157Z':'M82 112 Q100 108 118 114 Q124 137 130 159 Q99 171 73 159Z',adult?'#b6d8d1':'#c7e7d9',P.dark);
 s+=line('M83 147 Q102 155 124 148','#fff5e3',3);
 s+=line('M90 158 L85 173',P.dark,7)+ell(85,176,9,4.3,skin);
 s+=path(adult?'M59 72 Q57 26 90 19 Q129 15 138 59 Q145 100 123 115 L77 105Z':'M61 74 Q60 32 90 27 Q126 24 134 66 Q139 100 116 112 L76 104Z',hair,P.dark);
 s+=path('M94 99 L100 113 L112 112 L110 99Z',skin,'none',0);
 s+=ell(89,78,adult?36:33,adult?35:33,skin,'#d8b7a5',3);
 s+=path(adult?'M61 63 Q64 34 89 32 Q109 33 122 51 Q110 44 96 49 Q81 63 61 63Z':'M64 64 Q67 42 89 40 Q109 41 119 54 Q105 51 97 55 Q80 66 64 64Z',hair,'none',0);
 s+=path('M121 53 Q136 84 124 107','none',hair,7);
 s+=eye(76,77,mood,1.02)+eye(105,79,mood,.65);
 s+=ell(66,97,6,3,'#f3afaf')+smile(88,100,mood);
 s+=line('M85 115 Q76 127 73 141',P.dark,7)+circ(73,144,4.4,skin);
 if(adult)s+=sparkle(160,52,'#fff0b7');
 return s;
}
function yokaiThreeQuarter(age,mood){
 const P=palette.yokai,adult=age===2,baby=age===0;let s='';
 s+=path(adult?'M71 65 Q46 13 68 10 Q90 12 95 45 Q120 14 134 24 Q148 39 136 71Z':'M85 67 Q73 35 89 29 Q107 36 110 64Z',P.main,P.dark);
 s+=path(adult?'M51 84 Q49 39 99 37 Q150 39 154 90 Q162 121 145 148 L131 161 Q116 145 102 158 Q85 143 69 156 Q48 145 49 120Z':'M56 90 Q56 51 100 50 Q146 50 149 94 Q153 129 132 148 Q114 135 101 152 Q83 136 70 148 Q51 133 56 90Z',P.main,P.dark,3.8);
 s+=ell(83,95,adult?23:21,adult?24:22,'#fff7f4',P.dark,2.7)+eye(83,95,mood,1.85);
 s+=ell(60,117,8,4,'#eda2d0')+ell(115,116,7,3,'#eda2d0');
 s+=line('M71 126 Q87 138 106 125','#575082',3);
 if(!baby)s+=path('M135 122 Q164 99 171 114 Q174 139 142 148Z','#ddb4e9',P.dark);
 if(adult)s+=sparkle(145,60,'#f6c9ea');
 return s;
}
function dinoThreeQuarter(age,mood){
 const P=palette.dino,baby=age===0,adult=age===2;let s='';
 s+=path(adult?'M137 125 Q174 96 189 105 Q179 145 145 156Z':'M136 129 Q169 108 179 123 Q169 147 145 150Z',P.main,P.dark);
 s+=path(adult?'M104 94 L115 59 L131 85 L143 50 L156 93 L169 80 L161 128Z':'M105 101 L115 76 L131 97 L143 78 L149 120Z',P.detail,P.dark,3);
 s+=ell(109,130,adult?49:43,adult?40:35,P.main,P.dark)+ell(103,138,26,21,P.light);
 s+=line(adult?'M84 141 L77 169 L62 171 M137 143 L141 168 L155 170':'M84 141 L77 164 L65 168 M135 144 L140 165 L152 168',P.dark,adult?11:9);
 s+=path(adult?'M59 78 Q56 43 96 37 Q142 37 147 82 Q150 108 123 119 Q84 123 59 108 Q52 99 59 78Z':'M61 81 Q60 49 96 48 Q139 47 142 83 Q146 108 123 116 Q84 122 60 108 Q53 99 61 81Z',P.main,P.dark,3.7);
 s+=ell(67,104,21,14,P.light,P.dark,2.8);
 s+=eye(78,83,mood,1.15)+eye(114,85,mood,.63);
 s+=circ(54,104,3.1,P.dark)+line('M63 115 Q81 124 99 113',P.dark,2.7);
 s+=line('M122 119 Q132 128 138 123',P.dark,2.5);
 if(adult)s+=path('M82 117 L88 125 L94 119 L101 126 L107 118Z','#fff5de','none',0);
 if(baby)s+=path('M78 149 L89 145 L100 152 L111 145 L125 152 L129 159 Q101 168 77 159Z','#fbefd4','#dfc99b',2);
 return s;
}

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
  s+=animalThreeQuarter(age,mood);
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
  s+=fantasyThreeQuarter(age,mood);
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
  s+=fairyThreeQuarter(age,mood);
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
  s+=yokaiThreeQuarter(age,mood);
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
  s+=dinoThreeQuarter(age,mood);
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
