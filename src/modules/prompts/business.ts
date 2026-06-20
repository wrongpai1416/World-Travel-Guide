// 经营资产模块 — Prompt 模板

/** 阶段：经营资产生成（仅生成环境配置，不生成具体资产） */
export function buildBusinessGenPrompt(params: {
  theme: string;
  tone: string;
  userDesc?: string;
}): string {
  const userBlock = params.userDesc
    ? `\n\n玩家对经营系统的额外要求：\n${params.userDesc}`
    : '';

  return `为以下世界设计经营资产系统的环境配置：

世界主题：${params.theme}
基调：${params.tone}
${userBlock}

【设计要求】

1. 只生成经营环境配置，不要生成具体资产
2. 具体资产由玩家在游戏中通过角色行动获取（如：买下一家酒馆、承包一座矿场）
3. 你需要生成：
   - description: 经济环境描述（2-3句话，描述这个世界的经济状况）
   - cycleName: 结算周期名（"天"/"周"/"回合"，根据世界观选择）
   - funds: 初始资金（角色的起始资金，根据基调设定）
     - 末日/废土：50~150
     - 古代/宫廷：100~300
     - 都市/商战：200~500
     - 修仙/玄幻：50~200（灵石/仙玉等）
4. 可选生成 market（3~5个商品行情，有 basePrice 和 trend）
5. assets 数组留空（[]）

【输出JSON】
{
  "description": "经济环境描述（2-3句话）",
  "funds": 300,
  "cycleName": "天",
  "assets": [],
  "market": {
    "items": [
      { "name": "铁矿", "basePrice": 50, "trend": "stable", "changePercent": 0 },
      { "name": "粮食", "basePrice": 20, "trend": "up", "changePercent": 10 }
    ]
  },
  "transactionLog": []
}`;
}

/** 运行时 UpdateVariable 规则 */
export const BUSINESS_UPDATE_RULES = `【经营资产更新规则】
- 经营数据存放在 世界系统.经营资产 路径下
- 初始状态下玩家没有经营资产，需要通过角色行动获取
- 收购资产：当玩家在叙事中明确表达要购买/承包/开设经营项目时，将新资产 push 到 assets 数组，同时扣除 funds
  - 新资产必须包含完整字段：id, name, type, level(1), maxLevel, description, income, maintenance, status("active")
  - 收购前必须检查 funds 是否充足
- 升级资产：玩家要求升级时，修改 level（不能超过 maxLevel），扣除 upgradeCost
- 出售资产：从 assets 数组中移除，增加 funds（售价约为 upgradeCost * 0.5）
- 资产状态变化：受损时 status 改为 "damaged"（收入减半），被毁时改为 "destroyed"（收入归零）
- 每个资产的净收益（income.base + perLevel*(level-1) - maintenance）应为正数
- funds 不能为负数
- 经营日志：重大事件添加到 transactionLog 数组

UpdateVariable 格式示例：
{"世界系统":{"经营资产":{"funds":450,"assets":[{"id":"tavern","name":"酒馆","type":"餐饮","level":1,"maxLevel":3,"description":"...","income":{"base":30,"perLevel":15,"cycle":"天"},"maintenance":10,"status":"active"}]}}}`;
