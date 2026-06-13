// ============================================================
// 运行态图谱区块 — 使用 Mermaid 图谱面板 + 原始 JSON 视图
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { Download, Upload, Activity, Search, GitBranch, Code } from 'lucide-react';
import type { MemorySystemConfig, NarrativeMemoryRuntime, VectorMemoryItem } from '../../../memory/types';
import { useMemoryStore } from '../../../memory/memoryStore';
import { FieldGrid, Field, Button } from '../SettingsUIComponents';
import { MermaidGraphPanel, type NodeDetail } from '../../shared/MermaidGraphPanel';
import { buildMemoryRuntimeGraphPayload } from '../../../memory/narrativeGraph';

interface Props {
  config: MemorySystemConfig;
  memoryRuntime: NarrativeMemoryRuntime | null;
  vectorMemory: VectorMemoryItem[];
  stats: {
    sceneCount: number; threadCount: number; stateCount: number;
    relationCount: number; eventCount: number; entityCount: number;
    archiveCount: number; mutationCount: number; checkpointCount: number;
    lastIngestCursor: number; totalObjects: number;
  };
  search: string;
  activeTab: string;
  onSearchChange: (v: string) => void;
  onTabChange: (v: string) => void;
  onOpenEditor: (tabKey: string) => void;
  onOpenExportPicker: () => void;
  onOpenVectorExtract: () => void;
  isExporting: boolean;
}

const RUNTIME_TABS = [
  { key: 'scene', label: '场景' },
  { key: 'threads', label: '线程' },
  { key: 'states', label: '状态' },
  { key: 'relations', label: '关系' },
  { key: 'relationNetwork', label: '关系网' },
  { key: 'events', label: '事件' },
  { key: 'entities', label: '实体' },
  { key: 'archives', label: '归档' },
  { key: 'vector', label: '向量' },
  { key: 'summary', label: '摘要' },
  { key: 'mutations', label: '变更' },
  { key: 'checkpoints', label: '检查点' },
];

function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatRange(start: number | null | undefined, end: number | null | undefined): string {
  if (start == null && end == null) return '—';
  return `${start ?? '?'} ~ ${end ?? '?'}`;
}

const pillStyle: React.CSSProperties = {
  padding: '12px', borderRadius: 'var(--radius-md)',
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  transition: 'border-color 0.15s, transform 0.15s',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', overflow: 'hidden',
};

const metaLineStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '5px 0', borderBottom: '1px dashed var(--border)', fontSize: 'var(--font-size-sm)',
};

