// 六维属性 + 特色属性卡片
import { BarChart3 } from 'lucide-react';
import type { StatModuleSchema } from '../../../../modules/schema';
import { Collapsible } from '../../../shared/Collapsible';

interface SixDimCardProps {
  data: StatModuleSchema;
}

const DIM_KEYS = ['dim1', 'dim2', 'dim3', 'dim4', 'dim5', 'dim6'] as const;

export default function SixDimCard({ data }: SixDimCardProps) {
  return (
    <Collapsible icon={<BarChart3 size={15} />} title="六维属性" defaultOpen={true}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
        {DIM_KEYS.map(key => {
          const dim = data[key];
          const pct = Math.max(0, Math.min(100, ((dim.value - dim.range[0]) / (dim.range[1] - dim.range[0])) * 100));
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{dim.name}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>{dim.value}</span>
              </div>
              <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 特色属性 */}
      {data.special.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {data.special.map(sp => (
            <div
              key={sp.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '10px',
                background: 'var(--accent)15', fontSize: 'var(--font-size-xs)',
              }}
              title={sp.description}
            >
              <span style={{ color: 'var(--text-muted)' }}>{sp.name}</span>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{sp.value}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>/ {sp.range[1]}</span>
            </div>
          ))}
        </div>
      )}
    </Collapsible>
  );
}
