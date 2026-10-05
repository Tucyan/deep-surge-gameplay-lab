import test from 'node:test';
import assert from 'node:assert/strict';
import { newestVoyageLogs, parseSeed, canConfirmDiscard, canPurchase } from '../src/ui/view.js';
import {NODES} from '../src/content/index.js';
import { GameSession } from '../src/core/session.js';

test('log presentation puts the newest voyage, branch and message first without mutating the save',()=>{
  const source=[{voyage:1,groups:[{name:'旧',entries:['二','一']}]},{voyage:3,groups:[{name:'战斗',entries:['五','四']},{name:'准备',entries:['三']}]}];
  const before=JSON.stringify(source), ordered=newestVoyageLogs(source);
  assert.equal(ordered[0].voyage,3);
  assert.equal(ordered[0].groups[0].name,'战斗');
  assert.deepEqual(ordered[0].groups[0].entries,['五','四']);
  assert.equal(JSON.stringify(source),before);
});
test('session logs retain the core newest-first message order when rendered',()=>{
  let game=new GameSession();
  assert.equal(game.execute({type:'NewGame',seed:0,originId:'strong'}).ok,true);
  const data=game.serialize();data.state.nodePool=['drift'];data.state.candidates=[structuredClone(NODES.drift)];
  for(const id of ['rope','cloth'])data.state.hand.push({instanceId:'test-'+id,definitionId:id,quantity:1,enchant:[],stackLimit:1});
  game=GameSession.restore(data);
  assert.equal(game.execute({type:'SubmitVoyage',nodeId:'drift'}).ok,true);
  assert.equal(game.execute({type:'ChooseOption',optionId:'wood'}).ok,true);
  const actual=game.getView().log;
  const rendered=newestVoyageLogs(actual);
  assert.deepEqual(rendered[0].groups,actual[0].groups);
  assert.equal(rendered[0].groups.find(g=>g.name==='物资').entries[0],'获得 塑料');
});
test('seed entry accepts the full unsigned range and rejects blank, fractional and overflowing input',()=>{
  assert.equal(parseSeed('0'),0);
  assert.equal(parseSeed('4294967295'),4294967295);
  for(const input of ['','  ','abc','-1','1.5','4294967296'])assert.equal(parseSeed(input),null);
});
test('only a discard phase under the hand limit can offer confirmation',()=>{
  assert.equal(canConfirmDiscard({phase:'discard',excess:1}),false);
  assert.equal(canConfirmDiscard({phase:'discard',excess:0}),true);
  assert.equal(canConfirmDiscard({phase:'battleDiscard',excess:0}),true);
  assert.equal(canConfirmDiscard({phase:'action',excess:0}),false);
});
test('node trading costs no AP and guards actual coin/corpse quantities',()=>{
  const view={phase:'action',ap:0,node:{kind:'shop',resolved:false},hand:[{definitionId:'coin',quantity:3},{definitionId:'corpse',quantity:1}]};
  assert.equal(canPurchase(view,{price:3},'coin'),true);
  assert.equal(canPurchase(view,{price:4},'coin'),false);
  assert.equal(canPurchase(view,{price:2},'corpse'),true);
  assert.equal(canPurchase(view,{price:3},'corpse'),false);
  assert.equal(canPurchase({...view,node:{kind:'shop',resolved:true}},{price:1},'coin'),false);
});
