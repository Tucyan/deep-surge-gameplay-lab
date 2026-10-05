import test from 'node:test';
import assert from 'node:assert/strict';
import {runBalanceGame, summarizeRuns} from '../scripts/balance-player.mjs';
import {GameSession} from '../src/core/session.js';

function survivalFixture(){
 const g=new GameSession();g.execute({type:'NewGame',seed:2654435761,originId:'strong'});
 const saved=g.serialize();Object.assign(saved.state,{phase:'action',ap:3,node:{id:'camp',resolved:true},current:{hp:36,hunger:25,hydration:25,sanity:80}});
 for(const [i,id]of ['filter','planter','medkit'].entries())saved.state.cells[i].equipment={instanceId:'audit-'+id,definitionId:id,level:id==='medkit'?1:2,progress:0,fuel:0};
 return GameSession.restore(saved);
}

test('平衡策略仅提交合法命令，重复种子及策略的完整轨迹一致',()=>{
 const a=runBalanceGame({seed:2654435761,originId:'strong',strategy:'events',trace:true});
 const b=runBalanceGame({seed:2654435761,originId:'strong',strategy:'events',trace:true});
 assert.deepEqual(a,b);assert.equal(a.phase,'finished');assert.equal(a.failedCommands,0);
 assert.equal(a.initialPoolSize,2*(a.length-1));assert.equal(a.remainingPool,a.initialPoolSize-a.ordinarySelected);
 assert.ok(a.trace.some(t=>t.command.type==='SubmitVoyage'));
});
test('无事件对照策略不支付节点物资费用，非胜利不得计入击败Boss',()=>{
 const a=runBalanceGame({seed:1013904226,originId:'fool',strategy:'skip-events'});
 assert.equal(a.eventCardsConsumed,0);assert.equal(a.failedCommands,0);
 const summary=summarizeRuns([a]);
 assert.equal(summary.bossWins,['survived','true'].includes(a.result)?1:0);
 assert.equal(summary.runs,1);assert.equal(Object.values(summary.endings).reduce((n,x)=>n+x,0),1);
});
test('饥渴结算先于生产：25点存量不足以抵消30点航耗',()=>{
 const g=survivalFixture(),before=g.getView().current.hp;
 assert.equal(g.execute({type:'EndVoyage'}).ok,true);
 assert.equal(g.getView().current.hp,before-4);
 assert.equal(g.getView().current.hunger,0);assert.equal(g.getView().current.hydration,0);
 for(const id of ['water','food'])assert.ok(g.getView().hand.some(c=>c.definitionId===id));
});
test('Ⅰ级包扎包1AP和一份布条治疗8，无法无限无耗材抵消饥渴',()=>{
 const saved=survivalFixture().serialize();saved.state.current.hp=20;saved.state.hand=[{instanceId:'cloth-test',definitionId:'cloth',quantity:1,enchant:[],stackLimit:1}];
 const g=GameSession.restore(saved);
 assert.equal(g.execute({type:'ActivateEquipment',equipmentId:'audit-medkit'}).ok,true);
 assert.equal(g.getView().current.hp,28);assert.equal(g.getView().ap,2);assert.equal(g.getView().hand.length,0);
 assert.equal(g.execute({type:'ActivateEquipment',equipmentId:'audit-medkit'}).ok,false);
 assert.equal(g.execute({type:'EndVoyage'}).ok,true);
 assert.equal(g.getView().current.hp,24);
});

test('从双饥渴归零吃喝各一份40点食水，本轮结算不再扣生命',()=>{
 const saved=survivalFixture().serialize();saved.state.current.hunger=0;saved.state.current.hydration=0;
 saved.state.hand=['food','water'].map(id=>({instanceId:id+'-test',definitionId:id,quantity:1,enchant:[],stackLimit:1}));
 const g=GameSession.restore(saved),hp=g.getView().current.hp;
 for(const id of ['food','water'])assert.equal(g.execute({type:'PlayCard',cardId:id+'-test'}).ok,true);
 assert.equal(g.execute({type:'EndVoyage'}).ok,true);
 assert.equal(g.getView().current.hp,hp);assert.equal(g.getView().current.hunger,10);assert.equal(g.getView().current.hydration,10);
});
