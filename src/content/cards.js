// Card definitions are data only. Play effects use the shared resolver.
export const CARDS = {
 wood:{name:'木头',kind:'resource',cost:0,description:'制造材料；灯燃料1节点；两张木头可扩建一格。',fuel:1},
 iron:{name:'废铁',kind:'resource',cost:0,description:'制造材料。'},
 plastic:{name:'塑料',kind:'resource',cost:0,description:'滤水器与土盆的制造材料。'},
 rope:{name:'绳索',kind:'resource',cost:0,description:'弓弩的制造材料。'},
 cloth:{name:'布条',kind:'resource',cost:0,description:'制造包扎包。'},
 corpse:{name:'怪物尸体',kind:'resource',cost:0,description:'灯燃料3节点，或与海怪商人交换。',fuel:3},
 coin:{name:'贝币',kind:'currency',cost:0,description:'局内商店货币，全部贝币共占一张容量。'},
 water:{name:'淡水',kind:'survival',cost:0,description:'水分+40，瞬发。',effects:[{type:'ChangeCurrent',stat:'hydration',delta:40}]},
 food:{name:'食用植物',kind:'survival',cost:0,description:'饱食+40，瞬发。',effects:[{type:'ChangeCurrent',stat:'hunger',delta:40}]},
 calm:{name:'灯火余温',kind:'survival',cost:0,description:'精神+15，瞬发。',effects:[{type:'ChangeCurrent',stat:'sanity',delta:15}]},
 punch:{name:'出拳',kind:'combat',cost:1,description:'造成1伤害；打出或弃置后回到手牌。',damage:1,traits:['return']},
 arrow:{name:'射箭',kind:'combat',cost:0,description:'造成2伤害，瞬发；本场战斗有效。',damage:2},
 spear:{name:'矛击',kind:'combat',cost:1,description:'造成4伤害；本场战斗有效。',damage:4},
 pollution:{name:'潮蚀污染',kind:'negative',cost:2,description:'留手每战斗回合损失2生命；花2 AP清除。不能附魔或直接弃掉。',heldEffects:[{type:'ChangeCurrent',stat:'hp',delta:-2,reason:'pollution'}]},
 lamp:{name:'灯',kind:'equipment',cost:1,description:'安装后投入木头/尸体，燃烧时每节点恢复精神15。'},
 filter:{name:'滤水器',kind:'equipment',cost:1,description:'Ⅰ级每两节点产淡水；Ⅱ级起每节点产淡水。'},
 planter:{name:'土盆',kind:'equipment',cost:1,description:'Ⅰ级每两节点产植物；Ⅱ级起每节点产植物。'},
 medkit:{name:'包扎包',kind:'equipment',cost:1,description:'安装后花1 AP与布条×1恢复生命8，高等级治疗更多。'},
 crossbow:{name:'弓弩',kind:'equipment',cost:1,description:'每战斗回合产生射箭；Ⅱ/Ⅲ级每2/3张箭占一格。'},
 spearRack:{name:'矛架',kind:'equipment',cost:1,description:'每战斗回合产生矛击。'},
 dismantle:{name:'拆除',kind:'action',targetOperation:'dismantle',cost:1,description:'移除指定设备，回收一份配方材料。'},
 repair:{name:'修补包',kind:'action',targetOperation:'repair',cost:1,description:'修复指定的破损筏格。'}
};
export const SPRING_POOL=['wood','iron','plastic','rope','cloth'];
