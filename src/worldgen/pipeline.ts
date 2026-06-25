// ============================================================
//  世界生成管线 v3 — 主入口
//  7 阶段深度管线：种子 → 骨架 → 维度并行 → 校验 → 深写 → 世界书合成 → 模块
// ============================================================

import type { WorldGenConfig, WorldGenContext, WorldGenResult } from './types';
import { executeStage0 } from './stages/stage0-seed';
import { executeStage1 } from './stages/stage1-skeleton';
import { executeStage2 } from './stages/stage2-dimensions';
import { executeStage3 } from './stages/stage3-consistency';
import { executeStage4 } from './stages/stage4-deep-detail';
import { executeStage5 } from './stages/stage5-worldbook';
import { executeStage6 } from './stages/stage6-modules';

/**
 * 执行世界生成管线
 *
 * 阶段0: 种子分析（1 call）
 * 阶段1: 世界骨架（1 call）
 * 阶段2: 维度并行生成（5-7 calls，并发限流）
 * 阶段3: 交叉校验（1 call）
 * 阶段4: 深度细节（2-3 calls，并发限流）
 * 阶段5: 世界书条目合成（纯代码）
 * 阶段6: 模块管线（复用 executeBuildPipeline）
 */
export async function executeWorldGenPipeline(
  userDesc: string,
  config: WorldGenConfig,
): Promise<WorldGenResult> {
  const ctx: WorldGenContext = {
    userDesc,
    config,
  };

  try {
    // 阶段0：种子分析
    ctx.seed = await executeStage0(ctx);

    // 阶段1：世界骨架
    ctx.skeleton = await executeStage1(ctx);

    // 阶段2：维度并行生成（5-7 calls，限流并发）
    ctx.dimensions = await executeStage2(ctx);

    // 阶段3：交叉校验
    ctx.consistencyPatch = await executeStage3(ctx);

    // 应用校验补丁（如果有）
    applyConsistencyPatch(ctx);

    // 阶段4：深度细节（2-3 calls，限流并发）
    ctx.deepDetails = await executeStage4(ctx);

    // 阶段5：世界书条目合成（纯代码）
    ctx.worldBookEntries = executeStage5(ctx);

    // 阶段6：模块管线
    const stage6Result = await executeStage6(ctx);
    ctx.modules = stage6Result.modules;
    // 合并模块生成的世界书条目（数值规则、成长规则等）
    if (stage6Result.moduleWorldBookEntries.length > 0) {
      ctx.worldBookEntries = [
        ...(ctx.worldBookEntries ?? []),
        ...stage6Result.moduleWorldBookEntries,
      ];
    }

    // 组装最终结果
    return {
      worldDef: {
        id: `custom_${Date.now()}`,
        name: ctx.skeleton.name,
        description: ctx.skeleton.oneLiner,
        icon: ctx.skeleton.icon,
        coverColor: undefined,
        tags: ctx.skeleton.tags,
        difficulty: ctx.skeleton.difficulty,
        entryId: null,
        modules: ctx.modules,
      },
      worldBookEntries: ctx.worldBookEntries,
    };
  } catch (err) {
    console.error('[WorldGenPipeline] 管线执行失败:', err);
    throw err;
  }
}

/** 应用一致性校验补丁 */
function applyConsistencyPatch(ctx: WorldGenContext) {
  if (!ctx.consistencyPatch || ctx.consistencyPatch.patches.length === 0) return;

  for (const patch of ctx.consistencyPatch.patches) {
    try {
      const target = ctx.dimensions?.[patch.target as keyof typeof ctx.dimensions];
      if (target && typeof target === 'object') {
        // 简单的字段替换（支持点号路径）
        const parts = patch.field.split('.');
        let obj: any = target;
        for (let i = 0; i < parts.length - 1; i++) {
          obj = obj?.[parts[i]];
        }
        if (obj) {
          obj[parts[parts.length - 1]] = patch.newValue;
        }
      }
    } catch {
      // 补丁应用失败，跳过
    }
  }
}
