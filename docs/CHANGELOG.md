# 更新日志

## v1.8 — 桌面端与部署

### ✨ 新功能

- **Tauri 桌面端** (`src-tauri/`)：Tauri 2.x 桌面应用配置，支持 Windows / macOS / Linux
- **原生 HTTP 桥接**：Tauri 环境下使用原生 HTTP 请求，绕过浏览器 CORS 限制
- **构建脚本** (`scripts/`)：自动化构建、发布流程
- **Cloudflare Worker** (`docs/cloudflare-worker.js`)：边缘部署配置，全球 CDN 加速
- **架构图表**：角色创建流程图、世界书架构图

### 🏗 技术架构

- Tauri 2.x + Rust 后端
- PWA + 桌面端双模式部署
- Service Worker 离线缓存

---

## v1.7 — 游戏主界面与多媒体

### ✨ 新功能

- **游戏界面** (`GameScreen`)：聊天、面板、覆盖层一体化游戏主界面
- **聊天组件** (`chat/`)：消息列表、输入框、消息气泡、Markdown 渲染、代码高亮
- **管线监控**：实时显示管线各阶段状态，支持单步重试
- **移动端覆盖层** (`MobileOverlay`)：移动端专属 UI 覆盖
- **经营覆盖层** (`BusinessOverlay`)：经营系统覆盖界面
- **图片画廊** (`ImageGallery`)：生成图片展示与管理
- **生图系统** (`useImageGen`)：队列化异步生成，ComfyUI 集成
- **生图设置** (`ImageGenSettingsTab`)：生图配置界面

### 🔧 改进

- **记忆管线并行化**：写入阶段（叙事记忆、摘要保存、向量提取）改为并行执行，提升约 60-70% 性能
- **冲突裁决并行化**：事件卡和实体卡的冲突裁决改为 Promise.all 并行处理
- **管线单步重试**：监控弹窗中失败的 API 阶段显示重试按钮，支持单独重试某个阶段

### 🐛 修复

- 修复 `MessageBubble` 中 `getActivePreset()` 作为 Zustand selector 每次返回新对象引用导致的无限重渲染
- 修复 AbortController 泄漏问题

---

## v1.6 — 启动流程与角色创建

### ✨ 新功能

- **启动界面** (`StartScreen`)：应用入口，主菜单、存档管理、向导流程
- **主菜单** (`MainMenuView`)：新建冒险、继续游戏、存档管理
- **存档管理** (`SavesView`)：存档列表、加载、删除、导入导出
- **向导壳** (`WizardShell`)：角色创建向导容器
- **向导步骤**：世界选择 → 角色信息 → 角色历史 → 确认
- **引导选择** (`GuidedChoiceOverlay`)：引导式选择覆盖层，支持多选（最多 2-3 个选项）
- **自定义选项 E 卡片**：多选模式下支持添加自定义选项
- **角色历史 Hook** (`useCharacterHistory`)：角色历史记录管理
- **角色头像 Hook** (`useCharacterPortrait`)：角色头像生成与管理
- **年龄阶段** (`ageStages`)：角色年龄阶段定义
- **游戏面板**：ProfilePanel（角色档案）、NotebookPanel（笔记本）、RightPanel（右侧面板）
- **NPC 模块同步**：NPC 继承世界的数值属性和成长体系
- **变量结构扩展**：新增 NPC 段位（`npc_tier`）和经验值（`npc_xp`）
- **PWA 支持**：Service Worker 缓存优先策略 + Web App Manifest，支持安装到桌面

### 🔧 改进

- **conflict 维度持久化**：核心冲突选择保存到 setting 条目的 meta 中
- **assembler 多选支持**：世界书条目组装器正确处理多选维度
- **世界编辑器防误触**：点击遮罩层不再关闭面板
- **移动端头部优化**：显示世界名称而非世界 ID
- **存档导入修复**：支持 `{save: {...}}` 嵌套格式
- **存档导出文件名**：改为 `world-wanderer-save-{timestamp}.json`
- **ProfilePanel 去重**：移除与 RightPanel 重复的生存状态显示
- **Service Worker 缓存策略**：开发环境改为网络优先，避免缓存旧代码

