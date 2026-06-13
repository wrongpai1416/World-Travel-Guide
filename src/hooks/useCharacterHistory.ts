import { useState, useRef, useCallback } from 'react';
import type { PlayerProfile } from '../storage/db';
import type { WorldBookEntry } from '../worldbook/index';
import type { WorldDef } from '../data/worldLoader';
import type { ApiConfig } from '../api/types';
import { requestStreamWithRetry } from '../api/client';
import { getAgeStages, getAllSegmentIds } from '../utils/ageStages';

interface UseCharacterHistoryOptions {
  apiConfig: ApiConfig | null;
  personalInfo: PlayerProfile;
  selectedWorld: string;
  allWorlds: WorldDef[];
  worldEntry: WorldBookEntry | null;
  initialCharacterHistory?: string;
  navigate: (screen: any) => void;
  showAlert: (msg: string, opts?: any) => Promise<void>;
}

export function useCharacterHistory({
  apiConfig, personalInfo, selectedWorld, allWorlds, worldEntry,
  initialCharacterHistory, navigate, showAlert,
}: UseCharacterHistoryOptions) {
  const [segments, setSegments] = useState<Record<string, string>>(() => {
    const ids = getAllSegmentIds(personalInfo.age || '');
    const initial: Record<string, string> = {};
    for (const id of ids) initial[id] = '';
    if (initialCharacterHistory) initial.prologue = initialCharacterHistory;
    return initial;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── 辅助函数 ───
  const getWorldSetting = useCallback(() => {
    const worldData = allWorlds.find(w => w.id === selectedWorld);
    return worldEntry?.content || worldData?.description || '自由穿越模式';
  }, [allWorlds, selectedWorld, worldEntry]);

  const getPlayerInfoBlock = useCallback(() => {
    const parts = [
      `- 姓名：${personalInfo.name || '未设定'}`,
      `- 性别：${personalInfo.gender || '未设定'}`,
      `- 年龄：${personalInfo.age || '未设定'}`,
      `- 背景描述：${personalInfo.background || '无'}`,
    ];
    if (personalInfo.career) parts.push(`- 职业：${personalInfo.career}`);
    if (personalInfo.socialClass) parts.push(`- 阶层：${personalInfo.socialClass}`);
    if (personalInfo.organization) parts.push(`- 所属组织：${personalInfo.organization}`);
    if (personalInfo.specialIdentity) parts.push(`- 特殊身份：${personalInfo.specialIdentity}`);
    if (personalInfo.customNpcs.length > 0) {
      parts.push(`- 关联NPC：${personalInfo.customNpcs.map(n => `${n.name}(${n.relationshipType || '同伴'})`).join('、')}`);
    }
    return parts.join('\n');
  }, [personalInfo]);

  // ─── 解析 AI 输出为分段 ───
  const parseSegmentsFromText = (text: string, ageStr: string): Record<string, string> => {
    const ids = getAllSegmentIds(ageStr);
    const result: Record<string, string> = {};
    for (const id of ids) result[id] = '';

    const sections: { title: string; content: string }[] = [];
    const pattern = /##\s*([^\n]+)\n([\s\S]*?)(?=##\s*[^\n]+|$)/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      sections.push({ title: match[1].trim(), content: match[2].trim() });
    }

    for (const sec of sections) {
      if (sec.title.includes('序章')) {
        result.prologue = sec.content;
      } else {
        const stageId = ids.find(id => id !== 'prologue' && !result[id]);
        if (stageId) result[stageId] = sec.content;
      }
    }

    if (!Object.values(result).some(v => v.trim())) {
      result.prologue = text;
    }
    return result;
  };

  // ─── 一键生成全部 ───
  const handleGenerateAll = async () => {
    if (!apiConfig) { await showAlert('请先配置API'); navigate('settings'); return; }

    setIsGenerating(true);
    setRegeneratingId(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const ageStages = getAgeStages(personalInfo.age);
    const stagePrompts = ageStages.map(s => `## ${s.label}\n（${s.label}期间的经历，1-2段）`).join('\n\n');

    const systemPrompt = `你是一位专业的角色背景故事撰写者。根据以下信息，为玩家生成完整的人生经历。

【世界设定】
${getWorldSetting()}

【玩家信息】
${getPlayerInfoBlock()}

请严格按照以下格式输出，每个段落以 ## 标题开头：

## 序章
（描写角色当前所处的场景和氛围，作为冒险的开场白，2-3段）

${stagePrompts}

注意：
- 每个段落之间用空行分隔
- 内容要与世界设定紧密关联
- 要体现角色的性格和背景
- 序章要有画面感和氛围感`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: '请为我生成完整的角色人生经历。' },
    ];

    let rawText = '';
    try {
      const result = await requestStreamWithRetry(apiConfig, messages, {
        signal: controller.signal,
        onDelta: (_delta, acc) => {
          rawText = acc;
          const parsed = parseSegmentsFromText(acc, personalInfo.age);
          setSegments(parsed);
        },
      });
      const finalSegments = parseSegmentsFromText(result.text || rawText, personalInfo.age);
      setSegments(finalSegments);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[AI生成全部] 失败:', err);
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  // ─── 单段重新生成 ───
  const handleRegenerateSegment = async (segmentId: string) => {
    if (!apiConfig) { await showAlert('请先配置API'); navigate('settings'); return; }

    setIsGenerating(true);
    setRegeneratingId(segmentId);
    const controller = new AbortController();
    abortRef.current = controller;

    const ageStages = getAgeStages(personalInfo.age);
    const allIds = getAllSegmentIds(personalInfo.age);
    const segmentNames: Record<string, string> = {
      prologue: '序章（冒险开场白，描写当前场景和氛围）',
      ...Object.fromEntries(ageStages.map(s => [s.id, s.label])),
    };

    const idx = allIds.indexOf(segmentId);
    const prevSegment = idx > 0 ? segments[allIds[idx - 1]] : '';
    const nextSegment = idx < allIds.length - 1 ? segments[allIds[idx + 1]] : '';

    let contextBlock = '';
    if (prevSegment) contextBlock += `【前一阶段内容】\n${prevSegment}\n\n`;
    if (nextSegment) contextBlock += `【后一阶段内容】\n${nextSegment}\n\n`;

    const stageName = segmentNames[segmentId] || segmentId;
    const systemPrompt = `你是一位专业的角色背景故事撰写者。请只为以下阶段生成内容。

【世界设定】
${getWorldSetting()}

【玩家信息】
${getPlayerInfoBlock()}

${contextBlock}
请只输出「${stageName}」的内容，不要输出标题标记，直接输出故事文本，1-2段。`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请为我生成${stageName}的内容。` },
    ];

    try {
      let accumulated = '';
      const result = await requestStreamWithRetry(apiConfig, messages, {
        signal: controller.signal,
        onDelta: (_delta, acc) => {
          accumulated = acc;
          setSegments(prev => ({ ...prev, [segmentId]: acc }));
        },
      });
      setSegments(prev => ({ ...prev, [segmentId]: result.text || accumulated }));
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(`[AI生成 ${segmentId}] 失败:`, err);
    } finally {
      setIsGenerating(false);
      setRegeneratingId(null);
      abortRef.current = null;
    }
  };

  // ─── 拼接完整文本 ───
  const buildFullCharacterHistory = useCallback(() => {
    const order = getAllSegmentIds(personalInfo.age);
    return order.map(id => (segments[id] || '').trim()).filter(Boolean).join('\n\n');
  }, [segments, personalInfo.age]);

  // 清理
  const cleanup = () => { abortRef.current?.abort(); };

  return {
    segments, setSegments,
    isGenerating, regeneratingId,
    handleGenerateAll,
    handleRegenerateSegment,
    buildFullCharacterHistory,
    cleanup,
  };
}
