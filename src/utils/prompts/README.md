# Prompt 管理系统

集中管理所有 AI prompt，方便维护和复用。

## 目录结构

```
src/utils/prompts/
├── index.ts              # 统一导出
├── types.ts              # 类型定义
├── constants.ts          # 系统常量（游戏规则、回复格式）
├── guide-prompts.ts      # 导游相关 prompt
├── npc-prompts.ts        # NPC 相关 prompt
├── editor-prompts.ts     # 编辑器 AI 相关 prompt
└── README.md             # 本文档
```

## 使用方式

### 1. 导入所需函数

```typescript
import {
  // 类型
  type NpcTemplate,
  type GuideProfile,
  type SystemPromptOptions,

  // 常量
  GAMEPLAY_RULES,
  RESPONSE_RULES,

  // 导游相关
  getGuideProfiles,
  getGuideSystemTag,
  getGuideGreeting,
  buildSystemPrompt,

  // NPC 相关
  ALL_NPC_TEMPLATES,
  getNpcTemplateById,
  buildNpcEditorPrompt,

  // 编辑器 AI 相关
  buildCharacterFillPrompt,
  buildGameSystemPrompt,
} from '../utils/prompts';
```

### 2. 使用示例

#### 获取导游列表

```typescript
const guides = getGuideProfiles();
// 返回: [{ name: '导游小姐', greeting: '...', systemTag: '...' }, ...]
```

#### 构建系统提示词

```typescript
const systemPrompt = buildSystemPrompt({
  playerProfile: '玩家角色设定...',
  personalitiesBlock: '性格描述...',
  worldDesc: '世界描述...',
  worldName: '世界名称',
  guideName: '导游小姐',
  npcProfileBlock: 'NPC描述...',
  variablesBlock: '变量信息...',
  guideRagBlock: 'RAG注入内容...',
  injectedBlocks: ['额外注入内容...'],
});
```

#### 获取 NPC 模板

```typescript
const guideNpc = getNpcTemplateById('guide');
// 返回: { id: 'guide', name: '导游小姐', personality: '...', ... }
```

#### 构建 NPC 编辑器提示词

```typescript
const editorPrompt = buildNpcEditorPrompt({
  existingNames: ['导游小姐', '调查员凯'],
  worldDesc: '世界描述...',
  worldName: '世界名称',
});
```

#### 构建角色补全提示词

```typescript
const fillPrompt = buildCharacterFillPrompt({
  worldSetting: '世界设定...',
  playerName: '玩家姓名',
  playerGender: '男',
  playerAge: '25',
  playerBackground: '背景描述...',
});
```

## 内置 NPC 模板

| ID | 名称 | 性格 | 外貌 |
|----|------|------|------|
| `guide` | 导游小姐 | 优雅知性、温柔耐心 | 穿米色风衣，戴贝雷帽 |
| `kay` | 调查员凯 | 热情好奇、观察力强 | 短发、穿工装裤、总是背着相机 |
| `alpha` | 审讯官阿尔法 | 严肃冷静、逻辑性强 | 黑西装、白衬衫、戴金丝眼镜 |
| `wenwen` | 旅伴芠芠 | 可爱软萌、有点迷糊 | 双马尾、粉色连衣裙、总是带着零食 |

## 内置 Prompt 模板

### 1. NPC 人设模板

所有 NPC 都有详细的人设定义，包含：
- 角色身份和背景
- 语气和说话风格
- 行为准则和边界限制
- 特色行为和回复规则

示例（导游小姐）：
```typescript
{
  id: 'guide',
  name: '导游小姐',
  personality: '优雅知性、温柔耐心',
  appearance: '穿米色风衣，戴贝雷帽',
  systemPrompt: `你是世界旅行指南APP的专属导游小姐。
你拥有优雅知性、温柔耐心的气质，像一位贴心的旅行顾问。

【人格设定】
- 语气：温柔、耐心、偶尔俏皮，用词优雅但不晦涩
- 行为：主动关心用户需求，提供实用建议，适时分享旅行小贴士
- 边界：不讨论政治敏感话题，不鼓励危险旅行行为，不提供违法建议
- 特色：喜欢用表情符号点缀回复，偶尔引用旅行名言或诗句

【回复规则】
1. 先理解用户的真实需求，再给出针对性建议
2. 信息要准确、实用，避免空泛的套话
3. 如果用户描述模糊，主动追问细节
4. 保持专业形象，但不要过于严肃
5. 适当使用表情符号增加亲切感，但不要过度`
}
```

### 2. 系统规则模板

包含完整的游戏玩法规则和回复格式规则：

- **游戏玩法规则**：核心原则、回复长度与节奏、世界观与真实性、变量更新规则、互动与引导、禁止事项
- **回复格式规则**：强制输出格式、格式要求、字段说明、示例

### 3. NPC 编辑器模板

用于生成 NPC 设定卡的 prompt，包含：
- 核心原则（保持原作风格、合并重复信息等）
- 判定规则（同名NPC处理、推测内容标注等）
- 输出要求（JSON格式、字段说明）
- systemPrompt 字段详细要求（5个必须部分）

### 4. 角色补全模板

用于补全玩家角色设定的 prompt，包含：
- 核心原则（保持已填信息、符合世界设定等）
- 生成规则（9个字段的详细说明）
- 输出要求（JSON格式、示例输出）

### 5. 变量提取模板

用于提取游戏变量的 prompt，包含：
- 核心原则（只做变量更新、不续写剧情等）
- 输出格式（UpdateVariable标签）
- 人物档案规则（创建新NPC、更新已有NPC）
- 其他变量规则（玩家变量、世界变量、势力网络、笔记本）
- 禁止事项

## 添加新的 Prompt

1. 在对应的文件中添加新的函数（如 `guide-prompts.ts`、`npc-prompts.ts` 等）
2. 在 `types.ts` 中添加新的类型定义（如果需要）
3. 在 `index.ts` 中导出新函数
4. 更新本文档

## 迁移指南

从旧的分散式 prompt 迁移到新的集中式管理：

1. **删除旧文件**：`src/engine/systemPromptBuilder.ts` 已被废弃
2. **更新导入**：将 `import { buildSystemPrompt } from '../engine/systemPromptBuilder'` 改为 `import { buildSystemPrompt } from '../utils/prompts'`
3. **更新调用**：根据新的函数签名调整参数

## 设计原则

1. **集中管理**：所有 prompt 放在一个目录下，方便查找和维护
2. **类型安全**：使用 TypeScript 类型定义，减少错误
3. **模块化**：按功能拆分文件，职责清晰
4. **易于扩展**：添加新 prompt 只需在对应文件中添加函数
5. **向后兼容**：保留原有的功能，只改变组织方式
