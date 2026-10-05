import {readFile,writeFile} from 'node:fs/promises';

const read=async name=>JSON.parse(await readFile(new URL('../evidence/'+name,import.meta.url),'utf8'));
const {NODES}=(await read('default-v2.json')).content;
const audit=await read('balance-audit-v2.json'),comparison=await read('balance-comparison-v2.json'),costs=await read('event-cost-comparison-v2.json'),progression=await read('progression-balance-v2.json');
const sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]||0),0),round=n=>Number(n.toFixed(2));
const label={events:'事件优先',build:'建设优先','skip-events':'事件离开对照'};
function detail(rows){
 let rewards=0;const discards={},selections={},arrivals={},payments={};
 for(const r of rows){
  for(const [key,n]of Object.entries(r.eventSelections)){
   const [id,optionId]=key.split(':'),o=NODES[id].options.find(o=>o.id===optionId);
   // Tested variants change costs/metabolism/production, never these deterministic option rewards.
   rewards+=n*(o.effects||[]).filter(e=>e.type==='GiveCard').reduce((sum,e)=>sum+(e.amount||1),0);
   selections[key]=(selections[key]||0)+n;
  }
  for(const [id,n]of Object.entries(r.discardedByCard))discards[id]=(discards[id]||0)+n;
  for(const [id,n]of Object.entries(r.eventArrivals))arrivals[id]=(arrivals[id]||0)+n;
  for(const [id,n]of Object.entries(r.eventPaymentsByNode))payments[id]=(payments[id]||0)+n;
 }
 const wins=rows.filter(r=>['survived','true'].includes(r.result));
 return {runs:rows.length,meanEventRewards:round(rewards/rows.length),meanNetEventConsumption:round((sum(rows,'eventCardsConsumed')-rewards)/rows.length),discardedByCard:discards,selections,arrivals,eventPaymentsByNode:payments,wins:wins.length,winnersAtZeroHungerOrHydration:wins.filter(r=>r.current.hunger===0||r.current.hydration===0).length,winnersWithMedkit:wins.filter(r=>r.finalEquipment.some(e=>e.id==='medkit')).length,meanForcedOrdinaryBattles:round(rows.reduce((n,r)=>n+r.forcedBattleNavigations-(r.nodeHistory.includes('boss')?1:0),0)/rows.length),meanImmediateRepeats:round(sum(rows,'immediateRepeats')/rows.length),discardedPerVisitedVoyage:round(sum(rows,'discardedCards')/sum(rows,'voyage'))};
}
const details=audit.summaries.map(s=>({strategy:s.strategy,...detail(audit.runs.filter(r=>r.strategy===s.strategy))}));
const total=audit.runs.length+comparison.cases.filter(c=>c.id!=='baseline').reduce((n,c)=>n+c.runs.length,0)+costs.runs.length+progression.groups.reduce((n,g)=>n+g.runs.length,0);
const md=[];const add=s=>md.push(s);
add(`# 节点与数值平衡验证 v2\n\n日期：2026-10-05。内容契约：${audit.contentVersion}，发布配置指纹：${audit.configFingerprint}。范围：独立玩法实验。默认规则与发布配置本轮保持原值；对照配置只在测试进程内应用并在结束时恢复。`);
add(`## 结论\n\n当前方案仍有明显平衡问题。收费事件已经产生投入，但事件奖励抵消了大量净消耗；多数材料压力最终表现为弃牌，木头同时承担建设、燃灯和恢复费用。食水恢复25低于航耗30，使生存设备难以抑制伤害；不耗材的包扎包治疗形成另一条更直接的补偿路径。不能仅加大统一费用或降低航耗便认定问题解决。`);
add(`## 方法和可复现范围\n\n本轮记录${total}局自动测试：当前配置432局、三组数值对照432局、事件材料对照288局、局外成长对照288局。当前配置为24个种子×6出身×3策略，覆盖10–15轮；数值对照使用相同的前12个种子×6出身×2策略，事件材料与成长对照各使用24个种子。种子为 imul(index,2654435761) >>> 0，避免只用1–100导致首个随机结果集中在10轮。\n\n策略只读取当前可见候选、手牌、设备和生存值，不借未来节点池选择航线；全部动作通过公开GameSession命令，预览不改变实际随机流。不购买局外成长，除专门标注的成长组。所有记录均进入finished，非法提交为0。策略是启发式，不代表最优策略或真人胜率；六出身共享同一组种子，不能将这些局视作独立随机人群样本。\n\n事件优先在建设前支付有即时价值的事件，建设优先先建造再选事件；离开对照不支付普通选项费用，但保留建设与商店购买。三者都按实际最低伤害出拳并使用明确的生产、燃料与弃牌规则。策略未主动支付献血、随机资源转换或风险打捞，也未优化生存牌附魔，因此这些选项的零选择不能当作无价值的证明。`);
add('## 当前配置：完整144局/策略\n\n| 策略 | 击败Boss | 毛投入/局 | 奖励牌/局 | 事件净消耗/局 | 弃牌/局 | 饥渴伤害/局 | 战斗轮末伤害/局 |\n|---|---:|---:|---:|---:|---:|---:|---:|');
for(const s of audit.summaries){const d=details.find(d=>d.strategy===s.strategy);add(`| ${label[s.strategy]} | ${s.bossWins}/144（${s.bossWinPercent}%） | ${s.meanEventCardsConsumed} | ${d.meanEventRewards} | ${d.meanNetEventConsumption} | ${s.meanDiscardedCards} | ${s.meanSurvivalDamage} | ${s.meanBattleDamage} |`);}
add('\n毛投入是成功选项实际提交的卡牌数量；净消耗=投入−选项GiveCard奖励。奖励按已执行选项计数及固定定义复算，本轮策略没有兑换、献血或附魔奖励分支。币交易、合成、安装、燃料与饮食消耗分开记录，不并入事件净消耗。弃牌按数量计，含叠放实例；生存和战斗伤害是相应结算命令前后生命净下降，不能视为全部生命损失。');
add('## 问题证据\n\n1. **富余材料的去向不均衡。** 事件优先组144局共弃掉布条427、绳索376、废铁358、塑料231、木头48。约81%的弃牌是布条/绳索/废铁，木头只占3.3%。这是当前策略的资源结构，不是所有玩法的定论。\n2. **付费恢复不能撑过一轮。** 固定探针验证：饱食/水分各25，轮末各扣30，生命损失4；Ⅱ级食水设备在伤害之后产出，无法挽回当轮。正常玩法从归零吃喝各一张也只到25。Ⅰ级设备平均每轮仅提供12.5点食水，Ⅱ级25仍低于30。\n3. **包扎包绕过食水压力。** Ⅰ级1AP治疗4，且不耗牌；与双饥渴伤害上限4相同。事件优先21个胜利局中21局终局至少一项饥渴归零、19局装有包扎包。建设优先22胜全部至少一项归零、21局有包扎包。观察表明治疗路径很强，尚未通过禁用治疗的配对试验证明因果。\n4. **事件固定费用可支付不等于愿意支付。** 事件优先非商店节点固定费用可支付率67.3%，建设优先67.5%；特殊目标另行验证。事件优先风暴到达218次，浮架回收20次，剩余198次离开。水母被本轮策略全部略过，需单独测试其转换价值。\n5. **池降权只能改变顺序。** 普通池份数恰好等于普通航程，完整走完就会访问池中全部份数，选择的本质是访问顺序。事件优先平均每局约1.38次紧邻重复、'+details.find(d=>d.strategy==='events').meanForcedOrdinaryBattles+'次只有战斗候选的普通导航。降权无法减少整层必经的重复总次数，末段类型减少是池消耗的自然结果。');
add('## 六出身：事件优先、每种24局\n\n| 出身ID | 击败Boss | 精神失败 | 生命失败 | 弃牌/局 |\n|---|---:|---:|---:|---:|');
for(const s of audit.byOrigin.filter(s=>s.strategy==='events'))add(`| ${s.originId} | ${s.bossWins}/24 | ${s.endings.mad||0} | ${s.endings.dead||0} | ${s.meanDiscardedCards} |`);
add('## 数值对照：每项每策略72局，使用配对种子\n\n| 对照 | 策略 | 击败Boss | 事件毛投入/局 | 弃牌/局 |\n|---|---|---:|---:|---:|');
for(const c of comparison.cases)for(const s of c.summaries)add(`| ${c.description} | ${label[s.strategy]} | ${s.bossWins}/72（${s.bossWinPercent}%） | ${s.meanEventCardsConsumed} | ${s.meanDiscardedCards} |`);
add('\n必须与此表的配对基准比较，而不是与完整24种子结果直接比较。单减航耗对事件优先仅增加2/72胜，弃牌11.06→17.36；提前生产没有稳定提高胜率。组合修改也没有解决材料去向。对照只覆盖12个种子，结果对路线敏感，不宣称统计显著或已选出最终数值。');
add('## 事件材料对照：每策略144局\n\n休整由木头1＋布条1改为布条2＋塑料1；补给箱由木头2＋塑料1改为废铁1＋绳索1＋布条1；风暴浮架由木头2＋绳索1＋塑料1改为木头1＋绳索1＋布条2。AP与奖励不变。休整投入总数由2升为3，故这一组同时改变构成和该选项数量，不能单独归因于材料替换。\n\n| 策略 | 基准胜率 | 对照胜率 | 基准弃牌/局 | 对照弃牌/局 | 对照固定费用可支付率 |\n|---|---:|---:|---:|---:|---:|');
for(const s of costs.summaries){const b=costs.baseline.find(b=>b.strategy===s.strategy);add(`| ${label[s.strategy]} | ${b.bossWinPercent}% | ${s.bossWinPercent}% | ${b.meanDiscardedCards} | ${s.meanDiscardedCards} | ${s.payableArrivalPercent}% |`);}
add('\n事件优先对照毛投入5.74→6.61、净消耗'+detail(costs.runs.filter(r=>r.strategy==='events')).meanNetEventConsumption+'，但胜率14.6%→2.1%、费用可支付率67.3%→60.2%，并挤压设备建设。弃牌减少包含更早死亡的影响，不能当作平衡改善，因此未采用这一组。');
add('## 局外成长对照：事件优先、各144局\n\n| 进度 | 击败Boss | 弃牌/局 | 精神失败 |\n|---|---:|---:|---:|\n| 无成长 | 14.6% | 10 | 41 |');
for(const group of progression.groups)add(`| ${group.description} | ${group.summary.bossWinPercent}% | ${group.summary.meanDiscardedCards} | ${group.summary.endings.mad||0} |`);
add('\n珍珠消除精神归零失败，但没有解决食水和卡牌去向。成长组容量与AP提高后弃牌仍增加，不能只增手牌上限解决消耗不足。');
add('## 浏览器实际试玩\n\n本地127.0.0.1:5080，种子2654435761，强壮出身，未购买局外成长。实际操作三个普通节点并进入第4轮导航：\n\n- 首轮商人：合成土盆，商店无币可买，离开后饥渴40→10。\n- 第二轮风暴：通过明确安装按钮安装土盆与灯；材料出现布条4、木头1、塑料0。最后木头用于造灯，无燃料，付费风暴两项均因缺料不可选。结算生命40→36、饥渴→0、精神65→50。\n- 第三轮休整：领取补给后木头1、布条6；投入木头1、布条1、1AP休整，生命36→40，饥渴0→25，精神50→75。轮末生命又降至36、饥渴归零；土盆在伤害后发出食物。实际复现“手牌多布条，却要争用唯一木头，付费休整后仍挨饿”。\n- 本轮浏览器没有走完整层；完整成功/失败来自自动命令测试。读取当前浏览器控制台未发现error/warn。操作使用明确安装/出牌按钮，单击目标和双击提示与实际操作存在出入，作为后续界面问题记录，不用于推断核心数值。');
add('## 建议与当前处理\n\n本轮保留发布规则。建议下一轮分开验证，避免把几个变量一起改后只看胜率：\n\n1. 给事件增加有限、可选择的费用替代，优先消耗富余材料，但保留建设/燃灯的木头通路；休整总费用先不增加。本次全量替换方案失败，不能直接采用。\n2. 让食水的单次恢复与每轮消耗形成可理解的关系，再比较设备节奏；重点验证“认真吃喝能明显减少伤害”，不是只调高通过率。\n3. 单独比较包扎包需要耗材或限定每轮治疗次数，检查是否仍能长期无视食水；如果加耗材，应与生存减损一起测，避免当前低胜率继续下降。\n4. 水母转换、附魔、风险打捞需专门策略；本轮仅三种有限策略，没有证明所有事件组合的平衡。\n5. 若希望整层能够避开部分坏节点，需要比实际航程更大的池；保持池内可重复，另测池大小。当前大小下，降权只改善顺序。');
add('## 复现与原始数据\n\n在玩法实验目录运行（无需下载依赖）：\n\n```text\nnode scripts/audit-balance.mjs 24\nnode scripts/compare-balance.mjs\nnode scripts/compare-event-costs.mjs\nnode scripts/audit-progression.mjs\nnode scripts/write-balance-report.mjs\nnpm test\nnpm run check\n```\n\n- [当前配置432局](balance-audit-v2.json)\n- [数值对照432局及配对基准](balance-comparison-v2.json)\n- [事件费用对照288局](event-cost-comparison-v2.json)\n- [局外成长288局](progression-balance-v2.json)\n- [汇总指标](balance-review-v2-summary.json)\n\n新增balance-audit测试验证策略可复现、无非法提交、池份数守恒、25/30食水缺口与4点治疗对冲。最终检查结果见本文件末尾的当次验证记录。');
await writeFile(new URL('../evidence/balance-review-v2.md',import.meta.url),md.join('\n')+'\n');
await writeFile(new URL('../evidence/balance-review-v2-summary.json',import.meta.url),JSON.stringify({date:'2026-10-05',totalRuns:total,baseline:audit.summaries,details,defaultConfigurationUnchanged:true},null,2)+'\n');
process.stdout.write(`已生成平衡报告：${total}局，发布规则保留。\n`);
