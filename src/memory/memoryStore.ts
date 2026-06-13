// ============================================================
// 记忆系统 Zustand Store
// 核心状态管理 + 配置 + 运行态 + 公开 API
// 移植自 yijiekkk useMemorySystem.js → React Zustand
// ============================================================

import { create } from 'zustand';
import type {
  MemorySystemConfig,
  NarrativeMemoryRuntime,
  VectorMemoryItem,
  DebugLog,
  SceneAnchor,
  NarrativeThread,
  NarrativeStateSlot,
  NarrativeRelationEdge,
  NarrativeRelationNetworkItem,
  NarrativeEventCard,
  NarrativeEntityCard,
  NarrativeArchiveCard,
  NarrativeCheckpoint,
  NarrativeMutation,
  SummarySaveRecord,
  CompiledContextSnapshot,
  RuntimeFlowSnapshot,
  RetrievePlanSnapshot,
  CompiledNarrativeContext,
  NarrativeQueryPackage,
  NarrativeRetrieveCandidate,
  VectorFact,
} from './types';
import {
  createDefaultMemorySystemConfig,
  normalizeMemorySystemConfig,
} from './memoryConfig';

// ─── Store 接口 ───

interface MemoryStoreState {
  // 配置
  config: MemorySystemConfig;

  // 运行态
  memoryRuntime: NarrativeMemoryRuntime | null;

  // 向量记忆（独立于运行态）
  vectorMemory: VectorMemoryItem[];

  // 调试日志
  writeDebugLogs: DebugLog[];
  retrieveDebugLogs: DebugLog[];
  compileDebugLogs: DebugLog[];

  // 编译结果缓存
  lastCompiledContext: CompiledContextSnapshot | null;
  lastRuntimeFlow: RuntimeFlowSnapshot | null;
  lastRetrievePlan: RetrievePlanSnapshot | null;

  // UI 状态
  isLoading: boolean;
  loadingStage: string;
  error: string | null;

  // 版本号（用于触发 UI 刷新）
  runtimeVersion: number;
}

interface MemoryStoreActions {
  // 配置
  setConfig: (config: Partial<MemorySystemConfig>) => void;
  resetConfig: () => void;

  // 运行态管理
  initMemoryRuntime: (bankId?: string) => void;
  getMemoryRuntime: () => NarrativeMemoryRuntime;
  resetMemoryRuntime: () => void;
  bumpRuntimeVersion: () => void;

  // 场景锚点
  updateSceneAnchor: (patch: Partial<SceneAnchor>) => void;

  // 线程管理
  upsertThread: (thread: NarrativeThread) => void;
  removeThread: (id: string) => void;

  // 状态槽管理
  upsertStateSlot: (slot: NarrativeStateSlot) => void;
  removeStateSlot: (id: string) => void;

  // 关系边管理
  upsertRelationEdge: (edge: NarrativeRelationEdge) => void;

  // 关系网管理
  upsertRelationNetworkItem: (item: NarrativeRelationNetworkItem) => void;

  // 事件卡管理
  upsertEventCard: (card: NarrativeEventCard) => void;

  // 实体档案管理
  upsertEntityCard: (card: NarrativeEntityCard) => void;

  // 归档卡管理
  upsertArchiveCard: (card: NarrativeArchiveCard) => void;

  // 向量记忆管理
  setVectorMemory: (memories: VectorMemoryItem[]) => void;
  appendVectorMemories: (memories: VectorMemoryItem[]) => void;
  clearVectorMemory: () => void;

  // Checkpoint
  createCheckpoint: () => NarrativeCheckpoint | null;
  restoreCheckpoint: (checkpointId: string) => boolean;

  // Mutation 日志
  appendMutation: (mutation: NarrativeMutation) => void;

  // 摘要历史
  appendSummarySaveRecord: (record: SummarySaveRecord) => void;

  // 编译结果缓存
  setCompiledContext: (snapshot: CompiledContextSnapshot | null) => void;
  setRuntimeFlow: (snapshot: RuntimeFlowSnapshot | null) => void;
  setRetrievePlan: (plan: RetrievePlanSnapshot | null) => void;

  // 调试日志
  appendWriteDebugLog: (log: DebugLog) => void;
  appendRetrieveDebugLog: (log: DebugLog) => void;
  appendCompileDebugLog: (log: DebugLog) => void;
  clearDebugLogs: () => void;

  // Loading 状态
  setLoading: (loading: boolean, stage?: string) => void;
  setError: (error: string | null) => void;

