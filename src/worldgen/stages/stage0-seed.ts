// 阶段0：种子分析

import type { WorldGenContext, WorldSeed, CallAI } from '../types';
import { buildSeedPrompt } from '../prompts/seed';

export async function executeStage0(ctx: WorldGenContext): Promise<WorldSeed> {
  const { callAI, onProgress } = ctx.config;
  onProgress?.('阶段0', '分析世界描述...');

  const prompt = buildSeedPrompt(ctx.userDesc);
  const raw = await callAI([{ role: 'user', content: prompt }]);
  const data = JSON.parse(extractJSON(raw));

  return {
    genre: data.genre || '奇幻',
    themes: Array.isArray(data.themes) ? data.themes : ['冒险'],
    tone: data.tone || '中等',
    era: data.era || '架空',
    keyConcepts: Array.isArray(data.keyConcepts) ? data.keyConcepts : [],
    targetAudience: data.targetAudience || '通用玩家',
  };
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}
