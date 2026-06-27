// 选择式世界生成管线 — 2次调用版本
// 第1次：生成所有维度的选项（粗纲）
// 第2次：根据选择生成完整世界（细纲）
// ============================================================

import type { WorldBookEntryDef, WorldDef } from '../../data/worlds-schema';
import { executeBuildPipeline } from '../../modules/buildPipeline';
import { createBuildContext } from '../../modules/buildContext';
import type { CallAI } from '../types';
import type { DimensionConfig, DimensionGeneration, DimensionSelection } from './types';
import { DIMENSIONS } from './prompts';

// ── JSON 提取工具 ──
function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}

/**
 * 第1次调用：一次生成所有维度的选项
 * 返回 Record<dimensionKey, DimensionGeneration>
 */
export async function generateAllOptions(
  userDesc: string,
  callAI: CallAI,
): Promise<Record<string, DimensionGeneration>> {
  const dimensionList = DIMENSIONS.map(d =>
    `- ${d.label}（${d.key}）：${getDimensionHint(d.key)}`
  ).join('\n');

  const prompt = `你是一个世界构建专家。用户想要创建一个世界：
"${userDesc}"

请为以下每个维度各生成4个选项。每个选项要有明显差异，并且与用户描述的世界类型相匹配。

维度列表：
${dimensionList}

请严格按以下JSON格式返回，不要有任何其他文字：
{
  "worldType": {
    "narrative": "关于世界类型的2-3句描述",
    "choices": [
      { "id": "A", "title": "类型名", "subtitle": "一句话描述" },
      { "id": "B", "title": "类型名", "subtitle": "一句话描述" },
      { "id": "C", "title": "类型名", "subtitle": "一句话描述" },
      { "id": "D", "title": "类型名", "subtitle": "一句话描述" }
    ]
  },
  "tone": { "narrative": "...", "choices": [...] },
  "geography": { "narrative": "...", "choices": [...] },
  "factions": { "narrative": "...", "choices": [...] },
  "culture": { "narrative": "...", "choices": [...] },
  "economy": { "narrative": "...", "choices": [...] },
  "npcs": { "narrative": "...", "choices": [...] },
  "rules": { "narrative": "...", "choices": [...] }
}`;

  const raw = await callAI([{ role: 'user', content: prompt }]);
  const data = JSON.parse(extractJSON(raw));

  // 整理为标准格式
  const result: Record<string, DimensionGeneration> = {};
  for (const dim of DIMENSIONS) {
    const dimData = data[dim.key];
    if (dimData && Array.isArray(dimData.choices)) {
      result[dim.key] = {
        narrative: dimData.narrative || '',
        choices: dimData.choices,
      };
    } else {
      // 兜底：空选项
      result[dim.key] = { narrative: '', choices: [] };
    }
  }
  return result;
}

/**
 * 第2次调用：根据用户选择生成完整世界数据
 * 返回 WorldDef + WorldBookEntryDef[]
 */
