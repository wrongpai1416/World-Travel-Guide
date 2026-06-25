// 阶段1：世界骨架

import type { WorldGenContext, WorldSkeleton } from '../types';
import { buildSkeletonPrompt } from '../prompts/skeleton';

export async function executeStage1(ctx: WorldGenContext): Promise<WorldSkeleton> {
  const { callAI, onProgress } = ctx.config;
  onProgress?.('阶段1', '生成世界骨架...');

  const prompt = buildSkeletonPrompt(ctx.userDesc, ctx.seed!);
  const raw = await callAI([{ role: 'user', content: prompt }]);
  const data = JSON.parse(extractJSON(raw));

  return {
    name: data.name || '未命名世界',
    oneLiner: data.oneLiner || '',
    overview: data.overview || '',
    worldScale: data.worldScale || 'medium',
    timePeriod: data.timePeriod || '',
    locationNames: Array.isArray(data.locationNames) ? data.locationNames : [],
    factionNames: Array.isArray(data.factionNames) ? data.factionNames : [],
    npcRoles: Array.isArray(data.npcRoles) ? data.npcRoles : [],
    eventNames: Array.isArray(data.eventNames) ? data.eventNames : [],
    coreConflict: data.coreConflict || '',
    icon: data.icon || 'Globe',
    tags: Array.isArray(data.tags) ? data.tags : [],
    difficulty: data.difficulty || 'medium',
  };
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}
