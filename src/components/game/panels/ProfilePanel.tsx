import { User, Heart, Zap, DollarSign, Swords, Backpack, Globe, Target, Newspaper } from 'lucide-react';
// Swords 仍然用于技能系统，保留
import type { GameState } from '../../../schema/variables';
import { Collapsible } from '../../shared/Collapsible';
import { ExcelRow } from '../../shared/ExcelRow';
import { getQualityColor } from '../../shared/qualityUtils';

interface Props {
  gameState: GameState;
}

// 进度条
function GaugeBar({ label, value, max = 100, color, icon }: {
  label: string; value: number; max?: number; color: string; icon: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ width: '48px', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>{label}</span>
      <div style={{ flex: 1, height: '10px', background: 'var(--bg-tertiary)', borderRadius: '5px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ width: '52px', fontSize: 'var(--font-size-sm)', textAlign: 'right', color: 'var(--text-secondary)' }}>{value}/{max}</span>
    </div>
  );
}

export default function ProfilePanel({ gameState }: Props) {
  const p = gameState.玩家;
  const w = gameState.世界;
  const s = p.生存状态;

  return (
    <div>
      {/* 角色基本信息 */}
      <Collapsible icon={<User size={15} />} title="基本信息">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ExcelRow label="姓名" value={p.姓名} />
          <ExcelRow label="性别" value={p.性别} />
          <ExcelRow label="年龄" value={String(p.年龄)} />
          <ExcelRow label="职业" value={p.身份信息.职业} />
          <ExcelRow label="阶层" value={p.身份信息.阶层} />
          <ExcelRow label="所属组织" value={p.身份信息.所属组织} />
          {p.身份信息.特殊身份 && <ExcelRow label="特殊身份" value={p.身份信息.特殊身份} />}
        </div>
      </Collapsible>

      {/* 生存状态 */}
      <Collapsible icon={<Heart size={15} />} title="生存状态">
        <GaugeBar icon={<Heart size={12} color="#ef4444" />} label="血量" value={s.血量} color="#ef4444" />
        <GaugeBar icon={<Zap size={12} color="#f59e0b" />} label="体力" value={s.体力值} color="#f59e0b" />
      </Collapsible>

      {/* 货币资源 */}
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

      {/* 技能系统 */}
      {Object.keys(p.技能系统).length > 0 && (
        <Collapsible icon={<Swords size={15} />} title="技能系统">
          {Object.entries(p.技能系统).map(([name, skill]) => (
            <div key={name} style={{ padding: '4px 0', fontSize: 'var(--font-size-base)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: getQualityColor(skill.品质), fontSize: 'var(--font-size-xs)' }}>●</span>
              <span style={{ fontWeight: '500' }}>{name}</span>
              <span style={{
                fontSize: 'var(--font-size-sm)', padding: '2px 8px', borderRadius: '10px',
                background: getQualityColor(skill.品质) + '18', color: getQualityColor(skill.品质),
              }}>{skill.品质}</span>
              {skill.描述 && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.描述}</span>}
            </div>
          ))}
        </Collapsible>
      )}

      {/* 物品栏 */}
      {Object.keys(p.物品栏).length > 0 && (
        <Collapsible icon={<Backpack size={15} />} title="物品栏">
          {Object.entries(p.物品栏).map(([name, item]) => (
            <div key={name} style={{ padding: '3px 0', fontSize: 'var(--font-size-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: getQualityColor(item.品质), fontSize: 'var(--font-size-xs)' }}>●</span>
                {name}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>×{item.数量}</span>
            </div>
          ))}
        </Collapsible>
      )}

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
