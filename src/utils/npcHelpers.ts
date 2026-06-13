// NPC 管理工具
import type { GameState, NPCData } from '../schema/variables';
import * as _ from 'lodash-es';

// ─── 常量 ───────────────────────────────────────────

export const NPC_CATEGORY_DEFAULT = '在场' as const;
export const NPC_CATEGORY_VALUES = new Set(['在场', '离场', '重点'] as const);

const NPC_CREATION_HINT_KEYS = new Set([
  '姓名', 'name', '性别', 'gender', '年龄', 'age', '种族', 'race',
  '职业', 'job', '等级', 'level', '好感度', 'favor', '关系类型', 'relationshipType',
  '外貌', 'appearance', '穿着', 'clothing', '性格', 'personality',
  '表性格', 'surfacePersonality', '里性格', 'hiddenPersonality',
  '社会身份', 'socialIdentity', '所属势力', 'faction', '社会地位', 'socialStatus',
  '当前位置', 'currentLocation', '当前状态', 'status',
  '特殊能力', 'specialAbility', '背景', 'background',
]);

// ─── NPC 分类管理 ─────────────────────────────────────

export function normalizeNpcCategoryValue(value: unknown): '在场' | '离场' | '重点' {
  const raw = String(value ?? '').trim();
  if (NPC_CATEGORY_VALUES.has(raw as any)) return raw as any;
  return NPC_CATEGORY_DEFAULT;
}

export function getNpcCategoryValue(npc: Record<string, unknown> | NPCData | undefined | null): string {
  if (!npc || typeof npc !== 'object') return NPC_CATEGORY_DEFAULT;
  return normalizeNpcCategoryValue(
    (npc as any).人物分类 ??
    (npc as any).在场状态 ??
    (npc as any).登场状态 ??
    (npc as any).category ??
    (npc as any).presenceState
  );
}

export function ensureNpcCategoryDefaults(state: GameState): void {
  const npcs = state.人物档案;
  if (!npcs || typeof npcs !== 'object') return;
  for (const npc of Object.values(npcs)) {
    if (!npc || typeof npc !== 'object') continue;
    const next = getNpcCategoryValue(npc);
    if ((npc as any).人物分类 !== next) {
      (npc as any).人物分类 = next;
    }
  }
}

// ─── NPC 标识解析 ─────────────────────────────────────

export function normalizeNpcIdentifierText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/（已离场）$/, '')
    .trim();
}

export function getNpcDisplayName(npc: Record<string, unknown> | NPCData | undefined | null, fallbackId = ''): string {
  return normalizeNpcIdentifierText((npc as any)?.姓名 ?? (npc as any)?.name ?? fallbackId);
}

export interface NpcResolution {
  ok: boolean;
  npcId?: string;
  matchedBy?: 'id' | 'name';
  reason?: 'empty' | 'not_found' | 'ambiguous';
  rawIdentifier: string;
  normalizedIdentifier: string;
  matchedIds: string[];
}

export function resolveNpcId(npcIdentifier: unknown, state: GameState): NpcResolution {
  const rawIdentifier = String(npcIdentifier ?? '').trim();
  const normalizedIdentifier = normalizeNpcIdentifierText(rawIdentifier);
  const npcMap = state.人物档案 ?? {};

  if (!normalizedIdentifier) {
    return { ok: false, reason: 'empty', rawIdentifier, normalizedIdentifier, matchedIds: [] };
  }

  // 1. 精确 ID 匹配
  if (Object.prototype.hasOwnProperty.call(npcMap, rawIdentifier)) {
    return { ok: true, npcId: rawIdentifier, matchedBy: 'id', rawIdentifier, normalizedIdentifier, matchedIds: [rawIdentifier] };
  }

  // 2. 标准化 ID 匹配
  if (normalizedIdentifier !== rawIdentifier && Object.prototype.hasOwnProperty.call(npcMap, normalizedIdentifier)) {
    return { ok: true, npcId: normalizedIdentifier, matchedBy: 'id', rawIdentifier, normalizedIdentifier, matchedIds: [normalizedIdentifier] };
  }

  // 3. 按姓名匹配
  const matchedIds = Object.entries(npcMap)
    .filter(([id, npc]) => getNpcDisplayName(npc, id) === normalizedIdentifier)
    .map(([id]) => id);

  if (matchedIds.length === 1) {
    return { ok: true, npcId: matchedIds[0], matchedBy: 'name', rawIdentifier, normalizedIdentifier, matchedIds };
  }

  return {
    ok: false,
    reason: matchedIds.length > 1 ? 'ambiguous' : 'not_found',
    rawIdentifier, normalizedIdentifier, matchedIds,
  };
}

