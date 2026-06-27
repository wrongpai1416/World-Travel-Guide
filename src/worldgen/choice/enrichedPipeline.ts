// ============================================================
//  增强版选择式世界生成管线
//  在原 choicePipeline 基础上，产出与 7 阶段管线同等粒度的 WorldBookEntryDef[]
//  - 每个势力/NPC/地点独立条目，keyword 触发
//  - 丰富的 meta 数据
//  - 智能关键词生成
// ============================================================

import type { WorldBookEntryDef, WorldDef, WorldModule } from '../../data/worlds-schema';
import type { CallAI } from '../types';
import type { DimensionSelection } from './types';
import { executeBuildPipeline } from '../../modules/buildPipeline';
import { createBuildContext } from '../../modules/buildContext';
import { createFallbackModule } from '../../modules/defaults';

// ── JSON 提取工具 ──
function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch
    ? codeBlockMatch[1].trim()
    : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}

// ── 关键词生成工具（复用 stage5 逻辑） ──

/** 从名称和关联词生成关键词 */
function generateKeywords(name: string, related: Array<string | undefined>): string[] {
  const keywords = [name];
  for (const r of related) {
    if (r && r.length > 0 && r.length < 10) {
      keywords.push(r);
    }
  }
  return [...new Set(keywords)].slice(0, 8);
}

/** 从文本中提取关键词 */
function extractKeywordsFromText(text: string): string[] {
  const matches = text.match(/[一-龥]{2,4}/g) || [];
  const unique = [...new Set(matches)].filter(
    w => w.length >= 2 && !['的', '是', '在', '了', '和', '与', '或', '但', '而', '也', '都', '就', '不'].includes(w),
  );
  return unique.slice(0, 5);
}

// ── 增强版 AI Prompt（要求返回丰富数据结构） ──

function buildRichPrompt(userDesc: string, selectionSummary: string): string {
  return `你是一个世界构建专家。用户想要创建一个世界：
"${userDesc}"

用户已做出以下选择：
${selectionSummary}

请根据以上信息生成一个完整且丰富的世界设定。要求：
- 每个势力要有：名称、描述、阵营(alignment)、总部(headquarters)、理念(philosophy)、实力(strength)、内部派系(internalFactions)
- 每个NPC要有：名称、角色(role)、描述、性格(personality)、外貌(appearance)、背景(background)、动机(motivation)、秘密(secrets)
- 每个地点要有：名称、描述、特征(features)、氛围(atmosphere)、历史(history)
- 文化要有：描述、风俗(customs)、信仰(beliefs)、日常(dailyLife)、禁忌(taboos)
- 经济要有：货币(currency)、物价(priceLevel)、贸易路线(tradeRoutes)、稀缺资源(scarceResources)
- 规则要有：力量体系(powerSystem)、社会结构(socialStructure)、特殊规则(specialRules)、物理法则(physicalLaws)
- 事件要有：名称、描述、触发条件(trigger)、重要性(significance)、影响(impact)

请严格按以下JSON格式返回，不要有任何其他文字：

{
  "name": "世界名称（2-6个字，有创意）",
  "description": "一句话描述（15-30字）",
  "icon": "一个lucide图标名（如 Globe, Flame, Mountain, Ship, Rocket, Star, Ghost, Crown, Skull, Gem 等）",
  "tags": ["标签1", "标签2", "标签3"],
  "difficulty": "easy/medium/hard",
  "overview": "世界观概述（150-300字，描述这个世界的整体面貌、历史背景、核心特征）",
  "atmosphere": "氛围关键词（如 阴暗压抑、轻松明快、史诗壮阔）",
  "timePeriod": "时代背景（如 远古、中世纪、近未来）",
  "locations": [
    {
      "name": "区域名",
      "description": "区域描述（50-100字）",
      "features": ["特征1", "特征2"],
      "atmosphere": "氛围描述",
      "history": "历史背景（30-60字）"
    }
  ],
  "factions": [
    {
      "name": "势力名",
      "description": "势力描述（50-100字）",
      "alignment": "friendly/neutral/hostile",
      "headquarters": "总部所在地",
      "philosophy": "核心理念",
      "strength": "实力描述",
      "internalFactions": ["派系1", "派系2"],
      "relationships": [{ "target": "另一势力名", "relation": "关系描述" }]
    }
  ],
  "npcs": [
    {
      "name": "NPC名",
      "role": "角色定位",
      "description": "简要描述（30-60字）",
      "personality": "性格标签",
      "appearance": "外貌特征",
      "background": "背景故事（30-60字）",
      "motivation": "核心动机",
      "secrets": "隐藏的秘密",
      "relationships": [{ "target": "另一NPC或势力名", "relation": "关系描述" }]
    }
  ],
  "events": [
    {
      "name": "事件名",
      "description": "事件描述（30-60字）",
      "trigger": "触发条件",
      "significance": "major/minor",
      "impact": "事件影响"
    }
  ],
  "culture": {
    "description": "文化概述（50-100字）",
    "customs": ["风俗1", "风俗2", "风俗3"],
    "beliefs": ["信仰1", "信仰2"],
    "dailyLife": "日常生活描述",
    "taboos": ["禁忌1", "禁忌2"]
  },
  "economy": {
    "currency": { "name": "货币名", "symbol": "货币符号", "description": "货币描述" },
    "priceLevel": "物价水平描述",
    "tradeRoutes": ["贸易路线1", "贸易路线2"],
    "scarceResources": ["稀缺资源1", "稀缺资源2"]
  },
  "rules": {
    "powerSystem": "力量/权力体系（100-200字，详细描述等级、修炼方式、能力范围）",
    "socialStructure": "社会结构描述",
    "specialRules": ["特殊规则1", "特殊规则2", "特殊规则3"],
    "physicalLaws": "物理法则（如果有特殊设定）"
  },
  "highlights": ["核心特色1", "核心特色2", "核心特色3"]
}`;
}

