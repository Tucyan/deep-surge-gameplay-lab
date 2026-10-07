# Gameplay v5 and layers Implementation Plan

> **For agentic workers:** Use test-driven implementation and independent, explicitly scoped workers for content/configuration and presentation. Review specification compliance before code quality. Execute continuously; the user has authorized implementation.

**Goal:** Apply 进一步的游戏设计优化措施.md in the gameplay experiment, keeping one playable layer while supporting a neutral multi-layer structure.

**Architecture:** JSON content stays separate from state and deterministic rule commands. Layer definitions live in CONFIG.layers; runtime layer progress is independent of global voyage and battle clocks. New node outcomes, environmental effects and relic triggers use small core modules; views filter hidden information.

**Tech Stack:** JavaScript ES modules, Node built-in tests, existing static browser UI; no dependencies or downloads.

## Contract

- Version gameplay-experiment-v5, schema 1, xorshift32-v1. CONFIG.layers is a nonempty array of {id,name,bossNodeId,minVoyages?,maxVoyages?}; default only layer1 with boss. Global min/max remain fallback per layer.
- Runtime layers [{definitionId,length,completed}], layerIndex zero based, layerVoyage one based, voyage global, length current layer length. End-of-layer Boss must be defeated to advance; final layer completes the run. Per-layer pools/visits reset, hand/equipment/relics persist.
- NewGame and FinishDiscard start a round: activate environment, award spring once, then generate candidates. SubmitVoyage only chooses actual arrival and refreshes base AP.
- Option fields: statCosts {hp?,sanity?}; randomCardCost integer; detachCell boolean; outcomes [{weight,effects}]; successCondition {stat,operator,value}; special includes relicChance, altar; relicProbability in [0,1]. Node variants are [{id,name,description,options}], generated once per candidate. Rest options all zero cost and no material/stat/random/raft costs.
- Env BUFFS use environment:true and one supported mechanic: fog, bloodMoon, confusion, headwind, current, spring. Parameters fogLevel, chance, amount and normal duration. CONFIG.environment {chance,negativeChance,maxActive,maxNegative,weights}. Env instances track activeFrom; clocks advance exactly once per voyage, nodes schedule next-round activation.
- Relics use mechanic enum ember, scout, heading, repair, protect, salvage, lightHand, contract plus optional drawback:true. Commands ScoutNode {candidateId,method:'sanity'|'relic'}, FixHeading {method:'wood'|'relic'}, ChooseOption supports relicId and protectedCardId; ClaimRelic accepts/rejects fixed pending reward. View includes optionStatus, navigation summaries, altarChoices, sacrificeCandidates, detachableCells, relicUsage and sanitized candidates.

## Tasks and verification

- [x] Add tests for pre-navigation spring, free rest, layers, stat prices, seeded node outcomes, sacrifice, information filtering, navigation deviations, environments and eight relic mechanics. `npm test` passes.
- [x] Content/configuration worker: modify content, validation, editor support and regenerate `config/default.json`.
- [x] Core: add layers/environment/relic/node-cost modules, integrate session/nodes/effects/raft/battle, transaction rollback and restore validation.
- [x] Presentation worker: add layer/round status, inventory cost previews, free rest, masked candidates, scout/heading, random costs, altar protection, drawback text, environmental duration and enemy intent.
- [x] Update regression assertions and simulation selection for v5 behavior and layer Boss boundaries.
- [x] Run automated checks, deterministic simulation, review fixes, and browser-play the default layer plus fog/altar/Boss fixtures.
- [x] Update current rule, parameter, layer, interface, README and optimization documents. Balance remains provisional; no commit or push requested.

## Acceptance examples

```js
const g = new GameSession();
g.execute({type:'NewGame',seed:17,originId:'strong'});
assert.equal(g.getView().hand.length,7); // four original cards plus spring, before navigating
const before = g.serialize();
assert.equal(g.execute({type:'SubmitVoyage',nodeId:'invalid'}).ok,false);
assert.deepEqual(g.serialize(),before);
```

```js
// Free rest also works with zero AP and no material cards.
assert.equal(g.execute({type:'ChooseOption',optionId:'rest'}).ok,true);
assert.equal(g.getView().ap,0);
```

Tests include SAN 80/81, pearl/fool prices, insufficient protected sacrifice pool, connected raft loss, reveal without reroll, Boss no deviation, two-layer fixture (default remains one), delayed environment onset, charge persistence and no double spring.
