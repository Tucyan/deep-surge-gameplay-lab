import {readFile,writeFile} from 'node:fs/promises';
import {summarizeRuns} from './balance-player.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../evidence/'+name,import.meta.url),'utf8'));
const old=await read('balance-audit-v2.json'),oldConfig=await read('default-v2.json'),train=await read('balance-final-comparison-v3.json'),holdout=await read('balance-holdout-v3.json'),progression=await read('progression-balance-v3.json');
const chosen=train.cases.find(c=>c.variant==='restoration'),before=holdout.cases.find(c=>c.variant==='v2-compat'),after=holdout.cases.find(c=>c.variant==='v3-published');
const avg=(rows,key)=>Number((rows.reduce((n,r)=>n+(r[key]||0),0)/rows.length).toFixed(2));
function detail(rows,config){
 const reward=r=>Object.entries(r.eventSelections).reduce((n,[key,count])=>{
  const [id,optionId]=key.split(':'),o=config.content.NODES[id].options.find(o=>o.id===optionId);
  return n+count*((o.effects||[]).filter(e=>e.type==='GiveCard').reduce((x,e)=>x+(e.amount||1),0)+(o.special==='exchange'?1:0));
 },0);
 const gross=rows.reduce((n,r)=>n+r.eventCardsConsumed,0),rewards=rows.reduce((n,r)=>n+reward(r),0),voyages=rows.reduce((n,r)=>n+r.nodeHistory.length,0);
 return {...summarizeRuns(rows),meanEventNetConsumed:Number(((gross-rewards)/rows.length).toFixed(2)),discardPerVisitedNode:Number((rows.reduce((n,r)=>n+r.discardedCards,0)/voyages).toFixed(2)),eventNetPerVisitedNode:Number(((gross-rewards)/voyages).toFixed(2)),meanTreatmentConsumed:avg(rows,'treatmentCardsConsumed'),meanForcedOrdinaryBattles:Number((rows.reduce((n,r)=>n+r.forcedBattleNavigations-(r.nodeHistory.includes('boss')?1:0),0)/rows.length).toFixed(2)),meanImmediateRepeats:avg(rows,'immediateRepeats'),poolViolations:rows.filter(r=>r.remainingPool!==r.initialPoolSize-r.ordinarySelected).length};
}
const groups=[];
for(const [sample,a,b]of [['选参种子1–24',old.runs,chosen.runs],['额外种子25–48',before.runs,after.runs],['合计48种子',[...old.runs,...before.runs],[...chosen.runs,...after.runs]]])for(const strategy of ['events','build','skip-events'])groups.push({sample,strategy,before:detail(a.filter(r=>r.strategy===strategy),oldConfig),after:detail(b.filter(r=>r.strategy===strategy),chosen.config)});
const summary={date:'2026-10-05',publishedFingerprint:chosen.configFingerprint,groups,progression:progression.groups.map(p=>({id:p.id,...detail(p.runs,chosen.config)}))};
await writeFile(new URL('../evidence/balance-review-v3-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
const label={events:'事件优先',build:'建设优先','skip-events':'离开付费事件'};
let md=`# 玩法实验数值平衡试测 v3\n\n日期：2026-10-05。发布指纹：${chosen.configFingerprint}。仅修改独立“玩法实验”，不修改 water-era。所有数值是试测决定。\n\n## 本次采用\n\n- 普通节点池初始数量 = 2 ×（本层航行次数 − 1）。允许重复；只有启航选择才删除一份，未选保留。候选类型去重、已选降权、末轮固定Boss继续生效。走完普通航程后仍剩半池。\n- 食物/淡水恢复40；每轮仍各消耗30。Ⅰ级生产仍两轮一次，Ⅱ级每轮一次，Ⅲ级每轮两份。生产仍在生存处罚之后。\n- 包扎包每次消耗1 AP和布条1，三级恢复8/12/16；次数受AP和物资限制，费用不触发回牌。\n- 休整消耗布条2、1 AP，恢复生命15、饱食/水分/精神各40；补给箱和安全风暴改耗废铁/绳索/布条各1。安全风暴精神恢复20。其余选项保留。\n\n## 固定种子对照\n\n六种出身、三种固定策略，每组48种子（共288局）。前24种子用于选参，额外24种子在参数确定后才测试。种子为 imul(index,2654435761) >>> 0；旧规则用归档配置迁移到新契约，池倍数1，旧数值保留。每局从无局外成长档案开始，完整运行至结局，全部通过公共命令，不读未来池来作选择。\n\n| 策略 | 通关率 旧→新 | 事件净耗牌/局 旧→新 | 弃牌/局 旧→新 | 弃牌/已选节点 旧→新 | 饥渴损血/局 旧→新 |\n|---|---|---|---|---|---|\n`;
for(const g of groups.filter(g=>g.sample==='合计48种子')){const a=g.before,b=g.after;md+=`| ${label[g.strategy]} | ${a.bossWinPercent}% → ${b.bossWinPercent}% | ${a.meanEventNetConsumed} → ${b.meanEventNetConsumed} | ${a.meanDiscardedCards} → ${b.meanDiscardedCards} | ${a.discardPerVisitedNode} → ${b.discardPerVisitedNode} | ${a.meanSurvivalDamage} → ${b.meanSurvivalDamage} |\n`;}
md+='\n额外种子对照（每组144局，避免只报告选参样本）：\n\n';
for(const g of groups.filter(g=>g.sample==='额外种子25–48'))md+=`- ${label[g.strategy]}：通关 ${g.before.bossWinPercent}% → ${g.after.bossWinPercent}%；净耗牌 ${g.before.meanEventNetConsumed} → ${g.after.meanEventNetConsumed}；弃牌 ${g.before.meanDiscardedCards} → ${g.after.meanDiscardedCards}。\n`;
const event=groups.find(g=>g.sample==='合计48种子'&&g.strategy==='events');
md+=`\n事件优先策略的强制普通战斗平均 ${event.before.meanForcedOrdinaryBattles} → ${event.after.meanForcedOrdinaryBattles}；相邻重复 ${event.before.meanImmediateRepeats} → ${event.after.meanImmediateRepeats}。全部合法命令，池消耗不变量失败 ${groups.reduce((n,g)=>n+g.after.poolViolations,0)} 次。\n\n## 成长复核\n\n同前24种子、六出身、事件优先各144局：\n\n`;
for(const p of summary.progression)md+=`- ${p.id}：通关${p.bossWinPercent}%，平均弃牌${p.meanDiscardedCards}，事件净耗牌${p.meanEventNetConsumed}。\n`;
md+=`\n## 浏览器实际验证\n\n固定种子2654435761、强壮之人，完成5轮并进入第6/11轮导航。Ⅰ级土盆两轮生产，灯安装、普通战斗胜利、战斗与航行弃牌、尸体燃灯均实际操作。第4轮补给箱先扣铁/绳/布各1，得到食水各1；分别使用后各+40，当轮未扣饥渴生命。第3轮休整因只有1布条明确禁用。第6轮普通池剩15份，初始20份，符合只扣5个选中节点。控制台error/warn为空。截图：balance-v3-browser.jpg。未声称浏览器通关整层；完整结局覆盖来自命令驱动测试。\n\n## 限制与后续观察\n\n这些结果是固定启发式策略的样本，不能视为真实玩家胜率。原材料打捞仍可能净增牌，净耗牌按所有事件费用减去事件新增牌计，不把治疗、合成、弃牌算作事件消耗。回牌生存牌、商店和设备升级会影响结果。策略对水母、献血和风险打捞估值保守，可能低估这些路线。\n\n随机涌泉仍可能连续给大量绳索却缺布条/木头，付费节点可支付率约七成；绕开战斗减少战利品燃料也可能导致精神崩溃。没有为了提高通关率去取消这些取舍。Ⅰ级每轮生产的方案明显增加弃牌，未采用。成长档案胜率提升到约67%，需继续人工试玩检查是否过快。\n\n## 复跑\n\n- npm test；npm run check\n- node scripts/tune-balance.mjs 12 pool-only,food-med,events-slow,events\n- node scripts/tune-balance.mjs 24 events-slow,restoration balance-final-comparison-v3.json\n- node scripts/verify-balance-v3.mjs\n- node scripts/audit-progression.mjs\n\n旧v2原始报告和配置完整保留；v3总结按每个报告对应的内容计算奖励，避免用新定义重算旧结果。\n`;
md+='\n## 本次工程检查\n\n2026-10-05实际执行：npm test 为72/72通过，npm run check 为36个脚本语法及发布配置校验通过；README、玩法重制文档及本报告本地链接全部存在。未提交或推送。\n';
await writeFile(new URL('../evidence/balance-review-v3.md',import.meta.url),md);
process.stdout.write(JSON.stringify(groups.filter(g=>g.sample==='合计48种子'))+'\n');
