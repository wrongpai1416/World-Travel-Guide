// 游戏引擎 - 管线化消息发送、流式响应、变量更新
import { useCallback, useRef, useState, useEffect } from 'react';
import type { ApiConfig, Message } from '../api/types';
import { requestStreamWithRetry } from '../api/client';
import { setRateLimitInterval } from '../api/rateLimiter';
import { extractContentForPrompt, extractThinking, extractActionOptions, extractSummary } from './responseExtractor';
import { getMessageContent } from './contextManager';
import { VariableManager } from './variableManager';
import { eventBus, EVENTS } from './eventBus';
import { v4 as uuid } from 'uuid';
import type { WorldBookManager } from '../worldbook/index';
import { sanitizeForContext } from './contextManager';
import type { GameSave, PlayerProfile, CustomNpc } from '../storage/db';
import { optimizeSnapshots } from '../storage/db';
import { loadWorldBook, applyWorld, applyModules } from './worldPersonality';
import { WORLDS } from '../data/worldLoader';
import type { WorldDef } from '../data/worlds-schema';
import { createDefaultSurvivalModule, createDefaultBusinessModule, createDefaultDiceModule, createDefaultTalentModule } from '../modules/defaults';
import { PipelineExecutor } from './pipelineExecutor';
import { loadPipelineConfig, type PipelineStatus, type PipelineTaskId } from './pipelineTypes';
import type { ChatMessage, GameEngine } from './types';
import { getBuiltinPreset, getClaudePreset, getEnhancementModules } from '../data/builtinPresets';
import { ROLE_COGNITION_FIREWALL_TITLE, ROLE_COGNITION_FIREWALL_CONTENT } from '../utils/roleCognitionFirewall';
import { assembleSystemPrompt, injectAtDepthEntries } from './promptAssembler';
import { MacroEngine } from './macroEngine';
import { useMemoryStore } from '../memory/memoryStore';
import { formatSnapshotForMainAI } from '../utils/npcHelpers';
import type { MemoryPipelineContext } from '../memory/useMemorySystem';
import { loadPresets } from '../components/settings/apiPresetUtils';

export type { ChatMessage, GameEngine };

