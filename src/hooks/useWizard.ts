import { useState, useEffect, useRef, useMemo } from 'react';
import { WORLDS, type WorldDef } from '../data/worldLoader';
import type { PlayerProfile } from '../storage/db';
import type { WorldBookEntry } from '../worldbook/index';
import { loadWorldBook } from '../engine/worldPersonality';

const CREATED_WORLDS_KEY = 'chuanye_custom_worlds';

interface UseWizardOptions {
  initialWorld?: string;
  initialPersonalInfo?: PlayerProfile | null;
}

export function useWizard({ initialWorld = 'default', initialPersonalInfo }: UseWizardOptions = {}) {
  // ─── 向导状态 ───
  const [view, setView] = useState<'main' | 'wizard' | 'saves'>('main');
  const [step, setStep] = useState(1);
  const [selectedWorld, setSelectedWorld] = useState(initialWorld);

  // 世界切换时重置世界书加载状态
  const prevWorldRef = useRef(selectedWorld);
  useEffect(() => {
    if (prevWorldRef.current !== selectedWorld) {
      prevWorldRef.current = selectedWorld;
      setWorldBookLoaded(false);
      setWorldEntry(null);
    }
  }, [selectedWorld]);

  // ─── 世界书 ───
  const [worldBookLoaded, setWorldBookLoaded] = useState(false);
  const [worldEntry, setWorldEntry] = useState<WorldBookEntry | null>(null);

  // ─── 角色信息 ───
  const [personalInfo, setPersonalInfo] = useState<PlayerProfile>({
    name: initialPersonalInfo?.name || '',
    gender: initialPersonalInfo?.gender || '',
    age: initialPersonalInfo?.age || '',
    background: initialPersonalInfo?.background || '',
    career: initialPersonalInfo?.career || '',
    socialClass: initialPersonalInfo?.socialClass || '',
    organization: initialPersonalInfo?.organization || '',
    specialIdentity: initialPersonalInfo?.specialIdentity || '',
    perspective: initialPersonalInfo?.perspective || '第三人称',
    initialSkills: initialPersonalInfo?.initialSkills || {},
    initialItems: initialPersonalInfo?.initialItems || {},
    customNpcs: initialPersonalInfo?.customNpcs || [],
  });

  // ─── 用户创建的世界 ───
  const [createdWorlds, setCreatedWorlds] = useState<WorldDef[]>(() => {
    try { return JSON.parse(localStorage.getItem(CREATED_WORLDS_KEY) || '[]'); } catch { return []; }
  });
  const allWorlds = useMemo(() => [...WORLDS, ...createdWorlds], [createdWorlds]);

  // ─── 世界编辑器 ───
  const [worldEditorOpen, setWorldEditorOpen] = useState(false);
  const [editingWorld, setEditingWorld] = useState<WorldDef | null>(null);
  const aiWorldAbortRef = useRef<AbortController | null>(null);

  // 加载世界书（进入向导时触发，不再绑定特定步骤号）
  useEffect(() => {
    if (view !== 'wizard' || worldBookLoaded) return;
    loadWorldBook().then(wb => {
      setWorldBookLoaded(true);
      if (!wb) return;
      const world = allWorlds.find(w => w.id === selectedWorld);
      if (!world) return;

      // 旧模式：通过 entryId 查找
      if (world.entryId != null) {
        wb.enableEntry(world.entryId);
        const entries = wb.getEnabledEntries();
        setWorldEntry(entries.find(e => e.id === world.entryId) || null);
      }
      // v2.0 新模式：从 worldBookEntries 构造临时 entry 用于 UI 展示
      else if (world.worldBookEntries && world.worldBookEntries.length > 0) {
        const firstEntry = world.worldBookEntries[0];
        setWorldEntry({
          id: firstEntry.uid,
          comment: firstEntry.comment,
          content: firstEntry.content,
          constant: firstEntry.constant,
          enabled: !firstEntry.disable,
          selective: (firstEntry.key?.length ?? 0) > 0,
          keys: firstEntry.key ?? [],
          secondaryKeys: firstEntry.keysecondary ?? [],
          position: firstEntry.position ?? 'after_char',
          insertionOrder: firstEntry.order ?? 0,
        });
      }
    });
  }, [view, selectedWorld, worldBookLoaded]);

  // 一次性清理旧版自建世界
  useEffect(() => {
    if (!localStorage.getItem('chuanye_worlds_migrated')) {
      localStorage.removeItem(CREATED_WORLDS_KEY);
      localStorage.setItem('chuanye_worlds_migrated', '1');
      setCreatedWorlds([]);
    }
  }, []);

  // 持久化用户创建的世界
  useEffect(() => {
    localStorage.setItem(CREATED_WORLDS_KEY, JSON.stringify(createdWorlds));
  }, [createdWorlds]);

  // ─── 世界编辑器操作 ───
  const handleSaveWorld = (world: WorldDef) => {
    setCreatedWorlds(prev => {
      const idx = prev.findIndex(w => w.id === world.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = world; return next; }
      return [...prev, world];
    });
    setSelectedWorld(world.id);
    setWorldEditorOpen(false);
    setEditingWorld(null);
  };

  const handleDeleteWorld = (worldId: string) => {
    setCreatedWorlds(prev => prev.filter(w => w.id !== worldId));
    if (selectedWorld === worldId) setSelectedWorld('default');
  };

  const handleCancelWorldEditor = () => {
    setWorldEditorOpen(false);
    setEditingWorld(null);
  };

  return {
    // 向导
    view, setView,
    step, setStep,
    selectedWorld, setSelectedWorld,
    // 世界书
    worldEntry,
    // 角色
    personalInfo, setPersonalInfo,
    // 世界列表
    allWorlds, createdWorlds,
    // 编辑器
    worldEditorOpen, setWorldEditorOpen,
    editingWorld, setEditingWorld,
    handleSaveWorld,
    handleDeleteWorld,
    handleCancelWorldEditor,
  };
}
