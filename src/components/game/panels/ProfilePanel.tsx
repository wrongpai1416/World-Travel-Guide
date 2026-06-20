import { useState } from 'react';
import {
  User, DollarSign, Swords, Backpack, Globe, Target, Newspaper,
  Shield, Wrench, Beaker, Wheat, Gem, BookOpen, Package, ScrollText,
  Crosshair, Crown, Shirt, CircleDot, FlaskConical, Fish, Compass, Key,
  type LucideIcon,
} from 'lucide-react';
import type { GameState, SkillData, InventoryItem } from '../../../schema/variables';
import { Collapsible } from '../../shared/Collapsible';
import { ExcelRow } from '../../shared/ExcelRow';
import { getQualityColor } from '../../shared/qualityUtils';

interface Props {
  gameState: GameState;
  /** 是否启用了经营模块（启用时隐藏货币资源，因为右侧已有经营卡片） */
  hasBusinessModule?: boolean;
}

// ─── 物品类型 → Lucide 图标映射 ───
const ITEM_TYPE_ICON: Record<string, LucideIcon> = {
  '武器': Swords,
  '防具': Shield,
  '护甲': Shield,
  '盾牌': Shield,
  '工具': Wrench,
  '药品': Beaker,
  '药水': FlaskConical,
  '药剂': FlaskConical,
  '食物': Wheat,
  '食材': Wheat,
  '材料': Gem,
  '矿石': Gem,
  '宝石': Gem,
  '书籍': BookOpen,
  '卷轴': ScrollText,
  '弹药': Crosshair,
  '饰品': Crown,
  '衣服': Shirt,
  '容器': Package,
  '鱼': Fish,
  '鱼获': Fish,
  '钥匙': Key,
  '导航': Compass,
};

function getItemIcon(item: InventoryItem): LucideIcon {
  const t = item.类型;
  if (t && ITEM_TYPE_ICON[t]) return ITEM_TYPE_ICON[t];
  // 模糊匹配
  if (t) {
    for (const [key, icon] of Object.entries(ITEM_TYPE_ICON)) {
      if (t.includes(key) || key.includes(t)) return icon;
    }
  }
  return CircleDot;
}