export function warnIgnoredNpcPatchUpdate(sourceLabel: string, npcIdentifier: unknown, resolution: NpcResolution): void {
  const identifierLabel = normalizeNpcIdentifierText(npcIdentifier) || String(npcIdentifier ?? '').trim() || '空标识';
  if (resolution.reason === 'ambiguous') {
    console.warn(`[VariableSystem] 已忽略${sourceLabel}中的 NPC 更新：标识"${identifierLabel}"命中多个现有 NPC。`, resolution.matchedIds);
    return;
  }
  console.warn(`[VariableSystem] 已忽略${sourceLabel}中的 NPC 更新：标识"${identifierLabel}"未唯一命中现有 NPC。`);
}

// ─── NPC 事迹管理 ─────────────────────────────────────

export function normalizeNpcChronicles(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/\r?\n|[|｜]/).map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function isSameChronicleList(left: unknown, right: unknown): boolean {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  if (a.length !== b.length) return false;
  return a.every((item, i) => item === b[i]);
}

export function ensureNpcChronicleDefaults(state: GameState): void {
  const npcs = state.人物档案;
  if (!npcs || typeof npcs !== 'object') return;
  for (const npc of Object.values(npcs)) {
    if (!npc || typeof npc !== 'object') continue;
    const normalized = normalizeNpcChronicles(
      (npc as any).人物事迹 ?? (npc as any).characterDeeds ?? (npc as any).deeds ?? (npc as any).经历列表
    );
    if (!isSameChronicleList((npc as any).人物事迹, normalized)) {
      (npc as any).人物事迹 = normalized;
    }
  }
}

// ─── NPC 结构默认值 ───────────────────────────────────

