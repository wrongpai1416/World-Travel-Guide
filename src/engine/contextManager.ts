// 上下文管理器 - 负责清理发送给AI的消息上下文
// 使用正则脚本系统替代硬编码的标签清理逻辑

import type { ChatMessage } from './types';
import type { Message } from '../api/types';
import { processRegexScripts } from '../utils/regexScripts';
import { getBuiltinPromptScripts } from '../data/builtinPresets';

/** 核心函数：清理消息上下文用于发送给AI */
export function sanitizeForContext(messages: ChatMessage[], currentRound: number): Message[] {
  const MAX_HISTORY = 20;
  const SUMMARY_DEPTH_THRESHOLD = 10;
  const promptScripts = getBuiltinPromptScripts();

  // 取最近N条消息
  const recentMessages = messages
    .filter(m => m.round < currentRound)
    .slice(-MAX_HISTORY);

  return recentMessages.map(m => {
    let content = m.content;

    if (m.role === 'assistant') {
      const depth = currentRound - m.round;

      // 用正则脚本清理所有元数据标签
      content = processRegexScripts(content, promptScripts, 'Output', depth);

      // 深度>10：只保留 summary（使用 ChatMessage 上已提取的 summary 字段）
      if (depth > SUMMARY_DEPTH_THRESHOLD) {
        content = m.summary || content;
      }
    }

    // 清理多余空行
    content = content.replace(/\n{3,}/g, '\n\n').trim();

    return { role: m.role, content };
  }).filter(m => m.content.length > 0);
}
