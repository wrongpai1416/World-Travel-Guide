import { useState } from 'react';
import type { PlayerProfile, CustomNpc } from '../../storage/db';
import type { SkillData, InventoryItem } from '../../schema/variables';
import NpcEditorModal from './NpcEditorModal';
import {
  User, Briefcase, Sparkles, Package, Users,
  Plus, Trash2, Pencil, Wand2, Loader,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';

interface StepPersonalInfoProps {
  personalInfo: PlayerProfile;
  setPersonalInfo: (info: PlayerProfile) => void;
  isFilling: boolean;
  onAiFill: () => void;
  hasApiConfig: boolean;
  onNext: () => void;
  onPrev: () => void;
}

const QUALITY_OPTIONS: Array<SkillData['品质']> = ['普通', '精良', '稀有', '史诗', '传说'];
const PERSPECTIVE_OPTIONS: Array<{ value: PlayerProfile['perspective']; label: string; desc: string }> = [
  { value: '第一人称', label: '第一人称', desc: '「我」的视角' },
  { value: '第二人称', label: '第二人称', desc: '「你」的视角' },
  { value: '第三人称', label: '第三人称', desc: '「他/她」的视角' },
];

type RightTab = 'identity' | 'skills' | 'items' | 'npcs';

const RIGHT_TABS: Array<{ key: RightTab; label: string; icon: React.ReactNode }> = [
  { key: 'identity', label: '身份', icon: <Briefcase size={14} /> },
  { key: 'skills', label: '技能', icon: <Sparkles size={14} /> },
  { key: 'items', label: '物品', icon: <Package size={14} /> },
  { key: 'npcs', label: 'NPC', icon: <Users size={14} /> },
];

export default function StepPersonalInfo({
  personalInfo, setPersonalInfo, isFilling, onAiFill, hasApiConfig, onNext, onPrev,
}: StepPersonalInfoProps) {
  const [rightTab, setRightTab] = useState<RightTab>('identity');
  const [npcEditorOpen, setNpcEditorOpen] = useState(false);
  const [editingNpc, setEditingNpc] = useState<CustomNpc | null>(null);

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
  const updateSkill = (oldName: string, newName: string, field: keyof SkillData, value: string) => {
    const next = { ...personalInfo.initialSkills };
    const skill = next[oldName]; if (!skill) return;
    const updated = { ...skill, [field]: value };
    if (oldName !== newName) { delete next[oldName]; next[newName] = updated; } else { next[oldName] = updated; }
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
  const updateItem = (oldName: string, newName: string, field: keyof InventoryItem, value: any) => {
    const next = { ...personalInfo.initialItems };
    const item = next[oldName]; if (!item) return;
    const updated = { ...item, [field]: field === '数量' ? Number(value) || 1 : value };
    if (oldName !== newName) { delete next[oldName]; next[newName] = updated; } else { next[oldName] = updated; }
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
        </div>
        <div className="pi-box-body">
          <div className="form-group">
            <label>姓名 *</label>
            <input type="text" value={personalInfo.name} onChange={e => set('name', e.target.value)} placeholder="输入角色姓名..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label>年龄</label>
              <input type="text" value={personalInfo.age} onChange={e => set('age', e.target.value)} placeholder="如: 18, 25..." />
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
            <label>背景描述</label>
            <textarea value={personalInfo.background} onChange={e => set('background', e.target.value)} placeholder="简单描述你的角色性格、特长、来历等..." rows={5} />
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
            {hasApiConfig && (
              <button
                className="pi-ai-btn"
                onClick={onAiFill}
                disabled={isFilling || !personalInfo.name.trim()}
                title="AI 补全"
              >
                {isFilling ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
              </button>
            )}
          </div>
        </div>
        <div className="pi-box-body">
          {/* Tab: 身份信息 */}
          {rightTab === 'identity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label>职业</label>
                  <input type="text" value={personalInfo.career} onChange={e => set('career', e.target.value)} placeholder="学生, 佣兵..." />
                </div>
                <div className="form-group">
                  <label>阶层</label>
                  <input type="text" value={personalInfo.socialClass} onChange={e => set('socialClass', e.target.value)} placeholder="平民, 贵族..." />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label>所属组织</label>
                  <input type="text" value={personalInfo.organization} onChange={e => set('organization', e.target.value)} placeholder="佣兵工会..." />
                </div>
                <div className="form-group">
                  <label>特殊身份</label>
                  <input type="text" value={personalInfo.specialIdentity} onChange={e => set('specialIdentity', e.target.value)} placeholder="转生者..." />
                </div>
              </div>
            </div>
          )}

          {/* Tab: 初始技能 */}
          {rightTab === 'skills' && (
            <div className="world-dynamic-list">
              {Object.entries(personalInfo.initialSkills).map(([name, skill]) => (
                <div key={name} className="world-dynamic-item">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 'var(--space-1)' }}>
                      <input type="text" value={name} onChange={e => updateSkill(name, e.target.value, '描述', skill.描述)} placeholder="技能名称..." style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px' }} />
                      <select value={skill.品质} onChange={e => updateSkill(name, name, '品质', e.target.value)} style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                        {QUALITY_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                    <input type="text" value={skill.描述} onChange={e => updateSkill(name, name, '描述', e.target.value)} placeholder="技能描述..." style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px' }} />
                  </div>
                  <button onClick={() => removeSkill(name)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', flexShrink: 0 }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn-ghost" onClick={addSkill} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-base)', marginTop: '4px' }}><Plus size={14} /> 添加技能</button>
            </div>
          )}

          {/* Tab: 初始物品 */}
          {rightTab === 'items' && (
            <div className="world-dynamic-list">
              {Object.entries(personalInfo.initialItems).map(([name, item]) => (
                <div key={name} className="world-dynamic-item">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 90px', gap: 'var(--space-1)' }}>
                      <input type="text" value={name} onChange={e => updateItem(name, e.target.value, '备注', item.备注)} placeholder="物品名称..." style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px' }} />
                      <input type="number" value={item.数量} onChange={e => updateItem(name, name, '数量', e.target.value)} min={1} style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px' }} />
                      <select value={item.品质} onChange={e => updateItem(name, name, '品质', e.target.value)} style={{ fontSize: 'var(--font-size-base)', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                        {QUALITY_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={() => removeItem(name)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', flexShrink: 0 }}><Trash2 size={14} /></button>
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
              <button className="btn-ghost" onClick={() => { setEditingNpc(null); setNpcEditorOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-base)' }}><Plus size={14} /> 创建NPC</button>
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
        <NpcEditorModal initial={editingNpc} onSave={handleSaveNpc} onCancel={() => { setNpcEditorOpen(false); setEditingNpc(null); }} />
      )}
    </div>
  );
}