// ── 主函数：增强版世界生成 ──

export async function generateRichWorldFromSelections(
  userDesc: string,
  selections: DimensionSelection[],
  callAI: CallAI,
): Promise<{ worldDef: Partial<WorldDef>; worldBookEntries: WorldBookEntryDef[] }> {
  const selectionSummary = selections
    .map(s => `【${s.dimensionLabel}】${s.choice.title}：${s.choice.subtitle}`)
    .join('\n');

  const prompt = buildRichPrompt(userDesc, selectionSummary);
  const raw = await callAI([{ role: 'user', content: prompt }]);
  const data = JSON.parse(extractJSON(raw));

  // ── 组装 WorldDef ──
  const worldDef: Partial<WorldDef> = {
    name: data.name || '未命名世界',
    description: data.description || '',
    icon: data.icon || 'Globe',
    tags: data.tags || [],
    difficulty: data.difficulty || 'medium',
  };

  // ── 组装丰富的 WorldBookEntryDef[] ──
  const entries: WorldBookEntryDef[] = [];
  let uid = 1;

  // 1. setting entry（常驻）
  const mainLocation = Array.isArray(data.locations) && data.locations.length > 0
    ? data.locations.map((l: any) => l.name).join('、')
    : '';
  const atmosphere = data.atmosphere || '';

  entries.push({
    uid: uid++,
    key: [],
    constant: true,
    comment: '世界设定',
    content: data.overview || '',
    order: 1,
    position: 'before_char',
    entryType: 'setting',
    meta: {
      location: mainLocation || undefined,
      timePeriod: data.timePeriod || undefined,
      atmosphere: atmosphere || undefined,
    },
  });

  // 2. 核心规则（常驻）
  if (data.rules) {
    entries.push({
      uid: uid++,
      key: [],
      constant: true,
      comment: '核心规则',
      content: [
        data.rules.powerSystem ? `力量体系：${data.rules.powerSystem}` : '',
        data.rules.socialStructure ? `社会结构：${data.rules.socialStructure}` : '',
        data.rules.specialRules?.length ? `特殊规则：${data.rules.specialRules.join('；')}` : '',
      ].filter(Boolean).join('\n'),
      order: 2,
      position: 'before_char',
      entryType: 'rules',
      meta: {
        powerSystem: data.rules.powerSystem,
        socialStructure: data.rules.socialStructure,
        specialRules: data.rules.specialRules || [],
      },
    });
  }

  // 3. 各势力独立条目（关键词触发）
  if (Array.isArray(data.factions)) {
    for (const faction of data.factions) {
      entries.push({
        uid: uid++,
        key: generateKeywords(faction.name, [
          faction.headquarters,
          faction.philosophy,
          ...(faction.relationships?.map((r: any) => r.target) || []),
        ]),
        constant: false,
        comment: faction.name,
        content: [
          `【${faction.name}】${faction.alignment ? `[${faction.alignment}]` : ''}`,
          faction.description,
          faction.headquarters ? `总部：${faction.headquarters}` : '',
          faction.philosophy ? `理念：${faction.philosophy}` : '',
          faction.strength ? `实力：${faction.strength}` : '',
          faction.internalFactions?.length ? `内部派系：${faction.internalFactions.join('、')}` : '',
        ].filter(Boolean).join('\n'),
        order: 3,
        position: 'before_char',
        entryType: 'factions',
        meta: {
          factions: [{
            name: faction.name,
            description: faction.description,
            alignment: faction.alignment,
          }],
        },
      });
    }
  }

  // 4. 各 NPC 独立条目（关键词触发）
  if (Array.isArray(data.npcs)) {
    for (const npc of data.npcs) {
      entries.push({
        uid: uid++,
        key: generateKeywords(npc.name, [
          npc.role,
          npc.appearance,
          ...(npc.relationships?.map((r: any) => r.target) || []),
        ]),
        constant: false,
        comment: `${npc.name}（${npc.role}）`,
        content: [
          `【${npc.name}】${npc.role}`,
          npc.description,
          npc.personality ? `性格：${npc.personality}` : '',
          npc.background ? `背景：${npc.background}` : '',
          npc.motivation ? `动机：${npc.motivation}` : '',
        ].filter(Boolean).join('\n'),
        order: 4,
        position: 'before_char',
        entryType: 'npcs',
        meta: {
          npcs: [{
            name: npc.name,
            role: npc.role,
            description: npc.description,
            personality: npc.personality,
          }],
        },
      });
    }
  }

  // 5. 各事件独立条目（关键词触发）
  if (Array.isArray(data.events)) {
    for (const evt of data.events) {
      entries.push({
        uid: uid++,
        key: generateKeywords(evt.name, [evt.trigger, evt.impact || '']),
        constant: false,
        comment: evt.name,
        content: [
          `【${evt.name}】${evt.significance === 'major' ? '【重大事件】' : ''}`,
          evt.description,
          evt.trigger ? `触发条件：${evt.trigger}` : '',
          evt.impact ? `影响：${evt.impact}` : '',
        ].filter(Boolean).join('\n'),
        order: 7,
        position: 'before_char',
        entryType: 'events',
        meta: {
          events: [{
            name: evt.name,
            description: evt.description,
            trigger: evt.trigger,
            significance: evt.significance,
          }],
        },
      });
    }
  }

  // 6. 力量体系详情（关键词触发）
  if (data.rules?.powerSystem) {
    entries.push({
      uid: uid++,
      key: extractKeywordsFromText(data.rules.powerSystem),
      constant: false,
      comment: '力量体系',
      content: data.rules.powerSystem,
      order: 5,
      position: 'before_char',
      entryType: 'rules',
      meta: { powerSystem: data.rules.powerSystem },
    });
  }

  // 7. 经济系统（关键词触发）
  if (data.economy) {
    const eco = data.economy;
    entries.push({
      uid: uid++,
      key: ['花钱', '消费', '买单', '价格', '买东西', '付钱', '货币', '工资', '收入', '买', '卖'],
      constant: false,
      comment: '经济系统',
      content: [
        eco.currency ? `货币：${eco.currency.symbol || ''}${eco.currency.name}${eco.currency.description ? `（${eco.currency.description}）` : ''}` : '',
        eco.priceLevel ? `物价：${eco.priceLevel}` : '',
        eco.tradeRoutes?.length ? `贸易路线：${eco.tradeRoutes.join('、')}` : '',
        eco.scarceResources?.length ? `稀缺资源：${eco.scarceResources.join('、')}` : '',
      ].filter(Boolean).join('\n'),
      order: 6,
      position: 'before_char',
      entryType: 'economy',
      meta: {
        currency: eco.currency,
        priceLevel: eco.priceLevel,
      },
    });
  }

  // 8. 各地点独立条目（lore，关键词触发）
  if (Array.isArray(data.locations)) {
    for (const loc of data.locations) {
      entries.push({
        uid: uid++,
        key: generateKeywords(loc.name, loc.features),
        constant: false,
        comment: loc.name,
        content: [
          `【${loc.name}】`,
          loc.description,
          loc.history ? `历史：${loc.history}` : '',
        ].filter(Boolean).join('\n'),
        order: 8,
        position: 'before_char',
        entryType: 'lore',
        meta: {
          location: loc.name,
          atmosphere: loc.atmosphere,
        },
      });
    }
  }

  // 9. 文化风俗（culture，关键词触发）
  if (data.culture) {
    const cul = data.culture;
    const cultureText = typeof cul === 'string' ? cul : cul.description || '';
    if (cultureText) {
      entries.push({
        uid: uid++,
        key: extractKeywordsFromText(cultureText).concat(
          Array.isArray(cul.customs) ? cul.customs.slice(0, 3) : [],
          Array.isArray(cul.taboos) ? cul.taboos.slice(0, 2) : [],
        ),
        constant: false,
        comment: '文化风俗',
        content: [
          cultureText,
          Array.isArray(cul.customs) && cul.customs.length ? `风俗：${cul.customs.join('、')}` : '',
          Array.isArray(cul.beliefs) && cul.beliefs.length ? `信仰：${cul.beliefs.join('、')}` : '',
          cul.dailyLife ? `日常：${cul.dailyLife}` : '',
          Array.isArray(cul.taboos) && cul.taboos.length ? `禁忌：${cul.taboos.join('、')}` : '',
        ].filter(Boolean).join('\n'),
        order: 9,
        position: 'before_char',
        entryType: 'culture',
        meta: {
          highlights: [
            ...(Array.isArray(cul.customs) ? cul.customs : []),
            ...(Array.isArray(cul.beliefs) ? cul.beliefs : []),
          ],
        },
      });
    }
  }

  // 10. 核心特色（常驻）
  if (Array.isArray(data.highlights) && data.highlights.length > 0) {
    entries.push({
      uid: uid++,
      key: [],
      constant: true,
      comment: '核心特色',
      content: data.highlights.join('、'),
      order: 10,
      position: 'before_char',
      entryType: 'highlights',
      meta: { highlights: data.highlights },
    });
  }

  return { worldDef, worldBookEntries: entries };
}

