const CACHE_NAME='naxos-shell-v8';
const CACHE_PREFIX='naxos-shell-';
const CORE=[
  './',
  './index.html',
  './ksb.html',
  './matrix.html',
  './styles.css',
  './evia-shell.css',
  './naxos-evia-shell.js',
  './pwa.js',
  './app.js',
  './ksb.js',
  './matrix.js',
  './manifest.webmanifest',
  './naxos-logo.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.svg',
  './apple-touch-icon.png'
];

async function refreshCore(cache){
  await Promise.allSettled(CORE.map(async path=>{
    const response=await fetch(path,{cache:'reload'});
    if(response.ok) await cache.put(path,response.clone());
  }));
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await refreshCore(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response&&response.ok){
          const cache=await caches.open(CACHE_NAME);
          await cache.put(request,response.clone());
        }
        return response;
      }catch{
        return (await caches.match(request))||(await caches.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached) return cached;
    try{
      const response=await fetch(request);
      if(response&&response.ok){
        const cache=await caches.open(CACHE_NAME);
        await cache.put(request,response.clone());
      }
      return response;
    }catch{
      return Response.error();
    }
  })());
});