export function RuntimeGraphPanel({
  config, memoryRuntime, vectorMemory, stats, search, activeTab,
  onSearchChange, onTabChange, onOpenEditor,
  onOpenExportPicker, onOpenVectorExtract,
  isExporting,
}: Props) {
  const rt = memoryRuntime;
  const isSimple = config.memoryMode === 'simple';
  const visibleTabs = isSimple ? RUNTIME_TABS.filter(t => t.key !== 'vector') : RUNTIME_TABS;
  const activeTabLabel = RUNTIME_TABS.find(t => t.key === activeTab)?.label ?? activeTab;

  // ─── 视图模式切换 ───
  const [viewMode, setViewMode] = useState<'graph' | 'json'>('graph');

  // ─── 生成 Mermaid 图谱 ───
  const graphPayload = useMemo(() => {
    // 即使 rt 为 null，也生成空状态图谱
    const payload = buildMemoryRuntimeGraphPayload({
      tabKey: activeTab,
      query: search || undefined,
      sceneAnchor: rt?.sceneAnchor ?? null,
      threads: rt?.activeThreads ?? [],
      states: rt?.stateSlots ?? [],
      relations: rt?.relationEdges ?? [],
      relationNetwork: rt?.relationNetwork ?? [],
      events: rt?.eventCards ?? [],
      entities: rt?.entityCards ?? [],
      archives: rt?.archiveCards ?? [],
      vectorMemories: vectorMemory ?? [],
      summaryHistory: rt?.summarySaveHistory ?? [],
      lastRetrievePlan: rt?.lastRetrievePlan ?? null,
      mutations: rt?.mutationLog ?? [],
      checkpoints: rt?.checkpoints ?? [],
      writeLogs: rt?.writeDebugLogs ?? [],
      retrieveLogs: rt?.retrieveDebugLogs ?? [],
      compileLogs: rt?.compileDebugLogs ?? [],
    });
    console.log('[RuntimeGraphPanel] graphPayload:', {
      tabKey: activeTab,
      hasRt: !!rt,
      definitionLength: payload?.definition?.length,
      definitionPreview: payload?.definition?.substring(0, 100),
    });
    return payload;
  }, [rt, vectorMemory, activeTab, search]);

  // ─── 节点详情映射 ───
  const nodeDetails = useMemo(() => {
    if (!graphPayload?.nodeDetails) return {};
    const result: Record<string, NodeDetail> = {};
    for (const [key, val] of Object.entries(graphPayload.nodeDetails)) {
      const detail = val as any;
      result[key] = {
        title: detail?.title || key,
        typeLabel: detail?.typeLabel,
        summary: detail?.summary,
        fields: detail?.fields || [],
        rawLabel: detail?.rawLabel,
      };
    }
    return result;
  }, [graphPayload]);

  const getTabData = (): unknown[] => {
    if (!rt) return [];
    switch (activeTab) {
      case 'scene': return rt.sceneAnchor ? [rt.sceneAnchor] : [];
      case 'threads': return rt.activeThreads ?? [];
      case 'states': return rt.stateSlots ?? [];
      case 'relations': return rt.relationEdges ?? [];
      case 'relationNetwork': return rt.relationNetwork ?? [];
      case 'events': return rt.eventCards ?? [];
      case 'entities': return rt.entityCards ?? [];
      case 'archives': return rt.archiveCards ?? [];
      case 'vector': return vectorMemory ?? [];
      case 'mutations': return rt.mutationLog ?? [];
      case 'checkpoints': return rt.checkpoints ?? [];
      case 'logs': return [...(rt.writeDebugLogs ?? []), ...(rt.retrieveDebugLogs ?? []), ...(rt.compileDebugLogs ?? [])];
      case 'summary': return rt.summarySaveHistory ?? [];
      default: return [];
    }
  };

  const tabData = getTabData();
  const filteredData = search.trim()
    ? tabData.filter(item => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()))
    : tabData;

  const lastSummary = rt?.lastSummarySave;
  const summaryApplyResult = lastSummary?.applyResult as Record<string, number> | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 标题 + 操作按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>运行态图谱</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button disabled={isExporting} onClick={onOpenExportPicker} icon={<Download size={12} />}>
            导出记忆
          </Button>
        </div>
      </div>

      {/* 统计 Pill */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
        <StatPill label="模式" value={config.enabled ? '已启用' : '已关闭'} />
        <StatPill label="对象总量" value={stats.totalObjects} />
        <StatPill label="写入游标" value={stats.lastIngestCursor} />
        <StatPill label="Mutation" value={stats.mutationCount} />
        <StatPill label="Checkpoint" value={stats.checkpointCount} />
        {!isSimple && <StatPill label="向量事实" value={vectorMemory.length} />}
      </div>

      {/* 预览卡片网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* 最近摘要写入概览 */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', fontSize: 'var(--font-size-base)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>
            <span>最近摘要写入概览</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <Tag>角色 {summaryApplyResult?.otherCharacterCount ?? 0}</Tag>
              <Tag>玩家 {summaryApplyResult?.playerCount ?? 0}</Tag>
              <Tag>物件 {summaryApplyResult?.itemCount ?? 0}</Tag>
            </div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <MetaLine label="保存时间" value={formatDateTime(lastSummary?.savedAt)} />
            <MetaLine label="源范围" value={formatRange(lastSummary?.sourceStartIndex, lastSummary?.sourceEndIndex)} />
            <MetaLine label="角色记忆数" value={summaryApplyResult?.otherCharacterCount ?? 0} />
            <MetaLine label="玩家记忆数" value={summaryApplyResult?.playerCount ?? 0} />
            <MetaLine label="物件记忆数" value={summaryApplyResult?.itemCount ?? 0} />
          </div>
        </div>

        {/* 向量提取概览 / 检索规划概览 */}
        {isSimple ? (
          <div style={cardStyle}>
            <div style={{ padding: '12px 16px', fontSize: 'var(--font-size-base)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>
              <span>最近检索规划概览</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <MetaLine label="规划时间" value={formatDateTime(rt?.lastRetrievePlan?.plannedAt)} />
              <MetaLine label="联合候选" value={rt?.lastRetrievePlan?.candidates?.length ?? 0} />
              <MetaLine label="入选标题数" value={rt?.lastRetrievePlan?.selectedTitles?.length ?? 0} />
            </div>
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', fontSize: 'var(--font-size-base)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>
              <span>向量提取概览</span>
              <Button onClick={onOpenVectorExtract}>手动提取</Button>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <MetaLine label="事实库总量" value={`${vectorMemory.length} 条`} />
              <MetaLine label="最近提取游标" value={rt?.lastIngestCursor ?? 0} />
              <MetaLine label="最近摘要生成" value={formatDateTime(lastSummary?.savedAt)} />
            </div>
          </div>
        )}

        {/* 热态同步概览 */}
        <div style={cardStyle}>
          <div style={{ padding: '12px 16px', fontSize: 'var(--font-size-base)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>
            <span>热态同步概览</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <MetaLine label="写入游标" value={rt?.lastIngestCursor ?? 0} />
            <MetaLine label="最近成功写入" value={formatDateTime(rt?.lastIngestSuccessAt)} />
            <MetaLine label="最近写入尝试" value={formatDateTime(rt?.lastIngestAttemptAt)} />
            <MetaLine label="最近重建时间" value={formatDateTime(rt?.lastRebuildAt)} />
            {rt?.lastIngestFailure?.message && (
              <div style={{ marginTop: 8, textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', padding: '16px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', lineHeight: 1.6 }}>
                最近失败：{rt.lastIngestFailure.message}
              </div>
            )}
          </div>
        </div>

        {/* 摘要同步概览 */}
        <div style={cardStyle}>
          <div style={{ padding: '12px 16px', fontSize: 'var(--font-size-base)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>
            <span>摘要同步概览</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <MetaLine label="摘要保存" value={config.writePipeline.saveSummaryAfterIngest ? '已启用' : '已关闭'} />
            <MetaLine label="总记录数" value={rt?.summarySaveHistory?.length ?? 0} />
            <MetaLine label="最近摘要时间" value={formatDateTime(lastSummary?.savedAt)} />
          </div>
        </div>
      </div>

      {/* 搜索 + Tab */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="text"
          placeholder="搜索当前图谱节点 / 标签 / 摘要关键词"
          value={search} onChange={e => onSearchChange(e.target.value)}
          style={{
            maxWidth: '420px', padding: '7px 10px',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-primary)', color: 'var(--text-primary)',
            fontSize: 'var(--font-size-base)', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              style={{
                padding: '5px 12px',
                border: `1px solid ${activeTab === tab.key ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                background: activeTab === tab.key ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)', fontWeight: activeTab === tab.key ? '600' : '400',
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 图谱 Shell */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '2px' }}>
              记忆图谱
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              当前标签：{activeTabLabel} ｜ 命中 {filteredData.length} 项
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setViewMode('graph')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', border: `1px solid ${viewMode === 'graph' ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)',
                background: viewMode === 'graph' ? 'var(--accent-dim)' : 'transparent',
                color: viewMode === 'graph' ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', fontWeight: viewMode === 'graph' ? '600' : '400',
              }}
            >
              <GitBranch size={12} />图谱
            </button>
            <button
              onClick={() => setViewMode('json')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', border: `1px solid ${viewMode === 'json' ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)',
                background: viewMode === 'json' ? 'var(--accent-dim)' : 'transparent',
                color: viewMode === 'json' ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', fontWeight: viewMode === 'json' ? '600' : '400',
              }}
            >
              <Code size={12} />JSON
            </button>
          </div>
        </div>

        {filteredData.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: 'var(--font-size-base)', color: 'var(--text-muted)' }}>当前分类暂无数据。</div>
        ) : viewMode === 'graph' ? (
          <div style={{ padding: 12 }}>
            <MermaidGraphPanel
              graphDefinition={graphPayload?.definition || ''}
              nodeDetails={nodeDetails}
              title={activeTabLabel}
              subtitle={`${filteredData.length} 个节点`}
              style={{ minHeight: 360, maxHeight: 520 }}
            />
          </div>
        ) : (
          <div style={{ padding: 16, maxHeight: 400, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                显示 {filteredData.length} / {tabData.length} 项
              </span>
              <Button onClick={() => onOpenEditor(activeTab)}>编辑原始内容</Button>
            </div>
            <pre style={{
              padding: '12px', minHeight: 120, maxHeight: 300,
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              fontSize: 12, fontFamily: "var(--font-mono, 'Consolas', monospace)",
              lineHeight: 1.6, whiteSpace: 'pre-wrap', overflow: 'auto',
              pointerEvents: 'none', resize: 'vertical',
            }}>
              {JSON.stringify(filteredData.slice(0, 20), null, 2)}
              {filteredData.length > 20 && `\n\n... 还有 ${filteredData.length - 20} 项`}
            </pre>
          </div>
        )}
      </div>

      {/* 调试日志 */}
      {config.debug.enabled && (
        <details style={{ marginTop: 16, background: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
          <summary style={{ cursor: 'pointer', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--accent)' }}>调试日志</span>
              <span style={{
                padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)',
                background: (rt?.writeDebugLogs?.length ?? 0) > 0
                  ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'var(--bg-tertiary)',
                color: (rt?.writeDebugLogs?.length ?? 0) > 0 ? 'var(--success)' : 'var(--text-muted)',
              }}>
                写入 {(rt?.writeDebugLogs?.length ?? 0)} / 检索 {(rt?.retrieveDebugLogs?.length ?? 0)} / 编译 {(rt?.compileDebugLogs?.length ?? 0)}
              </span>
            </div>
          </summary>
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Button onClick={() => { const store = useMemoryStore.getState(); store.clearDebugLogs(); }}>
              清空日志
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={pillStyle}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{label}</span>
      <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>{value}</strong>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={metaLineStyle}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <strong style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{String(value)}</strong>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)',
      background: 'var(--accent-dim)', color: 'var(--accent)',
      border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
    }}>
      {children}
    </span>
  );
}
