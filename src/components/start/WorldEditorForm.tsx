import { useState, useEffect, useRef } from 'react';
import type { WorldDef } from '../../data/worldLoader';
import { requestStreamWithRetry } from '../../api/client';
import { useConfigStore } from '../../stores/configStore';
import {
  X, Cpu, Pencil, Sparkles, Loader, ClipboardList, ScrollText,
  Swords, DollarSign, Flag, User, Save,
  Globe, Compass, BookOpen, Flame, Mountain, Ship, Castle, Skull, Crown,
  Rocket, Star, Shield, Zap, Brain, Gem, Ghost, Snowflake, Sun, Moon,
  Wind, Waves, Anchor, Eye, Heart, Target, Wand2, Fish, Bug,
  Flower, TreePine, Cloud, Sunrise, Eclipse, Hexagon, Diamond, Atom,
  Download,
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
  // 系统 Tab 字段（AI 生成或手动编辑时直接透传）
  coreStats: WorldDef['coreStats'];
  progression: WorldDef['progression'];
  conflict: WorldDef['conflict'];
  relationships: WorldDef['relationships'];
  events: WorldDef['events'];
};

const defaultForm: FormState = {
  name: '', description: '', icon: '', coverColor: '#3b82f6', tags: '', difficulty: 'medium',
  overview: '', timePeriod: '', location: '', atmosphere: '',
  powerSystem: '', socialStructure: '', specialRules: '',
  currencyName: '', currencySymbol: '', currencyDesc: '', priceLevel: '',
  calendar: '', startTime: '', timeSpeed: '',
  factions: [], presetNPCs: [], highlights: '',
  coreStats: undefined, progression: undefined, conflict: undefined,
  relationships: undefined, events: undefined,
};

