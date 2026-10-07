import {CARDS,ORIGINS,BUFFS,RELICS,CONFIG,ENDINGS} from '../content/index.js';
import {random,pick,stat,activeEquipment,discover,sources} from './model.js';
import {addEnvironment} from './environment.js';
import {initializeRelicUsage,offerRelic} from './relic-rules.js';
export function context(s,p){
 for(const id of [...s.relicIds,...p.rareRelics])initializeRelicUsage(s,id);
 const ctx={s,p,random:()=>random(s),pick:list=>pick(s,list),stat:key=>stat(s,p,key),id:prefix=>prefix+'-'+s.nextId++,require:(valid,message)=>{if(!valid)throw new Error(message);}};
 ctx.log=(text,group='行动')=>{let branch=s.log.find(l=>l.voyage===s.voyage);if(!branch){branch={voyage:s.voyage,groups:[]};s.log.unshift(branch);}let section=branch.groups.find(g=>g.name===group);if(!section){section={name:group,entries:[]};branch.groups.unshift(section);}section.entries.unshift(text);};
 ctx.card=id=>{const card=s.hand.find(c=>c.instanceId===id);ctx.require(card,'找不到这张手牌');return card;};
 ctx.count=id=>s.hand.filter(c=>c.definitionId===id).reduce((sum,c)=>sum+c.quantity,0);
 ctx.consume=(id,amount=1)=>{ctx.require(ctx.count(id)>=amount,'缺少'+(CARDS[id]?.name||id));for(const card of [...s.hand]){if(card.definitionId!==id)continue;const used=Math.min(card.quantity,amount);card.quantity-=used;amount-=used;if(card.quantity===0)s.hand=s.hand.filter(c=>c.instanceId!==card.instanceId);if(amount===0)break;}};
 ctx.remove=id=>{const card=ctx.card(id);s.hand=s.hand.filter(c=>c.instanceId!==id);return card;};
 ctx.give=(id,amount=1,extra={})=>{
  ctx.require(CARDS[id]&&Number.isInteger(amount)&&amount>0,'未知卡牌或数量');
  if(id==='coin'){const old=s.hand.find(c=>c.definitionId===id);if(old)old.quantity+=amount;else s.hand.push({instanceId:ctx.id('card'),definitionId:id,quantity:amount,enchant:[],stackLimit:1,...extra});}
  else for(let i=0;i<amount;i++)s.hand.push({instanceId:ctx.id('card'),definitionId:id,quantity:1,enchant:[],level:1,stackLimit:1,...extra});
  discover(p,'cards',id);ctx.log('获得 '+CARDS[id].name+(amount>1?' ×'+amount:''),'物资');
 };
 ctx.relic=id=>{ctx.require(RELICS[id],'未知藏品');if(RELICS[id].rarity==='rare'){if(!p.rareRelics.includes(id))p.rareRelics.push(id);}else if(!s.relicIds.includes(id))s.relicIds.push(id);initializeRelicUsage(s,id);discover(p,'relics',id);ctx.log('获得藏品：'+RELICS[id].name,'藏品');};
 ctx.hasRelic=id=>s.relicIds.includes(id)||p.rareRelics.includes(id);
 ctx.feature=key=>sources(s,p).some(src=>src[key]);
 ctx.returnCard=(card,cost)=>{
  const def=CARDS[card.definitionId];if(['negative','equipment'].includes(def.kind))return;
  const stamp=s.voyage+':'+(s.phase==='battle'?'battle-'+s.battle.round:'action');
  const native=def.traits?.includes('return')&&cost>0;
  const chance=Math.min(1,sources(s,p).reduce((sum,src)=>sum+(src.returnChance||0),0));
  if(!native&&card.returnStamp===stamp)return;
  if(native||def.traits?.includes('return')||card.enchant.includes('return')||chance>0&&ctx.random()<chance){card.returnStamp=stamp;s.hand.push(card);ctx.log(def.name+' 回到手牌','回牌');}
 };
 ctx.change=(key,delta,reason='action')=>{
  if(key==='sanity'&&delta<0&&ORIGINS[s.originId]?.reduceSanityLoss>0&&(reason==='event'||reason==='voyage'&&!activeEquipment(s).some(e=>e.definitionId==='lamp'&&e.fuel>0)))delta=Math.min(0,delta+ORIGINS[s.originId].reduceSanityLoss);
  const before=s.current[key];s.current[key]=Math.max(0,Math.min(ctx.stat(key+'Max'),before+delta));
  const change=s.current[key]-before;if(change)ctx.log(({hp:'生命',hunger:'饱食',hydration:'水分',sanity:'精神'}[key]||key)+(change>0?' +':' ')+change,'数值');
 };
 ctx.buff=(id,reason='action')=>{
  const def=BUFFS[id];ctx.require(def,'未知增减益');
  if(def.environment){addEnvironment(ctx,id);return;}
  if(reason==='enemy'&&def.polarity==='negative'&&ORIGINS[s.originId]?.enemyBuffImmune){ctx.log('出身免疫了 '+def.name,'战斗');return;}
  const old=s.buffs.find(b=>b.definitionId===id);
  if(old){if(def.stacking==='stack')old.stacks++;else old.remaining=def.duration;old.appliedVoyage=s.voyage;old.appliedRound=s.battle?.round||0;}
  else s.buffs.push({instanceId:ctx.id('buff'),definitionId:id,stacks:1,remaining:def.duration,clock:def.clock,appliedVoyage:s.voyage,appliedRound:s.battle?.round||0,source:reason});
  ctx.log('获得'+(def.polarity==='negative'?'减益':'增益')+'：'+def.name,'增减益');
 };
 ctx.finish=kind=>{
  if(s.result)return;
  s.phase='finished';s.battle=null;s.pendingRelic=null;s.buffs=s.buffs.filter(b=>b.clock!=='battle');s.ap=0;s.battleAp=0;s.candidates=[];
  const points=s.completedNodes;p.points+=points;p.completedNodes+=points;p.runs++;
  discover(p,'endings',kind);
  for(const [id,def]of Object.entries(RELICS).sort(([a],[b])=>a.localeCompare(b))){const unlock=def.unlock;if(def.rarity!=='rare'||!unlock||p.rareRelics.includes(id))continue;const earned=(!unlock.nodes||p.completedNodes>=unlock.nodes)&&(!unlock.endings||p.discovered.endings.filter(e=>e!=='abandon').length>=unlock.endings);if(earned)ctx.relic(id);}
  s.result={...ENDINGS[kind],id:kind,points};ctx.log('结局：'+s.result.name+'，获得涌潮点 '+points,'结局');
 };
 ctx.checkAlive=()=>{
  if(s.current.hp>0)return true;
  if(s.battle?.ruin){s.current.hp=s.battle.entryHp;s.node.resolved=true;s.completedNodes++;s.battle=null;s.battleAp=0;s.buffs=s.buffs.filter(b=>b.clock!=='battle');s.hand=s.hand.filter(c=>!c.battleOnly);s.phase='action';ctx.log('遗迹保护：恢复入场生命，未获得奖励。','战斗');return false;}
  ctx.finish('dead');return false;
 };
 ctx.spend=(amount,battle=false)=>{ctx.require(Number.isFinite(amount)&&amount>=0,'无效AP费用');const key=battle?'battleAp':'ap';ctx.require(s[key]>=amount,'AP不足');s[key]-=amount;};
 ctx.tick=(clock)=>{
  for(const b of [...s.buffs]){
   if(b.clock!==clock)continue;const def=BUFFS[b.definitionId];if(def.environment)continue;
   if(clock==='battle'&&b.appliedRound===s.battle?.round||clock==='voyage'&&b.appliedVoyage===s.voyage)continue;
   for(const e of def.tick||[]){ctx.apply(e,'buff:'+b.instanceId);if(s.phase==='finished'||!s.battle&&clock==='battle')return;}
   b.remaining--;if(b.remaining<=0){s.buffs=s.buffs.filter(x=>x.instanceId!==b.instanceId);ctx.log(def.name+' 已结束','增减益');}
  }
 };
 ctx.apply=(effect,source='rule')=>{
  switch(effect.type){
   case 'ChangeCurrent':ctx.change(effect.stat,effect.delta,effect.reason||'action');if(effect.stat==='hp')ctx.checkAlive();break;
   case 'GiveCard':ctx.give(effect.id,effect.amount||1,{source});break;
   case 'AddBuff':ctx.buff(effect.id,effect.reason||source);break;
   case 'GrantRelic':if(RELICS[effect.id]?.rarity==='normal'&&RELICS[effect.id]?.drawback)offerRelic(ctx,[effect.id],source);else ctx.relic(effect.id);break;
   case 'SetFlag':s.flags[effect.key]=effect.value;break;
   case 'DamageCell':{const all=s.cells.filter(c=>c.state!=='detached');const edges=all.filter(c=>[[1,0],[-1,0],[0,1],[0,-1]].some(([x,z])=>!all.some(other=>other.x===c.x+x&&other.z===c.z+z)));const cell=ctx.pick(edges.filter(c=>!effect.damageOnly||c.state==='intact').sort((a,b)=>a.id.localeCompare(b.id)));if(cell){if(cell.state==='damaged'&&!effect.damageOnly){cell.state='detached';cell.equipment=null;cell.damagedAt=null;}else{cell.state='damaged';cell.damagedAt=s.voyage;}ctx.log('筏格 '+cell.id+' '+(cell.state==='damaged'?'破损':'脱落'),'木筏');}break;}
   default:throw new Error('未知效果：'+effect.type);
  }
 };
 ctx.effects=(list,source)=>{for(const e of list){ctx.apply(e,source);if(s.phase==='finished')break;}};
 return ctx;
}
