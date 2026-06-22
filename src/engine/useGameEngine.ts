// 游戏引擎 - 管线化消息发送、流式响应、变量更新
import { useCallback, useRef, useState, useEffect } from 'react';
import type { ApiConfig, Message } from '../api/types';
import { requestStreamWithRetry } from '../api/client';
import { setRateLimitInterval } from '../api/rateLimiter';
import { extractContentForPrompt } from './responseExtractor';
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
import { getBuiltinPreset, getClaudePreset, getEnhancementModules, PROMPT_INLINE_IMAGE } from '../data/builtinPresets';
import { usePresetStore } from '../stores/presetStore';
import { useImageStore } from '../stores/imageStore';
import { ROLE_COGNITION_FIREWALL_TITLE, ROLE_COGNITION_FIREWALL_CONTENT } from '../utils/roleCognitionFirewall';
import { assembleSystemPrompt, injectAtDepthEntries } from './promptAssembler';
import { MacroEngine } from './macroEngine';
import { useMemoryStore } from '../memory/memoryStore';
import { formatSnapshotForMainAI } from '../utils/npcHelpers';
import type { MemoryPipelineContext } from '../memory/useMemorySystem';
import { loadPresets, resolvePreset } from '../components/settings/apiPresetUtils';
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

  // 辅助：回滚变量快照 + 记忆检查点，并截断消息列表到指定索引
  const rollbackAndTruncate = useCallback((truncateAt: number) => {
    const currentMessages = messagesRef.current;

    // 1. 回滚变量快照
    let restored = false;
    for (let i = truncateAt - 1; i >= 0; i--) {
      if (currentMessages[i].snapshot) {
        varMgrRef.current.restoreSnapshot(currentMessages[i].snapshot as any);
        restored = true;
        break;
      }
    }
    if (!restored && initialSnapshotRef.current) {
      varMgrRef.current.restoreSnapshot(initialSnapshotRef.current as any);
    }

    // 2. 回滚记忆系统
    const memStore = useMemoryStore.getState();
    for (let i = truncateAt - 1; i >= 0; i--) {
      if (currentMessages[i].memoryCheckpointId) {
        memStore.restoreCheckpoint(currentMessages[i].memoryCheckpointId!);
        break;
      }
    }
    memStore.clearPipelineOutputs();

    // 3. 截断消息
    setMessages(prev => {
      const truncated = prev.slice(0, truncateAt);
      messagesRef.current = truncated;
      return truncated;
    });
  }, []);

  // 辅助：构建记忆管线上下文（加载 preset、解析各阶段 API 配置）
  const buildMemoryContext = useCallback((
    floor: number, batchText: string, inputText: string,
    recentContext: string, playerName: string, mainApiConfig: ApiConfig,
  ): MemoryPipelineContext => {
    const memStore = useMemoryStore.getState();
    const memConfig = memStore.config;
    const presets = loadPresets();
    const defaultMemApi = { baseUrl: mainApiConfig.baseUrl, apiKey: mainApiConfig.apiKey, model: mainApiConfig.model };
    const memApiConfig = resolvePreset(presets, memConfig.apiPresetId) ?? defaultMemApi;
    return {
      floor, batchText, inputText, recentContext, playerName,
      apiConfig: memApiConfig,
      writeApiConfig: resolvePreset(presets, memConfig.writePipeline.apiPresetId) ?? undefined,
      summaryApiConfig: resolvePreset(presets, memConfig.writePipeline.summaryApiPresetId) ?? undefined,
      conflictJudgeApiConfig: resolvePreset(presets, memConfig.writePipeline.conflictJudgeApiPresetId) ?? undefined,
      retrievalApiConfig: resolvePreset(presets, memConfig.retrieval.plannerApiPresetId) ?? undefined,
      vectorApiConfig: resolvePreset(presets, memConfig.vectorExtractApiPresetId) ?? undefined,
    };
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

    rollbackAndTruncate(userIdx);
  }, [rollbackAndTruncate]);

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

    rollbackAndTruncate(idx);

    setTimeout(() => {
      sendMessageRef.current?.(getMessageContent(msg));
    }, 0);
  }, [apiConfig, isGenerating, rollbackAndTruncate]);

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

    rollbackAndTruncate(userIdx);

    setTimeout(() => {
      sendMessageRef.current?.(getMessageContent(userMsg));
    }, 0);
  }, [apiConfig, isGenerating, rollbackAndTruncate]);

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
    memStore.clearPipelineOutputs();
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

      const playerName = playerProfileRef.current?.name || '冒险者';
      const batchText = userText + '\n\n' + '(等待AI回复)';
      const recentContext = sanitizeForContext(messagesRef.current, round)
        .slice(-6)
        .map(m => m.content || '')
        .join('\n\n');

      const memCtx = buildMemoryContext(round, batchText, userText, recentContext, playerName, apiConfig);

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
          // 优先使用用户自定义预设，否则用内置默认（支持 Claude 模式切换）
          const { activePresetId, userPresets } = usePresetStore.getState();
          let basePreset;
          if (activePresetId) {
            const found = userPresets.find(p => p.id === activePresetId);
            basePreset = found || (pipelineConfig.claudeMode ? getClaudePreset() : getBuiltinPreset('default'));
          } else {
            basePreset = pipelineConfig.claudeMode ? getClaudePreset() : getBuiltinPreset('default');
          }
          // 叠加增色模块
          let preset = pipelineConfig.enhancementEnabled
            ? { ...basePreset, prompts: [...basePreset.prompts, ...getEnhancementModules()] }
            : basePreset;
          // 叠加正文生图指令（独立于预设，当 inlineImageEnabled 时始终注入）
          const inlineImageEnabled = useImageStore.getState().config.inlineImageEnabled;
          if (inlineImageEnabled) {
            const hasInlineImage = preset.prompts.some(p => p.identifier === 'inline_image_gen');
            if (!hasInlineImage) {
              preset = {
                ...preset,
                prompts: [...preset.prompts, {
                  identifier: 'inline_image_gen',
                  name: '正文生图标签',
                  role: 'system' as const,
                  content: PROMPT_INLINE_IMAGE,
                  enabled: true,
                  order: 2300,
                }],
              };
            }
          }
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

          const result = await requestStreamWithRetry(apiConfig, apiMessages, {
            signal: controller.signal,
            onDelta: (_delta, acc) => { accumulated = acc; updateMessage(aiMsgId, { rawText: acc }); },
          });

          let rawText = result.text || accumulated;

          // 如果响应为空（SSE尾部丢失等），重试一次
          if (!rawText.trim()) {
            let retryAccumulated = '';
            const retryResult = await requestStreamWithRetry(apiConfig, apiMessages, {
              signal: controller.signal,
              onDelta: (_delta, acc) => { retryAccumulated = acc; updateMessage(aiMsgId, { rawText: acc }); },
            });
            rawText = retryResult.text || retryAccumulated;
          }

          // StatusPlaceHolderImpl 处理
          if (rawText.includes('<StatusPlaceHolderImpl/>')) {
            rawText = rawText.replace(/<StatusPlaceHolderImpl\/>/g, '').trim();
            if (!rawText) {
              rawText = '🌍 欢迎来到世界漫游指南！\n\n请描述你的角色和想要穿越的世界，开始你的冒险之旅。\n\n你可以：\n• 直接描述你想做什么\n• 选择下方的推荐行动\n• 输入任何你想尝试的行动';
            }
          }

          // 存储完整原始响应（thinking/options/summary 全由正则脚本处理）
          updateMessage(aiMsgId, {
            rawText,
            streaming: false,
          });
          eventBus.emit(EVENTS.MESSAGE_RECEIVED, aiMsgId);

          return { text: rawText, parsed: { content: extractContentForPrompt(rawText), thinking: '' } };
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
        // 不覆盖已生成的正文，只标记停止
        const existingRaw = getMessageContent(messagesRef.current.find(m => m.id === aiMsgId)!) || '';
        if (!existingRaw.trim()) {
          updateMessage(aiMsgId, { rawText: '[已停止生成]', streaming: false });
        } else {
          updateMessage(aiMsgId, { streaming: false });
        }
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
      const memCtx = buildMemoryContext(ctx.round, ctx.batchText, ctx.userText, ctx.recentContext, ctx.playerName, apiConfig);

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
    if (isGenerating) return; // 正在生成中，按钮已 disabled，静默返回
    if (!apiConfig || !ctx || !executor) {
      const reason = !apiConfig ? 'API 配置缺失' : '管线上下文或执行器已丢失（可能页面刷新过）';
      console.warn('[单步重试] 无法重试：', reason);
      alert(`无法重试：${reason}`);
      return;
    }

    const aiMsg = messagesRef.current.find(m => m.id === ctx.aiMsgId);
    if (!aiMsg || !aiMsg.rawText || aiMsg.rawText.startsWith('[错误]')) {
      console.warn('[单步重试] 无法重试：AI 消息不存在或正文为空');
      alert('无法重试：AI 消息不存在或正文为空');
      return;
    }

    setIsGenerating(true);
    try {
      const memStore = useMemoryStore.getState();
      const memCtx = buildMemoryContext(ctx.round, ctx.batchText, ctx.userText, ctx.recentContext, ctx.playerName, apiConfig);

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
    memStore.clearPipelineOutputs();
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
