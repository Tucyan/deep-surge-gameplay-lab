import {CARDS} from '../content/index.js';

export function nodeOptionCost(view,option,protectedCardId=null){
 const supplied=view.node?.optionStatus?.[option.id];
 if(option.randomCardCost&&protectedCardId){
  const pool=view.node?.sacrificeCandidates || [],units=pool.reduce((sum,c)=>sum+(c.quantity||1),0),protectedUnit=pool.some(c=>c.instanceId===protectedCardId)?1:0;
  if(units-protectedUnit-Object.entries(option.cardCosts||{}).reduce((n,[id,amount])=>n+(pool.some(c=>c.definitionId===id)?amount:0),0)<option.randomCardCost)return {canChoose:false,reason:'保护一份后，剩余合格手牌不足支付',summary:supplied?.summary || `随机失去 ${option.randomCardCost} 份合格手牌`};
 }
 if(supplied)return supplied;
 const parts=[`${option.cost||0} AP`],missing=[];
 for(const [id,amount] of Object.entries(option.cardCosts||{})){
  const held=(view.hand||[]).filter(c=>c.definitionId===id).reduce((n,c)=>n+c.quantity,0);
  parts.push(`${CARDS[id]?.name || id} ×${amount}（持有${held}）`);
  if(held<amount)missing.push(`${CARDS[id]?.name || id} ×${amount-held}`);
 }
 for(const [id,amount] of Object.entries(option.statCosts||{})){
  const label={hp:'生命',sanity:'理智',hunger:'饱食',hydration:'水分'}[id]||id,held=view.current?.[id]||0;
  parts.push(`${label} −${amount}（${held} → ${held-amount}）`);
  if(held<=amount)missing.push(`${label}支付后至少剩1`);
 }
 if(option.randomCardCost)parts.push(`随机失去 ${option.randomCardCost} 份合格手牌`);
 if(option.detachCell)parts.push('立即脱落一个外围筏格，设备一并损失');
 if(option.probability!=null)parts.push(`成功概率 ${Math.round(option.probability*100)}%`);
 const reason=view.phase!=='action'?'仅节点行动阶段':view.ap<(option.cost||0)?'AP不足':missing.length?'缺少'+missing.join('、'):'';
 return {canChoose:!reason,reason,summary:parts.join(' · ')};
}

export function currentNodeOption(view,id,fallback){return view.node?.options?.find(o=>o.id===id) || fallback?.options?.find(o=>o.id===id);}

export function candidatePresentation(candidate){
 const visibility=candidate.visibility || 'full';
 const base={id:candidate.id,name:candidate.name,kind:candidate.kind,description:candidate.description || '',opportunitySummary:candidate.opportunitySummary || '',options:candidate.options || []};
 if(visibility==='unknown')return {...base,name:'未知停靠点',kind:'unknown',description:'到达后完整揭示，可能发生战斗。',opportunitySummary:'',options:[]};
 if(visibility==='typeOnly')return {...base,name:'未辨认停靠点',description:'迷雾遮蔽具体遭遇，到达后完整揭示。',opportunitySummary:'',options:[]};
 if(visibility==='detailsHidden')return {...base,description:'迷雾遮蔽选项、费用与奖励详情，到达后完整揭示。',opportunitySummary:'',options:[]};
 return base;
}

export function layerProgress(view){
 const layer=view.layers?.[view.layerIndex || 0],name=view.layer?.name||layer?.name,label='第'+((view.layerIndex||0)+1)+'层';
 return `第 ${(view.layerIndex || 0)+1} 层${name&&name.replace(/\s/g,'')!==label?' · '+name:''} · ${view.layerVoyage ?? view.voyage ?? 0} / ${layer?.length ?? view.length ?? '—'} 站 · 总航行 ${view.voyage || 0}`;
}

export function navigationActionStatus(view,action,method){
 const supplied=view.navigationActions?.[action]?.[method];if(supplied)return supplied;
 const relic=action==='scout'?'tideLens':'headingNeedle',usage=view.relicUsage?.[action==='scout'?'scout':'heading'] || view.relicUsage?.[relic];
 let reason=view.phase!=='navigation'?'仅导航阶段':method==='sanity'&&(view.current?.sanity||0)<=8?'支付8理智后至少剩1':method==='wood'&&!(view.hand||[]).some(c=>c.definitionId==='wood'&&c.quantity>0)?'缺少木头':method==='relic'&&(!(view.relics||[]).some(r=>r.id===relic)||(usage?.charges ?? usage?.remaining ?? 0)<=0)?'藏品机会不足':'';
 return {canChoose:!reason,reason,summary:method==='sanity'?'理智 −8':method==='wood'?'木头 ×1':'消耗1次藏品机会'};
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
  return view.phase==='discard' && (view.excess || 0)<=0;
}

export function canUseProfileActions(view){return ['home','finished'].includes(view.phase);}

export function purchaseStatus(view,item,payment) {
  const currency=payment==='corpse'?'怪物尸体':'贝币';
  const cost=payment==='corpse'?Math.ceil(item.price/2):item.price;
  const count=(view.hand || []).filter(c=>c.definitionId===payment).reduce((sum,c)=>sum+c.quantity,0);
  const reason=!['coin','corpse'].includes(payment)?'请选择支付方式':view.phase!=='action'||view.node?.kind!=='shop'||view.node.resolved?'商店交易已关闭':item.relic&&(view.relics||[]).some(r=>r.id===item.relic)?'已拥有，不能重复购买':count<cost?`${currency}不足，还差 ${cost-count}`:'';
  return {canBuy:!reason,reason,currency,cost,held:count};
}

export function canPurchase(view,item,payment){return purchaseStatus(view,item,payment).canBuy;}
