import {CONFIG} from '../content/index.js';
import {random} from './model.js';

export const layerDefinition=s=>CONFIG.layers[s.layerIndex];
export const layerBoss=s=>layerDefinition(s).bossNodeId;
export const isLayerEnd=s=>s.layerVoyage===s.length;

export function initializeLayers(s){
 s.layers=CONFIG.layers.map(def=>{const min=def.minVoyages??CONFIG.minVoyages,max=def.maxVoyages??CONFIG.maxVoyages;return {definitionId:def.id,length:min+Math.floor(random(s)*(max-min+1)),completed:false};});
 selectLayer(s,0);
}
export function selectLayer(s,index){
 s.layerIndex=index;s.layerVoyage=1;s.length=s.layers[index].length;
 s.nodeVisits={};s.lastNodeId=null;s.flags.bossDefeated=false;
 for(const key of ['heading','protect'])if(s.relicUsage?.[key])s.relicUsage[key]={remaining:2,layerIndex:index};
}
export function validateLayers(s){
 if(!Array.isArray(s.layers)||s.layers.length!==CONFIG.layers.length||!Number.isSafeInteger(s.layerIndex)||s.layerIndex<0||s.layerIndex>=s.layers.length)throw new Error('层进度存档损坏');
 for(let i=0;i<s.layers.length;i++){const layer=s.layers[i],def=CONFIG.layers[i],min=def.minVoyages??CONFIG.minVoyages,max=def.maxVoyages??CONFIG.maxVoyages;if(layer.definitionId!==def.id||!Number.isSafeInteger(layer.length)||layer.length<min||layer.length>max||typeof layer.completed!=='boolean'||(i<s.layerIndex&&!layer.completed))throw new Error('层定义存档损坏');}
 if(s.length!==s.layers[s.layerIndex].length||!Number.isSafeInteger(s.layerVoyage)||s.layerVoyage<1||s.layerVoyage>s.length)throw new Error('层航次存档损坏');
 const expected=s.layers.slice(0,s.layerIndex).reduce((sum,l)=>sum+l.length,0)+s.layerVoyage;
 if(s.voyage!==expected)throw new Error('全局航次与层进度不一致');
}
