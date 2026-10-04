import { simulateSmartRun } from './simulate-smart.mjs';
import { createProfile } from '../src/core/session.js';
import { ORIGINS } from '../src/content/index.js';

const origins = Object.keys(ORIGINS);
console.log('================ 连续跑10次第一层玩法实验（拟真玩家策略） ================\n');

let profile = createProfile();
const results = [];

for (let i = 1; i <= 10; i++) {
  const seed = 20261000 + i * 137;
  const originId = origins[(i - 1) % origins.length];
  
  console.log(`----------------------------------------------------------------`);
  console.log(`【实验 Run #${i}】 Seed: ${seed} | 出身: ${ORIGINS[originId].name} (${originId})`);
  
  try {
    const outcome = simulateSmartRun({ seed, originId, profile, autoMeta: true });
    const v = outcome.view;
    const res = v.result;
    
    // Carry over profile to next run
    profile = outcome.profile;

    const stats = {
      run: i,
      seed,
      origin: ORIGINS[originId].name,
      outcomeId: res?.id,
      outcomeName: res?.name,
      voyages: `${v.voyage}/${v.length}`,
      finalHp: `${v.current.hp}/${v.stats.hpMax}`,
      finalHunger: `${v.current.hunger}/${v.stats.hungerMax}`,
      finalHydration: `${v.current.hydration}/${v.stats.hydrationMax}`,
      finalSanity: `${v.current.sanity}/${v.stats.sanityMax}`,
      level: `Lv${v.level} (XP:${v.xp})`,
      battles: outcome.battlesFought,
      cells: v.cells.length,
      equipment: v.cells.filter(c => c.equipment).map(c => `${c.equipment.name}Lv${c.equipment.level}`).join(', ') || '无',
      pointsEarned: res?.points || 0,
      totalProfilePoints: profile.points,
      techs: profile.tech.join(', ') || '无',
      purchases: Object.entries(profile.purchases).map(([k, count]) => `${k}:${count}`).join(', ') || '无',
      isVictory: ['survived', 'true', 'withdrawn'].includes(res?.id)
    };

    results.push(stats);
    console.log(`  结果: 【${stats.outcomeName}】(${stats.outcomeId}) | 航程: ${stats.voyages} | 遭遇战斗数: ${stats.battles}`);
    console.log(`  最终状态: HP ${stats.finalHp} | 饱食 ${stats.finalHunger} | 水分 ${stats.finalHydration} | 理智 ${stats.finalSanity}`);
    console.log(`  木筏规模: ${stats.cells}格 | 搭载设备: [${stats.equipment}]`);
    console.log(`  角色成长: ${stats.level} | 本局得分: ${stats.pointsEarned} | 局外剩余点数: ${stats.totalProfilePoints}`);
    console.log(`  局外科技/购买: 科技[${stats.techs}] / 购买[${stats.purchases}]\n`);
  } catch (err) {
    console.error(`Run #${i} 发生异常:`, err);
    results.push({ run: i, seed, error: err.message, isVictory: false });
  }
}

console.log('================ 10次实验数据汇总表格 ================');
console.table(results.map(r => ({
  '序号': r.run,
  '出身': r.origin,
  '结局': r.outcomeName,
  '航程': r.voyages,
  'HP': r.finalHp,
  '饱食': r.finalHunger,
  '水分': r.finalHydration,
  '理智': r.finalSanity,
  '等级': r.level,
  '战斗数': r.battles,
  '木筏格数': r.cells,
  '局外科技': r.techs,
  '累计点数': r.totalProfilePoints
})));

const survivedCount = results.filter(r => r.outcomeId === 'survived' || r.outcomeId === 'true').length;
const withdrawnCount = results.filter(r => r.outcomeId === 'withdrawn').length;
const deadCount = results.filter(r => r.outcomeId === 'dead').length;
const madCount = results.filter(r => r.outcomeId === 'mad').length;

console.log(`\n================ 结果分布统计 ================`);
console.log(`击败Boss通关 (survived / true): ${survivedCount}/10 (${survivedCount * 10}%)`);
console.log(`撤离潮眼生还 (withdrawn):         ${withdrawnCount}/10 (${withdrawnCount * 10}%)`);
console.log(`败亡死亡 (dead):                  ${deadCount}/10 (${deadCount * 10}%)`);
console.log(`精神归零发疯 (mad):               ${madCount}/10 (${madCount * 10}%)`);
console.log(`总体完成率 (生还+通关):           ${(survivedCount + withdrawnCount)}/10 (${(survivedCount + withdrawnCount) * 10}%)`);
