// 骰子检定模块 — Prompt 模板

/** 骰子检定规则（固定，不需要AI生成） */
export const DICE_RULES_PROMPT = `【骰子检定系统】
当玩家进行有风险的行动时，使用骰子检定判定结果。

规则：掷1d20 + 属性修正值 vs 难度等级(DC)

【可检定属性】
- 六维属性（dim1-dim6）
- 特色属性（special中的任意属性）

【属性修正值计算】
修正值 = floor((属性值 - 10) / 2)

【难度等级(DC)】
- DC 5:  简单（普通人也能做到）
- DC 10: 普通（需要一定能力）
- DC 15: 困难（需要较高能力）
- DC 20: 极难（需要顶尖能力）
- DC 25: 传奇（几乎不可能）

【特殊骰】
- 自然20（骰出20，不含修正）：大成功，额外有利效果
- 自然1（骰出1，不含修正）：大失败，额外不利效果

在叙事中体现骰子结果的随机性和不确定性。`;

/** 运行时UpdateVariable规则 */
export const DICE_UPDATE_RULES = `【骰子检定更新规则】

掷骰后更新结果：
{"世界系统":{"骰子检定":{"lastRoll":{"attributeUsed":"dim1","d20":15,"modifier":2,"total":17,"dc":15,"success":true,"isNatural20":false,"isNatural1":false}}}}

AI也可以在叙事中触发骰子检定，但最终结果由框架计算，AI只记录。`;
