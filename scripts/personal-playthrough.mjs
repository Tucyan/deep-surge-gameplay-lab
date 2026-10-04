import { GameSession } from '../src/core/session.js';
import { CARDS, RECIPES, NODES, ORIGINS } from '../src/content/index.js';

console.log('================ 亲自交互式游玩第一层测试局 ================\n');

// Choose a standard seed and origin
const seed = 20261024;
const originId = 'strong'; // 强壮之人
const session = new GameSession();

let res = session.execute({ type: 'NewGame', seed, originId });
if (!res.ok) throw new Error(res.errors.join('; '));

function step(title, cmd) {
  res = session.execute(cmd);
  if (!res.ok) {
    console.error(`[执行失败] ${title}: ${res.errors.join('; ')}`);
    throw new Error(res.errors.join('; '));
  }
  const v = session.getView();
  console.log(`▶ [${title}] -> Phase: ${v.phase} | HP: ${v.current.hp}/${v.stats.hpMax} | 饱食: ${v.current.hunger} | 水分: ${v.current.hydration} | 理智: ${v.current.sanity} | AP: ${v.phase === 'battle' ? v.battleAp : v.ap}`);
  return v;
}

let v = session.getView();
console.log(`初始状态：出身【${ORIGINS[originId].name}】，航程总长度 ${v.length} 轮，木筏 4 格，手牌: ${v.hand.map(c => c.name).join(', ')}\n`);

