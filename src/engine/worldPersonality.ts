import { type WorldBookManager, type WorldBookEntry, createWorldBookManager, parseWorldBook } from '../worldbook/index';
import { WORLDS, getWorldBookEntriesForWorld } from '../data/worldLoader';

export async function loadWorldBook(): Promise<WorldBookManager | null> {
  try {
    const resp = await fetch('/card.json');
    if (!resp.ok) return null;
    const cardData = await resp.json();
    return createWorldBookManager(parseWorldBook(cardData));
  } catch { return null; }
}

/**
 * 将世界专属条目应用到世界书管理器
 * - 禁用所有 [WB] 前缀的条目（card.json 中的通用条目）
 * - 如果世界有 entryId，启用该条目（旧模式兼容）
 * - 如果世界有 worldBookEntries，将它们添加到管理器（v2.0 新模式）
 */
export function applyWorld(wb: WorldBookManager, worldId: string) {
  wb.disableEntriesByPrefix('[WB]');

  if (worldId !== 'default') {
    const world = WORLDS.find(w => w.id === worldId);

    // 旧模式兼容：通过 entryId 启用
    if (world?.entryId != null) {
      wb.enableEntry(world.entryId);
    }

    // v2.0 新模式：加载嵌入式世界书条目
    const worldBookEntries = getWorldBookEntriesForWorld(worldId);
    if (worldBookEntries.length > 0) {
      const converted: WorldBookEntry[] = worldBookEntries.map((e, idx) => ({
        id: -(idx + 1),  // 负数 ID 避免与 card.json 条目冲突
        comment: e.comment,
        content: e.content,
        constant: e.constant,
        enabled: !e.disable,
        selective: (e.key?.length ?? 0) > 0,
        keys: e.key ?? [],
        secondaryKeys: e.keysecondary ?? [],
        position: e.position ?? 'after_char',
        insertionOrder: e.order ?? 0,
      }));
      wb.addEntries(converted);
    }
  }
}
