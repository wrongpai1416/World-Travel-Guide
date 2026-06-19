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
  resource: ['资源', '货币', '物品', '背包', '金币', '材料'],
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

function formatResourceModule(data: Record<string, unknown>): string {
  const lines: string[] = ['【资源管理系统】'];

  if (data.description) {
    lines.push(String(data.description));
  }

  const items = data.items as Array<Record<string, unknown>> | undefined;
  if (items && items.length > 0) {
    lines.push('资源列表：');
    for (const item of items) {
      const scarce = item.scarce ? ' [稀缺]' : '';
      const maxStr = item.max != null ? ` 上限:${item.max}` : '';
      lines.push(`  ${item.symbol || '•'} ${item.name}（${item.id}）：${item.description || ''}${scarce}${maxStr}`);
    }
  }

  const currency = data.currency as Record<string, unknown> | undefined;
  if (currency) {
    lines.push(`货币：${currency.symbol || ''} ${currency.name} - ${currency.description || ''}`);
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
    resource: formatResourceModule,
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
