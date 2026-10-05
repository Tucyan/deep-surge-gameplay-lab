import {NODES,SPRING_POOL,CONFIG,CARDS,SHOP,RELICS} from '../content/index.js';
import {clone,random,pick} from './model.js';
export function createNodePool(s){
 const ids=Object.keys(NODES).filter(id=>id!=='boss').sort();
 const safe=ids.filter(id=>!['battle','ruin'].includes(NODES[id].kind));
 const pool=Array.from({length:(s.length-1)*CONFIG.nodePoolMultiplier},()=>pick(s,ids));
 if(!pool.some(id=>safe.includes(id)))pool[0]=pick(s,safe);
 return pool;
}
function weightedNode(s,ids){
 const weights=ids.map(id=>s.nodePool.filter(x=>x===id).length/(1+3*(s.nodeVisits?.[id]||0))*(s.lastNodeId===id?0.25:1));
 let roll=random(s)*weights.reduce((sum,w)=>sum+w,0);
 for(let i=0;i<ids.length;i++){roll-=weights[i];if(roll<0)return ids[i];}
 return ids.at(-1);
}
export function candidates(s){
 if(s.voyage===s.length)return [clone(NODES.boss)];
 if(!s.nodePool.length)throw new Error('普通节点池已耗尽');
 const pool=[...new Set(s.nodePool)].sort();
 const safe=pool.filter(id=>!['battle','ruin'].includes(NODES[id].kind));
 const first=weightedNode(s,safe.length?safe:pool),ids=[first];pool.splice(pool.indexOf(first),1);
 while(ids.length<3&&pool.length){const id=weightedNode(s,pool);ids.push(id);pool.splice(pool.indexOf(id),1);}
 return ids.map(id=>clone(NODES[id]));
}
export function submitVoyage(ctx,cmd){
 const {s}=ctx;ctx.require(s.phase==='navigation','完成当前行动与弃牌后才能导航');const node=s.candidates.find(n=>n.id===cmd.nodeId);ctx.require(node,'节点不在候选中');s.node={...clone(node),resolved:false,instanceId:ctx.id('node')};s.candidates=[];s.ap=ctx.stat('baseAp');s.phase='action';
 if(node.id!=='boss'){const index=s.nodePool.indexOf(node.id);ctx.require(index>=0,'节点已从本层池中消耗');s.nodePool.splice(index,1);}
 s.nodeVisits[node.id]=(s.nodeVisits[node.id]||0)+1;s.lastNodeId=node.id;
 ctx.log('驶向 '+node.name,'导航');for(let i=0;i<3;i++)ctx.give(ctx.pick(SPRING_POOL),1,{source:'spring:'+s.voyage});ctx.log('涌泉補给已自动领取：资源牌三张','补给');
}
export function enchantCard(ctx,cardId,enchant){
 const card=ctx.card(cardId);ctx.require(['combat','survival','action'].includes(CARDS[card.definitionId].kind),'选择战斗、生存或行动牌附魔');ctx.require(['return','instant'].includes(enchant),'选择回牌或瞬发');ctx.require(!card.enchant.includes(enchant),'已有该附魔');card.enchant.push(enchant);ctx.log(CARDS[card.definitionId].name+' 获得'+(enchant==='return'?'回牌':'瞬发'),'附魔');return card;
}
export function chooseOption(ctx,cmd){
 const {s}=ctx;ctx.require(s.phase==='action'&&s.node&&!s.node.resolved,'当前没有待选择节点选项');const option=s.node.options?.find(o=>o.id===cmd.optionId);ctx.require(option,'未知节点选项');
 for(const [id,amount] of Object.entries(option.cardCosts||{})){
  ctx.require(['resource','survival','currency'].includes(CARDS[id]?.kind)&&Number.isSafeInteger(amount)&&amount>0,'无效节点物资费用');
  ctx.require(ctx.count(id)>=amount,'缺少'+CARDS[id].name+' ×'+(amount-ctx.count(id)));
 }
 ctx.spend(option.cost||0);
 for(const [id,amount] of Object.entries(option.cardCosts||{})){ctx.consume(id,amount);ctx.log('投入 '+CARDS[id].name+' ×'+amount,'节点费用');}
 switch(option.special){
  case 'upgrade':{const cell=s.cells.find(c=>c.state==='intact'&&c.equipment?.instanceId===cmd.equipmentId);ctx.require(cell&&cell.equipment.level<CONFIG.upgradeMax,'选择未满级的可用设备');cell.equipment.level++;ctx.log('休整委托升级 '+CARDS[cell.equipment.definitionId].name,'节点');break;}
  case 'enchant':enchantCard(ctx,cmd.cardId,cmd.enchant);break;
  case 'exchange':{const card=ctx.card(cmd.cardId);ctx.require(SPRING_POOL.includes(card.definitionId),'选择投入费用后仍持有的一张基础资源牌');const definitionId=card.definitionId;card.quantity--;if(!card.quantity)ctx.remove(card.instanceId);ctx.give(ctx.pick(SPRING_POOL.filter(id=>id!==definitionId)));break;}
  case 'blood':ctx.change('hp',-5,'event');if(!ctx.checkAlive())return;if(ctx.random()<0.5)ctx.relic(ctx.pick(Object.keys(RELICS).filter(id=>RELICS[id].rarity==='normal').sort()));else ctx.log('水母缓缓离去，没有留下东西','节点');break;
 }
 ctx.effects(option.effects||[],'node:'+s.node.instanceId);if(s.phase==='finished')return;s.node.resolved=true;s.completedNodes++;ctx.log(s.node.name+'：'+option.name,'节点');
}
export function shopBuy(ctx,cmd){
 const {s,p}=ctx;ctx.require(s.phase==='action'&&s.node?.kind==='shop'&&!s.node.resolved,'商店节点未开放');const item=SHOP.find(i=>i.id===cmd.itemId);ctx.require(item,'不存在的商品');let price=item.price;if(p.purchases.coupon&&price>1)price--;
 if(cmd.payment==='corpse')ctx.consume('corpse',Math.ceil(price/2));else{ctx.require(!cmd.payment||cmd.payment==='coin','请选择贝币或尸体');ctx.consume('coin',price);}
 if(item.card)ctx.give(item.card);if(item.relic){ctx.require(!s.relicIds.includes(item.relic),'本局已有这件藏品');ctx.relic(item.relic);}ctx.log('购买 '+item.name,'交易');
}
