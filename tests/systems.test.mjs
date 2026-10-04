import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession,createProfile} from '../src/core/session.js';
import {CONFIG,ORIGINS,CARDS,RECIPES,RELICS,NODES} from '../src/content/index.js';
function game(seed=245,originId='strong',profile=createProfile()){const g=new GameSession(profile);assert.equal(g.execute({type:'NewGame',seed,originId}).ok,true);return g;}
function fixture(change){const g=game();const save=g.serialize();save.state.phase='action';save.state.ap=3;save.state.node={...structuredClone(NODES.camp),resolved:false,instanceId:'node-test'};change(save.state,save.profile);return GameSession.restore(save);}
const card=(id,def,extra={})=>({instanceId:id,definitionId:def,quantity:1,enchant:[],stackLimit:1,level:1,...extra});
const unit=(id,def,level=1)=>({instanceId:id,definitionId:def,level,progress:0,fuel:0});
const ok=(g,cmd)=>{const r=g.execute(cmd);assert.equal(r.ok,true,r.errors.join(';'));return r.view;};
test('零基地AP战后仍可领取等级附魔，手动结束后才结算',()=>{
 const g=fixture(s=>{s.node={...structuredClone(NODES.boss),resolved:false};s.ap=0;s.level=14;});
 ok(g,{type:'EnterNode'});
 const save=g.serialize();save.state.battle.enemies[0].hp=1;
 const battle=GameSession.restore(save),punch=battle.getView().hand.find(c=>c.definitionId==='punch');
 ok(battle,{type:'PlayCard',cardId:punch.instanceId});
 assert.equal(battle.getView().phase,'action');assert.equal(battle.getView().pendingEnchant,1);
 ok(battle,{type:'EnchantCard',cardId:punch.instanceId,enchant:'instant'});
 assert.equal(battle.getView().phase,'action');
 ok(battle,{type:'EndVoyage'});
 assert.equal(battle.getView().phase,'discard');assert.equal(battle.getView().profile.legacyCards[0].definitionId,'punch');
});
test('最后1AP耗尽后仍可连续喝水和吃食物，手动结束只结算一次',()=>{
 const g=fixture(s=>{s.node.resolved=true;s.ap=1;s.current.hydration=40;s.current.hunger=40;s.hand.push(card('extra-wood','wood'),card('drink','water'),card('eat','food'));});
 ok(g,{type:'ExpandRaft',x:2,z:0});
 assert.equal(g.getView().ap,0);assert.equal(g.getView().phase,'action');
 const before=g.serialize();assert.equal(g.execute({type:'Craft',recipeId:'filter'}).ok,false);assert.deepEqual(g.serialize(),before);
 ok(g,{type:'PlayCard',cardId:'drink'});assert.equal(g.getView().current.hydration,65);assert.equal(g.getView().phase,'action');
 ok(g,{type:'PlayCard',cardId:'eat'});assert.equal(g.getView().current.hunger,65);assert.equal(g.getView().ap,0);
 ok(g,{type:'EndVoyage'});assert.equal(g.getView().phase,'discard');assert.equal(g.getView().current.hydration,35);assert.equal(g.getView().current.hunger,35);
 const ended=g.serialize();assert.equal(g.execute({type:'EndVoyage'}).ok,false);assert.deepEqual(g.serialize(),ended);
});
test('安装需要设备手牌；二合一升级释放材料设备、拆除消耗拆除牌',()=>{
 const g=fixture(s=>{s.hand.push(card('filter1','filter'),card('filter2','filter'),card('dismantle','dismantle'));});
 ok(g,{type:'PlayCard',cardId:'filter1',targetId:'cell-0-0'});const id=g.getView().cells[0].equipment.instanceId;ok(g,{type:'UpgradeEquipment',targetId:id,materialId:'filter2'});assert.equal(g.getView().cells[0].equipment.level,2);ok(g,{type:'PlayCard',cardId:'dismantle',targetId:id});assert.equal(g.getView().cells[0].equipment,null);assert.equal(g.getView().hand.some(c=>c.instanceId==='dismantle'),false);
});
test('滤水器自动生产入手，灯燃料以节点推进且视图显示真实数量',()=>{
 const g=fixture(s=>{s.node.resolved=true;s.cells[0].equipment=unit('filter','filter',2);s.cells[1].equipment={...unit('lamp','lamp'),fuel:3};});
 assert.equal(g.getView().cells[1].equipment.fuel,3);ok(g,{type:'EndVoyage'});assert.equal(g.getView().hand.filter(c=>c.definitionId==='water').length,1);assert.equal(g.getView().current.sanity,80);assert.equal(g.getView().cells[1].equipment.fuel,2);
});
test('扩建仅消耗2木头和1AP，允许相邻位置并拒绝重复位置',()=>{
 const g=fixture(s=>s.hand.push(card('wood2','wood')));ok(g,{type:'ExpandRaft',x:2,z:0});assert.equal(g.getView().cells.length,5);assert.equal(g.getView().ap,2);const before=g.serialize();assert.equal(g.execute({type:'ExpandRaft',x:2,z:0}).ok,false);assert.deepEqual(g.serialize(),before);
});
test('普通战斗与航行AP和饥渴时钟独立；出拳回手',()=>{
 const g=fixture(s=>{s.node={...structuredClone(NODES.battle),resolved:false};s.ap=2;});ok(g,{type:'EnterNode'});const hand=g.getView().hand, punch=hand.find(c=>c.definitionId==='punch');ok(g,{type:'PlayCard',cardId:punch.instanceId});assert.ok(g.getView().hand.some(c=>c.instanceId===punch.instanceId));ok(g,{type:'EndBattleTurn'});assert.equal(g.getView().current.hunger,40);assert.equal(g.getView().ap,2);assert.equal(g.getView().battle.round,2);
});
test('Boss污染每留手一回合扣2HP，清除花2战斗AP且不推进航行',()=>{
 const g=fixture(s=>{s.node={...structuredClone(NODES.boss),resolved:false};});ok(g,{type:'EnterNode'});ok(g,{type:'EndBattleTurn'});const pollution=g.getView().hand.find(c=>c.definitionId==='pollution');assert.ok(pollution);const hp=g.getView().current.hp;ok(g,{type:'EndBattleTurn'});assert.equal(g.getView().current.hp,hp-5);ok(g,{type:'PlayCard',cardId:pollution.instanceId});assert.equal(g.getView().battleAp,1);assert.equal(g.getView().hand.some(c=>c.instanceId===pollution.instanceId),false);assert.equal(g.getView().voyage,1);
});
test('无魔之人免疫敌方Debuff，实体污染手牌仍出现',()=>{
 const g=fixture(s=>{s.originId='skeptic';s.node={...structuredClone(NODES.boss),resolved:false};});ok(g,{type:'EnterNode'});ok(g,{type:'EndBattleTurn'});assert.equal(g.getView().buffs.length,0);assert.ok(g.getView().hand.some(c=>c.definitionId==='pollution'));
});
test('负面藏品影响基础能力；上限加成不自动治疗',()=>{
 const g=fixture(s=>{s.relicIds=['guardian','curse'];s.current.hp=20;});assert.equal(g.getView().stats.hpMax,45);assert.equal(g.getView().current.hp,20);assert.equal(g.getView().stats.baseAp,2);assert.equal(g.getView().stats.damage,2);
});
test('归零代价致死后，水母不会重掷或奖励',()=>{
 const g=fixture(s=>{s.current.hp=5;s.node={...structuredClone(NODES.jelly),resolved:false};});const rng=g.serialize().state.rng;ok(g,{type:'ChooseOption',optionId:'blood'});assert.equal(g.getView().phase,'finished');assert.equal(g.getView().result.id,'dead');assert.equal(g.serialize().state.rng,rng);assert.equal(g.getView().relics.filter(r=>r.rarity==='normal').length,0);
});
test('遗迹失败恢复入场HP而不是直接败亡，无战利品',()=>{
 const g=fixture(s=>{s.current.hp=2;s.node={...structuredClone(NODES.ruin),resolved:false};});ok(g,{type:'EnterNode'});ok(g,{type:'EndBattleTurn'});assert.equal(g.getView().phase,'action');assert.equal(g.getView().current.hp,2);assert.equal(g.getView().hand.some(c=>c.definitionId==='corpse'),false);
});
test('完成的节点积分只结算一次，珍珠与局外购买在下局生效',()=>{
 const g=fixture(s=>{s.completedNodes=12;});ok(g,{type:'AbandonRun'});assert.equal(g.getView().profile.points,12);assert.equal(g.execute({type:'AbandonRun'}).ok,false);ok(g,{type:'ReturnHome'});ok(g,{type:'BuyMeta',itemId:'raft'});assert.equal(g.getView().profile.points,4);ok(g,{type:'UnlockTech',techId:'knowledge'});assert.equal(g.getView().profile.points,1);ok(g,{type:'NewGame',seed:100,originId:'restless'});assert.equal(g.getView().maxRaftSide,4);assert.equal(g.getView().stats.baseAp,4);assert.equal(g.getView().stats.handLimit,11);
});
test('存档跨JSON往返可恢复叠放货币，错误版本拒绝',()=>{
 const p=createProfile();p.purchases.inheritance=1;const g=game(32,'strong',p);const restored=GameSession.restore(JSON.parse(JSON.stringify(g.serialize())));assert.deepEqual(restored.getView(),g.getView());const data=g.serialize();data.schema=99;assert.throws(()=>GameSession.restore(data));
});
test('取消预览不会提前执行水母随机兑换',()=>{
 const g=fixture(s=>s.node={...structuredClone(NODES.jelly),resolved:false});const before=g.serialize();assert.equal(g.preview({type:'ChooseOption',optionId:'blood'}).ok,true);assert.deepEqual(g.serialize(),before);
});
test('回牌附魔作用于行动牌；藏品概率读取内容定义',()=>{
 const g=fixture(s=>{s.hand.push(card('repair','repair',{enchant:['return']}));s.cells[0].state='damaged';s.cells[0].damagedAt=1;});ok(g,{type:'PlayCard',cardId:'repair',targetId:'cell-0-0'});assert.ok(g.getView().hand.some(c=>c.instanceId==='repair'));
 const old=RELICS.luckyShell.returnChance;try{RELICS.luckyShell.returnChance=1;const h=fixture(s=>{s.relicIds=['luckyShell'];s.hand.push(card('water','water'));});ok(h,{type:'PlayCard',cardId:'water'});assert.ok(h.getView().hand.some(c=>c.instanceId==='water'));}finally{RELICS.luckyShell.returnChance=old;}
});
test('精神保护读取藏品能力字段，不绑定珍珠ID',()=>{
 const old=RELICS.guardian.protectSanity;try{RELICS.guardian.protectSanity=true;const g=fixture(s=>{s.relicIds=['guardian'];s.current.sanity=5;s.node.resolved=true;});ok(g,{type:'EndVoyage'});assert.equal(g.getView().phase,'discard');}finally{RELICS.guardian.protectSanity=old;}
});
test('末轮Boss撤退只得到撤离结局，不能声称击败Boss',()=>{
 const g=fixture(s=>{s.voyage=s.length;s.node={...structuredClone(NODES.boss),resolved:false};});ok(g,{type:'EnterNode'});ok(g,{type:'EndBattleTurn'});ok(g,{type:'Retreat'});ok(g,{type:'EndVoyage'});ok(g,{type:'FinishDiscard'});assert.equal(g.getView().result.id,'withdrawn');
});
