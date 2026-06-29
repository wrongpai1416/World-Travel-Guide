# 更新日志

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
