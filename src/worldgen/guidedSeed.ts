// ============================================================
//  引导式种子 → 管线描述文本
//  将用户的结构化选择转换为管线可用的 userDesc
// ============================================================

import type { GuideSeedResult } from '../components/start/guides/guideTypes';
import { getWorldType, getTone, getConflict, ELEMENTS } from '../components/start/guides/guidePresets';

/**
 * 将引导选择结果转换为管线 userDesc
 * 这个文本会传递给 Stage 1（骨架）及后续阶段的 AI
 * 与自由输入模式不同，这里的信息已经是结构化的，AI 只需填充细节
 */
export function buildGuidedUserDesc(result: GuideSeedResult): string {
  const parts: string[] = [];

  // 世界类型描述
  const genre = result.seed.genre;
  parts.push(`【世界类型】${genre}`);

  // 基调
  parts.push(`【叙事基调】${result.seed.tone}`);

  // 时代背景
  parts.push(`【时代背景】${result.seed.era}`);

  // 核心概念
  if (result.seed.keyConcepts.length > 0) {
    parts.push(`【核心概念】${result.seed.keyConcepts.join('、')}`);
  }

  // 主题
  if (result.seed.themes.length > 0) {
    parts.push(`【核心主题】${result.seed.themes.join('、')}`);
  }

  // 启用的元素维度
  if (result.enabledElements.length > 0) {
    const elementLabels = result.enabledElements
      .map(id => ELEMENTS.find(e => e.id === id)?.label)
      .filter(Boolean);
    parts.push(`【重点维度】${elementLabels.join('、')}`);
  }

  // 个性化内容
  if (result.personalDesc) {
    parts.push(`\n【个性化需求】\n${result.personalDesc}`);
  }

  return parts.join('\n');
}

/**
 * 从启用的元素 ID 列表推导出需要重点生成的维度
 * 用于约束 Stage 2 的并行生成
 */
export function getEnabledDimensionIds(enabledElements: string[]): string[] {
  const dimensionSet = new Set<string>();
  for (const elId of enabledElements) {
    const el = ELEMENTS.find(e => e.id === elId);
    if (el) {
      el.relatedDimensions.forEach(dim => dimensionSet.add(dim));
    }
  }
  return [...dimensionSet];
}
