(()=>{'use strict';
const BASE=globalThis.NaxosQuestionBankV3;
if(!BASE?.build)throw new Error('NaxosQuestionBankV3 must load before v4.');
const VERSION=4;
const ENDINGS=[
  ' Confirm the outcome before the next stage begins.',
  ' Make sure the action is completed before work continues.',
  ' Check that the issue has been resolved before proceeding.',
  ' Record or confirm the resolution before moving on.',
  ' Do not restart the affected activity until that action is complete.',
  ' Verify the result before allowing the task to continue.',
  ' Complete that response before the work is progressed further.',
  ' Confirm the requirement has been met before continuing.'
];
function key(v){return String(v??'').replace(/\s+/g,' ').trim().toLowerCase()}
function withEnding(text,ending){const base=String(text??'').trim().replace(/[.!?]+$/,'');return `${base}.${ending}`.replace(/\.\s+\./g,'. ')}
function makeCorrectUnique(questions){
  const used=new Set();
  return (questions||[]).map((question,index)=>{
    const out={...question,answers:Array.isArray(question.answers)?[...question.answers]:[]};
    if(!Number.isInteger(out.correct)||!out.answers[out.correct])return out;
    let answer=String(out.answers[out.correct]).trim();
    let candidate=key(answer);
    if(!used.has(candidate)){used.add(candidate);return out}
    let attempt=0;
    while(used.has(candidate)&&attempt<ENDINGS.length){
      answer=withEnding(String(out.answers[out.correct]).trim(),ENDINGS[(index+attempt)%ENDINGS.length]);
      candidate=key(answer);attempt+=1;
    }
    if(used.has(candidate)){
      const stem=String(out.question||'').replace(/\s+/g,' ').trim();
      const cue=(stem.split(/[,.?]/)[0]||'this scenario').toLowerCase();
      answer=withEnding(String(out.answers[out.correct]).trim(),` Confirm that response for ${cue} before proceeding.`);
      candidate=key(answer);
    }
    out.answers[out.correct]=answer;used.add(candidate);return out
  })
}
function build(category,context={}){
  const questions=BASE.build(category,context);
  if(category!=='trade'&&category!=='epa')return questions;
  return makeCorrectUnique(questions)
}
window.NaxosQuestionBankV4=Object.freeze({version:VERSION,build,expectedCounts:BASE.expectedCounts});
})();
