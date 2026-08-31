(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const mode = $('courseSelect') ? 'ksb' : ($('routeSelect') ? 'nvq' : null);
  if (!mode) return;

  const EVIDENCE_TYPES = ['video','photos','photo','document','audio','written','witness','observation'];
  const TYPE_LABELS = {video:'Video',photos:'Photos',photo:'Photo',document:'Document',audio:'Audio',written:'Written statement',witness:'Witness statement',observation:'Assessor observation'};
  let ctx = null;
  let contextSignature = '';
  let loading = false;
  let activeCustomId = null;
  let scheduled = false;
  let editorState = null;

  const esc = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const uniq = items => [...new Set(items || [])];
  const fetchJson = async path => {
    const response = await fetch(path, { cache:'no-store' });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  };
  const abs = (path, base = window.location.href) => new URL(path, base).href;

  function injectStyles() {
    if ($('naxosEditorStyles')) return;
    const style = document.createElement('style');
    style.id = 'naxosEditorStyles';
    style.textContent = `
      .naxos-edit-tools{display:grid;grid-template-columns:1fr;gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
      .naxos-edit-tools button{min-height:38px;padding:8px 11px;font-size:12px}
      .naxos-custom-task{border-style:dashed!important}
      .naxos-custom-task small::after{content:' · Custom';color:var(--red-deep);font-weight:750}
      .naxos-editor-page{background:#fff;border:1px solid var(--line);border-radius:24px;box-shadow:var(--shadow);padding:16px;margin-bottom:14px}
      .naxos-editor-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
      .naxos-editor-heading h2{margin-bottom:4px}.naxos-editor-heading p{margin:0;color:var(--muted);font-size:13px;line-height:1.4}
      .naxos-editor-grid{display:grid;gap:14px}.naxos-editor-card{padding:14px;border:1px solid var(--line);border-radius:18px;background:#fff}
      .naxos-editor-card>label,.naxos-editor-card .field-label{display:block;margin-bottom:6px;color:#8a7c80;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.065em}
      .naxos-editor-card input[type=text],.naxos-editor-card input[type=search],.naxos-editor-card select,.naxos-editor-card textarea{width:100%;border:1px solid rgba(58,43,46,.11);border-radius:14px;padding:11px 12px;background:#fff;color:var(--ink);outline:none}
      .naxos-editor-card textarea{min-height:78px;margin:0;resize:vertical}.naxos-editor-help{margin:7px 0 0;color:var(--muted);font-size:12px;line-height:1.4}
      .naxos-target-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:9px}.naxos-target-toolbar input{flex:1}.naxos-selected-count{white-space:nowrap;color:var(--muted);font-size:12px;font-weight:700}
      .naxos-target-list{display:grid;gap:7px;max-height:330px;overflow:auto;padding-right:2px}.naxos-target-option{display:flex;gap:9px;align-items:flex-start;padding:10px;border:1px solid var(--line);border-radius:14px;background:#fff}
      .naxos-target-option input{width:18px;height:18px;flex:0 0 auto;margin-top:2px;accent-color:var(--red)}.naxos-target-option strong{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.naxos-target-option span{display:block;margin-top:3px;color:var(--muted);font-size:12px;line-height:1.35}
      .naxos-evidence-top{display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:10px}.naxos-evidence-rows{display:grid;gap:9px}.naxos-evidence-row{padding:11px;border:1px solid var(--line);border-radius:15px;background:var(--red-pale)}
      .naxos-evidence-row-top{display:grid;grid-template-columns:minmax(105px,.75fr) 1.25fr auto;gap:7px;align-items:center}.naxos-evidence-row .remove{min-height:40px;padding:7px 10px;background:#fff;color:#8e4b4e;border-color:var(--line);box-shadow:none}
      .naxos-evidence-row textarea{margin-top:7px;background:#fff}.naxos-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.naxos-editor-actions .save{grid-column:1/-1}
      .naxos-inline-note{padding:10px 12px;border:1px solid rgba(232,82,88,.16);border-radius:14px;background:var(--red-soft);color:#7b575a;font-size:12px;line-height:1.4}
      @media(min-width:700px){.naxos-edit-tools{grid-template-columns:repeat(2,minmax(0,1fr))}.naxos-editor-grid{grid-template-columns:1fr 1fr}.naxos-editor-card.full{grid-column:1/-1}.naxos-evidence-top{grid-template-columns:1fr auto}.naxos-editor-actions{display:flex;justify-content:flex-end}.naxos-editor-actions .save{grid-column:auto;order:3}}
      @media(max-width:520px){.naxos-evidence-row-top{grid-template-columns:1fr 1fr}.naxos-evidence-row-top .remove{grid-column:1/-1}.naxos-editor-heading{display:block}.naxos-editor-heading>button{margin-top:10px;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureEditorPage() {
    if ($('naxosTaskEditor')) return $('naxosTaskEditor');
    const section = document.createElement('section');
    section.id = 'naxosTaskEditor';
    section.className = 'naxos-editor-page';
    section.hidden = true;
    section.innerHTML = `
      <div class="naxos-editor-heading">
        <div><p class="eyebrow">Naxos task editor</p><h2 id="naxosEditorTitle">Add task</h2><p id="naxosEditorSubtitle"></p></div>
        <button type="button" id="naxosEditorClose" class="secondary compact">Back to mapping</button>
      </div>
      <div class="naxos-editor-grid">
        <div class="naxos-editor-card full">
          <label for="naxosTaskName">Task / section title</label>
          <input id="naxosTaskName" type="text" autocomplete="off" placeholder="Enter the task title">
          <p class="naxos-editor-help">You can rename this again at any time.</p>
        </div>
        <div class="naxos-editor-card full">
          <span class="field-label" id="naxosTargetLabel">KSBs / ACs</span>
          <div id="naxosLockedMappingNote" class="naxos-inline-note" hidden>Existing mapped criteria stay unchanged. You can edit the title and evidence requirements here.</div>
          <div class="naxos-target-toolbar"><input id="naxosTargetSearch" type="search" placeholder="Search IDs or wording"><span id="naxosSelectedCount" class="naxos-selected-count">0 selected</span></div>
          <div id="naxosTargetList" class="naxos-target-list"></div>
        </div>
        <div class="naxos-editor-card full">
          <span class="field-label">Evidence requirements</span>
          <div class="naxos-evidence-top">
            <select id="naxosProfileSelect" aria-label="Evidence profile"></select>
            <button type="button" id="naxosSuggestEvidence" class="secondary">Use Naxos suggestion</button>
          </div>
          <p class="naxos-editor-help">Naxos chooses a starting evidence plan. You can change the evidence type, quantity/label and instruction before saving.</p>
          <div id="naxosEvidenceRows" class="naxos-evidence-rows"></div>
          <button type="button" id="naxosAddEvidence" class="secondary" style="margin-top:9px;width:100%">Add evidence requirement</button>
        </div>
      </div>
      <div class="naxos-editor-actions">
        <button type="button" id="naxosCancelEditor" class="secondary">Cancel</button>
        <button type="button" id="naxosSaveTask" class="save">Save task</button>
      </div>`;
    const browser = $('browser');
    if (browser?.parentNode) browser.parentNode.insertBefore(section, browser);
    else document.querySelector('main')?.appendChild(section);
    $('naxosEditorClose').onclick = closeEditor;
    $('naxosCancelEditor').onclick = closeEditor;
    $('naxosSaveTask').onclick = saveEditor;
    $('naxosSuggestEvidence').onclick = useSuggestedEvidence;
    $('naxosAddEvidence').onclick = () => { editorState.evidenceManuallyChanged = true; editorState.rows.push({type:'photo',label:'1 photo',instruction:''}); renderEvidenceRows(); };
    $('naxosProfileSelect').onchange = () => { if (editorState) editorState.evidenceManuallyChanged = true; useProfile($('naxosProfileSelect').value); };
    $('naxosTargetSearch').oninput = filterTargets;
    return section;
  }

  function currentSignature() {
    if (mode === 'ksb') return `ksb:${$('courseSelect')?.value || ''}`;
    const course = new URLSearchParams(location.search).get('course') || '6570-05';
    return `nvq:${course}:${$('routeSelect')?.value || ''}`;
  }

  async function loadNvqContext() {
    const params = new URLSearchParams(location.search);
    const courseId = params.get('course') || '6570-05';
    const manifest = await fetchJson(courseId === '6570-04' ? 'manifest-6570-04.json' : 'manifest.json');
    const routeId = $('routeSelect')?.value || manifest.defaultRoute || manifest.routes[0]?.id;
    const route = manifest.routes.find(r => r.id === routeId) || manifest.routes[0];
    if (!route?.pack) throw new Error('No mapping pack configured for this route.');
    const packUrl = abs(route.pack, abs('./'));
    const pack = await fetchJson(packUrl);
    const packDir = abs('./', packUrl);
    const categories = await Promise.all((pack.categoryFiles || []).map(path => fetchJson(abs(path, packDir))));
    const routeMappings = pack.routeMappings ? await fetchJson(abs(pack.routeMappings, packDir)) : null;
    const activeUnits = new Set(pack.route?.activeUnits || []);
    const optionalUnit = String(pack.route?.optionalUnit || '');
    const keep = id => !activeUnits.size || activeUnits.has(String(id || '').split('.')[0]);
    const rawTaskList = cats => cats.flatMap(c => c.subcategories || []).flatMap(s => s.tasks || []);
    const rawTargets = cats => uniq(rawTaskList(cats).flatMap(t => [...(t.directLo7Targets || []), ...(t.mappedAtomicTargets || [])])).filter(keep);
    const required = [...(pack.requiredAtomicTargets || [])];

    for (const path of pack.requiredTargetFiles || []) {
      const file = await fetchJson(abs(path, packDir));
      required.push(...(file.targets || []));
    }
    for (const path of pack.coverageSourceFiles || []) {
      const file = await fetchJson(abs(path, packDir));
      required.push(...rawTargets([file]));
    }
    for (const sourcePath of pack.coverageSourcePacks || []) {
      const sourceUrl = abs(sourcePath, packDir);
      const sourcePack = await fetchJson(sourceUrl);
      const sourceDir = abs('./', sourceUrl);
      const sourceCats = await Promise.all((sourcePack.categoryFiles || []).map(path => fetchJson(abs(path, sourceDir))));
      if (sourcePack.routeMappings) {
        const mappings = await fetchJson(abs(sourcePack.routeMappings, sourceDir));
        for (const [taskId, ids] of Object.entries(mappings.taskMappings || {})) {
          const task = rawTaskList(sourceCats).find(t => t.id === taskId);
          if (task) task.mappedAtomicTargets = uniq([...(task.mappedAtomicTargets || []), ...ids]);
        }
      }
      required.push(...rawTargets(sourceCats));
    }

    const requiredSet = new Set(uniq(required).filter(keep));
    for (const task of rawTaskList(categories)) {
      if (task.primaryUnit === 'OPTIONAL') task.primaryUnit = optionalUnit;
      task.directLo7Targets = uniq(task.directLo7Targets || []).filter(keep);
      task.mappedAtomicTargets = uniq(task.mappedAtomicTargets || []).filter(keep);
      if (requiredSet.size && (task.targetPrefixes || []).length) {
        const prefixes = task.targetPrefixes.map(prefix => String(prefix).replaceAll('$OPTIONAL', optionalUnit));
        const matched = [...requiredSet].filter(id => prefixes.some(prefix => id === prefix || id.startsWith(`${prefix}.`)));
        task.mappedAtomicTargets = uniq([...task.mappedAtomicTargets, ...matched]);
      }
    }
    for (const [taskId, ids] of Object.entries(routeMappings?.taskMappings || {})) {
      const task = rawTaskList(categories).find(t => t.id === taskId);
      if (task) task.mappedAtomicTargets = uniq([...(task.mappedAtomicTargets || []), ...ids.filter(keep)]);
    }
    const availableTargets = uniq([
      ...rawTargets(categories),
      ...requiredSet,
      ...Object.values(routeMappings?.taskMappings || {}).flat()
    ]).filter(keep).sort(naturalCompare);
    const evidenceRules = await fetchJson('evidence-rules.json');
    return { mode:'nvq', courseId, routeId:route.id, pack, categories, availableTargets, registry:null, facets:null, profiles:evidenceRules.profiles || {} };
  }

  async function loadKsbContext() {
    const manifest = await fetchJson('ksb-manifest.json');
    const courseId = $('courseSelect')?.value || manifest.courses[0]?.id;
    const course = manifest.courses.find(c => c.id === courseId) || manifest.courses[0];
    const packUrl = abs(course.pack, abs('./'));
    const pack = await fetchJson(packUrl);
    const packDir = abs('./', packUrl);
    const [registry, facets, evidenceRules, ...categories] = await Promise.all([
      fetchJson(abs(pack.ksbRegistry, packDir)),
      fetchJson(abs(pack.facetRegistry, packDir)),
      fetchJson(abs(pack.evidenceRules, packDir)),
      ...(pack.categoryFiles || []).map(path => fetchJson(abs(path, packDir)))
    ]);
    const availableTargets = Object.keys(registry.items || {}).sort(naturalCompare);
    return { mode:'ksb', courseId:course.id, routeId:'', pack, categories, availableTargets, registry, facets, profiles:evidenceRules.profiles || {} };
  }

  function naturalCompare(a,b) {
    return String(a).localeCompare(String(b), undefined, { numeric:true, sensitivity:'base' });
  }

  function storageKey(context = ctx) {
    return `naxos-editor-v1:${context.mode}:${context.courseId}:${context.routeId || 'default'}`;
  }
  function defaultStore() {
    return { titles:{category:{},subcategory:{},task:{}}, taskEdits:{}, customTasks:[] };
  }
  function loadStore(context) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(context)) || 'null');
      return parsed && typeof parsed === 'object' ? {
        titles:{category:{...(parsed.titles?.category||{})},subcategory:{...(parsed.titles?.subcategory||{})},task:{...(parsed.titles?.task||{})}},
        taskEdits:{...(parsed.taskEdits || {})},
        customTasks:Array.isArray(parsed.customTasks) ? parsed.customTasks : []
      } : defaultStore();
    } catch { return defaultStore(); }
  }
  function saveStore() {
    if (!ctx) return;
    try { localStorage.setItem(storageKey(), JSON.stringify(ctx.store)); } catch {}
  }

  function liveKsbStore(courseId) {
    if (mode !== 'ksb' || !ctx || ctx.courseId !== courseId) return null;
    try { return JSON.parse(JSON.stringify(ctx.store || defaultStore())); }
    catch { return null; }
  }

  window.NaxosEditor = window.NaxosEditor || {};
  window.NaxosEditor.getKsbCustomisations = courseId => liveKsbStore(courseId);

  async function loadContext() {
    const sig = currentSignature();
    if (!sig || sig.endsWith(':') || loading || sig === contextSignature) return;
    loading = true;
    try {
      const loaded = mode === 'ksb' ? await loadKsbContext() : await loadNvqContext();
      loaded.store = loadStore(loaded);
      ctx = loaded;
      contextSignature = sig;
      activeCustomId = null;
      scheduleEnhance();
    } catch (error) {
      console.error('Naxos editor could not load mapping context', error);
    } finally { loading = false; }
  }

  function builtInButtons(id) {
    return [...($(id)?.children || [])].filter(node => node.classList?.contains('nav-button') && node.dataset.naxosCustom !== '1');
  }
  function selectedIndices() {
    const cats = builtInButtons('categories');
    const ci = Math.max(0, cats.findIndex(b => b.classList.contains('active')));
    const subs = builtInButtons('subcategories');
    const si = Math.max(0, subs.findIndex(b => b.classList.contains('active')));
    const tasks = builtInButtons('tasks');
    const ti = tasks.findIndex(b => b.classList.contains('active'));
    return { ci, si, ti };
  }
  const subKey = (ci,si) => `${ci}:${si}`;
  const taskKey = (ci,si,ti) => `${ci}:${si}:${ti}`;

  function buttonText(button) {
    const span = button?.querySelector('span');
    if (!span) return '';
    const clone = span.cloneNode(true);
    clone.querySelector('small')?.remove();
    return clone.textContent.trim();
  }
  function setButtonText(button, title) {
    if (!button || !title) return;
    const span = button.querySelector('span');
    if (!span) return;
    const small = span.querySelector('small');
    const current = buttonText(button);
    if (current === title) return;
    [...span.childNodes].filter(n => n !== small).forEach(n => n.remove());
    span.insertBefore(document.createTextNode(title), small || null);
  }

  function applyTitles() {
    if (!ctx) return;
    const cats = builtInButtons('categories');
    cats.forEach((button,i) => setButtonText(button, ctx.store.titles.category[String(i)]));
    const {ci} = selectedIndices();
    const subs = builtInButtons('subcategories');
    subs.forEach((button,i) => setButtonText(button, ctx.store.titles.subcategory[subKey(ci,i)]));
    const {si} = selectedIndices();
    const tasks = builtInButtons('tasks');
    tasks.forEach((button,i) => setButtonText(button, ctx.store.titles.task[taskKey(ci,si,i)]));

    cats.forEach(button => bindClearCustom(button));
    subs.forEach(button => bindClearCustom(button));
    tasks.forEach(button => bindClearCustom(button));
  }
  function bindClearCustom(button) {
    if (button.dataset.naxosEditorBound === '1') return;
    button.dataset.naxosEditorBound = '1';
    button.addEventListener('click', () => { activeCustomId = null; setTimeout(scheduleEnhance, 0); });
  }

  function ensureTools() {
    if (!ctx || $('naxosTaskEditor')?.hidden === false) return;
    const panels = $('browser')?.querySelectorAll('.level-panel');
    if (!panels || panels.length < 3) return;
    if (!panels[0].querySelector('.naxos-edit-tools')) {
      const tools = document.createElement('div'); tools.className='naxos-edit-tools';
      const edit = toolButton('Edit selected title', () => editSelectedTitle('category'));
      tools.appendChild(edit); panels[0].appendChild(tools);
    }
    if (!panels[1].querySelector('.naxos-edit-tools')) {
      const tools = document.createElement('div'); tools.className='naxos-edit-tools';
      const edit = toolButton('Edit selected title', () => editSelectedTitle('subcategory'));
      tools.appendChild(edit); panels[1].appendChild(tools);
    }
    if (!panels[2].querySelector('.naxos-edit-tools')) {
      const tools = document.createElement('div'); tools.className='naxos-edit-tools';
      tools.appendChild(toolButton('Add task', () => openEditor({kind:'new'}), false));
      tools.appendChild(toolButton('Edit selected task', () => openSelectedTaskEditor(), true));
      panels[2].appendChild(tools);
    }
  }
  function toolButton(text, onClick, secondary = true) {
    const b = document.createElement('button'); b.type='button'; b.textContent=text; if (secondary) b.className='secondary'; b.onclick=onClick; return b;
  }

  function editSelectedTitle(kind) {
    if (!ctx) return;
    const {ci,si,ti} = selectedIndices();
    let button, key, bucket;
    if (kind === 'category') { button=builtInButtons('categories')[ci]; key=String(ci); bucket=ctx.store.titles.category; }
    else if (kind === 'subcategory') { button=builtInButtons('subcategories')[si]; key=subKey(ci,si); bucket=ctx.store.titles.subcategory; }
    else { button=builtInButtons('tasks')[ti]; key=taskKey(ci,si,ti); bucket=ctx.store.titles.task; }
    if (!button) return;
    const next = window.prompt('Edit title', buttonText(button));
    if (next === null) return;
    const clean = next.trim();
    if (!clean) return;
    bucket[key] = clean;
    saveStore();
    scheduleEnhance();
  }

  function customTasksHere(ci,si) {
    return (ctx?.store.customTasks || []).filter(t => t.categoryIndex === ci && t.subcategoryIndex === si);
  }
  function ensureCustomTasks() {
    if (!ctx) return;
    const {ci,si} = selectedIndices();
    const wrap = $('tasks'); if (!wrap) return;
    for (const task of customTasksHere(ci,si)) {
      if (wrap.querySelector(`[data-naxos-custom-id="${CSS.escape(task.id)}"]`)) continue;
      const b = document.createElement('button');
      b.className = `nav-button naxos-custom-task${activeCustomId === task.id ? ' active' : ''}`;
      b.dataset.naxosCustom='1'; b.dataset.naxosCustomId=task.id;
      b.innerHTML = `<span>${esc(task.title)}<small>${task.targets.length} ${ctx.mode==='ksb'?'KSBs':'candidate criteria'} · ${esc(shortEvidenceLabel(task.evidence))}</small></span>`;
      b.onclick = () => {
        activeCustomId = task.id;
        builtInButtons('tasks').forEach(x => x.classList.remove('active'));
        [...wrap.querySelectorAll('[data-naxos-custom="1"]')].forEach(x => x.classList.toggle('active', x.dataset.naxosCustomId === task.id));
        renderCustomTask(task);
        scheduleEnhance();
      };
      wrap.appendChild(b);
    }
    const count = builtInButtons('tasks').length + customTasksHere(ci,si).length;
    if (customTasksHere(ci,si).length && $('taskCount')) $('taskCount').textContent = String(count);
  }

  function activeCustomTask() {
    return ctx?.store.customTasks.find(t => t.id === activeCustomId) || null;
  }

  function openSelectedTaskEditor() {
    if (!ctx) return;
    const custom = activeCustomTask();
    if (custom) return openEditor({kind:'custom', custom});
    const {ci,si,ti} = selectedIndices();
    if (ti < 0) return;
    openEditor({kind:'builtin', ci,si,ti});
  }

  function modelTask(ci,si,ti) {
    return ctx?.categories?.[ci]?.subcategories?.[si]?.tasks?.[ti] || null;
  }
  function modelTargets(task) {
    if (!task) return [];
    if (ctx.mode === 'ksb') return uniq(task.ksbTargets || []);
    return uniq([...(task.directLo7Targets || []), ...(task.mappedAtomicTargets || [])]).filter(id => {
      const active = ctx.pack.route?.activeUnits || [];
      return !active.length || active.includes(String(id).split('.')[0]);
    });
  }
  function expandedRequirements(targets) {
    if (ctx?.mode !== 'ksb') return [...targets];
    return targets.flatMap(id => {
      const rows = ctx.facets?.items?.[id] || [];
      return rows.length ? rows.map(([letter]) => `${id}.${letter}`) : [id];
    });
  }

  function openEditor(options) {
    if (!ctx) return;
    ensureEditorPage();
    const selected = selectedIndices();
    const kind = options.kind;
    let ci = options.ci ?? selected.ci;
    let si = options.si ?? selected.si;
    let ti = options.ti ?? selected.ti;
    let title = '';
    let targets = [];
    let evidence = null;
    let customId = null;
    let lockedTargets = false;
    let profileId = '';

    if (kind === 'builtin') {
      const task = modelTask(ci,si,ti); if (!task) return;
      const key = taskKey(ci,si,ti);
      title = ctx.store.titles.task[key] || task.title || '';
      targets = modelTargets(task);
      evidence = ctx.store.taskEdits[key]?.evidence || null;
      profileId = evidence?.profileId || originalProfileId(task);
      lockedTargets = true;
    } else if (kind === 'custom') {
      const task = options.custom;
      ci = task.categoryIndex; si = task.subcategoryIndex; ti = -1; customId = task.id;
      title = task.title; targets = [...task.targets]; evidence = task.evidence || null; profileId = evidence?.profileId || task.profileId || suggestProfile(title, targets);
    } else {
      ti = -1; profileId = suggestProfile('', []);
    }

    editorState = { kind, ci,si,ti,customId,lockedTargets, selectedTargets:new Set(targets), rows:[], evidenceManuallyChanged: kind !== 'new' };
    $('naxosEditorTitle').textContent = kind === 'new' ? 'Add task' : 'Edit task';
    $('naxosEditorSubtitle').textContent = kind === 'new'
      ? `Add ${ctx.mode === 'ksb' ? 'KSBs' : 'ACs'} and let Naxos choose the starting evidence requirements.`
      : 'Change the title or evidence requirements. Custom tasks can also change their mapped criteria.';
    $('naxosTaskName').value = title;
    $('naxosTargetLabel').textContent = ctx.mode === 'ksb' ? 'KSBs for this task' : 'ACs for this task';
    $('naxosTargetSearch').placeholder = ctx.mode === 'ksb' ? 'Search KSB IDs or wording' : 'Search AC IDs';
    $('naxosLockedMappingNote').hidden = !lockedTargets;
    $('naxosTargetSearch').disabled = false;
    renderTargetOptions();
    renderProfileOptions(profileId);
    if (evidence?.preferred?.length) editorState.rows = evidence.preferred.map(x => ({type:x.type||'photo',label:x.label||'',instruction:x.instruction||''}));
    else useProfile(profileId, false);

    ['statusPanel','browser','taskDetail','exportPanel'].forEach(id => { const node=$(id); if(node) node.hidden=true; });
    $('naxosTaskEditor').hidden = false;
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function closeEditor() {
    editorState = null;
    if ($('naxosTaskEditor')) $('naxosTaskEditor').hidden = true;
    if ($('statusPanel')) $('statusPanel').hidden = false;
    if ($('browser')) $('browser').hidden = false;
    if ($('exportPanel')) $('exportPanel').hidden = false;
    if ($('taskDetail')) $('taskDetail').hidden = false;
    if (activeCustomId) {
      const task = activeCustomTask(); if (task) renderCustomTask(task);
    }
    scheduleEnhance();
  }

  function targetWording(id) {
    return ctx?.mode === 'ksb' ? (ctx.registry?.items?.[id] || '') : '';
  }
  function renderTargetOptions() {
    const wrap = $('naxosTargetList'); if (!wrap || !editorState) return;
    wrap.innerHTML = ctx.availableTargets.map(id => {
      const checked = editorState.selectedTargets.has(id);
      const disabled = editorState.lockedTargets ? ' disabled' : '';
      const wording = targetWording(id);
      return `<label class="naxos-target-option" data-search="${esc(`${id} ${wording}`.toLowerCase())}"><input type="checkbox" value="${esc(id)}" ${checked?'checked':''}${disabled}><div><strong>${esc(id)}</strong>${wording?`<span>${esc(wording)}</span>`:''}</div></label>`;
    }).join('');
    wrap.querySelectorAll('input[type=checkbox]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) editorState.selectedTargets.add(input.value); else editorState.selectedTargets.delete(input.value);
      updateSelectedCount();
    }));
    updateSelectedCount();
    filterTargets();
  }
  function updateSelectedCount() {
    if ($('naxosSelectedCount') && editorState) $('naxosSelectedCount').textContent = `${editorState.selectedTargets.size} selected`;
  }
  function filterTargets() {
    const q = ($('naxosTargetSearch')?.value || '').trim().toLowerCase();
    $('naxosTargetList')?.querySelectorAll('.naxos-target-option').forEach(row => { row.hidden = q && !row.dataset.search.includes(q); });
  }

  function renderProfileOptions(selected) {
    const select = $('naxosProfileSelect'); if (!select) return;
    select.innerHTML = Object.entries(ctx.profiles).map(([id,p]) => `<option value="${esc(id)}">${esc(p.label || id)}</option>`).join('');
    if (ctx.profiles[selected]) select.value = selected;
    else select.value = Object.keys(ctx.profiles)[0] || '';
  }

  function originalProfileId(task) {
    if (task?.evidenceProfile && ctx?.profiles?.[task.evidenceProfile]) return task.evidenceProfile;
    if (ctx?.mode === 'ksb') return ctx.profiles?.knowledge ? 'knowledge' : Object.keys(ctx?.profiles || {})[0] || '';
    const title = String(task?.title || '').toLowerCase();
    const tags = new Set(task?.tags || []);
    if (task?.id === '1.1.4' && ctx.profiles?.['job-information']) return 'job-information';
    if (ctx.profiles?.['hidden-work'] && /(dpc|cavity tray|insulation|wall tie|fire barrier|fire break|support angle|wind post|movement joint|weep|vent|reinforcement|soffit|temporary|prop|support|bedding|backfill|pipework|chamber|gully)/i.test(title)) return 'hidden-work';
    if (task?.type === 'trade' && ctx.profiles?.practical) return 'practical';
    if (task?.type === 'optional-knowledge' && ctx.profiles?.knowledge) return 'knowledge';
    if (task?.type === 'common' && /^(summarise|explain|discuss|describe)/i.test(title) && ctx.profiles?.knowledge) return 'knowledge';
    if (tags.has('SAFE_WORK') && ctx.profiles?.safety) return 'safety';
    if (tags.has('COMMUNICATION') && ctx.profiles?.communication) return 'communication';
    if ((tags.has('RESOURCES') || tags.has('TOOLS')) && ctx.profiles?.resources) return 'resources';
    if (tags.has('QUALITY') && ctx.profiles?.quality) return 'quality';
    if (tags.has('PROGRAMME') && ctx.profiles?.programme) return 'programme';
    return ctx.profiles?.knowledge ? 'knowledge' : Object.keys(ctx?.profiles || {})[0] || '';
  }

  function suggestProfile(title, targets) {
    const text = String(title || '').toLowerCase();
    const has = id => Object.prototype.hasOwnProperty.call(ctx?.profiles || {}, id);
    if (has('safety') && /(safe|safety|hazard|risk|ppe|rpe|control)/i.test(text)) return 'safety';
    if (has('hidden-work') && /(dpc|cavity tray|insulation|wall tie|fire barrier|fire break|support angle|wind post|movement joint|weep|vent|reinforcement|soffit|temporary|prop|support|bedding|backfill|pipework|chamber|gully)/i.test(text)) return 'hidden-work';
    if (has('resources') && /(tool|material|resource|equipment|component|fixing)/i.test(text)) return 'resources';
    if (has('quality') && /(quality|check|measure|tolerance|inspect|finish)/i.test(text)) return 'quality';
    if (has('communication') && /(communicat|team|customer|client|colleague|supervisor|relationship)/i.test(text)) return 'communication';
    if (has('programme') && /(programme|progress|plan|time|schedule|sequence)/i.test(text)) return 'programme';
    if (has('job-information') && /(drawing|specification|information|instruction|method statement|risk assessment)/i.test(text)) return 'job-information';
    if (ctx?.mode === 'ksb') {
      const ids = targets || [];
      if (ids.some(id => String(id).startsWith('S')) && has('practical')) return 'practical';
      if (ids.some(id => String(id).startsWith('B')) && has('communication')) return 'communication';
      if (has('knowledge')) return 'knowledge';
    }
    if (has('practical') && !/^(summarise|explain|discuss|describe|identify|state|outline)/i.test(text)) return 'practical';
    return has('knowledge') ? 'knowledge' : Object.keys(ctx?.profiles || {})[0] || '';
  }

  function useSuggestedEvidence() {
    if (!editorState) return;
    const title = $('naxosTaskName')?.value || '';
    const id = suggestProfile(title, [...editorState.selectedTargets]);
    editorState.evidenceManuallyChanged = false;
    renderProfileOptions(id);
    useProfile(id);
  }
  function useProfile(id, render = true) {
    if (!editorState) return;
    const profile = ctx.profiles[id] || {};
    editorState.rows = (profile.preferred || []).map(x => ({type:x.type||'photo',label:x.label||'',instruction:x.instruction||''}));
    if (!editorState.rows.length) editorState.rows = [{type:'photo',label:'1 photo',instruction:''}];
    if ($('naxosProfileSelect') && ctx.profiles[id]) $('naxosProfileSelect').value = id;
    if (render) renderEvidenceRows(); else renderEvidenceRows();
  }
  function renderEvidenceRows() {
    const wrap = $('naxosEvidenceRows'); if (!wrap || !editorState) return;
    wrap.innerHTML = editorState.rows.map((row,index) => `
      <div class="naxos-evidence-row" data-index="${index}">
        <div class="naxos-evidence-row-top">
          <select class="evidence-type" aria-label="Evidence type">${EVIDENCE_TYPES.map(type=>`<option value="${type}" ${type===row.type?'selected':''}>${esc(TYPE_LABELS[type])}</option>`).join('')}</select>
          <input class="evidence-label" type="text" value="${esc(row.label)}" placeholder="Quantity / label, e.g. 3 photos">
          <button type="button" class="remove">Remove</button>
        </div>
        <textarea class="evidence-instruction" placeholder="What this evidence should show">${esc(row.instruction)}</textarea>
      </div>`).join('');
    wrap.querySelectorAll('.naxos-evidence-row').forEach(rowEl => {
      const index = Number(rowEl.dataset.index);
      rowEl.querySelector('.evidence-type').onchange = e => { editorState.evidenceManuallyChanged = true; editorState.rows[index].type = e.target.value; };
      rowEl.querySelector('.evidence-label').oninput = e => { editorState.evidenceManuallyChanged = true; editorState.rows[index].label = e.target.value; };
      rowEl.querySelector('.evidence-instruction').oninput = e => { editorState.evidenceManuallyChanged = true; editorState.rows[index].instruction = e.target.value; };
      rowEl.querySelector('.remove').onclick = () => { editorState.evidenceManuallyChanged = true; editorState.rows.splice(index,1); renderEvidenceRows(); };
    });
  }

  function buildEvidence() {
    const profileId = $('naxosProfileSelect')?.value || suggestProfile($('naxosTaskName')?.value, [...editorState.selectedTargets]);
    const profile = ctx.profiles[profileId] || {};
    const preferred = editorState.rows
      .map(row => ({type:row.type,label:String(row.label||'').trim(),instruction:String(row.instruction||'').trim()}))
      .filter(row => row.label || row.instruction);
    return {
      profileId,
      label: profile.label || 'Custom evidence',
      shortLabel: preferred.map(row => TYPE_LABELS[row.type] || row.type).join(' + ') || 'Custom evidence',
      oneSubmissionNote: profile.oneSubmissionNote || 'One strong submission can support several criteria when it genuinely demonstrates them.',
      preferred,
      alternatives: profile.alternatives || [],
      capture: profile.capture || []
    };
  }

  function saveEditor() {
    if (!ctx || !editorState) return;
    const title = ($('naxosTaskName')?.value || '').trim();
    if (!title) { alert('Add a task title before saving.'); $('naxosTaskName')?.focus(); return; }
    const targets = [...editorState.selectedTargets].sort(naturalCompare);
    if (!targets.length) { alert(`Select at least one ${ctx.mode === 'ksb' ? 'KSB' : 'AC'} before saving.`); return; }
    const {kind,ci,si,ti,customId} = editorState;
    if (kind === 'new' && !editorState.evidenceManuallyChanged) {
      const suggested = suggestProfile(title, targets);
      renderProfileOptions(suggested);
      useProfile(suggested);
    }
    const evidence = buildEvidence();
    if (!evidence.preferred.length) { alert('Add at least one evidence requirement before saving.'); return; }

    if (kind === 'builtin') {
      const key = taskKey(ci,si,ti);
      ctx.store.titles.task[key] = title;
      ctx.store.taskEdits[key] = { evidence };
    } else if (kind === 'custom') {
      const task = ctx.store.customTasks.find(t => t.id === customId);
      if (task) {
        task.title = title; task.targets = targets; task.evidence = evidence; task.profileId = evidence.profileId;
        task.evidenceRequirements = expandedRequirements(targets);
      }
      activeCustomId = customId;
    } else {
      const id = `custom-${Date.now().toString(36)}`;
      ctx.store.customTasks.push({
        id, categoryIndex:ci, subcategoryIndex:si, title, targets,
        evidence, profileId:evidence.profileId, evidenceRequirements:expandedRequirements(targets), createdAt:new Date().toISOString()
      });
      activeCustomId = id;
    }
    saveStore();
    closeEditor();
    const custom = activeCustomTask();
    if (custom) setTimeout(() => { ensureCustomTasks(); renderCustomTask(custom); }, 0);
  }

  function shortEvidenceLabel(evidence) {
    return evidence?.shortLabel || evidence?.preferred?.map(x => TYPE_LABELS[x.type] || x.type).join(' + ') || 'Evidence';
  }
  function setHtmlIfChanged(node, html) {
    if (node && node.innerHTML !== html) node.innerHTML = html;
  }
  function renderEvidenceDom(evidence, coverageText) {
    if (!evidence) return;
    const plan = $('evidencePlan'); if (!plan) return;
    plan.hidden = false;
    if ($('evidenceProfileTitle')) $('evidenceProfileTitle').textContent = evidence.label || 'Custom evidence';
    if ($('oneSubmissionNote')) $('oneSubmissionNote').textContent = evidence.oneSubmissionNote || 'One strong submission can support several criteria when it genuinely demonstrates them.';
    setHtmlIfChanged($('evidenceMinimum'), (evidence.preferred || []).map(item => `<div class="evidence-item"><div class="evidence-item-head"><span class="evidence-chip">${esc(TYPE_LABELS[item.type] || item.type)}</span> <strong>${esc(item.label)}</strong></div><p>${esc(item.instruction)}</p></div>`).join(''));
    setHtmlIfChanged($('evidenceAlternatives'), (evidence.alternatives || []).map(alt => `<div class="alternative-box"><strong>${esc(alt.label)}</strong><p>${esc(alt.instruction)}</p></div>`).join(''));
    setHtmlIfChanged($('evidenceCapture'), (evidence.capture || []).map(x => `<li>${esc(x)}</li>`).join(''));
    if ($('evidenceCoverageText')) $('evidenceCoverageText').textContent = coverageText;
    if ($('evidenceSelector')) { $('evidenceSelector').hidden = true; $('evidenceSelector').innerHTML=''; }
  }

  function renderCustomTask(task) {
    if (!ctx || !task) return;
    const detail = $('taskDetail'); if (!detail) return;
    detail.hidden = false;
    const {ci,si} = selectedIndices();
    const catTitle = buttonText(builtInButtons('categories')[ci]) || ctx.categories[ci]?.title || '';
    const subTitle = buttonText(builtInButtons('subcategories')[si]) || ctx.categories[ci]?.subcategories?.[si]?.title || '';
    if ($('taskPath')) $('taskPath').textContent = ctx.mode === 'ksb' ? `Route ${ctx.categories[ci]?.id || ci+1} · ${catTitle} › ${subTitle} › ${task.id}` : `${catTitle} › ${subTitle} › ${task.id}`;
    if ($('taskTitle')) $('taskTitle').textContent = task.title;
    if ($('mappedCount')) $('mappedCount').textContent = task.targets.length;
    if ($('promptBox')) $('promptBox').hidden = true;

    if (ctx.mode === 'ksb') {
      if ($('taskMeta')) $('taskMeta').innerHTML = `<div class="meta-item"><strong>Main route</strong>${esc(ctx.categories[ci]?.id || '')} · ${esc(catTitle)}</div><div class="meta-item"><strong>Evidence method</strong>${esc(shortEvidenceLabel(task.evidence))}</div><div class="meta-item"><strong>KSB candidates</strong>${task.targets.length}</div><div class="meta-item"><strong>Detailed checks</strong>${task.evidenceRequirements.length}</div><div class="meta-item"><strong>Course</strong>${esc(ctx.pack.qualification?.id || ctx.courseId)} v${esc(ctx.pack.qualification?.version || '')}</div><div class="meta-item"><strong>Mapping</strong>Custom · evidence-led</div>`;
      renderEvidenceDom(task.evidence, `This submission can support ${task.targets.length} KSBs and ${task.evidenceRequirements.length} detailed evidence checks. Only what is actually demonstrated is awarded.`);
      if ($('ksbList')) $('ksbList').innerHTML = task.targets.map(id => `<div class="ksb-row"><strong>${esc(id)}</strong> <span class="facet-note">${String(id).startsWith('K')?'Knowledge':String(id).startsWith('S')?'Skill':'Behaviour'}</span><p class="ksb-wording">${esc(ctx.registry?.items?.[id] || '')}</p></div>`).join('');
      if ($('requirementList')) $('requirementList').innerHTML = task.evidenceRequirements.map(id => `<span class="requirement-chip">${esc(id)}</span>`).join('');
    } else {
      const primary = task.targets[0]?.split('.')[0] || 'Custom';
      if ($('taskMeta')) $('taskMeta').innerHTML = `<div class="meta-item"><strong>Route</strong>${esc(ctx.routeId)}</div><div class="meta-item"><strong>Primary unit</strong>${esc(primary)}</div><div class="meta-item"><strong>Type</strong>Custom task</div><div class="meta-item"><strong>Holistic tags</strong>Custom</div><div class="meta-item"><strong>Direct LO7 targets</strong>0</div><div class="meta-item"><strong>Candidate atomic criteria</strong>${task.targets.length}</div>`;
      renderEvidenceDom(task.evidence, `${task.targets.length} candidate criteria can be considered from this custom task. Only criteria actually demonstrated are awarded.`);
      if ($('criteriaList')) $('criteriaList').innerHTML = task.targets.map(id => `<span class="criterion">${esc(id)}</span>`).join('');
      if ($('copyCriteria')) $('copyCriteria').onclick = async () => { await navigator.clipboard.writeText(task.targets.join('\n')); $('copyCriteria').textContent='Copied'; setTimeout(()=>$('copyCriteria').textContent='Copy IDs',1000); };
    }
  }

  function applyBuiltInDetailEdits() {
    if (!ctx || activeCustomId || $('naxosTaskEditor')?.hidden === false) return;
    const {ci,si,ti} = selectedIndices(); if (ti < 0) return;
    const key = taskKey(ci,si,ti);
    const title = ctx.store.titles.task[key];
    if (title && $('taskTitle')?.textContent !== title) $('taskTitle').textContent = title;
    const catTitle = buttonText(builtInButtons('categories')[ci]) || ctx.categories[ci]?.title || '';
    const subTitle = buttonText(builtInButtons('subcategories')[si]) || ctx.categories[ci]?.subcategories?.[si]?.title || '';
    const task = modelTask(ci,si,ti);
    if ($('taskPath') && task) {
      const desired = ctx.mode === 'ksb' ? `Route ${ctx.categories[ci]?.id || ci+1} · ${catTitle} › ${subTitle} › ${task.id}` : `${catTitle} › ${subTitle} › ${task.id}`;
      if ($('taskPath').textContent !== desired) $('taskPath').textContent = desired;
    }
    const edit = ctx.store.taskEdits[key];
    if (edit?.evidence && task) {
      const targets = modelTargets(task);
      const coverage = ctx.mode === 'ksb'
        ? `This submission can support ${targets.length} KSBs and ${expandedRequirements(targets).length} detailed evidence checks. Only what is actually demonstrated is awarded.`
        : `${targets.length} candidate criteria can be considered from this task. Only criteria actually demonstrated are awarded.`;
      renderEvidenceDom(edit.evidence, coverage);
    }
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; enhance(); });
  }
  function enhance() {
    if (!ctx) { loadContext(); return; }
    if (currentSignature() !== contextSignature) { loadContext(); return; }
    if ($('naxosTaskEditor')?.hidden === false) return;
    applyTitles();
    ensureTools();
    ensureCustomTasks();
    if (activeCustomId) {
      const task = activeCustomTask();
      const button = $('tasks')?.querySelector(`[data-naxos-custom-id="${CSS.escape(activeCustomId)}"]`);
      if (task && button) {
        button.classList.add('active');
        if ($('taskTitle')?.textContent !== task.title) renderCustomTask(task);
      }
    } else applyBuiltInDetailEdits();
  }

  function init() {
    injectStyles();
    ensureEditorPage();
    $('routeSelect')?.addEventListener('change', () => { contextSignature=''; setTimeout(loadContext, 20); });
    $('courseSelect')?.addEventListener('change', () => { contextSignature=''; setTimeout(loadContext, 20); });
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.querySelector('main') || document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
    loadContext();
    setTimeout(scheduleEnhance, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();