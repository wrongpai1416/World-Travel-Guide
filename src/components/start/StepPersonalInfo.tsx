import React, { useState, useRef, useEffect } from 'react';
import type { PlayerProfile, CustomNpc } from '../../storage/db';
import type { SkillData, InventoryItem } from '../../schema/variables';
import type { WorldModule } from '../../data/worlds-schema';
import type { WorldDef } from '../../data/worldLoader';
import type { WorldBookEntry } from '../../worldbook/index';
import type { ApiConfig } from '../../api/types';
import NpcEditorModal from './NpcEditorModal';
import TemplatePickerDialog from '../shared/TemplatePickerDialog';
import { useDialog } from '../shared/Dialog';
import {
  User, Briefcase, Sparkles, Package, Users, BarChart3,
  Plus, Trash2, Pencil, Wand2, Loader, Save, Download, Upload, ChevronDown, BookMarked,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { savePlayerPreset, downloadJSON, exportPlayerPresetJSON } from '../../storage/templateStore';

interface StepPersonalInfoProps {
  personalInfo: PlayerProfile;
  setPersonalInfo: (info: PlayerProfile) => void;
  isFilling: boolean;
  fillElapsed: number;
  onAiFill: () => void;
  onCancelFill: () => void;
  hasApiConfig: boolean;
  worldModules?: WorldModule[];
  apiConfig?: ApiConfig | null;
  selectedWorld?: string;
  allWorlds?: WorldDef[];
  worldEntry?: WorldBookEntry | null;
  onNext: () => void;
  onPrev: () => void;
}

const QUALITY_OPTIONS: Array<SkillData['品质']> = ['普通', '精良', '稀有', '史诗', '传说'];
const PERSPECTIVE_OPTIONS: Array<{ value: PlayerProfile['perspective']; label: string; desc: string }> = [
  { value: '第一人称', label: '第一人称', desc: '「我」的视角' },
  { value: '第二人称', label: '第二人称', desc: '「你」的视角' },
  { value: '第三人称', label: '第三人称', desc: '「他/她」的视角' },
];

type RightTab = 'identity' | 'stats' | 'skills' | 'items' | 'npcs';

const RIGHT_TABS: Array<{ key: RightTab; label: string; icon: React.ReactNode }> = [
  { key: 'identity', label: '身份', icon: <Briefcase size={14} /> },
  { key: 'stats', label: '属性', icon: <BarChart3 size={14} /> },
  { key: 'skills', label: '技能', icon: <Sparkles size={14} /> },
  { key: 'items', label: '物品', icon: <Package size={14} /> },
  { key: 'npcs', label: 'NPC', icon: <Users size={14} /> },
];

export default function StepPersonalInfo({
  personalInfo, setPersonalInfo, isFilling, fillElapsed, onAiFill, onCancelFill, hasApiConfig, worldModules,
  apiConfig, selectedWorld, allWorlds, worldEntry,
  onNext, onPrev,
}: StepPersonalInfoProps) {
  const [rightTab, setRightTab] = useState<RightTab>('identity');
  const [npcEditorOpen, setNpcEditorOpen] = useState(false);
  const [editingNpc, setEditingNpc] = useState<CustomNpc | null>(null);
  const [npcPickerOpen, setNpcPickerOpen] = useState(false);
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    if (!presetMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setPresetMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [presetMenuOpen]);

  // ─── 对话框 ───
  const { DialogUI, prompt: dlgPrompt, alert: dlgAlert } = useDialog();

  // ─── 主角预设操作 ───
  const handleSavePreset = async () => {
    const name = await dlgPrompt('请输入预设名称：', { defaultValue: personalInfo.name || '我的预设', title: '保存预设' });
    if (!name?.trim()) return;
    savePlayerPreset(name.trim(), personalInfo);
    await dlgAlert(`预设「${name.trim()}」已保存 ✓`);
  };

  const handleExportPreset = async () => {
    const name = await dlgPrompt('请输入导出文件名：', { defaultValue: personalInfo.name || 'my-preset', title: '导出预设' });
    if (!name?.trim()) return;
    const preset = savePlayerPreset(name.trim(), personalInfo);
    const json = exportPlayerPresetJSON(preset);
    downloadJSON(json, `player-preset-${name.trim()}.json`);
  };

  const set = <K extends keyof PlayerProfile>(key: K, val: PlayerProfile[K]) =>
    setPersonalInfo({ ...personalInfo, [key]: val });

  // ─── 技能操作 ───
  const addSkill = () => {
    const name = `技能${Object.keys(personalInfo.initialSkills).length + 1}`;
    set('initialSkills', { ...personalInfo.initialSkills, [name]: { 品质: '普通', 描述: '', 类型: '' } });
  };
  const removeSkill = (name: string) => {
    const next = { ...personalInfo.initialSkills }; delete next[name]; set('initialSkills', next);
  };
  const updateSkillField = (name: string, field: keyof SkillData, value: string) => {
    const next = { ...personalInfo.initialSkills };
    const skill = next[name]; if (!skill) return;
    next[name] = { ...skill, [field]: value };
    set('initialSkills', next);
  };
  const renameSkill = (oldName: string, newName: string) => {
    if (oldName === newName) return;
    const next = { ...personalInfo.initialSkills };
    const skill = next[oldName]; if (!skill) return;
    delete next[oldName];
    next[newName] = skill;
    set('initialSkills', next);
  };

  // ─── 物品操作 ───
  const addItem = () => {
    const name = `物品${Object.keys(personalInfo.initialItems).length + 1}`;
    set('initialItems', { ...personalInfo.initialItems, [name]: { 数量: 1, 类型: '', 品质: '普通', 备注: '' } });
  };
  const removeItem = (name: string) => {
    const next = { ...personalInfo.initialItems }; delete next[name]; set('initialItems', next);
  };
  const updateItemField = (name: string, field: keyof InventoryItem, value: any) => {
    const next = { ...personalInfo.initialItems };
    const item = next[name]; if (!item) return;
    next[name] = { ...item, [field]: field === '数量' ? Number(value) || 1 : value };
    set('initialItems', next);
  };
  const renameItem = (oldName: string, newName: string) => {
    if (oldName === newName) return;
    const next = { ...personalInfo.initialItems };
    const item = next[oldName]; if (!item) return;
    delete next[oldName];
    next[newName] = item;
    set('initialItems', next);
  };

  // ─── NPC 操作 ───
  const handleSaveNpc = (npc: CustomNpc) => {
    const idx = personalInfo.customNpcs.findIndex(n => n.id === npc.id);
    const next = [...personalInfo.customNpcs];
    if (idx >= 0) next[idx] = npc; else next.push(npc);
    set('customNpcs', next);
    setNpcEditorOpen(false); setEditingNpc(null);
  };
  const removeNpc = (id: string) => {
    set('customNpcs', personalInfo.customNpcs.filter(n => n.id !== id));
  };

  return (
    <div className="personal-info-layout">
      {/* ── 左栏：基本信息 ── */}
      <div className="personal-info-box">
        <div className="pi-box-header">
          <User size={16} />
          <span>基本信息</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* 预设下拉菜单 */}
            <div ref={presetMenuRef} style={{ position: 'relative' }}>
              <button
                className="pi-ai-btn"
                onClick={() => setPresetMenuOpen(!presetMenuOpen)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                <BookMarked size={12} /> 预设 <ChevronDown size={10} style={{ transform: presetMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {presetMenuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                  minWidth: '140px', zIndex: 200, overflow: 'hidden',
                }}>
                  <DropdownItem icon={<Download size={13} />} label="导入预设" onClick={() => { setPresetMenuOpen(false); setPlayerPickerOpen(true); }} />
                  <DropdownItem icon={<Save size={13} />} label="保存预设" disabled={!personalInfo.name.trim()} onClick={() => { setPresetMenuOpen(false); handleSavePreset(); }} />
                  <DropdownItem icon={<Upload size={13} />} label="导出 JSON" disabled={!personalInfo.name.trim()} onClick={() => { setPresetMenuOpen(false); handleExportPreset(); }} />
                </div>
              )}
            </div>
            {hasApiConfig && (
              <button
                className="pi-ai-btn"
                onClick={onAiFill}
                disabled={isFilling || !personalInfo.name.trim()}
                title="AI 补全所有信息"
              >
                {isFilling ? <><Loader size={12} className="animate-spin" /> 生成中{fillElapsed > 0 ? ` ${fillElapsed}s` : ''}</> : <><Wand2 size={12} /> AI 补全</>}
              </button>
            )}
          </div>
        </div>
        <div className="pi-box-body">
          <div className="form-group">
            <label>姓名 *</label>
            <input type="text" value={personalInfo.name} onChange={e => set('name', e.target.value)} placeholder="输入角色姓名..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label>年龄</label>
              <input type="text" value={personalInfo.age} onChange={e => set('age', e.target.value)} placeholder="18" />
            </div>
            <div className="form-group">
              <label>性别</label>
              <div className="gender-radio-group">
                {['男', '女', '其他'].map(g => (
                  <div key={g} className={`gender-radio${personalInfo.gender === g ? ' selected' : ''}`} onClick={() => set('gender', g)}>
                    {g === '男' ? '♂' : g === '女' ? '♀' : '⚧'} {g}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>性格</label>
            <textarea value={personalInfo.personality} onChange={e => set('personality', e.target.value)} placeholder="如：温柔善良、外冷内热、沉默寡言..." rows={2} />
          </div>
          <div className="form-group">
            <label>外貌</label>
            <textarea value={personalInfo.appearance} onChange={e => set('appearance', e.target.value)} placeholder="如：黑发碧眼、身材高挑、左脸有一道疤痕..." rows={2} />
          </div>
          <div className="form-group">
            <label>背景描述</label>
            <textarea value={personalInfo.background} onChange={e => set('background', e.target.value)} placeholder="简单描述你的角色特长、来历、动机等..." rows={5} />
          </div>
          <div className="form-group">
            <label>叙事视角</label>
            <div className="gender-radio-group">
              {PERSPECTIVE_OPTIONS.map(opt => (
                <div key={opt.value} className={`gender-radio${personalInfo.perspective === opt.value ? ' selected' : ''}`} onClick={() => set('perspective', opt.value)}>
                  <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)' }}>{opt.label}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.7, marginTop: '2px' }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 右栏：Tab 切换 ── */}
      <div className="personal-info-box">
        <div className="pi-box-header" style={{ padding: 0, background: 'transparent', borderBottom: 'none' }}>
          <div className="pi-right-tabs">
            {RIGHT_TABS.map(tab => (
              <button
                key={tab.key}
                className={`pi-right-tab${rightTab === tab.key ? ' active' : ''}`}
                onClick={() => setRightTab(tab.key)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="pi-box-body">
          {/* Tab: 身份信息 */}
          {rightTab === 'identity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label>职业</label>
                <input type="text" value={personalInfo.career} onChange={e => set('career', e.target.value)} placeholder="学生, 佣兵..." />
              </div>
              <div className="form-group">
                <label>阶层</label>
                <input type="text" value={personalInfo.socialClass} onChange={e => set('socialClass', e.target.value)} placeholder="平民, 贵族..." />
              </div>
              <div className="form-group">
                <label>所属组织</label>
                <input type="text" value={personalInfo.organization} onChange={e => set('organization', e.target.value)} placeholder="佣兵工会..." />
              </div>
              <div className="form-group">
                <label>特殊身份</label>
                <input type="text" value={personalInfo.specialIdentity} onChange={e => set('specialIdentity', e.target.value)} placeholder="转生者..." />
              </div>
            </div>
          )}

          {/* Tab: 初始属性 */}
          {rightTab === 'stats' && (
            <ModuleInitEditor
              worldModules={worldModules}
              initData={personalInfo.moduleInitData || {}}
              onChange={(data) => setPersonalInfo({ ...personalInfo, moduleInitData: data })}
            />
          )}

          {/* Tab: 初始技能 */}
          {rightTab === 'skills' && (
            <div className="world-dynamic-list">
              {Object.entries(personalInfo.initialSkills).map(([name, skill]) => (
                <div key={name} className="world-dynamic-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1 }}>
                    <input type="text" defaultValue={name} onBlur={e => renameSkill(name, e.target.value)} placeholder="技能名称..." style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px' }} />
                    <select value={skill.品质} onChange={e => updateSkillField(name, '品质', e.target.value)} style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                      {QUALITY_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <input type="text" value={skill.描述} onChange={e => updateSkillField(name, '描述', e.target.value)} placeholder="技能描述..." style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px' }} />
                  </div>
                  <button onClick={() => removeSkill(name)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', flexShrink: 0, alignSelf: 'flex-end' }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn-ghost" onClick={addSkill} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-base)', marginTop: '4px' }}><Plus size={14} /> 添加技能</button>
            </div>
          )}

          {/* Tab: 初始物品 */}
          {rightTab === 'items' && (
            <div className="world-dynamic-list">
              {Object.entries(personalInfo.initialItems).map(([name, item]) => (
                <div key={name} className="world-dynamic-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <input type="text" defaultValue={name} onBlur={e => renameItem(name, e.target.value)} placeholder="物品名称..." style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="number" value={item.数量} onChange={e => updateItemField(name, '数量', e.target.value)} min={1} style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px', width: '50px' }} placeholder="数量" />
                      <select value={item.品质} onChange={e => updateItemField(name, '品质', e.target.value)} style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)', width: '70px' }}>
                        {QUALITY_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                      <input type="text" value={item.类型} onChange={e => updateItemField(name, '类型', e.target.value)} placeholder="类型(武器/防具/消耗品...)" style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px', flex: 1 }} />
                    </div>
                    <input type="text" value={item.备注} onChange={e => updateItemField(name, '备注', e.target.value)} placeholder="备注(用途、来源等)..." style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px' }} />
                  </div>
                  <button onClick={() => removeItem(name)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', flexShrink: 0, alignSelf: 'flex-end' }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn-ghost" onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-base)', marginTop: '4px' }}><Plus size={14} /> 添加物品</button>
            </div>
          )}

          {/* Tab: 自建NPC */}
          {rightTab === 'npcs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {personalInfo.customNpcs.map(npc => (
                <div key={npc.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)' }}>{npc.name || '未命名'}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[npc.gender, npc.age && `${npc.age}岁`, npc.race, npc.relationshipType].filter(Boolean).join(' / ') || '未设定'}
                    </div>
                  </div>
                  <button onClick={() => { setEditingNpc(npc); setNpcEditorOpen(true); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><Pencil size={14} /></button>
                  <button onClick={() => removeNpc(npc.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn-ghost" onClick={() => setNpcPickerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-base)' }}><Plus size={14} /> 创建NPC</button>
            </div>
          )}
        </div>
      </div>

      {/* 导航按钮 */}
      <div className="personal-info-nav">
        <button className="btn-secondary" onClick={onPrev} style={{ padding: '10px 24px' }}>← 上一步</button>
        <button
          className="btn-primary"
          onClick={onNext}
          style={{ padding: '10px 32px', fontSize: 'var(--font-size-lg)' }}
          disabled={!personalInfo.name.trim() || !personalInfo.gender || !personalInfo.age.trim()}
          title={!personalInfo.name.trim() || !personalInfo.gender || !personalInfo.age.trim() ? '请填写姓名、性别和年龄' : ''}
        >
          下一步 →
        </button>
      </div>

      {npcEditorOpen && (
        <NpcEditorModal
          initial={editingNpc}
          onSave={handleSaveNpc}
          onCancel={() => { setNpcEditorOpen(false); setEditingNpc(null); }}
          apiConfig={apiConfig}
          playerName={personalInfo.name}
          playerGender={personalInfo.gender}
          playerAge={personalInfo.age}
          playerBackground={personalInfo.background}
          selectedWorld={selectedWorld}
          allWorlds={allWorlds}
          worldEntry={worldEntry}
        />
      )}

      {npcPickerOpen && (
        <TemplatePickerDialog
          mode="npc"
          onClose={() => setNpcPickerOpen(false)}
          onBlank={() => { setEditingNpc(null); setNpcEditorOpen(true); }}
          onImportTemplate={(npc) => { setEditingNpc(npc); setNpcEditorOpen(true); }}
        />
      )}

      {playerPickerOpen && (
        <TemplatePickerDialog
          mode="player"
          currentProfile={personalInfo}
          onClose={() => setPlayerPickerOpen(false)}
          onApplyPreset={(profile) => setPersonalInfo(profile)}
        />
      )}

      {DialogUI}
    </div>
  );
}

/** 下拉菜单项 */
function DropdownItem({ icon, label, disabled, onClick }: {
  icon: React.ReactNode; label: string; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
        padding: '8px 12px', border: 'none', background: 'none',
        color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
        fontSize: 'var(--font-size-sm)', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      {icon} {label}
    </button>
  );
}

// ═══════════════════════════════════════
//  模块初始属性编辑器
// ═══════════════════════════════════════

const _inputStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '5px 8px', color: 'var(--text-primary)',
  fontSize: 'var(--font-size-xs)', width: '100%', boxSizing: 'border-box',
};
const _labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2, display: 'block',
};

function ModuleInitEditor({ worldModules, initData, onChange }: {
  worldModules?: WorldModule[];
  initData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  if (!worldModules || worldModules.length === 0) {
    return <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>此世界未启用任何模块</div>;
  }

  const statMod = worldModules.find(m => m.moduleId === 'stat' && m.enabled);
  const progMod = worldModules.find(m => m.moduleId === 'progression' && m.enabled);
  // 兼容新格式（moduleConfig）和旧格式（data）
  const statData = (statMod?.moduleConfig || statMod?.data) as any;
  const progData = (progMod?.moduleConfig || progMod?.data) as any;

  const set = (path: string, value: unknown) => {
    const next = { ...initData };
    const parts = path.split('.');
    let obj: any = next;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    onChange(next);
  };

  const get = (path: string, fallback: unknown = undefined): unknown => {
    const parts = path.split('.');
    let obj: any = initData;
    for (const p of parts) {
      if (!obj) return fallback;
      obj = obj[p];
    }
    // 防御 NaN 和 undefined/null
    if (obj == null || (typeof obj === 'number' && isNaN(obj))) return fallback;
    return obj;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 数值属性 */}
      {statData && (
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 8, color: 'var(--accent)', letterSpacing: '0.03em' }}>
            {statMod!.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* 主属性（生命 / 能量）— 统一两列网格 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ key: 'attrA', fallback: 80, tag: '生命' }, { key: 'attrB', fallback: 60, tag: '能量' }].map(({ key, fallback, tag }) => {
                const attr = statData[key];
                if (!attr) return null;
                return (
                  <div key={key}>
                    <span style={_labelStyle}>{attr.name}<span style={{ opacity: 0.5, marginLeft: 3 }}>{tag}</span></span>
                    <input style={{ ..._inputStyle, width: 56, textAlign: 'center' }} type="number"
                      value={get(`数值属性.${key}.current`, attr.current ?? fallback) as number}
                      onChange={e => set(`数值属性.${key}.current`, Number(e.target.value) || 0)} />
                  </div>
                );
              })}
            </div>
            {/* 六维 — 统一三列网格 */}
            {['dim1','dim2','dim3','dim4','dim5','dim6'].filter(k => statData[k]).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(['dim1','dim2','dim3','dim4','dim5','dim6'] as const).map(key => {
                  const dim = statData[key];
                  if (!dim) return null;
                  return (
                    <div key={key}>
                      <span style={_labelStyle}>{dim.name}</span>
                      <input style={{ ..._inputStyle, textAlign: 'center' }} type="number"
                        value={get(`数值属性.${key}.value`, dim.value ?? 0) as number}
                        onChange={e => set(`数值属性.${key}.value`, Number(e.target.value) || 0)} />
                    </div>
                  );
                })}
              </div>
            )}
            {/* 属性 — 统一两列网格 */}
            {statData.special?.length > 0 && (
              <div>
                <span style={{ ..._labelStyle, marginBottom: 4, display: 'block' }}>属性</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {statData.special.map((sp: any) => (
                    <div key={sp.id}>
                      <span style={_labelStyle}>{sp.name}</span>
                      <input style={{ ..._inputStyle, textAlign: 'center' }} type="number"
                        value={get(`数值属性.special.${sp.id}.value`, sp.value ?? 0) as number}
                        onChange={e => set(`数值属性.special.${sp.id}.value`, Number(e.target.value) || 0)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 成长体系 */}
      {progData?.tiers?.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 8, color: 'var(--accent)', letterSpacing: '0.03em' }}>
            {progMod!.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {progData.tiers.map((tier: any, i: number) => (
              <label key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                borderRadius: 6, cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                background: (get('成长体系.currentTierIndex', 0) === i) ? 'var(--accent-dim)' : 'transparent',
                border: `1px solid ${(get('成长体系.currentTierIndex', 0) === i) ? 'var(--accent)' : 'var(--border)'}`,
                transition: 'all 0.12s',
              }}>
                <input type="radio" name="initTier"
                  checked={(get('成长体系.currentTierIndex', 0) === i)}
                  onChange={() => set('成长体系.currentTierIndex', i)}
                  style={{ display: 'none' }} />
                <span style={{ fontWeight: 600, color: (get('成长体系.currentTierIndex', 0) === i) ? 'var(--accent)' : 'var(--text-primary)', minWidth: '1.5em' }}>
                  {i + 1}.
                </span>
                <span style={{ fontWeight: 600, color: (get('成长体系.currentTierIndex', 0) === i) ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {tier.name}
                </span>
                {tier.description && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tier.description}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {!statData && !progData && (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          此世界的模块没有可配置的初始数据
        </div>
      )}
    </div>
  );
}
