import {writeFile,readFile} from 'node:fs/promises';
import {runBalanceGame,summarizeRuns} from './balance-player.mjs';
import {getDefaultConfig,applyConfig,configFingerprint} from '../src/config/store.js';
import {ORIGINS} from '../src/content/index.js';

const base=getDefaultConfig(),audit=JSON.parse(await readFile(new URL('../evidence/balance-audit-v2.json',import.meta.url),'utf8'));
if(audit.configFingerprint!==configFingerprint(base))throw new Error('基准报告与当前配置不一致');
const strategies=['events','build'],seeds=Array.from({length:12},(_,i)=>Math.imul(i+1,2654435761)>>>0);
const variants=[
 {id:'metabolism',description:'饱食/水分消耗20，精神消耗10',mutate:c=>{for(const e of c.VOYAGE_EFFECTS)e.delta=e.stat==='sanity'?-10:-20;}},
 {id:'production',description:'Ⅰ级滤水器与土盆每轮生产，其他参数不变',mutate:c=>{c.EQUIPMENT.filter.intervals[0]=1;c.EQUIPMENT.planter.intervals[0]=1;}},
 {id:'combined',description:'饱食/水分消耗25、精神10；Ⅰ级食水设备每轮生产',mutate:c=>{for(const e of c.VOYAGE_EFFECTS)e.delta=e.stat==='sanity'?-10:-25;c.EQUIPMENT.filter.intervals[0]=1;c.EQUIPMENT.planter.intervals[0]=1;}}
];
const matched=audit.runs.filter(r=>seeds.includes(r.seed)&&strategies.includes(r.strategy));
const cases=[{id:'baseline',description:'发布配置v2',summaries:strategies.map(strategy=>({strategy,...summarizeRuns(matched.filter(r=>r.strategy===strategy))})),runs:matched}];
try{
 for(const variant of variants){
  const config=structuredClone(base);variant.mutate(config.content);applyConfig(config);const runs=[];
  for(const strategy of strategies){
   for(const originId of Object.keys(ORIGINS))for(const seed of seeds)runs.push(runBalanceGame({seed,originId,strategy}));
   process.stdout.write(JSON.stringify({variant:variant.id,strategy,...summarizeRuns(runs.filter(r=>r.strategy===strategy))})+'\n');
  }
  cases.push({id:variant.id,description:variant.description,configFingerprint:configFingerprint(config),summaries:strategies.map(strategy=>({strategy,...summarizeRuns(runs.filter(r=>r.strategy===strategy))})),runs});
 }
}finally{applyConfig(base);}
await writeFile(new URL('../evidence/balance-comparison-v2.json',import.meta.url),JSON.stringify({date:'2026-10-05',profile:'fresh',seeds,cases},null,2)+'\n');
