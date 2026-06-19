// ============================================================
//  世界模块化系统 v2 — WorldBook 注入器
//  将管线生成的世界书条目注入 WorldBookManager
// ============================================================

import type { WorldDef } from '../data/worlds-schema';
import type { WorldBookManager, WorldBookEntry } from '../worldbook/index';

/**
 * 将世界启用的模块注入为世界书条目
 * 使用管线生成的世界书条目（world.worldBookEntries）
 */
export function applyModulesV2(wb: WorldBookManager, world: WorldDef) {
  if (!world.modules || world.modules.length === 0) return;
  if (!world.worldBookEntries || world.worldBookEntries.length === 0) return;

  const entries: WorldBookEntry[] = world.worldBookEntries.map((e, idx) => ({
    id: -5000 - idx,
    comment: e.comment,
    content: e.content,
    constant: e.constant,
    enabled: !e.disable,
    selective: (e.key?.length ?? 0) > 0,
    keys: e.key || [],
    secondaryKeys: e.keysecondary || [],
    position: e.position || 'after_char',
    insertionOrder: e.order ?? 0,
  }));
  wb.addEntries(entries);
}
