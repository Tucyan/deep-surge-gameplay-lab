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
