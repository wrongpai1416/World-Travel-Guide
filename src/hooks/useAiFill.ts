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
  const abortRef = useRef<AbortController | null>(null);

  const handleAiFill = async () => {
    if (!apiConfig) { await showAlert('请先配置API'); navigate('settings'); return; }
    if (!personalInfo.name.trim()) { await showAlert('请至少填写角色姓名'); return; }

    setIsFilling(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const worldData = allWorlds.find(w => w.id === selectedWorld);
    const worldSetting = worldEntry?.content || worldData?.description || '自由穿越模式';

    const systemPrompt = buildCharacterFillPrompt({
      worldSetting,
      playerName: personalInfo.name,
      playerGender: personalInfo.gender || '',
      playerAge: personalInfo.age || '',
      playerBackground: personalInfo.background || '',
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
          if (n.name) filledNpcs.push({
            id: uuid(), name: n.name, gender: n.gender || '', age: n.age || '',
            race: n.race || '', relationshipType: n.relationship || '',
            occupation: n.occupation || '', faction: n.faction || '', socialStatus: n.socialStatus || '',
            personality: n.personality || '', hiddenPersonality: n.hiddenPersonality || '',
            currentThought: n.currentThought || '',
            appearance: n.appearance || '', currentOutfit: n.currentOutfit || '',
            specialAbility: n.specialAbility || '',
            shortTermGoal: n.shortTermGoal || '', longTermGoal: n.longTermGoal || '',
            psychologicalTrauma: n.psychologicalTrauma || '',
            likes: n.likes || '', dislikes: n.dislikes || '',
            background: n.background || '',
          });
        }
      }

      setPersonalInfo(prev => ({
        ...prev,
        age: data.age || prev.age,
        background: data.background || prev.background,
        career: data.career || prev.career,
        socialClass: data.socialClass || prev.socialClass,
        organization: data.organization || prev.organization,
        specialIdentity: data.specialIdentity || prev.specialIdentity,
        initialSkills: { ...prev.initialSkills, ...filledSkills },
        initialItems: { ...prev.initialItems, ...filledItems },
        customNpcs: [...prev.customNpcs, ...filledNpcs],
      }));

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[AI补全] 失败:', err);
      await showAlert(`AI补全失败: ${err.message}`, { title: '补全失败' });
    } finally {
      setIsFilling(false);
      abortRef.current = null;
    }
  };

  // 清理
  const cleanup = () => { abortRef.current?.abort(); };

  return { isFilling, handleAiFill, cleanup };
}
