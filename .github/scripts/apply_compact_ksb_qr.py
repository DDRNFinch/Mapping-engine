from pathlib import Path

ksb = Path('ksb.js')
text = ksb.read_text()
start = text.index('  function compactEvidenceForExport(evidence){')
end = text.index('  function renderExport(){', start)
replacement = r'''  function evidenceRowsForPatch(evidence){
    return (evidence?.preferred||[]).map(item=>[
      String(item?.type||'').trim(),
      String(item?.label||'').trim(),
      String(item?.instruction||'').trim()
    ]).filter(row=>row.some(Boolean));
  }

  function compactEvidenceForPatch(evidence,baseProfileId=''){
    if(!evidence||typeof evidence!=='object') return null;
    const profileId=String(evidence.profileId||'').trim();
    const compareProfileId=profileId||baseProfileId;
    const baseProfile=state.evidenceRules?.profiles?.[compareProfileId]||{};
    const rows=evidenceRowsForPatch(evidence);
    const baseRows=evidenceRowsForPatch(baseProfile);
    const changedRows=JSON.stringify(rows)!==JSON.stringify(baseRows) ? rows : null;
    const changedProfile=profileId&&profileId!==baseProfileId ? profileId : (!baseProfileId&&profileId ? profileId : '');
    if(!changedProfile&&!changedRows) return null;
    return changedRows ? [changedProfile,changedRows] : [changedProfile];
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

  function exportPatch(){
    try{
      const store=editorStoreForExport();
      if(!store||typeof store!=='object') return null;
      const patch={v:1},categoryTitles=[],subcategoryTitles=[],taskTitles=[],evidenceEdits=[],addedTasks=[];

      for(const [key,value] of Object.entries(store.titles?.category||{})){
        const title=String(value||'').trim(),ci=Number(key);
        if(title&&Number.isInteger(ci)) categoryTitles.push([ci,title]);
      }
      for(const [key,value] of Object.entries(store.titles?.subcategory||{})){
        const [ci,si]=String(key).split(':').map(Number),title=String(value||'').trim();
        if(title&&Number.isInteger(ci)&&Number.isInteger(si)) subcategoryTitles.push([ci,si,title]);
      }
      for(const [key,value] of Object.entries(store.titles?.task||{})){
        const [ci,si,ti]=String(key).split(':').map(Number),title=String(value||'').trim();
        if(title&&Number.isInteger(ci)&&Number.isInteger(si)&&Number.isInteger(ti)) taskTitles.push([ci,si,ti,title]);
      }

      for(const [key,edit] of Object.entries(store.taskEdits||{})){
        const [ci,si,ti]=String(key).split(':').map(Number);
        if(!Number.isInteger(ci)||!Number.isInteger(si)||!Number.isInteger(ti)) continue;
        const baseTask=state.categories?.[ci]?.subcategories?.[si]?.tasks?.[ti];
        const evidence=compactEvidenceForPatch(edit?.evidence,String(baseTask?.evidenceProfile||''));
        if(evidence) evidenceEdits.push([ci,si,ti,evidence]);
      }

      for(const task of Array.isArray(store.customTasks)?store.customTasks:[]){
        const ci=Number(task?.categoryIndex),si=Number(task?.subcategoryIndex),title=String(task?.title||'').trim();
        const targets=Array.isArray(task?.targets)?task.targets.map(String).filter(Boolean):[];
        if(!Number.isInteger(ci)||!Number.isInteger(si)||!title||!targets.length) continue;
        const evidence=compactEvidenceForPatch(task?.evidence,'') || [String(task?.profileId||'knowledge').trim()||'knowledge'];
        addedTasks.push([ci,si,title,targets,evidence]);
      }

      if(categoryTitles.length) patch.c=categoryTitles;
      if(subcategoryTitles.length) patch.s=subcategoryTitles;
      if(taskTitles.length) patch.t=taskTitles;
      if(evidenceEdits.length) patch.e=evidenceEdits;
      if(addedTasks.length) patch.a=addedTasks;
      return Object.keys(patch).length>1 ? patch : null;
    }catch(error){
      console.error('Could not prepare compact Naxos patch',error);
      return null;
    }
  }

'''
text = text[:start] + replacement + text[end:]
text = text.replace("      const customisations=exportCustomisations();\n      if(customisations) data.customisations=customisations;", "      const patch=exportPatch();\n      if(patch) data.patch=patch;")
text = text.replace("new QRCode(el('qrcode'),{text:payload,width:240,height:240,correctLevel:QRCode.CorrectLevel.M});", "new QRCode(el('qrcode'),{text:payload,width:320,height:320,correctLevel:QRCode.CorrectLevel.M});")
text = text.replace("alert('This customised course QR is too large. Reduce the number of custom tasks or shorten the custom evidence text and try again.');", "alert('This course QR could not be created. Try shortening any custom wording and generate it again.');")
ksb.write_text(text)

html = Path('ksb.html')
text = html.read_text()
text = text.replace('./styles.css?v=8','./styles.css?v=9')
text = text.replace('ksb.js?v=7','ksb.js?v=8')
html.write_text(text)

styles = Path('styles.css')
text = styles.read_text()
old = ".export-panel{display:grid;grid-template-columns:1fr;gap:16px}.action-row{display:grid;grid-template-columns:1fr;gap:9px}.qr-area{padding-top:16px;border-top:1px solid var(--line)}#qrcode{width:fit-content;margin:0 auto 12px;padding:12px;border:1px solid var(--line);border-radius:16px;background:#fff}#qrcode img,#qrcode canvas{display:block;max-width:100%;height:auto}textarea{margin-bottom:8px;resize:vertical}"
new = ".export-panel{display:grid;grid-template-columns:1fr;gap:16px}.action-row{display:grid;grid-template-columns:1fr;gap:9px}.qr-area{padding:18px;border:1px solid var(--line);border-radius:22px;background:#fff;box-shadow:0 8px 24px rgba(79,45,49,.045)}#qrcode{width:fit-content;max-width:100%;margin:0 auto 16px;padding:20px;border:0;border-radius:22px;background:#fff}#qrcode img,#qrcode canvas{display:block;max-width:100%;height:auto;margin:auto}textarea{margin-bottom:8px;resize:vertical}"
if old not in text:
    raise SystemExit('QR style block not found')
text = text.replace(old,new)
text = text.replace(".export-panel{grid-template-columns:1.1fr .9fr}.qr-area{padding-top:0;padding-left:18px;border-top:0;border-left:1px solid var(--line)}", ".export-panel{grid-template-columns:1.1fr .9fr}.qr-area{padding:18px}")
styles.write_text(text)
