const CACHE='household-asset-manager-v0.2.49-candidate.1';
const FILES=['./','./index.html','./styles.css?v=0249c1','./db.js?v=0249c1','./dcard-import.js?v=0249c1','./analysis.js?v=0249c1','./pet-game.css?v=0249c1','./pet-hq.css?v=0249c1','./pet-art.js?v=0249c1','./pet-illustration.js?v=0249c1','./assets/pet-unified-atlas.webp?v=0249c1','./assets/pet-room-animal.svg?v=0249c1','./assets/pet-room-fantasy.svg?v=0249c1','./assets/pet-room-fairy.svg?v=0249c1','./assets/pet-room-yokai.svg?v=0249c1','./assets/pet-room-dino.svg?v=0249c1','./assets/pet-baby-chew-closed-q95.webp?v=0249c1','./assets/pet-baby-food-types.svg?v=0249c1','./assets/pet-blink-fantasy-baby.webp?v=0249c1','./assets/pet-gaze-yokai-baby.svg?v=0249c1','./assets/pet-blink-animal-baby.webp?v=0249c1','./assets/pet-animal-baby-blink-ear.webp?v=0249c1','./assets/pet-baby-tail-sides.webp?v=0249c1','./assets/pet-fantasy-baby-wings.webp?v=0249c1','./assets/pet-fairy-baby-wings.webp?v=0249c1','./assets/pet-fairy-baby-wing-fold.webp?v=0249c1','./assets/pet-fairy-baby-wing-axis.webp?v=0249c1','./assets/pet-yokai-baby-tail.webp?v=0249c1',
  './assets/pet-yokai-baby-tail-swing.webp?v=0249c1',
  './assets/pet-yokai-baby-tail-swing-fixed.webp?v=0249c1','./assets/pet-blink-dino-baby.webp?v=0249c1','./assets/pet-blink-fairy-baby.webp?v=0249c1','./pet-game.js?v=0249c1','./app.js?v=0249c1','./manifest.webmanifest','./icon-192.png','./icon-512.png','./assets/hq-baby/animal-base.webp?v=0249c1','./assets/hq-baby/animal-face.webp?v=0249c1','./assets/hq-baby/animal-motion.webp?v=0249c1','./assets/hq-baby/animal-food.webp?v=0249c1','./assets/hq-baby/dino-base.webp?v=0249c1','./assets/hq-baby/dino-face.webp?v=0249c1','./assets/hq-baby/dino-motion.webp?v=0249c1','./assets/hq-baby/dino-food.webp?v=0249c1','./assets/hq-baby/fantasy-base.webp?v=0249c1','./assets/hq-baby/fantasy-face.webp?v=0249c1','./assets/hq-baby/fantasy-motion.webp?v=0249c1','./assets/hq-baby/fantasy-food.webp?v=0249c1','./assets/hq-baby/yokai-base.webp?v=0249c1','./assets/hq-baby/yokai-face.webp?v=0249c1','./assets/hq-baby/yokai-motion.webp?v=0249c1','./assets/hq-baby/yokai-food.webp?v=0249c1','./assets/hq-baby/fairy-base.webp?v=0249c1','./assets/hq-baby/fairy-face.webp?v=0249c1','./assets/hq-baby/fairy-motion.webp?v=0249c1','./assets/hq-baby/fairy-food.webp?v=0249c1','./assets/hq-growth/animal-teen.webp?v=0249c1','./assets/hq-growth/animal-adult.webp?v=0249c1','./assets/hq-growth/fantasy-teen.webp?v=0249c1','./assets/hq-growth/fantasy-adult.webp?v=0249c1','./assets/hq-growth/fairy-teen.webp?v=0249c1','./assets/hq-growth/fairy-adult.webp?v=0249c1','./assets/hq-growth/yokai-teen.webp?v=0249c1','./assets/hq-growth/yokai-adult.webp?v=0249c1','./assets/hq-growth/dino-teen.webp?v=0249c1','./assets/hq-growth/dino-adult.webp?v=0249c1'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(FILES.map(url=>new Request(url,{cache:'reload'}))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('household-asset-manager-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    fetch(e.request,{cache:'no-cache'})
      .then(resp=>{
        if(resp&&resp.ok){
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy));
        }
        return resp;
      })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});
