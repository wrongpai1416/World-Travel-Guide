// 数值属性模块 — Prompt 模板

/** 阶段1：主题提取 — 提取属性命名信息 */
export function buildStatThemePrompt(description: string): string {
  return `分析以下世界描述，提取属性命名信息：
描述：${description}

根据世界主题，为以下属性取贴合世界观的中文名：

1. 属性A（生命类属性）：角色存活状态的核心数值
   - 取名要求：2-4个字，与世界观高度贴合
   - 示例方向：古风→气血，科幻→耐久，校园→体力

2. 属性B（能量类属性）：技能/行动消耗的核心数值
   - 取名要求：2-4个字，与世界观高度贴合

3. 六维属性命名（6个维度）：
   - 维度1（造成伤害的能力）：
   - 维度2（承受伤害的能力）：
   - 维度3（行动速度/先手）：
   - 维度4（学习/策略/施法能力）：
   - 维度5（社交/说服/影响能力）：
   - 维度6（随机运气/暴击/掉落）：

输出JSON：
{
  "attrAName": "...",
  "attrBName": "...",
  "dim1Name": "...",
  "dim2Name": "...",
  "dim3Name": "...",
  "dim4Name": "...",
  "dim5Name": "...",
  "dim6Name": "...",
  "theme": "世界主题关键词"
}`;
}

/** 阶段2b：属性生成 — 生成具体数值 */
export function buildStatGenPrompt(params: {
  theme: string;
  attrAName: string;
  attrBName: string;
  dim1Name: string;
  dim2Name: string;
  dim3Name: string;
  dim4Name: string;
  dim5Name: string;
  dim6Name: string;
}): string {
  return `为以下世界设计属性系统：

世界主题：${params.theme}
属性A（生命类）叫法：${params.attrAName}
属性B（能量类）叫法：${params.attrBName}
六维命名：${params.dim1Name}/${params.dim2Name}/${params.dim3Name}/${params.dim4Name}/${params.dim5Name}/${params.dim6Name}

【必须生成以下内容】

1. 属性A（${params.attrAName}）：
   - max: 上限值（根据世界基调：慢节奏100，快节奏200，高武500）
   - current: 初始值（80%上限）

2. 属性B（${params.attrBName}）：
   - max: 上限值
   - current: 初始值（60%上限）

3. 六维属性（每个都要设定value和range）：
   - ${params.dim1Name}: value(初始值), range[最小,最大]
   - ${params.dim2Name}: value(初始值), range[最小,最大]
   - ${params.dim3Name}: value(初始值), range[最小,最大]
   - ${params.dim4Name}: value(初始值), range[最小,最大]
   - ${params.dim5Name}: value(初始值), range[最小,最大]
   - ${params.dim6Name}: value(初始值), range[最小,最大]

   初始值建议：40-60（普通世界）或 20-40（高难度世界）
   范围建议：[0, 100]（普通）或 [0, 200]（高武/修仙）

4. 特色属性（1-2个，根据世界类型）：
   每个需要：id(英文), name(中文), value(初始值), range[最小,最大], description(一句话描述)

输出JSON：
{
  "attrA": { "name": "${params.attrAName}", "current": 80, "max": 100 },
  "attrB": { "name": "${params.attrBName}", "current": 60, "max": 100 },
  "dim1": { "name": "${params.dim1Name}", "value": 50, "range": [0, 100] },
  "dim2": { "name": "${params.dim2Name}", "value": 50, "range": [0, 100] },
  "dim3": { "name": "${params.dim3Name}", "value": 50, "range": [0, 100] },
  "dim4": { "name": "${params.dim4Name}", "value": 50, "range": [0, 100] },
  "dim5": { "name": "${params.dim5Name}", "value": 50, "range": [0, 100] },
  "dim6": { "name": "${params.dim6Name}", "value": 50, "range": [0, 100] },
  "special": [
    { "id": "...", "name": "...", "value": 5, "range": [1, 10], "description": "..." }
  ]
}`;
}

/** 运行时UpdateVariable规则 */
export const STAT_UPDATE_RULES = `【数值属性更新规则】

当角色受到伤害/恢复/消耗/提升时，更新对应属性：
{"世界系统":{"数值属性":{"attrA":{"当前":75}}}}  // 生命类变化
{"世界系统":{"数值属性":{"attrB":{"当前":55}}}}  // 能量类变化
{"世界系统":{"数值属性":{"dim1":{"value":47}}}}  // 六维变化
{"世界系统":{"数值属性":{"special":[{"id":"str","value":8}]}}}  // 特色属性变化

注意：
- 只输出发生变化的属性，未变化的不要输出
- 属性值不能超过当前段位上限（如果有成长体系模块）
- 属性值不能低于range[0]`;
