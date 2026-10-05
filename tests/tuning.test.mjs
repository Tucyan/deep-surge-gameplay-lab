import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../src/core/session.js';
import {getDefaultConfig,applyConfig} from '../src/config/store.js';
import {validateConfig} from '../src/config/validation.js';
import {treatmentCost} from '../src/ui/view.js';
import {candidates} from '../src/core/nodes.js';

test('治疗按配置消耗布条；缺料完整回滚，预览和读档不重复支付',()=>{
 const base=getDefaultConfig(),config=structuredClone(base);
 config.content.EQUIPMENT.medkit.activationCosts={cloth:1};
 try {
  applyConfig(config);
  const g=new GameSession();g.execute({type:'NewGame',seed:17,originId:'strong'});
  const saved=g.serialize();Object.assign(saved.state,{phase:'action',ap:3,current:{hp:20,hunger:40,hydration:40,sanity:80},hand:[]});
  saved.state.cells[0].equipment={instanceId:'med',definitionId:'medkit',level:1,progress:0,fuel:0};
  const empty=GameSession.restore(saved),before=empty.serialize();
  assert.equal(empty.execute({type:'ActivateEquipment',equipmentId:'med'}).ok,false);assert.deepEqual(empty.serialize(),before);
  saved.state.hand=[{instanceId:'cloth-test',definitionId:'cloth',quantity:1,enchant:['return'],stackLimit:1}];
  const ready=GameSession.restore(saved),initial=ready.serialize();
  assert.equal(ready.preview({type:'ActivateEquipment',equipmentId:'med'}).ok,true);assert.deepEqual(ready.serialize(),initial);
  const restored=GameSession.restore(initial);
  assert.equal(restored.execute({type:'ActivateEquipment',equipmentId:'med'}).ok,true);
  assert.equal(restored.getView().hand.length,0);assert.equal(restored.getView().ap,2);
  assert.equal(restored.getView().current.hp,20+config.content.EQUIPMENT.medkit.healing[0]);
  const paid=restored.serialize();assert.equal(restored.execute({type:'ActivateEquipment',equipmentId:'med'}).ok,false);assert.deepEqual(restored.serialize(),paid);
 } finally {applyConfig(base);}
});

test('治疗费用只能配置给包扎包，不能用污染、生存或零数量收费',()=>{
 for(const [id,costs]of [['filter',{cloth:1}],['medkit',{pollution:1}],['medkit',{water:1}],['medkit',{cloth:0}]]){
  const c=getDefaultConfig();c.content.EQUIPMENT[id].activationCosts=costs;assert.equal(validateConfig(c).ok,false);
 }
 for(const value of [0,1.5,11]){const c=getDefaultConfig();c.content.CONFIG.nodePoolMultiplier=value;assert.equal(validateConfig(c).ok,false);}
});

test('治疗按钮显示实际耗材、缺料与满血原因',()=>{
 const unit={definitionId:'medkit',activationCosts:{cloth:1}},v={phase:'action',ap:2,current:{hp:20},stats:{hpMax:30},hand:[]};
 assert.equal(treatmentCost(v,unit).canChoose,false);assert.equal(treatmentCost(v,unit).reason,'缺少布条 ×1');
 v.hand=[{definitionId:'cloth',quantity:1}];assert.equal(treatmentCost(v,unit).canChoose,true);
 v.current.hp=30;assert.equal(treatmentCost(v,unit).reason,'生命已满');
});

test('两倍池走完普通航程仍留半池，最终候选固定Boss，存档保留未选份数',()=>{
 const g=new GameSession();g.execute({type:'NewGame',seed:17,originId:'strong'});
 const saved=g.serialize();saved.profile.rareRelics=['pearl'];saved.state.base.hpMax=1000;saved.state.base.handLimit=1000;saved.state.current.hp=1000;
 saved.state.nodePool=Array(2*(saved.state.length-1)).fill('camp');saved.state.candidates=candidates(saved.state);
 const run=GameSession.restore(saved),length=run.getView().length;
 for(let voyage=1;voyage<length;voyage++){
  for(const command of [{type:'SubmitVoyage',nodeId:'camp'},{type:'ChooseOption',optionId:'leave'},{type:'EndVoyage'},{type:'FinishDiscard'}]){
   const r=run.execute(command);assert.equal(r.ok,true,r.errors.join(';'));
  }
 }
 assert.equal(run.getView().nodePool.length,length-1);assert.deepEqual(run.getView().candidates.map(n=>n.id),['boss']);
 assert.deepEqual(GameSession.restore(run.serialize()).getView(),run.getView());
});
