export function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '10px', fontWeight: '600', fontSize: 'var(--font-size-md)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>{icon}</span>{title}
      </div>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: '8px', overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

export function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '10px 16px',
      borderBottom: '1px solid var(--border)', minHeight: '44px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>{label}</div>
        {desc && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '1px' }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

export function SegmentedControl({ options, value, onChange }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '2px' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '4px 12px', border: 'none', borderRadius: '4px',
            fontSize: 'var(--font-size-sm)', cursor: 'pointer', transition: 'all 0.15s',
            background: value === opt.value ? 'var(--bg-secondary)' : 'transparent',
            color: value === opt.value ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: value === opt.value ? '600' : '400',
            boxShadow: value === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ options, value, onChange, width }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  width?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '5px 10px', border: '1px solid var(--border)', borderRadius: '6px',
        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
        fontSize: 'var(--font-size-base)', cursor: 'pointer', outline: 'none',
        width: width || 'auto',
      }}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: '40px', height: '22px', borderRadius: '11px', cursor: 'pointer',
        background: value ? 'var(--accent)' : 'var(--text-muted)',
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
        position: 'absolute', top: '2px', left: value ? '20px' : '2px',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );
}

/* ─── FieldGrid：两列表单网格 ─── */
export function FieldGrid({ children, columns = 2 }: { children: React.ReactNode; columns?: 1 | 2 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: columns === 2 ? '1fr 1fr' : '1fr',
      gap: '12px', padding: '12px 16px',
    }}>
      {children}
    </div>
  );
}

/* ─── Field：字段组（label + 控件 + hint） ─── */
export function Field({ label, hint, children, span }: {
  label: string; hint?: string; children: React.ReactNode; span?: 1 | 2;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '5px',
      gridColumn: span === 2 ? '1 / -1' : undefined,
    }}>
      <label style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', fontWeight: '600' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', lineHeight: '1.5' }}>{hint}</span>}
    </div>
  );
}

/* ─── Collapsible：可折叠区域 ─── */
export function Collapsible({ title, desc, children, defaultOpen = false }: {
  title: string; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} style={{
      gridColumn: '1 / -1',
      border: '1px dashed var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 0,
    }}>
      <summary style={{
        cursor: 'pointer', padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: '4px',
        userSelect: 'none', color: 'var(--text-primary)',
        fontSize: 'var(--font-size-md)', fontWeight: '600',
      }}>
        {title}
        {desc && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: '400' }}>{desc}</span>}
      </summary>
      <div style={{ padding: '0 14px 10px' }}>
        {children}
      </div>
    </details>
  );
}

/* ─── TextArea：多行文本输入 ─── */
export function TextArea({ value, onChange, placeholder, rows = 6, mono = false }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      spellCheck={false}
      style={{
        width: '100%', padding: '10px 12px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: 'var(--font-size-md)',
        fontFamily: mono ? "var(--font-mono, 'Consolas', monospace)" : 'inherit',
        lineHeight: '1.6', resize: 'vertical', outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onFocus={e => {
        e.target.style.borderColor = 'var(--accent)';
        e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)';
      }}
      onBlur={e => {
        e.target.style.borderColor = 'var(--border)';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

/* ─── Button：统一按钮 ─── */
export function Button({ children, onClick, primary = false, disabled = false, icon }: {
  children: React.ReactNode; onClick?: () => void;
  primary?: boolean; disabled?: boolean; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: primary ? '7px 16px' : '4px 12px',
        border: `1px solid ${primary ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        background: primary ? 'var(--accent)' : 'var(--bg-secondary)',
        color: primary ? '#fff' : 'var(--text-secondary)',
        fontSize: primary ? 'var(--font-size-md)' : 'var(--font-size-base)',
        fontWeight: primary ? '500' : '400',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.borderColor = 'var(--accent)';
          if (!primary) e.currentTarget.style.color = 'var(--accent)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = primary ? 'var(--accent)' : 'var(--border)';
        if (!primary) e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      {icon}{children}
    </button>
  );
}

/* ─── Slider：滑块输入 ─── */
export function Slider({ label, value, onChange, min, max, step = 1, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; unit?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: '600' }}>{label}</span>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent)', fontWeight: '600' }}>{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: '4px',
          appearance: 'none', WebkitAppearance: 'none',
          background: 'var(--bg-tertiary)',
          borderRadius: '2px', outline: 'none',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}
