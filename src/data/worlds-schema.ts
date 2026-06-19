// 世界定义完整 Schema —— 通用结构化框架，适用于所有类型的世界
//
// 设计原则：用固定的高级概念（属性、进阶、冲突、资源、关系、事件）作为
// 通用框架。所有世界都有这些概念，只是内容完全不同。留空 = 不适用。

// ═══════════════════════════════════════════════════════════════
//  通用子接口 —— 6 大结构化概念
// ═══════════════════════════════════════════════════════════════

/** 属性定义 —— 该世界的核心数值属性 */
export interface StatDef {
  id: string;                    // 'charm' | 'neigong' | 'exam_score' | 'radiation_res'
  name: string;                  // '魅力值' | '内力' | '考试成绩' | '辐射抗性'
  description: string;           // '社交场合的影响力与诱惑力'
  range?: [number, number];      // [0, 100]，可选
  important?: boolean;           // true = 核心属性，UI 高亮显示
}

/** 进阶体系 —— 角色如何变强/升级/晋升 */
export interface ProgressionDef {
  type: 'tiered' | 'skill_points' | 'reputation' | 'rank' | 'none';
  description?: string;          // 进阶方式的整体描述
  tiers?: Array<{
    name: string;                // '秀女' | '不入流' | '下城区居民'
    description?: string;        // 该阶段特征简述
  }>;
}

/** 冲突方式 —— 该世界如何处理对抗与纠纷 */
export interface ConflictDef {
  types: string[];               // ['权谋博弈', '毒害陷害'] / ['枪战火拼', '黑客攻防']
  description: string;           // 冲突运作机制的详细说明
  lethal?: boolean;              // 角色是否可能在冲突中死亡
  nonViolent?: boolean;          // true = 无物理暴力（校园/宫斗/都市）
}

/** 资源定义 —— 该世界中的一种重要资源 */
export interface ResourceDef {
  id: string;                    // 'favor' | 'bottlecaps' | 'credit' | 'allowance'
  name: string;                  // '恩宠值' | '瓶盖' | '信用点' | '零花钱'
  symbol?: string;               // '♥' | '⛃' | '₦' | '¥'
  description: string;           // 获取方式与用途
  scarce?: boolean;              // true = 稀缺资源，生存攸关
}

/** 资源管理系统 */
export interface ResourceManagementDef {
  resources: ResourceDef[];
  description?: string;          // 资源系统的整体说明
}

/** 关系类型定义 */
export interface RelationType {
  name: string;                  // '帝王' | '同学' | '帮派成员' | '师兄师姐'
  description: string;           // 与该类角色的关系特点
}

/** 关系系统 —— 该世界中的人际关系机制 */
export interface RelationshipDef {
  types: RelationType[];         // 可存在的关系类型
  mechanics?: string;            // 好感度、信任度、忠诚度等机制说明
  description?: string;          // 关系系统的整体描述
}

/** 世界事件/活动 */
export interface WorldEventDef {
  name: string;                  // '选秀大典' | '学园祭' | '月考' | '午夜狂欢'
  trigger?: string;              // '三年一次' | '秋季' | '每月' | '凌晨2点'
  description: string;           // 事件内容与影响
  significance?: 'major' | 'minor';
}

// ═══════════════════════════════════════════════════════════════
//  玩家指南与叙事风格
// ═══════════════════════════════════════════════════════════════

/** 玩家指南 —— 帮助玩家选择适合自己的世界 */
export interface PlaystyleGuideDef {
  recommendedFor?: string[];     // ['喜欢经营的玩家', '策略爱好者']
  avoidIf?: string[];            // ['不喜欢慢节奏']
  estimatedPlaytime?: string;    // '5-20小时'
}

/** 叙事风格指引 —— 可注入到 system prompt */
export interface NarrativeStyleDef {
  tone?: string;                 // '轻松幽默' | '压抑沉重' | '华丽压抑'
  pacing?: string;               // '慢热' | '快节奏'
  contentWarnings?: string[];    // ['暴力描写', '心理恐怖']
}

// ═══════════════════════════════════════════════════════════════
//  嵌入式世界书条目 —— 替代 entryId: null 模式
// ═══════════════════════════════════════════════════════════════

