// 阶段3：交叉校验 prompt

import type { WorldSkeleton, DimensionResults } from '../types';

export function buildConsistencyPrompt(
  skeleton: WorldSkeleton,
  dims: DimensionResults,
): string {
  return `你是世界设定一致性校验专家。请检查以下世界设定中的矛盾和缺失。

世界骨架：
${JSON.stringify(skeleton, null, 2)}

地理设定：
${JSON.stringify(dims.geography, null, 2)}

势力设定：
${JSON.stringify(dims.factions, null, 2)}

NPC 设定：
${JSON.stringify(dims.npcs, null, 2)}

事件设定：
${JSON.stringify(dims.events, null, 2)}

文化设定：
${JSON.stringify(dims.culture, null, 2)}

经济设定：
${JSON.stringify(dims.economy, null, 2)}

规则设定：
${JSON.stringify(dims.rules, null, 2)}

请检查：
1. 地理描述中的气候/地形是否与经济中的作物/资源一致？
2. 势力关系是否与 NPC 归属匹配？
3. 事件触发地点是否存在于地理中？
4. 文化禁忌是否与规则系统冲突？
5. 力量体系是否与 NPC 能力匹配？

严格返回 JSON：
{
  "patches": [
    {
      "target": "需要修改的维度（geography/factions/npcs/events/culture/economy/rules）",
      "field": "需要修改的字段路径",
      "oldValue": "当前值",
      "newValue": "建议修改为",
      "reason": "修改原因"
    }
  ]
}

如果没有发现矛盾，返回 {"patches": []}`;
}
