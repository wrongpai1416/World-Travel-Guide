// 经营管理覆盖层 — 纯展示（无操作按钮）
import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, X, DollarSign, TrendingUp, TrendingDown,
  Building2, Users, AlertTriangle, BarChart3, ScrollText,
  Minus, ChevronRight,
} from 'lucide-react';
import type {
  BusinessModuleSchema, BusinessAsset,
  MarketItem, TransactionEntry,
} from '../../../modules/schema';

interface BusinessOverlayProps {
  open: boolean;
  data: BusinessModuleSchema;
  title?: string;
  onClose: () => void;
}

// ── 状态标签颜色 ──
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: '#22c55e20', text: '#22c55e', label: '营业中' },
  idle: { bg: '#94a3b820', text: '#94a3b8', label: '闲置' },
  damaged: { bg: '#ef444420', text: '#ef4444', label: '受损' },
  destroyed: { bg: '#6b728020', text: '#6b7280', label: '已毁' },
};

// ── 风险等级颜色 ──
const RISK_COLORS: Record<string, { color: string; label: string }> = {
  low: { color: '#22c55e', label: '低' },
  medium: { color: '#eab308', label: '中' },
  high: { color: '#ef4444', label: '高' },
};

// ── 趋势图标 ──
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={13} color="#22c55e" />;
  if (trend === 'down') return <TrendingDown size={13} color="#ef4444" />;
  return <Minus size={13} color="var(--text-muted)" />;
}

// ── 计算资产净收益 ──
function assetNetIncome(asset: BusinessAsset): number {
  const levelBonus = (asset.income?.perLevel ?? 0) * Math.max(0, (asset.level ?? 1) - 1);
  return (asset.income?.base ?? 0) + levelBonus - (asset.maintenance ?? 0);
}

