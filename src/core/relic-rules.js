import {RELICS,SPRING_POOL} from '../content/index.js';

export function hasMechanic(s,p,mechanic){return [...s.relicIds,...p.rareRelics].some(id=>RELICS[id]?.mechanic===mechanic);}
export function initializeRelicUsage(s,id){
 const mechanic=RELICS[id]?.mechanic;
 if(mechanic==='scout'&&!s.relicUsage.scout)s.relicUsage.scout={charges:1,settlements:0};
 if(['heading','protect'].includes(mechanic)&&!s.relicUsage[mechanic])s.relicUsage[mechanic]={remaining:2,layerIndex:s.layerIndex};
}
export function availableRelics(ctx){return Object.keys(RELICS).filter(id=>RELICS[id].rarity==='normal'&&!ctx.hasRelic(id)).sort();}
export function relicChoices(ctx,amount=1){const pool=availableRelics(ctx),out=[];while(pool.length&&out.length<amount){const index=Math.floor(ctx.random()*pool.length);out.push(pool.splice(index,1)[0]);}return out;}
export function offerRelic(ctx,choices,source){
 if(!choices.length){ctx.give('coin');ctx.log('普通藏品已集齐，改获贝币 ×1','藏品');return;}
 ctx.s.pendingRelic={choices,source};
 ctx.log('获得藏品选择机会，请确认领取或放弃','藏品');
}
export function claimRelic(ctx,cmd){
 const reward=ctx.s.pendingRelic;ctx.require(reward&&ctx.s.phase==='action','没有待领取藏品');ctx.require(typeof cmd.accept==='boolean','请选择领取或放弃');
 if(cmd.accept){const id=cmd.relicId||(reward.choices.length===1?reward.choices[0]:null);ctx.require(reward.choices.includes(id),'选择本次固定藏品');ctx.require(!ctx.hasRelic(id),'已有该藏品');ctx.relic(id);}else ctx.log('放弃本次藏品，不能重新抽取','藏品');
 ctx.s.pendingRelic=null;
}
export function onEventPayment(ctx,units,sanityPrice){
 const {s,p}=ctx;s.roundEventUnits+=units;
 if(hasMechanic(s,p,'salvage')&&s.roundEventUnits>=3&&s.relicUsage.salvageVoyage!==s.voyage){s.relicUsage.salvageVoyage=s.voyage;ctx.give(ctx.pick(SPRING_POOL));ctx.log('拾荒者指环回收一份基础资源','藏品');}
 if(sanityPrice>0&&hasMechanic(s,p,'contract')&&s.relicUsage.contractVoyage!==s.voyage){s.relicUsage.contractVoyage=s.voyage;ctx.give('coin');ctx.log('深潮契印：主动事件交易获得贝币','藏品');}
}
export function tickRelics(s){const scout=s.relicUsage.scout;if(scout&&scout.charges===0){scout.settlements++;if(scout.settlements>=2){scout.charges=1;scout.settlements=0;}}}
export function validateRelicUsage(s){
 const u=s.relicUsage;if(!u||typeof u!=='object'||Array.isArray(u)||!Number.isSafeInteger(s.roundEventUnits)||s.roundEventUnits<0)throw new Error('藏品触发存档损坏');
 if(u.scout&&(![0,1].includes(u.scout.charges)||!Number.isSafeInteger(u.scout.settlements)||u.scout.settlements<0||u.scout.settlements>1))throw new Error('侦察充能存档损坏');
 for(const key of ['heading','protect'])if(u[key]&&(!Number.isSafeInteger(u[key].remaining)||u[key].remaining<0||u[key].remaining>2||u[key].layerIndex!==s.layerIndex))throw new Error('藏品层额度存档损坏');
 for(const key of ['repairVoyage','salvageVoyage','contractVoyage','headwindVoyage'])if(u[key]!==undefined&&(!Number.isSafeInteger(u[key])||u[key]<1||u[key]>s.voyage))throw new Error('藏品航次记录损坏');
 if(s.pendingRelic&&(!Array.isArray(s.pendingRelic.choices)||!s.pendingRelic.choices.length||new Set(s.pendingRelic.choices).size!==s.pendingRelic.choices.length||s.pendingRelic.choices.some(id=>RELICS[id]?.rarity!=='normal'||s.relicIds.includes(id))||s.phase!=='action'))throw new Error('待领取藏品存档损坏');
}
