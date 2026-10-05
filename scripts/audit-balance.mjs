import {writeFile} from 'node:fs/promises';
import {runBalanceGame,summarizeRuns} from './balance-player.mjs';
import {ORIGINS} from '../src/content/index.js';
import {getActiveConfig,configFingerprint} from '../src/config/store.js';

const sampleCount=Number(process.argv[2]||24);
if(!Number.isSafeInteger(sampleCount)||sampleCount<1||sampleCount>100)throw new Error('每组种子数量须为1–100');
const runs=[],strategies=['events','build','skip-events'];
for(const strategy of strategies)for(const originId of Object.keys(ORIGINS)){
 const group=[];
 for(let i=1;i<=sampleCount;i++){
  // Spread the first xorshift output across its range; seeds 1–100 alone mostly produce 10 voyages.
  const seed=Math.imul(i,2654435761)>>>0;
  group.push(runBalanceGame({seed,originId,strategy,trace:i===1&&originId==='strong'}));
 }
 runs.push(...group);process.stdout.write(JSON.stringify({strategy,originId,...summarizeRuns(group)})+'\n');
}
const config=getActiveConfig(),report={date:'2026-10-05',contentVersion:config.content.CONFIG.contentVersion,configFingerprint:configFingerprint(config),sampleCount,seeds:'imul(index,2654435761) >>> 0',profile:'fresh',summaries:strategies.map(strategy=>({strategy,...summarizeRuns(runs.filter(r=>r.strategy===strategy))})),byOrigin:strategies.flatMap(strategy=>Object.keys(ORIGINS).map(originId=>({strategy,originId,...summarizeRuns(runs.filter(r=>r.strategy===strategy&&r.originId===originId))}))),runs};
await writeFile(new URL('../evidence/balance-audit-'+config.content.CONFIG.contentVersion.split('-').at(-1)+'.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
process.stdout.write('TOTAL '+JSON.stringify(report.summaries)+'\n');
