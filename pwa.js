(()=>{
  'use strict';

  let deferredPrompt=null;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  const isAndroid=/android/i.test(navigator.userAgent);
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);

  async function refreshWorker(){
    if(!('serviceWorker' in navigator)) return;
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=10',{scope:'./',updateViaCache:'none'});
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

  function ensurePencilStyles(){
    if(document.getElementById('naxosPencilStyles')) return;
    const style=document.createElement('style');
    style.id='naxosPencilStyles';
    style.textContent=`
      .button-stack .nav-button{position:relative;padding-right:52px!important}
      .naxos-pill-pencil{position:absolute;right:9px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:rgba(251,98,98,.08);color:#9f4146;font-size:16px;font-weight:800;line-height:1;z-index:2}
      .nav-button.active .naxos-pill-pencil{background:rgba(251,98,98,.14)}
      .naxos-edit-tools.naxos-title-tools-hidden{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function findEditTool(panel,index){
    const wanted=index===2?'Edit selected task':'Edit selected title';
    return [...panel.querySelectorAll('.naxos-edit-tools button')].find(button=>button.textContent.trim()===wanted)||null;
  }

  function enhancePencilEditing(){
    const panels=document.querySelectorAll('#browser .level-panel');
    if(panels.length<3) return;
    ensurePencilStyles();

    panels.forEach((panel,index)=>{
      const tool=findEditTool(panel,index);
      if(!tool) return;
      if(index<2) tool.closest('.naxos-edit-tools')?.classList.add('naxos-title-tools-hidden');
      else tool.hidden=true;

      const stack=panel.querySelector('.button-stack');
      if(!stack) return;
      stack.querySelectorAll('.nav-button').forEach(button=>{
        if(button.querySelector(':scope > .naxos-pill-pencil')) return;
        const pencil=document.createElement('span');
        pencil.className='naxos-pill-pencil';
        pencil.textContent='✎';
        pencil.title='Edit';
        pencil.setAttribute('aria-label','Edit');
        pencil.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          button.click();
          setTimeout(()=>{
            const currentPanels=document.querySelectorAll('#browser .level-panel');
            const currentPanel=currentPanels[index];
            const currentTool=currentPanel?findEditTool(currentPanel,index):null;
            currentTool?.click();
          },30);
        });
        button.appendChild(pencil);
      });
    });
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
    enhancePencilEditing();
    const main=document.querySelector('main')||document.body;
    let scheduled=false;
    const observer=new MutationObserver(()=>{
      if(scheduled) return;
      scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;enhancePencilEditing();});
    });
    observer.observe(main,{subtree:true,childList:true});
    setTimeout(enhancePencilEditing,350);
  });
})();
