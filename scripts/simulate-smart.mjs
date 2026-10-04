import { GameSession, createProfile } from '../src/core/session.js';
import { CARDS, RECIPES, SPRING_POOL, NODES, ORIGINS, RELICS, META_SHOP, TECH } from '../src/content/index.js';

/**
 * Enhanced Simulation that plays like an experienced player:
 * - Understands survival mechanics (Filter + Planter + Lamp)
 * - Fights monsters for XP, coins, corpses
 * - Purchases from Trader / Meta Shop
 * - Manages combat AP, retreats from Boss if unwinnable without dying, or builds multiple weapons / upgrades
 */
export function simulateSmartRun({ seed, originId = 'strong', profile = createProfile(), autoMeta = true }) {
  const g = new GameSession(profile);
  const startRes = g.execute({ type: 'NewGame', seed, originId });
  if (!startRes.ok) throw new Error('Start failed: ' + startRes.errors.join('; '));

  const runLog = [];
  let turnCount = 0;
  const maxTurns = 600;

  let battlesFought = 0;
  let battlesWon = 0;
  let totalDamageTaken = 0;
  let survivalDeficits = 0;

  while (g.getView().phase !== 'finished' && turnCount++ < maxTurns) {
    const v = g.getView();

    // --- 1. NAVIGATION ---
    if (v.phase === 'navigation') {
      const candidates = v.candidates;
      let chosen = candidates[0];

      if (candidates.length === 1 && candidates[0].id === 'boss') {
        chosen = candidates[0];
      } else {
        const camp = candidates.find(c => c.id === 'camp');
        const drift = candidates.find(c => c.id === 'drift');
        const battle = candidates.find(c => c.kind === 'battle');
        const ruin = candidates.find(c => c.kind === 'ruin');
        const shop = candidates.find(c => c.kind === 'shop');
        const jelly = candidates.find(c => c.kind === 'exchange');

        const hpRatio = v.current.hp / v.stats.hpMax;
        const hungerRatio = v.current.hunger / v.stats.hungerMax;
        const hydRatio = v.current.hydration / v.stats.hydrationMax;
        const sanRatio = v.current.sanity / v.stats.sanityMax;
        const lowSurvival = hungerRatio < 0.35 || hydRatio < 0.35 || sanRatio < 0.35 || hpRatio < 0.4;

        if (lowSurvival && camp) {
          chosen = camp;
        } else if (v.voyage <= 2 && drift) {
          chosen = drift;
        } else if (battle && hpRatio >= 0.6) {
          chosen = battle;
        } else if (ruin && hpRatio >= 0.75) {
          chosen = ruin;
        } else if (shop && (v.hand.some(c => c.definitionId === 'coin' && c.quantity >= 2) || v.hand.some(c => c.definitionId === 'corpse'))) {
          chosen = shop;
        } else if (camp) {
          chosen = camp;
        } else if (drift) {
          chosen = drift;
        } else if (jelly) {
          chosen = jelly;
        } else {
          chosen = candidates[0];
        }
      }

      g.execute({ type: 'SubmitVoyage', nodeId: chosen.id });
      continue;
    }

    // --- 2. ACTION PHASE ---
    if (v.phase === 'action') {
      // Survival checks (0 AP)
      let drank = false;
      for (const c of v.hand) {
        if (c.definitionId === 'water' && v.current.hydration <= 75) { g.execute({ type: 'PlayCard', cardId: c.instanceId }); drank = true; break; }
        if (c.definitionId === 'food' && v.current.hunger <= 75) { g.execute({ type: 'PlayCard', cardId: c.instanceId }); drank = true; break; }
        if (c.definitionId === 'calm' && v.current.sanity <= 65) { g.execute({ type: 'PlayCard', cardId: c.instanceId }); drank = true; break; }
      }
      if (drank) continue;

      // Lamp fueling
      const lamp = v.cells.find(c => c.state === 'intact' && c.equipment?.definitionId === 'lamp');
      if (lamp && lamp.equipment.fuel <= 1) {
        const corpse = v.hand.find(c => c.definitionId === 'corpse');
        const wood = v.hand.find(c => c.definitionId === 'wood');
        if (corpse) { g.execute({ type: 'FuelLamp', equipmentId: lamp.equipment.instanceId, cardId: corpse.instanceId }); continue; }
        if (wood) { g.execute({ type: 'FuelLamp', equipmentId: lamp.equipment.instanceId, cardId: wood.instanceId }); continue; }
      }

      // Repair damaged cell
      const damaged = v.cells.find(c => c.state === 'damaged');
      if (damaged && v.ap >= 1 && v.hand.some(c => c.definitionId === 'wood')) {
        g.execute({ type: 'RepairCell', cellId: damaged.id });
        continue;
      }

      // Medkit healing
      const medkit = v.cells.find(c => c.state === 'intact' && c.equipment?.definitionId === 'medkit');
      if (medkit && v.current.hp <= v.stats.hpMax - 6 && v.ap >= 1) {
        g.execute({ type: 'ActivateEquipment', equipmentId: medkit.equipment.instanceId });
        continue;
      }

      // Install equipment from hand
      const equipInHand = v.hand.find(c => CARDS[c.definitionId]?.kind === 'equipment');
      const emptyCell = v.cells.find(c => c.state === 'intact' && !c.equipment);
      if (equipInHand && emptyCell && v.ap >= (equipInHand.cost || 1)) {
        g.execute({ type: 'PlayCard', cardId: equipInHand.instanceId, targetId: emptyCell.id });
        continue;
      }

      // Crafting priority: filter, planter, lamp, crossbow, medkit, crossbow#2
      const installed = v.cells.filter(c => c.state === 'intact' && c.equipment).map(c => c.equipment.definitionId);
      const handEquips = v.hand.filter(c => CARDS[c.definitionId]?.kind === 'equipment').map(c => c.definitionId);
      const neededOrder = ['filter', 'planter', 'lamp', 'crossbow', 'medkit', 'spearRack', 'crossbow'];
      let crafted = false;

      if (v.ap >= 1) {
        for (const req of neededOrder) {
          const countInstalled = installed.filter(x => x === req).length;
          const countHand = handEquips.filter(x => x === req).length;
          const limit = (req === 'crossbow') ? 2 : 1;
          if (countInstalled + countHand < limit && v.recipeAvailability[req]?.canCraft) {
            const res = g.execute({ type: 'Craft', recipeId: req });
            if (res.ok) { crafted = true; break; }
          }
        }
      }
      if (crafted) continue;

      // Raft Expansion
      if (!emptyCell && v.ap >= 1 && v.hand.filter(c => c.definitionId === 'wood').reduce((s, c) => s + c.quantity, 0) >= 2) {
        if (v.expansionOptions && v.expansionOptions.length > 0) {
          const opt = v.expansionOptions[0];
          const res = g.execute({ type: 'ExpandRaft', x: opt.x, z: opt.z });
          if (res.ok) continue;
        }
      }

      // Upgrade equipment if can
      if (v.ap >= 1 && v.upgradeOptions && v.upgradeOptions.length > 0) {
        const u = v.upgradeOptions[0];
        const res = g.execute({ type: 'UpgradeEquipment', targetId: u.targetId, materialId: u.materialId });
        if (res.ok) continue;
      }

      // Node Resolution
      if (v.node && !v.node.resolved) {
        if (['battle', 'ruin'].includes(v.node.kind)) {
          battlesFought++;
          g.execute({ type: 'EnterNode' });
          continue;
        }
        if (v.node.kind === 'supply') {
          const woodCount = v.hand.filter(c => c.definitionId === 'wood').reduce((s, c) => s + c.quantity, 0);
          g.execute({ type: 'ChooseOption', optionId: woodCount < 3 ? 'wood' : 'metal' });
          continue;
        }
        if (v.node.kind === 'rest') {
          const lowStats = v.current.hp <= v.stats.hpMax - 10 || v.current.hunger <= 60 || v.current.hydration <= 60 || v.current.sanity <= 60;
          const upgradeable = v.cells.find(c => c.state === 'intact' && c.equipment && c.equipment.level < 3);
          if (lowStats) {
            g.execute({ type: 'ChooseOption', optionId: 'rest' });
          } else if (upgradeable) {
            g.execute({ type: 'ChooseOption', optionId: 'upgrade', equipmentId: upgradeable.equipment.instanceId });
          } else {
            const punch = v.hand.find(c => c.definitionId === 'punch' && !c.enchant.includes('instant'));
            if (punch) g.execute({ type: 'ChooseOption', optionId: 'enchant', cardId: punch.instanceId, enchant: 'instant' });
            else g.execute({ type: 'ChooseOption', optionId: 'rest' });
          }
          continue;
        }
        if (v.node.kind === 'shop') {
          for (const item of (v.shop || [])) {
            const coins = v.hand.filter(c => c.definitionId === 'coin').reduce((s, c) => s + c.quantity, 0);
            const corpses = v.hand.filter(c => c.definitionId === 'corpse').reduce((s, c) => s + c.quantity, 0);
            if (coins >= item.price) { g.execute({ type: 'ShopBuy', itemId: item.id, payment: 'coin' }); break; }
            else if (corpses >= Math.ceil(item.price / 2)) { g.execute({ type: 'ShopBuy', itemId: item.id, payment: 'corpse' }); break; }
          }
          g.execute({ type: 'ChooseOption', optionId: 'leave' });
          continue;
        }
        if (v.node.kind === 'exchange') {
          if (v.current.hp >= 25) g.execute({ type: 'ChooseOption', optionId: 'blood' });
          else g.execute({ type: 'ChooseOption', optionId: 'leave' });
          continue;
        }
        if (v.node.kind === 'environment') {
          g.execute({ type: 'ChooseOption', optionId: 'leave' });
          continue;
        }
        if (v.node.options?.length) {
          g.execute({ type: 'ChooseOption', optionId: v.node.options[0].id });
          continue;
        }
      }

      // End Voyage
      if (v.node?.resolved) {
        if (v.pendingEnchant > 0) {
          const encCard = v.hand.find(c => ['combat', 'survival', 'action'].includes(CARDS[c.definitionId]?.kind) && !c.enchant.includes('instant'));
          if (encCard) g.execute({ type: 'EnchantCard', cardId: encCard.instanceId, enchant: 'instant' });
        }
        // Drink / eat if will starve
        for (const c of v.hand) {
          if (c.definitionId === 'water' && v.current.hydration <= 60) g.execute({ type: 'PlayCard', cardId: c.instanceId });
          if (c.definitionId === 'food' && v.current.hunger <= 60) g.execute({ type: 'PlayCard', cardId: c.instanceId });
        }
        const res = g.execute({ type: 'EndVoyage' });
        if (!res.ok) throw new Error('EndVoyage error: ' + res.errors.join('; '));
        continue;
      }
    }

    // --- 3. BATTLE PHASE ---
    if (v.phase === 'battle') {
      const enemies = v.battle.enemies.filter(e => e.hp > 0);
      if (!enemies.length) continue;
      const target = enemies[0];

      // Boss special logic:
      // If facing Boss, round >= 2, and player dealt very low damage and HP <= 15, retreat to survive with points!
      if (v.battle.boss && v.battle.round >= 2) {
        const fearful = v.buffs.some(b => b.definitionId === 'fearful');
        const arrows = v.hand.filter(c => c.definitionId === 'arrow').length;
        const spears = v.hand.filter(c => c.definitionId === 'spear').length;
        // If fearful and we don't have enough damage (only 1-2 dmg/turn) and enemy HP is high and player HP <= 15:
        if (fearful && target.hp > 8 && v.current.hp <= 15) {
          g.execute({ type: 'Retreat' });
          continue;
        }
      }

      // Play 0-AP arrows
      const arrow = v.hand.find(c => c.definitionId === 'arrow');
      if (arrow) { g.execute({ type: 'PlayCard', cardId: arrow.instanceId, targetId: target.instanceId }); continue; }

      // Clear pollution if AP >= 2
      const pollution = v.hand.find(c => c.definitionId === 'pollution');
      if (pollution && v.battleAp >= 2) { g.execute({ type: 'PlayCard', cardId: pollution.instanceId }); continue; }

      // Play spears (1 AP)
      const spear = v.hand.find(c => c.definitionId === 'spear');
      if (spear && v.battleAp >= 1) { g.execute({ type: 'PlayCard', cardId: spear.instanceId, targetId: target.instanceId }); continue; }

      // Play punch (1 AP)
      const punch = v.hand.find(c => c.definitionId === 'punch');
      if (punch && v.battleAp >= 1) {
        // Check if punch actually deals damage
        const fearful = v.buffs.some(b => b.definitionId === 'fearful');
        const originImmune = ORIGINS[v.originId]?.enemyBuffImmune;
        if (!fearful || originImmune || (v.stats.damage > 0)) {
          g.execute({ type: 'PlayCard', cardId: punch.instanceId, targetId: target.instanceId });
          continue;
        }
      }

      // End Battle Turn
      g.execute({ type: 'EndBattleTurn' });
      continue;
    }

    // --- 4. BATTLE DISCARD ---
    if (v.phase === 'battleDiscard') {
      const excess = v.excess;
      if (excess > 0) g.execute({ type: 'DiscardCards', cardIds: pickDiscards(v.hand, excess) });
      g.execute({ type: 'FinishDiscard' });
      continue;
    }

    // --- 5. VOYAGE DISCARD ---
    if (v.phase === 'discard') {
      const excess = v.excess;
      if (excess > 0) g.execute({ type: 'DiscardCards', cardIds: pickDiscards(v.hand, excess) });
      const fin = g.execute({ type: 'FinishDiscard' });
      if (!fin.ok) throw new Error('FinishDiscard error: ' + fin.errors.join('; '));
      continue;
    }
  }

  const finalView = g.getView();
  const res = finalView.result;
  let nextProfile = g.profile;

  // Auto-spend meta points in Profile between runs if enabled!
  if (autoMeta && nextProfile.points > 0) {
    const metaG = new GameSession(nextProfile);
    // Try unlocking Spear tech (cost 5), Raft upgrade (cost 8), AP (cost 10)
    if (!nextProfile.tech.includes('spear') && nextProfile.points >= 5) {
      metaG.execute({ type: 'UnlockTech', techId: 'spear' });
    }
    if (!nextProfile.purchases.raft && nextProfile.points >= 8) {
      metaG.execute({ type: 'BuyMeta', itemId: 'raft' });
    }
    if (!nextProfile.purchases.ap && nextProfile.points >= 10) {
      metaG.execute({ type: 'BuyMeta', itemId: 'ap' });
    }
    nextProfile = metaG.profile;
  }

  return {
    view: finalView,
    profile: nextProfile,
    result: res,
    battlesFought,
    turns: turnCount
  };
}

function pickDiscards(hand, count) {
  const discardable = hand.filter(c => {
    const kind = CARDS[c.definitionId]?.kind;
    const traits = CARDS[c.definitionId]?.traits || [];
    return kind !== 'negative' && !traits.includes('return') && !c.enchant.includes('return');
  });
  const score = c => {
    const def = c.definitionId;
    if (def === 'rope') return 10;
    if (def === 'cloth') return 9;
    if (def === 'iron') return 8;
    if (def === 'plastic') return 7;
    if (def === 'wood') return 6;
    if (def === 'corpse') return 5;
    if (def === 'food' || def === 'water') return 1;
    return 3;
  };
  discardable.sort((a, b) => score(b) - score(a));
  return discardable.slice(0, count).map(c => c.instanceId);
}
