import { useState, useEffect, useRef } from 'react';
import type { WorldDef, WorldBookEntryDef } from '../../data/worlds-schema';
import { requestStreamWithRetry } from '../../api/client';
import ModuleSelector, { getDefaultSelectedModules } from './ModuleSelector';
import { useConfigStore } from '../../stores/configStore';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { StatModuleSchema, ProgressionModuleSchema, SurvivalModuleSchema, BusinessModuleSchema, TalentModuleSchema } from '../../modules/schema';
import { createBuildContext } from '../../modules/buildContext';
import { executeBuildPipeline } from '../../modules/buildPipeline';
import GuidedChoiceOverlay from './GuidedChoiceOverlay';
import { normalizeModules, denormalizeModules } from '../../modules/normalizeModule';

import { createDefaultStatModule, createDefaultProgressionModule, createDefaultSurvivalModule, createDefaultBusinessModule, createDefaultDiceModule, createDefaultTalentModule } from '../../modules/defaults';
import { buildStatGenPrompt, buildProgressionGenPrompt, buildSurvivalGenPrompt, buildBusinessGenPrompt } from '../../modules/prompts';
import {
  X, Cpu, Pencil, Sparkles, Loader, ClipboardList, ScrollText,
  Swords, DollarSign, Flag, User, Save, Plus,
  Globe, Compass, BookOpen, Flame, Mountain, Ship, Castle, Skull, Crown,
  Rocket, Star, Shield, Zap, Brain, Gem, Ghost, Snowflake, Sun, Moon,
  Wind, Waves, Anchor, Eye, Heart, Target, Wand2, Fish, Bug,
  Flower, TreePine, Cloud, Sunrise, Eclipse, Hexagon, Diamond, Atom,
  Download, BarChart3, TrendingUp, Map, Landmark, BookMarked,
  type LucideIcon,
} from 'lucide-react';

// 内置图标列表（30个）
const WORLD_ICONS: Array<{ name: string; icon: LucideIcon }> = [
  { name: 'Globe', icon: Globe },
  { name: 'Compass', icon: Compass },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Flame', icon: Flame },
  { name: 'Mountain', icon: Mountain },
  { name: 'Ship', icon: Ship },
  { name: 'Castle', icon: Castle },
  { name: 'Skull', icon: Skull },
  { name: 'Crown', icon: Crown },
  { name: 'Rocket', icon: Rocket },
  { name: 'Star', icon: Star },
  { name: 'Shield', icon: Shield },
  { name: 'Zap', icon: Zap },
  { name: 'Brain', icon: Brain },
  { name: 'Gem', icon: Gem },
  { name: 'Ghost', icon: Ghost },
  { name: 'Snowflake', icon: Snowflake },
  { name: 'Sun', icon: Sun },
  { name: 'Moon', icon: Moon },
  { name: 'Wind', icon: Wind },
  { name: 'Waves', icon: Waves },
  { name: 'Anchor', icon: Anchor },
  { name: 'Eye', icon: Eye },
  { name: 'Heart', icon: Heart },
  { name: 'Target', icon: Target },
  { name: 'Wand2', icon: Wand2 },
  { name: 'Fish', icon: Fish },
  { name: 'Flower', icon: Flower },
  { name: 'TreePine', icon: TreePine },
  { name: 'Cloud', icon: Cloud },
];

interface WorldEditorFormProps {
  initialWorld: WorldDef | null;
  onSave: (world: WorldDef) => void;
  onCancel: () => void;
  apiConfig: any;
  settings: any;
}

type FormState = {
  name: string; description: string; icon: string; coverColor: string; tags: string; difficulty: string;
  overview: string; timePeriod: string; location: string; atmosphere: string;
  powerSystem: string; socialStructure: string; specialRules: string;
  currencyName: string; currencySymbol: string; currencyDesc: string; priceLevel: string;
  calendar: string; startTime: string; timeSpeed: string;
  factions: Array<{ name: string; description: string; alignment: string }>;
  presetNPCs: Array<{ name: string; role: string; description: string; personality: string }>;
  highlights: string;
  // 地理区域（lore entryType）
  locations: Array<{ name: string; description: string }>;
  // 文化风俗（culture entryType）
  culture: string;
  // 模块化系统（v2.1）
  modules: WorldDef['modules'];
};

const defaultForm: FormState = {
  name: '', description: '', icon: '', coverColor: '#3b82f6', tags: '', difficulty: 'medium',
  overview: '', timePeriod: '', location: '', atmosphere: '',
  powerSystem: '', socialStructure: '', specialRules: '',
  currencyName: '', currencySymbol: '', currencyDesc: '', priceLevel: '',
  calendar: '', startTime: '', timeSpeed: '',
  factions: [], presetNPCs: [], highlights: '',
  locations: [], culture: '',
  modules: undefined,
};

/** 从 worldBookEntries 中按 entryType 查找条目的 meta */
function findMeta(entries: WorldBookEntryDef[] | undefined, type: string) {
  return entries?.find(e => e.entryType === type)?.meta;
}

function worldToForm(w: WorldDef): FormState {
  const entries = w.worldBookEntries;
  const settingMeta = findMeta(entries, 'setting');
  const rulesMeta = findMeta(entries, 'rules');
  const economyMeta = findMeta(entries, 'economy');
  // 合并所有 factions/npcs 条目（管线可能生成多个条目）
  const allFactions = (entries?.filter(e => e.entryType === 'factions') ?? []).flatMap(e => (e.meta as any)?.factions ?? []);
  const allNPCs = (entries?.filter(e => e.entryType === 'npcs') ?? []).flatMap(e => (e.meta as any)?.npcs ?? []);
  const highlightsMeta = findMeta(entries, 'highlights');
  // 地理区域（lore 条目）
  const loreEntries = entries?.filter(e => e.entryType === 'lore') ?? [];
  // 文化风俗（culture 条目）
  const cultureEntry = entries?.find(e => e.entryType === 'culture');

  return {
    name: w.name || '', description: w.description || '',
    icon: w.icon || '', coverColor: w.coverColor || '#3b82f6',
    tags: w.tags?.join(', ') || '', difficulty: w.difficulty || 'medium',
    overview: entries?.find(e => e.entryType === 'setting')?.content || '',
    timePeriod: settingMeta?.timePeriod || '',
    location: settingMeta?.location || '',
    atmosphere: settingMeta?.atmosphere || '',
    powerSystem: rulesMeta?.powerSystem || '',
    socialStructure: rulesMeta?.socialStructure || '',
    specialRules: rulesMeta?.specialRules?.join('\n') || '',
    currencyName: economyMeta?.currency?.name || '',
    currencySymbol: economyMeta?.currency?.symbol || '',
    currencyDesc: economyMeta?.currency?.description || '',
    priceLevel: economyMeta?.priceLevel || '',
    calendar: economyMeta?.calendar || '',
    startTime: economyMeta?.startTime || '',
    timeSpeed: economyMeta?.timeSpeed || '',
    factions: allFactions.map((f: any) => ({ name: f.name || '', description: f.description || '', alignment: f.alignment || '中立' })),
    presetNPCs: allNPCs.map((n: any) => ({ name: n.name || '', role: n.role || '', description: n.description || '', personality: n.personality || '' })),
    highlights: highlightsMeta?.highlights?.join(', ') || '',
    locations: loreEntries.map(e => ({ name: e.comment || '', description: e.content || '' })),
    culture: cultureEntry?.content || '',
    modules: w.modules ? denormalizeModules(w.modules) : w.modules,
  };
}

