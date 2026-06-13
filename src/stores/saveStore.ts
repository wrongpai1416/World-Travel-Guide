import { create } from 'zustand';
import type { GameSave, SaveMeta } from '@/storage/db';
import {
  saveGame as saveGameToDb,
  loadGame as loadGameFromDb,
  deleteSave as deleteSaveFromDb,
  getAllSaveMeta,
  saveAllSaveMeta,
  generateSaveId,
  buildPreview,
  exportSave as exportSaveFromDb,
  importSaveFromData,
  migrateOldAutoSave,
  ACTIVE_SAVE_KEY,
} from '@/storage/db';

// ─── Store ───

interface SaveState {
  // 状态
  savesMeta: SaveMeta[];
  currentSaveId: string | null;
  currentSaveName: string;

  // 初始化（加载元数据 + 迁移旧存档）
  initialize: () => Promise<void>;

  // CRUD
  createNewGame: (saveName: string) => Promise<string>;
  loadSave: (saveId: string) => Promise<GameSave | null>;
  deleteSave: (saveId: string) => Promise<void>;
  renameSave: (saveId: string, newName: string) => Promise<void>;
  importSave: (data: any) => Promise<SaveMeta | null>;
  exportSave: (saveId: string) => Promise<Blob>;

  // 保存（写入 DB + 更新元数据）
  performSave: (saveData: GameSave) => Promise<void>;

  // Coalescing save（防并发）
  saveGame: (buildSaveData: () => GameSave | null) => Promise<void>;

  // Debounce 自动存档
  scheduleAutoSave: () => void;
  flushAutoSave: (buildSaveData: () => GameSave | null) => Promise<void>;
}

let _savePromise: Promise<void> | null = null;
let _saveQueued = false;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useSaveStore = create<SaveState>((set, get) => ({
  savesMeta: [],
  currentSaveId: localStorage.getItem(ACTIVE_SAVE_KEY),
  currentSaveName: '',

  initialize: async () => {
    try {
      await migrateOldAutoSave();
      const metas = await getAllSaveMeta();
      set({ savesMeta: metas });
    } catch (err) {
      console.warn('[存档] 初始化失败:', err);
    }
  },

  createNewGame: async (saveName) => {
    const { savesMeta } = get();
    if (savesMeta.some(s => s.name === saveName)) {
      throw new Error('存档名称已存在');
    }

    const saveId = generateSaveId();
    localStorage.setItem(ACTIVE_SAVE_KEY, saveId);
    set({ currentSaveId: saveId, currentSaveName: saveName });

    return saveId;
  },

  loadSave: async (saveId) => {
    try {
      const saveData = await loadGameFromDb(saveId);
      if (!saveData) return null;

      localStorage.setItem(ACTIVE_SAVE_KEY, saveId);
      set({ currentSaveId: saveId, currentSaveName: saveData.name });

      return saveData;
    } catch (err) {
      console.error('[存档] 加载失败:', err);
      return null;
    }
  },

  deleteSave: async (saveId) => {
    await deleteSaveFromDb(saveId);
    const { savesMeta, currentSaveId } = get();
    const updated = savesMeta.filter(s => s.id !== saveId);

    const changes: Partial<SaveState> = { savesMeta: updated };
    if (currentSaveId === saveId) {
      localStorage.removeItem(ACTIVE_SAVE_KEY);
      changes.currentSaveId = null;
      changes.currentSaveName = '';
    }

    set(changes);
    await saveAllSaveMeta(updated);
  },

  renameSave: async (saveId, newName) => {
    const fullSave = await loadGameFromDb(saveId);
    if (!fullSave) return;

    fullSave.name = newName;
    fullSave.timestamp = Date.now();
    await saveGameToDb(fullSave);

    const meta: SaveMeta = {
      id: fullSave.id,
      name: newName,
      timestamp: fullSave.timestamp,
      preview: buildPreview(fullSave),
    };

    const { savesMeta, currentSaveId } = get();
    const updated = savesMeta.map(m => m.id === saveId ? meta : m);

    const changes: Partial<SaveState> = { savesMeta: updated };
    if (currentSaveId === saveId) {
      changes.currentSaveName = newName;
    }

    set(changes);
    await saveAllSaveMeta(updated);
  },

  importSave: async (data) => {
    try {
      const meta = await importSaveFromData(data);
      const metas = await getAllSaveMeta();
      set({ savesMeta: metas });
      return meta;
    } catch (err) {
      console.error('[存档] 导入失败:', err);
      return null;
    }
  },

  exportSave: async (saveId) => {
    return exportSaveFromDb(saveId);
  },

  performSave: async (saveData) => {
    await saveGameToDb(saveData);

    const meta: SaveMeta = {
      id: saveData.id,
      name: saveData.name,
      timestamp: saveData.timestamp,
      preview: buildPreview(saveData),
    };

    const { savesMeta } = get();
    const idx = savesMeta.findIndex(m => m.id === meta.id);
    const updated = idx >= 0
      ? savesMeta.map((m, i) => i === idx ? meta : m)
      : [...savesMeta, meta];

    set({ savesMeta: updated });
    await saveAllSaveMeta(updated);
  },

  saveGame: async (buildSaveData) => {
    if (_savePromise) {
      _saveQueued = true;
      return _savePromise;
    }

    const run = async () => {
      do {
        _saveQueued = false;
        const saveData = buildSaveData();
        if (saveData) {
          await get().performSave(saveData);
        }
      } while (_saveQueued);
    };

    _savePromise = run();
    try {
      await _savePromise;
    } finally {
      _savePromise = null;
    }
  },

  scheduleAutoSave: () => {
    if (_saveTimer) clearTimeout(_saveTimer);
    // debounce 500ms 后通过全局注入的 _autoSaveBuilder 执行保存
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      if (_autoSaveBuilder) {
        get().saveGame(_autoSaveBuilder).catch(err => console.warn('[auto-save] 保存失败:', err));
      }
    }, 500);
  },

  flushAutoSave: async (buildSaveData) => {
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
    }
    await get().saveGame(buildSaveData);
  },
}));

// ─── 自动存档 builder（由 GameContext 注入） ───

let _autoSaveBuilder: (() => GameSave | null) | null = null;

/** 注入自动存档的 buildSaveData 函数（由 GameContext 调用） */
export function setAutoSaveBuilder(builder: () => GameSave | null) {
  _autoSaveBuilder = builder;
}
