import { GameSession, createProfile } from '../src/core/session.js';
import { CARDS, RECIPES, SPRING_POOL, NODES, ORIGINS } from '../src/content/index.js';

export function simulateRun({ seed = 1, originId = 'strong', profile = createProfile(), logDetail = false }) {
  const g = new GameSession(profile);
  // Paid events may be unavailable after preparing equipment; take the explicit leave option.
  function chooseNode(command) {
    if (g.preview(command).ok) return g.execute(command);
    return g.execute({type:'ChooseOption',optionId:'leave'});
  }
  const startRes = g.execute({ type: 'NewGame', seed, originId });
  if (!startRes.ok) {
    throw new Error('Failed to start game: ' + startRes.errors.join('; '));
  }

  const logs = [];
  function log(msg) {
    if (logDetail) console.log(msg);
    logs.push(msg);
  }

  let turnGuard = 0;
  const maxTurns = 500;

  while (g.getView().phase !== 'finished' && turnGuard++ < maxTurns) {
    const v = g.getView();

    // 1. Navigation Phase
    if (v.phase === 'navigation') {
      const candidates = v.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in navigation phase');
      }

      // Decision for node:
      let chosenNode = candidates[0];
      if (candidates.length === 1 && candidates[0].id === 'boss') {
        chosenNode = candidates[0];
      } else {
        // Evaluate candidates
        // Need rest?
        const needRest = v.current.hp <= 18 || v.current.hunger <= 35 || v.current.hydration <= 35 || v.current.sanity <= 35;
        const camp = candidates.find(c => c.id === 'camp');
        const drift = candidates.find(c => c.id === 'drift');
        const battle = candidates.find(c => c.kind === 'battle');
        const ruin = candidates.find(c => c.kind === 'ruin');
        const shop = candidates.find(c => c.kind === 'shop');
        const jelly = candidates.find(c => c.kind === 'exchange');

        if (needRest && camp) {
          chosenNode = camp;
        } else if (v.voyage <= 3 && drift) {
          chosenNode = drift;
        } else if (camp) {
          chosenNode = camp;
        } else if (drift) {
          chosenNode = drift;
        } else if (shop && (v.hand.some(c => c.definitionId === 'coin' && c.quantity >= 3) || v.hand.some(c => c.definitionId === 'corpse'))) {
          chosenNode = shop;
        } else if (battle) {
          chosenNode = battle;
        } else if (ruin && v.current.hp >= 20) {
          chosenNode = ruin;
        } else if (jelly) {
          chosenNode = jelly;
        } else {
          chosenNode = candidates[0];
        }
      }

      log(`[Voyage ${v.voyage}/${v.length}] Navigating to: ${chosenNode.name} (${chosenNode.id}) | HP:${v.current.hp} H:${v.current.hunger} W:${v.current.hydration} S:${v.current.sanity}`);
      const navRes = g.execute({ type: 'SubmitVoyage', nodeId: chosenNode.id });
      if (!navRes.ok) throw new Error('Nav failed: ' + navRes.errors.join('; '));
      continue;
    }

    // 2. Action Phase
    if (v.phase === 'action') {
      let acted = false;

      // 2a. Drink / Eat / Calm if needed (0 AP)
      for (const card of v.hand) {
        if (card.definitionId === 'water' && v.current.hydration <= 75) {
          g.execute({ type: 'PlayCard', cardId: card.instanceId });
          acted = true;
          break;
        }
        if (card.definitionId === 'food' && v.current.hunger <= 75) {
          g.execute({ type: 'PlayCard', cardId: card.instanceId });
          acted = true;
          break;
        }
        if (card.definitionId === 'calm' && v.current.sanity <= 70) {
          g.execute({ type: 'PlayCard', cardId: card.instanceId });
          acted = true;
          break;
        }
      }
      if (acted) continue;

      // 2b. Fuel Lamp if installed and fuel <= 1
      const lampCell = v.cells.find(c => c.state === 'intact' && c.equipment?.definitionId === 'lamp');
      if (lampCell && lampCell.equipment.fuel <= 1) {
        const corpse = v.hand.find(c => c.definitionId === 'corpse');
        const wood = v.hand.find(c => c.definitionId === 'wood');
        if (corpse) {
          g.execute({ type: 'FuelLamp', equipmentId: lampCell.equipment.instanceId, cardId: corpse.instanceId });
          continue;
        } else if (wood && v.hand.filter(c => c.definitionId === 'wood').reduce((s, c) => s + c.quantity, 0) >= 2) {
          g.execute({ type: 'FuelLamp', equipmentId: lampCell.equipment.instanceId, cardId: wood.instanceId });
          continue;
        }
      }

      // 2c. Repair damaged cell
      const damagedCell = v.cells.find(c => c.state === 'damaged');
      if (damagedCell && v.ap >= 1 && v.hand.some(c => c.definitionId === 'wood')) {
        g.execute({ type: 'RepairCell', cellId: damagedCell.id });
        continue;
      }

      // 2d. Medkit heal if HP <= 20
      const medkitCell = v.cells.find(c => c.state === 'intact' && c.equipment?.definitionId === 'medkit');
      if (medkitCell && v.current.hp <= 22 && v.ap >= 1) {
        g.execute({ type: 'ActivateEquipment', equipmentId: medkitCell.equipment.instanceId });
        continue;
      }

      // 2e. Install equipment from hand if empty intact cell exists and AP >= 1
      const equipInHand = v.hand.find(c => CARDS[c.definitionId]?.kind === 'equipment');
      const emptyCell = v.cells.find(c => c.state === 'intact' && !c.equipment);
      if (equipInHand && emptyCell && v.ap >= (equipInHand.cost || 1)) {
        const res = g.execute({ type: 'PlayCard', cardId: equipInHand.instanceId, targetId: emptyCell.id });
        if (res.ok) continue;
      }

      // 2f. Craft needed equipment if AP >= 1 and empty intact cell exists (or will exist)
      const installedDefIds = v.cells.filter(c => c.state === 'intact' && c.equipment).map(c => c.equipment.definitionId);
      const handDefIds = v.hand.map(c => c.definitionId);
      const craftPriority = ['filter', 'planter', 'lamp', 'crossbow', 'medkit', 'spearRack'];
      
      let crafted = false;
      if (v.ap >= 1 && (emptyCell || v.cells.filter(c => c.state === 'intact').length < 6)) {
        for (const req of craftPriority) {
          if (!installedDefIds.includes(req) && !handDefIds.includes(req)) {
            if (v.recipeAvailability[req]?.canCraft) {
              const res = g.execute({ type: 'Craft', recipeId: req });
              if (res.ok) {
                log(`Crafted ${req}`);
                crafted = true;
                break;
              }
            }
          }
        }
      }
      if (crafted) continue;

      // 2g. Expand raft if full and have 2 wood & 1 AP
      if (!emptyCell && v.ap >= 1 && v.hand.filter(c => c.definitionId === 'wood').reduce((s, c) => s + c.quantity, 0) >= 2) {
        if (v.expansionOptions && v.expansionOptions.length > 0) {
          const opt = v.expansionOptions[0];
          const res = g.execute({ type: 'ExpandRaft', x: opt.x, z: opt.z });
          if (res.ok) {
            log(`Expanded raft to (${opt.x}, ${opt.z})`);
            continue;
          }
        }
      }

      // 2h. Upgrade equipment if available and AP >= 1
      if (v.ap >= 1 && v.upgradeOptions && v.upgradeOptions.length > 0) {
        const u = v.upgradeOptions[0];
        const res = g.execute({ type: 'UpgradeEquipment', targetId: u.targetId, materialId: u.materialId });
        if (res.ok) {
          log(`Upgraded equipment ${u.label}`);
          continue;
        }
      }

      // 2i. Resolve Node if not resolved yet
      if (v.node && !v.node.resolved) {
        if (['battle', 'ruin'].includes(v.node.kind)) {
          log(`Entering battle at ${v.node.name} (${v.node.monster})`);
          const res = g.execute({ type: 'EnterNode' });
          if (!res.ok) throw new Error('Enter battle failed: ' + res.errors.join('; '));
          continue;
        }

        if (v.node.kind === 'supply') { // drift
          // Choose wood or metal
          const hasWood = v.hand.filter(c => c.definitionId === 'wood').reduce((s, c) => s + c.quantity, 0);
          const optId = hasWood < 3 ? 'wood' : 'metal';
          chooseNode({ type: 'ChooseOption', optionId: optId });
          continue;
        }

        if (v.node.kind === 'rest') { // camp
          // Options: rest, upgrade, enchant, leave
          const needStatRest = v.current.hp <= 24 || v.current.hunger <= 60 || v.current.hydration <= 60 || v.current.sanity <= 60;
          const upgradeableCell = v.cells.find(c => c.state === 'intact' && c.equipment && c.equipment.level < 3);
          
          if (needStatRest) {
            chooseNode({ type: 'ChooseOption', optionId: 'rest' });
          } else if (upgradeableCell) {
            chooseNode({ type: 'ChooseOption', optionId: 'upgrade', equipmentId: upgradeableCell.equipment.instanceId });
          } else {
            const punch = v.hand.find(c => c.definitionId === 'punch' && !c.enchant.includes('instant'));
            if (punch) {
              chooseNode({ type: 'ChooseOption', optionId: 'enchant', cardId: punch.instanceId, enchant: 'instant' });
            } else {
              chooseNode({ type: 'ChooseOption', optionId: 'rest' });
            }
          }
          continue;
        }

        if (v.node.kind === 'shop') { // trader
          // Try buying filter/planter/crossbow/relic if can afford
          let bought = false;
          for (const item of (v.shop || [])) {
            const coinCount = v.hand.filter(c => c.definitionId === 'coin').reduce((s, c) => s + c.quantity, 0);
            const corpseCount = v.hand.filter(c => c.definitionId === 'corpse').reduce((s, c) => s + c.quantity, 0);
            if (coinCount >= item.price) {
              const res = g.execute({ type: 'ShopBuy', itemId: item.id, payment: 'coin' });
              if (res.ok) { bought = true; break; }
            } else if (corpseCount >= Math.ceil(item.price / 2)) {
              const res = g.execute({ type: 'ShopBuy', itemId: item.id, payment: 'corpse' });
              if (res.ok) { bought = true; break; }
            }
          }
          if (!bought) {
            chooseNode({ type: 'ChooseOption', optionId: 'leave' });
          }
          continue;
        }

        if (v.node.kind === 'exchange') { // jelly
          if (v.current.hp >= 25) {
            chooseNode({ type: 'ChooseOption', optionId: 'blood' });
          } else {
            chooseNode({ type: 'ChooseOption', optionId: 'leave' });
          }
          continue;
        }

        if (v.node.kind === 'environment') { // storm
          chooseNode({ type: 'ChooseOption', optionId: 'leave' });
          continue;
        }

        // Default option
        if (v.node.options && v.node.options.length > 0) {
          chooseNode({ type: 'ChooseOption', optionId: v.node.options[0].id });
          continue;
        }
      }

      // 2j. End Voyage if node is resolved!
      if (v.node && v.node.resolved) {
        // Pending enchant check
        if (v.pendingEnchant > 0) {
          const cardToEnchant = v.hand.find(c => ['combat', 'survival', 'action'].includes(CARDS[c.definitionId]?.kind) && !c.enchant.includes('instant'));
          if (cardToEnchant) {
            g.execute({ type: 'EnchantCard', cardId: cardToEnchant.instanceId, enchant: 'instant' });
          }
        }

        // Before ending voyage, drink/eat if needed
        for (const card of v.hand) {
          if (card.definitionId === 'water' && v.current.hydration <= 70) g.execute({ type: 'PlayCard', cardId: card.instanceId });
          if (card.definitionId === 'food' && v.current.hunger <= 70) g.execute({ type: 'PlayCard', cardId: card.instanceId });
        }

        log(`Ending voyage ${v.voyage}. HP:${v.current.hp} H:${v.current.hunger} W:${v.current.hydration} S:${v.current.sanity}`);
        const endRes = g.execute({ type: 'EndVoyage' });
        if (!endRes.ok) throw new Error('EndVoyage failed: ' + endRes.errors.join('; '));
        continue;
      }
    }

    // 3. Battle Phase
    if (v.phase === 'battle') {
      const enemies = v.battle.enemies.filter(e => e.hp > 0);
      if (enemies.length === 0) {
        throw new Error('Battle with 0 enemies');
      }
      const target = enemies[0];

      // Priority 1: 0-cost combat cards (arrow)
      const arrow = v.hand.find(c => c.definitionId === 'arrow');
      if (arrow) {
        g.execute({ type: 'PlayCard', cardId: arrow.instanceId, targetId: target.instanceId });
        continue;
      }

      // Priority 2: Clear pollution if battleAp >= 2
      const pollution = v.hand.find(c => c.definitionId === 'pollution');
      if (pollution && v.battleAp >= 2) {
        g.execute({ type: 'PlayCard', cardId: pollution.instanceId });
        continue;
      }

      // Priority 3: Spear (1 AP, 4 dmg)
      const spear = v.hand.find(c => c.definitionId === 'spear');
      if (spear && v.battleAp >= 1) {
        g.execute({ type: 'PlayCard', cardId: spear.instanceId, targetId: target.instanceId });
        continue;
      }

      // Priority 4: Punch (1 AP, 1 dmg, return)
      const punch = v.hand.find(c => c.definitionId === 'punch');
      if (punch && v.battleAp >= 1) {
        g.execute({ type: 'PlayCard', cardId: punch.instanceId, targetId: target.instanceId });
        continue;
      }

      // No more attacks can be made, end battle turn
      log(`End battle turn ${v.battle.round}. Enemy HP: ${target.hp}/${target.maxHp}, Player HP: ${v.current.hp}`);
      const bRes = g.execute({ type: 'EndBattleTurn' });
      if (!bRes.ok) throw new Error('EndBattleTurn failed: ' + bRes.errors.join('; '));
      continue;
    }

    // 4. Battle Discard Phase
    if (v.phase === 'battleDiscard') {
      const excess = v.excess;
      if (excess > 0) {
        const discards = pickDiscards(v.hand, excess);
        g.execute({ type: 'DiscardCards', cardIds: discards });
      }
      g.execute({ type: 'FinishDiscard' });
      continue;
    }

    // 5. Discard Phase
    if (v.phase === 'discard') {
      const excess = v.excess;
      if (excess > 0) {
        const discards = pickDiscards(v.hand, excess);
        g.execute({ type: 'DiscardCards', cardIds: discards });
      }
      const finRes = g.execute({ type: 'FinishDiscard' });
      if (!finRes.ok) throw new Error('FinishDiscard failed: ' + finRes.errors.join('; '));
      continue;
    }
  }

  const finalView = g.getView();
  return {
    view: finalView,
    profile: g.profile,
    result: finalView.result,
    voyages: finalView.voyage,
    turns: turnGuard,
    logs
  };
}

function pickDiscards(hand, count) {
  // Discard priority: excess resources (rope, iron, cloth, plastic, wood)
  // Protect: food, water, equipment, weapons, coins
  const discardable = hand.filter(c => {
    const kind = CARDS[c.definitionId]?.kind;
    const traits = CARDS[c.definitionId]?.traits || [];
    return kind !== 'negative' && !traits.includes('return') && !c.enchant.includes('return');
  });

  // Sort by priority to discard:
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
