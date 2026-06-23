// 预设管理 Store — 用户预设持久化 + 激活状态
import { create } from 'zustand';
import { STORAGE_KEYS } from '@/config/storageKeys';
import type { PresetPack } from '@/data/builtinPresets';
import { getBuiltinPreset } from '@/data/builtinPresets';

const PRESETS_KEY = STORAGE_KEYS.PRESET_PACKS;
const ACTIVE_KEY = STORAGE_KEYS.ACTIVE_PRESET_ID;

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

// ─── Store ───

interface PresetStoreState {
  userPresets: PresetPack[];
  activePresetId: string | null; // null = 使用内置默认

  // Actions
  savePreset: (pack: PresetPack) => void;
  deletePreset: (id: string) => void;
  setActivePreset: (id: string | null) => void;
  resetToDefault: () => void;

  // 派生
  getActivePreset: () => PresetPack;
  getUserPresetById: (id: string) => PresetPack | undefined;
}

export const usePresetStore = create<PresetStoreState>((set, get) => ({
  userPresets: loadUserPresets(),
  activePresetId: loadActivePresetId(),

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

  getActivePreset: () => {
    const { userPresets, activePresetId } = get();
    if (activePresetId) {
      const found = userPresets.find(p => p.id === activePresetId);
      if (found) return found;
    }
    return getBuiltinPreset('default');
  },

  getUserPresetById: (id) => {
    return get().userPresets.find(p => p.id === id);
  },
}));
