export function ExcelRow({ label, value }: { label: string; value: string | number }) {
  const display = value === '' || value == null ? '-' : value;
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '8px 0', fontSize: 'var(--font-size-base)',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ width: '100px', color: 'var(--text-muted)', flexShrink: 0, fontSize: 'var(--font-size-base)' }}>{label}</span>
      <span style={{ flex: 1 }}>{display}</span>
    </div>
  );
}
