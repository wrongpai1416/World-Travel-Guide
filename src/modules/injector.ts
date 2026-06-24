// ============================================================
//  世界模块化系统 v2 — WorldBook 注入器
// ============================================================

import type { WorldDef } from '../data/worlds-schema';
import type { WorldBookManager, WorldBookEntry } from '../worldbook/index';

/**
 * 将世界启用的模块注入为世界书条目
 *
 * 职责划分：
 * - applyWorld()（在 worldPersonality.ts 中）负责加载 worldBookEntries
 *   （包含叙事条目和模块规则条目），这是唯一真相源
 * - applyModulesV2() 不再重复读取 worldBookEntries
 *
 * 此函数当前为 no-op，保留接口以备将来需要从 modules 配置
 * 动态生成额外条目时使用。
 */
export function applyModulesV2(_wb: WorldBookManager, _world: WorldDef) {
  // worldBookEntries 已由 applyWorld() 统一加载，不再重复注入
}
