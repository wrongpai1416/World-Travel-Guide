// 模块 Schema — 最小 stub（v1.4 替换为完整实现）

export interface StatModuleSchema {
  attrA: { name: string; current: number; max: number };
  attrB: { name: string; current: number; max: number };
  dim1: { name: string; value: number; range: [number, number] };
  dim2: { name: string; value: number; range: [number, number] };
  dim3: { name: string; value: number; range: [number, number] };
  dim4: { name: string; value: number; range: [number, number] };
  dim5: { name: string; value: number; range: [number, number] };
  dim6: { name: string; value: number; range: [number, number] };
  special: any[];
}

export interface ProgressionModuleSchema {
  mode: string;
  tiers: any[];
  xpFormula: { baseXP: number; exponent: number; scaleFactor: number };
  currentTierIndex: number;
  currentXP: number;
}

export interface SurvivalModuleSchema {
  description: string;
  resources: any[];
  rules: { cycleName: string; consumePerCycle: string; criticalThreshold: number };
}

export interface BusinessModuleSchema {
  description: string;
  funds: number;
  cycleName: string;
  assets: any[];
  market: { items: any[] };
  transactionLog: any[];
}

export interface DiceModuleSchema {
  history: any[];
}

export interface TalentModuleSchema {
  categories: any[];
}

export interface WorldSystemData {
  [key: string]: unknown;
}
