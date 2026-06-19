// 记忆系统管线执行器 - 从 useGameEngine.ts 提取
import { requestCompletion } from '../api/client';
import { waitForRateLimit } from '../api/rateLimiter';
import type { MemoryPipelineContext } from './useMemorySystem';
import type { NarrativeMemoryRuntime, SummaryMemoryItem, VectorMemoryItem } from './types';
import { normalizeVectorFact } from './vectorUtils';
import {
  parseNarrativePayload,
  parseNarrativeSummaryResult,
  parseNarrativeRetrievePlannerResult,
  parseNarrativeConflictJudgeResult,
  parseVectorQueryRewriteResult,
  parseRerankResult,
} from './narrativeParsers';

type MemoryStore = ReturnType<typeof import('./memoryStore').useMemoryStore.getState>;

/** 带超时的 Promise 包装 */
function withTimeout<T>(promise: Promise<T>, ms: number, label = '操作'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}超时(${ms / 1000}s)`)), ms)
    ),
  ]);
}

/** 调用记忆系统 AI */
export async function callMemoryAI(
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

export async function executeMemoryWrite(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
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

export async function executeMemorySummary(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
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

export async function executeMemoryVector(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
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

export async function executeMemoryQueryRewrite(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
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

export async function executeMemoryRetrievePlan(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
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

export async function executeMemoryMultiRound(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
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

export async function executeMemoryRerank(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
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

export async function executeMemoryRetrieveFinalize(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
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

// ─── 阶段9: 上下文编译 ───

export async function executeMemoryCompile(memStore: MemoryStore, ctx: MemoryPipelineContext): Promise<void> {
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

export function collectAllMemoriesFromRuntime(runtime: NarrativeMemoryRuntime) {
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
