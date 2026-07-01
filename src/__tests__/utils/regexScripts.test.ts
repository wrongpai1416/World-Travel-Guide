import { describe, it, expect } from 'bun:test';
import {
  processRegexScripts,
  resolveRegexScripts,
  type RegexScript,
} from '../../utils/regexScripts';

// hasReDoSRisk 是内部函数，通过 processRegexScripts 间接测试

// 辅助：创建基本正则脚本
function makeScript(overrides: Partial<RegexScript> = {}): RegexScript {
  return {
    id: 'test_1',
    scriptName: '测试脚本',
    findRegex: 'hello',
    replaceString: '你好',
    placement: [1, 2],
    disabled: false,
    markdownOnly: false,
    promptOnly: false,
    minDepth: null,
    maxDepth: null,
    ...overrides,
  };
}

describe('processRegexScripts', () => {
  // ── 基本替换 ──

  it('基本正则替换', () => {
    const result = processRegexScripts('hello world', [makeScript()]);
    expect(result).toBe('你好 world');
  });

  it('全局替换（g 标志自动添加）', () => {
    const result = processRegexScripts('hello hello hello', [makeScript()]);
    expect(result).toBe('你好 你好 你好');
  });

  it('空文本返回空', () => {
    expect(processRegexScripts('', [makeScript()])).toBe('');
  });

  it('空脚本数组返回原文', () => {
    expect(processRegexScripts('hello world', [])).toBe('hello world');
  });

  it('无 findRegex 的脚本被跳过', () => {
    const script = makeScript({ findRegex: '' });
    expect(processRegexScripts('hello world', [script])).toBe('hello world');
  });

  // ── 正则格式 ──

  it('/pattern/flags 格式的正则', () => {
    const script = makeScript({ findRegex: '/world/gi', replaceString: '世界' });
    expect(processRegexScripts('Hello World', [script])).toBe('Hello 世界');
  });

  it('裸模式自动加 g 标志', () => {
    const script = makeScript({ findRegex: 'cat', replaceString: '猫' });
    expect(processRegexScripts('cat cat cat', [script])).toBe('猫 猫 猫');
  });

  it('捕获组替换 $1 $2', () => {
    const script = makeScript({
      findRegex: '(\\w+)@(\\w+)',
      replaceString: '$2.$1',
    });
    expect(processRegexScripts('user@host', [script])).toBe('host.user');
  });

  it('转义字符 \\n \\t \\r 被正确处理', () => {
    const script = makeScript({
      findRegex: 'break',
      replaceString: 'line\\nbreak',
    });
    expect(processRegexScripts('break', [script])).toBe('line\nbreak');
  });

  it('大小写不敏感标志 i', () => {
    const script = makeScript({ findRegex: '/HELLO/gi', replaceString: '嗨' });
    expect(processRegexScripts('HeLLo WoRLd', [script])).toBe('嗨 WoRLd');
  });

  // ── disabled 过滤 ──

  it('disabled=true 的脚本被跳过', () => {
    const script = makeScript({ disabled: true });
    expect(processRegexScripts('hello world', [script])).toBe('hello world');
  });

  it('disabled="false" 字符串被当作 false', () => {
    const script = makeScript({ disabled: 'false' as any });
    expect(processRegexScripts('hello', [script])).toBe('你好');
  });

  it('disabled="true" 字符串被当作 true', () => {
    const script = makeScript({ disabled: 'true' as any });
    expect(processRegexScripts('hello', [script])).toBe('hello');
  });

  // ── placement 过滤 ──

  it('placement 匹配时执行', () => {
    const script = makeScript({ placement: [1] });
    expect(processRegexScripts('hello', [script], 1)).toBe('你好');
  });

  it('placement 不匹配时跳过', () => {
    const script = makeScript({ placement: [2] });
    expect(processRegexScripts('hello', [script], 1)).toBe('hello');
  });

  it('placement=2 (Output) 匹配', () => {
    const script = makeScript({ placement: [2] });
    expect(processRegexScripts('hello', [script], 2)).toBe('你好');
  });

  it('placement=3 (Slash) 匹配', () => {
    const script = makeScript({ placement: [3] });
    expect(processRegexScripts('hello', [script], 3)).toBe('你好');
  });

  it('placement 字符串 "1" 匹配', () => {
    const script = makeScript({ placement: [1] });
    expect(processRegexScripts('hello', [script], '1')).toBe('你好');
  });

  it('placement="Input" 匹配', () => {
    const script = makeScript({ placement: [1] });
    expect(processRegexScripts('hello', [script], 'Input')).toBe('你好');
  });

  it('脚本 placement 为空数组时不限制', () => {
    const script = makeScript({ placement: [] });
    expect(processRegexScripts('hello', [script], 1)).toBe('你好');
  });

  it('placement=undefined（显示渲染）时不受 placement 限制', () => {
    const script = makeScript({ placement: [1] });
    expect(processRegexScripts('hello', [script])).toBe('你好');
  });

  // ── markdownOnly / promptOnly ──

  it('markdownOnly=true 时仅在显示渲染执行', () => {
    const script = makeScript({ markdownOnly: true });
    // placement=undefined → 显示渲染 → 执行
    expect(processRegexScripts('hello', [script])).toBe('你好');
    // placement=1 → API 发送 → 不执行
    expect(processRegexScripts('hello', [script], 1)).toBe('hello');
  });

  it('promptOnly=true 时仅在 API 发送执行', () => {
    const script = makeScript({ promptOnly: true });
    // placement=undefined → 显示渲染 → 不执行
    expect(processRegexScripts('hello', [script])).toBe('hello');
    // placement=1 → API 发送 → 执行
    expect(processRegexScripts('hello', [script], 1)).toBe('你好');
  });

  it('markdownOnly + promptOnly 都为 true 时两边都执行', () => {
    const script = makeScript({ markdownOnly: true, promptOnly: true });
    expect(processRegexScripts('hello', [script])).toBe('你好');
    expect(processRegexScripts('hello', [script], 1)).toBe('你好');
  });

  it('markdownOnly + promptOnly 都为 false 时两边都执行', () => {
    const script = makeScript({ markdownOnly: false, promptOnly: false });
    expect(processRegexScripts('hello', [script])).toBe('你好');
    expect(processRegexScripts('hello', [script], 1)).toBe('你好');
  });

  // ── depth 过滤 ──

  it('minDepth 限制：depth < minDepth 时跳过', () => {
    const script = makeScript({ minDepth: 5 });
    expect(processRegexScripts('hello', [script], 1, 3)).toBe('hello');
  });

  it('minDepth 限制：depth >= minDepth 时执行', () => {
    const script = makeScript({ minDepth: 5 });
    expect(processRegexScripts('hello', [script], 1, 5)).toBe('你好');
  });

  it('maxDepth 限制：depth >= maxDepth 时跳过', () => {
    const script = makeScript({ maxDepth: 10 });
    expect(processRegexScripts('hello', [script], 1, 10)).toBe('hello');
  });

  it('maxDepth 限制：depth < maxDepth 时执行', () => {
    const script = makeScript({ maxDepth: 10 });
    expect(processRegexScripts('hello', [script], 1, 9)).toBe('你好');
  });

  it('无 depth 限制时（minDepth=maxDepth=null）不受 depth 影响', () => {
    const script = makeScript({ minDepth: null, maxDepth: null });
    expect(processRegexScripts('hello', [script], 1, 100)).toBe('你好');
  });

  it('depth=null 且脚本有 depth 限制时跳过', () => {
    const script = makeScript({ minDepth: 1 });
    expect(processRegexScripts('hello', [script], 1, null)).toBe('hello');
  });

  it('depth=null 且脚本无 depth 限制时执行', () => {
    const script = makeScript();
    expect(processRegexScripts('hello', [script], 1, null)).toBe('你好');
  });

  // ── ReDoS 防护 ──

  it('嵌套量词模式被跳过（ReDoS 防护）', () => {
    const script = makeScript({
      findRegex: '(a+)+',
      replaceString: 'X',
      scriptName: '危险脚本',
    });
    expect(processRegexScripts('aaa', [script])).toBe('aaa');
  });

  it('回溯炸弹模式被跳过（ReDoS 防护）', () => {
    // (a|b)*c+ 匹配 BACKTRACK_BOMB 正则：\([^)]*\|[^)]*\)[*+]\w*[*+]
    const script = makeScript({
      findRegex: '(a|b)*c+',
      replaceString: 'X',
      scriptName: '回溯炸弹',
    });
    expect(processRegexScripts('abc', [script])).toBe('abc');
  });

  it('安全模式正常执行', () => {
    const script = makeScript({
      findRegex: '\\d+',
      replaceString: 'NUM',
    });
    expect(processRegexScripts('abc123def456', [script])).toBe('abcNUMdefNUM');
  });

  // ── 多脚本 ──

  it('多个脚本按顺序执行', () => {
    const scripts = [
      makeScript({ id: 's1', findRegex: 'cat', replaceString: '狗' }),
      makeScript({ id: 's2', findRegex: '狗', replaceString: '犬' }),
    ];
    expect(processRegexScripts('cat', scripts)).toBe('犬');
  });

  it('无效正则被跳过不崩溃', () => {
    const script = makeScript({ findRegex: '[invalid', replaceString: 'X' });
    expect(processRegexScripts('hello', [script])).toBe('hello');
  });
});

// ── resolveRegexScripts ──

describe('resolveRegexScripts', () => {
  it('合并全局脚本和预设脚本', () => {
    const global = [makeScript({ id: 'g1', scriptName: '全局' })];
    const preset = [makeScript({ id: 'p1', scriptName: '预设' })];
    const result = resolveRegexScripts(preset, global);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('g1'); // 全局在前
    expect(result[1].id).toBe('p1'); // 预设在后
  });

  it('空数组合并', () => {
    expect(resolveRegexScripts([], [])).toEqual([]);
  });

  it('一边为空', () => {
    const global = [makeScript({ id: 'g1' })];
    expect(resolveRegexScripts([], global)).toHaveLength(1);
    expect(resolveRegexScripts([makeScript({ id: 'p1' })], [])).toHaveLength(1);
  });

  it('默认参数', () => {
    expect(resolveRegexScripts()).toEqual([]);
  });
});
