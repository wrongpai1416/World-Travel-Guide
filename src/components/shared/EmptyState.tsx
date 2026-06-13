import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  action?: { label: string; onClick: () => void };
}

/**
 * 统一空状态组件
 * 替代原来散落在各处的 "大号emoji + 文字" 模式
 */
export default function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      textAlign: 'center',
      gap: '12px',
    }}>
      {Icon && (
        <Icon
          size={32}
          strokeWidth={1.2}
          style={{ color: 'var(--text-muted)', opacity: 0.5 }}
        />
      )}
      <p style={{
        color: 'var(--text-muted)',
        fontSize: 'var(--font-size-md)',
        lineHeight: 1.5,
        maxWidth: '320px',
      }}>
        {message}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="btn-secondary"
          style={{ fontSize: 'var(--font-size-sm)', marginTop: '4px' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
