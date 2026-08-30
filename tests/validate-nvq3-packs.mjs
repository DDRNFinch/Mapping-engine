import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const ROUTES=['thin','repair','specialist','drainage'];
const uniq=xs=>[...new Set((xs||[]).map(String).filter(Boolean))];
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const flat=categories=>(categories||[]).flatMap(c=>(c.subcategories||[]).flatMap(s=>(s.tasks||[]).map(t=>({c,s,t}))));

function audit(route){
  const packPath=`packs/6570-05-${route}-v1.json`;
  const pack=read(packPath);
  if(String(pack?.qualification?.id)!=='6570-05')throw Error(`${route}: wrong qualification`);
  if(String(pack?.route?.id)!==route)throw Error(`${route}: route id mismatch`);
  const active=new Set((pack.route.activeUnits||[]).map(String));
  const keep=id=>active.has(String(id).split('.')[0]);
  const categories=(pack.categoryFiles||[]).map(p=>read(path.join('packs',p).replace(/^packs\/packs\//,'packs/')));
  const tasks=flat(categories);
  if(categories.length!==5)throw Error(`${route}: ${categories.length}/5 categories`);
  const subCount=categories.reduce((n,c)=>n+(c.subcategories||[]).length,0);
  if(subCount!==25)throw Error(`${route}: ${subCount}/25 subcategories`);
  if(tasks.length!==125)throw Error(`${route}: ${tasks.length}/125 learner tasks`);

  if(pack.routeMappings){
    const mappings=read(path.join('packs',pack.routeMappings).replace(/^packs\/packs\//,'packs/'));
    for(const [taskId,ids] of Object.entries(mappings.taskMappings||{})){
      const found=tasks.find(x=>String(x.t.id)===String(taskId));
      if(!found)throw Error(`${route}: route mapping points to missing task ${taskId}`);
      found.t.mappedAtomicTargets=uniq([...(found.t.mappedAtomicTargets||[]),...ids]);
    }
  }

  const unmapped=[];
  const mapped=new Set();
  for(const {t} of tasks){
    const ids=uniq([...(t.directLo7Targets||[]),...(t.mappedAtomicTargets||[])]).filter(keep);
    if(!ids.length)unmapped.push(`${t.id} ${t.title}`);
    ids.forEach(id=>mapped.add(id));
  }
  if(unmapped.length)throw Error(`${route}: learner tasks with no active AC mapping:\n- ${unmapped.join('\n- ')}`);
  const expected=Number(pack.route.atomicTargetCount||0);
  if(mapped.size!==expected)throw Error(`${route}: ${mapped.size}/${expected} active atomic criteria`);
  console.log(`${route}: PASS · ${tasks.length} tasks · ${mapped.size}/${expected} criteria · 0 unmapped learner tasks`);
}

for(const route of ROUTES)audit(route);
