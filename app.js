(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const requestedCourse = params.get('course') || '6570-05';
  const manifestFile = requestedCourse === '6570-04' ? 'manifest-6570-04.json' : 'manifest.json';

  const state = {
    manifest: null,
    qualificationId: requestedCourse,
    pack: null,
    routeMappings: null,
    requiredTargets: null,
    evidenceRules: null,
    route: null,
    categoryId: null,
    subcategoryId: null,
    taskId: null,
    evidenceSelections: {},
    audit: null,
  };

  const el = id => document.getElementById(id);
  const routeSelect = el('routeSelect');
  const browser = el('browser');
  const detail = el('taskDetail');
  const exportPanel = el('exportPanel');
  const byId = (items, id) => (items || []).find(x => x.id === id);
  const uniq = items => [...new Set(items || [])];

  async function fetchJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function taskList(categories = state.pack?.categories || []) {
    return categories.flatMap(c => c.subcategories || []).flatMap(s => s.tasks || []);
  }

  function activeUnit(id) {
    const unit = String(id || '').split('.')[0];
    return new Set(state.pack?.route?.activeUnits || []).has(unit);
  }

  function allTaskTargets(task) {
    return uniq([...(task.directLo7Targets || []), ...(task.mappedAtomicTargets || [])]).filter(activeUnit);
  }

  function findTask(categories, id) {
    return taskList(categories).find(t => t.id === id) || null;
  }

  function rawTargets(categories) {
    return uniq(taskList(categories).flatMap(t => [
      ...(t.directLo7Targets || []),
      ...(t.mappedAtomicTargets || []),
    ])).filter(activeUnit);
  }

  async function loadRequiredTargets(packDir) {
    const sourcePacks = state.pack.coverageSourcePacks || [];
    const sourceFiles = state.pack.coverageSourceFiles || [];
    const targetPaths = state.pack.requiredTargetFiles || [];
    const inline = state.pack.requiredAtomicTargets || [];
    if (!sourcePacks.length && !sourceFiles.length && !targetPaths.length && !inline.length) {
      state.requiredTargets = null;
      return;
    }

    const sourceIds = [];
    for (const sourcePath of sourcePacks) {
      const sourcePackUrl = new URL(sourcePath, packDir);
      const sourcePack = await fetchJson(sourcePackUrl.href);
      const sourcePackDir = new URL('./', sourcePackUrl);
      const categories = await Promise.all((sourcePack.categoryFiles || []).map(path => fetchJson(new URL(path, sourcePackDir).href)));
      if (sourcePack.routeMappings) {
        const mappings = await fetchJson(new URL(sourcePack.routeMappings, sourcePackDir).href);
        for (const [taskId, ids] of Object.entries(mappings.taskMappings || {})) {
          const task = findTask(categories, taskId);
          if (task) task.mappedAtomicTargets = uniq([...(task.mappedAtomicTargets || []), ...ids]);
        }
      }
      sourceIds.push(...rawTargets(categories));
    }

    const sourceCategories = sourceFiles.length
      ? await Promise.all(sourceFiles.map(path => fetchJson(new URL(path, packDir).href)))
      : [];
    const targetFiles = targetPaths.length
      ? await Promise.all(targetPaths.map(path => fetchJson(new URL(path, packDir).href)))
      : [];

    state.requiredTargets = uniq([
      ...sourceIds,
      ...rawTargets(sourceCategories),
      ...targetFiles.flatMap(file => file.targets || []),
      ...inline,
    ]).filter(activeUnit);
  }

  function prepareCategories(rawCategories, routeMappings) {
    const categories = structuredClone(rawCategories);
    const active = new Set(state.pack.route.activeUnits || []);
    const keep = id => active.has(String(id || '').split('.')[0]);
    const optionalUnit = String(state.pack.route.optionalUnit || '');

    const optionalCategory = categories.find(c => String(c.id) === '5');
    if (optionalCategory && state.qualificationId === '6570-04') optionalCategory.title = state.pack.route.title || optionalCategory.title;

    for (const task of taskList(categories)) {
      if (task.primaryUnit === 'OPTIONAL') task.primaryUnit = optionalUnit;
      task.directLo7Targets = uniq(task.directLo7Targets || []).filter(keep);
      task.mappedAtomicTargets = uniq(task.mappedAtomicTargets || []).filter(keep);

      if (state.requiredTargets && (task.targetPrefixes || []).length) {
        const prefixes = task.targetPrefixes.map(prefix => String(prefix).replaceAll('$OPTIONAL', optionalUnit));
        const matched = state.requiredTargets.filter(id => prefixes.some(prefix => id === prefix || id.startsWith(`${prefix}.`)));
        task.mappedAtomicTargets = uniq([...task.mappedAtomicTargets, ...matched]).filter(keep);
      }
      task.mappedAtomicCount = uniq([...task.directLo7Targets, ...task.mappedAtomicTargets]).length;
    }

    for (const [taskId, ids] of Object.entries(routeMappings?.taskMappings || {})) {
      const task = findTask(categories, taskId);
      if (!task) throw new Error(`Route mapping points to missing task ${taskId}`);
      task.mappedAtomicTargets = uniq([...(task.mappedAtomicTargets || []), ...ids.filter(keep)]);
      task.mappedAtomicCount = uniq([...(task.directLo7Targets || []), ...task.mappedAtomicTargets]).length;
    }

    return categories;
  }

  function runAudit() {
    const categories = state.pack.categories || [];
    const cats = categories.length;
    const subs = categories.reduce((n, c) => n + (c.subcategories || []).length, 0);
    const tasks = taskList(categories).length;
    const mappedSet = new Set(taskList(categories).flatMap(allTaskTargets));
    const structurePass = cats <= 5 && categories.every(c =>
      (c.subcategories || []).length <= 5 &&
      (c.subcategories || []).every(s => (s.tasks || []).length <= 5)
    );

    let expected;
    let missing = [];
    let extras = [];
    let coveragePass;

    if (state.requiredTargets) {
      const requiredSet = new Set(state.requiredTargets);
      expected = requiredSet.size;
      missing = [...requiredSet].filter(id => !mappedSet.has(id));
      extras = [...mappedSet].filter(id => !requiredSet.has(id));
      coveragePass = missing.length === 0 && extras.length === 0;
    } else {
      expected = Number(state.pack.route.atomicTargetCount || 0);
      coveragePass = mappedSet.size === expected;
    }

    state.audit = {
      categories: cats,
      subcategories: subs,
      tasks,
      mapped: mappedSet.size,
      expected,
      orphanCount: missing.length || Math.max(0, expected - mappedSet.size),
      extraCount: extras.length,
      missing,
      extras,
      structurePass,
      coveragePass,
      pass: structurePass && coveragePass,
    };
    return state.audit;
  }

  function renderQualificationHeader() {
    const q = state.qualificationId;
    const level = q === '6570-04' ? 'Level 2' : 'Level 3';
    const line = el('qualificationLine');
    if (line) line.textContent = `${q} · ${level} Trowel Occupations · 5 × 5 × 5 learner task structure`;
    const t2 = el('tab657004');
    const t3 = el('tab657005');
    if (t2) t2.classList.toggle('active', q === '6570-04');
    if (t3) t3.classList.toggle('active', q === '6570-05');
    const matrixUrl = `matrix.html?course=${encodeURIComponent(q)}`;
    const matrixNav = el('matrixNav');
    const matrixExport = el('matrixExportLink');
    if (matrixNav) matrixNav.href = matrixUrl;
    if (matrixExport) matrixExport.href = matrixUrl;
    document.title = `${level} NVQ Mapping Engine · ${q}`;
  }

  function renderRoutes() {
    routeSelect.innerHTML = '';
    for (const route of state.manifest.routes) {
      const option = document.createElement('option');
      option.value = route.id;
      option.textContent = `${route.optionalUnit} · ${route.title}`;
      routeSelect.appendChild(option);
    }
    routeSelect.value = state.route;
  }

  function renderStatus(route) {
    const panel = el('statusPanel');
    if (!route || !state.pack) {
      panel.innerHTML = '<strong class="warn">This route could not be loaded.</strong>';
      browser.hidden = detail.hidden = exportPanel.hidden = true;
      return;
    }
    const a = state.audit || runAudit();
    const level2 = state.qualificationId === '6570-04';
    const statusText = level2
      ? `${escapeHtml(route.optionalUnit)} · ${escapeHtml(route.title)} is mapped against the 6570-04 atomic AC set, including individual a, b, c… sub-criteria.`
      : `${escapeHtml(route.optionalUnit)} · ${escapeHtml(route.title)} is a test map pending final wording audit.`;
    panel.innerHTML = `
      <div class="status-grid">
        <div class="metric"><strong>${a.categories}/5</strong><span>categories</span></div>
        <div class="metric"><strong>${a.subcategories}/25</strong><span>sub-categories</span></div>
        <div class="metric"><strong>${a.tasks}/125</strong><span>task types</span></div>
        <div class="metric"><strong>${a.mapped}/${a.expected}</strong><span>active atomic criteria mapped</span></div>
        <div class="metric"><strong>${a.orphanCount}</strong><span>unmapped criteria</span></div>
      </div>
      <p class="status-note ${a.pass ? 'good' : 'warn'}"><strong>${a.pass ? 'Runtime structure and coverage audit passed.' : 'Audit failed — QR export is blocked.'}</strong> ${statusText}</p>`;
    browser.hidden = false;
    exportPanel.hidden = false;
    el('generateQr').disabled = !a.pass;
  }

  function button(text, onClick, active = false, small = '') {
    const b = document.createElement('button');
    b.className = `nav-button${active ? ' active' : ''}`;
    b.innerHTML = `<span>${escapeHtml(text)}${small ? `<small>${escapeHtml(small)}</small>` : ''}</span>`;
    b.addEventListener('click', onClick);
    return b;
  }

  function resolveEvidenceProfile(task) {
    const profiles = state.evidenceRules?.profiles || {};
    const title = String(task.title || '').toLowerCase();
    const tags = new Set(task.tags || []);
    let id = task.evidenceProfile;
    if (!id && task.id === '1.1.4') id = 'job-information';
    if (!id && /(dpc|cavity tray|insulation|wall tie|fire barrier|fire break|support angle|wind post|movement joint|weep|vent|reinforcement|soffit|temporary|prop|support|bedding|backfill|pipework|chamber|gully)/i.test(title)) id = 'hidden-work';
    if (!id && task.type === 'trade') id = 'practical';
    if (!id && task.type === 'optional-knowledge') id = 'knowledge';
    if (!id && task.type === 'common' && /^(summarise|explain|discuss|describe)/i.test(title)) id = 'knowledge';
    if (!id && tags.has('SAFE_WORK')) id = 'safety';
    if (!id && tags.has('COMMUNICATION')) id = 'communication';
    if (!id && (tags.has('RESOURCES') || tags.has('TOOLS'))) id = 'resources';
    if (!id && tags.has('QUALITY')) id = 'quality';
    if (!id && tags.has('PROGRAMME')) id = 'programme';
    if (!id) id = 'knowledge';
    return profiles[id] || profiles.knowledge || { id:'knowledge', label:'Knowledge statement', shortLabel:'Audio / written', preferred:[], alternatives:[], capture:[] };
  }

  function renderBrowser() {
    if (!state.pack) return;
    const categories = state.pack.categories;
    if (!state.categoryId) state.categoryId = categories[0].id;
    const category = byId(categories, state.categoryId) || categories[0];
    state.categoryId = category.id;
    if (!state.subcategoryId || !byId(category.subcategories, state.subcategoryId)) state.subcategoryId = category.subcategories[0].id;
    const sub = byId(category.subcategories, state.subcategoryId);
    if (!state.taskId || !byId(sub.tasks, state.taskId)) state.taskId = sub.tasks[0].id;

    const catWrap = el('categories');
    catWrap.innerHTML = '';
    categories.forEach(cat => catWrap.appendChild(button(cat.title, () => {
      state.categoryId = cat.id; state.subcategoryId = state.taskId = null; renderBrowser();
    }, cat.id === state.categoryId, `${cat.subcategories.length} sub-categories`)));
    el('categoryCount').textContent = `${categories.length}/5`;

    const subWrap = el('subcategories');
    subWrap.innerHTML = '';
    category.subcategories.forEach(item => subWrap.appendChild(button(item.title, () => {
      state.subcategoryId = item.id; state.taskId = null; renderBrowser();
    }, item.id === state.subcategoryId, `${item.tasks.length} tasks`)));
    el('subcategoryCount').textContent = `${category.subcategories.length}/5`;

    const taskWrap = el('tasks');
    taskWrap.innerHTML = '';
    sub.tasks.forEach(item => {
      const profile = resolveEvidenceProfile(item);
      taskWrap.appendChild(button(item.title, () => { state.taskId = item.id; renderBrowser(); }, item.id === state.taskId, `${allTaskTargets(item).length} candidate criteria · ${profile.shortLabel}`));
    });
    el('taskCount').textContent = `${sub.tasks.length}/5`;
    renderTask(category, sub, byId(sub.tasks, state.taskId));
  }

  function evidenceTypeChip(type) {
    const names = { video:'Video', photos:'Photos', photo:'Photo', document:'Document', audio:'Audio', written:'Written statement', witness:'Witness statement', observation:'Assessor observation' };
    return `<span class="evidence-chip">${escapeHtml(names[type] || type)}</span>`;
  }

  function renderEvidencePlan(task, taskTargets) {
    const panel = el('evidencePlan');
    const profile = resolveEvidenceProfile(task);
    panel.hidden = false;
    el('evidenceProfileTitle').textContent = profile.label;
    el('oneSubmissionNote').textContent = profile.oneSubmissionNote || 'This is one task submission. The same evidence can support several criteria; it is not one file per criterion.';
    el('evidenceMinimum').innerHTML = (profile.preferred || []).map(item => `<div class="evidence-item"><div class="evidence-item-head">${evidenceTypeChip(item.type)} <strong>${escapeHtml(item.label)}</strong></div><p>${escapeHtml(item.instruction)}</p></div>`).join('');
    el('evidenceAlternatives').innerHTML = (profile.alternatives || []).map(alt => `<div class="alternative-box"><strong>${escapeHtml(alt.label)}</strong><p>${escapeHtml(alt.instruction)}</p></div>`).join('');
    const capture = [...(profile.capture || [])];
    if (task.conditionalPrompt) capture.push(task.conditionalPrompt);
    el('evidenceCapture').innerHTML = capture.map(x => `<li>${escapeHtml(x)}</li>`).join('');

    const selector = el('evidenceSelector');
    if (task.id === '1.1.4') renderJobInformationSelector(task, taskTargets, selector);
    else {
      selector.hidden = true; selector.innerHTML = '';
      el('evidenceCoverageText').textContent = `${taskTargets.length} candidate criteria can be considered from this task. Only criteria actually demonstrated are awarded.`;
    }
  }

  const infoOptions = [
    ['drawing','Drawings'], ['specification','Specifications'], ['schedule','Schedules'], ['method','Method statement / method of work'],
    ['risk','Risk assessment'], ['manufacturer','Manufacturer information'], ['oral-written','Oral / written instructions'], ['sketch','Sketches'],
    ['electronic','Electronic data'], ['official','Official guidance'], ['programme','Programme of work']
  ];

  function infoTypeForCriterion(id) {
    const p = String(id).split('.');
    if (p.length < 4) return null;
    const unit = p[0], parent = `${p[1]}.${p[2]}`, child = p[3];
    if (unit === '837' && parent === '1.1') return ({a:'drawing',b:'risk',c:'method',d:'specification',e:'schedule',f:'manufacturer'})[child] || null;
    if (['234','235','238','313','690','701','828'].includes(unit)) {
      if (parent === '1.1') return ({a:'drawing',b:'specification',c:'schedule',d:'method',e:'risk',f:'manufacturer'})[child] || null;
      if (parent === '1.4') return ({a:'drawing',b:'specification',d:'schedule',e:'method',f:'risk',g:'manufacturer',h:'oral-written',i:'sketch',j:'electronic',k:'official'})[child] || null;
    }
    if (unit === '817') {
      if (parent === '1.1') return ({a:'drawing',b:'specification',c:'schedule',d:'method',e:'risk',f:'manufacturer'})[child] || null;
      if (parent === '1.4') return ({a:'drawing',b:'specification',c:'schedule',d:'method',e:'risk',f:'manufacturer',g:'oral-written',h:'official',i:'official'})[child] || null;
    }
    if (unit === '837' && parent === '1.4') return ({a:'drawing',b:'specification',d:'schedule',e:'method',f:'risk',g:'manufacturer',h:'oral-written',i:'sketch',j:'electronic',k:'official'})[child] || null;
    if (unit === '303' && parent === '1.1') return ({a:'drawing',b:'specification',c:'schedule',d:'manufacturer',e:'method',f:'risk',g:'programme'})[child] || null;
    return null;
  }

  function renderJobInformationSelector(task, taskTargets, selector) {
    selector.hidden = false;
    const selected = new Set(state.evidenceSelections[task.id] || []);
    selector.innerHTML = `<div class="selector-heading"><div><strong>What information did you actually use today?</strong><p>Select only what was genuinely used. This stops the engine awarding every candidate criterion automatically.</p></div><button id="clearEvidenceSelection" class="secondary compact">Clear</button></div><div class="check-grid">${infoOptions.map(([value,label]) => `<label class="check-option"><input type="checkbox" value="${value}" ${selected.has(value) ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`).join('')}</div><div class="selected-coverage"><strong id="selectedCoverageCount">0</strong><span>of ${taskTargets.length} candidate criteria potentially supported by this evidence</span></div><details class="selected-details"><summary>Show criteria selected for this evidence</summary><div id="selectedCriteriaList" class="criteria-list"></div></details>`;
    const refresh = () => {
      const values = [...selector.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value);
      state.evidenceSelections[task.id] = values;
      const allowed = taskTargets.filter(id => values.includes(infoTypeForCriterion(id)));
      el('selectedCoverageCount').textContent = allowed.length;
      el('selectedCriteriaList').innerHTML = allowed.map(id => `<span class="criterion">${escapeHtml(id)}</span>`).join('');
      el('evidenceCoverageText').textContent = values.length ? `${allowed.length} criteria are candidates for this single evidence submission based on the information types selected. They are awarded only if the evidence actually shows the required interpretation/explanation.` : 'Select the information types actually used to see which candidate criteria this one submission can support.';
    };
    selector.querySelectorAll('input').forEach(x => x.addEventListener('change', refresh));
    el('clearEvidenceSelection').onclick = () => { selector.querySelectorAll('input').forEach(x => x.checked = false); refresh(); };
    refresh();
  }

  function renderTask(category, sub, task) {
    if (!task) { detail.hidden = true; return; }
    detail.hidden = false;
    el('taskPath').textContent = `${category.title} › ${sub.title} › ${task.id}`;
    el('taskTitle').textContent = task.title;
    const targets = allTaskTargets(task);
    el('mappedCount').textContent = targets.length;
    el('taskMeta').innerHTML = `<div class="meta-item"><strong>Route</strong>${escapeHtml(task.route)}</div><div class="meta-item"><strong>Primary unit</strong>${escapeHtml(task.primaryUnit)}</div><div class="meta-item"><strong>Type</strong>${escapeHtml(task.type)}</div><div class="meta-item"><strong>Holistic tags</strong>${escapeHtml((task.tags || []).join(', ') || 'None')}</div><div class="meta-item"><strong>Direct LO7 targets</strong>${escapeHtml(String((task.directLo7Targets || []).length))}</div><div class="meta-item"><strong>Candidate atomic criteria</strong>${targets.length}</div>`;
    renderEvidencePlan(task, targets);

    const promptBox = el('promptBox');
    if (task.conditionalPrompt) { promptBox.hidden = false; el('taskPrompt').textContent = task.conditionalPrompt; }
    else promptBox.hidden = true;

    el('criteriaList').innerHTML = targets.map(id => `<span class="criterion">${escapeHtml(id)}</span>`).join('');
    el('copyCriteria').onclick = async () => {
      await navigator.clipboard.writeText(targets.join('\n'));
      el('copyCriteria').textContent = 'Copied'; setTimeout(() => el('copyCriteria').textContent = 'Copy IDs', 1000);
    };
  }

  function packUrl() {
    const route = state.manifest.routes.find(r => r.id === state.route);
    return route?.pack ? new URL(route.pack, new URL('./', window.location.href)).href : null;
  }

  function renderExport() {
    const url = packUrl();
    if (!url) return;
    el('downloadPack').href = url;
    el('generateQr').onclick = () => {
      if (!state.audit?.pass) return;
      const payload = JSON.stringify({
        type:'evia-mapping-pack-url',
        version:1,
        qualificationId:state.qualificationId || state.pack.qualification?.id,
        route:state.route,
        optionalUnit:state.pack.route.optionalUnit,
        packUrl:url
      });
      el('qrPayload').value = payload;
      el('qrcode').innerHTML = '';
      if (typeof QRCode !== 'function') { alert('QR library did not load. Check the connection and try again.'); return; }
      new QRCode(el('qrcode'), { text:payload, width:240, height:240, correctLevel:QRCode.CorrectLevel.M });
      el('qrArea').hidden = false;
    };
    el('copyPayload').onclick = async () => {
      await navigator.clipboard.writeText(el('qrPayload').value);
      el('copyPayload').textContent = 'Copied'; setTimeout(() => el('copyPayload').textContent = 'Copy payload', 1000);
    };
  }

  async function selectRoute(routeId) {
    state.route = routeId;
    state.pack = state.routeMappings = state.requiredTargets = state.audit = null;
    state.categoryId = state.subcategoryId = state.taskId = null;
    state.evidenceSelections = {};
    el('qrArea').hidden = true;
    const route = state.manifest.routes.find(r => r.id === routeId);
    if (!route?.pack) throw new Error(`No pack configured for ${routeId}`);
    state.pack = await fetchJson(route.pack);
    const base = new URL(route.pack, new URL('./', window.location.href));
    const packDir = new URL('./', base);
    await loadRequiredTargets(packDir);
    const rawCategories = await Promise.all((state.pack.categoryFiles || []).map(path => fetchJson(new URL(path, packDir).href)));
    if (state.pack.routeMappings) state.routeMappings = await fetchJson(new URL(state.pack.routeMappings, packDir).href);
    state.pack.categories = prepareCategories(rawCategories, state.routeMappings);
    runAudit();
    renderStatus(route); renderBrowser(); renderExport();
  }

  async function start() {
    try {
      [state.manifest, state.evidenceRules] = await Promise.all([fetchJson(manifestFile), fetchJson('evidence-rules.json')]);
      state.qualificationId = state.manifest.qualificationId || requestedCourse;
      const preferred = params.get('route');
      state.route = state.manifest.routes.find(r => r.id === preferred)?.id
        || state.manifest.routes.find(r => r.id === state.manifest.defaultRoute)?.id
        || state.manifest.routes.find(r => r.id === 'repair')?.id
        || state.manifest.routes[0]?.id;
      renderQualificationHeader();
      renderRoutes();
      routeSelect.addEventListener('change', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('course', state.qualificationId);
        url.searchParams.set('route', routeSelect.value);
        history.replaceState(null, '', url);
        selectRoute(routeSelect.value).catch(showError);
      });
      await selectRoute(state.route);
    } catch (error) { showError(error); }
  }

  function showError(error) {
    console.error(error);
    el('statusPanel').innerHTML = `<strong class="warn">Could not load the mapping data.</strong><p class="status-note">${escapeHtml(error?.message || error)}</p>`;
    browser.hidden = detail.hidden = exportPanel.hidden = true;
  }

  start();
})();