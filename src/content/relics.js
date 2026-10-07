export const RELICS={
 emberWick:{name:'余烬灯芯',rarity:'normal',mechanic:'ember',description:'每航行燃灯结算额外恢复SAN 5；至少一盏完好灯实际燃烧时触发，多灯只触发一次。'},
 tideLens:{name:'潮纹镜片',rarity:'normal',mechanic:'scout',description:'获得时免费侦察一次；使用后两次完整航行恢复，最多存一次，揭示一个迷雾候选。'},
 headingNeedle:{name:'定向骨针',rarity:'normal',mechanic:'heading',description:'每层两次，导航时主动使用，使本次航行免于混乱偏航。'},
 mendingNeedle:{name:'缝潮针',rarity:'normal',mechanic:'repair',description:'每航行第一次直接修理筏格少耗1木头，仍需AP；不减扩建或修补包制造费用。'},
 namedKnot:{name:'记名绳结',rarity:'normal',mechanic:'protect',description:'每层两次，在事件随机失牌前保护一个合格卡单位；仍须足额支付其他单位。'},
 scavengerRing:{name:'拾荒者指环',rarity:'normal',mechanic:'salvage',description:'每轮事件累计实际消耗3份非货币手牌后获得1份随机基础资源，每轮一次；不计制造、燃灯、交易和弃牌。'},
 emptyCompass:{name:'空腹罗盘',rarity:'normal',mechanic:'lightHand',description:'轮末航耗前手牌容量不超过5时，食水航耗各减少5；后续生产与弃牌不改变判定。'},
 deepContract:{name:'深潮契印',rarity:'normal',mechanic:'contract',drawback:true,description:'自愿支付SAN并完成事件后获得1贝币，每轮一次；基础SAN航耗额外增加5。导航侦察不触发。'},
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
