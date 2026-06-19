# <img src="https://unpkg.com/lucide-static@latest/icons/globe-2.svg" width="32" height="32" /> 世界漫游指南 (World Travel Guide)

**AI 驱动的互动小说引擎** — 在自定义世界观中创建角色、展开冒险，与 AI 共同书写属于你的故事。

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-FBF0CF?logo=bun)](https://bun.sh/)
[![Zustand](https://img.shields.io/badge/Zustand-5-3B3B3B)](https://zustand-demo.pmnd.rs/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## <img src="https://unpkg.com/lucide-static@latest/icons/sparkles.svg" width="20" height="20" /> 核心特性

### <img src="https://unpkg.com/lucide-static@latest/icons/theater.svg" width="16" height="16" /> 多世界观支持

内置 7 个精心设计的世界观，覆盖科幻、末日、武侠、校园、宫廷、幻想、都市题材。支持用户自建世界和 JSON 导入。

| 世界 | 题材 | 难度 | 简介 |
|------|------|:----:|------|
| <img src="https://unpkg.com/lucide-static@latest/icons/circuit-board.svg" width="14" height="14" /> 赛博朋克 | 科幻 | 中等 | 霓虹掩映下的罪恶、资本与极致享乐之城 |
| <img src="https://unpkg.com/lucide-static@latest/icons/flame.svg" width="14" height="14" /> 末日废土 | 末日 | 困难 | 核战后的荒芜世界，异能与辐射怪物共存 |
| <img src="https://unpkg.com/lucide-static@latest/icons/swords.svg" width="14" height="14" /> 武侠世界 | 武侠 | 困难 | 剑气纵横的架空武林，恩怨情仇交织的江湖 |
| <img src="https://unpkg.com/lucide-static@latest/icons/graduation-cap.svg" width="14" height="14" /> 日式校园 | 校园 | 简单 | 充满青春、社团与青涩恋爱的日式高中生活 |
| <img src="https://unpkg.com/lucide-static@latest/icons/crown.svg" width="14" height="14" /> 云汉皇朝·深宫 | 宫廷 | 中等 | 红墙黄瓦下，权谋与爱恨交织的华丽囚笼 |
| <img src="https://unpkg.com/lucide-static@latest/icons/gem.svg" width="14" height="14" /> 绯晶之乡 | JRPG | 中等 | 少年与少女们拯救世界的幻想史诗 |
| <img src="https://unpkg.com/lucide-static@latest/icons/building-2.svg" width="14" height="14" /> 欲望魔都 | 都市 | 中等 | 欲望交织的繁华不夜城 |

每个世界定义包含：世界观设定、规则体系、经济系统、时间系统、阵营势力、预设 NPC、结构化属性模块、世界书条目。详见 [WorldDef Schema](src/data/worlds-schema.ts) 和 [worlds/](src/data/worlds/) 目录。

### <img src="https://unpkg.com/lucide-static@latest/icons/cpu.svg" width="16" height="16" /> 11 阶段 AI 管线

每次对话经过完整的 11 阶段处理管线，自动维护叙事连贯性、记忆一致性和变量准确性。

<img src="docs/diagrams/pipeline.svg" alt="11 阶段 AI 管线" width="100%" />

管线支持同层并行、层间串行，执行顺序可通过配置自定义。

### <img src="https://unpkg.com/lucide-static@latest/icons/brain.svg" width="16" height="16" /> 叙事记忆系统

维护一个结构化的叙事运行时，让 AI 在长对话中保持记忆连贯。

| 记忆类型 | 字段 | 说明 |
|----------|------|------|
| <img src="https://unpkg.com/lucide-static@latest/icons/map-pin.svg" width="12" height="12" /> 场景锚点 | `sceneAnchor` | 当前时间/地点/实体/目标/风险 |
| <img src="https://unpkg.com/lucide-static@latest/icons/waypoints.svg" width="12" height="12" /> 叙事线索 | `activeThreads[]` | 开放/阻塞/已解决的故事线，带优先级和关联实体 |
| <img src="https://unpkg.com/lucide-static@latest/icons/locate.svg" width="12" height="12" /> 状态槽 | `stateSlots[]` | 作用域状态值（玩家/NPC/地点/世界） |
| <img src="https://unpkg.com/lucide-static@latest/icons/git-branch.svg" width="12" height="12" /> 关系图谱 | `relationEdges[]` | 实体间的关系网络 |
| <img src="https://unpkg.com/lucide-static@latest/icons/zap.svg" width="12" height="12" /> 事件卡片 | `eventCards[]` | 重要事件，按重要性评分，热/温/冷状态自动转换 |
| <img src="https://unpkg.com/lucide-static@latest/icons/user-circle.svg" width="12" height="12" /> 实体档案 | `entityCards[]` | 角色/地点/阵营/物品/能力的详细档案 |
| <img src="https://unpkg.com/lucide-static@latest/icons/archive.svg" width="12" height="12" /> 归档 | `archiveCards[]` | 已解决/过期的故事弧归档 |
| <img src="https://unpkg.com/lucide-static@latest/icons/database.svg" width="12" height="12" /> 向量记忆 | `vectorMemory[]` | 长期事实，支持嵌入向量检索 |
| <img src="https://unpkg.com/lucide-static@latest/icons/save.svg" width="12" height="12" /> 检查点 | `checkpoints[]` | 运行时快照，支持一键回滚（最多 5 个） |

记忆数据随存档一起持久化到 IndexedDB，F5 刷新不丢失。

### <img src="https://unpkg.com/lucide-static@latest/icons/bar-chart-3.svg" width="16" height="16" /> 结构化游戏变量

游戏状态完全结构化，AI 每轮自动通过 `<UpdateVariable>` 更新变量，支持三种更新格式：

| 格式 | 示例 | 说明 |
|------|------|------|
| RFC 6902 Patch | `[{"op":"replace", "path":"玩家.生存状态.血量", "value":80}]` | 精确的 JSON 补丁操作 |
| 深度合并 | `{"玩家":{"生存状态":{"血量":80}}}` | 对象递归合并 |
| 文本赋值 | `玩家.生存状态.血量=80` | 简单的 key=value 文本 |

**状态结构概览：**

```
GameState
├── 世界 (WorldState)
│   ├── 时间系统 / 空间定位 / 社会环境
│   ├── 信息层级 [全局/区域/本地/流言/传闻]
│   └── 世界系统 [数值属性/成长体系/资源管理/骰子/天赋]
├── 玩家 (PlayerState)
│   ├── 生存状态 [血量/体力]
│   ├── 身份信息 [背景/职业/阶层/组织/特殊身份]
│   ├── 技能系统 / 货币 / 物品栏
│   ├── 笔记本 [危机/机遇/待办]
│   └── 成长状态 [层级/经验值/属性点]
└── 人物档案 (Record<string, NPCData>)
    └── [NPC_ID] — 姓名/种族/关系/外貌/性格/大事记/属性/技能/物品...
```

每次 AI 回复后自动创建快照附加到消息上，支持随时回溯到任意历史节点。

### <img src="https://unpkg.com/lucide-static@latest/icons/book-open.svg" width="16" height="16" /> SillyTavern 兼容世界书

完整的 Lorebook 扫描引擎，与 SillyTavern 世界书格式兼容。

<img src="docs/diagrams/worldbook.svg" alt="世界书扫描流程" width="100%" />

**扫描能力：** 正则关键词 (`/pattern/flags`) / 大小写敏感 / 全词匹配 / 选择逻辑 (AND_ANY/AND_ALL/NOT_ALL/NOT_ANY) / 排除关键词 / 分组互斥（权重随机或优先级胜出）/ 概率触发 / 递归扫描 / NPC 世界书自动去重

### <img src="https://unpkg.com/lucide-static@latest/icons/puzzle.svg" width="16" height="16" /> 模块化游戏系统

可插拔的游戏机制模块，每个世界可自由组合配置：

| 模块 | ID | 说明 |
|------|----|------|
| <img src="https://unpkg.com/lucide-static@latest/icons/swords.svg" width="12" height="12" /> 数值属性 | `stat` | 力量/敏捷/体质/智力/感知/魅力 + 自定义属性，带范围钳位 |
| <img src="https://unpkg.com/lucide-static@latest/icons/trending-up.svg" width="12" height="12" /> 成长体系 | `progression` | 层级制/技能点/声望/军衔，可配置层级名称和 XP 曲线 |
| <img src="https://unpkg.com/lucide-static@latest/icons/coins.svg" width="12" height="12" /> 资源管理 | `resource` | 自定义货币和资源物品，带稀缺性标记 |
| <img src="https://unpkg.com/lucide-static@latest/icons/dices.svg" width="12" height="12" /> 骰子检定 | `dice` | d20/d6 等骰子系统，支持属性加值和难度等级 |
| <img src="https://unpkg.com/lucide-static@latest/icons/star.svg" width="12" height="12" /> 天赋体系 | `talent` | 分类天赋树，支持解锁条件和效果描述 |

模块在世界定义中声明，创建角色时初始化数值，游戏中 AI 自动更新。

### <img src="https://unpkg.com/lucide-static@latest/icons/hard-drive.svg" width="16" height="16" /> 完整存档管理

| 能力 | 说明 |
|------|------|
| 多存档 | 创建/删除/重命名，每个存档独立的世界+角色+对话+记忆 |
| 自动存档 | 每次对话结束 500ms 防抖自动保存，Promise 锁防止并发写入 |
| 导入/导出 | JSON 格式导出，跨设备迁移 |
| F5 恢复 | 刷新页面自动恢复上次存档（通过 `active_save_id`） |
| 快照回滚 | 每条 AI 消息附带变量快照，可回溯到任意历史节点 |
| 快照优化 | 保留首条 + 最近 10 条 + 每 10 条关键帧，防止存储膨胀 |
| 记忆恢复 | 回滚时同步恢复记忆系统检查点 |

### <img src="https://unpkg.com/lucide-static@latest/icons/smartphone.svg" width="16" height="16" /> 响应式设计

同一套面板组件（ProfilePanel / CharacterGrid / VariableSnapshotPanel 等）在桌面端渲染为 Drawer 抽屉，在移动端渲染为 MobileOverlay 滑入面板，无代码重复。

---

## <img src="https://unpkg.com/lucide-static@latest/icons/rocket.svg" width="20" height="20" /> 快速开始

### 环境要求

- [Bun](https://bun.sh/) (推荐) 或 Node.js 18+
- 一个 OpenAI 兼容的 AI API（OpenAI / DeepSeek / Google / 自定义）

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/wrongpai1416/World-Travel-Guide.git
cd World-Travel-Guide

# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 构建生产版本
bun run build
```

### 配置 API

1. 启动后进入 **设置** 页面
2. 在 **API 设置** Tab 中填写：
   - API 端点（如 `https://api.openai.com/v1`）
   - API Key
   - 模型名称（如 `gpt-4o`）
3. 点击 **测试连接** 验证配置

---

## <img src="https://unpkg.com/lucide-static@latest/icons/gamepad-2.svg" width="20" height="20" /> 使用流程

### 1. 创建角色

<img src="docs/diagrams/character-creation.svg" alt="角色创建流程" width="100%" />

### 2. 游戏交互

- 在输入框输入行动，或点击 AI 推荐的 `[OPTION]` 选项
- AI 实时流式回复，支持中途停止
- 右侧面板查看世界状态、角色属性、待办事项
- 左侧面板管理角色档案、NPC、笔记本、变量快照

### 3. 存档管理

- 自动存档：每次对话结束自动保存
- 手动存档：从存档列表管理（加载/删除/重命名/导入/导出）
- 快照回滚：回溯到任意历史节点

---

## <img src="https://unpkg.com/lucide-static@latest/icons/folder-tree.svg" width="20" height="20" /> 项目结构

```
src/
├── api/                    # API 层
│   ├── client.ts           # 多 Provider API 客户端
│   ├── rateLimiter.ts      # 限流器
│   └── types.ts            # API 类型
├── components/             # UI 组件
│   ├── start/              # 开始界面（主菜单/向导/存档）
│   ├── game/               # 游戏界面
│   │   ├── chat/           # 聊天面板/消息渲染/管线监控
│   │   └── panels/         # 侧边面板（角色/NPC/变量）
│   ├── settings/           # 设置界面
│   └── shared/             # 共享组件
├── context/                # React Context
│   ├── GameContext.tsx      # 游戏上下文（导航+引擎+存档）
│   └── UISettingsContext.tsx# UI 设置上下文
├── data/                   # 数据定义
│   ├── worlds/             # 7 个内置世界 JSON
│   ├── worlds-schema.ts    # WorldDef 类型定义
│   ├── worldLoader.ts      # 世界加载器
│   └── builtinPresets.ts   # 内置提示词预设（16 条）
├── engine/                 # 游戏引擎
│   ├── useGameEngine.ts    # 核心引擎 hook
│   ├── pipelineExecutor.ts # 管线执行器
│   ├── variableManager.ts  # 变量管理器
│   ├── promptAssembler.ts  # 提示词组装器
│   ├── macroEngine.ts      # 宏引擎
│   └── eventBus.ts         # 事件总线
├── hooks/                  # 自定义 Hooks
│   ├── useAiFill.ts        # AI 角色自动填充
│   ├── useCharacterHistory.ts # AI 背景故事生成
│   └── useWizard.ts        # 向导流程管理
├── memory/                 # 记忆系统
│   ├── memoryStore.ts      # Zustand Store
│   ├── memoryPipeline.ts   # 9 阶段记忆管线
│   └── types.ts            # 记忆类型定义
├── modules/                # 游戏模块（属性/成长/资源/骰子/天赋）
├── schema/                 # 类型定义
│   └── variables.ts        # GameState 结构
├── storage/                # 持久化层
│   └── db.ts               # IndexedDB 存档管理
├── stores/                 # Zustand Stores
│   ├── configStore.ts      # 配置管理
│   └── saveStore.ts        # 存档管理
├── utils/                  # 工具函数
│   ├── markdown.ts         # Markdown 渲染
│   ├── npcHelpers.ts       # NPC 管理工具
│   └── prompts/            # 提示词模板
└── worldbook/              # 世界书引擎
    ├── index.ts            # 世界书管理器
    ├── worldInfoEngine.ts  # SillyTavern 兼容扫描引擎
    └── npcWorldbook.ts     # NPC 世界书生成
```

---

## <img src="https://unpkg.com/lucide-static@latest/icons/layers.svg" width="20" height="20" /> 架构概览

```
┌─────────────────────────────────────────────────────┐
│                    UI 层                             │
│  start/  │  game/ (chat/panels)  │  settings/       │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  状态层                              │
│  GameContext  │  configStore  │  saveStore           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  引擎层                              │
│  useGameEngine │ PipelineExecutor │ VariableManager  │
│  PromptAssembler │ MacroEngine │ EventBus            │
└───────┬──────────────┬──────────────┬───────────────┘
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌────▼────────┐
│ memory/*     │ │ worldbook/*│ │ modules/*   │
│ 9阶段记忆管线 │ │ 世界书引擎  │ │ 模块系统     │
└──────────────┘ └────────────┘ └─────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  数据层                              │
│  worldLoader │ variables.ts │ db.ts (IndexedDB)      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  API 层                              │
│  client.ts (OpenAI/DeepSeek/Google) │ rateLimiter    │
└─────────────────────────────────────────────────────┘
```

> 详细的架构文档见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## <img src="https://unpkg.com/lucide-static@latest/icons/settings-2.svg" width="20" height="20" /> 技术细节

### AI 兼容性

| Provider | 流式 | 思考链 | 备注 |
|----------|:----:|:------:|------|
| OpenAI | <img src="https://unpkg.com/lucide-static@latest/icons/check.svg" width="14" height="14" /> | <img src="https://unpkg.com/lucide-static@latest/icons/check.svg" width="14" height="14" /> | 标准实现 |
| DeepSeek | <img src="https://unpkg.com/lucide-static@latest/icons/check.svg" width="14" height="14" /> | <img src="https://unpkg.com/lucide-static@latest/icons/check.svg" width="14" height="14" /> | 自动合并连续同角色消息 |
| Google Gemini | <img src="https://unpkg.com/lucide-static@latest/icons/check.svg" width="14" height="14" /> | <img src="https://unpkg.com/lucide-static@latest/icons/check.svg" width="14" height="14" /> | 自动适配端点和响应格式 |
| 自定义 | <img src="https://unpkg.com/lucide-static@latest/icons/check.svg" width="14" height="14" /> | <img src="https://unpkg.com/lucide-static@latest/icons/check.svg" width="14" height="14" /> | 任何 OpenAI 兼容 API |

### 变量系统工作流

```
AI 生成回复
  → 独立 API 调用提取 <UpdateVariable> JSON
  → VariableManager 解析并应用更新
  → normalizeState() 校验数值范围
  → 创建快照附加到消息（支持回滚）
```

### 记忆系统管线

```
写入 → 摘要 → 向量提取 → 查询重写 → 检索规划
→ 多轮补充 → 精排 → 检索定稿 → 上下文编译
```

每阶段独立 API 调用，默认串行执行（可通过配置开启并行）。

---

## <img src="https://unpkg.com/lucide-static@latest/icons/file-text.svg" width="20" height="20" /> 文档

- [架构文档](docs/ARCHITECTURE.md) — 完整的架构分析、用户流程、数据流、各层职责
- [变更日志](docs/CHANGELOG.md) — 版本更新记录

## <img src="https://unpkg.com/lucide-static@latest/icons/heart.svg" width="20" height="20" /> 致谢

### 记忆系统

本项目的记忆系统（编译式叙事记忆引擎）移植自 **lucklyjkop** 的项目，获得了原作者的授权许可。

- **原项目**：[异界转生录 (yijiekkk)](https://github.com/lucklyjkop/yijiekkk)
- **原作者**：[lucklyjkop](https://github.com/lucklyjkop)

#### 移植范围

| 模块 | 说明 |
|------|------|
| 记忆写入管线 | 叙事记忆提取 + 冲突裁决（事件卡冲突检测） |
| 摘要保存 | 3 类记忆压缩（玩家 / 角色 / 物品） |
| 检索规划 | 查询改写 → AI 规划 → 多轮补充 → 精排 |
| 上下文编译 | 将选中的记忆组装成注入文本 |
| 向量提取 | 长期事实记忆提取 |
| Mermaid 图谱 | 13 种图谱视图（场景、线程、状态、关系、事件、实体等） |

#### 适配说明

| 原项目 | 本项目 |
|--------|--------|
| Vue 3 Composition API | React 19 + Zustand |
| JavaScript | TypeScript（完整类型定义） |
| Pinia 状态管理 | Zustand Store |
| 暗金色图谱主题 | 项目浅色主题 |

感谢 lucklyjkop 的慷慨授权和详细的技术文档！

---

<div align="center">

<img src="https://unpkg.com/lucide-static@latest/icons/scale.svg" width="16" height="16" /> MIT License

</div>