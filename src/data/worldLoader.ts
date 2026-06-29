// 世界加载器 — 最小 stub（v1.5 替换为完整实现）
import type { WorldDef } from './worlds-schema';
import type { WorldBookEntry } from '../worldbook/index';

export const WORLDS: WorldDef[] = [];

export function getWorldById(id: string): WorldDef | undefined {
  return WORLDS.find(w => w.id === id);
}

export function findWorldDef(worldId: string): WorldDef | undefined {
  return WORLDS.find(w => w.id === worldId);
}

export function getWorldBookEntriesForWorld(worldId: string): WorldBookEntry[] {
  const world = findWorldDef(worldId);
  return (world?.worldBookEntries as WorldBookEntry[]) ?? [];
}
