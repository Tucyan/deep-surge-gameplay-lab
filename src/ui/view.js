import {CARDS} from '../content/index.js';

export function nodeOptionCost(view,option){
 const parts=[`${option.cost||0} AP`],missing=[];
 for(const [id,amount] of Object.entries(option.cardCosts||{})){
  const held=(view.hand||[]).filter(c=>c.definitionId===id).reduce((n,c)=>n+c.quantity,0);
  parts.push(`${CARDS[id].name} ×${amount}（持有${held}）`);
  if(held<amount)missing.push(`${CARDS[id].name} ×${amount-held}`);
 }
 const reason=view.phase!=='action'?'仅节点行动阶段':view.ap<(option.cost||0)?'AP不足':missing.length?'缺少'+missing.join('、'):'';
 return {canChoose:!reason,reason,summary:parts.join(' · ')};
}

export function treatmentCost(view,unit){
 if(unit?.definitionId!=='medkit')return {canChoose:false,reason:'选择包扎包',summary:'1 AP'};
 const fee=nodeOptionCost(view,{cost:1,cardCosts:unit.activationCosts});
 if(view.current.hp>=view.stats.hpMax)return {...fee,canChoose:false,reason:'生命已满'};
 return fee;
}

// Groups and entries are already newest-first in the core event history.
export function newestVoyageLogs(log = []) {
  return [...log].sort((a,b)=>b.voyage-a.voyage).map(v=>({
    ...v,
    groups:[...(v.groups || [])].map(g=>({...g,entries:[...(g.entries || [])]})),
  }));
}

export function parseSeed(value) {
  if(String(value).trim()==='') return null;
  const seed=Number(value);
  return Number.isInteger(seed) && seed>=0 && seed<=4294967295 ? seed : null;
}

export function canConfirmDiscard(view) {
  return ['discard','battleDiscard'].includes(view.phase) && (view.excess || 0)<=0;
}

export function canPurchase(view,item,payment) {
  if(view.phase!=='action' || view.node?.kind!=='shop' || view.node.resolved)return false;
  const count=(view.hand || []).filter(c=>c.definitionId===payment).reduce((sum,c)=>sum+c.quantity,0);
  return count >= (payment==='corpse'?Math.ceil(item.price/2):item.price);
}
