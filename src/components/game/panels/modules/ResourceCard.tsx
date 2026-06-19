// 资源管理卡片 — 货币 + 资源列表
import { Gem } from 'lucide-react';
import type { ResourceModuleSchema } from '../../../../modules/schema';
import { Collapsible } from '../../../shared/Collapsible';

interface ResourceCardProps {
  data: ResourceModuleSchema;
}

export default function ResourceCard({ data }: ResourceCardProps) {
  const hasCurrency = !!data.currency;
  const hasItems = data.items.length > 0;

  if (!hasCurrency && !hasItems) {
    return (
      <Collapsible icon={<Gem size={15} />} title="资源管理" defaultOpen={true}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>暂无数据</div>
      </Collapsible>
    );
  }

  return (
    <Collapsible icon={<Gem size={15} />} title="资源管理" defaultOpen={true}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* 整体描述 */}
        {data.description && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
            {data.description}
          </div>
        )}

        {/* 货币 */}
        {data.currency && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '4px 8px', borderRadius: '6px',
            background: 'var(--accent)10', marginBottom: '4px',
          }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
              {data.currency.symbol} {data.currency.name}
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--accent)' }}>
              {data.currency.amount}
            </span>
          </div>
        )}

        {/* 资源列表 */}
        {data.items.map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 0', fontSize: 'var(--font-size-sm)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>{item.symbol}</span>
              <span style={{ color: 'var(--text-muted)' }}>{item.name}</span>
              {item.scarce && (
                <span style={{
                  fontSize: '10px', padding: '0 4px', borderRadius: '6px',
                  background: '#ef444420', color: '#ef4444',
                }}>稀缺</span>
              )}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.amount}{item.max != null ? `/${item.max}` : ''}
            </span>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}
