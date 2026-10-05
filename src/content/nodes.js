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
 camp:{id:'camp',name:'灯火休整地',kind:'rest',description:'守灯人提供场地与手艺，来客需自备材料。',options:[
  option('rest','包扎补给休整','投入布条×2和1 AP；生命+15，饱食、水分、精神各+40，获得休整余裕。',[...['hp','hunger','hydration','sanity'].map(stat=>({type:'ChangeCurrent',stat,delta:stat==='hp'?15:40})),{type:'AddBuff',id:'rested'}],{cost:1,cardCosts:{cloth:2}}),
  option('upgrade','委托升级设备','投入废铁×2、绳索×1和1 AP，选择已安装设备升一级。',[],{special:'upgrade',cost:1,cardCosts:{iron:2,rope:1}}),
  option('enchant','供奉附魔手牌','投入布条×2、怪物尸体×1和1 AP，选择战斗、生存或行动牌赋予回牌或瞬发。',[],{special:'enchant',cost:1,cardCosts:{cloth:2,corpse:1}}),
  option('leave','继续航行','不投入物资，也不获得休整效果。')
 ]},
 trader:{id:'trader',name:'海怪商人',kind:'shop',description:'商人用触腕敲击货箱。贝币或尸体皆可交易。',options:[option('leave','离开商店','保留货币，继续航行。')]},
 jelly:{id:'jelly',name:'水母转换者',kind:'exchange',description:'水母需要过滤材料作为交换媒介，或用布条收取献血。',options:[
  option('card','投入媒介转换资源','投入塑料、布条各1和1 AP，再选择剩余的一张基础资源牌，随机换成另一种基础资源。',[],{special:'exchange',cost:1,cardCosts:{plastic:1,cloth:1}}),
  option('blood','包扎后献出5点生命','投入布条×1并损失5生命；50%获得普通藏品，否则无所得。',[],{special:'blood',cardCosts:{cloth:1}}),
  option('leave','保持距离','不付出代价，也无所得。')
 ]},
 storm:{id:'storm',name:'裂潮风暴',kind:'environment',description:'散落的货物正沉入浪底，回收需要消耗固定物资。',options:[
  option('risk','系绳深入打捞','投入绳索、木头各1和1 AP；外围一格受损，获得木头×1、废铁×2。',[{type:'DamageCell'},{type:'GiveCard',id:'wood'},{type:'GiveCard',id:'iron',amount:2}],{cost:1,cardCosts:{rope:1,wood:1}}),
  option('secure','搭浮架回收补给','投入废铁、绳索、布条各1和1 AP；无额外筏损，获得淡水、食物各1，精神恢复20。',[{type:'GiveCard',id:'water'},{type:'GiveCard',id:'food'},{type:'ChangeCurrent',stat:'sanity',delta:20}],{cost:1,cardCosts:{iron:1,rope:1,cloth:1}}),
  option('leave','绕过浪头','不受额外损伤，也不获得奖励。')
 ]},
 battle:{id:'battle',name:'捕食者水域',kind:'battle',description:'水下传来咬合声。战胜敌人获得尸体、贝币与经验。',monster:'biter'},
 jellyBattle:{id:'jellyBattle',name:'水母幽光',kind:'battle',description:'透明的伞盖遮住航线。',monster:'jelly'},
 crabBattle:{id:'crabBattle',name:'硬壳暗礁',kind:'battle',description:'一只绝壳蟹盘踞在暗礁上。',monster:'crab'},
 ruin:{id:'ruin',name:'沉没遗迹',kind:'ruin',description:'困难战斗；胜利50%获得藏品，50%获得日记。败退恢复进入时生命。',monster:'sentinel'},
 boss:{id:'boss',name:'层底：涌潮之眼',kind:'battle',description:'本层最后的阻拦。Boss会污染手牌。',monster:'boss',boss:true}
};
export const SHOP=[{id:'filter',name:'滤水器牌',price:3,card:'filter'},{id:'planter',name:'土盆牌',price:3,card:'planter'},{id:'lamp',name:'灯牌',price:2,card:'lamp'},{id:'crossbow',name:'弓弩牌',price:4,card:'crossbow'},{id:'guardian',name:'守潮骨片',price:4,relic:'guardian'},{id:'luckyShell',name:'回声贝壳',price:5,relic:'luckyShell'}];
export const DIARIES=[{id:'diary1',name:'前人的日记：灯',description:'“灯不是为了照亮海，而是提醒我们还在船上。”'},{id:'diary2',name:'前人的日记：回声',description:'“我听见歌声时，记得没有回头。”'},{id:'diary3',name:'前人的日记：潮眼',description:'“渡过最后的眼，记忆便会找到归处。”'}];
export const ENDINGS={withdrawn:{name:'离开潮眼',description:'你未击败潮眼，带着已完成的航程退回岸边。'},survived:{name:'灯火未熄',description:'你击退潮眼，带着漂流的记忆抵达彼岸。'},true:{name:'真结局：回声归航',description:'塞壬的珍珠守住记忆，前人的日记指引你驶向潮汐之外。'},dead:{name:'沉入深潮',description:'生命消逝，海仍记得这一段航行。'},mad:{name:'迷失潮声',description:'精神归零，你成为歌声的一部分。'},abandon:{name:'返回岸边',description:'你结束了这次探索，带回已经走过的航程。'}};