export default function BusinessOverlay({
  open, data, title, onClose,
}: BusinessOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const timer = setTimeout(() => { setVisible(false); setExpandedAsset(null); }, 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!visible) return null;

  const activeAssets = data.assets?.filter(a => a.status !== 'destroyed') ?? [];
  const totalIncome = data.assets?.filter(a => a.status === 'active').reduce((s, a) => s + assetNetIncome(a), 0) ?? 0;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 99,
          opacity: animating ? 1 : 0, transition: 'opacity 0.25s ease',
        }}
      />
      {/* 面板 */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: '50%', minWidth: '380px', maxWidth: '600px',
          background: 'var(--bg-primary)', zIndex: 100,
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          transform: animating ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* ── 顶部栏 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px',
            width: '32px', height: '32px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)', flex: 1 }}>
            {title || '经营资产'}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* ── 内容区 ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── 资金概览 ── */}
          <div className="surface-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <DollarSign size={20} color="var(--accent)" />
              <div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--accent)' }}>
                  {data.funds ?? 0}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>总资金</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{
                  fontSize: 'var(--font-size-lg)', fontWeight: 600,
                  color: totalIncome >= 0 ? '#22c55e' : '#ef4444',
                }}>
                  {totalIncome >= 0 ? '+' : ''}{totalIncome}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  净收入/{data.cycleName || '天'}
                </div>
              </div>
            </div>
            {data.description && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                {data.description}
              </p>
            )}
          </div>

          {/* ── 资产列表 ── */}
          <div>
            <div style={{
              fontSize: 'var(--font-size-sm)', fontWeight: 600,
              color: 'var(--text-muted)', marginBottom: '8px',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              资产列表 ({activeAssets.length})
            </div>
            {activeAssets.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px 16px',
                color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)',
              }}>
                <Building2 size={32} strokeWidth={1} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <div>暂无经营资产</div>
                <div style={{ fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                  通过角色行动在叙事中获取资产
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeAssets.map(asset => (
                  <AssetCardExpandable
                    key={asset.id}
                    asset={asset}
                    expanded={expandedAsset === asset.id}
                    onToggle={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── 市场行情 ── */}
          {data.market?.items && data.market.items.length > 0 && (
            <div className="surface-card" style={{ padding: '12px 16px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: 'var(--font-size-sm)', fontWeight: 600,
                color: 'var(--text-muted)', marginBottom: '8px',
              }}>
                <BarChart3 size={14} />
                市场行情
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {data.market.items.map((item, i) => (
                  <MarketRow key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* ── 经营日志 ── */}
          {data.transactionLog && data.transactionLog.length > 0 && (
            <div className="surface-card" style={{ padding: '12px 16px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: 'var(--font-size-sm)', fontWeight: 600,
                color: 'var(--text-muted)', marginBottom: '8px',
              }}>
                <ScrollText size={14} />
                经营日志
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {data.transactionLog.slice(-10).reverse().map((entry, i) => (
                  <LogRow key={i} entry={entry} cycleName={data.cycleName} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════
//  子组件
// ═══════════════════════════════════════

/** 可展开的资产卡片（纯展示） */
function AssetCardExpandable({ asset, expanded, onToggle }: {
  asset: BusinessAsset; expanded: boolean; onToggle: () => void;
}) {
  const status = STATUS_COLORS[asset.status] || STATUS_COLORS.active;
  const risk = asset.risk ? RISK_COLORS[asset.risk.level] || RISK_COLORS.low : null;
  const net = assetNetIncome(asset);
  const staff = asset.staff;
  const totalIncome = (asset.income?.base ?? 0) + (asset.income?.perLevel ?? 0) * Math.max(0, (asset.level ?? 1) - 1);

  return (
    <div className="surface-card" style={{ padding: '12px 16px', border: '1px solid var(--border)' }}>
      {/* 头部（点击展开） */}
      <div
        onClick={onToggle}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>{asset.name}</span>
            <span style={{
              fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: '8px',
              background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 600,
            }}>
              Lv.{asset.level}/{asset.maxLevel}
            </span>
            <span style={{
              fontSize: '10px', padding: '1px 6px', borderRadius: '8px',
              background: status.bg, color: status.text, fontWeight: 600,
            }}>
              {status.label}
            </span>
            {risk && (
              <span style={{
                fontSize: '10px', padding: '1px 6px', borderRadius: '8px',
                background: `${risk.color}15`, color: risk.color,
                display: 'inline-flex', alignItems: 'center', gap: '2px',
              }}>
                <AlertTriangle size={10} />
                风险{risk.label}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{asset.type}</span>
            <span style={{ color: '#22c55e' }}>+{totalIncome}</span>
            <span style={{ color: '#ef4444' }}>-{asset.maintenance ?? 0}</span>
            <span style={{ color: net >= 0 ? 'var(--text-primary)' : '#ef4444', fontWeight: 600 }}>
              净{net >= 0 ? '+' : ''}{net}
            </span>
          </div>
        </div>
        <ChevronRight size={14} style={{
          color: 'var(--text-muted)', flexShrink: 0,
          transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
          transition: 'transform 0.2s',
        }} />
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div style={{
          marginTop: '12px', paddingTop: '12px',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: '8px',
          fontSize: 'var(--font-size-sm)',
        }}>
          {asset.description && (
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {asset.description}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <DetailItem icon={<TrendingUp size={13} color="#22c55e" />} label="基础收益" value={`${asset.income?.base ?? 0}/${asset.income?.cycle || '天'}`} />
            <DetailItem icon={<TrendingUp size={13} color="#22c55e" />} label="每级加成" value={`+${asset.income?.perLevel ?? 0}`} />
            <DetailItem icon={<TrendingDown size={13} color="#ef4444" />} label="维护费" value={`${asset.maintenance ?? 0}/${asset.income?.cycle || '天'}`} />
            <DetailItem icon={<DollarSign size={13} color="var(--accent)" />} label="净收益" value={`${net >= 0 ? '+' : ''}${net}`} />
          </div>
          {staff && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <Users size={13} />
              <span>员工 {staff.current}/{staff.max}</span>
              <span>·</span>
              <span>效率 {staff.efficiency}</span>
            </div>
          )}
          {asset.income?.resource && (
            <div style={{ color: 'var(--text-muted)' }}>
              产出资源：{asset.income.resource}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 详情项 */
function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {icon}
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, marginLeft: 'auto' }}>{value}</span>
    </div>
  );
}

/** 市场行情行 */
function MarketRow({ item }: { item: MarketItem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-sm)' }}>
      <span style={{ flex: 1 }}>{item.name}</span>
      <span style={{ fontWeight: 600 }}>{item.basePrice}</span>
      <TrendIcon trend={item.trend} />
      <span style={{
        fontSize: 'var(--font-size-xs)', fontWeight: 600,
        color: item.trend === 'up' ? '#22c55e' : item.trend === 'down' ? '#ef4444' : 'var(--text-muted)',
      }}>
        {item.changePercent > 0 ? '+' : ''}{item.changePercent}%
      </span>
    </div>
  );
}

/** 经营日志行 */
function LogRow({ entry, cycleName }: { entry: TransactionEntry; cycleName: string }) {
  const typeLabels: Record<string, { label: string; color: string }> = {
    income: { label: '收入', color: '#22c55e' },
    expense: { label: '支出', color: '#ef4444' },
    acquire: { label: '收购', color: 'var(--accent)' },
    upgrade: { label: '升级', color: '#3b82f6' },
    event: { label: '事件', color: '#eab308' },
  };
  const t = typeLabels[entry.type] || typeLabels.event;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-xs)' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: '40px' }}>第{entry.cycle}{cycleName}</span>
      <span style={{
        padding: '0 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600,
        background: `${t.color}15`, color: t.color,
      }}>
        {t.label}
      </span>
      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{entry.description}</span>
      {entry.amount != null && (
        <span style={{
          fontWeight: 600,
          color: entry.amount >= 0 ? '#22c55e' : '#ef4444',
        }}>
          {entry.amount >= 0 ? '+' : ''}{entry.amount}
        </span>
      )}
    </div>
  );
}
