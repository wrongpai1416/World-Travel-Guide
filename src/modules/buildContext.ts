// ============================================================
//  世界模块化系统 v2 — 管线 Context
//  管线执行过程中传递的上下文数据
// ============================================================

import type { StatModuleSchema, ProgressionModuleSchema, ResourceModuleSchema } from './schema';

/** 世界创建管线的上下文数据 */
export interface BuildContext {
  /** 世界描述（用户输入） */
  description: string;
  /** 用户选中的模块ID列表 */
  selectedModules: string[];
  /** 阶段1提取的主题信息 */
  theme?: {
    theme: string;
    tone: string;
    era: string;
    attrAName: string;
    attrBName: string;
    dim1Name: string;
    dim2Name: string;
    dim3Name: string;
    dim4Name: string;
    dim5Name: string;
    dim6Name: string;
  };
  /** 阶段2生成的属性数据 */
  statData?: StatModuleSchema;
  /** 阶段2生成的成长数据 */
  progressionData?: ProgressionModuleSchema;
  /** 阶段3生成的资源数据 */
  resourceData?: ResourceModuleSchema;
  /** 阶段4合成的最终结果 */
  result?: Record<string, unknown>;
}

/** 创建空的BuildContext */
export function createBuildContext(description: string, selectedModules: string[]): BuildContext {
  return { description, selectedModules };
}
