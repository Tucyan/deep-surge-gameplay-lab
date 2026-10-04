import { simulateRun } from './simulate-runner.mjs';
import { createProfile } from '../src/core/session.js';
import { ORIGINS } from '../src/content/index.js';

const origins = Object.keys(ORIGINS);
console.log('=== 开始连续跑10次第一层玩法实验 ===\n');

let profile = createProfile();
const results = [];

for (let i = 1; i <= 10; i++) {
  const seed = 1000 + i * 77;
  const originId = origins[(i - 1) % origins.length];
  
  console.log(`----------------------------------------`);
  console.log(`【实验 Run #${i}】 Seed: ${seed}, 出身: ${ORIGINS[originId].name} (${originId})`);
  
  try {
    const outcome = simulateRun({ seed, originId, profile, logDetail: false });
    const v = outcome.view;
    const res = v.result;
    
    // Update profile with accumulated meta points / progress if needed
    profile = outcome.profile;

    const stats = {
      run: i,
      seed,
      origin: ORIGINS[originId].name,
      outcomeId: res?.id,
      outcomeName: res?.name,
      completedVoyages: `${v.voyage}/${v.length}`,
      finalHp: `${v.current.hp}/${v.stats.hpMax}`,
      finalHunger: `${v.current.hunger}/${v.stats.hungerMax}`,
      finalHydration: `${v.current.hydration}/${v.stats.hydrationMax}`,
      finalSanity: `${v.current.sanity}/${v.stats.sanityMax}`,
      level: v.level,
      cellsCount: v.cells.length,
      equipment: v.cells.filter(c => c.equipment).map(c => `${c.equipment.name}Lv${c.equipment.level}`).join(', ') || '无',
      pointsEarned: res?.points || 0,
      totalProfilePoints: profile.points,
      isVictory: ['survived', 'true'].includes(res?.id)
    };

    results.push(stats);
    console.log(`结果: ${stats.outcomeName} (${stats.outcomeId}) | 航程: ${stats.completedVoyages}`);
    console.log(`状态: 生命 ${stats.finalHp}, 饱食 ${stats.finalHunger}, 水分 ${stats.finalHydration}, 理智 ${stats.finalSanity}`);
    console.log(`木筏: ${stats.cellsCount}格, 设备: [${stats.equipment}]`);
    console.log(`角色: 等级 Lv${stats.level}, 本局得分: ${stats.pointsEarned}, 累计涌潮点: ${stats.totalProfilePoints}\n`);
  } catch (err) {
    console.error(`Run #${i} 发生异常:`, err);
    results.push({ run: i, seed, error: err.message, isVictory: false });
  }
}

console.log('================ 10次实验数据汇总 ================');
console.table(results);

const wins = results.filter(r => r.isVictory).length;
console.log(`\n通关率: ${wins}/10 (${wins * 10}%)`);
