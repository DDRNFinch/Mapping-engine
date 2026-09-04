const CACHE_NAME='naxos-shell-v16';
const CACHE_PREFIX='naxos-shell-';
const QR_CACHE='naxos-qr-v1';
const QR_LIBRARY_URL='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
const CORE=[
  './',
  './index.html',
  './ksb.html',
  './matrix.html',
  './styles.css',
  './evia-shell.css',
  './naxos-evia-shell.js',
  './naxos-editor.js',
  './naxos-task-prompts-v1.js',
  './naxos-evidence-contract-v3.js',
  './pwa.js',
  './app.js',
  './ksb.js',
  './matrix.js',
  './manifest.webmanifest',
  './naxos-logo.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.svg',
  './apple-touch-icon.png',
  './course-catalog.json',
  './ksb-manifest.json',
  './manifest-6570-04.json',
  './manifest.json',
  './evidence-rules.json',
  './evidence-capture-contract-v2.json',
  './question-banks/manifest.json',
  './question-banks/question-bank-engine-v1.js'
];
const DATA_SEEDS=[
  './course-catalog.json',
  './ksb-manifest.json',
  './manifest-6570-04.json',
  './manifest.json',
  './evidence-rules.json',
  './evidence-capture-contract-v2.json',
  './question-banks/manifest.json'
];

function collectJsonReferences(value,baseUrl,out=new Set()){
  if(typeof value==='string'){
    const text=value.trim();
    if(!/\.json(?:[?#].*)?$/i.test(text)) return out;
    try{
      const url=new URL(text,baseUrl);
      const scope=new URL(self.registration.scope);
      if(url.origin===scope.origin&&url.pathname.startsWith(scope.pathname)) out.add(url.href);
    }catch{}
    return out;
  }
  if(Array.isArray(value)){
    value.forEach(item=>collectJsonReferences(item,baseUrl,out));
    return out;
  }
  if(value&&typeof value==='object') Object.values(value).forEach(item=>collectJsonReferences(item,baseUrl,out));
  return out;
}

async function cacheJsonGraph(cache,seeds){
  const queue=seeds.map(path=>new URL(path,self.registration.scope).href);
  const seen=new Set();
  while(queue.length){
    const href=queue.shift();
    if(seen.has(href)) continue;
    seen.add(href);
    const response=await fetch(href,{cache:'reload'});
    if(!response.ok) throw new Error(`Could not cache offline course data: ${href}`);
    await cache.put(href,response.clone());
    let data=null;
    try{data=await response.json()}catch{}
    if(!data) continue;
    for(const next of collectJsonReferences(data,href)) if(!seen.has(next)) queue.push(next);
  }
}

async function cacheQrLibrary(){
  const response=await fetch(QR_LIBRARY_URL,{mode:'cors',cache:'reload'});
  if(!response.ok) throw new Error('Could not cache the offline QR library.');
  const cache=await caches.open(QR_CACHE);
  await cache.put(QR_LIBRARY_URL,response);
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(CORE);
    await cacheJsonGraph(cache,DATA_SEEDS);
    await cacheQrLibrary();
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

  if(request.url===QR_LIBRARY_URL){
    event.respondWith((async()=>{
      const cached=await caches.match(request);
      if(cached) return cached;
      try{
        const response=await fetch(request);
        if(response&&response.ok){
          const cache=await caches.open(QR_CACHE);
          await cache.put(request,response.clone());
        }
        return response;
      }catch{
        return Response.error();
      }
    })());
    return;
  }

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response&&response.ok){
          const cache=await caches.open(CACHE_NAME);
          await cache.put(request,response.clone());
          await cache.put(`${url.origin}${url.pathname}`,response.clone());
        }
        return response;
      }catch{
        return (await caches.match(request))
          ||(await caches.match(`${url.origin}${url.pathname}`))
          ||(await caches.match('./index.html'));
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