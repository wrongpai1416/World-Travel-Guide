import { Clock, MapPin, Cloud, Landmark, Globe, Brain, Heart, Zap } from 'lucide-react';
import type { GameState } from '../../../schema/variables';
import { extractWorldSystemData } from '../../../modules/runtime';
import type { WorldSystemData } from '../../../modules/schema';
import { BaseStatsCard, SixDimCard, ProgressionCard, ResourceCard, DiceCard } from './modules';
import { getModuleTemplate, type ModuleRenderType } from '../../../data/modules';
import ModuleCard from './ModuleCard';

interface Props {
  gameState: GameState;
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
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ width: '32px', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{label}</span>
      <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ width: '50px', fontSize: 'var(--font-size-xs)', textAlign: 'right', color: 'var(--text-secondary)' }}>{value}/{max}</span>
    </div>
  );
}

export default function RightPanel({ gameState }: Props) {
  const world = gameState.世界;
  const player = gameState.玩家;
  const notebook = player.记事本;

  // 提取世界系统数据（兼容v2.1旧格式和v2新格式）
  const worldSystem = extractWorldSystemData(world.世界系统);
  const hasStatModule = !!worldSystem.数值属性;

  // 兼容旧格式：如果没有新格式数据，尝试从旧格式提取
  const legacyModules = !hasStatModule && world.世界系统 ? world.世界系统 as Record<string, any> : null;

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
      {!hasStatModule && !legacyModules && (
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
          <BaseStatsCard data={worldSystem.数值属性} />
          <SixDimCard data={worldSystem.数值属性} />
        </>
      )}
      {worldSystem.成长体系 && (
        <ProgressionCard data={worldSystem.成长体系} />
      )}
      {worldSystem.资源管理 && (
        <ResourceCard data={worldSystem.资源管理} />
      )}
      {worldSystem.骰子检定 && (
        <DiceCard data={worldSystem.骰子检定} statData={worldSystem.数值属性} />
      )}

      {/* ── v2.1 旧格式兼容渲染 ── */}
      {legacyModules && Object.entries(legacyModules).map(([key, mod]) => {
        if (!mod || typeof mod !== 'object' || !('moduleId' in mod)) return null;
        return (
          <LegacyModuleCard key={key} moduleKey={key} mod={mod as any} />
        );
      })}

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

// ── 旧格式兼容卡片 ──
function LegacyModuleCard({ moduleKey, mod }: { moduleKey: string; mod: { moduleId: string; 名称: string; 描述: string; 数据: Record<string, unknown> } }) {
  const template = getModuleTemplate(mod.moduleId);
  const renderType: ModuleRenderType = (template?.renderType || 'stats') as ModuleRenderType;
  return (
    <ModuleCard
      module={mod}
      moduleKey={moduleKey}
      renderType={renderType}
    />
  );
}
