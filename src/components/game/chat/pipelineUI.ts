// ============================================================
// 管线 UI 共享常量 — PipelineMonitorModal 和 PipelineStatus 共用
// ============================================================

import type { PipelineTaskId } from '../../../engine/pipelineTypes';
import { PenLine, BookOpen, Search, Puzzle, Database, Variable } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** 阶段视觉配置（图标 + 颜色 + 描述） */
export const STAGE_META: Record<PipelineTaskId, { icon: LucideIcon; color: string; desc: string }> = {
  main:            { icon: PenLine,   color: '#3b82f6', desc: 'AI 生成正文回复' },
  memory_write:    { icon: BookOpen,  color: '#10b981', desc: '提取热态对象（场景/线程/关系/事件/实体）' },
  memory_summary:  { icon: BookOpen,  color: '#06b6d4', desc: '保存 3 类记忆（本层摘要/角色/物品）' },
  memory_vector:   { icon: Database,  color: '#14b8a6', desc: '提取长期向量事实' },
  memory_retrieve: { icon: Search,    color: '#8b5cf6', desc: '查询改写 → AI 规划 → 关键词匹配 → 精排' },
  memory_compile:  { icon: Puzzle,    color: '#f59e0b', desc: '组装记忆上下文注入系统提示词' },
  variable:        { icon: Variable,  color: '#ef4444', desc: '提取游戏变量更新' },
};

/** 阶段执行顺序 */
export const STAGE_ORDER: PipelineTaskId[] = ['main', 'memory_write', 'memory_summary', 'memory_vector', 'memory_retrieve', 'memory_compile', 'variable'];

/** 状态视觉配置 */
export const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'var(--text-muted)', label: '等待中' },
  running: { color: 'var(--accent)', label: '执行中...' },
  success: { color: '#4caf50', label: '已完成' },
  error:   { color: '#f44336', label: '异常' },
  skipped: { color: 'var(--text-muted)', label: '已跳过' },
};

/** 格式化毫秒数 */
export function formatMs(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
