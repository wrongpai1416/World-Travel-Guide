import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { ChatMessage } from '../../engine/types';

// ── 内存存储（模拟 IndexedDB 的 global / saves store）──
const mockStores = {
  global: new Map<string, any>(),
  saves: new Map<string, any>(),
};

// ── mock idb（用内存 Map 代替真实 IndexedDB）──
mock.module('idb', () => ({
  openDB: async () => ({
    get: async (store: string, key: string) => {
      if (store === 'global') return mockStores.global.get(key);
      if (store === 'saves') return mockStores.saves.get(key);
      return undefined;
    },
    put: async (store: string, obj: any) => {
      if (store === 'global') mockStores.global.set(obj.key, obj);
      else if (store === 'saves') mockStores.saves.set(obj.id, obj);
    },
    delete: async (store: string, key: string) => {
      if (store === 'global') mockStores.global.delete(key);
      if (store === 'saves') mockStores.saves.delete(key);
    },
    objectStoreNames: { contains: () => true },
    createObjectStore: () => ({ createIndex: () => {} }),
  }),
}));

// ── mock @/config/storageKeys ──
mock.module('@/config/storageKeys', () => ({
  STORAGE_KEYS: {
    ACTIVE_SAVE: 'active_save',
    CUSTOM_WORLDS: 'world_travel_guide_custom_worlds',
  },
}));

// ── mock @/memory/memoryStore ──
mock.module('@/memory/memoryStore', () => ({
  slimMemoryRuntimeForSave: (data: unknown) => data,
  useMemoryStore: { getState: () => ({}) },
}));

// 在 mock 之后导入
import {
  optimizeSnapshots,
  generateSaveId,
  buildPreview,
  invalidateSaveMetaCache,
  importSaveFromData,
  type GameSave,
} from '../../storage/db';

// 辅助：创建带 snapshot 的消息
function makeMsg(id: string, hasSnapshot = true): ChatMessage {
  return {
    id,
    role: 'assistant',
    rawText: `message-${id}`,
    round: 0,
    timestamp: Date.now(),
    ...(hasSnapshot ? { snapshot: { state: id }, snapshotTime: Date.now() } : {}),
  };
}

// 辅助：创建存档数据
function makeSaveData(overrides: Partial<GameSave> = {}): GameSave {
  return {
    id: 'test_save',
    name: '测试存档',
    timestamp: Date.now(),
    messages: [],
    gameState: { 世界: {} as any, 玩家: {} as any, 人物档案: {} },
    worldId: 'default',
    ...overrides,
  };
}

// 辅助：创建导入数据
function makeImportData(name: string, id?: string) {
  return {
    type: 'chuanyue-save',
    version: '2.0',
    save: {
      id: id || `save_${Date.now()}`,
      name,
      timestamp: Date.now(),
      messages: [{ id: 'm1', role: 'user' as const, rawText: 'test', round: 0, timestamp: Date.now() }],
      gameState: { 世界: {} as any, 玩家: {} as any, 人物档案: {} },
      worldId: 'default',
    },
  };
}

