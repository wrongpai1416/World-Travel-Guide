import { useState } from 'react';
import {
  User, Users, ScrollText, Swords, BookOpen, Star, X,
  BarChart3, Tag, Anchor, Briefcase, MapPin, Sparkles,
  Brain, Dna, Zap, Backpack, Shield,
  FileText, Edit3, Trash2, Plus, Save,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Avatar from '../../shared/Avatar';
import EmptyState from '../../shared/EmptyState';
import type { GameState, NPCData } from '../../../schema/variables';
import type { CustomNpc } from '../../../storage/db';
import { ExcelRow } from '../../shared/ExcelRow';
import { getQualityColor } from '../../shared/qualityUtils';
import { saveNpcTemplate } from '../../../storage/templateStore';
import { useDialog } from '../../shared/Dialog';
import { v4 as uuid } from 'uuid';

/** 将运行时 NPCData（中文键）转换为向导 CustomNpc 格式 */
function npcDataToCustomNpc(npc: NPCData): CustomNpc {
  const ext = npc as any;
  const pi = npc.个人信息 ?? {} as any;
  const sj = npc.社会身份 ?? {} as any;
  const rd = npc.关系数据 ?? {} as any;

  // 技能列表：可能是 string[] 或 Record，统一转为 Record
  let skillsList: CustomNpc['skillsList'] = {};
  if (ext.技能列表 && typeof ext.技能列表 === 'object') {
    if (Array.isArray(ext.技能列表)) {
      ext.技能列表.forEach((s: any, i: number) => {
        if (typeof s === 'string') skillsList[s] = { 描述: '', 类型: '', 品质: '普通' };
        else if (s?.name) skillsList[s.name] = { 描述: s.描述 || '', 类型: s.类型 || '', 品质: s.品质 || '普通' };
      });
    } else {
      for (const [k, v] of Object.entries(ext.技能列表)) {
        if (typeof v === 'string') skillsList[k] = { 描述: v, 类型: '', 品质: '普通' };
        else if (v && typeof v === 'object') {
          const sv = v as any;
          skillsList[k] = { 描述: sv.描述 || '', 类型: sv.类型 || '', 品质: sv.品质 || '普通' };
        }
      }
    }
  }

  // 物品列表：同上
  let itemsList: CustomNpc['itemsList'] = {};
  if (ext.物品列表 && typeof ext.物品列表 === 'object') {
    if (Array.isArray(ext.物品列表)) {
      ext.物品列表.forEach((item: any, i: number) => {
        if (typeof item === 'string') itemsList[item] = { 数量: 1, 类型: '', 品质: '普通', 备注: '' };
        else if (item?.name) itemsList[item.name] = { 数量: item.数量 || 1, 类型: item.类型 || '', 品质: item.品质 || '普通', 备注: item.备注 || '' };
      });
    } else {
      for (const [k, v] of Object.entries(ext.物品列表)) {
        if (typeof v === 'string') itemsList[k] = { 数量: 1, 类型: '', 品质: '普通', 备注: v };
        else if (v && typeof v === 'object') {
          const iv = v as any;
          itemsList[k] = { 数量: iv.数量 || 1, 类型: iv.类型 || '', 品质: iv.品质 || '普通', 备注: iv.备注 || '' };
        }
      }
    }
  }

  return {
    id: uuid(),
    name: npc.姓名 || '',
    gender: npc.性别 || '',
    age: String(npc.年龄 ?? ''),
    race: npc.种族 || '',
    relationshipType: rd.关系类型 || '',
    occupation: sj.职业 || '',
    socialStatus: sj.社会地位 || '',
    personality: pi.表性格 || ext.性格 || '',
    hiddenPersonality: pi.里性格 || '',
    currentThought: pi.当前想法 || '',
    appearance: pi.外貌 || '',
    currentOutfit: pi.当前穿着 || ext.穿着 || '',
    currentAction: ext.当前行动 || pi.当前状态 || '',
    currentLocation: pi.当前位置 || '',
    currentState: pi.当前状态 || '',
    shortTermGoal: ext.短期目标 || '',
    longTermGoal: ext.长期目标 || '',
    background: npc.背景 || pi.备注 || '',
    chronicles: [],  // 事迹是游戏运行时数据，不存入模板
    skillsList,
    itemsList,
  };
}

interface Props {
  gameState: GameState;
  onSummarizeChronicles?: (npcId: string) => Promise<boolean>;
  onUpdateChronicles?: (npcId: string, chronicles: string[]) => void;
  onMergeChronicles?: (npcId: string, startIndex: number, endIndex: number) => Promise<boolean>;
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
  const rd = npc.关系数据 ?? { 好感度: 0, 关系类型: '未知', 核心锚点: [] };
  const sj = npc.社会身份 ?? { 职业: '', 社会地位: '' };
  const fav = favorClass(rd.好感度);
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
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: '2px' }}>
          <span style={{ color: 'var(--text-muted)' }}>好感度</span>
          <span style={{ color: fav.color, fontWeight: '500' }}>{rd.好感度}</span>
        </div>
        <GaugeBar value={rd.好感度} color={fav.color} />
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
  const [selected, setSelected] = useState<{ name: string; fields: [string, string][] } | null>(null);

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

    // 提取所有可展示的字段
    const extractFields = (obj: Record<string, unknown>): [string, string][] => {
      return Object.entries(obj)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([fk, fv]) => [fk, typeof fv === 'object' ? JSON.stringify(fv) : String(fv)]);
    };

    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          {entries.map(([k, v]) => {
            const isObject = typeof v === 'object' && v !== null;
            const quality = isObject && (v as any).品质 ? (v as any).品质 as string : undefined;
            const desc = isObject && (v as any).描述 ? (v as any).描述 as string : undefined;
            const count = isObject && (v as any).数量 ? (v as any).数量 as number : undefined;
            const qColor = quality ? getQualityColor(quality) : undefined;

            return (
              <div key={k} style={{
                padding: '10px 12px',
                border: `1px solid ${qColor ? qColor + '30' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                background: qColor ? `linear-gradient(135deg, ${qColor}08, ${qColor}03)` : 'var(--bg-primary)',
                cursor: isObject ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}
              onClick={() => {
                if (isObject) setSelected({ name: k, fields: extractFields(v as Record<string, unknown>) });
              }}
              onMouseEnter={e => { if (isObject) { e.currentTarget.style.borderColor = qColor || 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { if (isObject) { e.currentTarget.style.borderColor = qColor ? qColor + '30' : 'var(--border)'; e.currentTarget.style.transform = ''; } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  {qColor && <span style={{ color: qColor, fontSize: '10px' }}>●</span>}
                  <span style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
                </div>
                {count !== undefined && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>×{count}</div>}
                {quality && <div style={{ fontSize: 'var(--font-size-xs)', color: qColor }}>{quality}</div>}
                {desc && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>}
              </div>
            );
          })}
        </div>

        {/* 详情弹窗 */}
        {selected && (
          <div
            onClick={() => setSelected(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '20px', maxWidth: '360px', width: '90%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontWeight: '700', fontSize: 'var(--font-size-lg)' }}>{selected.name}</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px', lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selected.fields.map(([fk, fv]) => (
                  <div key={fk} style={{ display: 'flex', gap: '8px', fontSize: 'var(--font-size-sm)' }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: '56px', flexShrink: 0 }}>{fk}</span>
                    <span style={{ color: 'var(--text-primary)', lineHeight: '1.5', wordBreak: 'break-all' }}>{fv}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  return null;
}

// 物品背包网格 (6×8)
function InventoryGrid({ data }: { data: Record<string, unknown> | undefined }) {
  const [selected, setSelected] = useState<{ name: string; fields: [string, string][] } | null>(null);

  const extractFields = (obj: Record<string, unknown>): [string, string][] => {
    return Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([fk, fv]) => [fk, typeof fv === 'object' ? JSON.stringify(fv) : String(fv)]);
  };

  const entries = data ? Object.entries(data) : [];
  const totalSlots = 48; // 6×8

  return (
    <>
      <div className="inventory-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '4px',
      }}>
        {Array.from({ length: totalSlots }).map((_, i) => {
          const entry = entries[i];
          if (entry) {
            const [name, value] = entry;
            const isObject = typeof value === 'object' && value !== null;
            const quality = isObject && (value as any).品质 ? (value as any).品质 as string : undefined;
            const count = isObject && (value as any).数量 ? (value as any).数量 as number : undefined;
            const qColor = quality ? getQualityColor(quality) : 'var(--text-muted)';

            return (
              <div
                key={name}
                onClick={() => {
                  if (isObject) setSelected({ name, fields: extractFields(value as Record<string, unknown>) });
                }}
                style={{
                  aspectRatio: '1',
                  padding: '6px 4px',
                  border: `1px solid ${quality ? qColor + '40' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: quality ? `linear-gradient(135deg, ${qColor}08, ${qColor}03)` : 'var(--bg-primary)',
                  cursor: isObject ? 'pointer' : 'default',
                  transition: 'all 0.12s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  minWidth: 0,
                }}
                onMouseEnter={e => { if (isObject) e.currentTarget.style.borderColor = qColor; }}
                onMouseLeave={e => { if (isObject) e.currentTarget.style.borderColor = quality ? qColor + '40' : 'var(--border)'; }}
              >
                {count && count > 1 && (
                  <span style={{
                    position: 'absolute', top: '2px', right: '3px',
                    fontSize: '9px', fontWeight: '700', color: qColor,
                    lineHeight: 1,
                  }}>×{count}</span>
                )}
                <Backpack size={16} color={qColor} />
                <div style={{
                  fontSize: '9px', fontWeight: '500', marginTop: '2px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center',
                }}>{name}</div>
              </div>
            );
          }
          // 空格子
          return (
            <div
              key={`empty-${i}`}
              style={{
                aspectRatio: '1',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
              }}
            />
          );
        })}
      </div>

      {/* 详情弹窗 */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: '16px', maxWidth: '340px', width: '92%', overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{
              background: 'var(--bg-tertiary)', padding: '14px 18px',
              borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontWeight: '700', fontSize: 'var(--font-size-lg)' }}>{selected.name}</span>
              <button onClick={() => setSelected(null)} style={{
                background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                width: '26px', height: '26px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selected.fields.map(([fk, fv]) => (
                <div key={fk} style={{ display: 'flex', gap: '8px', fontSize: 'var(--font-size-sm)' }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: '56px', flexShrink: 0 }}>{fk}</span>
                  <span style={{ color: 'var(--text-primary)', lineHeight: '1.5', wordBreak: 'break-all' }}>{fv}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 事迹弹窗组件
function DeedsModal({ npcId, npcName, chronicles: initialChronicles, onClose, onUpdate, onSummarize, onMerge }: {
  npcId: string; npcName: string; chronicles: string[];
  onClose: () => void; onUpdate: (npcId: string, chronicles: string[]) => void;
  onSummarize?: (npcId: string) => Promise<boolean>;
  onMerge?: (npcId: string, startIndex: number, endIndex: number) => Promise<boolean>;
}) {
  const [chronicles, setChronicles] = useState<string[]>(initialChronicles);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeStart, setMergeStart] = useState<number | null>(null);
  const [mergeEnd, setMergeEnd] = useState<number | null>(null);

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

  const handleMergeClick = (idx: number) => {
    if (mergeStart === null) {
      setMergeStart(idx);
      setMergeEnd(idx);
    } else if (mergeEnd !== null && idx > mergeStart) {
      setMergeEnd(idx);
    } else {
      setMergeStart(idx);
      setMergeEnd(idx);
    }
  };

  const handleMergeConfirm = async () => {
    if (mergeStart === null || mergeEnd === null || !onMerge) return;
    setMerging(true);
    try {
      const ok = await onMerge(npcId, mergeStart, mergeEnd);
      if (ok) {
        // 重新读取合并后的数据
        setChronicles(prev => {
          const selected = prev.slice(mergeStart, mergeEnd + 1);
          // 合并后的结果需要从父组件刷新，这里先做乐观更新
          return prev;
        });
        setMergeMode(false);
        setMergeStart(null);
        setMergeEnd(null);
        // 通知父组件刷新
        onClose();
      }
    } finally {
      setMerging(false);
    }
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
            {chronicles.length >= 2 && onMerge && (
              mergeMode ? (
                <>
                  {mergeStart !== null && mergeEnd !== null && mergeEnd > mergeStart && (
                    <button onClick={handleMergeConfirm} disabled={merging} style={{
                      border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 'var(--font-size-sm)',
                      background: merging ? 'var(--bg-tertiary)' : 'var(--accent-dim)',
                      color: merging ? 'var(--text-muted)' : 'var(--accent)', cursor: merging ? 'wait' : 'pointer', fontWeight: '500',
                    }}>{merging ? '合并中...' : `合并 ${mergeStart + 1}-${mergeEnd + 1}`}</button>
                  )}
                  <button onClick={() => { setMergeMode(false); setMergeStart(null); setMergeEnd(null); }} style={{
                    border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 'var(--font-size-sm)',
                    background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer',
                  }}>取消</button>
                </>
              ) : (
                <button onClick={() => setMergeMode(true)} style={{
                  border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 'var(--font-size-sm)',
                  background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', fontWeight: '500',
                }}>合并事迹</button>
              )
            )}
            {chronicles.length > 5 && onSummarize && !mergeMode && (
              <button onClick={async () => { setSummarizing(true); try { await onSummarize(npcId); } finally { setSummarizing(false); } }}
                disabled={summarizing} style={{
                  border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 'var(--font-size-sm)',
                  background: summarizing ? 'var(--bg-tertiary)' : 'var(--accent-dim)',
                  color: summarizing ? 'var(--text-muted)' : 'var(--accent)', cursor: summarizing ? 'wait' : 'pointer', fontWeight: '500',
                }}>{summarizing ? '总结中...' : '总结事迹'}</button>
            )}
            <button onClick={onClose} className="btn-ghost btn-icon-sm" style={{ background: 'var(--bg-tertiary)' }}><X size={14} /></button>
          </div>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {chronicles.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {chronicles.map((c, i) => {
                const inMergeRange = mergeMode && mergeStart !== null && mergeEnd !== null && i >= mergeStart && i <= mergeEnd;
                const isMergeStart = mergeMode && mergeStart === i;
                const isMergeEnd = mergeMode && mergeEnd === i;
                return (
                <div key={i} onClick={() => mergeMode ? handleMergeClick(i) : undefined} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', borderBottom: '1px solid var(--border)',
                  background: inMergeRange ? 'var(--accent-dim)' : 'transparent',
                  cursor: mergeMode ? 'pointer' : 'default',
                  borderRadius: inMergeRange ? 'var(--radius-sm)' : undefined,
                  borderLeft: isMergeStart ? '3px solid var(--accent)' : isMergeEnd ? '3px solid var(--accent)' : '3px solid transparent',
                }}>
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
                );
              })}
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
function NPCDetail({ npc, npcId, onClose, onSummarizeChronicles, onUpdateChronicles, onMergeChronicles }: {
  npc: NPCData; npcId: string; onClose: () => void;
  onSummarizeChronicles?: (npcId: string) => Promise<boolean>;
  onUpdateChronicles?: (npcId: string, chronicles: string[]) => void;
  onMergeChronicles?: (npcId: string, startIndex: number, endIndex: number) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [showDeeds, setShowDeeds] = useState(false);
  const { DialogUI, prompt: dlgPrompt, alert: dlgAlert } = useDialog();
  const chronicles = ((npc as any).人物事迹 as string[] | undefined) ?? [];

  const ext = npc as any;
  const rd = npc.关系数据 ?? { 好感度: 0, 关系类型: '未知', 核心锚点: [] as any[] };
  const sj = npc.社会身份 ?? { 职业: '', 社会地位: '' };
  const pi = npc.个人信息 ?? { 外貌: '', 表性格: '', 里性格: '', 当前想法: '', 当前穿着: '', 当前位置: '', 当前状态: '', 备注: '' };

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
          <button
            onClick={async () => {
              const name = await dlgPrompt('请输入NPC模板名称：', { defaultValue: npc.姓名 || 'NPC模板', title: '保存NPC模板' });
              if (!name?.trim()) return;
              const customNpc = npcDataToCustomNpc(npc);
              saveNpcTemplate(name.trim(), customNpc);
              await dlgAlert(`NPC模板「${name.trim()}」已保存 ✓`);
            }}
            style={{
              border: 'none', background: 'var(--bg-tertiary)', width: '28px', height: '28px',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--accent)',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="保存为NPC模板"
          >
            <Save size={14} />
          </button>
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
                </Section>

                <Section icon={BarChart3} title="关系数据">
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '2px' }}>好感度 {rd.好感度}</div>
                    <GaugeBar value={rd.好感度} color={favorClass(rd.好感度).color} />
                  </div>
                  <ExcelRow label="关系类型" value={rd.关系类型} />
                </Section>

                {rd.核心锚点.length > 0 && (
                  <Section icon={Anchor} title="核心锚点">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {rd.核心锚点.map((a, i) => {
                        // 兼容两种格式：字符串 或 {事件, 影响, 权重} 对象
                        const text = typeof a === 'string' ? a : (a as any).事件 ?? JSON.stringify(a);
                        return (
                          <span key={i} style={{
                            padding: '4px 10px', background: 'var(--bg-primary)',
                            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                            fontSize: 'var(--font-size-sm)',
                          }}>
                            {text}
                          </span>
                        );
                      })}
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

                {(ext.背景 || npc.背景) && (
                  <Section icon={BookOpen} title="背景">
                    <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: '1.6', color: 'var(--text-secondary)' }}>{ext.背景 || npc.背景}</div>
                  </Section>
                )}

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
                {ext.特殊能力 && (
                  <Section icon={Sparkles} title="特殊能力">
                    <div style={{ padding: '8px 10px', background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-base)', lineHeight: '1.5' }}>{ext.特殊能力}</div>
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

                {!ext.特殊能力 && !ext.属性 && !ext.天赋 && !ext.技能列表 && (
                  <EmptyState icon={Swords} message="暂无技能数据" />
                )}
              </div>
            )}

            {/* Tab 4: 物品列表 - 6×8 背包网格 */}
            {tab === 'items' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ext.物品列表 && (
                  <Section icon={Backpack} title="物品列表">
                    <InventoryGrid data={ext.物品列表} />
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
          onMerge={onMergeChronicles}
        />
      )}

      {DialogUI}
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

export default function CharacterGrid({ gameState, onSummarizeChronicles, onUpdateChronicles, onMergeChronicles }: Props) {
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
      {selected && <NPCDetail npc={selected.data} npcId={selected.id} onClose={() => setSelected(null)} onSummarizeChronicles={onSummarizeChronicles} onUpdateChronicles={onUpdateChronicles} onMergeChronicles={onMergeChronicles} />}
    </div>
  );
}
