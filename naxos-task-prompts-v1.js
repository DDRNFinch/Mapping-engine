(()=>{'use strict';
const VERSION=1;
const STORE_PREFIX='naxos-task-prompts-v1';
let editorSession='';
let lastRendered='';
let scheduled=false;

const $=id=>document.getElementById(id);
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const uniq=items=>{const seen=new Set(),out=[];(items||[]).forEach(x=>{const s=clean(x),k=s.toLowerCase();if(s&&!seen.has(k)){seen.add(k);out.push(s)}});return out};
function sentence(text){const s=clean(text);if(!s)return'';return /[?.!]$/.test(s)?s:`${s}.`}
function taskPhrase(title){return clean(title).replace(/[?.!]+$/,'').replace(/^(work to|carry out|complete|perform|undertake)\s+/i,'').trim()||'this task'}
function profileId(value){
  const raw=clean(value).toLowerCase();
  if(['job-information','practical','hidden-work','knowledge','safety','resources','quality','programme','communication'].includes(raw))return raw;
  if(/communicat|witness/.test(raw))return'communication';
  if(/hidden/.test(raw))return'hidden-work';
  if(/safety/.test(raw))return'safety';
  if(/resource|tool/.test(raw))return'resources';
  if(/quality/.test(raw))return'quality';
  if(/programme|progress/.test(raw))return'programme';
  if(/job information|drawing|specification/.test(raw))return'job-information';
  if(/practical/.test(raw))return'practical';
  return'knowledge';
}
function derive(title,conditional='',profile='knowledge'){
  const t=taskPhrase(title),low=t.toLowerCase(),specific=sentence(conditional),p=profileId(profile);
  if(/regulation|standard|required standard|compliance/.test(low))return[
    'Which standard or regulation applies to the work you are carrying out?',
    'What requirement from it affects how this work must be completed?',
    'Show or describe where that requirement applies to the work in front of you.',
    'What could be wrong or non-compliant if that requirement was not followed?'
  ];
  if(p==='communication')return uniq([
    `What did you personally observe the apprentice doing during ${t}?`,
    `What did the apprentice communicate, coordinate or contribute during ${t}?`,
    specific?`From what you personally observed, ${specific.charAt(0).toLowerCase()+specific.slice(1)}`:'',
    `What result showed the apprentice handled ${t} appropriately?`
  ]);
  if(p==='job-information'||/drawing|specification|information|instruction/.test(low))return uniq([
    `Show the drawing, specification or job information you actually used for ${t}.`,
    specific,
    `Which dimensions or requirements were most important for ${t}?`,
    `How did that information change or confirm what you did?`
  ]);
  if(p==='safety')return uniq([
    `Show the main hazard and the controls you are using for ${t}.`,
    specific,
    `Why are those controls suitable for ${t}?`,
    `What would make you stop or change the work?`
  ]);
  if(p==='hidden-work')return uniq([
    `Show the ${t} clearly before it is covered or concealed.`,
    specific,
    `Show the position, fixing, bed, joint, spacing or continuity detail that matters for ${t}.`,
    `Show a wider view so the assessor can locate this detail in the work.`
  ]);
  if(p==='resources')return uniq([
    `Show the actual tools, materials or components you selected for ${t}.`,
    specific,
    `Why are they suitable for ${t}?`,
    `What did you check before using them?`
  ]);
  if(p==='quality')return uniq([
    `Show the check or measurement you are using for ${t}.`,
    specific,
    `What result, tolerance or requirement are you checking against?`,
    `What would you correct if the result was outside the requirement?`
  ]);
  if(p==='programme')return uniq([
    `What time or sequence was planned for ${t}?`,
    specific,
    `What progress did you actually make against that plan?`,
    `What changed, and who did you tell if the plan had to change?`
  ]);
  if(p==='practical')return uniq([
    `Show ${t} as you carry it out, not only the finished result.`,
    specific,
    `Show a measurement, check or quality decision that proves ${t} is being done correctly.`,
    `Explain anything important about ${t} that the camera cannot show directly.`
  ]);
  return uniq([
    specific,
    `Use the work you are doing to explain ${t} in your own words.`,
    `Give a real example from ${t} and explain what you did or would do.`,
    `What requirement, check or decision matters most for ${t}, and why?`
  ]);
}

function mode(){return $('courseSelect')?'ksb':($('routeSelect')?'nvq':'')}
function courseId(){if(mode()==='ksb')return $('courseSelect')?.value||'';return new URLSearchParams(location.search).get('course')||'6570-05'}
function routeId(){return mode()==='ksb'?'default':($('routeSelect')?.value||'default')}
function storeKey(m=mode(),c=courseId(),r=routeId()){return `${STORE_PREFIX}:${m}:${c}:${r||'default'}`}
function blankStore(){return{builtins:{},customs:{}}}
function readStore(m=mode(),c=courseId(),r=routeId()){
  try{const v=JSON.parse(localStorage.getItem(storeKey(m,c,r))||'null');return v&&typeof v==='object'?{builtins:{...(v.builtins||{})},customs:{...(v.customs||{})}}:blankStore()}catch{return blankStore()}
}
function writeStore(value,m=mode(),c=courseId(),r=routeId()){try{localStorage.setItem(storeKey(m,c,r),JSON.stringify(value))}catch{}}
function builtIns(id){return[...($(id)?.children||[])].filter(n=>n.classList?.contains('nav-button')&&n.dataset.naxosCustom!=='1')}
function indices(){
  const cats=builtIns('categories'),subs=builtIns('subcategories'),tasks=builtIns('tasks');
  return{ci:Math.max(0,cats.findIndex(x=>x.classList.contains('active'))),si:Math.max(0,subs.findIndex(x=>x.classList.contains('active'))),ti:tasks.findIndex(x=>x.classList.contains('active'))}
}
function activeCustomId(){return $('tasks')?.querySelector('.naxos-custom-task.active')?.dataset.naxosCustomId||''}
function builtinKey(i=indices()){return`${i.ci}:${i.si}:${i.ti}`}
function currentProfile(){return $('naxosProfileSelect')?.value||$('evidenceProfileTitle')?.textContent||'knowledge'}
function currentConditional(){const box=$('promptBox');return box&&!box.hidden?clean($('taskPrompt')?.textContent):''}
function currentTitle(){return clean($('naxosTaskName')?.value||$('taskTitle')?.textContent)}
function currentExplicit(){
  const store=readStore(),custom=activeCustomId();
  if(custom)return Array.isArray(store.customs[custom])?store.customs[custom]:null;
  const i=indices();if(i.ti<0)return null;return Array.isArray(store.builtins[builtinKey(i)])?store.builtins[builtinKey(i)]:null;
}
function effectivePrompts(){return currentExplicit()||derive(currentTitle(),currentConditional(),currentProfile())}

function renderTaskPrompts(){
  const list=$('evidenceCapture');if(!list||$('naxosTaskEditor')?.hidden===false)return;
  const prompts=effectivePrompts();if(!prompts.length)return;
  const signature=JSON.stringify(prompts);if(signature===lastRendered&&list.dataset.naxosActivityPrompts==='1')return;
  lastRendered=signature;list.dataset.naxosActivityPrompts='1';list.innerHTML=prompts.map(x=>`<li>${esc(x)}</li>`).join('');
}

function injectStyles(){if($('naxosTaskPromptStyles'))return;const style=document.createElement('style');style.id='naxosTaskPromptStyles';style.textContent=`
.naxos-prompt-editor{display:grid;gap:9px}.naxos-prompt-row{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:start}.naxos-prompt-row textarea{min-height:64px!important}.naxos-prompt-row .remove{min-height:42px;padding:8px 10px;background:#fff;color:#8e4b4e;border-color:var(--line);box-shadow:none}.naxos-prompt-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}@media(max-width:520px){.naxos-prompt-row{grid-template-columns:1fr}.naxos-prompt-row .remove{width:100%}}
`;document.head.appendChild(style)}
function ensurePromptCard(){
  const grid=$('naxosTaskEditor')?.querySelector('.naxos-editor-grid');if(!grid||$('naxosPromptCard'))return;
  const card=document.createElement('div');card.id='naxosPromptCard';card.className='naxos-editor-card full';card.innerHTML=`<span class="field-label">Capture prompts</span><p class="naxos-editor-help">These are the prompts Evia shows one at a time while this evidence is being collected. Naxos creates an activity-specific starting set; edit any wording you want.</p><div id="naxosPromptRows" class="naxos-prompt-editor"></div><div class="naxos-prompt-tools"><button type="button" id="naxosSuggestPrompts" class="secondary">Use Naxos prompts</button><button type="button" id="naxosAddPrompt" class="secondary">Add prompt</button></div>`;grid.appendChild(card);
  $('naxosSuggestPrompts').onclick=()=>setEditorPrompts(derive(currentTitle(),currentConditional(),currentProfile()));
  $('naxosAddPrompt').onclick=()=>{const p=editorPrompts();p.push('');setEditorPrompts(p,true)};
}
function editorPrompts(){return[...($('naxosPromptRows')?.querySelectorAll('textarea')||[])].map(x=>clean(x.value)).filter(Boolean)}
function setEditorPrompts(prompts,focusLast=false){
  const wrap=$('naxosPromptRows');if(!wrap)return;const rows=(prompts&&prompts.length?prompts:['']);wrap.innerHTML=rows.map((p,i)=>`<div class="naxos-prompt-row" data-index="${i}"><textarea placeholder="What should the learner or witness show or explain?">${esc(p)}</textarea><button type="button" class="remove">Remove</button></div>`).join('');
  wrap.querySelectorAll('.naxos-prompt-row').forEach(row=>row.querySelector('.remove').onclick=()=>{const p=editorPrompts(),i=Number(row.dataset.index);p.splice(i,1);setEditorPrompts(p)});if(focusLast)wrap.querySelector('.naxos-prompt-row:last-child textarea')?.focus();
}
function editorTarget(){
  const custom=activeCustomId(),i=indices(),adding=/add task/i.test(clean($('naxosEditorTitle')?.textContent));
  return{m:mode(),c:courseId(),r:routeId(),custom,i,adding,title:currentTitle(),conditional:currentConditional(),profile:currentProfile()}
}
function hydrateEditor(){
  const page=$('naxosTaskEditor');if(!page||page.hidden)return;ensurePromptCard();const target=editorTarget();const sig=JSON.stringify([target.m,target.c,target.r,target.custom,target.i.ci,target.i.si,target.i.ti,target.adding]);if(sig===editorSession)return;editorSession=sig;
  const store=readStore(target.m,target.c,target.r);let prompts=null;if(target.custom)prompts=store.customs[target.custom];else if(!target.adding&&target.i.ti>=0)prompts=store.builtins[builtinKey(target.i)];
  setEditorPrompts(Array.isArray(prompts)&&prompts.length?prompts:derive(target.title,target.conditional,target.profile));
}
function persistEditorPrompts(snapshot,prompts){
  if(!prompts.length)return;const store=readStore(snapshot.m,snapshot.c,snapshot.r);
  if(snapshot.custom){store.customs[snapshot.custom]=prompts;writeStore(store,snapshot.m,snapshot.c,snapshot.r);return}
  if(!snapshot.adding&&snapshot.i.ti>=0){store.builtins[builtinKey(snapshot.i)]=prompts;writeStore(store,snapshot.m,snapshot.c,snapshot.r);return}
  const mainKey=`naxos-editor-v1:${snapshot.m}:${snapshot.c}:${snapshot.r||'default'}`;
  let main=null;try{main=JSON.parse(localStorage.getItem(mainKey)||'null')}catch{}
  const customs=Array.isArray(main?.customTasks)?main.customTasks:[];
  const match=[...customs].reverse().find(t=>Number(t?.categoryIndex)===snapshot.i.ci&&Number(t?.subcategoryIndex)===snapshot.i.si&&clean(t?.title)===snapshot.title)||customs.at(-1);
  if(match?.id){store.customs[match.id]=prompts;writeStore(store,snapshot.m,snapshot.c,snapshot.r)}
}
function bindSave(){const button=$('naxosSaveTask');if(!button||button.dataset.naxosPromptBound)return;button.dataset.naxosPromptBound='1';button.addEventListener('click',()=>{const snapshot=editorTarget(),prompts=editorPrompts();setTimeout(()=>{persistEditorPrompts(snapshot,prompts);editorSession='';lastRendered='';schedule()},40)},true)}

function compactPatch(m,c,r,editorStore){
  const store=readStore(m,c,r),p=[],pc=[];
  Object.entries(store.builtins).forEach(([key,prompts])=>{const [ci,si,ti]=key.split(':').map(Number);if(Number.isInteger(ci)&&Number.isInteger(si)&&Number.isInteger(ti)&&Array.isArray(prompts)&&prompts.length)p.push([ci,si,ti,uniq(prompts)])});
  Object.entries(store.customs).forEach(([id,prompts])=>{const task=(editorStore?.customTasks||[]).find(x=>String(x?.id)===id);if(task&&Array.isArray(prompts)&&prompts.length)pc.push([Number(task.categoryIndex),Number(task.subcategoryIndex),clean(task.title),uniq(prompts)])});
  return{p,pc};
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;hydrateEditor();renderTaskPrompts();bindSave()})}
function init(){injectStyles();ensurePromptCard();bindSave();schedule();const main=document.querySelector('main')||document.body;new MutationObserver(schedule).observe(main,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});$('courseSelect')?.addEventListener('change',()=>{editorSession='';lastRendered='';setTimeout(schedule,30)});$('routeSelect')?.addEventListener('change',()=>{editorSession='';lastRendered='';setTimeout(schedule,30)})}
window.NaxosTaskPrompts=Object.freeze({version:VERSION,derive,readStore,compactPatch});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();