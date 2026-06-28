import { useState, useMemo, useRef, useEffect } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  Search, Globe, ScrollText, MapPin, Clock, Cloud,
  Swords, AlertTriangle, DollarSign, Flag, User,
  Sparkles, ChevronRight, Layers, Shield, Users,
  Calendar, Heart, Zap, Target, BarChart3,
  Compass, BookOpen, Star, Upload, ArrowLeft,
  Briefcase, TrendingUp, TrendingDown, Landmark, Scroll,
  Map, BookMarked,
} from 'lucide-react';
import type { WorldDef, WorldBookEntryDef } from '../../data/worlds-schema';
import type { WorldBookEntry } from '../../worldbook/index';
import WorldCard, { CreateWorldCard, getWorldIcon } from './WorldCard';
import { useIsPhone } from '../../hooks/useIsMobile';

// ── 从 worldBookEntries 按 entryType 查找 ──
function findEntryByType(entries: WorldBookEntryDef[] | undefined, type: string): WorldBookEntryDef | undefined {
  return entries?.find(e => e.entryType === type);
}

// ── 难度筛选 ──
const DIFFICULTY_FILTERS = [
  { key: 'all', label: '全部', color: undefined as string | undefined },
  { key: 'easy', label: '简单', color: '#22c55e' as string | undefined },
  { key: 'medium', label: '中等', color: '#eab308' as string | undefined },
  { key: 'hard', label: '困难', color: '#ef4444' as string | undefined },
];

// ── Tab 定义（2.0：按维度拆分） ──
const TABS = [
  { key: 'overview', label: '概览', icon: BookOpen },
  { key: 'setting', label: '设定', icon: ScrollText },
  { key: 'lore', label: '地理', icon: Map },
  { key: 'factions', label: '势力', icon: Flag },
  { key: 'culture', label: '文化', icon: BookMarked },
  { key: 'economy', label: '经济', icon: DollarSign },
  { key: 'npcs', label: '人物', icon: User },
  { key: 'rules', label: '规则', icon: Swords },
  { key: 'systems', label: '系统', icon: Layers },
] as const;

type TabKey = typeof TABS[number]['key'];

interface StepWorldBrowserProps {
  selectedWorld: string;
  setSelectedWorld: (id: string) => void;
  createdWorlds: WorldDef[];
  allWorlds: WorldDef[];
  worldEntry: WorldBookEntry | null;
  onNext: () => void;
  onEditWorld: (world: WorldDef) => void;
  onDeleteWorld: (worldId: string) => void;
  onCreateWorld: () => void;
  onImportWorld: (world: WorldDef) => void;
}

