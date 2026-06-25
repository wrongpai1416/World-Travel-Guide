import { Globe, ScrollText, Pencil, MapPin, Clock, Cloud, Swords, AlertTriangle, DollarSign, Flag, User, Sparkles, Check, Compass, Shield, Zap, Flame, Mountain, Ship, Castle, Skull, Crown, Rocket, Star, BookOpen, Heart, Anchor, Backpack, Target, Brain, Dna, Lightbulb, Bookmark, Landmark, Scroll, type LucideIcon } from 'lucide-react';
import type { WorldDef, WorldBookEntryDef } from '../../data/worlds-schema';
import { WORLDS } from '../../data/worldLoader';
import type { WorldBookEntry } from '../../worldbook/index';

// Lucide 图标名称 → 组件映射
const ICON_COMPONENTS: Record<string, LucideIcon> = {
  Globe, ScrollText, Pencil, MapPin, Clock, Cloud, Swords, AlertTriangle,
  DollarSign, Flag, User, Sparkles, Check, Compass, Shield, Zap, Flame,
  Mountain, Ship, Castle, Skull, Crown, Rocket, Star, BookOpen, Heart,
  Anchor, Backpack, Target, Brain, Dna, Lightbulb, Bookmark,
};

function WorldIcon({ name, size = 28 }: { name: string; size?: number }) {
  const IconComp = ICON_COMPONENTS[name];
  if (IconComp) return <IconComp size={size} style={{ color: 'var(--accent)' }} />;
  return <Globe size={size} style={{ color: 'var(--accent)' }} />;
}

/** 从 worldBookEntries 中按 entryType 查找条目 */
function findEntryByType(entries: WorldBookEntryDef[] | undefined, type: string): WorldBookEntryDef | undefined {
  return entries?.find(e => e.entryType === type);
}

/** 从 worldBookEntries 中按 entryType 查找所有条目 */
function findAllEntriesByType(entries: WorldBookEntryDef[] | undefined, type: string): WorldBookEntryDef[] {
  return entries?.filter(e => e.entryType === type) ?? [];
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
  const entries = world.worldBookEntries;

  // 从 worldBookEntries 中提取各类数据
  const settingEntry = findEntryByType(entries, 'setting');
  const rulesEntry = findEntryByType(entries, 'rules');
  const economyEntry = findEntryByType(entries, 'economy');
  const highlightsEntry = findEntryByType(entries, 'highlights');
  const loreEntries = findAllEntriesByType(entries, 'lore');
  const cultureEntry = findEntryByType(entries, 'culture');
  // 势力和 NPC：合并所有同类型条目的 meta（每个势力/NPC 各一条）
  const factionEntries = findAllEntriesByType(entries, 'factions');
  const allFactions = factionEntries.flatMap(e => e.meta?.factions ?? []);
  const npcEntries = findAllEntriesByType(entries, 'npcs');
  const allNPCs = npcEntries.flatMap(e => e.meta?.npcs ?? []);

  const hasSetting = !!settingEntry || !!worldEntry;
  const hasRules = !!rulesEntry;
  const hasEconomy = !!economyEntry;
  const hasFactions = allFactions.length > 0;
  const hasNPCs = allNPCs.length > 0;
  const hasHighlights = !!highlightsEntry && highlightsEntry.meta?.highlights && highlightsEntry.meta.highlights.length > 0;

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
      {hasSetting && (
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
          ) : settingEntry ? (
            <div style={{ fontSize: 'var(--font-size-md)', lineHeight: '1.8', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {settingEntry.content}
            </div>
          ) : null}
          {settingEntry?.meta && (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              {settingEntry.meta.location && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {settingEntry.meta.location}</span>}
              {settingEntry.meta.timePeriod && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {settingEntry.meta.timePeriod}</span>}
              {settingEntry.meta.atmosphere && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Cloud size={12} /> {settingEntry.meta.atmosphere}</span>}
            </div>
          )}
        </div>
      )}

      {/* 世界规则 */}
      {hasRules && rulesEntry && (
        <div className="surface-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Swords size={14} />世界规则
          </div>
          {rulesEntry.meta && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {rulesEntry.meta.powerSystem && (
                  <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>力量体系</div>
                    <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{rulesEntry.meta.powerSystem}</div>
                  </div>
                )}
                {rulesEntry.meta.socialStructure && (
                  <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>社会结构</div>
                    <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{rulesEntry.meta.socialStructure}</div>
                  </div>
                )}
              </div>
              {rulesEntry.meta.specialRules && rulesEntry.meta.specialRules.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {rulesEntry.meta.specialRules.map((rule, i) => (
                    <span key={i} style={{
                      fontSize: 'var(--font-size-sm)', padding: '3px 10px', borderRadius: '12px',
                      background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}><AlertTriangle size={10} /> {rule}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 经济 & 时间 */}
      {hasEconomy && economyEntry && (
        <div className="surface-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={14} />经济 & 时间
          </div>
          {economyEntry.meta && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {economyEntry.meta.currency && (
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>货币</div>
                  <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>
                    {economyEntry.meta.currency.symbol} {economyEntry.meta.currency.name}
                    {economyEntry.meta.currency.description && <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginLeft: '6px' }}>{economyEntry.meta.currency.description}</span>}
                  </div>
                </div>
              )}
              {economyEntry.meta.priceLevel && (
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>物价水平</div>
                  <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{economyEntry.meta.priceLevel}</div>
                </div>
              )}
              {economyEntry.meta.calendar && (
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>纪年</div>
                  <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{economyEntry.meta.calendar}</div>
                </div>
              )}
              {economyEntry.meta.startTime && (
                <div style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>开始时间</div>
                  <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{economyEntry.meta.startTime}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 势力 */}
      {hasFactions && (
        <div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flag size={14} />势力 ({allFactions.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {allFactions.map((f, i) => (
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
            <User size={14} />关键人物 ({allNPCs.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {allNPCs.map((npc, i) => (
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

      {/* 地理地点 */}
      {loreEntries.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Landmark size={14} />地理 ({loreEntries.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loreEntries.map(entry => (
              <div key={entry.uid} className="surface-card" style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)', marginBottom: '4px' }}>{entry.comment}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {entry.content.length > 300 ? entry.content.substring(0, 300) + '...' : entry.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文化风俗 */}
      {cultureEntry && (
        <div className="surface-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Scroll size={14} />文化风俗
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
            {cultureEntry.content}
          </div>
        </div>
      )}

      {/* 核心特色 */}
      {hasHighlights && highlightsEntry && (
        <div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} />核心特色
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {highlightsEntry.meta!.highlights!.map((h, i) => (
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
