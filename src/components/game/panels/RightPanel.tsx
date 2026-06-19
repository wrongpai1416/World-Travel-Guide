import { Clock, MapPin, Cloud, Landmark, Globe, Brain, Heart, Zap } from 'lucide-react';
import type { GameState } from '../../../schema/variables';
import type { WorldDef } from '../../../data/worlds-schema';
import { extractWorldSystemData } from '../../../modules/runtime';
import type { WorldSystemData, ProgressionConfig } from '../../../modules/schema';
import { BaseStatsCard, SixDimCard, ProgressionCard, ResourceCard, TalentCard } from './modules';
import { findWorldDef } from '../../../data/worldLoader';

interface Props {
  gameState: GameState;
  worldId?: string;
}

// 世界状态行 - Lucide 图标 + 文字
function StatusRow({ icon, text, muted }: { icon: React.ReactNode; text: string; muted?: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: muted ? 'var(--text-muted)' : undefined }}>
      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      {text}
    </span>
  );
}

// 生存状态条
function GaugeBar({ label, value, max, color, icon }: { label: string; value: number; max: number; color: string; icon: React.ReactNode }) {
  // 防御：确保 value 和 max 是有效数字
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const safeMax = typeof max === 'number' && !isNaN(max) && max > 0 ? max : 100;
  const pct = Math.max(0, Math.min(100, (safeValue / safeMax) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ width: '32px', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{label}</span>
      <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ width: '50px', fontSize: 'var(--font-size-xs)', textAlign: 'right', color: 'var(--text-secondary)' }}>{safeValue}/{safeMax}</span>
    </div>
  );
}

