// 响应解析器 — 从原始 API 响应中按需提取结构化数据
// 设计原则：不修改原始文本，所有提取都是纯函数

/**
 * 从原始响应中提取纯正文（剥掉所有标签）
 * 用途：发给 AI API、变量提取、记忆系统
 */
export function extractContentForPrompt(rawText: string): string {
  if (!rawText) return '';

  // 优先提取 <contenttext> 标签内的内容
  const contentMatch = rawText.match(/<contenttext>([\s\S]*?)<\/contenttext>/i);
  if (contentMatch) {
    return stripInnerTags(contentMatch[1]).trim();
  }

  // 兜底：剥掉所有已知标签，剩余当正文
  return stripAllTags(rawText).trim();
}

/**
 * 从原始响应中提取思维链
 * 用途：MessageBubble 折叠显示
 */
export function extractThinking(rawText: string): string {
  if (!rawText) return '';

  // 闭合的 <thinking>
  const closed = rawText.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (closed) return closed[1].trim();

  // 未闭合的 <thinking>（到下一个已知标签或文末）
  const open = rawText.match(/<thinking>([\s\S]*?)(?=<\/?(?:contenttext|action_?options|Update|variable|summary|Auto|safe)|$)/i);
  if (open) return open[1].trim();

  return '';
}

/**
 * 从原始响应中提取行动选项
 * 用途：InputArea 选项卡片、ChatPanel 最新选项
 */
export function extractActionOptions(rawText: string): string[] {
  if (!rawText) return [];
  const options: string[] = [];

  // 提取 <action_options> 或 <options> 标签
  const tagMatch = rawText.match(/<(?:action_)?options>([\s\S]*?)<\/(?:action_)?options>/i);
  if (tagMatch) {
    parseOptionLines(tagMatch[1], options);
    if (options.length > 0) return options;
  }

  // 兜底：从文末提取列表格式选项
  extractTrailingOptions(rawText, options);
  return options;
}

/**
 * 从原始响应中提取摘要
 */
export function extractSummary(rawText: string): string | null {
  if (!rawText) return null;
  const match = rawText.match(/<summary>([\s\S]*?)<\/summary>/i);
  return match ? match[1].trim() : null;
}

/**
 * 渲染用于显示的文本
 * - 剥掉 <thinking>（单独显示）
 * - 剥掉 <contenttext> 开闭标签（保留内容）
 * - 保留 [OPTION] 标签（正则脚本会渲染成卡片）
 * - 剥掉其他元标签
 * 用途：MessageBubble 正文渲染
 */
export function renderForDisplay(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 剥掉 <thinking> 块（单独显示，不在此渲染）
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  text = text.replace(/<thinking>[\s\S]*?(?=<\/?(?:contenttext|action_?options|Update|variable|summary|Auto|safe)|$)/gi, '');

  // 剥掉元标签块
  text = text.replace(/<details>[\s\S]*?<\/details>/gi, '');
  text = text.replace(/<summary>[\s\S]*?<\/summary>/gi, '');
  text = text.replace(/<Auto>[\s\S]*?<\/Auto>/gi, '');
  text = text.replace(/<safe>[\s\S]*?<\/safe>/gi, '');
  text = text.replace(/<analysis_block>[\s\S]*?<\/analysis_block>/gi, '');
  text = text.replace(/<image[^>]*>[\s\S]*?<\/image>/gi, '');
  text = text.replace(/<imgthink[^>]*>[\s\S]*?<\/imgthink>/gi, '');

  // 剥掉 UpdateVariable 块
  text = text.replace(/<(?:Update)?[Vv]ariable>[\s\S]*?<\/(?:Update)?[Vv]ariable>/gi, '');

  // 剥掉开闭标签本身（但保留标签内的 [OPTION] 等文本内容）
  text = text.replace(/<\/?(?:contenttext|action_?options|options|details|summary|Auto|safe|StatusPlaceHolderImpl|thinking|analysis_block|image|imgthink|br|hr)[^>]*\/?>/gi, '');

  return text.trim();
}

// ── 内部工具函数 ──

