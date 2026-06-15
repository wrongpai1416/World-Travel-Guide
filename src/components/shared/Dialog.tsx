import { useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, Info, HelpCircle, X } from 'lucide-react';
import { useConfigStore } from '../../stores/configStore';

interface DialogOptions {
  type: 'confirm' | 'alert' | 'info' | 'prompt';
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
}

interface DialogState extends DialogOptions {
  open: boolean;
  resolve: (value: any) => void;
  inputValue?: string;
}

export function useDialog() {
  const t = useConfigStore(s => s.t);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const confirm = useCallback((message: string, options?: Partial<Omit<DialogOptions, 'type' | 'message'>>): Promise<boolean> => {
    return new Promise(resolve => {
      setDialog({ type: 'confirm', message, open: true, resolve, ...options });
    });
  }, []);

  const alert = useCallback((message: string, options?: Partial<Omit<DialogOptions, 'type' | 'message'>>): Promise<void> => {
    return new Promise(resolve => {
      setDialog({
        type: 'alert', message, open: true,
        resolve: () => resolve(),
        ...options,
      });
    });
  }, []);

  const prompt = useCallback((message: string, options?: Partial<Omit<DialogOptions, 'type' | 'message' | 'resolve'>>): Promise<string | null> => {
    return new Promise(resolve => {
      setDialog({
        type: 'prompt', message, open: true,
        inputValue: options?.defaultValue || '',
        resolve: (val: string | null) => resolve(val),
        ...options,
      });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    if (dialog?.type === 'prompt') {
      dialog.resolve(result ? (dialog.inputValue ?? '') : null);
    } else {
      dialog?.resolve(result);
    }
    setDialog(null);
  }, [dialog]);

  const setInputValue = useCallback((val: string) => {
    setDialog(prev => prev ? { ...prev, inputValue: val } : null);
  }, []);

  // ESC 关闭 + Enter 确认
  useEffect(() => {
    if (!dialog?.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter' && dialog.type === 'prompt') close(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dialog?.open, dialog?.type, close]);

  const iconMap = {
    confirm: HelpCircle,
    alert: AlertTriangle,
    info: Info,
    prompt: HelpCircle,
  };

  const DialogUI = dialog?.open ? (
    <div
      ref={dialogRef}
      onClick={() => close(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary, #1a1a2e)',
          border: '1px solid var(--border, rgba(255,255,255,0.1))',
          borderRadius: '12px',
          padding: '24px',
          width: '90%',
          maxWidth: '380px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          animation: 'dialogSlideIn 0.2s ease',
        }}
      >
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          {(() => {
            const Icon = iconMap[dialog.type];
            return (
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: dialog.danger ? 'rgba(239, 68, 68, 0.12)' : 'var(--accent-dim, rgba(212,175,55,0.12))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={16} color={dialog.danger ? '#ef4444' : 'var(--accent, #d4af37)'} />
              </div>
            );
          })()}
          <span style={{
            fontWeight: '600', fontSize: 'var(--font-size-lg)',
            color: 'var(--text-primary, #e8e6e3)',
          }}>
            {dialog.title || t(`dialog.${dialog.type}`)}
          </span>
        </div>

        {/* 内容 */}
        <div style={{
          fontSize: 'var(--font-size-md)',
          color: 'var(--text-secondary, #a0a0a0)',
          lineHeight: 1.6,
          marginBottom: '20px',
          paddingLeft: '42px',
        }}>
          {dialog.message}
        </div>

        {/* Prompt 输入框 */}
        {dialog.type === 'prompt' && (
          <div style={{ marginBottom: '20px', paddingLeft: '42px' }}>
            <input
              type="text"
              value={dialog.inputValue || ''}
              onChange={e => setInputValue(e.target.value)}
              placeholder={dialog.placeholder || ''}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--border, rgba(255,255,255,0.15))',
                borderRadius: '8px',
                background: 'var(--bg-tertiary, #2a2a3e)',
                color: 'var(--text-primary, #e8e6e3)',
                fontSize: 'var(--font-size-md)',
                outline: 'none',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent, #d4af37)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border, rgba(255,255,255,0.15))'; }}
            />
          </div>
        )}

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingLeft: '42px' }}>
          {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
            <button
              onClick={() => close(false)}
              style={{
                padding: '8px 18px',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: '8px',
                background: 'var(--bg-tertiary, #2a2a3e)',
                color: 'var(--text-muted, #888)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)',
                fontWeight: '500',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted, #888)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, rgba(255,255,255,0.1))'; }}
            >
              {dialog.cancelText || t('common.cancel')}
            </button>
          )}
          <button
            onClick={() => close(true)}
            autoFocus
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: '8px',
              background: dialog.danger
                ? 'rgba(239, 68, 68, 0.9)'
                : 'var(--accent, #d4af37)',
              color: dialog.danger ? '#fff' : 'var(--bg-deep, #0f0f1a)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: '600',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {dialog.confirmText || (dialog.type === 'confirm' ? t('common.confirm') : t('dialog.gotIt'))}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { DialogUI, confirm, alert, prompt };
}
