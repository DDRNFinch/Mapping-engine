(() => {
  'use strict';

  const state = { manifest:null, course:null, pack:null, registry:null, facets:null, evidenceRules:null, categories:[], categoryId:null, subcategoryId:null, taskId:null, audit:null };
  const el = id => document.getElementById(id);
  const byId = (items,id) => items.find(x => x.id === id);
  const uniq = xs => [...new Set(xs || [])];

  async function fetchJson(path){ const r=await fetch(path,{cache:'no-store'}); if(!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
  function esc(v){ return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function taskList(){ return state.categories.flatMap(c => c.subcategories||[]).flatMap(s => s.tasks||[]); }
  function ksbType(id){ return String(id).startsWith('K')?'Knowledge':String(id).startsWith('S')?'Skill':'Behaviour'; }

  function expectedRequirements(){
    const ids = Object.keys(state.registry?.items || {});
    const f = state.facets?.items || {};
    return ids.flatMap(id => (f[id]?.length ? f[id].map(([letter]) => `${id}.${letter}`) : [id]));
  }

  function runAudit(){
    const tasks = taskList();
    const ksbs = new Set(tasks.flatMap(t => t.ksbTargets || []));
    const reqs = new Set(tasks.flatMap(t => t.evidenceRequirements || []));
    const expectedK = Object.keys(state.registry?.items || {});
    const expectedR = expectedRequirements();
    const structurePass = state.categories.length <= 5 && state.categories.every(c => (c.subcategories||[]).length <= 5 && (c.subcategories||[]).every(s => (s.tasks||[]).length <= 5));
    const ksbPass = expectedK.every(id => ksbs.has(id)) && ksbs.size === expectedK.length;
    const requirementPass = expectedR.every(id => reqs.has(id)) && reqs.size === expectedR.length;
    state.audit = {
      categories:state.categories.length,
      subcategories:state.categories.reduce((n,c)=>n+(c.subcategories||[]).length,0),
      tasks:tasks.length,
      ksbMapped:ksbs.size, ksbExpected:expectedK.length,
      requirementsMapped:reqs.size, requirementsExpected:expectedR.length,
      orphanKSBs:expectedK.filter(id=>!ksbs.has(id)),
      orphanRequirements:expectedR.filter(id=>!reqs.has(id)),
      structurePass, ksbPass, requirementPass,
      pass:structurePass && ksbPass && requirementPass
    };
    return state.audit;
  }

  function renderCourseSelect(){
    const select=el('courseSelect'); select.innerHTML='';
    for(const c of state.manifest.courses){ const o=document.createElement('option'); o.value=c.id; o.textContent=c.title; select.appendChild(o); }
    select.value=state.course.id;
  }

  function renderStatus(){
    const a=state.audit||runAudit();
    el('statusPanel').innerHTML=`
      <div class="status-grid">
        <div class="metric"><strong>${a.categories}/5</strong><span>main routes</span></div>
        <div class="metric"><strong>${a.subcategories}/25</strong><span>sub-categories</span></div>
        <div class="metric"><strong>${a.tasks}/125</strong><span>task types</span></div>
        <div class="metric"><strong>${a.ksbMapped}/${a.ksbExpected}</strong><span>KSBs mapped</span></div>
        <div class="metric"><strong>${a.requirementsMapped}/${a.requirementsExpected}</strong><span>a,b,c evidence checks</span></div>
      </div>
      <p class="status-note ${a.pass?'good':'warn'}"><strong>${a.pass?'Structure and coverage audit passed.':'Audit failed — QR export is blocked.'}</strong> Compound KSBs use internal a,b,c… evidence facets so one broad KSB cannot be ticked from unrelated evidence.</p>`;
    el('browser').hidden=false; el('exportPanel').hidden=false; el('generateQr').disabled=!a.pass;
  }

  function navButton(text,onClick,active,small){
    const b=document.createElement('button'); b.className=`nav-button${active?' active':''}`;
    b.innerHTML=`<span>${esc(text)}${small?`<small>${esc(small)}</small>`:''}</span>`; b.onclick=onClick; return b;
  }

  function renderBrowser(){
    if(!state.categories.length) return;
    if(!state.categoryId) state.categoryId=state.categories[0].id;
    const category=byId(state.categories,state.categoryId)||state.categories[0]; state.categoryId=category.id;
    if(!state.subcategoryId || !byId(category.subcategories,state.subcategoryId)) state.subcategoryId=category.subcategories[0].id;
    const sub=byId(category.subcategories,state.subcategoryId);
    if(!state.taskId || !byId(sub.tasks,state.taskId)) state.taskId=sub.tasks[0].id;

    const cw=el('categories'); cw.innerHTML='';
    state.categories.forEach(c=>cw.appendChild(navButton(c.title,()=>{state.categoryId=c.id;state.subcategoryId=null;state.taskId=null;renderBrowser();},c.id===state.categoryId,`${c.subcategories.length} sub-categories`)));
    el('categoryCount').textContent=`${state.categories.length}/5`;

    const sw=el('subcategories'); sw.innerHTML='';
    category.subcategories.forEach(s=>sw.appendChild(navButton(s.title,()=>{state.subcategoryId=s.id;state.taskId=null;renderBrowser();},s.id===state.subcategoryId,`${s.tasks.length} tasks`)));
    el('subcategoryCount').textContent=`${category.subcategories.length}/5`;

    const tw=el('tasks'); tw.innerHTML='';
    sub.tasks.forEach(t=>tw.appendChild(navButton(t.title,()=>{state.taskId=t.id;renderBrowser();},t.id===state.taskId,`${(t.ksbTargets||[]).length} KSBs · ${profile(t).shortLabel||profile(t).label}`)));
    el('taskCount').textContent=`${sub.tasks.length}/5`;
    renderTask(category,sub,byId(sub.tasks,state.taskId));
  }

  function profile(task){
    const p=state.evidenceRules?.profiles||{};
    return p[task.evidenceProfile] || p.knowledge || {label:'Evidence',shortLabel:'Evidence',preferred:[],alternatives:[],capture:[]};
  }
  function evidenceChip(type){ const names={video:'Video',photos:'Photos',photo:'Photo',document:'Document',audio:'Audio',written:'Written statement',witness:'Witness statement',observation:'Assessor observation'}; return `<span class="evidence-chip">${esc(names[type]||type)}</span>`; }

  function renderEvidence(task){
    const p=profile(task); el('evidencePlan').hidden=false; el('evidenceProfileTitle').textContent=p.label;
    el('oneSubmissionNote').textContent=p.oneSubmissionNote||'One strong submission can support several KSBs when it genuinely demonstrates them.';
    el('evidenceMinimum').innerHTML=(p.preferred||[]).map(x=>`<div class="evidence-item"><div class="evidence-item-head">${evidenceChip(x.type)} <strong>${esc(x.label)}</strong></div><p>${esc(x.instruction)}</p></div>`).join('');
    el('evidenceAlternatives').innerHTML=(p.alternatives||[]).map(x=>`<div class="alternative-box"><strong>${esc(x.label)}</strong><p>${esc(x.instruction)}</p></div>`).join('');
    const capture=[...(p.capture||[])]; if(task.conditionalPrompt) capture.push(task.conditionalPrompt);
    el('evidenceCapture').innerHTML=capture.map(x=>`<li>${esc(x)}</li>`).join('');
    el('evidenceCoverageText').textContent=`This submission can support ${(task.ksbTargets||[]).length} KSBs and ${(task.evidenceRequirements||[]).length} detailed evidence checks. Only what is actually demonstrated is awarded.`;
  }

  function renderTask(category,sub,task){
    if(!task){el('taskDetail').hidden=true;return;} el('taskDetail').hidden=false;
    el('taskPath').textContent=`Route ${category.id} · ${category.title} › ${sub.title} › ${task.id}`; el('taskTitle').textContent=task.title; el('mappedCount').textContent=(task.ksbTargets||[]).length;
    el('taskMeta').innerHTML=`
      <div class="meta-item"><strong>Main route</strong>${esc(category.id)} · ${esc(category.title)}</div>
      <div class="meta-item"><strong>Evidence method</strong>${esc(profile(task).shortLabel||profile(task).label)}</div>
      <div class="meta-item"><strong>KSB candidates</strong>${(task.ksbTargets||[]).length}</div>
      <div class="meta-item"><strong>Detailed checks</strong>${(task.evidenceRequirements||[]).length}</div>
      <div class="meta-item"><strong>Course</strong>${esc(state.pack.qualification.id)} v${esc(state.pack.qualification.version)}</div>
      <div class="meta-item"><strong>Mapping</strong>Holistic · evidence-led</div>`;
    renderEvidence(task);
    const pb=el('promptBox'); if(task.conditionalPrompt){pb.hidden=false;el('taskPrompt').textContent=task.conditionalPrompt}else pb.hidden=true;

    const klist=el('ksbList'); klist.innerHTML='';
    (task.ksbTargets||[]).forEach(id=>{ const d=document.createElement('div'); d.className='ksb-row'; d.innerHTML=`<strong>${esc(id)}</strong> <span class="facet-note">${ksbType(id)}</span><p class="ksb-wording">${esc(state.registry.items[id]||'')}</p>`; klist.appendChild(d); });
    const rlist=el('requirementList'); rlist.innerHTML='';
    (task.evidenceRequirements||[]).forEach(id=>{ const s=document.createElement('span'); s.className='requirement-chip'; s.textContent=id; s.title=requirementText(id); rlist.appendChild(s); });
  }

  function requirementText(id){
    const m=String(id).match(/^([KSB]\d+)\.([a-z]+)$/i); if(!m) return state.registry?.items?.[id]||'';
    const rows=state.facets?.items?.[m[1]]||[]; return rows.find(x=>x[0]===m[2])?.[1]||'';
  }

  function packUrl(){ return new URL(state.course.pack,new URL('./',window.location.href)).href; }

  function compactEvidenceForExport(evidence){
    if(!evidence || typeof evidence!=='object') return null;
    const preferred=(evidence.preferred||[]).map(item=>({
      type:String(item?.type||'').trim(),
      label:String(item?.label||'').trim(),
      instruction:String(item?.instruction||'').trim()
    })).filter(item=>item.type||item.label||item.instruction);
    const result={};
    if(String(evidence.profileId||'').trim()) result.profileId=String(evidence.profileId).trim();
    if(preferred.length) result.preferred=preferred;
    return Object.keys(result).length?result:null;
  }

  function editorStoreForExport(){
    try{
      const liveGetter=window.NaxosEditor?.getKsbCustomisations;
      if(typeof liveGetter==='function'){
        const liveStore=liveGetter(state.course.id);
        if(liveStore && typeof liveStore==='object') return liveStore;
      }
      const key=`naxos-editor-v1:ksb:${state.course.id}:default`;
      const saved=JSON.parse(localStorage.getItem(key)||'null');
      return saved && typeof saved==='object' ? saved : null;
    }catch(error){
      console.error('Could not read Naxos editor state for export',error);
      return null;
    }
  }

  function exportCustomisations(){
    try{
      const store=editorStoreForExport();
      if(!store || typeof store!=='object') return null;
      const titles={category:{},subcategory:{},task:{}};
      for(const group of ['category','subcategory','task']){
        for(const [id,value] of Object.entries(store.titles?.[group]||{})){
          const clean=String(value||'').trim();
          if(clean) titles[group][id]=clean;
        }
      }
      const taskEdits={};
      for(const [id,edit] of Object.entries(store.taskEdits||{})){
        const evidence=compactEvidenceForExport(edit?.evidence);
        if(evidence) taskEdits[id]={evidence};
      }
      const customTasks=(Array.isArray(store.customTasks)?store.customTasks:[]).map(task=>({
        id:String(task?.id||''),
        categoryIndex:Number(task?.categoryIndex),
        subcategoryIndex:Number(task?.subcategoryIndex),
        title:String(task?.title||'').trim(),
        targets:Array.isArray(task?.targets)?task.targets.map(String):[],
        evidence:compactEvidenceForExport(task?.evidence),
        evidenceRequirements:Array.isArray(task?.evidenceRequirements)?task.evidenceRequirements.map(String):[]
      })).filter(task=>Number.isInteger(task.categoryIndex)&&Number.isInteger(task.subcategoryIndex)&&task.title&&task.targets.length);
      const hasTitles=Object.values(titles).some(group=>Object.keys(group).length);
      if(!hasTitles&&!Object.keys(taskEdits).length&&!customTasks.length) return null;
      return {version:1,titles,taskEdits,customTasks};
    }catch(error){
      console.error('Could not prepare Naxos customisations for export',error);
      return null;
    }
  }

  function renderExport(){
    const url=packUrl(); el('downloadPack').href=url; el('openMatrix').href=`matrix.html?course=${encodeURIComponent(state.course.id)}`;
    el('generateQr').onclick=()=>{
      if(!state.audit?.pass) return;
      const data={type:'evia-mapping-pack-url-v1',version:1,courseType:'ksb',courseId:state.course.id,standardVersion:state.course.version,packUrl:url};
      const customisations=exportCustomisations();
      if(customisations) data.customisations=customisations;
      const payload=JSON.stringify(data);
      el('qrPayload').value=payload; el('qrcode').innerHTML='';
      if(typeof QRCode!=='function'){alert('QR library did not load.');return;}
      try{
        new QRCode(el('qrcode'),{text:payload,width:240,height:240,correctLevel:QRCode.CorrectLevel.M});
      }catch(error){
        console.error('Could not create Naxos QR',error);
        alert('This customised course QR is too large. Reduce the number of custom tasks or shorten the custom evidence text and try again.');
        return;
      }
      el('qrArea').hidden=false;
    };
    el('copyPayload').onclick=async()=>{await navigator.clipboard.writeText(el('qrPayload').value);el('copyPayload').textContent='Copied';setTimeout(()=>el('copyPayload').textContent='Copy payload',1000);};
  }

  async function loadCourse(id){
    state.course=state.manifest.courses.find(c=>c.id===id)||state.manifest.courses[0];
    const selectedPackUrl=packUrl();
    state.pack=await fetchJson(selectedPackUrl);
    const packDir=new URL('./',selectedPackUrl).href;
    const resolvePackPath=path=>new URL(path,packDir).href;
    const [registry,facets,evidenceRules,...categories]=await Promise.all([
      fetchJson(resolvePackPath(state.pack.ksbRegistry)),
      fetchJson(resolvePackPath(state.pack.facetRegistry)),
      fetchJson(resolvePackPath(state.pack.evidenceRules)),
      ...state.pack.categoryFiles.map(path=>fetchJson(resolvePackPath(path)))
    ]);
    state.registry=registry; state.facets=facets; state.evidenceRules=evidenceRules; state.categories=categories;
    state.categoryId=state.subcategoryId=state.taskId=null; state.audit=runAudit();
    renderCourseSelect(); renderStatus(); renderBrowser(); renderExport(); el('qrArea').hidden=true;
  }

  async function start(){
    try{
      state.manifest=await fetchJson('ksb-manifest.json'); state.course=state.manifest.courses[0]; renderCourseSelect();
      el('courseSelect').addEventListener('change',()=>loadCourse(el('courseSelect').value));
      await loadCourse(state.course.id);
    }catch(err){ console.error(err); el('statusPanel').innerHTML=`<strong class="warn">Could not load the KSB mapping data.</strong><p class="status-note">${esc(err.message)}</p>`; }
  }
  start();
})();