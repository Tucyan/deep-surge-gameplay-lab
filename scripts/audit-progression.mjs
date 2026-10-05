import {writeFile} from 'node:fs/promises';
import {createProfile} from '../src/core/session.js';
import {runBalanceGame,summarizeRuns} from './balance-player.mjs';
import {ORIGINS} from '../src/content/index.js';
import {getActiveConfig,configFingerprint} from '../src/config/store.js';

const profiles=[];
const pearl=createProfile();pearl.rareRelics=['pearl'];pearl.discovered.endings=['dead'];pearl.runs=1;
profiles.push({id:'pearl-only',description:'达成一次结局后持有珍珠，无付费成长',profile:pearl});
const grown=structuredClone(pearl);grown.tech=['knowledge','craft'];grown.purchases={hands:1,body:1,smallBox:1};grown.completedNodes=32;grown.runs=4;
profiles.push({id:'growth-32',description:'珍珠＋32积分成长：知识3、熟练双手6、手工者手记12、身体6、小箱子5',profile:grown});
const groups=[];
for(const p of profiles){
 const runs=[];
 for(const originId of Object.keys(ORIGINS))for(let i=1;i<=24;i++)runs.push(runBalanceGame({seed:Math.imul(i,2654435761)>>>0,originId,strategy:'events',profile:p.profile}));
 const summary=summarizeRuns(runs);groups.push({...p,summary,runs});process.stdout.write(JSON.stringify({profile:p.id,...summary})+'\n');
}
await writeFile(new URL('../evidence/progression-balance-'+getActiveConfig().content.CONFIG.contentVersion.split('-').at(-1)+'.json',import.meta.url),JSON.stringify({date:'2026-10-05',configFingerprint:configFingerprint(getActiveConfig()),groups},null,2)+'\n');
