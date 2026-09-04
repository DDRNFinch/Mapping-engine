(()=>{'use strict';
const BASE=globalThis.NaxosQuestionBankV1;
if(!BASE?.build)throw new Error('NaxosQuestionBankV1 must load before v2.');
const VERSION=2;
const PROFILES={
 safety:{stems:[
  'While working on {topic}, a required control is no longer effective. What is the best response?',
  'During {topic}, conditions change and the agreed safe system no longer controls the risk. What should happen?',
  'A colleague wants to continue {topic} even though an agreed control has failed. Which response is strongest?'
 ]},
 info:{stems:[
  'While preparing {topic}, two current-looking sources conflict. What is the best next step?',
  'The drawing, specification or instruction for {topic} does not agree with the site condition. What should you do?',
  'Before committing work on {topic}, the information is incomplete or inconsistent. Which response is strongest?'
 ]},
 resource:{stems:[
  'A material or component for {topic} does not fully match the issued requirement. What is the best response?',
  'During {topic}, a resource has doubtful condition or identification. What should you do?',
  'A colleague proposes a similar substitute for {topic} because the specified item is unavailable. Which response is strongest?'
 ]},
 tools:{stems:[
  'A tool or item of equipment used for {topic} develops a defect during a pre-use check. What should you do?',
  'During {topic}, the equipment still operates but a safety or accuracy feature is unreliable. What is the best response?',
  'A colleague suggests using defective equipment only to finish a short part of {topic}. Which response is strongest?'
 ]},
 quality:{stems:[
  'While carrying out {topic}, a check shows the work no longer matches the issued requirement. What is the best response?',
  'During {topic}, the work looks acceptable but a required quality check does not pass. What should you do?',
  'The next stage will conceal part of {topic}, but a required check is still outstanding. Which response is strongest?'
 ]},
 estimate:{stems:[
  'A quantity for {topic} is much higher than expected. What is the most reliable check?',
  'Before ordering for {topic}, your calculation differs significantly from a previous similar job. What should you do?',
  'You need to allow for dimensions, openings or waste when planning {topic}. Which approach is strongest?'
 ]},
 environment:{stems:[
  'The work on {topic} produces reusable, recyclable and disposal waste. What is the best approach?',
  'During {topic}, mixed waste and usable offcuts are building up in the work area. What should happen?',
  'At the end of {topic}, several waste streams have been mixed. Which response is strongest?'
 ]},
 communication:{stems:[
  'Your work on {topic} will affect another person or trade. What is the best response?',
  'During {topic}, the sequence or information needed by another person becomes unclear. What should you do?',
  'A coordination issue around {topic} could create delay or rework. Which response is strongest?'
 ]},
 inclusion:{stems:[
  'A colleague is being excluded during {topic} for reasons unrelated to competence or safety. What is the best response?',
  'During {topic}, someone is treated differently because of an assumption rather than their work. What should you do?',
  'A team decision affecting {topic} is unfair and has no work-related justification. Which response is strongest?'
 ]},
 wellbeing:{stems:[
  'A colleague involved in {topic} says their wellbeing is affecting concentration. What is the best response?',
  'During {topic}, a normally reliable colleague is distressed and making unusual mistakes. What should you do?',
  'A wellbeing concern may now affect safe work on {topic}. Which response is strongest?'
 ]},
 competence:{stems:[
  'You are asked to carry out {topic}, but an important decision is outside your current competence or authority. What should you do?',
  'During {topic}, a technical decision is needed that you are not authorised to make. What is the best response?',
  'An improvised solution could keep {topic} moving, but the decision is outside your role. Which response is strongest?'
 ]}
};
function clean(v){return String(v??'').replace(/\s+/g,' ').trim()}
function stripCode(v){return clean(v).replace(/^[A-Z]+\d+[a-z]?\s*[-:–]?\s*/i,'').replace(/[.;]+$/,'')}
function clipped(v,n=170){const s=stripCode(v);return s.length>n?`${s.slice(0,n-1).trim()}…`:s}
function topicText(v){const s=stripCode(v);const first=(s.split(/[.;]/)[0]||s).trim();return (first.length>105?`${first.slice(0,104).trim()}…`:first).toLowerCase()||'the task'}
function classify(text){const s=clean(text).toLowerCase();
 if(/well-?being|mental|physical health|support available/.test(s))return'wellbeing';
 if(/inclusion|inclusive|equity|equality|divers/.test(s))return'inclusion';
 if(/drawing|specification|information|digital design|modelling|interpret|technical literature|data/.test(s))return'info';
 if(/estimate|quantity|cutting list|calculate|resource estimation/.test(s))return'estimate';
 if(/environment|sustain|recycl|waste|net zero/.test(s))return'environment';
 if(/communicat|team|relationship|customer|stakeholder/.test(s))return'communication';
 if(/tool|machine|equipment|laser|jig|sharpen/.test(s))return'tools';
 if(/material|timber|brick|block|mortar|component|product|adhesive|paint|tile|flooring/.test(s))return'resource';
 if(/health and safety|safe|hazard|risk|ppe|rpe|coshh|working at height|isolate|fire/.test(s))return'safety';
 if(/authority|competence|cpd|learning and development|seek learning/.test(s))return'competence';
 return'quality'}
function answersFor(type,focus,index){
 const f=clipped(focus),v=index%3;
 const variants={
  safety:[
   [`For the requirement on ${f}, stop the affected activity, make the situation safe and restore or review the failed control before restarting.`,[`Continue the ${f} activity cautiously because the original task has not changed.`,`Keep ${f} moving by relying on PPE while the failed control is left as it is.`,`Finish the immediate ${f} operation first, then report that the control failed.`]],
   [`Pause work connected with ${f}; reassess the changed risk and put an effective agreed control back in place before continuing.`,[`Reduce the pace of ${f} and continue under the original method without reviewing it.`,`Ask another operative to watch ${f} while the failed control remains unavailable.`,`Complete the current stage of ${f} because changing the system now would delay the job.`]],
   [`Do not continue ${f} under a failed control: secure the activity, review the safe system and resume only when the risk is properly controlled.`,[`Carry on with ${f} if the remaining exposure is brief.`,`Use additional PPE for ${f} instead of restoring the failed control.`,`Record the failed control for ${f} and deal with it after the task is finished.`]]
  ],
  info:[
   [`For ${f}, stop before committing the work, confirm the current approved information and resolve the conflict before proceeding.`,[`Choose the drawing for ${f} automatically because drawings always override site information.`,`Follow the site condition for ${f} without checking because it is physically present.`,`Average the conflicting information for ${f} so progress can continue.`]],
   [`Before continuing ${f}, verify which instruction, drawing or specification is current and obtain clarification for any conflict.`,[`Use whichever ${f} document is easiest to follow.`,`Continue ${f} from memory and correct it later if necessary.`,`Let the next trade decide which ${f} information should have been used.`]],
   [`Treat the uncertainty around ${f} as unresolved: check the approved source and get the discrepancy confirmed before work is fixed or concealed.`,[`Use the newest-looking ${f} document even if its revision is unconfirmed.`,`Adapt ${f} to suit the site without recording the change.`,`Proceed with ${f} and ask for confirmation only at handover.`]]
  ],
  resource:[
   [`For ${f}, separate the questionable resource and confirm its condition, specification and approval before it is incorporated.`,[`Use the resource for a less visible part of ${f}.`,`Use extra quantity of the substitute during ${f} to compensate for the difference.`,`Install the resource for ${f} and record the substitution only at handover.`]],
   [`Do not use the doubtful material in ${f} until its identity, suitability and approval have been checked against the requirement.`,[`Fit the material during ${f} if it appears close enough to the specified item.`,`Ask another operative to accept the material for ${f} informally.`,`Keep the material in ${f} and replace it only if the finished work fails inspection.`]],
   [`Quarantine the resource intended for ${f}, verify it against the current requirement and use it only when its suitability is confirmed.`,[`Use the resource in ${f} where it will be concealed.`,`Modify the resource on site for ${f} without checking approval.`,`Proceed with ${f} because shortages justify an unapproved substitution.`]]
  ],
  tools:[
   [`For ${f}, stop using the defective equipment, identify it as out of service and follow the workplace route for reporting, repair or replacement.`,[`Continue ${f} with the equipment at a reduced load or speed.`,`Let the most experienced person try the equipment during ${f} before deciding.`,`Use the defective equipment only for a non-visible part of ${f}.`]],
   [`Do not continue ${f} with unreliable equipment; take it out of use and arrange the required report, inspection, maintenance or replacement.`,[`Use the equipment for ${f} only until the current operation is complete.`,`Keep the equipment in service for ${f} if a colleague agrees to monitor it.`,`Compensate for the defect during ${f} by working more slowly.`]],
   [`Suspend the affected part of ${f} until the defective tool or equipment is removed from service and dealt with through the approved workplace procedure.`,[`Finish ${f} first because the defect has not stopped the equipment operating.`,`Use the equipment for ${f} only where accuracy is less important.`,`Ask someone else to use the equipment for ${f} so responsibility is transferred.`]]
  ],
  quality:[
   [`For ${f}, stop before the defect is concealed, identify the cause, correct or escalate it and repeat the required check before continuing.`,[`Continue ${f} and correct only the visible result at final inspection.`,`Record the deviation in ${f} but leave it unless another trade objects.`,`Adjust a later part of ${f} to disguise the current error.`]],
   [`Hold the next stage of ${f}, investigate why the check failed and bring the work back to the issued requirement before it is covered.`,[`Proceed with ${f} because the work looks acceptable despite the failed check.`,`Leave the ${f} defect for handover so it can be considered with the finished job.`,`Change the next stage of ${f} instead of correcting the failed requirement.`]],
   [`Do not conceal ${f} while a required check is unresolved; correct or formally escalate the issue and verify compliance before moving on.`,[`Photograph ${f} and continue even though the check has not passed.`,`Accept ${f} because a later finish will hide the discrepancy.`,`Continue ${f} and rely on the final inspection to identify any problem.`]]
  ],
  estimate:[
   [`For ${f}, recalculate from the current job information and check dimensions, deductions, components and any justified allowance before ordering.`,[`Use the quantity from a previous ${f} job because it is a practical benchmark.`,`Keep the higher ${f} figure without checking so there is no risk of shortage.`,`Round every stage of the ${f} calculation upward before checking the dimensions.`]],
   [`Rework the ${f} quantity from the issued dimensions and current scope, then compare each assumption before accepting the total.`,[`Average the new ${f} quantity with the previous job total.`,`Order the larger ${f} amount and investigate only if material is left over.`,`Ignore openings or deductions in ${f} so the estimate stays conservative.`]],
   [`Trace the ${f} estimate back to the current measurements, required components and stated waste allowance, correcting any unsupported assumption.`,[`Use a rule-of-thumb quantity for ${f} instead of checking the current information.`,`Apply the same waste allowance to every part of ${f} without justification.`,`Choose the nearest whole quantity for ${f} before completing the calculation.`]]
  ],
  environment:[
   [`For ${f}, keep the area controlled and separate reusable, recyclable and disposal material using the site's agreed waste arrangements.`,[`Put all waste from ${f} in the nearest container so the area is cleared quickly.`,`Keep only high-value offcuts from ${f} and dispose of the rest together.`,`Leave all sorting from ${f} until the end of the project.`]],
   [`Manage waste from ${f} as it is produced: retain usable material and place each waste stream in the correct reuse, recycling or disposal route.`,[`Mix the ${f} waste now and sort it later if there is time.`,`Dispose of every offcut from ${f} even where it can be reused.`,`Move mixed ${f} waste out of sight without checking the site waste plan.`]],
   [`During ${f}, prevent mixed waste building up by segregating materials at source and following the site's resource and disposal arrangements.`,[`Use one container for all ${f} waste because segregation slows the task.`,`Separate only hazardous ${f} waste and mix all other materials together.`,`Wait until ${f} is complete before deciding which materials could have been reused.`]]
  ],
  communication:[
   [`For ${f}, share the relevant information with the people affected and agree a safe, workable sequence before the coordination issue creates rework.`,[`Complete your part of ${f} first because it is already under way.`,`Leave the ${f} issue for the next person to solve when they reach it.`,`Create an informal workaround for ${f} without agreeing the changed sequence.`]],
   [`Clarify the ${f} information with the affected people, confirm responsibilities and agree the sequence before work proceeds.`,[`Assume the other trade understands ${f} without checking.`,`Change the ${f} sequence yourself and tell others afterwards.`,`Continue ${f} until the coordination problem actually stops the job.`]],
   [`Resolve the ${f} interface early by communicating the change, checking understanding and agreeing what each person will do next.`,[`Send a vague message about ${f} and continue regardless of the response.`,`Wait for someone else to raise the ${f} conflict formally.`,`Prioritise your own ${f} output even if it blocks following work.`]]
  ],
  inclusion:[
   [`For ${f}, support fair and respectful treatment and address or report the inappropriate practice through the correct workplace route.`,[`Ignore the issue during ${f} unless the person affected makes a formal complaint.`,`Accept the unequal treatment in ${f} if the current arrangement is quicker.`,`Move the colleague to simpler ${f} work so the disagreement disappears.`]],
   [`Challenge the unsupported assumption affecting ${f} appropriately and make sure work opportunities or decisions are based on relevant competence and safety requirements.`,[`Keep the ${f} decision unchanged because challenging it may create tension.`,`Exclude the colleague from ${f} until they prove the assumption wrong.`,`Treat the ${f} issue as personal rather than a workplace concern.`]],
   [`Do not allow an unjustified assumption to determine ${f}; use the proper route to restore fair, respectful and work-related decision-making.`,[`Use the existing ${f} arrangement because it is familiar to the team.`,`Avoid discussing the ${f} decision and give the person different work.`,`Wait until ${f} is finished before considering whether the treatment was fair.`]]
  ],
  wellbeing:[
   [`For ${f}, prioritise immediate safety, speak supportively with the person and involve appropriate supervision or support where needed.`,[`Tell the person to continue ${f} more slowly and keep the concern private.`,`Move them away from ${f} without discussing what support they need.`,`Wait until the end of the week before responding to the ${f} concern.`]],
   [`If wellbeing is affecting ${f}, make the activity safe, check in with the person and use the appropriate support or escalation route rather than ignoring the change.`,[`Keep ${f} running and assume concentration will improve.`,`Ask colleagues to cover the person's mistakes in ${f} without addressing the concern.`,`Treat the ${f} issue only as a performance problem.`]],
   [`Pause or adjust ${f} where safety is affected, respond respectfully to the wellbeing concern and seek suitable support or supervision.`,[`Tell the person to finish ${f} before discussing how they feel.`,`Remove the person from ${f} permanently without speaking to them.`,`Keep the concern about ${f} informal even if safety is deteriorating.`]]
  ],
  competence:[
   [`For ${f}, make the situation safe and seek the correct instruction, supervision or authorised decision before acting beyond your competence.`,[`Use the solution that worked on a previous ${f} job.`,`Ask another operative to take responsibility for ${f} informally while you continue.`,`Choose the least disruptive ${f} option and report it after completion.`]],
   [`Do not improvise the decision for ${f}; recognise the limit of your role and obtain authorised guidance or supervision before continuing.`,[`Carry on with ${f} using your best judgement even though the decision is outside your authority.`,`Copy a previous ${f} solution without checking whether it is approved.`,`Let the customer decide the technical ${f} issue instead.`]],
   [`Where ${f} goes beyond your competence or authority, stop at the appropriate point and escalate for a competent, authorised decision.`,[`Complete ${f} first and ask for approval retrospectively.`,`Transfer the ${f} decision verbally to a colleague who has the same authority as you.`,`Select the quickest ${f} workaround and document it later.`]]
  ]
 };
 const pair=variants[type]?.[v]||variants.quality[v];
 return{correct:pair[0],wrong:pair[1],why:`The response must address the specific mapped requirement for ${f} rather than rely on a generic workaround.`}
}
function rotate(correct,wrong,index){const all=[correct,...wrong],k=index%4,out=all.slice(k).concat(all.slice(0,k));return{answers:out,correct:out.indexOf(correct)}}
function make(id,category,courseId,question,spec,index,mappings,extra={}){const r=rotate(spec.correct,spec.wrong,index);return{id,category,courseId,question,answers:r.answers,correct:r.correct,explanation:spec.why,difficulty:index%5===4?'stretch':'competent',mappings:mappings||[],active:true,...extra}}
function idSort(a,b){const pa=String(a[0]).match(/^([KSB])(\d+)$/i),pb=String(b[0]).match(/^([KSB])(\d+)$/i);if(pa&&pb){const order={K:0,S:1,B:2},d=order[pa[1].toUpperCase()]-order[pb[1].toUpperCase()];return d||Number(pa[2])-Number(pb[2])}return String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true})}
function buildKsb(courseId,officialItems,category){const entries=Object.entries(officialItems||{}).sort(idSort);if(!entries.length)return[];const source=category==='epa'?[...entries].reverse():entries;return source.slice(0,50).map(([code,text],i)=>{const type=classify(text),profile=PROFILES[type]||PROFILES.quality,topic=topicText(text),focus=stripCode(text),base=profile.stems[i%profile.stems.length].replaceAll('{topic}',topic),question=category==='epa'?`During an EPA assessment, ${base[0].toLowerCase()}${base.slice(1)}`:base;return make(`${courseId}-${category.toUpperCase()}-${String(i+1).padStart(3,'0')}`,category,courseId,question,answersFor(type,focus,i),i,[code],{sourceRef:code})})}
function leaves(items,path=[],out=[]){for(const node of items||[]){const next=[...path,clean(node?.label)];if(Array.isArray(node?.children)&&node.children.length)leaves(node.children,next,out);else if(next[next.length-1])out.push({node,path:next})}return out}
function roundRobinCore(items){const groups=(items||[]).slice(0,4).map(item=>leaves([item]));const out=[];for(let row=0;out.length<35&&groups.some(g=>row<g.length);row++)for(const g of groups){if(row<g.length&&out.length<35)out.push(g[row])}return out}
const ROUTE_BY_UNIT={'6570-04':{'234':'cladding','238':'thin','690':'repair','817':'concrete','828':'specialist','837':'drainage'},'6570-05':{'238':'thin','690':'repair','828':'specialist','837':'drainage'}};
function routeFor(courseId,meta){const map=ROUTE_BY_UNIT[courseId]||{},units=(meta?.units||[]).map(String);for(const unit of units)if(map[unit])return map[unit];return'route'}
function buildNvq(courseId,items,meta){const core=roundRobinCore(items),optional=items?.[4]?leaves([items[4]]).slice(0,15):[],route=routeFor(courseId,meta),selected=[...core.map(x=>({...x,route:'core'})),...optional.map(x=>({...x,route}))];return selected.map((leaf,i)=>{const label=clean(leaf.node?.label||leaf.path.at(-1)),context=clean(leaf.path.slice(0,-1).join(' — ')),sourceText=clean([context,label].filter(Boolean).join(' — ')),type=classify(sourceText),profile=PROFILES[type]||PROFILES.quality,topic=topicText(sourceText),question=profile.stems[i%profile.stems.length].replaceAll('{topic}',topic),id=leaf.route==='core'?`${courseId}-TRADE-${String(i+1).padStart(3,'0')}`:`${courseId}-TRADE-${route.toUpperCase()}-${String(i-34).padStart(3,'0')}`,mappings=[...(leaf.node?.acTargets||leaf.node?.ksbs||leaf.node?.mappedAtomicTargets||[])].map(String);return make(id,'trade',courseId,question,answersFor(type,sourceText,i),i,mappings,{route:leaf.route})})}
function build(category,context={}){const courseId=clean(context.courseId||context.meta?.qualificationId||context.meta?.qualification?.id);if(category==='maths'||category==='english')return BASE.build(category,context);if(category==='trade'){if(/^6570-0[45]$/.test(courseId))return buildNvq(courseId,context.courseItems||[],context.meta||{});return buildKsb(courseId,context.meta?.officialItems||{},'trade')}if(category==='epa'){if(/^6570-0[45]$/.test(courseId))return[];return buildKsb(courseId,context.meta?.officialItems||{},'epa')}return[]}
window.NaxosQuestionBankV2=Object.freeze({version:VERSION,build,expectedCounts:BASE.expectedCounts});
})();
