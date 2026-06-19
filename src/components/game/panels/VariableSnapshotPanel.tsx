// ============================================================
// 变量快照面板 — 侧边抽屉版（仅保留数据快照功能）
// ============================================================

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Layers, Download, Upload, RefreshCw, Settings,
  ChevronDown, ChevronRight, RotateCcw, Save,
  ChevronLeft, ChevronRight as ChevronRightNav,
} from 'lucide-react';
import type { GameState } from '../../../schema/variables';
import type { VariableManager } from '../../../engine/variableManager';
import type { ChatMessage } from '../../../engine/types';
import { loadPresets } from '../../settings/apiPresetUtils';
import { useConfigStore } from '../../../stores/configStore';

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

export default function VariableSnapshotPanel({
  messages, varMgr, onRestoreSnapshot, onSave,
}: Props) {
  const [snapshotPage, setSnapshotPage] = useState(0);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [layerEditTexts, setLayerEditTexts] = useState<Record<string, string>>({});
  const [layerModified, setLayerModified] = useState<Set<string>>(new Set());
  const [confirmRollback, setConfirmRollback] = useState<SnapshotLayer | null>(null);
  const [showApiSettings, setShowApiSettings] = useState(false);

  // ─── 变量提取 API 配置（per-save） ───
  const apiPresets = loadPresets();
  const [varApiPresetId, setVarApiPresetId] = useState<string>(() => {
    try { return localStorage.getItem('world_travel_guide_variable_api_preset') || ''; } catch { return ''; }
  });

  const { setAuxiliaryConfig, setApiMode } = useConfigStore();

  const handleSaveApiSettings = useCallback(() => {
    localStorage.setItem('world_travel_guide_variable_api_preset', varApiPresetId);
    // 同步到 configStore 的 auxiliaryConfig（让运行中的引擎立即生效）
    if (varApiPresetId) {
      const preset = apiPresets.find(p => p.id === varApiPresetId);
      if (preset) {
        setAuxiliaryConfig({
          endpoint: preset.config.baseUrl,
          apiKey: preset.config.apiKey,
          model: preset.config.model,
        });
        setApiMode('auxiliary');
      }
    } else {
      setAuxiliaryConfig(null);
      setApiMode('default');
    }
    onSave?.();
  }, [varApiPresetId, apiPresets, setAuxiliaryConfig, setApiMode, onSave]);

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

  // ─── 格式化时间 ───
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-primary)',
    }}>
      {/* 头部工具栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
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
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '700', color: 'var(--text-primary)' }}>
              数据快照
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              {snapshotLayers.length} 层快照
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
          <ToolBtn onClick={() => setSnapshotPage(0)} title="刷新"><RefreshCw size={14} /></ToolBtn>
        </div>
      </div>

      {/* API 设置（可折叠） */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowApiSettings(!showApiSettings)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '10px 16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)',
          }}
        >
          <Settings size={14} />
          <span>变量提取 API 设置</span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {varApiPresetId ? (apiPresets.find(p => p.id === varApiPresetId)?.name || '自定义') : '跟随主 API'}
          </span>
          {showApiSettings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {showApiSettings && (
          <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>API 预设</span>
              <select
                value={varApiPresetId}
                onChange={e => { setVarApiPresetId(e.target.value); }}
                style={{
                  padding: '4px 8px', fontSize: 'var(--font-size-sm)',
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: '6px', color: 'var(--text-primary)', width: '160px',
                }}
              >
                <option value="">跟随主 API</option>
                {apiPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button
              onClick={handleSaveApiSettings}
              style={{
                padding: '6px 16px', fontSize: 'var(--font-size-sm)',
                border: 'none', borderRadius: '6px',
                background: 'var(--accent)', color: '#fff',
                cursor: 'pointer', fontWeight: '600', alignSelf: 'flex-end',
              }}
            >
              保存设置
            </button>
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {/* 分页控制 */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            padding: '8px 0',
            marginBottom: '12px',
          }}>
            <ToolBtn onClick={() => setSnapshotPage(Math.max(0, snapshotPage - 1))} disabled={snapshotPage === 0}>
              <ChevronLeft size={14} />
            </ToolBtn>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              第 {snapshotPage + 1} / {totalPages} 页 · 共 {snapshotLayers.length} 层
            </span>
            <ToolBtn onClick={() => setSnapshotPage(Math.min(totalPages - 1, snapshotPage + 1))} disabled={snapshotPage >= totalPages - 1}>
              <ChevronRightNav size={14} />
            </ToolBtn>
          </div>
        )}

        {/* 层列表 */}
        {pagedLayers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 'var(--font-size-base)' }}>
            暂无快照数据。进行几轮对话后会自动生成快照。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagedLayers.map((layer, idx) => {
              const isExpanded = expandedLayers.has(layer.id);
              const isModified = layerModified.has(layer.id);
              const isLatest = idx === 0 && snapshotPage === 0;
              const globalIdx = snapshotPage * SNAPSHOT_PAGE_SIZE + idx;

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
                    onClick={() => toggleLayer(layer.id)}
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
                          onClick={(e) => { e.stopPropagation(); handleLoadLatest(layer); }}
                          title="加载编辑后的状态"
                          disabled={!isModified}
                        >
                          <Save size={12} />
                        </ToolBtn>
                      ) : (
                        <ToolBtn
                          onClick={(e) => { e.stopPropagation(); setConfirmRollback(layer); }}
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
                        value={getLayerEditText(layer)}
                        onChange={e => handleLayerEdit(layer.id, e.target.value)}
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
                            onClick={() => handleLoadLatest(layer)}
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
                            编辑 JSON 后点击应用
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
