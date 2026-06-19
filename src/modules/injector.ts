// ============================================================
//  世界模块化系统 v2 — WorldBook 注入器
//  将模块规则注入AI提示词（通过WorldBookManager）
// ============================================================

import type { WorldDef, WorldModule } from '../data/worlds-schema';
import type { WorldBookManager, WorldBookEntry } from '../worldbook/index';
import type { StatModuleSchema, ProgressionModuleSchema, ResourceModuleSchema, WorldSystemData } from './schema';
import {
  STAT_UPDATE_RULES,
  PROGRESSION_UPDATE_RULES,
  RESOURCE_UPDATE_RULES,
  DICE_RULES_PROMPT,
  DICE_UPDATE_RULES,
} from './prompts';

/**
 * 将世界启用的模块注入为世界书条目（v2 新版）
 * - 使用新的 WorldSystemData schema
 * - 每个模块生成描述性prompt + UpdateVariable规则
 */
export function applyModulesV2(
  wb: WorldBookManager,
  world: WorldDef,
  worldSystem?: WorldSystemData
) {
  if (!world.modules || world.modules.length === 0) return;

  for (const mod of world.modules) {
    if (!mod.enabled) continue;

    const content = generateModuleContentV2(mod, world, worldSystem);
    if (!content) continue;

    wb.addEntries([{
      id: -2000 - Math.abs(hashCode(mod.moduleId)),
      comment: `[模块] ${mod.name}`,
      content,
      constant: true,
      enabled: true,
      selective: false,
      keys: [],
      secondaryKeys: [],
      position: 'after_char' as const,
      insertionOrder: 50,
    }]);
  }
}

/** 根据模块类型生成注入到AI的prompt内容 */
function generateModuleContentV2(
  mod: WorldModule,
  world: WorldDef,
  worldSystem?: WorldSystemData
): string {
  switch (mod.moduleId) {
    case 'stat': {
      const statData = worldSystem?.数值属性 as StatModuleSchema | undefined;
      if (!statData) {
        // 没有运行时数据时，从WorldDef的coreStats生成描述
        if (!world.coreStats?.length) return '';
        const stats = world.coreStats.map(s =>
          `- ${s.name}（${s.description}）：范围 ${s.range?.[0] ?? 0}-${s.range?.[1] ?? 100}${s.important ? '，核心属性' : ''}`
        ).join('\n');
        return `【${mod.name}】\n本世界的核心属性：\n${stats}\n请在变量更新中维护这些属性的当前值。\n\n${STAT_UPDATE_RULES}`;
      }
      // 有运行时数据时，生成详细的属性描述
      const dims = [statData.dim1, statData.dim2, statData.dim3, statData.dim4, statData.dim5, statData.dim6];
      const dimNames = ['dim1', 'dim2', 'dim3', 'dim4', 'dim5', 'dim6'];
      const dimDesc = dims.map((d, i) =>
        `- ${d.name}（${dimNames[i]}）：当前 ${d.value}，范围 ${d.range[0]}-${d.range[1]}`
      ).join('\n');
      const specialDesc = statData.special.length > 0
        ? '\n特色属性：\n' + statData.special.map(s =>
            `- ${s.name}（${s.id}）：当前 ${s.value}，范围 ${s.range[0]}-${s.range[1]}，${s.description}`
          ).join('\n')
        : '';
      return `【${mod.name}】\n底层属性：${statData.attrA.name} ${statData.attrA.current}/${statData.attrA.max}，${statData.attrB.name} ${statData.attrB.current}/${statData.attrB.max}\n六维属性：\n${dimDesc}${specialDesc}\n\n${STAT_UPDATE_RULES}`;
    }

    case 'progression': {
      const progData = worldSystem?.成长体系 as ProgressionModuleSchema | undefined;
      if (!progData) {
        if (!world.progression) return '';
        const p = world.progression;
        const tiers = p.tiers?.map((t, i) => `  ${i + 1}. ${t.name}${t.description ? ` — ${t.description}` : ''}`).join('\n') || '';
        return `【${mod.name}】\n成长体系类型：${p.type}\n${p.description ? `说明：${p.description}\n` : ''}${tiers ? `进阶阶段：\n${tiers}` : ''}\n请在故事中体现角色的成长进阶。\n\n${PROGRESSION_UPDATE_RULES}`;
      }
      const currentTier = progData.tiers[progData.currentTierIndex];
      const tierList = progData.tiers.map((t, i) =>
        `  ${i + 1}. ${t.name}${i === progData.currentTierIndex ? '（当前）' : ''} — ${t.description}`
      ).join('\n');
      return `【${mod.name}】\n模式：${progData.mode === 'tiered' ? '段位制' : '等级制'}\n当前：${currentTier?.name || '未知'}（第${progData.currentTierIndex + 1}级）\n经验：${progData.currentXP}\n阶段列表：\n${tierList}\n\n${PROGRESSION_UPDATE_RULES}`;
    }

    case 'resource': {
      const resData = worldSystem?.资源管理 as ResourceModuleSchema | undefined;
      if (!resData) {
        if (!world.resources?.resources?.length) return '';
        const res = world.resources.resources.map(r =>
          `- ${r.name}（${r.description}）${r.symbol ? ` 符号:${r.symbol}` : ''}${r.scarce ? ' [稀缺]' : ''}`
        ).join('\n');
        return `【${mod.name}】\n${world.resources.description || ''}\n资源列表：\n${res}\n请在变量更新中维护资源数量变化。\n\n${RESOURCE_UPDATE_RULES}`;
      }
      const currencyDesc = resData.currency
        ? `货币：${resData.currency.name} ${resData.currency.amount}${resData.currency.symbol || ''}\n`
        : '';
      const itemsDesc = resData.items.map(r =>
        `- ${r.name}（${r.id}）${r.symbol}：${r.amount}${r.max ? `/${r.max}` : ''}${r.scarce ? ' [稀缺]' : ''} — ${r.description}`
      ).join('\n');
      return `【${mod.name}】\n${resData.description}\n${currencyDesc}资源列表：\n${itemsDesc}\n\n${RESOURCE_UPDATE_RULES}`;
    }

    case 'dice': {
      const promptContent = (mod.config?.promptContent as string) || DICE_RULES_PROMPT;
      return `${promptContent}\n\n${DICE_UPDATE_RULES}`;
    }

    case 'custom_prompt': {
      return (mod.config?.promptContent as string) || '';
    }

    default:
      return '';
  }
}

/** 简单哈希函数 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 10000;
}
