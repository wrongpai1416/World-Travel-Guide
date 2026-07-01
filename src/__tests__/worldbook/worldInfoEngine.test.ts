import { describe, expect, it, mock, beforeEach } from 'bun:test';
import {
  scanWorldInfo,
  matchWorldInfoKey,
  readEntryKeyList,
  compareWorldInfoEntriesBySendOrder,
  world_info_logic,
  world_info_position,
  type WorldInfoEntry,
} from '../../worldbook/worldInfoEngine';

// ═══════════════════════════════════════════════════
//  readEntryKeyList — 关键词读取（多别名兼容）
// ═══════════════════════════════════════════════════

describe('readEntryKeyList', () => {
  it('从 key 数组读取主关键词', () => {
    const entry = { key: ['dragon', 'wyrm'] } as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'key')).toEqual(['dragon', 'wyrm']);
  });

  it('从 keys 别名读取', () => {
    const entry = { keys: ['sword', 'blade'] } as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'key')).toEqual(['sword', 'blade']);
  });

  it('从 keywords 别名读取', () => {
    const entry = { keywords: ['magic', 'spell'] } as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'key')).toEqual(['magic', 'spell']);
  });

  it('从字符串读取并按逗号分隔', () => {
    const entry = { keysStr: 'fire, water, earth' } as unknown as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'key')).toEqual(['fire', 'water', 'earth']);
  });

  it('从字符串读取并按中文逗号分隔', () => {
    const entry = { keysStr: '火，水，土' } as unknown as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'key')).toEqual(['火', '水', '土']);
  });

  it('从字符串读取并按换行分隔', () => {
    const entry = { keysStr: 'line1\nline2\nline3' } as unknown as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'key')).toEqual(['line1', 'line2', 'line3']);
  });

  it('从字符串读取并按竖线分隔', () => {
    const entry = { keysStr: 'a|b|c' } as unknown as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'key')).toEqual(['a', 'b', 'c']);
  });

  it('过滤空白和空字符串', () => {
    const entry = { key: ['valid', '', '  ', 'also'] } as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'key')).toEqual(['valid', 'also']);
  });

  it('空 entry 返回空数组', () => {
    expect(readEntryKeyList(null as unknown as WorldInfoEntry, 'key')).toEqual([]);
    expect(readEntryKeyList(undefined as unknown as WorldInfoEntry, 'key')).toEqual([]);
  });

  it('没有匹配字段时返回空数组', () => {
    const entry = { content: 'something' } as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'key')).toEqual([]);
  });

  it('读取次级关键词 (keysecondary)', () => {
    const entry = {
      keysecondary: ['sec1', 'sec2'],
      secondary_keys: ['old_format'],
    } as WorldInfoEntry;
    // keysecondary 优先于 secondary_keys
    expect(readEntryKeyList(entry, 'keysecondary')).toEqual(['sec1', 'sec2']);
  });

  it('读取排除关键词 (exclude_key)', () => {
    const entry = { excludeKeys: ['bad', 'evil'] } as WorldInfoEntry;
    expect(readEntryKeyList(entry, 'exclude_key')).toEqual(['bad', 'evil']);
  });

  it('数组优先于字符串别名', () => {
    const entry = { key: ['arr1'], keysStr: 'str1,str2' } as unknown as WorldInfoEntry;
    // key 数组优先
    expect(readEntryKeyList(entry, 'key')).toEqual(['arr1']);
  });
});

// ═══════════════════════════════════════════════════
//  matchWorldInfoKey — 关键词匹配
// ═══════════════════════════════════════════════════

