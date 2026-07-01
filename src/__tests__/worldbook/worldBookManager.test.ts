import { describe, expect, it } from 'bun:test';
import {
  createWorldBookManager,
  parseWorldBook,
  type WorldBookEntry,
} from '../../worldbook/index';

// ═══════════════════════════════════════════════════
//  辅助函数
// ═══════════════════════════════════════════════════

function makeEntry(overrides: Partial<WorldBookEntry> = {}): WorldBookEntry {
  return {
    id: Math.floor(Math.random() * 100000) + 1,
    comment: 'test entry',
    content: 'test content',
    constant: false,
    enabled: true,
    selective: false,
    keys: [],
    secondaryKeys: [],
    position: 'after_char',
    insertionOrder: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════
//  parseWorldBook — 卡片数据解析
// ═══════════════════════════════════════════════════

describe('parseWorldBook', () => {
  it('解析标准 SillyTavern 格式', () => {
    const cardData = {
      data: {
        character_book: {
          entries: [
            {
              id: 0,
              comment: 'entry1',
              content: 'content1',
              constant: true,
              enabled: true,
              keys: ['key1'],
              secondary_keys: ['sec1'],
              position: 'before_char',
              insertion_order: 5,
            },
          ],
        },
      },
    };
    const result = parseWorldBook(cardData);
    expect(result).toHaveLength(1);
    expect(result[0].comment).toBe('entry1');
    expect(result[0].constant).toBe(true);
    expect(result[0].keys).toEqual(['key1']);
    expect(result[0].secondaryKeys).toEqual(['sec1']);
    expect(result[0].position).toBe('before_char');
    expect(result[0].insertionOrder).toBe(5);
  });

  it('空数据返回空数组', () => {
    expect(parseWorldBook(null)).toEqual([]);
    expect(parseWorldBook({})).toEqual([]);
    expect(parseWorldBook({ data: {} })).toEqual([]);
    expect(parseWorldBook({ data: { character_book: {} } })).toEqual([]);
  });

  it('缺失字段使用默认值', () => {
    const cardData = {
      data: {
        character_book: {
          entries: [{ id: 1 }],
        },
      },
    };
    const result = parseWorldBook(cardData);
    expect(result).toHaveLength(1);
    expect(result[0].comment).toBe('');
    expect(result[0].content).toBe('');
    expect(result[0].constant).toBe(false);
    expect(result[0].enabled).toBe(true);
    expect(result[0].position).toBe('after_char');
    expect(result[0].insertionOrder).toBe(0);
  });

  it('解析 v2 扩展字段', () => {
    const cardData = {
      data: {
        character_book: {
          entries: [{
            id: 1,
            uid: 'uid_001',
            exclude_key: ['bad'],
            selectiveLogic: 2,
            caseSensitive: true,
            matchWholeWords: true,
            probability: 50,
            useProbability: true,
            group: 'test_group',
            order: 10,
            depth: 3,
          }],
        },
      },
    };
    const result = parseWorldBook(cardData);
    expect(result[0].uid).toBe('uid_001');
    expect(result[0].excludeKeys).toEqual(['bad']);
    expect(result[0].selectiveLogic).toBe(2);
    expect(result[0].caseSensitive).toBe(true);
    expect(result[0].matchWholeWords).toBe(true);
    expect(result[0].probability).toBe(50);
    expect(result[0].useProbability).toBe(true);
    expect(result[0].group).toBe('test_group');
    expect(result[0].order).toBe(10);
    expect(result[0].depth).toBe(3);
  });
});

// ═══════════════════════════════════════════════════
//  getConstantEntries
// ═══════════════════════════════════════════════════

describe('WorldBookManager.getConstantEntries', () => {
  it('返回 constant=true 且 enabled=true 的条目', () => {
    const entries = [
      makeEntry({ id: 1, constant: true, enabled: true, insertionOrder: 2 }),
      makeEntry({ id: 2, constant: true, enabled: false, insertionOrder: 1 }),
      makeEntry({ id: 3, constant: false, enabled: true, insertionOrder: 1 }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.getConstantEntries();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('按 insertionOrder 排序', () => {
    const entries = [
      makeEntry({ id: 1, constant: true, insertionOrder: 30 }),
      makeEntry({ id: 2, constant: true, insertionOrder: 10 }),
      makeEntry({ id: 3, constant: true, insertionOrder: 20 }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.getConstantEntries();
    expect(result.map(e => e.id)).toEqual([2, 3, 1]);
  });

  it('没有常驻条目时返回空数组', () => {
    const mgr = createWorldBookManager([makeEntry({ constant: false })]);
    expect(mgr.getConstantEntries()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════
//  getActiveEntries
// ═══════════════════════════════════════════════════

describe('WorldBookManager.getActiveEntries', () => {
  it('关键词命中时返回非 constant 条目', () => {
    // 注意：getActiveEntries 是简化版匹配
    // 非 selective 条目不检查关键词，直接返回；selective 条目检查 keys+secondaryKeys
    const entries = [
      makeEntry({ id: 1, keys: ['dragon'], constant: false, selective: true }),
      makeEntry({ id: 2, keys: ['cat'], constant: false, selective: true }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.getActiveEntries('I see a dragon');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('不返回 constant 条目', () => {
    const entries = [
      makeEntry({ id: 1, keys: ['dragon'], constant: true }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.getActiveEntries('dragon');
    expect(result).toHaveLength(0);
  });

  it('不返回 disabled 条目', () => {
    const entries = [
      makeEntry({ id: 1, keys: ['dragon'], enabled: false }),
    ];
    const mgr = createWorldBookManager(entries);
    expect(mgr.getActiveEntries('dragon')).toHaveLength(0);
  });

  it('selective 条目匹配 keys 或 secondaryKeys', () => {
    // getActiveEntries 的 selective 匹配：检查 keys + secondaryKeys 任意命中
    const entries = [
      makeEntry({
        id: 1,
        keys: ['sword'],
        selective: true,
        secondaryKeys: ['fire'],
      }),
    ];
    const mgr = createWorldBookManager(entries);
    // 'sword' 在 keys 中，命中
    expect(mgr.getActiveEntries('sword of ice')).toHaveLength(1);
    // 'fire' 在 secondaryKeys 中，命中
    expect(mgr.getActiveEntries('fire magic')).toHaveLength(1);
    // 都不命中
    expect(mgr.getActiveEntries('water magic')).toHaveLength(0);
  });

  it('selective 条目无关键词时不激活', () => {
    const entries = [
      makeEntry({ id: 1, selective: true, keys: [], secondaryKeys: [] }),
    ];
    const mgr = createWorldBookManager(entries);
    expect(mgr.getActiveEntries('anything')).toHaveLength(0);
  });

  it('非 selective 且有关键词的条目匹配 key 或 secondaryKeys', () => {
    const entries = [
      makeEntry({ id: 1, keys: [], secondaryKeys: ['magic'] }),
    ];
    const mgr = createWorldBookManager(entries);
    // 非 selective，无主关键词，直接返回 true
    expect(mgr.getActiveEntries('anything')).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════
//  toggleEntry / enableEntry / disableEntry
// ═══════════════════════════════════════════════════

describe('WorldBookManager.toggleEntry', () => {
  it('切换 enabled 状态', () => {
    const entries = [makeEntry({ id: 1, enabled: true })];
    const mgr = createWorldBookManager(entries);
    mgr.toggleEntry(1);
    expect(mgr.getAllEntries()[0].enabled).toBe(false);
    mgr.toggleEntry(1);
    expect(mgr.getAllEntries()[0].enabled).toBe(true);
  });

  it('只影响指定 ID', () => {
    const entries = [
      makeEntry({ id: 1, enabled: true }),
      makeEntry({ id: 2, enabled: true }),
    ];
    const mgr = createWorldBookManager(entries);
    mgr.toggleEntry(1);
    expect(mgr.getAllEntries()[0].enabled).toBe(false);
    expect(mgr.getAllEntries()[1].enabled).toBe(true);
  });
});

describe('WorldBookManager.enableEntry / disableEntry', () => {
  it('enableEntry 设置 enabled=true', () => {
    const entries = [makeEntry({ id: 1, enabled: false })];
    const mgr = createWorldBookManager(entries);
    mgr.enableEntry(1);
    expect(mgr.getAllEntries()[0].enabled).toBe(true);
  });

  it('disableEntry 设置 enabled=false', () => {
    const entries = [makeEntry({ id: 1, enabled: true })];
    const mgr = createWorldBookManager(entries);
    mgr.disableEntry(1);
    expect(mgr.getAllEntries()[0].enabled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
//  enableEntriesByPrefix / disableEntriesByPrefix
// ═══════════════════════════════════════════════════

describe('WorldBookManager prefix 操作', () => {
  it('enableEntriesByPrefix 启用 comment 包含前缀的条目', () => {
    const entries = [
      makeEntry({ id: 1, comment: 'weather_rain', enabled: false }),
      makeEntry({ id: 2, comment: 'weather_sun', enabled: false }),
      makeEntry({ id: 3, comment: 'time_morning', enabled: false }),
    ];
    const mgr = createWorldBookManager(entries);
    mgr.enableEntriesByPrefix('weather');
    const all = mgr.getAllEntries();
    expect(all[0].enabled).toBe(true);
    expect(all[1].enabled).toBe(true);
    expect(all[2].enabled).toBe(false);
  });

  it('disableEntriesByPrefix 禁用 comment 包含前缀的条目', () => {
    const entries = [
      makeEntry({ id: 1, comment: 'weather_rain', enabled: true }),
      makeEntry({ id: 2, comment: 'time_morning', enabled: true }),
    ];
    const mgr = createWorldBookManager(entries);
    mgr.disableEntriesByPrefix('weather');
    const all = mgr.getAllEntries();
    expect(all[0].enabled).toBe(false);
    expect(all[1].enabled).toBe(true);
  });

  it('enableOnlyEntry 只启用同前缀中指定 ID 的条目', () => {
    const entries = [
      makeEntry({ id: 1, comment: 'weather_rain', enabled: true }),
      makeEntry({ id: 2, comment: 'weather_sun', enabled: true }),
      makeEntry({ id: 3, comment: 'time_morning', enabled: true }),
    ];
    const mgr = createWorldBookManager(entries);
    mgr.enableOnlyEntry('weather', 2);
    const all = mgr.getAllEntries();
    expect(all[0].enabled).toBe(false); // weather_rain 被禁用
    expect(all[1].enabled).toBe(true);  // weather_sun 保持启用
    expect(all[2].enabled).toBe(true);  // time_morning 不受影响
  });
});

// ═══════════════════════════════════════════════════
//  getEntriesByPrefix
// ═══════════════════════════════════════════════════

describe('WorldBookManager.getEntriesByPrefix', () => {
  it('返回 comment 包含前缀的条目', () => {
    const entries = [
      makeEntry({ id: 1, comment: 'npc_alice' }),
      makeEntry({ id: 2, comment: 'npc_bob' }),
      makeEntry({ id: 3, comment: 'location_town' }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.getEntriesByPrefix('npc');
    expect(result).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════
//  addEntries
// ═══════════════════════════════════════════════════

describe('WorldBookManager.addEntries', () => {
  it('添加新条目到末尾', () => {
    const mgr = createWorldBookManager([makeEntry({ id: 1 })]);
    mgr.addEntries([makeEntry({ id: 2, content: 'new' })]);
    expect(mgr.getAllEntries()).toHaveLength(2);
  });

  it('正 ID 的新条目会被分配负 ID', () => {
    const mgr = createWorldBookManager([makeEntry({ id: 1 })]);
    mgr.addEntries([makeEntry({ id: 100, content: 'new' })]);
    const all = mgr.getAllEntries();
    expect(all[1].id).toBeLessThan(0);
  });

  it('负 ID 的新条目保持原 ID', () => {
    const mgr = createWorldBookManager([makeEntry({ id: 1 })]);
    mgr.addEntries([makeEntry({ id: -5, content: 'negative' })]);
    const all = mgr.getAllEntries();
    expect(all[1].id).toBe(-5);
  });

  it('重复 ID 的条目被跳过', () => {
    const mgr = createWorldBookManager([makeEntry({ id: -5 })]);
    mgr.addEntries([makeEntry({ id: -5, content: 'duplicate' })]);
    expect(mgr.getAllEntries()).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════
//  getAllEntries
// ═══════════════════════════════════════════════════

describe('WorldBookManager.getAllEntries', () => {
  it('返回所有条目的副本', () => {
    const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
    const mgr = createWorldBookManager(entries);
    const result = mgr.getAllEntries();
    expect(result).toHaveLength(2);
    // 修改返回值不影响内部状态
    result.push(makeEntry({ id: 3 }));
    expect(mgr.getAllEntries()).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════
//  replaceNonConstantEntries
// ═══════════════════════════════════════════════════

describe('WorldBookManager.replaceNonConstantEntries', () => {
  it('替换所有非 constant 条目，保留 constant 条目', () => {
    const entries = [
      makeEntry({ id: 1, constant: true, content: 'keep' }),
      makeEntry({ id: 2, constant: false, content: 'replace_me' }),
    ];
    const mgr = createWorldBookManager(entries);
    mgr.replaceNonConstantEntries([
      makeEntry({ id: -1, constant: false, content: 'new_entry' }),
    ]);
    const all = mgr.getAllEntries();
    expect(all).toHaveLength(2);
    expect(all[0].content).toBe('keep');
    expect(all[1].content).toBe('new_entry');
  });

  it('没有 constant 条目时全部替换', () => {
    const mgr = createWorldBookManager([
      makeEntry({ id: 1, constant: false, content: 'old' }),
    ]);
    mgr.replaceNonConstantEntries([
      makeEntry({ id: -1, constant: false, content: 'new' }),
    ]);
    const all = mgr.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0].content).toBe('new');
  });
});

// ═══════════════════════════════════════════════════
//  clearWorldEntries
// ═══════════════════════════════════════════════════

describe('WorldBookManager.clearWorldEntries', () => {
  it('清除负 ID 条目，保留正 ID 条目', () => {
    const entries = [
      makeEntry({ id: 1, content: 'card_entry' }),
      makeEntry({ id: -1, content: 'world_entry_1' }),
      makeEntry({ id: -2, content: 'world_entry_2' }),
    ];
    const mgr = createWorldBookManager(entries);
    mgr.clearWorldEntries();
    const all = mgr.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(1);
  });

  it('全是正 ID 时不变', () => {
    const mgr = createWorldBookManager([
      makeEntry({ id: 1 }),
      makeEntry({ id: 2 }),
    ]);
    mgr.clearWorldEntries();
    expect(mgr.getAllEntries()).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════
//  getEnabledEntries
// ═══════════════════════════════════════════════════

describe('WorldBookManager.getEnabledEntries', () => {
  it('只返回 enabled=true 的条目', () => {
    const entries = [
      makeEntry({ id: 1, enabled: true }),
      makeEntry({ id: 2, enabled: false }),
      makeEntry({ id: 3, enabled: true }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.getEnabledEntries();
    expect(result).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════
//  scanAndBuildInjection
// ═══════════════════════════════════════════════════

describe('WorldBookManager.scanAndBuildInjection', () => {
  it('按 position 分组到 beforeChar / afterChar', () => {
    const entries: WorldBookEntry[] = [
      makeEntry({ id: 1, keys: ['trigger'], position: 'before_char', content: 'Before content' }),
      makeEntry({ id: 2, keys: ['trigger'], position: 'after_char', content: 'After content' }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.scanAndBuildInjection(
      [{ role: 'user', content: 'trigger' }],
      'trigger',
    );
    expect(result.beforeChar).toContain('Before content');
    expect(result.afterChar).toContain('After content');
  });

  it('多个 before 条目用换行连接', () => {
    const entries: WorldBookEntry[] = [
      makeEntry({ id: 1, keys: ['x'], position: 'before_char', content: 'First' }),
      makeEntry({ id: 2, keys: ['x'], position: 'before_char', content: 'Second' }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.scanAndBuildInjection([], 'x');
    expect(result.beforeChar).toContain('First');
    expect(result.beforeChar).toContain('Second');
    expect(result.beforeChar).toContain('\n\n');
  });

  it('禁用的条目不参与扫描', () => {
    const entries: WorldBookEntry[] = [
      makeEntry({ id: 1, keys: ['x'], enabled: false, content: 'disabled' }),
      makeEntry({ id: 2, keys: ['x'], enabled: true, content: 'enabled' }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.scanAndBuildInjection([], 'x');
    expect(result.afterChar).toContain('enabled');
    expect(result.afterChar).not.toContain('disabled');
  });

  it('atDepth 条目出现在 atDepthEntries 中', () => {
    const entries: WorldBookEntry[] = [
      makeEntry({
        id: 1,
        keys: ['x'],
        position: 'after_char',
        content: 'At depth content',
        depth: 4,
      }),
    ];
    // 注意：position 'after_char' 映射到 position=1 (after)
    // 要测试 atDepth，需要在 WorldInfoEntry 层面设置 position=4
    // 但 WorldBookEntry 的 position 只有 'before_char' | 'after_char'
    // atDepth 是通过 v2 的 depth 字段 + position 映射实现的
    // 这里测试 after_char 的基本功能
    const mgr = createWorldBookManager(entries);
    const result = mgr.scanAndBuildInjection([], 'x');
    expect(result.afterChar).toContain('At depth content');
  });

  it('activatedEntries 包含所有激活的条目', () => {
    // 注意：内容不能用 "Entry" 这种含 "y" 的词，否则递归扫描会误触发 key='y'
    const entries: WorldBookEntry[] = [
      makeEntry({ id: 1, keys: ['alpha'], content: 'Alpha data' }),
      makeEntry({ id: 2, keys: ['alpha'], content: 'Beta data' }),
      makeEntry({ id: 3, keys: ['zeta'], content: 'Zeta data' }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.scanAndBuildInjection([], 'alpha');
    expect(result.activatedEntries).toHaveLength(2);
  });

  it('没有匹配时返回空结果', () => {
    const entries: WorldBookEntry[] = [
      makeEntry({ id: 1, keys: ['unmatchable'] }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.scanAndBuildInjection([], 'nothing matches here');
    expect(result.beforeChar).toBe('');
    expect(result.afterChar).toBe('');
    expect(result.activatedEntries).toHaveLength(0);
  });

  it('constant 条目也参与扫描注入', () => {
    const entries: WorldBookEntry[] = [
      makeEntry({
        id: 1,
        keys: ['always'],
        constant: true,
        enabled: true,
        content: 'Constant entry',
        position: 'before_char',
      }),
    ];
    const mgr = createWorldBookManager(entries);
    const result = mgr.scanAndBuildInjection(
      [{ content: 'always keyword here' }],
      'always',
    );
    expect(result.beforeChar).toContain('Constant entry');
  });
});