### 🐛 修复

- 修复多选切换时快速点击导致选择丢失的问题（stale closure）
- 修复自定义选项选中状态不显示高亮的问题
- 修复 handleSaveCustom 多选支持问题

---

## v1.5 — 世界生成与内置世界

### ✨ 新功能

- **世界定义 Schema** (`worlds-schema`)：WorldDef 统一数据结构
- **世界加载器** (`worldLoader`)：世界查找、世界书条目获取
- **内置世界数据** (`worlds/`)：6 个预定义世界观
  - 日式校园（无模块）→ 入门纯文游
  - 欲望魔都（数值）→ 都市题材
  - 武侠世界（数值+成长）→ 武侠题材
  - 末日废土（数值+成长+天赋+骰子）→ 异能冒险
  - 荒岛求生（生存资源）→ 生存题材
  - 边境贸易（经营资产）→ 经营题材
- **世界模板** (`worldTemplates/`)：世界创建模板（奇幻、历史、现代、科幻）
- **世界生成器** (`worldgen/`)：程序化世界生成，选择式流程
- **世界配置应用** (`worldPersonality`)：世界书条目加载、启用/禁用、模块注入
- **内置预设** (`builtinPresets`)：系统内置预设包
- **世界选择步骤** (`StepWorld*`)：世界选择向导步骤
- **世界卡片** (`WorldCard`)：世界展示卡片，添加难度标签
- **世界编辑表单** (`WorldEditorForm`)：世界编辑界面

### 🔧 改进

- **世界卡片样式重构**：提升卡片质感，优化视觉效果
- **统一 `findWorldDef`**：删除 `useGameEngine.ts` 中的重复定义，统一使用 `worldLoader.ts` 导出
- **修复硬编码 key**：`localStorage.getItem` 改为 `STORAGE_KEYS.CUSTOM_WORLDS`

---

## v1.4 — 世界模块化系统

### ✨ 新功能

- **模块注入器** (`injector`)：applyModulesV2 将模块配置注入 AI 提示词
- **模块运行时** (`runtime`)：模块运行时状态管理
- **模块 Schema** (`schema`)：模块数据结构定义
- **模块默认值** (`defaults`)：生存、经营、骰子、天赋模块默认配置
- **经验算法** (`xpAlgorithm`)：模块升级经验计算
- **模块归一化** (`normalizeModule`)：模块数据归一化
- **内置模块数据** (`data/modules.ts`)：预定义模块配置
- **编译格式化器** (`compileFormatter`)：记忆编译输出格式化
- **模块卡片** (`ModuleCard`)：模块展示卡片
- **模块面板** (`modules/`)：生存、经营、骰子、天赋、数值、进度、六维属性卡片

### ✨ 模块系统

- **天赋体系模块**：完整天赋系统，品质分为普通/精良/稀有/史诗/传说五档
- **天赋觉醒卡片**：AI 触发天赋觉醒时渲染内联天赋卡片
- **生存资源制作系统**：配方生成、手动制作、资源消耗与产出
- **配方 AI 生成**：输入需求自动生成 JSON 配方，带错误容错

### 🔧 改进

- **模块依赖显示**：选择成长体系时，数值属性自动显示"自动启用"标签
- **天赋世界书集成**：天赋模块勾选后自动注入天赋规则到世界书

---

## v1.3 — NPC 系统与世界书

### ✨ 新功能

- **世界书管理器** (`worldbook/`)：SillyTavern 级别扫描引擎
  - 正则关键词匹配
  - 选择逻辑（selective 模式）
  - 排除关键词（excludeRecursion）
  - 递归扫描（多层级）
  - 分组互斥（同组条目互斥激活）
  - 概率触发（triggerChance）
