// 经营资产模块 — Prompt 模板（占位，待设计完善）

/** 阶段：经营资产生成 */
export function buildBusinessGenPrompt(params: {
  theme: string;
  tone: string;
}): string {
  return `为以下世界设计经营资产系统（TODO: 待完善）：

世界主题：${params.theme}
基调：${params.tone}

输出JSON：
{
  "description": "..."
}`;
}

/** 运行时UpdateVariable规则（占位） */
export const BUSINESS_UPDATE_RULES = `【经营资产更新规则】（TODO: 待完善）`;
