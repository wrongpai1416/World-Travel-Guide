// ============================================================
//  世界模块化系统 v2 — 管线执行器
//  用于多步骤世界创建管线（主题提取 → 并行生成 → 资源生成 → 合成验证）
// ============================================================

import type { BuildContext } from './buildContext';
import type { StatModuleSchema, ProgressionModuleSchema, ResourceModuleSchema } from './schema';
import {
  buildStatThemePrompt,
  buildStatGenPrompt,
  buildProgressionGenPrompt,
  buildResourceGenPrompt,
} from './prompts';

export interface PipelineConfig {
  /** AI 调用函数（由外部注入，解耦API层） */
  callAI: (messages: Array<{ role: string; content: string }>) => Promise<string>;
  /** 进度回调 */
  onProgress?: (stage: string, detail: string) => void;
}

/**
 * 执行世界创建管线
 *
 * 阶段1: 主题提取 → WorldTheme
 * 阶段2: 并行生成（属性+成长）
 * 阶段3: 资源生成
 * 阶段4: 合成验证
 */
export async function executeBuildPipeline(
  ctx: BuildContext,
  config: PipelineConfig
): Promise<BuildContext> {
  const { callAI, onProgress } = config;
  const hasModule = (id: string) => ctx.selectedModules.includes(id);

  // ─── 阶段1：主题提取 ───
  if (hasModule('stat')) {
    onProgress?.('阶段1', '提取世界主题与属性命名...');
    const themePrompt = buildStatThemePrompt(ctx.description);
    const themeRaw = await callAI([{ role: 'user', content: themePrompt }]);
    try {
      const themeData = JSON.parse(extractJSON(themeRaw));
      ctx.theme = {
        theme: themeData.theme || '',
        tone: themeData.tone || '中等',
        era: themeData.era || '现代',
        attrAName: themeData.attrAName || '生命',
        attrBName: themeData.attrBName || '能量',
        dim1Name: themeData.dim1Name || '攻击',
        dim2Name: themeData.dim2Name || '防御',
        dim3Name: themeData.dim3Name || '速度',
        dim4Name: themeData.dim4Name || '智力',
        dim5Name: themeData.dim5Name || '魅力',
        dim6Name: themeData.dim6Name || '幸运',
      };
    } catch {
      // JSON解析失败，使用默认命名
      ctx.theme = {
        theme: '通用',
        tone: '中等',
        era: '现代',
        attrAName: '生命', attrBName: '能量',
        dim1Name: '攻击', dim2Name: '防御', dim3Name: '速度',
        dim4Name: '智力', dim5Name: '魅力', dim6Name: '幸运',
      };
    }
  }

  // ─── 阶段2：并行生成（属性 + 成长） ───
  const stage2Tasks: Promise<void>[] = [];

  if (hasModule('stat') && ctx.theme) {
    onProgress?.('阶段2', '生成属性系统...');
    stage2Tasks.push(
      (async () => {
        const statPrompt = buildStatGenPrompt({
          theme: ctx.theme!.theme,
          attrAName: ctx.theme!.attrAName,
          attrBName: ctx.theme!.attrBName,
          dim1Name: ctx.theme!.dim1Name,
          dim2Name: ctx.theme!.dim2Name,
          dim3Name: ctx.theme!.dim3Name,
          dim4Name: ctx.theme!.dim4Name,
          dim5Name: ctx.theme!.dim5Name,
          dim6Name: ctx.theme!.dim6Name,
        });
        const statRaw = await callAI([{ role: 'user', content: statPrompt }]);
        try {
          ctx.statData = JSON.parse(extractJSON(statRaw)) as StatModuleSchema;
        } catch { /* 解析失败则不设置 */ }
      })()
    );
  }

  if (hasModule('progression') && ctx.theme) {
    onProgress?.('阶段2', '生成成长体系...');
    stage2Tasks.push(
      (async () => {
        const progPrompt = buildProgressionGenPrompt({
          theme: ctx.theme!.theme,
          tone: ctx.theme!.tone,
          era: ctx.theme!.era,
        });
        const progRaw = await callAI([{ role: 'user', content: progPrompt }]);
        try {
          ctx.progressionData = JSON.parse(extractJSON(progRaw)) as ProgressionModuleSchema;
        } catch { /* 解析失败则不设置 */ }
      })()
    );
  }

  await Promise.all(stage2Tasks);

  // ─── 阶段3：资源生成 ───
  if (hasModule('resource') && ctx.theme) {
    onProgress?.('阶段3', '生成资源系统...');
    const statNames = ctx.statData
      ? [ctx.statData.dim1.name, ctx.statData.dim2.name, ctx.statData.dim3.name,
         ctx.statData.dim4.name, ctx.statData.dim5.name, ctx.statData.dim6.name,
         ...ctx.statData.special.map(s => s.name)].join('、')
      : '';
    const progressionInfo = ctx.progressionData
      ? ctx.progressionData.tiers.map(t => t.name).join('、')
      : '';

    const resPrompt = buildResourceGenPrompt({
      theme: ctx.theme.theme,
      tone: ctx.theme.tone,
      statNames,
      progressionInfo,
    });
    const resRaw = await callAI([{ role: 'user', content: resPrompt }]);
    try {
      ctx.resourceData = JSON.parse(extractJSON(resRaw)) as ResourceModuleSchema;
    } catch { /* 解析失败则不设置 */ }
  }

  // ─── 阶段4：合成验证 ───
  onProgress?.('阶段4', '合成验证...');
  ctx.result = synthesizeResult(ctx);

  return ctx;
}

/** 从AI回复中提取JSON字符串 */
function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const jsonMatch = text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();
  return text.trim();
}

/** 合成最终结果 */
function synthesizeResult(ctx: BuildContext): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (ctx.statData) {
    result.数值属性 = ctx.statData;
  }
  if (ctx.progressionData) {
    result.成长体系 = ctx.progressionData;
  }
  if (ctx.resourceData) {
    result.资源管理 = ctx.resourceData;
  }

  return result;
}
