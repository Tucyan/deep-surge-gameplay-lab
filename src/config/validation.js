import * as defaults from '../content/index.js';
const native = structuredClone(Object.fromEntries(Object.entries(defaults)));
const n=(min=0,max=10000)=>({type:'number',min,max,integer:true});
const text={type:'string'}, bool={type:'boolean'};
const pick=(...values)=>({type:'enum',values});
const ref=table=>({type:'ref',table});
const list=item=>({type:'array',item});
const obj=fields=>({type:'object',fields});
export const MODIFIERS=obj(Object.fromEntries(['hpMax','hungerMax','hydrationMax','sanityMax','baseAp','battleAp','handLimit','damage'].map(k=>[k,n(-1000,1000)])));
export const EFFECT={type:'effect'};
const common={name:text,description:text};
export const OPTION=obj({id:text,...common,cost:n(),cardCosts:{type:'ingredients'},special:pick('upgrade','enchant','exchange','blood'),effects:list(EFFECT)});
export const SCHEMAS={
 CARDS:obj({...common,kind:pick('resource','currency','survival','combat','negative','equipment','action'),cost:n(),fuel:n(1),damage:n(),traits:list(pick('return')),targetOperation:pick('dismantle','repair'),effects:list(EFFECT),heldEffects:list(EFFECT)}),
 EQUIPMENT:obj({...common,fuel:bool,output:ref('CARDS'),intervals:list(n(1)),amounts:list(n(1)),healing:list(n(1)),activationCosts:{type:'ingredients'},battleOutput:ref('CARDS')}),
 RECIPES:obj({id:text,name:text,ingredients:{type:'ingredients'},output:ref('CARDS'),cost:n(),tool:pick('handtool')}),
 ORIGINS:obj({...common,modifiers:MODIFIERS,reduceSanityLoss:n(),retreatReduction:n(),enemyBuffImmune:bool}),
 BUFFS:obj({...common,polarity:pick('positive','negative'),clock:pick('battle','voyage'),duration:n(1),stacking:pick('refresh','stack'),modifiers:MODIFIERS,tick:list(EFFECT)}),
 RELICS:obj({...common,rarity:pick('normal','rare'),modifiers:MODIFIERS,returnChance:{type:'number',min:0,max:1},protectSanity:bool,trueEndingEligible:bool,unlock:obj({nodes:n(1),endings:n(1)})}),
 META_SHOP:obj({...common,price:n(1),maxPurchases:n(1),modifiers:MODIFIERS}),
 TECH:obj({...common,price:n(1),requires:list(ref('TECH')),modifiers:MODIFIERS}),
 NODES:obj({id:text,...common,kind:pick('supply','rest','shop','exchange','environment','battle','ruin'),options:list(OPTION),monster:ref('MONSTERS'),boss:bool}),
 MONSTERS:obj({name:text,hp:n(1),damage:n(),intent:text,buff:ref('BUFFS'),pollution:bool}),
 SHOP:obj({id:text,name:text,price:n(1),card:ref('CARDS'),relic:ref('RELICS')}),
 DIARIES:obj({id:text,...common}),ENDINGS:obj(common),
 CONFIG:obj({schema:{type:'fixed',value:1},contentVersion:{type:'fixed',value:defaults.CONFIG.contentVersion},randomVersion:{type:'fixed',value:defaults.CONFIG.randomVersion},minVoyages:n(1,100),maxVoyages:n(1,100),nodePoolMultiplier:n(1,10),initial:obj(Object.fromEntries(['hp','hunger','hydration','sanity'].map(k=>[k,n(1)]))),base:obj(Object.fromEntries(['hpMax','hungerMax','hydrationMax','sanityMax','baseAp','battleAp','handLimit','damage'].map(k=>[k,n(k==='damage'?0:1)]))),upgradeCost:n(),upgradeMax:{type:'fixed',value:3},restRecovery:n(),retreatDamage:n(),xpPerLevel:n(1),bossXp:n(),battleXp:n()}),
 SURVIVAL:obj({hungerDamage:n(),hydrationDamage:n(),maxDamage:n()}),SPRING_POOL:list(ref('CARDS')),VOYAGE_EFFECTS:list(EFFECT),VOYAGE_STEPS:{type:'fixed',value:defaults.VOYAGE_STEPS}
};
export const EFFECT_SCHEMAS={ChangeCurrent:obj({type:pick('ChangeCurrent'),stat:pick('hp','hunger','hydration','sanity'),delta:n(-1000,1000),reason:text}),GiveCard:obj({type:pick('GiveCard'),id:ref('CARDS'),amount:n(1,100)}),AddBuff:obj({type:pick('AddBuff'),id:ref('BUFFS'),reason:text}),GrantRelic:obj({type:pick('GrantRelic'),id:ref('RELICS')}),SetFlag:obj({type:pick('SetFlag'),key:text,value:{type:'primitive'}}),DamageCell:obj({type:pick('DamageCell')})};
SCHEMAS.CONFIG.fields.restRecovery={type:'fixed',value:native.CONFIG.restRecovery};
const required={CARDS:['name','kind','cost','description'],EQUIPMENT:['name','description'],RECIPES:['id','name','ingredients','output','cost','tool'],ORIGINS:['name','description'],BUFFS:['name','description','polarity','clock','duration','stacking'],RELICS:['name','description','rarity'],META_SHOP:['name','description','price','maxPurchases'],TECH:['name','description','price','requires'],NODES:['id','name','description','kind'],MONSTERS:['name','hp','damage','intent'],SHOP:['id','name','price'],DIARIES:['id','name','description'],ENDINGS:['name','description']};
export function validateConfig(config){
 const errors=[],warnings=[];const add=(path,message,suggestion='请在对应表单中修正后重试。')=>errors.push({path,message,suggestion});
 const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 if(!plain(config))return {ok:false,errors:[{path:'',message:'配置应为完整内容对象',suggestion:'导入编辑器导出的配置文件。'}],warnings};
 for(const k of Object.keys(config))if(!['format','schema','content'].includes(k))add(k,'未知配置字段');
 if(config.format!=='deep-surge-content')add('format','文件格式不兼容');if(config.schema!==1)add('schema','配置版本不兼容');
 const c=config.content;if(!plain(c)){add('content','缺少内容表');return {ok:false,errors,warnings};}
 function visit(v,s,path){
  if(s.type==='fixed'){if(JSON.stringify(v)!==JSON.stringify(s.value))add(path,'此程序契约固定，不能修改');return;}
  if(s.type==='number'){if(typeof v!=='number'||!Number.isFinite(v)||s.integer&&!Number.isInteger(v)||v<s.min||v>s.max)add(path,`应为${s.integer?'整数':'数值'}，范围 ${s.min}～${s.max}`);return;}
  if(s.type==='string'){if(typeof v!=='string'||!v.trim()||v.length>3000)add(path,'请填写非空文字（最多3000字）');return;}
  if(s.type==='primitive'){if(!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v))add(path,'标记值应为文字、有限数值或布尔值');return;}
  if(s.type==='boolean'){if(typeof v!=='boolean')add(path,'应为开关值');return;}
  if(s.type==='enum'){if(!s.values.includes(v))add(path,'请选择程序支持的选项');return;}
  if(s.type==='ref'){if(typeof v!=='string'||!plain(c[s.table])||!Object.hasOwn(c[s.table],v))add(path,'引用的内容不存在','请选择对应内容表中已存在的条目。');return;}
  if(s.type==='array'){if(!Array.isArray(v)||v.length>300){add(path,'应为列表（最多300项）');return;}v.forEach((x,i)=>visit(x,s.item,path+'.'+i));return;}
  if(s.type==='effect'){if(!plain(v)||!Object.hasOwn(EFFECT_SCHEMAS,v.type)){add(path,'不支持这种效果','请选择六种现有效果之一。');return;}visit(v,EFFECT_SCHEMAS[v.type],path);for(const k of Object.keys(EFFECT_SCHEMAS[v.type].fields))if(!['reason','amount'].includes(k)&&!Object.hasOwn(v,k))add(path+'.'+k,'缺少效果参数');return;}
  if(!plain(v)){add(path,'应为字段对象');return;}
  if(s.type==='ingredients'){if(!Object.keys(v).length)add(path,'至少需要一种材料');for(const [k,x]of Object.entries(v)){visit(k,ref('CARDS'),path+'.'+k);visit(x,n(1,100),path+'.'+k);}return;}
  for(const [k,x]of Object.entries(v)){if(!Object.hasOwn(s.fields,k))add(path+'.'+k,'未知字段，程序不会执行此行为','移除此字段，使用编辑器提供的字段。');else visit(x,s.fields[k],path+'.'+k);}
 }
 for(const k of Object.keys(c))if(!Object.hasOwn(SCHEMAS,k))add('content.'+k,'未知内容表');
 for(const [table,s]of Object.entries(SCHEMAS)){
  const path='content.'+table;if(!Object.hasOwn(c,table)){add(path,'缺少必需内容表','从默认配置开始编辑。');continue;}
  if(['CONFIG','SURVIVAL','SPRING_POOL','VOYAGE_EFFECTS','VOYAGE_STEPS'].includes(table)){visit(c[table],s,path);if(['CONFIG','SURVIVAL'].includes(table)&&plain(c[table]))for(const k of Object.keys(s.fields))if(!Object.hasOwn(c[table],k))add(path+'.'+k,'缺少必需参数');continue;}
  const array=['SHOP','DIARIES'].includes(table),entries=array?(Array.isArray(c[table])?c[table].map((v,i)=>[i,v]):null):(plain(c[table])?Object.entries(c[table]):null);
  if(!entries){add(path,array?'应为条目列表':'应为内容表');continue;}if(!entries.length)add(path,'内容表不能为空');if(entries.length>300){add(path,'每类内容最多300个条目');continue;}
  const ids=new Set();for(const [id,v]of entries){const p=path+'.'+id;visit(v,s,p);if(!plain(v))continue;for(const field of required[table]||[])if(!Object.hasOwn(v,field))add(p+'.'+field,'缺少必需字段');
   const key=array?v.id:id;if(typeof key!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(key)||['__proto__','constructor','prototype'].includes(key))add(p,'内部编号格式无效');if(ids.has(key))add(p+'.id','内部编号重复');ids.add(key);
   if(!array&&v.id!==undefined&&v.id!==id)add(p+'.id','内部编号与条目编号不一致');
   if(table==='EQUIPMENT'){if(v.activationCosts){if(id!=='medkit')add(p+'.activationCosts','主动治疗耗材仅原生包扎包支持');for(const cardId of Object.keys(v.activationCosts))if(c.CARDS?.[cardId]?.kind!=='resource')add(p+'.activationCosts.'+cardId,'治疗耗材必须是基础资源');}if(c.CARDS?.[id]?.kind!=='equipment')add(p,'设备需要同编号的设备卡');if(v.output)for(const f of ['intervals','amounts'])if(!Array.isArray(v[f])||v[f].length!==3)add(p+'.'+f,'生产设备须填写完整的三级数值');for(const f of ['intervals','amounts','healing'])if(v[f]&&v[f].length!==3)add(p+'.'+f,'须填写三级数值');if(!v.output&&(v.intervals||v.amounts))add(p+'.output','填写生产数值时必须选择产物');if(id!=='lamp'&&v.fuel!==undefined)add(p+'.fuel','燃灯机制仅原生灯支持');if(id!=='medkit'&&v.healing)add(p+'.healing','主动治疗仅原生包扎包支持');if(id==='medkit'&&(!Array.isArray(v.healing)||v.healing.length!==3))add(p+'.healing','原生包扎包必须保留三级治疗量');}
   if(table==='CARDS'){if(native.CARDS[id]&&v.kind!==native.CARDS[id].kind)add(p+'.kind','原生卡牌类型属于程序契约，不能修改');if(v.kind==='equipment'&&!c.EQUIPMENT?.[id])add(p+'.kind','设备卡须有同编号设备定义');if(v.kind==='currency'&&id!=='coin')add(p+'.kind','货币机制仅原生贝币支持');if(v.targetOperation&&v.kind!=='action')add(p+'.targetOperation','目标操作仅行动牌支持');if(v.kind==='combat'&&v.damage===undefined)add(p+'.damage','战斗牌必须填写伤害');if(v.kind!=='combat'&&v.damage!==undefined)add(p+'.damage','直接伤害仅战斗牌支持');if((['resource','currency','equipment'].includes(v.kind)||v.kind==='action'&&v.targetOperation)&&v.effects?.length)add(p+'.effects','此卡牌类型不执行自定义出牌效果','请使用生存、战斗或普通行动牌设置效果。');if(v.kind==='equipment'&&v.traits?.length)add(p+'.traits','设备安装不执行回牌特性');}
   if(table==='NODES'){if(['battle','ruin'].includes(v.kind)&&!v.monster)add(p+'.monster','战斗节点必须选择怪物');if(!['battle','ruin'].includes(v.kind)&&(!Array.isArray(v.options)||!v.options.length))add(p+'.options','普通节点至少需要一个选项');if(v.boss&&id!=='boss')add(p+'.boss','层底机制仅原生层底节点支持');const opts=new Set();for(const [i,o]of (Array.isArray(v.options)?v.options:[]).entries()){for(const f of ['id','name','description','cost','effects'])if(!Object.hasOwn(o||{},f))add(p+'.options.'+i+'.'+f,'缺少选项字段');if(typeof o?.id!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(o.id))add(p+'.options.'+i+'.id','选项内部编号格式无效');if(opts.has(o?.id))add(p+'.options.'+i+'.id','选项编号重复');opts.add(o?.id);}}
   if(table==='NODES')for(const [i,o] of (Array.isArray(v.options)?v.options:[]).entries())for(const id of Object.keys(o?.cardCosts||{}))if(!['resource','survival','currency'].includes(c.CARDS?.[id]?.kind))add(p+'.options.'+i+'.cardCosts.'+id,'节点投入仅支持资源、生存牌或货币，不能清除污染或提交回牌攻击');
   if(table==='SHOP'&&Number(Boolean(v.card))+Number(Boolean(v.relic))!==1)add(p,'商品应且仅应选择一种卡牌或藏品');
   if(table==='EQUIPMENT'&&v.battleOutput&&c.CARDS?.[v.battleOutput]?.kind!=='combat')add(p+'.battleOutput','战斗补给必须选择战斗牌');
   if(table==='EQUIPMENT'&&id==='lamp'&&v.fuel!==true)add(p+'.fuel','原生灯的燃烧机制必须保留');
   if(table==='NODES'&&['battle','ruin'].includes(v.kind)&&Array.isArray(v.options)&&v.options.length)add(p+'.options','战斗节点不能设置不执行的选项','改为普通节点或移除选项字段。');
   if(table==='NODES'&&!['battle','ruin'].includes(v.kind)&&v.monster!==undefined)add(p+'.monster','普通节点不执行遭遇怪物');
   if(table==='CARDS'){
    const allowed={resource:['fuel'],currency:[],survival:['effects','traits'],combat:['damage','effects','traits'],negative:['heldEffects','effects'],equipment:[],action:['targetOperation','effects','traits']}[v.kind]||[];
    for(const key of Object.keys(v))if(!['id','name','kind','cost','description'].includes(key)&&!allowed.includes(key))add(p+'.'+key,'此卡牌类型不执行该字段','改用此类型支持的字段。');
    if(['resource','currency'].includes(v.kind)&&v.cost!==0)add(p+'.cost','物资卡费用固定为0，合成及交易另行收费');
   }
  }
 }
 // Native IDs are referenced directly by the rule core; removing them would break a run.
 for(const table of ['CARDS','EQUIPMENT','RECIPES','ORIGINS','BUFFS','RELICS','META_SHOP','TECH','NODES','MONSTERS','ENDINGS'])for(const id of Object.keys(native[table]))if(!c[table]||!Object.hasOwn(c[table],id))add('content.'+table+'.'+id,'程序保留条目不能删除','恢复此默认条目；可修改它的展示和受支持数值。');
 if(c.NODES?.boss?.kind!=='battle'||c.NODES?.boss?.boss!==true)add('content.NODES.boss','原生层底节点必须为层底战斗');
 if(c.NODES?.camp&&['battle','ruin'].includes(c.NODES.camp.kind))add('content.NODES.camp.kind','原生休整候选不能改为战斗');
 if(c.NODES?.drift&&['battle','ruin'].includes(c.NODES.drift.kind))add('content.NODES.drift.kind','原生补给候选不能改为战斗');
 if(!plain(c.RELICS)||!Object.values(c.RELICS).some(v=>v?.rarity==='normal'))add('content.RELICS','至少需要一种普通藏品');
 for(const container of ['initial','base'])if(plain(c.CONFIG?.[container]))for(const key of Object.keys(SCHEMAS.CONFIG.fields[container].fields))if(!Object.hasOwn(c.CONFIG[container],key))add('content.CONFIG.'+container+'.'+key,'缺少必需数值');
 if(c.CONFIG?.minVoyages>c.CONFIG?.maxVoyages)add('content.CONFIG.maxVoyages','最大航程不能小于最小航程');
 for(const stat of ['hp','hunger','hydration','sanity'])if(c.CONFIG?.initial?.[stat]>c.CONFIG?.base?.[stat+'Max'])add('content.CONFIG.initial.'+stat,'初始值不能超过对应基础上限');
 if(!Array.isArray(c.SPRING_POOL)||new Set(c.SPRING_POOL).size<2)add('content.SPRING_POOL','涌泉池至少需要两种不同卡牌');
 for(const id of Array.isArray(c.SPRING_POOL)?c.SPRING_POOL:[])if(c.CARDS?.[id]?.kind!=='resource')add('content.SPRING_POOL','涌泉池只能使用资源牌');
 const visiting=new Set(),done=new Set();function walk(id){if(visiting.has(id)){add('content.TECH.'+id+'.requires','科技前置出现循环依赖','移除循环中的一项前置。');return;}if(done.has(id))return;visiting.add(id);for(const next of Array.isArray(c.TECH?.[id]?.requires)?c.TECH[id].requires:[])if(c.TECH?.[next])walk(next);visiting.delete(id);done.add(id);}if(plain(c.TECH)&&Object.keys(c.TECH).length<=300)Object.keys(c.TECH).forEach(walk);
 return {ok:errors.length===0,errors,warnings};
}
export function parseConfig(text){let config;try{config=JSON.parse(text);}catch{const e=new Error('无法读取文件：请导入完整的配置 JSON 文件。');e.issues=[{path:'',message:e.message,suggestion:'使用编辑器导出的文件。'}];throw e;}const result=validateConfig(config);if(!result.ok){const e=new Error('配置存在错误，未导入。');e.issues=result.errors;throw e;}return config;}