function worldToForm(w: WorldDef): FormState {
  return {
    name: w.name || '', description: w.description || '',
    icon: w.icon || '', coverColor: w.coverColor || '#3b82f6',
    tags: w.tags?.join(', ') || '', difficulty: w.difficulty || 'medium',
    overview: w.setting?.overview || '', timePeriod: w.setting?.timePeriod || '',
    location: w.setting?.location || '', atmosphere: w.setting?.atmosphere || '',
    powerSystem: w.rules?.powerSystem || '', socialStructure: w.rules?.socialStructure || '',
    specialRules: w.rules?.specialRules?.join('\n') || '',
    currencyName: w.economy?.currency?.name || '', currencySymbol: w.economy?.currency?.symbol || '',
    currencyDesc: w.economy?.currency?.description || '', priceLevel: w.economy?.priceLevel || '',
    calendar: w.timeSystem?.calendar || '', startTime: w.timeSystem?.startTime || '',
    timeSpeed: w.timeSystem?.timeSpeed || '',
    factions: w.factions?.map(f => ({ name: f.name, description: f.description, alignment: f.alignment || '中立' })) || [],
    presetNPCs: w.presetNPCs?.map(n => ({ name: n.name, role: n.role, description: n.description, personality: n.personality || '' })) || [],
    highlights: w.highlights?.join(', ') || '',
    coreStats: w.coreStats, progression: w.progression,
    conflict: w.conflict, relationships: w.relationships, events: w.events,
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
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);
  const [genError, setGenError] = useState('');
  const aiAbortRef = useRef<AbortController | null>(null);

  const update = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const addFaction = () => setForm(f => ({ ...f, factions: [...f.factions, { name: '', description: '', alignment: '中立' }] }));
  const removeFaction = (i: number) => setForm(f => ({ ...f, factions: f.factions.filter((_, idx) => idx !== i) }));
  const updateFaction = (i: number, patch: Partial<FormState['factions'][0]>) =>
    setForm(f => ({ ...f, factions: f.factions.map((item, idx) => idx === i ? { ...item, ...patch } : item) }));
  const addNPC = () => setForm(f => ({ ...f, presetNPCs: [...f.presetNPCs, { name: '', role: '', description: '', personality: '' }] }));
  const removeNPC = (i: number) => setForm(f => ({ ...f, presetNPCs: f.presetNPCs.filter((_, idx) => idx !== i) }));
  const updateNPC = (i: number, patch: Partial<FormState['presetNPCs'][0]>) =>
    setForm(f => ({ ...f, presetNPCs: f.presetNPCs.map((item, idx) => idx === i ? { ...item, ...patch } : item) }));

  const isEditing = !!initialWorld;
  const [editorMode, setEditorMode] = useState<'manual' | 'ai'>(isEditing ? 'manual' : 'ai');

  const handleAIGenerate = async () => {
    if (!aiGenName.trim()) { setGenError('请输入世界描述'); return; }
    if (!apiConfig) { setGenError('请先在设置中配置API'); return; }
    setGenError(''); setIsGeneratingWorld(true);
    const ctrl = new AbortController(); aiAbortRef.current = ctrl;
    const sysPrompt = `你是一位专业的世界观架构师。请根据用户给出的世界描述，生成一个完整的世界定义JSON。

要求：
1. 根据描述创意生成一个合适的中文世界名称（不要直接使用用户输入）
2. 严格返回一个JSON对象（不要markdown标记），包含以下结构：
{
  "name": "创意中文世界名称（根据描述生成，不要直接用用户输入）",
  "description": "一句话简介（20字以内）",
  "icon": "一个合适的Lucide图标名称（从以下选择：Globe, Compass, BookOpen, Flame, Mountain, Ship, Castle, Skull, Crown, Rocket, Star, Shield, Zap, Brain, Gem, Ghost, Snowflake, Sun, Moon, Wind, Waves, Anchor, Eye, Heart, Target, Wand2, Fish, Flower, TreePine, Cloud）",
  "tags": ["标签1", "标签2", "标签3"],
  "setting": {
    "overview": "2-3段沉浸式世界观描述（200-400字）",
    "timePeriod": "时间背景",
    "location": "地理位置",
    "atmosphere": "氛围描述"
  },
  "rules": {
    "powerSystem": "力量/魔法/科技体系",
    "socialStructure": "社会结构",
    "specialRules": ["特殊规则1", "特殊规则2"]
  },
  "coreStats": [
    { "id": "stat1", "name": "属性名", "description": "属性说明", "range": [0, 100], "important": true },
    { "id": "stat2", "name": "属性名", "description": "属性说明", "range": [0, 100] }
  ],
  "progression": {
    "description": "进阶体系简述",
    "tiers": [
      { "name": "阶段名", "description": "阶段说明" }
    ]
  },
  "conflict": {
    "description": "冲突方式描述",
    "types": ["冲突类型1", "冲突类型2"],
    "lethal": false,
    "nonViolent": false
  },
  "relationships": {
    "description": "关系系统描述",
    "mechanics": "关系机制说明",
    "types": [
      { "name": "关系类型", "description": "说明" }
    ]
  },
  "events": [
    { "name": "事件名", "description": "事件描述", "trigger": "触发条件", "significance": "major" }
  ],
  "economy": {
    "currency": { "name": "货币名", "symbol": "符号", "description": "说明" },
    "priceLevel": "物价水平描述"
  },
  "timeSystem": {
    "calendar": "纪年方式",
    "startTime": "故事开始时间",
    "timeSpeed": "时间流速"
  },
  "factions": [
    { "name": "势力名", "description": "描述", "alignment": "友善/中立/敌对" }
  ],
  "presetNPCs": [
    { "name": "NPC名", "role": "角色定位", "description": "简介", "personality": "性格" }
  ],
  "highlights": ["特色1", "特色2", "特色3"]
}`;
    try {
      const result = await requestStreamWithRetry(apiConfig, [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: `请为以下世界生成完整设定：${aiGenName.trim()}` },
      ], { signal: ctrl.signal, onDelta: () => {} });
      let text = result.text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) { setGenError('AI未返回有效JSON，请重试'); return; }
      const data = JSON.parse(jsonMatch[1].trim());
      update({
        name: data.name || aiGenName.trim(), description: data.description || '',
        icon: data.icon || '', tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
        overview: data.setting?.overview || '', timePeriod: data.setting?.timePeriod || '',
        location: data.setting?.location || '', atmosphere: data.setting?.atmosphere || '',
        powerSystem: data.rules?.powerSystem || '', socialStructure: data.rules?.socialStructure || '',
        specialRules: Array.isArray(data.rules?.specialRules) ? data.rules.specialRules.join('\n') : '',
        currencyName: data.economy?.currency?.name || '', currencySymbol: data.economy?.currency?.symbol || '',
        currencyDesc: data.economy?.currency?.description || '', priceLevel: data.economy?.priceLevel || '',
        calendar: data.timeSystem?.calendar || '', startTime: data.timeSystem?.startTime || '',
        timeSpeed: data.timeSystem?.timeSpeed || '',
        factions: Array.isArray(data.factions) ? data.factions.map((f: any) => ({ name: f.name || '', description: f.description || '', alignment: f.alignment || '中立' })) : [],
        presetNPCs: Array.isArray(data.presetNPCs) ? data.presetNPCs.map((n: any) => ({ name: n.name || '', role: n.role || '', description: n.description || '', personality: n.personality || '' })) : [],
        highlights: Array.isArray(data.highlights) ? data.highlights.join(', ') : '',
        coreStats: Array.isArray(data.coreStats) ? data.coreStats : undefined,
        progression: data.progression || undefined,
        conflict: data.conflict || undefined,
        relationships: data.relationships || undefined,
        events: Array.isArray(data.events) ? data.events : undefined,
      });
      setEditorMode('manual');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setGenError(`生成失败: ${err.message}`);
    } finally { setIsGeneratingWorld(false); aiAbortRef.current = null; }
  };

  // 将当前表单转换为 WorldDef 对象（供导出和保存共用）
  const formToWorldDef = (): WorldDef => ({
    id: initialWorld?.id || `custom_${Date.now()}`,
    name: form.name.trim(), description: form.description.trim(), entryId: null,
    icon: form.icon || undefined, coverColor: form.coverColor || undefined,
    tags: form.tags ? form.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined,
    difficulty: (form.difficulty as any) || undefined,
    setting: form.overview ? { overview: form.overview, timePeriod: form.timePeriod || undefined, location: form.location || undefined, atmosphere: form.atmosphere || undefined } : undefined,
    rules: (form.powerSystem || form.socialStructure || form.specialRules) ? { powerSystem: form.powerSystem || undefined, socialStructure: form.socialStructure || undefined, specialRules: form.specialRules ? form.specialRules.split('\n').map(s => s.trim()).filter(Boolean) : undefined } : undefined,
    economy: form.currencyName ? { currency: { name: form.currencyName, symbol: form.currencySymbol || undefined, description: form.currencyDesc || undefined }, priceLevel: form.priceLevel || undefined } : undefined,
    timeSystem: (form.calendar || form.startTime) ? { calendar: form.calendar || undefined, startTime: form.startTime || undefined, timeSpeed: form.timeSpeed || undefined } : undefined,
    factions: form.factions.filter(f => f.name.trim()).length > 0 ? form.factions.filter(f => f.name.trim()).map(f => ({ name: f.name.trim(), description: f.description.trim(), alignment: f.alignment || undefined })) : undefined,
    presetNPCs: form.presetNPCs.filter(n => n.name.trim()).length > 0 ? form.presetNPCs.filter(n => n.name.trim()).map(n => ({ name: n.name.trim(), role: n.role.trim(), description: n.description.trim(), personality: n.personality.trim() || undefined })) : undefined,
    highlights: form.highlights ? form.highlights.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined,
    coreStats: form.coreStats,
    progression: form.progression,
    conflict: form.conflict,
    relationships: form.relationships,
    events: form.events,
    author: initialWorld?.author, createdAt: initialWorld?.createdAt || new Date().toISOString(),
  });

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(formToWorldDef());
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

  return (
    <div className="world-editor-overlay" onClick={onCancel}>
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
              {genError && <div style={{ color: '#ef4444', fontSize: 'var(--font-size-sm)', marginTop: 8 }}>{genError}</div>}
              {isGeneratingWorld && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--accent)' }}><div className="ai-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /><span style={{ fontSize: 'var(--font-size-base)' }}>AI 正在构建世界...</span></div>}
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
  );
}
