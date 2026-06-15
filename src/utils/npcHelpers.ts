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

    // 基础字段默认值 — 缺失时填有意义的值而非空字符串
    if (n.年龄 === undefined) n.年龄 = '';
    if (n.背景 === undefined) n.背景 = '未知';
    if (n.性格 === undefined) n.性格 = '未知';
    if (n.穿着 === undefined) n.穿着 = '未知';
    if (n.外貌 === undefined && n.个人信息) n.外貌 = n.个人信息.外貌 ?? '未知';
    if (n.当前行动 === undefined) n.当前行动 = '未知';
    if (n.短期目标 === undefined) n.短期目标 = '未知';
    if (n.长期目标 === undefined) n.长期目标 = '未知';
    if (n.内心想法 === undefined) n.内心想法 = '暂无';
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
      n.社会身份 = { 职业: '未知', 社会地位: '普通' };
    } else {
      if (n.社会身份.职业 === undefined || n.社会身份.职业 === '') n.社会身份.职业 = '未知';
      if (n.社会身份.社会地位 === undefined || n.社会身份.社会地位 === '') n.社会身份.社会地位 = '普通';
    }
    if (!n.关系数据 || typeof n.关系数据 !== 'object') {
      n.关系数据 = { 好感度: 0, 关系类型: '陌生人', 印象标签: [], 核心锚点: [] };
    } else {
      if (!Array.isArray(n.关系数据.印象标签)) n.关系数据.印象标签 = [];
      if (!Array.isArray(n.关系数据.核心锚点)) n.关系数据.核心锚点 = [];
      if (typeof n.关系数据.好感度 !== 'number') n.关系数据.好感度 = 0;
    }
    if (!n.个人信息 || typeof n.个人信息 !== 'object') {
      n.个人信息 = {
        外貌: '未知', 表性格: '未知', 里性格: '未知',
        当前想法: '暂无', 当前穿着: '未知', 当前位置: '未知', 当前状态: '未知',
        备注: '',
      };
    } else {
      if (n.个人信息.外貌 === '') n.个人信息.外貌 = '未知';
      if (n.个人信息.表性格 === '') n.个人信息.表性格 = '未知';
      if (n.个人信息.里性格 === '') n.个人信息.里性格 = '未知';
      if (n.个人信息.当前想法 === '') n.个人信息.当前想法 = '暂无';
      if (n.个人信息.当前状态 === '') n.个人信息.当前状态 = '未知';
      if (n.个人信息.当前穿着 === '') n.个人信息.当前穿着 = '未知';
      if (n.个人信息.当前位置 === '') n.个人信息.当前位置 = '未知';
    }
    if (!n.交互记忆 || typeof n.交互记忆 !== 'object') {
      n.交互记忆 = { 未完成约定: [], 共同秘密: [], 赠礼记录: [] };
    } else {
      if (!Array.isArray(n.交互记忆.未完成约定)) n.交互记忆.未完成约定 = [];
      if (!Array.isArray(n.交互记忆.共同秘密)) n.交互记忆.共同秘密 = [];
      if (!Array.isArray(n.交互记忆.赠礼记录)) n.交互记忆.赠礼记录 = [];
    }
    if (!Array.isArray(n.重要经历)) n.重要经历 = [];
    if (n.重要NPC === undefined) n.重要NPC = false;
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
  const chronicles = normalizeNpcChronicles(
    (npc as any).人物事迹 ?? (npc as any).characterDeeds ?? (npc as any).deeds ?? (npc as any).经历列表
  );

  // 离场 NPC 精简快照：只保留姓名、分类、最近3条事迹、位置
  if (category === '离场') {
    return {
      姓名: rawName,
      人物分类: '离场',
      人物事迹: chronicles.slice(-3),
      个人信息: { 当前位置: (npc as any).个人信息?.当前位置 ?? '未知' },
    };
  }

  // 在场/重点 NPC 完整快照
  const snapshot = _.cloneDeep(npc) as any;
  snapshot.姓名 = rawName;
  if (snapshot.name !== undefined) snapshot.name = rawName;
  snapshot.人物分类 = category;
  snapshot.人物事迹 = chronicles;
  return snapshot;
}

// ─── 主 AI 紧凑快照 ─────────────────────────────────

