export const RELICS={
 luckyShell:{name:'回声贝壳',rarity:'normal',description:'普通出牌有25%概率回手；不影响污染牌与设备安装。',returnChance:0.25},
 guardian:{name:'守潮骨片',rarity:'normal',description:'生命上限+5。',modifiers:{hpMax:5}},
 curse:{name:'锈蚀金币',rarity:'normal',description:'攻击伤害+2，但基地AP上限−1。',modifiers:{damage:2,baseAp:-1}},
 pearl:{name:'塞壬的珍珠',rarity:'rare',description:'达成一次结局后获得；精神归零仍可航行，可进入真结局。',protectSanity:true,trueEndingEligible:true,unlock:{endings:1}},
 memory:{name:'记忆的回响',rarity:'rare',description:'累计完成50节点获得；基地和战斗AP上限各+1。',modifiers:{baseAp:1,battleAp:1},unlock:{nodes:50}}
};
export const META_SHOP={
 raft:{name:'木筏扩建许可',description:'永久扩建上限提高为4×4。',price:8,maxPurchases:1},
 body:{name:'提高身体素质',description:'永久生命、饱食、水分、精神上限各+5。',price:6,maxPurchases:3,modifiers:{hpMax:5,hungerMax:5,hydrationMax:5,sanityMax:5}},
 inheritance:{name:'流浪者遗产',description:'每局开局获得3贝币。',price:4,maxPurchases:1},
 coupon:{name:'商人优惠券',description:'局内商店价格大于1时减1。',price:5,maxPurchases:1},
 hands:{name:'手工者手记',description:'永久基地和战斗AP上限各+1。',price:12,maxPurchases:1,modifiers:{baseAp:1,battleAp:1}},
 smallBox:{name:'小箱子',description:'永久手牌上限+1。',price:5,maxPurchases:1,modifiers:{handLimit:1}},
 bigBox:{name:'大箱子',description:'永久手牌上限+2。',price:9,maxPurchases:1,modifiers:{handLimit:2}},
 blessing:{name:'下局祝福',description:'下局开战时获得鼓舞；仅消耗一次。',price:3,maxPurchases:5},
 supply:{name:'下局工具包',description:'下局额外获得一张滤水器设备牌；仅消耗一次。',price:4,maxPurchases:5}
};
export const TECH={
 knowledge:{name:'漂流知识',description:'永久手牌上限+1。',price:3,requires:[],modifiers:{handLimit:1}},
 craft:{name:'熟练双手',description:'永久基地AP上限+1。',price:6,requires:['knowledge'],modifiers:{baseAp:1}},
 endurance:{name:'深海耐性',description:'永久精神上限+10。',price:4,requires:['knowledge'],modifiers:{sanityMax:10}},
 spear:{name:'长矛工艺',description:'解锁矛架制造。',price:5,requires:['craft']}
};
