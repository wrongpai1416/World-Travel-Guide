// 资源管理模块 — Prompt 模板

/** 阶段3：资源生成 */
export function buildResourceGenPrompt(params: {
  theme: string;
  tone: string;
  statNames: string;
  progressionInfo: string;
}): string {
  return `为以下世界设计资源系统：

世界主题：${params.theme}
基调：${params.tone}
已有属性：${params.statNames}（六维+特色属性的名称列表）
已有成长体系：${params.progressionInfo}（段位/等级名称列表）

【设计原则】
- 资源名称必须与世界观高度贴合
- 资源获取方式和用途必须在description中说明
- 稀缺资源是该世界的核心挑战之一
- 货币是通用交换媒介
- 资源数量根据世界基调设定（慢节奏少，快节奏多）

【必须生成以下内容】

1. 整体描述：一句话说明这个世界的资源系统特点

2. 货币（可选）：
   - name: 货币名称
   - symbol: 符号
   - amount: 初始数量
   - description: 获取方式与用途

3. 资源列表（3-8种）：
   每种资源需要：
   - id: 英文标识
   - name: 中文名（与世界观贴合）
   - symbol: 资源符号（emoji或特殊字符）
   - amount: 初始数量（根据世界基调）
   - max: 上限（可选，某些资源有上限）
   - scarce: 是否稀缺（至少1种稀缺）
   - description: 获取方式与用途

4. 特殊规则（可选）：
   如果这个世界有独特的资源机制（如生产、交易、消耗规则），
   可以在输出JSON中添加自定义字段说明。

输出JSON：
{
  "description": "...",
  "currency": { "name": "...", "symbol": "...", "amount": 500, "description": "..." },
  "items": [
    { "id": "...", "name": "...", "symbol": "...", "amount": 10, "max": 99, "scarce": false, "description": "..." },
    { "id": "...", "name": "...", "symbol": "...", "amount": 3, "scarce": true, "description": "..." }
  ]
}`;
}

/** 运行时UpdateVariable规则 */
export const RESOURCE_UPDATE_RULES = `【资源管理更新规则】

资源数量变化时：
{"世界系统":{"资源管理":{"items":[{"id":"resource_id","amount":新数量}]}}}

货币变化时：
{"世界系统":{"资源管理":{"currency":{"amount":新数量}}}}

新增资源时：
{"世界系统":{"资源管理":{"items":[{"id":"new_id","name":"...","symbol":"...","amount":1,"scarce":false,"description":"..."}]}}}

注意：
- 只输出变化的资源，未变化的不要输出
- amount不能为负数
- 如果有max，amount不能超过max`;
