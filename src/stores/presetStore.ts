// 预设管理 Store — 用户预设持久化 + 激活状态
import { create } from 'zustand';
import { STORAGE_KEYS } from '@/config/storageKeys';
import type { PresetPack } from '@/data/builtinPresets';
import { getBuiltinPreset } from '@/data/builtinPresets';

const PRESETS_KEY = STORAGE_KEYS.PRESET_PACKS;
const ACTIVE_KEY = STORAGE_KEYS.ACTIVE_PRESET_ID;
const OVERRIDES_KEY = 'world_travel_guide_builtin_overrides';

// ─── 持久化读取 ───

function loadUserPresets(): PresetPack[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('[presetStore] loadPresets 解析失败:', e);
    return [];
  }
}

function loadActivePresetId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY) || null;
  } catch (e) {
    console.warn('[presetStore] loadActivePresetId 失败:', e);
    return null;
  }
}

/** 内置预设覆盖层：保存用户对内置预设条目的开关状态 */
type BuiltinOverrides = Record<string, Record<string, boolean>>; // presetId -> { identifier -> enabled }

function loadBuiltinOverrides(): BuiltinOverrides {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** 将覆盖层应用到内置预设 */
export function applyOverrides(preset: PresetPack, overrides: BuiltinOverrides): PresetPack {
  const presetOverrides = overrides[preset.id];
  if (!presetOverrides || !preset.builtin) return preset;
  return {
    ...preset,
    prompts: preset.prompts.map(p =>
      p.identifier in presetOverrides ? { ...p, enabled: presetOverrides[p.identifier] } : p
    ),
  };
}

// ─── Store ───

interface PresetStoreState {
  userPresets: PresetPack[];
  activePresetId: string | null; // null = 使用内置默认
  builtinOverrides: BuiltinOverrides;

  // Actions
  savePreset: (pack: PresetPack) => void;
  deletePreset: (id: string) => void;
  setActivePreset: (id: string | null) => void;
  resetToDefault: () => void;
  /** 保存内置预设条目的开关覆盖 */
  saveBuiltinOverride: (presetId: string, identifier: string, enabled: boolean) => void;
  /** 恢复内置预设默认值（清除覆盖） */
  restoreBuiltinDefaults: (presetId: string) => void;

  // 派生
  getActivePreset: () => PresetPack;
  getUserPresetById: (id: string) => PresetPack | undefined;
}

export const usePresetStore = create<PresetStoreState>((set, get) => ({
  userPresets: loadUserPresets(),
  activePresetId: loadActivePresetId(),
  builtinOverrides: loadBuiltinOverrides(),

  savePreset: (pack) => {
    set((state) => {
      const existing = state.userPresets.findIndex(p => p.id === pack.id);
      let updated: PresetPack[];
      if (existing >= 0) {
        updated = [...state.userPresets];
        updated[existing] = pack;
      } else {
        updated = [...state.userPresets, pack];
      }
      localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
      return { userPresets: updated };
    });
  },

  deletePreset: (id) => {
    set((state) => {
      const updated = state.userPresets.filter(p => p.id !== id);
      localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
      const newActive = state.activePresetId === id ? null : state.activePresetId;
      if (newActive === null) localStorage.removeItem(ACTIVE_KEY);
      return { userPresets: updated, activePresetId: newActive };
    });
  },

  setActivePreset: (id) => {
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
    set({ activePresetId: id });
  },

  resetToDefault: () => {
    localStorage.removeItem(ACTIVE_KEY);
    set({ activePresetId: null });
  },

  saveBuiltinOverride: (presetId, identifier, enabled) => {
    set((state) => {
      const current = state.builtinOverrides[presetId] || {};
      const updated = {
        ...state.builtinOverrides,
        [presetId]: { ...current, [identifier]: enabled },
      };
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(updated));
      return { builtinOverrides: updated };
    });
  },

  restoreBuiltinDefaults: (presetId) => {
    set((state) => {
      const updated = { ...state.builtinOverrides };
      delete updated[presetId];
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(updated));
      return { builtinOverrides: updated };
    });
  },

  getActivePreset: () => {
    const { userPresets, activePresetId, builtinOverrides } = get();
    if (activePresetId) {
      const found = userPresets.find(p => p.id === activePresetId);
      if (found) return found;
      // 尝试作为内置预设加载（带覆盖层）
      const builtin = getBuiltinPreset(activePresetId);
      return applyOverrides(builtin, builtinOverrides);
    }
    return applyOverrides(getBuiltinPreset('default'), builtinOverrides);
  },

  getUserPresetById: (id) => {
    return get().userPresets.find(p => p.id === id);
  },
}));
