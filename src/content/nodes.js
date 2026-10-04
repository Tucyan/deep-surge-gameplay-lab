export const MONSTERS={
 biter:{name:'啃筏者',hp:5,damage:2,intent:'咬击：生命−2。'},
 jelly:{name:'胶膜水母',hp:6,damage:1,intent:'刺击：生命−1，并施加中毒。',buff:'poisoned'},
 crab:{name:'绝壳蟹',hp:8,damage:3,intent:'重击：生命−3。'},
 sentinel:{name:'遗迹守卫',hp:10,damage:3,intent:'回响：生命−3，并施加畏惧。',buff:'fearful'},
 boss:{name:'涌潮之眼',hp:18,damage:3,intent:'潮蚀：生命−3；隔回合污染手牌。',buff:'fearful',pollution:true}
};
const option=(id,name,description,effects=[],extra={})=>({id,name,description,effects,cost:0,...extra});
export const NODES={
 drift:{id:'drift',name:'漂浮物带',kind:'supply',description:'缆绳上挂着旧船的残片。选择一组材料。',options:[option('wood','打捞木料','获得木头×2、塑料×1。',[{type:'GiveCard',id:'wood',amount:2},{type:'GiveCard',id:'plastic',amount:1}]),option('metal','打捞金属','获得废铁、绳索、布条各1。',[{type:'GiveCard',id:'iron'},{type:'GiveCard',id:'rope'},{type:'GiveCard',id:'cloth'}]),option('leave','平稳驶过','不额外获得材料。')]},
 camp:{id:'camp',name:'灯火休整地',kind:'rest',description:'守灯人邀请你靠岸。选择一种休整。',options:[option('rest','灯下休息','四项生存数值各恢复40；获得休整余裕。',[...['hp','hunger','hydration','sanity'].map(stat=>({type:'ChangeCurrent',stat,delta:40})),{type:'AddBuff',id:'rested'}]),option('upgrade','免费升级设备','选择一件已安装设备，免费升一级。',[],{special:'upgrade'}),option('enchant','附魔手牌','选择一张非污染牌，赋予回牌或瞬发。',[],{special:'enchant'}),option('leave','继续航行','不获得休整效果。')]},
 trader:{id:'trader',name:'海怪商人',kind:'shop',description:'商人用触腕敲击货箱。贝币或尸体皆可交易。',options:[option('leave','离开商店','保留货币，继续航行。')]},
 jelly:{id:'jelly',name:'水母转换者',kind:'exchange',description:'水母吞吐着陌生的记忆。你可以交换一张牌或献血。',options:[option('card','喂给它一张牌','选择一张资源牌，随机换成另一张资源牌。',[],{special:'exchange'}),option('blood','献出5点生命','50%获得普通藏品，否则无所得。',[],{special:'blood'}),option('leave','保持距离','不付出代价。')]},
 storm:{id:'storm',name:'裂潮风暴',kind:'environment',description:'浪头从筏边撕开一条缝。',options:[option('risk','深入打捞','外围一格受损；获得木头×3、废铁×2。',[{type:'DamageCell'},{type:'GiveCard',id:'wood',amount:3},{type:'GiveCard',id:'iron',amount:2}]),option('leave','绕过浪头','不受额外损伤。')]},
 battle:{id:'battle',name:'捕食者水域',kind:'battle',description:'水下传来咬合声。战胜敌人获得尸体、贝币与经验。',monster:'biter'},
 jellyBattle:{id:'jellyBattle',name:'水母幽光',kind:'battle',description:'透明的伞盖遮住航线。',monster:'jelly'},
 crabBattle:{id:'crabBattle',name:'硬壳暗礁',kind:'battle',description:'一只绝壳蟹盘踞在暗礁上。',monster:'crab'},
 ruin:{id:'ruin',name:'沉没遗迹',kind:'ruin',description:'困难战斗；胜利50%获得藏品，50%获得日记。败退恢复进入时生命。',monster:'sentinel'},
 boss:{id:'boss',name:'层底：涌潮之眼',kind:'battle',description:'本层最后的阻拦。Boss会污染手牌。',monster:'boss',boss:true}
};
export const SHOP=[{id:'filter',name:'滤水器牌',price:3,card:'filter'},{id:'planter',name:'土盆牌',price:3,card:'planter'},{id:'lamp',name:'灯牌',price:2,card:'lamp'},{id:'crossbow',name:'弓弩牌',price:4,card:'crossbow'},{id:'guardian',name:'守潮骨片',price:4,relic:'guardian'},{id:'luckyShell',name:'回声贝壳',price:5,relic:'luckyShell'}];
export const DIARIES=[{id:'diary1',name:'前人的日记：灯',description:'“灯不是为了照亮海，而是提醒我们还在船上。”'},{id:'diary2',name:'前人的日记：回声',description:'“我听见歌声时，记得没有回头。”'},{id:'diary3',name:'前人的日记：潮眼',description:'“渡过最后的眼，记忆便会找到归处。”'}];
export const ENDINGS={withdrawn:{name:'离开潮眼',description:'你未击败潮眼，带着已完成的航程退回岸边。'},survived:{name:'灯火未熄',description:'你击退潮眼，带着漂流的记忆抵达彼岸。'},true:{name:'真结局：回声归航',description:'塞壬的珍珠守住记忆，前人的日记指引你驶向潮汐之外。'},dead:{name:'沉入深潮',description:'生命消逝，海仍记得这一段航行。'},mad:{name:'迷失潮声',description:'精神归零，你成为歌声的一部分。'},abandon:{name:'返回岸边',description:'你结束了这次探索，带回已经走过的航程。'}};

