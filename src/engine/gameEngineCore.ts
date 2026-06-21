// 游戏引擎核心 - 从 useGameEngine.ts 提取的核心编排逻辑
import type { ApiConfig, Message } from '../api/types';
import { requestStreamWithRetry } from '../api/client';
import { extractContentForPrompt } from './responseExtractor';
import { VariableManager } from './variableManager';
import { eventBus, EVENTS } from './eventBus';
import { v4 as uuid } from 'uuid';
import type { WorldBookManager } from '../worldbook/index';
import { sanitizeForContext, getMessageContent } from './contextManager';
import { optimizeSnapshots } from '../storage/db';
import { PipelineExecutor } from './pipelineExecutor';
import { loadPipelineConfig, type PipelineStatus } from './pipelineTypes';
import type { ChatMessage } from './types';
import { getBuiltinPreset, getClaudePreset } from '../data/builtinPresets';
import { ROLE_COGNITION_FIREWALL_TITLE, ROLE_COGNITION_FIREWALL_CONTENT } from '../utils/roleCognitionFirewall';
import { assembleSystemPrompt, injectAtDepthEntries } from './promptAssembler';
import { MacroEngine } from './macroEngine';
import { useMemoryStore } from '../memory/memoryStore';
import { formatSnapshotForMainAI } from '../utils/npcHelpers';
import type { MemoryPipelineContext } from '../memory/useMemorySystem';
import { loadPresets } from '../components/settings/apiPresetUtils';
import {
  executeMemoryWrite,
  executeMemorySummary,
  executeMemoryVector,
  executeMemoryQueryRewrite,
  executeMemoryRetrievePlan,
  executeMemoryMultiRound,
  executeMemoryRerank,
  executeMemoryRetrieveFinalize,
  executeMemoryCompile,
} from '../memory/memoryPipeline';

export interface GameEngineCoreConfig {
  apiConfig: ApiConfig;
  varMgr: VariableManager;
  worldBook: WorldBookManager | null;
  messages: ChatMessage[];
  playerProfile: any;
  characterHistory: string;
  auxiliaryConfig: any;
  selectedWorld: string;
}

export interface GameEngineCoreCallbacks {
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  setIsGenerating: (value: boolean) => void;
  setPipelineStatus: (status: PipelineStatus | null) => void;
  onAutoSave?: () => void;
}

export class GameEngineCore {
  private config: GameEngineCoreConfig;
  private callbacks: GameEngineCoreCallbacks;
  private round: number = 0;
  private cancelController: AbortController | null = null;

