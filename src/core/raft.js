import {CONFIG,EQUIPMENT,RECIPES,CARDS,VOYAGE_STEPS,VOYAGE_EFFECTS,SURVIVAL} from '../content/index.js';
export function expansionOptions(s,p){
 const side=p.purchases.raft?4:3,options=[];
 for(let z=0;z<side;z++)for(let x=0;x<side;x++)if(!s.cells.some(c=>c.x===x&&c.z===z&&c.state!=='detached')&&s.cells.some(c=>c.state!=='detached'&&Math.abs(c.x-x)+Math.abs(c.z-z)===1))options.push({x,z});
 return options;
}
export function upgradeOptions(s){
 const list=[];for(const cell of s.cells){const target=cell.equipment;if(cell.state!=='intact'||!target||target.level>=CONFIG.upgradeMax)continue;
  for(const c of s.cells)if(c.id!==cell.id&&c.state==='intact'&&c.equipment?.definitionId===target.definitionId&&c.equipment.level===target.level)list.push({targetId:target.instanceId,materialId:c.equipment.instanceId,label:target.definitionId+' / 已安装设备'});
  for(const c of s.hand)if(c.definitionId===target.definitionId&&(c.level||1)===target.level)list.push({targetId:target.instanceId,materialId:c.instanceId,label:CARDS[c.definitionId].name+' / 设备牌'});
 }return list;
}
export function raftCommand(ctx,cmd){
 const {s,p}=ctx;ctx.require(s.phase==='action','木筏操作仅在航行行动阶段进行');
 switch(cmd.type){
  case 'Craft':{const r=RECIPES[cmd.recipeId];ctx.require(r,'未知配方');ctx.require(r.output!=='spearRack'||p.tech.includes('spear'),'先在科技树解锁长矛工艺');ctx.require(s.tools.includes(r.tool),'缺少对应工具');for(const [id,amount]of Object.entries(r.ingredients))ctx.require(ctx.count(id)>=amount,'材料不足：'+CARDS[id].name);ctx.spend(r.cost);for(const [id,amount]of Object.entries(r.ingredients))ctx.consume(id,amount);ctx.give(r.output,1,{source:'craft:'+r.id});ctx.log('制作 '+r.name,'制造');break;}
  case 'ExpandRaft':{ctx.require(expansionOptions(s,p).some(o=>o.x===cmd.x&&o.z===cmd.z),'选择边缘可扩建位置');ctx.spend(1);ctx.consume('wood',2);let cell=s.cells.find(c=>c.x===cmd.x&&c.z===cmd.z);if(cell){cell.state='intact';cell.damagedAt=null;}else s.cells.push({id:'cell-'+cmd.x+'-'+cmd.z,x:cmd.x,z:cmd.z,state:'intact',damagedAt:null,equipment:null});ctx.log('扩建筏格 '+cmd.x+','+cmd.z,'木筏');break;}
  case 'RepairCell':{const c=s.cells.find(c=>c.id===cmd.cellId);ctx.require(c?.state==='damaged','只能修复破损格');ctx.spend(1);ctx.consume('wood');c.state='intact';c.damagedAt=null;ctx.log('修复 '+c.id,'木筏');break;}
  case 'UpgradeEquipment':{ctx.require(upgradeOptions(s).some(o=>o.targetId===cmd.targetId&&o.materialId===cmd.materialId),'需要另一件同类同级设备或设备牌');ctx.spend(CONFIG.upgradeCost);const target=s.cells.find(c=>c.equipment?.instanceId===cmd.targetId).equipment;const material=s.cells.find(c=>c.equipment?.instanceId===cmd.materialId);if(material)material.equipment=null;else ctx.remove(cmd.materialId);target.level++;ctx.log(EQUIPMENT[target.definitionId].name+' 升至'+target.level+'级','木筏');break;}
  case 'ActivateEquipment':{const cell=s.cells.find(c=>c.equipment?.instanceId===cmd.equipmentId);ctx.require(cell?.state==='intact'&&cell.equipment.definitionId==='medkit','选择可用包扎包');ctx.require(s.current.hp<ctx.stat('hpMax'),'生命已满');ctx.spend(1);ctx.change('hp',EQUIPMENT.medkit.healing[cell.equipment.level-1]);break;}
  case 'FuelLamp':{const card=ctx.card(cmd.cardId);const cell=s.cells.find(c=>c.equipment?.instanceId===cmd.equipmentId);ctx.require(cell?.state==='intact'&&cell.equipment.definitionId==='lamp','选择完好筏格上的灯');ctx.require(CARDS[card.definitionId].fuel,'只能投入木头或怪物尸体');cell.equipment.fuel+=CARDS[card.definitionId].fuel;ctx.remove(card.instanceId);ctx.log('投入燃料，剩余 '+cell.equipment.fuel+' 节点','木筏');break;}
  default:throw new Error('未知木筏操作');
 }
}
export function endVoyage(ctx){
 const {s}=ctx;ctx.require(s.phase==='action'&&s.node?.resolved,'先完成当前节点');ctx.require(s.settledVoyage!==s.voyage,'本轮已结算');s.ap=0;s.candidates=[];s.settledVoyage=s.voyage;
 for(const step of VOYAGE_STEPS){
  if(s.phase==='finished')return;
  switch(step){
   case 'consume':ctx.effects(VOYAGE_EFFECTS,'voyage-end');break;
   case 'lamp':for(const c of s.cells)if(c.state==='intact'&&c.equipment?.definitionId==='lamp'&&c.equipment.fuel>0){ctx.change('sanity',15+5*(c.equipment.level-1),'lamp');c.equipment.fuel--;}break;
   case 'survival':{const damage=Math.min(SURVIVAL.maxDamage,(s.current.hunger===0?SURVIVAL.hungerDamage:0)+(s.current.hydration===0?SURVIVAL.hydrationDamage:0));if(damage){ctx.change('hp',-damage,'survival');if(!ctx.checkAlive())return;}if(s.current.sanity===0&&!ctx.feature('protectSanity')){ctx.finish('mad');return;}break;}
   case 'ageCells':for(const c of s.cells)if(c.state==='damaged'&&s.voyage-c.damagedAt>=2){c.state='detached';c.equipment=null;c.damagedAt=null;ctx.log(c.id+' 超时脱落','木筏');}break;
   case 'produce':for(const c of s.cells){const u=c.equipment;if(c.state!=='intact'||!u)continue;const def=EQUIPMENT[u.definitionId];if(!def.output)continue;u.progress++;const interval=def.intervals[u.level-1];if(u.progress>=interval){u.progress-=interval;ctx.give(def.output,def.amounts[u.level-1],{source:u.instanceId});ctx.log(def.name+' 自动生产并领取','生产');}}break;
   case 'buffClock':ctx.tick('voyage');break;
   case 'discard':s.phase='discard';ctx.log('结算完成，请处理超限手牌后继续','结算');break;
  }
 }
}
