const CACHE='naxos-mapping-engine-v1';
const SHELL=[
  './','./index.html','./ksb.html','./matrix.html','./styles.css','./app.js','./ksb.js','./matrix.js','./pwa.js',
  './manifest.webmanifest','./naxos-logo.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png',
  './manifest.json','./manifest-6570-04.json','./ksb-manifest.json','./course-catalog.json','./evidence-rules.json'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(res=>{
      if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
      return res;
    }).catch(()=>{
      if(req.mode==='navigate') return caches.match('./index.html');
      throw new Error('offline');
    }))
  );
});
