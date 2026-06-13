// 游戏引擎 - 管线化消息发送、流式响应、变量更新
import { useCallback, useRef, useState, useEffect } from 'react';
import type { ApiConfig, Message } from '../api/types';
import { requestStreamWithRetry } from '../api/client';
import { parseResponse } from './responseExtractor';
import { VariableManager } from './variableManager';
import { eventBus, EVENTS } from './eventBus';
import { v4 as uuid } from 'uuid';
import type { WorldBookManager } from '../worldbook/index';
import type { AuxiliaryConfig } from '../api/auxiliaryApi';
import { sanitizeForContext } from './contextManager';
import type { GameSave, PlayerProfile, CustomNpc } from '../storage/db';
import { loadWorldBook, applyWorld } from './worldPersonality';
import { PipelineExecutor } from './pipelineExecutor';
import { loadPipelineConfig, type PipelineStatus } from './pipelineTypes';
import type { ChatMessage, GameEngine } from './types';
import { getBuiltinPreset } from '../data/builtinPresets';
import { ROLE_COGNITION_FIREWALL_TITLE, ROLE_COGNITION_FIREWALL_CONTENT } from '../utils/roleCognitionFirewall';
import { assembleSystemPrompt } from './promptAssembler';
import { MacroEngine } from './macroEngine';
import { useMemoryStore } from '../memory/memoryStore';
import type { MemoryPipelineContext } from '../memory/useMemorySystem';
import { loadPresets } from '../components/settings/apiPresetUtils';

export type { ChatMessage, GameEngine };

