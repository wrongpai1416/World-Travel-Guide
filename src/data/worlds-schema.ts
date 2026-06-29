// 世界定义 Schema — 最小 stub（v1.5 替换为完整实现）

export interface WorldModule {
  moduleId: string;
  name: string;
  description?: string;
  enabled: boolean;
  moduleConfig?: any;
  initialState?: any;
  data?: any;
}

export interface WorldDef {
  id: string;
  name: string;
  description: string;
  genre: string;
  tags: string[];
  icon?: string;
  modules?: string[];
  worldBookEntries?: any[];
  playerProfile?: any;
  npcs?: any[];
  variables?: Record<string, unknown>;
}
