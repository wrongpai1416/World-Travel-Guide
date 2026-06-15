import type { VariableManager } from './variableManager';
import type { WorldBookManager } from '../worldbook/index';
import type { GameState } from '../schema/variables';
import type { ParsedResponse } from './responseExtractor';
import type { AuxiliaryConfig } from '../api/auxiliaryApi';
import type { ApiConfig } from '../api/types';
import { callAuxiliaryApi, extractVariableRules } from '../api/auxiliaryApi';
import { eventBus, EVENTS } from './eventBus';
import { buildVariableExtractionPrompt } from '../utils/prompts';

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callAuxiliaryApiForEngine(
  config: AuxiliaryConfig | ApiConfig,
  worldBook: WorldBookManager | null,
  gameState: GameState,
  userMessage: string,
  aiContentText: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const variableSnapshot = JSON.stringify(gameState, null, 2);

  let worldBookRules = '';
  if (worldBook) {
    worldBookRules = extractVariableRules(worldBook.entries);
  }

  const messages: { role: string; content: string }[] = [
    { role: 'user', content: `[当前变量快照]: ${variableSnapshot}` },
  ];
  if (worldBookRules) {
    messages.push({ role: 'user', content: worldBookRules });
  }
  if (userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }
  messages.push({ role: 'assistant', content: aiContentText });

  const variableUpdatePrompt = buildVariableExtractionPrompt();

  return callAuxiliaryApi(config, messages, variableUpdatePrompt, signal);
}

export async function runVariableExtraction(params: {
  varMgr: VariableManager;
  parsed: ParsedResponse;
  round: number;
  userText: string;
  auxiliaryConfig: AuxiliaryConfig | null;
  mainApiConfig: ApiConfig;
  worldBook: WorldBookManager | null;
  delayMs: number;
  maxRetries: number;
}): Promise<void> {
  const { varMgr, parsed, round, userText, auxiliaryConfig, mainApiConfig, worldBook, delayMs, maxRetries } = params;

  // 选择 API 配置：优先辅助API，fallback 到主API
  const effectiveConfig = auxiliaryConfig ?? mainApiConfig;

  // 等待一段时间，让记忆系统的 API 调用完成，避免 429 限流
  const totalDelay = delayMs + 3000; // 额外等待 3 秒
  await sleep(totalDelay);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let updateText: string | null = null;

      // 始终通过独立 API 调用提取变量（正文和变量完全分离）
      if (parsed.content) {
        updateText = await callAuxiliaryApiForEngine(
          effectiveConfig,
          worldBook,
          varMgr.createSafeSnapshotForPrompt(),
          userText,
          parsed.content,
        );
      }

      if (updateText) {
        // 提取 <UpdateVariable> 标签内的 JSON 内容
        let jsonContent = updateText;
        const tagMatch = updateText.match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i);
        if (tagMatch) {
          jsonContent = tagMatch[1].trim();
        }

        varMgr.applyUpdateVariable(jsonContent);
      }

      eventBus.emit(EVENTS.VARIABLE_UPDATE_ENDED);
      return;
    } catch (err: unknown) {
      lastError = err;
      console.warn(`[变量提取] 第 ${attempt + 1}/${maxRetries + 1} 次失败:`, (err as Error).message || err);
      if (attempt < maxRetries) {
        await sleep(delayMs);
      }
    }
  }

  console.warn('[变量提取] 全部重试失败:', (lastError as Error)?.message || lastError);
  eventBus.emit(EVENTS.VARIABLE_UPDATE_ENDED);
}
