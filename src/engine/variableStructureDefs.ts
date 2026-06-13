// ============================================================
// 变量结构定义 — 为变量系统提供分类展示、路径映射、显示名称
// 移植自 yijiekkk/src/utils/dlc-variable-design.js 概念
// 适配本项目的 GameState 路径结构
// ============================================================

import type { GameState, PlayerState, NPCData, WorldState } from '../schema/variables';

// ============================================================
//  类型定义
// ============================================================

export interface VariableEntry {
  id: string;
  section: string;
  sectionLabel: string;
  displayName: string;
  /** JSON 路径，如 '玩家.姓名' */
  canonicalPath: string;
  description: string;
  /** 值类型提示 */
  valueType?: 'string' | 'number' | 'object' | 'array' | 'boolean';
  /** 是否支持在UI中编辑 */
  editable?: boolean;
  /** NPC 路径模板，如 '人物档案.[NPC_ID].姓名' */
  isNpcTemplate?: boolean;
}

export interface VariableSection {
  key: string;
  label: string;
  icon: string;
  entries: VariableEntry[];
}

// ============================================================
//  变量结构定义列表
// ============================================================

export const VARIABLE_STRUCTURE_DEFINITIONS: VariableEntry[] = [
  // ─── 世界状态 ───
  {
    id: 'world_time',
    section: 'world',
    sectionLabel: '世界状态',
    displayName: '当前时间',
    canonicalPath: '世界.时间系统.当前时间',
    description: '游戏世界当前的时间描述',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'world_era',
    section: 'world',
    sectionLabel: '世界状态',
    displayName: '纪元名称',
    canonicalPath: '世界.时间系统.纪元名称',
    description: '当前纪元或时代名称',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'world_weather',
    section: 'world',
    sectionLabel: '世界状态',
    displayName: '当前天气',
    canonicalPath: '世界.时间系统.当前天气',
    description: '当前天气状况',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'world_location',
    section: 'world',
    sectionLabel: '世界状态',
    displayName: '当前位置',
    canonicalPath: '世界.空间定位.当前位置',
    description: '玩家当前所在的地理位置',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'world_area',
    section: 'world',
    sectionLabel: '世界状态',
    displayName: '区域特征',
    canonicalPath: '世界.空间定位.区域特征',
    description: '当前区域的环境特征描述',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'world_power',
    section: 'world',
    sectionLabel: '世界状态',
    displayName: '权力结构',
    canonicalPath: '世界.社会环境.权力结构',
    description: '当前世界的权力分配结构',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'world_atmosphere',
    section: 'world',
    sectionLabel: '世界状态',
    displayName: '社会氛围',
    canonicalPath: '世界.社会环境.社会氛围',
    description: '当前社会的整体氛围',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'world_values',
    section: 'world',
    sectionLabel: '世界状态',
    displayName: '主流价值观',
    canonicalPath: '世界.社会环境.主流价值观',
    description: '当前社会的主流价值取向',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'info_global',
    section: 'world_info',
    sectionLabel: '信息层级',
    displayName: '全局重大事件',
    canonicalPath: '世界.信息层级.全局重大事件',
    description: '影响整个世界的重大事件',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'info_faction',
    section: 'world_info',
    sectionLabel: '信息层级',
    displayName: '势力动态',
    canonicalPath: '世界.信息层级.势力动态',
    description: '各势力之间的动态变化',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'info_region',
    section: 'world_info',
    sectionLabel: '信息层级',
    displayName: '区域事件',
    canonicalPath: '世界.信息层级.区域事件',
    description: '当前区域发生的事件',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'info_local',
    section: 'world_info',
    sectionLabel: '信息层级',
    displayName: '本地消息',
    canonicalPath: '世界.信息层级.本地消息',
    description: '本地流传的消息',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'info_rumor',
    section: 'world_info',
    sectionLabel: '信息层级',
    displayName: '圈内传闻',
    canonicalPath: '世界.信息层级.圈内传闻',
    description: '特定圈子里流传的传闻',
    valueType: 'string',
    editable: true,
  },

  // ─── 玩家核心 ───
  {
    id: 'player_name',
    section: 'player_core',
    sectionLabel: '玩家核心',
    displayName: '姓名',
    canonicalPath: '玩家.姓名',
    description: '玩家角色的姓名',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'player_age',
    section: 'player_core',
    sectionLabel: '玩家核心',
    displayName: '年龄',
    canonicalPath: '玩家.年龄',
    description: '玩家角色的年龄',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'player_gender',
    section: 'player_core',
    sectionLabel: '玩家核心',
    displayName: '性别',
    canonicalPath: '玩家.性别',
    description: '玩家角色的性别',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'player_goal',
    section: 'player_core',
    sectionLabel: '玩家核心',
    displayName: '当前目标',
    canonicalPath: '玩家.当前目标',
    description: '玩家当前的主要目标',
    valueType: 'string',
    editable: true,
  },

  // ─── 玩家生存 ───
  {
    id: 'player_hp',
    section: 'player_survival',
    sectionLabel: '生存状态',
    displayName: '血量',
    canonicalPath: '玩家.生存状态.血量',
    description: '当前生命值',
    valueType: 'number',
    editable: true,
  },
  {
    id: 'player_stamina',
    section: 'player_survival',
    sectionLabel: '生存状态',
    displayName: '体力值',
    canonicalPath: '玩家.生存状态.体力值',
    description: '当前体力值',
    valueType: 'number',
    editable: true,
  },

  // ─── 玩家身份 ───
  {
    id: 'player_job',
    section: 'player_identity',
    sectionLabel: '身份信息',
    displayName: '职业',
    canonicalPath: '玩家.身份信息.职业',
    description: '当前职业',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'player_class',
    section: 'player_identity',
    sectionLabel: '身份信息',
    displayName: '阶层',
    canonicalPath: '玩家.身份信息.阶层',
    description: '社会阶层',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'player_org',
    section: 'player_identity',
    sectionLabel: '身份信息',
    displayName: '所属组织',
    canonicalPath: '玩家.身份信息.所属组织',
    description: '所属组织或势力',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'player_special',
    section: 'player_identity',
    sectionLabel: '身份信息',
    displayName: '特殊身份',
    canonicalPath: '玩家.身份信息.特殊身份',
    description: '隐藏或特殊的身份',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'player_background',
    section: 'player_identity',
    sectionLabel: '身份信息',
    displayName: '背景信息',
    canonicalPath: '玩家.身份信息.背景信息',
    description: '角色背景故事',
    valueType: 'string',
    editable: true,
  },

  // ─── 玩家货币 ───
  {
    id: 'player_currency_name',
    section: 'player_currency',
    sectionLabel: '货币资源',
    displayName: '主货币名称',
    canonicalPath: '玩家.货币资源.主货币.名称',
    description: '主要货币的名称',
    valueType: 'string',
    editable: true,
  },
  {
    id: 'player_currency_amount',
    section: 'player_currency',
    sectionLabel: '货币资源',
    displayName: '主货币数量',
    canonicalPath: '玩家.货币资源.主货币.数量',
    description: '当前持有的主货币数量',
    valueType: 'number',
    editable: true,
  },

  // ─── NPC 核心 ───
  {
    id: 'npc_name',
    section: 'npc_core',
    sectionLabel: 'NPC 核心',
    displayName: '姓名',
    canonicalPath: '人物档案.[NPC_ID].姓名',
    description: 'NPC 的姓名',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_race',
    section: 'npc_core',
    sectionLabel: 'NPC 核心',
    displayName: '种族',
    canonicalPath: '人物档案.[NPC_ID].种族',
    description: 'NPC 的种族',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_gender',
    section: 'npc_core',
    sectionLabel: 'NPC 核心',
    displayName: '性别',
    canonicalPath: '人物档案.[NPC_ID].性别',
    description: 'NPC 的性别',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_age',
    section: 'npc_core',
    sectionLabel: 'NPC 核心',
    displayName: '年龄',
    canonicalPath: '人物档案.[NPC_ID].年龄',
    description: 'NPC 的年龄',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_category',
    section: 'npc_core',
    sectionLabel: 'NPC 核心',
    displayName: '人物分类',
    canonicalPath: '人物档案.[NPC_ID].人物分类',
    description: '在场/离场/重点',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },

  // ─── NPC 生存 ───
  {
    id: 'npc_hp',
    section: 'npc_survival',
    sectionLabel: 'NPC 生存',
    displayName: '血量',
    canonicalPath: '人物档案.[NPC_ID].生存状态.血量',
    description: 'NPC 当前生命值',
    valueType: 'number',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_stamina',
    section: 'npc_survival',
    sectionLabel: 'NPC 生存',
    displayName: '体力值',
    canonicalPath: '人物档案.[NPC_ID].生存状态.体力值',
    description: 'NPC 当前体力值',
    valueType: 'number',
    editable: true,
    isNpcTemplate: true,
  },

  // ─── NPC 社会身份 ───
  {
    id: 'npc_job',
    section: 'npc_identity',
    sectionLabel: 'NPC 社会身份',
    displayName: '职业',
    canonicalPath: '人物档案.[NPC_ID].社会身份.职业',
    description: 'NPC 的职业',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_faction',
    section: 'npc_identity',
    sectionLabel: 'NPC 社会身份',
    displayName: '所属势力',
    canonicalPath: '人物档案.[NPC_ID].社会身份.所属势力',
    description: 'NPC 所属的势力',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_status',
    section: 'npc_identity',
    sectionLabel: 'NPC 社会身份',
    displayName: '社会地位',
    canonicalPath: '人物档案.[NPC_ID].社会身份.社会地位',
    description: 'NPC 的社会地位',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },

  // ─── NPC 关系 ───
  {
    id: 'npc_affinity',
    section: 'npc_relation',
    sectionLabel: 'NPC 关系',
    displayName: '好感度',
    canonicalPath: '人物档案.[NPC_ID].关系数据.好感度',
    description: 'NPC 对玩家的好感度 (0-100)',
    valueType: 'number',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_trust',
    section: 'npc_relation',
    sectionLabel: 'NPC 关系',
    displayName: '信任度',
    canonicalPath: '人物档案.[NPC_ID].关系数据.信任度',
    description: 'NPC 对玩家的信任度 (0-100)',
    valueType: 'number',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_rel_type',
    section: 'npc_relation',
    sectionLabel: 'NPC 关系',
    displayName: '关系类型',
    canonicalPath: '人物档案.[NPC_ID].关系数据.关系类型',
    description: '与玩家的关系类型',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },

  // ─── NPC 个人信息 ───
  {
    id: 'npc_personality',
    section: 'npc_personal',
    sectionLabel: 'NPC 个人信息',
    displayName: '表性格',
    canonicalPath: '人物档案.[NPC_ID].个人信息.表性格',
    description: 'NPC 表面上的性格特征',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_inner',
    section: 'npc_personal',
    sectionLabel: 'NPC 个人信息',
    displayName: '里性格',
    canonicalPath: '人物档案.[NPC_ID].个人信息.里性格',
    description: 'NPC 内心深处的真实性格',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_appearance',
    section: 'npc_personal',
    sectionLabel: 'NPC 个人信息',
    displayName: '外貌',
    canonicalPath: '人物档案.[NPC_ID].个人信息.外貌',
    description: 'NPC 的外貌描述',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_location',
    section: 'npc_personal',
    sectionLabel: 'NPC 个人信息',
    displayName: '当前位置',
    canonicalPath: '人物档案.[NPC_ID].个人信息.当前位置',
    description: 'NPC 当前所在位置',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_state',
    section: 'npc_personal',
    sectionLabel: 'NPC 个人信息',
    displayName: '当前状态',
    canonicalPath: '人物档案.[NPC_ID].个人信息.当前状态',
    description: 'NPC 当前的状态描述',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
  {
    id: 'npc_thought',
    section: 'npc_personal',
    sectionLabel: 'NPC 个人信息',
    displayName: '当前想法',
    canonicalPath: '人物档案.[NPC_ID].个人信息.当前想法',
    description: 'NPC 当前的想法',
    valueType: 'string',
    editable: true,
    isNpcTemplate: true,
  },
];

// ============================================================
//  分组工具
// ============================================================

/** 按 section 分组，返回有序的 VariableSection 列表 */
export function groupVariableEntriesBySection(): VariableSection[] {
  const sectionOrder = [
    'world', 'world_info',
    'player_core', 'player_survival', 'player_identity', 'player_currency',
    'npc_core', 'npc_survival', 'npc_identity', 'npc_relation', 'npc_personal',
  ];
  const sectionIcons: Record<string, string> = {
    world: '🌍', world_info: '📰',
    player_core: '👤', player_survival: '❤️', player_identity: '🪪', player_currency: '💰',
    npc_core: '👥', npc_survival: '💚', npc_identity: '🏷️', npc_relation: '🤝', npc_personal: '📝',
  };

  const groups = new Map<string, VariableEntry[]>();
  for (const entry of VARIABLE_STRUCTURE_DEFINITIONS) {
    const arr = groups.get(entry.section) || [];
    arr.push(entry);
    groups.set(entry.section, arr);
  }

  return sectionOrder
    .filter(key => groups.has(key))
    .map(key => ({
      key,
      label: groups.get(key)![0].sectionLabel,
      icon: sectionIcons[key] || '📋',
      entries: groups.get(key)!,
    }));
}

/** 根据 canonicalPath 查找定义 */
export function findVariableEntry(canonicalPath: string): VariableEntry | undefined {
  return VARIABLE_STRUCTURE_DEFINITIONS.find(e => e.canonicalPath === canonicalPath);
}

/** 获取变量的显示名称（优先用定义中的 displayName，否则用路径最后一段） */
export function getVariableDisplayName(path: string): string {
  const entry = findVariableEntry(path);
  if (entry) return entry.displayName;
  const parts = path.split('.');
  return parts[parts.length - 1] || path;
}

/** 获取路径对应的 section label */
export function getVariableSectionLabel(path: string): string {
  const entry = findVariableEntry(path);
  return entry?.sectionLabel || '其他';
}

// ============================================================
//  变量值读取工具
// ============================================================

/** 从 GameState 中读取指定路径的值 */
export function getVariableValue(state: GameState, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = state;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** 从 GameState 中读取所有已定义的变量值，返回 path → value 映射 */
export function getAllDefinedVariableValues(state: GameState): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const entry of VARIABLE_STRUCTURE_DEFINITIONS) {
    if (entry.isNpcTemplate) continue; // NPC 模板路径跳过，需要具体 NPC ID
    const value = getVariableValue(state, entry.canonicalPath);
    result.set(entry.canonicalPath, value);
  }
  return result;
}

/** 获取所有 NPC 的变量值展开列表 */
export function getNpcVariableValues(state: GameState): Array<{
  npcId: string;
  npcName: string;
  path: string;
  displayName: string;
  sectionLabel: string;
  value: unknown;
}> {
  const results: Array<{
    npcId: string;
    npcName: string;
    path: string;
    displayName: string;
    sectionLabel: string;
    value: unknown;
  }> = [];

  const npcEntries = VARIABLE_STRUCTURE_DEFINITIONS.filter(e => e.isNpcTemplate);

  for (const [npcId, npc] of Object.entries(state.人物档案 || {})) {
    const npcName = (npc as NPCData)?.姓名 || npcId;
    for (const entry of npcEntries) {
      const concretePath = entry.canonicalPath.replace('[NPC_ID]', npcId);
      const value = getVariableValue(state, concretePath);
      results.push({
        npcId,
        npcName,
        path: concretePath,
        displayName: entry.displayName,
        sectionLabel: entry.sectionLabel,
        value,
      });
    }
  }

  return results;
}