export default function WorldEditorForm({
  initialWorld, onSave, onCancel, apiConfig, settings: uiSettings,
}: WorldEditorFormProps) {
  const t = useConfigStore(s => s.t);
  const [form, setForm] = useState<FormState>(() => initialWorld ? worldToForm(initialWorld) : defaultForm);

  useEffect(() => {
    setForm(initialWorld ? worldToForm(initialWorld) : defaultForm);
  }, [initialWorld]);

  const [aiGenName, setAiGenName] = useState('');
  const [survivalGenDesc, setSurvivalGenDesc] = useState('');
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);
  const [isGeneratingTalent, setIsGeneratingTalent] = useState(false);
  const [generatingModule, setGeneratingModule] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState('');
  /** 细化后的世界书条目（管线生成时写入，formToWorldDef 优先使用） */
  const [refinedEntries, setRefinedEntries] = useState<WorldBookEntryDef[]>([]);
  const [genError, setGenError] = useState('');
  const [selectedModules, setSelectedModules] = useState<Set<string>>(() => {
    // 如果是编辑已有世界，从 modules 中恢复已选模块
    if (initialWorld?.modules) {
      return new Set(initialWorld.modules.filter(m => m.enabled).map(m => m.moduleId));
    }
    // 默认选中数值属性（必选）
    return getDefaultSelectedModules();
  });
  const aiAbortRef = useRef<AbortController | null>(null);

  // 引导式选择流程状态
  const [showGuidedChoice, setShowGuidedChoice] = useState(false);

  const DEFAULT_MODULE_FACTORIES: Record<string, () => unknown> = {
    stat: createDefaultStatModule,
    progression: createDefaultProgressionModule,
    survival: createDefaultSurvivalModule,
    business: createDefaultBusinessModule,
    dice: createDefaultDiceModule,
    talent: createDefaultTalentModule,
  };
  const MODULE_NAME_MAP: Record<string, string> = {
    stat: '数值属性', progression: '成长体系', survival: '生存资源', business: '经营资产', dice: '骰子检定', talent: '天赋体系',
  };

  // 模块互斥规则：生存资源/经营资产 与 数值属性/成长体系 互斥
  const MUTEX: Record<string, string[]> = {
    survival: ['stat', 'progression', 'talent', 'business'],
    stat: ['survival', 'business'],
    progression: ['survival', 'business'],
    talent: ['survival'],
    business: ['stat', 'progression', 'survival'],
  };

  // 计算因互斥而被禁用的模块集合
  const disabledByConflict = new Set<string>();
  for (const id of selectedModules) {
    for (const conflict of (MUTEX[id] || [])) {
      if (!selectedModules.has(conflict)) {
        disabledByConflict.add(conflict);
      }
    }
  }

  const toggleModule = (moduleId: string) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      const adding = !next.has(moduleId);

      if (adding) {
        next.add(moduleId);
        // 互斥：移除冲突模块
        for (const conflict of (MUTEX[moduleId] || [])) {
          next.delete(conflict);
        }
      } else {
        next.delete(moduleId);
      }

      // 同步 form.modules
      setForm(f => {
        let modules = f.modules ? [...f.modules] : [];
        if (adding) {
          // 移除冲突模块
          for (const conflict of (MUTEX[moduleId] || [])) {
            modules = modules.filter(m => m.moduleId !== conflict);
          }
          // 添加：如果不存在则创建默认数据
          if (!modules.find(m => m.moduleId === moduleId)) {
            const data = DEFAULT_MODULE_FACTORIES[moduleId]?.();
            modules.push({ moduleId, name: MODULE_NAME_MAP[moduleId] || moduleId, description: '', enabled: true, ...(data ? { data: data as Record<string, unknown> } : {}) });
          } else {
            // 已存在但被禁用，重新启用
            modules = modules.map(m => m.moduleId === moduleId ? { ...m, enabled: true } : m);
          }
        } else {
          // 移除
          modules = modules.filter(m => m.moduleId !== moduleId);
        }
        return { ...f, modules };
      });
      return next;
    });
  };

  const update = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  /** 更新 modules[idx].data */
  const updateModuleData = (idx: number, data: Record<string, unknown>) => {
    setForm(f => ({
      ...f,
      modules: f.modules?.map((mod, i) => i === idx ? { ...mod, data } : mod),
    }));
  };

  const addFaction = () => setForm(f => ({ ...f, factions: [...f.factions, { name: '', description: '', alignment: '中立' }] }));
  const removeFaction = (i: number) => setForm(f => ({ ...f, factions: f.factions.filter((_, idx) => idx !== i) }));
  const updateFaction = (i: number, patch: Partial<FormState['factions'][0]>) =>
    setForm(f => ({ ...f, factions: f.factions.map((item, idx) => idx === i ? { ...item, ...patch } : item) }));
  const addNPC = () => setForm(f => ({ ...f, presetNPCs: [...f.presetNPCs, { name: '', role: '', description: '', personality: '' }] }));
  const removeNPC = (i: number) => setForm(f => ({ ...f, presetNPCs: f.presetNPCs.filter((_, idx) => idx !== i) }));
  const updateNPC = (i: number, patch: Partial<FormState['presetNPCs'][0]>) =>
    setForm(f => ({ ...f, presetNPCs: f.presetNPCs.map((item, idx) => idx === i ? { ...item, ...patch } : item) }));
  const addLocation = () => setForm(f => ({ ...f, locations: [...f.locations, { name: '', description: '' }] }));
  const removeLocation = (i: number) => setForm(f => ({ ...f, locations: f.locations.filter((_, idx) => idx !== i) }));
  const updateLocation = (i: number, patch: Partial<FormState['locations'][0]>) =>
    setForm(f => ({ ...f, locations: f.locations.map((item, idx) => idx === i ? { ...item, ...patch } : item) }));

  const isEditing = !!initialWorld;
  const [editorMode, setEditorMode] = useState<'manual' | 'ai'>(isEditing ? 'manual' : 'ai');

  const handleAIGenerate = async () => {
    if (!aiGenName.trim()) { setGenError('请输入世界描述'); return; }
    if (!apiConfig) { setGenError('请先在设置中配置API'); return; }
    setGenError(''); setIsGeneratingWorld(true);
    const ctrl = new AbortController(); aiAbortRef.current = ctrl;

    try {
      // 打开引导式选择覆盖层（内部会调用 AI 生成选项）
      setShowGuidedChoice(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const errMsg = err instanceof Error ? err.message : String(err);
      setGenError(`生成失败: ${errMsg}`);
    } finally { setIsGeneratingWorld(false); aiAbortRef.current = null; }
  };

  // ── 引导式选择流程完成回调 ──
  const handleGuidedComplete = (worldDef: WorldDef) => {
    // 从结果填充表单
    const entries = worldDef.worldBookEntries || [];
    const settingEntry = entries.find(e => e.entryType === 'setting');
    const rulesEntry = entries.find(e => e.entryType === 'rules');
    const economyEntry = entries.find(e => e.entryType === 'economy');
    const highlightsEntry = entries.find(e => e.entryType === 'highlights');
    const loreEntries = entries.filter(e => e.entryType === 'lore');
    const cultureEntry = entries.find(e => e.entryType === 'culture');
    const factionEntries = entries.filter(e => e.entryType === 'factions');
    const allFactions = factionEntries.flatMap(e => e.meta?.factions ?? []);
    const npcEntries = entries.filter(e => e.entryType === 'npcs');
    const allNPCs = npcEntries.flatMap(e => e.meta?.npcs ?? []);

    update({
      name: worldDef.name || '',
      description: worldDef.description || '',
      icon: worldDef.icon || '',
      tags: worldDef.tags?.join(', ') || '',
      overview: settingEntry?.content || '',
      timePeriod: settingEntry?.meta?.timePeriod || '',
      location: settingEntry?.meta?.location || '',
      atmosphere: settingEntry?.meta?.atmosphere || '',
      powerSystem: rulesEntry?.meta?.powerSystem || '',
      socialStructure: rulesEntry?.meta?.socialStructure || '',
      specialRules: rulesEntry?.meta?.specialRules?.join('\n') || '',
      currencyName: economyEntry?.meta?.currency?.name || '',
      currencySymbol: economyEntry?.meta?.currency?.symbol || '',
      currencyDesc: economyEntry?.meta?.currency?.description || '',
      priceLevel: economyEntry?.meta?.priceLevel || '',
      factions: allFactions.map(f => ({
        name: f.name || '', description: f.description || '',
        alignment: f.alignment || '中立',
      })),
      presetNPCs: allNPCs.map(n => ({
        name: n.name || '', role: n.role || '',
        description: n.description || '', personality: n.personality || '',
      })),
      highlights: highlightsEntry?.meta?.highlights?.join(', ') || '',
      locations: loreEntries.map(e => ({ name: e.comment || '', description: (e.content || '').replace(/^【[^】]*】\n?/, '') })),
      culture: cultureEntry?.content || '',
      modules: worldDef.modules ? denormalizeModules(worldDef.modules) : worldDef.modules,
    });

    // 存储条目，formToWorldDef 会优先使用
    setRefinedEntries(entries);
    setShowGuidedChoice(false);
    setEditorMode('manual');
  };

  // 天赋 AI 按需生成（指定大类）
  const handleTalentAiGenerate = async (categoryIndex: number, count: number) => {
    if (!apiConfig) return;
    const cat = talentData?.categories?.[categoryIndex];
    if (!cat) return;
    setIsGeneratingTalent(true);
    try {
      const prompt = `为以下世界的"${cat.name}"天赋大类生成${count}个天赋：
世界描述：${form.overview || aiGenName || '通用世界'}
大类：${cat.name}（${cat.description || '无描述'}）
品质分5档：普通(40%)、精良(25%)、稀有(20%)、史诗(10%)、传说(5%)。
只输出JSON数组：[{"id":"英文","name":"天赋名","description":"描述","rarity":"品质","effects":["效果"]}]`;

      const result = await requestStreamWithRetry(apiConfig, [
        { role: 'user', content: prompt },
      ], { signal: new AbortController().signal, onDelta: () => {} });
      const jsonMatch = result.text.match(/```(?:json)?\s*([\s\S]*?)```/) || result.text.match(/(\[[\s\S]*\])/);
      if (jsonMatch) {
        const fixed = jsonMatch[1].trim().replace(/[""]/g, '"').replace(/['']/g, "'");
        const talents = JSON.parse(fixed);
        if (Array.isArray(talents)) {
          const next = JSON.parse(JSON.stringify(talentData));
          for (const t of talents) {
            if (!next.categories[categoryIndex].talents.find((et: any) => et.id === t.id)) {
              next.categories[categoryIndex].talents.push(t);
            }
          }
          updateModuleDataByModuleId('talent', next);
        }
      }
    } catch (err: unknown) {
      console.warn('[天赋AI生成] 失败:', err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingTalent(false);
    }
  };

  // 根据 moduleId 查找并更新模块数据
  const updateModuleDataByModuleId = (moduleId: string, data: Record<string, unknown>) => {
    setForm(f => {
      const modules = f.modules ? [...f.modules] : [];
      const idx = modules.findIndex(m => m.moduleId === moduleId);
      if (idx >= 0) {
        modules[idx] = { ...modules[idx], data };
      }
      return { ...f, modules };
    });
  };

  // 单模块 AI 补全（手动编辑模式下，对缺失数据的模块单独生成）
  const handleModuleAiFill = async (moduleId: string) => {
    if (!apiConfig) return;
    setGeneratingModule(moduleId);
    try {
      const desc = form.overview || aiGenName || '通用世界';
      let prompt = '';
      if (moduleId === 'stat') {
        prompt = buildStatGenPrompt({ theme: desc, attrAName: '生命', attrBName: '能量', dim1Name: '攻击', dim2Name: '防御', dim3Name: '速度', dim4Name: '智力', dim5Name: '魅力', dim6Name: '幸运' });
      } else if (moduleId === 'progression') {
        prompt = buildProgressionGenPrompt({ theme: desc, tone: '中等', era: '现代' });
      } else if (moduleId === 'survival') {
        prompt = buildSurvivalGenPrompt({ theme: desc, tone: '中等' });
      } else if (moduleId === 'business') {
        prompt = buildBusinessGenPrompt({ theme: desc, tone: '中等' });
      } else {
        return;
      }
      const result = await requestStreamWithRetry(apiConfig, [
        { role: 'user', content: prompt },
      ], { signal: new AbortController().signal, onDelta: () => {} });
      const jsonMatch = result.text.match(/```(?:json)?\s*([\s\S]*?)```/) || result.text.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        const fixed = jsonMatch[1].trim().replace(/[""]/g, '"').replace(/['']/g, "'");
        const data = JSON.parse(fixed);
        updateModuleDataByModuleId(moduleId, data);
      }
    } catch (err: unknown) {
      console.warn(`[模块AI补全] ${moduleId} 失败:`, err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingModule(null);
    }
  };

  // 获取天赋模块数据
  const talentMod = form.modules?.find(m => m.moduleId === 'talent');
  const talentData = (talentMod?.data || talentMod?.moduleConfig) as TalentModuleSchema | undefined;

  // 将当前表单转换为 WorldDef 对象（供导出和保存共用）
  // 叙事内容全部存为 worldBookEntries
  // 如果有管线生成的细化条目，优先使用
  const formToWorldDef = (): WorldDef => {
    // 如果有管线生成的细化条目，直接使用
    if (refinedEntries.length > 0) {
      return {
        id: initialWorld?.id || `custom_${Date.now()}`,
        name: form.name.trim(), description: form.description.trim(), entryId: null,
        icon: form.icon || undefined, coverColor: form.coverColor || undefined,
        tags: form.tags ? form.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined,
        difficulty: (form.difficulty as any) || undefined,
        worldBookEntries: refinedEntries,
        modules: normalizeModules(form.modules || []),
        author: initialWorld?.author, createdAt: initialWorld?.createdAt || new Date().toISOString(),
      };
    }

    // 手动编辑模式：从表单字段构建条目
    const entries: WorldBookEntryDef[] = [];
    let uid = 1;

    // setting 条目
    if (form.overview) {
      entries.push({
        uid: uid++, key: [], constant: true, comment: '世界设定', content: form.overview,
        order: 1, position: 'before_char', entryType: 'setting',
        meta: {
          location: form.location || undefined,
          timePeriod: form.timePeriod || undefined,
          atmosphere: form.atmosphere || undefined,
        },
      });
    }

    // rules 条目
    if (form.powerSystem || form.socialStructure || form.specialRules) {
      const rulesContent = [
        form.powerSystem ? `力量体系：${form.powerSystem}` : '',
        form.socialStructure ? `社会结构：${form.socialStructure}` : '',
        form.specialRules ? `特殊规则：${form.specialRules}` : '',
      ].filter(Boolean).join('\n');
      entries.push({
        uid: uid++, key: [], constant: true, comment: '世界规则', content: rulesContent,
        order: 2, position: 'before_char', entryType: 'rules',
        meta: {
          powerSystem: form.powerSystem || undefined,
          socialStructure: form.socialStructure || undefined,
          specialRules: form.specialRules ? form.specialRules.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
        },
      });
    }

    // factions 条目
    const validFactions = form.factions.filter(f => f.name.trim());
    if (validFactions.length > 0) {
      const factionsContent = validFactions.map(f =>
        `【${f.name.trim()}】${f.alignment ? `[${f.alignment}]` : ''} ${f.description.trim()}`
      ).join('\n');
      entries.push({
        uid: uid++, key: [], constant: true, comment: '势力', content: factionsContent,
        order: 3, position: 'before_char', entryType: 'factions',
        meta: {
          factions: validFactions.map(f => ({
            name: f.name.trim(), description: f.description.trim(),
            alignment: f.alignment || undefined,
          })),
        },
      });
    }

    // npcs 条目
    const validNPCs = form.presetNPCs.filter(n => n.name.trim());
    if (validNPCs.length > 0) {
      const npcsContent = validNPCs.map(n =>
        `【${n.name.trim()}】${n.role.trim()} — ${n.description.trim()}${n.personality.trim() ? `（性格：${n.personality.trim()}）` : ''}`
      ).join('\n');
      entries.push({
        uid: uid++, key: [], constant: true, comment: '关键人物', content: npcsContent,
        order: 4, position: 'before_char', entryType: 'npcs',
        meta: {
          npcs: validNPCs.map(n => ({
            name: n.name.trim(), role: n.role.trim(),
            description: n.description.trim(),
            personality: n.personality.trim() || undefined,
          })),
        },
      });
    }

    // economy + timeSystem 条目
    if (form.currencyName || form.calendar || form.startTime) {
      const economyContent = [
        form.currencyName ? `货币：${form.currencySymbol || ''}${form.currencyName}${form.currencyDesc ? `（${form.currencyDesc}）` : ''}` : '',
        form.priceLevel ? `物价水平：${form.priceLevel}` : '',
        form.calendar ? `纪年：${form.calendar}` : '',
        form.startTime ? `开始时间：${form.startTime}` : '',
        form.timeSpeed ? `时间流速：${form.timeSpeed}` : '',
      ].filter(Boolean).join('\n');
      entries.push({
        uid: uid++, key: ['花钱', '消费', '买单', '价格', '买东西', '付钱', '货币', '工资', '收入'],
        constant: false, comment: '经济 & 时间', content: economyContent,
        order: 5, position: 'before_char', entryType: 'economy',
        meta: {
          currency: form.currencyName ? {
            name: form.currencyName,
            symbol: form.currencySymbol || undefined,
            description: form.currencyDesc || undefined,
          } : undefined,
          priceLevel: form.priceLevel || undefined,
          calendar: form.calendar || undefined,
          startTime: form.startTime || undefined,
          timeSpeed: form.timeSpeed || undefined,
        },
      });
    }

    // highlights 条目
    const highlightList = form.highlights ? form.highlights.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
    if (highlightList.length > 0) {
      entries.push({
        uid: uid++, key: [], constant: true, comment: '核心特色', content: highlightList.join('、'),
        order: 6, position: 'before_char', entryType: 'highlights',
        meta: { highlights: highlightList },
      });
    }

    // lore 条目（地理区域）
    const validLocations = form.locations.filter(l => l.name.trim());
    for (const loc of validLocations) {
      entries.push({
        uid: uid++, key: [loc.name.trim()], constant: false, comment: loc.name.trim(),
        content: loc.description.trim(), order: 7, position: 'before_char', entryType: 'lore',
      });
    }

    // culture 条目（文化风俗）
    if (form.culture.trim()) {
      entries.push({
        uid: uid++, key: ['文化', '风俗', '传统'], constant: false, comment: '文化风俗',
        content: form.culture.trim(), order: 8, position: 'before_char', entryType: 'culture',
      });
    }

    // 保留已有的非叙事 worldBookEntries（如模块规则条目）
    const existingEntries = initialWorld?.worldBookEntries?.filter(e => e.entryType === 'module_rule' || !e.entryType) ?? [];

    return {
      id: initialWorld?.id || `custom_${Date.now()}`,
      name: form.name.trim(), description: form.description.trim(), entryId: null,
      icon: form.icon || undefined, coverColor: form.coverColor || undefined,
      tags: form.tags ? form.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined,
      difficulty: (form.difficulty as any) || undefined,
      worldBookEntries: [...entries, ...existingEntries],
      modules: normalizeModules(form.modules || []),
      author: initialWorld?.author, createdAt: initialWorld?.createdAt || new Date().toISOString(),
    };
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const world = formToWorldDef();

    // 手动编辑模式：如果有模块但没有模块规则条目，补充生成
    if (refinedEntries.length === 0 && world.modules?.some(m => m.enabled)) {
      try {
        const enabledModules = world.modules.filter(m => m.enabled).map(m => m.moduleId);
        const worldDesc = form.overview || form.name;
        const buildCtx = createBuildContext(worldDesc, enabledModules);

        // 把模块数据注入 buildCtx 供 generateWorldBookEntries 使用
        for (const mod of world.modules.filter(m => m.enabled)) {
          const mc = mod.moduleConfig as any;
          if (!mc) continue;
          if (mod.moduleId === 'stat') buildCtx.statData = mc;
          if (mod.moduleId === 'progression') buildCtx.progressionData = mc;
          if (mod.moduleId === 'survival') buildCtx.survivalData = mc;
          if (mod.moduleId === 'business') buildCtx.businessData = mc;
          if (mod.moduleId === 'talent') buildCtx.talentData = mc;
        }

        await executeBuildPipeline(buildCtx, {
          callAI: async () => '{}',  // 不需要 AI 调用，只用阶段3生成条目
          onProgress: () => {},
        });

        if (buildCtx.worldBookEntries?.length) {
          // 合并模块条目，用负数 uid 避免冲突
          const moduleEntries = buildCtx.worldBookEntries.map((e, i) => ({
            ...e,
            uid: -5000 - i,
            entryType: 'module_rule' as const,
          }));
          world.worldBookEntries = [...(world.worldBookEntries ?? []), ...moduleEntries];
        }
      } catch (err) {
        console.warn('[handleSave] 生成模块世界书条目失败:', err);
      }
    }

    onSave(world);
  };

  // 导出世界为 JSON 文件
  const handleExport = () => {
    const world = formToWorldDef();
    const json = JSON.stringify(world, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${world.name || 'world'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useBodyScrollLock(true);

  return (
    <>
    <div className="world-editor-overlay">
      <div className="world-editor-panel" onClick={e => e.stopPropagation()}>
        <div className="world-editor-header">
          <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{initialWorld ? '编辑世界' : '新建世界'}</h3>
          <button onClick={onCancel} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>

        <div className="world-editor-body">
          {!isEditing && (
            <div className="mode-toggle">
              <button className={editorMode === 'ai' ? 'active' : ''} onClick={() => setEditorMode('ai')}><Cpu size={15} style={{ marginRight: 4, flexShrink: 0 }} /> AI 生成</button>
              <button className={editorMode === 'manual' ? 'active' : ''} onClick={() => setEditorMode('manual')}><Pencil size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 手动编辑</button>
            </div>
          )}

          {editorMode === 'ai' && !isEditing && (
            <div className="world-form-section" style={{ marginBottom: 20 }}>
              <h4><Cpu size={15} style={{ marginRight: 4, flexShrink: 0 }} /> AI 一键生成</h4>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 10 }}>输入世界描述，AI 将自动生成创意名称和完整的世界设定，你可以在"手动编辑"中修改细节</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="text" value={aiGenName} onChange={e => setAiGenName(e.target.value)} placeholder="例如：一个被僵尸占领的末日废土世界..." style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)' }} onKeyDown={e => e.key === 'Enter' && !isGeneratingWorld && handleAIGenerate()} />
                <button className="btn-primary" onClick={handleAIGenerate} disabled={isGeneratingWorld} style={{ padding: '8px 20px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{isGeneratingWorld ? <><Loader size={14} className="animate-spin" /> 生成中...</> : <><Sparkles size={14} style={{ flexShrink: 0 }} /> 生成</>}</button>
                {isGeneratingWorld && <button className="btn-ghost" onClick={() => aiAbortRef.current?.abort()} style={{ padding: '8px 12px', color: '#ef4444' }}>{t('common.cancel')}</button>}
              </div>
              {/* 模块选择 */}
              <ModuleSelector
                selected={selectedModules}
                onToggle={toggleModule}
                disabledByConflict={disabledByConflict}
              />
              {/* 生存资源：额外描述输入 */}
              {selectedModules.has('survival') && (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    value={survivalGenDesc}
                    onChange={e => setSurvivalGenDesc(e.target.value)}
                    placeholder="描述你想要的生存资源系统（如：荒岛求生，需要淡水/食物/木材/药草，初期紧张后期富足...）"
                    style={{
                      width: '100%', background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      padding: '8px 10px', color: 'var(--text-primary)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  />
                </div>
              )}
              {genError && <div style={{ color: '#ef4444', fontSize: 'var(--font-size-sm)', marginTop: 8 }}>{genError}</div>}
              {isGeneratingWorld && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                    <div className="ai-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                    <span style={{ fontSize: 'var(--font-size-base)' }}>AI 正在构建世界...</span>
                  </div>
                  {pipelineStage && (
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', paddingLeft: 28, display: 'block', marginTop: 4 }}>
                      {pipelineStage}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {editorMode === 'manual' && (
            <>
              <div className="world-form-section"><h4><ClipboardList size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 基本信息</h4>
                <div className="world-form-group"><label>世界名称 *</label><input type="text" value={form.name} onChange={e => update({ name: e.target.value })} placeholder="给你的世界起个名字..." /></div>
                <div className="world-form-group"><label>简介</label><textarea value={form.description} onChange={e => update({ description: e.target.value })} placeholder="一句话描述这个世界（展示在卡片上）" rows={2} /></div>
                <div className="world-form-row">
                  <div className="world-form-group">
                    <label>图标</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, maxHeight: 120, overflowY: 'auto' }}>
                      {WORLD_ICONS.map(({ name, icon: Icon }) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => update({ icon: name })}
                          style={{
                            width: 32, height: 32,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: form.icon === name ? '2px solid var(--accent)' : '1px solid var(--border)',
                            borderRadius: 4,
                            background: form.icon === name ? 'var(--accent-dim)' : 'transparent',
                            color: form.icon === name ? 'var(--accent)' : 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                          title={name}
                        >
                          <Icon size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="world-form-group"><label>主题色</label><input type="color" value={form.coverColor} onChange={e => update({ coverColor: e.target.value })} /></div>
                  <div className="world-form-group"><label>难度</label><select value={form.difficulty} onChange={e => update({ difficulty: e.target.value })} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px', color: 'var(--text-primary)' }}><option value="easy">&#9679; 简单</option><option value="medium">&#9679; 中等</option><option value="hard">&#9679; 困难</option></select></div>
                </div>
                <div className="world-form-group"><label>标签 (逗号分隔)</label><input type="text" value={form.tags} onChange={e => update({ tags: e.target.value })} placeholder="科幻, 冒险, 开放世界" /></div>
              </div>

              <div className="world-form-section"><h4><ScrollText size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 世界设定</h4>
                <div className="world-form-group"><label>世界观概述</label><textarea value={form.overview} onChange={e => update({ overview: e.target.value })} placeholder="2-3段沉浸式世界观描述..." rows={5} /></div>
                <div className="world-form-row three">
                  <div className="world-form-group"><label>时间背景</label><input type="text" value={form.timePeriod} onChange={e => update({ timePeriod: e.target.value })} placeholder="1990年春" /></div>
                  <div className="world-form-group"><label>地理位置</label><input type="text" value={form.location} onChange={e => update({ location: e.target.value })} placeholder="东北工业城市" /></div>
                  <div className="world-form-group"><label>氛围</label><input type="text" value={form.atmosphere} onChange={e => update({ atmosphere: e.target.value })} placeholder="温暖怀旧" /></div>
                </div>
              </div>

              <div className="world-form-section"><h4><Map size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 地理区域</h4>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
                  定义世界中的关键区域/地点（对应世界书的 lore 条目）
                </p>
                <div className="world-dynamic-list">
                  {form.locations.map((loc, i) => (
                    <div key={i} className="world-dynamic-item">
                      <button className="remove-btn" onClick={() => removeLocation(i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                      <div className="world-form-row" style={{ marginBottom: 0 }}>
                        <div className="world-form-group" style={{ marginBottom: 0 }}><label>区域名称</label><input type="text" value={loc.name} onChange={e => updateLocation(i, { name: e.target.value })} placeholder="东域·天剑城" /></div>
                        <div className="world-form-group" style={{ marginBottom: 0 }}><label>描述</label><input type="text" value={loc.description} onChange={e => updateLocation(i, { description: e.target.value })} placeholder="灵气充沛的修仙重地..." /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-ghost" onClick={addLocation} style={{ marginTop: 8, fontSize: 'var(--font-size-base)' }}>+ 添加区域</button>
              </div>

              <div className="world-form-section"><h4><BookMarked size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 文化风俗</h4>
                <div className="world-form-group"><label>文化描述</label><textarea value={form.culture} onChange={e => update({ culture: e.target.value })} placeholder="描述这个世界的信仰、习俗、禁忌、语言特色..." rows={3} /></div>
              </div>

              <div className="world-form-section"><h4><Swords size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 世界规则</h4>
                <div className="world-form-row">
                  <div className="world-form-group"><label>力量体系</label><textarea value={form.powerSystem} onChange={e => update({ powerSystem: e.target.value })} placeholder="魔法/科技/武道..." rows={2} /></div>
                  <div className="world-form-group"><label>社会结构</label><textarea value={form.socialStructure} onChange={e => update({ socialStructure: e.target.value })} placeholder="封建王国/星际联邦..." rows={2} /></div>
                </div>
                <div className="world-form-group"><label>特殊规则 (每行一条)</label><textarea value={form.specialRules} onChange={e => update({ specialRules: e.target.value })} placeholder="角色可能死亡&#10;无魔法系统" rows={2} /></div>
              </div>

              <div className="world-form-section"><h4><DollarSign size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 经济 & 时间</h4>
                <div className="world-form-row three">
                  <div className="world-form-group"><label>货币名称</label><input type="text" value={form.currencyName} onChange={e => update({ currencyName: e.target.value })} placeholder="人民币" /></div>
                  <div className="world-form-group"><label>货币符号</label><input type="text" value={form.currencySymbol} onChange={e => update({ currencySymbol: e.target.value })} placeholder="¥" /></div>
                  <div className="world-form-group"><label>物价水平</label><input type="text" value={form.priceLevel} onChange={e => update({ priceLevel: e.target.value })} placeholder="1990年物价" /></div>
                </div>
                <div className="world-form-group"><label>货币说明</label><input type="text" value={form.currencyDesc} onChange={e => update({ currencyDesc: e.target.value })} placeholder="简要说明" /></div>
                <div className="world-form-row three">
                  <div className="world-form-group"><label>纪年方式</label><input type="text" value={form.calendar} onChange={e => update({ calendar: e.target.value })} placeholder="公历" /></div>
                  <div className="world-form-group"><label>开始时间</label><input type="text" value={form.startTime} onChange={e => update({ startTime: e.target.value })} placeholder="1990年3月15日" /></div>
                  <div className="world-form-group"><label>时间流速</label><input type="text" value={form.timeSpeed} onChange={e => update({ timeSpeed: e.target.value })} placeholder="与现实同步" /></div>
                </div>
              </div>

              <div className="world-form-section"><h4><Flag size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 势力</h4>
                <div className="world-dynamic-list">
                  {form.factions.map((f, i) => (
                    <div key={i} className="world-dynamic-item">
                      <button className="remove-btn" onClick={() => removeFaction(i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                      <div className="world-form-row three" style={{ marginBottom: 0 }}>
                        <div className="world-form-group" style={{ marginBottom: 0 }}><label>名称</label><input type="text" value={f.name} onChange={e => updateFaction(i, { name: e.target.value })} placeholder="势力名称" /></div>
                        <div className="world-form-group" style={{ marginBottom: 0 }}><label>立场</label><select value={f.alignment} onChange={e => updateFaction(i, { alignment: e.target.value })} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px', color: 'var(--text-primary)' }}><option value="友善">友善</option><option value="中立">中立</option><option value="敌对">敌对</option></select></div>
                        <div className="world-form-group" style={{ marginBottom: 0 }}><label>描述</label><input type="text" value={f.description} onChange={e => updateFaction(i, { description: e.target.value })} placeholder="简要描述" /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-ghost" onClick={addFaction} style={{ marginTop: 8, fontSize: 'var(--font-size-base)' }}>+ 添加势力</button>
              </div>

              <div className="world-form-section"><h4><User size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 预设NPC</h4>
                <div className="world-dynamic-list">
                  {form.presetNPCs.map((n, i) => (
                    <div key={i} className="world-dynamic-item">
                      <button className="remove-btn" onClick={() => removeNPC(i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                      <div className="world-form-row" style={{ marginBottom: 0 }}>
                        <div className="world-form-group" style={{ marginBottom: 0 }}><label>姓名</label><input type="text" value={n.name} onChange={e => updateNPC(i, { name: e.target.value })} placeholder="NPC姓名" /></div>
                        <div className="world-form-group" style={{ marginBottom: 0 }}><label>角色定位</label><input type="text" value={n.role} onChange={e => updateNPC(i, { role: e.target.value })} placeholder="邻居大婶" /></div>
                      </div>
                      <div className="world-form-row" style={{ marginBottom: 0, marginTop: 6 }}>
                        <div className="world-form-group" style={{ marginBottom: 0 }}><label>简介</label><input type="text" value={n.description} onChange={e => updateNPC(i, { description: e.target.value })} placeholder="1-2句简介" /></div>
                        <div className="world-form-group" style={{ marginBottom: 0 }}><label>性格</label><input type="text" value={n.personality} onChange={e => updateNPC(i, { personality: e.target.value })} placeholder="热心肠、爱八卦" /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-ghost" onClick={addNPC} style={{ marginTop: 8, fontSize: 'var(--font-size-base)' }}>+ 添加NPC</button>
              </div>

              <div className="world-form-section"><h4><Sparkles size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 核心特色</h4>
                <div className="world-form-group"><label>特色 (逗号分隔)</label><input type="text" value={form.highlights} onChange={e => update({ highlights: e.target.value })} placeholder="日常生活, 温情互动, 怀旧氛围" /></div>
              </div>

              {/* ── 模块选择 ── */}
              <div className="world-form-section">
                <h4><BarChart3 size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 系统模块</h4>
                <ModuleSelector selected={selectedModules} onToggle={toggleModule} disabledByConflict={disabledByConflict} />
              </div>

              {/* ── 模块数据编辑 ── */}
              {form.modules && form.modules.length > 0 && (
                <div className="world-form-section">
                  <h4><BarChart3 size={15} style={{ marginRight: 4, flexShrink: 0 }} /> 模块数据</h4>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 10 }}>
                    编辑各模块的初始数据（AI已生成，可手动调整）
                  </p>
                  {form.modules.map((mod, modIdx) => {
                    if (!mod.enabled) return null;
                    // 优先读 data（旧格式），其次 moduleConfig（新格式）
                    const modData = mod.data || mod.moduleConfig;
                    return (
                      <div key={mod.moduleId} style={{ marginBottom: 16, padding: '10px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 8, color: 'var(--accent)' }}>
                          {mod.name} ({mod.moduleId})
                        </div>
                        {mod.moduleId === 'stat' && modData && (
                          <StatModuleEditor data={modData as any} onChange={(d) => updateModuleData(modIdx, d)} />
                        )}
                        {mod.moduleId === 'progression' && modData && (
                          <ProgressionModuleEditor data={modData as any} onChange={(d) => updateModuleData(modIdx, d)} />
                        )}
                        {mod.moduleId === 'survival' && modData && (
                          <SurvivalModuleEditor data={modData as any} onChange={(d) => updateModuleData(modIdx, d)} />
                        )}
                        {mod.moduleId === 'business' && modData && (
                          <BusinessModuleEditor data={modData as any} onChange={(d) => updateModuleData(modIdx, d)} />
                        )}
                        {mod.moduleId === 'dice' && (
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>骰子检定无需初始数据，运行时自动计算</div>
                        )}
                        {mod.moduleId === 'talent' && (
                          <TalentModuleEditor
                            data={(modData as any) || { categories: [] }}
                            onChange={(d) => updateModuleData(modIdx, d)}
                            onAiGenerate={handleTalentAiGenerate}
                            isGenerating={isGeneratingTalent}
                          />
                        )}
                        {!modData && mod.moduleId !== 'dice' && mod.moduleId !== 'talent' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>暂无数据</span>
                            <button
                              className="btn-ghost"
                              onClick={() => handleModuleAiFill(mod.moduleId)}
                              disabled={generatingModule === mod.moduleId}
                              style={{ fontSize: 'var(--font-size-xs)', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              {generatingModule === mod.moduleId
                                ? <><Loader size={11} className="animate-spin" /> 生成中</>
                                : <><Sparkles size={11} /> AI 补全</>
                              }
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="world-editor-footer">
          <button className="btn-ghost" onClick={handleExport} style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-sm)' }}><Download size={14} style={{ flexShrink: 0 }} /> 导出</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={onCancel} style={{ padding: '8px 20px' }}>{t('common.cancel')}</button>
            <button className="btn-primary" onClick={handleSave} disabled={!form.name.trim()} style={{ padding: '8px 24px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Save size={14} style={{ flexShrink: 0 }} /> {t('worldEditor.saveWorld')}</button>
          </div>
        </div>
      </div>
    </div>

    {/* 引导式选择世界创建覆盖层 */}
    {showGuidedChoice && (
      <GuidedChoiceOverlay
        visible={showGuidedChoice}
        userDesc={aiGenName}
        selectedModules={[...selectedModules]}
        apiConfig={apiConfig}
        onComplete={handleGuidedComplete}
        onClose={() => setShowGuidedChoice(false)}
      />
    )}
    </>
  );
}

// ═══════════════════════════════════════
//  模块数据编辑器组件
// ═══════════════════════════════════════

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '4px 6px', color: 'var(--text-primary)',
  fontSize: 'var(--font-size-xs)', width: '100%',
};
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2, display: 'block',
};

/** 数值属性编辑器 */
function StatModuleEditor({ data, onChange }: { data: StatModuleSchema; onChange: (d: Record<string, unknown>) => void }) {
  const set = (path: string, value: unknown) => {
    const next = JSON.parse(JSON.stringify(data));
    const parts = path.split('.');
    let obj: any = next;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    onChange(next);
  };

  const addSpecial = () => {
    if (data.special.length >= 4) return;
    const next = JSON.parse(JSON.stringify(data));
    next.special.push({ id: `special_${Date.now()}`, name: '新特色属性', value: 50, range: [0, 100], description: '' });
    onChange(next);
  };

  const removeSpecial = (i: number) => {
    const next = JSON.parse(JSON.stringify(data));
    next.special.splice(i, 1);
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div><label style={labelStyle}>生命类名称</label><input style={inputStyle} value={data.attrA.name} onChange={e => set('attrA.name', e.target.value)} /></div>
        <div><label style={labelStyle}>能量类名称</label><input style={inputStyle} value={data.attrB.name} onChange={e => set('attrB.name', e.target.value)} /></div>
      </div>
      {/* 六维属性（选了数值模块就是固定六维，只能改名） */}
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>六维属性</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        {(['dim1', 'dim2', 'dim3', 'dim4', 'dim5', 'dim6'] as const).map(key => {
          const dim = data[key];
          return (
            <div key={key}>
              <label style={labelStyle}>{key}</label>
              <input style={inputStyle} value={dim?.name ?? ''} onChange={e => set(`${key}.name`, e.target.value)} placeholder="属性名" />
            </div>
          );
        })}
      </div>
      {/* 特色属性（0~4个） */}
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>
        特色属性（0~4个，数值型）
        {data.special.length >= 4 && <span style={{ color: '#ef4444', marginLeft: 4 }}>已达上限</span>}
      </div>
      {data.special.map((sp, i) => (
        <div key={sp.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input style={{ ...inputStyle, width: 80 }} value={sp.name} onChange={e => set(`special.${i}.name`, e.target.value)} placeholder="属性名" />
          <input style={{ ...inputStyle, width: 50 }} type="number" value={sp.range[0]} onChange={e => set(`special.${i}.range`, [Number(e.target.value) || 0, sp.range[1]])} placeholder="最小" title="最小值" />
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>~</span>
          <input style={{ ...inputStyle, width: 50 }} type="number" value={sp.range[1]} onChange={e => set(`special.${i}.range`, [sp.range[0], Number(e.target.value) || 0])} placeholder="最大" title="最大值" />
          <input style={{ ...inputStyle, flex: 1 }} value={sp.description} onChange={e => set(`special.${i}.description`, e.target.value)} placeholder="属性描述（如：领悟武学本质的境界）" />
          <button onClick={() => removeSpecial(i)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}>✕</button>
        </div>
      ))}
      {data.special.length < 4 && (
        <button className="btn-ghost" onClick={addSpecial} style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}>+ 添加特色属性</button>
      )}
    </div>
  );
}

/** 成长体系编辑器（段位制/等级制分支） */
function ProgressionModuleEditor({ data, onChange }: { data: ProgressionModuleSchema; onChange: (d: Record<string, unknown>) => void }) {
  const set = (path: string, value: unknown) => {
    const next = JSON.parse(JSON.stringify(data));
    const parts = path.split('.');
    let obj: any = next;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    onChange(next);
  };

  // 切换模式时初始化对应数据
  const switchMode = (mode: string) => {
    const next = JSON.parse(JSON.stringify(data));
    next.mode = mode;
    if (mode === 'tiered' && !next.tiers) {
      next.tiers = [];
    }
    if (mode === 'level' && !next.levelData) {
      next.levelData = {
        maxLevel: 100,
        baseStats: { attrAMax: 100, attrBMax: 100, dim1Max: 100, dim2Max: 100, dim3Max: 100, dim4Max: 100, dim5Max: 100, dim6Max: 100 },
        growthPerLevel: { attrAMax: 10, attrBMax: 10, dim1Max: 8, dim2Max: 8, dim3Max: 8, dim4Max: 8, dim5Max: 8, dim6Max: 8 },
      };
    }
    onChange(next);
  };

  const addTier = () => {
    const next = JSON.parse(JSON.stringify(data));
    if (!next.tiers) next.tiers = [];
    next.tiers.push({
      name: '新段位', description: '', xpRequired: 0,
      statBonuses: { attrAMax: 100, attrBMax: 100, dim1Max: 100, dim2Max: 100, dim3Max: 100, dim4Max: 100, dim5Max: 100, dim6Max: 100 },
    });
    onChange(next);
  };

  const removeTier = (i: number) => {
    const next = JSON.parse(JSON.stringify(data));
    next.tiers.splice(i, 1);
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={labelStyle}>模式</label>
        <select style={{ ...inputStyle, width: 'auto' }} value={data.mode} onChange={e => switchMode(e.target.value)}>
          <option value="tiered">段位制</option>
          <option value="level">等级制</option>
        </select>
      </div>

      {/* ── 段位制 ── */}
      {data.mode === 'tiered' && (
        <>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>段位列表</div>
          {(data.tiers || []).map((tier, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: 16 }}>{i + 1}.</span>
              <input style={{ ...inputStyle, flex: 1 }} value={tier.name} onChange={e => set(`tiers.${i}.name`, e.target.value)} placeholder="段位名" />
              <input style={{ ...inputStyle, flex: 2 }} value={tier.description} onChange={e => set(`tiers.${i}.description`, e.target.value)} placeholder="描述" />
              <button onClick={() => removeTier(i)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}>✕</button>
            </div>
          ))}
          <button className="btn-ghost" onClick={addTier} style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}>+ 添加段位</button>
        </>
      )}

      {/* ── 等级制 ── */}
      {data.mode === 'level' && data.levelData && (() => {
        const ld = data.levelData;
        // 属性名称映射（英文 → 中文）
        const statNameMap: Record<string, string> = {
          attrAMax: '生命上限',
          attrBMax: '能量上限',
          dim1Max: '属性1上限',
          dim2Max: '属性2上限',
          dim3Max: '属性3上限',
          dim4Max: '属性4上限',
          dim5Max: '属性5上限',
          dim6Max: '属性6上限',
        };
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div>
                <label style={labelStyle}>最大等级</label>
                <input style={inputStyle} type="number" value={ld.maxLevel} onChange={e => set('levelData.maxLevel', Math.max(1, Number(e.target.value) || 100))} />
              </div>
              <div>
                <label style={labelStyle}>基础经验</label>
                <input style={inputStyle} type="number" value={data.xpFormula.baseXP} onChange={e => set('xpFormula.baseXP', Math.max(1, Number(e.target.value) || 100))} />
              </div>
              <div>
                <label style={labelStyle}>经验指数</label>
                <input style={inputStyle} type="number" step="0.1" value={data.xpFormula.exponent} onChange={e => set('xpFormula.exponent', Number(e.target.value) || 1.5)} />
              </div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>0级属性天花板</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {(['attrAMax', 'attrBMax', 'dim1Max', 'dim2Max', 'dim3Max', 'dim4Max', 'dim5Max', 'dim6Max'] as const).map(key => (
                <div key={key}>
                  <label style={labelStyle}>{statNameMap[key] || key}</label>
                  <input style={inputStyle} type="number" value={ld.baseStats?.[key] ?? 0} onChange={e => set(`levelData.baseStats.${key}`, Number(e.target.value) || 0)} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>每级属性增长</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {(['attrAMax', 'attrBMax', 'dim1Max', 'dim2Max', 'dim3Max', 'dim4Max', 'dim5Max', 'dim6Max'] as const).map(key => (
                <div key={key}>
                  <label style={labelStyle}>{statNameMap[key] || key}</label>
                  <input style={inputStyle} type="number" value={ld.growthPerLevel?.[key] ?? 0} onChange={e => set(`levelData.growthPerLevel.${key}`, Number(e.target.value) || 0)} />
                </div>
              ))}
            </div>
          </>
        );
      })()}
    </div>
  );
}

/** 生存资源编辑器 */
function SurvivalModuleEditor({ data, onChange }: {
  data: SurvivalModuleSchema; onChange: (d: Record<string, unknown>) => void;
}) {
  const commit = (next: SurvivalModuleSchema) => onChange(next as any);

  const addResource = () => {
    const next = JSON.parse(JSON.stringify(data));
    next.resources.push({ id: `res_${Date.now()}`, name: '新资源', symbol: '📦', amount: 5, max: 10, scarce: false, gatherRate: '', usage: '', description: '' });
    commit(next);
  };

  const removeResource = (i: number) => {
    const next = JSON.parse(JSON.stringify(data));
    next.resources.splice(i, 1);
    commit(next);
  };

  const setResField = (i: number, field: string, value: unknown) => {
    const next = JSON.parse(JSON.stringify(data));
    next.resources[i][field] = value;
    commit(next);
  };

  const setRulesField = (field: string, value: unknown) => {
    const next = JSON.parse(JSON.stringify(data));
    if (!next.rules) next.rules = { cycleName: '一天', consumePerCycle: '', criticalThreshold: 2 };
    next.rules[field] = value;
    commit(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--font-size-xs)' }}>
      {/* 整体描述 */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: 'var(--text-muted)' }}>整体描述</span>
        <input value={data.description || ''} onChange={e => commit({ ...data, description: e.target.value })} placeholder="一句话描述生存资源系统" style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }} />
      </label>

      {/* 生存规则 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>结算周期</span>
          <input value={data.rules?.cycleName || '一天'} onChange={e => setRulesField('cycleName', e.target.value)} style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>危机阈值</span>
          <input type="number" value={data.rules?.criticalThreshold ?? 2} onChange={e => setRulesField('criticalThreshold', Number(e.target.value))} style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }} />
        </label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: 'var(--text-muted)' }}>每周期消耗 <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>(AI参考描述，非固定值)</span></span>
        <input value={data.rules?.consumePerCycle || ''} onChange={e => setRulesField('consumePerCycle', e.target.value)} placeholder="如：每人每天消耗1份口粮+1份水，人数增加时等比增长" style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }} />
      </label>

      {/* 资源列表 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>资源列表</span>
        <button className="btn-ghost" onClick={addResource} style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}>+ 添加</button>
      </div>
      {data.resources.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>暂无资源，点击"添加"创建</div>
      )}
      {data.resources.map((res, i) => (
        <div key={res.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input value={res.symbol} onChange={e => setResField(i, 'symbol', e.target.value)} style={{ width: 32, textAlign: 'center', padding: '4px', fontSize: 'var(--font-size-sm)' }} placeholder="图标" />
            <input value={res.name} onChange={e => setResField(i, 'name', e.target.value)} style={{ flex: 1, padding: '4px 8px', fontSize: 'var(--font-size-xs)' }} placeholder="资源名" />
            <input type="number" value={res.amount} onChange={e => setResField(i, 'amount', Number(e.target.value))} style={{ width: 48, padding: '4px', fontSize: 'var(--font-size-xs)' }} title="初始数量" />
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <input type="number" value={res.max} onChange={e => setResField(i, 'max', Number(e.target.value))} style={{ width: 48, padding: '4px', fontSize: 'var(--font-size-xs)' }} title="上限" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={res.scarce} onChange={e => setResField(i, 'scarce', e.target.checked)} /> 稀缺
            </label>
            <button className="btn-ghost" onClick={() => removeResource(i)} style={{ color: '#ef4444', padding: '2px 6px', fontSize: 'var(--font-size-xs)' }}>✕</button>
          </div>
          <input value={res.description || ''} onChange={e => setResField(i, 'description', e.target.value)} placeholder="获取方式与用途" style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <input value={res.gatherRate || ''} onChange={e => setResField(i, 'gatherRate', e.target.value)} placeholder="采集描述（如：初期每天3单位，后期可增长）" style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }} />
            <input value={res.usage || ''} onChange={e => setResField(i, 'usage', e.target.value)} placeholder="消耗描述（如：初期每天1单位，人数增加时等比）" style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 经营资产编辑器 — 显示 AI 生成的经营概览 */
function BusinessModuleEditor({ data, onChange }: { data: BusinessModuleSchema; onChange: (d: Record<string, unknown>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-xs)' }}>
      <div style={{ color: 'var(--text-muted)' }}>
        经营系统已由 AI 生成，可在游戏内通过经营管理面板查看详情。
      </div>
      {data.description && (
        <div style={{ padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px', color: 'var(--text-secondary)' }}>
          {data.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', color: 'var(--text-muted)' }}>
        <span>初始资金: <strong style={{ color: 'var(--text-primary)' }}>{data.funds ?? 0}</strong></span>
        <span>资产数: <strong style={{ color: 'var(--text-primary)' }}>{data.assets?.length ?? 0}</strong></span>
        <span>结算周期: <strong style={{ color: 'var(--text-primary)' }}>每{data.cycleName || '天'}</strong></span>
      </div>
      {data.assets && data.assets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {data.assets.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: '6px',
            }}>
              <span style={{ fontWeight: 600 }}>{a.name}</span>
              <span style={{ color: 'var(--text-muted)' }}>Lv.{a.level}/{a.maxLevel}</span>
              <span style={{ color: 'var(--text-muted)' }}>{a.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 天赋体系编辑器 — 弹窗式 */
function TalentModuleEditor({ data, onChange, onAiGenerate, isGenerating }: {
  data: TalentModuleSchema;
  onChange: (d: Record<string, unknown>) => void;
  onAiGenerate?: (categoryIndex: number, count: number) => void;
  isGenerating?: boolean;
}) {
  const RARITY_OPTIONS = ['普通', '精良', '稀有', '史诗', '传说'] as const;
  const [editingCat, setEditingCat] = useState<number | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [genCount, setGenCount] = useState(5);

  const commit = (next: TalentModuleSchema) => onChange(next as any);

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const next = JSON.parse(JSON.stringify(data));
    next.categories.push({ id: `cat_${Date.now()}`, name: newCatName.trim(), description: newCatDesc.trim(), talents: [] });
    commit(next);
    setNewCatName(''); setNewCatDesc(''); setAddCatOpen(false);
  };

  const removeCategory = (ci: number) => {
    const next = JSON.parse(JSON.stringify(data));
    next.categories.splice(ci, 1);
    commit(next);
  };

  const addTalent = () => {
    if (editingCat === null) return;
    const next = JSON.parse(JSON.stringify(data));
    next.categories[editingCat].talents.push({ id: `tal_${Date.now()}`, name: '新天赋', description: '', rarity: '普通', effects: [] });
    commit(next);
  };

  const removeTalent = (ti: number) => {
    if (editingCat === null) return;
    const next = JSON.parse(JSON.stringify(data));
    next.categories[editingCat].talents.splice(ti, 1);
    commit(next);
  };

  const setTalentField = (ti: number, field: string, value: unknown) => {
    if (editingCat === null) return;
    const next = JSON.parse(JSON.stringify(data));
    next.categories[editingCat].talents[ti][field] = value;
    commit(next);
  };

  const setCatField = (field: string, value: unknown) => {
    if (editingCat === null) return;
    const next = JSON.parse(JSON.stringify(data));
    next.categories[editingCat][field] = value;
    commit(next);
  };

  const editing = editingCat !== null ? data.categories[editingCat] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* 大类列表 */}
      {data.categories.map((cat, ci) => (
        <div key={cat.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{cat.name}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              {cat.description || '无描述'} · {cat.talents.length} 个天赋
            </div>
          </div>
          <button className="btn-ghost" onClick={() => setEditingCat(ci)} style={{ fontSize: 'var(--font-size-xs)', padding: '3px 10px' }}>编辑</button>
          <button onClick={() => removeCategory(ci)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: '4px' }}>✕</button>
        </div>
      ))}

      {/* 添加大类按钮 */}
      <button className="btn-ghost" onClick={() => setAddCatOpen(true)} style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', alignSelf: 'flex-start' }}>
        + 添加天赋大类
      </button>

      {/* ── 添加大类弹窗 ── */}
      {addCatOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAddCatOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, maxWidth: 360, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)' }}>添加天赋大类</h3>
            <div className="form-group">
              <label>大类名称</label>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="如：灵根、体质、血脉..." autoFocus />
            </div>
            <div className="form-group">
              <label>描述</label>
              <input value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} placeholder="可选" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => setAddCatOpen(false)}>取消</button>
              <button className="btn-primary" onClick={addCategory} disabled={!newCatName.trim()}>添加</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 编辑大类弹窗 ── */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditingCat(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, maxWidth: 500, width: '92%', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>{editing.name}</h3>
              <button onClick={() => setEditingCat(null)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 'var(--font-size-xs)', marginBottom: 2, display: 'block' }}>大类名称</label>
                <input value={editing.name} onChange={e => setCatField('name', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 'var(--font-size-xs)', marginBottom: 2, display: 'block' }}>描述</label>
                <input value={editing.description} onChange={e => setCatField('description', e.target.value)} placeholder="可选" />
              </div>
            </div>

            {/* 天赋列表 */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  天赋列表
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{editing.talents.length}</span>
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {onAiGenerate && (
                    <>
                      <input
                        type="number" min={1} max={20}
                        style={{ ...inputStyle, width: 38, textAlign: 'center', padding: '3px 4px', fontSize: 'var(--font-size-xs)' }}
                        value={genCount}
                        onChange={e => setGenCount(Math.max(1, Math.min(20, Number(e.target.value) || 5)))}
                      />
                      <button
                        className="btn-ghost"
                        onClick={() => onAiGenerate(editingCat!, genCount)}
                        disabled={isGenerating}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--font-size-xs)', padding: '3px 10px' }}
                      >
                        <Sparkles size={12} />
                        {isGenerating ? '生成中' : 'AI 生成'}
                      </button>
                    </>
                  )}
                  <button
                    className="btn-ghost"
                    onClick={addTalent}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--font-size-xs)', padding: '3px 10px' }}
                  >
                    <Plus size={12} /> 添加
                  </button>
                </div>
              </div>

              {editing.talents.length === 0 && (
                <div style={{
                  fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                  padding: '16px 0', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 6,
                }}>
                  暂无天赋
                </div>
              )}

              {editing.talents.map((tal, ti) => (
                <div key={tal.id} style={{
                  display: 'flex', flexDirection: 'column', gap: 4,
                  padding: '6px 8px', marginBottom: 4,
                  border: '1px solid var(--border)', borderRadius: 4,
                }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input style={{ ...inputStyle, flex: 1 }} value={tal.name} onChange={e => setTalentField(ti, 'name', e.target.value)} placeholder="天赋名" />
                    <select style={{ ...inputStyle, width: 60 }} value={tal.rarity} onChange={e => setTalentField(ti, 'rarity', e.target.value)}>
                      {RARITY_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => removeTalent(ti)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}>✕</button>
                  </div>
                  <input style={{ ...inputStyle }} value={tal.description} onChange={e => setTalentField(ti, 'description', e.target.value)} placeholder="描述..." />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn-primary" onClick={() => setEditingCat(null)} style={{ padding: '6px 20px' }}>完成</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
