// ============================================================
//  世界模块化系统 v2 — WorldBook 注入器
//  将模块规则注入AI提示词（通过WorldBookManager）
// ============================================================

import type { WorldDef, WorldModule, WorldBookEntryDef } from '../data/worlds-schema';
import type { WorldBookManager, WorldBookEntry } from '../worldbook/index';
import type { StatModuleSchema, ProgressionModuleSchema, ResourceModuleSchema, TalentModuleSchema, WorldSystemData } from './schema';
import {
  STAT_UPDATE_RULES,
  PROGRESSION_UPDATE_RULES,
  RESOURCE_UPDATE_RULES,
  DICE_RULES_PROMPT,
  DICE_UPDATE_RULES,
  TALENT_UPDATE_RULES,
} from './prompts';

/**
 * 将世界启用的模块注入为世界书条目（v2 新版）
 * - 优先使用管线生成的世界书条目（world.worldBookEntries）
 * - 如果没有，则从模块数据动态生成
 *
 * @param world 世界定义（包含模块配置）
 * @param playerState 玩家状态（动态数据，如当前段位索引、当前经验值）
 */
export function applyModulesV2(
  wb: WorldBookManager,
  world: WorldDef,
  worldSystem?: WorldSystemData,
  playerState?: { 当前段位索引?: number; 当前经验值?: number }
) {
  if (!world.modules || world.modules.length === 0) return;

  // 优先使用管线生成的世界书条目
  if (world.worldBookEntries && world.worldBookEntries.length > 0) {
    const entries: WorldBookEntry[] = world.worldBookEntries.map((e, idx) => ({
      id: -5000 - idx,
      comment: e.comment,
      content: e.content,
      constant: e.constant,
      enabled: !e.disable,
      selective: (e.key?.length ?? 0) > 0,
      keys: e.key || [],
      secondaryKeys: e.keysecondary || [],
      position: e.position || 'after_char',
      insertionOrder: e.order ?? 0,
    }));
    wb.addEntries(entries);
    return;
  }

  // 回退：从模块数据动态生成（兼容旧世界）
  for (const mod of world.modules) {
    if (!mod.enabled) continue;

    const entries = generateModuleEntriesV2(mod, world, worldSystem, playerState);
    wb.addEntries(entries);
  }
}

/** 模块注入的绿灯配置（所有模块都是绿灯，关键词触发） */
const MODULE_GREEN_KEYWORDS: Record<string, string[]> = {
  // 数值属性：提到属性/血量/生命等才注入
  stat: ['属性', '血量', '生命', '能量', '体力', '攻击', '防御', '速度', '力量', '敏捷', '智力', '感知', '魅力', '幸运'],
  // 成长体系：提到境界/升级/段位等才注入
  progression: ['境界', '段位', '升级', '突破', '经验', '等级', '进阶', '修炼', '晋升', '提升', '等级制', '段位制', '升级', '升段'],
  // 资源管理：提到资源/货币等才注入
  resource: ['资源', '货币', '材料', '金币', '银两', '物品', '背包', '仓库', '商店', '购买', '出售', '铜钱', '灵石'],
  // 骰子检定：提到掷骰/检定等才注入
  dice: ['掷骰', '检定', '判定', 'd20', '骰子', '骰', '难度', 'DC', '成功率', '豁免'],
  // 天赋体系：提到天赋/技能等才注入
  talent: ['天赋', '技能', '觉醒', '能力', '神通', '功法', '武技', '魔法', '异能', '被动', '主动'],
  // 自定义提示词：常驻注入（蓝灯）
  custom_prompt: [],
};

/**
 * 为单个模块生成世界书条目（全部绿灯，关键词触发）
 * 自定义提示词除外（蓝灯常驻）
 */
