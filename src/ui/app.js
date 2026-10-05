import { GameSession } from '../core/session.js';
import { CARDS, SPRING_POOL, EQUIPMENT, RECIPES, ORIGINS, RELICS, BUFFS, META_SHOP, TECH, NODES, MONSTERS, CONFIG, DIARIES, ENDINGS } from '../content/index.js';
import { newestVoyageLogs, parseSeed, canConfirmDiscard, purchaseStatus, nodeOptionCost, treatmentCost, canUseProfileActions } from './view.js';
import {loadPublishedConfig,loadAppliedConfig,saveAppliedConfig,getActiveConfig,clearAppliedConfig} from '../config/store.js';
import {parseConfig} from '../config/validation.js';

const publishedConfig=await loadPublishedConfig();
const appliedConfig=loadAppliedConfig();
let configWarning=[...(!publishedConfig.ok?publishedConfig.errors:[]),...(!appliedConfig.ok?appliedConfig.errors:[])].map(e=>e.message).join('；');
const STORAGE_KEY = `deep-surge-gameplay-lab-save-v1-${CONFIG.contentVersion}`;
const editorUrl=location.pathname.startsWith('/deep-surge-lab/')?'/deep-surge-editor/':'./editor/';
const $ = (s) => document.querySelector(s);
const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entries = map => Object.entries(map || {});
const defs = map => entries(map).map(([id, d]) => ({...d, id:d.id || id}));
const name = (map,id) => map?.[id]?.name || id;
const button = (label,action,disabled=false,cls='',data='') => `<button type="button" data-action="${action}" ${disabled?'disabled':''} class="${cls}" ${data}>${esc(label)}</button>`;
const tagged = (id,key='id') => `data-${key}="${esc(id)}"`;
let session = new GameSession();
let view = session.getView();
let selectedCard = null, selectedTarget = null, selectedCandidate = null;
let discarded = new Set(), modal = null, catalogueTab = 'cards', toastTimer;
let saveAvailable = false, saveFailure = '', restoredRun = false;
let homeSeed = String(Math.floor(Math.random()*2147483647)), homeOrigin = defs(ORIGINS)[0]?.id || '';
let logScroll = 0, handScroll = 0, stageScroll = 0, raftScroll = 0;

