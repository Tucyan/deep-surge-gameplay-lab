import test from 'node:test';
import assert from 'node:assert/strict';
import {getDefaultConfig,getActiveConfig,applyConfig,saveAppliedConfig,loadAppliedConfig,clearAppliedConfig,configFingerprint} from '../src/config/store.js';
import {CARDS,CONFIG} from '../src/content/index.js';
import {GameSession} from '../src/core/session.js';

test('应用配置能改变真实游戏，内容版本隔离存档，恢复默认可继续原存档',()=>{
  const defaultConfig=getDefaultConfig();
  const oldSession=new GameSession();oldSession.execute({type:'NewGame',originId:'strong',seed:245});
  const oldSave=oldSession.serialize();
  const changed=getDefaultConfig();changed.content.CARDS.punch.damage=7;
  const oldReference=CARDS;
  try{
    applyConfig(changed);
    assert.equal(CARDS,oldReference);assert.equal(CARDS.punch.damage,7);
    assert.notEqual(CONFIG.contentVersion,oldSave.contentVersion);
    assert.throws(()=>GameSession.restore(oldSave),/版本/);
    const game=new GameSession();game.execute({type:'NewGame',originId:'strong',seed:245});
    const snapshot=game.serialize();snapshot.state.candidates=[structuredClone(changed.content.NODES.battle)];
    const battle=GameSession.restore(snapshot);
    assert.equal(battle.execute({type:'SubmitVoyage',nodeId:'battle'}).ok,true);
    assert.equal(battle.execute({type:'EnterNode'}).ok,true);
    const punch=battle.getView().hand.find(c=>c.definitionId==='punch');
    assert.equal(battle.execute({type:'PlayCard',cardId:punch.instanceId}).ok,true);
    assert.equal(battle.getView().phase,'action');
  }finally{applyConfig(defaultConfig);}
  assert.equal(GameSession.restore(oldSave).getView().voyage,1);
});

test('不合法配置和损坏的浏览器记录不能覆盖已生效内容',()=>{
  const before=getActiveConfig(),bad=getDefaultConfig();bad.content.CARDS.punch.cost=-1;
  const storage=new Map();const adapter={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
  assert.throws(()=>saveAppliedConfig(bad,adapter));assert.equal(storage.size,0);
  assert.deepEqual(getActiveConfig(),before);
  adapter.setItem('deep-surge-lab-content-v1','broken');
  assert.equal(loadAppliedConfig(adapter).ok,false);assert.deepEqual(getActiveConfig(),before);
});

test('浏览器存储属性被禁用时仍能加载游戏，保存和恢复给出说明',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('SecurityError');}});
  try{
    assert.equal(loadAppliedConfig().ok,false);
    assert.throws(()=>saveAppliedConfig(getDefaultConfig()),/浏览器存储不可用/);
    assert.throws(()=>clearAppliedConfig(),/浏览器存储不可用/);
    const game=new GameSession();assert.equal(game.execute({type:'NewGame',seed:245,originId:'strong'}).ok,true);
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});

test('配置指纹与对象字段顺序无关，导出不暴露运行版本',()=>{
  const first=getDefaultConfig(),second=structuredClone(first);
  second.content.CARDS=Object.fromEntries(Object.entries(second.content.CARDS).reverse());
  assert.equal(configFingerprint(first),configFingerprint(second));
  first.content.CARDS.water.effects[0].delta=35;
  try{applyConfig(first);assert.equal(getActiveConfig().content.CONFIG.contentVersion,getDefaultConfig().content.CONFIG.contentVersion);}
  finally{applyConfig(getDefaultConfig());}
});

test('内容表条目顺序变化不改变固定种子的节点候选',()=>{
  const config=getDefaultConfig();
  try{
    applyConfig(config);const first=new GameSession();first.execute({type:'NewGame',seed:245,originId:'strong'});
    const ids=first.getView().candidates.map(n=>n.id);
    config.content.NODES=Object.fromEntries(Object.entries(config.content.NODES).reverse());
    applyConfig(config);const second=new GameSession();second.execute({type:'NewGame',seed:245,originId:'strong'});
    assert.deepEqual(second.getView().candidates.map(n=>n.id),ids);
  }finally{applyConfig(getDefaultConfig());}
});

test('策划初始生命与普通行动牌效果在真实规则中生效',()=>{
  const config=getDefaultConfig();config.content.CONFIG.initial.hp=10;
  config.content.CARDS.restAction={name:'小憩',kind:'action',cost:1,description:'恢复精神。',effects:[{type:'ChangeCurrent',stat:'sanity',delta:5}]};
  config.content.NODES.drift.options[0].effects=[{type:'GiveCard',id:'restAction'}];
  try{
    applyConfig(config);const game=new GameSession();game.execute({type:'NewGame',originId:'strong',seed:245});
    assert.equal(game.getView().current.hp,20);
    assert.equal(game.execute({type:'SubmitVoyage',nodeId:'drift'}).ok,true);
    assert.equal(game.execute({type:'ChooseOption',optionId:'wood'}).ok,true);
    const action=game.getView().hand.find(c=>c.definitionId==='restAction');
    assert.equal(game.execute({type:'PlayCard',cardId:action.instanceId}).ok,true);
    assert.equal(game.getView().current.sanity,85);
  }finally{applyConfig(getDefaultConfig());}
});
