const CACHE='household-asset-manager-v0.2.53-candidate.1';
const FILES=['./pet-teen.css?v=0253','./teen-art-data.js?v=0253','./pet-teen.js?v=0253','./assets/hq-teen/fantasy-front-motion.webp?v=0253','./assets/hq-teen/fantasy-front-face.webp?v=0253','./assets/hq-teen/fantasy-left-motion.webp?v=0253','./assets/hq-teen/fantasy-back-motion.webp?v=0253','./assets/hq-teen/fantasy-right-motion.webp?v=0253','./assets/hq-teen/fantasy-food.svg?v=0253','./assets/hq-teen/fantasy-closed.webp?v=0253','./assets/hq-teen/fantasy-chew.webp?v=0253','./assets/hq-teen/fairy-front-motion.webp?v=0253','./assets/hq-teen/fairy-front-face.webp?v=0253','./assets/hq-teen/fairy-left-motion.webp?v=0253','./assets/hq-teen/fairy-back-motion.webp?v=0253','./assets/hq-teen/fairy-right-motion.webp?v=0253','./assets/hq-teen/fairy-food.svg?v=0253','./assets/hq-teen/fairy-closed.webp?v=0253','./assets/hq-teen/fairy-chew.webp?v=0253','./assets/hq-teen/fairy-sleep.webp?v=0253','./assets/hq-teen/yokai-base.webp?v=0253','./assets/hq-teen/yokai-front-motion.webp?v=0253','./assets/hq-teen/yokai-front-face.webp?v=0253','./assets/hq-teen/yokai-left-motion.webp?v=0253','./assets/hq-teen/yokai-back-motion.webp?v=0253','./assets/hq-teen/yokai-right-motion.webp?v=0253','./assets/hq-teen/yokai-food.svg?v=0253','./assets/hq-teen/yokai-closed.webp?v=0253','./assets/hq-teen/yokai-chew.webp?v=0253','./assets/hq-teen/yokai-sleep-half.webp?v=0253','./assets/hq-teen/yokai-sleep-closed.webp?v=0253','./assets/hq-teen/dino-front-face.webp?v=0253','./assets/hq-teen/dino-left-motion.webp?v=0253','./assets/hq-teen/dino-back-motion.webp?v=0253','./assets/hq-teen/dino-right-motion.webp?v=0253','./assets/hq-teen/dino-food.svg?v=0253','./assets/hq-teen/dino-closed.webp?v=0253','./assets/hq-teen/dino-chew.webp?v=0253','./assets/hq-teen/animal-front-ears.webp?v=0253','./assets/hq-teen/animal-left-ears.webp?v=0253','./assets/hq-teen/animal-left-tail.webp?v=0253','./assets/hq-teen/animal-back-ears.webp?v=0253','./assets/hq-teen/animal-back-tail.webp?v=0253','./assets/hq-teen/animal-right-ears.webp?v=0253','./assets/hq-teen/animal-right-tail.webp?v=0253','./assets/hq-teen/animal-half.webp?v=0253','./assets/hq-teen/animal-closed.webp?v=0253','./assets/hq-teen/animal-mouthClosed.webp?v=0253','./assets/hq-teen/animal-mouthChew.webp?v=0253','./assets/hq-teen/animal-sleep.webp?v=0253','./assets/hq-teen/animal-food.svg?v=0253','./assets/pet-care-brush.svg?v=0253','./assets/pet-care-hairbrush.svg?v=0253','./assets/pet-care-sponge.svg?v=0253','./assets/pet-care-cloth.svg?v=0253','./pet-sleep.css?v=0253','./sleep-controller.js?v=0253','./assets/animal-drowsy-mouth.webp?v=0253','./assets/animal-sleep.webp?v=0253','./assets/dino-sleep-mouth.webp?v=0253','./assets/fairy-sleep-mouth.webp?v=0253','./assets/fairy-sleep.webp?v=0253','./assets/fantasy-sleep-mouth.webp?v=0253','./assets/yokai-sleep-face.webp?v=0253','./pet-ball.css?v=0253','./assets/pet-ball.svg','./pet-brush.css?v=0253','./assets/pet-care-brush.svg','./assets/pet-care-hairbrush.svg','./assets/pet-care-cloth.svg','./assets/pet-care-sponge.svg','./','./index.html','./styles.css?v=0253','./db.js?v=0253','./dcard-import.js?v=0253','./analysis.js?v=0253','./pet-game.css?v=0253','./pet-hq.css?v=0253','./pet-art.js?v=0253','./pet-illustration.js?v=0253','./assets/pet-unified-atlas.webp?v=0253','./assets/pet-room-animal.svg?v=0253','./assets/pet-room-fantasy.svg?v=0253','./assets/pet-room-fairy.svg?v=0253','./assets/pet-room-yokai.svg?v=0253','./assets/pet-room-dino.svg?v=0253','./assets/pet-baby-chew-closed-q95.webp?v=0253','./assets/pet-baby-food-types.svg?v=0253','./assets/pet-blink-fantasy-baby.webp?v=0253','./assets/pet-gaze-yokai-baby.svg?v=0253','./assets/pet-blink-animal-baby.webp?v=0253','./assets/pet-animal-baby-blink-ear.webp?v=0253','./assets/pet-baby-tail-sides.webp?v=0253','./assets/pet-fantasy-baby-wings.webp?v=0253','./assets/pet-fairy-baby-wings.webp?v=0253','./assets/pet-fairy-baby-wing-fold.webp?v=0253','./assets/pet-fairy-baby-wing-axis.webp?v=0253','./assets/pet-yokai-baby-tail.webp?v=0253',
  './assets/pet-yokai-baby-tail-swing.webp?v=0253',
  './assets/pet-yokai-baby-tail-swing-fixed.webp?v=0253','./assets/pet-blink-dino-baby.webp?v=0253','./assets/pet-blink-fairy-baby.webp?v=0253','./pet-game.js?v=0253','./app.js?v=0253','./manifest.webmanifest','./icon-192.png','./icon-512.png','./assets/hq-baby/animal-base.webp?v=0253','./assets/hq-baby/animal-face.webp?v=0253','./assets/hq-baby/animal-motion.webp?v=0253','./assets/hq-baby/animal-food.webp?v=0253','./assets/hq-baby/dino-base.webp?v=0253','./assets/hq-baby/dino-face.webp?v=0253','./assets/hq-baby/dino-motion.webp?v=0253','./assets/hq-baby/dino-food.webp?v=0253','./assets/hq-baby/fantasy-base.webp?v=0253','./assets/hq-baby/fantasy-face.webp?v=0253','./assets/hq-baby/fantasy-motion.webp?v=0253','./assets/hq-baby/fantasy-food.webp?v=0253','./assets/hq-baby/yokai-base.webp?v=0253','./assets/hq-baby/yokai-face.webp?v=0253','./assets/hq-baby/yokai-motion.webp?v=0253','./assets/hq-baby/yokai-food.webp?v=0253','./assets/hq-baby/fairy-base.webp?v=0253','./assets/hq-baby/fairy-face.webp?v=0253','./assets/hq-baby/fairy-motion.webp?v=0253','./assets/hq-baby/fairy-food.webp?v=0253','./assets/hq-growth/animal-teen.webp?v=0253','./assets/hq-growth/animal-adult.webp?v=0253','./assets/hq-growth/fantasy-teen.webp?v=0253','./assets/hq-growth/fantasy-adult.webp?v=0253','./assets/hq-growth/fairy-teen.webp?v=0253','./assets/hq-growth/fairy-adult.webp?v=0253','./assets/hq-growth/yokai-teen.webp?v=0253','./assets/hq-growth/yokai-adult.webp?v=0253','./assets/hq-growth/dino-teen.webp?v=0253','./assets/hq-growth/dino-adult.webp?v=0253'];

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