export function useGameEngine(
  apiConfig: ApiConfig | null,
  initialVarMgr?: VariableManager,
  auxiliaryConfig?: AuxiliaryConfig | null,
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

  useEffect(() => { playerProfileRef.current = playerProfile ?? null; }, [playerProfile]);
  useEffect(() => { characterHistoryRef.current = characterHistory ?? ''; }, [characterHistory]);
  useEffect(() => { onAutoSaveRef.current = onAutoSave; }, [onAutoSave]);

  // 管线状态持久化到 sessionStorage
  useEffect(() => {
    if (pipelineStatus) {
      try { sessionStorage.setItem('dev_pipeline_status', JSON.stringify(pipelineStatus)); } catch {}
    }
  }, [pipelineStatus]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    loadWorldBook().then(wb => {
      worldBookRef.current = wb;
      if (wb && !initializedRef.current) {
        initializedRef.current = true;
        applyWorld(wb, selectedWorld);
      }
    });
  }, []);

  useEffect(() => {
    if (worldBookRef.current && initializedRef.current) {
      applyWorld(worldBookRef.current, selectedWorld);
    }
  }, [selectedWorld]);

  const addMessage = useCallback((msg: ChatMessage) => { setMessages(prev => [...prev, msg]); }, []);
  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  const deleteSingleMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const editMessage = useCallback((id: string, content: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m));
  }, []);

  const resendFromMessage = useCallback(async (id: string) => {
    if (!apiConfig || isGenerating) return;
    const currentMessages = messagesRef.current;
    const idx = currentMessages.findIndex(m => m.id === id);
    if (idx === -1) return;
    const msg = currentMessages[idx];
    if (!msg || msg.role !== 'user') return;

    // 回滚变量状态：从 idx-1 向前找最近的 snapshot
    for (let i = idx - 1; i >= 0; i--) {
      if (currentMessages[i].snapshot) {
        varMgrRef.current.restoreSnapshot(currentMessages[i].snapshot as any);
        break;
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

    setMessages(prev => {
      const truncated = prev.slice(0, idx);
      messagesRef.current = truncated;
      return truncated;
    });

    setTimeout(() => {
      sendMessageRef.current?.(msg.content);
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

    // 回滚变量状态：从 userIdx-1 向前找最近的 snapshot
    for (let i = userIdx - 1; i >= 0; i--) {
      if (currentMessages[i].snapshot) {
        varMgrRef.current.restoreSnapshot(currentMessages[i].snapshot as any);
        break;
      }
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
      sendMessageRef.current?.(userMsg.content);
    }, 0);
  }, [apiConfig, isGenerating]);

  const loadSave = useCallback((save: GameSave) => {
    setMessages(save.messages);
    varMgrRef.current = VariableManager.fromJSON({ state: save.gameState });
    roundRef.current = save.messages.length > 0
      ? Math.max(...save.messages.map(m => m.round))
      : 0;
    if (save.worldId && worldBookRef.current) {
      applyWorld(worldBookRef.current, save.worldId);
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
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    if (!apiConfig || isGenerating || !userText.trim()) return;

    setIsGenerating(true);
    roundRef.current++;
    const round = roundRef.current;

    const userMsg: ChatMessage = { id: uuid(), role: 'user', content: userText, round, timestamp: Date.now() };
    addMessage(userMsg);
    eventBus.emit(EVENTS.MESSAGE_SENT, userMsg);

    const aiMsgId = uuid();
    const aiMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: '', round, timestamp: Date.now(), streaming: true };
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
        varMgr: varMgrRef.current,
        worldBook: worldBookRef.current,
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
          // 检索：查询改写 → AI规划 → 多轮 → 精排
          retrieve: async () => {
            await executeMemoryRetrieve(memStore, memCtx);
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
          const varSnapshot = JSON.stringify(state, null, 2);

          // 世界书注入
          let wbInjection = '';
          if (worldBookRef.current) {
            const { beforeChar, afterChar } = worldBookRef.current.buildInjection(userText);
            if (beforeChar) wbInjection += beforeChar + '\n\n';
            if (afterChar) wbInjection += afterChar + '\n\n';
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
- 背景描述：${playerProfileRef.current.background || '无'}
- 职业：${playerProfileRef.current.career || '未设定'}
- 阶层：${playerProfileRef.current.socialClass || '未设定'}
- 所属组织：${playerProfileRef.current.organization || '无'}
- 特殊身份：${playerProfileRef.current.specialIdentity || '无'}
- 叙事视角：${playerProfileRef.current.perspective || '第三人称'}
${characterHistoryRef.current ? `- 角色经历：\n${characterHistoryRef.current}` : ''}
${customNpcsBlock}
在故事开始时，玩家应以此身份登场。NPC 应以该角色的姓名和身份进行称呼和互动。
${perspectiveInstruction}
</PlayerProfile>
`;
          }

          // 获取上一次编译的记忆上下文（如果有）
          const compiledMemoryContext = memStore.lastCompiledContext?.fullText || '';

          // 使用结构化预设 + 宏引擎组装系统提示
          const preset = getBuiltinPreset('default');
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
          const apiMessages: Message[] = [
            { role: 'system', content: systemPrompt },
            ...chatHistory,
            { role: 'user', content: userText },
          ];

          let accumulated = '';
          let reasoning = '';

          const result = await requestStreamWithRetry(apiConfig, apiMessages, {
            signal: controller.signal,
            onDelta: (delta, acc) => { accumulated = acc; updateMessage(aiMsgId, { content: acc }); },
            onReasoning: (r) => { reasoning = r; updateMessage(aiMsgId, { thinking: r }); },
          });

          const parsed = parseResponse(result.text || accumulated);

          let finalContent = parsed.content || result.text || accumulated;

          // 如果响应为空（SSE尾部丢失等），重试一次
          if (!finalContent.trim()) {
            let retryAccumulated = '';
            const retryResult = await requestStreamWithRetry(apiConfig, apiMessages, {
              signal: controller.signal,
              onDelta: (delta, acc) => { retryAccumulated = acc; updateMessage(aiMsgId, { content: acc }); },
              onReasoning: (r) => { reasoning = r; updateMessage(aiMsgId, { thinking: r }); },
            });
            const retryParsed = parseResponse(retryResult.text || retryAccumulated);
            finalContent = retryParsed.content || retryResult.text || retryAccumulated;
            if (retryParsed.thinking) parsed.thinking = retryParsed.thinking;
            if (retryParsed.actionOptions) parsed.actionOptions = retryParsed.actionOptions;
            if (retryParsed.summary) parsed.summary = retryParsed.summary;
          }

          if (finalContent.includes('<StatusPlaceHolderImpl/>')) {
            finalContent = finalContent.replace(/<StatusPlaceHolderImpl\/>/g, '').trim();
            if (!finalContent) {
              finalContent = '🌍 欢迎来到世界漫游指南！\n\n请描述你的角色和想要穿越的世界，开始你的冒险之旅。\n\n你可以：\n• 直接描述你想做什么\n• 选择下方的推荐行动\n• 输入任何你想尝试的行动';
            }
          }

          updateMessage(aiMsgId, {
            content: result.text || accumulated,
            thinking: parsed.thinking || reasoning || result.reasoning,
            actionOptions: parsed.actionOptions,
            summary: parsed.summary || undefined,
            streaming: false,
          });
          eventBus.emit(EVENTS.MESSAGE_RECEIVED, aiMsgId);

          return { text: finalContent, parsed };
        },
      });

      // 管线完成 — 保存当前变量快照到 AI 消息（用于回滚）
      const snapshot = varMgrRef.current.createSnapshot();
      // 创建记忆系统检查点（用于回滚）
      const memStoreForCheckpoint = useMemoryStore.getState();
      const memCheckpoint = memStoreForCheckpoint.createCheckpoint();
      updateMessage(aiMsgId, {
        snapshot,
        snapshotTime: Date.now(),
        memoryCheckpointId: memCheckpoint?.id,
      });

      setPipelineStatus(pipelineResult.status);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        updateMessage(aiMsgId, { content: '[已停止生成]', streaming: false });
      } else {
        updateMessage(aiMsgId, { content: `[错误] ${err.message}`, streaming: false });
      }
    } finally {
      setIsGenerating(false);
      cancelRef.current = null;
      eventBus.emit(EVENTS.GENERATION_ENDED, aiMsgId);
      // 直接触发自动存档（通过 ref 回调，不依赖事件总线时序）
      try { onAutoSaveRef.current?.(); } catch (e) { console.warn('[auto-save] 回调失败:', e); }
    }
  }, [apiConfig, isGenerating, addMessage, updateMessage, auxiliaryConfig]);

  sendMessageRef.current = sendMessage;

  const cancel = useCallback(() => { cancelRef.current?.abort(); }, []);

  const reset = useCallback(() => {
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
  }, [selectedWorld]);

  const setPlayerProfile = useCallback((profile: PlayerProfile) => {
    const state = varMgrRef.current.getState();
    // 基础信息
    state.玩家.姓名 = profile.name;
    state.玩家.性别 = profile.gender;
    state.玩家.年龄 = profile.age;
    state.玩家.身份信息.背景信息 = profile.background;
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
          所属势力: npc.faction || '',
          社会地位: npc.socialStatus || '',
        },
        关系数据: {
          好感度: 50, 信任度: 50,
          关系类型: npc.relationshipType || '同伴',
          印象标签: [], 核心锚点: [],
        },
        个人信息: {
          价值观: {
            喜好: npc.likes ? npc.likes.split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [],
            厌恶: npc.dislikes ? npc.dislikes.split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [],
            雷区: '',
          },
          执念与目标: npc.longTermGoal || '',
          心理创伤: npc.psychologicalTrauma || '',
          外貌: npc.appearance || '',
          表性格: npc.personality || '',
          里性格: npc.hiddenPersonality || '',
          当前想法: npc.currentThought || '',
          特殊能力: npc.specialAbility || '',
          当前穿着: npc.currentOutfit || '',
          当前位置: '', 当前状态: '',
          持有物品: '', 过往经历: [], 备注: '',
        },
        交互记忆: { 未完成约定: [], 共同秘密: [], 赠礼记录: [] },
        重要NPC: true,
        _关注: true,
        婚姻状态: '', 联系方式: '',
        近期事件: [], 重要经历: [],
        $time: Date.now(),
        人物分类: '在场',
        短期目标: npc.shortTermGoal || '',
        长期目标: npc.longTermGoal || '',
      };
    }
    varMgrRef.current.setState(state);
  }, []);

  return {
    sendMessage, cancel, isGenerating, messages,
    variableManager: varMgrRef.current,
    worldBook: worldBookRef.current,
    pipelineStatus,
    deleteSingleMessage, editMessage, resendFromMessage, resendFromAssistantMessage,
    loadSave, reset, setPlayerProfile, setInitialNPCs, addMessage,
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

async function callMemoryAI(
  apiConfig: { baseUrl: string; apiKey: string; model: string },
  systemPrompt: string,
  userContent: string,
  temperature = 0.3,
  timeoutMs = 120000,
): Promise<string> {
  console.log('[记忆AI] 调用开始', { model: apiConfig.model });
  try {
    // 非流式调用，加大超时到 120 秒
    // 注意：参考项目明确不使用 responseFormat: 'json'，因为某些 API 对非流式响应很慢
    const result = await withTimeout(
      requestCompletion(
        { ...apiConfig, provider: 'openai' },
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
        { temperature },
      ),
      timeoutMs,
      '记忆AI调用',
    );
    console.log('[记忆AI] 调用成功', { length: result.text?.length });
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
  console.log('[记忆写入] 开始, floor:', ctx.floor, 'maxAttempts:', maxAttempts);

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
        console.log('[记忆写入] AI 返回解析结果:', {
          attempt,
          hasScenePatch: !!parsed.scenePatch,
          threadCount: Array.isArray(parsed.threadUpserts) ? parsed.threadUpserts.length : 0,
          eventCount: Array.isArray(parsed.eventCandidates) ? parsed.eventCandidates.length : 0,
          entityCount: Array.isArray(parsed.entityPatches) ? parsed.entityPatches.length : 0,
        });

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
        console.log('[记忆写入] 完成, 运行态:', {
          scene: !!runtime.sceneAnchor,
          threads: runtime.activeThreads.length,
          events: runtime.eventCards.length,
          entities: runtime.entityCards.length,
        });
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
        console.log('[摘要保存] 完成, attempt:', attempt);
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

// ─── 阶段4: 检索规划 ───

async function executeMemoryRetrieve(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  const runtime = memStore.getMemoryRuntime();
  const allMemories = collectAllMemoriesFromRuntime(runtime);
  console.log('[记忆检索] 开始, 已有记忆:', allMemories.length, '条, summaryHistory:', runtime.summarySaveHistory.length);
  if (allMemories.length === 0) {
    console.log('[记忆检索] 无记忆可检索, 跳过');
    return;
  }

  const templates = memStore.config.narrativePromptTemplates;
  const rConfig = memStore.config.retrieval;
  memStore.setLoading(true, '正在检索记忆...');

  try {
    // 查询改写
    let retrievalKeywords: string[] = [];
    if (rConfig.useQueryRewrite) {
      try {
        const qrPrompt = templates.queryRewrite
          .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
          .replace(/\{\{inputText\}\}/g, ctx.inputText)
          .replace(/\{\{recentContext\}\}/g, ctx.recentContext.slice(-800))
          .replace(/\{\{entityTerms\}\}/g, '').replace(/\{\{timeTerms\}\}/g, '');
        const qrRaw = await callMemoryAI(ctx.retrievalApiConfig ?? ctx.apiConfig, qrPrompt, '请分析当前输入并输出查询改写 JSON。');
        retrievalKeywords = parseVectorQueryRewriteResult(qrRaw).retrievalKeywords;
      } catch { /* 失败用原始输入 */ }
    }

    // AI 检索规划
    const candidateList = allMemories.slice(0, rConfig.plannerCandidateLimit)
      .map((m, i) => `[${i}] ${m.title}（关键词：${m.keywords.join('、')}）`).join('\n');

    const plannerPrompt = templates.retrievePlanner
      .replace(/\{\{玩家名字\}\}/g, ctx.playerName)
      .replace(/\{\{inputText\}\}/g, ctx.inputText)
      .replace(/\{\{recentContext\}\}/g, ctx.recentContext.slice(-600))
      .replace(/\{\{compiledNarrativeContext\}\}/g, '无')
      .replace(/\{\{compiledNarrativeSections\}\}/g, '无')
      .replace(/\{\{semanticAnalysis\}\}/g, '')
      .replace(/\{\{summaryHistory\}\}/g, `共 ${runtime.summarySaveHistory.length} 条摘要`)
      .replace(/\{\{memoryCandidates\}\}/g, candidateList || '无候选');

    const plannerRaw = await callMemoryAI(ctx.retrievalApiConfig ?? ctx.apiConfig, plannerPrompt, '请规划需要注入的记忆，输出 JSON。', 0.3, 60000);
    const plannerResult = parseNarrativeRetrievePlannerResult(plannerRaw);
    const allKeywords = [...new Set([...retrievalKeywords, ...plannerResult.retrievalKeywords])];

    // 标题匹配 + 关键词命中率
    const finalTitles = plannerResult.items.map(i => i.title);
    const titleSelected = allMemories.filter(m => finalTitles.some(t => t === m.title || m.title.includes(t) || t.includes(m.title)));
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
      strategy: `AI规划 + 关键词匹配 → ${deduped.length} 条`,
    });
  } finally {
    memStore.setLoading(false);
  }
}

// ─── 阶段5: 上下文编译 ───

async function executeMemoryCompile(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
  const entries = ctx._selectedEntries ?? [];
  console.log('[记忆编译] 开始, 选中条目:', entries.length);

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
