// 模块默认值 — 最小 stub（v1.4 替换为完整实现）

export function createDefaultSurvivalModule(): any {
  return { description: '', resources: [], rules: { cycleName: '一天', consumePerCycle: '', criticalThreshold: 2 } };
}

export function createDefaultBusinessModule(): any {
  return { description: '', funds: 500, cycleName: '天', assets: [], market: { items: [] }, transactionLog: [] };
}

export function createDefaultDiceModule(): any {
  return { history: [] };
}

export function createDefaultTalentModule(): any {
  return { categories: [] };
}

export function createFallbackModule(moduleId: string, name: string): any {
  return { moduleId, name, description: '', enabled: true };
}
