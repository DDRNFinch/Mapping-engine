(()=>{
  'use strict';

  let deferredPrompt=null;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  const isAndroid=/android/i.test(navigator.userAgent);
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);

  async function refreshWorker(){
    if(!('serviceWorker' in navigator)) return;
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=7',{scope:'./',updateViaCache:'none'});
      await reg.update().catch(()=>{});
    }catch{}
  }

  function openInChrome(){
    const path=location.host+location.pathname+location.search+location.hash;
    location.href=`intent://${path}#Intent;scheme=https;package=com.android.chrome;end`;
  }

  function installCopy(btn,host){
    if(deferredPrompt){
      btn.innerHTML='<span class="naxos-install-dot"></span><span>Install Naxos</span>';
      btn.onclick=async()=>{
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(()=>null);
        deferredPrompt=null;
        if(standalone()) host.remove(); else installCopy(btn,host);
      };
      return;
    }
    if(isAndroid){
      btn.innerHTML='<span class="naxos-install-dot"></span><span>Install app</span>';
      btn.onclick=openInChrome;
      return;
    }
    if(isIOS){
      btn.innerHTML='<span class="naxos-install-dot"></span><span>Add to Home</span>';
      btn.onclick=()=>alert('In Safari, tap Share, then Add to Home Screen.');
      return;
    }
    btn.innerHTML='<span class="naxos-install-dot"></span><span>Install Naxos</span>';
    btn.onclick=()=>alert('Open this page in Chrome or Edge and choose Install app.');
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
    btn.setAttribute('aria-label','Install Naxos app');
    host.appendChild(btn);
    topbar.appendChild(host);
    installCopy(btn,host);
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    const btn=document.getElementById('naxosInstall');
    const host=btn?.closest('.naxos-install-wrap');
    if(btn&&host) installCopy(btn,host); else ensureInstallButton();
  });

  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    document.querySelector('.naxos-install-wrap')?.remove();
  });

  window.addEventListener('DOMContentLoaded',()=>{
    refreshWorker();
    ensureInstallButton();
  });
})();
