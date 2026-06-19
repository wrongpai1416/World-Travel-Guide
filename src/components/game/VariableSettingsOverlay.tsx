// ============================================================
// 变量管理面板 — 快照分层、变量编辑、回滚、导入导出
// 移植自 yijiekkk/src/components/VariableSettings.vue
// ============================================================

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  X, Layers, List, Download, Upload, RefreshCw,
  ChevronDown, ChevronRight, RotateCcw, Save,
  ChevronLeft, ChevronRight as ChevronRightNav,
  Globe, Newspaper, User, Heart, IdCard, DollarSign, BookOpen, Swords,
  Users, Tag, Handshake, FileText, Dna, Sparkles, Backpack, ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import type { GameState } from '../../schema/variables';
import type { VariableManager } from '../../engine/variableManager';
import type { ChatMessage } from '../../engine/types';
import {
  groupVariableEntriesBySection,
  getVariableValue,
  getNpcVariableValues,
  type VariableSection,
} from '../../engine/variableStructureDefs';

// Lucide 图标名称 → 组件映射（变量分区图标）
const SECTION_ICON_MAP: Record<string, LucideIcon> = {
  Globe, Newspaper, User, Heart, IdCard, DollarSign, BookOpen, Swords,
  Users, Tag, Handshake, FileText, Dna, Sparkles, Backpack, ClipboardList,
};

function resolveSectionIcon(name?: string): LucideIcon {
  return (name && SECTION_ICON_MAP[name]) || ClipboardList;
}

// ============================================================
//  类型
// ============================================================

interface SnapshotLayer {
  id: string;
  msgIndex: number;
  snapshot: GameState;
  snapshotTime: number;
  isInitial: boolean;
  content?: string; // AI 消息摘要
}

interface Props {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  varMgr: VariableManager;
  onRestoreSnapshot?: (snapshot: GameState) => void;
  onSave?: () => void;
}

// ============================================================
//  常量
// ============================================================

const SNAPSHOT_PAGE_SIZE = 20;

// ============================================================
//  主组件
// ============================================================

