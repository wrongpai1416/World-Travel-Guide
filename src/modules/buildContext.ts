// ============================================================
//  世界模块化系统 v2 — 管线 Context
//  管线执行过程中传递的上下文数据
// ============================================================

import type { StatModuleSchema, ProgressionModuleSchema, ResourceModuleSchema, TalentModuleSchema } from './schema';
import type { WorldBookEntryDef } from '../data/worlds-schema';

/** 数值属性配置（静态，存入世界定义/世界书） */
export interface StatConfig {
  attrA: { name: string; max: number };
  attrB: { name: string; max: number };
  dim1: { name: string; range: [number, number] };
  dim2: { name: string; range: [number, number] };
  dim3: { name: string; range: [number, number] };
  dim4: { name: string; range: [number, number] };
  dim5: { name: string; range: [number, number] };
  dim6: { name: string; range: [number, number] };
  special: Array<{ id: string; name: string; range: [number, number]; description: string }>;
}

/** 数值属性状态（动态，存入变量系统） */
export interface StatState {
  attrA: number;
  attrB: number;
  dim1: number;
  dim2: number;
  dim3: number;
  dim4: number;
  dim5: number;
  dim6: number;
  special: Record<string, number>;
}

/** 等级制属性天花板 */
interface StatBonuses {
  attrAMax: number;
  attrBMax: number;
  dim1Max: number;
  dim2Max: number;
  dim3Max: number;
  dim4Max: number;
  dim5Max: number;
  dim6Max: number;
}

/** 成长体系配置（静态，存入世界定义/世界书） */
export interface ProgressionConfig {
  mode: 'tiered' | 'level';
  tiers?: Array<{ name: string; description: string }>;
  levelData?: {
    maxLevel: number;
    baseStats: StatBonuses;
    growthPerLevel: StatBonuses;
  };
  xpFormula: { baseXP: number; exponent: number; scaleFactor: number };
}

/** 资源管理配置（静态，存入世界定义/世界书） */
export interface ResourceConfig {
  description: string;
  items: Array<{ id: string; name: string; symbol: string; max?: number; scarce: boolean; description: string }>;
  currency?: { name: string; symbol: string; description?: string };
}

/** 世界创建管线的上下文数据 */
export interface BuildContext {
  /** 世界描述（用户输入） */
  description: string;
  /** 用户选中的模块ID列表 */
  selectedModules: string[];
  /** 阶段1提取的主题信息 */
  theme?: {
    theme: string;
    tone: string;
    era: string;
    attrAName: string;
    attrBName: string;
    dim1Name: string;
    dim2Name: string;
    dim3Name: string;
    dim4Name: string;
    dim5Name: string;
    dim6Name: string;
  };
  /** 阶段2生成的属性数据（原始格式，用于合成） */
  statData?: StatModuleSchema;
  /** 阶段2生成的成长数据（原始格式，用于合成） */
  progressionData?: ProgressionModuleSchema;
  /** 阶段3生成的资源数据（原始格式，用于合成） */
  resourceData?: ResourceModuleSchema;
  /** 阶段3生成的天赋数据 */
  talentData?: TalentModuleSchema;
  /** 阶段4生成的世界书条目 */
  worldBookEntries?: WorldBookEntryDef[];

  // ── 分离的配置和状态 ──
  /** 数值属性配置 */
  statConfig?: StatConfig;
  /** 数值属性初始状态 */
  statState?: StatState;
  /** 成长体系配置 */
  progressionConfig?: ProgressionConfig;
  /** 资源管理配置 */
  resourceConfig?: ResourceConfig;

  /** 阶段5合成的最终结果 */
  result?: Record<string, unknown>;
}

/** 创建空的BuildContext */
export function createBuildContext(description: string, selectedModules: string[]): BuildContext {
  return { description, selectedModules };
}
