import {GameSession,createProfile} from '../src/core/session.js';
import {CARDS,RECIPES,CONFIG,MONSTERS,EQUIPMENT} from '../src/content/index.js';

const counts=hand=>Object.fromEntries([...new Set(hand.map(c=>c.definitionId))].map(id=>[id,hand.filter(c=>c.definitionId===id).reduce((n,c)=>n+c.quantity,0)]));
const average=xs=>xs.length?Number((xs.reduce((n,x)=>n+x,0)/xs.length).toFixed(2)):0;
const ordinary=n=>!['battle','ruin'].includes(n.kind);
const equipment=v=>v.cells.filter(c=>c.state==='intact'&&c.equipment);
const has=(v,id)=>equipment(v).some(c=>c.equipment.definitionId===id)||v.hand.some(c=>c.definitionId===id);
const affordable=(v,o)=>v.ap>=o.cost&&Object.entries(o.cardCosts||{}).every(([id,n])=>(counts(v.hand)[id]||0)>=n);

export function runBalanceGame({seed,originId='strong',strategy='events',profile=createProfile(),trace=false}){
 const g=new GameSession(profile);
 const row={seed,originId,strategy,failedCommands:0,commands:0,treatmentCardsConsumed:0,eventCardsConsumed:0,craftCardsConsumed:0,fuelCardsConsumed:0,playedCardsConsumed:0,discardedCards:0,permanentCardsGained:0,eventSelections:{},eventArrivals:{},eventPaymentsByNode:{},payableByNode:{},candidateCounts:[],forcedBattleNavigations:0,immediateRepeats:0,shopCardsConsumed:0,discardedByCard:{},payableEventArrivals:0,eventArrivalsTotal:0,leftDespiteAffordable:0,survivalDamage:0,battleDamage:0,battleRounds:0,ordinarySelected:0,nodeHistory:[],equipmentBuilt:{},settlements:[],...(trace?{trace:[]}: {})};
 const payableAtArrival=new Map();
 function act(command){
  const before=g.getView(),r=g.execute(command);
  if(!r.ok){row.failedCommands++;throw new Error(`${seed}/${originId}/${strategy}: ${command.type}: ${r.errors.join('；')}`);}
  const after=r.view;row.commands++;
  if(trace)row.trace.push({voyage:before.voyage,command:structuredClone(command),hp:after.current.hp,hunger:after.current.hunger,hydration:after.current.hydration,sanity:after.current.sanity,capacity:after.capacity,ap:after.ap,phase:after.phase});
  const oldInstances=new Map(before.hand.map(c=>[c.instanceId,c.quantity]));
  for(const card of after.hand){const gained=Math.max(0,card.quantity-(oldInstances.get(card.instanceId)||0));if(!card.battleOnly&&card.definitionId!=='coin')row.permanentCardsGained+=gained;}
  const old=counts(before.hand),now=counts(after.hand);
  if(command.type==='SubmitVoyage'){
   row.candidateCounts.push(before.candidates.length);
   if(before.candidates.every(n=>!ordinary(n)))row.forcedBattleNavigations++;
   if(row.nodeHistory.at(-1)===after.node.id)row.immediateRepeats++;
   if(after.node.id!=='boss')row.ordinarySelected++;
   row.nodeHistory.push(after.node.id);
   if(ordinary(after.node)){
    if(after.node.kind!=='shop')row.eventArrivalsTotal++;row.eventArrivals[after.node.id]=(row.eventArrivals[after.node.id]||0)+1;
    const payable=after.node.options.some(o=>o.id!=='leave'&&affordable(after,o));
    payableAtArrival.set(after.voyage,payable);if(payable){row.payableEventArrivals++;row.payableByNode[after.node.id]=(row.payableByNode[after.node.id]||0)+1;}
   }
  }
  if(command.type==='ChooseOption'){
   const o=before.node.options.find(o=>o.id===command.optionId),key=before.node.id+':'+o.id;
   row.eventSelections[key]=(row.eventSelections[key]||0)+1;
   const paid=Object.values(o.cardCosts||{}).reduce((n,x)=>n+x,0)+(o.special==='exchange'?1:0);row.eventCardsConsumed+=paid;row.eventPaymentsByNode[before.node.id]=(row.eventPaymentsByNode[before.node.id]||0)+paid;
   if(o.id==='leave'&&payableAtArrival.get(before.voyage))row.leftDespiteAffordable++;
  }
  if(command.type==='Craft')row.craftCardsConsumed+=Object.values(RECIPES[command.recipeId].ingredients).reduce((n,x)=>n+x,0);
  if(command.type==='FuelLamp')row.fuelCardsConsumed++;
  if(command.type==='ActivateEquipment')row.treatmentCardsConsumed+=Object.values(EQUIPMENT.medkit.activationCosts||{}).reduce((n,x)=>n+x,0);
  if(command.type==='ShopBuy')row.shopCardsConsumed+=Math.max(0,(old[command.payment==='corpse'?'corpse':'coin']||0)-(now[command.payment==='corpse'?'corpse':'coin']||0));
  if(command.type==='DiscardCards')for(const card of before.hand.filter(c=>command.cardIds.includes(c.instanceId))){const removed=Math.max(0,card.quantity-(after.hand.find(c=>c.instanceId===card.instanceId)?.quantity||0));row.discardedCards+=removed;row.discardedByCard[card.definitionId]=(row.discardedByCard[card.definitionId]||0)+removed;}
  if(command.type==='PlayCard'){
   const c=before.hand.find(c=>c.instanceId===command.cardId);
   if(!c.battleOnly&&CARDS[c.definitionId].kind!=='equipment')row.playedCardsConsumed+=Math.max(0,(old[c.definitionId]||0)-(now[c.definitionId]||0));
   if(CARDS[c.definitionId].kind==='equipment')row.equipmentBuilt[c.definitionId]=(row.equipmentBuilt[c.definitionId]||0)+1;
  }
  if(command.type==='EndBattleTurn'){row.battleRounds++;row.battleDamage+=Math.max(0,before.current.hp-after.current.hp);}
  if(command.type==='EndVoyage'){
   row.survivalDamage+=Math.max(0,before.current.hp-after.current.hp);
   row.settlements.push({voyage:before.voyage,current:structuredClone(after.current),capacity:after.capacity,excess:after.excess,equipment:equipment(after).map(c=>c.equipment.definitionId),poolRemaining:after.nodePool.length});
  }
  return after;
 }
 act({type:'NewGame',seed,originId});row.initialPoolSize=g.getView().nodePool.length;
 function eventCommand(v){
  const options=v.node.options.filter(o=>o.id!=='leave'&&affordable(v,o));
  let best={score:0,command:{type:'ChooseOption',optionId:'leave'}};
  if(strategy==='skip-events')return best;
  for(const o of options){
   let score=0,command={type:'ChooseOption',optionId:o.id};
   for(const e of o.effects||[]){
    if(e.type==='ChangeCurrent'&&e.delta>0)score+=Math.min(e.delta,v.stats[e.stat+'Max']-v.current[e.stat])*({hp:3,hunger:1,hydration:1.2,sanity:1.8}[e.stat]||1);
    if(e.type==='GiveCard'){const n=e.amount||1;score+=n*(e.id==='water'?Math.max(4,Math.min(25,v.stats.hydrationMax-v.current.hydration)):e.id==='food'?Math.max(4,Math.min(25,v.stats.hungerMax-v.current.hunger)):5);}
    if(e.type==='DamageCell')score-=30;
   }
   score-=Object.values(o.cardCosts||{}).reduce((n,x)=>n+x,0)*4;
   if(o.special==='upgrade'){
    const target=equipment(v).filter(c=>c.equipment.level<CONFIG.upgradeMax).sort((a,b)=>['filter','planter','medkit','lamp','crossbow'].indexOf(a.equipment.definitionId)-['filter','planter','medkit','lamp','crossbow'].indexOf(b.equipment.definitionId))[0];
    if(target){command.equipmentId=target.equipment.instanceId;score+=['filter','planter'].includes(target.equipment.definitionId)?40:18;}
   }
   if(o.special==='enchant'){
    const target=v.hand.find(c=>['water','food','calm'].includes(c.definitionId)&&!c.enchant.includes('return'));
    if(target){command.cardId=target.instanceId;command.enchant='return';score+=35;}
   }
   // Conversion and blood offer no immediate survival value to this policy.
   if(score>best.score&&g.preview(command).ok)best={score,command};
  }
  return best;
 }
 function build(v){
  const active=equipment(v),empty=v.cells.find(c=>c.state==='intact'&&!c.equipment),qty=counts(v.hand);
  const damaged=v.cells.find(c=>c.state==='damaged'&&c.equipment);
  if(damaged&&v.ap>=1&&qty.wood)return {type:'RepairCell',cellId:damaged.id};
  const med=active.find(c=>c.equipment.definitionId==='medkit');
  if(med&&v.ap>=1&&v.current.hp<=v.stats.hpMax-EQUIPMENT.medkit.healing[med.equipment.level-1]&&g.preview({type:'ActivateEquipment',equipmentId:med.equipment.instanceId}).ok)return {type:'ActivateEquipment',equipmentId:med.equipment.instanceId};
  const lamp=active.find(c=>c.equipment.definitionId==='lamp');
  if(lamp&&lamp.equipment.fuel<1){const fuel=v.hand.find(c=>c.definitionId==='corpse')||v.hand.find(c=>c.definitionId==='wood');if(fuel)return {type:'FuelLamp',equipmentId:lamp.equipment.instanceId,cardId:fuel.instanceId};}
  const held=v.hand.find(c=>c.kind==='equipment');
  if(held&&empty&&v.ap>=held.cost)return {type:'PlayCard',cardId:held.instanceId,targetId:empty.id};
  const priorities=['lamp','crossbow','filter','planter','medkit'];
  if(v.current.sanity>45&&v.voyage<3)priorities.splice(0,3,'filter','planter','lamp','crossbow');
  if(empty&&v.ap>=2){for(const id of priorities)if(!has(v,id)&&v.recipeAvailability[id]?.canCraft)return {type:'Craft',recipeId:id};}
  if(!empty&&v.ap>=1&&qty.wood>=2&&v.expansionOptions.length&&!has(v,'medkit'))return {type:'ExpandRaft',...v.expansionOptions[0]};
  return null;
 }
 for(let guard=0;guard<800;guard++){
  const v=g.getView();if(v.phase==='finished')break;
  if(v.phase==='navigation'){
   const ranked=v.candidates.map(n=>{
    const def=MONSTERS[n.monster],armed=has(v,'crossbow');
    let score=0;
    if(n.id==='camp')score=40+Math.max(0,60-v.current.hp)+Math.max(0,40-v.current.sanity);
    if(n.id==='drift')score=35;
    if(n.id==='storm')score=20;
    if(n.id==='trader')score=(counts(v.hand).coin||0)>=3?50:10;
    if(n.id==='jelly')score=5;
    if(!ordinary(n))score=armed?25:(n.kind==='ruin'?0: -def.hp);
    return {node:n,score};
   }).sort((a,b)=>b.score-a.score||a.node.id.localeCompare(b.node.id));
   act({type:'SubmitVoyage',nodeId:ranked[0].node.id});continue;
  }
  if(['action','battle'].includes(v.phase)){
   const food=v.hand.find(c=>['water','food','calm'].includes(c.definitionId)&&CARDS[c.definitionId].effects.some(e=>e.type==='ChangeCurrent'&&e.delta>0&&v.stats[e.stat+'Max']-v.current[e.stat]>=e.delta));
   if(food&&g.preview({type:'PlayCard',cardId:food.instanceId}).ok){act({type:'PlayCard',cardId:food.instanceId});continue;}
  }
  if(v.phase==='action'){
   if(!v.node.resolved&&ordinary(v.node)){
    const e=eventCommand(v);
    if(strategy==='events'&&e.score>0){act(e.command);continue;}
   }
   const b=build(v);if(b){act(b);continue;}
   if(!v.node.resolved){
    if(!ordinary(v.node)){act({type:'EnterNode'});continue;}
    if(v.node.kind==='shop'){
     const qty=counts(v.hand),wanted=['lamp','crossbow','filter','planter','medkit'];
     const item=v.shop.find(i=>wanted.includes(i.card)&&!has(v,i.card)&&(qty.coin||0)>=i.price);
     if(item){act({type:'ShopBuy',itemId:item.id,payment:'coin'});continue;}
    }
    act(eventCommand(v).command);continue;
   }
   act({type:'EndVoyage'});continue;
  }
  if(v.phase==='battle'){
   const target=v.battle.enemies.find(e=>e.hp>0);
   const attacks=v.hand.filter(c=>c.kind==='combat'&&c.cost<=v.battleAp).sort((a,b)=>a.cost-b.cost||b.damage-a.damage);
   const attack=attacks[0];
   if(attack){act({type:'PlayCard',cardId:attack.instanceId,targetId:target.instanceId});continue;}
   const pollution=v.hand.find(c=>c.definitionId==='pollution'&&c.cost<=v.battleAp);
   if(pollution){act({type:'PlayCard',cardId:pollution.instanceId});continue;}
   if(v.battle.round>=2&&v.current.hp<=target.damage+(v.hand.some(c=>c.definitionId==='pollution')?2:0)+2&&v.current.hp>CONFIG.retreatDamage){act({type:'Retreat'});continue;}
   act({type:'EndBattleTurn'});continue;
  }
  if(v.phase==='discard'){
   if(v.excess){
    const qty=counts(v.hand);
    const priority=c=>c.kind==='survival'?100:c.kind==='equipment'?80:c.definitionId==='coin'?70:c.definitionId==='corpse'?45:({wood:25,plastic:22,iron:18,rope:14,cloth:14}[c.definitionId]||10)-(qty[c.definitionId]||0)*3;
    const cards=v.hand.filter(c=>c.kind!=='negative'&&!c.traits?.includes('return')&&!c.enchant.includes('return')).sort((a,b)=>priority(a)-priority(b));
    if(!cards.length)throw new Error('没有可丢弃物资');
    act({type:'DiscardCards',cardIds:[cards[0].instanceId]});continue;
   }
   act({type:'FinishDiscard'});continue;
  }
  throw new Error('未处理阶段 '+v.phase);
 }
 const final=g.getView();if(final.phase!=='finished')throw new Error('策略超过800次命令');
 return {...row,phase:final.phase,result:final.result.id,voyage:final.voyage,length:final.length,current:final.current,remainingPool:final.nodePool.length,finalEquipment:equipment(final).map(c=>({id:c.equipment.definitionId,level:c.equipment.level})),finalHand:counts(final.hand)};
}

export function summarizeRuns(runs){
 const endings={},sum=k=>runs.reduce((n,r)=>n+r[k],0),wins=runs.filter(r=>['survived','true'].includes(r.result));
 for(const r of runs)endings[r.result]=(endings[r.result]||0)+1;
 const events=sum('eventArrivalsTotal'),payable=sum('payableEventArrivals');
 return {runs:runs.length,bossWins:wins.length,bossWinPercent:Number((100*wins.length/runs.length).toFixed(1)),endings,meanVoyages:average(runs.map(r=>r.voyage)),meanEventCardsConsumed:average(runs.map(r=>r.eventCardsConsumed)),meanCraftCardsConsumed:average(runs.map(r=>r.craftCardsConsumed)),meanDiscardedCards:average(runs.map(r=>r.discardedCards)),meanSurvivalDamage:average(runs.map(r=>r.survivalDamage)),meanBattleDamage:average(runs.map(r=>r.battleDamage)),eventArrivals:events,payableEventArrivals:payable,payableArrivalPercent:Number((100*payable/events).toFixed(1)),leftDespiteAffordable:sum('leftDespiteAffordable'),lengths:[...new Set(runs.map(r=>r.length))].sort((a,b)=>a-b),failedCommands:sum('failedCommands')};
}
