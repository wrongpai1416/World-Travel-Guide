import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock, Trash2, Plus, Save, Upload, Download, Edit3,
  ChevronDown, ChevronUp, ExternalLink, AlertCircle,
} from 'lucide-react';
import type { WorldDef, WorldBookEntryDef } from '../../data/worlds-schema';

interface Props {
  world: WorldDef;
  onSave: (updated: WorldDef) => void;
}

type EditModeEntry = WorldBookEntryDef & { _dirty?: boolean };

export default function WorldBookEditor({ world, onSave }: Props) {
  const [entries, setEntries] = useState<EditModeEntry[]>(() =>
    (world.worldBookEntries || []).map(e => ({ ...e })),
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [importMsg, setImportMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextUidRef = useRef(Date.now());

  // 世界切换时重置状态
  useEffect(() => {
    setEntries((world.worldBookEntries || []).map(e => ({ ...e })));
    setExpanded(new Set());
    setImportMsg('');
    nextUidRef.current = Date.now();
  }, [world.id]);

  const genUid = useCallback(() => ++nextUidRef.current, []);

  // ── 展开/折叠 ──
  const toggleExpand = (uid: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  // ── 编辑条目字段 ──
  const updateEntry = (uid: number, patch: Partial<EditModeEntry>) => {
    setEntries(prev => prev.map(e => e.uid === uid ? { ...e, ...patch, _dirty: true } : e));
  };

  // ── 删除条目（只能删触发式） ──
  const deleteEntry = (uid: number) => {
    setEntries(prev => prev.filter(e => {
      if (e.uid === uid) return !e.constant; // constant 的不能删
      return true;
    }));
  };

  // ── 新增条目 ──
  const addEntry = () => {
    const uid = genUid();
    const newEntry: EditModeEntry = {
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

  // ── 导出条目 ──
  const exportEntries = () => {
    const clean = entries.map(({ _dirty, ...rest }) => rest);
    const blob = new Blob([JSON.stringify({ worldBookEntries: clean }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${world.name}_entries.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── 导入条目 ──
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
          let added = 0, replaced = 0;
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

  // ── 保存 ──
  const handleSave = () => {
    const clean = entries.map(({ _dirty, ...rest }) => rest);
    onSave({ ...world, worldBookEntries: clean });
  };

  const globalCount = entries.filter(e => e.constant).length;
  const triggerCount = entries.filter(e => !e.constant).length;

  return (
    <div className="wbe-root">
      {/* 工具栏 */}
      <div className="wbe-toolbar">
        <div className="wbe-info">
          <span className="wbe-badge wbe-badge-global"><Lock size={12} /> 全局 {globalCount}</span>
          <span className="wbe-badge wbe-badge-trigger"><Edit3 size={12} /> 触发 {triggerCount}</span>
          <span className="wbe-hint">全局条目只读 · 触发条目可编辑</span>
        </div>
        <div className="wbe-actions">
          <button className="wbe-btn wbe-btn-outline" onClick={importEntries} title="导入条目JSON">
            <Upload size={14} /> 导入
          </button>
          <button className="wbe-btn wbe-btn-outline" onClick={exportEntries} title="导出条目JSON">
            <Download size={14} /> 导出
          </button>
          <button className="wbe-btn wbe-btn-ghost" onClick={addEntry} title="新增触发式条目">
            <Plus size={14} /> 新增
          </button>
          <button className="wbe-btn wbe-btn-primary" onClick={handleSave} title="保存编辑">
            <Save size={14} /> 保存
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
      </div>

      {importMsg && (
        <div className={`wbe-import-msg${importMsg.startsWith('导入完成') ? '' : ' wbe-import-msg-error'}`}>
          <AlertCircle size={14} /> {importMsg}
        </div>
      )}

      {/* 条目列表 */}
      <div className="wbe-entries">
        {entries.length === 0 ? (
          <div className="wbe-empty">
            <p>暂无条目</p>
            <button className="wbe-btn wbe-btn-outline" onClick={addEntry}>新增条目</button>
          </div>
        ) : (
          entries.map((entry, idx) => {
            const isExpanded = expanded.has(entry.uid);
            const isGlobal = entry.constant;

            return (
              <div key={entry.uid} className={`wbe-entry${isGlobal ? ' wbe-entry-global' : ''}${isExpanded ? ' wbe-entry-expanded' : ''}`}>
                {/* 条目头部 */}
                <div className="wbe-entry-header" onClick={() => toggleExpand(entry.uid)}>
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
                        onClick={e => { e.stopPropagation(); deleteEntry(entry.uid); }}
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
                        onChange={e => updateEntry(entry.uid, { comment: e.target.value })}
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
                        onChange={e => updateEntry(entry.uid, { content: e.target.value })}
                        disabled={isGlobal}
                      />
                    </label>

                    {/* 关键词 */}
                    <label className="wbe-field">
                      <span className="wbe-label">触发关键词（逗号分隔）</span>
                      <input
                        className="wbe-input"
                        value={entry.key?.join(', ') ?? ''}
                        onChange={e => updateEntry(entry.uid, {
                          key: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
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
                          onChange={e => updateEntry(entry.uid, { constant: e.target.value === 'constant' })}
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
                          onChange={e => updateEntry(entry.uid, { order: Number(e.target.value) || 0 })}
                          disabled={isGlobal}
                        />
                      </label>
                      <label className="wbe-field wbe-field-sm">
                        <span className="wbe-label">位置</span>
                        <select
                          className="wbe-input"
                          value={entry.position ?? 'after_char'}
                          onChange={e => updateEntry(entry.uid, { position: e.target.value as 'before_char' | 'after_char' })}
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
                          onChange={e => updateEntry(entry.uid, { depth: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="不限"
                        />
                      </label>
                      <label className="wbe-field wbe-field-sm">
                        <span className="wbe-label">触发概率%</span>
                        <input
                          className="wbe-input"
                          type="number"
                          min={0} max={100}
                          value={entry.probability ?? ''}
                          onChange={e => updateEntry(entry.uid, { probability: e.target.value ? Number(e.target.value) : undefined })}
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
  );
}
