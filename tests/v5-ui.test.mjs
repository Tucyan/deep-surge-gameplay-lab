import test from 'node:test';
import assert from 'node:assert/strict';
import {candidatePresentation,layerProgress,nodeOptionCost,currentNodeOption,navigationActionStatus} from '../src/ui/view.js';

test('hidden navigation candidates never expose details, name or risk data',()=>{
 const candidate={id:'secret',name:'秘密祭坛',kind:'altar',description:'secret rewards',options:[{id:'blood'}],opportunitySummary:'secret costs',visibility:'unknown'};
 assert.deepEqual(candidatePresentation(candidate),{id:'secret',name:'未知停靠点',kind:'unknown',description:'到达后完整揭示，可能发生战斗。',opportunitySummary:'',options:[]});
 const type=candidatePresentation({...candidate,visibility:'typeOnly'});
 assert.equal(type.name,'未辨认停靠点');assert.equal(type.kind,'altar');assert.deepEqual(type.options,[]);assert.equal(type.opportunitySummary,'');
 const details=candidatePresentation({...candidate,visibility:'detailsHidden'});
 assert.equal(details.name,'秘密祭坛');assert.deepEqual(details.options,[]);assert.equal(details.opportunitySummary,'');
});
test('layer progress uses current layer voyage, not global total',()=>{
 assert.equal(layerProgress({layerIndex:1,layerVoyage:2,voyage:15,length:12,layers:[{definitionId:'a',length:13},{definitionId:'b',length:12,name:'第二层'}]}),'第 2 层 · 第二层 · 2 / 12 站 · 总航行 15');
});
test('runtime options and core statuses override static node costs',()=>{
 const option={id:'upgrade',cost:2,cardCosts:{wood:2}};
 const status={canChoose:true,reason:'',summary:'0 AP · 免费升级',probability:1};
 const view={phase:'action',ap:0,hand:[],node:{options:[{...option,cost:0}],optionStatus:{upgrade:status}}};
 assert.equal(currentNodeOption(view,'upgrade',{options:[option]}).cost,0);
 assert.deepEqual(nodeOptionCost(view,option),status);
});
test('active stat payments preserve one life/SAN and summarize random losses',()=>{
 const view={phase:'action',ap:2,current:{hp:30,sanity:10},hand:[{definitionId:'wood',quantity:3}]};
 const status=nodeOptionCost(view,{cost:0,statCosts:{sanity:10},randomCardCost:3});
 assert.equal(status.canChoose,false);assert.match(status.reason,/理智/);assert.match(status.summary,/随机.*3/);
});
test('navigation statuses rely on actual charges and current SAN, never base AP',()=>{
 const view={phase:'navigation',ap:0,current:{sanity:8},hand:[],relics:[{id:'tideLens'}],relicUsage:{tideLens:{charges:0}}};
 assert.equal(navigationActionStatus(view,'scout','sanity').canChoose,false);
 assert.equal(navigationActionStatus(view,'scout','relic').canChoose,false);
 assert.equal(navigationActionStatus({...view,current:{sanity:9}},'scout','sanity').canChoose,true);
});
test('protecting one unit disables sacrifice if the remaining pool cannot pay',()=>{
 const option={id:'sacrifice',randomCardCost:3};
 const view={phase:'action',node:{optionStatus:{sacrifice:{canChoose:true,reason:'',summary:'随机失去3份'}},sacrificeCandidates:[{instanceId:'wood',quantity:3}]}};
 assert.equal(nodeOptionCost(view,option,'wood').canChoose,false);
 assert.equal(nodeOptionCost(view,option).canChoose,true);
 assert.equal(nodeOptionCost({...view,node:{...view.node,sacrificeCandidates:[{instanceId:'wood',quantity:4}]}},option,'wood').canChoose,true);
});

test('保护组合费用预览扣除固定材料，与真实费用一致',()=>{const o={id:'mixed',randomCardCost:2,cardCosts:{wood:1}},view={node:{sacrificeCandidates:[{instanceId:'w',definitionId:'wood',quantity:3}],optionStatus:{mixed:{canChoose:true,summary:'wood1 + random2'}}}};assert.equal(nodeOptionCost(view,o,'w').canChoose,false);});
test('中性层名可显示海域或时间，但默认名称不重复',()=>{const v={layerIndex:0,layerVoyage:1,voyage:1,length:10,layer:{name:'第1层'}};assert.equal(layerProgress(v),'第 1 层 · 1 / 10 站 · 总航行 1');v.layer.name='第三个黎明';assert.match(layerProgress(v),/第三个黎明/);});
