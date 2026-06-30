// 游戏内世界书编辑器 —— 覆盖式编辑界面
// 全局条目( constant )只读 · 触发条目可自由编辑
// 保存直接反馈到游戏引擎的 WorldBookManager
import { useState, useRef, useCallback } from 'react';
import {
  Lock, Trash2, Plus, Save, Upload, Download,
  ChevronDown, ChevronUp, AlertCircle, X, Pencil,
} from 'lucide-react';
import type { GameEngine } from '../../../engine/types';
import type { WorldBookEntry } from '../../../worldbook/index';
import { findWorldDef } from '../../../data/worldLoader';
import type { WorldBookEntryDef } from '../../../data/worlds-schema';

interface Props {
  engine: GameEngine;
  worldId: string;
  onClose: () => void;
}

type EditEntry = WorldBookEntry & { _dirty?: boolean };

/** 将 WorldBookEntryDef 转为 WorldBookEntry 格式（编辑器内部用） */
function defsToEntries(defs: WorldBookEntryDef[]): WorldBookEntry[] {
  return defs.map((e, idx) => ({
    id: -(idx + 1),
    comment: e.comment,
    content: e.content,
    constant: e.constant,
    enabled: !e.disable,
    selective: (e.key?.length ?? 0) > 0,
    keys: e.key ?? [],
    secondaryKeys: e.keysecondary ?? [],
    position: (e.position ?? 'after_char') as 'before_char' | 'after_char',
    insertionOrder: e.order ?? 0,
    order: e.order,
    depth: e.depth,
    probability: e.probability,
    useProbability: e.useProbability,
    excludeRecursion: e.excludeRecursion,
    preventRecursion: e.preventRecursion,
    group: e.group,
  }));
}

