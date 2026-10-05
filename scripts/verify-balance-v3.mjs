import {readFile,writeFile} from 'node:fs/promises';
import {getDefaultConfig,applyConfig,configFingerprint} from '../src/config/store.js';
import {ORIGINS} from '../src/content/index.js';
import {runBalanceGame,summarizeRuns} from './balance-player.mjs';

const current=getDefaultConfig(),comparison=JSON.parse(await readFile(new URL('../evidence/balance-final-comparison-v3.json',import.meta.url),'utf8'));
const chosen=comparison.cases.find(c=>c.variant==='restoration');
if(configFingerprint(chosen.config)!==configFingerprint(current))throw new Error('发布内容与测试候选不一致');
const old=JSON.parse(await readFile(new URL('../evidence/default-v2.json',import.meta.url),'utf8'));
old.content.CONFIG.contentVersion=current.content.CONFIG.contentVersion;old.content.CONFIG.nodePoolMultiplier=1;
const seeds=Array.from({length:24},(_,i)=>Math.imul(i+25,2654435761)>>>0),cases=[];
try {
 for(const [variant,config]of [['v2-compat',old],['v3-published',current]]){
  applyConfig(config);const runs=[];
  for(const strategy of ['events','build','skip-events']){
   for(const originId of Object.keys(ORIGINS))for(const seed of seeds)runs.push(runBalanceGame({seed,originId,strategy}));
   process.stdout.write(JSON.stringify({variant,strategy,...summarizeRuns(runs.filter(r=>r.strategy===strategy))})+'\n');
  }
  cases.push({variant,config,configFingerprint:configFingerprint(config),summaries:['events','build','skip-events'].map(strategy=>({strategy,...summarizeRuns(runs.filter(r=>r.strategy===strategy))})),runs});
 }
} finally {applyConfig(current);}
await writeFile(new URL('../evidence/balance-holdout-v3.json',import.meta.url),JSON.stringify({date:'2026-10-05',seeds,profile:'fresh',method:'预先选定参数后，未参与选参的索引25–48对照；旧配置迁移到当前契约，池倍数1、旧数值不变。',cases},null,2)+'\n');
