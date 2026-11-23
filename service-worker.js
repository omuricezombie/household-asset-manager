const CACHE='household-asset-manager-v0.2.46-candidate.11';
const FILES=['./','./index.html','./styles.css?v=0246c11','./db.js?v=0246c11','./dcard-import.js?v=0246c11','./analysis.js?v=0246c11','./pet-game.css?v=0246c11','./pet-art.js?v=0246c11','./assets/pet-concept-atlas.webp?v=0246c11','./assets/pet-yokai-concept.webp?v=0246c11','./pet-illustration.js?v=0246c11','./assets/pet-growth-atlas.webp?v=0246c11','./pet-game.js?v=0246c11','./app.js?v=0246c11','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

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
