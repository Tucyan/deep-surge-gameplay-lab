import {SPRING_POOL} from './cards.js';
export const MONSTERS={
 biter:{name:'啃筏者',hp:6,damage:2,intent:'咬击：生命−2。'},
 jelly:{name:'胶膜水母',hp:7,damage:1,intent:'刺击：生命−1，并施加中毒。',buff:'poisoned'},
 crab:{name:'绝壳蟹',hp:9,damage:3,intent:'重击：生命−3。'},
 sentinel:{name:'遗迹守卫',hp:11,damage:3,intent:'回响：生命−3，并施加畏惧。',buff:'fearful'},
 boss:{name:'涌潮之眼',hp:18,damage:3,intent:'潮蚀：生命−3；隔回合污染手牌。',buff:'fearful',pollution:true}
};
const option=(id,name,description,effects=[],extra={})=>({id,name,description,effects,cost:0,...extra});
export const NODES={
 drift:{id:'drift',name:'漂浮物带',kind:'supply',description:'残片被缆绳和油污缠住，需投入物资才能回收；也可换取补给。',options:[
  option('wood','编网打捞木料','投入绳索、布条各1和1 AP，获得木头×2、塑料×1。',[{type:'GiveCard',id:'wood',amount:2},{type:'GiveCard',id:'plastic'}],{cost:1,cardCosts:{rope:1,cloth:1}}),
  option('metal','撬开金属货箱','投入木头×2、塑料×1和1 AP，获得废铁×2、绳索×1。',[{type:'GiveCard',id:'iron',amount:2},{type:'GiveCard',id:'rope'}],{cost:1,cardCosts:{wood:2,plastic:1}}),
  option('provisions','修复密封补给箱','投入废铁、绳索、布条各1和1 AP，获得淡水、食物各1。',[{type:'GiveCard',id:'water'},{type:'GiveCard',id:'food'}],{cost:1,cardCosts:{iron:1,rope:1,cloth:1}}),
  option('leave','平稳驶过','不投入物资，也不获得奖励。')
 ]},
 camp:{id:'camp',name:'灯火休整地',kind:'rest',description:'守灯人提供免费的安顿调整，每次只能领取一个方向的收益。',options:[
  option('rest','包扎补给休整','免费休整；生命+15，饱食、水分、精神各+40，获得休整余裕。',[...['hp','hunger','hydration','sanity'].map(stat=>({type:'ChangeCurrent',stat,delta:stat==='hp'?15:40})),{type:'AddBuff',id:'rested'}]),
  option('upgrade','委托升级设备','免费选择已安装设备升一级，不消耗目标。',[],{special:'upgrade'}),
  option('enchant','供奉附魔手牌','免费选择战斗、生存或行动牌赋予回牌或瞬发，不消耗目标。',[],{special:'enchant'}),
  option('leave','继续航行','不投入物资，也不获得休整效果。')
 ]},
 trader:{id:'trader',name:'海怪商人',kind:'shop',description:'商人用触腕敲击货箱。贝币或尸体皆可交易。',options:[option('calm','听一段海上故事','无需费用，精神恢复5，结束本次商店停留。',[{type:'ChangeCurrent',stat:'sanity',delta:5}]),option('leave','离开商店','保留货币，继续航行。')]},
 jelly:{id:'jelly',name:'水母转换者',kind:'exchange',description:'水母转换一份基础资源，也可以交换鲜血或记忆。',options:[
  option('card','投入媒介转换资源','只投入1 AP，选择一份基础资源随机换为另一种，无额外媒介。',[],{special:'exchange',cost:1}),
  option('blood','包扎后献出5点生命','投入布条×1并损失5生命；50%获得普通藏品，否则无所得。',[],{special:'blood',cardCosts:{cloth:1}}),
  option('memory','交换潮汐记忆','塑料1、SAN10、1 AP；60%获得普通藏品，否则贝币1；支付前SAN>80时确定获得藏品。',[],{cost:1,cardCosts:{plastic:1},statCosts:{sanity:10},special:'relicChance',relicProbability:0.6,successCondition:{stat:'sanity',operator:'gt',value:80}}),
  option('emergency','收取应急补给','支付SAN6，随机获得一份基础资源；无需材料和AP。',[],{statCosts:{sanity:6},outcomes:SPRING_POOL.map(id=>({weight:1,effects:[{type:'GiveCard',id}]}))}),
  option('leave','保持距离','不付出代价，也无所得。')
 ]},
 storm:{id:'storm',name:'裂潮风暴',kind:'environment',description:'散落的货物正沉入浪底，回收需要消耗固定物资。',options:[
  option('risk','系绳深入打捞','投入绳索、木头各1和1 AP；外围一格受损，获得木头×1、废铁×2。',[{type:'DamageCell'},{type:'GiveCard',id:'wood'},{type:'GiveCard',id:'iron',amount:2}],{cost:1,cardCosts:{rope:1,wood:1}}),
  option('secure','搭浮架回收补给','投入废铁、绳索、布条各1和1 AP；无额外筏损，获得淡水、食物各1，精神恢复20。',[{type:'GiveCard',id:'water'},{type:'GiveCard',id:'food'},{type:'ChangeCurrent',stat:'sanity',delta:20}],{cost:1,cardCosts:{iron:1,rope:1,cloth:1}}),
  option('leave','绕过浪头','不获得牌，本轮食水航耗各减少5。',[{type:'SetFlag',key:'avoidWave',value:true}])
 ]},
 altar:{id:'altar',name:'深潮祭坛',kind:'exchange',description:'先从固定的两件未持有普通藏品中选择一件，再以一种代价换取；藏品可拒绝，不能重抽。',options:[
  option('sacrifice','献出行囊','随机失去3份合格手牌，获得所选普通藏品。',[],{randomCardCost:3,special:'altar'}),
  option('blood','献出鲜血','支付8 HP且至少剩1，获得所选普通藏品。',[],{statCosts:{hp:8},special:'altar'}),
  option('raft','献出筏身','随机立即脱落一个合法外围格及其设备，获得所选普通藏品。',[],{detachCell:true,special:'altar'}),
  option('leave','离开祭坛','无代价、无奖励。')
 ]},
 fogGuide:{id:'fogGuide',name:'漂流灯塔',kind:'environment',description:'独立的雾中导引事件；守灯人不在休息节点收取费用。',options:[
  option('guide','接受雾中导引','支付木头1；有完好燃灯时下一次导航揭示所有候选，下一次偏航概率降低15个百分点。',[],{cardCosts:{wood:1},special:'guide'}),
  option('listen','听取航线提醒','免费获得1份木头。',[{type:'GiveCard',id:'wood'}]),
  option('leave','离开灯塔','不付出也不获得。')
 ]},
 battle:{id:'battle',name:'捕食者水域',kind:'battle',description:'水下传来咬合声。战胜敌人获得尸体、贝币与经验。',monster:'biter'},
 jellyBattle:{id:'jellyBattle',name:'水母幽光',kind:'battle',description:'透明的伞盖遮住航线。',monster:'jelly'},
 crabBattle:{id:'crabBattle',name:'硬壳暗礁',kind:'battle',description:'一只绝壳蟹盘踞在暗礁上。',monster:'crab'},
 ruin:{id:'ruin',name:'沉没遗迹',kind:'ruin',description:'困难战斗；胜利50%获得藏品，50%获得日记。败退恢复进入时生命。',monster:'sentinel'},
 boss:{id:'boss',name:'层底：涌潮之眼',kind:'battle',description:'本层最后的阻拦。Boss会污染手牌。',monster:'boss',boss:true}
};
NODES.drift.variants=[
 {id:'salvage',name:'漂浮物·缆绳残片',description:NODES.drift.description,options:structuredClone(NODES.drift.options)},
 {id:'sealed',name:'漂浮物·封蜡木箱',description:'撬箱需要投入；也可拾取少量碎木，或承受幻听换取材料。',options:[
  option('scraps','捡拾漂浮残片','免费随机获得木头或塑料1。',[],{outcomes:[{weight:1,effects:[{type:'GiveCard',id:'wood'}]},{weight:1,effects:[{type:'GiveCard',id:'plastic'}]}]}),
  option('open','撬开封蜡箱','木头1、1 AP；70%食水各1，30%塑料1。',[],{cost:1,cardCosts:{wood:1},outcomes:[{weight:7,effects:[{type:'GiveCard',id:'food'},{type:'GiveCard',id:'water'}]},{weight:3,effects:[{type:'GiveCard',id:'plastic'}]}]}),
  option('voices','听取船底幻声','SAN10换废铁与绳索各1。',[{type:'GiveCard',id:'iron'},{type:'GiveCard',id:'rope'}],{statCosts:{sanity:10}}),
  option('leave','平稳驶过','无代价、无奖励。')]},
 {id:'lostBag',name:'漂浮物·遗失货袋',description:'可用一份随机手牌换回确定材料。',options:[
  option('bag','换取货袋','随机失去1份合格手牌，获得废铁与绳索各1。',[{type:'GiveCard',id:'iron'},{type:'GiveCard',id:'rope'}],{randomCardCost:1}),
  option('leave','平稳驶过','无代价、无奖励。')]}
];
NODES.storm.variants=[
 {id:'surface',name:'风暴·散落货物',description:NODES.storm.description,options:structuredClone(NODES.storm.options)},
 {id:'hold',name:'风暴·沉底货舱',description:'明确的打捞风险，失败只破损而不立即脱落。',options:[
  option('salvage','下潜货舱','绳索1、1 AP；65%废铁2，35%废铁1并破损一格。',[],{cost:1,cardCosts:{rope:1},outcomes:[{weight:65,effects:[{type:'GiveCard',id:'iron',amount:2}]},{weight:35,effects:[{type:'GiveCard',id:'iron'},{type:'DamageCell',damageOnly:true}]}]}),
  option('tide','追随顺流','SAN5，下一轮开始获得2次航行顺流。',[{type:'AddBuff',id:'current'}],{statCosts:{sanity:5}}),
  option('abyss','追逐异常歌声','SAN10，获得贝币2；下一轮进入1次航行迷雾Ⅲ。',[{type:'GiveCard',id:'coin',amount:2},{type:'AddBuff',id:'fog3'}],{statCosts:{sanity:10}}),
  option('leave','绕过浪头','不获得牌，本轮食水航耗各减少5。',[{type:'SetFlag',key:'avoidWave',value:true}])]}
];
export const SHOP=[{id:'filter',name:'滤水器牌',price:3,card:'filter'},{id:'planter',name:'土盆牌',price:3,card:'planter'},{id:'lamp',name:'灯牌',price:2,card:'lamp'},{id:'crossbow',name:'弓弩牌',price:4,card:'crossbow'},{id:'guardian',name:'守潮骨片',price:4,relic:'guardian'},{id:'luckyShell',name:'回声贝壳',price:5,relic:'luckyShell'},
 {id:'emberWick',name:'余烬灯芯',price:5,relic:'emberWick'},
 {id:'tideLens',name:'潮纹镜片',price:5,relic:'tideLens'},
 {id:'headingNeedle',name:'定向骨针',price:5,relic:'headingNeedle'},
 {id:'mendingNeedle',name:'缝潮针',price:5,relic:'mendingNeedle'},
 {id:'namedKnot',name:'记名绳结',price:5,relic:'namedKnot'},
 {id:'scavengerRing',name:'拾荒者指环',price:5,relic:'scavengerRing'},
 {id:'emptyCompass',name:'空腹罗盘',price:5,relic:'emptyCompass'},
 {id:'deepContract',name:'深潮契印（代价：基础SAN航耗额外5）',price:5,relic:'deepContract'}
];
export const DIARIES=[{id:'diary1',name:'前人的日记：灯',description:'“灯不是为了照亮海，而是提醒我们还在船上。”'},{id:'diary2',name:'前人的日记：回声',description:'“我听见歌声时，记得没有回头。”'},{id:'diary3',name:'前人的日记：潮眼',description:'“渡过最后的眼，记忆便会找到归处。”'}];
export const ENDINGS={withdrawn:{name:'离开潮眼',description:'你未击败潮眼，带着已完成的航程退回岸边。'},survived:{name:'灯火未熄',description:'你击退潮眼，带着漂流的记忆抵达彼岸。'},true:{name:'真结局：回声归航',description:'塞壬的珍珠守住记忆，前人的日记指引你驶向潮汐之外。'},dead:{name:'沉入深潮',description:'生命消逝，海仍记得这一段航行。'},mad:{name:'迷失潮声',description:'精神归零，你成为歌声的一部分。'},abandon:{name:'返回岸边',description:'你结束了这次探索，带回已经走过的航程。'}};

