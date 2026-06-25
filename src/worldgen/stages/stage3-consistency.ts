// 阶段3：交叉校验

import type { WorldGenContext, ConsistencyPatch } from '../types';
import { buildConsistencyPrompt } from '../prompts/consistency';

export async function executeStage3(ctx: WorldGenContext): Promise<ConsistencyPatch> {
  const { callAI, onProgress } = ctx.config;
  onProgress?.('阶段3', '交叉校验...');

  try {
    const prompt = buildConsistencyPrompt(ctx.skeleton!, ctx.dimensions!);
    const raw = await callAI([{ role: 'user', content: prompt }]);
    const data = JSON.parse(extractJSON(raw));
    return { patches: Array.isArray(data.patches) ? data.patches : [] };
  } catch {
    // 校验失败跳过
    return { patches: [] };
  }
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}
