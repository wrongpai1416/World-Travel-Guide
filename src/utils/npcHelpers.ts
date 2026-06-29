// NPC 辅助工具 — 最小 stub（v1.3 替换为完整实现）

export function formatSnapshotForMainAI(_snapshot: any): string { return ''; }
export function isNpcCreationPayload(_payload: any): boolean { return false; }
export function ensureNpcCategoryDefaults(npc: any): any { return npc; }
export function ensureNpcChronicleDefaults(npc: any): any { return npc; }
export function ensureNpcStructureDefaults(npc: any): any { return npc; }
export function createPromptSafeNpcSnapshot(npc: any): any { return npc; }
export function resolveNpcId(_data: any): string | null { return null; }
export function warnIgnoredNpcPatchUpdate(_patch: any, _existing: any): void {}
export function canCreateNpcFromPatch(_patch: any): boolean { return false; }
export function getCreatableNpcIdentifier(_patch: any): string | null { return null; }
