import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../src/core/session.js';
import {NODES} from '../src/content/index.js';
import {candidates} from '../src/core/nodes.js';
import {getDefaultConfig} from '../src/config/store.js';
import {validateConfig} from '../src/config/validation.js';
import * as ui from '../src/ui/view.js';

const card=(id,quantity=1,enchant=[])=>({instanceId:'test-'+id,definitionId:id,quantity,enchant,stackLimit:1});
function event(nodeId,hand){
 const g=new GameSession();assert.equal(g.execute({type:'NewGame',seed:17,originId:'strong'}).ok,true);
 const data=g.serialize();Object.assign(data.state,{phase:'action',ap:3,hand,node:{...structuredClone(NODES[nodeId]),resolved:false,instanceId:'test-node'}});
 return GameSession.restore(data);
}
const count=(g,id)=>g.getView().hand.filter(c=>c.definitionId===id).reduce((n,c)=>n+c.quantity,0);

test('休整先消耗两份布条和AP，回牌附魔不返还事件投入',()=>{
 const g=event('camp',[card('cloth',2,['return'])]);
 assert.equal(g.execute({type:'ChooseOption',optionId:'rest'}).ok,true);
 assert.equal(count(g,'wood'),0);assert.equal(count(g,'cloth'),0);assert.equal(g.getView().ap,2);
 assert.equal(g.getView().current.hunger,80);
});
test('材料不足、AP不足、特殊目标非法均完整回滚，收益不能倒付费用',()=>{
 for(const hand of [[card('wood')],[]]){
  const g=event('camp',hand),before=g.serialize();
  assert.equal(g.execute({type:'ChooseOption',optionId:'rest'}).ok,false);assert.deepEqual(g.serialize(),before);
 }
 const g=event('camp',[card('iron',2),card('rope')]),before=g.serialize();
 assert.equal(g.execute({type:'ChooseOption',optionId:'upgrade',equipmentId:'bad'}).ok,false);assert.deepEqual(g.serialize(),before);
 const d=event('camp',[card('cloth',2)]).serialize();d.state.ap=0;
 const h=GameSession.restore(d),saved=h.serialize();assert.equal(h.execute({type:'ChooseOption',optionId:'rest'}).ok,false);assert.deepEqual(h.serialize(),saved);
});
test('漂浮物以三份材料换两张生存牌，离开不扣牌且不能重复领奖',()=>{
 const g=event('drift',[card('iron'),card('rope'),card('cloth')]);
 assert.equal(g.execute({type:'ChooseOption',optionId:'provisions'}).ok,true);
 for(const id of ['iron','rope','cloth'])assert.equal(count(g,id),0);assert.equal(count(g,'water'),1);assert.equal(count(g,'food'),1);
 const before=g.serialize();assert.equal(g.execute({type:'ChooseOption',optionId:'provisions'}).ok,false);assert.deepEqual(g.serialize(),before);
 const h=event('storm',[]);assert.equal(h.execute({type:'ChooseOption',optionId:'leave'}).ok,true);assert.equal(h.getView().ap,3);
});
test('成功启航才记录节点选择，预览与拒绝不计，恢复后候选一致',()=>{
 const g=new GameSession();g.execute({type:'NewGame',seed:17,originId:'strong'});
 const id=g.getView().candidates[0].id,before=g.serialize();g.preview({type:'SubmitVoyage',nodeId:id});
 assert.deepEqual(g.serialize(),before);assert.deepEqual(g.getView().nodeVisits,{});
 assert.equal(g.execute({type:'SubmitVoyage',nodeId:'bad'}).ok,false);
  assert.equal(g.execute({type:'SubmitVoyage',nodeId:id}).ok,true);assert.equal(g.getView().nodeVisits[id],1);assert.equal(g.getView().lastNodeId,id);
 assert.equal(g.getView().nodePool.filter(x=>x===id).length,before.state.nodePool.filter(x=>x===id).length-1);
 for(const other of before.state.candidates.filter(n=>n.id!==id))assert.equal(g.getView().nodePool.filter(x=>x===other.id).length,before.state.nodePool.filter(x=>x===other.id).length);
 const a=g.serialize().state,b=GameSession.restore(g.serialize()).serialize().state;
 a.voyage=2;b.voyage=2;assert.deepEqual(candidates(a),candidates(b));assert.equal(a.rng,b.rng);
});
test('已选节点显著降权，保证非战斗且候选不重复，末轮固定Boss',()=>{
 let fresh=0,repeat=0;
 for(let seed=1;seed<=1200;seed++){
  const base={voyage:3,length:12,rng:Math.imul(seed,2654435761)>>>0,nodePool:Object.keys(NODES).filter(id=>id!=='boss'),nodeVisits:{},lastNodeId:null};
  const a=candidates(structuredClone(base));
  const b=candidates({...base,nodeVisits:{drift:3},lastNodeId:'drift'});
  fresh+=a.some(n=>n.id==='drift');repeat+=b.some(n=>n.id==='drift');
  assert.equal(new Set(b.map(n=>n.id)).size,3);assert.ok(b.some(n=>!['battle','ruin'].includes(n.kind)));
 }
 assert.ok(repeat<fresh/3,`${repeat} / ${fresh}`);
 assert.deepEqual(candidates({voyage:12,length:12}),[NODES.boss]);
});
test('重复节点只消耗一份，未选份数保留，剩余候选类型不重复',()=>{
 const g=new GameSession();g.execute({type:'NewGame',seed:17,originId:'strong'});
 const data=g.serialize();data.state.nodePool=['drift','drift','camp'];data.state.candidates=candidates(data.state);
 const h=GameSession.restore(data);
 assert.equal(h.getView().candidates.length,2);
 assert.equal(h.execute({type:'SubmitVoyage',nodeId:'drift'}).ok,true);
 assert.deepEqual(h.getView().nodePool,['drift','camp']);
 const state=h.serialize().state;state.voyage=2;assert.deepEqual(new Set(candidates(state).map(n=>n.id)),new Set(['drift','camp']));
});
test('种子生成普通航程两倍的节点池，允许重复且最后一站固定Boss',()=>{
 const g=new GameSession();g.execute({type:'NewGame',seed:17,originId:'strong'});
 const s=g.serialize().state;assert.equal(s.nodePool.length,2*(s.length-1));
 assert.ok(new Set(s.nodePool).size<s.nodePool.length);
 assert.deepEqual(GameSession.restore(g.serialize()).getView().nodePool,s.nodePool);
});
test('事件投入可通过策划配置，错误数量和污染费用被拒绝',()=>{
 const config=getDefaultConfig();config.content.NODES.drift.options[0].cardCosts={wood:2};assert.equal(validateConfig(config).ok,true);
 for(const costs of [{wood:0},{wood:1.5},{missing:1},{pollution:1},{punch:1},{}]){
  config.content.NODES.drift.options[0].cardCosts=costs;assert.equal(validateConfig(config).ok,false,JSON.stringify(costs));
 }
});
test('界面从费用数据生成持有量与禁用原因',()=>{
 const option={cost:1,cardCosts:{wood:2,cloth:1}};
 assert.deepEqual(ui.nodeOptionCost({phase:'action',ap:3,hand:[card('wood',2)]},option),{canChoose:false,reason:'缺少布条 ×1',summary:'1 AP · 木头 ×2（持有2） · 布条 ×1（持有0）'});
 assert.equal(ui.nodeOptionCost({phase:'action',ap:0,hand:[card('wood',2),card('cloth')]},option).reason,'AP不足');
});
