// ============================================================
//  世界模块化系统 v2 — 运行时管理
//  管理 WorldSystemData 的读取和更新
// ============================================================

import type { WorldSystemData, StatModuleSchema, ProgressionModuleSchema, ResourceModuleSchema, DiceModuleSchema } from './schema';
import { getXpForNextTier, getTierProgress } from './xpAlgorithm';

/**
 * 从 WorldState.世界系统 中提取模块数据
 * 兼容旧格式（WorldModuleRuntime）和新格式（WorldSystemData）
 */
export function extractWorldSystemData(
  worldSystem: Record<string, unknown> | undefined
): WorldSystemData {
  if (!worldSystem) return {};

  // 新格式：直接是 WorldSystemData
  if ('数值属性' in worldSystem || '成长体系' in worldSystem ||
      '资源管理' in worldSystem || '骰子检定' in worldSystem) {
    return worldSystem as WorldSystemData;
  }

  // 旧格式兼容：从 WorldModuleRuntime 提取数据
  const result: WorldSystemData = {};
  for (const [_key, value] of Object.entries(worldSystem)) {
    if (value && typeof value === 'object' && 'moduleId' in (value as any) && '数据' in (value as any)) {
      const mod = value as any;
      const data = mod.数据 as Record<string, unknown>;
      switch (mod.moduleId) {
        case 'stat':
          result.数值属性 = data as unknown as StatModuleSchema;
          break;
        case 'progression':
          result.成长体系 = data as unknown as ProgressionModuleSchema;
          break;
        case 'resource':
          result.资源管理 = data as unknown as ResourceModuleSchema;
          break;
        case 'dice':
          result.骰子检定 = data as unknown as DiceModuleSchema;
          break;
      }
    }
  }

  return result;
}

/**
 * 获取成长体系的显示信息
 */
export function getProgressionDisplay(progression: ProgressionModuleSchema | undefined): {
  currentName: string;
  nextName: string;
  progress: number;
  xpCurrent: number;
  xpNeeded: number;
} | null {
  if (!progression || !progression.tiers.length) return null;

  const currentTier = progression.tiers[progression.currentTierIndex];
  const nextTier = progression.tiers[progression.currentTierIndex + 1];
  const xpNeeded = getXpForNextTier(progression);
  const progress = getTierProgress(progression);

  return {
    currentName: currentTier?.name || '未知',
    nextName: nextTier?.name || '已满级',
    progress,
    xpCurrent: progression.currentXP,
    xpNeeded: xpNeeded === Infinity ? 0 : xpNeeded,
  };
}

/**
 * 获取属性的显示颜色
 * attrA: 红色系，attrB: 蓝色系
 */
export function getStatColor(statKey: string): string {
  if (statKey === 'attrA') return '#ef4444'; // 红
  if (statKey === 'attrB') return '#3b82f6'; // 蓝
  return '#60a5fa'; // 默认蓝
}