export default function InGameWorldBookEditor({ engine, worldId, onClose }: Props) {
  const [entries, setEntries] = useState<EditEntry[]>(() => {
    // 优先从引擎的运行时 WorldBookManager 读取
    const wb = engine.worldBook;
    if (wb) {
      const runtime = wb.getAllEntries();
      if (runtime.length > 0) {
        return runtime.map(e => ({ ...e }));
      }
    }
    // 兜底：从 WorldDef 静态定义读取（card.json 不存在时的场景）
    const world = findWorldDef(worldId);
    return defsToEntries(world?.worldBookEntries ?? []).map(e => ({ ...e }));
  });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [importMsg, setImportMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(Date.now());

  const genId = useCallback(() => --nextIdRef.current, []);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateEntry = (id: number, patch: Partial<EditEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch, _dirty: true } : e));
  };

  const deleteEntry = (id: number) => {
    setEntries(prev => prev.filter(e => {
      if (e.id === id) return !e.constant;
      return true;
    }));
  };

  const addEntry = () => {
    const id = genId();
    const newEntry: EditEntry = {
      id,
      comment: '新条目',
      content: '',
      constant: false,
      enabled: true,
      selective: false,
      keys: [],
      secondaryKeys: [],
      position: 'after_char',
      insertionOrder: entries.length + 1,
      order: entries.length + 1,
      _dirty: true,
    };
    setEntries(prev => [...prev, newEntry]);
    setExpanded(prev => new Set(prev).add(id));
  };

  // 导出当前所有条目
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
        const incoming: WorldBookEntry[] = data.worldBookEntries || data.entries || [];
        if (!Array.isArray(incoming) || incoming.length === 0) {
          setImportMsg('未找到有效的条目数据');
          return;
        }
        setEntries(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const merged = [...prev];
          let added = 0, replaced = 0;
          for (const item of incoming) {
            if (existingIds.has(item.id)) {
              merged[merged.findIndex(e => e.id === item.id)] = { ...item };
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
    if (!engine.worldBook) return;
    const clean = entries.map(({ _dirty, ...rest }) => rest);
    // 如果管理器中没有 constant 条目（例如从 WorldDef 兜底加载的场景），
    // 先把所有条目注入管理器，再替换 non-constant 部分
    const wbEntries = engine.worldBook.getAllEntries();
    const hasConstantInManager = wbEntries.some(e => e.constant);
    if (!hasConstantInManager) {
      // 管理器为空或无 constant → 先注入全部（含 constant）
      engine.worldBook.addEntries(clean);
    } else {
      // 正常场景：只替换 non-constant 条目
      engine.worldBook.replaceNonConstantEntries(
        clean.filter(e => !e.constant),
      );
    }
    onClose();
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
            <Lock size={12} /> 全局 {globalCount}（只读，需导出编辑后重新导入）
          </span>
          <span style={badgeStyle('color-mix(in srgb, var(--success) 12%, transparent)', 'var(--success)')}>
            <Pencil size={12} /> 触发 {triggerCount}（可编辑）
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', flex: 1, textAlign: 'right' }}>
            修改立即生效于当前游戏，不会持久化到预设世界
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
              const isExpanded = expanded.has(entry.id);
              const isGlobal = entry.constant;

              return (
                <div key={entry.id} className={`wbe-entry${isGlobal ? ' wbe-entry-global' : ''}${isExpanded ? ' wbe-entry-expanded' : ''}`}>
                  {/* 条目头部 */}
                  <div className="wbe-entry-header" onClick={() => toggleExpand(entry.id)}>
                    <div className="wbe-entry-left">
                      <span className="wbe-entry-order">{idx + 1}</span>
                      {isGlobal ? (
                        <span className="wbe-entry-lock" title="全局条目（只读）"><Lock size={13} /></span>
                      ) : (
                        <span className="wbe-entry-type-dot" />
                      )}
                      <span className="wbe-entry-title">{entry.comment || '（无标题）'}</span>
                    </div>
                    <div className="wbe-entry-right">
                      {isGlobal && <span className="wbe-tag-locked">受保护</span>}
                      {!isGlobal && (
                        <button
                          className="wbe-entry-delete"
                          onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }}
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
                          onChange={e => updateEntry(entry.id, { comment: e.target.value })}
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
                          onChange={e => updateEntry(entry.id, { content: e.target.value })}
                          disabled={isGlobal}
                        />
                      </label>

                      {/* 关键词 */}
                      <label className="wbe-field">
                        <span className="wbe-label">触发关键词（逗号分隔）</span>
                        <input
                          className="wbe-input"
                          value={entry.keys?.join(', ') ?? ''}
                          onChange={e => updateEntry(entry.id, {
                            keys: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean),
                          })}
                          disabled={isGlobal}
                          placeholder={isGlobal ? '全局条目始终生效' : '输入触发关键词...'}
                        />
                      </label>

                      {/* 选项行 */}
                      <div className="wbe-options-row">
                        <label className="wbe-field wbe-field-sm">
                          <span className="wbe-label">类型</span>
                          <select
                            className="wbe-input"
                            value={entry.constant ? 'constant' : 'trigger'}
                            disabled={isGlobal}
                            onChange={e => updateEntry(entry.id, { constant: e.target.value === 'constant' })}
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
                            value={entry.order ?? entry.insertionOrder}
                            onChange={e => updateEntry(entry.id, { order: Number(e.target.value) || 0 })}
                            disabled={isGlobal}
                          />
                        </label>
                        <label className="wbe-field wbe-field-sm">
                          <span className="wbe-label">位置</span>
                          <select
                            className="wbe-input"
                            value={entry.position ?? 'after_char'}
                            onChange={e => updateEntry(entry.id, { position: e.target.value as 'before_char' | 'after_char' })}
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
                            onChange={e => updateEntry(entry.id, { depth: e.target.value ? Number(e.target.value) : undefined })}
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
                            onChange={e => updateEntry(entry.id, { probability: e.target.value ? Number(e.target.value) : undefined })}
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
