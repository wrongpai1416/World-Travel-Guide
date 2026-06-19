import { Globe, ScrollText, Pencil, MapPin, Clock, Cloud, Swords, AlertTriangle, DollarSign, Flag, User, Sparkles } from 'lucide-react';
import type { WorldDef } from '../../data/worldLoader';
import { WORLDS } from '../../data/worldLoader';
import type { WorldBookEntry } from '../../worldbook/index';
import { resolveWorldIcon } from '../shared/worldIcons';

function WorldIcon({ name, size = 28 }: { name: string; size?: number }) {
  const IconComp = resolveWorldIcon(name);
  return <IconComp size={size} style={{ color: 'var(--accent)' }} />;
}

interface StepWorldDetailProps {
  selectedWorld: string;
  allWorlds: WorldDef[];
  worldEntry: WorldBookEntry | null;
  onNext: () => void;
  onPrev: () => void;
  onEditWorld: (world: WorldDef) => void;
}

export default function StepWorldDetail({
  selectedWorld, allWorlds, worldEntry, onNext, onPrev, onEditWorld,
}: StepWorldDetailProps) {
  const world = allWorlds.find(w => w.id === selectedWorld);

  if (!world) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--accent)22, var(--accent)08)',
          border: '1px solid var(--accent)33',
          borderRadius: 'var(--radius-lg)', padding: '1.25rem',
        }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} />默认自由模式
          </h3>
          <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>无特定世界观限制，自由穿越到任何想象中的世界。</p>
        </div>
        {worldEntry && (
          <div className="surface-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ScrollText size={14} />世界设定
            </div>
            <div style={{ fontSize: 'var(--font-size-md)', lineHeight: '1.8', color: 'var(--text-primary)', maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
              {worldEntry.content.length > 2000 ? worldEntry.content.substring(0, 2000) + '...' : worldEntry.content}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <button className="btn-secondary" onClick={onPrev} style={{ padding: '10px 24px' }}>← 上一步</button>
          <button className="btn-primary" onClick={onNext} style={{ padding: '10px 32px', fontSize: 'var(--font-size-lg)' }}>下一步 →</button>
        </div>
      </div>
    );
  }

  const accentColor = world.coverColor || 'var(--accent)';
  const hasSetting = !!world.setting;
  const hasRules = !!world.rules;
  const hasEconomy = !!world.economy || !!world.timeSystem;
  const hasFactions = world.factions && world.factions.length > 0;
  const hasNPCs = world.presetNPCs && world.presetNPCs.length > 0;
  const hasHighlights = world.highlights && world.highlights.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* 头部横幅 */}
      <div style={{
        background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}08)`,
        border: `1px solid ${accentColor}33`,
        borderRadius: 'var(--radius-lg)', padding: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          {world.icon && <WorldIcon name={world.icon} size={28} />}
          <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: accentColor, flex: 1 }}>{world.name}</h3>
          {!WORLDS.find(w => w.id === world.id) && (
            <button
              className="btn-secondary"
              onClick={() => onEditWorld(world)}
              style={{ padding: '4px 14px', fontSize: 'var(--font-size-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
            ><Pencil size={12} /> 编辑</button>
          )}
        </div>
        <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{world.description}</p>
        {world.tags && world.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
            {world.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 'var(--font-size-xs)', padding: '2px 10px', borderRadius: '12px',
                background: `${accentColor}18`, color: accentColor, fontWeight: '500',
              }}>{tag}</span>
            ))}
            {world.difficulty && (
              <span style={{
                fontSize: 'var(--font-size-xs)', padding: '2px 10px', borderRadius: '12px',
                background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: world.difficulty === 'easy' ? '#22c55e' : world.difficulty === 'medium' ? '#f59e0b' : '#ef4444',
                }} />
                {world.difficulty === 'easy' ? '简单' : world.difficulty === 'medium' ? '中等' : '困难'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 世界设定叙事 */}
      {(hasSetting || worldEntry) && (
        <div className="surface-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ScrollText size={14} />世界设定
          </div>
          {worldEntry ? (
            <div style={{
              fontSize: 'var(--font-size-md)', lineHeight: '1.8', color: 'var(--text-primary)',
              maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)',
            }}>
              {worldEntry.content.length > 2000
                ? worldEntry.content.substring(0, 2000) + '...\n\n[完整设定将在游戏中加载]'
                : worldEntry.content}
            </div>
          ) : hasSetting ? (
            <div style={{ fontSize: 'var(--font-size-md)', lineHeight: '1.8', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {world.setting!.overview}
            </div>
          ) : null}
          {hasSetting && (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              {world.setting!.location && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {world.setting!.location}</span>}
              {world.setting!.timePeriod && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {world.setting!.timePeriod}</span>}
              {world.setting!.atmosphere && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Cloud size={12} /> {world.setting!.atmosphere}</span>}
            </div>
          )}
        </div>
      )}

      {/* 世界规则 */}
      {hasRules && (
        <div className="surface-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Swords size={14} />世界规则
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {world.rules!.powerSystem && (
              <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>力量体系</div>
                <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{world.rules!.powerSystem}</div>
              </div>
            )}
            {world.rules!.socialStructure && (
              <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>社会结构</div>
                <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{world.rules!.socialStructure}</div>
              </div>
            )}
          </div>
          {world.rules!.specialRules && world.rules!.specialRules.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {world.rules!.specialRules.map((rule, i) => (
                <span key={i} style={{
                  fontSize: 'var(--font-size-sm)', padding: '3px 10px', borderRadius: '12px',
                  background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}><AlertTriangle size={10} /> {rule}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 经济 & 时间 */}
      {hasEconomy && (
        <div className="surface-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={14} />经济 & 时间
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {world.economy?.currency && (
              <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>货币</div>
                <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>
                  {world.economy.currency.symbol} {world.economy.currency.name}
                  {world.economy.currency.description && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginLeft: '6px' }}>{world.economy.currency.description}</span>}
                </div>
              </div>
            )}
            {world.economy?.priceLevel && (
              <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>物价水平</div>
                <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{world.economy.priceLevel}</div>
              </div>
            )}
            {world.timeSystem?.calendar && (
              <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>纪年</div>
                <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{world.timeSystem.calendar}</div>
              </div>
            )}
            {world.timeSystem?.startTime && (
              <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>开始时间</div>
                <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{world.timeSystem.startTime}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 势力 */}
      {hasFactions && (
        <div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flag size={14} />势力 ({world.factions!.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {world.factions!.map((f, i) => (
              <div key={i} className="surface-card" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600', fontSize: 'var(--font-size-md)' }}>{f.name}</span>
                  {f.alignment && (
                    <span style={{
                      fontSize: 'var(--font-size-xs)', padding: '1px 8px', borderRadius: '10px',
                      background: f.alignment === '友善' ? '#22c55e18' : f.alignment === '敌对' ? '#ef444418' : '#f59e0b18',
                      color: f.alignment === '友善' ? '#22c55e' : f.alignment === '敌对' ? '#ef4444' : '#f59e0b',
                    }}>{f.alignment}</span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', lineHeight: '1.4' }}>{f.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 关键人物 */}
      {hasNPCs && (
        <div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} />关键人物 ({world.presetNPCs!.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {world.presetNPCs!.map((npc, i) => (
              <div key={i} className="surface-card" style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)', marginBottom: '2px' }}>{npc.name}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: accentColor, marginBottom: '4px' }}>{npc.role}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', lineHeight: '1.4' }}>{npc.description}</div>
                {npc.personality && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>{npc.personality}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 核心特色 */}
      {hasHighlights && (
        <div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} />核心特色
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {world.highlights!.map((h, i) => (
              <span key={i} style={{
                fontSize: 'var(--font-size-base)', padding: '6px 14px', borderRadius: '20px',
                background: `${accentColor}12`, color: accentColor, fontWeight: '500',
              }}>{h}</span>
            ))}
          </div>
        </div>
      )}

      {/* 按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <button className="btn-secondary" onClick={onPrev} style={{ padding: '10px 24px' }}>← 上一步</button>
        <button className="btn-primary" onClick={onNext} style={{ padding: '10px 32px', fontSize: 'var(--font-size-lg)' }}>下一步 →</button>
      </div>
    </div>
  );
}