export async function generateWorldFromSelections(
  userDesc: string,
  selections: DimensionSelection[],
  callAI: CallAI,
): Promise<{ worldDef: Partial<WorldDef>; worldBookEntries: WorldBookEntryDef[] }> {
  const selectionSummary = selections
    .map(s => `【${s.dimensionLabel}】${s.choice.title}：${s.choice.subtitle}`)
    .join('\n');

  const prompt = `你是一个世界构建专家。用户想要创建一个世界：
"${userDesc}"

用户已做出以下选择：
${selectionSummary}

请根据以上信息生成一个完整的世界设定。返回严格的JSON格式，不要有任何其他文字：

{
  "name": "世界名称（2-6个字，有创意）",
  "description": "一句话描述（15-30字）",
  "icon": "一个lucide图标名（如 Globe, Flame, Mountain, Ship, Rocket, Star, Ghost, Crown, Skull, Gem 等）",
  "tags": ["标签1", "标签2", "标签3"],
  "difficulty": "easy/medium/hard",
  "overview": "世界观概述（100-200字，描述这个世界的整体面貌）",
  "atmosphere": "氛围关键词（如 阴暗压抑、轻松明快、史诗壮阔）",
  "timePeriod": "时代背景（如 远古、中世纪、近未来）",
  "locations": [
    { "name": "区域名", "description": "区域描述（30-60字）" }
  ],
  "factions": [
    { "name": "势力名", "description": "势力描述（30-60字）", "alignment": "friendly/neutral/hostile" }
  ],
  "npcs": [
    { "name": "NPC名", "role": "角色定位", "description": "简要描述", "personality": "性格标签" }
  ],
  "culture": "文化风俗描述（50-100字，包含信仰、习俗、禁忌等）",
  "economy": {
    "currencyName": "货币名",
    "currencySymbol": "货币符号",
    "currencyDesc": "货币描述",
    "priceLevel": "物价水平描述"
  },
  "rules": {
    "powerSystem": "力量/权力体系名称",
    "socialStructure": "社会结构描述",
    "specialRules": ["特殊规则1", "特殊规则2"]
  },
  "highlights": ["核心特色1", "核心特色2", "核心特色3"]
}`;

  const raw = await callAI([{ role: 'user', content: prompt }]);
  const data = JSON.parse(extractJSON(raw));

  // 组装 WorldDef
  const worldDef: Partial<WorldDef> = {
    name: data.name || '未命名世界',
    description: data.description || '',
    icon: data.icon || 'Globe',
    tags: data.tags || [],
    difficulty: data.difficulty || 'medium',
  };

  // 组装 WorldBookEntryDef[]
  const entries: WorldBookEntryDef[] = [];
  let uid = 1;

  // 1. setting entry
  const worldTypeSel = selections.find(s => s.dimensionKey === 'worldType');
  const toneSel = selections.find(s => s.dimensionKey === 'tone');
  entries.push({
    uid: uid++, key: [], constant: true, comment: '世界设定',
    content: data.overview || '',
    order: 1, position: 'before_char', entryType: 'setting',
    meta: {
      genre: worldTypeSel?.choice.title,
      atmosphere: data.atmosphere || toneSel?.choice.title,
      timePeriod: data.timePeriod,
    },
  });

  // 2. lore entries（地理）
  if (Array.isArray(data.locations)) {
    for (const loc of data.locations) {
      entries.push({
        uid: uid++, key: [loc.name], constant: false,
        comment: loc.name, content: loc.description || '',
        order: 2, position: 'before_char', entryType: 'lore',
      });
    }
  }

  // 3. factions entry
  if (Array.isArray(data.factions) && data.factions.length > 0) {
    entries.push({
      uid: uid++, key: [], constant: true, comment: '势力格局',
      content: data.factions.map((f: any) => `${f.name}：${f.description}`).join('\n'),
      order: 3, position: 'before_char', entryType: 'factions',
      meta: { factions: data.factions },
    });
  }

  // 4. culture entry
  if (data.culture) {
    entries.push({
      uid: uid++, key: ['文化', '风俗'], constant: false,
      comment: '文化风俗', content: data.culture,
      order: 4, position: 'before_char', entryType: 'culture',
    });
  }

  // 5. economy entry
  if (data.economy) {
    const eco = data.economy;
    entries.push({
      uid: uid++, key: ['货币', '经济', '消费'], constant: false,
      comment: '经济系统',
      content: [eco.currencyName, eco.currencyDesc].filter(Boolean).join('：'),
      order: 5, position: 'before_char', entryType: 'economy',
      meta: {
        currency: { name: eco.currencyName, symbol: eco.currencySymbol, description: eco.currencyDesc },
        priceLevel: eco.priceLevel,
      },
    });
  }

  // 6. npcs entry
  if (Array.isArray(data.npcs) && data.npcs.length > 0) {
    entries.push({
      uid: uid++, key: [], constant: true, comment: '关键人物',
      content: data.npcs.map((n: any) => `${n.name}（${n.role}）：${n.description}`).join('\n'),
      order: 6, position: 'before_char', entryType: 'npcs',
      meta: { npcs: data.npcs },
    });
  }

  // 7. rules entry
  if (data.rules) {
    entries.push({
      uid: uid++, key: [], constant: true, comment: '世界规则',
      content: [data.rules.powerSystem, data.rules.socialStructure].filter(Boolean).join('\n'),
      order: 7, position: 'before_char', entryType: 'rules',
      meta: {
        powerSystem: data.rules.powerSystem,
        socialStructure: data.rules.socialStructure,
        specialRules: data.rules.specialRules,
      },
    });
  }

  // 8. highlights entry
  if (Array.isArray(data.highlights) && data.highlights.length > 0) {
    entries.push({
      uid: uid++, key: [], constant: true, comment: '核心特色',
      content: data.highlights.join('、'),
      order: 8, position: 'before_char', entryType: 'highlights',
      meta: { highlights: data.highlights },
    });
  }

  return { worldDef, worldBookEntries: entries };
}

/**
 * 为选中的模块生成世界书条目
 */
export async function generateModuleEntries(
  worldDesc: string,
  selectedModules: string[],
  callAI: CallAI,
): Promise<WorldBookEntryDef[]> {
  if (selectedModules.length === 0) return [];

  const buildCtx = createBuildContext(worldDesc, selectedModules);

  await executeBuildPipeline(buildCtx, {
    callAI,
    onProgress: () => {},
  });

  if (buildCtx.worldBookEntries?.length) {
    return buildCtx.worldBookEntries.map((e, i) => ({
      ...e,
      uid: -5000 - i,
      entryType: 'module_rule' as const,
    }));
  }

  return [];
}

// ── 辅助函数 ──

function getDimensionHint(key: string): string {
  const hints: Record<string, string> = {
    worldType: '根据用户描述生成4个不同世界类型变体（如用户描述修仙，可生成"古典仙侠"、"都市修仙"等）',
    tone: '不同风格基调，如"严肃古典"、"轻松日常"、"黑暗残酷"、"史诗壮阔"',
    geography: '不同地理格局，如"五大陆分布"、"群岛散布"、"一超多强"',
    factions: '不同势力结构，如"正邪对立"、"群雄割据"、"暗流涌动"',
    culture: '不同文化特征，如"宗门制度"、"城邦联盟"、"部落传统"',
    economy: '不同经济体系，如"灵石经济"、"信用点体系"、"以物易物"',
    npcs: '不同关键人物组合，如"正道领袖"、"亦正亦邪"、"底层群像"',
    rules: '不同规则体系，如"修仙九境"、"科技等级"、"血脉觉醒"',
  };
  return hints[key] || '生成4个有明显差异的选项';
}

/** 获取维度配置列表 */
export function getDimensions(): DimensionConfig[] {
  return DIMENSIONS;
}