export function VariableSettingsOverlay({
  visible, onClose, messages, varMgr, onRestoreSnapshot, onSave,
}: Props) {
  const [activeTab, setActiveTab] = useState<'snapshots' | 'variables'>('snapshots');
  const [snapshotPage, setSnapshotPage] = useState(0);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [layerEditTexts, setLayerEditTexts] = useState<Record<string, string>>({});
  const [layerModified, setLayerModified] = useState<Set<string>>(new Set());
  const [confirmRollback, setConfirmRollback] = useState<SnapshotLayer | null>(null);
  const [variableFilter, setVariableFilter] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedNpcs, setExpandedNpcs] = useState<Set<string>>(new Set());
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const importRef = useRef<HTMLInputElement>(null);

  // ─── 构建快照层级 ───
  const snapshotLayers = useMemo<SnapshotLayer[]>(() => {
    const layers: SnapshotLayer[] = [];

    // 第 0 层：当前状态
    const currentState = varMgr.getState();
    layers.push({
      id: 'current',
      msgIndex: -1,
      snapshot: currentState,
      snapshotTime: Date.now(),
      isInitial: false,
      content: '当前状态（最新）',
    });

    // 从消息历史中提取快照
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.snapshot) {
        layers.push({
          id: `msg-${i}`,
          msgIndex: i,
          snapshot: msg.snapshot as GameState,
          snapshotTime: (msg as any).snapshotTime || Date.now(),
          isInitial: false,
          content: typeof msg.content === 'string'
            ? msg.content.slice(0, 80) + (msg.content.length > 80 ? '...' : '')
            : '',
        });
      }
    }

    return layers;
  }, [messages, varMgr]);

  // ─── 分页 ───
  const totalPages = Math.ceil(snapshotLayers.length / SNAPSHOT_PAGE_SIZE);
  const pagedLayers = snapshotLayers.slice(
    snapshotPage * SNAPSHOT_PAGE_SIZE,
    (snapshotPage + 1) * SNAPSHOT_PAGE_SIZE,
  );

  // ─── 展开/折叠层 ───
  const toggleLayer = useCallback((layerId: string) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  // ─── 获取层的编辑文本 ───
  const getLayerEditText = useCallback((layer: SnapshotLayer) => {
    if (layerEditTexts[layer.id] !== undefined) return layerEditTexts[layer.id];
    return JSON.stringify(layer.snapshot, null, 2);
  }, [layerEditTexts]);

  // ─── 编辑层内容 ───
  const handleLayerEdit = useCallback((layerId: string, text: string) => {
    setLayerEditTexts(prev => ({ ...prev, [layerId]: text }));
    setLayerModified(prev => new Set(prev).add(layerId));
  }, []);

  // ─── 加载最新层（应用编辑） ───
  const handleLoadLatest = useCallback((layer: SnapshotLayer) => {
    const text = getLayerEditText(layer);
    try {
      const parsed = JSON.parse(text);
      if (varMgr.setStateFromJSON(text)) {
        setLayerModified(prev => {
          const next = new Set(prev);
          next.delete(layer.id);
          return next;
        });
        onSave?.();
      }
    } catch {
      alert('JSON 格式错误，请检查后重试');
    }
  }, [varMgr, getLayerEditText, onSave]);

  // ─── 回滚到指定层 ───
  const handleRollback = useCallback((layer: SnapshotLayer) => {
    varMgr.restoreSnapshot(layer.snapshot);
    onRestoreSnapshot?.(layer.snapshot);
    onSave?.();
    setConfirmRollback(null);
  }, [varMgr, onRestoreSnapshot, onSave]);

  // ─── 导出快照 ───
  const handleExport = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      layers: snapshotLayers.map(l => ({
        msgIndex: l.msgIndex,
        snapshotTime: l.snapshotTime,
        isInitial: l.isInitial,
        snapshot: l.snapshot,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `variable-snapshots-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [snapshotLayers]);

  // ─── 导入快照 ───
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const snapshot = data.snapshot || data;
      if (typeof snapshot === 'object' && snapshot !== null) {
        varMgr.restoreSnapshot(snapshot);
        onSave?.();
      }
    } catch {
      alert('导入失败：文件格式不正确');
    }
    if (importRef.current) importRef.current.value = '';
  }, [varMgr, onSave]);

  // ─── 变量列表 ───
  const sections = useMemo(() => groupVariableEntriesBySection(), []);
  const currentState = useMemo(() => varMgr.getState(), [varMgr, messages]);
  const npcVariables = useMemo(() => getNpcVariableValues(currentState), [currentState]);

  // ─── 变量编辑 ───
  const startEdit = useCallback((path: string, value: unknown) => {
    setEditingVar(path);
    setEditValue(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? ''));
  }, []);

  const saveEdit = useCallback((path: string) => {
    try {
      // 尝试解析为 JSON
      let value: unknown;
      try {
        value = JSON.parse(editValue);
      } catch {
        value = editValue;
      }
      varMgr.setVar(path, value);
      setEditingVar(null);
      onSave?.();
    } catch {
      alert('值格式错误');
    }
  }, [editValue, varMgr, onSave]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleNpc = useCallback((npcId: string) => {
    setExpandedNpcs(prev => {
      const next = new Set(prev);
      if (next.has(npcId)) next.delete(npcId);
      else next.add(npcId);
      return next;
    });
  }, []);

  if (!visible) return null;

  // ─── 格式化时间 ───
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  // ─── 变量值显示 ───
  const displayValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* 背景 */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* 主面板 */}
      <div style={{
        position: 'relative',
        width: '90vw', maxWidth: 1000, height: '85vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* 标题栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)',
            }}>
              <Layers size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--text-primary)' }}>
                变量管理
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                VARIABLE MANAGEMENT · {snapshotLayers.length} 层快照
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
            <ToolBtn onClick={handleExport} title="导出快照"><Download size={14} /></ToolBtn>
            <ToolBtn onClick={() => importRef.current?.click()} title="导入快照"><Upload size={14} /></ToolBtn>
            <ToolBtn onClick={onClose} title="关闭"><X size={14} /></ToolBtn>
          </div>
        </div>

        {/* Tab 栏 */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          <TabBtn
            active={activeTab === 'snapshots'}
            onClick={() => setActiveTab('snapshots')}
            icon={<Layers size={14} />}
            label="数据快照"
          />
          <TabBtn
            active={activeTab === 'variables'}
            onClick={() => setActiveTab('variables')}
            icon={<List size={14} />}
            label="变量列表"
          />
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {activeTab === 'snapshots' ? (
            <SnapshotTab
              layers={pagedLayers}
              totalLayers={snapshotLayers.length}
              page={snapshotPage}
              totalPages={totalPages}
              expandedLayers={expandedLayers}
              layerModified={layerModified}
              onPageChange={setSnapshotPage}
              onToggleLayer={toggleLayer}
              getEditText={getLayerEditText}
              onEdit={handleLayerEdit}
              onLoadLatest={handleLoadLatest}
              onRollback={setConfirmRollback}
              formatTime={formatTime}
            />
          ) : (
            <VariableTab
              sections={sections}
              state={currentState}
              npcVariables={npcVariables}
              filter={variableFilter}
              onFilterChange={setVariableFilter}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
              expandedNpcs={expandedNpcs}
              onToggleNpc={toggleNpc}
              editingVar={editingVar}
              editValue={editValue}
              onStartEdit={startEdit}
              onEditValueChange={setEditValue}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditingVar(null)}
              displayValue={displayValue}
            />
          )}
        </div>

        {/* 确认回滚弹窗 */}
        {confirmRollback && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            zIndex: 10,
          }}>
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              maxWidth: 400,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', color: 'var(--text-primary)', marginBottom: 8 }}>
                确认回滚？
              </div>
              <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                回滚到第 {confirmRollback.msgIndex + 1} 层
                {confirmRollback.content && (
                  <span style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    "{confirmRollback.content.slice(0, 50)}..."
                  </span>
                )}
                <span style={{ display: 'block', marginTop: 8, color: '#f0883e', fontSize: 'var(--font-size-sm)' }}>
                  ⚠️ 此操作将覆盖当前变量状态
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setConfirmRollback(null)} style={{
                  padding: '8px 20px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-base)',
                }}>取消</button>
                <button onClick={() => handleRollback(confirmRollback)} style={{
                  padding: '8px 20px', border: 'none',
                  borderRadius: 'var(--radius-md)', background: '#da3633',
                  color: '#fff', cursor: 'pointer', fontSize: 'var(--font-size-base)', fontWeight: '600',
                }}>确认回滚</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  快照 Tab
// ============================================================

function SnapshotTab({
  layers, totalLayers, page, totalPages, expandedLayers, layerModified,
  onPageChange, onToggleLayer, getEditText, onEdit, onLoadLatest, onRollback, formatTime,
}: {
  layers: SnapshotLayer[];
  totalLayers: number;
  page: number;
  totalPages: number;
  expandedLayers: Set<string>;
  layerModified: Set<string>;
  onPageChange: (p: number) => void;
  onToggleLayer: (id: string) => void;
  getEditText: (layer: SnapshotLayer) => string;
  onEdit: (id: string, text: string) => void;
  onLoadLatest: (layer: SnapshotLayer) => void;
  onRollback: (layer: SnapshotLayer) => void;
  formatTime: (ts: number) => string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 分页控制 */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '8px 0',
        }}>
          <ToolBtn onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}>
            <ChevronLeft size={14} />
          </ToolBtn>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
            第 {page + 1} / {totalPages} 页 · 共 {totalLayers} 层
          </span>
          <ToolBtn onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
            <ChevronRightNav size={14} />
          </ToolBtn>
        </div>
      )}

      {/* 层列表 */}
      {layers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 'var(--font-size-base)' }}>
          暂无快照数据。进行几轮对话后会自动生成快照。
        </div>
      ) : (
        layers.map((layer, idx) => {
          const isExpanded = expandedLayers.has(layer.id);
          const isModified = layerModified.has(layer.id);
          const isLatest = idx === 0 && page === 0;
          const globalIdx = page * SNAPSHOT_PAGE_SIZE + idx;

          // 简单预览：提取 HP/MP 等关键值
          const preview = (() => {
            try {
              const s = layer.snapshot;
              const hp = (s as any)?.玩家?.生存状态?.血量;
              const mp = (s as any)?.玩家?.生存状态?.体力值;
              const name = (s as any)?.玩家?.姓名;
              const parts: string[] = [];
              if (name) parts.push(name);
              if (hp !== undefined) parts.push(`HP:${hp}`);
              if (mp !== undefined) parts.push(`体力:${mp}`);
              return parts.join(' · ') || '';
            } catch { return ''; }
          })();

          return (
            <div key={layer.id} style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: isLatest ? 'var(--accent-dim)' : 'var(--bg-secondary)',
            }}>
              {/* 层头 */}
              <div
                onClick={() => onToggleLayer(layer.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.03))'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}

                <span style={{
                  fontSize: 'var(--font-size-sm)', fontWeight: '700',
                  color: isLatest ? 'var(--accent)' : 'var(--text-muted)',
                  minWidth: 28,
                }}>
                  #{globalIdx}
                </span>

                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {formatTime(layer.snapshotTime)}
                </span>

                {preview && (
                  <span style={{
                    fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {preview}
                  </span>
                )}

                {isLatest && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-sm)', fontWeight: '600',
                    background: 'var(--accent)', color: '#fff',
                  }}>最新</span>
                )}

                {isModified && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-sm)', fontWeight: '600',
                    background: '#f0883e', color: '#fff',
                  }}>已修改</span>
                )}

                {/* 操作按钮 */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {isLatest ? (
                    <ToolBtn
                      onClick={(e) => { e.stopPropagation(); onLoadLatest(layer); }}
                      title="加载编辑后的状态"
                      disabled={!isModified}
                    >
                      <Save size={12} />
                    </ToolBtn>
                  ) : (
                    <ToolBtn
                      onClick={(e) => { e.stopPropagation(); onRollback(layer); }}
                      title="回滚到此层"
                    >
                      <RotateCcw size={12} />
                    </ToolBtn>
                  )}
                </div>
              </div>

              {/* 展开内容：JSON 编辑器 */}
              {isExpanded && (
                <div style={{
                  padding: '10px 14px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                }}>
                  <textarea
                    value={getEditText(layer)}
                    onChange={e => onEdit(layer.id, e.target.value)}
                    readOnly={!isLatest}
                    spellCheck={false}
                    style={{
                      width: '100%',
                      minHeight: 200,
                      maxHeight: 400,
                      padding: '10px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: isLatest ? 'var(--bg-secondary)' : 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--font-size-sm)',
                      fontFamily: "var(--font-mono, 'Consolas', monospace)",
                      lineHeight: 1.6,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                  {isLatest && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => onLoadLatest(layer)}
                        style={{
                          padding: '6px 16px',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent)',
                          color: '#fff',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        应用编辑
                      </button>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', lineHeight: '28px' }}>
                        编辑 JSON 后点击应用，将覆盖当前变量状态
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================================================
//  变量列表 Tab
// ============================================================

function VariableTab({
  sections, state, npcVariables, filter, onFilterChange,
  expandedSections, onToggleSection,
  expandedNpcs, onToggleNpc,
  editingVar, editValue, onStartEdit, onEditValueChange, onSaveEdit, onCancelEdit,
  displayValue,
}: {
  sections: VariableSection[];
  state: GameState;
  npcVariables: Array<{ npcId: string; npcName: string; path: string; displayName: string; sectionLabel: string; value: unknown }>;
  filter: string;
  onFilterChange: (v: string) => void;
  expandedSections: Set<string>;
  onToggleSection: (key: string) => void;
  expandedNpcs: Set<string>;
  onToggleNpc: (npcId: string) => void;
  editingVar: string | null;
  editValue: string;
  onStartEdit: (path: string, value: unknown) => void;
  onEditValueChange: (v: string) => void;
  onSaveEdit: (path: string) => void;
  onCancelEdit: () => void;
  displayValue: (v: unknown) => string;
}) {
  const filterLower = filter.toLowerCase();

  // 按 NPC 分组
  const npcGroups = useMemo(() => {
    const groups = new Map<string, typeof npcVariables>();
    for (const v of npcVariables) {
      const arr = groups.get(v.npcId) || [];
      arr.push(v);
      groups.set(v.npcId, arr);
    }
    return groups;
  }, [npcVariables]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 搜索 */}
      <input
        type="text"
        placeholder="搜索变量名、路径或值..."
        value={filter}
        onChange={e => onFilterChange(e.target.value)}
        style={{
          maxWidth: 360,
          padding: '7px 10px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontSize: 'var(--font-size-base)',
          outline: 'none',
        }}
      />

      {/* 非 NPC 变量分组 */}
      {sections.map(section => {
        const filteredEntries = section.entries.filter(e => {
          if (!filterLower) return true;
          return e.displayName.toLowerCase().includes(filterLower)
            || e.canonicalPath.toLowerCase().includes(filterLower);
        });
        if (filteredEntries.length === 0) return null;

        const isExpanded = expandedSections.has(section.key);

        return (
          <div key={section.key} style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            <div
              onClick={() => onToggleSection(section.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {(() => { const Icon = resolveSectionIcon(section.icon); return <Icon size={14} />; })()}
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)' }}>
                {section.label}
              </span>
              <span style={{
                fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)',
                marginLeft: 'auto',
              }}>
                {filteredEntries.length} 项
              </span>
            </div>

            {isExpanded && (
              <div style={{ padding: '4px 0' }}>
                {filteredEntries.map(entry => {
                  const value = getVariableValue(state, entry.canonicalPath);
                  const isEditing = editingVar === entry.canonicalPath;
                  const valueStr = displayValue(value);
                  const isComplex = typeof value === 'object' && value !== null;

                  return (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '6px 14px 6px 36px',
                      borderBottom: '1px dashed var(--border)',
                    }}>
                      <span style={{
                        fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)',
                        minWidth: 120, flexShrink: 0, paddingTop: 2,
                      }}>
                        {entry.displayName}
                      </span>

                      {isEditing ? (
                        <div style={{ flex: 1, display: 'flex', gap: 6, flexDirection: 'column' }}>
                          <textarea
                            value={editValue}
                            onChange={e => onEditValueChange(e.target.value)}
                            spellCheck={false}
                            style={{
                              width: '100%',
                              minHeight: isComplex ? 80 : 28,
                              padding: '4px 8px',
                              border: '1px solid var(--accent)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: 'var(--font-size-sm)',
                              fontFamily: isComplex ? "var(--font-mono, monospace)" : 'inherit',
                              outline: 'none',
                              resize: 'vertical',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => onSaveEdit(entry.canonicalPath)} style={{
                              padding: '3px 10px', border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--accent)', color: '#fff',
                              fontSize: 'var(--font-size-sm)', cursor: 'pointer',
                            }}>保存</button>
                            <button onClick={onCancelEdit} style={{
                              padding: '3px 10px', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'transparent', color: 'var(--text-muted)',
                              fontSize: 'var(--font-size-sm)', cursor: 'pointer',
                            }}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <span
                          onClick={() => onStartEdit(entry.canonicalPath, value)}
                          style={{
                            flex: 1,
                            fontSize: 'var(--font-size-sm)',
                            color: isComplex ? 'var(--accent)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            wordBreak: 'break-word',
                            fontFamily: isComplex ? "var(--font-mono, monospace)" : 'inherit',
                            padding: '2px 4px',
                            borderRadius: 'var(--radius-sm)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.05))'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          title={`路径: ${entry.canonicalPath}\n点击编辑`}
                        >
                          {valueStr}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* NPC 分组 */}
      {npcGroups.size > 0 && (
        <div style={{
          marginTop: 8,
          fontSize: 'var(--font-size-base)', fontWeight: '600',
          color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Users size={14} /> NPC 人物档案
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>({npcGroups.size} 人)</span>
        </div>
      )}

      {Array.from(npcGroups.entries()).map(([npcId, entries]) => {
        const npcName = entries[0]?.npcName || npcId;
        const isExpanded = expandedNpcs.has(npcId);

        const filteredEntries = entries.filter(e => {
          if (!filterLower) return true;
          return e.displayName.toLowerCase().includes(filterLower)
            || e.path.toLowerCase().includes(filterLower)
            || npcName.toLowerCase().includes(filterLower);
        });
        if (filteredEntries.length === 0) return null;

        return (
          <div key={npcId} style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            <div
              onClick={() => onToggleNpc(npcId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)' }}>
                {npcName}
              </span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                ({npcId})
              </span>
              <span style={{
                fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)',
                marginLeft: 'auto',
              }}>
                {filteredEntries.length} 项
              </span>
            </div>

            {isExpanded && (
              <div style={{ padding: '4px 0' }}>
                {filteredEntries.map((entry, i) => {
                  const value = entry.value;
                  const isEditing = editingVar === entry.path;
                  const valueStr = displayValue(value);
                  const isComplex = typeof value === 'object' && value !== null;

                  return (
                    <div key={`${entry.path}-${i}`} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '6px 14px 6px 36px',
                      borderBottom: '1px dashed var(--border)',
                    }}>
                      <span style={{
                        fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)',
                        minWidth: 120, flexShrink: 0, paddingTop: 2,
                      }}>
                        {entry.displayName}
                      </span>

                      {isEditing ? (
                        <div style={{ flex: 1, display: 'flex', gap: 6, flexDirection: 'column' }}>
                          <textarea
                            value={editValue}
                            onChange={e => onEditValueChange(e.target.value)}
                            spellCheck={false}
                            style={{
                              width: '100%',
                              minHeight: isComplex ? 80 : 28,
                              padding: '4px 8px',
                              border: '1px solid var(--accent)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: 'var(--font-size-sm)',
                              fontFamily: isComplex ? "var(--font-mono, monospace)" : 'inherit',
                              outline: 'none',
                              resize: 'vertical',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => onSaveEdit(entry.path)} style={{
                              padding: '3px 10px', border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--accent)', color: '#fff',
                              fontSize: 'var(--font-size-sm)', cursor: 'pointer',
                            }}>保存</button>
                            <button onClick={onCancelEdit} style={{
                              padding: '3px 10px', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'transparent', color: 'var(--text-muted)',
                              fontSize: 'var(--font-size-sm)', cursor: 'pointer',
                            }}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <span
                          onClick={() => onStartEdit(entry.path, value)}
                          style={{
                            flex: 1,
                            fontSize: 'var(--font-size-sm)',
                            color: isComplex ? 'var(--accent)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            wordBreak: 'break-word',
                            padding: '2px 4px',
                            borderRadius: 'var(--radius-sm)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.05))'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          title={`路径: ${entry.path}\n点击编辑`}
                        >
                          {valueStr}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  小组件
// ============================================================

function ToolBtn({ onClick, title, disabled, children }: {
  onClick: (e?: any) => void;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 34, height: 34,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm, 4px)',
        background: 'var(--bg-secondary)',
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = disabled ? 'var(--text-muted)' : 'var(--text-secondary)';
      }}
    >
      {children}
    </button>
  );
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '10px 20px',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        fontSize: 'var(--font-size-base)',
        fontWeight: active ? '600' : '400',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