describe('matchWorldInfoKey', () => {
  // ── 基本子串匹配 ──
  it('子串匹配成功', () => {
    expect(matchWorldInfoKey('the dragon flies', 'dragon', {})).toBe(true);
  });

  it('子串匹配失败', () => {
    expect(matchWorldInfoKey('the cat sleeps', 'dragon', {})).toBe(false);
  });

  it('空关键词返回 false', () => {
    expect(matchWorldInfoKey('some text', '', {})).toBe(false);
  });

  it('空文本不匹配非空关键词', () => {
    expect(matchWorldInfoKey('', 'dragon', {})).toBe(false);
  });

  // ── 大小写处理 ──
  it('默认大小写不敏感', () => {
    expect(matchWorldInfoKey('The DRAGON Flies', 'dragon', {})).toBe(true);
    expect(matchWorldInfoKey('the dragon flies', 'DRAGON', {})).toBe(true);
  });

  it('caseSensitive=true 时大小写敏感', () => {
    expect(matchWorldInfoKey('The Dragon flies', 'dragon', { caseSensitive: true })).toBe(false);
    expect(matchWorldInfoKey('The Dragon flies', 'Dragon', { caseSensitive: true })).toBe(true);
  });

  // ── 全词匹配 ──
  it('matchWholeWords: 词边界匹配成功', () => {
    expect(matchWorldInfoKey('a dragon here', 'dragon', { matchWholeWords: true })).toBe(true);
  });

  it('matchWholeWords: 子串不算全词', () => {
    expect(matchWorldInfoKey('dragons fly', 'dragon', { matchWholeWords: true })).toBe(false);
  });

  it('matchWholeWords: 中文字符不算词边界（直接 includes）', () => {
    // 中文没有 A-Za-z0-9_ 边界，所以回退到 includes
    expect(matchWorldInfoKey('巨龙飞过', '巨龙', { matchWholeWords: true })).toBe(true);
  });

  it('matchWholeWords: 词首位置也算边界', () => {
    expect(matchWorldInfoKey('dragon at start', 'dragon', { matchWholeWords: true })).toBe(true);
  });

  it('matchWholeWords: 词尾位置也算边界', () => {
    expect(matchWorldInfoKey('at end dragon', 'dragon', { matchWholeWords: true })).toBe(true);
  });

  // ── 正则关键词 ──
  it('正则关键词 /pattern/ 匹配', () => {
    expect(matchWorldInfoKey('level 42', '/\\d+/', {})).toBe(true);
  });

  it('正则关键词不匹配', () => {
    expect(matchWorldInfoKey('no numbers here', '/\\d+/', {})).toBe(false);
  });

  it('正则关键词带 flags', () => {
    expect(matchWorldInfoKey('Hello World', '/world/i', {})).toBe(true);
  });

  it('无效正则返回 false 不抛异常', () => {
    expect(matchWorldInfoKey('test', '/[invalid/', {})).toBe(false);
  });

  it('正则匹配空文本', () => {
    expect(matchWorldInfoKey('', '/^$/', {})).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
//  compareWorldInfoEntriesBySendOrder — 排序
// ═══════════════════════════════════════════════════

describe('compareWorldInfoEntriesBySendOrder', () => {
  it('before_char (position=0) 排在 after_char (position=1) 前面', () => {
    const before = { position: 0, order: 100 } as WorldInfoEntry;
    const after = { position: 1, order: 1 } as WorldInfoEntry;
    expect(compareWorldInfoEntriesBySendOrder(before, after)).toBeLessThan(0);
  });

  it('atDepth (position=4) 排在 after_char (position=1) 后面', () => {
    const atDepth = { position: 4, order: 1, depth: 2 } as WorldInfoEntry;
    const after = { position: 1, order: 1 } as WorldInfoEntry;
    expect(compareWorldInfoEntriesBySendOrder(atDepth, after)).toBeGreaterThan(0);
  });

  it('同 position 时 order 小的排前面', () => {
    const a = { position: 1, order: 10 } as WorldInfoEntry;
    const b = { position: 1, order: 20 } as WorldInfoEntry;
    expect(compareWorldInfoEntriesBySendOrder(a, b)).toBeLessThan(0);
  });

  it('同 position 同 order 时按名称排序', () => {
    const a = { position: 1, order: 10, comment: 'apple' } as WorldInfoEntry;
    const b = { position: 1, order: 10, comment: 'banana' } as WorldInfoEntry;
    expect(compareWorldInfoEntriesBySendOrder(a, b)).toBeLessThan(0);
  });

  it('两个 atDepth 条目按 depth 排序（浅的在前）', () => {
    const shallow = { position: 4, order: 10, depth: 2 } as WorldInfoEntry;
    const deep = { position: 4, order: 10, depth: 4 } as WorldInfoEntry;
    expect(compareWorldInfoEntriesBySendOrder(shallow, deep)).toBeLessThan(0);
  });

  it('缺失 order 时回退到默认值 100', () => {
    const a = { position: 1 } as WorldInfoEntry;  // order 默认 100
    const b = { position: 1, order: 50 } as WorldInfoEntry;  // order 50 < 100
    expect(compareWorldInfoEntriesBySendOrder(a, b)).toBeGreaterThan(0);
  });

  it('完全相同的条目返回 0', () => {
    const a = { position: 1, order: 10, comment: 'same' } as WorldInfoEntry;
    const b = { position: 1, order: 10, comment: 'same' } as WorldInfoEntry;
    expect(compareWorldInfoEntriesBySendOrder(a, b)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
//  scanWorldInfo — 完整扫描流程
// ═══════════════════════════════════════════════════

describe('scanWorldInfo', () => {
  // ── 基本功能 ──
  it('空条目列表返回空数组', () => {
    const result = scanWorldInfo([], { entries: [] }, 'test');
    expect(result).toEqual([]);
  });

  it('null pack 返回空数组', () => {
    const result = scanWorldInfo([], null as unknown as { entries: [] }, 'test');
    expect(result).toEqual([]);
  });

  it('禁用的条目不被激活', () => {
    const entries = [
      { content: 'hidden', key: ['secret'], enabled: false },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ role: 'user', content: 'I found a secret' }],
      { entries },
      '',
    );
    expect(result).toHaveLength(0);
  });

  it('disable=true 的条目不被激活', () => {
    const entries = [
      { content: 'hidden', key: ['secret'], disable: true },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ role: 'user', content: 'I found a secret' }],
      { entries },
      '',
    );
    expect(result).toHaveLength(0);
  });

  // ── 关键词触发 ──
  it('关键词在用户输入中命中则激活', () => {
    const entries = [
      { content: 'Dragon info', key: ['dragon'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ role: 'user', content: 'I see a dragon' }],
      { entries },
      'dragon',
    );
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Dragon info');
  });

  it('关键词在聊天历史中命中也激活', () => {
    const entries = [
      { content: 'Castle info', key: ['castle'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ role: 'user', content: 'We approach the castle' }],
      { entries },
      '',  // 用户输入为空，但历史中有
    );
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Castle info');
  });

  it('关键词未命中不激活', () => {
    const entries = [
      { content: 'Dragon info', key: ['dragon'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ role: 'user', content: 'I see a cat' }],
      { entries },
      'cat',
    );
    expect(result).toHaveLength(0);
  });

  // ── 多关键词 OR 逻辑 ──
  it('多个主关键词是 OR 逻辑（任一命中即激活）', () => {
    const entries = [
      { content: 'Weapon info', key: ['sword', 'bow', 'spear'] },
    ] as WorldInfoEntry[];
    expect(scanWorldInfo([{ content: 'I have a bow' }], { entries }, '')).toHaveLength(1);
    expect(scanWorldInfo([{ content: 'I have a sword' }], { entries }, '')).toHaveLength(1);
    expect(scanWorldInfo([{ content: 'I have a shield' }], { entries }, '')).toHaveLength(0);
  });

  // ── 次级关键词 + selectiveLogic ──
  it('selective + AND_ANY: 次级关键词命中任一即激活', () => {
    const entries = [
      {
        content: 'Magic sword',
        key: ['sword'],
        selective: true,
        keysecondary: ['fire', 'ice'],
        selectiveLogic: world_info_logic.AND_ANY,
      },
    ] as WorldInfoEntry[];
    expect(scanWorldInfo([{ content: 'a sword of fire' }], { entries }, '')).toHaveLength(1);
    expect(scanWorldInfo([{ content: 'a sword of ice' }], { entries }, '')).toHaveLength(1);
    expect(scanWorldInfo([{ content: 'a sword of lightning' }], { entries }, '')).toHaveLength(0);
  });

  it('selective + AND_ALL: 次级关键词全部命中才激活', () => {
    const entries = [
      {
        content: 'Magic sword',
        key: ['sword'],
        selective: true,
        keysecondary: ['fire', 'ice'],
        selectiveLogic: world_info_logic.AND_ALL,
      },
    ] as WorldInfoEntry[];
    expect(scanWorldInfo([{ content: 'a sword of fire and ice' }], { entries }, '')).toHaveLength(1);
    expect(scanWorldInfo([{ content: 'a sword of fire' }], { entries }, '')).toHaveLength(0);
  });

  it('selective + NOT_ANY: 次级关键词都不命中才激活', () => {
    const entries = [
      {
        content: 'Normal sword',
        key: ['sword'],
        selective: true,
        keysecondary: ['fire', 'ice'],
        selectiveLogic: world_info_logic.NOT_ANY,
      },
    ] as WorldInfoEntry[];
    expect(scanWorldInfo([{ content: 'a plain sword' }], { entries }, '')).toHaveLength(1);
    expect(scanWorldInfo([{ content: 'a sword of fire' }], { entries }, '')).toHaveLength(0);
  });

  it('selective + NOT_ALL: 次级关键词不全命中才激活', () => {
    const entries = [
      {
        content: 'Magic sword',
        key: ['sword'],
        selective: true,
        keysecondary: ['fire', 'ice'],
        selectiveLogic: world_info_logic.NOT_ALL,
      },
    ] as WorldInfoEntry[];
    expect(scanWorldInfo([{ content: 'a sword of fire' }], { entries }, '')).toHaveLength(1);
    expect(scanWorldInfo([{ content: 'a sword of fire and ice' }], { entries }, '')).toHaveLength(0);
  });

  it('selective 但没有次级关键词时，仅靠主关键词激活', () => {
    const entries = [
      {
        content: 'Selective entry',
        key: ['magic'],
        selective: true,
        keysecondary: [],
      },
    ] as WorldInfoEntry[];
    expect(scanWorldInfo([{ content: 'use magic' }], { entries }, '')).toHaveLength(1);
  });

  // ── 排除关键词 ──
  it('排除关键词命中则不激活', () => {
    const entries = [
      {
        content: 'Dragon info',
        key: ['dragon'],
        exclude_key: ['baby'],
      },
    ] as WorldInfoEntry[];
    expect(scanWorldInfo([{ content: 'a baby dragon' }], { entries }, '')).toHaveLength(0);
    expect(scanWorldInfo([{ content: 'a dragon' }], { entries }, '')).toHaveLength(1);
  });

  // ── 递归扫描 ──
  it('递归扫描：条目A的内容触发条目B', () => {
    const entries = [
      { content: 'The king lives in the castle', key: ['king'] },
      { content: 'Castle description', key: ['castle'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'I talk to the king' }],
      { entries },
      '',
    );
    // king 条目激活，其内容含 "castle"，递归触发 castle 条目
    expect(result).toHaveLength(2);
    const comments = result.map(e => e.content).sort();
    expect(comments).toContain('The king lives in the castle');
    expect(comments).toContain('Castle description');
  });

  it('excludeRecursion=true 的条目不参与递归触发', () => {
    const entries = [
      { content: 'Mention of tavern', key: ['tavern'], excludeRecursion: true },
      { content: 'Tavern details', key: ['tavern'] },
    ] as WorldInfoEntry[];
    // 两个条目都直接被 "tavern" 触发，但第一个不递归
    const result = scanWorldInfo(
      [{ content: 'I enter the tavern' }],
      { entries },
      '',
    );
    expect(result).toHaveLength(2);
  });

  it('preventRecursion=true 终止后续递归', () => {
    const entries = [
      { content: 'Gate to the dungeon', key: ['gate'], preventRecursion: true },
      { content: 'Dungeon description', key: ['dungeon'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'I open the gate' }],
      { entries },
      '',
    );
    // gate 激活但阻止递归，dungeon 不被触发
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Gate to the dungeon');
  });

  // ── 分组互斥 ──
  it('同组只保留 order 最大的一条（单轮内互斥）', () => {
    // excludeRecursion 防止内容触发递归，确保只跑一轮
    const entries = [
      { content: 'Option A', key: ['weather'], group: 'weather_group', order: 10, excludeRecursion: true },
      { content: 'Option B', key: ['weather'], group: 'weather_group', order: 20, excludeRecursion: true },
      { content: 'Option C', key: ['weather'], group: 'weather_group', order: 5, excludeRecursion: true },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'How is the weather?' }],
      { entries },
      'weather',
      { maxRecursion: 1 },
    );
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Option B');  // order 20 最大
  });

  it('不同组各自保留', () => {
    const entries = [
      { content: 'Weather A', key: ['weather'], group: 'g1', order: 10 },
      { content: 'Time A', key: ['time'], group: 'g2', order: 5 },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'weather and time' }],
      { entries },
      'weather time',
    );
    expect(result).toHaveLength(2);
  });

  it('无分组的条目不受分组互斥影响', () => {
    const entries = [
      { content: 'No group 1', key: ['test'] },
      { content: 'No group 2', key: ['test'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'test' }],
      { entries },
      'test',
    );
    expect(result).toHaveLength(2);
  });

  // ── 概率触发 ──
  it('useProbability=true 且 probability=100 时总是激活', () => {
    const entries = [
      {
        content: 'Lucky entry',
        key: ['luck'],
        useProbability: true,
        probability: 100,
      },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo([{ content: 'feeling lucky' }], { entries }, '');
    expect(result).toHaveLength(1);
  });

  it('useProbability=true 且 probability=0 时永不激活', () => {
    const entries = [
      {
        content: 'Unlucky entry',
        key: ['luck'],
        useProbability: true,
        probability: 0,
      },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo([{ content: 'feeling lucky' }], { entries }, '');
    expect(result).toHaveLength(0);
  });

  it('useProbability 未设置时不做概率门控', () => {
    const entries = [
      {
        content: 'Always entry',
        key: ['always'],
        probability: 0,  // 但 useProbability 没设
      },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo([{ content: 'always here' }], { entries }, '');
    expect(result).toHaveLength(1);
  });

  // ── 扫描深度 ──
  it('scanDepth 限制只扫描最近 N 条消息', () => {
    const entries = [
      { content: 'Old topic', key: ['ancient'] },
    ] as WorldInfoEntry[];
    // 聊天历史按时间正序（最旧在前），扫描器内部会反转为最新在前
    // scanDepth=2 只扫描反转后的前2条（即最新的2条），不含最旧的 "ancient"
    const chatHistory = [
      { role: 'user', content: 'talk about ancient things' },  // 最旧，反转后在最后
      { role: 'user', content: 'recent message 1' },
      { role: 'user', content: 'recent message 2' },
      { role: 'user', content: 'recent message 3' },  // 最新，反转后在最前
    ];
    const result = scanWorldInfo(chatHistory, { entries }, '', { scanDepth: 2 });
    expect(result).toHaveLength(0);
  });

  it('全局 scanDepth 足够大时能命中旧消息', () => {
    const entries = [
      { content: 'Old topic', key: ['ancient'] },
    ] as WorldInfoEntry[];
    const chatHistory = [
      { role: 'user', content: 'recent message 1' },
      { role: 'user', content: 'talk about ancient things' },
    ];
    const result = scanWorldInfo(chatHistory, { entries }, '', { scanDepth: 10 });
    expect(result).toHaveLength(1);
  });

  // ── suppressCharacterEntry 回调 ──
  it('suppressCharacterEntry 回调返回 true 时抑制条目', () => {
    const entries = [
      { content: 'NPC info', key: ['npc'] },
    ] as WorldInfoEntry[];
    const suppress = () => true;
    const result = scanWorldInfo(
      [{ content: 'talk to npc' }],
      { entries },
      '',
      { suppressCharacterEntry: suppress },
    );
    expect(result).toHaveLength(0);
  });

  it('suppressCharacterEntry 回调返回 false 时不抑制', () => {
    const entries = [
      { content: 'NPC info', key: ['npc'] },
    ] as WorldInfoEntry[];
    const suppress = () => false;
    const result = scanWorldInfo(
      [{ content: 'talk to npc' }],
      { entries },
      '',
      { suppressCharacterEntry: suppress },
    );
    expect(result).toHaveLength(1);
  });

  // ── 没有主关键词的条目 ──
  it('没有主关键词的条目视为常驻模式直接激活', () => {
    const entries = [
      { content: 'Always active' },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'any message' }],
      { entries },
      'anything',
    );
    expect(result).toHaveLength(1);
  });

  // ── 结果排序 ──
  it('结果按发送顺序排序 (before 在 after 之前)', () => {
    const entries = [
      { content: 'After entry', key: ['trigger'], position: 1, order: 1 },
      { content: 'Before entry', key: ['trigger'], position: 0, order: 1 },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'trigger' }],
      { entries },
      'trigger',
    );
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Before entry');
    expect(result[1].content).toBe('After entry');
  });
});

