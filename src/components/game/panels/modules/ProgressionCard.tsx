// 成长体系卡片 — 段位/等级 + XP进度条
import { TrendingUp } from 'lucide-react';
import type { ProgressionModuleSchema } from '../../../../modules/schema';
import { getXpForNextTier, getTierProgress } from '../../../../modules/xpAlgorithm';
import { Collapsible } from '../../../shared/Collapsible';

interface ProgressionCardProps {
  data: ProgressionModuleSchema;
}

export default function ProgressionCard({ data }: ProgressionCardProps) {
  if (!data.tiers.length) {
    return (
      <Collapsible icon={<TrendingUp size={15} />} title="成长体系" defaultOpen={true}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>暂无数据</div>
      </Collapsible>
    );
  }

  const currentTier = data.tiers[data.currentTierIndex];
  const nextTier = data.tiers[data.currentTierIndex + 1];
  const xpNeeded = getXpForNextTier(data);
  const progress = getTierProgress(data);
  const pct = Math.round(progress * 100);

  return (
    <Collapsible icon={<TrendingUp size={15} />} title={data.mode === 'tiered' ? '段位体系' : '等级体系'} defaultOpen={true}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* 当前段位/等级 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--accent)' }}>
            {currentTier?.name || '未知'}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {data.mode === 'level' ? `Lv.${data.currentTierIndex + 1}` : `第${data.currentTierIndex + 1}段`}
          </span>
        </div>

        {/* 当前段位描述 */}
        {currentTier?.description && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {currentTier.description}
          </div>
        )}

        {/* XP进度条 */}
        {xpNeeded !== Infinity && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>
              <span style={{ color: 'var(--text-muted)' }}>经验</span>
              <span style={{ color: 'var(--text-secondary)' }}>{data.currentXP} / {xpNeeded}</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#a78bfa', borderRadius: '4px', transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* 下一段位 */}
        {nextTier && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            → 下一级：{nextTier.name}
          </div>
        )}

        {/* 已满级 */}
        {!nextTier && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', fontWeight: 600 }}>
            ✦ 已达最高段位
          </div>
        )}
      </div>
    </Collapsible>
  );
}
