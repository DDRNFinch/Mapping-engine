(()=>{
  let deferredPrompt=null;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  const isAndroid=/android/i.test(navigator.userAgent);
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);

  async function refreshWorker(){
    if(!('serviceWorker' in navigator)) return;
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=5',{updateViaCache:'none'});
      await reg.update().catch(()=>{});
      if('caches' in window){
        const keys=await caches.keys();
        await Promise.all(keys.filter(k=>k.startsWith('naxos-mapping-engine-')&&k!=='naxos-mapping-engine-v5').map(k=>caches.delete(k)));
      }
    }catch{}
  }

  function openInChrome(){
    const path=location.host+location.pathname+location.search+location.hash;
    const intent=`intent://${path.replace(/^https?:\/\//,'')}#Intent;scheme=https;package=com.android.chrome;end`;
    location.href=intent;
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
    host.appendChild(btn);
    topbar.appendChild(host);

    const render=()=>{
      if(deferredPrompt){
        btn.innerHTML='<span class="naxos-install-dot"></span><span>Install Naxos</span>';
        btn.onclick=async()=>{
          deferredPrompt.prompt();
          await deferredPrompt.userChoice.catch(()=>null);
          deferredPrompt=null;
          if(standalone()) host.remove(); else render();
        };
        return;
      }
      if(isAndroid){
        btn.innerHTML='<span class="naxos-install-dot"></span><span>Open in Chrome to install</span>';
        btn.onclick=openInChrome;
        return;
      }
      if(isIOS){
        btn.innerHTML='<span class="naxos-install-dot"></span><span>Add Naxos to Home Screen</span>';
        btn.onclick=()=>alert('In Safari, tap Share, then Add to Home Screen.');
        return;
      }
      btn.innerHTML='<span class="naxos-install-dot"></span><span>Install Naxos</span>';
      btn.onclick=()=>alert('Open this page in Chrome or Edge and choose Install app.');
    };
    render();
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    const btn=document.getElementById('naxosInstall');
    if(btn){
      btn.innerHTML='<span class="naxos-install-dot"></span><span>Install Naxos</span>';
      btn.onclick=async()=>{
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(()=>null);
        deferredPrompt=null;
        if(standalone()) document.querySelector('.naxos-install-wrap')?.remove();
      };
    } else ensureInstallButton();
  });
  window.addEventListener('appinstalled',()=>document.querySelector('.naxos-install-wrap')?.remove());
  window.addEventListener('DOMContentLoaded',()=>{refreshWorker();if(!standalone())ensureInstallButton();});
})();