// ═══════════════════════════════════════════════════
//  scanWorldInfo — 递归控制 + 边界场景
// ═══════════════════════════════════════════════════

describe('scanWorldInfo 递归与边界', () => {
  it('最大递归次数限制 (maxRecursion=1)', () => {
    // A→B→C 链式触发，但 maxRecursion=1 只允许一轮
    const entries = [
      { content: 'A mentions B', key: ['start_a'] },
      { content: 'B mentions C', key: ['start_b'] },
      { content: 'C content', key: ['start_c'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'start_a' }],
      { entries },
      'start_a',
      { maxRecursion: 1 },
    );
    // 只一轮：只有 A 被直接触发
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('A mentions B');
  });

  it('maxRecursion=3 允许链式触发 A→B→C', () => {
    const entries = [
      { content: 'A says keyword_b', key: ['keyword_a'] },
      { content: 'B says keyword_c', key: ['keyword_b'] },
      { content: 'C final', key: ['keyword_c'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'keyword_a' }],
      { entries },
      'keyword_a',
      { maxRecursion: 3 },
    );
    expect(result).toHaveLength(3);
  });

  it('已激活的条目不会被重复激活', () => {
    const entries = [
      { content: 'Self-referencing', key: ['loop'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'loop trigger' }],
      { entries },
      'loop',
    );
    expect(result).toHaveLength(1);
  });

  it('globalScanData (用户输入) 也参与扫描', () => {
    const entries = [
      { content: 'User keyword hit', key: ['userword'] },
    ] as WorldInfoEntry[];
    // 聊天历史不含关键词，但用户输入含
    const result = scanWorldInfo(
      [{ content: 'irrelevant history' }],
      { entries },
      'userword in input',
    );
    expect(result).toHaveLength(1);
  });

  it('条目内容为空字符串时不参与递归', () => {
    const entries = [
      { content: '', key: ['trigger'] },
      { content: 'Should not trigger', key: ['trigger'] },
    ] as WorldInfoEntry[];
    const result = scanWorldInfo(
      [{ content: 'trigger' }],
      { entries },
      'trigger',
    );
    // 两个都直接被触发，但空内容的不会递归
    expect(result).toHaveLength(2);
  });
});
