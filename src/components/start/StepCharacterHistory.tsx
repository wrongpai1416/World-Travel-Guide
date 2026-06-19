import { useState } from 'react';
import {
  RefreshCw, Play, Loader, Sparkles,
  Sunrise, Baby, BookOpen, Flame, Zap,
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
  includeAgeStages: boolean;
  setIncludeAgeStages: (v: boolean) => void;
  hasApiConfig: boolean;
  onGenerateAll: (drafts?: Record<string, string>) => void;
  onRegenerateSegment: (id: string, draft?: string) => void;
  onStartGame: () => void;
  onPrev: () => void;
}

export default function StepCharacterHistory({
  segmentDefs, segments, setSegments, isGenerating, regeneratingId,
  includeAgeStages, setIncludeAgeStages,
  hasApiConfig, onGenerateAll, onRegenerateSegment,
  onStartGame, onPrev,
}: StepCharacterHistoryProps) {
  const [activeId, setActiveId] = useState(segmentDefs[0]?.id ?? '');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const hasContent = Object.values(segments).some(v => v.trim().length > 0);
  // 验证：根据开关决定需要填写哪些阶段
  const allSegmentsFilled = segmentDefs.every(def => segments[def.id]?.trim().length > 0);

  const activeDef = segmentDefs.find(d => d.id === activeId);
  const activeContent = segments[activeId] || '';
  const activeDraft = drafts[activeId] || '';
  const isActiveRegenerating = regeneratingId === activeId;
  const isActiveEmpty = !activeContent.trim();

  // 切换年龄阶段开关时，同步更新 activeId
  const handleToggleAgeStages = (next: boolean) => {
    setIncludeAgeStages(next);
    // 如果当前 activeId 是年龄阶段且即将隐藏，切回序章
    if (!next && activeId !== 'prologue') {
      setActiveId('prologue');
    }
  };

  return (
    <div className="history-layout">
      {/* ── 顶部操作栏 ── */}
      <div className="history-topbar">
        <label className="history-toggle" title="是否包含0岁到当前年龄的成长经历">
          <input
            type="checkbox"
            checked={includeAgeStages}
            onChange={e => handleToggleAgeStages(e.target.checked)}
          />
          <span>包含成长经历</span>
        </label>
        {hasApiConfig && (
          <button
            className="btn-secondary pi-ai-btn"
            onClick={() => onGenerateAll(drafts)}
            disabled={isGenerating}
          >
            {isGenerating ? <><Loader size={12} className="animate-spin" /> 生成中</> : hasContent ? <><RefreshCw size={12} /> 全部重生成</> : '一键生成全部'}
          </button>
        )}
      </div>

      {/* ── Tab 栏：阶段选择 ── */}
      <div className="history-tabs">
        {segmentDefs.map((def) => {
          const content = segments[def.id] || '';
          const hasText = content.trim().length > 0;
          const isRegen = regeneratingId === def.id;
          return (
            <button
              key={def.id}
              className={`history-tab${activeId === def.id ? ' active' : ''}`}
              onClick={() => setActiveId(def.id)}
            >
              <span className="history-tab-icon">{def.icon}</span>
              <span className="history-tab-title">{def.title}</span>
              <span className="history-tab-status">
                {isRegen ? <Loader size={10} className="animate-spin" /> : hasText ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 内容编辑区 ── */}
      <div className="history-content">
        {activeDef && (
          <>
            <div className="history-content-header">
              <span className="history-content-icon">{activeDef.icon}</span>
              <span className="history-content-title">{activeDef.title}</span>
              {hasApiConfig && !isActiveEmpty && (
                <button
                  className="btn-ghost pi-ai-btn"
                  onClick={() => onRegenerateSegment(activeId)}
                  disabled={isGenerating}
                  style={{ marginLeft: 'auto' }}
                >
                  {isActiveRegenerating ? <><Loader size={12} className="animate-spin" /> 生成中</> : <><RefreshCw size={12} /> 重新生成</>}
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
                /* ── 空状态：草稿输入 + 生成按钮 ── */
                <div className="history-draft-area">
                  <textarea
                    className="history-draft-textarea"
                    value={activeDraft}
                    onChange={e => setDrafts(prev => ({ ...prev, [activeId]: e.target.value }))}
                    placeholder="写下你对这个阶段的想法，AI会参考你的草稿来生成（也可以留空直接生成）..."
                    rows={6}
                  />
                  {hasApiConfig && (
                    <button
                      className="btn-primary pi-generate-btn"
                      onClick={() => onRegenerateSegment(activeId, activeDraft)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <><Loader size={12} className="animate-spin" /> 生成中</> : <><Sparkles size={12} /> 根据草稿生成</>}
                    </button>
                  )}
                  {!hasApiConfig && (
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                      请先配置API后再生成
                    </span>
                  )}
                </div>
              ) : (
                /* ── 已有内容：编辑 textarea ── */
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