function generateModuleEntriesV2(
  mod: WorldModule,
  world: WorldDef,
  worldSystem?: WorldSystemData,
  playerState?: { 当前段位索引?: number; 当前经验值?: number }
): WorldBookEntry[] {
  const entries: WorldBookEntry[] = [];
  const keywords = MODULE_GREEN_KEYWORDS[mod.moduleId] || [];

  // 兼容新格式（moduleConfig）和旧格式（data）
  const getModData = (mod: WorldModule) => mod.moduleConfig || mod.data;

  switch (mod.moduleId) {
    case 'stat': {
      const statData = (worldSystem?.数值属性 || getModData(mod)) as StatModuleSchema | undefined;
      if (!statData?.attrA) break;

      // 绿灯：数值属性状态 + 更新规则（关键词触发）
      const statusContent = generateStatStatusContent(mod.name, statData);
      const fullContent = `${statusContent}\n\n${STAT_UPDATE_RULES}`;
      if (keywords.length > 0) {
        entries.push(createGreenEntry(mod.moduleId, `[模块] ${mod.name}`, fullContent, keywords, 50));
      }
      break;
    }

    case 'progression': {
      // 配置从世界定义读取，状态从 playerState 读取
      const config = getModData(mod) as ProgressionModuleSchema | undefined;
      if (!config) break;

      const statusContent = generateProgressionStatusContent(mod.name, config, playerState);
      const fullContent = `${statusContent}\n\n${PROGRESSION_UPDATE_RULES}`;
      if (keywords.length > 0) {
        entries.push(createGreenEntry(mod.moduleId, `[模块] ${mod.name}`, fullContent, keywords, 50));
      }
      break;
    }

    case 'resource': {
      const resData = (worldSystem?.资源管理 || getModData(mod)) as ResourceModuleSchema | undefined;
      if (!resData?.items?.length) break;

      // 绿灯：资源状态 + 更新规则（关键词触发）
      const statusContent = generateResourceStatusContent(mod.name, resData);
      const fullContent = `${statusContent}\n\n${RESOURCE_UPDATE_RULES}`;
      if (keywords.length > 0) {
        entries.push(createGreenEntry(mod.moduleId, `[模块] ${mod.name}`, fullContent, keywords, 50));
      }
      break;
    }

    case 'dice': {
      // 绿灯：骰子检定规则（关键词触发）
      const promptContent = (mod.config?.promptContent as string) || DICE_RULES_PROMPT;
      const content = `${promptContent}\n\n${DICE_UPDATE_RULES}`;
      if (keywords.length > 0) {
        entries.push(createGreenEntry(mod.moduleId, `[模块] ${mod.name}`, content, keywords, 50));
      }
      break;
    }

    case 'talent': {
      const talentData = (worldSystem?.天赋体系 || mod.data) as TalentModuleSchema | undefined;
      if (!talentData?.categories?.length) break;

      // 绿灯：天赋体系详情（关键词触发）
      const content = generateTalentContent(mod.name, talentData);
      if (keywords.length > 0) {
        entries.push(createGreenEntry(mod.moduleId, `[模块] ${mod.name}`, `${content}\n\n${TALENT_UPDATE_RULES}`, keywords, 50));
      }
      break;
    }

    case 'custom_prompt': {
      // 蓝灯：自定义提示词（常驻注入）
      const content = (mod.config?.promptContent as string) || '';
      if (content) {
        entries.push(createBlueEntry(mod.moduleId, `[模块] ${mod.name}`, content, 50));
      }
      break;
    }
  }

  return entries;
}

