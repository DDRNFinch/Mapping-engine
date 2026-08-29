(()=>{
  let deferredPrompt=null;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
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
  window.addEventListener('DOMContentLoaded',()=>{
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    if(!standalone()) ensureInstallButton();
  });
})();