export function useGameEngine(
  apiConfig: ApiConfig | null,
  initialVarMgr?: VariableManager,
  selectedWorld: string = 'default',
  playerProfile?: PlayerProfile | null,
  characterHistory?: string,
  onAutoSave?: () => void,
): GameEngine {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sendMessageRef = useRef<((text: string) => Promise<void>) | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const varMgrRef = useRef(initialVarMgr || new VariableManager());
  const cancelRef = useRef<AbortController | null>(null);
  const roundRef = useRef(0);
  const worldBookRef = useRef<WorldBookManager | null>(null);
  const initializedRef = useRef(false);
  // 全局初始快照（参考项目的 initialSnapshot，用于回滚兜底）
  const initialSnapshotRef = useRef<unknown>(null);
  // 从 sessionStorage 恢复最后一轮管线状态
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(() => {
    try {
      const saved = sessionStorage.getItem('dev_pipeline_status');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const playerProfileRef = useRef(playerProfile ?? null);
  const characterHistoryRef = useRef(characterHistory ?? '');
  const onAutoSaveRef = useRef(onAutoSave);
  // 存储最后一轮管线执行器实例（用于单步重试）
  const lastExecutorRef = useRef<PipelineExecutor | null>(null);
  // 存储最后一轮管线执行上下文（用于重试管线）
  const lastPipelineCtxRef = useRef<{
    round: number;
    userText: string;
    aiMsgId: string;
    batchText: string;
    recentContext: string;
    playerName: string;
  } | null>(null);

  useEffect(() => { playerProfileRef.current = playerProfile ?? null; }, [playerProfile]);
  useEffect(() => { characterHistoryRef.current = characterHistory ?? ''; }, [characterHistory]);
  useEffect(() => { onAutoSaveRef.current = onAutoSave; }, [onAutoSave]);

  // API 限流间隔同步
  useEffect(() => {
    if (apiConfig?.rateLimitMs) {
      setRateLimitInterval(apiConfig.rateLimitMs);
    }
  }, [apiConfig?.rateLimitMs]);

  // 管线状态持久化到 sessionStorage
  useEffect(() => {
    if (pipelineStatus) {
      try { sessionStorage.setItem('dev_pipeline_status', JSON.stringify(pipelineStatus)); } catch {}
    }
  }, [pipelineStatus]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 辅助：根据 worldId 查找 WorldDef（内置 + 自建）
  const findWorldDef = useCallback((worldId: string): WorldDef | undefined => {
    const builtIn = WORLDS.find(w => w.id === worldId);
    if (builtIn) return builtIn;
    try {
      const custom: WorldDef[] = JSON.parse(localStorage.getItem('chuanye_custom_worlds') || '[]');
      return custom.find((w: WorldDef) => w.id === worldId);
    } catch { return undefined; }
  }, []);

  // 辅助：应用世界 + 模块注入
  const applyWorldAndModules = useCallback((wb: WorldBookManager, worldId: string) => {
    applyWorld(wb, worldId);
    const world = findWorldDef(worldId);
    if (world) {
      applyModules(wb, world);
    }
  }, [findWorldDef]);

  useEffect(() => {
    loadWorldBook().then(wb => {
      worldBookRef.current = wb;
      if (wb && !initializedRef.current) {
        initializedRef.current = true;
        applyWorldAndModules(wb, selectedWorld);
      }
    });
  }, []);

  useEffect(() => {
    if (worldBookRef.current && initializedRef.current) {
      applyWorldAndModules(worldBookRef.current, selectedWorld);
    }
  }, [selectedWorld]);

  const addMessage = useCallback((msg: ChatMessage) => { setMessages(prev => [...prev, msg]); }, []);
  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  // 删除消息：级联删除 + 回滚状态（用户消息连同后面的AI消息一起删）
  const deleteSingleMessage = useCallback((id: string) => {
    const currentMessages = messagesRef.current;
    const idx = currentMessages.findIndex(m => m.id === id);
    if (idx === -1) return;
    const msg = currentMessages[idx];

    // 确定要回滚到的用户消息索引
    let userIdx = idx;
    if (msg.role === 'assistant') {
      for (let i = idx - 1; i >= 0; i--) {
        if (currentMessages[i].role === 'user') { userIdx = i; break; }
      }
    }
    if (userIdx < 0 || currentMessages[userIdx]?.role !== 'user') return;

    // 回滚变量状态：从 userIdx-1 向前找最近的 snapshot，找不到则用全局初始快照
    let restored = false;
    for (let i = userIdx - 1; i >= 0; i--) {
      if (currentMessages[i].snapshot) {
        varMgrRef.current.restoreSnapshot(currentMessages[i].snapshot as any);
        restored = true;
        break;
      }
    }
    if (!restored && initialSnapshotRef.current) {
      varMgrRef.current.restoreSnapshot(initialSnapshotRef.current as any);
    }

    // 回滚记忆系统
    const memStore = useMemoryStore.getState();
    for (let i = userIdx - 1; i >= 0; i--) {
      if (currentMessages[i].memoryCheckpointId) {
        memStore.restoreCheckpoint(currentMessages[i].memoryCheckpointId!);
        break;
      }
    }
    memStore.setCompiledContext(null);
    memStore.setRuntimeFlow(null);
    memStore.setRetrievePlan(null);

    // 截断到用户消息（不含），删除用户消息及之后所有消息
    setMessages(prev => {
      const truncated = prev.slice(0, userIdx);
      messagesRef.current = truncated;
      return truncated;
    });
  }, []);

  const editMessage = useCallback((id: string, content: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, rawText: content } : m));
  }, []);

  const resendFromMessage = useCallback(async (id: string) => {
    if (!apiConfig || isGenerating) return;
    const currentMessages = messagesRef.current;
    const idx = currentMessages.findIndex(m => m.id === id);
    if (idx === -1) return;
    const msg = currentMessages[idx];
    if (!msg || msg.role !== 'user') return;

    // 回滚变量状态：从 idx-1 向前找最近的 snapshot，找不到则用全局初始快照
    let restored = false;
    for (let i = idx - 1; i >= 0; i--) {
      if (currentMessages[i].snapshot) {
        varMgrRef.current.restoreSnapshot(currentMessages[i].snapshot as any);
        restored = true;
        break;
      }
    }
    if (!restored) {
      if (initialSnapshotRef.current) {
        varMgrRef.current.restoreSnapshot(initialSnapshotRef.current as any);
      } else {
        console.log('[回滚] 没有找到任何快照！');
      }
    }

    // 回滚记忆系统：从 idx-1 向前找最近的 memoryCheckpointId
    const memStore = useMemoryStore.getState();
    for (let i = idx - 1; i >= 0; i--) {
      if (currentMessages[i].memoryCheckpointId) {
        memStore.restoreCheckpoint(currentMessages[i].memoryCheckpointId!);
        break;
      }
    }
    memStore.setCompiledContext(null);
    memStore.setRuntimeFlow(null);
    memStore.setRetrievePlan(null);

    // 截断到用户消息（不含），重新发送（参考项目的 splice + push + generateResponse）
    setMessages(prev => {
      const truncated = prev.slice(0, idx);
      messagesRef.current = truncated;
      return truncated;
    });

    setTimeout(() => {
      sendMessageRef.current?.(getMessageContent(msg));
    }, 0);
  }, [apiConfig, isGenerating]);

  // 从 AI 消息回滚并重新发送
  const resendFromAssistantMessage = useCallback(async (id: string) => {
    if (!apiConfig || isGenerating) return;
    const currentMessages = messagesRef.current;
    const aiIdx = currentMessages.findIndex(m => m.id === id);
    if (aiIdx === -1) return;
    const aiMsg = currentMessages[aiIdx];
    if (!aiMsg || aiMsg.role !== 'assistant') return;

    // 找到这条 AI 消息之前的最近一条用户消息
    let userIdx = -1;
    for (let i = aiIdx - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'user') { userIdx = i; break; }
    }
    if (userIdx === -1) return;
    const userMsg = currentMessages[userIdx];

    // 回滚变量状态：从 userIdx-1 向前找最近的 snapshot，找不到则用全局初始快照
    let restored = false;
    for (let i = userIdx - 1; i >= 0; i--) {
      if (currentMessages[i].snapshot) {
        varMgrRef.current.restoreSnapshot(currentMessages[i].snapshot as any);
        restored = true;
        break;
      }
    }
    if (!restored && initialSnapshotRef.current) {
      varMgrRef.current.restoreSnapshot(initialSnapshotRef.current as any);
    }

    // 回滚记忆系统：从 userIdx-1 向前找最近的 memoryCheckpointId
    const memStore = useMemoryStore.getState();
    for (let i = userIdx - 1; i >= 0; i--) {
      if (currentMessages[i].memoryCheckpointId) {
        memStore.restoreCheckpoint(currentMessages[i].memoryCheckpointId!);
        break;
      }
    }
    memStore.setCompiledContext(null);
    memStore.setRuntimeFlow(null);
    memStore.setRetrievePlan(null);

    // 截断到用户消息之前，重新发送
    setMessages(prev => {
      const truncated = prev.slice(0, userIdx);
      messagesRef.current = truncated;
      return truncated;
    });

    setTimeout(() => {
      sendMessageRef.current?.(getMessageContent(userMsg));
    }, 0);
  }, [apiConfig, isGenerating]);

  const loadSave = useCallback((save: GameSave) => {
    setMessages(save.messages);
    varMgrRef.current = VariableManager.fromJSON({ state: save.gameState });
    // 恢复全局初始快照：优先从第一条消息的 snapshot 获取，否则用存档的 gameState
    const firstMsg = save.messages.find(m => m.snapshot);
    if (firstMsg?.snapshot) {
      initialSnapshotRef.current = firstMsg.snapshot;
    } else {
      initialSnapshotRef.current = varMgrRef.current.createSnapshot();
    }
    roundRef.current = save.messages.length > 0
      ? save.messages.reduce((max, m) => Math.max(max, m.round), 0)
      : 0;
    if (save.worldId && worldBookRef.current) {
      applyWorldAndModules(worldBookRef.current, save.worldId);
    }
    // 先完全重置记忆系统，防止跨存档污染
    const memStore = useMemoryStore.getState();
    memStore.resetMemoryRuntime();
    memStore.setCompiledContext(null);
    memStore.setRuntimeFlow(null);
    memStore.setRetrievePlan(null);
    // 再从存档恢复记忆数据
    if (save.memoryRuntime || save.memoryConfig || save.vectorMemory) {
      memStore.fromJSON({
        memoryRuntime: save.memoryRuntime,
        config: save.memoryConfig,
        vectorMemory: save.vectorMemory,
      });
    }
    // 恢复变量提取 API 配置
    if (save.variableConfig?.apiPresetId) {
      localStorage.setItem('world_travel_guide_variable_api_preset', save.variableConfig.apiPresetId);
    }
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    if (!apiConfig || isGenerating || !userText.trim()) return;

    setIsGenerating(true);
    roundRef.current++;
    const round = roundRef.current;

    const userMsg: ChatMessage = { id: uuid(), role: 'user', rawText: userText, round, timestamp: Date.now() };
    addMessage(userMsg);
    eventBus.emit(EVENTS.MESSAGE_SENT, userMsg);

    const aiMsgId = uuid();
    const aiMsg: ChatMessage = { id: aiMsgId, role: 'assistant', rawText: '', round, timestamp: Date.now(), streaming: true };
    addMessage(aiMsg);
    eventBus.emit(EVENTS.GENERATION_STARTED, aiMsgId);

    const controller = new AbortController();
    cancelRef.current = controller;

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
    lastExecutorRef.current = executor;

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
      const playerName = playerProfileRef.current?.name || '冒险者';
      const batchText = userText + '\n\n' + '(等待AI回复)';
      const recentContext = sanitizeForContext(messagesRef.current, round)
        .slice(-6)
        .map(m => m.content || '')
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

      // 保存管线上下文（用于重试管线）
      lastPipelineCtxRef.current = { round, userText, aiMsgId, batchText, recentContext, playerName };

      const pipelineResult = await executor.execute({
        config: pipelineConfig,
        signal: controller.signal,
        varMgr: varMgrRef.current,
        worldBook: worldBookRef.current,
        userText,
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
          const state = varMgrRef.current.createSafeSnapshotForPrompt();
          const varSnapshot = formatSnapshotForMainAI(state);

          // 世界书注入（v2 扫描引擎：支持正则关键词、选择逻辑、递归扫描、分组互斥）
          let wbInjection = '';
          const atDepthEntries: Array<{ depth: number; content: string }> = [];
          if (worldBookRef.current) {
            // 构建聊天历史供扫描引擎使用
            const scanHistory = messagesRef.current.map(m => ({
              role: m.role,
              content: getMessageContent(m),
            }));
            const scanResult = worldBookRef.current.scanAndBuildInjection(scanHistory, userText);
            if (scanResult.beforeChar) wbInjection += scanResult.beforeChar + '\n\n';
            if (scanResult.afterChar) wbInjection += scanResult.afterChar + '\n\n';
            atDepthEntries.push(...scanResult.atDepthEntries);
          }

          // 玩家角色设定注入
          let playerProfileBlock = '';
          if (playerProfileRef.current?.name) {
            const perspectiveMap: Record<string, string> = {
              '第一人称': '请用第二人称"你"来称呼玩家，描写玩家的内心感受和第一视角体验。',
              '第二人称': '请用第二人称"你"来称呼玩家。',
              '第三人称': '请用第三人称称呼玩家角色。',
            };
            const perspectiveInstruction = perspectiveMap[playerProfileRef.current.perspective || '第三人称'] || perspectiveMap['第三人称'];

            let customNpcsBlock = '';
            if (playerProfileRef.current.customNpcs && playerProfileRef.current.customNpcs.length > 0) {
              const npcLines = playerProfileRef.current.customNpcs.map(npc => {
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
- 姓名：${playerProfileRef.current.name}
- 性别：${playerProfileRef.current.gender || '未设定'}
- 年龄：${playerProfileRef.current.age || '未设定'}
- 性格：${playerProfileRef.current.personality || '未设定'}
- 外貌：${playerProfileRef.current.appearance || '未设定'}
- 背景描述：${playerProfileRef.current.background || '无'}
- 职业：${playerProfileRef.current.career || '未设定'}
- 阶层：${playerProfileRef.current.socialClass || '未设定'}
- 所属组织：${playerProfileRef.current.organization || '无'}
- 特殊身份：${playerProfileRef.current.specialIdentity || '无'}
- 叙事视角：${playerProfileRef.current.perspective || '第三人称'}
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
${characterHistoryRef.current ? `- 角色经历：\n${characterHistoryRef.current}` : ''}
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
          const basePreset = pipelineConfig.claudeMode ? getClaudePreset() : getBuiltinPreset('default');
          const preset = pipelineConfig.enhancementEnabled
            ? { ...basePreset, prompts: [...basePreset.prompts, ...getEnhancementModules()] }
            : basePreset;
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

          const chatHistory = sanitizeForContext(messagesRef.current, round);
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
            onDelta: (delta, acc) => { accumulated = acc; updateMessage(aiMsgId, { rawText: acc }); },
            onReasoning: (r) => { reasoning = r; updateMessage(aiMsgId, { thinking: r }); },
          });

          let rawText = result.text || accumulated;

          // 如果响应为空（SSE尾部丢失等），重试一次
          if (!rawText.trim()) {
            let retryAccumulated = '';
            const retryResult = await requestStreamWithRetry(apiConfig, apiMessages, {
              signal: controller.signal,
              onDelta: (delta, acc) => { retryAccumulated = acc; updateMessage(aiMsgId, { rawText: acc }); },
              onReasoning: (r) => { reasoning = r; updateMessage(aiMsgId, { thinking: r }); },
            });
            rawText = retryResult.text || retryAccumulated;
            if (retryResult.reasoning) reasoning = retryResult.reasoning;
          }

          // 从 rawText 按需解析各字段
          let actionOptions = extractActionOptions(rawText);
          let summary = extractSummary(rawText);
          const thinking = extractThinking(rawText) || reasoning || result.reasoning || '';

          // 格式不完整补救：有正文但缺少行动选项，用轻量 API 调用补生成
          const contentForCheck = extractContentForPrompt(rawText);
          if (contentForCheck.trim() && actionOptions.length === 0) {
            console.warn('[引擎] 响应缺少行动选项，补生成中...');
            try {
              const optionPrompt = `根据以下叙事内容，生成3-5个行动选项。每个选项包含标题和简短描述。

叙事内容：
${contentForCheck.slice(0, 2000)}

严格按以下格式输出，不要输出其他内容：
[OPTION_START]
[OPTION]{t: "选项标题", d: "简短描述"}
[OPTION]{t: "选项标题", d: "简短描述"}
[OPTION]{t: "选项标题", d: "简短描述"}
[OPTION_END]`;

              const optionResult = await requestCompletion(apiConfig, [
                { role: 'user', content: optionPrompt },
              ], { maxTokens: 500 });

              const genOptions = extractActionOptions(optionResult.text);
              if (genOptions.length > 0) {
                actionOptions = genOptions;
                // 把补生成的选项追加到 rawText 中，保持一致性
                rawText = rawText + '\n\n[OPTION_START]\n' + genOptions.map(o => `[OPTION]{t: "${o}", d: ""}`).join('\n') + '\n[OPTION_END]';
                console.warn(`[引擎] 补生成成功，${genOptions.length} 个选项`);
              }
            } catch (err) {
              console.warn('[引擎] 补生成选项失败:', err);
            }
          }

          // StatusPlaceHolderImpl 处理
          if (rawText.includes('<StatusPlaceHolderImpl/>')) {
            rawText = rawText.replace(/<StatusPlaceHolderImpl\/>/g, '').trim();
            if (!rawText) {
              rawText = '🌍 欢迎来到世界漫游指南！\n\n请描述你的角色和想要穿越的世界，开始你的冒险之旅。\n\n你可以：\n• 直接描述你想做什么\n• 选择下方的推荐行动\n• 输入任何你想尝试的行动';
            }
          }

          // 存储完整原始响应
          updateMessage(aiMsgId, {
            rawText,
            thinking,
            actionOptions,
            summary: summary || undefined,
            streaming: false,
          });
          eventBus.emit(EVENTS.MESSAGE_RECEIVED, aiMsgId);

          return { text: rawText, parsed: { content: extractContentForPrompt(rawText), thinking, actionOptions, summary } };
        },
      });

      // 管线完成 — 保存当前变量快照到 AI 消息（用于回滚）
      try {
        const snapshot = varMgrRef.current.createSnapshot();
        // 创建记忆系统检查点（用于回滚）
        const memStoreForCheckpoint = useMemoryStore.getState();
        const memCheckpoint = memStoreForCheckpoint.createCheckpoint();
        updateMessage(aiMsgId, {
          snapshot,
          snapshotTime: Date.now(),
          memoryCheckpointId: memCheckpoint?.id,
        });
      } catch (snapErr: any) {
        // 快照失败不覆盖正文，只打日志
        console.warn('[快照] 创建失败（不影响正文）:', snapErr.message);
      }

      // 清理内存中的冗余快照，防止内存无限增长
      setMessages(prev => optimizeSnapshots(prev));

      setPipelineStatus(pipelineResult.status);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        updateMessage(aiMsgId, { rawText: '[已停止生成]', streaming: false });
      } else {
        // 不覆盖已流式输出的正文，只在文末追加错误提示
        const currentContent = getMessageContent(messagesRef.current.find(m => m.id === aiMsgId)!) || '';
        const errorSuffix = currentContent.trim()
          ? `\n\n⚠️ [管线错误] ${err.message}`
          : `[错误] ${err.message}`;
        updateMessage(aiMsgId, { rawText: errorSuffix, streaming: false });
      }
    } finally {
      setIsGenerating(false);
      cancelRef.current = null;
      eventBus.emit(EVENTS.GENERATION_ENDED, aiMsgId);
      // 直接触发自动存档（通过 ref 回调，不依赖事件总线时序）
      try { onAutoSaveRef.current?.(); } catch (e) { console.warn('[auto-save] 回调失败:', e); }
    }
  }, [apiConfig, isGenerating, addMessage, updateMessage]);

  sendMessageRef.current = sendMessage;

  const cancel = useCallback(() => { cancelRef.current?.abort(); }, []);

  // ─── 重试管线（跳过正文生成，只重跑失败的记忆/变量阶段） ───
  const retryPipeline = useCallback(async () => {
    const ctx = lastPipelineCtxRef.current;
    if (!apiConfig || isGenerating || !ctx) return;

    // 找到对应的 AI 消息，确认正文还在
    const aiMsg = messagesRef.current.find(m => m.id === ctx.aiMsgId);
    if (!aiMsg || !aiMsg.rawText || aiMsg.rawText.startsWith('[错误]')) return;

    setIsGenerating(true);
    const controller = new AbortController();
    cancelRef.current = controller;

    const pipelineConfig = loadPipelineConfig();
    const memStoreForConfig = useMemoryStore.getState();
    pipelineConfig.memoryEnabled = memStoreForConfig.config.enabled;

    // 重试时跳过 main 阶段
    pipelineConfig.executionOrder = pipelineConfig.executionOrder
      .map(step => step.filter(t => t !== 'main'))
      .filter(step => step.length > 0);

    const executor = new PipelineExecutor(ctx.round, {
      onUpdate: () => {
        const status = executor.getStatus();
        setPipelineStatus({ ...status, stages: { ...status.stages } });
        eventBus.emit(EVENTS.PIPELINE_UPDATE, status);
      },
    });
    setPipelineStatus(executor.getStatus());

    try {
      const memStore = useMemoryStore.getState();
      const memConfig = memStore.config;
      const presets = loadPresets();
      const resolvePreset = (presetId: string | null | undefined) => {
        if (!presetId) return null;
        const preset = presets.find(p => p.id === presetId);
        return preset ? { baseUrl: preset.config.baseUrl, apiKey: preset.config.apiKey, model: preset.config.model } : null;
      };
      const defaultMemApi = { baseUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey, model: apiConfig.model };
      const memApiConfig = resolvePreset(memConfig.apiPresetId) ?? defaultMemApi;

      const memCtx: MemoryPipelineContext = {
        floor: ctx.round,
        batchText: ctx.batchText,
        inputText: ctx.userText,
        recentContext: ctx.recentContext,
        playerName: ctx.playerName,
        apiConfig: memApiConfig,
        writeApiConfig: resolvePreset(memConfig.writePipeline.apiPresetId) ?? undefined,
        summaryApiConfig: resolvePreset(memConfig.writePipeline.summaryApiPresetId) ?? undefined,
        conflictJudgeApiConfig: resolvePreset(memConfig.writePipeline.conflictJudgeApiPresetId) ?? undefined,
        retrievalApiConfig: resolvePreset(memConfig.retrieval.plannerApiPresetId) ?? undefined,
        vectorApiConfig: resolvePreset(memConfig.vectorExtractApiPresetId) ?? undefined,
      };

      const pipelineResult = await executor.execute({
        config: pipelineConfig,
        signal: controller.signal,
        varMgr: varMgrRef.current,
        worldBook: worldBookRef.current,
        userText: ctx.userText,
        mainApiConfig: apiConfig,

        memoryTasks: memConfig.enabled ? {
          write: async () => { await executeMemoryWrite(memStore, memCtx); },
          summary: async () => { await executeMemorySummary(memStore, memCtx); },
          vector: memConfig.vectorEnabled ? async () => { await executeMemoryVector(memStore, memCtx); } : undefined,
          queryRewrite: async () => { await executeMemoryQueryRewrite(memStore, memCtx); },
          retrievePlan: async () => { await executeMemoryRetrievePlan(memStore, memCtx); },
          multiRound: async () => { await executeMemoryMultiRound(memStore, memCtx); },
          rerank: async () => { await executeMemoryRerank(memStore, memCtx); },
          retrieveFinalize: async () => { await executeMemoryRetrieveFinalize(memStore, memCtx); },
          compile: async () => { await executeMemoryCompile(memStore, memCtx); },
          debugLogger: (kind: string, message: string) => {
            memStore.appendWriteDebugLog({ kind: `error_${kind}`, message, timestamp: Date.now() });
          },
        } : undefined,

        // mainTask 为空（跳过）
        mainTask: async () => ({ text: aiMsg.rawText, parsed: { content: extractContentForPrompt(aiMsg.rawText), thinking: '', actionOptions: [], summary: null } }),
      });

      // 重试成功后重新保存快照
      try {
        const snapshot = varMgrRef.current.createSnapshot();
        const memStoreForCheckpoint = useMemoryStore.getState();
        const memCheckpoint = memStoreForCheckpoint.createCheckpoint();
        updateMessage(ctx.aiMsgId, {
          snapshot,
          snapshotTime: Date.now(),
          memoryCheckpointId: memCheckpoint?.id,
        });
      } catch (snapErr: any) {
        console.warn('[重试快照] 创建失败:', snapErr.message);
      }

      setMessages(prev => optimizeSnapshots(prev));
      setPipelineStatus(pipelineResult.status);
    } catch (err: any) {
      console.error('[重试管线] 失败:', err.message);
    } finally {
      setIsGenerating(false);
      cancelRef.current = null;
      try { onAutoSaveRef.current?.(); } catch (e) { console.warn('[auto-save] 回调失败:', e); }
    }
  }, [apiConfig, isGenerating]);

  // ─── 单步重试（只重跑管线中的某一个失败阶段） ───
  const retrySingleStage = useCallback(async (taskId: PipelineTaskId) => {
    const ctx = lastPipelineCtxRef.current;
    const executor = lastExecutorRef.current;
    if (!apiConfig || isGenerating || !ctx || !executor) return;

    const aiMsg = messagesRef.current.find(m => m.id === ctx.aiMsgId);
    if (!aiMsg || !aiMsg.rawText || aiMsg.rawText.startsWith('[错误]')) return;

    setIsGenerating(true);
    try {
      const memStore = useMemoryStore.getState();
      const memConfig = memStore.config;
      const presets = loadPresets();
      const resolvePreset = (presetId: string | null | undefined) => {
        if (!presetId) return null;
        const preset = presets.find(p => p.id === presetId);
        return preset ? { baseUrl: preset.config.baseUrl, apiKey: preset.config.apiKey, model: preset.config.model } : null;
      };
      const defaultMemApi = { baseUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey, model: apiConfig.model };
      const memApiConfig = resolvePreset(memConfig.apiPresetId) ?? defaultMemApi;

      const memCtx: MemoryPipelineContext = {
        floor: ctx.round,
        batchText: ctx.batchText,
        inputText: ctx.userText,
        recentContext: ctx.recentContext,
        playerName: ctx.playerName,
        apiConfig: memApiConfig,
        writeApiConfig: resolvePreset(memConfig.writePipeline.apiPresetId) ?? undefined,
        summaryApiConfig: resolvePreset(memConfig.writePipeline.summaryApiPresetId) ?? undefined,
        conflictJudgeApiConfig: resolvePreset(memConfig.writePipeline.conflictJudgeApiPresetId) ?? undefined,
        retrievalApiConfig: resolvePreset(memConfig.retrieval.plannerApiPresetId) ?? undefined,
        vectorApiConfig: resolvePreset(memConfig.vectorExtractApiPresetId) ?? undefined,
      };

      // 根据 taskId 构建对应的执行函数
      const taskFnMap: Record<string, () => Promise<void>> = {
        memory_write: () => executeMemoryWrite(memStore, memCtx),
        memory_summary: () => executeMemorySummary(memStore, memCtx),
        memory_vector: () => executeMemoryVector(memStore, memCtx),
        memory_query_rewrite: () => executeMemoryQueryRewrite(memStore, memCtx),
        memory_retrieve_plan: () => executeMemoryRetrievePlan(memStore, memCtx),
        memory_multi_round: () => executeMemoryMultiRound(memStore, memCtx),
        memory_rerank: () => executeMemoryRerank(memStore, memCtx),
        memory_retrieve_finalize: () => executeMemoryRetrieveFinalize(memStore, memCtx),
        memory_compile: () => executeMemoryCompile(memStore, memCtx),
      };

      const taskFn = taskFnMap[taskId];
      if (!taskFn) {
        console.warn(`[单步重试] 不支持重试阶段: ${taskId}`);
        return;
      }

      await executor.retryStage(taskId, taskFn);

      // 重试成功后更新快照
      try {
        const snapshot = varMgrRef.current.createSnapshot();
        const memStoreForCheckpoint = useMemoryStore.getState();
        const memCheckpoint = memStoreForCheckpoint.createCheckpoint();
        updateMessage(ctx.aiMsgId, {
          snapshot,
          snapshotTime: Date.now(),
          memoryCheckpointId: memCheckpoint?.id,
        });
      } catch (snapErr: any) {
        console.warn('[单步重试快照] 创建失败:', snapErr.message);
      }

      setPipelineStatus({ ...executor.getStatus(), stages: { ...executor.getStatus().stages } });
    } catch (err: any) {
      console.error('[单步重试] 失败:', err.message);
    } finally {
      setIsGenerating(false);
      try { onAutoSaveRef.current?.(); } catch (e) { console.warn('[auto-save] 回调失败:', e); }
    }
  }, [apiConfig, isGenerating]);

  const reset = useCallback((worldDef?: WorldDef) => {
    cancelRef.current?.abort();
    setIsGenerating(false);
    setMessages([]);
    varMgrRef.current = new VariableManager();
    varMgrRef.current.initializeWorldAndNotebook();
    roundRef.current = 0;
    // 重置记忆系统，防止跨存档污染
    const memStore = useMemoryStore.getState();
    memStore.resetMemoryRuntime();
    memStore.setCompiledContext(null);
    memStore.setRuntimeFlow(null);
    memStore.setRetrievePlan(null);
    // 初始化世界系统模块数据
    // 新格式：moduleConfig（配置，注入世界书）+ initialState（状态，初始化变量）
    // 旧格式：data（配置+状态混在一起，向后兼容）
    if (worldDef?.modules?.length) {
      const state = varMgrRef.current.getState();
      const worldSystem: Record<string, unknown> = {};
      const moduleNames: Record<string, string> = {};

      for (const mod of worldDef.modules) {
        if (!mod.enabled) continue;

        // 模块ID到中文名的映射
        const mapKey: Record<string, string> = {
          stat: '数值属性', survival: '生存资源', business: '经营资产', dice: '骰子检定', talent: '天赋体系',
        };
        const key = mapKey[mod.moduleId];
        if (!key) continue;

        // 记录模块名称
        if (mod.name) moduleNames[key] = mod.name;

        // 新格式：从 initialState 初始化变量
        if (mod.initialState && Object.keys(mod.initialState).length > 0) {
          // 数值属性：从 initialState 设置玩家属性
          if (mod.moduleId === 'stat') {
            const initState = mod.initialState as any;
            if (initState.attrA != null) state.玩家.生存状态.血量 = initState.attrA;
            if (initState.attrB != null) state.玩家.生存状态.体力值 = initState.attrB;
            // 六维和特色属性存入玩家属性字段
            if (!state.玩家.属性) (state.玩家 as any).属性 = {};
            const attrs = (state.玩家 as any).属性;
            if (initState.dim1 != null) attrs.dim1 = initState.dim1;
            if (initState.dim2 != null) attrs.dim2 = initState.dim2;
            if (initState.dim3 != null) attrs.dim3 = initState.dim3;
            if (initState.dim4 != null) attrs.dim4 = initState.dim4;
            if (initState.dim5 != null) attrs.dim5 = initState.dim5;
            if (initState.dim6 != null) attrs.dim6 = initState.dim6;
            if (initState.special) {
              for (const [id, value] of Object.entries(initState.special)) {
                attrs[id] = value;
              }
            }
          }

          // 成长体系：从 initialState 设置玩家状态
          if (mod.moduleId === 'progression') {
            const initState = mod.initialState as any;
            state.玩家.当前段位索引 = initState.currentTierIndex ?? 0;
            state.玩家.当前经验值 = initState.currentXP ?? 0;
          }
        }

        // 旧格式兼容：从 data 初始化（配置+状态混在一起）
        if (mod.data && Object.keys(mod.data).length > 0) {
          // 对于数值属性，需要从 data 中提取状态，同时把 data 存入世界系统（用于 UI 展示）
          if (mod.moduleId === 'stat') {
            const statData = mod.data as any;
            // 设置玩家生存状态
            if (statData.attrA?.current != null) state.玩家.生存状态.血量 = statData.attrA.current;
            if (statData.attrB?.current != null) state.玩家.生存状态.体力值 = statData.attrB.current;
            // 数值属性的 data 也需要存入世界系统（用于 UI 展示）
            worldSystem[key] = mod.data;
          }

          // 对于成长体系，从 data 中提取状态
          if (mod.moduleId === 'progression') {
            const progData = mod.data as any;
            state.玩家.当前段位索引 = progData.currentTierIndex ?? 0;
            state.玩家.当前经验值 = progData.currentXP ?? 0;
          }

          // 其他模块（生存资源、经营资产、骰子、天赋）的 data 存入世界系统
          if (['survival', 'business', 'dice', 'talent'].includes(mod.moduleId)) {
            worldSystem[key] = mod.data;
          }
        }

        // 如果没有 data 也没有 initialState，使用默认值
        if (!mod.data && !mod.initialState) {
          const defaults: Record<string, () => unknown> = {
            survival: createDefaultSurvivalModule,
            business: createDefaultBusinessModule,
            dice: createDefaultDiceModule,
            talent: createDefaultTalentModule,
          };
          if (defaults[mod.moduleId]) {
            worldSystem[key] = defaults[mod.moduleId]!();
          }
        }
      }

      // 存储模块自定义名称
      if (Object.keys(moduleNames).length > 0) {
        (worldSystem as any)._moduleNames = moduleNames;
      }

      // 存储世界系统数据（只包含资源、骰子、天赋等模块）
      if (Object.keys(worldSystem).length > 0) {
        state.世界.世界系统 = worldSystem;
      }

      varMgrRef.current.setState(state);

      // ★ 重新注入世界书条目（因为变量系统已更新）
      // 使用 worldDef.id 而不是闭包中的 selectedWorld，避免时序问题
      if (worldBookRef.current && worldDef?.id) {
        applyWorldAndModules(worldBookRef.current, worldDef.id);
      }
    }
  }, [selectedWorld]);

  const setPlayerProfile = useCallback((profile: PlayerProfile) => {
    const state = varMgrRef.current.getState();
    // 基础信息
    state.玩家.姓名 = profile.name;
    state.玩家.性别 = profile.gender;
    state.玩家.年龄 = profile.age;
    state.玩家.身份信息.背景信息 = profile.background;
    state.玩家.性格 = profile.personality || '';
    state.玩家.外貌 = profile.appearance || '';
    // 身份信息
    state.玩家.身份信息.职业 = profile.career || '';
    state.玩家.身份信息.阶层 = profile.socialClass || '';
    state.玩家.身份信息.所属组织 = profile.organization || '';
    state.玩家.身份信息.特殊身份 = profile.specialIdentity || '';
    // 初始技能
    if (profile.initialSkills && Object.keys(profile.initialSkills).length > 0) {
      state.玩家.技能系统 = { ...state.玩家.技能系统, ...profile.initialSkills };
    }
    // 初始物品（补全 InventoryItem 缺失字段）
    if (profile.initialItems && Object.keys(profile.initialItems).length > 0) {
      const filled: typeof state.玩家.物品栏 = {};
      for (const [k, v] of Object.entries(profile.initialItems)) {
        filled[k] = { ...v, 有效期: '', 特殊属性: '' };
      }
      state.玩家.物品栏 = { ...state.玩家.物品栏, ...filled };
    }
    varMgrRef.current.setState(state);
    varMgrRef.current.initializeWorldAndNotebook();
  }, [selectedWorld]);

  // 应用 AI 生成的模块初始化数据（覆盖世界定义的默认值）
  const applyModuleInitData = useCallback((moduleInitData: Record<string, unknown>) => {
    if (!moduleInitData || Object.keys(moduleInitData).length === 0) return;

    const state = varMgrRef.current.getState();
    const worldSystem = (state.世界.世界系统 as Record<string, unknown>) || {};

    // 处理数值属性模块
    const statData = moduleInitData['数值属性'] as Record<string, unknown> | undefined;
    if (statData) {
      // 更新玩家生存状态
      if (statData.attrA && typeof statData.attrA === 'object') {
        const attrA = statData.attrA as { current?: number };
        if (attrA.current != null) state.玩家.生存状态.血量 = attrA.current;
      }
      if (statData.attrB && typeof statData.attrB === 'object') {
        const attrB = statData.attrB as { current?: number };
        if (attrB.current != null) state.玩家.生存状态.体力值 = attrB.current;
      }

      // 更新世界系统中的数值属性数据
      const existingStat = worldSystem['数值属性'] as Record<string, unknown> | undefined;
      if (existingStat) {
        // 更新 attrA 和 attrB 的 current 值
        if (statData.attrA && typeof statData.attrA === 'object') {
          const attrA = statData.attrA as { current?: number };
          if (attrA.current != null && existingStat.attrA && typeof existingStat.attrA === 'object') {
            (existingStat.attrA as Record<string, unknown>).current = attrA.current;
          }
        }
        if (statData.attrB && typeof statData.attrB === 'object') {
          const attrB = statData.attrB as { current?: number };
          if (attrB.current != null && existingStat.attrB && typeof existingStat.attrB === 'object') {
            (existingStat.attrB as Record<string, unknown>).current = attrB.current;
          }
        }

        // 更新 dim1~dim6 的 value 值
        for (let i = 1; i <= 6; i++) {
          const dimKey = `dim${i}`;
          if (statData[dimKey] && typeof statData[dimKey] === 'object') {
            const dimData = statData[dimKey] as { value?: number };
            if (dimData.value != null && existingStat[dimKey] && typeof existingStat[dimKey] === 'object') {
              (existingStat[dimKey] as Record<string, unknown>).value = dimData.value;
            }
          }
        }

        // 更新 special 属性
        if (statData.special && Array.isArray(statData.special)) {
          const aiSpecial = statData.special as Array<{ id: string; value: number }>;
          const existingSpecial = existingStat.special as Array<{ id: string; value: number }> | undefined;
          if (existingSpecial && Array.isArray(existingSpecial)) {
            for (const aiItem of aiSpecial) {
              const existingItem = existingSpecial.find(s => s.id === aiItem.id);
              if (existingItem) {
                existingItem.value = aiItem.value;
              }
            }
          }
        }
      }
    }

    // 处理其他模块（如果需要）
    // 可以在这里添加对其他模块的处理逻辑

    varMgrRef.current.setState(state);
  }, [selectedWorld]);

  const setInitialNPCs = useCallback((npcs: CustomNpc[]) => {
    const state = varMgrRef.current.getState();
    for (const npc of npcs) {
      const npcId = `NPC_${npc.name}`;
      state.人物档案[npcId] = {
        姓名: npc.name,
        种族: npc.race || '人类',
        性别: npc.gender || '',
        年龄: npc.age || '',
        背景: npc.background || '',
        生存状态: { 血量: 100, 体力值: 100 },
        社会身份: {
          职业: npc.occupation || '',
          社会地位: npc.socialStatus || '',
        },
        关系数据: {
          好感度: 50,
          关系类型: npc.relationshipType || '同伴',
        },
        个人信息: {
          外貌: npc.appearance || '',
          表性格: npc.personality || '',
          里性格: npc.hiddenPersonality || '',
          当前想法: npc.currentThought || '',
          当前穿着: npc.currentOutfit || '',
          当前位置: npc.currentLocation || '',
          当前状态: npc.currentState || '',
          备注: '',
        },
        重要NPC: true,
        _关注: true,
        $time: Date.now(),
        人物分类: '在场',
        当前行动: npc.currentAction || '',
        短期目标: npc.shortTermGoal || '',
        长期目标: npc.longTermGoal || '',
        人物事迹: npc.chronicles || [],
        技能列表: npc.skillsList || {},
        物品列表: npc.itemsList || {},
      };
    }
    varMgrRef.current.setState(state);
    // 更新全局初始快照（此时包含玩家数据和NPC，NPC事迹为空）
    initialSnapshotRef.current = varMgrRef.current.createSnapshot();
  }, []);

  // 使用 getter 确保 variableManager 总是返回最新的 ref 值
  // （reset 会创建新的 VariableManager 实例，旧的 engine 对象仍需能访问到新实例）
  return {
    sendMessage, cancel, isGenerating, messages,
    get variableManager() { return varMgrRef.current; },
    get worldBook() { return worldBookRef.current; },
    pipelineStatus,
    deleteSingleMessage, editMessage, resendFromMessage, resendFromAssistantMessage,
    loadSave, reset, setPlayerProfile, applyModuleInitData, setInitialNPCs, addMessage,
    retryPipeline, retrySingleStage,
  };
}

