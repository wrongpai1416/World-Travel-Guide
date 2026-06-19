<div align="center">

# <img src="https://unpkg.com/lucide-static@latest/icons/globe-2.svg" width="36" height="36" /> 世界漫游指南

**AI-Powered Interactive Fiction Engine**

<img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" /> <img src="https://img.shields.io/badge/Bun-FBF0CF?style=for-the-badge&logo=bun&logoColor=black" /> <img src="https://img.shields.io/badge/Zustand-594B3E?style=for-the-badge" /> <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />

基于 React 19 + TypeScript 的 AI 互动叙事引擎，支持多世界观、多阶段管线执行、编译式记忆系统与实时变量管理。

**[在线体验](https://world-travel-guide.pages.dev)** · [问题反馈](https://github.com/wrongpai1416/World-Travel-Guide/issues)

</div>

---

## <img src="https://unpkg.com/lucide-static@latest/icons/sparkles.svg" width="20" height="20" /> 核心特性

### <img src="https://unpkg.com/lucide-static@latest/icons/wand-sparkles.svg" width="18" height="18" /> 游戏向导

5 步式角色创建流程：世界选择 → 世界浏览 → 世界详情 → 角色创建 → 人物经历（分段式 AI 生成，支持单段重新生成）

### <img src="https://unpkg.com/lucide-static@latest/icons/message-circle.svg" width="18" height="18" /> 对话引擎

- AI 流式对话（支持 OpenAI / DeepSeek / Google AI / 自定义端点）
- 思维链展示 + 行动选项 + 结构化摘要
- 消息编辑 / 删除 / 重新发送 / 回滚

### <img src="https://unpkg.com/lucide-static@latest/icons/workflow.svg" width="18" height="18" /> 多阶段管线系统

```
正文生成 → 记忆写入 → 摘要保存 → 向量提取 → 检索规划 → 上下文编译 → 变量提取
```

- 正文生成与变量提取完全分离，变量提取不阻塞正文显示
- 支持重试机制、延迟配置、独立 API 预设
- 管线状态实时监控

### <img src="https://unpkg.com/lucide-static@latest/icons/brain.svg" width="18" height="18" /> 编译式记忆引擎

- **记忆写入**：从 AI 回复中提取场景锚点、叙事线程、状态槽、关系边、事件卡、实体档案
- **摘要保存**：定期压缩为 3 类摘要（玩家 / 角色 / 物品）
- **检索规划**：AI 规划注入哪些记忆，支持查询改写、多轮补充、精排
- **向量提取**：提取长期事实作为向量记忆
- **冲突裁决**：新事件卡与旧卡冲突检测

### <img src="https://unpkg.com/lucide-static@latest/icons/network.svg" width="18" height="18" /> 图谱可视化

- 13 种 Mermaid 图谱视图（场景、线程、状态、关系、事件、实体等）
- 支持平移、缩放、节点交互、节点详情弹窗

### <img src="https://unpkg.com/lucide-static@latest/icons/database.svg" width="18" height="18" /> 变量系统

- 快照层：每轮对话保存变量快照，支持查看、编辑、回滚
- NPC 感知合并 + RFC 6902 Patch
- 独立辅助 API 配置

### <img src="https://unpkg.com/lucide-static@latest/icons/hard-drive.svg" width="18" height="18" /> 存档系统

| 特性 | 说明 |
|------|------|
| **多存档支持** | 每次新游戏生成独立存档 ID，不限数量 |
| **自动存档** | 500ms debounce + coalescing 防并发写入 |
| **手动存档** | 游戏内侧边栏即时保存 |
| **快照优化** | 保存前自动瘦身（首条 + 最后 10 条 + 每 10 条关键帧） |
| **导入/导出** | JSON 文件（去除 API key）/ 导入自动分配新 ID |
| **F5 恢复** | 刷新后自动恢复上次活跃存档 |

### <img src="https://unpkg.com/lucide-static@latest/icons/settings-2.svg" width="18" height="18" /> 预设系统

- 结构化提示词管理（15 个独立模块）
- 支持宏替换与条件触发
- 正则脚本系统（显示 / API 双通道独立清理）

### <img src="https://unpkg.com/lucide-static@latest/icons/layout-dashboard.svg" width="18" height="18" /> 状态面板

- 人物档案（概览 / 背景 / 能力 / 事迹，30+ 扩展字段）
- 人物关系网格（NPC 概览 + 事迹摘要）
- 笔记本（危机 / 机遇 / 待办）
- 右侧实时状态栏（时间 / 地点 / 天气 / 权力结构 / 社会氛围）

---

## <img src="https://unpkg.com/lucide-static@latest/icons/palette.svg" width="20" height="20" /> UI 设计

日系文字游戏风格的暗雅设计语言。

### 主题配色

| 主题 | 色调 | 强调色 |
|:----:|:----:|:------:|
| 拂晓 | 浅蓝白 | `#3b82f6` |
| 玄夜 | 暗底金色 | `#c8a26c` |
| 银灰 | 浅灰白 | `#6b7a94` |
| 翠林 | 浅绿白 | `#4a8c6a` |

### 设计系统

| 要素 | 规范 |
|------|------|
| 字体 | 标题 `Noto Serif SC`（衬线），正文跟随用户设置 |
| 图标 | Lucide React，16-20px，`strokeWidth: 1.5` |
| 头像 | 字首圆形头像，名字哈希生成渐变背景色 |
| 间距 | 8px 基准网格（4/8/12/16/20/24/32/40px） |
| 圆角 | 4/8/12/16px + 50% |
| 弹窗 | 自定义 Dialog 组件（`useDialog` hook），匹配主题风格 |
| 动效 | 主菜单入场动画、抽屉侧滑、弹窗缩放淡入 |

---

## <img src="https://unpkg.com/lucide-static@latest/icons/rocket.svg" width="20" height="20" /> 快速开始

### 方式一：在线体验

直接访问 **https://world-travel-guide.pages.dev**

配置 API Key 后即可开始游戏（支持 OpenAI / DeepSeek / Google AI）

### 方式二：本地运行

```bash
# 克隆项目
git clone https://github.com/wrongpai1416/World-Travel-Guide.git
cd World-Travel-Guide

# 安装依赖
bun install

# 启动开发服务器（默认 http://localhost:3456）
bun run dev

# 构建生产版本
bun run build
```

---

## <img src="https://unpkg.com/lucide-static@latest/icons/gamepad-2.svg" width="20" height="20" /> 怎么玩？

### 基本流程

1. 点击「新游戏」→ 选择世界 → 填写角色信息 → 开始冒险
2. 输入你的行动或对话，AI 会继续故事
3. 也可以点击「行动选项」快速选择

### 操作说明

| 操作 | 说明 |
|------|------|
| 消息右上角「...」 | 回滚 / 编辑 / 删除 / 重新发送 |
| 右侧栏 | 实时世界状态（时间、地点、天气、权力结构） |
| 导航栏图标 | 人物档案、人物关系、笔记本、变量系统、记忆系统 |
| 设置 | API 配置、记忆系统、UI 主题 |
| 思维链 | 查看 AI 推理过程（可关闭） |

---

## <img src="https://unpkg.com/lucide-static@latest/icons/brain.svg" width="20" height="20" /> 记忆系统

让 AI 记住你的故事：

### 记忆类型

| 类型 | 说明 |
|------|------|
| **场景锚点** | 记住你去过哪里 |
| **叙事线程** | 追踪剧情发展 |
| **状态槽** | 记录角色状态变化 |
| **关系边** | 记录 NPC 关系变化 |
| **事件卡** | 记录重要事件 |
| **实体档案** | 记住遇到的人和物 |
| **向量记忆** | 长期事实记忆 |

### 图谱可视化

右侧边栏「图谱」可查看 13 种可视化图谱，支持：
- 平移、缩放
- 节点交互
- 节点详情弹窗

---

## <img src="https://unpkg.com/lucide-static@latest/icons/database.svg" width="20" height="20" /> 变量系统

追踪生命值、体力、金币等量化数据：

- **快照回滚**：每轮对话保存变量快照，支持查看、编辑、回滚
- **NPC 感知合并**：NPC 会根据感知到的信息调整行为
- **RFC 6902 Patch**：精确的变量差异更新
- **独立 API 配置**：可为变量提取配置独立的 API

---

## <img src="https://unpkg.com/lucide-static@latest/icons/hard-drive.svg" width="20" height="20" /> 存档系统

### 自动保存

- 每次对话后自动存档
- 500ms debounce + coalescing 防并发写入
- F5 刷新自动恢复上次进度

### 多槽位管理

- 支持多个存档槽位
- 每次新游戏生成独立存档 ID
- 不限存档数量

### 导入导出

- 导出为 JSON 文件（自动去除 API key）
- 导入自动分配新存档 ID
- 方便备份和分享

---

## <img src="https://unpkg.com/lucide-static@latest/icons/settings.svg" width="20" height="20" /> 技术栈

| 技术 | 用途 |
|------|------|
| **React 19 + TypeScript** | UI 框架 + 类型安全 |
| **Zustand** | 轻量状态管理 |
| **Bun** | 开发服务器 + 构建打包 |
| **Lucide React** | SVG 图标系统 |
| **IndexedDB (idb)** | 存档持久化 |
| **Lodash ES** | 深度克隆 / 合并 / 补丁 |
| **Mermaid** | 图谱可视化 |
| **marked + DOMPurify + highlight.js** | Markdown 渲染 |
| **Zod** | 运行时数据验证 |

---

## <img src="https://unpkg.com/lucide-static@latest/icons/folder-tree.svg" width="20" height="20" /> 项目结构

```
src/
├── api/                  # 网络层
│   ├── client.ts         #   请求 / 流式响应 / 重试
│   ├── auxiliaryApi.ts   #   辅助 API（变量提取）
│   └── types.ts          #   ApiConfig / Provider 类型
│
├── engine/               # 游戏引擎（纯逻辑）
│   ├── useGameEngine.ts  #   消息发送 / 流式 / 管线调度
│   ├── pipelineExecutor.ts#  多阶段管线执行器
│   ├── promptAssembler.ts#   结构化提示词组装
│   ├── macroEngine.ts    #   宏替换引擎
│   ├── variableManager.ts#   变量（快照 / 回滚 / Patch）
│   └── types.ts          #   ChatMessage / GameEngine
│
├── memory/               # 记忆系统
│   ├── memoryStore.ts    #   记忆状态管理
│   ├── memoryUtils.ts    #   记忆工具函数
│   ├── narrativeGraph.ts #   叙事图谱
│   ├── memoryPrompts.ts  #   记忆提示词
│   └── useMemorySystem.ts#   记忆系统 hooks
│
├── components/
│   ├── game/             #   游戏主界面
│   │   ├── GameScreen.tsx#     三栏布局 + 抽屉 + 存档面板
│   │   ├── chat/         #     聊天（气泡 / 输入 / 思维链 / 管线）
│   │   └── panels/       #     面板（档案 / 关系 / 笔记）
│   ├── start/            #   开始页（主菜单 / 向导 / 世界编辑器 / 存档）
│   ├── settings/         #   设置（API / 变量系统 / 记忆系统）
│   └── shared/           #   通用组件（Avatar / Dialog / Collapsible）
│
├── stores/               # Zustand 状态管理
│   ├── configStore.ts    #   UI 设置 + API 配置
│   └── saveStore.ts      #   多槽位存档管理
│
├── context/              # React Context（导航 + 引擎生命周期）
│   └── GameContext.tsx
│
├── schema/               # GameState 类型定义
├── storage/              # IndexedDB 存储层
├── data/                 # 内置数据（世界 / 预设）
├── utils/                # 工具函数
└── worldbook/            # 世界书管理器
```

---

## <img src="https://unpkg.com/lucide-static@latest/icons/plug.svg" width="20" height="20" /> API 兼容

| Provider | 说明 |
|----------|------|
| OpenAI 兼容 | 标准 `/v1/chat/completions` 端点 |
| DeepSeek | 自动合并连续同 role 消息 |
| Google AI | Gemini API (v1beta) |
| 自定义 | 任意 OpenAI 兼容端点 |

支持保存多个 API 预设，可为不同管线阶段使用不同 API 配置。

---

## <img src="https://unpkg.com/lucide-static@latest/icons/help-circle.svg" width="20" height="20" /> 常见问题

### 这是什么类型的游戏？

世界漫游指南是一款 **AI 驱动的文字冒险游戏**。你扮演一名穿越者，在不同的世界观中自由探索、与 NPC 互动、做出选择，AI 会根据你的行动实时生成剧情。没有固定结局，故事由你和 AI 共同书写。

### 内置了哪些世界？

目前内置 **7 个世界**，每个都有独立的设定、种族、职业和 NPC 体系：

| 世界 | 风格 |
|:----:|:----:|
| 武侠世界 | 江湖恩怨、门派纷争 |
| 赛博朋克都市 | 霓虹灯下的暗流涌动 |
| 水晶世界 | 魔法与水晶的力量 |
| 日式校园 | 青春与秘密交织 |
| 废土末日 | 荒野求生、资源争夺 |
| 宫廷权谋 | 深宫之中步步为营 |
| 欲望都市 | 现代都市的欲望与选择 |

你也可以用**世界编辑器**创建自己的世界，或导入其他玩家分享的世界 JSON。

### 角色创建有哪些玩法？

向导支持创建**主角**和**自建 NPC**：

- **主角**：姓名、性别、年龄、性格、外貌、职业、阶层、所属组织、特殊身份、初始技能、初始物品，还可以一键 AI 补全
- **自建 NPC**：设定姓名、关系、性格（表/里）、外貌、目标等，会自动融入剧情
- **人物模板**：主角和 NPC 都可以保存为模板，下次开局直接导入，不用重复填写
- **人物经历**：AI 会根据你的角色和世界设定，生成分段式的人生经历（序章 + 多个人生阶段），支持单段重新生成

### 游戏界面怎么操作？

游戏采用**三栏布局**：

- **中间**：对话区域，你和 AI 的互动在这里进行，支持思维链展示和行动选项快捷选择
- **右侧**：实时世界状态栏（当前时间、地点、天气、权力结构、社会氛围）
- **导航栏**：点击图标打开对应面板 —— 人物档案、人物关系网格、笔记本（危机/机遇/待办）、变量系统、记忆系统

每条消息右上角的「...」菜单可以编辑、删除、回滚或重新发送。

### 记忆系统有什么用？

记忆系统让 AI **真正记住你的故事**，而不是只看最近几轮对话。它会自动提取场景锚点、叙事线程、NPC 关系变化、重要事件等，存入编译式记忆引擎。下次对话时，AI 会根据记忆规划注入相关上下文，让剧情连贯、NPC 行为一致。还可以在「图谱」面板查看 13 种可视化关系图。

### 变量系统是什么？

变量系统自动追踪生命值、体力、金币等**量化数据**，每轮对话保存快照，支持查看、编辑和回滚。NPC 也会根据感知到的变量变化调整行为。

### AI 回复慢怎么办？

- 换更快的模型（如 GPT-4o、Claude Sonnet）
- 在设置中减少记忆系统调用频率
- 管线系统支持独立 API 配置，可以让变量提取用便宜的模型

### 游戏卡住了怎么办？

- 刷新页面（F5 会自动恢复上次进度，不会丢档）
- 检查设置中的 API 连接状态
- 查看管线状态监控，看是哪个阶段卡住了

### 存档能备份吗？

支持**导入/导出 JSON 文件**（自动去除 API Key），方便备份或分享给朋友。每次新游戏自动生成独立存档，不限数量。

---

## <img src="https://unpkg.com/lucide-static@latest/icons/file-text.svg" width="20" height="20" /> 更新日志

### v1.5.3 (2026-06-14)

- 存档取名优化
- 修复类型和一致性问题
- 清理调试日志

### v1.5.0 (2026-06-13)

- 移动端响应式适配
- 管线重构 + 限流配置
- 触控目标优化（≥ 44px）

### v1.0.0 (2026-06-13)

- 首个正式版本
- 完整游戏引擎、记忆系统与管线架构

---

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
