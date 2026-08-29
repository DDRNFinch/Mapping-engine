(() => {
  'use strict';

  const state = {
    manifest: null,
    pack: null,
    route: 'repair',
    categoryId: null,
    subcategoryId: null,
    taskId: null,
  };

  const el = id => document.getElementById(id);
  const routeSelect = el('routeSelect');
  const browser = el('browser');
  const detail = el('taskDetail');
  const exportPanel = el('exportPanel');

  const byId = (items, id) => items.find(x => x.id === id);

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
      <p class="status-note good"><strong>Structure and ID coverage pass.</strong> This remains a test pack until the final exact-wording audit is locked.</p>`;
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
      taskWrap.appendChild(button(item.title, () => {
        state.taskId = item.id;
        renderBrowser();
      }, item.id === state.taskId, `${item.mappedAtomicCount} mapped criteria`));
    });
    el('taskCount').textContent = `${sub.tasks.length}/5`;

    renderTask(category, sub, byId(sub.tasks, state.taskId));
  }

  function renderTask(category, sub, task) {
    if (!task) { detail.hidden = true; return; }
    detail.hidden = false;
    el('taskPath').textContent = `${category.title} › ${sub.title} › ${task.id}`;
    el('taskTitle').textContent = task.title;
    el('mappedCount').textContent = task.mappedAtomicCount;

    el('taskMeta').innerHTML = `
      <div class="meta-item"><strong>Route</strong>${escapeHtml(task.route)}</div>
      <div class="meta-item"><strong>Primary unit</strong>${escapeHtml(task.primaryUnit)}</div>
      <div class="meta-item"><strong>Type</strong>${escapeHtml(task.type)}</div>
      <div class="meta-item"><strong>Holistic tags</strong>${escapeHtml(task.tags.join(', ') || 'None')}</div>
      <div class="meta-item"><strong>Direct LO7 targets</strong>${escapeHtml(String(task.directLo7Targets.length))}</div>
      <div class="meta-item"><strong>All primary mappings</strong>${escapeHtml(String(task.mappedAtomicTargets.length))}</div>`;

    const promptBox = el('promptBox');
    if (task.conditionalPrompt) {
      promptBox.hidden = false;
      el('taskPrompt').textContent = task.conditionalPrompt;
    } else {
      promptBox.hidden = true;
    }

    const list = el('criteriaList');
    list.innerHTML = '';
    task.mappedAtomicTargets.forEach(id => {
      const tag = document.createElement('span');
      tag.className = 'criterion';
      tag.textContent = id;
      list.appendChild(tag);
    });

    el('copyCriteria').onclick = async () => {
      await navigator.clipboard.writeText(task.mappedAtomicTargets.join('\n'));
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
      state.manifest = await fetchJson('manifest.json');
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
