/**
 * 世界动态面板 — 展示后台推演的世界事件和玩家切入点
 */

import { useState, useEffect } from 'react';
import {
  Globe, Zap, ChevronDown, ChevronRight, AlertTriangle,
  Users, Building2, Coins, PersonStanding, Sparkles,
  Target, Clock, MessageSquare, Radio,
} from 'lucide-react';
import { useSimulationStore } from '../../../stores/simulationStore';
import type { SimEvent, PlayerHook, EventLevel, NpcProactiveInteraction, SimConfig } from '../../../simulation/types';
import { DEFAULT_SIM_CONFIG } from '../../../simulation/types';
import { loadPresets } from '../../settings/apiPresetUtils';
import { getSimulationEngine } from '../../../simulation/SimulationApi';

const SIM_API_PRESET_KEY = 'world_travel_guide_sim_api_preset';

/** 获取当前世界的自适应层级标签（兜底通用标签） */
function getLevelLabel(level: EventLevel): string {
  try {
    return getSimulationEngine().getLevelLabels()[level] ?? level;
  } catch {
    return level;
  }
}

// ─── 图标映射 ───
const LEVEL_ICONS: Record<EventLevel, React.ReactNode> = {
  mythic: <Sparkles size={14} />,
  political: <Building2 size={14} />,
  factional: <Users size={14} />,
  economic: <Coins size={14} />,
  civilian: <PersonStanding size={14} />,
};

const LEVEL_COLORS: Record<EventLevel, string> = {
  mythic: 'var(--event-level-mythic)',
  political: 'var(--event-level-political)',
  factional: 'var(--event-level-factional)',
  economic: 'var(--event-level-economic)',
  civilian: 'var(--event-level-civilian)',
};

const URGENCY_ICONS: Record<string, React.ReactNode> = {
  urgent: <AlertTriangle size={12} color="var(--danger)" />,
  near_term: <Clock size={12} color="var(--warning)" />,
  ongoing: <Clock size={12} color="var(--text-muted)" />,
};

const URGENCY_LABELS: Record<string, string> = {
  urgent: '紧急',
  near_term: '近期',
  ongoing: '持续',
};

