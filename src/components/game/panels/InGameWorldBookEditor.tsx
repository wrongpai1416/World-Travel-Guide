// 游戏内世界书编辑器 —— 直接操作 WorldBookEntryDef
// 全局条目( constant )只读 · 触发条目可自由编辑
// 保存直接反馈到游戏引擎的 WorldBookManager
import { useState, useRef, useCallback } from 'react';
import {
  Lock, Trash2, Plus, Save, Upload, Download,
  ChevronDown, ChevronUp, AlertCircle, X, Pencil,
} from 'lucide-react';
import type { GameEngine } from '../../../engine/types';
import { convertWorldBookDefsToEntries } from '../../../worldbook/index';
import { findWorldDef } from '../../../data/worldLoader';
import type { WorldBookEntryDef, WorldDef } from '../../../data/worlds-schema';
import { STORAGE_KEYS } from '../../../config/storageKeys';
import { parseKeywordInput } from '../../../utils/formatNormalize';

interface Props {
  engine: GameEngine;
  worldId: string;
  onClose: () => void;
}

type EditEntry = WorldBookEntryDef & { _dirty?: boolean };

/** 持久化世界到 localStorage（CUSTOM_WORLDS） */
function persistWorldToStorage(updatedWorld: WorldDef) {
  try {
    const stored: WorldDef[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_WORLDS) || '[]');
    const idx = stored.findIndex(w => w.id === updatedWorld.id);
    if (idx >= 0) {
      stored[idx] = updatedWorld;
    } else {
      stored.push(updatedWorld);
    }
    localStorage.setItem(STORAGE_KEYS.CUSTOM_WORLDS, JSON.stringify(stored));
  } catch (err) {
    console.error('[世界书] 持久化失败:', err);
    throw err;
  }
}

/** 读取原始 WorldBookEntryDef[]，优先从 worldDef 读取 */
function loadDefs(worldId: string): WorldBookEntryDef[] {
  const world = findWorldDef(worldId);
  const defs = world?.worldBookEntries ?? [];
  return JSON.parse(JSON.stringify(defs)); // 深拷贝，避免编辑污染原始数据
}

