(() => {
  'use strict';

  const CONTRACT_FILE = 'evidence-capture-contract-v2.json';
  const TOKEN_PREFIX = 'naxosv2';
  const escType = value => String(value || '').trim().toLowerCase();
  const uniq = values => [...new Set(values || [])];

  function quantity(type, label) {
    const text = String(label || '').toLowerCase();
    const range = text.match(/(\d+)\s*(?:-|–|—|to)\s*(\d+)/i);
    if (range) {
      const a = Math.max(1, Number(range[1]) || 1);
      const b = Math.max(a, Number(range[2]) || a);
      return { min:a, max:b };
    }
    const upTo = text.match(/\bup\s+to\s+(\d+)\b/i);
    if (upTo) return { min:1, max:Math.max(1, Number(upTo[1]) || 1) };
    const photoCount = /photos?/.test(type) ? text.match(/\b(\d+)\s+photos?\b/i) : null;
    if (photoCount) {
      const count = Math.max(1, Number(photoCount[1]) || 1);
      return { min:count, max:count };
    }
    const direct = text.match(/\b(\d+)\b/);
    const count = Math.max(1, Number(direct?.[1]) || 1);
    if (type === 'photos' && !direct) return { min:1, max:3 };
    return { min:count, max:count };
  }

  function canonicalType(type) {
    const raw = escType(type);
    if (raw === 'photos') return 'photo';
    if (['video','photo','audio','written','document','witness','observation'].includes(raw)) return raw;
    return raw || 'written';
  }

  function captureToken(type, label) {
    const raw = escType(type);
    if (raw.startsWith(`${TOKEN_PREFIX}:`)) return raw;
    const kind = canonicalType(raw);
    const q = quantity(raw, label);
    return `${TOKEN_PREFIX}:${kind}:${q.min}:${q.max}`;
  }

  function evidencePatch(evidence, fallbackProfile = '') {
    if (!evidence || typeof evidence !== 'object') return null;
    const profileId = String(evidence.profileId || fallbackProfile || '').trim();
    const rows = (Array.isArray(evidence.preferred) ? evidence.preferred : [])
      .map(item => [
        captureToken(item?.type, item?.label),
        String(item?.label || '').trim(),
        String(item?.instruction || '').trim()
      ])
      .filter(row => row.some(Boolean));
    return rows.length ? [profileId, rows] : (profileId ? [profileId] : null);
  }

  function compactStore(store) {
    if (!store || typeof store !== 'object') return null;
    const patch = { v:2 };
    const c = [], s = [], t = [], e = [], a = [];

    for (const [key,value] of Object.entries(store.titles?.category || {})) {
      const ci = Number(key), title = String(value || '').trim();
      if (Number.isInteger(ci) && title) c.push([ci,title]);
    }
    for (const [key,value] of Object.entries(store.titles?.subcategory || {})) {
      const [ci,si] = String(key).split(':').map(Number), title = String(value || '').trim();
      if (Number.isInteger(ci) && Number.isInteger(si) && title) s.push([ci,si,title]);
    }
    for (const [key,value] of Object.entries(store.titles?.task || {})) {
      const [ci,si,ti] = String(key).split(':').map(Number), title = String(value || '').trim();
      if (Number.isInteger(ci) && Number.isInteger(si) && Number.isInteger(ti) && title) t.push([ci,si,ti,title]);
    }
    for (const [key,edit] of Object.entries(store.taskEdits || {})) {
      const [ci,si,ti] = String(key).split(':').map(Number);
      const evidence = evidencePatch(edit?.evidence);
      if (Number.isInteger(ci) && Number.isInteger(si) && Number.isInteger(ti) && evidence) e.push([ci,si,ti,evidence]);
    }
    for (const task of Array.isArray(store.customTasks) ? store.customTasks : []) {
      const ci = Number(task?.categoryIndex), si = Number(task?.subcategoryIndex);
      const title = String(task?.title || '').trim();
      const targets = uniq(Array.isArray(task?.targets) ? task.targets.map(String).filter(Boolean) : []);
      const evidence = evidencePatch(task?.evidence, String(task?.profileId || 'knowledge').trim() || 'knowledge');
      if (Number.isInteger(ci) && Number.isInteger(si) && title && targets.length && evidence) a.push([ci,si,title,targets,evidence]);
    }

    if (c.length) patch.c = c;
    if (s.length) patch.s = s;
    if (t.length) patch.t = t;
    if (e.length) patch.e = e;
    if (a.length) patch.a = a;
    return Object.keys(patch).length > 1 ? patch : null;
  }

  function storeKey(mode, courseId, routeId = 'default') {
    return `naxos-editor-v1:${mode}:${courseId}:${routeId || 'default'}`;
  }

  function readStore(mode, courseId, routeId = 'default') {
    try {
      const value = JSON.parse(localStorage.getItem(storeKey(mode, courseId, routeId)) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch { return null; }
  }

  async function json(path) {
    const response = await fetch(path, { cache:'no-store' });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  function renderQr(payload) {
    const area = document.getElementById('qrArea');
    const output = document.getElementById('qrPayload');
    const box = document.getElementById('qrcode');
    if (!area || !output || !box) return;
    output.value = payload;
    box.innerHTML = '';
    if (typeof QRCode !== 'function') throw new Error('QR library did not load.');
    new QRCode(box, { text:payload, width:320, height:320, correctLevel:QRCode.CorrectLevel.M });
    area.hidden = false;
  }

  async function ksbPayload() {
    const manifest = await json('ksb-manifest.json');
    const courseId = document.getElementById('courseSelect')?.value || manifest.courses?.[0]?.id;
    const course = manifest.courses?.find(item => item.id === courseId) || manifest.courses?.[0];
    if (!course?.pack) throw new Error('No KSB mapping pack is configured.');
    const packUrl = new URL(course.pack, new URL('./', location.href)).href;
    const data = {
      type:'evia-mapping-pack-url-v1', version:1, courseType:'ksb',
      courseId:course.id, standardVersion:course.version, packUrl,
      evidenceContractUrl:new URL(CONTRACT_FILE, new URL('./', location.href)).href
    };
    const patch = compactStore(readStore('ksb', course.id, 'default'));
    if (patch) data.patch = patch;
    return JSON.stringify(data);
  }

  async function nvqPayload() {
    const params = new URLSearchParams(location.search);
    const courseId = params.get('course') || '6570-05';
    const manifestFile = courseId === '6570-04' ? 'manifest-6570-04.json' : 'manifest.json';
    const manifest = await json(manifestFile);
    const routeId = document.getElementById('routeSelect')?.value || manifest.defaultRoute || manifest.routes?.[0]?.id;
    const route = manifest.routes?.find(item => item.id === routeId) || manifest.routes?.[0];
    if (!route?.pack) throw new Error('No NVQ mapping pack is configured.');
    const packUrl = new URL(route.pack, new URL('./', location.href)).href;
    const data = {
      type:'evia-mapping-pack-url', version:1, courseType:'nvq',
      qualificationId:manifest.qualificationId || courseId,
      route:route.id, optionalUnit:route.optionalUnit, packUrl,
      evidenceContractUrl:new URL(CONTRACT_FILE, new URL('./', location.href)).href
    };
    const patch = compactStore(readStore('nvq', courseId, route.id));
    if (patch) data.nvqPatchV2 = patch;
    return JSON.stringify(data);
  }

  async function interceptGenerate(event) {
    const button = event.target?.closest?.('#generateQr');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const payload = document.getElementById('courseSelect') ? await ksbPayload() : await nvqPayload();
      renderQr(payload);
    } catch (error) {
      console.error('Could not create exact-evidence Naxos QR', error);
      alert(error?.message || 'This course QR could not be created.');
    }
  }

  document.addEventListener('click', interceptGenerate, true);
  window.NaxosEvidenceContract = Object.freeze({ version:2, file:CONTRACT_FILE, captureToken, compactStore });
})();
