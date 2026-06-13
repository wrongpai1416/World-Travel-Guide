// 提示词组装器 —— 从结构化 prompts[] 构建完整的系统提示
// 替代 useGameEngine.ts 中的内联字符串拼接

import type { PresetPack, PresetPromptEntry } from '../data/builtinPresets';
import { getEnabledPrompts, filterTriggeredPrompts } from '../data/builtinPresets';
import type { MacroEngine } from './macroEngine';

/** 组装器上下文 —— 包装所有需要注入到 prompt 的数据 */
export interface AssemblerContext {
  /** 变量快照（序列化的 GameState） */
  varSnapshot: string;
  /** 世界书注入内容 */
  wbInjection: string;
  /** 玩家档案区块 */
  playerProfileBlock: string;
  /** 角色认知防火墙标题 */
  firewallTitle: string;
  /** 角色认知防火墙内容 */
  firewallContent: string;
  /** 当前用户输入文本（用于 green 触发过滤） */
  userText: string;
  /** 当前轮次 */
  round: number;
  /** 宏引擎实例 */
  macroEngine: MacroEngine;
  /** 编译后的记忆上下文（来自记忆系统） */
  compiledMemoryContext?: string;
}

/**
 * 从结构化预设包组装完整的系统提示
 *
 * 组装顺序：
 * 1. 世界书注入 (wbInjection)
 * 2. 玩家档案 (playerProfileBlock)
 * 3. 角色认知防火墙 (firewall)
 * 4. 预设提示词条目（按 order 排序，过滤 enabled + 触发模式）
 *
 * 每个条目的 content 在拼接前通过 macroEngine.resolve() 解析宏
 */
export function assembleSystemPrompt(
  preset: PresetPack,
  ctx: AssemblerContext,
): string {
  // 1. 获取已启用的条目并按 order 排序
  const enabled = getEnabledPrompts(preset);

  // 2. 过滤 green 触发的条目
  const triggered = filterTriggeredPrompts(enabled, ctx.userText);

  // 3. 解析每个条目的宏并拼接
  const resolvedParts = triggered.map(entry => {
    let content = entry.content;

    // 替换 {{VAR_SNAPSHOT}} 占位符（延迟绑定）
    content = content.replace(/\{\{VAR_SNAPSHOT\}\}/gi, ctx.varSnapshot);

    // 通过宏引擎解析其他宏
    content = ctx.macroEngine.resolve(content);

    return content;
  });

  const presetBody = resolvedParts.join('\n\n');

  // 4. 组装最终系统提示（前置部分 + 预设主体）
  const parts: string[] = [];

  if (ctx.wbInjection) {
    parts.push(ctx.wbInjection);
  }

  if (ctx.playerProfileBlock) {
    parts.push(ctx.playerProfileBlock);
  }

  if (ctx.firewallTitle && ctx.firewallContent) {
    parts.push(`${ctx.firewallTitle}\n${ctx.firewallContent}`);
  }

  // 注入记忆上下文（如果有）
  if (ctx.compiledMemoryContext) {
    parts.push(ctx.compiledMemoryContext);
  }

  parts.push(presetBody);

  return parts.join('\n\n');
}

/**
 * 从旧版 monolithic systemPrompt 构建（向后兼容）
 * 当 preset 没有 prompts[] 时使用
 */
export function assembleSystemPromptLegacy(
  systemPromptTemplate: string,
  ctx: AssemblerContext,
): string {
  // 替换 {{VAR_SNAPSHOT}}
  let resolved = systemPromptTemplate.replace(/\{\{VAR_SNAPSHOT\}\}/gi, ctx.varSnapshot);
  // 宏解析
  resolved = ctx.macroEngine.resolve(resolved);

  const parts: string[] = [];
  if (ctx.wbInjection) parts.push(ctx.wbInjection);
  if (ctx.playerProfileBlock) parts.push(ctx.playerProfileBlock);
  if (ctx.firewallTitle && ctx.firewallContent) {
    parts.push(`${ctx.firewallTitle}\n${ctx.firewallContent}`);
  }
  parts.push(resolved);

  return parts.join('\n\n');
}
