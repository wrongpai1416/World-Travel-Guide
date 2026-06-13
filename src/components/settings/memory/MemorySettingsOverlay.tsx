// ============================================================
// 记忆系统设置 — 支持 overlay（弹窗）和 inline（Tab 内嵌）两种模式
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { Brain, Repeat, ArrowLeft, Check, Download, Upload, AlertTriangle, X } from 'lucide-react';
import { useMemoryStore } from '../../../memory/memoryStore';
import { loadPresets } from '../apiPresetUtils';
import { Section, SettingRow, Select } from '../SettingsUIComponents';
import { WriteConfigPanel } from './WriteConfigPanel';
import { VectorConfigPanel } from './VectorConfigPanel';
import { RetrievalConfigPanel } from './RetrievalConfigPanel';
import { PromptTemplatesPanel } from './PromptTemplatesPanel';
import { RuntimeGraphPanel } from './RuntimeGraphPanel';
import { ExportPickerDialog } from './ExportPickerDialog';
import { VectorExtractDialog } from './VectorExtractDialog';
import '../MemorySettingsOverlay.css';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  /** overlay = 全屏弹窗（默认），inline = 普通 Tab 内嵌 */
  mode?: 'overlay' | 'inline';
}

export function MemorySettingsOverlay({ visible, onClose, onSave, mode = 'overlay' }: Props) {
  const store = useMemoryStore();
  const { config, memoryRuntime, vectorMemory } = store;
  const apiPresets = loadPresets();

  // ─── UI 状态 ───
  const [localConfig, setLocalConfig] = useState(() => ({ ...config }));
  const [localPromptTemplates, setLocalPromptTemplates] = useState(() => ({ ...config.narrativePromptTemplates }));
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [runtimeSearch, setRuntimeSearch] = useState('');
  const [activeRuntimeTab, setActiveRuntimeTab] = useState('scene');

  // 弹窗状态
  const [exportPickerVisible, setExportPickerVisible] = useState(false);
  const [vectorExtractVisible, setVectorExtractVisible] = useState(false);
  const [rawEditorVisible, setRawEditorVisible] = useState(false);
  const [rawEditorTabKey, setRawEditorTabKey] = useState('scene');
  const [rawEditorText, setRawEditorText] = useState('');
  const [rawEditorSaving, setRawEditorSaving] = useState(false);
  const [rawEditorError, setRawEditorError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);

  // ─── Escape 键关闭 ───
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rawEditorVisible || exportPickerVisible || vectorExtractVisible) return;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, rawEditorVisible, exportPickerVisible, vectorExtractVisible, onClose]);

  // ─── 派生值 ───
  const isSimple = localConfig.memoryMode === 'simple';
  const modeLabel = isSimple ? '简单模式' : '满血模式';
  const configDesc = isSimple
    ? '简单模式仅保留本地热态编译与记忆检索规划设置。'
    : '写入记忆层与向量化设置并列显示，下方为检索记忆层。';

  // ─── 运行态统计 ───
  const runtime = memoryRuntime;
  const stats = {
    sceneCount: runtime?.sceneAnchor ? 1 : 0,
    threadCount: runtime?.activeThreads?.length ?? 0,
    stateCount: runtime?.stateSlots?.length ?? 0,
    relationCount: runtime?.relationEdges?.length ?? 0,
    eventCount: runtime?.eventCards?.length ?? 0,
    entityCount: runtime?.entityCards?.length ?? 0,
    archiveCount: runtime?.archiveCards?.length ?? 0,
    mutationCount: runtime?.mutationLog?.length ?? 0,
    checkpointCount: runtime?.checkpoints?.length ?? 0,
    lastIngestCursor: runtime?.lastIngestCursor ?? 0,
    totalObjects: 0,
  };
  stats.totalObjects = stats.sceneCount + stats.threadCount + stats.stateCount
    + stats.relationCount + stats.eventCount + stats.entityCount + stats.archiveCount;

  // ─── 配置更新 ───
  const updateConfig = useCallback((patch: Record<string, unknown>) => {
    setLocalConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const updateWritePipeline = useCallback((patch: Record<string, unknown>) => {
    setLocalConfig(prev => ({
      ...prev,
      writePipeline: { ...prev.writePipeline, ...patch },
    }));
  }, []);

  const updateRetrieval = useCallback((patch: Record<string, unknown>) => {
    setLocalConfig(prev => ({
      ...prev,
      retrieval: { ...prev.retrieval, ...patch },
    }));
  }, []);

  const updateCompiler = useCallback((patch: Record<string, unknown>) => {
    setLocalConfig(prev => ({
      ...prev,
      compiler: { ...prev.compiler, ...patch },
    }));
  }, []);

  const updateRetention = useCallback((patch: Record<string, unknown>) => {
    setLocalConfig(prev => ({
      ...prev,
      retention: { ...prev.retention, ...patch },
    }));
  }, []);

  // ─── 保存 ───
  const handleSave = useCallback(() => {
    store.setConfig({
      ...localConfig,
      narrativePromptTemplates: localPromptTemplates,
    });
    onSave();
  }, [localConfig, localPromptTemplates, store, onSave]);

  // ─── 模式切换 ───
  const toggleMemoryMode = useCallback(() => {
    const next = isSimple ? 'full' : 'simple';
    updateConfig({ memoryMode: next });
  }, [isSimple, updateConfig]);

  // ─── 导入 ───
  const handleImportClick = useCallback(() => {
    if (isImporting || isExporting) return;
    importInputRef.current?.click();
  }, [isImporting, isExporting]);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data?.runtime) {
        store.fromJSON(data.runtime);
      } else {
        store.fromJSON(data);
      }
      alert('导入成功！');
    } catch (err) {
      alert(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }, [store, isImporting]);

  // ─── 编辑器 ───
  const openRawEditor = useCallback((tabKey: string) => {
    setRawEditorTabKey(tabKey);
    const rt = store.getMemoryRuntime();
    let data: unknown;
    switch (tabKey) {
      case 'scene': data = rt.sceneAnchor; break;
      case 'threads': data = rt.activeThreads; break;
      case 'states': data = rt.stateSlots; break;
      case 'relations': data = rt.relationEdges; break;
      case 'relationNetwork': data = rt.relationNetwork; break;
      case 'events': data = rt.eventCards; break;
      case 'entities': data = rt.entityCards; break;
      case 'archives': data = rt.archiveCards; break;
      case 'vector': data = vectorMemory; break;
      case 'mutations': data = rt.mutationLog; break;
      case 'checkpoints': data = rt.checkpoints; break;
      default: data = null;
    }
    setRawEditorText(JSON.stringify(data, null, 2));
    setRawEditorError('');
    setRawEditorVisible(true);
  }, [store, vectorMemory]);

  const saveRawEditor = useCallback(() => {
    setRawEditorSaving(true);
    setRawEditorError('');
    try {
      const parsed = JSON.parse(rawEditorText);
      const rt = store.getMemoryRuntime();
      switch (rawEditorTabKey) {
        case 'scene': store.updateSceneAnchor(parsed); break;
        case 'threads': { if (Array.isArray(parsed)) { rt.activeThreads = parsed; } break; }
        case 'states': { if (Array.isArray(parsed)) { rt.stateSlots = parsed; } break; }
        case 'events': { if (Array.isArray(parsed)) { rt.eventCards = parsed; } break; }
        case 'entities': { if (Array.isArray(parsed)) { rt.entityCards = parsed; } break; }
        case 'archives': { if (Array.isArray(parsed)) { rt.archiveCards = parsed; } break; }
        default: break;
      }
      store.bumpRuntimeVersion();
      setRawEditorVisible(false);
    } catch (err) {
      setRawEditorError(String(err instanceof Error ? err.message : err));
    } finally {
      setRawEditorSaving(false);
    }
  }, [rawEditorText, rawEditorTabKey, store]);

  if (!visible) return null;

  /* ─── 共享的内容区（两种模式复用） ─── */
  const content = (
    <>
      {/* 区段头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '18px 24px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-lg)',
          background: 'var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)', flexShrink: 0,
        }}>
          <Brain size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
            记忆系统设置
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.5px' }}>
            NARRATIVE MEMORY CONFIGURATION
          </div>
        </div>
        <button
          onClick={toggleMemoryMode}
          title={`切换记忆模式（当前：${modeLabel}）`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 16px', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-lg)', background: 'var(--accent-dim)',
            color: 'var(--accent)', fontSize: 'var(--font-size-sm)', fontWeight: '600',
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)'; }}
        >
          <Repeat size={13} /><span>{modeLabel}</span>
        </button>
      </div>

      {/* 可滚动内容 */}
      <div className="ms-scroll">
        {/* ═══ Block 1: 记忆系统配置 ═══ */}
        <div className="ms-block">
          <div className="ms-block-header">
            <div>
              <div className="ms-block-title">记忆系统配置</div>
              <div className="ms-block-desc">{configDesc}</div>
            </div>
            <button
              className={`ms-toggle-btn ${localConfig.enabled ? 'active' : ''}`}
              role="switch"
              aria-checked={localConfig.enabled}
              onClick={() => updateConfig({ enabled: !localConfig.enabled })}
            >
              <div className="ms-toggle-thumb" />
            </button>
          </div>

          <div className={`ms-config-grid ${isSimple ? 'simple-mode' : ''}`}>
            <Section icon={<Brain size={15} />} title="记忆系统主 API">
              <SettingRow label="默认 API 预设" desc="所有记忆阶段（写入、摘要、检索、向量）的默认 API。各阶段可单独覆盖。">
                <Select
                  options={[{ label: '跟随主聊天 API', value: '' }, ...apiPresets.map(p => ({ label: p.name, value: p.id }))]}
                  value={localConfig.apiPresetId ?? ''}
                  onChange={v => updateConfig({ apiPresetId: v || null })}
                  width="180px"
                />
              </SettingRow>
            </Section>
            <WriteConfigPanel
              config={localConfig}
              apiPresets={apiPresets}
              isSimple={isSimple}
              onUpdate={updateConfig}
              onWritePipelineUpdate={updateWritePipeline}
              onRetentionUpdate={updateRetention}
              onCompilerUpdate={updateCompiler}
            />
            {!isSimple && (
              <VectorConfigPanel
                config={localConfig}
                apiPresets={apiPresets}
                onUpdate={updateConfig}
              />
            )}
            <RetrievalConfigPanel
              config={localConfig}
              apiPresets={apiPresets}
              onUpdate={updateConfig}
              onRetrievalUpdate={updateRetrieval}
            />
          </div>
        </div>

        <div className="ms-divider" />

        {/* ═══ Block 2: 提示词模板 ═══ */}
        {!isSimple && (
          <>
            <PromptTemplatesPanel
              templates={localPromptTemplates}
              expanded={expandedPrompts}
              onToggle={(key) => setExpandedPrompts(prev => ({ ...prev, [key]: !prev[key] }))}
              onChange={(key, value) => setLocalPromptTemplates(prev => ({ ...prev, [key]: value }))}
              onReset={(key) => {
                import('../../../memory/memoryPrompts').then(mod => {
                  const defaults: Record<string, () => string> = {
                    ingest: mod.getDefaultNarrativeIngestPrompt,
                    summary: mod.getDefaultNarrativeSummaryPrompt,
                    retrievePlanner: mod.getDefaultNarrativeRetrievePlannerPrompt,
                    multiRoundRetrievePlanner: mod.getDefaultMultiRoundRetrievePlannerPrompt,
                    multiRoundRetrievePlannerFinal: mod.getDefaultMultiRoundRetrievePlannerFinalPrompt,
                    queryRewrite: mod.getDefaultNarrativeQueryRewritePrompt,
                    rerank: mod.getDefaultNarrativeRerankPrompt,
                    conflictJudge: mod.getDefaultNarrativeConflictJudgePrompt,
                    vectorExtract: mod.getDefaultVectorExtractPrompt,
                    vectorQueryRewrite: mod.getDefaultVectorQueryRewritePrompt,
                    vectorRerank: mod.getDefaultVectorRerankPrompt,
                  };
                  if (defaults[key]) {
                    setLocalPromptTemplates(prev => ({ ...prev, [key]: defaults[key]() }));
                  }
                });
              }}
            />
            <div className="ms-divider" />
          </>
        )}

        {/* ═══ Block 3: 运行态图谱 ═══ */}
        <RuntimeGraphPanel
          config={localConfig}
          memoryRuntime={memoryRuntime}
          vectorMemory={vectorMemory}
          stats={stats}
          search={runtimeSearch}
          activeTab={activeRuntimeTab}
          onSearchChange={setRuntimeSearch}
          onTabChange={setActiveRuntimeTab}
          onOpenEditor={openRawEditor}
          onOpenExportPicker={() => setExportPickerVisible(true)}
          onOpenVectorExtract={() => setVectorExtractVisible(true)}
          onImportClick={handleImportClick}
          isExporting={isExporting}
          isImporting={isImporting}
        />
      </div>

      {/* 底部操作栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 24px', flexShrink: 0,
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        {mode === 'overlay' ? (
          <button onClick={onClose} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 18px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)', fontWeight: '500',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <ArrowLeft size={15} /><span>返回</span>
          </button>
        ) : <div />}
        <button onClick={handleSave} style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 24px', border: 'none',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--accent)', color: '#fff',
          fontSize: 'var(--font-size-base)', fontWeight: '600',
          cursor: 'pointer', transition: 'all 0.15s',
          boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent)',
        }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none'; }}
        >
          <Check size={15} /><span>保存配置</span>
        </button>
      </div>
    </>
  );

  /* ─── 弹窗层（两种模式共用） ─── */
  const dialogs = (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,.png,application/json,image/png"
        className="ms-hidden-input"
        onChange={handleImportFile}
      />
      {exportPickerVisible && (
        <ExportPickerDialog
          onClose={() => setExportPickerVisible(false)}
          store={store}
          vectorMemory={vectorMemory}
          memoryRuntime={memoryRuntime}
        />
      )}
      {vectorExtractVisible && (
        <VectorExtractDialog onClose={() => setVectorExtractVisible(false)} />
      )}
      {rawEditorVisible && (
        <div className="ms-editor-overlay" onClick={() => !rawEditorSaving && setRawEditorVisible(false)}>
          <div className="ms-editor-card" onClick={e => e.stopPropagation()}>
            <div className="ms-editor-header">
              <div>
                <div className="ms-editor-title">{rawEditorTabKey} 原始内容</div>
                <div className="ms-editor-subtitle">直接编辑当前分类整组 JSON，保存后立即写回当前存档并刷新图谱。</div>
              </div>
              <button className="ms-editor-close" onClick={() => setRawEditorVisible(false)}><X size={16} /></button>
            </div>
            <div className="ms-editor-body">
              <div className="ms-editor-hint">
                请输入合法的 JSON {rawEditorTabKey === 'scene' ? '对象' : '数组'}。保存后会立即覆盖当前存档中对应分类的数据。
              </div>
              <textarea
                className="ms-textarea"
                style={{ minHeight: 420 }}
                value={rawEditorText}
                onChange={e => setRawEditorText(e.target.value)}
                spellCheck={false}
              />
              {rawEditorError && (
                <div className="ms-editor-error"><AlertTriangle size={14} />{rawEditorError}</div>
              )}
              <div className="ms-editor-actions">
                <button className="ms-btn-sm" disabled={rawEditorSaving} onClick={() => setRawEditorVisible(false)}>
                  取消
                </button>
                <button className="ms-btn-sm ms-editor-save" disabled={rawEditorSaving} onClick={saveRawEditor}>
                  {rawEditorSaving ? '保存中...' : '保存并刷新图谱'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  /* ─── Inline 模式：直接渲染为普通内容 ─── */
  if (mode === 'inline') {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {content}
        </div>
        {dialogs}
      </>
    );
  }

  /* ─── Overlay 模式：全屏弹窗（默认） ─── */
  return (
    <div className="ms-overlay ms-root">
      <div className="ms-bg">
        <div className="ms-bg-gradient" />
        <div className="ms-bg-overlay" />
      </div>
      <div className="ms-main">
        <div className="ms-header">
          <div className="ms-header-icon"><Brain size={22} /></div>
          <h2 className="ms-page-title">记忆系统</h2>
          <p className="ms-page-subtitle">COMPILED NARRATIVE MEMORY</p>
          <div className="ms-title-deco">
            <span className="ms-deco-line ms-deco-line-left" />
            <span className="ms-deco-diamond" />
            <span className="ms-deco-line ms-deco-line-right" />
          </div>
        </div>
        <div className="ms-card">
          <div className="ms-card-glow" />
          <div className="ms-card-frame">
            <div className="ms-corner ms-corner-tl" />
            <div className="ms-corner ms-corner-tr" />
            <div className="ms-corner ms-corner-bl" />
            <div className="ms-corner ms-corner-br" />
          </div>
          {content}
        </div>
      </div>
      {dialogs}
    </div>
  );
}
