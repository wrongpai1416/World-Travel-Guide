import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  calculateXpForLevel,
  calculateCumulativeXp,
  populateTierXp,
  getLevelStatBonuses,
  getXpForNextTier,
  getTierProgress,
  getCurrentLevelCap,
  calcModifier,
  rollDice,
  getCheckableAttributes,
} from '../../modules/xpAlgorithm';
import type { XpFormula, TierDef, LevelData, ProgressionModuleSchema, StatModuleSchema } from '../../modules/schema';

// ═══════════════════════════════════════════════════
//  calculateXpForLevel
// ═══════════════════════════════════════════════════

describe('calculateXpForLevel', () => {
  const linear: XpFormula = { baseXP: 100, exponent: 1, scaleFactor: 1 };
  const exponential: XpFormula = { baseXP: 50, exponent: 2, scaleFactor: 1 };
  const scaled: XpFormula = { baseXP: 100, exponent: 1.5, scaleFactor: 2 };

  it('线性公式: baseXP * level * scaleFactor', () => {
    expect(calculateXpForLevel(1, linear)).toBe(100);
    expect(calculateXpForLevel(5, linear)).toBe(500);
    expect(calculateXpForLevel(10, linear)).toBe(1000);
  });

  it('指数公式: baseXP * level^2 * scaleFactor', () => {
    expect(calculateXpForLevel(1, exponential)).toBe(50);    // 50 * 1
    expect(calculateXpForLevel(2, exponential)).toBe(200);   // 50 * 4
    expect(calculateXpForLevel(3, exponential)).toBe(450);   // 50 * 9
  });

  it('带缩放系数的公式', () => {
    // 100 * 4^1.5 * 2 = 100 * 8 * 2 = 1600
    expect(calculateXpForLevel(4, scaled)).toBe(1600);
  });

  it('level=0 返回 0', () => {
    expect(calculateXpForLevel(0, linear)).toBe(0);
  });

  it('负 level 返回 0', () => {
    expect(calculateXpForLevel(-5, linear)).toBe(0);
  });

  it('结果总是整数（Math.floor）', () => {
    const fractional: XpFormula = { baseXP: 100, exponent: 1.5, scaleFactor: 1 };
    const result = calculateXpForLevel(3, fractional);
    // 100 * 3^1.5 * 1 = 100 * 5.196... = 519.6... → floor = 519
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(519);
  });
});

// ═══════════════════════════════════════════════════
//  calculateCumulativeXp
// ═══════════════════════════════════════════════════

describe('calculateCumulativeXp', () => {
  const linear: XpFormula = { baseXP: 100, exponent: 1, scaleFactor: 1 };

  it('累计 XP = sum(XpForLevel(1..n))', () => {
    // 100 + 200 + 300 = 600
    expect(calculateCumulativeXp(3, linear)).toBe(600);
    // 100 + 200 + 300 + 400 + 500 = 1500
    expect(calculateCumulativeXp(5, linear)).toBe(1500);
  });

  it('level=0 返回 0', () => {
    expect(calculateCumulativeXp(0, linear)).toBe(0);
  });

  it('level=1 等于单级 XP', () => {
    expect(calculateCumulativeXp(1, linear)).toBe(calculateXpForLevel(1, linear));
  });

  it('指数公式的累计', () => {
    const exp: XpFormula = { baseXP: 50, exponent: 2, scaleFactor: 1 };
    // 50 + 200 + 450 = 700
    expect(calculateCumulativeXp(3, exp)).toBe(700);
  });
});

// ═══════════════════════════════════════════════════
//  populateTierXp
// ═══════════════════════════════════════════════════

