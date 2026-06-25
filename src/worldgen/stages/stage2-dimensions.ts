// 阶段2：维度并行生成

import type {
  WorldGenContext, DimensionResults, CallAI, WorldSkeleton,
  GeographyResult, FactionResult, NPCResult, EventResult,
  CultureResult, EconomyResult, RulesResult,
} from '../types';
import {
  buildGeographyPrompt, buildFactionsPrompt, buildNPCsPrompt,
  buildEventsPrompt, buildCulturePrompt, buildEconomyPrompt, buildRulesPrompt,
} from '../prompts/dimensions';

export async function executeStage2(ctx: WorldGenContext): Promise<DimensionResults> {
  const { callAI, onProgress, maxConcurrency = 2 } = ctx.config;
  const skeleton = ctx.skeleton!;

  onProgress?.('阶段2', '并行生成 7 个维度...');

  const tasks: Array<{ name: string; fn: () => Promise<unknown> }> = [
    { name: '地理', fn: () => generateGeography(skeleton, callAI) },
    { name: '势力', fn: () => generateFactions(skeleton, callAI) },
    { name: 'NPC', fn: () => generateNPCs(skeleton, callAI) },
    { name: '事件', fn: () => generateEvents(skeleton, callAI) },
    { name: '文化', fn: () => generateCulture(skeleton, callAI) },
    { name: '经济', fn: () => generateEconomy(skeleton, callAI) },
    { name: '规则', fn: () => generateRules(skeleton, callAI) },
  ];

  const results = await runWithConcurrency(tasks, maxConcurrency, onProgress);

  // 兜底：{} as T 不会触发 ??，需要检查实际属性
  const r = results as any[];
  return {
    geography: r[0]?.locations ? r[0] : { locations: [] },
    factions: r[1]?.factions ? r[1] : { factions: [] },
    npcs: r[2]?.npcs ? r[2] : { npcs: [] },
    events: r[3]?.events ? r[3] : { events: [] },
    culture: r[4]?.description ? r[4] : { description: '', customs: [], beliefs: [], dailyLife: '', taboos: [] },
    economy: r[5]?.currency ? r[5] : { description: '', currency: { name: '货币' }, priceLevel: '' },
    rules: r[6]?.powerSystem ? r[6] : { description: '', powerSystem: '', socialStructure: '', specialRules: [] },
  };
}

/** 并发执行器 */
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
        onProgress?.('阶段2', `${task.name} 完成 (${idx + 1}/${tasks.length})`);
      } catch {
        results[idx] = {} as T;
        onProgress?.('阶段2', `${task.name} 失败，使用兜底数据`);
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

// ── 各维度生成函数 ──

async function generateGeography(skeleton: WorldSkeleton, callAI: CallAI): Promise<GeographyResult> {
  const raw = await callAI([{ role: 'user', content: buildGeographyPrompt(skeleton) }]);
  const data = JSON.parse(extractJSON(raw));
  return { locations: Array.isArray(data.locations) ? data.locations : [] };
}

async function generateFactions(skeleton: WorldSkeleton, callAI: CallAI): Promise<FactionResult> {
  const raw = await callAI([{ role: 'user', content: buildFactionsPrompt(skeleton) }]);
  const data = JSON.parse(extractJSON(raw));
  return { factions: Array.isArray(data.factions) ? data.factions : [] };
}

async function generateNPCs(skeleton: WorldSkeleton, callAI: CallAI): Promise<NPCResult> {
  const raw = await callAI([{ role: 'user', content: buildNPCsPrompt(skeleton) }]);
  const data = JSON.parse(extractJSON(raw));
  return { npcs: Array.isArray(data.npcs) ? data.npcs : [] };
}

async function generateEvents(skeleton: WorldSkeleton, callAI: CallAI): Promise<EventResult> {
  const raw = await callAI([{ role: 'user', content: buildEventsPrompt(skeleton) }]);
  const data = JSON.parse(extractJSON(raw));
  return { events: Array.isArray(data.events) ? data.events : [] };
}

async function generateCulture(skeleton: WorldSkeleton, callAI: CallAI): Promise<CultureResult> {
  const raw = await callAI([{ role: 'user', content: buildCulturePrompt(skeleton) }]);
  const data = JSON.parse(extractJSON(raw));
  return {
    description: data.description || '',
    customs: Array.isArray(data.customs) ? data.customs : [],
    beliefs: Array.isArray(data.beliefs) ? data.beliefs : [],
    dailyLife: data.dailyLife || '',
    taboos: Array.isArray(data.taboos) ? data.taboos : [],
    languageFeatures: Array.isArray(data.languageFeatures) ? data.languageFeatures : [],
  };
}

async function generateEconomy(skeleton: WorldSkeleton, callAI: CallAI): Promise<EconomyResult> {
  const raw = await callAI([{ role: 'user', content: buildEconomyPrompt(skeleton) }]);
  const data = JSON.parse(extractJSON(raw));
  return {
    description: data.description || '',
    currency: data.currency || { name: '货币' },
    priceLevel: data.priceLevel || '',
    tradeRoutes: Array.isArray(data.tradeRoutes) ? data.tradeRoutes : [],
    scarceResources: Array.isArray(data.scarceResources) ? data.scarceResources : [],
    blackMarket: data.blackMarket || '',
  };
}

async function generateRules(skeleton: WorldSkeleton, callAI: CallAI): Promise<RulesResult> {
  const raw = await callAI([{ role: 'user', content: buildRulesPrompt(skeleton) }]);
  const data = JSON.parse(extractJSON(raw));
  return {
    description: data.description || '',
    powerSystem: data.powerSystem || '',
    socialStructure: data.socialStructure || '',
    specialRules: Array.isArray(data.specialRules) ? data.specialRules : [],
    physicalLaws: data.physicalLaws || '',
    magicOrTechSystem: data.magicOrTechSystem || '',
  };
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}