// ═══════════════════════════════════════════
// 记忆系统管线执行函数
// ═══════════════════════════════════════════

type MemoryStore = ReturnType<typeof useMemoryStore.getState>;
import { requestCompletion } from '../api/client';
import {
  parseNarrativePayload,
  parseNarrativeSummaryResult,
  parseNarrativeRetrievePlannerResult,
  parseNarrativeConflictJudgeResult,
  parseVectorQueryRewriteResult,
  parseRerankResult,
} from '../memory/narrativeParsers';
import { normalizeVectorFact } from '../memory/vectorUtils';
import type { SummaryMemoryItem, VectorMemoryItem, NarrativeMemoryRuntime } from '../memory/types';

/** 带超时的 Promise 包装 */
function withTimeout<T>(promise: Promise<T>, ms: number, label = '操作'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}超时(${ms / 1000}s)`)), ms)
    ),
  ]);
}

import { waitForRateLimit } from '../api/rateLimiter';

async function callMemoryAI(
  apiConfig: { baseUrl: string; apiKey: string; model: string },
  systemPrompt: string,
  userContent: string,
  temperature = 0.3,
  timeoutMs = 120000,
): Promise<string> {
  // 限流保护
  await waitForRateLimit();

  try {
    // 非流式调用，加大超时到 120 秒
    const result = await withTimeout(
      requestCompletion(
        { ...apiConfig, provider: 'openai' },
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
        { temperature },
      ),
      timeoutMs,
      '记忆AI调用',
    );
    return result.text;
  } catch (err) {
    console.error('[记忆AI] 调用失败:', err);
    throw err;
  }
}

// ─── 阶段1: 记忆写入（带重试）───

async function executeMemoryWrite(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  const runtime = memStore.getMemoryRuntime();
  const templates = memStore.config.narrativePromptTemplates;
  const retryCount = memStore.config.writePipeline.retryCount ?? 2;
  const retryDelayMs = memStore.config.writePipeline.retryDelayMs ?? 1200;
  const maxAttempts = retryCount + 1;

  memStore.setLoading(true, '正在写入叙事记忆...');

  let lastError: Error | null = null;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const referenceBlock = buildIngestReferenceBlock(runtime, ctx.playerName);
        const prompt = templates.ingest
          .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
          .replace(/\{\{叙事写入参考\}\}/g, referenceBlock)
          .replace(/\{\{剧情原文\}\}/g, ctx.batchText);

        const rawResult = await callMemoryAI(ctx.writeApiConfig ?? ctx.apiConfig, prompt, '请分析上述剧情并输出结构化叙事记忆 JSON。');
        const parsed = parseNarrativePayload(rawResult);

        // 冲突裁决
        if (memStore.config.writePipeline.conflictJudgeEnabled) {
          const eventCandidates = parsed.eventCandidates as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(eventCandidates)) {
            for (const newCard of eventCandidates) {
              const existing = runtime.eventCards.find((c: { title?: string; id?: string }) => c.title === newCard.title || c.id === newCard.id);
              if (existing) {
                try {
                  const judgePrompt = templates.conflictJudge
                    .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
                    .replace(/\{\{currentObject\}\}/g, JSON.stringify(existing))
                    .replace(/\{\{incomingObject\}\}/g, JSON.stringify(newCard));
                  const judgeRaw = await callMemoryAI(ctx.conflictJudgeApiConfig ?? ctx.apiConfig, judgePrompt, '请裁决冲突，输出 JSON。');
                  const judgeResult = parseNarrativeConflictJudgeResult(judgeRaw);
                  if (judgeResult.action === 'reject_incoming') continue;
                  if (judgeResult.action === 'mark_expired') { (existing as unknown as Record<string, unknown>).status = 'cold'; continue; }
                } catch { /* 裁决失败按默认处理 */ }
              }
            }
          }
        }

        applyIngestToRuntime(runtime, parsed);
        memStore.bumpRuntimeVersion();
        memStore.appendWriteDebugLog({ kind: 'ingest', message: '写入完成', sourceStartIndex: ctx.floor, sourceEndIndex: ctx.floor });
        return; // 成功，退出
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[记忆写入] 第 ${attempt}/${maxAttempts} 次尝试失败:`, lastError.message);

        if (attempt < maxAttempts) {
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }

    // 所有重试都失败
    const errorMessage = lastError?.message || '写入失败';
    memStore.appendWriteDebugLog({ kind: 'ingest', message: `写入失败: ${errorMessage}`, mode: 'error', sourceStartIndex: ctx.floor, sourceEndIndex: ctx.floor });
    console.error('[记忆写入] 所有重试都失败:', errorMessage);
  } finally {
    memStore.setLoading(false);
  }
}