describe('populateTierXp', () => {
  const formula: XpFormula = { baseXP: 100, exponent: 1, scaleFactor: 1 };

  it('填充每个段位的 xpRequired 字段', () => {
    const tiers: TierDef[] = [
      { name: '青铜', description: '初学者', xpRequired: 0, statBonuses: {} as any },
      { name: '白银', description: '进阶', xpRequired: 0, statBonuses: {} as any },
      { name: '黄金', description: '高级', xpRequired: 0, statBonuses: {} as any },
    ];
    const result = populateTierXp(tiers, formula);
    // index 0: cumulative(0) = 0
    expect(result[0].xpRequired).toBe(0);
    // index 1: cumulative(1) = 100
    expect(result[1].xpRequired).toBe(100);
    // index 2: cumulative(2) = 300
    expect(result[2].xpRequired).toBe(300);
  });

  it('不修改原始数组', () => {
    const tiers: TierDef[] = [
      { name: 'T1', description: '', xpRequired: -1, statBonuses: {} as any },
    ];
    const result = populateTierXp(tiers, formula);
    expect(tiers[0].xpRequired).toBe(-1);  // 原始不变
    expect(result[0].xpRequired).toBe(0);  // 新数组被填充
  });

  it('空数组返回空数组', () => {
    expect(populateTierXp([], formula)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════
//  getLevelStatBonuses
// ═══════════════════════════════════════════════════

describe('getLevelStatBonuses', () => {
  const levelData: LevelData = {
    maxLevel: 100,
    baseStats: {
      attrAMax: 100, attrBMax: 100,
      dim1Max: 50, dim2Max: 50, dim3Max: 50,
      dim4Max: 50, dim5Max: 50, dim6Max: 50,
    },
    growthPerLevel: {
      attrAMax: 10, attrBMax: 5,
      dim1Max: 8, dim2Max: 8, dim3Max: 8,
      dim4Max: 8, dim5Max: 8, dim6Max: 8,
    },
  };

  it('level=0 时返回 baseStats', () => {
    const result = getLevelStatBonuses(0, levelData);
    expect(result.attrAMax).toBe(100);
    expect(result.dim1Max).toBe(50);
  });

  it('level=10 时正确计算', () => {
    const result = getLevelStatBonuses(10, levelData);
    expect(result.attrAMax).toBe(100 + 10 * 10);  // 200
    expect(result.attrBMax).toBe(100 + 10 * 5);   // 150
    expect(result.dim1Max).toBe(50 + 10 * 8);     // 130
  });

  it('缺失字段使用默认值', () => {
    const partialData = {
      maxLevel: 50,
      baseStats: {} as any,
      growthPerLevel: {} as any,
    };
    const result = getLevelStatBonuses(5, partialData);
    // baseStats 缺失 → 默认 attrAMax=100, dim1Max=100
    // growthPerLevel 缺失 → 默认 attrAMax=10, dim1Max=8
    expect(result.attrAMax).toBe(100 + 5 * 10);  // 150
    expect(result.dim1Max).toBe(100 + 5 * 8);    // 140
  });
});

// ═══════════════════════════════════════════════════
//  getXpForNextTier
// ═══════════════════════════════════════════════════

describe('getXpForNextTier', () => {
  const formula: XpFormula = { baseXP: 100, exponent: 1, scaleFactor: 1 };

  it('段位制：返回下一级所需 XP', () => {
    const progression = {
      mode: 'tiered' as const,
      xpFormula: formula,
      tiers: [
        { name: 'T1', description: '', xpRequired: 0, statBonuses: {} as any },
        { name: 'T2', description: '', xpRequired: 0, statBonuses: {} as any },
        { name: 'T3', description: '', xpRequired: 0, statBonuses: {} as any },
      ],
      currentTierIndex: 0,
      currentXP: 0,
    } as ProgressionModuleSchema;
    // currentTierIndex=0, next=1, xpForLevel(1) = 100
    expect(getXpForNextTier(progression)).toBe(100);
  });

  it('段位制：已满级返回 Infinity', () => {
    const progression = {
      mode: 'tiered' as const,
      xpFormula: formula,
      tiers: [
        { name: 'T1', description: '', xpRequired: 0, statBonuses: {} as any },
      ],
      currentTierIndex: 0,
      currentXP: 0,
    } as ProgressionModuleSchema;
    // currentTierIndex=0, next=1, maxIndex=1, 1>=1 → Infinity
    expect(getXpForNextTier(progression)).toBe(Infinity);
  });

  it('等级制：返回下一级所需 XP', () => {
    const progression = {
      mode: 'level' as const,
      xpFormula: formula,
      levelData: {
        maxLevel: 50,
        baseStats: {} as any,
        growthPerLevel: {} as any,
      },
      currentTierIndex: 4,
      currentXP: 0,
    } as ProgressionModuleSchema;
    // currentTierIndex=4, next=5, xpForLevel(5) = 500
    expect(getXpForNextTier(progression)).toBe(500);
  });

  it('等级制：已满级返回 Infinity', () => {
    const progression = {
      mode: 'level' as const,
      xpFormula: formula,
      levelData: {
        maxLevel: 10,
        baseStats: {} as any,
        growthPerLevel: {} as any,
      },
      currentTierIndex: 9,
      currentXP: 0,
    } as ProgressionModuleSchema;
    expect(getXpForNextTier(progression)).toBe(Infinity);
  });

  it('xpFormula 缺失时返回 0', () => {
    const progression = {
      mode: 'tiered' as const,
      // 需要有 2+ 段位才能走到 xpFormula 检查（否则先返回 Infinity）
      tiers: [
        { name: 'T1', description: '', xpRequired: 0, statBonuses: {} as any },
        { name: 'T2', description: '', xpRequired: 0, statBonuses: {} as any },
      ],
      currentTierIndex: 0,
      currentXP: 0,
    } as ProgressionModuleSchema;
    expect(getXpForNextTier(progression)).toBe(0);
  });

  it('currentTierIndex 缺失时默认为 0', () => {
    const progression = {
      mode: 'tiered' as const,
      xpFormula: formula,
      tiers: [
        { name: 'T1', description: '', xpRequired: 0, statBonuses: {} as any },
        { name: 'T2', description: '', xpRequired: 0, statBonuses: {} as any },
      ],
    } as ProgressionModuleSchema;
    // currentTierIndex 默认 0, next=1, xpForLevel(1) = 100
    expect(getXpForNextTier(progression)).toBe(100);
  });
});

// ═══════════════════════════════════════════════════
//  getTierProgress
// ═══════════════════════════════════════════════════

describe('getTierProgress', () => {
  const formula: XpFormula = { baseXP: 100, exponent: 1, scaleFactor: 1 };

  it('返回 0~1 之间的进度', () => {
    const progression = {
      mode: 'tiered' as const,
      xpFormula: formula,
      tiers: [
        { name: 'T1', description: '', xpRequired: 0, statBonuses: {} as any },
        { name: 'T2', description: '', xpRequired: 0, statBonuses: {} as any },
      ],
      currentTierIndex: 0,
      currentXP: 50,
    } as ProgressionModuleSchema;
    // xpNeeded = 100, currentXP = 50 → 0.5
    expect(getTierProgress(progression)).toBe(0.5);
  });

  it('满级时返回 1', () => {
    const progression = {
      mode: 'tiered' as const,
      xpFormula: formula,
      tiers: [{ name: 'T1', description: '', xpRequired: 0, statBonuses: {} as any }],
      currentTierIndex: 0,
      currentXP: 999,
    } as ProgressionModuleSchema;
    expect(getTierProgress(progression)).toBe(1);
  });

  it('XP 超过需要时不超过 1', () => {
    const progression = {
      mode: 'tiered' as const,
      xpFormula: formula,
      tiers: [
        { name: 'T1', description: '', xpRequired: 0, statBonuses: {} as any },
        { name: 'T2', description: '', xpRequired: 0, statBonuses: {} as any },
      ],
      currentTierIndex: 0,
      currentXP: 200,
    } as ProgressionModuleSchema;
    // xpNeeded = 100, currentXP = 200 → min(1, 2) = 1
    expect(getTierProgress(progression)).toBe(1);
  });

  it('currentXP 缺失时默认为 0', () => {
    const progression = {
      mode: 'tiered' as const,
      xpFormula: formula,
      tiers: [
        { name: 'T1', description: '', xpRequired: 0, statBonuses: {} as any },
        { name: 'T2', description: '', xpRequired: 0, statBonuses: {} as any },
      ],
      currentTierIndex: 0,
    } as ProgressionModuleSchema;
    expect(getTierProgress(progression)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
//  getCurrentLevelCap
// ═══════════════════════════════════════════════════

describe('getCurrentLevelCap', () => {
  it('段位制：返回当前段位的 statBonuses', () => {
    const bonuses = { attrAMax: 200, attrBMax: 150, dim1Max: 100, dim2Max: 100, dim3Max: 100, dim4Max: 100, dim5Max: 100, dim6Max: 100 };
    const progression = {
      mode: 'tiered' as const,
      tiers: [
        { name: 'T1', description: '', xpRequired: 0, statBonuses: bonuses },
      ],
      currentTierIndex: 0,
    } as ProgressionModuleSchema;
    expect(getCurrentLevelCap(progression)).toEqual(bonuses);
  });

  it('等级制：返回当前等级的属性天花板', () => {
    const progression = {
      mode: 'level' as const,
      levelData: {
        maxLevel: 50,
        baseStats: { attrAMax: 100, attrBMax: 100, dim1Max: 50, dim2Max: 50, dim3Max: 50, dim4Max: 50, dim5Max: 50, dim6Max: 50 },
        growthPerLevel: { attrAMax: 10, attrBMax: 5, dim1Max: 8, dim2Max: 8, dim3Max: 8, dim4Max: 8, dim5Max: 8, dim6Max: 8 },
      },
      currentTierIndex: 5,
    } as ProgressionModuleSchema;
    const result = getCurrentLevelCap(progression);
    expect(result).not.toBeNull();
    expect(result!.attrAMax).toBe(100 + 5 * 10);  // 150
  });

  it('段位制：超出范围返回 null', () => {
    const progression = {
      mode: 'tiered' as const,
      tiers: [],
      currentTierIndex: 0,
    } as ProgressionModuleSchema;
    expect(getCurrentLevelCap(progression)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════
//  calcModifier
// ═══════════════════════════════════════════════════

describe('calcModifier', () => {
  it('属性值 10 → 修正 0', () => {
    expect(calcModifier(10)).toBe(0);
  });

  it('属性值 20 → 修正 +5', () => {
    expect(calcModifier(20)).toBe(5);
  });

  it('属性值 8 → 修正 -1', () => {
    expect(calcModifier(8)).toBe(-1);
  });

  it('属性值 0 → 修正 -5', () => {
    expect(calcModifier(0)).toBe(-5);
  });

  it('奇数属性值向下取整', () => {
    // (15 - 10) / 2 = 2.5 → floor = 2
    expect(calcModifier(15)).toBe(2);
    // (13 - 10) / 2 = 1.5 → floor = 1
    expect(calcModifier(13)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════
//  rollDice
// ═══════════════════════════════════════════════════

describe('rollDice', () => {
  beforeEach(() => {
    mock.restore();
  });

  it('Math.random()=0.95 → d20=20 (自然20)', () => {
    mock.module('globalThis', () => ({
      ...globalThis,
      Math: { ...Math, random: () => 0.95 },
    }));
    // 由于 mock.module 可能不稳定，直接用 spy
    const spy = mock(() => 0.95);
    const original = Math.random;
    Math.random = spy as any;
    const result = rollDice(10, 15);
    expect(result.d20).toBe(20);
    expect(result.isNatural20).toBe(true);
    expect(result.isNatural1).toBe(false);
    Math.random = original;
  });

  it('Math.random()=0 → d20=1 (自然1)', () => {
    const original = Math.random;
    Math.random = (() => 0) as any;
    const result = rollDice(10, 15);
    expect(result.d20).toBe(1);
    expect(result.isNatural1).toBe(true);
    expect(result.isNatural20).toBe(false);
    Math.random = original;
  });

  it('total = d20 + modifier', () => {
    const original = Math.random;
    Math.random = (() => 0.5) as any;  // d20 = 11
    const result = rollDice(14, 15);    // modifier = floor((14-10)/2) = 2
    expect(result.d20).toBe(11);
    expect(result.modifier).toBe(2);
    expect(result.total).toBe(13);
    expect(result.success).toBe(false); // 13 < 15
    Math.random = original;
  });

  it('成功/失败判定正确', () => {
    const original = Math.random;
    // d20 = 11, modifier = 5 (attr 20), total = 16 >= DC 15 → 成功
    Math.random = (() => 0.5) as any;
    const success = rollDice(20, 15);
    expect(success.success).toBe(true);

    // d20 = 11, modifier = -1 (attr 8), total = 10 < DC 15 → 失败
    const failure = rollDice(8, 15);
    expect(failure.success).toBe(false);
    Math.random = original;
  });
});

// ═══════════════════════════════════════════════════
//  getCheckableAttributes
// ═══════════════════════════════════════════════════

describe('getCheckableAttributes', () => {
  it('提取六维属性和特色属性', () => {
    const statModule: StatModuleSchema = {
      attrA: { name: 'HP', current: 80, max: 100 },
      attrB: { name: 'MP', current: 60, max: 100 },
      dim1: { name: '力量', value: 15, range: [0, 100] },
      dim2: { name: '敏捷', value: 12, range: [0, 100] },
      dim3: { name: '智力', value: 18, range: [0, 100] },
      special: [
        { id: 'luck', name: '幸运', value: 7, range: [0, 10], description: '运气' },
      ],
    };
    const result = getCheckableAttributes(statModule);
    expect(result).toHaveLength(4); // 3 dims + 1 special
    expect(result[0]).toEqual({ id: 'dim1', name: '力量', value: 15 });
    expect(result[3]).toEqual({ id: 'luck', name: '幸运', value: 7 });
  });

  it('缺失的六维属性被跳过', () => {
    const statModule: StatModuleSchema = {
      attrA: { name: 'HP', current: 80, max: 100 },
      attrB: { name: 'MP', current: 60, max: 100 },
      dim1: { name: '力量', value: 15, range: [0, 100] },
      special: [],
    };
    const result = getCheckableAttributes(statModule);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dim1');
  });

  it('没有六维属性只有特色属性', () => {
    const statModule: StatModuleSchema = {
      attrA: { name: 'HP', current: 80, max: 100 },
      attrB: { name: 'MP', current: 60, max: 100 },
      special: [
        { id: 'sp1', name: '特殊1', value: 5, range: [0, 10], description: '' },
        { id: 'sp2', name: '特殊2', value: 8, range: [0, 10], description: '' },
      ],
    };
    const result = getCheckableAttributes(statModule);
    expect(result).toHaveLength(2);
  });
});
