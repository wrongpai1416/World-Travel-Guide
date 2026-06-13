import { useState } from 'react';
import {
  Settings, RefreshCw, Play, Loader, ScrollText,
  Sunrise, Baby, BookOpen, Flame, Zap, ChevronRight,
} from 'lucide-react';

/** 拆块定义 */
export interface SegmentDef {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const STAGE_ICONS = [
  <Baby size={15} />,
  <BookOpen size={15} />,
  <Flame size={15} />,
  <Zap size={15} />,
];

export function buildSegmentDefs(ageStages: { id: string; label: string }[]): SegmentDef[] {
  return [
    { id: 'prologue', title: '序章', icon: <Sunrise size={15} /> },
    ...ageStages.map((stage, i) => ({
      id: stage.id,
      title: stage.label,
      icon: STAGE_ICONS[i] || <Flame size={15} />,
    })),
  ];
}

interface StepCharacterHistoryProps {
  segmentDefs: SegmentDef[];
  segments: Record<string, string>;
  setSegments: (s: Record<string, string>) => void;
  isGenerating: boolean;
  regeneratingId: string | null;
  hasApiConfig: boolean;
  onGenerateAll: () => void;
  onRegenerateSegment: (id: string) => void;
  onStartGame: () => void;
  onPrev: () => void;
  onSettings: () => void;
}

export default function StepCharacterHistory({
  segmentDefs, segments, setSegments, isGenerating, regeneratingId,
  hasApiConfig, onGenerateAll, onRegenerateSegment,
  onStartGame, onPrev, onSettings,
}: StepCharacterHistoryProps) {
  const [activeId, setActiveId] = useState(segmentDefs[0]?.id ?? '');
  const hasContent = Object.values(segments).some(v => v.trim().length > 0);
  // 验证所有阶段是否都已填写
  const allSegmentsFilled = segmentDefs.every(def => segments[def.id]?.trim().length > 0);

  const activeDef = segmentDefs.find(d => d.id === activeId);
  const activeContent = segments[activeId] || '';
  const isActiveRegenerating = regeneratingId === activeId;
  const isActiveEmpty = !activeContent.trim();

  return (
    <div className="history-layout">
      {/* ── 左侧边栏：阶段列表 ── */}
      <div className="history-sidebar">
        <div className="history-sidebar-header">
          <ScrollText size={15} />
          <span>人生阶段</span>
        </div>
        <div className="history-sidebar-list">
          {segmentDefs.map((def, i) => {
            const content = segments[def.id] || '';
            const hasText = content.trim().length > 0;
            const isRegen = regeneratingId === def.id;
            return (
              <button
                key={def.id}
                className={`history-sidebar-item${activeId === def.id ? ' active' : ''}`}
                onClick={() => setActiveId(def.id)}
              >
                <span className="history-sidebar-icon">{def.icon}</span>
                <span className="history-sidebar-title">{def.title}</span>
                <span className="history-sidebar-status">
                  {isRegen ? <Loader size={11} className="animate-spin" /> : hasText ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* 侧边栏底部按钮 */}
        <div className="history-sidebar-footer">
          {hasApiConfig && (
            <button
              className="btn-secondary pi-ai-btn"
              onClick={onGenerateAll}
              disabled={isGenerating}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {isGenerating ? <><Loader size={12} className="animate-spin" /> 生成中</> : hasContent ? <><RefreshCw size={12} /> 全部重生成</> : '一键生成全部'}
            </button>
          )}
          {!hasApiConfig && (
            <button className="btn-ghost" onClick={onSettings} style={{ fontSize: 'var(--font-size-sm)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Settings size={12} /> 配置API
            </button>
          )}
        </div>
      </div>

      {/* ── 右侧：内容编辑区 ── */}
      <div className="history-content">
        {activeDef && (
          <>
            <div className="history-content-header">
              <span className="history-content-icon">{activeDef.icon}</span>
              <span className="history-content-title">{activeDef.title}</span>
              {hasApiConfig && (
                <button
                  className="btn-ghost pi-ai-btn"
                  onClick={() => onRegenerateSegment(activeId)}
                  disabled={isGenerating}
                  style={{ marginLeft: 'auto' }}
                >
                  {isActiveRegenerating ? <><Loader size={12} className="animate-spin" /> 生成中</> : <><RefreshCw size={12} /> {isActiveEmpty ? '生成' : '重新生成'}</>}
                </button>
              )}
            </div>
            <div className="history-content-body">
              {isActiveRegenerating ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)', padding: '40px 0', justifyContent: 'center' }}>
                  <div className="ai-spinner" style={{ width: '24px', height: '24px' }} />
                  <span style={{ fontSize: 'var(--font-size-md)' }}>正在生成...</span>
                </div>
              ) : isActiveEmpty ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <ScrollText size={32} strokeWidth={1} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: 'var(--font-size-md)' }}>{hasApiConfig ? '点击右上角按钮生成' : '请先配置API'}</span>
                </div>
              ) : (
                <textarea
                  value={activeContent}
                  onChange={e => setSegments({ ...segments, [activeId]: e.target.value })}
                  className="history-textarea"
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 底部导航 ── */}
      <div className="history-nav">
        <button className="btn-secondary" onClick={onPrev} style={{ padding: '10px 24px' }}>← 上一步</button>
        <button
          className="btn-primary"
          onClick={onStartGame}
          style={{ padding: '10px 32px', fontSize: 'var(--font-size-lg)', display: 'flex', alignItems: 'center', gap: '6px' }}
          disabled={!allSegmentsFilled}
          title={!allSegmentsFilled ? '请填写所有人生阶段的内容' : ''}
        >
          <Play size={16} /> 下一步
        </button>
      </div>
    </div>
  );
}
