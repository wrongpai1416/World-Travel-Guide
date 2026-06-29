# <img src="https://unpkg.com/lucide-static@latest/icons/globe-2.svg" width="32" height="32" /> 世界漫游指南 (World Travel Guide)

**AI 驱动的互动小说引擎** — 在自定义世界观中创建角色、展开冒险，与 AI 共同书写属于你的故事。

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-FBF0CF?logo=bun)](https://bun.sh/)
[![Zustand](https://img.shields.io/badge/Zustand-5-3B3B3B)](https://zustand-demo.pmnd.rs/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## <img src="https://unpkg.com/lucide-static@latest/icons/sparkles.svg" width="20" height="20" /> 核心特性

### <img src="https://unpkg.com/lucide-static@latest/icons/cog.svg" width="16" height="16" /> 项目基础框架

- **React 19 + TypeScript 5 + Bun** 现代化前端技术栈
- **Zustand 5** 轻量级状态管理
- **CSS 设计系统**：CSS 变量令牌 + 响应式断点 + CSS Layers 分层
- **IndexedDB 持久化**：存档、配置、图片、模板本地存储
- **共享 UI 组件库**：Dialog、Collapsible、Avatar、EmptyState 等

### <img src="https://unpkg.com/lucide-static@latest/icons/cpu.svg" width="16" height="16" /> AI 引擎核心

- **多阶段管线执行器**：按 executionOrder 顺序/并行执行各模块，支持降级检测
- **变量管理器**：GameState 多维数据模型（玩家、NPC、世界、系统变量），支持 JSON Path 安全读写
- **提示词组装器**：从结构化 PresetPack 构建完整系统提示，支持宏替换、深度注入、内联图片生成
- **上下文管理器**：消息上下文清理，正则脚本系统替代硬编码标签清理
- **响应提取器**：从 AI 响应中提取结构化数据
- **API 客户端**：OpenAI-compatible SSE 流式接口，支持重试与速率限制
- **预设系统**：内置预设包 + 用户自定义预设，支持 JSON 导入/导出

### <img src="https://unpkg.com/lucide-static@latest/icons/brain.svg" width="16" height="16" /> 叙事记忆系统

- **编译式记忆管线**：写入→摘要→向量化→检索→重排→编译，六阶段全自动
- **叙事图谱**：Mermaid 可视化叙事节点关系图
- **变量系统**：结构化变量定义 + 变量设置覆盖层
- **向量检索**：支持向量相似度检索与重排序
- **正则脚本**：可配置的标签清理与内容过滤

> **致谢**：叙事记忆系统移植自 [lucklyjkop](https://github.com/lucklyjkop) 的项目，经原作者授权使用。特此感谢。

### <img src="https://unpkg.com/lucide-static@latest/icons/users.svg" width="16" height="16" /> NPC 系统与世界书

- **世界书管理器**：SillyTavern 级别扫描引擎，支持正则关键词、选择逻辑、递归扫描、分组互斥、概率触发
- **NPC 创建与填充**：useNpcCreate / useNpcFill Hook，支持结构验证与数据自动填充
- **NPC 编辑器**：可视化 NPC 编辑弹窗
- **世界书面板**：游戏内世界书条目管理
- **角色网格**：NPC 角色展示与管理

### <img src="https://unpkg.com/lucide-static@latest/icons/package.svg" width="16" height="16" /> 世界模块化系统

- **模块注入器**：applyModulesV2 将模块配置注入 AI 提示词
- **内置模块**：生存（生命/饥饿/疲劳）、经营（资源/贸易）、骰子（随机/检定）、天赋（技能树）
- **模块运行时**：独立运行时状态管理，支持热插拔
- **经验算法**：模块升级经验计算与等级系统

## <img src="https://unpkg.com/lucide-static@latest/icons/file-text.svg" width="20" height="20" /> 文档

- [架构文档](docs/ARCHITECTURE.md) — 完整的架构分析、用户流程、数据流、各层职责
- [变更日志](docs/CHANGELOG.md) — 版本更新记录
