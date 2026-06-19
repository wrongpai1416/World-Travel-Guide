// 经营资产卡片（占位，待设计完善）
import { Briefcase } from 'lucide-react';
import type { BusinessModuleSchema } from '../../../../modules/schema';
import { Collapsible } from '../../../shared/Collapsible';

interface BusinessCardProps {
  data: BusinessModuleSchema;
  title?: string;
}

export default function BusinessCard({ data, title }: BusinessCardProps) {
  const displayTitle = title || '经营资产';

  return (
    <Collapsible icon={<Briefcase size={15} />} title={displayTitle} defaultOpen={true}>
      {data.description && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
          {data.description}
        </div>
      )}
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        TODO: 待设计完善
      </div>
    </Collapsible>
  );
}
