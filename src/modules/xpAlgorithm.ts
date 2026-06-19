// ============================================================
//  世界模块化系统 v2 — XP 算法
//  纯算法，无指向性描述
// ============================================================

import type { XpFormula, TierDef, ProgressionModuleSchema } from './schema';

/**
 * 计算升到第N级需要的单级XP（增量）
 * cumulativeXP(N) = baseXP * (N ^ exponent) * scaleFactor
 */
export function calculateXpForTier(tierIndex: number, formula: XpFormula): number {
  if (tierIndex <= 0) return 0;
  return Math.floor(formula.baseXP * Math.pow(tierIndex, formula.exponent) * formula.scaleFactor);
}

/**
 * 计算升到第N级累计需要的XP
 */
export function calculateCumulativeXp(tierIndex: number, formula: XpFormula): number {
  let total = 0;
  for (let i = 1; i <= tierIndex; i++) {
    total += calculateXpForTier(i, formula);
  }
  return total;
}

/**
 * 填充tiers数组的xpRequired字段
 */
export function populateTierXp(tiers: TierDef[], formula: XpFormula): TierDef[] {
  return tiers.map((tier, index) => ({
    ...tier,
    xpRequired: calculateCumulativeXp(index, formula),
  }));
}

/**
 * 获取当前段位内升到下一级需要的XP（增量）
 */
export function getXpForNextTier(progression: ProgressionModuleSchema): number {
  const nextIndex = progression.currentTierIndex + 1;
  if (nextIndex >= progression.tiers.length) return Infinity; // 已满级
  return calculateXpForTier(nextIndex, progression.xpFormula);
}

/**
 * 获取当前段位内的XP进度百分比（0-1）
 */
export function getTierProgress(progression: ProgressionModuleSchema): number {
  const xpNeeded = getXpForNextTier(progression);
  if (xpNeeded === Infinity || xpNeeded === 0) return 1;
  return Math.min(1, progression.currentXP / xpNeeded);
}

/**
 * 计算属性修正值（骰子检定用）
 * 修正值 = floor((属性值 - 10) / 2)
 */
export function calcModifier(attributeValue: number): number {
  return Math.floor((attributeValue - 10) / 2);
}

/**
 * 执行骰子检定
 */
export function rollDice(attributeValue: number, dc: number): {
  d20: number;
  modifier: number;
  total: number;
  success: boolean;
  isNatural20: boolean;
  isNatural1: boolean;
} {
  const d20 = Math.floor(Math.random() * 20) + 1;
  const modifier = calcModifier(attributeValue);
  const total = d20 + modifier;

  return {
    d20,
    modifier,
    total,
    success: total >= dc,
    isNatural20: d20 === 20,
    isNatural1: d20 === 1,
  };
}

/**
 * 获取可检定属性列表（从数值属性模块提取）
 */
export function getCheckableAttributes(
  statModule: import('./schema').StatModuleSchema
): Array<{ id: string; name: string; value: number }> {
  const attrs = [
    { id: 'dim1', name: statModule.dim1.name, value: statModule.dim1.value },
    { id: 'dim2', name: statModule.dim2.name, value: statModule.dim2.value },
    { id: 'dim3', name: statModule.dim3.name, value: statModule.dim3.value },
    { id: 'dim4', name: statModule.dim4.name, value: statModule.dim4.value },
    { id: 'dim5', name: statModule.dim5.name, value: statModule.dim5.value },
    { id: 'dim6', name: statModule.dim6.name, value: statModule.dim6.value },
  ];

  for (const sp of statModule.special) {
    attrs.push({ id: sp.id, name: sp.name, value: sp.value });
  }

  return attrs;
}
