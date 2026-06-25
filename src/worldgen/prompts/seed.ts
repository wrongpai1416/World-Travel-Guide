// 阶段0：种子分析 prompt

export function buildSeedPrompt(userDesc: string): string {
  return `你是一位世界设定分析专家。请分析以下世界描述，提取关键信息。

用户描述：${userDesc}

严格返回 JSON（不要 markdown），包含：
{
  "genre": "类型（如：末日废土、仙侠、赛博朋克、都市奇幻、历史架空、科幻）",
  "themes": ["主题1", "主题2", "主题3"],
  "tone": "基调（如：压抑沉重、轻松幽默、华丽史诗、写实冷峻）",
  "era": "时代背景（如：近未来、架空古代、现代、中世纪、星际时代）",
  "keyConcepts": ["核心概念1", "核心概念2", "核心概念3", "核心概念4", "核心概念5"],
  "targetAudience": "目标玩家群体描述"
}`;
}
