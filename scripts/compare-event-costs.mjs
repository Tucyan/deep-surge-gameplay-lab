import {writeFile,readFile} from 'node:fs/promises';
import {runBalanceGame,summarizeRuns} from './balance-player.mjs';
import {getDefaultConfig,applyConfig,configFingerprint} from '../src/config/store.js';
import {ORIGINS} from '../src/content/index.js';

const base=getDefaultConfig(),config=structuredClone(base);
const option=(node,id)=>config.content.NODES[node].options.find(o=>o.id===id);
option('camp','rest').cardCosts={cloth:2,plastic:1};
option('drift','provisions').cardCosts={iron:1,rope:1,cloth:1};
option('storm','secure').cardCosts={wood:1,rope:1,cloth:2};
const runs=[];
try{
 applyConfig(config);
 for(const strategy of ['events','build'])for(const originId of Object.keys(ORIGINS)){
  const group=[];
  for(let i=1;i<=24;i++)group.push(runBalanceGame({seed:Math.imul(i,2654435761)>>>0,originId,strategy}));
  runs.push(...group);process.stdout.write(JSON.stringify({strategy,originId,...summarizeRuns(group)})+'\n');
 }
}finally{applyConfig(base);}
const baseline=JSON.parse(await readFile(new URL('../evidence/balance-audit-v2.json',import.meta.url),'utf8'));
if(baseline.configFingerprint!==configFingerprint(base))throw new Error('当前配置与基准报告不同');
const report={date:'2026-10-05',description:'只调整三项事件材料构成，AP、收益、生存和设备生产不变；休整由2张投入变为3张，其余两项投入张数不变。',changes:{'camp:rest':{cloth:2,plastic:1},'drift:provisions':{iron:1,rope:1,cloth:1},'storm:secure':{wood:1,rope:1,cloth:2}},profile:'fresh',sampleCount:24,configFingerprint:configFingerprint(config),baseline:baseline.summaries.filter(s=>s.strategy!=='skip-events'),summaries:['events','build'].map(strategy=>({strategy,...summarizeRuns(runs.filter(r=>r.strategy===strategy))})),runs};
await writeFile(new URL('../evidence/event-cost-comparison-v2.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
process.stdout.write('TOTAL '+JSON.stringify(report.summaries)+'\n');
