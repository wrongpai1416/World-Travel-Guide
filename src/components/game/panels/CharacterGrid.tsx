import { useState } from 'react';
import {
  User, Users, ScrollText, Swords, BookOpen, Star, X,
  BarChart3, Tag, Anchor, Briefcase, MapPin, Sparkles,
  Brain, Dna, MessageSquare, Zap, Backpack, Shield,
  FileText, Edit3, Trash2, Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Avatar from '../../shared/Avatar';
import EmptyState from '../../shared/EmptyState';
import type { GameState, NPCData } from '../../../schema/variables';
import { ExcelRow } from '../../shared/ExcelRow';

interface Props {
  gameState: GameState;
  onSummarizeChronicles?: (npcId: string) => Promise<boolean>;
  onUpdateChronicles?: (npcId: string, chronicles: string[]) => void;
}

type DetailTab = 'overview' | 'dossier' | 'skills' | 'items';

const DETAIL_TABS: { id: DetailTab; icon: LucideIcon; label: string }[] = [
  { id: 'overview', icon: User, label: '概览' },
  { id: 'dossier', icon: FileText, label: '档案' },
  { id: 'skills', icon: Swords, label: '技能列表' },
  { id: 'items', icon: Backpack, label: '物品列表' },
];

function favorClass(v: number) {
  if (v >= 60) return { color: '#22c55e', label: '高' };
  if (v >= 20) return { color: '#3b82f6', label: '中' };
  if (v >= -20) return { color: '#9ca3af', label: '平' };
  return { color: '#ef4444', label: '低' };
}

function categoryStyle(cat?: string) {
  switch (cat) {
    case '在场': return { bg: '#dcfce7', color: '#166534', label: '在场' };
    case '离场': return { bg: '#f3f4f6', color: '#6b7280', label: '离场' };
    case '重点': return { bg: '#fef3c7', color: '#92400e', label: '重点' };
    default: return { bg: '#dcfce7', color: '#166534', label: '在场' };
  }
}

function GaugeBar({ value, color }: { value: number; color: string }) {
  const pct = (value + 100) / 200 * 100;
  return (
    <div style={{ height: '7px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
    </div>
  );
}

// NPC 卡片
function NPCCard({ id, npc, onClick }: { id: string; npc: NPCData; onClick: () => void }) {
  const rd = npc.关系数据 ?? { 好感度: 0, 信任度: 0, 关系类型: '未知', 印象标签: [], 核心锚点: [] };
  const sj = npc.社会身份 ?? { 职业: '', 所属势力: '', 社会地位: '' };
  const fav = favorClass(rd.好感度);
  const tru = favorClass(rd.信任度);
  const cat = categoryStyle(npc.人物分类);
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 2px 8px var(--accent-glow)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* 头像 + 名字 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <Avatar name={npc.姓名 || id} size="md" />
        <div style={{ flex: '1', minWidth: 0 }}>
          <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            {npc.重要NPC && <Star size={13} fill="var(--warning)" color="var(--warning)" />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.姓名 || id}</span>
            <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '8px', background: cat.bg, color: cat.color, fontWeight: '500', flexShrink: 0 }}>{cat.label}</span>
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
            {sj.职业}
          </div>
        </div>
      </div>
      {/* 好感度 */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: '2px' }}>
          <span style={{ color: 'var(--text-muted)' }}>好感度</span>
          <span style={{ color: fav.color, fontWeight: '500' }}>{rd.好感度}</span>
        </div>
        <GaugeBar value={rd.好感度} color={fav.color} />
      </div>
      {/* 信任度 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: '2px' }}>
          <span style={{ color: 'var(--text-muted)' }}>信任度</span>
          <span style={{ color: tru.color, fontWeight: '500' }}>{rd.信任度}</span>
        </div>
        <GaugeBar value={rd.信任度} color={tru.color} />
      </div>
    </div>
  );
}

// 标签列表组件
function TagList({ items, accent }: { items: string[]; accent?: boolean }) {
  if (!items || items.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>无</span>;
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {items.map((t, i) => (
        <span key={i} style={{
          padding: '2px 10px', borderRadius: '12px', fontSize: 'var(--font-size-sm)',
          background: accent ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
          color: accent ? 'var(--accent)' : 'var(--text-secondary)',
        }}>{t}</span>
      ))}
    </div>
  );
}

// Record 键值网格
function RecordGrid({ data, label }: { data: Record<string, unknown> | undefined; label?: string }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div>
      {label && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {Object.entries(data).map(([k, v]) => (
          <span key={k} style={{
            padding: '3px 10px', borderRadius: '6px', fontSize: 'var(--font-size-sm)',
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
          }}>
            {k}: <strong style={{ color: 'var(--text-primary)' }}>{String(v)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

// 列表渲染（string[] 或 Record）
function ListOrRecord({ data, emptyText }: { data: string[] | Record<string, unknown> | undefined; emptyText?: string }) {
  if (!data) return <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{emptyText || '无'}</span>;
  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{emptyText || '无'}</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {data.map((item, i) => (
          <div key={i} style={{ padding: '3px 0', fontSize: 'var(--font-size-sm)', borderBottom: '1px solid var(--border)' }}>• {item}</div>
        ))}
      </div>
    );
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{emptyText || '无'}</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--font-size-sm)' }}>
            <span style={{ width: '100px', color: 'var(--text-muted)', flexShrink: 0, fontSize: 'var(--font-size-sm)' }}>{k}</span>
            <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// 事迹弹窗组件
function DeedsModal({ npcId, npcName, chronicles: initialChronicles, onClose, onUpdate, onSummarize }: {
  npcId: string; npcName: string; chronicles: string[];
  onClose: () => void; onUpdate: (npcId: string, chronicles: string[]) => void;
  onSummarize?: (npcId: string) => Promise<boolean>;
}) {
  const [chronicles, setChronicles] = useState<string[]>(initialChronicles);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const [summarizing, setSummarizing] = useState(false);

  const handleSave = (idx: number) => {
    const updated = [...chronicles];
    updated[idx] = editText.trim();
    setChronicles(updated);
    onUpdate(npcId, updated);
    setEditingIndex(null);
  };

  const handleDelete = (idx: number) => {
    const updated = chronicles.filter((_, i) => i !== idx);
    setChronicles(updated);
    onUpdate(npcId, updated);
  };

  const handleAdd = () => {
    if (!addText.trim()) return;
    const updated = [...chronicles, addText.trim()];
    setChronicles(updated);
    onUpdate(npcId, updated);
    setAddText('');
    setAdding(false);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, animation: 'fadeIn 0.15s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
        width: '90%', maxWidth: '520px', maxHeight: '75vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* 头部 */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontWeight: '600', fontSize: 'var(--font-size-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScrollText size={16} />人物事迹
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: '400' }}>
              {chronicles.length > 0 ? `共 ${chronicles.length} 条` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {chronicles.length > 5 && onSummarize && (
              <button onClick={async () => { setSummarizing(true); try { await onSummarize(npcId); } finally { setSummarizing(false); } }}
                disabled={summarizing} style={{
                  border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 'var(--font-size-sm)',
                  background: summarizing ? 'var(--bg-tertiary)' : 'var(--accent-dim)',
                  color: summarizing ? 'var(--text-muted)' : 'var(--accent)', cursor: summarizing ? 'wait' : 'pointer', fontWeight: '500',
                }}>{summarizing ? '总结中...' : '总结事迹'}</button>
            )}
            <button onClick={onClose} style={{ border: 'none', background: 'var(--bg-tertiary)', width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {chronicles.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {chronicles.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', flexShrink: 0, marginTop: '2px' }}>{i + 1}.</span>
                  {editingIndex === i ? (
                    <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{
                        flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)',
                        resize: 'vertical', minHeight: '60px', fontFamily: 'inherit',
                      }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button onClick={() => handleSave(i)} style={{ border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 'var(--font-size-sm)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer' }}>保存</button>
                        <button onClick={() => setEditingIndex(null)} style={{ border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 'var(--font-size-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer' }}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', lineHeight: '1.5' }}>{c}</span>
                      <button onClick={() => { setEditingIndex(i); setEditText(c); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }} title="编辑"><Edit3 size={13} /></button>
                      <button onClick={() => handleDelete(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }} title="删除"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ScrollText} message="暂无事迹记录" />
          )}
        </div>

        {/* 底部添加 */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {adding ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <textarea value={addText} onChange={e => setAddText(e.target.value)} placeholder="输入新事迹..." style={{
                flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)',
                resize: 'vertical', minHeight: '50px', fontFamily: 'inherit',
              }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button onClick={handleAdd} style={{ border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 'var(--font-size-sm)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer' }}>添加</button>
                <button onClick={() => { setAdding(false); setAddText(''); }} style={{ border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 'var(--font-size-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer' }}>取消</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{
              width: '100%', padding: '8px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            }}><Plus size={14} /> 添加事迹</button>
          )}
        </div>
      </div>
    </div>
  );
}

// NPC 详情弹窗
function NPCDetail({ npc, npcId, onClose, onSummarizeChronicles, onUpdateChronicles }: {
  npc: NPCData; npcId: string; onClose: () => void;
  onSummarizeChronicles?: (npcId: string) => Promise<boolean>;
  onUpdateChronicles?: (npcId: string, chronicles: string[]) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [showDeeds, setShowDeeds] = useState(false);
  const chronicles = ((npc as any).人物事迹 as string[] | undefined) ?? [];

  const ext = npc as any;
  const rd = npc.关系数据 ?? { 好感度: 0, 信任度: 0, 关系类型: '未知', 印象标签: [] as string[], 核心锚点: [] as any[] };
  const sj = npc.社会身份 ?? { 职业: '', 所属势力: '', 社会地位: '' };
  const pi = npc.个人信息 ?? { 价值观: { 喜好: [], 厌恶: [], 雷区: '' }, 心理创伤: '', 外貌: '', 表性格: '', 里性格: '', 当前想法: '', 特殊能力: '', 当前穿着: '', 当前位置: '', 当前状态: '', 持有物品: '', 过往经历: [], 备注: '' };
  const _交互记忆 = npc.交互记忆 || {};
  const 交互记忆 = {
    未完成约定: Array.isArray(_交互记忆.未完成约定) ? _交互记忆.未完成约定 : [],
    共同秘密: Array.isArray(_交互记忆.共同秘密) ? _交互记忆.共同秘密 : [],
    赠礼记录: Array.isArray(_交互记忆.赠礼记录) ? _交互记忆.赠礼记录 : [],
  };

  const cat = categoryStyle(npc.人物分类);

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          width: '92%', maxWidth: '640px', height: '82vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* 头部 */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <Avatar name={npc.姓名 || npcId} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '600', fontSize: 'var(--font-size-lg)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {npc.重要NPC && <Star size={14} fill="var(--warning)" color="var(--warning)" />}
              <span>{npc.姓名 || npcId}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '10px', background: cat.bg, color: cat.color, fontWeight: '500' }}>{cat.label}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', padding: '1px 7px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{npc.种族 || '未知种族'}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', padding: '1px 7px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{npc.性别}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', padding: '1px 7px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{npc.年龄}岁</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'var(--bg-tertiary)', width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>

        {/* 主体：左侧 Tab 导航 + 右侧内容 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 左侧竖向 Tab 栏 */}
          <div style={{
            width: '48px', flexShrink: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', padding: '8px 0', gap: '2px',
            borderRight: '1px solid var(--border)', background: 'var(--bg-primary)',
          }}>
            {DETAIL_TABS.map(t => {
              const TabIcon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  title={t.label}
                  style={{
                    width: '36px', height: '36px', border: 'none', borderRadius: 'var(--radius-md)',
                    background: tab === t.id ? 'var(--accent-dim)' : 'transparent',
                    color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.background = 'var(--accent-dim)'; }}
                  onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <TabIcon size={16} strokeWidth={1.5} />
                </button>
              );
            })}
          </div>

          {/* 右侧内容区 */}
          <div style={{ flex: 1, padding: '14px 18px', overflowY: 'auto', fontSize: 'var(--font-size-base)', lineHeight: '1.6' }}>

            {/* Tab 1: 概览 */}
            {tab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Section icon={User} title="基本信息">
                  <ExcelRow label="姓名" value={npc.姓名} />
                  <ExcelRow label="种族" value={npc.种族} />
                  <ExcelRow label="性别" value={npc.性别} />
                  <ExcelRow label="年龄" value={String(npc.年龄)} />
                  <ExcelRow label="婚姻" value={npc.婚姻状态} />
                  <ExcelRow label="联系方式" value={ext.联系方式} />
                </Section>

                <Section icon={BarChart3} title="关系数据">
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '2px' }}>好感度 {rd.好感度}</div>
                      <GaugeBar value={rd.好感度} color={favorClass(rd.好感度).color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '2px' }}>信任度 {rd.信任度}</div>
                      <GaugeBar value={rd.信任度} color={favorClass(rd.信任度).color} />
                    </div>
                  </div>
                  <ExcelRow label="关系类型" value={rd.关系类型} />
                </Section>

                {rd.印象标签.length > 0 && (
                  <Section icon={Tag} title="印象标签">
                    <TagList items={rd.印象标签} accent />
                  </Section>
                )}

                {rd.核心锚点.length > 0 && (
                  <Section icon={Anchor} title="核心锚点">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {rd.核心锚点.map((a, i) => (
                        <div key={i} style={{ padding: '6px 10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 'var(--font-size-sm)' }}>
                          <div style={{ fontWeight: '600', marginBottom: '2px' }}>{a.事件}</div>
                          <div style={{ color: 'var(--text-muted)' }}>影响: {a.影响} · 权重: {a.权重}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                <Section icon={Briefcase} title="社会身份">
                  <ExcelRow label="职业" value={sj.职业} />
                  <ExcelRow label="地位" value={sj.社会地位} />
                </Section>

                <Section icon={MapPin} title="状态">
                  <ExcelRow label="位置" value={pi.当前位置} />
                  <ExcelRow label="状态" value={pi.当前状态} />
                </Section>
              </div>
            )}

            {/* Tab 2: 档案 */}
            {tab === 'dossier' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Section icon={Sparkles} title="外貌与性格">
                  <ExcelRow label="外貌" value={pi.外貌} />
                  <ExcelRow label="表性格" value={pi.表性格} />
                  <ExcelRow label="里性格" value={pi.里性格} />
                  <ExcelRow label="穿着" value={pi.当前穿着} />
                </Section>

                <Section icon={Brain} title="内心世界">
                  <ExcelRow label="当前想法" value={pi.当前想法 || ext.内心想法} />
                  <ExcelRow label="当前行动" value={ext.当前行动} />
                  <ExcelRow label="短期目标" value={ext.短期目标} />
                  <ExcelRow label="长期目标" value={ext.长期目标} />
                </Section>

                {(ext.种族描述 || ext.种族效果 || (ext.种族特性 && ext.种族特性.length > 0)) && (
                  <Section icon={Dna} title="种族信息">
                    <ExcelRow label="种族描述" value={ext.种族描述} />
                    <ExcelRow label="种族效果" value={ext.种族效果} />
                    {ext.种族特性 && ext.种族特性.length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '3px' }}>种族特性</div>
                        <TagList items={ext.种族特性} />
                      </div>
                    )}
                  </Section>
                )}

                {(交互记忆.未完成约定.length > 0 || 交互记忆.共同秘密.length > 0 || 交互记忆.赠礼记录.length > 0) && (
                  <Section icon={MessageSquare} title="交互记忆">
                    {交互记忆.未完成约定.length > 0 && (
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '3px' }}>未完成约定</div>
                        <TagList items={交互记忆.未完成约定} />
                      </div>
                    )}
                    {交互记忆.共同秘密.length > 0 && (
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '3px' }}>共同秘密</div>
                        <TagList items={交互记忆.共同秘密} />
                      </div>
                    )}
                    {交互记忆.赠礼记录.length > 0 && (
                      <div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '3px' }}>赠礼记录</div>
                        <TagList items={交互记忆.赠礼记录} />
                      </div>
                    )}
                  </Section>
                )}

                {pi.备注 && (
                  <Section icon={BookOpen} title="备注">
                    <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: '1.5', color: 'var(--text-secondary)' }}>{pi.备注}</div>
                  </Section>
                )}

                {/* 人物事迹入口 */}
                <Section icon={ScrollText} title="人物事迹">
                  <button onClick={() => setShowDeeds(true)} style={{
                    width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ScrollText size={14} />查看人物事迹
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                      {chronicles && chronicles.length > 0 ? `${chronicles.length} 条` : '暂无'}
                    </span>
                  </button>
                </Section>
              </div>
            )}

            {/* Tab 3: 技能列表 */}
            {tab === 'skills' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {pi.特殊能力 && (
                  <Section icon={Sparkles} title="特殊能力">
                    <div style={{ padding: '8px 10px', background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-base)', lineHeight: '1.5' }}>{pi.特殊能力}</div>
                  </Section>
                )}

                {ext.属性 && Object.keys(ext.属性).length > 0 && (
                  <Section icon={BarChart3} title="属性">
                    <RecordGrid data={ext.属性} />
                  </Section>
                )}

                {ext.天赋 && ext.天赋.length > 0 && (
                  <Section icon={Star} title="天赋">
                    <TagList items={ext.天赋} accent />
                  </Section>
                )}

                {ext.技能列表 && (
                  <Section icon={Zap} title="技能列表">
                    <ListOrRecord data={ext.技能列表} emptyText="暂无技能" />
                  </Section>
                )}

                {!pi.特殊能力 && !ext.属性 && !ext.天赋 && !ext.技能列表 && (
                  <EmptyState icon={Swords} message="暂无技能数据" />
                )}
              </div>
            )}

            {/* Tab 4: 物品列表 */}
            {tab === 'items' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ext.物品列表 && (
                  <Section icon={Backpack} title="物品列表">
                    <ListOrRecord data={ext.物品列表} emptyText="暂无物品" />
                  </Section>
                )}

                {ext.装备列表 && Object.keys(ext.装备列表).length > 0 && (
                  <Section icon={Shield} title="装备列表">
                    <RecordGrid data={ext.装备列表} />
                  </Section>
                )}

                {!ext.物品列表 && !ext.装备列表 && (
                  <EmptyState icon={Backpack} message="暂无物品数据" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 事迹弹窗 */}
      {showDeeds && (
        <DeedsModal
          npcId={npcId}
          npcName={npc.姓名 || npcId}
          chronicles={chronicles}
          onClose={() => setShowDeeds(false)}
          onUpdate={onUpdateChronicles ?? (() => {})}
          onSummarize={onSummarizeChronicles}
        />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '600', fontSize: 'var(--font-size-base)' }}>
        <Icon size={15} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />{title}
      </div>
      {children}
    </div>
  );
}

export default function CharacterGrid({ gameState, onSummarizeChronicles, onUpdateChronicles }: Props) {
  const npcs = gameState.人物档案;
  const [selected, setSelected] = useState<{ id: string; data: NPCData } | null>(null);

  const sorted = Object.entries(npcs).sort((a, b) => (b[1].关系数据?.好感度 ?? 0) - (a[1].关系数据?.好感度 ?? 0));

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
        {sorted.map(([id, npc]) => (
          <NPCCard key={id} id={id} npc={npc} onClick={() => setSelected({ id, data: npc })} />
        ))}
      </div>
      {sorted.length === 0 && (
        <EmptyState icon={Users} message="暂无人物档案" />
      )}
      {selected && <NPCDetail npc={selected.data} npcId={selected.id} onClose={() => setSelected(null)} onSummarizeChronicles={onSummarizeChronicles} onUpdateChronicles={onUpdateChronicles} />}
    </div>
  );
}
