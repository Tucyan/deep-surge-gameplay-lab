// Pure editing transitions shared by record creation and field changes.
export const CARD_FIELDS={resource:['fuel'],currency:[],survival:['effects','traits'],combat:['damage','effects','traits'],negative:['heldEffects','effects'],equipment:[],action:['targetOperation','effects','traits']};
export function normalizeCard(card,kind=card.kind){
 const next=structuredClone(card);next.kind=kind;
 for(const key of Object.keys(next))if(!['id','name','description','kind','cost'].includes(key)&&!(CARD_FIELDS[kind]||[]).includes(key))delete next[key];
 if(['resource','currency'].includes(kind))next.cost=0;
 if(kind==='combat'&&next.damage===undefined)next.damage=0;
 if(kind==='action'&&next.targetOperation)delete next.effects;
 return next;
}
export function setTargetOperation(card,operation){const next={...structuredClone(card),targetOperation:operation};return normalizeCard(next);}
export function prepareRecord(table,record,{copy=false,nextOptionId=()=>'',id}={}){
 let next=structuredClone(record);
 if(copy)next.name+='（副本）';
 if(table==='CARDS')next=normalizeCard(next,copy&&next.kind==='currency'?'resource':next.kind);
 if(table==='NODES'&&copy){delete next.boss;next.options?.forEach(o=>{o.id=nextOptionId();});next.variants?.forEach(v=>{v.id=nextOptionId();v.options?.forEach(o=>{o.id=nextOptionId();});});}
 if(table==='EQUIPMENT'){
  delete next.fuel;delete next.healing;delete next.activationCosts;
  if(!next.output&&!next.battleOutput)Object.assign(next,{output:'water',intervals:[2,1,1],amounts:[1,1,2]});
 }
 if(Object.hasOwn(next,'id')&&id)next.id=id;
 return next;
}
export function equipmentCard(equipment){return {name:equipment.name,description:equipment.description,kind:'equipment',cost:1};}
export function copyEquipmentById(content,sourceId,id){
 const card=content.CARDS[sourceId],equipment=content.EQUIPMENT[sourceId];
 if(!card||card.kind!=='equipment'||!equipment)throw new Error('设备卡缺少同编号设备定义，请先修正配套内容。');
 return {card:prepareRecord('CARDS',card,{copy:true,id}),equipment:prepareRecord('EQUIPMENT',equipment,{copy:true,id})};
}