- **NPC 辅助工具** (`npcHelpers`)：NPC 创建、分类默认值、结构验证、快照格式化
- **NPC 创建 Hook** (`useNpcCreate`)：NPC 创建流程管理
- **NPC 填充 Hook** (`useNpcFill`)：NPC 数据自动填充
- **NPC 编辑器** (`NpcEditorModal`)：NPC 编辑弹窗
- **模块选择器** (`ModuleSelector`)：世界模块选择界面
- **世界书面板** (`WorldBookPanel`)：世界书条目管理
- **角色网格** (`CharacterGrid`)：NPC 角色展示与管理
- **变量快照面板** (`VariableSnapshotPanel`)：变量状态查看

---

## v1.2 — 叙事记忆系统

### ✨ 新功能

- **编译式记忆管线** (`memoryPipeline`)：六阶段全自动记忆处理
  1. Write（写入）— 从对话中提取叙事片段
  2. Summary（摘要）— 记忆片段摘要压缩
  3. Vector（向量化）— 向量化用于检索
  4. Retrieve（检索）— 根据上下文检索相关记忆
  5. Rerank（重排）— 检索结果重排序
  6. Compile（编译）— 编译为可注入提示词
- **叙事图谱** (`narrativeGraph`)：Mermaid 可视化叙事节点关系图
- **叙事解析器** (`narrativeParsers`)：从对话中提取叙事片段
- **向量工具** (`vectorUtils`)：向量相似度计算与检索
- **记忆配置** (`memoryConfig`)：记忆系统参数配置
- **记忆提示词** (`memoryPrompts`)：记忆相关提示词模板
- **变量系统** (`schema/variables`)：结构化变量定义
- **设置界面**：记忆设置 Tab、变量设置 Tab、记忆设置覆盖层
- **Mermaid 图表面板** (`MermaidGraphPanel`)：叙事图谱可视化

### 📄 文档

- 新增 `docs/reference-memory-system.md` 记忆系统参考文档

### 🙏 致谢

- 叙事记忆系统移植自 [lucklyjkop](https://github.com/lucklyjkop) 的项目，经原作者授权使用

---

## v1.1 — AI 引擎核心

### ✨ 新功能

- **多阶段管线执行器** (`pipelineExecutor`)：按 executionOrder 顺序/并行执行各模块，支持降级检测
- **变量管理器** (`variableManager`)：GameState 多维数据模型，支持 JSON Path 安全读写
- **提示词组装器** (`promptAssembler`)：从结构化 PresetPack 构建系统提示，支持宏替换、深度注入
- **上下文管理器** (`contextManager`)：消息上下文清理，正则脚本系统
- **响应提取器** (`responseExtractor`)：从 AI 响应中提取结构化数据
- **宏引擎** (`macroEngine`)：支持 `{{macro}}` 语法的变量替换
- **API 客户端** (`api/client`)：OpenAI-compatible SSE 流式接口，支持重试
- **速率限制器** (`api/rateLimiter`)：API 请求速率控制
- **辅助 API** (`api/auxiliaryApi`)：变量规则提取等辅助功能
- **预设系统**：内置预设包 + 用户自定义预设，支持 JSON 导入/导出
- **设置界面** (`SettingsScreen`)：通用设置、API 设置、生图设置、预设管理

### 🏗 技术架构

- 引擎层与 UI 层解耦，通过 Hook 桥接
- 管线化执行，支持模块热插拔
- 变量系统支持嵌套对象和数组

---

## v1.0 — 项目骨架与基础框架

### ✨ 核心框架

- **React 19 + TypeScript 5 + Bun** 现代化前端技术栈
- **Zustand 5** 轻量级状态管理
- **CSS 设计系统**：CSS 变量令牌 + 响应式断点 + CSS Layers 分层
- **IndexedDB 持久化**：存档、配置、图片、模板本地存储
- **共享 UI 组件库**：Dialog、Collapsible、Avatar、EmptyState 等

### 🏗 技术架构

- 状态管理：Zustand + React Context (useReducer)
- 持久化：IndexedDB (存档) + localStorage (配置)
- 样式：纯 CSS + CSS 变量设计系统 + CSS Layers (base/layout/state/theme/print/a11y)
- 导航：状态驱动，无 React Router
