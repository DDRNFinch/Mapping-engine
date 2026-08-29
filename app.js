(() => {
  'use strict';

  const state = {
    manifest: null,
    pack: null,
    evidenceRules: null,
    route: 'repair',
    categoryId: null,
    subcategoryId: null,
    taskId: null,
    evidenceSelections: {},
  };

  const el = id => document.getElementById(id);
  const routeSelect = el('routeSelect');
  const browser = el('browser');
  const detail = el('taskDetail');
  const exportPanel = el('exportPanel');

  const byId = (items, id) => items.find(x => x.id === id);
  const allTaskTargets = task => [...new Set([...(task.directLo7Targets || []), ...(task.mappedAtomicTargets || [])])];

  async function fetchJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  function renderRoutes() {
    routeSelect.innerHTML = '';
    for (const route of state.manifest.routes) {
      const option = document.createElement('option');
      option.value = route.id;
      option.textContent = `${route.optionalUnit} · ${route.title}${route.status === 'mapped-test' ? '' : ' · mapping next'}`;
      routeSelect.appendChild(option);
    }
    routeSelect.value = state.route;
  }

  function renderStatus(route) {
    const panel = el('statusPanel');
    if (!route || route.status !== 'mapped-test' || !state.pack) {
      panel.innerHTML = `
        <strong class="warn">${route ? route.title : 'Route'} is selectable but is not mapped yet.</strong>
        <p class="status-note">The current working test route is <strong>690 · Repair & Maintenance</strong>. Export and QR are disabled until a route has a locked map.</p>`;
      browser.hidden = true;
      detail.hidden = true;
      exportPanel.hidden = true;
      return;
    }

    const v = state.pack.validation;
    panel.innerHTML = `
      <div class="status-grid">
        <div class="metric"><strong>${v.categoryCount}/5</strong><span>categories</span></div>
        <div class="metric"><strong>25/25</strong><span>sub-categories</span></div>
        <div class="metric"><strong>${state.pack.route.taskTypeCount}/125</strong><span>task types</span></div>
        <div class="metric"><strong>${state.pack.route.mappedAtomicTargetCount}/${state.pack.route.atomicTargetCount}</strong><span>atomic criteria mapped</span></div>
        <div class="metric"><strong>${state.pack.route.orphanAtomicTargetCount}</strong><span>orphan criteria</span></div>
      </div>
      <p class="status-note good"><strong>Structure and ID coverage pass.</strong> Candidate criteria are never one-file-per-criterion: one strong task submission can satisfy many criteria when it actually demonstrates them.</p>`;
    browser.hidden = false;
    exportPanel.hidden = false;
  }

  function button(text, onClick, active = false, small = '') {
    const b = document.createElement('button');
    b.className = `nav-button${active ? ' active' : ''}`;
    b.innerHTML = `<span>${escapeHtml(text)}${small ? `<small>${escapeHtml(small)}</small>` : ''}</span>`;
    b.addEventListener('click', onClick);
    return b;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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
    categories.forEach(cat => {
      catWrap.appendChild(button(cat.title, () => {
        state.categoryId = cat.id;
        state.subcategoryId = null;
        state.taskId = null;
        renderBrowser();
      }, cat.id === state.categoryId, `${cat.subcategories.length} sub-categories`));
    });
    el('categoryCount').textContent = `${categories.length}/5`;

    const subWrap = el('subcategories');
    subWrap.innerHTML = '';
    category.subcategories.forEach(item => {
      subWrap.appendChild(button(item.title, () => {
        state.subcategoryId = item.id;
        state.taskId = null;
        renderBrowser();
      }, item.id === state.subcategoryId, `${item.tasks.length} tasks`));
    });
    el('subcategoryCount').textContent = `${category.subcategories.length}/5`;

    const taskWrap = el('tasks');
    taskWrap.innerHTML = '';
    sub.tasks.forEach(item => {
      const profile = resolveEvidenceProfile(item);
      taskWrap.appendChild(button(item.title, () => {
        state.taskId = item.id;
        renderBrowser();
      }, item.id === state.taskId, `${allTaskTargets(item).length} candidate criteria · ${profile.shortLabel}`));
    });
    el('taskCount').textContent = `${sub.tasks.length}/5`;

    renderTask(category, sub, byId(sub.tasks, state.taskId));
  }

  function resolveEvidenceProfile(task) {
    const profiles = state.evidenceRules?.profiles || {};
    const title = String(task.title || '').toLowerCase();
    const tags = new Set(task.tags || []);
    let id = task.evidenceProfile;

    if (!id && task.id === '1.1.4') id = 'job-information';
    if (!id && /(dpc|cavity tray|insulation|wall tie|fire barrier|fire break|support angle|wind post|movement joint|weep|vent|reinforcement|soffit|temporary|prop|support)/i.test(title)) id = 'hidden-work';
    if (!id && task.type === 'trade') id = 'practical';
    if (!id && task.type === 'optional-knowledge') id = 'knowledge';
    if (!id && task.type === 'common' && /^(summarise|explain|discuss|describe)/i.test(title)) id = 'knowledge';
    if (!id && tags.has('SAFE_WORK')) id = 'safety';
    if (!id && tags.has('COMMUNICATION')) id = 'communication';
    if (!id && (tags.has('RESOURCES') || tags.has('TOOLS'))) id = 'resources';
    if (!id && tags.has('QUALITY')) id = 'quality';
    if (!id && tags.has('PROGRAMME')) id = 'programme';
    if (!id) id = 'knowledge';

    return profiles[id] || profiles.knowledge || {
      id: 'knowledge', label: 'Knowledge statement', shortLabel: 'Audio / written',
      preferred: [], alternatives: [], capture: []
    };
  }

  function evidenceTypeChip(type) {
    const names = {
      video: 'Video', photos: 'Photos', photo: 'Photo', document: 'Document',
      audio: 'Audio', written: 'Written statement', witness: 'Witness statement',
      observation: 'Assessor observation'
    };
    return `<span class="evidence-chip">${escapeHtml(names[type] || type)}</span>`;
  }

  function renderEvidencePlan(task, taskTargets) {
    const panel = el('evidencePlan');
    const profile = resolveEvidenceProfile(task);
    panel.hidden = false;

    const preferredItems = (profile.preferred || []).map(item => `
      <div class="evidence-item">
        <div class="evidence-item-head">${evidenceTypeChip(item.type)} <strong>${escapeHtml(item.label)}</strong></div>
        <p>${escapeHtml(item.instruction)}</p>
      </div>`).join('');

    const alternatives = (profile.alternatives || []).map(alt => `
      <div class="alternative-box">
        <strong>${escapeHtml(alt.label)}</strong>
        <p>${escapeHtml(alt.instruction)}</p>
      </div>`).join('');

    const capture = [...(profile.capture || [])];
    if (task.conditionalPrompt) capture.push(task.conditionalPrompt);

    el('evidenceProfileTitle').textContent = profile.label;
    el('evidenceMinimum').innerHTML = preferredItems;
    el('evidenceAlternatives').innerHTML = alternatives;
    el('evidenceCapture').innerHTML = capture.map(x => `<li>${escapeHtml(x)}</li>`).join('');
    el('oneSubmissionNote').textContent = profile.oneSubmissionNote || 'This is one task submission. The same evidence can support several criteria; it is not one file per criterion.';

    const selector = el('evidenceSelector');
    if (task.id === '1.1.4') {
      renderJobInformationSelector(task, taskTargets, selector);
    } else {
      selector.hidden = true;
      selector.innerHTML = '';
      el('evidenceCoverageText').textContent = `${taskTargets.length} candidate criteria can be considered from this task. Only criteria actually demonstrated are awarded.`;
    }
  }

  const infoOptions = [
    ['drawing', 'Drawings'],
    ['specification', 'Specifications'],
    ['schedule', 'Schedules'],
    ['method', 'Method statement / method of work'],
    ['risk', 'Risk assessment'],
    ['manufacturer', 'Manufacturer information'],
    ['oral-written', 'Oral / written instructions'],
    ['sketch', 'Sketches'],
    ['electronic', 'Electronic data'],
    ['official', 'Official guidance'],
    ['programme', 'Programme of work'],
  ];

  function infoTypeForCriterion(id) {
    const p = String(id).split('.');
    if (p.length < 4) return null;
    const unit = p[0], parent = `${p[1]}.${p[2]}`, child = p[3];

    if (['234','235','313','690','701'].includes(unit)) {
      if (parent === '1.1') {
        return ({a:'drawing',b:'specification',c:'schedule',d:'method',e:'risk',f:'manufacturer'})[child] || null;
      }
      if (parent === '1.4') {
        return ({a:'drawing',b:'specification',d:'schedule',e:'method',f:'risk',g:'manufacturer',h:'oral-written',i:'sketch',j:'electronic',k:'official'})[child] || null;
      }
    }
    if (unit === '303' && parent === '1.1') {
      return ({a:'drawing',b:'specification',c:'schedule',d:'manufacturer',e:'method',f:'risk',g:'programme'})[child] || null;
    }
    return null;
  }

  function renderJobInformationSelector(task, taskTargets, selector) {
    selector.hidden = false;
    const selected = new Set(state.evidenceSelections[task.id] || []);
    selector.innerHTML = `
      <div class="selector-heading">
        <div>
          <strong>What information did you actually use today?</strong>
          <p>Select only what was genuinely used. This stops the engine awarding all 87 candidate criteria automatically.</p>
        </div>
        <button id="clearEvidenceSelection" class="secondary compact">Clear</button>
      </div>
      <div class="check-grid">
        ${infoOptions.map(([value,label]) => `
          <label class="check-option">
            <input type="checkbox" value="${value}" ${selected.has(value) ? 'checked' : ''}>
            <span>${escapeHtml(label)}</span>
          </label>`).join('')}
      </div>
      <div class="selected-coverage">
        <strong id="selectedCoverageCount">0</strong>
        <span>of ${taskTargets.length} candidate criteria potentially supported by this evidence</span>
      </div>
      <details class="selected-details">
        <summary>Show criteria selected for this evidence</summary>
        <div id="selectedCriteriaList" class="criteria-list"></div>
      </details>`;

    const refresh = () => {
      const values = [...selector.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value);
      state.evidenceSelections[task.id] = values;
      const valueSet = new Set(values);
      const selectedTargets = taskTargets.filter(id => valueSet.has(infoTypeForCriterion(id)));
      el('selectedCoverageCount').textContent = selectedTargets.length;
      el('evidenceCoverageText').textContent = selectedTargets.length
        ? `One strong submission can potentially support these ${selectedTargets.length} selected criteria across the active units. Each is still checked against what the evidence actually shows or explains.`
        : `Choose the information used today. The 87 listed criteria are possibilities, not 87 separate evidence files.`;
      const list = el('selectedCriteriaList');
      list.innerHTML = selectedTargets.map(id => `<span class="criterion selected">${escapeHtml(id)}</span>`).join('');
    };

    selector.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', refresh));
    el('clearEvidenceSelection').onclick = () => {
      selector.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
      refresh();
    };
    refresh();
  }

  function renderTask(category, sub, task) {
    if (!task) { detail.hidden = true; return; }
    detail.hidden = false;
    el('taskPath').textContent = `${category.title} › ${sub.title} › ${task.id}`;
    el('taskTitle').textContent = task.title;
    const taskTargets = allTaskTargets(task);
    el('mappedCount').textContent = taskTargets.length;

    const profile = resolveEvidenceProfile(task);
    el('taskMeta').innerHTML = `
      <div class="meta-item"><strong>Route</strong>${escapeHtml(task.route)}</div>
      <div class="meta-item"><strong>Primary unit</strong>${escapeHtml(task.primaryUnit)}</div>
      <div class="meta-item"><strong>Evidence type</strong>${escapeHtml(profile.shortLabel)}</div>
      <div class="meta-item"><strong>Holistic tags</strong>${escapeHtml((task.tags || []).join(', ') || 'None')}</div>
      <div class="meta-item"><strong>Direct LO7 targets</strong>${escapeHtml(String((task.directLo7Targets || []).length))}</div>
      <div class="meta-item"><strong>Candidate atomic criteria</strong>${escapeHtml(String(taskTargets.length))}</div>`;

    const promptBox = el('promptBox');
    if (task.conditionalPrompt) {
      promptBox.hidden = false;
      el('taskPrompt').textContent = task.conditionalPrompt;
    } else {
      promptBox.hidden = true;
    }

    renderEvidencePlan(task, taskTargets);

    const list = el('criteriaList');
    list.innerHTML = '';
    taskTargets.forEach(id => {
      const tag = document.createElement('span');
      tag.className = 'criterion';
      tag.textContent = id;
      list.appendChild(tag);
    });

    el('copyCriteria').onclick = async () => {
      await navigator.clipboard.writeText(taskTargets.join('\n'));
      el('copyCriteria').textContent = 'Copied';
      setTimeout(() => el('copyCriteria').textContent = 'Copy IDs', 1000);
    };
  }

  function packUrl() {
    const route = state.manifest.routes.find(r => r.id === state.route);
    if (!route?.pack) return null;
    return new URL(route.pack, new URL('./', window.location.href)).href;
  }

  function renderExport() {
    const url = packUrl();
    if (!url) return;
    el('downloadPack').href = url;
    el('generateQr').onclick = () => {
      const payload = JSON.stringify({
        type: 'evia-course-url',
        version: 1,
        qualificationId: '6570-05',
        route: state.route,
        packUrl: url,
      });
      el('qrPayload').value = payload;
      el('qrcode').innerHTML = '';
      if (typeof QRCode !== 'function') {
        alert('QR library did not load. Check the connection and try again.');
        return;
      }
      new QRCode(el('qrcode'), {
        text: payload,
        width: 240,
        height: 240,
        correctLevel: QRCode.CorrectLevel.M,
      });
      el('qrArea').hidden = false;
    };
    el('copyPayload').onclick = async () => {
      await navigator.clipboard.writeText(el('qrPayload').value);
      el('copyPayload').textContent = 'Copied';
      setTimeout(() => el('copyPayload').textContent = 'Copy payload', 1000);
    };
  }

  async function selectRoute(routeId) {
    state.route = routeId;
    state.pack = null;
    state.categoryId = state.subcategoryId = state.taskId = null;
    el('qrArea').hidden = true;
    const route = state.manifest.routes.find(r => r.id === routeId);
    if (route?.pack) {
      state.pack = await fetchJson(route.pack);
      if (Array.isArray(state.pack.categoryFiles)) {
        state.pack.categories = await Promise.all(state.pack.categoryFiles.map(fetchJson));
      }
    }
    renderStatus(route);
    if (state.pack) {
      renderBrowser();
      renderExport();
    }
  }

  async function start() {
    try {
      [state.manifest, state.evidenceRules] = await Promise.all([
        fetchJson('manifest.json'),
        fetchJson('evidence-rules.json'),
      ]);
      renderRoutes();
      routeSelect.addEventListener('change', () => selectRoute(routeSelect.value));
      await selectRoute(state.route);
    } catch (error) {
      console.error(error);
      el('statusPanel').innerHTML = `<strong class="warn">Could not load the mapping data.</strong><p class="status-note">${escapeHtml(error.message)}</p>`;
    }
  }

  start();
})();
