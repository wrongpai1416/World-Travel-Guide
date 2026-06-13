import { useState, useRef, useCallback } from 'react';
import { useUISettings } from '../../../context/UISettingsContext';
import { Activity } from 'lucide-react';
import type { PipelineStatus as PipelineStatusType } from '../../../engine/pipelineTypes';

interface Props {
  onSend: (text: string) => void;
  onCancel: () => void;
  isGenerating: boolean;
  actionOptions?: string[];
  pipelineStatus?: PipelineStatusType | null;
  onOpenMonitor?: () => void;
}

export default function InputArea({ onSend, onCancel, isGenerating, actionOptions, pipelineStatus, onOpenMonitor }: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useUISettings();

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  }, [text, isGenerating, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleActionClick = useCallback((option: string) => {
    setText(option);
    inputRef.current?.focus();
  }, []);

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
    }}>
      {/* 推荐选项 */}
      {actionOptions && actionOptions.length > 0 && !isGenerating && (
        <div style={{
          padding: '8px 12px 0',
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          overflow: 'hidden',
          maxHeight: '120px',
          overflowY: 'auto',
        }}>
          {actionOptions.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleActionClick(opt)}
              style={{
                padding: '4px 12px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--accent)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent-dim)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-primary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          className="input-field"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('input.placeholder')}
          disabled={isGenerating}
          rows={3}
          style={{ flex: 1, resize: 'none', fontFamily: 'inherit' }}
        />
        {/* 管线监控按钮 */}
        <button
          onClick={onOpenMonitor}
          title="查看管线监控"
          style={{
            padding: '8px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: pipelineStatus && !isAllDone(pipelineStatus) ? 'var(--accent-dim)' : 'transparent',
            color: pipelineStatus && !isAllDone(pipelineStatus) ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <Activity size={16} />
          {pipelineStatus && !isAllDone(pipelineStatus) && (
            <span style={{
              position: 'absolute', top: '2px', right: '2px',
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          )}
        </button>
        {isGenerating ? (
          <button className="btn-ghost" onClick={onCancel} style={{ padding: '8px 16px', color: 'var(--danger)' }}>
            {t('input.stop')}
          </button>
        ) : (
          <button className="btn-primary" onClick={handleSend} disabled={!text.trim()} style={{ padding: '8px 16px' }}>
            {t('input.send')}
          </button>
        )}
      </div>
    </div>
  );
}

function isAllDone(status: PipelineStatusType): boolean {
  return Object.values(status.stages).every(s => s.status !== 'pending' && s.status !== 'running');
}