export default function InGameWorldBookEditor({ engine, worldId, onClose }: Props) {
  const [entries, setEntries] = useState<EditEntry[]>(() =>
    loadDefs(worldId),
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [importMsg, setImportMsg] = useState('');
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextUidRef = useRef(Date.now());

  const genUid = useCallback(() => --nextUidRef.current, []);

  const toggleExpand = (uid: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const updateEntry = (uid: number, patch: Partial<EditEntry>) => {
    setEntries(prev => prev.map(e => e.uid === uid ? { ...e, ...patch, _dirty: true } : e));
  };

  const deleteEntry = (uid: number) => {
    setEntries(prev => prev.filter(e => {
      if (e.uid === uid) return !e.constant;
      return true;
    }));
  };

  const addEntry = () => {
    const uid = genUid();
    const newEntry: EditEntry = {
      uid,
      key: [],
      comment: '新条目',
      content: '',
      constant: false,
      order: entries.length + 1,
      position: 'after_char',
      _dirty: true,
    };
    setEntries(prev => [...prev, newEntry]);
    setExpanded(prev => new Set(prev).add(uid));
  };

  // 导出
  const exportEntries = () => {
    const clean = entries.map(({ _dirty, ...rest }) => rest);
    const blob = new Blob([JSON.stringify({ worldBookEntries: clean }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${worldId}_entries.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importEntries = () => fileInputRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const incoming: WorldBookEntryDef[] = data.worldBookEntries || data.entries || [];
        if (!Array.isArray(incoming) || incoming.length === 0) {
          setImportMsg('未找到有效的条目数据');
          return;
        }
        setEntries(prev => {
          const existingUids = new Set(prev.map(e => e.uid));
          const merged = [...prev];
          let added = 0; let replaced = 0;
          for (const item of incoming) {
            if (existingUids.has(item.uid)) {
              merged[merged.findIndex(e => e.uid === item.uid)] = { ...item };
              replaced++;
            } else {
              merged.push({ ...item });
              added++;
            }
          }
          setImportMsg(`导入完成：新增 ${added} 条，替换 ${replaced} 条`);
          return merged;
        });
      } catch {
        setImportMsg('JSON 解析失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = () => {
    if (!engine.worldBook) {
      setSaveMsg({ type: 'error', text: '世界书引擎未初始化' });
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }
    const clean: WorldBookEntryDef[] = entries.map(({ _dirty, ...rest }) => rest);

    // ── Step 1: 持久化到 localStorage ──
    try {
      const world = findWorldDef(worldId);
      if (world) {
        const updatedWorld: WorldDef = { ...world, worldBookEntries: clean };
        persistWorldToStorage(updatedWorld);
      } else {
        setSaveMsg({ type: 'error', text: `未找到世界定义: ${worldId}` });
        setTimeout(() => setSaveMsg(null), 3000);
        return;
      }
    } catch (err) {
      console.error('[世界书保存] 持久化失败:', err);
      setSaveMsg({ type: 'error', text: '持久化失败' });
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }

    // ── Step 2: 重载到运行时引擎 ──
    // 直接替换所有世界专属条目（统一转换，零字段丢失）
    engine.worldBook.clearWorldEntries();
    engine.worldBook.addEntries(convertWorldBookDefsToEntries(clean));

    setSaveMsg({ type: 'success', text: '保存成功' });
    setTimeout(() => { setSaveMsg(null); onClose(); }, 800);
  };

  const globalCount = entries.filter(e => e.constant).length;
  const triggerCount = entries.filter(e => !e.constant).length;

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        {/* 头部 */}
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
            编辑世界书
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {worldId} · {entries.length} 条
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="btn-ghost btn-icon-sm" title="关闭">
            <X size={20} />
          </button>
        </div>

        {/* 提示信息 */}
        <div style={{
          padding: '10px 20px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        }}>
          <span style={badgeStyle('color-mix(in srgb, var(--warning) 12%, transparent)', 'var(--warning)')}>
            <Lock size={12} /> 全局 {globalCount}（只读）
          </span>
          <span style={badgeStyle('color-mix(in srgb, var(--success) 12%, transparent)', 'var(--success)')}>
            <Pencil size={12} /> 触发 {triggerCount}（可编辑）
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', flex: 1, textAlign: 'right' }}>
            保存后立即生效于当前游戏
          </span>
        </div>

        {/* 工具栏 */}
        <div style={toolbarStyle}>
          <button className="wbe-btn wbe-btn-outline" onClick={importEntries} title="导入条目JSON">
            <Upload size={14} /> 导入
          </button>
          <button className="wbe-btn wbe-btn-outline" onClick={exportEntries} title="导出条目JSON">
            <Download size={14} /> 导出
          </button>
          <button className="wbe-btn wbe-btn-ghost" onClick={addEntry} title="新增触发式条目">
            <Plus size={14} /> 新增
          </button>
          <button className="wbe-btn wbe-btn-primary" onClick={handleSave} title="保存并应用到当前游戏">
            <Save size={14} /> 保存
          </button>
        </div>

        {importMsg && (
          <div style={{
            margin: '0 20px 8px', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-sm)',
            background: importMsg.startsWith('导入完成')
              ? 'color-mix(in srgb, var(--success) 8%, transparent)'
              : 'color-mix(in srgb, var(--warning) 8%, transparent)',
            color: importMsg.startsWith('导入完成') ? 'var(--success)' : 'var(--warning)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <AlertCircle size={14} /> {importMsg}
          </div>
        )}

        {saveMsg && (
          <div style={{
            margin: '0 20px 8px', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-sm)',
            background: saveMsg.type === 'success'
              ? 'color-mix(in srgb, var(--success) 8%, transparent)'
              : 'color-mix(in srgb, var(--danger) 8%, transparent)',
            color: saveMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <AlertCircle size={14} /> {saveMsg.text}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />

        {/* 条目列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px 20px' }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <p>暂无条目</p>
              <button className="wbe-btn wbe-btn-outline" onClick={addEntry} style={{ marginTop: '12px' }}>新增条目</button>
            </div>
          ) : (
            entries.map((entry, idx) => {
              const isExpanded = expanded.has(entry.uid);
              const isGlobal = entry.constant;
              const isEnabled = !entry.disable;
              const keys = entry.key ?? [];

              return (
                <div key={entry.uid} className={`wbe-entry${isGlobal ? ' wbe-entry-global' : ''}${isExpanded ? ' wbe-entry-expanded' : ''}`}>
                  {/* 条目头部 */}
                  <div className="wbe-entry-header" onClick={() => toggleExpand(entry.uid)}>
                    <div className="wbe-entry-left">
                      <span className="wbe-entry-order">{idx + 1}</span>
                      {isGlobal ? (
                        <span className="wbe-entry-lock" title="全局条目（只读）"><Lock size={13} /></span>
                      ) : isEnabled ? (
                        <span className="wbe-entry-type-dot" />
                      ) : (
                        <span className="wbe-entry-type-dot" style={{ background: 'var(--text-muted)' }} />
                      )}
                      <span className="wbe-entry-title">{entry.comment || '（无标题）'}</span>
                    </div>
                    <div className="wbe-entry-right">
                      {isGlobal && <span className="wbe-tag-locked">受保护</span>}
                      {!isGlobal && (
                        <button
                          className="wbe-entry-delete"
                          onClick={e2 => { e2.stopPropagation(); deleteEntry(entry.uid); }}
                          title="删除条目"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* 展开内容 */}
                  {isExpanded && (
                    <div className="wbe-entry-body">
                      {/* 标题 */}
                      <label className="wbe-field">
                        <span className="wbe-label">标题</span>
                        <input
                          className="wbe-input"
                          value={entry.comment}
                          onChange={e2 => updateEntry(entry.uid, { comment: e2.target.value })}
                          disabled={isGlobal}
                        />
                      </label>

                      {/* 内容 */}
                      <label className="wbe-field">
                        <span className="wbe-label">内容</span>
                        <textarea
                          className="wbe-textarea"
                          rows={6}
                          value={entry.content}
                          onChange={e2 => updateEntry(entry.uid, { content: e2.target.value })}
                          disabled={isGlobal}
                        />
                      </label>

                      {/* 关键词 */}
                      <label className="wbe-field">
                        <span className="wbe-label">触发关键词（逗号分隔）</span>
                        <input
                          className="wbe-input"
                          value={keys.join(', ')}
                          onChange={e2 => updateEntry(entry.uid, {
                            key: parseKeywordInput(e2.target.value),
                          })}
                          disabled={isGlobal}
                          placeholder={isGlobal ? '全局条目始终生效' : '输入触发关键词...'}
                        />
                      </label>

                      {/* 选项行 */}
                      <div className="wbe-options-row">
                        <label className="wbe-field wbe-field-sm">
                          <span className="wbe-label">启用</span>
                          <select
                            className="wbe-input"
                            value={entry.disable ? 'disabled' : 'enabled'}
                            disabled={isGlobal}
                            onChange={e2 => updateEntry(entry.uid, { disable: e2.target.value === 'disabled' })}
                          >
                            <option value="enabled">启用</option>
                            <option value="disabled">禁用</option>
                          </select>
                        </label>
                        <label className="wbe-field wbe-field-sm">
                          <span className="wbe-label">类型</span>
                          <select
                            className="wbe-input"
                            value={entry.constant ? 'constant' : 'trigger'}
                            disabled={isGlobal}
                            onChange={e2 => updateEntry(entry.uid, { constant: e2.target.value === 'constant' })}
                          >
                            <option value="trigger">触发式</option>
                            <option value="constant">全局</option>
                          </select>
                        </label>
                        <label className="wbe-field wbe-field-sm">
                          <span className="wbe-label">排序</span>
                          <input
                            className="wbe-input"
                            type="number"
                            value={entry.order}
                            onChange={e2 => updateEntry(entry.uid, { order: Number(e2.target.value) || 0 })}
                            disabled={isGlobal}
                          />
                        </label>
                        <label className="wbe-field wbe-field-sm">
                          <span className="wbe-label">位置</span>
                          <select
                            className="wbe-input"
                            value={entry.position ?? 'after_char'}
                            onChange={e2 => updateEntry(entry.uid, { position: e2.target.value as 'before_char' | 'after_char' })}
                            disabled={isGlobal}
                          >
                            <option value="after_char">角色定义后</option>
                            <option value="before_char">角色定义前</option>
                          </select>
                        </label>
                        <label className="wbe-field wbe-field-sm">
                          <span className="wbe-label">深度</span>
                          <input
                            className="wbe-input"
                            type="number"
                            value={entry.depth ?? ''}
                            onChange={e2 => updateEntry(entry.uid, { depth: e2.target.value ? Number(e2.target.value) : undefined })}
                            placeholder="不限"
                          />
                        </label>
                        <label className="wbe-field wbe-field-sm">
                          <span className="wbe-label">概率%</span>
                          <input
                            className="wbe-input"
                            type="number"
                            min={0} max={100}
                            value={entry.probability ?? ''}
                            onChange={e2 => updateEntry(entry.uid, { probability: e2.target.value ? Number(e2.target.value) : undefined })}
                            placeholder="100"
                          />
                        </label>
                      </div>

                      {isGlobal && (
                        <div className="wbe-global-hint">
                          <Lock size={12} /> 全局条目无法在此编辑。如需修改，请导出 → 编辑JSON → 重新导入。
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── 内联样式 ──
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'stretch', justifyContent: 'stretch',
};
const panelStyle: React.CSSProperties = {
  width: '100%', maxWidth: '860px',
  margin: '20px auto',
  display: 'flex', flexDirection: 'column',
  background: 'var(--bg-primary)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '14px 20px', borderBottom: '1px solid var(--border)',
};
const toolbarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 20px', borderBottom: '1px solid var(--border)',
  flexWrap: 'wrap',
};
function badgeStyle(bg: string, fg: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
    background: bg, color: fg, fontWeight: 500,
  };
}
