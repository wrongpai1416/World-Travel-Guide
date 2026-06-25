// 阶段6：模块管线（复用现有 executeBuildPipeline）

import type { WorldGenContext } from '../types';
import type { WorldModule } from '../../data/worlds-schema';
import { executeBuildPipeline } from '../../modules/buildPipeline';
import { createBuildContext } from '../../modules/buildContext';

export async function executeStage6(ctx: WorldGenContext): Promise<WorldModule[]> {
  const { callAI, onProgress, selectedModules = [] } = ctx.config;

  if (selectedModules.length === 0) {
    return [];
  }

  onProgress?.('阶段6', '生成模块数据...');

  const worldDesc = ctx.skeleton?.overview || ctx.userDesc;
  const buildCtx = createBuildContext(worldDesc, selectedModules);

  try {
    await executeBuildPipeline(buildCtx, {
      callAI,
      onProgress: (stage, detail) => onProgress?.(`阶段6.${stage}`, detail),
    });

    // 从管线结果构建 modules 数组
    const moduleIdToKey: Record<string, string> = {
      stat: '数值属性', progression: '成长体系', survival: '生存资源',
      business: '经营资产', dice: '骰子检定', talent: '天赋体系',
    };

    return selectedModules.map(id => {
      const key = moduleIdToKey[id];
      const pipelineData = key ? buildCtx.result?.[key] : undefined;

      if (pipelineData && typeof pipelineData === 'object' && 'config' in pipelineData) {
        const { config, initialState } = pipelineData as any;
        let data: Record<string, unknown>;
        if (id === 'progression') {
          data = { ...config, currentTierIndex: initialState?.currentTierIndex ?? 0, currentXP: initialState?.currentXP ?? 0 };
        } else if (id === 'stat') {
          const s = initialState || {};
          const specialArr = Array.isArray(config.special) ? config.special.map((sp: any) => ({
            ...sp, value: s.special?.[sp.id] ?? sp.value ?? 0,
          })) : [];
          data = {
            attrA: { name: config.attrA?.name || '生命', current: s.attrA ?? config.attrA?.max ?? 100, max: config.attrA?.max ?? 100 },
            attrB: { name: config.attrB?.name || '能量', current: s.attrB ?? config.attrB?.max ?? 100, max: config.attrB?.max ?? 100 },
            dim1: { name: config.dim1?.name || '属性1', value: s.dim1Value ?? 50, range: config.dim1?.range ?? [0, 100] },
            dim2: { name: config.dim2?.name || '属性2', value: s.dim2Value ?? 50, range: config.dim2?.range ?? [0, 100] },
            dim3: { name: config.dim3?.name || '属性3', value: s.dim3Value ?? 50, range: config.dim3?.range ?? [0, 100] },
            dim4: { name: config.dim4?.name || '属性4', value: s.dim4Value ?? 50, range: config.dim4?.range ?? [0, 100] },
            dim5: { name: config.dim5?.name || '属性5', value: s.dim5Value ?? 50, range: config.dim5?.range ?? [0, 100] },
            dim6: { name: config.dim6?.name || '属性6', value: s.dim6Value ?? 50, range: config.dim6?.range ?? [0, 100] },
            special: specialArr,
          };
        } else {
          data = { ...config, ...initialState };
        }
        return {
          moduleId: id,
          name: key || id,
          description: '',
          enabled: true,
          moduleConfig: config,
          ...(initialState ? { initialState } : {}),
          data,
        };
      }

      // 兜底
      return {
        moduleId: id,
        name: key || id,
        description: '',
        enabled: true,
      };
    }) as WorldModule[];
  } catch (err) {
    console.warn('[stage6] 模块管线失败:', err);
    return selectedModules.map(id => ({
      moduleId: id,
      name: id,
      description: '',
      enabled: true,
    })) as WorldModule[];
  }
}