// ─── 事件卡片 ───
function EventCard({ event, depth = 0, tickCount }: { event: SimEvent; depth?: number; tickCount?: number }) {
  const [expanded, setExpanded] = useState(false);
  const severityBar = Math.min(100, event.severity * 10);
  const severityColor = event.severity >= 7 ? 'var(--danger)' : event.severity >= 4 ? 'var(--warning)' : 'var(--text-muted)';
  const staleTicks = tickCount != null ? tickCount - (event.lastUpdatedTick ?? 0) : 0;
  const isStale = staleTicks > 5;

  return (
    <div style={{
      marginBottom: '8px',
      marginLeft: `${depth * 16}px`,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-secondary)',
      overflow: 'hidden',
    }}>
      {/* 头部 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '8px 10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{ color: LEVEL_COLORS[event.level], display: 'flex', alignItems: 'center', gap: '4px' }}>
          {LEVEL_ICONS[event.level]}
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{getLevelLabel(event.level)}</span>
        </span>
        <span style={{ flex: 1, fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {event.title}
        </span>
        {/* 严重度条 */}
        <div style={{
          width: '40px', height: '4px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-tertiary)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${severityBar}%`, height: '100%',
            background: severityColor, borderRadius: 'var(--radius-sm)',
          }} />
        </div>
        <span className={`event-badge ${event.status}`}>
          {event.status === 'brewing' ? '酝酿' : event.status === 'active' ? '进行中' : '已结束'}
        </span>
        {isStale && event.status === 'active' && (
          <span className="event-badge brewing" style={{ fontSize: 'var(--font-size-xs)', padding: '1px 4px' }}>
            沉寂
          </span>
        )}
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div style={{ padding: '0 10px 10px 10px' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 var(--space-2) 0' }}>
            {event.description}
          </p>

          {/* 受影响实体 */}
          {((event.affectedNpcIds?.length ?? 0) > 0 || (event.affectedFactions?.length ?? 0) > 0) && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
              {(event.affectedFactions ?? []).map(f => (
                <span key={f} className="event-badge active" style={{ fontSize: 'var(--font-size-xs)', padding: '1px 6px' }}>
                  {f}
                </span>
              ))}
              {(event.affectedNpcIds ?? []).map(n => (
                <span key={n} style={{
                  fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                }}>
                  {n}
                </span>
              ))}
            </div>
          )}

          {/* 玩家切入点 */}
          {(event.playerHooks?.length ?? 0) > 0 && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' }}>
                <Target size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                玩家可介入
              </div>
              {event.playerHooks.map((hook, hi) => (
                <PlayerHookItem key={hi} hook={hook} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 切入点条目 ───
function PlayerHookItem({ hook }: { hook: PlayerHook }) {
  return (
    <div style={{
      fontSize: 'var(--font-size-xs)', padding: '6px 8px', marginBottom: '4px',
      borderLeft: '2px solid var(--accent)',
      background: 'var(--accent-dim)',
      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{hook.title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {URGENCY_ICONS[hook.urgency]}
          {URGENCY_LABELS[hook.urgency]}
        </span>
      </div>
      <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>{hook.description}</div>
      {(hook.suggestedActions?.length ?? 0) > 0 && (
        <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(hook.suggestedActions ?? []).map((action, ai) => (
            <span key={ai} style={{
              fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
            }}>
              {action}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 角色暗线条目 ───
function StorylineEntry({ npcId, npcName }: { npcId: string; npcName: string }) {
  const state = useSimulationStore(s => s.simState);
  const storyline = state.storylines[npcId];
  const [expanded, setExpanded] = useState(false);

  if (!storyline || storyline.beats.length === 0) return null;

  const recentBeats = storyline.beats.filter(b => !b.merged).slice(-5);

  return (
    <div style={{
      marginBottom: '8px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-secondary)',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: '8px 10px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <PersonStanding size={14} color="var(--accent)" />
        <span style={{ flex: 1, fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {npcName}
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {recentBeats.length} 个新进展
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '0 10px 10px 10px' }}>
          {storyline.summary && (
            <p style={{
              fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)',
              lineHeight: '1.5', fontStyle: 'italic', margin: '0 0 var(--space-2) 0',
              padding: '6px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
            }}>
              {storyline.summary}
            </p>
          )}
          {recentBeats.map((beat, bi) => (
            <div key={bi} style={{
              fontSize: 'var(--font-size-xs)', padding: '4px 0', borderBottom: '1px solid var(--border)',
              color: 'var(--text-secondary)', lineHeight: '1.5',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{beat.title}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', marginLeft: '6px' }}>
                {beat.time}
              </span>
              <div>{beat.narrative}</div>
              {beat.locationChange && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                  移至: {beat.locationChange}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── NPC 主动交互卡片 ───
function NpcInteractionCard({ interaction }: { interaction: NpcProactiveInteraction }) {
  const [expanded, setExpanded] = useState(false);
  const priorityColor = interaction.priority <= 100 ? 'var(--danger)'
    : interaction.priority <= 300 ? 'var(--warning)'
    : interaction.priority <= 600 ? 'var(--accent)' : 'var(--text-muted)';
  const priorityLabel = interaction.priority <= 100 ? '紧急'
    : interaction.priority <= 300 ? '重要'
    : interaction.priority <= 600 ? '一般' : '低';

  return (
    <div style={{
      marginBottom: '8px',
      border: `1px solid var(--border)`,
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-secondary)',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: '8px 10px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <MessageSquare size={14} color={priorityColor} />
        <span style={{ flex: 1, fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {interaction.npcName}
        </span>
        <span style={{
          fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)',
          background: priorityColor, color: 'var(--color-on-accent)', opacity: 0.85,
        }}>
          {priorityLabel}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '0 10px 10px 10px' }}>
          <div style={{
            fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)',
          }}>
            原因：{interaction.contactReason}
          </div>

          {/* NPC 内心想法 */}
          <div style={{
            fontSize: 'var(--font-size-xs)', padding: '6px 8px', marginBottom: 'var(--space-2)',
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.5',
            borderLeft: '2px solid var(--text-muted)',
          }}>
            💭 {interaction.innerThoughts}
          </div>

          {/* NPC 对白 */}
          <div style={{
            fontSize: 'var(--font-size-sm)', padding: '8px 10px',
            background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)', lineHeight: '1.6',
            borderLeft: '3px solid var(--accent)',
          }}>
            💬 {interaction.reply}
          </div>

          {/* 变量变更 */}
          {interaction.variableChanges && interaction.variableChanges.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {interaction.variableChanges.map((vc, i) => (
                <span key={i} style={{
                  fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                }}>
                  {vc}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 空状态 ───
function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 16px', gap: '8px',
      color: 'var(--text-muted)', textAlign: 'center',
    }}>
      <Globe size={32} opacity={0.4} />
      <div style={{ fontSize: 'var(--font-size-base)' }}>世界正在平静运转中</div>
      <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.7 }}>
        当重大事件发生时，动态将在此处展示
      </div>
    </div>
  );
}

// ─── 主面板 ───
interface Props {
  gameState?: import('../../../schema/variables').GameState;
  onManualTick?: () => void;
  isSimulating?: boolean;
}

export default function WorldDynamicsPanel({ gameState, onManualTick, isSimulating }: Props) {
  const { simState, updateConfig } = useSimulationStore();
  const [activeTab, setActiveTab] = useState<'events' | 'storylines' | 'interactions' | 'settings'>('events');

  const eventsMap = simState.events ?? {};
  const activeEvents = Object.values(eventsMap).filter(
    e => e.status === 'active' || e.status === 'brewing',
  );
  // 按严重度排序
  activeEvents.sort((a, b) => b.severity - a.severity);

  const offscreenNpcs = gameState
    ? Object.entries(gameState.人物档案 ?? {})
        .filter(([, npc]) => (npc.人物分类 === '离场' || npc.人物分类 === '重点') && npc.重要NPC)
        .slice(0, 10)
    : [];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      overflow: 'hidden',
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Globe size={16} color="var(--accent)" />
          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
            世界动态
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('events')}
            className={activeTab === 'events' ? 'btn-primary btn-xs' : 'btn-ghost btn-xs'}
          >
            事件
          </button>
          <button
            onClick={() => setActiveTab('storylines')}
            className={activeTab === 'storylines' ? 'btn-primary btn-xs' : 'btn-ghost btn-xs'}
          >
            暗线
          </button>
          <button
            onClick={() => setActiveTab('interactions')}
            className={activeTab === 'interactions' ? 'btn-primary btn-xs' : 'btn-ghost btn-xs'}
            style={{ position: 'relative' }}
          >
            交互
            {(simState.pendingInteractions ?? []).length > 0 && (
              <span className="notification-dot">
                {simState.pendingInteractions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={activeTab === 'settings' ? 'btn-primary btn-xs' : 'btn-ghost btn-xs'}
          >
            设置
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {activeTab === 'events' && (
          <>
            {/* 世界新闻摘要 */}
            {simState.worldNewsSummary && (
              <div style={{
                fontSize: 'var(--font-size-xs)', padding: '8px 10px', marginBottom: '10px',
                background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)', lineHeight: '1.6',
                border: '1px solid var(--accent)',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: '4px', fontSize: 'var(--font-size-xs)' }}>
                  <Zap size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  世界新闻
                </div>
                {simState.worldNewsSummary}
              </div>
            )}

            {/* 事件列表 */}
            {activeEvents.length === 0 ? (
              <EmptyState />
            ) : (
              activeEvents.map(evt => (
                <EventCard key={evt.id} event={evt} tickCount={simState.tickCount} />
              ))
            )}

            {/* 手动推演按钮 */}
            {onManualTick && (
              <button
                onClick={onManualTick}
                disabled={isSimulating}
                className="btn-ghost btn-sm"
                style={{ width: '100%', marginTop: 'var(--space-3)' }}
              >
                {isSimulating ? '推演中...' : '手动推演一次'}
              </button>
            )}
          </>
        )}

        {activeTab === 'storylines' && (
          <>
            {offscreenNpcs.length === 0 ? (
              <EmptyState />
            ) : (
              offscreenNpcs.map(([npcId, npc]) => (
                <StorylineEntry key={npcId} npcId={npcId} npcName={npc.姓名} />
              ))
            )}
            {/* 也显示已有暗线但不在离场列表中的 */}
            {Object.entries(simState.storylines ?? {})
              .filter(([id]) => !offscreenNpcs.some(([nid]) => nid === id))
              .map(([npcId]) => (
                <StorylineEntry key={npcId} npcId={npcId} npcName={npcId} />
              ))}
          </>
        )}

        {activeTab === 'interactions' && (
          <>
            {(simState.pendingInteractions ?? []).length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '32px 16px', gap: '8px',
                color: 'var(--text-muted)', textAlign: 'center',
              }}>
                <Radio size={32} opacity={0.4} />
                <div style={{ fontSize: 'var(--font-size-base)' }}>暂无 NPC 主动联系</div>
                <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.7 }}>
                  当离场角色有重要事务时，会在此处显示
                </div>
              </div>
            ) : (
              (simState.pendingInteractions ?? []).map(interaction => (
                <NpcInteractionCard key={interaction.id} interaction={interaction} />
              ))
            )}
          </>
        )}

        {activeTab === 'settings' && (
          <SimSettings />
        )}
      </div>
    </div>
  );
}

// ─── 设置面板 ───
function SimSettings() {
  const { simState, updateConfig } = useSimulationStore();
  const cfg = simState.config ?? DEFAULT_SIM_CONFIG;
  const presets = loadPresets();

  const [presetId, setPresetId] = useState<string>(() => {
    try { return localStorage.getItem(SIM_API_PRESET_KEY) || ''; } catch { return ''; }
  });

  // preset 变更时：取完整 ApiConfig 注入引擎（不 merge 主 API）
  useEffect(() => {
    const preset = presets.find(p => p.id === presetId);
    getSimulationEngine().setSimApiOverride(preset?.config ?? null);
  }, [presetId, presets]);

  const handlePresetChange = (id: string) => {
    setPresetId(id);
    try { localStorage.setItem(SIM_API_PRESET_KEY, id); } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 开关 */}
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: '8px',
      }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>启用世界推演</span>
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={e => updateConfig({ enabled: e.target.checked })}
        />
      </label>

      {/* API 预设 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>推演 API</span>
        <select
          value={presetId}
          onChange={e => handlePresetChange(e.target.value)}
          className="input-field"
          style={{ width: '100%' }}
        >
          <option value="">跟随主 API</option>
          {presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* 时间单位 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>推演触发方式</span>
        <select
          value={cfg.timeUnit}
          onChange={e => updateConfig({ timeUnit: e.target.value as SimConfig['timeUnit'] })}
          className="input-field"
          style={{ width: '100%' }}
        >
          <option value="per_scene">每次场景切换</option>
          <option value="per_day">每天一次</option>
          <option value="per_week">每周一次</option>
          <option value="per_month">每月一次</option>
        </select>
      </div>

      {/* 自动推演间隔 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          自动推演间隔（消息轮数，0=仅手动触发）
        </span>
        <input
          type="number"
          min={0}
          max={20}
          value={cfg.autoTickInterval}
          onChange={e => updateConfig({ autoTickInterval: parseInt(e.target.value) || 0 })}
          className="input-field"
          style={{ width: '80px' }}
        />
      </div>

      {/* 最大级联深度 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          事件级联深度: {cfg.maxCascadeDepth}
        </span>
        <input
          type="range"
          min={1} max={5}
          value={cfg.maxCascadeDepth}
          onChange={e => updateConfig({ maxCascadeDepth: parseInt(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      {/* 最大活跃事件 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          最大活跃事件数: {cfg.maxActiveEvents}
        </span>
        <input
          type="range"
          min={1} max={10}
          value={cfg.maxActiveEvents}
          onChange={e => updateConfig({ maxActiveEvents: parseInt(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      {/* 陈旧事件阈值 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          陈旧事件衰减阈值: {cfg.staleTickThreshold} tick（0=禁用）
        </span>
        <input
          type="range"
          min={0} max={30}
          value={cfg.staleTickThreshold}
          onChange={e => updateConfig({ staleTickThreshold: parseInt(e.target.value) })}
          style={{ width: '100%' }}
        />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', opacity: 0.7 }}>
          超过此 tick 数未更新的事件将自动衰减严重度
        </span>
      </div>

      {/* 统计信息 */}
      <div style={{
        fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: '8px 10px',
        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
      }}>
        <div>推演次数: {simState.tickCount ?? 0}</div>
        <div>活跃事件: {Object.values(simState.events ?? {}).filter(e => e.status !== 'resolved').length}</div>
        <div>已解决事件: {Object.keys(simState.resolvedEvents ?? {}).length}</div>
        <div>暗线角色: {Object.keys(simState.storylines ?? {}).length}</div>
        <div>待处理交互: {(simState.pendingInteractions ?? []).length}</div>
      </div>
    </div>
  );
}

// SimConfig 已在顶部导入
