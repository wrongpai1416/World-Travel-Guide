// 阶段5：世界书条目合成 prompt（用于 AI 补充关键词）
// 注意：主要合成逻辑是纯代码，这个 prompt 只在需要 AI 补充关键词时使用

import type { WorldSkeleton, DimensionResults, DeepDetailResults } from '../types';

/**
 * 为势力/NPC/事件生成触发关键词的 prompt
 * 输入：世界上下文 + 条目列表
 * 输出：每条的关联关键词
 */
export function buildKeywordPrompt(
  skeleton: WorldSkeleton,
  category: string,
  items: Array<{ name: string; description: string }>,
): string {
  return `你是世界书关键词专家。为以下${category}生成触发关键词。

世界：${skeleton.name}（${skeleton.overview.substring(0, 100)}...）

需要生成关键词的条目：
${items.map((item, i) => `${i + 1}. ${item.name}：${item.description.substring(0, 80)}...`).join('\n')}

为每条生成 3-8 个触发关键词，包含：
- 名称本身
- 别名/简称
- 关联概念（地点、人物、事件、物品等）

严格返回 JSON 数组：
[
  {
    "name": "条目名",
    "key": ["关键词1", "关键词2", "关键词3"]
  }
]`;
}
