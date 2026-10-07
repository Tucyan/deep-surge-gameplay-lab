import {NODES,SPRING_POOL,CONFIG,CARDS,SHOP,BUFFS} from '../content/index.js';
import {clone,random,pick} from './model.js';
import {layerBoss,isLayerEnd} from './layers.js';
import {rollEnvironment,concealCandidate,fogLevel,confusionChance,environmentAmount} from './environment.js';
import {payOption,optionProbability} from './node-costs.js';
import {relicChoices,offerRelic,onEventPayment} from './relic-rules.js';

export function createNodePool(s){
 const bosses=new Set(CONFIG.layers.map(l=>l.bossNodeId));
 const ids=Object.keys(NODES).filter(id=>!NODES[id].boss&&!bosses.has(id)).sort();
 const safe=ids.filter(id=>!['battle','ruin'].includes(NODES[id].kind));
 const pool=Array.from({length:(s.length-1)*CONFIG.nodePoolMultiplier},()=>pick(s,ids));
 if(pool.length&&!pool.some(id=>safe.includes(id))&&safe.length)pool[0]=pick(s,safe);
 return pool;
}
function weightedNode(s,ids){
 const weights=ids.map(id=>s.nodePool.filter(x=>x===id).length/(1+3*(s.nodeVisits[id]||0))*(s.lastNodeId===id?.25:1));
 let roll=random(s)*weights.reduce((sum,w)=>sum+w,0);
 for(let i=0;i<ids.length;i++){roll-=weights[i];if(roll<0)return ids[i];}
 return ids.at(-1);
}
function instantiate(ctx,id){
 const node=clone(NODES[id]);node.instanceId=ctx.id('candidate');
 if(node.variants?.length){const variant=ctx.pick(node.variants);Object.assign(node,clone(variant),{id,variantId:variant.id});}
 delete node.variants;
 if(node.id==='altar'){
  node.altarChoices=relicChoices(ctx,2);
  if(!node.altarChoices.length){node.kind='supply';node.name='空寂祭坛';node.description='普通藏品已集齐，可收取残留物资。';node.options=[{id:'supplies',name:'收取残留物资',description:'获得两份木头。',cost:0,effects:[{type:'GiveCard',id:'wood',amount:2}]},{id:'leave',name:'离开',description:'继续航行。',cost:0,effects:[]}];}
 }
 node.visibility=concealCandidate(ctx,node);return node;
}
export function candidates(s,p){
 const ctx={s,p,random:()=>random(s),pick:list=>pick(s,list),id:prefix=>prefix+'-'+s.nextId++,hasRelic:id=>s.relicIds.includes(id)||p?.rareRelics?.includes(id)};
 if(isLayerEnd(s))return [instantiate(ctx,layerBoss(s))];
 if(!s.nodePool.length)throw new Error('普通节点池已耗尽');
 const pool=[...new Set(s.nodePool)].sort(),safe=pool.filter(id=>!['battle','ruin'].includes(NODES[id].kind));
 const first=weightedNode(s,safe.length?safe:pool),ids=[first];pool.splice(pool.indexOf(first),1);
 while(ids.length<3&&pool.length){const id=weightedNode(s,pool);ids.push(id);pool.splice(pool.indexOf(id),1);}
 const result=ids.map(id=>instantiate(ctx,id));
 if(fogLevel(s)===3&&safe.includes(first)){result[0].visibility='typeOnly';result[0].safeRoute=true;}
 return result;
}
export function beginRound(ctx){
 const {s}=ctx;ctx.require(s.springClaimedVoyage!==s.voyage,'本轮涌泉已领取');
 s.phase='navigation';s.ap=0;s.node=null;s.roundEventUnits=0;s.flags.avoidWave=false;
 s.navigation={fixedHeading:false,plannedNodeId:null,actualNodeId:null};rollEnvironment(ctx);
 const spring=3+environmentAmount(s,'spring');for(let i=0;i<spring;i++)ctx.give(ctx.pick(SPRING_POOL),1,{source:'spring:'+s.voyage});
 s.springClaimedVoyage=s.voyage;s.buffs=s.buffs.filter(b=>!(b.activeFrom<=s.voyage&&BUFFS[b.definitionId]?.mechanic==='spring'));
 ctx.log('先领取涌泉资源 '+spring+' 张，再选择航行节点','补给');s.candidates=candidates(s,ctx.p);
}
export function submitVoyage(ctx,cmd){
 const {s}=ctx;ctx.require(s.phase==='navigation','完成当前行动与弃牌后才能导航');
 const planned=s.candidates.find(n=>n.instanceId===cmd.nodeId||n.id===cmd.nodeId);ctx.require(planned,'节点不在候选中');
 const chance=confusionChance(s),others=s.candidates.filter(n=>n.instanceId!==planned.instanceId);let node=planned;
 if(others.length&&chance>0&&ctx.random()<chance)node=ctx.pick(others);
 s.navigation.plannedNodeId=planned.id;s.navigation.actualNodeId=node.id;
 if(node!==planned)ctx.log('混乱偏航：原计划 '+planned.name+' → 实际到达 '+node.name,'导航');
 else ctx.log('驶向 '+node.name+(chance>0?'（偏航概率 '+Math.round(chance*100)+'%）':''),'导航');
 s.node={...clone(node),resolved:false,instanceId:ctx.id('node'),visibility:'full'};s.candidates=[];s.ap=ctx.stat('baseAp');s.phase='action';
 if(!node.boss){const index=s.nodePool.indexOf(node.id);ctx.require(index>=0,'节点已从本层池中消耗');s.nodePool.splice(index,1);}
 s.nodeVisits[node.id]=(s.nodeVisits[node.id]||0)+1;s.lastNodeId=node.id;
}
export function enchantCard(ctx,cardId,enchant){
 const card=ctx.card(cardId);ctx.require(['combat','survival','action'].includes(CARDS[card.definitionId].kind),'选择战斗、生存或行动牌附魔');ctx.require(['return','instant'].includes(enchant),'选择回牌或瞬发');ctx.require(!card.enchant.includes(enchant),'已有该附魔');card.enchant.push(enchant);ctx.log(CARDS[card.definitionId].name+' 获得'+(enchant==='return'?'回牌':'瞬发'),'附魔');return card;
}
export function chooseOption(ctx,cmd){
 const {s}=ctx;ctx.require(s.phase==='action'&&s.node&&!s.node.resolved,'当前没有待选择节点选项');const option=s.node.options?.find(o=>o.id===cmd.optionId);ctx.require(option,'未知节点选项');
 const probability=optionProbability(s,option);
 if(option.special==='altar'){ctx.require(s.node.altarChoices?.includes(cmd.relicId),'先选择祭坛展示的一件藏品');ctx.require(!ctx.hasRelic(cmd.relicId),'已有该藏品');}
 const payment=payOption(ctx,option,cmd);
 switch(option.special){
  case 'upgrade':{const cell=s.cells.find(c=>c.state==='intact'&&c.equipment?.instanceId===cmd.equipmentId);ctx.require(cell&&cell.equipment.level<CONFIG.upgradeMax,'选择未满级的可用设备');cell.equipment.level++;ctx.log('安顿升级 '+CARDS[cell.equipment.definitionId].name,'节点');break;}
  case 'enchant':enchantCard(ctx,cmd.cardId,cmd.enchant);break;
  case 'exchange':{const card=ctx.card(cmd.cardId);ctx.require(SPRING_POOL.includes(card.definitionId),'选择投入费用后仍持有的一张基础资源牌');const id=card.definitionId;card.quantity--;if(!card.quantity)ctx.remove(card.instanceId);ctx.give(ctx.pick(SPRING_POOL.filter(x=>x!==id)));payment.units++;break;}
  case 'blood':ctx.change('hp',-5,'event');if(!ctx.checkAlive())return;if(ctx.random()<.5)offerRelic(ctx,relicChoices(ctx),'水母献血');else ctx.log('水母没有留下藏品','节点');break;
  case 'relicChance':if(ctx.random()<(probability??.5))offerRelic(ctx,relicChoices(ctx),'节点概率奖励');else ctx.give('coin');break;
  case 'altar':ctx.relic(cmd.relicId);break;
  case 'guide':s.guidance={voyage:s.voyage+1,reveal:true,confusionReduction:.15};ctx.log('灯塔向导：下一轮导航揭示全部候选，偏航概率减少15个百分点','节点');break;
 }
 ctx.effects(option.effects||[],'node:'+s.node.instanceId);if(s.phase==='finished')return;
 if(option.outcomes?.length){let roll=ctx.random()*option.outcomes.reduce((n,o)=>n+o.weight,0);const result=option.outcomes.find(o=>{roll-=o.weight;return roll<0;})||option.outcomes.at(-1);ctx.effects(result.effects,'node:'+s.node.instanceId);}
 if(s.phase==='finished')return;
 onEventPayment(ctx,payment.units,payment.sanityPrice);s.node.resolved=true;s.completedNodes++;ctx.log(s.node.name+'：'+option.name,'节点');
}
export function shopBuy(ctx,cmd){
 const {s,p}=ctx;ctx.require(s.phase==='action'&&s.node?.kind==='shop'&&!s.node.resolved,'商店节点未开放');const item=SHOP.find(i=>i.id===cmd.itemId);ctx.require(item,'不存在的商品');let price=item.price;if(p.purchases.coupon&&price>1)price--;
 if(cmd.payment==='corpse')ctx.consume('corpse',Math.ceil(price/2));else{ctx.require(!cmd.payment||cmd.payment==='coin','请选择贝币或尸体');ctx.consume('coin',price);}
 if(item.card)ctx.give(item.card);if(item.relic){ctx.require(!ctx.hasRelic(item.relic),'本局已有这件藏品');ctx.relic(item.relic);}ctx.log('购买 '+item.name,'交易');
}