/** 世界书条目（直接嵌入 WorldDef，可注入到 system prompt） */
export interface WorldBookEntryDef {
  uid: number;
  key: string[];                 // 触发关键词（空数组 = 始终注入）
  keysecondary?: string[];
  comment: string;               // 条目标题
  content: string;               // 详细内容（注入到 prompt）
  constant: boolean;             // true = 始终注入，false = 关键词触发
  selectiveLogic?: number;       // 0=AND_ANY, 1=NOT_ALL, 2=NOT_ANY, 3=AND_ALL
  order: number;                 // 注入顺序
  position?: 'before_char' | 'after_char';
  depth?: number;                // 最大注入轮次
  probability?: number;          // 触发概率 (0-100)
  disable?: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  已有子接口
// ═══════════════════════════════════════════════════════════════

/** 预设势力 */
export interface FactionDef {
  name: string;
  description: string;
  alignment?: string;           // '友善' | '中立' | '敌对' | ...
}

/** 预设NPC */
export interface PresetNPCDef {
  name: string;
  role: string;                 // 角色定位：'邻居大婶'、'矿场工头'
  description: string;
  personality?: string;         // 性格标签：'热心肠、爱八卦'
}

// ═══════════════════════════════════════════════════════════════
//  完整的世界定义
// ═══════════════════════════════════════════════════════════════

/** 完整的世界定义 —— 通用结构化框架 */
export interface WorldDef {
  // ─── 必填 ───
  id: string;
  name: string;
  description: string;          // 一句话简介（Step 1 卡片用）
  entryId: number | null;       // 世界书条目ID，null = 默认自由模式

  // ─── 视觉/展示 ───
  tags?: string[];              // ['科幻', '封闭空间', '生存']
  icon?: string;                // Lucide 图标名称：'Cpu'、'Swords'（见 shared/worldIcons.tsx）
  coverColor?: string;          // 主题色 hex：'#e74c3c'

  // ─── 世界设定 ───
  setting?: {
    overview: string;           // 2-3段世界观背景故事
    timePeriod?: string;        // '1990年春' | '星际历2187年'
    location?: string;          // '东北工业城市鹤岗'
    atmosphere?: string;        // '温暖怀旧、市井烟火气'
  };

  // ─── 世界规则（概览，保留向后兼容） ───
  rules?: {
    powerSystem?: string;       // 力量/魔法/科技体系
    socialStructure?: string;   // 社会结构
    specialRules?: string[];    // ['角色可能死亡', '无魔法']
  };

  // ─── 经济/时间系统 ───
  economy?: {
    currency?: {
      name: string;             // '人民币'
      symbol?: string;          // '¥'
      description?: string;
    };
    priceLevel?: string;        // '1990年物价水平'
  };
  timeSystem?: {
    calendar?: string;          // '公历' | '星际历'
    startTime?: string;         // '1990年3月15日'
    timeSpeed?: string;         // '与现实同步'
  };

  // ─── 势力与NPC ───
  factions?: FactionDef[];
  presetNPCs?: PresetNPCDef[];

  // ─── 核心特色 ───
  highlights?: string[];        // ['日常生活细节', '温情互动', '怀旧氛围']

  // ─── 文风引用（预留） ───
  writingStyleRef?: string;     // 引用外部文风 JSON 的 id

  // ─── 元数据 ───
  difficulty?: 'easy' | 'medium' | 'hard';
  author?: string;
  version?: string;
  createdAt?: string;
  matureContent?: boolean;

  // ═══════════════════════════════════════════════════════════════
  //  通用结构化框架 —— v2.0 新增
  //  所有字段均为 optional，留空表示不适用于该世界
  // ═══════════════════════════════════════════════════════════════

  /** 核心属性 —— 该世界中最重要的 3-5 个数值属性 */
  coreStats?: StatDef[];

  /** 进阶体系 —— 角色如何变强/晋升 */
  progression?: ProgressionDef;

  /** 冲突方式 —— 该世界如何处理对抗 */
  conflict?: ConflictDef;

  /** 资源系统 —— 该世界的重要资源 */
  resources?: ResourceManagementDef;

  /** 关系系统 —— 该世界的人际关系机制 */
  relationships?: RelationshipDef;

  /** 世界事件 —— 该世界中的关键事件/活动 */
  events?: WorldEventDef[];

  /** 玩家指南 —— 帮助选择适合的世界 */
  playstyleGuide?: PlaystyleGuideDef;

  /** 叙事风格 —— 可注入到 system prompt */
  narrativeStyle?: NarrativeStyleDef;

  /** 嵌入式世界书条目 —— 替代 entryId: null */
  worldBookEntries?: WorldBookEntryDef[];
}
