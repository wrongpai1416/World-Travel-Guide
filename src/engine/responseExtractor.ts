// 从 AI 响应中提取结构化数据（contenttext / UpdateVariable / thinking / action_options / summary）
// 原 responseParser.ts 的标签提取逻辑，渲染部分已移至 utils/markdown.ts

export interface ParsedResponse {
  content: string;           // <contenttext>内的正文
  updateVariable: string | null; // <UpdateVariable>标签内容
  thinking: string;          // <thinking>思维链
  actionOptions: string[];   // <action_options>里的选项
  summary: string | null;    // <summary>摘要
  rawText: string;           // 原始全文
}

export function parseResponse(rawText: string): ParsedResponse {
  let content = '';
  let updateVariable: string | null = null;
  let thinking = '';
  let summary: string | null = null;
  const actionOptions: string[] = [];

  // 提取 <contenttext>
  const contentMatch = rawText.match(/<contenttext>([\s\S]*?)<\/contenttext>/i);
  if (contentMatch) {
    content = contentMatch[1].trim()
      // 先移除标签+内容（防止 AI 把思维链标签放进正文）
      .replace(/<details>[\s\S]*?<\/details>/gi, '')
      .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
      .replace(/<Auto>[\s\S]*?<\/Auto>/gi, '')
      .replace(/<safe>[\s\S]*?<\/safe>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<analysis_block>[\s\S]*?<\/analysis_block>/gi, '')
      .replace(/<image[^>]*>[\s\S]*?<\/image>/gi, '')
      .replace(/<imgthink[^>]*>[\s\S]*?<\/imgthink>/gi, '')
      // 移除残留的孤立标签
      .replace(/<\/?(?:UpdateVariable|variable|action_options|options|details|summary|Auto|safe|StatusPlaceHolderImpl|thinking|analysis_block|contenttext|image|imgthink|br|hr)[^>]*\/?>/gi, '')
      .trim();
  }

  // 提取 <UpdateVariable> (也兼容 <variable>)
  const updateMatch = rawText.match(/<(?:Update)?[Vv]ariable>([\s\S]*?)<\/(?:Update)?[Vv]ariable>/i);
  if (updateMatch) {
    updateVariable = updateMatch[1].trim();
  }

  // 提取 <thinking>
  const thinkMatch = rawText.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (thinkMatch) {
    thinking = thinkMatch[1].trim();
  }
  // 未闭合的 <thinking>
  if (!thinking) {
    const openThink = rawText.match(/<thinking>([\s\S]*?)(?=<\/?(?:contenttext|action_?options|Update|variable|summary|Auto|safe)|$)/i);
    if (openThink) thinking = openThink[1].trim();
  }

  // 提取 <summary>
  const summaryMatch = rawText.match(/<summary>([\s\S]*?)<\/summary>/i);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  }

  // 提取 <action_options> (也兼容 <options>)
  const actionMatch = rawText.match(/<(?:action_)?options>([\s\S]*?)<\/(?:action_)?options>/i);
  if (actionMatch) {
    // 先清除混入的标签内容
    const cleaned = actionMatch[1]
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
      // 支持 "- 选项" 或 "• 选项" 或 "1. 选项" 格式，只取行首匹配
      const opt = line.match(/^(?:[-•]\s+|(?:\d+[.)]\s+))(.+)/);
      if (opt) {
        const value = opt[1].trim()
          .replace(/<\/?(?:details|summary|Auto|safe|thinking|analysis_block)[^>]*\/?>/gi, '')
          .trim();
        if (value.length > 0 && value.length < 200) actionOptions.push(value);
      }
    }
  }

  // 备用提取：当没有 <action_options> 标签时，从正文末尾提取行动选项
  // 适配不使用标签的简洁系统提示词
  if (actionOptions.length === 0) {
    // 先清理标签，拿到纯文本
    const plainText = rawText
      .replace(/<(?:action_)?options>[\s\S]*?<\/(?:action_)?options>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<thinking>[\s\S]*/gi, '')
      .replace(/<integrity>[\s\S]*?<\/integrity>/gi, '')
      .replace(/<integrity>[\s\S]*/gi, '')
      .replace(/<details>[\s\S]*?<\/details>/gi, '')
      .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
      .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '')
      .replace(/<analysis_block>[\s\S]*?<\/analysis_block>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();

    // 从末尾向前扫描，收集连续的 "- xxx" 或 "• xxx" 行
    const allLines = plainText.split('\n').map(l => l.trim()).filter(Boolean);
    const collected: string[] = [];
    for (let i = allLines.length - 1; i >= 0; i--) {
      const line = allLines[i];
      // 匹配列表项格式
      const opt = line.match(/^(?:[-•]\s+|(?:\d+[.)]\s+))(.+)/);
      if (opt) {
        const value = opt[1].trim();
        if (value.length > 0 && value.length < 200) {
          collected.unshift(value);
        }
      } else if (collected.length > 0) {
        // 遇到非列表行且已收集到选项，停止
        // 但允许 "可选行动：" "推荐行动：" 等标题行
        if (/^(?:可选行动|推荐行动|行动选项|建议行动)[：:]/.test(line)) {
          continue;
        }
        break;
      }
    }
    // 至少 2 个选项才认为有效（避免误匹配正文中的列表）
    if (collected.length >= 2) {
      actionOptions.push(...collected);
    }
  }

  // 如果没有contenttext标签，用全文（去掉标签部分）
  if (!content) {
    content = rawText
      // 移除标签+内容
      .replace(/<(?:Update)?[Vv]ariable>[\s\S]*?<\/(?:Update)?[Vv]ariable>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<(?:action_)?options>[\s\S]*?<\/(?:action_)?options>/gi, '')
      .replace(/<analysis_block>[\s\S]*?<\/analysis_block>/gi, '')
      .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
      .replace(/<image[^>]*>[\s\S]*?<\/image>/gi, '')
      .replace(/<imgthink[^>]*>[\s\S]*?<\/imgthink>/gi, '')
      .replace(/<Auto>[\s\S]*?<\/Auto>/gi, '')
      .replace(/<safe>[\s\S]*?<\/safe>/gi, '')
      .replace(/<details>[\s\S]*?<\/details>/gi, '')
      // 移除未闭合的标签（从开标签到下一个已知标签或文末）
      .replace(/<thinking>[\s\S]*?(?=<\/?(?:contenttext|action_?options|Update|variable|summary|Auto|safe)|$)/gi, '')
      .replace(/<Auto>[\s\S]*?(?=<\/?(?:contenttext|action_?options|Update|variable|summary|thinking|safe)|$)/gi, '')
      .replace(/<safe>[\s\S]*?(?=<\/?(?:contenttext|action_?options|Update|variable|summary|thinking|Auto)|$)/gi, '')
      .replace(/<details>[\s\S]*?(?=<\/?(?:contenttext|action_?options|Update|variable|summary|thinking|Auto|safe)|$)/gi, '')
      // 移除残留的孤立标签
      .replace(/<\/?(?:UpdateVariable|variable|action_options|options|details|summary|Auto|safe|StatusPlaceHolderImpl|thinking|analysis_block|contenttext|image|imgthink|br|hr)[^>]*\/?>/gi, '')
      .trim();
  }

  return { content, updateVariable, thinking, actionOptions, summary, rawText };
}

// 提取内联思维链
export function extractInlineThinking(text: string): { cleaned: string; reasoning: string } {
  const closedMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (closedMatch) {
    return {
      cleaned: text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim(),
      reasoning: closedMatch[1].trim(),
    };
  }
  const openMatch = text.match(/<thinking>([\s\S]*?)(?=<\/?(?:contenttext|action_?options|Update|variable|summary|Auto|safe)|$)/i);
  if (openMatch) {
    return {
      cleaned: text.replace(/<thinking>[\s\S]*?(?=<\/?(?:contenttext|action_?options|Update|variable|summary|Auto|safe)|$)/gi, '').trim(),
      reasoning: openMatch[1].trim(),
    };
  }
  return { cleaned: text, reasoning: '' };
}
