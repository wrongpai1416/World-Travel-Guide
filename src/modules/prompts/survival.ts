// 生存资源模块 — Prompt 模板

/** 阶段：生存资源生成 */
export function buildSurvivalGenPrompt(params: {
  theme: string;
  tone: string;
}): string {
  return `为以下世界设计生存资源系统：

世界主题：${params.theme}
基调：${params.tone}

【设计原则】
- 生存资源是这个世界的核心挑战，资源获取和消耗是叙事驱动力
- 3-6种核心资源，不能太多（控制复杂度）
- 至少1种稀缺资源（标记 scarce: true），稀缺资源是生存压力的来源
- 每种资源必须有 max 上限，代表物理存储/携带极限
- 每种资源必须有 gatherRate（采集速率）和 usage（消耗速率），用自然语言描述
- 配方不在世界创建时生成，而是在游戏中由玩家触发AI动态生成

★ amount 必须是正数！表示游戏开始时玩家拥有的初始数量，不能为0！

【数值设计指南】

● 末日/荒岛/原始生存类（紧张节奏）：
  - 资源上限：5-15，初始数量：上限的30%-60%
  - 每天消耗：1-2单位核心资源，稀缺资源初始：1-3

● 像素生存/沙盒类（中等节奏）：
  - 资源上限：20-50，初始数量：上限的40%-70%
  - 每天消耗：1单位，稀缺资源初始：3-5

● 轻度生存/经营混合类（宽松节奏）：
  - 资源上限：50-100，初始数量：上限的50%-80%
  - 每天消耗：0-1单位，稀缺资源初始：5-10

【必须生成以下内容】

1. 整体描述：一句话说明这个世界的生存资源系统特点

2. 资源列表（3-6种）：
   每种资源需要：
   - id: 英文标识（如 water, food, wood, stone, herb）
   - name: 中文名（与世界观贴合）
   - symbol: 资源符号（emoji）
   - ★ amount: 初始数量（必须是正数！如 6、10、3，绝不能是 0）
   - max: 上限（必须设定）
   - scarce: 是否稀缺（至少1种为true）
   - gatherRate: 采集速率描述（如"河边每天可取3桶水"）
   - usage: 消耗速率描述（如"每人每天需要1份饮用水"）
   - description: 获取方式与用途

3. 生存规则：
   - cycleName: 结算周期名（"一天"/"一个回合"）
   - consumePerCycle: 每周期自动消耗描述
   - criticalThreshold: 危机触发阈值（默认2）

输出JSON：
{
  "description": "一句话描述",
  "resources": [
    {
      "id": "water", "name": "淡水", "symbol": "💧",
      "amount": 6, "max": 10, "scarce": false,
      "gatherRate": "河边每天可取3桶水",
      "usage": "每人每天需要1份饮用水",
      "description": "生存必需品，用于饮用和烹饪。"
    },
    {
      "id": "herb", "name": "药草", "symbol": "🌿",
      "amount": 2, "max": 15, "scarce": true,
      "gatherRate": "山林中偶有发现，每天约1-2株",
      "usage": "受伤或生病时使用，每次1株",
      "description": "稀有的野生草药，可治疗伤口和疾病。"
    }
  ],
  "rules": {
    "cycleName": "一天",
    "consumePerCycle": "每人每天消耗1份口粮+1份饮用水",
    "criticalThreshold": 2
  }
}`;
}

/** 运行时 UpdateVariable 规则 */
export const SURVIVAL_UPDATE_RULES = `【生存资源更新规则】

当资源数量发生变化时，通过 UpdateVariable 更新：
{"世界系统":{"生存资源":{"resources":{"资源id":{"amount":新数量}}}}}

规则：
- 只输出发生变化的资源，未变化的不要输出
- amount 不能为负数，不能超过该资源的 max
- 多个资源同时变化时，放在同一个 resources 对象中
- 示例：食物消耗1、木材采集3 → {"世界系统":{"生存资源":{"resources":{"food":{"amount":5},"wood":{"amount":8}}}}}

上限更新（当玩家建造更大的存储设施、升级仓库时）：
- 同时更新 amount 和 max
- 示例：建造大型仓库后 → {"世界系统":{"生存资源":{"resources":{"wood":{"max":100}}}}}

危机触发：
- 当任何资源的 amount 低于 criticalThreshold 时，应在叙事中体现危机感
- 资源耗尽（amount=0）时，必须触发严重后果（受伤、虚弱、死亡威胁等）`;

/** 动态配方生成（游戏中玩家触发） */
export function buildRecipeGenPrompt(params: {
  currentResources: Array<{ id: string; name: string; amount: number; max: number }>;
  playerRequest: string;
  worldTheme: string;
}): string {
  const resList = params.currentResources.map(r => `${r.name}(${r.id}): ${r.amount}/${r.max}`).join('、');

  return `你是生存世界的配方生成系统。玩家想要制作一样东西，你需要生成一个合理的配方。

【当前世界】${params.worldTheme}

【玩家已有的资源】
${resList}

【玩家需求】
${params.playerRequest}

【规则】
- inputs 是消耗的材料及其数量（从玩家已有资源中选择）
- output 是制作出来的产品
- 产品可以是已有资源（如把 raw_meat 变成 cooked_meat），也可以是新物品
- 如果是新物品，resourceId 用英文小写下划线命名
- amount 必须是正数
- 材料消耗要合理（不能太贵也不能太便宜）
- 如果玩家需求不合理，可以生成一个近似的合理配方

输出JSON（单个配方对象）：
{
  "id": "recipe_英文标识",
  "name": "配方名称（如：石斧、熟肉、净化水）",
  "inputs": {"材料id": 数量, "材料id2": 数量2},
  "output": {"resourceId": "产品id", "amount": 产品数量},
  "description": "制作说明（一句话）"
}`;
}
