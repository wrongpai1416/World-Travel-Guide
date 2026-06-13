import { Clock, MapPin, Cloud, Landmark, Globe, Brain, Star } from 'lucide-react';
import Avatar from '../../shared/Avatar';
import type { GameState } from '../../../schema/variables';

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

export default function RightPanel({ gameState }: Props) {
  const world = gameState.世界;
  const npcs = gameState.人物档案;
  const notebook = gameState.玩家.记事本;

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
      {gameState.玩家.当前目标 && (
        <div className="surface-card" style={{ padding: '1rem' }}>
          <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            当前目标
          </h4>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--accent)' }}>
            {gameState.玩家.当前目标}
          </div>
        </div>
      )}

      {/* NPC列表 */}
      {Object.keys(npcs).length > 0 && (
        <div className="surface-card" style={{ padding: '1rem' }}>
          <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            人物档案 ({Object.keys(npcs).length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(npcs).map(([id, npc]) => (
              <div key={id} style={{
                padding: '8px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <Avatar name={npc.姓名 || id} size="sm" />
                    <span style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.姓名 || id}</span>
                  </div>
                  {npc.重要NPC && <Star size={12} fill="var(--warning)" color="var(--warning)" style={{ flexShrink: 0 }} />}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', paddingLeft: '36px' }}>
                  <span>好感 {npc.关系数据?.好感度 ?? 0}</span>
                  <span>信任 {npc.关系数据?.信任度 ?? 0}</span>
                </div>
                {/* 生存状态条 */}
                {npc.生存状态 && (
                  <div style={{ marginTop: '4px', display: 'flex', gap: '4px', paddingLeft: '36px' }}>
                    <MiniBar value={npc.生存状态.血量 ?? 100} color="#e74c3c" />
                    <MiniBar value={npc.生存状态.体力值 ?? 100} color="#f39c12" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
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

      {/* 信息层级 */}
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

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ flex: 1, height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '2px' }} />
    </div>
  );
}