export default function StepWorldBrowser({
  selectedWorld, setSelectedWorld,
  createdWorlds, allWorlds, worldEntry,
  onNext, onEditWorld, onDeleteWorld, onCreateWorld, onImportWorld,
}: StepWorldBrowserProps) {
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [importError, setImportError] = useState('');
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsPhone();

  const selected = allWorlds.find(w => w.id === selectedWorld);
  useBodyScrollLock(isMobile && showMobileDetail && !!selected);

  // 移动端：选择世界后自动显示详情
  useEffect(() => {
    if (isMobile && selectedWorld) {
      setShowMobileDetail(true);
    }
  }, [selectedWorld, isMobile]);

  // ── 导入世界 ──
  const handleImportClick = () => {
    setImportError('');
    fileInputRef.current?.click();
  };
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as WorldDef;
        if (!data.name) { setImportError('JSON 缺少 name 字段'); return; }
        // 确保有 id
        if (!data.id) data.id = `custom_${Date.now()}`;
        data.entryId = null;
        onImportWorld(data);
        setImportError('');
      } catch {
        setImportError('JSON 解析失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── 搜索 + 筛选 ──
  const filteredWorlds = useMemo(() => {
    return allWorlds.filter(w => {
      if (diffFilter !== 'all' && w.difficulty !== diffFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match = (s?: string) => s?.toLowerCase().includes(q);
        return match(w.name) || match(w.description) || w.tags?.some(t => match(t));
      }
      return true;
    });
  }, [allWorlds, search, diffFilter]);

  // 移动端详情覆盖层
  const renderMobileDetailOverlay = () => {
    if (!isMobile || !showMobileDetail || !selected) return null;
    return (
      <div className="mobile-detail-overlay">
        <div className="mobile-detail-header">
          <button className="mobile-detail-back" onClick={() => setShowMobileDetail(false)}>
            <ArrowLeft size={20} />
            <span>返回</span>
          </button>
          <button
            className="btn-primary mobile-detail-next"
            onClick={onNext}
            disabled={!selectedWorld}
          >
            下一步 <ChevronRight size={16} />
          </button>
        </div>
        <div className="mobile-detail-content">
          <div className="world-detail">
            {(() => {
              const DetailIcon = getWorldIcon(selected);
              return (
                <div
                  className="world-detail-header"
                  style={{ '--cover-color': selected.coverColor ?? 'var(--accent)' } as React.CSSProperties}
                >
                  <DetailIcon size={32} strokeWidth={1.5} />
                  <div>
                    <h2 className="world-detail-title">{selected.name}</h2>
                    <p className="world-detail-desc">{selected.description}</p>
                    <div className="world-detail-meta">
                      {selected.tags?.map(tag => (
                        <span key={tag} className="world-card-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className={`world-tabs${isMobile ? ' world-tabs-icon-only' : ''}`}>
              {TABS.filter(tab => tab.key !== 'systems' || (selected.modules && selected.modules.some(m => m.enabled))).map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    className={`world-tab${activeTab === tab.key ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                    title={isMobile ? tab.label : undefined}
                  >
                    <Icon size={isMobile ? 18 : 14} strokeWidth={2} />
                    {!isMobile && tab.label}
                  </button>
                );
              })}
            </div>

            <div className="world-tab-content">
              {activeTab === 'overview' && <OverviewTab world={selected} worldEntry={worldEntry} />}
              {activeTab === 'setting' && <SettingTab world={selected} worldEntry={worldEntry} />}
              {activeTab === 'lore' && <LoreTab world={selected} />}
              {activeTab === 'factions' && <FactionsTab world={selected} />}
              {activeTab === 'culture' && <CultureTab world={selected} />}
              {activeTab === 'economy' && <EconomyTab world={selected} />}
              {activeTab === 'npcs' && <NpcsTab world={selected} />}
              {activeTab === 'rules' && <RulesTab world={selected} />}
              {activeTab === 'systems' && <SystemsTab world={selected} />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="world-browser">
      {/* ── 左侧：卡片网格 ── */}
      <div className="world-browser-left">
        {/* 搜索 + 筛选 */}
        <div className="world-browser-toolbar">
          <div className="world-search-box">
            <Search size={14} strokeWidth={2} />
            <input
              type="text"
              placeholder="搜索世界..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="world-diff-filters">
            {DIFFICULTY_FILTERS.map(f => (
              <button
                key={f.key}
                className={`diff-filter-btn${diffFilter === f.key ? ' active' : ''}`}
                onClick={() => setDiffFilter(f.key)}
                style={f.color ? { '--dot-color': f.color } as React.CSSProperties : undefined}
                data-color={f.color}
              >
                {f.color && <span className="diff-dot" style={{ background: f.color }} />}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 卡片网格 */}
        <div className="world-card-grid">
          {filteredWorlds.map(w => (
            <WorldCard
              key={w.id}
              world={w}
              selected={selectedWorld === w.id}
              onSelect={() => setSelectedWorld(w.id)}
              isCustom={createdWorlds.some(c => c.id === w.id)}
              onEdit={e => onEditWorld(w)}
              onDelete={() => onDeleteWorld(w.id)}
            />
          ))}
          <CreateWorldCard onClick={onCreateWorld} />
          {/* 导入世界卡片 */}
          <div
            className="world-card create-world-card"
            onClick={handleImportClick}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '2px dashed var(--border)', background: 'transparent' }}
          >
            <Upload size={28} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>导入世界</span>
          </div>
          {importError && <div style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>{importError}</div>}
        </div>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
      </div>

      {/* ── 右侧：详情面板（桌面端） ── */}
      {!isMobile && (
        <div className="world-browser-right">
          {selected ? (
            <div className="world-detail">
              {/* 头部 */}
              {(() => {
                const DetailIcon = getWorldIcon(selected);
                return (
              <div
                className="world-detail-header"
                style={{ '--cover-color': selected.coverColor ?? 'var(--accent)' } as React.CSSProperties}
              >
                <DetailIcon size={32} strokeWidth={1.5} />
                <div>
                  <h2 className="world-detail-title">{selected.name}</h2>
                  <p className="world-detail-desc">{selected.description}</p>
                  <div className="world-detail-meta">
                    {selected.tags?.map(tag => (
                      <span key={tag} className="world-card-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
                );
              })()}

              {/* Tab 栏 */}
              <div className={`world-tabs${isMobile ? ' world-tabs-icon-only' : ''}`}>
                {TABS.filter(tab => tab.key !== 'systems' || (selected.modules && selected.modules.some(m => m.enabled))).map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      className={`world-tab${activeTab === tab.key ? ' active' : ''}`}
                      onClick={() => setActiveTab(tab.key)}
                      title={isMobile ? tab.label : undefined}
                    >
                      <Icon size={isMobile ? 18 : 14} strokeWidth={2} />
                      {!isMobile && tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab 内容 */}
              <div className="world-tab-content">
                {activeTab === 'overview' && <OverviewTab world={selected} worldEntry={worldEntry} />}
                {activeTab === 'setting' && <SettingTab world={selected} worldEntry={worldEntry} />}
                {activeTab === 'lore' && <LoreTab world={selected} />}
                {activeTab === 'factions' && <FactionsTab world={selected} />}
                {activeTab === 'culture' && <CultureTab world={selected} />}
                {activeTab === 'economy' && <EconomyTab world={selected} />}
                {activeTab === 'npcs' && <NpcsTab world={selected} />}
                {activeTab === 'rules' && <RulesTab world={selected} />}
                {activeTab === 'systems' && <SystemsTab world={selected} />}
              </div>
            </div>
          ) : (
            <div className="world-detail-empty">
              <Globe size={48} strokeWidth={1} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
              <p>选择一个世界查看详情</p>
            </div>
          )}

          {/* 下一步按钮 */}
          <div className="world-browser-nav">
            <button
              className="btn-primary"
              onClick={onNext}
              disabled={!selectedWorld}
              title={!selectedWorld ? '请先选择一个世界' : ''}
            >
              下一步 <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 移动端详情覆盖层 */}
      {renderMobileDetailOverlay()}
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  Tab 内容组件
// ═══════════════════════════════════════════════════

/** 概览 Tab — 精简版，只展示核心信息 */
function OverviewTab({ world, worldEntry }: { world: WorldDef; worldEntry: WorldBookEntry | null }) {
  const settingEntry = findEntryByType(world.worldBookEntries, 'setting');
  const highlightsEntry = findEntryByType(world.worldBookEntries, 'highlights');

  return (
    <div className="tab-section">
      {/* 世界设定摘要 */}
      {worldEntry?.content ? (
        <div className="detail-block">
          <div className="detail-block-title"><ScrollText size={15} />世界设定</div>
          <div className="detail-block-body">{worldEntry.content}</div>
        </div>
      ) : settingEntry?.content && (
        <div className="detail-block">
          <div className="detail-block-title"><ScrollText size={15} />世界设定</div>
          <div className="detail-block-body">{settingEntry.content}</div>
        </div>
      )}

      {/* 元数据徽章 */}
      {settingEntry?.meta && (
        <div className="detail-badges">
          {settingEntry.meta.location && (
            <span className="detail-badge"><MapPin size={12} />{settingEntry.meta.location}</span>
          )}
          {settingEntry.meta.timePeriod && (
            <span className="detail-badge"><Clock size={12} />{settingEntry.meta.timePeriod}</span>
          )}
          {settingEntry.meta.atmosphere && (
            <span className="detail-badge"><Cloud size={12} />{settingEntry.meta.atmosphere}</span>
          )}
        </div>
      )}

      {/* 核心特色 */}
      {highlightsEntry?.meta?.highlights && highlightsEntry.meta.highlights.length > 0 && (
        <div className="detail-block">
          <div className="detail-block-title"><Star size={15} />核心特色</div>
          <div className="detail-pills">
            {highlightsEntry.meta.highlights.map((h, i) => <span key={i} className="detail-pill"><Sparkles size={11} />{h}</span>)}
          </div>
        </div>
      )}

      {/* 适合人群 */}
      {settingEntry?.meta?.recommendedFor && settingEntry.meta.recommendedFor.length > 0 && (
        <div className="detail-block">
          <div className="detail-block-title"><Compass size={15} />适合人群</div>
          <div className="detail-pills">
            {settingEntry.meta.recommendedFor.map((p, i) => <span key={i} className="detail-pill">{p}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

/** 设定 Tab — 基调、时代、氛围 */
function SettingTab({ world, worldEntry }: { world: WorldDef; worldEntry: WorldBookEntry | null }) {
  const settingEntry = findEntryByType(world.worldBookEntries, 'setting');

  return (
    <div className="tab-section">
      {worldEntry?.content && (
        <div className="detail-block">
          <div className="detail-block-title"><ScrollText size={15} />世界设定</div>
          <div className="detail-block-body">{worldEntry.content}</div>
        </div>
      )}
      {settingEntry?.meta && (
        <div className="detail-block">
          <div className="detail-block-title"><Globe size={15} />基本信息</div>
          <div className="detail-block-body">
            {settingEntry.meta.timePeriod && (
              <div className="detail-row"><Clock size={13} /><strong>时代背景：</strong>{settingEntry.meta.timePeriod}</div>
            )}
            {settingEntry.meta.location && (
              <div className="detail-row"><MapPin size={13} /><strong>地理位置：</strong>{settingEntry.meta.location}</div>
            )}
            {settingEntry.meta.atmosphere && (
              <div className="detail-row"><Cloud size={13} /><strong>氛围基调：</strong>{settingEntry.meta.atmosphere}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 地理 Tab — 区域/地点 */
function LoreTab({ world }: { world: WorldDef }) {
  const loreEntries = world.worldBookEntries?.filter(e => e.entryType === 'lore') ?? [];

  return (
    <div className="tab-section">
      {loreEntries.length > 0 ? (
        <div className="detail-block">
          <div className="detail-block-title"><Map size={15} />地理区域</div>
          <div className="factions-grid">
            {loreEntries.map((entry, i) => (
              <div key={i} className="faction-card">
                <div className="faction-header">
                  <span className="faction-name">{entry.comment}</span>
                </div>
                <div className="faction-desc">{entry.content}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>暂无地理数据</div>
      )}
    </div>
  );
}

/** 势力 Tab */
function FactionsTab({ world }: { world: WorldDef }) {
  const factionEntries = world.worldBookEntries?.filter(e => e.entryType === 'factions') ?? [];
  const allFactions = factionEntries.flatMap(e => e.meta?.factions ?? []);

  return (
    <div className="tab-section">
      {allFactions.length > 0 ? (
        <div className="detail-block">
          <div className="detail-block-title"><Flag size={15} />势力分布</div>
          <div className="factions-grid">
            {allFactions.map((f, i) => (
              <div key={i} className="faction-card">
                <div className="faction-header">
                  <span className="faction-name">{f.name}</span>
                  {f.alignment && (
                    <span className={`faction-alignment ${f.alignment === '友善' ? 'friendly' : f.alignment === '敌对' ? 'hostile' : 'neutral'}`}>
                      {f.alignment}
                    </span>
                  )}
                </div>
                <div className="faction-desc">{f.description}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>暂无势力数据</div>
      )}
    </div>
  );
}

/** 文化 Tab */
function CultureTab({ world }: { world: WorldDef }) {
  const cultureEntries = world.worldBookEntries?.filter(e => e.entryType === 'culture') ?? [];

  return (
    <div className="tab-section">
      {cultureEntries.length > 0 ? (
        cultureEntries.map((entry, i) => (
          <div key={i} className="detail-block">
            <div className="detail-block-title"><BookMarked size={15} />{entry.comment || '文化风俗'}</div>
            <div className="detail-block-body">{entry.content}</div>
          </div>
        ))
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>暂无文化数据</div>
      )}
    </div>
  );
}

/** 人物 Tab — NPC */
function NpcsTab({ world }: { world: WorldDef }) {
  const npcEntries = world.worldBookEntries?.filter(e => e.entryType === 'npcs') ?? [];
  const allNPCs = npcEntries.flatMap(e => e.meta?.npcs ?? []);

  return (
    <div className="tab-section">
      {allNPCs.length > 0 ? (
        <div className="detail-block">
          <div className="detail-block-title"><User size={15} />关键 NPC</div>
          <div className="npcs-grid">
            {allNPCs.map((npc, i) => (
              <div key={i} className="npc-card">
                <div className="npc-header">
                  <span className="npc-name">{npc.name}</span>
                  <span className="npc-role">{npc.role}</span>
                </div>
                <div className="npc-desc">{npc.description}</div>
                {npc.personality && <div className="npc-personality">性格：{npc.personality}</div>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>暂无人物数据</div>
      )}
    </div>
  );
}

/** 规则 Tab */
function RulesTab({ world }: { world: WorldDef }) {
  const rulesEntry = findEntryByType(world.worldBookEntries, 'rules');

  return (
    <div className="tab-section">
      {rulesEntry?.meta ? (
        <div className="detail-block">
          <div className="detail-block-title"><Swords size={15} />世界规则</div>
          <div className="detail-block-body">
            {rulesEntry.meta.powerSystem && (
              <div className="detail-row"><Zap size={13} /><strong>力量体系：</strong>{rulesEntry.meta.powerSystem}</div>
            )}
            {rulesEntry.meta.socialStructure && (
              <div className="detail-row"><Users size={13} /><strong>社会结构：</strong>{rulesEntry.meta.socialStructure}</div>
            )}
            {rulesEntry.meta.specialRules?.map((rule, i) => (
              <div key={i} className="detail-rule"><AlertTriangle size={12} />{rule}</div>
            ))}
          </div>
        </div>
      ) : rulesEntry?.content ? (
        <div className="detail-block">
          <div className="detail-block-title"><Swords size={15} />世界规则</div>
          <div className="detail-block-body">{rulesEntry.content}</div>
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>暂无规则数据</div>
      )}
    </div>
  );
}

/** 系统 Tab — 从 modules[].moduleConfig 读取 */
function SystemsTab({ world }: { world: WorldDef }) {
  const statMod = world.modules?.find(m => m.moduleId === 'stat' && m.enabled);
  const progMod = world.modules?.find(m => m.moduleId === 'progression' && m.enabled);
  const survMod = world.modules?.find(m => m.moduleId === 'survival' && m.enabled);

  const statData = (statMod?.moduleConfig || statMod?.data) as any;
  const hasNewStat = !!statData?.attrA;
  const dims = hasNewStat
    ? ['dim1','dim2','dim3','dim4','dim5','dim6'].filter(k => statData[k]).map(k => ({ key: k, name: statData[k].name, range: statData[k].range }))
    : [];
  const specials: Array<{ id: string; name: string; value: number; range: [number,number]; description: string }> = statData?.special || [];

  const progData = (progMod?.moduleConfig || progMod?.data) as any;
  const tiers: Array<{ name: string; description?: string }> = progData?.tiers || [];
  const progDesc = progData ? (progData.mode === 'tiered' ? '段位制' : '等级制') : '';

  const survData = (survMod?.moduleConfig || survMod?.data) as any;
  const resources = survData?.resources || [];
  const resDesc = survData?.description;

  // 关系系统和世界事件从 worldBookEntries 读取
  const relationshipsEntry = findEntryByType(world.worldBookEntries, 'relationships');
  const eventsEntry = findEntryByType(world.worldBookEntries, 'events');

  // 新格式：modules 是字符串数组时，只显示模块列表
  const modulesRaw = world.modules as any[] | undefined;
  const isStringArray = Array.isArray(modulesRaw) && modulesRaw.length > 0 && typeof modulesRaw[0] === 'string';
  const enabledModules = isStringArray ? (modulesRaw as string[]) : [];
  const MODULE_NAMES: Record<string, string> = {
    stat: '数值属性', progression: '成长体系', survival: '生存资源',
    business: '经营资产', dice: '骰子检定', talent: '天赋体系',
  };

  // 如果是新格式且没有详细数据，显示模块列表
  if (isStringArray && !statData && !progData && !survData) {
    return (
      <div className="tab-section">
        {enabledModules.length > 0 ? (
          <div className="detail-block">
            <div className="detail-block-title"><Layers size={15} />启用的模块</div>
            <div className="detail-block-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {enabledModules.map(mod => (
                  <span key={mod} className="detail-pill">{MODULE_NAMES[mod] || mod}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="detail-block">
            <div className="detail-block-title"><Layers size={15} />系统模块</div>
            <div className="detail-block-body">
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                该世界为纯叙事模式，无数值系统模块。
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tab-section">
      {/* 数值属性（只显示六维+特殊，不露attrA/attrB） */}
      {(dims.length > 0 || specials.length > 0) && (
        <div className="detail-block">
          <div className="detail-block-title"><BarChart3 size={15} />数值属性</div>
          <div className="detail-block-body">
            {/* 新格式六维 */}
            {dims.length > 0 && (
              <div className="stats-grid">
                {dims.map(d => (
                  <div key={d.key} className="stat-card">
                    <div className="stat-name">{d.name}</div>
                    <div className="stat-range">{d.range ? `${d.range[0]}~${d.range[1]}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
            {/* 特色属性 */}
            {specials.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {specials.map(sp => (
                  <span key={sp.id} className="detail-pill" title={sp.description}>{sp.name} {sp.value}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 成长体系 */}
      {(tiers.length > 0 || (progData?.mode === 'level' && progData?.levelData)) && (
        <div className="detail-block">
          <div className="detail-block-title"><Target size={15} />成长体系</div>
          <div className="detail-block-body">
            {progDesc && <p>{progDesc}</p>}
            {/* 等级制 */}
            {progData?.mode === 'level' && progData?.levelData && (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                等级范围：0 ~ {progData.levelData.maxLevel} 级
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                  （每级生命+{progData.levelData.growthPerLevel?.attrAMax || 0}，六维+{progData.levelData.growthPerLevel?.dim1Max || 0}）
                </span>
              </div>
            )}
            {/* 段位制 */}
            {tiers.length > 0 && (
              <div className="progression-ladder">
                {tiers.map((tier, i) => (
                  <div key={i} className="progression-tier">
                    <span className="tier-number">{i + 1}</span>
                    <div>
                      <span className="tier-name">{tier.name}</span>
                      {tier.description && <span className="tier-desc">{tier.description}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 生存资源 */}
      {resources.length > 0 && (
        <div className="detail-block">
          <div className="detail-block-title"><Flag size={15} />生存资源</div>
          <div className="detail-block-body">
            {resDesc && <p>{resDesc}</p>}
            <div className="resources-list">
              {resources.map((res: any) => (
                <div key={res.id} className={`resource-item${res.scarce ? ' scarce' : ''}`}>
                  <div className="resource-header">
                    <span className="resource-name">{res.symbol ? `${res.symbol} ` : ''}{res.name}</span>
                    {res.scarce && <span className="resource-scarce">稀缺</span>}
                  </div>
                  <div className="resource-desc">{res.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 经营资产 */}
      {(() => {
        const bizMod = world.modules?.find(m => m.moduleId === 'business' && m.enabled);
        const bizData = (bizMod?.moduleConfig || bizMod?.data) as any;
        if (!bizData) return null;
        return (
          <div className="detail-block">
            <div className="detail-block-title"><Briefcase size={15} />经营资产</div>
            <div className="detail-block-body">
              {bizData.description && <p>{bizData.description}</p>}
              <div className="detail-row">
                <DollarSign size={13} /><strong>初始资金：</strong>{bizData.funds ?? 0}
              </div>
              <div className="detail-row">
                <Clock size={13} /><strong>结算周期：</strong>每{bizData.cycleName || '天'}
              </div>
              {bizData.market?.items && bizData.market.items.length > 0 && (
                <>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>
                    市场行情
                  </div>
                  <div className="detail-pills">
                    {bizData.market.items.map((item: any, i: number) => (
                      <span key={i} className="detail-pill" title={`基准价: ${item.basePrice}`}>
                        {item.name} {item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : '─'}{Math.abs(item.changePercent || 0)}%
                      </span>
                    ))}
                  </div>
                </>
              )}
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                资产将在游戏内通过角色行动获取
              </div>
            </div>
          </div>
        );
      })()}

      {/* 关系系统 */}
      {relationshipsEntry?.meta?.relationships && (
        <div className="detail-block">
          <div className="detail-block-title"><Heart size={15} />关系系统</div>
          <div className="detail-block-body">
            {relationshipsEntry.meta.relationships.description && <p>{relationshipsEntry.meta.relationships.description}</p>}
            {relationshipsEntry.meta.relationships.mechanics && (
              <div className="detail-row"><Zap size={13} /><strong>机制：</strong>{relationshipsEntry.meta.relationships.mechanics}</div>
            )}
            <div className="detail-pills">
              {relationshipsEntry.meta.relationships.types.map((rt, i) => (
                <span key={i} className="detail-pill" title={rt.description}>{rt.name}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 世界事件 */}
      {eventsEntry?.meta?.events && eventsEntry.meta.events.length > 0 && (
        <div className="detail-block">
          <div className="detail-block-title"><Calendar size={15} />世界事件</div>
          <div className="events-list">
            {eventsEntry.meta.events.map((evt, i) => (
              <div key={i} className={`event-item${evt.significance === 'major' ? ' major' : ''}`}>
                <div className="event-header">
                  <span className="event-name">{evt.name}</span>
                  {evt.trigger && <span className="event-trigger">{evt.trigger}</span>}
                </div>
                <div className="event-desc">{evt.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/** 经济 Tab — 从 modules[] 和 worldBookEntries 读取 */
function EconomyTab({ world }: { world: WorldDef }) {
  // 生存资源（新模块 ID: 'survival'）
  const survMod = world.modules?.find(m => m.moduleId === 'survival' && m.enabled);
  const survData = (survMod?.moduleConfig || survMod?.data) as any;
  const resources = survData?.resources || [];
  const recipes = survData?.recipes || [];
  const rules = survData?.rules;
  const resDesc = survData?.description;

  // 经济系统从 worldBookEntries 读取
  const economyEntry = findEntryByType(world.worldBookEntries, 'economy');
  const currency = economyEntry?.meta?.currency;

  return (
    <div className="tab-section">
      {/* 货币 & 经济 */}
      {(economyEntry || currency) && (
        <div className="detail-block">
          <div className="detail-block-title"><DollarSign size={15} />经济系统</div>
          <div className="detail-block-body">
            {currency && (
              <div className="detail-row">
                <strong>{currency.symbol ?? ''} {currency.name}</strong>
                {currency.description && <span> — {currency.description}</span>}
              </div>
            )}
            {economyEntry?.meta?.priceLevel && (
              <div className="detail-row"><BarChart3 size={13} /><strong>物价水平：</strong>{economyEntry.meta.priceLevel}</div>
            )}
          </div>
        </div>
      )}

      {/* 生存资源 */}
      {resources.length > 0 && (
        <div className="detail-block">
          <div className="detail-block-title"><Flag size={15} />生存资源</div>
          <div className="detail-block-body">
            {resDesc && <p>{resDesc}</p>}
            {rules?.consumePerCycle && (
              <div className="detail-row"><strong>每周期消耗：</strong>{rules.consumePerCycle}</div>
            )}
            <div className="resources-list">
              {resources.map((res: any) => (
                <div key={res.id} className={`resource-item${res.scarce ? ' scarce' : ''}`}>
                  <div className="resource-header">
                    <span className="resource-name">{res.symbol ? `${res.symbol} ` : ''}{res.name}</span>
                    {res.scarce && <span className="resource-scarce">稀缺</span>}
                    <span className="resource-amount">{res.amount}/{res.max}</span>
                  </div>
                  <div className="resource-desc">{res.description}</div>
                  {res.gatherRate && <div className="resource-rate">采集：{res.gatherRate}</div>}
                  {res.usage && <div className="resource-rate">消耗：{res.usage}</div>}
                </div>
              ))}
            </div>
            {recipes.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong style={{ fontSize: 'var(--font-size-xs)' }}>制作配方：</strong>
                {recipes.map((r: any) => (
                  <div key={r.id} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', paddingLeft: 8 }}>
                    {r.name}: {Object.entries(r.inputs).map(([k, v]) => `${k}×${v}`).join(' + ')} → {r.output.resourceId}×{r.output.amount}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 时间系统 */}
      {economyEntry?.meta && (economyEntry.meta.calendar || economyEntry.meta.startTime || economyEntry.meta.timeSpeed) && (
        <div className="detail-block">
          <div className="detail-block-title"><Clock size={15} />时间系统</div>
          <div className="detail-block-body">
            {economyEntry.meta.calendar && (
              <div className="detail-row"><Calendar size={13} /><strong>历法：</strong>{economyEntry.meta.calendar}</div>
            )}
            {economyEntry.meta.startTime && (
              <div className="detail-row"><Clock size={13} /><strong>开局时间：</strong>{economyEntry.meta.startTime}</div>
            )}
            {economyEntry.meta.timeSpeed && (
              <div className="detail-row"><Zap size={13} /><strong>时间流速：</strong>{economyEntry.meta.timeSpeed}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