// ── 模块生成：复用 stage6 逻辑 ──

/** 模块ID到中文名称的映射 */
const MODULE_ID_TO_KEY: Record<string, string> = {
  stat: '数值属性', progression: '成长体系', survival: '生存资源',
  business: '经营资产', dice: '骰子检定', talent: '天赋体系',
};

/**
 * 生成完整的模块配置（moduleConfig + initialState + data）
 * 复用 stage6 的 executeBuildPipeline 逻辑
 */
export async function generateRichModules(
  worldDesc: string,
  selectedModules: string[],
  callAI: CallAI,
  onProgress?: (stage: string, detail: string) => void,
): Promise<{ modules: WorldModule[]; moduleWorldBookEntries: WorldBookEntryDef[] }> {
  if (selectedModules.length === 0) {
    return { modules: [], moduleWorldBookEntries: [] };
  }

  onProgress?.('模块', '生成模块数据...');

  const buildCtx = createBuildContext(worldDesc, selectedModules);

  try {
    await executeBuildPipeline(buildCtx, {
      callAI,
      onProgress: (stage, detail) => onProgress?.(`模块.${stage}`, detail),
    });

    // 从管线结果构建 modules 数组（复用 stage6 逻辑）
    const modules = selectedModules.map(id => {
      const key = MODULE_ID_TO_KEY[id];
      const pipelineData = key ? buildCtx.result?.[key] : undefined;

      if (pipelineData && typeof pipelineData === 'object' && 'config' in pipelineData) {
        const { config, initialState } = pipelineData as any;
        let data: Record<string, unknown>;
        if (id === 'progression') {
          data = { ...config, currentTierIndex: initialState?.currentTierIndex ?? 0, currentXP: initialState?.currentXP ?? 0 };
        } else if (id === 'stat') {
          const s = initialState || {};
          const specialArr = Array.isArray(config.special) ? config.special.map((sp: any) => ({
            ...sp, value: s.special?.[sp.id] ?? sp.value ?? 0,
          })) : [];
          data = {
            attrA: { name: config.attrA?.name || '生命', current: s.attrA ?? config.attrA?.max ?? 100, max: config.attrA?.max ?? 100 },
            attrB: { name: config.attrB?.name || '能量', current: s.attrB ?? config.attrB?.max ?? 100, max: config.attrB?.max ?? 100 },
            dim1: { name: config.dim1?.name || '属性1', value: s.dim1 ?? 50, range: config.dim1?.range ?? [0, 100] },
            dim2: { name: config.dim2?.name || '属性2', value: s.dim2 ?? 50, range: config.dim2?.range ?? [0, 100] },
            dim3: { name: config.dim3?.name || '属性3', value: s.dim3 ?? 50, range: config.dim3?.range ?? [0, 100] },
            dim4: { name: config.dim4?.name || '属性4', value: s.dim4 ?? 50, range: config.dim4?.range ?? [0, 100] },
            dim5: { name: config.dim5?.name || '属性5', value: s.dim5 ?? 50, range: config.dim5?.range ?? [0, 100] },
            dim6: { name: config.dim6?.name || '属性6', value: s.dim6 ?? 50, range: config.dim6?.range ?? [0, 100] },
            special: specialArr,
          };
        } else {
          data = { ...config, ...initialState };
        }
        return {
          moduleId: id,
          name: key || id,
          description: '',
          enabled: true,
          moduleConfig: config,
          ...(initialState ? { initialState } : {}),
          data,
        };
      }

      // 兜底
      return {
        moduleId: id,
        name: key || id,
        description: '',
        enabled: true,
      };
    }) as WorldModule[];

    // 提取模块生成的世界书条目
    const moduleWorldBookEntries = buildCtx.worldBookEntries ?? [];

    return { modules, moduleWorldBookEntries };
  } catch (err) {
    console.warn('[generateRichModules] 模块管线失败:', err);
    return {
      modules: selectedModules.map(id => createFallbackModule(id, MODULE_ID_TO_KEY[id] || id)) as WorldModule[],
      moduleWorldBookEntries: [],
    };
  }
}
