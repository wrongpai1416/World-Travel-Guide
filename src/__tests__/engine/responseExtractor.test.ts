import { describe, it, expect } from 'bun:test';
import { extractContentForPrompt } from '../../engine/responseExtractor';

// stripInnerTags 和 stripAllTags 是内部函数，通过 extractContentForPrompt 间接测试

describe('extractContentForPrompt', () => {
  // ── 基本提取 ──

  it('空输入返回空字符串', () => {
    expect(extractContentForPrompt('')).toBe('');
    expect(extractContentForPrompt(null as any)).toBe('');
    expect(extractContentForPrompt(undefined as any)).toBe('');
  });

  it('从 <contenttext> 标签提取正文', () => {
    const raw = '<contenttext>这是正文内容。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('这是正文内容。');
  });

  it('contenttext 内含换行和空白时保留', () => {
    const raw = '<contenttext>\n  第一段。\n  第二段。\n</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('第一段。\n  第二段。');
  });

  it('没有 contenttext 标签时走兜底逻辑（stripAllTags）', () => {
    const raw = '这是纯文本，没有标签。';
    expect(extractContentForPrompt(raw)).toBe('这是纯文本，没有标签。');
  });

  // ── stripInnerTags（contenttext 内部子标签清理）──

  it('contenttext 内部的 <thinking> 标签被移除', () => {
    const raw = '<contenttext><thinking>内部思考</thinking>实际正文。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('实际正文。');
  });

  it('contenttext 内部的 <details>/<summary> 标签被移除', () => {
    const raw = '<contenttext><details><summary>标题</summary>详情内容</details>正文。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('contenttext 内部的 <Auto> 标签被移除', () => {
    const raw = '<contenttext><Auto>自动内容</Auto>正文。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('contenttext 内部的 <safe> 标签被移除', () => {
    const raw = '<contenttext><safe>安全内容</safe>正文。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('contenttext 内部的 <analysis_block> 标签被移除', () => {
    const raw = '<contenttext><analysis_block>分析</analysis_block>正文。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('contenttext 内部的 <image> 标签被移除', () => {
    const raw = '<contenttext><image src="test.png">图片描述</image>正文。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('contenttext 内部的 <image_think> 标签被移除', () => {
    const raw = '<contenttext><image_think type="analysis">图片思考</image_think>正文。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('contenttext 内部的 <imgthink> 标签被移除', () => {
    const raw = '<contenttext><imgthink>图片思考</imgthink>正文。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('contenttext 内部的 UpdateVariable 标签被移除（内容保留）', () => {
    const raw = '<contenttext><UpdateVariable>[{"op":"add","path":"/玩家/姓名","value":"测试"}]</UpdateVariable>正文。</contenttext>';
    // stripInnerTags 只移除标签本身，不删除标签内的内容
    expect(extractContentForPrompt(raw)).toBe('[{"op":"add","path":"/玩家/姓名","value":"测试"}]正文。');
  });

  it('contenttext 内部的 action_options 标签被移除（内容保留）', () => {
    const raw = '<contenttext><action_options>选项</action_options>正文。</contenttext>';
    // stripInnerTags 只移除标签本身，不删除标签内的内容
    expect(extractContentForPrompt(raw)).toBe('选项正文。');
  });

  it('contenttext 内部多个不同子标签同时存在时全部移除', () => {
    const raw = '<contenttext><thinking>思考</thinking><Auto>自动</Auto>正文<safe>安全</safe>。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('contenttext 内部的自闭合 br/hr 标签被移除', () => {
    const raw = '<contenttext>第一行<br>第二行<hr>第三行</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('第一行第二行第三行');
  });

  // ── stripAllTags（兜底路径）──

  it('兜底路径：thinking 标签整体移除', () => {
    const raw = '<thinking>思考内容</thinking>这是正文。';
    expect(extractContentForPrompt(raw)).toBe('这是正文。');
  });

  it('兜底路径：options 标签整体移除', () => {
    const raw = '正文。<options>选项A|选项B</options>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('兜底路径：action_options 标签整体移除', () => {
    const raw = '正文。<action_options>选项A|选项B</action_options>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('兜底路径：UpdateVariable 标签整体移除', () => {
    const raw = '正文。<UpdateVariable>[{"op":"replace","path":"/a","value":1}]</UpdateVariable>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('兜底路径：variable 标签整体移除', () => {
    const raw = '正文。<variable>data</variable>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('兜底路径：details + summary 整体移除', () => {
    const raw = '正文。<details><summary>标题</summary>详情</details>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  it('兜底路径：contenttext 标签整体移除（兜底时不提取内容）', () => {
    // 注意：兜底路径的 stripAllTags 会把 contenttext 整体移除，而不是提取内容
    // 这是因为兜底路径只有在没有匹配到 contenttext 时才会走到
    // 这里测试的是：如果 contenttext 存在但内容为空，仍走 contenttext 路径
    const raw = '<contenttext></contenttext>剩余文本';
    // contenttext 匹配到但内容为空，stripInnerTags('') = ''，trim() = ''
    expect(extractContentForPrompt(raw)).toBe('');
  });

  // ── 大小写不敏感 ──

  it('标签大小写不敏感：<CONTENTTEXT> 同样匹配', () => {
    const raw = '<CONTENTTEXT>正文</CONTENTTEXT>';
    expect(extractContentForPrompt(raw)).toBe('正文');
  });

  it('标签大小写不敏感：<THINKING> 同样移除', () => {
    const raw = '<contenttext><THINKING>思考</THINKING>正文。</contenttext>';
    expect(extractContentForPrompt(raw)).toBe('正文。');
  });

  // ── 复杂场景 ──

  it('混合标签 + 纯文本的正确提取', () => {
    const raw = [
      '<contenttext>',
      '<thinking>这是 AI 的内心独白</thinking>',
      '<analysis_block>系统分析</analysis_block>',
      '李明走进了酒馆。',
      '<Auto>环境描写：酒馆里弥漫着麦酒的香气</Auto>',
      '他向吧台走去。',
      '</contenttext>',
    ].join('\n');
    const result = extractContentForPrompt(raw);
    expect(result).toContain('李明走进了酒馆。');
    expect(result).toContain('他向吧台走去。');
    expect(result).not.toContain('内心独白');
    expect(result).not.toContain('系统分析');
    expect(result).not.toContain('环境描写');
  });

  it('多个 contenttext 标签只取第一个', () => {
    const raw = '<contenttext>第一段</contenttext><contenttext>第二段</contenttext>';
    // match 只取第一个，stripInnerTags('第一段') = '第一段'
    expect(extractContentForPrompt(raw)).toBe('第一段');
  });

  it('contenttext 标签带属性时仍能匹配', () => {
    // 正则 /<contenttext>([\s\S]*?)<\/contenttext>/i 不匹配带属性的标签
    // 带属性的 contenttext 会走兜底路径
    const raw = '<contenttext type="main">正文</contenttext>';
    // 兜底路径：stripAllTags 会移除 <contenttext...> 和 </contenttext> 标签本身
    // 但 /<contenttext>[\s\S]*?<\/contenttext>/gi 不匹配带属性的版本
    // 所以只剩下移除标签本身
    const result = extractContentForPrompt(raw);
    // stripAllTags 中的最后一条正则会移除 <contenttext...> 和 </contenttext>
    expect(result).toBe('正文');
  });
});
