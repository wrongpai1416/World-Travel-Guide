// 辅助 API 客户端 - 从 AI 回复中提取变量更新
// 基于酒馆助手脚本-辅助api.json 的逻辑

import type { ApiConfig } from './types';
import { buildEndpoint } from './client';

export interface AuxiliaryConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

// 调用变量提取 API（辅助API 或 主API fallback）
export async function callAuxiliaryApi(
  config: AuxiliaryConfig | ApiConfig,
  messages: { role: string; content: string }[],
  variableUpdatePrompt: string,
  signal?: AbortSignal,
): Promise<string | null> {
  // 统一处理两种配置类型
  let url: string;
  let apiKey: string;
  let model: string;

  if ('baseUrl' in config) {
    // ApiConfig: 使用标准 endpoint 构建
    url = buildEndpoint(config);
    apiKey = config.apiKey;
    model = config.model;
  } else {
    // AuxiliaryConfig: 保持原有逻辑
    const { endpoint, apiKey: auxKey, model: auxModel } = config;
    url = endpoint.endsWith('/') ? endpoint + 'chat/completions' : endpoint + '/chat/completions';
    apiKey = auxKey;
    model = auxModel;
  }

  // 构建完整消息列表，最后加上变量更新指令
  const fullMessages = [
    ...messages,
    { role: 'user', content: variableUpdatePrompt },
  ];

  const body = {
    model,
    messages: fullMessages,
    temperature: 0.8,
    stream: false,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    throw new Error(`辅助 API 请求失败: ${resp.status}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  // 提取 <UpdateVariable> 标签
  const match = content.match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i);
  return match ? match[0].trim() : null;
}

// 从世界书提取变量更新规则
export function extractVariableRules(entries: { comment: string; content: string; enabled: boolean }[]): string {
  return entries
    .filter(e => e.enabled && e.comment.includes('[mvu_update]'))
    .map(e => e.content)
    .filter(Boolean)
    .join('\n\n');
}
