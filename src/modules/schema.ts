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
  /** 六维属性（可选，经营/日常等世界可以不要） */
  dim1?: SixDimStat;
  dim2?: SixDimStat;
  dim3?: SixDimStat;
  dim4?: SixDimStat;
  dim5?: SixDimStat;
  dim6?: SixDimStat;
  /** 特色属性（0~4个） */
  special: SpecialStat[];
}

// ─── 成长体系模块 ───

/** 属性上限（段位制和等级制共用） */
export interface StatBonuses {
  attrAMax: number;
  attrBMax: number;
  dim1Max: number;
  dim2Max: number;
  dim3Max: number;
  dim4Max: number;
  dim5Max: number;
  dim6Max: number;
}

/** 单个段位定义（段位制专用） */
export interface TierDef {
  name: string;           // AI生成的段位名
  description: string;    // AI生成的描述
  xpRequired: number;     // 升到此段累计需要的XP（由算法计算）
  statBonuses: StatBonuses; // 该段位的属性上限
}

/** 等级制专用数据 */
export interface LevelData {
  maxLevel: number;           // 等级上限（如100）
  baseStats: StatBonuses;     // 0级属性天花板
  growthPerLevel: StatBonuses; // 每级属性增长量
}

/** XP计算公式参数 */
export interface XpFormula {
  baseXP: number;         // 基础XP（如100）
  exponent: number;       // 指数（1.0=线性，1.5=递增，2.0=快速递增）
  scaleFactor: number;    // 缩放系数（默认1.0）
}

/**
 * 成长体系配置（静态，存放在世界系统中）
 * 创建世界时设定，不频繁变化
 */
export interface ProgressionConfig {
  mode: 'tiered' | 'level';
  xpFormula: XpFormula;
  // ── 二选一（OR 关系，由 mode 决定读哪个） ──
  /** 段位制：命名段位列表 */
  tiers?: TierDef[];
  /** 等级制：公式化等级数据 */
  levelData?: LevelData;
}

/**
 * 成长体系状态（动态，存放在变量系统中）
 * AI 每次回复可能更新
 */
export interface ProgressionState {
  currentTierIndex: number;   // 当前段位/等级索引
  currentXP: number;          // 当前经验值
}

/**
 * 完整的成长体系模块（兼容旧格式）
 * @deprecated 新代码请使用 ProgressionConfig + ProgressionState 分离读取
 */
export interface ProgressionModuleSchema extends ProgressionConfig, ProgressionState {}

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

// ─── 天赋体系模块 ───

/** 天赋条目 */
export interface TalentDef {
  id: string;              // 英文标识
  name: string;            // 天赋名
  description: string;     // 描述
  rarity: '普通' | '精良' | '稀有' | '史诗' | '传说';  // 品质
  effects?: string[];      // 效果描述（纯文本，供AI参考）
}

/** 天赋大类 */
export interface TalentCategoryDef {
  id: string;              // 英文标识
  name: string;            // AI生成的大类名（如"灵根"、"体质"、"血脉"）
  description: string;     // 大类描述
  talents: TalentDef[];    // 该大类下的天赋列表
}

/** 完整的天赋体系模块 */
export interface TalentModuleSchema {
  categories: TalentCategoryDef[];  // AI生成的天赋大类列表
}

// ─── 世界系统聚合类型 ───

/** 世界系统运行时数据（存放在 GameState.世界.世界系统） */
export interface WorldSystemData {
  数值属性?: StatModuleSchema;
  成长体系?: ProgressionModuleSchema;
  资源管理?: ResourceModuleSchema;
  骰子检定?: DiceModuleSchema;
  天赋体系?: TalentModuleSchema;
  /** 保留扩展性：自定义模块数据 */
  [key: string]: unknown;
}
