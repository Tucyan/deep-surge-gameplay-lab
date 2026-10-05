import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../src/core/session.js';
import {NODES} from '../src/content/index.js';
import * as ui from '../src/ui/view.js';

const card=(id,quantity=1)=>({instanceId:'test-'+id,definitionId:id,quantity,enchant:[],stackLimit:1});
function fixture(node){
 const g=new GameSession();g.execute({type:'NewGame',seed:17,originId:'strong'});
 const saved=g.serialize();Object.assign(saved.state,{phase:'action',ap:3,node:{...structuredClone(NODES[node]),resolved:false},hand:[card('punch'),card('rope',15)]});
 return saved;
}
test('战斗超限仍直接进入下一回合；胜利后保留超限，航行结束才要求弃牌',()=>{
 const g=GameSession.restore(fixture('battle'));
 assert.equal(g.execute({type:'EnterNode'}).ok,true);assert.ok(g.getView().excess>0);
 const before=g.getView().current,hand=g.getView().hand;
 assert.equal(g.execute({type:'EndBattleTurn'}).ok,true);
 assert.equal(g.getView().phase,'battle');assert.equal(g.getView().battle.round,2);assert.equal(g.getView().battleAp,3);
 assert.equal(g.getView().current.hunger,before.hunger);assert.equal(g.getView().current.hydration,before.hydration);assert.deepEqual(g.getView().hand,hand);
 const unchanged=g.serialize();assert.equal(g.execute({type:'DiscardCards',cardIds:['test-rope']}).ok,false);assert.deepEqual(g.serialize(),unchanged);
 const saved=g.serialize();saved.state.battle.enemies[0].hp=1;
 const won=GameSession.restore(saved);assert.equal(won.execute({type:'PlayCard',cardId:'test-punch'}).ok,true);
 assert.equal(won.getView().phase,'action');assert.ok(won.getView().excess>0);
 assert.equal(won.execute({type:'EndVoyage'}).ok,true);assert.equal(won.getView().phase,'discard');
 assert.equal(won.execute({type:'FinishDiscard'}).ok,false);
});
test('航行结束后局外购买可操作；活跃航行回首页仍不能提前购买',()=>{
 assert.equal(ui.canUseProfileActions({phase:'home'}),true);assert.equal(ui.canUseProfileActions({phase:'finished'}),true);
 for(const phase of ['navigation','action','battle','discard'])assert.equal(ui.canUseProfileActions({phase}),false);
 const saved=fixture('camp');saved.profile.points=12;const g=GameSession.restore(saved);
 assert.equal(g.execute({type:'BuyMeta',itemId:'inheritance'}).ok,false);
 assert.equal(g.execute({type:'AbandonRun'}).ok,true);
 assert.equal(g.execute({type:'BuyMeta',itemId:'inheritance'}).ok,true);assert.equal(g.getView().profile.purchases.inheritance,1);
 assert.equal(g.execute({type:'UnlockTech',techId:'knowledge'}).ok,true);
});
test('局内商店以币或尸体支付，重复藏品按钮禁用且重复交易完整回滚',()=>{
 const saved=fixture('trader');saved.state.hand=[card('coin',4),card('corpse',2)];saved.state.ap=0;
 const g=GameSession.restore(saved);assert.equal(g.execute({type:'ShopBuy',itemId:'guardian',payment:'corpse'}).ok,true);
 const v=g.getView(),item=v.shop.find(i=>i.id==='guardian');assert.equal(v.ap,0);assert.ok(v.relics.some(r=>r.id==='guardian'));
 assert.equal(ui.canPurchase(v,item,'coin'),false);
 assert.equal(ui.purchaseStatus(v,item,'coin').reason,'已拥有，不能重复购买');
 assert.equal(ui.purchaseStatus(v,v.shop.find(i=>i.id==='crossbow'),'corpse').reason,'怪物尸体不足，还差 2');
 assert.equal(ui.purchaseStatus(v,v.shop.find(i=>i.id==='lamp'),'coin').cost,2);
 const before=g.serialize();assert.equal(g.execute({type:'ShopBuy',itemId:'guardian',payment:'coin'}).ok,false);assert.deepEqual(g.serialize(),before);
 assert.equal(g.execute({type:'ShopBuy',itemId:'lamp',payment:'coin'}).ok,true);assert.equal(g.getView().hand.find(c=>c.definitionId==='coin').quantity,2);
});
