// 记忆 Zustand Store — 最小 stub（v1.2 替换为完整实现）
import { create } from 'zustand';

interface MemoryStoreState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export const useMemoryStore = create<MemoryStoreState>((set) => ({
  enabled: false,
  setEnabled: (v) => set({ enabled: v }),
}));

export function slimMemoryRuntimeForSave(runtime: any): any {
  if (!runtime || typeof runtime !== 'object') return runtime;
  return { ...runtime, writeDebugLogs: [], retrieveDebugLogs: [], compileDebugLogs: [] };
}
