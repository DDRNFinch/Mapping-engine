(() => {
  'use strict';
  const state={catalog:null,course:null,routeManifest:null,route:null,pack:null,categories:[],registry:null,facets:null,evidenceRules:null,mode:null,criteria:[],hits:new Map(),group:null};
  const el=id=>document.getElementById(id); const uniq=xs=>[...new Set(xs||[])];
  async function fetchJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();}
  function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
  function baseDir(path){return String(path).replace(/[^/]*$/,'');}
  function childPath(packPath,path){if(!path)return null;if(/^https?:/i.test(path))return path;if(path.startsWith('packs/')||path==='evidence-rules.json'||path.startsWith('/'))return path.replace(/^\//,'');return baseDir(packPath)+path;}
  function flatTasks(categories){return (categories||[]).flatMap(c=>(c.subcategories||[]).flatMap(s=>(s.tasks||[]).map(t=>({t,c,s}))));}
  function allTasks(){return state.categories.flatMap(c=>(c.subcategories||[]).flatMap(s=>(s.tasks||[]).map(t=>({...t,categoryId:c.id,categoryTitle:c.title,subcategoryId:s.id,subcategoryTitle:s.title}))));}
  function parentAc(id){const p=String(id).split('.');return p.length>=3?`${p[0]}.${p[1]}.${p[2]}`:String(id);}
  function profile(task){const p=state.evidenceRules?.profiles||{};return p[task.evidenceProfile]||p.knowledge||{label:'Evidence',shortLabel:'Evidence'};}
  function compareKsbIds(a,b){const rank={K:0,S:1,B:2};const ar=rank[String(a)[0]]??9,br=rank[String(b)[0]]??9;return ar-br||String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});}

  function fillCourseSelect(){const s=el('courseSelect');s.innerHTML='';state.catalog.courses.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=`${c.type==='nvq'?'NVQ':'KSB'} · ${c.title}`;s.appendChild(o)});s.value=state.course.id;}
  function fillRouteSelect(){const box=el('routeControl'),s=el('routeSelect');if(state.course.type!=='nvq'){box.hidden=true;return;}box.hidden=false;s.innerHTML='';state.routeManifest.routes.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=`${r.optionalUnit} · ${r.title}`;s.appendChild(o)});s.value=state.route.id;}

  async function loadCourse(id,preferredRoute){
    state.course=state.catalog.courses.find(c=>c.id===id)||state.catalog.courses[0];fillCourseSelect();el('matrixDetail').hidden=true;
    if(state.course.type==='ksb') await loadKsb(); else await loadNvq(preferredRoute);
    renderGroups();renderMatrix();
  }

  async function loadKsb(){
    state.mode='ksb';state.routeManifest=null;state.route=null;fillRouteSelect();
    state.pack=await fetchJson(state.course.pack);
    const [registry,facets,evidenceRules,...cats]=await Promise.all([
      fetchJson(state.pack.ksbRegistry),fetchJson(state.pack.facetRegistry),fetchJson(state.pack.evidenceRules),...state.pack.categoryFiles.map(fetchJson)
    ]);
    state.registry=registry;state.facets=facets;state.evidenceRules=evidenceRules;state.categories=cats;
    const tasks=allTasks();state.hits=new Map();
    for(const id of Object.keys(registry.items)){state.hits.set(id,new Map());}
    tasks.forEach(t=>(t.ksbTargets||[]).forEach(id=>{if(!state.hits.has(id))state.hits.set(id,new Map());const m=state.hits.get(id);if(!m.has(t.categoryId))m.set(t.categoryId,[]);m.get(t.categoryId).push(t);}));
    state.criteria=Object.keys(registry.items).sort(compareKsbIds).map(id=>({id,group:id[0],text:registry.items[id]||'',atoms:[]}));
    state.group=state.group&&['K','S','B'].includes(state.group)?state.group:'K';
    el('matrixStatus').innerHTML=`<strong class="good">${state.pack.coverage.ksbCoverage}/${state.pack.coverage.ksbCount} KSBs mapped.</strong><p class="status-note">${state.pack.coverage.taskTypeCount}/125 task types. Compound KSB wording is also split into ${state.pack.coverage.internalEvidenceRequirementCount} internal a,b,c… evidence checks.</p>`;
  }

  async function loadNvq(preferredRoute){
    state.mode='nvq';state.registry=state.facets=null;
    state.routeManifest=await fetchJson(state.course.manifest);
    state.route=state.routeManifest.routes.find(r=>r.id===preferredRoute)
      ||state.routeManifest.routes.find(r=>r.id===state.routeManifest.defaultRoute)
      ||state.routeManifest.routes.find(r=>r.id==='repair')
      ||state.routeManifest.routes[0];
    fillRouteSelect();

    const packPath=state.route.pack;state.pack=await fetchJson(packPath);
    let cats=await Promise.all(state.pack.categoryFiles.map(p=>fetchJson(childPath(packPath,p))));
    cats=structuredClone(cats);
    const active=new Set(state.pack.route.activeUnits||[]);const keep=id=>active.has(String(id).split('.')[0]);

    let requiredTargets=null;
    const sourceFiles=state.pack.coverageSourceFiles||[];
    const requiredFiles=state.pack.requiredTargetFiles||[];
    const inline=state.pack.requiredAtomicTargets||[];
    if(sourceFiles.length||requiredFiles.length||inline.length){
      const sourceCats=sourceFiles.length?await Promise.all(sourceFiles.map(p=>fetchJson(childPath(packPath,p)))):[];
      const sourceIds=uniq(flatTasks(sourceCats).flatMap(({t})=>[...(t.directLo7Targets||[]),...(t.mappedAtomicTargets||[])])).filter(keep);
      const reqDocs=requiredFiles.length?await Promise.all(requiredFiles.map(p=>fetchJson(childPath(packPath,p)))):[];
      requiredTargets=uniq([...sourceIds,...reqDocs.flatMap(d=>d.targets||[]),...inline]).filter(keep);
    }

    const optionalUnit=String(state.pack.route.optionalUnit||'');
    const optionalCategory=cats.find(c=>String(c.id)==='5');
    if(optionalCategory&&state.course.id==='6570-04') optionalCategory.title=state.pack.route.title||optionalCategory.title;
    const flat=()=>flatTasks(cats);
    flat().forEach(({t})=>{
      if(t.primaryUnit==='OPTIONAL')t.primaryUnit=optionalUnit;
      t.directLo7Targets=uniq(t.directLo7Targets||[]).filter(keep);
      t.mappedAtomicTargets=uniq(t.mappedAtomicTargets||[]).filter(keep);
      if(requiredTargets&&(t.targetPrefixes||[]).length){
        const prefixes=t.targetPrefixes.map(p=>String(p).replaceAll('$OPTIONAL',optionalUnit));
        const matched=requiredTargets.filter(id=>prefixes.some(p=>id===p||id.startsWith(`${p}.`)));
        t.mappedAtomicTargets=uniq([...t.mappedAtomicTargets,...matched]).filter(keep);
      }
    });
    if(state.pack.routeMappings){const rm=await fetchJson(childPath(packPath,state.pack.routeMappings));for(const [taskId,ids] of Object.entries(rm.taskMappings||{})){const found=flat().find(x=>x.t.id===taskId);if(found)found.t.mappedAtomicTargets=uniq([...(found.t.mappedAtomicTargets||[]),...ids.filter(keep)]);}}

    state.categories=cats;
    const erPath=state.pack.evidenceRules||state.pack.evidence?.rulesFile||'evidence-rules.json';state.evidenceRules=await fetchJson(childPath(packPath,erPath));
    const tasks=allTasks();const parentAtoms=new Map();state.hits=new Map();
    tasks.forEach(t=>uniq([...(t.directLo7Targets||[]),...(t.mappedAtomicTargets||[])]).filter(keep).forEach(atom=>{const parent=parentAc(atom);if(!parentAtoms.has(parent))parentAtoms.set(parent,new Set());parentAtoms.get(parent).add(atom);if(!state.hits.has(parent))state.hits.set(parent,new Map());const m=state.hits.get(parent);if(!m.has(t.categoryId))m.set(t.categoryId,[]);m.get(t.categoryId).push(t);}));
    state.criteria=[...parentAtoms.entries()].map(([id,atoms])=>({id,group:id.split('.')[0],text:'',atoms:[...atoms].sort()})).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
    const units=state.pack.route.activeUnits||[];state.group=units.includes(state.group)?state.group:units[0];
    const atomicCount=requiredTargets?.length??state.pack.route.atomicTargetCount??uniq(tasks.flatMap(t=>[...(t.directLo7Targets||[]),...(t.mappedAtomicTargets||[])])).filter(keep).length;
    const atomNote=state.course.id==='6570-04'?' Every a, b, c… sub-criterion remains a separate atomic target.':'';
    el('matrixStatus').innerHTML=`<strong class="good">${atomicCount} active atomic criteria in this pathway.</strong><p class="status-note">Matrix rows are rolled up to parent AC level for fast IQA/EQA navigation. Click a dot to see the mapped learner tasks and the atomic IDs underneath.${atomNote}</p>`;
  }

  function renderGroups(){
    const s=el('groupSelect');s.innerHTML='';
    if(state.mode==='ksb'){
      el('groupLabel').textContent='KSB type';[['K','Knowledge'],['S','Skills'],['B','Behaviours']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;s.appendChild(o)});
    }else{
      el('groupLabel').textContent='Unit';(state.pack.route.activeUnits||[]).forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=`Unit ${v}`;s.appendChild(o)});
    }
    s.value=state.group;
  }

  function renderMatrix(){
    const search=el('matrixSearch').value.trim().toLowerCase();const rows=state.criteria.filter(c=>c.group===state.group && (!search||c.id.toLowerCase().includes(search)||c.text.toLowerCase().includes(search)));
    el('matrixHead').innerHTML=`<tr><th>Criterion</th>${state.categories.map(c=>`<th>Pack ${esc(c.id)}<span class="route-name">${esc(c.title)}</span></th>`).join('')}</tr>`;
    el('matrixBody').innerHTML=rows.map(c=>{
      const cells=state.categories.map(cat=>{const hits=state.hits.get(c.id)?.get(cat.id)||[];return hits.length?`<td><button class="matrix-dot" data-criterion="${esc(c.id)}" data-category="${esc(cat.id)}" title="${hits.length} mapped task${hits.length===1?'':'s'}"><strong>•</strong>${hits.length>1?`<small>${hits.length}</small>`:''}</button></td>`:`<td><span class="matrix-dot empty">·</span></td>`}).join('');
      const text=c.text?`<span class="criterion-text">${esc(c.text)}</span>`:c.atoms.length?`<span class="criterion-text">${c.atoms.length} atomic target${c.atoms.length===1?'':'s'}</span>`:'';
      return `<tr><td><span class="criterion-code">${esc(c.id)}</span>${text}</td>${cells}</tr>`;
    }).join('');
    document.querySelectorAll('.matrix-dot[data-criterion]').forEach(b=>b.addEventListener('click',()=>showDetail(b.dataset.criterion,b.dataset.category)));
    const mappedCells=rows.reduce((n,c)=>n+state.categories.filter(cat=>(state.hits.get(c.id)?.get(cat.id)||[]).length).length,0);
    el('matrixSummary').innerHTML=`<span><strong>${rows.length}</strong> rows shown</span><span><strong>${mappedCells}</strong> evidence-pack links</span><span>• = evidence exists in that pack</span>`;
  }

  function showDetail(criterionId,categoryId){
    const c=state.criteria.find(x=>x.id===criterionId),cat=state.categories.find(x=>x.id===categoryId),hits=state.hits.get(criterionId)?.get(categoryId)||[];const d=el('matrixDetail');d.hidden=false;
    const facets=state.mode==='ksb'?(state.facets?.items?.[criterionId]||[]):[];
    const facetHtml=facets.length?`<details><summary>Internal a,b,c… evidence checks</summary><ul class="facet-list">${facets.map(([l,t])=>`<li><strong>${esc(criterionId)}.${esc(l)}</strong> — ${esc(t)}</li>`).join('')}</ul></details>`:'';
    const atomHtml=state.mode==='nvq'&&c.atoms.length?`<details><summary>Atomic IDs under ${esc(c.id)}</summary><div class="requirement-list">${c.atoms.map(a=>`<span class="requirement-chip">${esc(a)}</span>`).join('')}</div></details>`:'';
    d.innerHTML=`<p class="eyebrow">Pack ${esc(cat.id)} · ${esc(cat.title)}</p><h2>${esc(c.id)}</h2>${c.text?`<p>${esc(c.text)}</p>`:''}${facetHtml}${atomHtml}<h3>Evidence routes</h3>${hits.map(t=>{
      const related=state.mode==='ksb'?(t.evidenceRequirements||[]).filter(x=>x===criterionId||x.startsWith(`${criterionId}.`)):uniq([...(t.directLo7Targets||[]),...(t.mappedAtomicTargets||[])]).filter(x=>parentAc(x)===criterionId);
      return `<div class="task-hit"><strong>${esc(t.id)} · ${esc(t.title)}</strong><p>${esc(t.subcategoryTitle)} · <span class="mini-chip">${esc(profile(t).shortLabel||profile(t).label)}</span></p>${related.length?`<p>Mapped checks: ${related.map(esc).join(', ')}</p>`:''}</div>`;
    }).join('')}`;
    d.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  async function start(){
    try{
      state.catalog=await fetchJson('course-catalog.json');const qs=new URLSearchParams(location.search);const wanted=qs.get('course');state.course=state.catalog.courses.find(c=>c.id===wanted)||state.catalog.courses[0];
      fillCourseSelect();el('courseSelect').addEventListener('change',()=>{state.group=null;loadCourse(el('courseSelect').value)});el('routeSelect').addEventListener('change',()=>{state.group=null;loadCourse(state.course.id,el('routeSelect').value)});el('groupSelect').addEventListener('change',()=>{state.group=el('groupSelect').value;el('matrixDetail').hidden=true;renderMatrix()});el('matrixSearch').addEventListener('input',renderMatrix);
      await loadCourse(state.course.id,qs.get('route'));
    }catch(err){console.error(err);el('matrixStatus').innerHTML=`<strong class="warn">Could not load the evidence matrix.</strong><p class="status-note">${esc(err.message)}</p>`;}
  }
  start();
})();