  constructor(config: GameEngineCoreConfig, callbacks: GameEngineCoreCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  async sendMessage(userText: string): Promise<void> {
    const { apiConfig, varMgr, worldBook, messages, playerProfile, characterHistory, auxiliaryConfig, selectedWorld } = this.config;
    const { addMessage, updateMessage, setMessages, setIsGenerating, setPipelineStatus, onAutoSave } = this.callbacks;

    if (!apiConfig || !userText.trim()) return;

    setIsGenerating(true);
    this.round++;
    const round = this.round;

    const userMsg: ChatMessage = { id: uuid(), role: 'user', rawText: userText, round, timestamp: Date.now() };
    addMessage(userMsg);
    eventBus.emit(EVENTS.MESSAGE_SENT, userMsg);

    const aiMsgId = uuid();
    const aiMsg: ChatMessage = { id: aiMsgId, role: 'assistant', rawText: '', round, timestamp: Date.now(), streaming: true };
    addMessage(aiMsg);
    eventBus.emit(EVENTS.GENERATION_STARTED, aiMsgId);

    const controller = new AbortController();
    this.cancelController = controller;

    // 创建管线执行器
    const pipelineConfig = loadPipelineConfig();
    // 统一记忆系统启用状态：使用 memoryStore 的配置
    const memStoreForConfig = useMemoryStore.getState();
    pipelineConfig.memoryEnabled = memStoreForConfig.config.enabled;
    const executor = new PipelineExecutor(round, {
      onUpdate: () => {
        const status = executor.getStatus();
        setPipelineStatus({ ...status, stages: { ...status.stages } });
        eventBus.emit(EVENTS.PIPELINE_UPDATE, status);
      },
    });
    setPipelineStatus(executor.getStatus());

    try {
      // 使用管线执行器运行执行链
      // ── 记忆系统任务 ──
      const memStore = useMemoryStore.getState();
      const memConfig = memStore.config;

      // 解析记忆系统的 API preset，支持独立 API 配置
      const presets = loadPresets();
      const resolvePreset = (presetId: string | null | undefined) => {
        if (!presetId) return null;
        const preset = presets.find(p => p.id === presetId);
        return preset ? { baseUrl: preset.config.baseUrl, apiKey: preset.config.apiKey, model: preset.config.model } : null;
      };
      const defaultMemApi = { baseUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey, model: apiConfig.model };
      // 顶层 apiPresetId 作为记忆系统的默认 API；未设置则跟随主 API
      const memApiConfig = resolvePreset(memConfig.apiPresetId) ?? defaultMemApi;
      const playerName = playerProfile?.name || '冒险者';
      const batchText = userText + '\n\n' + '(等待AI回复)';
      const recentContext = sanitizeForContext(messages, round)
        .slice(-6)
        .map(m => m.content)
        .join('\n\n');

      const memCtx: MemoryPipelineContext = {
        floor: round,
        batchText,
        inputText: userText,
        recentContext,
        playerName,
        apiConfig: memApiConfig,
        // 各阶段独立 API preset（未设置则回退到 memApiConfig）
        writeApiConfig: resolvePreset(memConfig.writePipeline.apiPresetId) ?? undefined,
        summaryApiConfig: resolvePreset(memConfig.writePipeline.summaryApiPresetId) ?? undefined,
        conflictJudgeApiConfig: resolvePreset(memConfig.writePipeline.conflictJudgeApiPresetId) ?? undefined,
        retrievalApiConfig: resolvePreset(memConfig.retrieval.plannerApiPresetId) ?? undefined,
        vectorApiConfig: resolvePreset(memConfig.vectorExtractApiPresetId) ?? undefined,
      };

      const pipelineResult = await executor.execute({
        config: pipelineConfig,
        signal: controller.signal,
        varMgr,
        worldBook,
        userText,
        auxiliaryConfig: auxiliaryConfig ?? null,
        mainApiConfig: apiConfig,

        // 记忆系统任务集
        memoryTasks: memConfig.enabled ? {
          // 写入：叙事记忆写入 + 冲突裁决
          write: async () => {
            await executeMemoryWrite(memStore, memCtx);
          },
          // 摘要：3 类记忆保存
          summary: async () => {
            await executeMemorySummary(memStore, memCtx);
          },
          // 向量：向量事实提取（未启用则不传，管线自动标 skipped）
          vector: memConfig.vectorEnabled ? async () => {
            await executeMemoryVector(memStore, memCtx);
          } : undefined,
          // 查询改写
          queryRewrite: async () => {
            await executeMemoryQueryRewrite(memStore, memCtx);
          },
          // 检索规划
          retrievePlan: async () => {
            await executeMemoryRetrievePlan(memStore, memCtx);
          },
          // 多轮补充
          multiRound: async () => {
            await executeMemoryMultiRound(memStore, memCtx);
          },
          // 精排
          rerank: async () => {
            await executeMemoryRerank(memStore, memCtx);
          },
          // 检索收尾
          retrieveFinalize: async () => {
            await executeMemoryRetrieveFinalize(memStore, memCtx);
          },
          // 编译：组装注入文本
          compile: async () => {
            await executeMemoryCompile(memStore, memCtx);
          },
          // 错误日志 → 写入记忆系统的调试日志（UI 可见）
          debugLogger: (kind: string, message: string) => {
            memStore.appendWriteDebugLog({ kind: `error_${kind}`, message, timestamp: Date.now() });
          },
        } : undefined,

        // main 任务：正文生成
        mainTask: async () => {
          // ── 构建系统提示词（v2.0 结构化预设 + 宏引擎） ──
          const state = varMgr.createSafeSnapshotForPrompt();
          const varSnapshot = formatSnapshotForMainAI(state);

          // 世界书注入（v2 扫描引擎：支持正则关键词、选择逻辑、递归扫描、分组互斥）
          let wbInjection = '';
          const atDepthEntries: Array<{ depth: number; content: string }> = [];
          if (worldBook) {
            // 构建聊天历史供扫描引擎使用
            const scanHistory = messages.map(m => ({
              role: m.role,
              content: getMessageContent(m),
            }));
            const scanResult = worldBook.scanAndBuildInjection(scanHistory, userText);
            if (scanResult.beforeChar) wbInjection += scanResult.beforeChar + '\n\n';
            if (scanResult.afterChar) wbInjection += scanResult.afterChar + '\n\n';
            atDepthEntries.push(...scanResult.atDepthEntries);
          }

          // 玩家角色设定注入
          let playerProfileBlock = '';
          if (playerProfile?.name) {
            const perspectiveMap: Record<string, string> = {
              '第一人称': '请用第二人称"你"来称呼玩家，描写玩家的内心感受和第一视角体验。',
              '第二人称': '请用第二人称"你"来称呼玩家。',
              '第三人称': '请用第三人称称呼玩家角色。',
            };
            const perspectiveInstruction = perspectiveMap[playerProfile.perspective || '第三人称'] || perspectiveMap['第三人称'];

            let customNpcsBlock = '';
            if (playerProfile.customNpcs && playerProfile.customNpcs.length > 0) {
              const npcLines = playerProfile.customNpcs.map((npc: any) => {
                const parts = [npc.name];
                if (npc.gender) parts.push(`${npc.gender}`);
                if (npc.age) parts.push(`${npc.age}岁`);
                if (npc.race) parts.push(npc.race);
                if (npc.relationshipType) parts.push(`关系：${npc.relationshipType}`);
                if (npc.personality) parts.push(`性格：${npc.personality}`);
                if (npc.appearance) parts.push(`外貌：${npc.appearance}`);
                if (npc.background) parts.push(`背景：${npc.background}`);
                return `- ${parts.join('，')}`;
              }).join('\n');
              customNpcsBlock = `
自建NPC（玩家的初始关联角色，必须在游戏中以该身份登场）：
${npcLines}
人物档案中已预置这些NPC的完整数据，请直接使用。`;
            }

            playerProfileBlock = `
<PlayerProfile>
玩家角色设定（最高优先级，必须严格遵守）：
- 姓名：${playerProfile.name}
- 性别：${playerProfile.gender || '未设定'}
- 年龄：${playerProfile.age || '未设定'}
- 性格：${playerProfile.personality || '未设定'}
- 外貌：${playerProfile.appearance || '未设定'}
- 背景描述：${playerProfile.background || '无'}
- 职业：${playerProfile.career || '未设定'}
- 阶层：${playerProfile.socialClass || '未设定'}
- 所属组织：${playerProfile.organization || '无'}
- 特殊身份：${playerProfile.specialIdentity || '无'}
- 叙事视角：${playerProfile.perspective || '第三人称'}
${(() => {
  const skills = (state as any).玩家?.技能系统;
  if (skills && typeof skills === 'object' && Object.keys(skills).length > 0) {
    const lines = Object.entries(skills).map(([name, data]: [string, any]) => {
      const parts = [`【${name}】`];
      if (data.品质) parts.push(`品质:${data.品质}`);
      if (data.类型) parts.push(`类型:${data.类型}`);
      if (data.描述) parts.push(`效果:${data.描述}`);
      return `- ${parts.join(' | ')}`;
    });
    return `- 技能：\n${lines.join('\n')}`;
  }
  return '';
})()}
${characterHistory ? `- 角色经历：\n${characterHistory}` : ''}
${customNpcsBlock}
在故事开始时，玩家应以此身份登场。NPC 应以该角色的姓名和身份进行称呼和互动。
使用技能时，必须严格遵循技能描述中的效果，不要自行编造技能功能。
${perspectiveInstruction}
</PlayerProfile>
`;
          }

          // 获取上一次编译的记忆上下文（如果有）
          const compiledMemoryContext = memStore.lastCompiledContext?.fullText || '';

          // 使用结构化预设 + 宏引擎组装系统提示
          const preset = pipelineConfig.claudeMode ? getClaudePreset() : getBuiltinPreset('default');
          const macroEngine = new MacroEngine();
          const systemPrompt = assembleSystemPrompt(preset, {
            varSnapshot,
            wbInjection,
            playerProfileBlock,
            firewallTitle: ROLE_COGNITION_FIREWALL_TITLE,
            firewallContent: ROLE_COGNITION_FIREWALL_CONTENT,
            userText,
            round,
            macroEngine,
            compiledMemoryContext,  // ← 注入记忆上下文
          });

          const chatHistory = sanitizeForContext(messages, round);
          // 注入 atDepth 世界书条目到聊天历史
          const chatHistoryWithDepth = injectAtDepthEntries(chatHistory, atDepthEntries);
          const apiMessages: Message[] = [
            { role: 'system', content: systemPrompt },
            ...chatHistoryWithDepth,
            { role: 'user', content: userText },
          ];

          let accumulated = '';
          let reasoning = '';

          const result = await requestStreamWithRetry(apiConfig, apiMessages, {
            signal: controller.signal,
            onDelta: (_delta, acc) => { accumulated = acc; updateMessage(aiMsgId, { rawText: acc }); },
            onReasoning: (r) => { reasoning = r; },
          });

          let rawText = result.text || accumulated;

          // 如果响应为空（SSE尾部丢失等），重试一次
          if (!rawText.trim()) {
            let retryAccumulated = '';
            const retryResult = await requestStreamWithRetry(apiConfig, apiMessages, {
              signal: controller.signal,
              onDelta: (_delta, acc) => { retryAccumulated = acc; updateMessage(aiMsgId, { rawText: acc }); },
              onReasoning: (r) => { reasoning = r; },
            });
            rawText = retryResult.text || retryAccumulated;
            if (retryResult.reasoning) reasoning = retryResult.reasoning;
          }

          // StatusPlaceHolderImpl 处理
          if (rawText.includes('<StatusPlaceHolderImpl/>')) {
            rawText = rawText.replace(/<StatusPlaceHolderImpl\/>/g, '').trim();
            if (!rawText) {
              rawText = '🌍 欢迎来到世界漫游指南！\n\n请描述你的角色和想要穿越的世界，开始你的冒险之旅。\n\n你可以：\n• 直接描述你想做什么\n• 选择下方的推荐行动\n• 输入任何你想尝试的行动';
            }
          }

          updateMessage(aiMsgId, {
            rawText,
            streaming: false,
          });
          eventBus.emit(EVENTS.MESSAGE_RECEIVED, aiMsgId);

          return { text: rawText, parsed: { content: extractContentForPrompt(rawText), thinking: '' } };
        },
      });

      // 管线完成 — 保存当前变量快照到 AI 消息（用于回滚）
      const snapshot = varMgr.createSnapshot();
      // 创建记忆系统检查点（用于回滚）
      const memStoreForCheckpoint = useMemoryStore.getState();
      const memCheckpoint = memStoreForCheckpoint.createCheckpoint();
      updateMessage(aiMsgId, {
        snapshot,
        snapshotTime: Date.now(),
        memoryCheckpointId: memCheckpoint?.id,
      });

      // 清理内存中的冗余快照，防止内存无限增长
      setMessages(prev => optimizeSnapshots(prev));

      setPipelineStatus(pipelineResult.status);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // 不覆盖已生成的正文，只标记停止
        updateMessage(aiMsgId, { streaming: false });
      } else {
        updateMessage(aiMsgId, { rawText: `[错误] ${err.message}`, streaming: false });
      }
    } finally {
      setIsGenerating(false);
      this.cancelController = null;
      eventBus.emit(EVENTS.GENERATION_ENDED, aiMsgId);
      // 直接触发自动存档（通过 ref 回调，不依赖事件总线时序）
      try { onAutoSave?.(); } catch (e) { console.warn('[auto-save] 回调失败:', e); }
    }
  }

  cancel(): void {
    this.cancelController?.abort();
  }

  getRound(): number {
    return this.round;
  }

  setRound(round: number): void {
    this.round = round;
  }
}
