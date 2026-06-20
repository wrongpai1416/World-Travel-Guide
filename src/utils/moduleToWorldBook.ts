// ============================================================
//  模块配置转世界书条目工具
//  把 WorldDef.modules 中的静态配置转为世界书条目，注入给 AI
// ============================================================

import type { WorldModule } from '../data/worlds-schema';
import type { WorldBookEntry } from '../worldbook/index';

// ─── 模块ID → 世界书关键词映射 ─────────────────────────────

const MODULE_KEYWORDS: Record<string, string[]> = {
  stat: ['属性', '数值', '战斗', '能力值', '六维'],
  progression: ['段位', '等级', '境界', '修炼', '经验', '升级'],
  survival: ['生存', '资源', '采集', '制作', '消耗', '食物', '淡水', '木材'],
  business: ['经营', '资产', '收购', '升级', '出售', '资金', '收益', '维护', '员工', '市场', '店铺', '产业', '收入', '支出'],
  dice: ['骰子', '检定', '判定', '掷骰'],
  talent: ['天赋', '能力', '血脉', '体质', '灵根'],
};

// ─── 格式化工具 ─────────────────────────────────────────

function formatStatModule(data: Record<string, unknown>): string {
  const lines: string[] = ['【数值属性系统】'];

  // attrA
  const attrA = data.attrA as Record<string, unknown> | undefined;
  if (attrA) {
    lines.push(`- ${attrA.name || '生命'}：当前值/上限（如 ${attrA.current}/${attrA.max}）`);
  }

  // attrB
  const attrB = data.attrB as Record<string, unknown> | undefined;
  if (attrB) {
    lines.push(`- ${attrB.name || '能量'}：当前值/上限（如 ${attrB.current}/${attrB.max}）`);
  }

  // 六维属性
  const dims: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const dim = data[`dim${i}`] as Record<string, unknown> | undefined;
    if (dim?.name) {
      dims.push(`${dim.name}(${(dim.range as number[])?.[0] ?? 0}~${(dim.range as number[])?.[1] ?? 100})`);
    }
  }
  if (dims.length > 0) {
    lines.push(`- 六维属性：${dims.join('、')}`);
  }

  // 特色属性
  const special = data.special as Array<Record<string, unknown>> | undefined;
  if (special && special.length > 0) {
    lines.push('- 特色属性：');
    for (const sp of special) {
      lines.push(`  - ${sp.name}（${sp.id}）：${sp.description || ''} 范围 ${(sp.range as number[])?.[0] ?? 0}~${(sp.range as number[])?.[1] ?? 100}`);
    }
  }

  return lines.join('\n');
}

function formatProgressionModule(data: Record<string, unknown>): string {
  const lines: string[] = ['【成长体系/境界系统】'];
  const mode = data.mode as string;

  if (mode === 'tiered') {
    lines.push('模式：段位制');
    const tiers = data.tiers as Array<Record<string, unknown>> | undefined;
    if (tiers && tiers.length > 0) {
      lines.push('段位列表（从低到高）：');
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const statBonuses = tier.statBonuses as Record<string, unknown> | undefined;
        const bonusStr = statBonuses ? ` 生命上限:${statBonuses.attrAMax} 能量上限:${statBonuses.attrBMax}` : '';
        lines.push(`  第${i}段 - ${tier.name}：${tier.description || ''}${bonusStr}`);
      }
    }
  } else if (mode === 'level') {
    lines.push('模式：等级制');
    const levelData = data.levelData as Record<string, unknown> | undefined;
    if (levelData) {
      lines.push(`等级上限：${levelData.maxLevel}`);
    }
  }

  // 经验公式
  const xpFormula = data.xpFormula as Record<string, unknown> | undefined;
  if (xpFormula) {
    lines.push(`经验公式：每级需要 经验 = ${xpFormula.baseXP} × 等级^${xpFormula.exponent} × ${xpFormula.scaleFactor}`);
  }

  lines.push('');
  lines.push('状态存储（AI可通过UpdateVariable更新）：');
  lines.push('- 玩家.当前段位索引：当前所在的段位/等级索引（数字）');
  lines.push('- 玩家.当前经验值：当前经验值（数字）');

  return lines.join('\n');
}

function formatSurvivalModule(data: Record<string, unknown>): string {
  const lines: string[] = ['【生存资源系统】'];
  if (data.description) lines.push(String(data.description));

  const rules = data.rules as Record<string, unknown> | undefined;
  if (rules) {
    lines.push(`结算周期：每${rules.cycleName || '天'}`);
    if (rules.consumePerCycle) lines.push(`每周期消耗：${rules.consumePerCycle}`);
    if (rules.criticalThreshold) lines.push(`危机阈值：低于 ${rules.criticalThreshold} 触发危险`);
  }

  const resources = data.resources as Array<Record<string, unknown>> | undefined;
  if (resources && resources.length > 0) {
    lines.push('\n资源列表：');
    for (const r of resources) {
      const scarce = r.scarce ? ' [稀缺]' : '';
      lines.push(`- ${r.symbol || ''}${r.name}（${r.id}）：${r.amount ?? 0}/${r.max}${scarce}`);
      if (r.gatherRate) lines.push(`  采集：${r.gatherRate}`);
      if (r.usage) lines.push(`  消耗：${r.usage}`);
      if (r.description) lines.push(`  ${r.description}`);
    }
  }

  const recipes = data.recipes as Array<Record<string, unknown>> | undefined;
  if (recipes && recipes.length > 0) {
    lines.push('\n制作配方：');
    for (const r of recipes) {
      const inputs = r.inputs as Record<string, number> | undefined;
      const inputStr = inputs ? Object.entries(inputs).map(([k, v]) => `${k}×${v}`).join(' + ') : '?';
      const output = r.output as Record<string, unknown> | undefined;
      const outputStr = output ? `${output.resourceId}×${output.amount}` : '?';
      lines.push(`- ${r.name}：${inputStr} → ${outputStr}`);
    }
  }

  return lines.join('\n');
}