export default function RightPanel({ gameState, worldId }: Props) {
  const world = gameState.世界;
  const player = gameState.玩家;
  const notebook = player.记事本;

  // 提取世界系统数据
  const worldSystem = extractWorldSystemData(world.世界系统);
  const hasStatModule = !!worldSystem.数值属性;

  // 提取模块自定义名称（世界创建时设置）
  const moduleNames = (world.世界系统 as any)?._moduleNames as Record<string, string> | undefined;

  // 从世界定义获取成长体系配置（静态配置，不存入 GameState）
  const worldDef = worldId ? findWorldDef(worldId) : null;
  const progMod = worldDef?.modules?.find(m => m.moduleId === 'progression' && m.enabled);
  const progressionConfig = progMod?.moduleConfig as ProgressionConfig | undefined;

  // 从世界定义获取数值属性配置（用于显示属性中文名称）
  const statMod = worldDef?.modules?.find(m => m.moduleId === 'stat' && m.enabled);
  const statModuleData = statMod?.moduleConfig as any;
  const statConfig = statModuleData ? {
    attrA: { name: statModuleData.attrA?.name || '生命' },
    attrB: { name: statModuleData.attrB?.name || '能量' },
    dim1: { name: statModuleData.dim1?.name || '属性1' },
    dim2: { name: statModuleData.dim2?.name || '属性2' },
    dim3: { name: statModuleData.dim3?.name || '属性3' },
    dim4: { name: statModuleData.dim4?.name || '属性4' },
    dim5: { name: statModuleData.dim5?.name || '属性5' },
    dim6: { name: statModuleData.dim6?.name || '属性6' },
  } : undefined;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      padding: '1rem',
      overflowY: 'auto',
      height: '100%',
    }}>
      {/* 世界状态 */}
      <div className="surface-card" style={{ padding: '1rem' }}>
        <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          世界状态
        </h4>
        <div style={{ fontSize: 'var(--font-size-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(!world.时间系统.当前时间 && !world.空间定位.当前位置) ? (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 'var(--font-size-sm)' }}>
              等待世界展开...
            </span>
          ) : (
            <>
              {world.时间系统.当前时间 && <StatusRow icon={<Clock size={13} />} text={`${world.时间系统.当前时间}${world.时间系统.纪元名称 ? ` (${world.时间系统.纪元名称})` : ''}`} />}
              {world.空间定位.当前位置 && <StatusRow icon={<MapPin size={13} />} text={`${world.空间定位.当前位置}${world.空间定位.区域特征 ? ` · ${world.空间定位.区域特征}` : ''}`} />}
              {world.时间系统.当前天气 && <StatusRow icon={<Cloud size={13} />} text={world.时间系统.当前天气} />}
              {world.社会环境.权力结构 && <StatusRow icon={<Landmark size={13} />} text={world.社会环境.权力结构} />}
              {world.社会环境.社会氛围 && <StatusRow icon={<Globe size={13} />} text={world.社会环境.社会氛围} muted />}
              {world.社会环境.主流价值观 && <StatusRow icon={<Brain size={13} />} text={world.社会环境.主流价值观} muted />}
            </>
          )}
        </div>
      </div>

      {/* 当前目标 */}
      {player.当前目标 && (
        <div className="surface-card" style={{ padding: '1rem' }}>
          <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            当前目标
          </h4>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--accent)' }}>
            {player.当前目标}
          </div>
        </div>
      )}

      {/* 生存状态（无数值属性模块时显示默认血量/体力） */}
      {!hasStatModule && (
        <div className="surface-card" style={{ padding: '1rem' }}>
          <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            生存状态
          </h4>
          <GaugeBar icon={<Heart size={11} color="#ef4444" />} label="血量" value={player.生存状态.血量} max={100} color="#ef4444" />
          <GaugeBar icon={<Zap size={11} color="#f59e0b" />} label="体力" value={player.生存状态.体力值} max={100} color="#f59e0b" />
        </div>
      )}

      {/* ── v2 模块卡片（新格式） ── */}
      {worldSystem.数值属性 && (
        <>
          <BaseStatsCard data={worldSystem.数值属性} title={moduleNames?.['数值属性']} />
          <SixDimCard data={worldSystem.数值属性} title={moduleNames?.['数值属性'] ? moduleNames['数值属性'] + ' · 六维' : undefined} />
        </>
      )}
      {/* 成长体系：配置从世界定义读取，状态从玩家读取 */}
      {progressionConfig && (
        <ProgressionCard
          config={progressionConfig}
          state={{
            currentTierIndex: player.当前段位索引 ?? 0,
            currentXP: player.当前经验值 ?? 0,
          }}
          title={worldDef?.modules?.find(m => m.moduleId === 'progression')?.name || '成长体系'}
          statNames={statConfig ? {
            attrA: statConfig.attrA.name,
            attrB: statConfig.attrB.name,
            dim1: statConfig.dim1.name,
            dim2: statConfig.dim2.name,
            dim3: statConfig.dim3.name,
            dim4: statConfig.dim4.name,
            dim5: statConfig.dim5.name,
            dim6: statConfig.dim6.name,
          } : undefined}
        />
      )}
      {worldSystem.资源管理 && (
        <ResourceCard data={worldSystem.资源管理} title={moduleNames?.['资源管理']} />
      )}
      {worldSystem.天赋体系 && (
        <TalentCard data={worldSystem.天赋体系} title={moduleNames?.['天赋体系']} />
      )}

      {/* 待办事项 */}
      {Object.keys(notebook.待办事项).length > 0 && (
        <div className="surface-card" style={{ padding: '1rem' }}>
          <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            待办事项
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(notebook.待办事项).map(([name, todo]) => (
              <div key={name} style={{ fontSize: 'var(--font-size-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: todo.状态 === '已完成' ? 0.5 : 1, textDecoration: todo.状态 === '已完成' ? 'line-through' : 'none' }}>
                    {name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{todo.优先级}</span>
                </div>
                {todo.截止时间 && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>截止: {todo.截止时间}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最新消息 */}
      {world.信息层级.本地消息 && (
        <div className="surface-card" style={{ padding: '1rem' }}>
          <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            最新消息
          </h4>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            {world.信息层级.本地消息}
          </div>
        </div>
      )}
    </div>
  );
}
