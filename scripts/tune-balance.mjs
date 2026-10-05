import {readFile,writeFile} from 'node:fs/promises';
import {getDefaultConfig,applyConfig,configFingerprint} from '../src/config/store.js';
import {ORIGINS} from '../src/content/index.js';
import {runBalanceGame,summarizeRuns} from './balance-player.mjs';

const baseline=JSON.parse(await readFile(new URL('../evidence/default-v2.json',import.meta.url),'utf8'));
baseline.content.CONFIG.contentVersion=getDefaultConfig().content.CONFIG.contentVersion;
baseline.content.CONFIG.nodePoolMultiplier=1;
const count=Number(process.argv[2]||12);
if(!Number.isInteger(count)||count<1||count>100)throw new Error('种子数量1–100');
const seeds=Array.from({length:count},(_,i)=>Math.imul(i+1,2654435761)>>>0);
export function tune(config,variant){
 const c=config.content;
 if(variant==='baseline')return config;
 c.CONFIG.nodePoolMultiplier=2;
 if(variant==='pool-only')return config;
 for(const id of ['water','food']){c.CARDS[id].effects[0].delta=40;c.CARDS[id].description=(id==='water'?'水分':'饱食')+'+40，瞬发。';}
 c.EQUIPMENT.medkit.activationCosts={cloth:1};c.EQUIPMENT.medkit.healing=[8,12,16];
 c.EQUIPMENT.medkit.description='主动治疗；1 AP与布条×1，恢复8/12/16生命。';
 c.CARDS.medkit.description='安装后花1 AP与布条×1恢复生命8，高等级治疗更多。';
 if(variant==='food-med')return config;
 c.EQUIPMENT.filter.intervals=[1,1,1];c.EQUIPMENT.planter.intervals=[1,1,1];
 if(variant==='production')return config;
 const rest=c.NODES.camp.options.find(o=>o.id==='rest');
 rest.cardCosts={cloth:2};rest.name='包扎补给休整';
 rest.description='投入布条×2和1 AP；生命+15，饱食、水分各+40，精神+25，获得休整余裕。';
 for(const e of rest.effects)if(e.type==='ChangeCurrent')e.delta=e.stat==='hp'?15:e.stat==='sanity'?25:40;
 const provisions=c.NODES.drift.options.find(o=>o.id==='provisions');
 provisions.cardCosts={iron:1,rope:1,cloth:1};provisions.description='投入废铁、绳索、布条各1和1 AP，获得淡水、食物各1。';
 const secure=c.NODES.storm.options.find(o=>o.id==='secure');
 secure.cardCosts={iron:1,rope:1,cloth:1};secure.description='投入废铁、绳索、布条各1和1 AP；无额外筏损，获得淡水、食物各1，精神恢复10。';
 if(['events-slow','restoration'].includes(variant)){c.EQUIPMENT.filter.intervals[0]=2;c.EQUIPMENT.planter.intervals[0]=2;}
 if(variant==='restoration'){
  rest.effects.find(e=>e.stat==='sanity').delta=40;
  rest.description='投入布条×2和1 AP；生命+15，饱食、水分、精神各+40，获得休整余裕。';
  secure.effects.find(e=>e.stat==='sanity').delta=20;
  secure.description=secure.description.replace('精神恢复10','精神恢复20');
 }
 return config;
}
const cases=[];
try {
 for(const variant of (process.argv[3]||'pool-only,food-med,events-slow,events').split(',')){
  if(!['baseline','pool-only','food-med','production','events-slow','events','restoration'].includes(variant))throw new Error('未知对照 '+variant);
  const config=tune(structuredClone(baseline),variant);applyConfig(config);const runs=[];
  for(const strategy of ['events','build','skip-events'])for(const originId of Object.keys(ORIGINS))for(const seed of seeds)runs.push(runBalanceGame({seed,originId,strategy}));
  const summaries=['events','build','skip-events'].map(strategy=>({strategy,...summarizeRuns(runs.filter(r=>r.strategy===strategy))}));
  process.stdout.write(JSON.stringify({variant,summaries})+'\n');
  cases.push({variant,configFingerprint:configFingerprint(config),config,summaries,runs});
 }
} finally {applyConfig(getDefaultConfig());}
await writeFile(new URL('../evidence/'+(process.argv[4]||'balance-tuning-v3.json'),import.meta.url),JSON.stringify({date:'2026-10-05',seeds,profile:'fresh',cases},null,2)+'\n');