/** 根据模块类型生成注入到AI的prompt内容 */
function generateModuleContentV2(
  mod: WorldModule,
  world: WorldDef,
  worldSystem?: WorldSystemData
): string {
  // 数据优先级：worldSystem（运行时）> mod.data（模块初始数据）> 旧WorldDef字段
  const modData = mod.data as Record<string, unknown> | undefined;

  switch (mod.moduleId) {
    case 'stat': {
      const statData = (worldSystem?.数值属性 || modData) as StatModuleSchema | undefined;
      if (!statData?.attrA) return '';
      const dims = [statData.dim1, statData.dim2, statData.dim3, statData.dim4, statData.dim5, statData.dim6];
      const dimKeys = ['dim1', 'dim2', 'dim3', 'dim4', 'dim5', 'dim6'];
      const dimDesc = dims.map((d, i) =>
        `- ${d.name}（${dimKeys[i]}）：当前 ${d.value}，范围 ${d.range[0]}-${d.range[1]}`
      ).join('\n');
      const specialDesc = statData.special.length > 0
        ? '\n特色属性：\n' + statData.special.map(s =>
            `- ${s.name}（${s.id}）：当前 ${s.value}，范围 ${s.range[0]}-${s.range[1]}，${s.description}`
          ).join('\n')
        : '';
      return `【${mod.name}】\n底层属性：${statData.attrA.name} ${statData.attrA.current}/${statData.attrA.max}，${statData.attrB.name} ${statData.attrB.current}/${statData.attrB.max}\n六维属性：\n${dimDesc}${specialDesc}\n\n${STAT_UPDATE_RULES}`;
    }

    case 'progression': {
      const progData = (worldSystem?.成长体系 || modData) as ProgressionModuleSchema | undefined;
      if (!progData) return '';

      // 等级制
      if (progData.mode === 'level' && progData.levelData) {
        const ld = progData.levelData;
        return `【${mod.name}】\n模式：等级制（0~${ld.maxLevel}级）\n当前：Lv.${progData.currentTierIndex}\n经验：${progData.currentXP}\n\n${PROGRESSION_UPDATE_RULES}`;
      }

      // 段位制
      if (!progData.tiers?.length) return '';
      const currentTier = progData.tiers[progData.currentTierIndex];
      const tierList = progData.tiers.map((t, i) =>
        `  ${i + 1}. ${t.name}${i === progData.currentTierIndex ? '（当前）' : ''} — ${t.description}`
      ).join('\n');
      return `【${mod.name}】\n模式：段位制\n当前：${currentTier?.name || '未知'}（第${progData.currentTierIndex + 1}段）\n经验：${progData.currentXP}\n段位列表：\n${tierList}\n\n${PROGRESSION_UPDATE_RULES}`;
    }

    case 'resource': {
      const resData = (worldSystem?.资源管理 || modData) as ResourceModuleSchema | undefined;
      if (!resData?.items?.length) return '';
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

    case 'talent': {
      const talentData = (worldSystem?.天赋体系 || modData) as TalentModuleSchema | undefined;
      if (!talentData?.categories?.length) return '';
      const catDesc = talentData.categories.map(cat => {
        const talentsDesc = cat.talents.map(t =>
            `    - ${t.name}【${t.rarity}】：${t.description}`
          ).join('\n');
        return `  【${cat.name}】${cat.description}\n${talentsDesc}`;
      }).join('\n\n');
      return `【${mod.name}】\n${catDesc}\n\n${TALENT_UPDATE_RULES}`;
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

/** 创建蓝灯条目（常驻注入） */
function createBlueEntry(moduleId: string, comment: string, content: string, order: number): WorldBookEntry {
  return {
    id: -2000 - Math.abs(hashCode(moduleId + comment)),
    comment,
    content,
    constant: true,
    enabled: true,
    selective: false,
    keys: [],
    secondaryKeys: [],
    position: 'after_char' as const,
    insertionOrder: order,
  };
}

/** 创建绿灯条目（关键词触发） */
function createGreenEntry(moduleId: string, comment: string, content: string, keywords: string[], order: number): WorldBookEntry {
  return {
    id: -3000 - Math.abs(hashCode(moduleId + comment)),
    comment,
    content,
    constant: false,
    enabled: true,
    selective: true,
    keys: keywords,
    secondaryKeys: [],
    position: 'after_char' as const,
    insertionOrder: order,
  };
}

/** 生成数值属性状态内容（不含更新规则） */
function generateStatStatusContent(moduleName: string, statData: StatModuleSchema): string {
  const dims = [statData.dim1, statData.dim2, statData.dim3, statData.dim4, statData.dim5, statData.dim6];
  const dimKeys = ['dim1', 'dim2', 'dim3', 'dim4', 'dim5', 'dim6'];
  const dimDesc = dims.map((d, i) =>
    d ? `- ${d.name}（${dimKeys[i]}）：当前 ${d.value}，范围 ${d.range[0]}-${d.range[1]}` : ''
  ).filter(Boolean).join('\n');
  const specialDesc = statData.special.length > 0
    ? '\n特色属性：\n' + statData.special.map(s =>
        `- ${s.name}（${s.id}）：当前 ${s.value}，范围 ${s.range[0]}-${s.range[1]}，${s.description}`
      ).join('\n')
    : '';
  return `【${moduleName}】\n底层属性：${statData.attrA.name} ${statData.attrA.current}/${statData.attrA.max}，${statData.attrB.name} ${statData.attrB.current}/${statData.attrB.max}\n六维属性：\n${dimDesc}${specialDesc}`;
}

/**
 * 生成成长体系状态内容（不含更新规则）
 * @param moduleName 模块名称
 * @param config 世界定义中的配置（段位列表、经验公式等）
 * @param playerState 玩家状态（当前段位索引、当前经验值）
 */
function generateProgressionStatusContent(
  moduleName: string,
  config: ProgressionModuleSchema,
  playerState?: { 当前段位索引?: number; 当前经验值?: number }
): string {
  const currentTierIndex = playerState?.当前段位索引 ?? 0;
  const currentXP = playerState?.当前经验值 ?? 0;

  if (config.mode === 'level' && config.levelData) {
    const ld = config.levelData;
    return `【${moduleName}】\n模式：等级制（0~${ld.maxLevel}级）\n当前：Lv.${currentTierIndex}\n经验：${currentXP}`;
  }

  if (config.tiers?.length) {
    const currentTier = config.tiers[currentTierIndex];
    const tierList = config.tiers.map((t, i) =>
      `  ${i + 1}. ${t.name}${i === currentTierIndex ? '（当前）' : ''} — ${t.description}`
    ).join('\n');
    return `【${moduleName}】\n模式：段位制\n当前：${currentTier?.name || '未知'}（第${currentTierIndex + 1}段）\n经验：${currentXP}\n段位列表：\n${tierList}`;
  }

  return '';
}

/** 生成资源管理状态内容（不含更新规则） */
function generateResourceStatusContent(moduleName: string, resData: ResourceModuleSchema): string {
  const currencyDesc = resData.currency
    ? `货币：${resData.currency.name} ${resData.currency.amount}${resData.currency.symbol || ''}\n`
    : '';
  const itemsDesc = resData.items.map(r =>
    `- ${r.name}（${r.id}）${r.symbol}：${r.amount}${r.max ? `/${r.max}` : ''}${r.scarce ? ' [稀缺]' : ''} — ${r.description}`
  ).join('\n');
  return `【${moduleName}】\n${resData.description}\n${currencyDesc}资源列表：\n${itemsDesc}`;
}

/** 生成天赋体系内容 */
function generateTalentContent(moduleName: string, talentData: TalentModuleSchema): string {
  const catDesc = talentData.categories.map(cat => {
    const talentsDesc = cat.talents.map(t =>
        `    - ${t.name}【${t.rarity}】：${t.description}`
      ).join('\n');
    return `  【${cat.name}】${cat.description}\n${talentsDesc}`;
  }).join('\n\n');
  return `【${moduleName}】\n${catDesc}`;
}
