// ============================================================
//  世界模块化系统 v2 — 默认值
//  框架层零指向性，所有命名由AI生成时注入
// ============================================================

import type {
  StatModuleSchema,
  ProgressionModuleSchema,
  ResourceModuleSchema,
  DiceModuleSchema,
  TalentModuleSchema,
  WorldSystemData,
} from './schema';

/** 数值属性模块默认值 */
export const STAT_DEFAULTS = {
  attrACurrent: 80,
  attrAMax: 100,
  attrBCurrent: 60,
  attrBMax: 100,
  dimRange: [0, 100] as [number, number],
  dimInitial: 50,
  specialRange: [0, 100] as [number, number],
};

/** 成长体系模块默认值 */
export const PROGRESSION_DEFAULTS = {
  mode: 'tiered' as const,
  baseXP: 100,
  exponent: 1.5,
  scaleFactor: 1.0,
  initialTierIndex: 0,
  initialXP: 0,
};

/** 资源管理模块默认值 */
export const RESOURCE_DEFAULTS = {
  initialCurrencyAmount: 500,
  initialItemAmount: 10,
};

/** 骰子检定模块默认值 */
export const DICE_DEFAULTS = {
  maxHistory: 10,
  defaultDC: 10,
};

/** 创建默认的数值属性模块数据 */
export function createDefaultStatModule(): StatModuleSchema {
  return {
    attrA: { name: '生命', current: STAT_DEFAULTS.attrACurrent, max: STAT_DEFAULTS.attrAMax },
    attrB: { name: '能量', current: STAT_DEFAULTS.attrBCurrent, max: STAT_DEFAULTS.attrBMax },
    dim1: { name: '攻击', value: STAT_DEFAULTS.dimInitial, range: [...STAT_DEFAULTS.dimRange] },
    dim2: { name: '防御', value: STAT_DEFAULTS.dimInitial, range: [...STAT_DEFAULTS.dimRange] },
    dim3: { name: '速度', value: STAT_DEFAULTS.dimInitial, range: [...STAT_DEFAULTS.dimRange] },
    dim4: { name: '智力', value: STAT_DEFAULTS.dimInitial, range: [...STAT_DEFAULTS.dimRange] },
    dim5: { name: '魅力', value: STAT_DEFAULTS.dimInitial, range: [...STAT_DEFAULTS.dimRange] },
    dim6: { name: '幸运', value: STAT_DEFAULTS.dimInitial, range: [...STAT_DEFAULTS.dimRange] },
    special: [],
  };
}

/** 创建默认的成长体系模块数据（段位制） */
export function createDefaultProgressionModule(): ProgressionModuleSchema {
  return {
    mode: PROGRESSION_DEFAULTS.mode,
    tiers: [],
    xpFormula: {
      baseXP: PROGRESSION_DEFAULTS.baseXP,
      exponent: PROGRESSION_DEFAULTS.exponent,
      scaleFactor: PROGRESSION_DEFAULTS.scaleFactor,
    },
    currentTierIndex: PROGRESSION_DEFAULTS.initialTierIndex,
    currentXP: PROGRESSION_DEFAULTS.initialXP,
  };
}

/** 创建默认的资源管理模块数据 */
export function createDefaultResourceModule(): ResourceModuleSchema {
  return {
    description: '',
    items: [],
  };
}

/** 创建默认的骰子检定模块数据 */
export function createDefaultDiceModule(): DiceModuleSchema {
  return {
    history: [],
  };
}

/** 创建默认的天赋体系模块数据 */
export function createDefaultTalentModule(): TalentModuleSchema {
  return {
    categories: [],
  };
}

/** 创建默认的世界系统数据 */
export function createDefaultWorldSystem(): WorldSystemData {
  return {};
}
