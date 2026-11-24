const CACHE='household-asset-manager-v0.2.47-candidate.9';
const FILES=['./','./index.html','./styles.css?v=0247c9','./db.js?v=0247c9','./dcard-import.js?v=0247c9','./analysis.js?v=0247c9','./pet-game.css?v=0247c9','./pet-art.js?v=0247c9','./pet-illustration.js?v=0247c9','./assets/pet-unified-atlas.webp?v=0247c9','./assets/pet-blink-fantasy-baby.webp?v=0247c9','./assets/pet-gaze-yokai-baby.svg?v=0247c9','./assets/pet-blink-animal-baby.webp?v=0247c9','./assets/pet-animal-baby-blink-ear.webp?v=0247c9','./assets/pet-baby-tail-sides.webp?v=0247c9','./assets/pet-fantasy-baby-wings.webp?v=0247c9','./assets/pet-fairy-baby-wings.webp?v=0247c9','./assets/pet-fairy-baby-wing-fold.webp?v=0247c9','./assets/pet-fairy-baby-wing-axis.webp?v=0247c9','./assets/pet-yokai-baby-tail.webp?v=0247c9',
  './assets/pet-yokai-baby-tail-swing.webp?v=0247c9','./assets/pet-blink-dino-baby.webp?v=0247c9','./assets/pet-blink-fairy-baby.webp?v=0247c9','./pet-game.js?v=0247c9','./app.js?v=0247c9','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

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
