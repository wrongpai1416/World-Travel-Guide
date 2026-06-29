// 双层编译格式化器 — 将 NarrativeMemoryRuntime 编译为主AI可消费的上下文文本
// 热态/查询扩展双层架构

import type {
  NarrativeMemoryRuntime,
  NarrativeThread,
  NarrativeEventCard,
  NarrativeEntityCard,
  NarrativeRelationEdge,
  NarrativeRelationNetworkItem,
} from './types';

// ─── 预算配置 ───

export interface CompileBudget {
  /** 热态上下文最大 token 数 */
  hotTokenBudget: number;
  /** 查询扩展上下文最大 token 数 */
  expansionTokenBudget: number;
  /** 事件卡片最大数量 */
  maxEventCards: number;
  /** 实体档案最大数量 */
  maxEntityCards: number;
  /** 关系边最大数量 */
  maxRelationEdges: number;
}

/** 默认预算配置 */
export const DEFAULT_COMPILE_BUDGET: CompileBudget = {
  hotTokenBudget: 800,
  expansionTokenBudget: 600,
  maxEventCards: 8,
  maxEntityCards: 6,
  maxRelationEdges: 10,
};

// ─── 估算 token ───

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 2.5);
}

function trimToTokenBudget(text: string, budget: number): string {
  if (!text || budget <= 0) return '';
  const lines = text.split('\n');
  const result: string[] = [];
  let total = 0;
  for (const line of lines) {
    const lineTokens = estimateTokens(line);
    if (total + lineTokens > budget) break;
    result.push(line);
    total += lineTokens;
  }
  return result.join('\n');
}

// ─── 热态层编译 ───

function compileHotLayer(
  runtime: NarrativeMemoryRuntime,
  budget: CompileBudget,
): string {
  const parts: string[] = [];

  // 场景锚点
  if (runtime.sceneAnchor) {
    const sa = runtime.sceneAnchor;
    parts.push('[当前场景]');
    parts.push(`地点: ${sa.location ?? '未知'}`);
    parts.push(`时间: ${sa.time ?? '未知'}`);
    if (sa.currentGoal) parts.push(`当前目标: ${sa.currentGoal}`);
    if (sa.currentRisk) parts.push(`当前风险: ${sa.currentRisk}`);
    parts.push('');
  }

  // 活跃叙事线索
  const activeThreads = runtime.activeThreads?.filter(
    (t: NarrativeThread) => t.status === 'open' || t.status === 'blocked',
  ) ?? [];
  if (activeThreads.length > 0) {
    parts.push('[活跃叙事线索]');
    for (const thread of activeThreads.slice(0, 5)) {
      const status = thread.status === 'blocked' ? '（阻塞）' : '';
      parts.push(`- ${thread.title}${status}: ${thread.summary ?? ''}`);
    }
    parts.push('');
  }

  // 状态槽
  const stateSlots = runtime.stateSlots ?? [];
  if (stateSlots.length > 0) {
    parts.push('[状态值]');
    for (const slot of stateSlots.slice(0, 8)) {
      parts.push(`- ${slot.scope}/${slot.key}: ${slot.value}`);
    }
    parts.push('');
  }

  return trimToTokenBudget(parts.join('\n'), budget.hotTokenBudget);
}

// ─── 查询扩展层编译 ───

function compileExpansionLayer(
  runtime: NarrativeMemoryRuntime,
  budget: CompileBudget,
): string {
  const parts: string[] = [];

  // 事件卡片（按重要性排序）
  const events = [...(runtime.eventCards ?? [])]
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, budget.maxEventCards);
  if (events.length > 0) {
    parts.push('[近期事件]');
    for (const evt of events) {
      const heat = evt.heat === 'hot' ? '🔥' : evt.heat === 'warm' ? '♨️' : '❄️';
      parts.push(`${heat} ${evt.title}: ${evt.summary ?? ''}`);
    }
    parts.push('');
  }

  // 实体档案
  const entities = (runtime.entityCards ?? []).slice(0, budget.maxEntityCards);
  if (entities.length > 0) {
    parts.push('[角色/实体档案]');
    for (const entity of entities) {
      const status = entity.currentStatus ? ` [${entity.currentStatus}]` : '';
      parts.push(`- ${entity.name}(${entity.type})${status}: ${entity.stableFacts?.slice(0, 3).join('；') ?? ''}`);
    }
    parts.push('');
  }

  // 关系图谱
  const edges = (runtime.relationEdges ?? []).slice(0, budget.maxRelationEdges);
  if (edges.length > 0) {
    parts.push('[关系网络]');
    for (const edge of edges) {
      parts.push(`- ${edge.source} → ${edge.target}: ${edge.relation}(${edge.strength ?? '中'})`);
    }
    parts.push('');
  }

  return trimToTokenBudget(parts.join('\n'), budget.expansionTokenBudget);
}

// ─── 公共 API ───

export interface CompiledContext {
  hotLayer: string;
  expansionLayer: string;
  fullText: string;
}

/**
 * 将 NarrativeMemoryRuntime 编译为主AI可消费的上下文文本
 * 热态层（场景+线索+状态）+ 查询扩展层（事件+实体+关系）
 */
export function compileNarrativeContext(
  runtime: NarrativeMemoryRuntime | null | undefined,
  budget: CompileBudget = DEFAULT_COMPILE_BUDGET,
): CompiledContext {
  if (!runtime) {
    return { hotLayer: '', expansionLayer: '', fullText: '' };
  }

  const hotLayer = compileHotLayer(runtime, budget);
  const expansionLayer = compileExpansionLayer(runtime, budget);

  const fullText = [hotLayer, expansionLayer].filter(Boolean).join('\n');

  return { hotLayer, expansionLayer, fullText };
}