/** 截断文本到指定长度 */
function truncate(text: unknown, maxLen: number): string {
  const s = String(text ?? '').trim();
  if (!s || s === '未知' || s === '无' || s === '暂无') return '';
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

/** 格式化单个 NPC 为紧凑文本 */
function formatNpcCompact(npc: Record<string, unknown>, npcId: string): string {
  const n = npc as any;
  const name = String(n.姓名 ?? npcId).trim() || npcId;
  const category = String(n.人物分类 ?? '在场').trim();
  const gender = String(n.性别 ?? '').trim();
  const race = String(n.种族 ?? '').trim();
  const age = n.年龄 ?? '';
  const sj = n.社会身份 ?? {};
  const job = String(sj.职业 ?? '').trim() || '未知';
  const rd = n.关系数据 ?? {};
  const favor = rd.好感度 ?? '';
  const relationType = String(rd.关系类型 ?? '').trim();
  const pi = n.个人信息 ?? {};
  const ext = n;

  // 头部行
  const headerParts = [`[NPC] ${name}`];
  if (gender) headerParts.push(gender);
  if (race) headerParts.push(race);
  if (age !== '' && age !== undefined) headerParts.push(`${age}岁`);
  headerParts.push(`职业:${job}`);
  if (category !== '在场') headerParts.push(`[${category}]`);

  const lines = [headerParts.join(' | ')];

  // 关系
  const relationParts = [];
  if (favor !== '' && favor !== undefined) relationParts.push(`好感度:${favor}`);
  if (relationType) relationParts.push(`关系:${relationType}`);
  if (relationParts.length > 0) lines.push(`> 关系: ${relationParts.join(', ')}`);

  // 外貌与性格
  const appearance = truncate(pi.外貌 ?? ext.外貌, 40);
  const personality = truncate(pi.表性格 ?? ext.性格, 20);
  const hiddenPersonality = truncate(pi.里性格, 20);
  const clothing = truncate(pi.当前穿着 ?? ext.穿着, 24);
  if (appearance || personality || clothing) {
    const parts = [];
    if (appearance) parts.push(`外貌:${appearance}`);
    if (personality) parts.push(`性格:${personality}`);
    if (hiddenPersonality) parts.push(`里性格:${hiddenPersonality}`);
    if (clothing) parts.push(`穿着:${clothing}`);
    lines.push(`> 描写: ${parts.join(' | ')}`);
  }

  // 当前状态
  const location = truncate(pi.当前位置 ?? ext.当前位置, 20);
  const status = truncate(pi.当前状态, 20);
  const action = truncate(ext.当前行动, 30);
  const thoughts = truncate(pi.当前想法 ?? ext.内心想法, 50);
  const stateParts = [];
  if (location) stateParts.push(`位置:${location}`);
  if (status) stateParts.push(`状态:${status}`);
  if (action) stateParts.push(`行动:${action}`);
  if (stateParts.length > 0) lines.push(`> 当前: ${stateParts.join(', ')}`);
  if (thoughts) lines.push(`> 想法: ${thoughts}`);

  // 目标
  const shortGoal = truncate(ext.短期目标, 30);
  const longGoal = truncate(ext.长期目标, 30);
  if (shortGoal || longGoal) {
    const parts = [];
    if (shortGoal) parts.push(`短期:${shortGoal}`);
    if (longGoal) parts.push(`长期:${longGoal}`);
    lines.push(`> 目标: ${parts.join(' | ')}`);
  }

  // 事迹（最近5条）
  const chronicles = normalizeNpcChronicles(n.人物事迹 ?? n.characterDeeds ?? n.deeds);
  if (chronicles.length > 0) {
    const recent = chronicles.slice(-5);
    const chronicleText = recent.map((c, i) => `${i + 1}.${truncate(c, 36)}`).join(' | ');
    lines.push(`> 事迹: ${chronicleText}`);
  }

  return lines.join('\n');
}

/** 格式化离场 NPC 为精简文本 */
function formatDepartedNpcCompact(npc: Record<string, unknown>, npcId: string): string {
  const n = npc as any;
  const name = String(n.姓名 ?? npcId).trim() || npcId;
  const chronicles = normalizeNpcChronicles(n.人物事迹 ?? n.characterDeeds ?? n.deeds);
  const recent = chronicles.slice(-3);

  let line = `> ${name}`;
  if (recent.length > 0) {
    line += ` — 最近: ${recent.map(c => truncate(c, 28)).join('; ')}`;
  }
  return line;
}

/**
 * 将 GameState 格式化为主 AI 可读的紧凑文本快照
 * 只提取叙事需要的字段，避免浪费 token
 */
export function formatSnapshotForMainAI(state: GameState): string {
  const lines: string[] = [];

  // 世界状态
  const world = state.世界 ?? ({} as any);
  const time = world.时间系统?.当前时间 ?? '';
  const weather = world.时间系统?.当前天气 ?? '';
  const location = world.空间定位?.当前位置 ?? '';
  if (time || location || weather) {
    lines.push(`### 【世界状态】`);
    const parts = [];
    if (time) parts.push(`时间:${time}`);
    if (location) parts.push(`地点:${location}`);
    if (weather) parts.push(`天气:${weather}`);
    lines.push(`> ${parts.join(' | ')}`);
  }

  // 玩家状态
  const player = state.玩家 ?? ({} as any);
  const playerName = player.姓名 ?? (player as any).name ?? '';
  const playerLocation = player.当前位置 ?? '';
  const playerGoal = player.当前目标 ?? '';
  if (playerName || playerLocation || playerGoal) {
    lines.push(`### 【玩家】`);
    if (playerName) lines.push(`> 姓名: ${playerName}`);
    if (playerLocation) lines.push(`> 位置: ${playerLocation}`);
    if (playerGoal) lines.push(`> 目标: ${playerGoal}`);
  }

  // 人物档案
  const npcs = state.人物档案 ?? {};
  const npcEntries = Object.entries(npcs);
  if (npcEntries.length > 0) {
    const presentNpcs: [string, Record<string, unknown>][] = [];
    const departedNpcs: [string, Record<string, unknown>][] = [];

    for (const [id, npc] of npcEntries) {
      if (!npc || typeof npc !== 'object') continue;
      const category = getNpcCategoryValue(npc);
      if (category === '离场') {
        departedNpcs.push([id, npc as unknown as Record<string, unknown>]);
      } else {
        presentNpcs.push([id, npc as unknown as Record<string, unknown>]);
      }
    }

    if (presentNpcs.length > 0) {
      lines.push(`### 【在场人物】`);
      for (const [id, npc] of presentNpcs) {
        lines.push(formatNpcCompact(npc, id));
      }
    }

    if (departedNpcs.length > 0) {
      lines.push(`### 【离场人物】`);
      lines.push('> 以下人物已不在当前场景中，如需重新引入，先将人物分类设为"在场"');
      for (const [id, npc] of departedNpcs) {
        lines.push(formatDepartedNpcCompact(npc, id));
      }
    }
  }

  return lines.join('\n');
}