function formatBusinessModule(data: Record<string, unknown>): string {
  const lines: string[] = ['【经营资产系统】'];
  if (data.description) lines.push(String(data.description));
  lines.push(`结算周期：每${data.cycleName || '天'}`);
  lines.push(`当前资金：${data.funds ?? 0}`);

  const assets = data.assets as Array<Record<string, unknown>> | undefined;
  if (assets && assets.length > 0) {
    lines.push('\n资产列表：');
    for (const a of assets) {
      const income = a.income as Record<string, unknown> | undefined;
      const netIncome = income ? (Number(income.base) || 0) + (Number(income.perLevel) || 0) * ((Number(a.level) || 1) - 1) - (Number(a.maintenance) || 0) : 0;
      const staff = a.staff as Record<string, unknown> | undefined;
      const risk = a.risk as Record<string, unknown> | undefined;

      lines.push(`- ${a.name} [Lv.${a.level}/${a.maxLevel}] [${a.status || 'active'}]`);
      lines.push(`  类型: ${a.type || '未分类'} | 收益: ${income?.base ?? 0}+${income?.perLevel ?? 0}/级 ${income?.resource || '金'}/${income?.cycle || '天'}`);
      lines.push(`  维护: ${a.maintenance ?? 0}/${income?.cycle || '天'} | 净收益: ${netIncome > 0 ? '+' : ''}${netIncome}`);
      if (staff) lines.push(`  员工: ${staff.current}/${staff.max} 效率: ${staff.efficiency}`);
      if (risk) lines.push(`  风险: ${risk.level} - ${risk.description}`);
      if (a.description) lines.push(`  ${a.description}`);
    }
  }

  const market = data.market as Record<string, unknown> | undefined;
  const items = market?.items as Array<Record<string, unknown>> | undefined;
  if (items && items.length > 0) {
    lines.push('\n市场行情：');
    for (const item of items) {
      const trend = item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : '─';
      lines.push(`- ${item.name}：${item.basePrice} ${trend}${Math.abs(Number(item.changePercent) || 0)}%`);
    }
  }

  return lines.join('\n');
}

function formatTalentModule(data: Record<string, unknown>): string {
  const lines: string[] = ['【天赋体系】'];

  const categories = data.categories as Array<Record<string, unknown>> | undefined;
  if (categories && categories.length > 0) {
    for (const cat of categories) {
      lines.push(`\n【${cat.name}】${cat.description || ''}`);
      const talents = cat.talents as Array<Record<string, unknown>> | undefined;
      if (talents && talents.length > 0) {
        for (const t of talents) {
          lines.push(`  - ${t.name}（${t.rarity || '普通'}）：${t.description || ''}`);
        }
      }
    }
  }

  return lines.join('\n');
}

// ─── 主函数 ─────────────────────────────────────────

/**
 * 把世界定义中的 modules 配置转为世界书条目
 * 这些条目会注入给 AI，让 AI 知道该世界有哪些系统
 */
export function convertModulesToWorldBookEntries(
  modules: WorldModule[],
  startUid: number = 9000,
): WorldBookEntry[] {
  const entries: WorldBookEntry[] = [];
  let uid = startUid;

  const formatters: Record<string, (data: Record<string, unknown>) => string> = {
    stat: formatStatModule,
    progression: formatProgressionModule,
    survival: formatSurvivalModule,
    business: formatBusinessModule,
    talent: formatTalentModule,
  };

  for (const mod of modules) {
    if (!mod.enabled || !mod.data) continue;

    const formatter = formatters[mod.moduleId];
    if (!formatter) continue; // 跳过没有格式化器的模块（如 dice）

    const content = formatter(mod.data);
    const keywords = MODULE_KEYWORDS[mod.moduleId] || [];

    entries.push({
      id: uid,
      uid: String(uid),
      comment: mod.name || `${mod.moduleId} 模块配置`,
      content,
      constant: true, // 始终注入
      enabled: true,
      selective: false,
      keys: [],
      secondaryKeys: [],
      position: 'after_char',
      insertionOrder: 150, // 在世界书条目之后注入
      order: 150,
    });

    uid++;
  }

  return entries;
}

/**
 * 从 WorldDef 中提取模块配置的世界书条目
 */
export function getModuleWorldBookEntries(
  worldDef: { modules?: WorldModule[] } | null | undefined,
): WorldBookEntry[] {
  if (!worldDef?.modules?.length) return [];
  return convertModulesToWorldBookEntries(worldDef.modules);
}
