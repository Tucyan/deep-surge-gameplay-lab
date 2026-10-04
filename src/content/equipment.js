export const EQUIPMENT={
 lamp:{name:'灯',description:'燃烧时抵消精神耗损；燃料越多燃烧越久。',fuel:true},
 filter:{name:'滤水器',description:'自动生产淡水。',output:'water',intervals:[2,1,1],amounts:[1,1,2]},
 planter:{name:'土盆',description:'自动生产食用植物。',output:'food',intervals:[2,1,1],amounts:[1,1,2]},
 medkit:{name:'包扎包',description:'主动治疗；1 AP。',healing:[6,9,12]},
 crossbow:{name:'弓弩',description:'战斗每回合产箭；升级增加堆叠容量。',battleOutput:'arrow'},
 spearRack:{name:'矛架',description:'战斗每回合产矛；升级提高伤害。',battleOutput:'spear'}
};
const recipe=(id,name,ingredients,output)=>({id,name,ingredients,output,cost:1,tool:'handtool'});
export const RECIPES={
 lamp:recipe('lamp','制造灯',{wood:1,iron:1},'lamp'),
 filter:recipe('filter','制造滤水器',{plastic:2,wood:1},'filter'),
 planter:recipe('planter','制造土盆',{plastic:1,wood:1},'planter'),
 medkit:recipe('medkit','制造包扎包',{cloth:2,wood:1},'medkit'),
 crossbow:recipe('crossbow','制造弓弩',{iron:1,rope:1,wood:1},'crossbow'),
 spearRack:recipe('spearRack','制造矛架',{wood:2,iron:1},'spearRack'),
 dismantle:recipe('dismantle','制造拆除牌',{wood:1,iron:1},'dismantle'),
 repair:recipe('repair','制造修补包',{wood:1,iron:1},'repair')
};
