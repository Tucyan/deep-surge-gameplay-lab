import {CARDS,CONFIG,SPRING_POOL,BUFFS} from '../content/index.js';
import {hasMechanic} from './relic-rules.js';
import {canAddEnvironment,addEnvironment} from './environment.js';

export const sacrificeCards=s=>s.hand.filter(c=>!c.battleOnly&&c.definitionId!=='punch'&&['resource','survival','equipment','action'].includes(CARDS[c.definitionId]?.kind));
export function detachableCells(s){
 const all=s.cells.filter(c=>c.state!=='detached');if(all.length<2)return [];
 const neighbor=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)===1;
 return all.filter(c=>all.filter(o=>neighbor(c,o)).length<4).filter(c=>{const left=all.filter(o=>o.id!==c.id),seen=new Set([left[0].id]),queue=[left[0]];while(queue.length){const current=queue.shift();for(const o of left)if(!seen.has(o.id)&&neighbor(current,o)){seen.add(o.id);queue.push(o);}}return seen.size===left.length;}).sort((a,b)=>a.id.localeCompare(b.id));
}
export function optionProbability(s,option){
 const condition=option.successCondition;
 if(condition&&condition.operator==='gt'&&s.current[condition.stat]>condition.value)return 1;
 return option.relicProbability??null;
}
export function optionStatus(s,p,option){
 const parts=[(option.cost||0)+' AP'],missing=[];
 const counts=id=>s.hand.filter(c=>c.definitionId===id).reduce((n,c)=>n+c.quantity,0);
 for(const [id,n]of Object.entries(option.cardCosts||{})){parts.push(CARDS[id].name+' ×'+n+'（持有'+counts(id)+'）');if(counts(id)<n)missing.push('缺少'+CARDS[id].name+' ×'+(n-counts(id)));}
 for(const [stat,n]of Object.entries(option.statCosts||{})){parts.push((stat==='hp'?'HP':'SAN')+' −'+n+'（'+s.current[stat]+' → '+(s.current[stat]-n)+'）');if(s.current[stat]<=n)missing.push((stat==='hp'?'HP':'SAN')+'支付后须至少剩1');}
 if(option.randomCardCost){parts.push('随机失去 '+option.randomCardCost+' 份手牌');const available=sacrificeCards(s).reduce((n,c)=>n+c.quantity,0)-Object.entries(option.cardCosts||{}).filter(([id])=>['resource','survival'].includes(CARDS[id]?.kind)).reduce((n,[,quantity])=>n+quantity,0);if(available<option.randomCardCost)missing.push('支付固定费用后合格手牌不足');}
 if(option.detachCell){parts.push('随机立即脱落一外围格（设备损失）');if(!detachableCells(s).length)missing.push('无可脱落的合法外围格');}
 if(option.special==='upgrade'&&!s.cells.some(c=>c.state==='intact'&&c.equipment&&c.equipment.level<CONFIG.upgradeMax))missing.push('没有可升级设备');
 if(option.special==='enchant'&&!s.hand.some(c=>['combat','survival','action'].includes(CARDS[c.definitionId]?.kind)&&(!c.enchant.includes('return')||!c.enchant.includes('instant'))))missing.push('没有可附魔手牌');
 if(option.special==='exchange'&&!s.hand.some(c=>SPRING_POOL.includes(c.definitionId)&&counts(c.definitionId)>(option.cardCosts?.[c.definitionId]||0)))missing.push('没有支付后可交换的基础资源');
 if(option.special==='guide'&&!s.cells.some(c=>c.state==='intact'&&c.equipment?.definitionId==='lamp'&&c.equipment.fuel>0))missing.push('需要完好燃灯');
 const validateEnvironment=effects=>{const shadow=structuredClone(s),ctx={s:shadow,id:()=> 'preview-environment',log:()=>{},require:(ok,message)=>{if(!ok)throw new Error(message);}};try{for(const e of effects)if(e.type==='AddBuff'&&BUFFS[e.id]?.environment)addEnvironment(ctx,e.id);}catch{missing.push('海况冲突或达到上限');}};
 if(option.outcomes?.length)for(const branch of option.outcomes)validateEnvironment([...(option.effects||[]),...branch.effects]);else validateEnvironment(option.effects||[]);
 if(s.ap<(option.cost||0)&&s.phase==='action')missing.unshift('AP不足');
 if(s.node?.resolved&&s.phase==='action')missing.unshift('节点已完成');
 const probability=optionProbability(s,option);
 return {canChoose:missing.length===0,reason:missing.join('；'),summary:parts.join(' · '),probability,risk:option.randomCardCost?'随机损失可含食水、附魔牌或设备牌':option.detachCell?'立即毁掉筏格与格上设备，不能修补恢复':''};
}
export function payOption(ctx,option,cmd){
 const {s}=ctx;const status=optionStatus(s,ctx.p,option);ctx.require(status.canChoose,status.reason);
 let protectedCard=null;
 if(cmd.protectedCardId){ctx.require(option.randomCardCost&&hasMechanic(s,ctx.p,'protect')&&s.relicUsage.protect?.remaining>0,'没有随机失牌保护额度');protectedCard=sacrificeCards(s).find(c=>c.instanceId===cmd.protectedCardId);ctx.require(protectedCard,'请选择一份合格保护手牌');}
 const fixedUnits=Object.entries(option.cardCosts||{}).filter(([id])=>['resource','survival'].includes(CARDS[id]?.kind)).reduce((n,[,quantity])=>n+quantity,0);
 const units=sacrificeCards(s).reduce((n,c)=>n+c.quantity,0)-(protectedCard?1:0)-fixedUnits;ctx.require(units>=(option.randomCardCost||0),'保护后或支付固定费用后合格手牌不足');
 if(protectedCard){const required=option.cardCosts?.[protectedCard.definitionId]||0;ctx.require(ctx.count(protectedCard.definitionId)-1>=required,'保护牌不能用于支付固定费用');}
 ctx.spend(option.cost||0);let paid=0;
 for(const [id,n]of Object.entries(option.cardCosts||{})){let remaining=n;for(const c of [...s.hand]){if(c.definitionId!==id)continue;const used=Math.min(remaining,c.quantity-(c.instanceId===protectedCard?.instanceId?1:0));c.quantity-=used;remaining-=used;if(!c.quantity)ctx.remove(c.instanceId);if(!remaining)break;}ctx.require(remaining===0,'固定费用未完整支付');if(CARDS[id].kind!=='currency')paid+=n;ctx.log('投入 '+CARDS[id].name+' ×'+n,'节点费用');}
 for(const [stat,n]of Object.entries(option.statCosts||{}))ctx.change(stat,-n,'price');
 if(option.randomCardCost){
  for(let i=0;i<option.randomCardCost;i++){const pool=sacrificeCards(s).map(c=>({card:c,available:c.quantity-(c.instanceId===protectedCard?.instanceId?1:0)})).filter(x=>x.available>0);let roll=Math.floor(ctx.random()*pool.reduce((n,x)=>n+x.available,0));const entry=pool.find(x=>{roll-=x.available;return roll<0;});const c=entry.card;c.quantity--;if(!c.quantity)ctx.remove(c.instanceId);ctx.log('随机失去 '+CARDS[c.definitionId].name+' ×1','节点费用');}
  paid+=option.randomCardCost;if(protectedCard)s.relicUsage.protect.remaining--;
 }
 if(option.detachCell){const c=ctx.pick(detachableCells(s));const equipment=c.equipment;c.state='detached';c.damagedAt=null;c.equipment=null;ctx.log('筏格 '+c.id+' 立即脱落'+(equipment?'，损失 '+CARDS[equipment.definitionId].name:''),'节点费用');}
 return {units:paid,sanityPrice:option.statCosts?.sanity||0};
}
