# 更新日志

## v1.6.0 — 启动流程与角色创建

### ✨ 新增功能

- **启动界面** (`components/start/StartScreen`)：应用入口，主菜单、存档管理、向导流程
- **主菜单** (`components/start/MainMenuView`)：新建冒险、继续游戏、存档管理
- **存档管理** (`components/start/SavesView`)：存档列表、加载、删除
- **向导壳** (`components/start/WizardShell`)：角色创建向导容器
- **向导步骤**：世界选择、角色信息、角色历史、确认等步骤
- **引导选择** (`components/start/GuidedChoiceOverlay`)：引导式选择覆盖层
- **向导 Hook** (`hooks/useWizard`)：向导流程状态管理
- **角色历史 Hook** (`hooks/useCharacterHistory`)：角色历史记录管理
- **角色头像 Hook** (`hooks/useCharacterPortrait`)：角色头像生成与管理
- **年龄阶段** (`utils/ageStages`)：角色年龄阶段定义
- **游戏面板**：ProfilePanel（角色档案）、NotebookPanel（笔记本）、RightPanel（右侧面板）

### 🏗️ 架构

- App.tsx 更新：加入 StartScreen 和 SettingsScreen 路由
- 向导流程模块化，支持自定义步骤

## v1.5.0 — 世界生成与内置世界

### ✨ 新增功能

- **世界定义 Schema** (`data/worlds-schema`)：WorldDef 数据结构定义
- **世界加载器** (`data/worldLoader`)：世界加载、查找、世界书条目获取
- **内置世界数据** (`data/worlds/`)：预定义世界观配置
- **世界模板** (`data/worldTemplates/`)：世界创建模板
- **世界生成器** (`worldgen/`)：程序化世界生成
- **世界配置应用** (`engine/worldPersonality`)：世界书条目加载、启用/禁用、模块注入
- **内置预设** (`data/builtinPresets`)：系统内置预设包
- **世界选择步骤** (`components/start/StepWorld*.tsx`)：世界选择向导步骤
- **世界卡片** (`components/start/WorldCard`)：世界展示卡片
- **世界编辑表单** (`components/start/WorldEditorForm`)：世界编辑界面

### 🏗️ 架构

- 世界定义与模块系统解耦，通过 WorldDef 统一管理
- 支持 JSON 格式世界数据导入导出

## v1.4.0 — 世界模块化系统

### ✨ 新增功能

- **模块注入器** (`modules/injector`)：applyModulesV2 将模块注入提示词
- **模块运行时** (`modules/runtime`)：模块运行时状态管理
- **模块 Schema** (`modules/schema`)：模块数据结构定义
- **模块默认值** (`modules/defaults`)：生存、经营、骰子、天赋模块默认配置
- **经验算法** (`modules/xpAlgorithm`)：模块升级经验计算
- **模块归一化** (`modules/normalizeModule`)：模块数据归一化
- **内置模块数据** (`data/modules.ts`)：预定义模块配置
- **编译格式化器** (`memory/compileFormatter`)：记忆编译输出格式化
- **模块卡片** (`components/game/panels/ModuleCard`)：模块展示卡片
- **模块面板** (`components/game/panels/modules/`)：模块管理界面

### 🏗️ 架构

- 模块化系统支持热插拔，通过 injector 注入提示词
- 模块间独立，通过统一 Schema 管理

## v1.3.0 — NPC 系统与世界书

### ✨ 新增功能

- **世界书管理器** (`worldbook/index`)：支持 SillyTavern 级别的扫描引擎，正则关键词、选择逻辑、排除关键词、递归扫描、分组互斥、概率触发
- **NPC 辅助工具** (`utils/npcHelpers`)：NPC 创建、分类默认值、结构验证、快照格式化
- **NPC 创建 Hook** (`hooks/useNpcCreate`)：NPC 创建流程管理
- **NPC 填充 Hook** (`hooks/useNpcFill`)：NPC 数据自动填充
- **NPC 编辑器** (`components/start/NpcEditorModal`)：NPC 编辑弹窗
- **模块选择器** (`components/start/ModuleSelector`)：世界模块选择界面
- **世界书面板** (`components/game/panels/WorldBookPanel`)：世界书条目管理
- **角色网格** (`components/game/panels/CharacterGrid`)：NPC 角色展示网格
- **变量快照面板** (`components/game/panels/VariableSnapshotPanel`)：变量状态查看

### 🏗️ 架构

- 世界书支持 v2 扫描引擎，兼容 SillyTavern 格式
- NPC 系统与变量系统深度集成

## v1.2.0 — 叙事记忆系统

### ✨ 新增功能

- **编译式记忆管线** (`memory/memoryPipeline`)：六阶段全自动记忆处理（写入→摘要→向量化→检索→重排→编译）
- **叙事图谱** (`memory/narrativeGraph`)：Mermaid 可视化叙事节点关系图
- **叙事解析器** (`memory/narrativeParsers`)：从对话中提取叙事片段
- **向量工具** (`memory/vectorUtils`)：向量相似度计算与检索
- **记忆配置** (`memory/memoryConfig`)：记忆系统参数配置
- **记忆提示词** (`memory/memoryPrompts`)：记忆相关提示词模板
- **变量系统** (`schema/variables`)：结构化变量定义
- **设置界面**：记忆设置 Tab、变量设置 Tab、记忆设置覆盖层
- **Mermaid 图表面板** (`components/shared/MermaidGraphPanel`)：叙事图谱可视化

### 📄 文档

- 新增 `docs/reference-memory-system.md` 记忆系统参考文档

### 🙏 致谢

- 叙事记忆系统移植自 [lucklyjkop](https://github.com/lucklyjkop) 的项目，经原作者授权使用

## v1.1.0 — AI 引擎核心

### ✨ 新增功能

- **多阶段管线执行器** (`engine/pipelineExecutor`)：按 executionOrder 顺序/并行执行各模块，支持降级检测
- **变量管理器** (`engine/variableManager`)：GameState 多维数据模型，支持 JSON Path 安全读写
- **提示词组装器** (`engine/promptAssembler`)：从结构化 PresetPack 构建系统提示，支持宏替换、深度注入
- **上下文管理器** (`engine/contextManager`)：消息上下文清理，正则脚本系统
- **响应提取器** (`engine/responseExtractor`)：从 AI 响应中提取结构化数据
- **宏引擎** (`engine/macroEngine`)：支持 `{{macro}}` 语法的变量替换
- **API 客户端** (`api/client`)：OpenAI-compatible SSE 流式接口，支持重试
- **速率限制器** (`api/rateLimiter`)：API 请求速率控制
- **辅助 API** (`api/auxiliaryApi`)：变量规则提取等辅助功能
- **预设系统**：内置预设包 + 用户自定义预设，支持 JSON 导入/导出
- **设置界面** (`SettingsScreen`)：通用设置、API 设置、生图设置、预设管理

### 🏗️ 架构

- 引擎层与 UI 层解耦，通过 Hook 桥接
- 管线化执行，支持模块热插拔
- 变量系统支持嵌套对象和数组

## v1.0.0 — 项目初始发布

### ✨ 核心框架

- **React 19 + TypeScript 5 + Bun** 技术栈搭建
- **Zustand 5** 状态管理 + React Context
- **CSS 设计系统**：CSS 变量令牌、响应式断点、CSS Layers 分层
- **IndexedDB 持久化**：存档、配置、图片、模板本地存储
- **共享 UI 组件库**：Dialog、Collapsible、Avatar、EmptyState 等