export function ensureNpcStructureDefaults(state: GameState): void {
  const npcs = state.人物档案;
  if (!npcs || typeof npcs !== 'object') return;

  for (const npc of Object.values(npcs)) {
    if (!npc || typeof npc !== 'object') continue;
    const n = npc as any;

    // 基础字段默认值
    if (n.年龄 === undefined) n.年龄 = '';
    if (n.背景 === undefined) n.背景 = '';
    if (n.性格 === undefined) n.性格 = '';
    if (n.穿着 === undefined) n.穿着 = '';
    if (n.外貌 === undefined && n.个人信息) n.外貌 = n.个人信息.外貌 ?? '';
    if (n.当前行动 === undefined) n.当前行动 = '';
    if (n.短期目标 === undefined) n.短期目标 = '';
    if (n.长期目标 === undefined) n.长期目标 = '';
    if (n.内心想法 === undefined) n.内心想法 = '';
    if (n.种族描述 === undefined) n.种族描述 = '';
    if (n.种族效果 === undefined) n.种族效果 = '';
    if (n.种族特性 === undefined) n.种族特性 = [];
    if (n.属性 === undefined) n.属性 = {};
    if (n.天赋 === undefined) n.天赋 = [];
    if (n.技能列表 === undefined) n.技能列表 = [];
    if (n.物品列表 === undefined) n.物品列表 = [];
    if (n.装备列表 === undefined) n.装备列表 = {};

    // 嵌套对象默认值（AI 创建 NPC 时可能缺失）
    if (!n.生存状态 || typeof n.生存状态 !== 'object') {
      n.生存状态 = { 血量: 100, 体力值: 100 };
    }
    if (!n.社会身份 || typeof n.社会身份 !== 'object') {
      n.社会身份 = { 职业: '', 所属势力: '', 社会地位: '' };
    }
    if (!n.关系数据 || typeof n.关系数据 !== 'object') {
      n.关系数据 = { 好感度: 0, 信任度: 0, 关系类型: '陌生人', 印象标签: [], 核心锚点: [] };
    } else {
      if (!Array.isArray(n.关系数据.印象标签)) n.关系数据.印象标签 = [];
      if (!Array.isArray(n.关系数据.核心锚点)) n.关系数据.核心锚点 = [];
      if (typeof n.关系数据.好感度 !== 'number') n.关系数据.好感度 = 0;
      if (typeof n.关系数据.信任度 !== 'number') n.关系数据.信任度 = 0;
    }
    if (!n.个人信息 || typeof n.个人信息 !== 'object') {
      n.个人信息 = {
        价值观: { 喜好: [], 厌恶: [], 雷区: '' },
        执念与目标: '', 心理创伤: '', 外貌: '', 表性格: '', 里性格: '',
        当前想法: '', 特殊能力: '', 当前穿着: '', 当前位置: '', 当前状态: '',
        持有物品: '', 过往经历: [], 备注: '',
      };
    } else {
      if (!Array.isArray(n.个人信息.过往经历)) n.个人信息.过往经历 = [];
    }
    if (!n.交互记忆 || typeof n.交互记忆 !== 'object') {
      n.交互记忆 = { 未完成约定: [], 共同秘密: [], 赠礼记录: [] };
    } else {
      if (!Array.isArray(n.交互记忆.未完成约定)) n.交互记忆.未完成约定 = [];
      if (!Array.isArray(n.交互记忆.共同秘密)) n.交互记忆.共同秘密 = [];
      if (!Array.isArray(n.交互记忆.赠礼记录)) n.交互记忆.赠礼记录 = [];
    }
    if (!Array.isArray(n.近期事件)) n.近期事件 = [];
    if (!Array.isArray(n.重要经历)) n.重要经历 = [];
    if (n.重要NPC === undefined) n.重要NPC = false;
    if (n.婚姻状态 === undefined) n.婚姻状态 = '';
    if (n.联系方式 === undefined) n.联系方式 = '';
  }
}

// ─── NPC 创建检测 ─────────────────────────────────────

export function countNpcCreationHintFields(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  let count = 0;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (NPC_CREATION_HINT_KEYS.has(key)) count++;
  }
  return count;
}

export function isNpcCreationPayload(value: unknown): boolean {
  return countNpcCreationHintFields(value) >= 2;
}

export function canCreateNpcFromPatch(pathParts: string[], op: string, value: unknown): boolean {
  return (
    Array.isArray(pathParts) &&
    pathParts[0] === '人物档案' &&
    pathParts.length === 2 &&
    ['add', 'replace'].includes(String(op ?? '').toLowerCase()) &&
    isNpcCreationPayload(value)
  );
}

export function getCreatableNpcIdentifier(identifier: unknown): string {
  return normalizeNpcIdentifierText(identifier) || String(identifier ?? '').trim();
}

// ─── 安全快照 ─────────────────────────────────────────

export function createPromptSafeNpcSnapshot(npc: NPCData | Record<string, unknown> | null | undefined, npcId = ''): Record<string, unknown> {
  if (!npc || typeof npc !== 'object') {
    return {
      姓名: normalizeNpcIdentifierText(npcId) || '未知NPC',
      人物分类: '离场',
      人物事迹: [],
    };
  }

  const category = getNpcCategoryValue(npc);
  const rawName = getNpcDisplayName(npc, npcId) || '未知NPC';

  const snapshot = _.cloneDeep(npc) as any;
  snapshot.姓名 = rawName;
  if (snapshot.name !== undefined) snapshot.name = rawName;
  snapshot.人物分类 = category;
  snapshot.人物事迹 = normalizeNpcChronicles(
    snapshot.人物事迹 ?? snapshot.characterDeeds ?? snapshot.deeds ?? snapshot.经历列表
  );
  return snapshot;
}

