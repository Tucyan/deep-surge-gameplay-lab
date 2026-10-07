export const CONFIG={schema:1,contentVersion:'gameplay-experiment-v5',randomVersion:'xorshift32-v1',minVoyages:10,maxVoyages:15,nodePoolMultiplier:2,layers:[{id:'layer1',name:'第1层',bossNodeId:'boss'}],environment:{chance:0.25,negativeChance:0.75,maxActive:3,maxNegative:2,weights:{fog1:4,fog2:1,bloodMoon:3,confusion:2,current:3,spring:1}},initial:{hp:30,hunger:40,hydration:40,sanity:80},base:{hpMax:30,hungerMax:100,hydrationMax:100,sanityMax:100,baseAp:3,battleAp:3,handLimit:10,damage:0},upgradeCost:1,upgradeMax:3,restRecovery:40,retreatDamage:4,xpPerLevel:5,bossXp:20,battleXp:5};
// These steps run once per voyage. Reorder here, never in the UI.
export const VOYAGE_STEPS=['consume','lamp','survival','ageCells','produce','buffClock','discard'];
export const VOYAGE_EFFECTS=[
 {type:'ChangeCurrent',stat:'hunger',delta:-30,reason:'voyage'},
 {type:'ChangeCurrent',stat:'hydration',delta:-30,reason:'voyage'},
 {type:'ChangeCurrent',stat:'sanity',delta:-15,reason:'voyage'}
];
export const SURVIVAL={hungerDamage:2,hydrationDamage:3,maxDamage:4};
export const ORIGINS={
 strong:{name:'强壮之人',description:'生命、饱食、水分上限各+10。',modifiers:{hpMax:10,hungerMax:10,hydrationMax:10}},
 fool:{name:'愚者',description:'事件及未燃灯的精神损失少5。',reduceSanityLoss:5},
 restless:{name:'多动症',description:'基地和战斗AP上限各+1（实验）。',modifiers:{baseAp:1,battleAp:1}},
 hoarder:{name:'囤积癖',description:'手牌上限+1。',modifiers:{handLimit:1}},
 zealot:{name:'战斗狂热',description:'普通战斗撤退损失减少5（实验）。',retreatReduction:5},
 skeptic:{name:'无魔之人',description:'免疫敌方战斗Debuff；实体污染牌仍需处理。',enemyBuffImmune:true}
};
export const BUFFS={
 inspired:{name:'鼓舞',description:'攻击伤害+1，持续3战斗回合。',polarity:'positive',clock:'battle',duration:3,stacking:'refresh',modifiers:{damage:1}},
 poisoned:{name:'中毒',description:'战斗回合末生命−1，持续3回合。',polarity:'negative',clock:'battle',duration:3,stacking:'refresh',tick:[{type:'ChangeCurrent',stat:'hp',delta:-1,reason:'poison'}]},
 fearful:{name:'畏惧',description:'攻击伤害−1，持续2战斗回合。',polarity:'negative',clock:'battle',duration:2,stacking:'refresh',modifiers:{damage:-1}},
 fog1:{name:'迷雾Ⅰ',description:'35%概率遮蔽候选详情；持续2次航行。',polarity:'negative',clock:'voyage',duration:2,stacking:'refresh',environment:true,mechanic:'fog',fogLevel:1,chance:0.35},
 fog2:{name:'迷雾Ⅱ',description:'候选仅显示类型；持续2次航行。',polarity:'negative',clock:'voyage',duration:2,stacking:'refresh',environment:true,mechanic:'fog',fogLevel:2},
 fog3:{name:'迷雾Ⅲ',description:'候选只显示未知停靠点；持续1次航行。仅明示风险事件施加。',polarity:'negative',clock:'voyage',duration:1,stacking:'refresh',environment:true,mechanic:'fog',fogLevel:3},
 bloodMoon:{name:'血月',description:'敌方直接生命攻击+1，胜利额外获得1贝币；持续2次航行。',polarity:'negative',clock:'voyage',duration:2,stacking:'refresh',environment:true,mechanic:'bloodMoon',amount:1},
 confusion:{name:'混乱',description:'25%概率偏航到其他候选；持续2次航行。',polarity:'negative',clock:'voyage',duration:2,stacking:'refresh',environment:true,mechanic:'confusion',chance:0.25},
 headwind:{name:'逆流',description:'每轮首次基地制造或安装额外消耗1 AP；持续2次航行。默认随机池未启用。',polarity:'negative',clock:'voyage',duration:2,stacking:'refresh',environment:true,mechanic:'headwind',amount:1},
 current:{name:'顺流',description:'食水航耗各减少5；持续2次航行。',polarity:'positive',clock:'voyage',duration:2,stacking:'refresh',environment:true,mechanic:'current',amount:5},
 spring:{name:'漂流丰收',description:'下一次涌泉额外获得1份资源，领取后移除。',polarity:'positive',clock:'voyage',duration:1,stacking:'refresh',environment:true,mechanic:'spring',amount:1},
 rested:{name:'休整余裕',description:'基地AP上限+1，持续2航行轮。',polarity:'positive',clock:'voyage',duration:2,stacking:'refresh',modifiers:{baseAp:1}}
};
