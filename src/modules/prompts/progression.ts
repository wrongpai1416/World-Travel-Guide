// 成长体系模块 — Prompt 模板

/** 阶段2c：成长体系生成 */
export function buildProgressionGenPrompt(params: {
  theme: string;
  tone: string;
  era: string;
}): string {
  return `为以下世界设计成长体系：

世界主题：${params.theme}
基调：${params.tone}
时代：${params.era}

【必须选择一种模式】

模式A - 段位制（适合慢节奏、有明显质变的世界）：
- 段位数：4-10个
- 特点：每个段位之间有明显的实力差距
- 适用：修仙/武侠/宫斗/奇幻

模式B - 等级制（适合快节奏、平滑成长的世界）：
- 等级数：10-100级
- 特点：每级提升较小，累积效果明显
- 适用：网游/RPG/校园/都市

【根据世界主题选择模式，并生成以下内容】

1. 模式选择：tiered 或 level

2. 段位/等级列表（从低到高）：
   每个需要：
   - name: 名称（与世界观贴合）
   - description: 该阶段特征描述
   - statBonuses: 该级别的属性上限提升
     - attrAMax: 生命类上限（从100开始，每级递增）
     - attrBMax: 能量类上限（同上）
     - dim1Max-dim6Max: 六维上限（从100开始，每级递增）

   属性上限递增规则：
   - 段位制：每段上限翻倍或+100（100→200→400→800）
   - 等级制：每级上限+5~+20（100→105→110→...→500）

3. XP参数：
   - baseXP: 基础XP（段位制100-200，等级制30-100）
   - exponent: 指数（段位制1.5-2.5，等级制1.0-1.3）
   - scaleFactor: 缩放系数（默认1.0）

输出JSON：
{
  "mode": "tiered",
  "tiers": [
    {
      "name": "...",
      "description": "...",
      "statBonuses": {
        "attrAMax": 100, "attrBMax": 100,
        "dim1Max": 100, "dim2Max": 100, "dim3Max": 100,
        "dim4Max": 100, "dim5Max": 100, "dim6Max": 100
      }
    },
    {
      "name": "...",
      "description": "...",
      "statBonuses": {
        "attrAMax": 200, "attrBMax": 200,
        "dim1Max": 150, "dim2Max": 150, "dim3Max": 120,
        "dim4Max": 150, "dim5Max": 150, "dim6Max": 120
      }
    }
  ],
  "xpFormula": {
    "baseXP": 100,
    "exponent": 2.0,
    "scaleFactor": 1.0
  }
}`;
}

/** 运行时UpdateVariable规则 */
export const PROGRESSION_UPDATE_RULES = `【成长体系更新规则】

获得经验值时：
{"世界系统":{"成长体系":{"currentXP":新值}}}

当currentXP >= xpForNextTier时，系统自动计算升段：
- currentTierIndex += 1
- currentXP = 0
- 属性上限自动提升到新段位的statBonuses

AI也可以直接触发升级：
{"世界系统":{"成长体系":{"currentTierIndex":新索引,"currentXP":0}}}

注意：
- currentXP不能为负数
- currentTierIndex不能超过tiers.length - 1
- 升级时如果属性超过新上限，属性值不变（不自动降低）`;
