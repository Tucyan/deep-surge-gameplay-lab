# Antigravity 工作交接记录

更新时间：2026-10-07（Asia/Singapore）  
工作目录：`玩法实验`  
当前分支：`codex/gameplay-v5-layers`  
交接状态：实现已完成第一轮，未提交 commit，未推送远程。

## 用户目标

正式应用《进一步的游戏设计优化措施.md》，并同步修改抽象层：涌泉先于航行；SAN 支付和概率事件更丰富；低库存节点不能无收益空转；随机损失、环境海况、藏品和多种节点选项布局接入；游戏结构先保持默认一层，同时为“每层多次航行、末站 Boss、以后多层”留出中性接口。休息节点必须完全免费，节点选项不能强制统一为三档模板。

## 已完成实现

- 首次及每个航行轮按“涌泉三张（春潮可加）→候选导航→启航→节点行动→结束航行→结算/弃牌”的顺序运行，启航不重复发牌。
- 休息节点的恢复、升级、附魔均为零 AP、零材料、零 HP/SAN、零燃料成本；不存在目标时只禁用对应选项，恢复仍可选。
- 保留多种选项布局：三项近等价投入加绕过、低库存补给、风暴回收/绕过、独立灯塔等；节点实例变体固定生成，查看、取消、预览不重掷。
- SAN 价格走完整支付路径，支付后至少保留 1；节点概率按支付前 SAN 判断，SAN > 80 的记忆事件保证藏品，否则 60%，视图显示支付前后数值和概率。
- 祭坛固定展示两件未持有普通藏品，先选藏品再选代价：随机失去 3 个合格实体卡单位、支付 8 HP、随机脱落合法外围筏格；禁止最后一格和割裂木筏，脱落格上的设备一起损失。可拒绝且不重抽。
- 已接入低库存路径：应急 SAN 补给、免费稳心、密封废料随机木头/塑料、风暴绕行降低当轮食水航耗；风暴轻损失败只使完好格破损，不会立即把已破损格变为脱落。
- 已接入八件普通藏品及触发记录：`emberWick`、`tideLens`、`headingNeedle`、`mendingNeedle`、`namedKnot`、`scavengerRing`、`emptyCompass`、`deepContract`。藏品机制、每轮/每层次数、侦察/固定航向/保护单位/待领取奖励均可序列化恢复。
- 已接入环境状态：迷雾 I/II/III、血月、混乱、顺流、逆流、春潮；最多 3 个环境、最多 2 个负面，迷雾 III 与混乱互斥。节点获得的环境下一轮生效；同状态刷新用 `pendingRefresh` 排队，不会少持续一轮。
- `src/core/layers.js` 提供中性层契约：`CONFIG.layers[{id,name,bossNodeId,minVoyages?,maxVoyages?}]`；运行时 `layers[{definitionId,length,completed}]`，另有 `layerIndex`、`layerVoyage`、全局 `voyage`。末站 Boss 固定，不受迷雾/混乱影响；跨层保留手牌、木筏、设备、数值和本局藏品，重建节点池与访问历史。默认仍只有 1 层，双层只在测试夹具验证，没有第二层内容。
- UI 已显示层进度、实际库存费用、随机损失池、爆格风险、环境持续、敌方意图、侦察/固定航向操作、藏品负面说明。浏览器旧配置警告已压缩为可读提示。

## 关键文件

- 规则核心：`src/core/session.js`、`src/core/nodes.js`、`src/core/layers.js`、`src/core/environment.js`、`src/core/node-costs.js`、`src/core/relic-rules.js`、`src/core/effects.js`、`src/core/raft.js`、`src/core/battle.js`。
- 内容和约束：`src/content/nodes.js`、`src/content/relics.js`、`src/content/rules.js`、`src/config/validation.js`、`config/default.json`。
- 表现和配置：`src/ui/app.js`、`src/ui/view.js`、`src/editor/app.js`、`src/editor/records.js`、`style.css`。
- 当前规则说明：`玩法重制/玩法.md`、`玩法重制/实验参数.md`、`玩法重制/系统分层.md`、`玩法重制/接口草稿.md`、`进一步的游戏设计优化措施.md`。
- 实现计划：`docs/superpowers/plans/2026-10-07-gameplay-v5-layers.md`。

## 验证结果

- `npm test`：120 项通过，0 失败。
- `npm run check`：40 个脚本语法检查通过，发布配置检查通过。
- `node scripts/audit-balance.mjs 6`：108 局，所有命令成功；事件/建设策略可支付事件为 324/330 = 98.2%，跳过事件策略为 264/270 = 97.8%。该报告是小样本试测，不是最终平衡结论。报告：`evidence/balance-audit-v5.json`。
- 浏览器服务器仍可用：`http://127.0.0.1:5080/`，由 `node server.mjs` 启动。已实际验证：固定种子首轮涌泉、免费休整、迷雾 II + 混乱 + 潮纹镜片侦察、祭坛三种代价、默认一层末站 Boss、战斗污染和轮末弃牌。
- 浏览器夹具：`evidence/browser-fog-fixture.json`、`evidence/browser-altar-fixture.json`、`evidence/browser-boss-fixture.json`。测试输出：`evidence/test-v5.txt`。

## 已知限制与下一步

- 尚未提交或推送；继续前先检查工作树，不要用 destructive git 命令覆盖现有改动。
- 默认只有一层；多层接口和跨层状态已验证，第二层主题、敌人、掉落和剧情尚未设计。
- 逆流已有处理，但当前默认环境随机权重未启用；更多环境组合、节点变体和长期平衡仍需试测。
- 目前发现的非阻断展示注意点已处理：合成费用显示使用 `recipeAvailability[id].cost`（包含逆流额外 AP）；藏品 drawback 布尔值显示为说明文字而不是 `true`。
- `git diff --check` 只剩已有换行风格警告，以及 `src/content/rules.js` 和 `tests/balance-audit.test.mjs` 文件末尾空行提示；不影响运行，但后续可统一格式。
- 不要把旧 v2/v3/v4 报告当作 v5 平衡结论；不要把默认一层以外的多层内容描述为已完成；不要把 `water-era` 首版代码改成这套实验规则。

## 建议接手命令

```powershell
Set-Location 'C:\Users\ALmerb\Desktop\MyProgram\yongxian\玩法实验'
npm test
npm run check
node scripts/audit-balance.mjs 6
npm start
```

继续开发时优先阅读本文件、`玩法重制/系统分层.md` 和 `玩法重制/接口草稿.md`，再查看 `docs/superpowers/plans/2026-10-07-gameplay-v5-layers.md` 的未完成项。若需要提交，建议先保留当前分支并由接手者自行决定 commit 边界。
