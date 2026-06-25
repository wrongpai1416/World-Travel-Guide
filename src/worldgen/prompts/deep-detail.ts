// 阶段4：深度细节 prompt

import type { WorldSkeleton, DimensionResults } from '../types';

const WORLD_CONTEXT = (skeleton: WorldSkeleton) =>
  `世界名称：${skeleton.name}
世界概述：${skeleton.overview}
核心矛盾：${skeleton.coreConflict}`;

// ── 地点深写 ──

export function buildLocationDeepPrompt(
  skeleton: WorldSkeleton,
  locations: Array<{ name: string; description: string }>,
): string {
  return `你是世界地理深度设计师。请为以下地点补充更丰富的细节。

${WORLD_CONTEXT(skeleton)}

需要深写的地点：
${locations.map(l => `- ${l.name}：${l.description}`).join('\n')}

为每个地点补充：历史传说、地下秘密、可互动元素、隐藏地点、当地居民特色。

严格返回 JSON：
{
  "locations": [
    {
      "name": "地点名",
      "description": "扩充后的300-500字详细描述",
      "features": ["特征1", "特征2", "特征3", "特征4", "特征5"],
      "atmosphere": "氛围",
      "history": "100-200字的丰富历史背景"
    }
  ]
}`;
}

// ── 势力深写 ──

export function buildFactionDeepPrompt(
  skeleton: WorldSkeleton,
  factions: Array<{ name: string; description: string }>,
): string {
  return `你是势力深度设计师。请为以下势力补充更丰富的内部细节。

${WORLD_CONTEXT(skeleton)}

需要深写的势力：
${factions.map(f => `- ${f.name}：${f.description}`).join('\n')}

为每个势力补充：内部权力结构、隐藏议程、弱点、历史转折点、标志性人物。

严格返回 JSON：
{
  "factions": [
    {
      "name": "势力名",
      "description": "扩充后的300-500字详细描述",
      "alignment": "友善/中立/敌对",
      "headquarters": "总部",
      "philosophy": "核心理念（扩充）",
      "strength": "实力评估（扩充）",
      "internalFactions": ["内部派系1（含描述）", "内部派系2"],
      "relationships": [{"target": "目标", "relation": "关系"}]
    }
  ]
}`;
}

// ── NPC 深写 ──

export function buildNPCDeepPrompt(
  skeleton: WorldSkeleton,
  npcs: Array<{ name: string; role: string; description: string }>,
): string {
  return `你是角色深度设计师。请为以下 NPC 补充更丰富的背景细节。

${WORLD_CONTEXT(skeleton)}

需要深写的 NPC：
${npcs.map(n => `- ${n.name}（${n.role}）：${n.description}`).join('\n')}

为每个 NPC 补充：完整背景故事、性格成因、关键记忆、隐藏能力、未来走向。

严格返回 JSON：
{
  "npcs": [
    {
      "name": "NPC姓名",
      "role": "角色定位",
      "description": "扩充后的300-500字角色描述",
      "personality": "性格标签",
      "appearance": "外貌描述（扩充）",
      "background": "200-300字的完整背景故事",
      "motivation": "核心动机（扩充）",
      "secrets": "隐藏秘密（扩充）",
      "relationships": [{"target": "目标", "relation": "关系"}]
    }
  ]
}`;
}
