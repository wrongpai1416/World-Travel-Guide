import { useState, useRef } from 'react';
import type { PlayerProfile, CustomNpc } from '../storage/db';
import type { WorldBookEntry } from '../worldbook/index';
import type { WorldDef } from '../data/worldLoader';
import type { ApiConfig } from '../api/types';
import { requestStreamWithRetry } from '../api/client';
import { v4 as uuid } from 'uuid';
import { buildCharacterFillPrompt } from '../utils/prompts';

interface UseAiFillOptions {
  apiConfig: ApiConfig | null;
  personalInfo: PlayerProfile;
  selectedWorld: string;
  allWorlds: WorldDef[];
  worldEntry: WorldBookEntry | null;
  setPersonalInfo: React.Dispatch<React.SetStateAction<PlayerProfile>>;
  navigate: (screen: any) => void;
  showAlert: (msg: string, opts?: any) => Promise<void>;
}

export function useAiFill({
  apiConfig, personalInfo, selectedWorld, allWorlds, worldEntry,
  setPersonalInfo, navigate, showAlert,
}: UseAiFillOptions) {
  const [isFilling, setIsFilling] = useState(false);
  const [fillElapsed, setFillElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAiFill = async () => {
    if (!apiConfig) { await showAlert('请先配置API'); navigate('settings'); return; }
    if (!personalInfo.name.trim()) { await showAlert('请至少填写角色姓名'); return; }

    setIsFilling(true);
    setFillElapsed(0);
    const controller = new AbortController();
    abortRef.current = controller;
    // 计时器：每秒更新已用时间
    const startTime = Date.now();
    timerRef.current = setInterval(() => setFillElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);

    const worldData = allWorlds.find(w => w.id === selectedWorld);
    const worldSetting = worldEntry?.content || worldData?.description || '自由穿越模式';

    // 提取世界的数值属性模块配置（用于生成角色初始属性）
    const statMod = worldData?.modules?.find(m => m.moduleId === 'stat' && m.enabled);
    const hasProgression = !!worldData?.modules?.some(m => m.moduleId === 'progression' && m.enabled);
    const statRaw = (statMod?.moduleConfig || statMod?.data) as any;
    const statModule = statRaw ? {
      attrA: { name: statRaw.attrA?.name || '生命', max: statRaw.attrA?.max || 100 },
      attrB: { name: statRaw.attrB?.name || '能量', max: statRaw.attrB?.max || 100 },
      dim1: { name: statRaw.dim1?.name || '属性1', range: statRaw.dim1?.range || [0, 100] },
      dim2: { name: statRaw.dim2?.name || '属性2', range: statRaw.dim2?.range || [0, 100] },
      dim3: { name: statRaw.dim3?.name || '属性3', range: statRaw.dim3?.range || [0, 100] },
      dim4: { name: statRaw.dim4?.name || '属性4', range: statRaw.dim4?.range || [0, 100] },
      dim5: { name: statRaw.dim5?.name || '属性5', range: statRaw.dim5?.range || [0, 100] },
      dim6: { name: statRaw.dim6?.name || '属性6', range: statRaw.dim6?.range || [0, 100] },
      special: Array.isArray(statRaw.special) ? statRaw.special.map((s: any) => ({
        id: s.id || '', name: s.name || '', range: s.range || [0, 100], description: s.description || '',
      })) : undefined,
    } : undefined;

    const systemPrompt = buildCharacterFillPrompt({
      worldSetting,
      playerName: personalInfo.name,
      playerGender: personalInfo.gender || '',
      playerAge: personalInfo.age || '',
      playerBackground: personalInfo.background || '',
      statModule,
    });

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: '请根据我的基础信息和世界设定，补全我的角色信息。' },
    ];

    try {
      const result = await requestStreamWithRetry(apiConfig, messages, {
        signal: controller.signal,
        onDelta: () => {},
      });

      const text = result.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI 返回格式异常');

      const data = JSON.parse(jsonMatch[0]);

      const filledSkills: PlayerProfile['initialSkills'] = {};
      if (Array.isArray(data.skills)) {
        for (const s of data.skills) {
          if (s.name) filledSkills[s.name] = {
            品质: s.quality || '普通', 描述: s.desc || '', 类型: s.type || '',
          };
        }
      }

      const filledItems: PlayerProfile['initialItems'] = {};
      if (Array.isArray(data.items)) {
        for (const it of data.items) {
          if (it.name) filledItems[it.name] = {
            数量: it.quantity || 1, 类型: it.type || '', 品质: it.quality || '普通', 备注: it.note || '',
          };
        }
      }

      const filledNpcs: CustomNpc[] = [];
      if (Array.isArray(data.npcs)) {
        for (const n of data.npcs) {
          if (n.name) {
            const npc: CustomNpc = {
              id: uuid(), name: n.name, gender: n.gender || '', age: n.age || '',
              race: n.race || '', relationshipType: n.relationship || '',
              occupation: n.occupation || '', socialStatus: n.socialStatus || '',
              personality: n.personality || '', hiddenPersonality: n.hiddenPersonality || '',
              currentThought: n.currentThought || '',
              appearance: n.appearance || '', currentOutfit: n.currentOutfit || '',
              currentAction: n.currentAction || '', currentLocation: n.currentLocation || '',
              currentState: n.currentState || '',
              shortTermGoal: n.shortTermGoal || '', longTermGoal: n.longTermGoal || '',
              background: n.background || '',
              chronicles: Array.isArray(n.chronicles) ? n.chronicles : [],
              skillsList: n.skillsList && typeof n.skillsList === 'object' ? n.skillsList : {},
              itemsList: n.itemsList && typeof n.itemsList === 'object' ? n.itemsList : {},
            };
            // NPC 属性（数值属性模块）
            if (n.attrs && typeof n.attrs === 'object' && statModule) {
              npc.attrs = {};
              if (n.attrs.attrA != null) npc.attrs['attrA'] = Number(n.attrs.attrA);
              if (n.attrs.attrB != null) npc.attrs['attrB'] = Number(n.attrs.attrB);
              for (let i = 1; i <= 6; i++) {
                const key = `dim${i}`;
                if (n.attrs[key] != null) npc.attrs[key] = Number(n.attrs[key]);
              }
            }
            // NPC 段位（成长体系模块）
            if (n.tierIndex != null && hasProgression) {
              npc.tierIndex = Number(n.tierIndex);
            }
            filledNpcs.push(npc);
          }
        }
      }

      // 处理 AI 生成的初始属性
      const moduleInitData: Record<string, unknown> = { ...(personalInfo.moduleInitData || {}) };
      if (data.initialStats && statModule) {
        const stats: Record<string, unknown> = {};
        if (data.initialStats.attrA != null) stats['attrA'] = { current: Number(data.initialStats.attrA) };
        if (data.initialStats.attrB != null) stats['attrB'] = { current: Number(data.initialStats.attrB) };
        for (let i = 1; i <= 6; i++) {
          const key = `dim${i}`;
          if (data.initialStats[key] != null) stats[key] = { value: Number(data.initialStats[key]) };
        }
        if (Array.isArray(data.initialStats.special)) {
          stats['special'] = data.initialStats.special.map((s: any) => ({
            id: s.id, value: Number(s.value),
          }));
        }
        moduleInitData['数值属性'] = stats;
      }

      setPersonalInfo(prev => ({
        ...prev,
        age: data.age || prev.age,
        personality: data.personality || prev.personality,
        appearance: data.appearance || prev.appearance,
        background: data.background || prev.background,
        career: data.career || prev.career,
        socialClass: data.socialClass || prev.socialClass,
        organization: data.organization || prev.organization,
        specialIdentity: data.specialIdentity || prev.specialIdentity,
        initialSkills: { ...prev.initialSkills, ...filledSkills },
        initialItems: { ...prev.initialItems, ...filledItems },
        customNpcs: [...prev.customNpcs, ...filledNpcs],
        moduleInitData,
      }));

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[AI补全] 失败:', err);
      await showAlert(`AI补全失败: ${err.message}`, { title: '补全失败' });
    } finally {
      setIsFilling(false);
      abortRef.current = null;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  // 取消补全
  const cancelFill = () => { abortRef.current?.abort(); };

  // 清理
  const cleanup = () => { abortRef.current?.abort(); };

  return { isFilling, fillElapsed, handleAiFill, cancelFill, cleanup };
}