// ─── 详情弹窗 ───
function DetailModal({ title, quality, onClose, children, icon }: {
  title: string; quality?: string; onClose: () => void; children: React.ReactNode; icon?: React.ReactNode;
}) {
  const qColor = quality ? getQualityColor(quality) : 'var(--accent)';
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: `1px solid ${qColor}30`,
          borderRadius: '16px',
          maxWidth: '340px',
          width: '92%',
          overflow: 'hidden',
          boxShadow: `0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px ${qColor}15`,
        }}
      >
        {/* 头部 */}
        <div style={{
          background: `linear-gradient(135deg, ${qColor}15, ${qColor}05)`,
          padding: '16px 20px',
          borderBottom: `1px solid ${qColor}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {icon || <span style={{ color: qColor, fontSize: '16px' }}>●</span>}
            <div>
              <div style={{ fontWeight: '700', fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>{title}</div>
              {quality && (
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                  background: qColor + '20', color: qColor, fontWeight: '600',
                  display: 'inline-block', marginTop: '4px',
                }}>{quality}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              width: '28px', height: '28px', borderRadius: '8px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '14px',
            }}
          >✕</button>
        </div>
        {/* 内容 */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── 详情行 ───
function DetailRow({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', gap: '10px', fontSize: 'var(--font-size-sm)' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
        {icon}
        {label}
      </span>
      <span style={{ color: 'var(--text-primary)', lineHeight: '1.6', flex: 1 }}>{String(value)}</span>
    </div>
  );
}

export default function ProfilePanel({ gameState, hasBusinessModule }: Props) {
  const p = gameState.玩家;
  const w = gameState.世界;
  const s = p.生存状态;

  const [selectedSkill, setSelectedSkill] = useState<{ name: string; data: SkillData } | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ name: string; data: InventoryItem } | null>(null);

  return (
    <div>
      {/* 角色基本信息 */}
      <Collapsible icon={<User size={15} />} title="基本信息">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ExcelRow label="姓名" value={p.姓名} />
          <ExcelRow label="性别" value={p.性别} />
          <ExcelRow label="年龄" value={String(p.年龄)} />
          {p.性格 && <ExcelRow label="性格" value={p.性格} />}
          {p.外貌 && <ExcelRow label="外貌" value={p.外貌} />}
          <ExcelRow label="职业" value={p.身份信息.职业} />
          <ExcelRow label="阶层" value={p.身份信息.阶层} />
          <ExcelRow label="所属组织" value={p.身份信息.所属组织} />
          {p.身份信息.特殊身份 && <ExcelRow label="特殊身份" value={p.身份信息.特殊身份} />}
        </div>
      </Collapsible>

      {/* 货币资源（经营模块启用时隐藏，资金已在右侧经营卡片显示） */}
      {!hasBusinessModule && (
        <Collapsible icon={<DollarSign size={15} />} title="货币资源">
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--font-size-md)' }}>
            <span style={{ color: 'var(--accent)' }}>{p.货币资源.主货币.名称 || '金币'}</span>
            <span style={{ fontWeight: '600' }}>{p.货币资源.主货币.数量}</span>
          </div>
          {Object.entries(p.货币资源.次级货币).map(([name, cur]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              <span>{name}</span>
              <span>{cur.数量}</span>
            </div>
          ))}
        </Collapsible>
      )}

      {/* 技能系统 - 列表样式，可点击 */}
      {Object.keys(p.技能系统).length > 0 && (
        <Collapsible icon={<Swords size={15} />} title="技能系统">
          {Object.entries(p.技能系统).map(([name, skill]) => {
            const qColor = getQualityColor(skill.品质);
            return (
              <div
                key={name}
                onClick={() => setSelectedSkill({ name, data: skill })}
                style={{
                  padding: '6px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <span style={{ color: qColor, fontSize: '11px' }}>●</span>
                <span style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)', flex: 1 }}>{name}</span>
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '8px',
                  background: qColor + '18', color: qColor,
                }}>{skill.品质}</span>
                {skill.描述 && (
                  <span style={{
                    fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                    maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{skill.描述}</span>
                )}
              </div>
            );
          })}
        </Collapsible>
      )}

      {/* 物品栏 - 背包网格 (桌面6列，移动端4列) */}
      <Collapsible icon={<Backpack size={15} />} title="物品栏">
        <div className="inventory-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '4px',
        }}>
          {/* 生成 48 格 (6×8) */}
          {Array.from({ length: 48 }).map((_, i) => {
            const entry = Object.entries(p.物品栏)[i];
            if (entry) {
              const [name, item] = entry;
              const qColor = getQualityColor(item.品质);
              const IconComp = getItemIcon(item);
              return (
                <div
                  key={name}
                  onClick={() => setSelectedItem({ name, data: item })}
                  style={{
                    aspectRatio: '1',
                    padding: '6px 4px',
                    border: `1px solid ${qColor}40`,
                    borderRadius: 'var(--radius-sm)',
                    background: `linear-gradient(135deg, ${qColor}08, ${qColor}03)`,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    minWidth: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = qColor; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${qColor}40`; }}
                >
                  {item.数量 > 1 && (
                    <span style={{
                      position: 'absolute', top: '2px', right: '3px',
                      fontSize: '9px', fontWeight: '700', color: qColor,
                      lineHeight: 1,
                    }}>×{item.数量}</span>
                  )}
                  <IconComp size={16} color={qColor} />
                  <div style={{
                    fontSize: '9px', fontWeight: '500', marginTop: '2px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center',
                  }}>{name}</div>
                </div>
              );
            }
            // 空格子
            return (
              <div
                key={`empty-${i}`}
                style={{
                  aspectRatio: '1',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                }}
              />
            );
          })}
        </div>
      </Collapsible>

      {/* 世界状态 */}
      <Collapsible icon={<Globe size={15} />} title="世界状态">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {w.时间系统.当前时间 && <ExcelRow label="时间" value={w.时间系统.当前时间} />}
          {w.空间定位.当前位置 && <ExcelRow label="位置" value={w.空间定位.当前位置} />}
          {w.时间系统.当前天气 && <ExcelRow label="天气" value={w.时间系统.当前天气} />}
          {w.社会环境.权力结构 && <ExcelRow label="权力结构" value={w.社会环境.权力结构} />}
        </div>
      </Collapsible>

      {/* 当前目标 */}
      {p.当前目标 && (
        <Collapsible icon={<Target size={15} />} title="当前目标">
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--accent)', lineHeight: '1.5' }}>{p.当前目标}</div>
        </Collapsible>
      )}

      {/* 信息层级 */}
      <Collapsible icon={<Newspaper size={15} />} title="信息层级" defaultOpen={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {w.信息层级.全局重大事件 && <InfoItem label="全局" text={w.信息层级.全局重大事件} />}
          {w.信息层级.区域事件 && <InfoItem label="区域" text={w.信息层级.区域事件} />}
          {w.信息层级.本地消息 && <InfoItem label="本地" text={w.信息层级.本地消息} />}
          {w.信息层级.圈内传闻 && <InfoItem label="传闻" text={w.信息层级.圈内传闻} />}
        </div>
      </Collapsible>

      {/* 技能详情弹窗 */}
      {selectedSkill && (
        <DetailModal title={selectedSkill.name} quality={selectedSkill.data.品质} onClose={() => setSelectedSkill(null)}>
          {selectedSkill.data.类型 && <DetailRow label="类型" value={selectedSkill.data.类型} />}
          {selectedSkill.data.描述 && <DetailRow label="描述" value={selectedSkill.data.描述} />}
        </DetailModal>
      )}

      {/* 物品详情弹窗 */}
      {selectedItem && (
        <DetailModal title={selectedItem.name} quality={selectedItem.data.品质} onClose={() => setSelectedItem(null)}>
          <DetailRow label="数量" value={selectedItem.data.数量} />
          {selectedItem.data.类型 && <DetailRow label="类型" value={selectedItem.data.类型} />}
          {selectedItem.data.有效期 && <DetailRow label="有效期" value={selectedItem.data.有效期} />}
          {selectedItem.data.特殊属性 && <DetailRow label="特殊属性" value={selectedItem.data.特殊属性} />}
          {selectedItem.data.备注 && <DetailRow label="备注" value={selectedItem.data.备注} />}
        </DetailModal>
      )}
    </div>
  );
}

function InfoItem({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: '1.5' }}>
      <span style={{ fontWeight: '600', color: 'var(--text-muted)', marginRight: '4px' }}>[{label}]</span>
      {text}
    </div>
  );
}
