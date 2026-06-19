// 天赋体系模块 — Prompt 模板

/** 天赋按需生成（在世界编辑器中手动触发） */
export function buildTalentGenPrompt(params: {
  theme: string;
  tone: string;
  era: string;
  existingCategories: string[];
  count?: number;
}): string {
  const count = params.count || 5;
  const existing = params.existingCategories.length > 0
    ? `\n已有天赋大类（可以往这些大类里补充，也可以新建大类）：${params.existingCategories.join('、')}`
    : '';

  return `为以下世界设计天赋体系：

世界主题：${params.theme}
基调：${params.tone}
时代：${params.era}
${existing}

【设计要求】

1. 生成 2~4 个天赋大类（如：灵根、体质、血脉、天赋、命格、资质等，根据世界观选择合适的分类）
2. 每个大类下生成 ${count} 个具体天赋
3. 品质分为5档：普通、精良、稀有、史诗、传说
4. 天赋名和描述必须与世界观高度贴合
5. effects 数组列出天赋的效果描述（纯文本，1~3条）

【品质分布参考】
- 普通：常见天赋，约40%
- 精良：较好的天赋，约25%
- 稀有：少见的天赋，约20%
- 史诗：极少见，约10%
- 传说：最稀有，约5%

【输出JSON】
{
  "categories": [
    {
      "id": "英文标识（如 root, physique, bloodline）",
      "name": "大类中文名（如：灵根）",
      "description": "大类描述",
      "talents": [
        {
          "id": "英文标识（如 heavenly_root）",
          "name": "天赋中文名（如：天灵根）",
          "description": "天赋描述（2-3句话）",
          "rarity": "普通/精良/稀有/史诗/传说",
          "effects": ["效果1", "效果2"]
        }
      ]
    }
  ]
}`;
}

/** 运行时 UpdateVariable 规则 */
export const TALENT_UPDATE_RULES = `【天赋体系更新规则】
- 天赋是角色的固有特质，一般不会在运行时新增或删除
- AI在叙事中可以提及角色的天赋，但不需要在 UpdateVariable 中操作
- 如果剧情触发角色觉醒新天赋（罕见情况），输出：
  {"世界系统":{"天赋体系":{"categories":[{"id":"大类id","talents":[{"id":"新天赋id","name":"天赋名","description":"描述","rarity":"稀有","effects":["效果"]}]}}}}
- 不要删除或修改已有的天赋数据`;
