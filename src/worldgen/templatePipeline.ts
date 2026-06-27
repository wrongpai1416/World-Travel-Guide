// ============================================================
//  模板管线 — 将模板系统接入世界生成管线
//
//  提供两种模式：
//  1. 纯模板模式（0次AI调用）：直接用模板数据生成完整世界
//  2. AI增强模式（1-2次AI调用）：用模板作为骨架，AI丰富细节
// ============================================================

import type { WorldGenResult, WorldGenConfig } from './types';
import type { WorldTemplate, VariableValues } from '../data/worldTemplates/types';
import { buildWorldFromTemplate } from '../data/worldTemplates/engine';

export interface TemplateGenConfig {
  /** 选择的模板 */
  template: WorldTemplate;
  /** 用户填写的变量值 */
  variables: VariableValues;
  /** 世界生成配置（含 AI 调用函数） */
  worldGenConfig?: WorldGenConfig;
  /** 是否用 AI 丰富模板内容（默认 false） */
  enrichWithAI?: boolean;
  /** 选择的模块（覆盖模板默认值） */
  selectedModules?: string[];
  /** 进度回调 */
  onProgress?: (stage: string, detail: string) => void;
}

/**
 * 使用模板生成世界（替代 executeWorldGenPipeline）
 *
 * 纯模板模式（enrichWithAI=false）：
 *   直接用模板 + 变量替换生成完整世界，0 次 AI 调用。
 *   适合移动端、弱网环境、或用户想快速开始游戏的场景。
 *
 * AI 增强模式（enrichWithAI=true）：
 *   先用模板生成骨架，然后用 1-2 次 AI 调用丰富地点描述和 NPC 背景。
 *   适合想要更丰富内容但又不想等太久的场景。
 */
export async function executeTemplatePipeline(config: TemplateGenConfig): Promise<WorldGenResult> {
  const { template, variables, enrichWithAI = false, onProgress } = config;

  onProgress?.('模板', '正在从模板构建世界...');

  // 1. 用模板引擎生成基础数据
  const buildResult = buildWorldFromTemplate({
    template,
    variables,
    selectedModules: config.selectedModules,
  });

  onProgress?.('模板', '世界骨架构建完成');

  // 2. 如果启用 AI 增强，用 AI 丰富内容
  if (enrichWithAI && config.worldGenConfig?.callAI) {
    onProgress?.('AI增强', '正在用 AI 丰富世界细节...');
    try {
      await enrichDimensionsWithAI(config.worldGenConfig.callAI, buildResult, template, variables, onProgress);
      onProgress?.('AI增强', 'AI 丰富完成');
    } catch (err) {
      console.warn('[TemplatePipeline] AI 增强失败，使用纯模板数据:', err);
      onProgress?.('AI增强', 'AI 增强失败，使用纯模板数据');
    }
  }

  // 3. 组装最终结果
  onProgress?.('模板', '正在组装最终世界定义...');

  const worldName = variables.worldName || template.name;

  return {
    worldDef: {
      id: `template_${template.id}_${Date.now()}`,
      name: worldName,
      description: buildResult.skeleton.oneLiner,
      icon: template.scaffold.icon,
      coverColor: template.coverColor,
      tags: buildResult.skeleton.tags,
      difficulty: template.scaffold.difficulty,
      entryId: null,
      modules: buildResult.modules,
    },
    worldBookEntries: buildResult.worldBookEntries,
  };
}

// ═══════════════════════════════════════════════════════════════
//  AI 增强逻辑
// ═══════════════════════════════════════════════════════════════

type CallAI = (messages: Array<{ role: string; content: string }>) => Promise<string>;

/**
 * 用 AI 丰富模板生成的内容
 * 只做轻量级增强：丰富地点描述、NPC 背景、核心矛盾细节
 * 不重新生成任何结构，只在现有框架上添加细节
 */