describe('db', () => {
  // ── optimizeSnapshots ──

  describe('optimizeSnapshots', () => {
    it('空数组返回空数组', () => {
      expect(optimizeSnapshots([])).toEqual([]);
    });

    it('null 返回 null', () => {
      expect(optimizeSnapshots(null as any)).toBeNull();
    });

    it('无 snapshot 的消息原样返回', () => {
      const msgs = [makeMsg('1', false), makeMsg('2', false)];
      const result = optimizeSnapshots(msgs);
      expect(result).toHaveLength(2);
      expect(result[0].snapshot).toBeUndefined();
      expect(result[1].snapshot).toBeUndefined();
    });

    it('< 10 条消息：全部保留 snapshot', () => {
      const msgs = Array.from({ length: 5 }, (_, i) => makeMsg(`m${i}`));
      const result = optimizeSnapshots(msgs);
      result.forEach(msg => {
        expect(msg.snapshot).toBeDefined();
      });
    });

    it('= 10 条消息：全部保留 snapshot（都在最后 10 条范围内）', () => {
      const msgs = Array.from({ length: 10 }, (_, i) => makeMsg(`m${i}`));
      const result = optimizeSnapshots(msgs);
      result.forEach(msg => {
        expect(msg.snapshot).toBeDefined();
      });
    });

    it('> 10 条消息：第一个有 snapshot 的始终保留', () => {
      const msgs = Array.from({ length: 15 }, (_, i) => makeMsg(`m${i}`));
      const result = optimizeSnapshots(msgs);
      // 第 0 条是第一个有 snapshot 的
      expect(result[0].snapshot).toBeDefined();
    });

    it('> 10 条消息：最后 10 条保留 snapshot', () => {
      const msgs = Array.from({ length: 20 }, (_, i) => makeMsg(`m${i}`));
      const result = optimizeSnapshots(msgs);
      // 最后 10 条：index 10-19
      for (let i = 10; i < 20; i++) {
        expect(result[i].snapshot).toBeDefined();
      }
    });

    it('> 10 条消息：非关键帧非近期的 snapshot 被清除', () => {
      const msgs = Array.from({ length: 25 }, (_, i) => makeMsg(`m${i}`));
      const result = optimizeSnapshots(msgs);
      // index 1-14 中，非关键帧（i%10!==0）且非近期（i<15）的 snapshot 应被清除
      // index 1: 1%10=1≠0, 1<15 → 清除
      // index 10: 10%10=0 → 关键帧，保留
      // index 11-14: 非关键帧，非近期 → 清除
      expect(result[1].snapshot).toBeUndefined();
      expect(result[10].snapshot).toBeDefined(); // 关键帧
      expect(result[11].snapshot).toBeUndefined();
      expect(result[14].snapshot).toBeUndefined();
    });

    it('关键帧（i%10===0）保留 snapshot', () => {
      const msgs = Array.from({ length: 30 }, (_, i) => makeMsg(`m${i}`));
      const result = optimizeSnapshots(msgs);
      // index 0: 第一个 → 保留
      // index 10: 关键帧 → 保留
      // index 20: 关键帧 + 近期 → 保留
      expect(result[0].snapshot).toBeDefined();
      expect(result[10].snapshot).toBeDefined();
      expect(result[20].snapshot).toBeDefined();
    });

    it('snapshotTime 随 snapshot 一起被清除', () => {
      const msgs = Array.from({ length: 25 }, (_, i) => makeMsg(`m${i}`));
      const result = optimizeSnapshots(msgs);
      // index 1 的 snapshot 和 snapshotTime 都应被清除
      expect(result[1].snapshot).toBeUndefined();
      expect(result[1].snapshotTime).toBeUndefined();
    });

    it('清除 snapshot 后其他字段保留', () => {
      const msgs = Array.from({ length: 25 }, (_, i) => makeMsg(`m${i}`));
      const result = optimizeSnapshots(msgs);
      // index 1 的 snapshot 被清除，但 id, role, rawText 等保留
      expect(result[1].id).toBe('m1');
      expect(result[1].role).toBe('assistant');
      expect(result[1].rawText).toBe('message-m1');
    });

    it('第一条无 snapshot 的消息不影响 firstSnapshotFound 逻辑', () => {
      const msgs = [
        makeMsg('m0', false), // 无 snapshot
        makeMsg('m1'),        // 第一个有 snapshot 的
        ...Array.from({ length: 20 }, (_, i) => makeMsg(`m${i + 2}`)),
      ];
      const result = optimizeSnapshots(msgs);
      // m1 是第一个有 snapshot 的，应保留
      expect(result[1].snapshot).toBeDefined();
    });
  });

  // ── generateSaveId ──

  describe('generateSaveId', () => {
    it('生成以 save_ 开头的 ID', () => {
      const id = generateSaveId();
      expect(id.startsWith('save_')).toBe(true);
    });

    it('包含时间戳', () => {
      const before = Date.now();
      const id = generateSaveId();
      const after = Date.now();
      // 提取时间戳部分
      const match = id.match(/^save_(\d+)_/);
      expect(match).not.toBeNull();
      const ts = parseInt(match![1], 10);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('每次调用生成不同的 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSaveId());
      }
      expect(ids.size).toBe(100);
    });
  });

  // ── buildPreview ──

  describe('buildPreview', () => {
    it('有角色名和世界名时组合显示', () => {
      const save = makeSaveData({
        personalInfo: { name: '勇者' } as any,
        worldId: 'cyberpunk_city',
      });
      expect(buildPreview(save)).toBe('勇者 · 赛博朋克');
    });

    it('只有角色名时只显示角色名', () => {
      const save = makeSaveData({
        personalInfo: { name: '勇者' } as any,
        worldId: 'default',
      });
      expect(buildPreview(save)).toBe('勇者');
    });

    it('无角色名无世界名时返回默认文本', () => {
      const save = makeSaveData();
      expect(buildPreview(save)).toBe('世界漫游');
    });

    it('内置世界 ID 映射为中文名', () => {
      const save = makeSaveData({
        personalInfo: { name: '英雄' } as any,
        worldId: 'wuxia_world',
      });
      expect(buildPreview(save)).toBe('英雄 · 武侠江湖');
    });

    it('未知世界 ID 使用原始 ID', () => {
      const save = makeSaveData({
        personalInfo: { name: '英雄' } as any,
        worldId: 'unknown_world',
      });
      expect(buildPreview(save)).toBe('英雄 · unknown_world');
    });
  });

  // ── invalidateSaveMetaCache ──

  describe('invalidateSaveMetaCache', () => {
    it('调用不崩溃', () => {
      expect(() => invalidateSaveMetaCache()).not.toThrow();
    });
  });

  // ── importSaveFromData（间接测试 getUniqueImportName）──

  describe('importSaveFromData（间接测试 getUniqueImportName）', () => {
    beforeEach(() => {
      mockStores.global.clear();
      mockStores.saves.clear();
      invalidateSaveMetaCache();
    });

    it('无冲突时使用原始名称', async () => {
      const data = makeImportData('新存档');
      const meta = await importSaveFromData(data);
      expect(meta.name).toBe('新存档');
    });

    it('有冲突时追加（导入）后缀', async () => {
      // 第一次导入
      const data1 = makeImportData('冲突存档', 'save_1');
      await importSaveFromData(data1);
      // 第二次导入同名
      invalidateSaveMetaCache(); // 刷新缓存
      const data2 = makeImportData('冲突存档', 'save_2');
      const meta2 = await importSaveFromData(data2);
      expect(meta2.name).toBe('冲突存档（导入）');
    });

    it('多次冲突递增后缀', async () => {
      await importSaveFromData(makeImportData('多次冲突', 's1'));
      invalidateSaveMetaCache();
      await importSaveFromData(makeImportData('多次冲突', 's2'));
      invalidateSaveMetaCache();
      const meta3 = await importSaveFromData(makeImportData('多次冲突', 's3'));
      expect(meta3.name).toBe('多次冲突（导入2）');
    });

    it('无效数据格式抛出错误', async () => {
      await expect(importSaveFromData(null)).rejects.toThrow();
      await expect(importSaveFromData({})).rejects.toThrow();
      await expect(importSaveFromData({ save: {} })).rejects.toThrow();
    });

    it('生成新 ID 避免冲突', async () => {
      const data1 = makeImportData('ID测试', 'same_id');
      const meta1 = await importSaveFromData(data1);
      expect(meta1.id).toBe('same_id');

      invalidateSaveMetaCache();
      const data2 = makeImportData('ID测试2', 'same_id');
      const meta2 = await importSaveFromData(data2);
      // 第二次使用相同 ID 时应生成新 ID
      expect(meta2.id).not.toBe('same_id');
    });

    it('返回的 meta 包含 preview', async () => {
      const data = makeImportData('预览测试');
      const meta = await importSaveFromData(data);
      expect(meta.preview).toBeDefined();
      expect(typeof meta.preview).toBe('string');
    });
  });
});
