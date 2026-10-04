import {CARDS,EQUIPMENT,RECIPES,CONFIG,ORIGINS,RELICS,BUFFS,META_SHOP,TECH,SHOP} from '../content/index.js';
import {clone,createProfile,random,stat,sources,capacity,enrichedCard} from './model.js';
import {context} from './effects.js';
import {raftCommand,endVoyage,expansionOptions,upgradeOptions} from './raft.js';
import {candidates,submitVoyage,chooseOption,shopBuy,enchantCard} from './nodes.js';
import {enterBattle,attack,endBattleTurn,retreat,battleSupply} from './battle.js';
import {profileCommand} from './profile.js';
export {createProfile};
const ACTIVE_PHASES=['navigation','action','discard','battle','battleDiscard'];
const RAFT_COMMANDS=['Craft','ExpandRaft','RepairCell','UpgradeEquipment','ActivateEquipment','FuelLamp'];
export class GameSession{
 constructor(profile=createProfile()){this.profile=clone(profile);this.state=null;}
 serialize(){return clone({schema:CONFIG.schema,contentVersion:CONFIG.contentVersion,randomVersion:CONFIG.randomVersion,profile:this.profile,state:this.state});}
 static restore(data){
  if(!data||data.schema!==CONFIG.schema||data.contentVersion!==CONFIG.contentVersion||data.randomVersion!==CONFIG.randomVersion)throw new Error('存档版本不兼容');
  const d=clone(data),p=d.profile,s=d.state;
  if(!p||!Number.isSafeInteger(p.points)||p.points<0||!p.purchases||!p.pending||!Array.isArray(p.tech)||!Array.isArray(p.rareRelics)||!p.discovered||!Array.isArray(p.legacyCards)||!Number.isSafeInteger(p.completedNodes)||!Number.isSafeInteger(p.runs))throw new Error('局外存档损坏');
  for(const key of ['cards','relics','monsters','diaries','endings'])if(!Array.isArray(p.discovered[key]))throw new Error('图鉴存档损坏');
  for(const [id,n]of Object.entries(p.purchases))if(!META_SHOP[id]||!Number.isSafeInteger(n)||n<0||n>META_SHOP[id].maxPurchases)throw new Error('商店存档损坏');
  if(p.tech.some(id=>!TECH[id])||p.rareRelics.some(id=>RELICS[id]?.rarity!=='rare'))throw new Error('解锁存档损坏');
  if(s){
   if(![...ACTIVE_PHASES,'finished'].includes(s.phase)||!ORIGINS[s.originId]||!Number.isSafeInteger(s.voyage)||!Number.isSafeInteger(s.length)||s.length<CONFIG.minVoyages||s.length>CONFIG.maxVoyages||s.voyage<1||s.voyage>s.length||!Number.isSafeInteger(s.rng)||!Array.isArray(s.hand)||!Array.isArray(s.cells)||!Array.isArray(s.buffs)||!Array.isArray(s.relicIds)||!Array.isArray(s.log)||!s.current||!s.base||!s.bonuses)throw new Error('本局存档损坏');
   const ids=new Set();for(const card of s.hand){if(!CARDS[card.definitionId]||typeof card.instanceId!=='string'||ids.has(card.instanceId)||!Number.isSafeInteger(card.quantity)||card.quantity<1||!Array.isArray(card.enchant)||card.enchant.some(x=>!['instant','return'].includes(x)))throw new Error('手牌存档损坏');ids.add(card.instanceId);}
   for(const c of s.cells){if(!['intact','damaged','detached'].includes(c.state)||!Number.isInteger(c.x)||!Number.isInteger(c.z)||c.x<0||c.z<0||c.x>3||c.z>3||c.equipment&&(!EQUIPMENT[c.equipment.definitionId]||c.equipment.level<1||c.equipment.level>3))throw new Error('木筏存档损坏');}
   if(s.buffs.some(b=>!BUFFS[b.definitionId]||!Number.isFinite(b.remaining)||b.remaining<0)||s.relicIds.some(id=>!RELICS[id]))throw new Error('效果存档损坏');
   for(const key of ['hp','hunger','hydration','sanity'])if(!Number.isFinite(s.current[key])||s.current[key]<0)throw new Error('数值存档损坏');
   if(!Number.isFinite(s.ap)||s.ap<0||!Number.isFinite(s.battleAp)||s.battleAp<0||!Array.isArray(s.candidates)||!Array.isArray(s.tools)||!s.flags||!Number.isSafeInteger(s.nextId))throw new Error('阶段存档损坏');
   if(['battle','battleDiscard'].includes(s.phase)&&(!s.battle||!Array.isArray(s.battle.enemies)||!Number.isSafeInteger(s.battle.round)))throw new Error('战斗存档损坏');
  }
  const game=new GameSession(p);game.state=s;return game;
 }
 preview(command){const copy=GameSession.restore(this.serialize());const result=copy.execute(command);return {ok:result.ok,errors:result.errors};}
 getView(){
  const s=this.state,p=this.profile;if(!s)return clone({phase:'home',profile:p,hand:[],cells:[],buffs:[],relics:[],log:[],candidates:[],node:null,battle:null,stats:CONFIG.base,current:CONFIG.initial,capacity:0,excess:0,recipeAvailability:{},upgradeOptions:[],expansionOptions:[]});
  const stats=Object.fromEntries(Object.keys(CONFIG.base).map(k=>[k,stat(s,p,k)]));
  const recipeAvailability={};for(const [id,r]of Object.entries(RECIPES)){const enough=Object.entries(r.ingredients).every(([defId,amount])=>s.hand.filter(c=>c.definitionId===defId).reduce((sum,c)=>sum+c.quantity,0)>=amount);const unlocked=r.output!=='spearRack'||p.tech.includes('spear');recipeAvailability[id]={canCraft:s.phase==='action'&&s.ap>=r.cost&&enough&&unlocked,reason:!unlocked?'需解锁科技':s.phase!=='action'?'仅航行行动阶段':!enough?'缺少材料':s.ap<r.cost?'AP不足':''};}
  const ids=[...new Set([...s.relicIds,...p.rareRelics])];
  return clone({...s,profile:p,stats,statDetails:sources(s,p),hand:s.hand.map(enrichedCard),capacity:capacity(s),excess:Math.max(0,capacity(s)-stats.handLimit),cells:s.cells.map(c=>({...c,equipment:c.equipment?{...EQUIPMENT[c.equipment.definitionId],...c.equipment}:null})),maxRaftSide:p.purchases.raft?4:3,relics:ids.map(id=>({id,...RELICS[id]})),buffs:s.buffs.map(b=>({...b,...BUFFS[b.definitionId]})),shop:SHOP.map(item=>({...item,price:p.purchases.coupon&&item.price>1?item.price-1:item.price,description:item.card?CARDS[item.card].description:RELICS[item.relic].description})),recipeAvailability,upgradeOptions:upgradeOptions(s),expansionOptions:expansionOptions(s,p)});
 }
 execute(command){
  const before=this.serialize();try{
   if(!command||typeof command.type!=='string')throw new Error('无效操作');this.profile=clone(this.profile);this.state=clone(this.state);
   if(['BuyMeta','UnlockTech'].includes(command.type)){if(this.state&&ACTIVE_PHASES.includes(this.state.phase))throw new Error('回到主页后再进行局外操作');profileCommand(this.profile,command);}
   else if(command.type==='NewGame')this.newGame(command);
   else if(command.type==='ReturnHome'){if(this.state&&this.state.phase!=='finished')throw new Error('请先保存或结束本局');this.state=null;}
   else{if(!this.state)throw new Error('请先开始游戏');const ctx=context(this.state,this.profile);this.handle(ctx,command);if(this.state.phase==='action'&&this.state.node?.resolved&&this.state.ap===0&&this.state.pendingEnchant===0)endVoyage(ctx);}
   this.normalize();return {ok:true,errors:[],view:this.getView(),events:[]};
  }catch(error){this.profile=before.profile;this.state=before.state;return {ok:false,errors:[error.message],view:this.getView(),events:[]};}
 }
 normalize(){if(!this.state)return;for(const k of ['hp','hunger','hydration','sanity'])this.state.current[k]=Math.min(this.state.current[k],stat(this.state,this.profile,k+'Max'));this.state.ap=Math.min(this.state.ap,stat(this.state,this.profile,'baseAp'));this.state.battleAp=Math.min(this.state.battleAp,stat(this.state,this.profile,'battleAp'));}
 newGame(command){
  if(this.state&&ACTIVE_PHASES.includes(this.state.phase))throw new Error('当前航行尚未结束');if(!ORIGINS[command.originId])throw new Error('选择一种出身');if(!Number.isSafeInteger(command.seed)||command.seed<0||command.seed>0xffffffff)throw new Error('种子须为0至4294967295的整数');
  const p=this.profile;const s={phase:'navigation',seed:command.seed,rng:command.seed||0x9e3779b9,originId:command.originId,voyage:1,length:0,ap:0,battleAp:0,current:clone(CONFIG.initial),base:clone(CONFIG.base),bonuses:{},hand:[],tools:['handtool'],cells:[],buffs:[],relicIds:[],log:[],candidates:[],node:null,battle:null,flags:{},nextId:1,completedNodes:0,settledVoyage:0,level:1,xp:0,pendingEnchant:0,result:null,blessing:false};this.state=s;
  s.length=CONFIG.minVoyages+Math.floor(random(s)*(CONFIG.maxVoyages-CONFIG.minVoyages+1));s.current.hp=Math.max(1,Math.min(stat(s,p,'hpMax'),CONFIG.initial.hp+stat(s,p,'hpMax')-CONFIG.base.hpMax));
  for(let z=0;z<2;z++)for(let x=0;x<2;x++)s.cells.push({id:'cell-'+x+'-'+z,x,z,state:'intact',damagedAt:null,equipment:null});
  const ctx=context(s,p);ctx.give('punch');ctx.give('wood');ctx.give('plastic');ctx.give('iron');
  if(p.purchases.inheritance)ctx.give('coin',3);for(const card of p.legacyCards)ctx.give(card.definitionId,1,{enchant:clone(card.enchant),source:'legacy'});
  if(p.pending.supply>0){ctx.give('filter');p.pending.supply--;}
  if(p.pending.blessing>0){s.blessing=true;p.pending.blessing--;}
  s.candidates=candidates(s);ctx.log('出身：'+ORIGINS[s.originId].name+'；本层 '+s.length+' 次航行','启航');
 }
 handle(ctx,cmd){
  const {s,p}=ctx;if(s.phase==='finished')throw new Error('本局已结束，请返回主页');
  if(RAFT_COMMANDS.includes(cmd.type)){raftCommand(ctx,cmd);return;}
  switch(cmd.type){
   case 'SubmitVoyage':submitVoyage(ctx,cmd);break;
   case 'ChooseOption':chooseOption(ctx,cmd);break;
   case 'EnterNode':enterBattle(ctx);break;
   case 'ShopBuy':shopBuy(ctx,cmd);break;
   case 'PlayCard':this.playCard(ctx,cmd);break;
   case 'EndVoyage':endVoyage(ctx);break;
   case 'EndBattleTurn':endBattleTurn(ctx);break;
   case 'Retreat':retreat(ctx);break;
   case 'DiscardCards':{ctx.require(['discard','battleDiscard'].includes(s.phase),'仅在弃牌阶段弃牌');ctx.require(Array.isArray(cmd.cardIds)&&new Set(cmd.cardIds).size===cmd.cardIds.length&&cmd.cardIds.length>0,'选择不同的手牌');for(const id of cmd.cardIds){const card=ctx.card(id);ctx.require(CARDS[card.definitionId].kind!=='negative','负面牌必须花AP清除');if(CARDS[card.definitionId].traits?.includes('return')||card.enchant.includes('return')){ctx.log(CARDS[card.definitionId].name+' 回牌，不能通过弃置腾出容量','弃牌');continue;}ctx.remove(id);ctx.log('弃置 '+CARDS[card.definitionId].name,'弃牌');}break;}
   case 'FinishDiscard':{ctx.require(['discard','battleDiscard'].includes(s.phase),'当前不是弃牌阶段');ctx.require(capacity(s)<=ctx.stat('handLimit'),'手牌仍然超限');if(s.phase==='battleDiscard'){s.phase='battle';s.battle.round++;battleSupply(ctx);}else if(s.voyage===s.length){ctx.finish(!s.flags.bossDefeated?'withdrawn':ctx.feature('trueEndingEligible')&&s.flags.readDiary?'true':'survived');}else{s.voyage++;s.node=null;s.phase='navigation';s.candidates=candidates(s);}break;}
   case 'EnchantCard':{ctx.require(s.phase==='action'&&s.pendingEnchant>0,'没有可领取的留存附魔');const card=enchantCard(ctx,cmd.cardId,cmd.enchant);p.legacyCards=[{definitionId:card.definitionId,enchant:clone(card.enchant)}];s.pendingEnchant--;break;}
   case 'AbandonRun':ctx.require(ACTIVE_PHASES.includes(s.phase),'当前没有进行中的航行');ctx.finish('abandon');break;
   default:throw new Error('未知操作：'+cmd.type);
  }
 }
 playCard(ctx,cmd){
  const {s}=ctx;ctx.require(['action','battle'].includes(s.phase),'当前不能出牌');const card=ctx.card(cmd.cardId),def=CARDS[card.definitionId];const cost=card.definitionId==='pollution'?def.cost:(card.enchant.includes('instant')?0:def.cost);
  ctx.require(!['resource','currency'].includes(def.kind),'资源用于合成、扩建或投料，货币用于商店');
  if(def.kind==='equipment'){
   ctx.require(s.phase==='action','战斗中不能安装设备');const c=s.cells.find(c=>c.id===cmd.targetId);ctx.require(c?.state==='intact'&&!c.equipment,'选择完好的空筏格');ctx.spend(cost);ctx.remove(card.instanceId);c.equipment={instanceId:ctx.id('equipment'),definitionId:card.definitionId,level:card.level||1,fuel:0,progress:0};ctx.log('安装 '+def.name+' 于 '+c.id,'木筏');return;
  }
  if(def.kind==='action'){
   ctx.require(s.phase==='action','此牌仅在航行行动阶段使用');
   if(!def.targetOperation){ctx.spend(cost);ctx.remove(card.instanceId);ctx.returnCard(card,cost);ctx.effects(def.effects||[],card.instanceId);return;}
   if(def.targetOperation==='dismantle'){const c=s.cells.find(c=>c.equipment?.instanceId===cmd.targetId);ctx.require(c,'选择已安装设备');ctx.spend(cost);ctx.remove(card.instanceId);const r=RECIPES[c.equipment.definitionId];c.equipment=null;if(r)ctx.give(Object.keys(r.ingredients).sort()[0]);ctx.log('拆除设备并回收材料','木筏');}
   else{const c=s.cells.find(c=>c.id===cmd.targetId);ctx.require(c?.state==='damaged','选择破损筏格');ctx.spend(cost);ctx.remove(card.instanceId);c.state='intact';c.damagedAt=null;ctx.log('使用修补包修复 '+c.id,'木筏');}ctx.returnCard(card,cost);return;
  }
  if(def.kind==='combat'){ctx.require(s.phase==='battle','选择战斗中的敌人');const e=s.battle.enemies.find(e=>e.instanceId===cmd.targetId)||(!cmd.targetId&&s.battle.enemies[0]);ctx.require(e?.hp>0,'选择存活敌人');}
  if(def.kind==='negative')ctx.require(s.phase==='battle','污染牌只在战斗中清除');
  ctx.spend(cost,s.phase==='battle');ctx.remove(card.instanceId);
  ctx.returnCard(card,cost);
  
  if(def.kind==='combat'){attack(ctx,card,cmd.targetId);if(s.phase!=='finished')ctx.effects(def.effects||[],card.instanceId);}else ctx.effects(def.effects||[],card.instanceId);
  if(def.kind==='negative')ctx.log('清除潮蚀污染','战斗');
 }
}

