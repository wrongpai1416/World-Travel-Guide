// 世界数据加载器 —— 从 worlds/ 目录逐个加载，同时重新导出类型
import type { WorldDef, WorldBookEntryDef } from './worlds-schema';

// ── 逐个导入世界 JSON（Vite 会内联打包） ──
import cyberpunkCity from './worlds/cyberpunk_city.json';
import desireMetropolis from './worlds/desire_metropolis.json';
import wastelandApocalypse from './worlds/wasteland_apocalypse.json';
import japaneseSchool from './worlds/japanese_school.json';
import crystalWorld from './worlds/crystal_world.json';
import wuxiaWorld from './worlds/wuxia_world.json';
import palaceIntrigue from './worlds/palace_intrigue.json';

export type {
  WorldDef, FactionDef, PresetNPCDef,
  // ── v2.0 通用框架类型 ──
  StatDef, ProgressionDef, ConflictDef,
  ResourceDef, ResourceManagementDef,
  RelationType, RelationshipDef,
  WorldEventDef, PlaystyleGuideDef, NarrativeStyleDef,
  WorldBookEntryDef,
} from './worlds-schema';

/** 全部世界定义（从分拆文件加载） */
export const WORLDS: WorldDef[] = [
  ...(cyberpunkCity as unknown as WorldDef[]),
  ...(desireMetropolis as unknown as WorldDef[]),
  ...(wastelandApocalypse as unknown as WorldDef[]),
  ...(japaneseSchool as unknown as WorldDef[]),
  ...(crystalWorld as unknown as WorldDef[]),
  ...(wuxiaWorld as unknown as WorldDef[]),
  ...(palaceIntrigue as unknown as WorldDef[]),
];

/** 按 id 查找世界 */
export function getWorldById(id: string): WorldDef | undefined {
  return WORLDS.find(w => w.id === id);
}

/** 获取指定世界的嵌入式世界书条目（修复 entryId: null 问题） */
export function getWorldBookEntriesForWorld(worldId: string): WorldBookEntryDef[] {
  const world = getWorldById(worldId);
  return world?.worldBookEntries ?? [];
}
