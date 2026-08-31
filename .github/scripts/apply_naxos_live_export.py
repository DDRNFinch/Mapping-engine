from pathlib import Path

editor = Path('naxos-editor.js')
text = editor.read_text()
old = """  function saveStore() {
    if (!ctx) return;
    try { localStorage.setItem(storageKey(), JSON.stringify(ctx.store)); } catch {}
  }

  async function loadContext() {
"""
new = """  function saveStore() {
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
"""
if old not in text:
    raise SystemExit('naxos-editor saveStore marker not found')
text = text.replace(old, new, 1)
editor.write_text(text)

ksb = Path('ksb.js')
text = ksb.read_text()
old = """  function exportCustomisations(){
    const key=`naxos-editor-v1:ksb:${state.course.id}:default`;
    try{
      const store=JSON.parse(localStorage.getItem(key)||'null');
      if(!store || typeof store!=='object') return null;
"""
new = """  function editorStoreForExport(){
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
"""
if old not in text:
    raise SystemExit('ksb exportCustomisations marker not found')
text = text.replace(old, new, 1)
ksb.write_text(text)

html = Path('ksb.html')
text = html.read_text()
if 'ksb.js?v=6' not in text:
    raise SystemExit('ksb.js v6 marker not found')
if 'naxos-editor.js?v=1' not in text:
    raise SystemExit('naxos-editor v1 marker not found')
text = text.replace('ksb.js?v=6', 'ksb.js?v=7', 1)
text = text.replace('naxos-editor.js?v=1', 'naxos-editor.js?v=2', 1)
html.write_text(text)
