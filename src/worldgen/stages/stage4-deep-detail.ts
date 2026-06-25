// 阶段4：深度细节

import type { WorldGenContext, DeepDetailResults, CallAI } from '../types';
import { buildLocationDeepPrompt, buildFactionDeepPrompt, buildNPCDeepPrompt } from '../prompts/deep-detail';

export async function executeStage4(ctx: WorldGenContext): Promise<DeepDetailResults> {
  const { callAI, onProgress, maxConcurrency = 2 } = ctx.config;
  const skeleton = ctx.skeleton!;
  const dims = ctx.dimensions!;

  onProgress?.('阶段4', '深度细节...');

  // 只深写有内容的维度
  const tasks: Array<{ name: string; fn: () => Promise<any> }> = [];

  if (dims.geography.locations.length > 0) {
    tasks.push({
      name: '地点深写',
      fn: async () => {
        const raw = await callAI([{ role: 'user', content: buildLocationDeepPrompt(skeleton, dims.geography.locations) }]);
        const data = JSON.parse(extractJSON(raw));
        return Array.isArray(data.locations) ? data.locations : dims.geography.locations;
      },
    });
  }

  if (dims.factions.factions.length > 0) {
    tasks.push({
      name: '势力深写',
      fn: async () => {
        const raw = await callAI([{ role: 'user', content: buildFactionDeepPrompt(skeleton, dims.factions.factions) }]);
        const data = JSON.parse(extractJSON(raw));
        return Array.isArray(data.factions) ? data.factions : dims.factions.factions;
      },
    });
  }

  if (dims.npcs.npcs.length > 0) {
    tasks.push({
      name: 'NPC 深写',
      fn: async () => {
        const raw = await callAI([{ role: 'user', content: buildNPCDeepPrompt(skeleton, dims.npcs.npcs) }]);
        const data = JSON.parse(extractJSON(raw));
        return Array.isArray(data.npcs) ? data.npcs : dims.npcs.npcs;
      },
    });
  }

  // 并发执行
  const results = await runWithConcurrency(tasks, maxConcurrency, onProgress);

  // 兜底：{} as T 不会触发 ??，需要检查实际属性
  const loc = results[0] as any;
  const fac = results[1] as any;
  const npc = results[2] as any;

  return {
    locationDeep: (tasks.length >= 1 && Array.isArray(loc) && loc.length > 0) ? loc : dims.geography.locations,
    factionDeep: (tasks.length >= 2 && Array.isArray(fac) && fac.length > 0) ? fac : dims.factions.factions,
    npcDeep: (tasks.length >= 3 && Array.isArray(npc) && npc.length > 0) ? npc : dims.npcs.npcs,
  };
}

async function runWithConcurrency<T>(
  tasks: Array<{ name: string; fn: () => Promise<T> }>,
  maxConcurrency: number,
  onProgress?: (stage: string, detail: string) => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      const task = tasks[idx];
      try {
        results[idx] = await task.fn();
        onProgress?.('阶段4', `${task.name} 完成`);
      } catch {
        results[idx] = {} as T;
        onProgress?.('阶段4', `${task.name} 失败，使用原始数据`);
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}
