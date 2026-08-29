const CACHE='naxos-mapping-engine-v4';
const SHELL=[
  './','./index.html','./ksb.html','./matrix.html','./styles.css?v=4','./pwa.js?v=4',
  './app.js?v=4','./ksb.js?v=4','./matrix.js?v=4','./manifest.webmanifest?v=4','./naxos-logo.svg?v=4',
  './icon-192.png?v=4','./icon-512.png?v=4','./apple-touch-icon.png?v=4','./manifest.json','./manifest-6570-04.json',
  './ksb-manifest.json','./course-catalog.json','./evidence-rules.json'
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
  const networkFirst=req.mode==='navigate'||/\.(?:css|js|json|webmanifest)$/.test(url.pathname);
  if(networkFirst){
    event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
      return res;
    }).catch(()=>caches.match(req).then(cached=>cached||(req.mode==='navigate'?caches.match('./index.html'):Response.error()))));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
    return res;
  })));
});
