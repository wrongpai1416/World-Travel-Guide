// 阶段2：维度并行生成 prompt

import type { WorldSkeleton } from '../types';

const WORLD_CONTEXT = (skeleton: WorldSkeleton) =>
  `世界名称：${skeleton.name}
世界概述：${skeleton.overview}
核心矛盾：${skeleton.coreConflict}
基调：${skeleton.worldScale}`;

// ── 地理维度 ──

export function buildGeographyPrompt(skeleton: WorldSkeleton): string {
  return `你是世界地理设计师。为以下世界生成关键地点的详细描述。

${WORLD_CONTEXT(skeleton)}

需要描述的地点：${skeleton.locationNames.join('、')}

严格返回 JSON：
{
  "locations": [
    {
      "name": "地点名",
      "description": "200-300字的详细描述，包含地理特征、建筑、氛围、居民、 notable 特征",
      "features": ["特征1", "特征2", "特征3"],
      "atmosphere": "该地点给人的感受",
      "history": "简要历史背景（50-100字）"
    }
  ]
}`;
}

// ── 势力维度 ──

export function buildFactionsPrompt(skeleton: WorldSkeleton): string {
  return `你是势力设计师。为以下世界生成各势力的详细设定。

${WORLD_CONTEXT(skeleton)}

需要设定的势力：${skeleton.factionNames.join('、')}

严格返回 JSON：
{
  "factions": [
    {
      "name": "势力名",
      "description": "150-250字的势力描述，包含宗旨、行事风格、外人印象",
      "alignment": "友善/中立/敌对",
      "headquarters": "总部所在地",
      "philosophy": "核心理念",
      "strength": "实力评估",
      "internalFactions": ["内部派系1", "内部派系2"],
      "relationships": [{"target": "其他势力名", "relation": "关系描述"}]
    }
  ]
}`;
}

// ── NPC 维度 ──

export function buildNPCsPrompt(skeleton: WorldSkeleton): string {
  return `你是角色设计师。为以下世界生成关键 NPC 的详细设定。

${WORLD_CONTEXT(skeleton)}

需要设定的 NPC 角色定位：
${skeleton.npcRoles.map((r, i) => `${i + 1}. ${r}`).join('\n')}

严格返回 JSON：
{
  "npcs": [
    {
      "name": "NPC姓名",
      "role": "角色定位",
      "description": "150-250字的角色描述",
      "personality": "性格标签（3-5个词）",
      "appearance": "外貌描述（50-100字）",
      "background": "背景故事（100-200字）",
      "motivation": "核心动机",
      "secrets": "隐藏的秘密（一句话）",
      "relationships": [{"target": "其他NPC或势力名", "relation": "关系描述"}]
    }
  ]
}`;
}

// ── 事件维度 ──

export function buildEventsPrompt(skeleton: WorldSkeleton): string {
  return `你是事件设计师。为以下世界生成关键事件/活动。

${WORLD_CONTEXT(skeleton)}

需要设定的事件：${skeleton.eventNames.join('、')}

严格返回 JSON：
{
  "events": [
    {
      "name": "事件名",
      "description": "150-250字的事件描述，包含经过、参与者、影响",
      "trigger": "触发条件（时间/地点/行为）",
      "significance": "major 或 minor",
      "impact": "该事件对世界的影响"
    }
  ]
}`;
}

// ── 文化维度 ──

export function buildCulturePrompt(skeleton: WorldSkeleton): string {
  return `你是文化设计师。为以下世界生成社会文化设定。

${WORLD_CONTEXT(skeleton)}

严格返回 JSON：
{
  "description": "150-250字的文化概述",
  "customs": ["风俗1", "风俗2", "风俗3"],
  "beliefs": ["信仰/价值观1", "信仰/价值观2"],
  "dailyLife": "100-150字的日常生活描述",
  "taboos": ["禁忌1", "禁忌2"],
  "languageFeatures": ["语言特色1", "语言特色2"]
}`;
}

// ── 经济维度 ──

export function buildEconomyPrompt(skeleton: WorldSkeleton): string {
  return `你是经济系统设计师。为以下世界生成经济设定。

${WORLD_CONTEXT(skeleton)}

严格返回 JSON：
{
  "description": "100-200字的经济概述",
  "currency": {"name": "货币名", "symbol": "符号", "description": "说明"},
  "priceLevel": "物价水平描述",
  "tradeRoutes": ["贸易路线1", "贸易路线2"],
  "scarceResources": ["稀缺资源1", "稀缺资源2"],
  "blackMarket": "黑市描述（如有）"
}`;
}

// ── 规则维度 ──

export function buildRulesPrompt(skeleton: WorldSkeleton): string {
  return `你是规则系统设计师。为以下世界生成世界规则。

${WORLD_CONTEXT(skeleton)}

严格返回 JSON：
{
  "description": "100-200字的规则概述",
  "powerSystem": "力量/魔法/科技体系的详细描述（200-300字）",
  "socialStructure": "社会结构描述（100-200字）",
  "specialRules": ["特殊规则1", "特殊规则2", "特殊规则3"],
  "physicalLaws": "物理法则（如有特殊设定）",
  "magicOrTechSystem": "魔法或科技系统的核心机制"
}`;
}
