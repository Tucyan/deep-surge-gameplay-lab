import {MONSTERS,EQUIPMENT,CARDS,CONFIG,ORIGINS,DIARIES,RELICS} from '../content/index.js';
import {activeEquipment,capacity,discover} from './model.js';
export function battleSupply(ctx){
 const {s}=ctx;s.battleAp=ctx.stat('battleAp');
 for(const u of activeEquipment(s)){const def=EQUIPMENT[u.definitionId];if(def.battleOutput)ctx.give(def.battleOutput,1,{battleOnly:true,source:u.instanceId,stackLimit:u.definitionId==='crossbow'?u.level:1,bonusDamage:u.definitionId==='spearRack'?u.level-1:0});}
 ctx.log('战斗第 '+s.battle.round+' 回合，AP '+s.battleAp,'战斗');
}
export function enterBattle(ctx){
 const {s,p}=ctx;ctx.require(s.phase==='action'&&s.node&&!s.node.resolved&&['battle','ruin'].includes(s.node.kind),'当前节点不是待进入战斗');const def=MONSTERS[s.node.monster];
 s.battle={round:1,ruin:s.node.kind==='ruin',boss:!!s.node.boss,entryHp:s.current.hp,enemies:[{instanceId:ctx.id('enemy'),definitionId:s.node.monster,name:def.name,hp:def.hp,maxHp:def.hp,damage:def.damage,intent:def.intent}]};
 s.phase='battle';discover(p,'monsters',s.node.monster);ctx.log('进入 '+def.name+' 战斗','战斗');if(s.blessing)ctx.buff('inspired','shop');battleSupply(ctx);
}
export function grantXp(ctx,amount){
 const {s,p}=ctx;s.xp+=amount;ctx.log('经验 +'+amount,'成长');
 while(s.xp>=CONFIG.xpPerLevel){s.xp-=CONFIG.xpPerLevel;s.level++;s.bonuses.hpMax=(s.bonuses.hpMax||0)+1;
  if(s.level%5===0){const cycle=(s.level/5-1)%3;if(cycle===0){s.bonuses.baseAp=(s.bonuses.baseAp||0)+1;s.bonuses.battleAp=(s.bonuses.battleAp||0)+1;}if(cycle===1)s.bonuses.handLimit=(s.bonuses.handLimit||0)+1;if(cycle===2)s.pendingEnchant++;}
  ctx.log('升至 Lv'+s.level+'，生命上限+1'+(s.pendingEnchant?'，可领取留存附魔':''),'成长');
 }
}
export function finishBattle(ctx,won){
 const {s,p}=ctx,old=s.battle;if(!old)return;
 if(won){ctx.give('coin',old.boss?5:2);ctx.give('corpse');grantXp(ctx,old.boss?CONFIG.bossXp:CONFIG.battleXp);
  if(old.ruin){if(ctx.random()<0.5)ctx.relic(ctx.pick(Object.keys(RELICS).filter(id=>RELICS[id].rarity==='normal').sort()));else{const unread=DIARIES.filter(d=>!p.discovered.diaries.includes(d.id));const diary=ctx.pick(unread.length?unread:DIARIES);discover(p,'diaries',diary.id);s.flags.readDiary=true;ctx.log('发现 '+diary.name,'故事');}}
  if(old.boss)s.flags.bossDefeated=true;
 }
 s.node.resolved=true;s.completedNodes++;s.battle=null;s.battleAp=0;s.buffs=s.buffs.filter(b=>b.clock!=='battle');s.hand=s.hand.filter(c=>!c.battleOnly&&c.definitionId!=='pollution');s.phase='action';ctx.log(won?'战斗胜利，返回航行行动':'撤离战斗，没有奖励','战斗');
}
export function attack(ctx,card,targetId){
 const {s}=ctx;ctx.require(s.phase==='battle','战斗牌仅在战斗中使用');const enemy=s.battle.enemies.find(e=>e.instanceId===targetId)||(!targetId&&s.battle.enemies[0]);ctx.require(enemy&&enemy.hp>0,'选择存活敌人');const damage=Math.max(0,CARDS[card.definitionId].damage+(card.bonusDamage||0)+ctx.stat('damage'));enemy.hp=Math.max(0,enemy.hp-damage);ctx.log(CARDS[card.definitionId].name+' → '+enemy.name+'，伤害 '+damage,'战斗');
 if(s.battle.enemies.every(e=>e.hp===0))finishBattle(ctx,true);
}
export function endBattleTurn(ctx){
 const {s}=ctx;ctx.require(s.phase==='battle','当前不在战斗行动阶段');s.battleAp=0;
 for(const card of [...s.hand])for(const e of CARDS[card.definitionId].heldEffects||[]){ctx.apply(e,card.instanceId);if(s.phase!=='battle')return;}
 ctx.tick('battle');if(s.phase!=='battle')return;
 for(const enemy of s.battle.enemies.filter(e=>e.hp>0)){
  ctx.change('hp',-enemy.damage,'enemy');if(!ctx.checkAlive()||s.phase!=='battle')return;
  const def=MONSTERS[enemy.definitionId];if(def.buff)ctx.buff(def.buff,'enemy');if(def.pollution&&s.battle.round%2===1)ctx.give('pollution',1,{battleOnly:true,source:enemy.instanceId});
 }
 if(s.battle.round>=7){ctx.change('hp',-2,'depth');if(!ctx.checkAlive())return;}
 if(capacity(s)>ctx.stat('handLimit'))s.phase='battleDiscard';else{s.battle.round++;battleSupply(ctx);}
}
export function retreat(ctx){
 const {s}=ctx;ctx.require(s.phase==='battle'&&s.battle.round>=2,'第2战斗回合起才可撤退');
 if(s.battle.ruin)s.current.hp=s.battle.entryHp;else{ctx.change('hp',-Math.max(0,CONFIG.retreatDamage-(ORIGINS[s.originId].retreatReduction||0)),'retreat');if(!ctx.checkAlive())return;}
 finishBattle(ctx,false);
}
