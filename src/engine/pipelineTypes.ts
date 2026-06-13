// 管线类型定义
// 执行顺序：正文 → 记忆写入 → 摘要保存 → 检索规划 → 上下文编译 → 变量提取

/** 管线任务 ID */
export type PipelineTaskId =
  | 'main'              // 正文生成
  | 'memory_write'      // 叙事记忆写入（热态对象提取）
  | 'memory_summary'    // 摘要保存（3类记忆）
  | 'memory_retrieve'   // 检索规划（查询改写 → AI规划 → 多轮 → 精排）
  | 'memory_compile'    // 上下文编译（组装注入文本）
  | 'memory_vector'     // 向量事实提取
  | 'variable';         // 变量提取（最后执行）

/** 管线阶段状态 */
export type PipelineStageStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

/** 管线阶段结果 */
export interface PipelineStageResult {
  status: PipelineStageStatus;
  label: string;
  attempts?: number;
  maxAttempts?: number;
  dataLength?: number;
  error?: string;
  skipped?: boolean;
  startTime?: number;
  endTime?: number;
  /** 附加数据（如记忆条数、命中数等） */
  extra?: Record<string, unknown>;
}

/** 管线状态（快照，用于 UI 渲染） */
export interface PipelineStatus {
  round: number;
  stages: Record<PipelineTaskId, PipelineStageResult>;
  startTime: number;
  endTime?: number;
}

/** 管线执行配置 */
export interface PipelineConfig {
  /** 执行顺序：二维数组，同层并行，层间串行 */
  executionOrder: PipelineTaskId[][];
  /** 变量系统是否启用 */
  variableEnabled: boolean;
  /** 变量提取延迟（毫秒） */
  variableDelayMs: number;
  /** 变量提取最大重试次数 */
  variableMaxRetries: number;
  /** 记忆系统是否启用 */
  memoryEnabled: boolean;
}

/**
 * 默认执行顺序
 * 1. main — 正文生成（必须先完成，后续阶段依赖它的输出）
 * 2. memory_write + memory_summary + memory_vector — 三者可并行
 * 3. memory_retrieve — 检索规划（依赖摘要结果）
 * 4. memory_compile — 编译注入（依赖检索结果）
 * 5. variable — 变量提取（最后执行）
 */
export const DEFAULT_EXECUTION_ORDER: PipelineTaskId[][] = [
  ['main'],
  ['memory_write', 'memory_summary', 'memory_vector'],
  ['memory_retrieve'],
  ['memory_compile'],
  ['variable'],
];

/** 阶段标签 */
export const STAGE_LABELS: Record<PipelineTaskId, string> = {
  main: '正文生成',
  memory_write: '记忆写入',
  memory_summary: '摘要保存',
  memory_retrieve: '检索规划',
  memory_compile: '上下文编译',
  memory_vector: '向量提取',
  variable: '变量提取',
};

/** 创建默认管线状态 */
export function createPipelineStatus(round: number): PipelineStatus {
  return {
    round,
    stages: {
      main: { status: 'pending', label: STAGE_LABELS.main },
      memory_write: { status: 'pending', label: STAGE_LABELS.memory_write },
      memory_summary: { status: 'pending', label: STAGE_LABELS.memory_summary },
      memory_retrieve: { status: 'pending', label: STAGE_LABELS.memory_retrieve },
      memory_compile: { status: 'pending', label: STAGE_LABELS.memory_compile },
      memory_vector: { status: 'pending', label: STAGE_LABELS.memory_vector },
      variable: { status: 'pending', label: STAGE_LABELS.variable },
    },
    startTime: Date.now(),
  };
}

/** 从 localStorage 读取管线配置 */
export function loadPipelineConfig(): PipelineConfig {
  let variableEnabled = true;
  let variableDelayMs = 1000;
  let variableMaxRetries = 3;
  let memoryEnabled = true;

  try { variableEnabled = localStorage.getItem('world_travel_guide_variable_enabled') !== 'false'; } catch {}
  try {
    const sec = Math.max(0, Math.min(10, parseFloat(localStorage.getItem('world_travel_guide_variable_delay') || '1') || 1));
    variableDelayMs = sec * 1000;
  } catch {}
  try { variableMaxRetries = Math.max(0, Math.min(5, parseInt(localStorage.getItem('world_travel_guide_variable_retries') || '3') || 3)); } catch {}
  try { memoryEnabled = localStorage.getItem('world_travel_guide_memory_enabled') !== 'false'; } catch {}

  return {
    executionOrder: DEFAULT_EXECUTION_ORDER,
    variableEnabled,
    variableDelayMs,
    variableMaxRetries,
    memoryEnabled,
  };
}
