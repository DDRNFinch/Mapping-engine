(()=>{
  'use strict';

  const page=()=>{
    const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    if(file.startsWith('ksb')) return {key:'ksb',title:'KSB Mapping Engine'};
    if(file.startsWith('matrix')) return {key:'matrix',title:'Evidence Matrix'};
    return {key:'nvq',title:'NVQ Mapping Engine'};
  };

  const arch=(href,label,sub,key,current,install=false)=>{
    const tag=install?'button':'a';
    const hrefAttr=install?'type="button" data-naxos-install-proxy':`href="${href}"`;
    return `<${tag} class="naxos-dock-item${key===current?' is-active':''}" ${hrefAttr} aria-label="${label} ${sub}">
      <svg viewBox="0 0 108 72" aria-hidden="true"><path class="naxos-arch-track" pathLength="100" d="M10 62 A44 44 0 0 1 98 62"/><path class="naxos-arch-value" pathLength="100" d="M10 62 A44 44 0 0 1 98 62"/></svg>
      <span class="naxos-dock-label">${label}</span><span class="naxos-dock-sub">${sub}</span>
    </${tag}>`;
  };

  function init(){
    if(document.body.dataset.naxosEviaShell==='1') return;
    document.body.dataset.naxosEviaShell='1';
    document.body.classList.add('naxos-shell');

    const view=page();
    const sourceTitle=document.querySelector('.brand-copy h1')?.textContent?.trim()||view.title;

    const ambientOne=document.createElement('div');
    ambientOne.className='naxos-ambient naxos-ambient-one';
    const ambientTwo=document.createElement('div');
    ambientTwo.className='naxos-ambient naxos-ambient-two';
    document.body.append(ambientOne,ambientTwo);

    const top=document.createElement('div');
    top.className='naxos-top';
    top.innerHTML=`<b>Naxos</b><small>${sourceTitle}</small>`;
    document.body.appendChild(top);

    const anchor=document.createElement('button');
    anchor.type='button';
    anchor.className='naxos-anchor';
    anchor.setAttribute('aria-label','Open Naxos');
    anchor.setAttribute('aria-expanded','false');
    anchor.innerHTML='<span class="naxos-float"><span class="naxos-halo"></span><span class="naxos-face"><span class="naxos-eyes"><span class="naxos-eye"></span><span class="naxos-eye"></span></span></span></span>';
    document.body.appendChild(anchor);

    const invite=document.createElement('div');
    invite.className='naxos-invite';
    invite.textContent='Tap Naxos';
    document.body.appendChild(invite);

    const dock=document.createElement('nav');
    dock.className='naxos-progress-dock';
    dock.setAttribute('aria-label','Naxos sections');
    dock.innerHTML=`<div class="naxos-progress-row">
      ${arch('index.html?course=6570-04','NVQ','Courses','nvq',view.key)}
      ${arch('ksb.html','KSB','Courses','ksb',view.key)}
      ${arch('matrix.html?course=6570-05','MAP','Matrix','matrix',view.key)}
      ${arch('#','APP','Install','app',view.key,true)}
    </div>`;
    document.body.appendChild(dock);

    const main=document.querySelector('main');
    if(main){
      const context=document.createElement('section');
      context.className='naxos-context';
      const tabs=document.querySelector('.qualification-tabs');
      const route=document.querySelector('.route-box');
      if(tabs) context.appendChild(tabs);
      if(route) context.appendChild(route);
      if(context.children.length) main.prepend(context);
    }

    const open=()=>{
      document.body.classList.add('naxos-open');
      anchor.setAttribute('aria-expanded','true');
      anchor.setAttribute('aria-label','Close Naxos');
    };
    const close=()=>{
      document.body.classList.remove('naxos-open');
      anchor.setAttribute('aria-expanded','false');
      anchor.setAttribute('aria-label','Open Naxos');
    };
    const toggle=()=>document.body.classList.contains('naxos-open')?close():open();
    anchor.addEventListener('click',toggle);

    dock.querySelectorAll('.naxos-dock-item.is-active').forEach(item=>{
      item.addEventListener('click',event=>{
        if(!document.body.classList.contains('naxos-open')){
          event.preventDefault();
          open();
        }
      });
    });

    dock.querySelector('[data-naxos-install-proxy]')?.addEventListener('click',()=>{
      const actual=document.getElementById('naxosInstall');
      if(actual){actual.click();return;}
      const fallback=document.querySelector('.naxos-install');
      if(fallback) fallback.click();
    });

    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&document.body.classList.contains('naxos-open')) close();
    });

    if(location.hash) open();
    requestAnimationFrame(()=>document.body.classList.add('naxos-ready'));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
