import {BUFFS,CONFIG} from '../content/index.js';
import {isLayerEnd} from './layers.js';
import {hasMechanic} from './relic-rules.js';

export const activeEnvironment=s=>s.buffs.filter(b=>BUFFS[b.definitionId]?.environment&&b.activeFrom<=s.voyage);
export const environmentAmount=(s,mechanic)=>activeEnvironment(s).filter(b=>BUFFS[b.definitionId].mechanic===mechanic).reduce((n,b)=>n+(BUFFS[b.definitionId].amount??1),0);
export const fogLevel=s=>Math.max(0,...activeEnvironment(s).filter(b=>BUFFS[b.definitionId].mechanic==='fog').map(b=>BUFFS[b.definitionId].fogLevel));
export const firstBaseActionExtra=s=>s.relicUsage.headwindVoyage===s.voyage?0:environmentAmount(s,'headwind');
export function spendBaseAction(ctx,cost){const extra=firstBaseActionExtra(ctx.s);ctx.spend(cost+extra);if(extra)ctx.s.relicUsage.headwindVoyage=ctx.s.voyage;}

function compatible(s,id){
 const def=BUFFS[id],env=s.buffs.filter(b=>BUFFS[b.definitionId]?.environment),conf=env.some(b=>BUFFS[b.definitionId].mechanic==='confusion'),fog3=env.some(b=>BUFFS[b.definitionId].fogLevel===3);
 return !(def.fogLevel===3&&conf||def.mechanic==='confusion'&&fog3);
}
export function canAddEnvironment(s,id){
 const def=BUFFS[id];if(!def?.environment||!compatible(s,id))return false;
 const env=s.buffs.filter(b=>BUFFS[b.definitionId]?.environment),same=env.find(b=>b.definitionId===id);
 if(same)return true;
 const oldFog=env.find(b=>BUFFS[b.definitionId].mechanic==='fog');
 if(def.mechanic==='fog'&&oldFog)return def.fogLevel>=BUFFS[oldFog.definitionId].fogLevel;
 return env.length<CONFIG.environment.maxActive&&(def.polarity!=='negative'||env.filter(b=>BUFFS[b.definitionId].polarity==='negative').length<CONFIG.environment.maxNegative);
}
export function addEnvironment(ctx,id,immediate=false){
 const {s}=ctx,def=BUFFS[id];ctx.require(canAddEnvironment(s,id),'环境状态不兼容或达到上限');
 if(def.mechanic==='fog')s.buffs=s.buffs.filter(b=>BUFFS[b.definitionId]?.mechanic!=='fog'||b.definitionId===id);
 const old=s.buffs.find(b=>b.definitionId===id);
 if(old){if(!immediate&&old.activeFrom<=s.voyage)old.pendingRefresh={voyage:s.voyage+1,remaining:def.duration};else{old.remaining=def.duration;old.activeFrom=immediate?s.voyage:s.voyage+1;delete old.pendingRefresh;}}else s.buffs.push({instanceId:ctx.id('environment'),definitionId:id,stacks:1,remaining:def.duration,clock:'voyage',source:'environment',appliedVoyage:s.voyage,appliedRound:0,activeFrom:immediate?s.voyage:s.voyage+1});
 ctx.log(def.name+'：'+(immediate?'本轮生效':'下一航行轮生效'),'海况');
}
export function rollEnvironment(ctx){
 for(const b of ctx.s.buffs)if(b.pendingRefresh?.voyage<=ctx.s.voyage){b.remaining=b.pendingRefresh.remaining;b.activeFrom=b.pendingRefresh.voyage;delete b.pendingRefresh;}
 const {s}=ctx;if(s.voyage===1||isLayerEnd(s))return;
 const config=CONFIG.environment;if(ctx.random()>=config.chance)return;
 const polarity=ctx.random()<config.negativeChance?'negative':'positive';
 const ids=Object.keys(config.weights).filter(id=>BUFFS[id]?.polarity===polarity&&config.weights[id]>0&&canAddEnvironment(s,id)).sort();
 if(!ids.length)return;
 let roll=ctx.random()*ids.reduce((n,id)=>n+config.weights[id],0);
 for(const id of ids){roll-=config.weights[id];if(roll<0){addEnvironment(ctx,id,true);break;}}
}
export function concealCandidate(ctx,node){
 const {s}=ctx,level=fogLevel(s);if(node.boss||s.guidance?.voyage===s.voyage&&s.guidance.reveal)return 'full';
 if(level===3)return 'unknown';if(level===2)return 'typeOnly';
 if(level===1){const fog=activeEnvironment(s).find(b=>BUFFS[b.definitionId].fogLevel===1);return ctx.random()<(BUFFS[fog.definitionId].chance??.35)?'detailsHidden':'full';}
 return 'full';
}
export function tickEnvironment(ctx){
 for(const b of [...activeEnvironment(ctx.s)]){b.remaining--;if(b.remaining<=0){if(b.pendingRefresh){b.remaining=b.pendingRefresh.remaining;b.activeFrom=b.pendingRefresh.voyage;delete b.pendingRefresh;}else{ctx.s.buffs=ctx.s.buffs.filter(x=>x.instanceId!==b.instanceId);ctx.log(BUFFS[b.definitionId].name+' 已结束','海况');}}}
}
export function confusionChance(s){
 if(isLayerEnd(s)||s.navigation.fixedHeading)return 0;
 const buff=activeEnvironment(s).find(b=>BUFFS[b.definitionId].mechanic==='confusion');
 return Math.max(0,(buff?BUFFS[buff.definitionId].chance??.25:0)-(s.guidance?.voyage===s.voyage?s.guidance.confusionReduction||0:0));
}
export function navigationActions(s,p){
 const navigation=s.phase==='navigation',scout=s.relicUsage.scout,heading=s.relicUsage.heading;
 const hidden=s.candidates.some(c=>c.visibility!=='full');
 const status=(ok,reason,summary)=>({canChoose:ok,reason:ok?'':reason,summary});
 return {
  scout:{sanity:status(navigation&&hidden&&s.current.sanity>8,!navigation?'仅导航阶段':!hidden?'候选信息均已清晰':'SAN须支付后至少剩1','SAN −8'),relic:status(navigation&&hidden&&hasMechanic(s,p,'scout')&&scout?.charges>0,'需要潮纹镜片及一次侦察机会','侦察机会 ×1')},
  fixHeading:{wood:status(navigation&&!s.navigation.fixedHeading&&confusionChance(s)>0&&s.hand.some(c=>c.definitionId==='wood'),'需混乱状态、未固定航向及木头1','木头 ×1'),relic:status(navigation&&!s.navigation.fixedHeading&&confusionChance(s)>0&&hasMechanic(s,p,'heading')&&heading?.remaining>0,'需要混乱状态、定向骨针及剩余额度','定向额度 ×1')}
 };
}
export function scoutNode(ctx,cmd){
 const {s}=ctx;ctx.require(s.phase==='navigation','仅导航阶段可侦察');const node=s.candidates.find(c=>c.instanceId===cmd.candidateId||c.id===cmd.candidateId);ctx.require(node&&node.visibility!=='full','选择被迷雾遮蔽的候选');
 const method=cmd.method;ctx.require(['sanity','relic'].includes(method),'选择侦察支付方式');const status=navigationActions(s,ctx.p).scout[method];ctx.require(status.canChoose,status.reason);
 if(method==='sanity')ctx.change('sanity',-8,'price');else{s.relicUsage.scout.charges--;s.relicUsage.scout.settlements=0;}
 node.visibility='full';ctx.log('侦察揭示：'+node.name,'导航');
}
export function fixHeading(ctx,cmd){
 const {s}=ctx;ctx.require(['wood','relic'].includes(cmd.method),'选择固定航向支付方式');const status=navigationActions(s,ctx.p).fixHeading[cmd.method];ctx.require(status.canChoose,status.reason);
 if(cmd.method==='wood')ctx.consume('wood');else s.relicUsage.heading.remaining--;
 s.navigation.fixedHeading=true;ctx.log('本次航行已固定方向，免于混乱偏航','导航');
}