  // 序列化（用于存档）
  toJSON: () => { memoryRuntime: NarrativeMemoryRuntime | null; vectorMemory: VectorMemoryItem[]; config: MemorySystemConfig };
  fromJSON: (data: { memoryRuntime?: unknown; vectorMemory?: unknown[]; config?: unknown }) => void;
}

// ─── 默认运行态 ───

function createDefaultMemoryRuntime(bankId = ''): NarrativeMemoryRuntime {
  return {
    version: 'compiled_context_v2',
    bankId,
    lastIngestCursor: 0,
    lastIngestAttemptAt: 0,
    lastIngestSuccessAt: 0,
    lastIngestFailure: null,
    lastRebuildAt: 0,
    entityCanonicalVersion: 2,
    sceneAnchor: null,
    activeThreads: [],
    stateSlots: [],
    relationEdges: [],
    relationNetwork: [],
    eventCards: [],
    entityCards: [],
    archiveCards: [],
    mutationLog: [],
    checkpoints: [],
    lastCompiledContext: null,
    lastRuntimeFlow: null,
    lastSummarySave: null,
    summarySaveHistory: [],
    lastRetrievePlan: null,
    writeDebugLogs: [],
    retrieveDebugLogs: [],
    compileDebugLogs: [],
    vectorMemory: [],
  };
}

// ─── 运行态归一化 ───

function normalizeMemoryRuntime(raw: unknown): NarrativeMemoryRuntime {
  const defaults = createDefaultMemoryRuntime();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;

  const safe = raw as Record<string, unknown>;
  const normalizeArray = (val: unknown): unknown[] => Array.isArray(val) ? val : [];

  return {
    ...defaults,
    ...safe,
    version: typeof safe.version === 'string' ? safe.version : defaults.version,
    bankId: typeof safe.bankId === 'string' ? safe.bankId : defaults.bankId,
    lastIngestCursor: Math.max(0, Math.floor(Number(safe.lastIngestCursor) || 0)),
    lastIngestAttemptAt: Math.max(0, Math.floor(Number(safe.lastIngestAttemptAt) || 0)),
    lastIngestSuccessAt: Math.max(0, Math.floor(Number(safe.lastIngestSuccessAt) || 0)),
    lastIngestFailure: safe.lastIngestFailure && typeof safe.lastIngestFailure === 'object'
      ? safe.lastIngestFailure as NarrativeMemoryRuntime['lastIngestFailure']
      : null,
    sceneAnchor: safe.sceneAnchor && typeof safe.sceneAnchor === 'object'
      ? safe.sceneAnchor as SceneAnchor
      : null,
    activeThreads: normalizeArray(safe.activeThreads) as NarrativeThread[],
    stateSlots: normalizeArray(safe.stateSlots) as NarrativeStateSlot[],
    relationEdges: normalizeArray(safe.relationEdges) as NarrativeRelationEdge[],
    relationNetwork: normalizeArray(safe.relationNetwork) as NarrativeRelationNetworkItem[],
    eventCards: normalizeArray(safe.eventCards) as NarrativeEventCard[],
    entityCards: normalizeArray(safe.entityCards) as NarrativeEntityCard[],
    archiveCards: normalizeArray(safe.archiveCards) as NarrativeArchiveCard[],
    mutationLog: normalizeArray(safe.mutationLog) as NarrativeMutation[],
    checkpoints: normalizeArray(safe.checkpoints) as NarrativeCheckpoint[],
    summarySaveHistory: normalizeArray(safe.summarySaveHistory) as SummarySaveRecord[],
    lastSummarySave: safe.lastSummarySave && typeof safe.lastSummarySave === 'object'
      ? safe.lastSummarySave as SummarySaveRecord
      : null,
    lastCompiledContext: safe.lastCompiledContext && typeof safe.lastCompiledContext === 'object'
      ? safe.lastCompiledContext as CompiledContextSnapshot
      : null,
    lastRuntimeFlow: safe.lastRuntimeFlow && typeof safe.lastRuntimeFlow === 'object'
      ? safe.lastRuntimeFlow as RuntimeFlowSnapshot
      : null,
    lastRetrievePlan: safe.lastRetrievePlan && typeof safe.lastRetrievePlan === 'object'
      ? safe.lastRetrievePlan as RetrievePlanSnapshot
      : null,
    writeDebugLogs: normalizeArray(safe.writeDebugLogs) as DebugLog[],
    retrieveDebugLogs: normalizeArray(safe.retrieveDebugLogs) as DebugLog[],
    compileDebugLogs: normalizeArray(safe.compileDebugLogs) as DebugLog[],
    vectorMemory: normalizeArray(safe.vectorMemory) as VectorMemoryItem[],
  };
}

