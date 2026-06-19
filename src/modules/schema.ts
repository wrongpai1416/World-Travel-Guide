// ============================================================
//  世界模块化系统 v2 — Schema 类型定义
//  框架层零指向性，所有世界相关内容由AI生成时注入
// ============================================================

// ─── 数值属性模块 ───

/** 六维单个属性 */
export interface SixDimStat {
  name: string;           // AI生成的中文名
  value: number;          // 当前值
  range: [number, number]; // [最小值, 最大值]
}

/** 特色属性 */
export interface SpecialStat {
  id: string;             // 英文标识
  name: string;           // AI生成的中文名
  value: number;          // 当前值
  range: [number, number];
  description: string;    // AI生成的描述
}

/** 完整的数值属性模块 */
export interface StatModuleSchema {
  /** 底层必选 - 生命类属性 */
  attrA: { name: string; current: number; max: number };
  /** 底层必选 - 能量类属性 */
  attrB: { name: string; current: number; max: number };
  /** 六维属性 - dim1~dim6 */
  dim1: SixDimStat;  // 造成伤害的能力
  dim2: SixDimStat;  // 承受伤害的能力
  dim3: SixDimStat;  // 行动速度/先手
  dim4: SixDimStat;  // 学习/策略/施法能力
  dim5: SixDimStat;  // 社交/说服/影响能力
  dim6: SixDimStat;  // 随机运气/暴击/掉落
  /** 特色属性（1-2个） */
  special: SpecialStat[];
}

// ─── 成长体系模块 ───

/** 单个段位/等级定义 */
export interface TierDef {
  name: string;           // AI生成的段位/等级名
  description: string;    // AI生成的描述
  xpRequired: number;     // 升到此级累计需要的XP（由算法计算）
  statBonuses: {          // 该级别的属性上限提升（累计值）
    attrAMax: number;
    attrBMax: number;
    dim1Max: number;
    dim2Max: number;
    dim3Max: number;
    dim4Max: number;
    dim5Max: number;
    dim6Max: number;
  };
}

/** XP计算公式参数 */
export interface XpFormula {
  baseXP: number;         // 基础XP（如100）
  exponent: number;       // 指数（1.0=线性，1.5=递增，2.0=快速递增）
  scaleFactor: number;    // 缩放系数（默认1.0）
}

/** 完整的成长体系模块 */
export interface ProgressionModuleSchema {
  mode: 'tiered' | 'level';  // 段位制 或 等级制
  tiers: TierDef[];           // AI生成的段位/等级列表
  xpFormula: XpFormula;       // XP计算参数
  /** 运行时数据 */
  currentTierIndex: number;   // 当前段位/等级索引
  currentXP: number;          // 当前级别内的XP
}

// ─── 资源管理模块 ───

/** 单个资源 */
export interface ResourceItem {
  id: string;             // 英文标识
  name: string;           // AI生成的资源名
  symbol: string;         // AI生成的符号（如💰💎⚔️📦）
  amount: number;         // 当前数量
  max?: number;           // 上限（可选，无上限则不填）
  scarce: boolean;        // 是否稀缺
  description: string;    // AI生成的描述（获取方式与用途）
}

/** 货币（可选） */
export interface CurrencyDef {
  name: string;           // AI生成的货币名
  symbol: string;         // AI生成的符号
  amount: number;         // 当前数量
  description?: string;   // AI生成的描述
}

/** 完整的资源管理模块 */
export interface ResourceModuleSchema {
  description: string;    // AI生成的资源系统整体描述
  items: ResourceItem[];  // AI生成的资源列表（3-8种）
  currency?: CurrencyDef; // 货币系统（可选）
  /** AI可添加自定义字段 */
  [key: string]: unknown;
}

// ─── 骰子检定模块 ───

/** 骰子检定结果 */
export interface DiceRoll {
  attributeName: string;  // 使用的属性名称
  attributeValue: number; // 属性当前值
  modifier: number;       // 属性修正值
  d20: number;            // 骰出的d20值
  total: number;          // 总值 = d20 + modifier
  dc: number;             // 难度等级
  success: boolean;       // 是否成功
  isNatural20: boolean;   // 是否大成功
  isNatural1: boolean;    // 是否大失败
  timestamp: number;      // 掷骰时间
}

/** 完整的骰子检定模块 */
export interface DiceModuleSchema {
  lastRoll?: DiceRoll;    // 最近一次掷骰结果
  history?: DiceRoll[];   // 掷骰历史（最多保留10次）
}

// ─── 世界系统聚合类型 ───

/** 世界系统运行时数据（存放在 GameState.世界.世界系统） */
export interface WorldSystemData {
  数值属性?: StatModuleSchema;
  成长体系?: ProgressionModuleSchema;
  资源管理?: ResourceModuleSchema;
  骰子检定?: DiceModuleSchema;
  /** 保留扩展性：自定义模块数据 */
  [key: string]: unknown;
}
