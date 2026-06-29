// 记忆系统 Hook — 最小 stub（v1.2 替换为完整实现）

export interface MemoryPipelineContext {
  worldId: string;
  characterId: string;
  currentScene: string;
  recentMessages: Array<{ role: string; content: string }>;
  userText: string;
  variables: Record<string, unknown>;
}
