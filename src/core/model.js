import {CONFIG,ORIGINS,RELICS,BUFFS,META_SHOP,TECH,CARDS} from '../content/index.js';
export const clone=value=>structuredClone(value);
export const createProfile=()=>({points:0,purchases:{},pending:{},tech:[],rareRelics:[],discovered:{cards:[],relics:[],monsters:[],diaries:[],endings:[]},completedNodes:0,runs:0,legacyCards:[]});
export function discover(profile,kind,id){if(!profile.discovered[kind].includes(id))profile.discovered[kind].push(id);}
export function random(state){let x=state.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;state.rng=x>>>0;return state.rng/4294967296;}
export const pick=(state,list)=>list[Math.floor(random(state)*list.length)];
export function sources(state,profile){
 const result=[];
 if(state&&ORIGINS[state.originId])result.push({source:'出身',name:ORIGINS[state.originId].name,...ORIGINS[state.originId]});
 for(const [id,count] of Object.entries(profile.purchases))if(META_SHOP[id]?.modifiers)result.push({...META_SHOP[id],source:'局外商店',multiplier:count});
 for(const id of profile.tech)if(TECH[id])result.push({...TECH[id],source:'科技树'});
 const relics=new Set([...(state?.relicIds||[]),...profile.rareRelics]);
 for(const id of relics)if(RELICS[id])result.push({...RELICS[id],source:'藏品'});
 for(const b of state?.buffs||[])if(!BUFFS[b.definitionId].environment||b.activeFrom<=state.voyage)result.push({...BUFFS[b.definitionId],source:'增减益',multiplier:b.stacks});
 return result;
}
export function stat(state,profile,key){
 const base=(state?.base||CONFIG.base)[key]+(state?.bonuses?.[key]||0);
 const value=sources(state,profile).reduce((sum,src)=>sum+(src.modifiers?.[key]||0)*(src.multiplier||1),base);
 return Math.max(key==='damage'? -10:1,value);
}
export function capacity(state){
 let count=0;const groups=new Map();
 for(const card of state.hand){
  if(card.definitionId==='coin'){groups.set('coin',1);continue;}
  const limit=card.stackLimit||1;
  if(limit>1){const key=card.definitionId+':'+JSON.stringify(card.enchant)+':'+limit;groups.set(key,(groups.get(key)||0)+card.quantity/limit);}
  else count+=card.quantity;
 }
 return count+[...groups.values()].reduce((sum,n)=>sum+Math.ceil(n-1e-9),0);
}
export function activeEquipment(state){return state.cells.filter(c=>c.state==='intact'&&c.equipment).map(c=>({...c.equipment,cellId:c.id}));}
export function enrichedCard(card){const def=CARDS[card.definitionId];return {...card,...def,cost:card.definitionId==='pollution'?def.cost:(card.enchant.includes('instant')?0:def.cost)};}