function toast(message,error=false) {
  const el = $('#toast');
  el.textContent = message; el.className = `show${error?' error':''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>{el.className='';},error?7000:3500);
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(session.serialize())); saveAvailable=true; saveFailure=''; }
  catch (e) { saveFailure='存档未能保存，请导出航行记录以免丢失。'; toast(saveFailure,true); }
}
function initialSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return;
    session = GameSession.restore(JSON.parse(raw)); view=session.getView();
    saveAvailable=true; restoredRun = !['home','finished'].includes(view.phase);
    if(view.phase==='discard' && canConfirmDiscard(view)){
      try {
        const autoRes=session.execute({type:'FinishDiscard'});
        if(autoRes.ok){ view=autoRes.view || session.getView(); persist(); }
      } catch {}
    }
  } catch(e) { saveFailure=`旧存档无法读取：${e.message || '内容损坏'}。可导入另一份记录。`; }
}
function run(command) {
  let result;
  try { result=session.execute(command); }
  catch(e) { toast(`操作失败：${e.message}`,true); return false; }
  if (!result.ok) { toast((result.errors || ['暂时无法执行']).join('；'),true); return false; }
  view=result.view || session.getView(); persist();
  if(view.phase==='discard' && canConfirmDiscard(view)){
    try {
      const autoRes=session.execute({type:'FinishDiscard'});
      if(autoRes.ok){
        view=autoRes.view || session.getView();
        persist();
        if(command.type==='DiscardCards'){
          toast('手牌已满足容量，已自动确认继续');
        } else if(command.type==='EndVoyage'){
          toast('手牌未超限，已自动进入下一航程');
        }
      }
    } catch {}
  }
  const ids=new Set((view.hand || []).map(c=>c.instanceId));
  if (!ids.has(selectedCard)) selectedCard=null;
  discarded=new Set([...discarded].filter(id=>ids.has(id)));
  const targets=[...(view.cells || []).map(c=>c.id),...(view.cells || []).map(c=>c.equipment?.instanceId),...(view.battle?.enemies || []).map(e=>e.instanceId)];
  if (!targets.includes(selectedTarget)) selectedTarget=null;
  if (view.phase!=='discard') discarded.clear();
  if(modal?.type==='nodeShop'&&view.node?.resolved)modal=null;
  if(command.type==='SubmitVoyage'&&view.node?.kind==='shop'&&!view.node.resolved)modal={type:'nodeShop'};
  restoredRun=false; render(); return true;
}
const card = () => (view.hand || []).find(c=>c.instanceId===selectedCard);
const cell = () => (view.cells || []).find(c=>c.id===selectedTarget || c.equipment?.instanceId===selectedTarget);
const equipment = () => cell()?.equipment;
const isBattle = () => view.phase==='battle';
const isDiscard = () => view.phase==='discard';
const canAct = () => view.phase==='action';
const enchantable = () => ['combat','survival','action'].includes(card()?.kind);
function canPlaySelected(){
  const c=card();if(!c)return false;
  if((isBattle()?view.battleAp:view.ap)<c.cost)return false;
  if(canAct())return ['survival','equipment','action'].includes(c.kind);
  if(view.phase==='battle')return ['survival','combat','negative'].includes(c.kind);
  return false;
}

function header(home=false) {
  return `<header class="topbar"><div><div class="brand">深涌 <span class="badge">玩法实验</span></div><div class="subtitle">${home?'平衡试测 · 每次航行都留下新的线索':`第 ${view.voyage || 0} / ${view.length || CONFIG?.voyages || '—'} 次航行 · ${isBattle()?`战斗第 ${view.battle?.round || 1} 回合`:{navigation:'选择航线',action:'节点行动',discard:'整理行囊',finished:'航行结束'}[view.phase] || '航行准备'}`}</div></div><div class="row">${!home?`<span class="badge">${isBattle()?'战斗 AP':'AP'} ${isBattle()?view.battleAp:view.ap ?? 0}</span><span class="badge">等级 ${view.level || 1} · 经验 ${view.xp || 0}</span>`:''}${saveFailure?`<span class="save-warning">${esc(saveFailure)}</span>`:''}${button('图鉴','catalogue',false,'quiet')}${button('记录','saveMenu',false,'quiet')}${button('玩法说明','help',false,'quiet')}${button('玩法配置','contentConfig',false,'quiet')}<a class="badge" href="${editorUrl}" target="_blank" rel="noopener">策划工具 ↗</a>${!home?button('返回首页','homeMenu',false,'quiet'):''}</div></header>`;
}
function home() {
  const active=!['home','finished'].includes(view.phase);
  return `<main class="screen home">${header(true)}<div class="home-body"><section class="home-intro"><span class="gold">一叶筏 · 一片未知的海</span><h1>深涌</h1><p>涌泉带来物资，航线决定遭遇。照看饥渴与理智，搭建设备，带着有限的行动点走向下一场风浪。</p><p>这是可独立游玩的规则实验。数值仍在试测，选择出身并输入种子，开启一段可重现的航行。</p><div class="row"><span class="badge">筏格与设备</span><span class="badge">独立战斗</span><span class="badge">局外成长</span></div></section><section class="panel home-menu"><div class="panel-head"><h2>准备启航</h2><span class="gold">涌潮点 ${view.profile?.points || 0}</span></div><div class="panel-body"><label>出身<select id="origin">${defs(ORIGINS).map(o=>`<option value="${esc(o.id)}" ${homeOrigin===o.id?'selected':''}>${esc(o.name)}</option>`).join('')}</select><small id="origin-description">${esc(ORIGINS[homeOrigin]?.description || '')}</small></label><label>航行种子<div class="row"><input class="grow" id="seed" inputmode="numeric" type="number" min="0" max="4294967295" value="${esc(homeSeed)}">${button('随机','randomSeed',false,'quiet')}</div><small>相同种子与相同选择会带来相同的遭遇。</small></label><div class="main-buttons">${button('新的航行','newGame',false,'primary')}${button(active?'继续航行':'继续', 'continue',!active)}</div>${active?'<small>已保存一段进行中的航行。开始新的航行会替换它。</small>':saveAvailable?'<small>上一次航行已结束，可以开启新的旅途。</small>':'<small>暂无进行中的航行。</small>'}<div class="row home-bottom">${button('海怪商店','meta')}${button('科技树','tech')}${button('图鉴','catalogue')}</div><div class="row muted"><small>已启航 ${view.profile?.runs || 0} 次</small><small>已完成节点 ${Array.isArray(view.profile?.completedNodes)?view.profile.completedNodes.length:view.profile?.completedNodes || 0}</small></div></div></section></div></main>`;
}
function meters() {
  const items = [
    ['hp', '❤️ 生命'],
    ['hunger', '🍖 饱食'],
    ['hydration', '💧 水分'],
    ['sanity', '🧠 理智']
  ];
  return `<section class="status" aria-label="生存状态">${items.map(([k, label]) => {
    const val = view.current?.[k] ?? 0, max = view.stats?.[`${k}Max`] || 100;
    const pct = Math.max(0, Math.min(100, Math.round(val / max * 100)));
    const isDanger = (k === 'hp' && pct <= 35) || (k !== 'hp' && val <= 25);
    return `<div class="meter ${k} ${isDanger ? 'danger-alert' : ''}" title="${label}：${val}/${max} (${pct}%)"><div class="meter-title"><span class="meter-label">${label}</span><span class="meter-val">${val} <small>/ ${max}</small></span></div><div class="meter-track"><div class="meter-fill" style="width:${pct}%"></div></div>${isDanger ? `<span class="meter-warn-tag">${k==='hp'?'濒危':k==='hunger'?'饥饿':k==='hydration'?'脱水':'迷失'}</span>` : ''}</div>`;
  }).join('')}</section>`;
}
function log() {
  return `<section class="panel log-panel"><div class="panel-head"><h2>航行日志</h2><small>最新在上</small></div><div class="panel-body log-body" id="log-body">${newestVoyageLogs(view.log).map((v,i)=>`<details data-log-key="v${v.voyage}" ${i===0?'open':''}><summary>第 ${v.voyage} 次航行</summary>${v.groups.map((g,j)=>`<details data-log-key="v${v.voyage}-g${j}" open><summary>${esc(g.name)}</summary>${g.entries.map(e=>`<div class="log-entry">${esc(typeof e==='string'?e:e.text || e.message || JSON.stringify(e))}</div>`).join('')}</details>`).join('')}</details>`).join('') || '<p class="empty">海面尚未留下记录。</p>'}</div></section>`;
}
function stage() {
  let content='', footer='';
  if (view.phase==='navigation') {
    content=`<p class="muted">选择下一处停靠点，出发后领取三张涌泉资源。池内节点允许重复；选中只消耗一份，未选份数保留，已选类型降低抽取权重。本层普通池剩余 ${view.nodePool.length} 份，初始为 ${CONFIG.nodePoolMultiplier} 倍普通航程。</p><div class="node-grid">${(view.candidates || []).map(n=>`<button class="node-card candidate ${selectedCandidate===n.id?'selected':''}" data-action="candidate" ${tagged(n.id)}><span class="node-name">${esc(n.name)}</span><span class="badge ${n.kind==='battle'||n.kind==='boss'?'red':n.kind==='rest'?'gold':''}">${esc(nodeKind(n.kind))}</span><span class="card-description">${esc(n.description)}</span></button>`).join('')}</div>`;
    footer=button('启航','submitVoyage',!selectedCandidate,'primary');
  } else if (isBattle()) {
    content=`<div class="row between"><h3>${esc(view.node?.name || (view.battle?.boss?'深海首领':'海上遭遇'))}</h3><span class="badge red">${view.battle?.ruin?'遗迹战斗':'战斗'} · ${view.battle?.enemies?.length || 0} 个目标</span></div><p class="muted">先选手牌，再选敌人或筏格。敌方意图在回合结束时生效。</p><div class="enemy-list">${(view.battle?.enemies || []).map((e,i)=>{const pct=Math.max(0,Math.min(100,Math.round((e.hp/e.maxHp)*100)));return `<button class="enemy-card ${selectedTarget===e.instanceId?'selected':''}" data-action="target" ${tagged(e.instanceId)} ${e.hp<=0?'disabled':''}><span class="row between"><strong>${esc(e.name)}</strong><small>目标 ${i+1}</small></span><div class="row between"><span>生命 ${e.hp} / ${e.maxHp}</span><small>${pct}%</small></div><div class="enemy-hp-track"><div class="enemy-hp-fill" style="width:${pct}%"></div></div><span class="enemy-intent">意图：${esc(intent(e.intent))}</span>${e.damage!=null?`<small class="muted">单次伤害 ${esc(e.damage)}</small>`:''}</button>`;}).join('')}</div>`;
    footer=button('结束战斗回合','endBattle',view.phase!=='battle','primary')+button('撤退','retreat',view.phase!=='battle','danger');
  } else if (view.phase==='discard') {
    content=discardPrompt(); footer=discardFooter();
  } else if (view.phase==='finished') {
    content=`<div class="node-card"><span class="node-name">${esc(view.result?.name || '航行结束')}</span><p>${esc(view.result?.description || '')}</p><p class="gold">获得涌潮点 ${view.result?.points || 0}</p></div><p class="muted">记录已经保存。回到首页，查看图鉴与局外成长。</p>`;footer=button('回到首页','returnHome',false,'primary');
  } else {
    const node=view.node;
    content=`<div class="node-card"><span class="node-name">${esc(node?.name || '航行准备')}</span><p class="card-description">${esc(node?.description || '检查物资、设备和筏格，再开始探索。')}</p><span class="muted">${node?.resolved?'节点已完成 · 点击结束本次航行后结算':'节点等待探索'}</span></div>${!node?.resolved && (node?.options || []).length?`<div class="node-grid">${node.options.map(o=>{const fee=nodeOptionCost(view,o);return `<div class="node-card"><strong>${esc(o.name)}</strong><p class="card-description">${esc(o.description)}</p><small>投入 ${esc(fee.summary)}</small>${fee.reason?`<small class="muted">${esc(fee.reason)}</small>`:''}${button('选择','option',!fee.canChoose,'',tagged(o.id))}</div>`;}).join('')}</div>`:''}${!node?.resolved && ['battle','ruin'].includes(node?.kind)?button('进入遭遇','enterNode',false,'primary'):''}`;
    if(node?.kind==='shop' && !node.resolved)content= `<div class="node-card"><span class="node-name">${esc(node.name)}</span><p>${esc(node.description)}</p>${button('打开交易','nodeShop',false,'primary')}</div>`;
    if(view.ap===0)content+='<p class="notice">AP已用完，仍可使用淡水、食物等0 AP牌及免费操作。准备好后点击结束本次航行。</p>';
    footer=button('结束本次航行','endVoyage',!node?.resolved,'primary');
  }
  return `<section class="panel stage-panel"><div class="panel-head"><h2>${isBattle()?'战场':view.phase==='navigation'?'航线':view.phase==='discard'?'整理行囊':'当前节点'}</h2>${canAct()?button('合成','craft',false,'quiet'):''}</div><div class="panel-body stage-body" id="stage-body">${content}</div><div class="stage-footer">${footer}</div></section>`;
}
function intent(value) { return typeof value==='string'?value:value?.description || value?.name || (value?JSON.stringify(value):'待定'); }
function nodeKind(k) {return {combat:'⚔️ 战斗',battle:'⚔️ 战斗',event:'📜 事件',rest:'⛺ 休整',exchange:'🔄 交换',environment:'🌊 环境',camp:'⛺ 营地',ruin:'🏛️ 遗迹',shop:'🐙 交易',spring:'💧 涌泉',boss:'👁️ 首领',supply:'📦 补给',treasure:'💎 宝物'}[k] || k || '探索';}
function discardPrompt() {
  return `<div class="notice">航行结束整理：容量 ${view.capacity ?? view.hand?.length ?? 0} / ${view.stats?.handLimit || 0}。${view.excess>0?`超出 ${view.excess} 张，请勾选丢弃（降至上限后自动确认推进）。`:'已满足容量限制，正在自动进入下一阶段…'}</div><p class="muted">点击手牌可选中；弃牌满足容量上限后将自动确认继续。负面牌需消耗 AP 清除。</p>`;
}
function discardFooter(){
  const canDiscard = discarded.size > 0;
  return button(`丢弃选中 (${discarded.size})`,'discard',!canDiscard,'primary')+(canConfirmDiscard(view)?button('确认整理','finishDiscard',false,'quiet'):'');
}
function hand() {
  const c=card();
  const currentAp=isBattle()?view.battleAp:view.ap;
  let guideHint='';
  if(c){
    if(c.kind==='equipment')guideHint='<span class="guide-hint">💡 放置指引：在右侧木筏上点击任意【完好空格】以安装</span>';
    else if(c.definitionId==='repair')guideHint='<span class="guide-hint">💡 修补指引：在右侧木筏上点击【破损格】进行修复</span>';
    else if(c.definitionId==='dismantle')guideHint='<span class="guide-hint">💡 拆除指引：在右侧木筏上点击【已安装设备】进行拆除回收</span>';
    else if(c.kind==='combat')guideHint='<span class="guide-hint">💡 战斗指引：在上方战场点击存活敌人锁定目标</span>';
    else if(CARDS[c.definitionId]?.fuel)guideHint='<span class="guide-hint">💡 投料指引：点击右侧木筏上的【灯】后点击添燃料</span>';
  }
  return `<section class="panel hand-panel"><div class="panel-head"><h2>手牌 <small>${view.capacity ?? view.hand?.length ?? 0} / ${view.stats?.handLimit || 0}</small></h2>${button('查看详情','inspect',!c,'quiet')}</div><div class="panel-body" id="hand-body"><div class="hand-grid">${(view.hand || []).map(c=>{const affordable=(c.cost??0)<=currentAp;return `<button class="hand-card kind-${c.kind} ${c.kind==='negative'?'negative':''} ${!affordable&&c.cost>0?'unaffordable':''} ${isDiscard()?discarded.has(c.instanceId)?'selected':'':selectedCard===c.instanceId?'selected':''}" data-action="card" ${tagged(c.instanceId)} aria-pressed="${isDiscard()?discarded.has(c.instanceId):selectedCard===c.instanceId}"><span class="card-name">${esc(c.name)}</span><span class="card-meta">${esc(cardKind(c.kind))} <span class="card-ap-tag">${c.cost ?? 0} AP</span> ${c.quantity>1?`×${c.quantity}`:''}</span>${c.enchant?.length?`<span class="good card-meta">${c.enchant.map(enchantName).join(' · ')}</span>`:''}</button>`;}).join('')}</div>${!view.hand?.length?'<p class="empty">行囊空了，新的物资还在海上。</p>':''}</div><div class="selection-detail">${isDiscard()?`<div class="row between"><span>已选 <strong>${discarded.size}</strong> 张手牌${view.excess>0?`（尚需丢弃 ${Math.max(0, view.excess - discarded.size)} 张）`:''}</span>${button(`立即丢弃 (${discarded.size})`,'discard',!discarded.size,'primary')}</div>`:c?`<strong>${esc(c.name)}</strong> <span class="muted">${esc(c.description)}</span>${guideHint}<div class="row" style="margin-top:6px">${button(c.kind==='equipment'?'⚙️ 安装':c.kind==='negative'?'☣️ 清除':c.definitionId==='dismantle'?'🔨 拆除设备':'✨ 使用','play',!canPlaySelected(),'primary')}${button('🔥 灯笼添燃料','fuel',!canAct() || !equipment() || !CARDS[c.definitionId]?.fuel)}${view.pendingEnchant?button('附魔','enchant',!canAct() || !enchantable()):''}<small>${selectedTarget?`已选目标：${esc(targetLabel())}`:'尚未指定目标'}</small></div>`:'<span class="muted">点击手牌查看说明与操作。双击可用手牌可快速打出。</span>'}</div></section>`;
}
function cardKind(k){return {resource:'🪵 材料',survival:'💧 生存',combat:'⚔️ 战术',equipment:'⚙️ 设备',action:'🔨 行动',negative:'☣️ 负面',currency:'🪙 货币'}[k] || k || '物资';}
function enchantName(k){return {return:'回牌',instant:'瞬发'}[k] || k;}
function targetLabel(){return (view.battle?.enemies || []).find(e=>e.instanceId===selectedTarget)?.name || equipment()?.name || cell()?.id || selectedTarget;}
function raft() {
  const cells=view.cells || [];
  const xs=cells.map(c=>c.x), zs=cells.map(c=>c.z);
  const minX=xs.length?Math.min(...xs):0,maxX=xs.length?Math.max(...xs):0,minZ=zs.length?Math.min(...zs):0,maxZ=zs.length?Math.max(...zs):0;
  const width=maxX-minX+1;
  const curCard=card();
  const isInstall=curCard?.kind==='equipment', isRepair=curCard?.definitionId==='repair';
  let tiles='';
  for(let z=minZ;z<=maxZ;z++) for(let x=minX;x<=maxX;x++){
    const c=cells.find(c=>c.x===x&&c.z===z);
    if(!c){tiles+='<span class="raft-cell space"></span>';continue;}
    const isTargetInstall=isInstall && c.state==='intact' && !c.equipment;
    const isTargetRepair=isRepair && c.state==='damaged';
    const targetClass=isTargetInstall?'target-install':isTargetRepair?'target-repair':'';
    let statusPill='';
    if(c.equipment?.definitionId==='lamp')statusPill=`<span class="cell-status-tag">🔥 燃料 ${c.equipment.fuel ?? 0}</span>`;
    else if(c.equipment?.output)statusPill=`<span class="cell-status-tag">⏳ 进度 ${c.equipment.progress ?? 0}</span>`;
    else if(c.equipment?.healing)statusPill=`<span class="cell-status-tag">🩹 可治疗</span>`;
    else if(c.equipment?.battleOutput)statusPill=`<span class="cell-status-tag">🏹 产箭</span>`;
    tiles+=`<button class="raft-cell ${c.state} ${targetClass} ${selectedTarget===c.id || selectedTarget===c.equipment?.instanceId?'selected':''}" data-action="cell" ${tagged(c.id)} aria-label="${esc(c.id)} ${esc(c.equipment?.name || '空筏格')} ${c.state==='damaged'?'破损':c.state==='detached'?'脱落':'完好'}"><span>${c.state==='detached'?'脱落':c.state==='damaged'?'破损':c.equipment?'设备':'空格'}</span>${c.equipment?`<span class="equip">${esc(c.equipment.name)}</span><small>Lv.${c.equipment.level || 1}</small>${statusPill}`:`<small>${esc(c.id)}</small>`}</button>`;
  }
  const selected=cell(), unit=equipment();
  return `<section class="panel raft-panel"><div class="panel-head"><h2>木筏</h2><small>${cells.filter(c=>c.state!=='detached').length} 格${isBattle()?' · 战斗中只读':''}</small></div><div class="panel-body" id="raft-body"><div class="raft-board" style="grid-template-columns:repeat(${width},minmax(0,1fr))">${tiles}</div><div class="raft-legend">绿色描边：已选 · 红褐：破损 · 虚线：脱落</div>${selected?`<div class="selection-detail"><strong>${esc(selected.id)} · ${selected.state==='intact'?'完好':selected.state==='damaged'?'破损':'脱落'}</strong>${unit?`<p>${esc(unit.name)} · Lv.${unit.level || 1} · 燃料 ${unit.fuel ?? 0} · 生产进度 ${unit.progress ?? 0}</p>`:'<p class="muted">此格没有设备</p>'}</div>`:''}</div><div class="stage-footer">${button('➕ 扩建','expand',!canAct() || !view.expansionOptions?.length)}${button('🔨 修补','repair',!canAct() || !selected || selected.state!=='damaged')}${button('⭐ 升级','upgrade',!canAct() || !unit)}${button('🩹 治疗 · '+treatmentCost(view,unit).summary,'activate',!canAct() || selected?.state!=='intact' || !treatmentCost(view,unit).canChoose)}${button('📦 合成','craft',!canAct())}</div></section>`;
}
function buffs(){return `<section class="panel buff-panel"><div class="panel-head"><h2>状态与藏品</h2><small>${view.buffs?.length || 0} 个状态</small></div><div class="panel-body"><div class="buff-list">${(view.buffs || []).map(b=>`<span class="buff ${b.polarity==='negative'?'negative':''}" title="${esc(b.description)}">${esc(b.name)}${b.remaining!=null?` · ${b.remaining} ${b.clock==='battle'?'回合':'轮'}`:''}</span>`).join('')}${(view.relics || []).map(r=>`<span class="buff gold" title="${esc(r.description)}">◆ ${esc(r.name)}</span>`).join('') || ''}</div>${!view.buffs?.length && !view.relics?.length?'<small class="muted">暂时没有状态或藏品</small>':''}</div></section>`;}
function game(){return `<main class="screen">${header()}${meters()}<div class="game-body">${log()}<div class="middle-column">${stage()}${hand()}</div><aside class="right-column">${raft()}${buffs()}</aside></div></main>`;}

function render() {
  const logOpen=new Map([...document.querySelectorAll('[data-log-key]')].map(e=>[e.dataset.logKey,e.open]));
  logScroll=$('#log-body')?.scrollTop || logScroll; handScroll=$('#hand-body')?.scrollTop || handScroll;
  stageScroll=$('#stage-body')?.scrollTop || stageScroll; raftScroll=$('#raft-body')?.scrollTop || raftScroll;
  $('#app').innerHTML=(view.phase==='home' || restoredRun)?home():game();
  if(view.phase==='home' || restoredRun)document.querySelector('.home-bottom')?.insertAdjacentHTML('beforeend',button('退出','exit',false,'quiet'));
  for(const el of document.querySelectorAll('[data-log-key]')) if(logOpen.has(el.dataset.logKey)) el.open=logOpen.get(el.dataset.logKey);
  [['#log-body',logScroll],['#hand-body',handScroll],['#stage-body',stageScroll],['#raft-body',raftScroll]].forEach(([s,pos])=>{if($(s))$(s).scrollTop=pos;});
  renderModal();
}
function openModal(type,data={}) {modal={type,...data};renderModal();}
function closeModal(){modal=null;renderModal();}
function modalFrame(title,content,extraCls=''){const cls=typeof extraCls==='boolean'?(extraCls?'small':''):extraCls;return `<div class="overlay-backdrop" data-action="backdrop"><section class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="panel-head"><h2>${esc(title)}</h2>${button('×','close',false,'modal-close','aria-label="关闭"')}</div><div class="modal-content">${content}</div></section></div>`;}
function renderModal(){
  let html='';
  $('#app').inert=!!modal;
  if(!modal){$('#overlay-root').innerHTML='';return;}
  if(modal.type==='craft'){
    const RECIPE_ICONS={lamp:'🔥',filter:'💧',planter:'🌿',medkit:'🩹',crossbow:'🏹',spearRack:'🗡️',dismantle:'🔨',repair:'🧰'};
    const MAT_ICONS={wood:'🪵',iron:'🔩',plastic:'🧴',cloth:'🧵',rope:'🪢'};
    const matCount=defId=>(view.hand||[]).filter(c=>c.definitionId===defId).reduce((s,c)=>s+(c.quantity||1),0);
    const invHtml=`<div class="craft-inv-bar"><div class="craft-inv-title"><span>🎒 材料库存</span><span class="craft-ap-badge ${view.ap>0?'good':'warn'}">⚡ 当前 AP: ${view.ap??0}</span></div><div class="craft-inv-mats">${['wood','iron','plastic','cloth','rope'].map(m=>{const count=matCount(m);return `<span class="inv-mat ${count>0?'has':'zero'}" title="${esc(CARDS[m]?.name)}">${MAT_ICONS[m]} ${esc(CARDS[m]?.name)} <strong>${count}</strong></span>`;}).join('')}</div></div>`;
    const gridHtml=`<div class="craft-grid">${defs(RECIPES).map(r=>{const a=view.recipeAvailability?.[r.id];const cardDef=CARDS[r.output]||{};const icon=RECIPE_ICONS[r.id]||'⚙️';const canCraft=canAct()&&a?.canCraft;const isLocked=r.id==='spearRack'&&!view.profile?.tech?.includes('spear');const ings=entries(r.ingredients).map(([id,needed])=>{const have=matCount(id);const ok=have>=needed;return `<span class="craft-ing ${ok?'ok':'miss'}">${MAT_ICONS[id]||''} ${esc(name(CARDS,id))} ${have}/${needed}</span>`;}).join('');return `<div class="craft-card ${canCraft?'craftable':''} ${isLocked?'locked':''}"><div class="craft-card-head"><div class="craft-card-title"><span class="craft-card-icon">${icon}</span><strong>${esc(cardDef.name||r.name)}</strong></div><span class="craft-cost-badge">${r.cost??1} AP</span></div><p class="craft-card-desc">${esc(cardDef.description||'合成可用物资')}</p><div class="craft-card-ings">${ings}</div><div class="craft-card-foot">${button(canCraft?'🔨 合成':a?.reason||'不可合成','craftRecipe',!canCraft,`btn-craft ${canCraft?'primary':''}`,tagged(r.id))}</div></div>`;}).join('')}</div>`;
    html=modalFrame('工具台 · 配方合成',`${invHtml}${gridHtml}`,'craft-modal');
  }
  if(modal.type==='inspect'){const c=card();html=modalFrame(c?.name || '手牌详情',c?`<p class="help-copy">${esc(c.description)}</p><p class="muted">${cardKind(c.kind)} · ${c.cost || 0} AP · 数量 ${c.quantity || 1}</p>${c.enchant?.length?`<p class="good">附魔：${c.enchant.map(enchantName).join('、')}</p>`:''}`:'<p>请先选择手牌。</p>',true);}
  if(modal.type==='nodeShop'){
    const count=id=>(view.hand||[]).filter(c=>c.definitionId===id).reduce((n,c)=>n+c.quantity,0);
    const goods=(view.shop||[]).map(item=>{
      const coin=purchaseStatus(view,item,'coin'),corpse=purchaseStatus(view,item,'corpse');
      return `<div class="catalogue-item"><strong>${esc(item.name)}</strong><p>${esc(item.description)}</p><small>${item.card?`获得手牌 ×1${CARDS[item.card]?.kind==='equipment'?'，需另行安装':''}`:'获得藏品，立即生效'} · 支付方式二选一</small><div class="row">${button(`贝币 ×${coin.cost} 购买`,'shopCoin',!coin.canBuy,'',tagged(item.id))}${button(`尸体 ×${corpse.cost} 交换`,'shopCorpse',!corpse.canBuy,'',tagged(item.id))}</div><small>${esc([coin.reason,corpse.reason].filter((r,i,a)=>r&&a.indexOf(r)===i).join('；'))}</small></div>`;
    }).join('');
    const options=(view.node?.options||[]).map(o=>{const fee=nodeOptionCost(view,o);return `<div class="row"><span>${esc(o.description)} · ${esc(fee.summary)}</span>${button(o.name,'option',!fee.canChoose,'',tagged(o.id))}</div>`;}).join('');
    html=modalFrame('海怪商人 · 交易',`<p class="gold">持有贝币 ${count('coin')} · 怪物尸体 ${count('corpse')}</p><p>每次购买不消耗 AP。设备购买后放入手牌；手牌超限可继续交易，航行结束时再整理。关闭窗口可重新打开；选择「离开商店」后，本节点不可继续交易。</p>${modal.notice?`<p role="status" class="gold">${esc(modal.notice)}</p>`:''}<div class="catalogue">${goods}</div>${options}`);
  }
  if(modal.type==='meta')html=modalFrame('海怪商店',`<p class="gold">涌潮点 ${view.profile?.points || 0}</p><div class="catalogue">${defs(META_SHOP).map(m=>{const n=view.profile?.purchases?.[m.id] || 0;return `<div class="catalogue-item"><strong>${esc(m.name)}</strong><p class="card-description">${esc(m.description)}</p><small>已购 ${n} / ${m.maxPurchases ?? '不限'}</small>${button(`${m.price} 点 · 购买`,'buyMeta',!canUseProfileActions(view) || (view.profile?.points || 0)<m.price || n>=(m.maxPurchases ?? Infinity),'',tagged(m.id))}</div>`;}).join('')}</div>${!canUseProfileActions(view)?'<p class="muted">结束当前航行后可购买局外成长。</p>':''}`);
  if(modal.type==='tech')html=modalFrame('科技树',`<p class="gold">涌潮点 ${view.profile?.points || 0}</p><div class="catalogue">${defs(TECH).map(t=>{const got=view.profile?.tech?.includes(t.id);const prereq=(t.requires || []).every(id=>view.profile?.tech?.includes(id));return `<div class="catalogue-item ${got?'':'locked'}"><strong>${esc(t.name)}</strong><p class="card-description">${esc(t.description)}</p><small>前置：${t.requires?.length?t.requires.map(id=>esc(name(TECH,id))).join('、'):'无'}</small>${button(got?'已解锁':`${t.price} 点 · 解锁`,'unlockTech',!canUseProfileActions(view) || got || !prereq || (view.profile?.points || 0)<t.price,'',tagged(t.id))}</div>`;}).join('')}</div>`);
  if(modal.type==='catalogue')html=modalFrame('航海图鉴',catalogue());
  if(modal.type==='expand')html=modalFrame('扩建木筏',`<p class="muted">选择扩建的位置；需要足够的材料与 AP。</p><div class="row">${(view.expansionOptions || []).map(p=>button(`位置 (${p.x}, ${p.z})`,'expandAt',!canAct(),' ',`data-x="${p.x}" data-z="${p.z}"`)).join('')}</div>`,true);
  if(modal.type==='upgrade')html=modalFrame('设备升级',`<p>目标：${esc(equipment()?.name || '未选择设备')}</p><p class="muted">选择可合并的设备材料。</p>${(view.upgradeOptions || []).filter(o=>o.targetId===equipment()?.instanceId).map(o=>button(o.label || o.materialId,'upgradeWith',!canAct(),'',tagged(o.materialId))).join('') || '<p class="empty">没有适合此设备的升级材料。</p>'}`,true);
  if(modal.type==='enchant')html=modalFrame('附魔奖励',`<p>为 ${esc(card()?.name || '所选手牌')} 选择附魔。</p><p class="muted">${modal.optionId?'营地为所选手牌附魔。':view.pendingEnchant?'可领取等级附魔奖励。':'请通过当前节点选择领取附魔。'}</p><div class="row">${button('回牌','enchantReturn',!enchantable())}${button('瞬发','enchantInstant',!enchantable())}</div>`,true);
  if(modal.type==='saveMenu')html=modalFrame('航行记录',`<p class="help-copy">每次成功行动都会保存到此浏览器。导出记录可留作备份，或在其他设备导入继续。</p>${saveFailure?`<div class="notice bad">${esc(saveFailure)}</div>`:'<p class="good">当前记录可导出。</p>'}<div class="row">${button('导出记录','export')}${button('导入记录','import')}</div><input class="file-input" id="import-file" type="file" accept="application/json,.json"><small>导入会替换当前航行，请先导出需要保留的记录。</small>`,true);
  if(modal.type==='contentConfig')html=modalFrame('玩法配置',`<p class="help-copy">这里导入的是策划工具导出的玩法配置，航行记录请通过“记录”导入。</p><p>当前使用${appliedConfig.source==='browser'?'本浏览器的策划配置':'发布配置'}。不同配置分别保存进度；导入后重新打开首页。</p><div class="row">${button('导入玩法配置','importContent')}${button('导出当前配置','exportContent')}${button('恢复发布配置','resetContent')}</div><input class="file-input" id="content-file" type="file" accept="application/json,.json"><p class="muted">应用范围仅为此浏览器。要交给其他人试玩，请分享导出的配置文件。</p>`,true);
  if(modal.type==='homeMenu')html=modalFrame('航行菜单',`<p class="muted">${saveFailure?'航行记录保存失败，请导出备份。':'当前航行已经记录，可回到首页后继续。'}</p><div class="row">${saveFailure?button('导出记录','export'):''}${button('回到首页','showHome')}${button('放弃本次航行','abandon',view.phase==='finished','danger')}</div>`,true);
  if(modal.type==='exitFallback')html=modalFrame('退出航行',`<p class="help-copy">${saveFailure?'记录尚未成功保存，请先导出备份。':'航行记录已保存。'}浏览器若未关闭此页面，可直接关闭标签页，或返回首页。</p><div class="row">${saveFailure?button('导出记录','export'):''}${button('返回首页','showHome')}</div>`,true);
  if(modal.type==='confirm')html=modalFrame(modal.title,`<p class="help-copy">${esc(modal.message)}</p><div class="row">${button('确认','confirm',false,'primary')}${button('取消','close')}</div>`,true);
  if(modal.type==='help')html=modalFrame('航行指南',`<div class="help-copy"><p>① 首页选择出身与种子，开始新航行；有进行中的记录时可继续。</p><p>② 导航阶段选择节点并启航。补给进入手牌，行动阶段可使用物资、安装设备、合成、修补或进入战斗。</p><p>③ 点击手牌查看操作，再点击敌人、筏格或设备选定目标。普通材料每份各占一张；贝币集中占一张，高级弓弩产生的箭按设备等级合并容量。</p><p>④ 节点完成后仍可行动；AP归零仍可使用0 AP牌。点击结束本次航行才会结算生存消耗和设备生产；超出容量时需要弃牌。</p><p>⑤ 战斗有独立 AP 与回合。留意敌方意图，结束回合后承受攻击。战斗时无法合成或改造木筏。</p><p>⑥ 破损格停用设备，修补可恢复；脱落会损失其设备。死亡或完成旅途后返回首页，使用涌潮点成长。</p><p class="gold">实验中的数值与组合仍在试测，请以界面反馈为准。</p></div>`);
  $('#overlay-root').innerHTML=html;
}
function catalogue(){
  const tabs=[['cards','卡牌'],['relics','藏品'],['monsters','怪物'],['diaries','日记'],['endings','结局']];
  const discovered=view.profile?.discovered?.[catalogueTab] || [];
  const maps={cards:CARDS,relics:RELICS,monsters:MONSTERS,diaries:Object.fromEntries((DIARIES || []).map(d=>[d.id,d])),endings:ENDINGS};
  let items=maps[catalogueTab]?defs(maps[catalogueTab]):discovered.map(id=>typeof id==='object'?id:{id,name:id,description:'已收录的航行见闻'});
  return `<nav class="tabs">${tabs.map(([id,label])=>button(label,'catalogueTab',false,catalogueTab===id?'active':'',tagged(id))).join('')}</nav><p class="muted">已发现 ${discovered.length} 项。未发现的内容仍可预览规则说明。</p><div class="catalogue">${items.map(d=>`<article class="catalogue-item ${discovered.includes(d.id)?'':'locked'}"><div class="row between"><strong>${esc(d.name)}</strong><small>${discovered.includes(d.id)?'已发现':'未发现'}</small></div><p class="card-description">${esc(d.description || '')}</p>${d.kind?`<small>${cardKind(d.kind)}</small>`:''}${d.rarity?`<small>${esc(d.rarity)}</small>`:''}</article>`).join('') || '<p class="empty">航行中发现的线索会收录在这里。</p>'}</div>`;
}
function confirmAction(title,message,callback){openModal('confirm',{title,message,callback});}

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-action]'); if(!el || el.disabled)return;
  const a=el.dataset.action,id=el.dataset.id;
  if(a==='backdrop'){if(e.target===el)closeModal();return;}
  if(a==='close'){closeModal();return;}
  if(a==='confirm'){const cb=modal.callback;closeModal();cb();return;}
  if(a==='card'){if(isDiscard()){discarded.has(id)?discarded.delete(id):discarded.add(id);}else selectedCard=selectedCard===id?null:id;render();return;}
  if(a==='target'){selectedTarget=id;render();return;}
  if(a==='cell'){selectedTarget=id;render();return;}
  if(a==='candidate'){selectedCandidate=id;render();return;}
  if(a==='randomSeed'){homeSeed=String(Math.floor(Math.random()*4294967296));$('#seed').value=homeSeed;return;}
  if(a==='newGame'){
    homeSeed=$('#seed').value; homeOrigin=$('#origin').value;
    const seed=parseSeed(homeSeed); if(seed===null){toast('请输入 0 至 4294967295 的整数种子。',true);return;}
    const go=()=>{selectedCard=null;selectedTarget=null;selectedCandidate=null;logScroll=0;run({type:'NewGame',seed,originId:homeOrigin});};
    if(!['home','finished'].includes(view.phase))confirmAction('开启新的航行','当前航行尚未结束。新航行会替换它，是否继续？',()=>{if(run({type:'AbandonRun'}))go();});else go();return;
  }
  if(a==='continue'){restoredRun=false;render();return;}
  if(a==='exit'){
    persist();window.close();
    openModal('exitFallback');return;
  }
  if(a==='showHome'){closeModal();if(view.phase==='finished'){run({type:'ReturnHome'});return;}restoredRun=true;persist();render();return;}
  if(a==='abandon'){confirmAction('放弃航行','结束当前旅途并返回首页？',()=>run({type:'AbandonRun'}));return;}
  if(a==='returnHome'){run({type:'ReturnHome'});return;}
  if(['nodeShop','help','meta','tech','catalogue','saveMenu','contentConfig','homeMenu','craft','inspect','expand','upgrade','enchant'].includes(a)){openModal(a);return;}
  if(a==='catalogueTab'){catalogueTab=id;renderModal();return;}
  if(a==='submitVoyage'){if(run({type:'SubmitVoyage',nodeId:selectedCandidate})){selectedCandidate=null;logScroll=0;}return;}
  if(a==='enterNode'){run({type:'EnterNode'});return;}
  if(a==='option'){
    const option=NODES[view.node?.id]?.options?.find(o=>o.id===id) || view.node?.options?.find(o=>o.id===id);
    if(option?.special==='enchant'){
      if(!enchantable()){toast('先选择一张战斗、生存或行动牌，再选择附魔。',true);return;}
      openModal('enchant',{optionId:id});return;
    }
    if(option?.special==='exchange' && !SPRING_POOL.includes(card()?.definitionId)){toast('先选择一张基础资源牌，再进行交换。',true);return;}
    if(option?.special==='upgrade' && (!equipment() || cell()?.state!=='intact' || equipment().level>=CONFIG.upgradeMax)){toast('先选择一件完好筏格上的未满级设备。',true);return;}
    run({type:'ChooseOption',optionId:id,...(selectedCard?{cardId:selectedCard}:{}),...(equipment()?{equipmentId:equipment().instanceId}:{}),...(option?.enchant?{enchant:option.enchant}:{})});return;
  }
  if(a==='play'){const targetId=card()?.targetOperation==='dismantle'?equipment()?.instanceId:selectedTarget;run({type:'PlayCard',cardId:selectedCard,...(targetId?{targetId}:{})});return;}
  if(a==='fuel'){run({type:'FuelLamp',cardId:selectedCard,equipmentId:equipment()?.instanceId});return;}
  if(a==='craftRecipe'){if(run({type:'Craft',recipeId:id}))toast('合成完成');return;}
  if(a==='expandAt'){if(run({type:'ExpandRaft',x:Number(el.dataset.x),z:Number(el.dataset.z)}))closeModal();return;}
  if(a==='repair'){run({type:'RepairCell',cellId:cell()?.id});return;}
  if(a==='upgradeWith'){if(run({type:'UpgradeEquipment',targetId:equipment()?.instanceId,materialId:id}))closeModal();return;}
  if(a==='activate'){run({type:'ActivateEquipment',equipmentId:equipment()?.instanceId});return;}
  if(a==='endVoyage'){run({type:'EndVoyage'});return;}
  if(a==='discard'){run({type:'DiscardCards',cardIds:[...discarded]});return;}
  if(a==='finishDiscard'){run({type:'FinishDiscard'});return;}
  if(a==='endBattle'){run({type:'EndBattleTurn'});return;}
  if(a==='retreat'){confirmAction('从战斗撤退','撤退可能带来惩罚，是否离开战场？',()=>run({type:'Retreat'}));return;}
  if(a==='buyMeta'){if(run({type:'BuyMeta',itemId:id}))toast('局外购买成功');return;}
  if(a==='unlockTech'){if(run({type:'UnlockTech',techId:id}))toast('科技已解锁');return;}
  if(a==='enchantReturn' || a==='enchantInstant'){const enchant=a==='enchantReturn'?'return':'instant';if(run(modal?.optionId?{type:'ChooseOption',optionId:modal.optionId,cardId:selectedCard,enchant}:{type:'EnchantCard',cardId:selectedCard,enchant}))closeModal();return;}
  if(a==='shopCoin' || a==='shopCorpse'){
    const item=view.shop.find(i=>i.id===id),payment=a==='shopCoin'?'coin':'corpse',fee=purchaseStatus(view,item,payment);
    if(run({type:'ShopBuy',itemId:id,payment})){
      modal.notice=`交易成功：支付${fee.currency} ×${fee.cost}，获得${item.name} ×1${item.card?'（已放入手牌）':'（已生效）'}；剩余${fee.currency} ${fee.held-fee.cost}。`;
      renderModal();
    }return;
  }
  if(a==='export'){
    const blob=new Blob([JSON.stringify(session.serialize(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=`深涌-航行记录-${view.seed ?? '局外'}-${new Date().toISOString().slice(0,10)}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('记录已导出');return;
  }
  if(a==='import'){$('#import-file').click();return;}
  if(a==='importContent'){$('#content-file').click();return;}
  if(a==='exportContent'){
    const url=URL.createObjectURL(new Blob([JSON.stringify(getActiveConfig(),null,2)],{type:'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='深涌-玩法配置.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
  }
  if(a==='resetContent'){confirmAction('恢复发布配置','重新使用当前发布配置，并读取它对应的进度？',()=>{try{clearAppliedConfig();location.reload();}catch(error){toast(error.message,true);}});return;}
});
document.addEventListener('dblclick',e=>{
  const cardEl=e.target.closest('[data-action="card"]');
  if(cardEl && !cardEl.disabled && !isDiscard()){
    const id=cardEl.dataset.id;
    selectedCard=id;
    const c=card();
    if(c && canPlaySelected()){
      if(c.kind==='combat'){
        const aliveEnemies=(view.battle?.enemies||[]).filter(en=>en.hp>0);
        let targetId=selectedTarget;
        if(!targetId && aliveEnemies.length===1) targetId=aliveEnemies[0].instanceId;
        if(targetId){
          run({type:'PlayCard',cardId:id,targetId});
          return;
        }
      }else if(c.kind==='survival' || (c.kind==='action' && !c.targetOperation)){
        run({type:'PlayCard',cardId:id});
        return;
      }else if(c.kind==='equipment'){
        const emptyCells=(view.cells||[]).filter(cl=>cl.state==='intact' && !cl.equipment);
        let targetId=selectedTarget;
        if(!targetId && emptyCells.length===1) targetId=emptyCells[0].id;
        if(targetId){
          run({type:'PlayCard',cardId:id,targetId});
          return;
        }
      }
    }
    render();
    return;
  }
  const enemyEl=e.target.closest('[data-action="target"]');
  if(enemyEl && !enemyEl.disabled && isBattle()){
    const enemyId=enemyEl.dataset.id;
    selectedTarget=enemyId;
    const c=card();
    if(c && c.kind==='combat' && canPlaySelected()){
      run({type:'PlayCard',cardId:selectedCard,targetId:enemyId});
      return;
    }
    render();
    return;
  }
  const cellEl=e.target.closest('[data-action="cell"]');
  if(cellEl && !cellEl.disabled && canAct()){
    const cellId=cellEl.dataset.id;
    selectedTarget=cellId;
    const c=card();
    if(c && c.kind==='equipment'){
      const targetCell=(view.cells||[]).find(cl=>cl.id===cellId);
      if(targetCell && targetCell.state==='intact' && !targetCell.equipment && canPlaySelected()){
        run({type:'PlayCard',cardId:selectedCard,targetId:cellId});
        return;
      }
    }else if(c && c.definitionId==='repair'){
      const targetCell=(view.cells||[]).find(cl=>cl.id===cellId);
      if(targetCell && targetCell.state==='damaged' && canPlaySelected()){
        run({type:'PlayCard',cardId:selectedCard,targetId:cellId});
        return;
      }
    }
    render();
    return;
  }
});
document.addEventListener('change',async e=>{
  if(e.target.id==='content-file'){
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>2*1024*1024)throw new Error('配置文件超过2MB，请检查是否选成了其他文件');
      const config=parseConfig(await file.text());
      confirmAction('应用玩法配置','配置检查通过。应用后将重新打开首页，当前配置的进度会保留。',()=>{try{saveAppliedConfig(config);location.reload();}catch(error){toast(error.message,true);}});
    }catch(error){toast(`配置未导入：${error.message}`,true);}
  }
  if(e.target.id==='origin'){homeOrigin=e.target.value;$('#origin-description').textContent=ORIGINS[homeOrigin]?.description || '';}
  if(e.target.id==='seed')homeSeed=e.target.value;
  if(e.target.id==='import-file'){
    const file=e.target.files[0];if(!file)return;
    try{const imported=GameSession.restore(JSON.parse(await file.text()));confirmAction('导入航行记录','用这份记录替换当前航行？',()=>{session=imported;view=session.getView();selectedCard=null;selectedTarget=null;selectedCandidate=null;discarded.clear();restoredRun=false;persist();render();toast('航行记录已恢复');});}
    catch(error){toast(`无法导入：${error.message || '记录格式不正确'}`,true);}
  }
});
document.addEventListener('keydown',e=>{
  if(!modal)return;
  if(e.key==='Escape'){closeModal();return;}
  if(e.key==='Tab'){
    const items=[...document.querySelectorAll('.modal button:not(:disabled),.modal input,.modal select')];
    if(!items.length)return;
    const first=items[0],last=items.at(-1);
    if(e.shiftKey && (document.activeElement===first || !items.includes(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey && (document.activeElement===last || !items.includes(document.activeElement))){e.preventDefault();first.focus();}
  }
});
initialSave();render();
if(configWarning)toast(configWarning,true);