async function enrichDimensionsWithAI(
  callAI: CallAI,
  buildResult: ReturnType<typeof buildWorldFromTemplate>,
  template: WorldTemplate,
  variables: VariableValues,
  onProgress?: (stage: string, detail: string) => void,
) {
  const worldName = variables.worldName || template.name;

  // 构建增强 prompt — 一次性请求 AI 丰富所有维度
  const enrichPrompt = `你是一个世界构建助手。以下是一个已构建好的世界设定框架，请你为每个维度添加 1-2 句生动的细节描写，使世界更加丰满。不要改变任何结构，只在现有内容上润色和补充。

世界名称：${worldName}
世界类型：${template.category} - ${template.name}

当前地点列表：
${buildResult.dimensions.geography.locations.map(l => `- ${l.name}：${l.description}`).join('\n')}

当前势力列表：
${buildResult.dimensions.factions.factions.map(f => `- ${f.name}：${f.description}`).join('\n')}

当前NPC列表：
${buildResult.dimensions.npcs.npcs.map(n => `- ${n.name}（${n.role}）：${n.description}`).join('\n')}

请以 JSON 格式返回丰富后的内容：
{
  "locationEnrichments": [
    { "name": "地点名", "enrichedDescription": "丰富后的描述（保留原有内容，添加细节）" }
  ],
  "factionEnrichments": [
    { "name": "势力名", "enrichedDescription": "丰富后的描述" }
  ],
  "npcEnrichments": [
    { "name": "NPC名", "enrichedDescription": "丰富后的描述", "enrichedBackground": "丰富后的背景（如有）" }
  ]
}

只返回 JSON，不要添加其他文字。`;

  try {
    const raw = await callAI([{ role: 'user', content: enrichPrompt }]);
    const data = JSON.parse(extractJSON(raw));

    // 应用地点增强
    if (Array.isArray(data.locationEnrichments)) {
      for (const enrichment of data.locationEnrichments) {
        const loc = buildResult.dimensions.geography.locations.find(
          l => l.name === enrichment.name,
        );
        if (loc && enrichment.enrichedDescription) {
          loc.description = enrichment.enrichedDescription;
          // 同步更新世界书条目
          const entry = buildResult.worldBookEntries.find(
            e => e.entryType === 'lore' && e.comment === loc.name,
          );
          if (entry) {
            entry.content = `【${loc.name}】\n${loc.description}`;
          }
        }
      }
    }

    // 应用势力增强
    if (Array.isArray(data.factionEnrichments)) {
      for (const enrichment of data.factionEnrichments) {
        const faction = buildResult.dimensions.factions.factions.find(
          f => f.name === enrichment.name,
        );
        if (faction && enrichment.enrichedDescription) {
          faction.description = enrichment.enrichedDescription;
        }
      }
      // 更新势力世界书条目
      const factionEntry = buildResult.worldBookEntries.find(e => e.entryType === 'factions');
      if (factionEntry) {
        factionEntry.content = buildResult.dimensions.factions.factions.map(f =>
          `【${f.name}】阵营：${f.alignment}\n${f.description}${f.headquarters ? `\n总部：${f.headquarters}` : ''}${f.philosophy ? `\n理念：${f.philosophy}` : ''}`,
        ).join('\n\n');
      }
    }

    // 应用 NPC 增强
    if (Array.isArray(data.npcEnrichments)) {
      for (const enrichment of data.npcEnrichments) {
        const npc = buildResult.dimensions.npcs.npcs.find(
          n => n.name === enrichment.name,
        );
        if (npc) {
          if (enrichment.enrichedDescription) npc.description = enrichment.enrichedDescription;
          if (enrichment.enrichedBackground) npc.background = enrichment.enrichedBackground;
        }
      }
      // 更新 NPC 世界书条目
      const npcEntry = buildResult.worldBookEntries.find(e => e.entryType === 'npcs');
      if (npcEntry) {
        npcEntry.content = buildResult.dimensions.npcs.npcs.map(n =>
          `【${n.name}】${n.role}\n${n.description}${n.personality ? `\n性格：${n.personality}` : ''}`,
        ).join('\n\n');
      }
    }
  } catch (err) {
    console.warn('[TemplatePipeline] AI 增强解析失败:', err);
  }
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch
    ? codeBlockMatch[1].trim()
    : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}