// ─── Zustand Store ───

export const useMemoryStore = create<MemoryStoreState & MemoryStoreActions>()((set, get) => ({
  // 初始状态
  config: createDefaultMemorySystemConfig(),
  memoryRuntime: null,
  vectorMemory: [],
  writeDebugLogs: [],
  retrieveDebugLogs: [],
  compileDebugLogs: [],
  lastCompiledContext: null,
  lastRuntimeFlow: null,
  lastRetrievePlan: null,
  isLoading: false,
  loadingStage: '',
  error: null,
  runtimeVersion: 0,

  // ─── 配置 ───

  setConfig: (patch) => {
    set((state) => ({
      config: normalizeMemorySystemConfig({ ...state.config, ...patch }),
    }));
  },

  resetConfig: () => {
    set({ config: createDefaultMemorySystemConfig() });
  },

  // ─── 运行态管理 ───

  initMemoryRuntime: (bankId = '') => {
    // 始终创建新的运行时，防止跨存档污染
    set({
      memoryRuntime: createDefaultMemoryRuntime(bankId),
      vectorMemory: [],
      lastCompiledContext: null,
      lastRuntimeFlow: null,
      lastRetrievePlan: null,
      writeDebugLogs: [],
      retrieveDebugLogs: [],
      compileDebugLogs: [],
      runtimeVersion: 0,
    });
  },

  getMemoryRuntime: () => {
    const state = get();
    if (!state.memoryRuntime) {
      const runtime = createDefaultMemoryRuntime();
      set({ memoryRuntime: runtime });
      return runtime;
    }
    return state.memoryRuntime;
  },

  resetMemoryRuntime: () => {
    set({
      memoryRuntime: null,
      vectorMemory: [],
      lastCompiledContext: null,
      lastRuntimeFlow: null,
      lastRetrievePlan: null,
      writeDebugLogs: [],
      retrieveDebugLogs: [],
      compileDebugLogs: [],
      isLoading: false,
      loadingStage: '',
      error: null,
      runtimeVersion: 0,
    });
  },

  bumpRuntimeVersion: () => {
    set((state) => ({
      runtimeVersion: state.runtimeVersion + 1,
      // 创建新引用，确保 Zustand 检测到变化并触发 React 刷新
      memoryRuntime: state.memoryRuntime ? { ...state.memoryRuntime } : null,
    }));
  },

  // ─── 场景锚点 ───

  updateSceneAnchor: (patch) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const existing = state.memoryRuntime.sceneAnchor;
      return {
        memoryRuntime: {
          ...state.memoryRuntime,
          sceneAnchor: {
            timeLabel: '',
            locationLabel: '',
            presentEntities: [],
            immediateGoal: '',
            immediateRisk: '',
            conversationFocus: '',
            recentChange: '',
            confidence: 0.5,
            ...existing,
            ...patch,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  // ─── 线程管理 ───

  upsertThread: (thread) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const threads = [...state.memoryRuntime.activeThreads];
      const idx = threads.findIndex(t => t.id === thread.id);
      if (idx >= 0) {
        threads[idx] = { ...threads[idx], ...thread, updatedAt: Date.now() };
      } else {
        threads.push({ ...thread, createdAt: thread.createdAt || Date.now(), updatedAt: Date.now() });
      }
      return { memoryRuntime: { ...state.memoryRuntime, activeThreads: threads } };
    });
  },

  removeThread: (id) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      return {
        memoryRuntime: {
          ...state.memoryRuntime,
          activeThreads: state.memoryRuntime.activeThreads.filter(t => t.id !== id),
        },
      };
    });
  },

  // ─── 状态槽管理 ───

  upsertStateSlot: (slot) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const slots = [...state.memoryRuntime.stateSlots];
      const idx = slots.findIndex(s => s.id === slot.id);
      if (idx >= 0) {
        slots[idx] = { ...slots[idx], ...slot, updatedAt: Date.now() };
      } else {
        slots.push({ ...slot, createdAt: slot.createdAt || Date.now(), updatedAt: Date.now() });
      }
      return { memoryRuntime: { ...state.memoryRuntime, stateSlots: slots } };
    });
  },

  removeStateSlot: (id) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      return {
        memoryRuntime: {
          ...state.memoryRuntime,
          stateSlots: state.memoryRuntime.stateSlots.filter(s => s.id !== id),
        },
      };
    });
  },

  // ─── 关系边管理 ───

  upsertRelationEdge: (edge) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const edges = [...state.memoryRuntime.relationEdges];
      const idx = edges.findIndex(e => e.id === edge.id);
      if (idx >= 0) {
        edges[idx] = { ...edges[idx], ...edge, updatedAt: Date.now() };
      } else {
        edges.push({ ...edge, createdAt: edge.createdAt || Date.now(), updatedAt: Date.now() });
      }
      return { memoryRuntime: { ...state.memoryRuntime, relationEdges: edges } };
    });
  },

  // ─── 关系网管理 ───

  upsertRelationNetworkItem: (item) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const network = [...state.memoryRuntime.relationNetwork];
      const idx = network.findIndex(n => n.id === item.id);
      if (idx >= 0) {
        network[idx] = { ...network[idx], ...item, updatedAt: Date.now() };
      } else {
        network.push({ ...item, createdAt: item.createdAt || Date.now(), updatedAt: Date.now() });
      }
      return { memoryRuntime: { ...state.memoryRuntime, relationNetwork: network } };
    });
  },

  // ─── 事件卡管理 ───

  upsertEventCard: (card) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const cards = [...state.memoryRuntime.eventCards];
      const idx = cards.findIndex(c => c.id === card.id);
      if (idx >= 0) {
        cards[idx] = { ...cards[idx], ...card, updatedAt: Date.now() };
      } else {
        cards.push({ ...card, createdAt: card.createdAt || Date.now(), updatedAt: Date.now() });
      }
      return { memoryRuntime: { ...state.memoryRuntime, eventCards: cards } };
    });
  },

  // ─── 实体档案管理 ───

  upsertEntityCard: (card) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const cards = [...state.memoryRuntime.entityCards];
      const idx = cards.findIndex(c => c.id === card.id);
      if (idx >= 0) {
        cards[idx] = { ...cards[idx], ...card, updatedAt: Date.now() };
      } else {
        cards.push({ ...card, createdAt: card.createdAt || Date.now(), updatedAt: Date.now() });
      }
      return { memoryRuntime: { ...state.memoryRuntime, entityCards: cards } };
    });
  },

  // ─── 归档卡管理 ───

  upsertArchiveCard: (card) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const cards = [...state.memoryRuntime.archiveCards];
      const idx = cards.findIndex(c => c.id === card.id);
      if (idx >= 0) {
        cards[idx] = { ...cards[idx], ...card };
      } else {
        cards.push({ ...card, createdAt: card.createdAt || Date.now(), archivedAt: Date.now() });
      }
      return { memoryRuntime: { ...state.memoryRuntime, archiveCards: cards } };
    });
  },

  // ─── 向量记忆管理 ───

  setVectorMemory: (memories) => {
    set({ vectorMemory: memories });
  },

  appendVectorMemories: (memories) => {
    set((state) => ({
      vectorMemory: [...state.vectorMemory, ...memories],
    }));
  },

  clearVectorMemory: () => {
    set({ vectorMemory: [] });
  },

  // ─── Checkpoint ───

  createCheckpoint: () => {
    const state = get();
    if (!state.memoryRuntime) return null;

    const checkpoint: NarrativeCheckpoint = {
      id: `cp_${Date.now()}`,
      createdAt: Date.now(),
      lastIngestCursor: state.memoryRuntime.lastIngestCursor,
      activeThreadCount: state.memoryRuntime.activeThreads.length,
      eventCount: state.memoryRuntime.eventCards.length,
      entityCount: state.memoryRuntime.entityCards.length,
      snapshot: JSON.parse(JSON.stringify(state.memoryRuntime)),
    };

    set((s) => {
      if (!s.memoryRuntime) return s;
      const checkpoints = [...s.memoryRuntime.checkpoints, checkpoint];
      return { memoryRuntime: { ...s.memoryRuntime, checkpoints } };
    });

    return checkpoint;
  },

  restoreCheckpoint: (checkpointId) => {
    const state = get();
    if (!state.memoryRuntime) return false;

    const checkpoint = state.memoryRuntime.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint?.snapshot) return false;

    const restored = normalizeMemoryRuntime(checkpoint.snapshot);
    restored.checkpoints = state.memoryRuntime.checkpoints;

    set({ memoryRuntime: restored, runtimeVersion: state.runtimeVersion + 1 });
    return true;
  },

  // ─── Mutation 日志 ───

  appendMutation: (mutation) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const mutationLog = [...state.memoryRuntime.mutationLog, { ...mutation, createdAt: mutation.createdAt || Date.now() }];
      return { memoryRuntime: { ...state.memoryRuntime, mutationLog } };
    });
  },

  // ─── 摘要历史 ───

  appendSummarySaveRecord: (record) => {
    set((state) => {
      if (!state.memoryRuntime) return state;
      const summarySaveHistory = [...state.memoryRuntime.summarySaveHistory, record];
      return {
        memoryRuntime: {
          ...state.memoryRuntime,
          summarySaveHistory,
          lastSummarySave: record,
        },
      };
    });
  },

  // ─── 编译结果缓存 ───

  setCompiledContext: (snapshot) => {
    set((state) => ({
      lastCompiledContext: snapshot,
      memoryRuntime: state.memoryRuntime
        ? { ...state.memoryRuntime, lastCompiledContext: snapshot }
        : null,
    }));
  },

  setRuntimeFlow: (snapshot) => {
    set((state) => ({
      lastRuntimeFlow: snapshot,
      memoryRuntime: state.memoryRuntime
        ? { ...state.memoryRuntime, lastRuntimeFlow: snapshot }
        : null,
    }));
  },

  setRetrievePlan: (plan) => {
    set((state) => ({
      lastRetrievePlan: plan,
      memoryRuntime: state.memoryRuntime
        ? { ...state.memoryRuntime, lastRetrievePlan: plan }
        : null,
    }));
  },

  // ─── 调试日志 ───

  appendWriteDebugLog: (log) => {
    set((state) => {
      const maxLogs = state.config.debug.maxLogs;
      const logs = [...state.writeDebugLogs, { ...log, timestamp: log.timestamp || Date.now() }];
      return {
        writeDebugLogs: logs.length > maxLogs ? logs.slice(-maxLogs) : logs,
        memoryRuntime: state.memoryRuntime ? {
          ...state.memoryRuntime,
          writeDebugLogs: logs.length > maxLogs ? logs.slice(-maxLogs) : logs,
        } : null,
      };
    });
  },

  appendRetrieveDebugLog: (log) => {
    set((state) => {
      const maxLogs = state.config.debug.maxLogs;
      const logs = [...state.retrieveDebugLogs, { ...log, timestamp: log.timestamp || Date.now() }];
      return {
        retrieveDebugLogs: logs.length > maxLogs ? logs.slice(-maxLogs) : logs,
        memoryRuntime: state.memoryRuntime ? {
          ...state.memoryRuntime,
          retrieveDebugLogs: logs.length > maxLogs ? logs.slice(-maxLogs) : logs,
        } : null,
      };
    });
  },

  appendCompileDebugLog: (log) => {
    set((state) => {
      const maxLogs = state.config.debug.maxLogs;
      const logs = [...state.compileDebugLogs, { ...log, timestamp: log.timestamp || Date.now() }];
      return {
        compileDebugLogs: logs.length > maxLogs ? logs.slice(-maxLogs) : logs,
        memoryRuntime: state.memoryRuntime ? {
          ...state.memoryRuntime,
          compileDebugLogs: logs.length > maxLogs ? logs.slice(-maxLogs) : logs,
        } : null,
      };
    });
  },

  clearDebugLogs: () => {
    set((state) => ({
      writeDebugLogs: [],
      retrieveDebugLogs: [],
      compileDebugLogs: [],
      memoryRuntime: state.memoryRuntime ? {
        ...state.memoryRuntime,
        writeDebugLogs: [],
        retrieveDebugLogs: [],
        compileDebugLogs: [],
      } : null,
    }));
  },

  // ─── Loading 状态 ───

  setLoading: (loading, stage = '') => {
    set({ isLoading: loading, loadingStage: stage });
  },

  setError: (error) => {
    set({ error });
  },

  // ─── 序列化 ───

  toJSON: () => {
    const state = get();
    return {
      memoryRuntime: state.memoryRuntime,
      vectorMemory: state.vectorMemory,
      config: state.config,
    };
  },

  fromJSON: (data) => {
    const config = data.config
      ? normalizeMemorySystemConfig(data.config)
      : createDefaultMemorySystemConfig();

    const memoryRuntime = data.memoryRuntime
      ? normalizeMemoryRuntime(data.memoryRuntime)
      : null;

    const vectorMemory = Array.isArray(data.vectorMemory)
      ? data.vectorMemory as VectorMemoryItem[]
      : [];

    set({ config, memoryRuntime, vectorMemory });
  },
}));
