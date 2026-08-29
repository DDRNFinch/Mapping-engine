(()=>{
  let deferredPrompt=null;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  async function refreshWorker(){
    if(!('serviceWorker' in navigator)) return;
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=4',{updateViaCache:'none'});
      await reg.update().catch(()=>{});
      if('caches' in window){
        const keys=await caches.keys();
        await Promise.all(keys.filter(k=>k.startsWith('naxos-mapping-engine-')&&k!=='naxos-mapping-engine-v4').map(k=>caches.delete(k)));
      }
    }catch{}
  }
  function ensureInstallButton(){
    if(standalone()||document.getElementById('naxosInstall')) return;
    const topbar=document.querySelector('.topbar');
    if(!topbar) return;
    const host=document.createElement('div');
    host.className='naxos-install-wrap';
    const btn=document.createElement('button');
    btn.id='naxosInstall';
    btn.type='button';
    btn.className='naxos-install';
    btn.innerHTML='<span class="naxos-install-dot"></span><span>Install app</span>';
    btn.addEventListener('click',async()=>{
      if(deferredPrompt){
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(()=>null);
        deferredPrompt=null;
        if(standalone()) host.remove();
        return;
      }
      const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
      alert(ios?'In Safari, tap Share and choose Add to Home Screen.':'Open your browser menu and choose Install app or Add to Home screen.');
    });
    host.appendChild(btn);
    topbar.appendChild(host);
  }
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;ensureInstallButton();});
  window.addEventListener('appinstalled',()=>document.querySelector('.naxos-install-wrap')?.remove());
  window.addEventListener('DOMContentLoaded',()=>{refreshWorker();if(!standalone())ensureInstallButton();});
})();