/** 剥掉 contenttext 内部的子标签（thinking/details 等） */
function stripInnerTags(text: string): string {
  return text
    .replace(/<details>[\s\S]*?<\/details>/gi, '')
    .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
    .replace(/<Auto>[\s\S]*?<\/Auto>/gi, '')
    .replace(/<safe>[\s\S]*?<\/safe>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<analysis_block>[\s\S]*?<\/analysis_block>/gi, '')
    .replace(/<image[^>]*>[\s\S]*?<\/image>/gi, '')
    .replace(/<imgthink[^>]*>[\s\S]*?<\/imgthink>/gi, '')
    .replace(/<\/?(?:UpdateVariable|variable|action_options|options|details|summary|Auto|safe|StatusPlaceHolderImpl|thinking|analysis_block|contenttext|image|imgthink|br|hr)[^>]*\/?>/gi, '');
}

/** 剥掉所有已知标签（兜底用） */
function stripAllTags(text: string): string {
  return text
    .replace(/<contenttext>[\s\S]*?<\/contenttext>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<(?:action_)?options>[\s\S]*?<\/(?:action_)?options>/gi, '')
    .replace(/<(?:Update)?[Vv]ariable>[\s\S]*?<\/(?:Update)?[Vv]ariable>/gi, '')
    .replace(/<details>[\s\S]*?<\/details>/gi, '')
    .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
    .replace(/<Auto>[\s\S]*?<\/Auto>/gi, '')
    .replace(/<safe>[\s\S]*?<\/safe>/gi, '')
    .replace(/<analysis_block>[\s\S]*?<\/analysis_block>/gi, '')
    .replace(/<image[^>]*>[\s\S]*?<\/image>/gi, '')
    .replace(/<imgthink[^>]*>[\s\S]*?<\/imgthink>/gi, '')
    // 未闭合的 thinking
    .replace(/<thinking>[\s\S]*?(?=<\/?(?:contenttext|action_?options|Update|variable|summary|Auto|safe)|$)/gi, '')
    // 孤立标签
    .replace(/<\/?(?:UpdateVariable|variable|action_options|options|details|summary|Auto|safe|StatusPlaceHolderImpl|thinking|analysis_block|contenttext|image|imgthink|br|hr)[^>]*\/?>/gi, '');
}

/** 从选项文本中解析 [OPTION] 行 */
function parseOptionLines(text: string, options: string[]): void {
  const cleaned = text
    .replace(/<details>[\s\S]*?<\/details>/gi, '')
    .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
    .replace(/<Auto>[\s\S]*?<\/Auto>/gi, '')
    .replace(/<safe>[\s\S]*?<\/safe>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<analysis_block>[\s\S]*?<\/analysis_block>/gi, '')
    .replace(/<\/?(?:details|summary|Auto|safe|thinking|analysis_block|br|hr)[^>]*\/?>/gi, '')
    .replace(/^\s*可选行动[：:]\s*$/gm, '')
    .replace(/^\s*(?:核心活跃NPC|NPC.*行为链|当前状态|当前想法|长期目标|近期打算|关键记忆|部分构思|分析)[：:].*$/gm, '');

  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const opt = line.match(/^(?:[-•]\s+|(?:\d+[.)]\s+))(.+)/);
    if (opt) {
      const value = opt[1].trim()
        .replace(/<\/?(?:details|summary|Auto|safe|thinking|analysis_block)[^>]*\/?>/gi, '')
        .trim();
      if (value.length > 0 && value.length < 200) options.push(value);
    }
  }
}

/** 从文末提取列表格式选项（兜底） */
function extractTrailingOptions(text: string, options: string[]): void {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let collected: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const isHeading = /^[#*_~`]{1,3}|^<h[1-6]/i.test(line) || /^[-=]{3,}$/.test(line);
    if (isHeading) break;
    const opt = line.match(/^[-•]\s+(.+)/) || line.match(/^\d+[.)]\s+(.+)/);
    if (opt) {
      collected.unshift(opt[1].trim());
    } else if (collected.length > 0) {
      break;
    }
  }
  if (collected.length >= 2) {
    options.push(...collected.filter(o => o.length > 0 && o.length < 200));
  }
}

// ── 旧接口兼容 ──

/** @deprecated 旧接口，供还未迁移的代码使用 */
export interface ParsedResponse {
  content: string;
  thinking: string;
  actionOptions: string[];
  summary: string | null;
}

/** @deprecated 旧接口，供还未迁移的代码使用 */
export function parseResponse(rawText: string): ParsedResponse {
  return {
    content: extractContentForPrompt(rawText),
    thinking: extractThinking(rawText),
    actionOptions: extractActionOptions(rawText),
    summary: extractSummary(rawText),
  };
}