// ─── 阶段2: 摘要保存（带重试）───

async function executeMemorySummary(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  if (!memStore.config.writePipeline.saveSummaryAfterIngest) return;
  const templates = memStore.config.narrativePromptTemplates;
  const retryCount = memStore.config.writePipeline.retryCount ?? 2;
  const retryDelayMs = memStore.config.writePipeline.retryDelayMs ?? 1200;
  const maxAttempts = retryCount + 1;

  memStore.setLoading(true, '正在保存剧情摘要...');

  try {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const prompt = templates.summary
          .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
          .replace(/\{\{batchText\}\}/g, ctx.batchText);

        const rawResult = await callMemoryAI(ctx.summaryApiConfig ?? ctx.apiConfig, prompt, '请为当前剧情批次产出结构化摘要 JSON。');
        const parsed = parseNarrativeSummaryResult(rawResult);
        const savedAt = Date.now();

        memStore.appendSummarySaveRecord({
          savedAt, status: 'success', sourceStartIndex: ctx.floor, sourceEndIndex: ctx.floor,
          applyResult: { otherCharacterCount: parsed.otherCharacterMemories.length, playerCount: parsed.playerMemories.length, itemCount: parsed.itemMemories.length },
          summaryData: { otherCharacterMemories: parsed.otherCharacterMemories, playerMemories: parsed.playerMemories, itemMemories: parsed.itemMemories },
        });
        memStore.bumpRuntimeVersion();
        return; // 成功，退出
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[摘要保存] 第 ${attempt}/${maxAttempts} 次尝试失败:`, lastError.message);

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }

    // 所有重试都失败
    const errorMessage = lastError?.message || '摘要保存失败';
    memStore.appendWriteDebugLog({ kind: 'summary', message: `摘要保存失败: ${errorMessage}`, mode: 'error' });
    console.error('[摘要保存] 所有重试都失败:', errorMessage);
  } finally {
    memStore.setLoading(false);
  }
}

// ─── 阶段3: 向量提取 ───

async function executeMemoryVector(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  if (!memStore.config.vectorEnabled) return;
  const templates = memStore.config.narrativePromptTemplates;
  memStore.setLoading(true, '正在提取向量事实...');

  try {
    const prompt = templates.vectorExtract
      .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
      .replace(/\{\{剧情原文\}\}/g, ctx.batchText);

    const rawResult = await callMemoryAI(ctx.vectorApiConfig ?? ctx.apiConfig, prompt, '请提取长期事实，输出 JSON 数组。');
    const parsed = parseNarrativePayload(rawResult);
    const factsArray = Array.isArray(parsed) ? parsed : Array.isArray(parsed.facts) ? parsed.facts : Array.isArray(parsed.data) ? parsed.data : [];

    const vectorItems: VectorMemoryItem[] = factsArray
      .map((item: unknown, index: number) => {
        const fact = normalizeVectorFact(item);
        if (!fact) return null;
        return { ...fact, id: `vec_${ctx.floor}_${index}`, searchText: [fact.fact, ...fact.keywords, ...fact.entities].join(' ') } as VectorMemoryItem;
      })
      .filter((item): item is VectorMemoryItem => item != null);

    memStore.appendVectorMemories(vectorItems);
    memStore.bumpRuntimeVersion();
  } finally {
    memStore.setLoading(false);
  }
}

// ─── 阶段4: 查询改写 ───

async function executeMemoryQueryRewrite(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  const rConfig = memStore.config.retrieval;
  if (!rConfig.useQueryRewrite) return;

  const templates = memStore.config.narrativePromptTemplates;
  memStore.setLoading(true, '正在查询改写...');

  try {
    const qrPrompt = templates.queryRewrite
      .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
      .replace(/\{\{inputText\}\}/g, ctx.inputText)
      .replace(/\{\{recentContext\}\}/g, ctx.recentContext.slice(-800))
      .replace(/\{\{entityTerms\}\}/g, '').replace(/\{\{timeTerms\}\}/g, '');
    const qrRaw = await callMemoryAI(ctx.retrievalApiConfig ?? ctx.apiConfig, qrPrompt, '请分析当前输入并输出查询改写 JSON。');
    const qrResult = parseVectorQueryRewriteResult(qrRaw);
    ctx._retrievalKeywords = qrResult.retrievalKeywords;
    ctx._semanticQuery = qrResult.semanticQuery || ctx.inputText;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '查询改写失败';
    console.warn('[查询改写] 失败:', message);
    ctx._retrievalKeywords = [];
    ctx._semanticQuery = ctx.inputText;
  } finally {
    memStore.setLoading(false);
  }
}

// ─── 阶段5: 检索规划 ───

async function executeMemoryRetrievePlan(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  const runtime = memStore.getMemoryRuntime();
  const allMemories = collectAllMemoriesFromRuntime(runtime);
  if (allMemories.length === 0) {
    return;
  }

  const templates = memStore.config.narrativePromptTemplates;
  const rConfig = memStore.config.retrieval;
  memStore.setLoading(true, '正在检索规划...');

  try {
    const semanticQuery = ctx._semanticQuery || ctx.inputText;
    const candidateList = allMemories.slice(0, rConfig.plannerCandidateLimit)
      .map((m, i) => `[${i}] ${m.title}（关键词：${m.keywords.join('、')}）`).join('\n');

    const plannerPrompt = templates.retrievePlanner
      .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
      .replace(/\{\{inputText\}\}/g, ctx.inputText)
      .replace(/\{\{recentContext\}\}/g, ctx.recentContext.slice(-600))
      .replace(/\{\{compiledNarrativeContext\}\}/g, '无')
      .replace(/\{\{compiledNarrativeSections\}\}/g, '无')
      .replace(/\{\{semanticAnalysis\}\}/g, semanticQuery)
      .replace(/\{\{summaryHistory\}\}/g, `共 ${runtime.summarySaveHistory.length} 条摘要`)
      .replace(/\{\{memoryCandidates\}\}/g, candidateList || '无候选');

    const plannerRaw = await callMemoryAI(ctx.retrievalApiConfig ?? ctx.apiConfig, plannerPrompt, '请规划需要注入的记忆，输出 JSON。');
    const plannerResult = parseNarrativeRetrievePlannerResult(plannerRaw);
    ctx._plannerResult = plannerResult;
    ctx._finalSelectedTitles = [...plannerResult.items.map(i => i.title)];
    ctx._candidateList = candidateList;
    ctx._allMemories = allMemories;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '检索规划失败';
    console.warn('[检索规划] 失败:', message);
    ctx._plannerResult = undefined;
    ctx._finalSelectedTitles = [];
  } finally {
    memStore.setLoading(false);
  }
}

// ─── 阶段6: 多轮补充 ───

async function executeMemoryMultiRound(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  const rConfig = memStore.config.retrieval;
  if (!rConfig.multiRoundEnabled || !ctx._plannerResult) return;

  const runtime = memStore.getMemoryRuntime();
  const templates = memStore.config.narrativePromptTemplates;
  memStore.setLoading(true, '正在多轮补充...');

  try {
    const semanticQuery = ctx._semanticQuery || ctx.inputText;
    const candidateList = ctx._candidateList || '';
    const maxRounds = rConfig.multiRoundMaxRounds;
    let previousResults = ctx._plannerResult.items.map(item => `${item.title}: ${item.reason || ''}`).join('\n');

    for (let round = 2; round <= maxRounds; round++) {
      try {
        const isLast = round === maxRounds;
        const multiPrompt = isLast ? templates.multiRoundRetrievePlannerFinal : templates.multiRoundRetrievePlanner;

        const multiFilled = multiPrompt
          .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
          .replace(/\{\{currentRound\}\}/g, String(round))
          .replace(/\{\{maxRounds\}\}/g, String(maxRounds))
          .replace(/\{\{inputText\}\}/g, ctx.inputText)
          .replace(/\{\{recentContext\}\}/g, ctx.recentContext.slice(-600))
          .replace(/\{\{compiledNarrativeContext\}\}/g, '无')
          .replace(/\{\{compiledNarrativeSections\}\}/g, '无')
          .replace(/\{\{semanticAnalysis\}\}/g, semanticQuery)
          .replace(/\{\{summaryHistory\}\}/g, `共 ${runtime.summarySaveHistory.length} 条摘要`)
          .replace(/\{\{memoryCandidates\}\}/g, candidateList || '无候选')
          .replace(/\{\{previousResults\}\}/g, previousResults);

        const multiRaw = await callMemoryAI(ctx.retrievalApiConfig ?? ctx.apiConfig, multiFilled, '请补充遗漏的记忆，输出 JSON。');
        const multiResult = parseNarrativeRetrievePlannerResult(multiRaw);

        const multiTitles = multiResult.items.map(i => i.title);
        if (multiTitles.length === 0) break;

        if (!ctx._finalSelectedTitles) ctx._finalSelectedTitles = [];
        ctx._finalSelectedTitles.push(...multiTitles);
        previousResults += '\n' + multiResult.items.map(item => `${item.title}: ${item.reason || ''}`).join('\n');
      } catch {
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '多轮补充失败';
    console.warn('[多轮补充] 失败:', message);
  } finally {
    memStore.setLoading(false);
  }
}

// ─── 阶段7: 精排 ───

async function executeMemoryRerank(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  const rConfig = memStore.config.retrieval;
  if (!rConfig.useRerank) {
    return;
  }

  const allMemories = ctx._allMemories || collectAllMemoriesFromRuntime(memStore.getMemoryRuntime());
  const finalSelectedTitles = ctx._finalSelectedTitles || [];
  if (allMemories.length === 0 || finalSelectedTitles.length === 0) {
    return;
  }

  const templates = memStore.config.narrativePromptTemplates;
  memStore.setLoading(true, '正在精排...');

  try {
    // 先做本地匹配
    const titleSelected = allMemories.filter(m =>
      finalSelectedTitles.some(t => t === m.title || m.title.includes(t) || t.includes(m.title))
    );

    const rerankPrompt = templates.rerank
      .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
      .replace(/\{\{query\}\}/g, ctx.inputText)
      .replace(/\{\{candidates\}\}/g, titleSelected.map((m, i) => `[${i}] ${m.title}: ${m.summary}`).join('\n'));

    const rerankRaw = await callMemoryAI(ctx.retrievalApiConfig ?? ctx.apiConfig, rerankPrompt, '请对候选记忆精排打分，输出 JSON。');
    const rerankResult = parseRerankResult(rerankRaw);
    ctx._rerankResult = rerankResult;

    // 按精排分数重新排序
    const scoreMap = new Map(rerankResult.rankings.map(r => [r.index, r.score]));
    const sortedEntries = [...titleSelected]
      .map((entry, index) => ({ entry, score: scoreMap.get(index) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .map(({ entry }) => entry);

    ctx._selectedEntries = sortedEntries;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '精排失败';
    console.warn('[精排] 失败:', message);
    // 精排失败，使用原始排序
    const titleSelected = allMemories.filter(m =>
      finalSelectedTitles.some(t => t === m.title || m.title.includes(t) || t.includes(m.title))
    );
    ctx._selectedEntries = titleSelected;
  } finally {
    memStore.setLoading(false);
  }
}

// ─── 阶段8: 检索收尾 ───

async function executeMemoryRetrieveFinalize(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  const runtime = memStore.getMemoryRuntime();
  const allMemories = collectAllMemoriesFromRuntime(runtime);
  const rConfig = memStore.config.retrieval;
  memStore.setLoading(true, '正在检索收尾...');

  try {
    const finalSelectedTitles = ctx._finalSelectedTitles || [];
    const retrievalKeywords = ctx._retrievalKeywords || [];
    const plannerKeywords = ctx._plannerResult?.retrievalKeywords || [];
    const allKeywords = [...new Set([...retrievalKeywords, ...plannerKeywords])];

    // 标题匹配
    const titleSelected = allMemories.filter(m =>
      finalSelectedTitles.some(t => t === m.title || m.title.includes(t) || t.includes(m.title))
    );

    // 关键词命中率补充
    const threshold = rConfig.keywordRecallThreshold / 100;
    const keywordSelected = allMemories.filter(m => {
      if (titleSelected.some(t => t.id === m.id)) return false;
      const mk = m.keywords.map(k => k.toLowerCase());
      const rk = allKeywords.map(k => k.toLowerCase());
      const matched = mk.filter(k => rk.some(r => r.includes(k) || k.includes(r)));
      return mk.length > 0 && (matched.length / mk.length) >= threshold;
    });

    // 去重 + 排序
    const seen = new Set<string>();
    const deduped = [...titleSelected, ...keywordSelected].filter(e => {
      const key = e.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) => a.sourceFloor - b.sourceFloor);

    ctx._selectedEntries = deduped;
    memStore.setRetrievePlan({
      plannedAt: Date.now(),
      candidates: allMemories.map(m => ({ title: m.title })),
      selectedTitles: deduped.map(m => m.title),
      selectedModes: deduped.map(() => 'keyword_hit'),
      strategy: `AI规划 ${ctx._plannerResult?.items.length ?? 0} 条 + 关键词补充 ${keywordSelected.length} 条 → ${deduped.length} 条`,
    });
  } finally {
    memStore.setLoading(false);
  }
}

// ─── 阶段5: 上下文编译 ───

async function executeMemoryCompile(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  const entries = ctx._selectedEntries ?? [];

  const runtime = memStore.getMemoryRuntime();
  const parts: string[] = [];

  if (runtime.sceneAnchor) {
    const sa = runtime.sceneAnchor;
    const lines = [
      sa.locationLabel ? `地点：${sa.locationLabel}` : '',
      sa.timeLabel ? `时间：${sa.timeLabel}` : '',
      sa.immediateGoal ? `当前目标：${sa.immediateGoal}` : '',
      sa.immediateRisk ? `当前风险：${sa.immediateRisk}` : '',
    ].filter(Boolean);
    if (lines.length > 0) parts.push(`【当前场景】\n${lines.join('\n')}`);
  }

  const player = entries.filter(e => e.type === 'player');
  const chars = entries.filter(e => e.type === 'otherCharacter');
  const items = entries.filter(e => e.type === 'item');
  if (player.length > 0) parts.push(`【本层摘要】\n${player.map(e => `- ${e.title}：${e.summary}`).join('\n')}`);
  if (chars.length > 0) parts.push(`【角色记忆】\n${chars.map(e => `- ${e.title}：${e.summary}`).join('\n')}`);
  if (items.length > 0) parts.push(`【物品记忆】\n${items.map(e => `- ${e.title}：${e.summary}`).join('\n')}`);

  const compiled = parts.join('\n\n');
  ctx._compiledContext = compiled;
  memStore.setCompiledContext({ compiledAt: Date.now(), fullText: compiled, sections: { scene: parts[0] || '', retrieval: `检索到 ${entries.length} 条记忆` }, sceneAnchor: runtime.sceneAnchor });
}

// ─── 内部工具函数 ───

function buildIngestReferenceBlock(runtime: NarrativeMemoryRuntime, playerName: string): string {
  const parts: string[] = [];
  if (runtime.sceneAnchor) {
    const sa = runtime.sceneAnchor;
    parts.push(`场景：${sa.locationLabel || '未知'} | ${sa.timeLabel || '未知'} | 目标：${sa.immediateGoal || '无'} | 风险：${sa.immediateRisk || '无'}`);
  }
  const threads = runtime.activeThreads.filter(t => t.status === 'open' || t.status === 'blocked');
  if (threads.length > 0) parts.push(`活跃线程：${threads.map(t => `${t.title}(${t.status})`).join('、')}`);
  const slots = runtime.stateSlots.filter(s => s.status === 'active');
  if (slots.length > 0) parts.push(`状态槽：${slots.map(s => `${s.slotType}(${s.scopeId})`).join('、')}`);
  if (runtime.relationNetwork.length > 0) parts.push(`关系网：${runtime.relationNetwork.slice(0, 5).map(r => `${r.sourceEntityId}→${r.targetEntityId}(${r.relationType})`).join('、')}`);
  return parts.length > 0 ? parts.join('\n') : '暂无已知参考锚点';
}

function applyIngestToRuntime(runtime: NarrativeMemoryRuntime, parsed: Record<string, unknown>): void {
  const scenePatch = parsed.scenePatch as Record<string, string> | undefined;
  if (scenePatch && typeof scenePatch === 'object') {
    const existing = runtime.sceneAnchor;
    runtime.sceneAnchor = {
      timeLabel: scenePatch.timeLabel ?? existing?.timeLabel ?? '',
      locationLabel: scenePatch.locationLabel ?? existing?.locationLabel ?? '',
      presentEntities: (Array.isArray(scenePatch.presentEntities) ? scenePatch.presentEntities : existing?.presentEntities) ?? [],
      immediateGoal: scenePatch.immediateGoal ?? existing?.immediateGoal ?? '',
      immediateRisk: scenePatch.immediateRisk ?? existing?.immediateRisk ?? '',
      conversationFocus: scenePatch.conversationFocus ?? existing?.conversationFocus ?? '',
      recentChange: scenePatch.recentChange ?? existing?.recentChange ?? '',
      confidence: Number(scenePatch.confidence) || existing?.confidence || 0.5,
      updatedAt: Date.now(),
    };
  }

  const threadUpserts = parsed.threadUpserts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(threadUpserts)) {
    for (const thread of threadUpserts) {
      const idx = runtime.activeThreads.findIndex(t => t.id === thread.id);
      if (idx >= 0) runtime.activeThreads[idx] = { ...runtime.activeThreads[idx], ...thread, updatedAt: Date.now() } as typeof runtime.activeThreads[number];
      else runtime.activeThreads.push({ ...thread, createdAt: Date.now(), updatedAt: Date.now() } as typeof runtime.activeThreads[number]);
    }
  }

  const eventCandidates = parsed.eventCandidates as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(eventCandidates)) {
    for (const card of eventCandidates) {
      const idx = runtime.eventCards.findIndex(c => c.id === card.id);
      if (idx >= 0) runtime.eventCards[idx] = { ...runtime.eventCards[idx], ...card, updatedAt: Date.now() } as typeof runtime.eventCards[number];
      else runtime.eventCards.push({ ...card, createdAt: Date.now(), updatedAt: Date.now() } as typeof runtime.eventCards[number]);
    }
  }

  const entityPatches = parsed.entityPatches as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(entityPatches)) {
    for (const patch of entityPatches) {
      const idx = runtime.entityCards.findIndex(c => c.id === patch.id || c.name === patch.name);
      if (idx >= 0) runtime.entityCards[idx] = { ...runtime.entityCards[idx], ...patch, updatedAt: Date.now() } as typeof runtime.entityCards[number];
      else runtime.entityCards.push({ ...patch, createdAt: Date.now(), updatedAt: Date.now() } as typeof runtime.entityCards[number]);
    }
  }

  runtime.lastIngestSuccessAt = Date.now();
}

function collectAllMemoriesFromRuntime(runtime: NarrativeMemoryRuntime) {
  const memories: Array<{ id: string; title: string; summary: string; keywords: string[]; type: 'player' | 'otherCharacter' | 'item'; sourceFloor: number; savedAt: number }> = [];
  for (const record of runtime.summarySaveHistory) {
    if (!record.summaryData) continue;
    const floor = record.sourceStartIndex ?? 0;
    for (const item of record.summaryData.playerMemories ?? []) {
      memories.push({ id: item.id || `pm_${floor}_${memories.length}`, title: item.title, summary: item.summary, keywords: item.keywords ?? [], type: 'player', sourceFloor: floor, savedAt: item.savedAt ?? record.savedAt });
    }
    for (const item of record.summaryData.otherCharacterMemories ?? []) {
      memories.push({ id: item.id || `oc_${floor}_${memories.length}`, title: item.title, summary: item.summary, keywords: item.keywords ?? [], type: 'otherCharacter', sourceFloor: floor, savedAt: item.savedAt ?? record.savedAt });
    }
    for (const item of record.summaryData.itemMemories ?? []) {
      memories.push({ id: item.id || `im_${floor}_${memories.length}`, title: item.title, summary: item.summary, keywords: item.keywords ?? [], type: 'item', sourceFloor: floor, savedAt: item.savedAt ?? record.savedAt });
    }
  }
  return memories;
}
