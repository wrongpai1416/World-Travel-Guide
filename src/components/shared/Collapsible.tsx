import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export function Collapsible({ icon, title, count, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 16px', cursor: 'pointer', userSelect: 'none',
        background: open ? 'var(--bg-primary)' : 'transparent',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontWeight: '600', fontSize: 'var(--font-size-md)', flex: 1 }}>{title}</span>
        {count != null && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 8px', borderRadius: '10px' }}>{count}</span>
        )}
        <ChevronRight
          size={14}
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        />
      </div>
      {open && <div style={{ padding: '8px 16px 12px' }}>{children}</div>}
    </div>
  );
}