while (v.phase !== 'finished') {
  v = session.getView();

  if (v.phase === 'navigation') {
    console.log(`\n---------------- [航行轮 ${v.voyage}/${v.length}] 导航选择 ----------------`);
    console.log(`候选节点: ${v.candidates.map(c => `${c.name} (${c.id}, ${c.kind})`).join(' | ')}`);
    
    // Select best node based on current condition
    let targetNode = v.candidates[0];
    if (v.candidates.length === 1 && v.candidates[0].id === 'boss') {
      targetNode = v.candidates[0];
    } else {
      const camp = v.candidates.find(c => c.id === 'camp');
      const drift = v.candidates.find(c => c.id === 'drift');
      const battle = v.candidates.find(c => c.kind === 'battle');
      const ruin = v.candidates.find(c => c.kind === 'ruin');

      if ((v.current.hunger <= 40 || v.current.hydration <= 40 || v.current.hp <= 20) && camp) {
        targetNode = camp;
      } else if (v.voyage <= 2 && drift) {
        targetNode = drift;
      } else if (battle && v.current.hp >= 25) {
        targetNode = battle;
      } else if (camp) {
        targetNode = camp;
      } else {
        targetNode = drift || v.candidates[0];
      }
    }

    v = step(`启航前往: ${targetNode.name}`, { type: 'SubmitVoyage', nodeId: targetNode.id });
    console.log(`领取涌泉物资后手牌: ${v.hand.map(c => c.name).join(', ')}`);
    continue;
  }

  if (v.phase === 'action') {
    // 1. Drink / Eat if needed
    for (const c of v.hand) {
      if (c.definitionId === 'water' && v.current.hydration <= 75) {
        v = step(`饮用淡水 (+25水分)`, { type: 'PlayCard', cardId: c.instanceId });
        break;
      }
      if (c.definitionId === 'food' && v.current.hunger <= 75) {
        v = step(`食用植物 (+25饱食)`, { type: 'PlayCard', cardId: c.instanceId });
        break;
      }
    }

    // 2. Fuel lamp
    const lamp = v.cells.find(c => c.state === 'intact' && c.equipment?.definitionId === 'lamp');
    if (lamp && lamp.equipment.fuel <= 1) {
      const corpse = v.hand.find(c => c.definitionId === 'corpse');
      const wood = v.hand.find(c => c.definitionId === 'wood');
      if (corpse) {
        v = step(`投料怪物尸体入灯 (+3节点)`, { type: 'FuelLamp', equipmentId: lamp.equipment.instanceId, cardId: corpse.instanceId });
        continue;
      } else if (wood && v.hand.filter(c => c.definitionId === 'wood').length >= 2) {
        v = step(`投料木头入灯 (+1节点)`, { type: 'FuelLamp', equipmentId: lamp.equipment.instanceId, cardId: wood.instanceId });
        continue;
      }
    }

    // 3. Heal with medkit if damaged
    const medkit = v.cells.find(c => c.state === 'intact' && c.equipment?.definitionId === 'medkit');
    if (medkit && v.current.hp <= v.stats.hpMax - 4 && v.ap >= 1) {
      v = step(`使用包扎包治疗 (+4生命)`, { type: 'ActivateEquipment', equipmentId: medkit.equipment.instanceId });
      continue;
    }

    // 4. Install equipment
    const equipCard = v.hand.find(c => CARDS[c.definitionId]?.kind === 'equipment');
    const emptyCell = v.cells.find(c => c.state === 'intact' && !c.equipment);
    if (equipCard && emptyCell && v.ap >= 1) {
      v = step(`在木筏安装【${equipCard.name}】于 ${emptyCell.id}`, { type: 'PlayCard', cardId: equipCard.instanceId, targetId: emptyCell.id });
      continue;
    }

    // 5. Craft equipment
    const installed = v.cells.filter(c => c.state === 'intact' && c.equipment).map(c => c.equipment.definitionId);
    const handEquip = v.hand.filter(c => CARDS[c.definitionId]?.kind === 'equipment').map(c => c.definitionId);
    const craftList = ['filter', 'planter', 'lamp', 'crossbow', 'medkit', 'crossbow'];
    let crafted = false;
    if (v.ap >= 1) {
      for (const item of craftList) {
        const count = installed.filter(x => x === item).length + handEquip.filter(x => x === item).length;
        const max = item === 'crossbow' ? 2 : 1;
        if (count < max && v.recipeAvailability[item]?.canCraft) {
          v = step(`制造设备【${RECIPES[item].name}】`, { type: 'Craft', recipeId: item });
          crafted = true;
          break;
        }
      }
    }
    if (crafted) continue;

    // 6. Expand raft if full
    if (!emptyCell && v.ap >= 1 && v.hand.filter(c => c.definitionId === 'wood').reduce((s, c) => s + c.quantity, 0) >= 2) {
      if (v.expansionOptions && v.expansionOptions.length > 0) {
        const opt = v.expansionOptions[0];
        v = step(`扩建木筏格 (${opt.x}, ${opt.z})`, { type: 'ExpandRaft', x: opt.x, z: opt.z });
        continue;
      }
    }

    // 7. Resolve node
    if (v.node && !v.node.resolved) {
      if (['battle', 'ruin'].includes(v.node.kind)) {
        v = step(`进入战斗: ${v.node.name} (目标: ${v.node.monster})`, { type: 'EnterNode' });
        continue;
      }
      if (v.node.kind === 'supply') {
        const woodCount = v.hand.filter(c => c.definitionId === 'wood').length;
        v = step(`打捞物资`, { type: 'ChooseOption', optionId: woodCount < 3 ? 'wood' : 'metal' });
        continue;
      }
      if (v.node.kind === 'rest') {
        v = step(`休整地休息 (+25全数值)`, { type: 'ChooseOption', optionId: 'rest' });
        continue;
      }
      if (v.node.kind === 'shop') {
        v = step(`离开商店`, { type: 'ChooseOption', optionId: 'leave' });
        continue;
      }
      if (v.node.options?.length) {
        v = step(`节点选择: ${v.node.options[0].name}`, { type: 'ChooseOption', optionId: v.node.options[0].id });
        continue;
      }
    }

    // 8. End voyage
    if (v.node?.resolved) {
      v = step(`结束航行轮，进入生存结算`, { type: 'EndVoyage' });
      continue;
    }
  }

  if (v.phase === 'battle') {
    const enemy = v.battle.enemies.find(e => e.hp > 0);
    if (!enemy) continue;

    console.log(`   [战斗对局中] 回合 ${v.battle.round} | 敌人【${enemy.name}】剩余生命: ${enemy.hp}/${enemy.maxHp} | 玩家 AP: ${v.battleAp}`);

    // Boss retreat check if health critically low and no hope
    if (v.battle.boss && v.battle.round >= 2 && v.current.hp <= 8 && enemy.hp >= 10) {
      v = step(`【战术撤退】Boss战受创过重，第2回合撤离`, { type: 'Retreat' });
      continue;
    }

    // Arrow
    const arrow = v.hand.find(c => c.definitionId === 'arrow');
    if (arrow) {
      v = step(`打出【射箭】(0 AP)`, { type: 'PlayCard', cardId: arrow.instanceId, targetId: enemy.instanceId });
      continue;
    }

    // Clear pollution
    const pollution = v.hand.find(c => c.definitionId === 'pollution');
    if (pollution && v.battleAp >= 2) {
      v = step(`清除手牌【潮蚀污染】(2 AP)`, { type: 'PlayCard', cardId: pollution.instanceId });
      continue;
    }

    // Punch
    const punch = v.hand.find(c => c.definitionId === 'punch');
    if (punch && v.battleAp >= 1) {
      v = step(`打出【出拳】(1 AP)`, { type: 'PlayCard', cardId: punch.instanceId, targetId: enemy.instanceId });
      continue;
    }

    // End battle turn
    v = step(`结束战斗第 ${v.battle.round} 回合，承受敌方攻击`, { type: 'EndBattleTurn' });
    continue;
  }

  if (v.phase === 'battleDiscard' || v.phase === 'discard') {
    const excess = v.excess;
    if (excess > 0) {
      const discards = v.hand.filter(c => !['negative', 'combat'].includes(CARDS[c.definitionId]?.kind)).slice(0, excess).map(c => c.instanceId);
      v = step(`弃置超限手牌 ${discards.length} 张`, { type: 'DiscardCards', cardIds: discards });
    }
    v = step(`确认弃牌完成`, { type: 'FinishDiscard' });
    continue;
  }
}

console.log(`\n================ 亲自游玩最终结局 ================`);
console.log(`结局：【${v.result?.name}】 (${v.result?.id})`);
console.log(`说明：${v.result?.description}`);
console.log(`最终得分：${v.result?.points} 涌潮点`);
console.log(`最终生存指标：生命 ${v.current.hp}/${v.stats.hpMax} | 饱食 ${v.current.hunger} | 水分 ${v.current.hydration} | 理智 ${v.current.sanity}`);
console.log(`木筏设备规模：${v.cells.filter(c => c.equipment).map(c => `${c.equipment.name}Lv${c.equipment.level}`).join(', ')}`);
