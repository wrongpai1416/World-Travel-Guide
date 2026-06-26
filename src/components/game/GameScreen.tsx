import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Home, User, Users, BookOpen, Settings, X, ChevronLeft, ChevronRight, Menu, PanelRightOpen, Layers, Brain, Maximize2, Minimize2, BookMarked } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useUISettings } from '../../context/UISettingsContext';
import { useConfigStore } from '../../stores/configStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import ChatPanel from './chat/ChatPanel';
import ProfilePanel from './panels/ProfilePanel';
import CharacterGrid from './panels/CharacterGrid';
import NotebookPanel from './panels/NotebookPanel';
import VariableSnapshotPanel from './panels/VariableSnapshotPanel';
import WorldBookPanel from './panels/WorldBookPanel';
import RightPanel from './panels/RightPanel';
import MobileOverlay from './MobileOverlay';
import BusinessOverlay from './panels/BusinessOverlay';
import { MemorySettingsOverlay } from '../settings/memory/MemorySettingsOverlay';
import type { WorldSystemData, DiceRoll, SurvivalRecipe, BusinessModuleSchema } from '../../modules/schema';

import { eventBus, EVENTS } from '../../engine/eventBus';
import { findWorldDef } from '../../data/worldLoader';
type OverlayPanel = null | 'profile' | 'notebook' | 'characters' | 'variables' | 'worldbook' | 'memory';

interface NavButton {
  id: OverlayPanel | 'home';
  icon: LucideIcon;
  labelKey: string;
}

const navButtons: NavButton[] = [
  { id: 'home', icon: Home, labelKey: 'nav.home' },
  { id: 'profile', icon: User, labelKey: 'nav.profile' },
  { id: 'characters', icon: Users, labelKey: 'nav.characters' },
  { id: 'notebook', icon: BookOpen, labelKey: 'nav.notebook' },
  { id: 'variables', icon: Layers, labelKey: 'nav.variables' },
  { id: 'worldbook', icon: BookMarked, labelKey: 'nav.worldbook' },
  { id: 'memory', icon: Brain, labelKey: 'nav.memory' },
];

// 侧滑抽屉面板组件
function DrawerPanel({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!visible) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 99,
          opacity: animating ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      />
      {/* 抽屉面板 */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '50%',
          minWidth: '360px',
          maxWidth: '560px',
          background: 'var(--bg-secondary)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
          transform: animating ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* 头部 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600' }}>{title}</h2>
          <button
            onClick={onClose}
            className="btn-ghost btn-icon-sm"
            style={{ background: 'var(--bg-tertiary)' }}
          ><X size={14} /></button>
        </div>
        {/* 内容 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </>
  );
}

export default function GameScreen() {
  const { state, navigate, engine } = useGame();
  const { t } = useUISettings();
  const isMobile = useIsMobile(900);

  // 桌面端状态
  const [overlay, setOverlay] = useState<OverlayPanel>(null);
  const [businessOverlayOpen, setBusinessOverlayOpen] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 移动端状态
  const [showLeftOverlay, setShowLeftOverlay] = useState(false);
  const [showRightOverlay, setShowRightOverlay] = useState(false);
  const [mobileActivePanel, setMobileActivePanel] = useState<'profile' | 'characters' | 'notebook' | 'variables' | 'worldbook' | 'memory' | null>(null);

  const [stateVersion, setStateVersion] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  // 全屏切换
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      // 忽略全屏切换错误
    }
  }, []);

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 窄视口自动折叠右侧面板
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setRightCollapsed(true);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const gameState = engine.variableManager.getState();

  // 模块数据从世界定义读取（用于内联骰子卡片等）
  const worldDef = useMemo(() => {
    try { return findWorldDef(state.selectedWorld); } catch { return undefined; }
  }, [state.selectedWorld]);
  const hasBusinessModule = !!worldDef?.modules?.some(m => m.moduleId === 'business' && m.enabled);

  // 模块数据聚合（从世界定义 modules 构建 WorldSystemData，用于 UI 卡片）
  const worldSystem = useMemo((): WorldSystemData => {
    if (!worldDef?.modules) return {};
    const keyMap: Record<string, string> = {
      stat: '数值属性', progression: '成长体系', survival: '生存资源',
      business: '经营资产', dice: '骰子检定', talent: '天赋体系',
    };
    const result: WorldSystemData = {};
    for (const mod of worldDef.modules) {
      if (!mod.enabled) continue;
      const key = keyMap[mod.moduleId];
      if (key && mod.data) (result as any)[key] = mod.data;
    }
    return result;
  }, [worldDef]);

  // 骰子掷骰结果回调 — 存入本地 state 刷新 UI
  const [lastDiceRoll, setLastDiceRoll] = useState<DiceRoll | null>(null);
  const handleDiceRoll = useCallback((roll: DiceRoll) => {
    setLastDiceRoll(roll);
  }, []);

  const apiConfig = useConfigStore(s => s.apiConfig);

  // ── 生存资源：制作逻辑 ──
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);

  const handleSurvivalCraft = useCallback((recipe: SurvivalRecipe) => {
    const state = engine.variableManager.getState();
    const resources = state.玩家?.生存资源;
    if (!resources) return;

    // 检查资源是否足够
    for (const [resId, need] of Object.entries(recipe.inputs)) {
      const res = resources[resId];
      if (!res || res.数量 < need) return;
    }

    // 消耗材料
    for (const [resId, need] of Object.entries(recipe.inputs)) {
      const res = resources[resId];
      if (res) res.数量 -= need;
    }

    // 产出产品
    const outputId = recipe.output.resourceId;
    const outputAmount = recipe.output.amount;
    const outputRes = resources[outputId];
    if (outputRes) {
      outputRes.数量 += outputAmount;
    } else {
      resources[outputId] = { 数量: outputAmount };
    }

    engine.variableManager.setState(state);
    setStateVersion(v => v + 1);
  }, [engine]);

  // ── 生存资源：配方生成 ──
  const handleSurvivalGenerateRecipe = useCallback(async (request: string) => {
    if (!apiConfig) return;
    setIsGeneratingRecipe(true);
    try {
      const { buildRecipeGenPrompt } = await import('../../modules/prompts');
      const state = engine.variableManager.getState();
      const resources = state.玩家?.生存资源 || {};
      const currentResources = Object.entries(resources).map(([id, r]) => ({
        id, name: id, amount: r.数量, max: r.最大值 ?? 9999,
      }));
      const worldTheme = state.世界?.社会环境?.社会氛围 || '生存世界';

      const prompt = buildRecipeGenPrompt({ currentResources, playerRequest: request, worldTheme });
      const { requestStreamWithRetry } = await import('../../api/client');
      const result = await requestStreamWithRetry(apiConfig, [
        { role: 'user', content: prompt },
      ], { signal: new AbortController().signal, onDelta: () => {} });

      const jsonMatch = result.text.match(/```(?:json)?\s*([\s\S]*?)```/) || result.text.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        const fixed = jsonMatch[1].trim().replace(/[""]/g, '"').replace(/['']/g, "'");
        const recipe = JSON.parse(fixed);

        // 配方数据在世界定义中，此处仅刷新UI展示
        engine.variableManager.setState(state);
        setStateVersion(v => v + 1);
      }
    } catch (err) {
      console.warn('[配方生成] 失败:', err);
    } finally {
      setIsGeneratingRecipe(false);
    }
  }, [engine, apiConfig]);

  // ── 生存资源：删除配方（配方数据在世界定义中，此处仅刷新UI） ──
  const handleSurvivalDeleteRecipe = useCallback((_recipeId: string) => {
    setStateVersion(v => v + 1);
  }, []);

  // ── 经营资产：自动结算（每轮变量更新后，纯机械计算） ──
  useEffect(() => {
    const handler = () => {
      const biz = worldDef?.modules?.find(m => m.moduleId === 'business' && m.enabled)?.data as BusinessModuleSchema | undefined;
      if (!biz?.assets?.length) return;

      let totalIncome = 0;
      let totalMaintenance = 0;
      for (const asset of biz.assets) {
        if (asset.status !== 'active') continue;
        const levelBonus = (asset.income?.perLevel ?? 0) * Math.max(0, (asset.level ?? 1) - 1);
        totalIncome += (asset.income?.base ?? 0) + levelBonus;
        totalMaintenance += asset.maintenance ?? 0;
      }

      const net = totalIncome - totalMaintenance;
      if (net === 0) return;

      biz.funds = (biz.funds ?? 0) + net;
      if (!biz.transactionLog) biz.transactionLog = [];
      biz.transactionLog.push({
        cycle: 0, type: net >= 0 ? 'income' : 'expense',
        description: `周期结算：收入 +${totalIncome}，维护 -${totalMaintenance}`,
        amount: net,
      });

      setStateVersion(v => v + 1);
    };

    eventBus.on(EVENTS.VARIABLE_UPDATE_ENDED, handler);
    return () => { eventBus.off(EVENTS.VARIABLE_UPDATE_ENDED, handler); };
  }, [engine]);

  // 变量更新后刷新右侧面板
  useEffect(() => {
    const handler = () => setStateVersion(v => v + 1);
    eventBus.on(EVENTS.VARIABLE_UPDATE_ENDED, handler);
    return () => { eventBus.off(EVENTS.VARIABLE_UPDATE_ENDED, handler); };
  }, []);

  // 变量提取失败时显示提示
  useEffect(() => {
    const handler = (errMsg: string) => {
      setNotification('变量提取失败，游戏状态可能未更新');
      setTimeout(() => setNotification(null), 4000);
    };
    eventBus.on(EVENTS.VARIABLE_EXTRACTION_FAILED, handler);
    return () => { eventBus.off(EVENTS.VARIABLE_EXTRACTION_FAILED, handler); };
  }, []);

  // __engine 和测试桥梁已在 GameProvider 中注册，此处无需重复

  const getOverlayTitle = () => {
    const btn = navButtons.find(b => b.id === overlay);
    return btn ? t(btn.labelKey) : '';
  };

  const handleUpdateChronicles = useCallback((npcId: string, chronicles: string[]) => {
    const state = engine.variableManager.getState();
    const npc = state.人物档案?.[npcId];
    if (!npc) return;
    (npc as any).人物事迹 = chronicles;
    engine.variableManager.setState(state);
    setStateVersion(v => v + 1);
  }, [engine]);

  const handleMergeChronicles = useCallback(async (npcId: string, startIndex: number, endIndex: number) => {
    if (!apiConfig) return false;
    const ok = await engine.variableManager.mergeNpcChronicles(npcId, startIndex, endIndex, apiConfig);
    if (ok) setStateVersion(v => v + 1);
    return ok;
  }, [engine, apiConfig]);

  const renderOverlayContent = () => {
    switch (overlay) {
      case 'profile': return <ProfilePanel gameState={gameState} hasBusinessModule={hasBusinessModule} />;
      case 'characters': return <CharacterGrid gameState={gameState} onUpdateChronicles={handleUpdateChronicles} onMergeChronicles={handleMergeChronicles} />;
      case 'notebook': return <NotebookPanel gameState={gameState} />;
      case 'variables': return <VariableSnapshotPanel messages={engine.messages} varMgr={engine.variableManager} onRestoreSnapshot={(snapshot) => { engine.variableManager.restoreSnapshot(snapshot); setStateVersion(v => v + 1); }} onSave={() => setStateVersion(v => v + 1)} />;
      case 'worldbook': return <WorldBookPanel worldId={state.selectedWorld} />;
      case 'memory': return <MemorySettingsOverlay visible={true} onClose={() => setOverlay(null)} onSave={() => {}} mode="inline" />;
      default: return null;
    }
  };

  // 移动端导航菜单项
  const mobileNavItems = [
    { id: 'home', icon: Home, labelKey: 'nav.home', action: () => { setShowLeftOverlay(false); navigate('start'); } },
    { id: 'profile', icon: User, labelKey: 'nav.profile', action: () => { setShowLeftOverlay(false); setMobileActivePanel('profile'); } },
    { id: 'characters', icon: Users, labelKey: 'nav.characters', action: () => { setShowLeftOverlay(false); setMobileActivePanel('characters'); } },
    { id: 'notebook', icon: BookOpen, labelKey: 'nav.notebook', action: () => { setShowLeftOverlay(false); setMobileActivePanel('notebook'); } },
    { id: 'variables', icon: Layers, labelKey: 'nav.variables', action: () => { setShowLeftOverlay(false); setMobileActivePanel('variables'); } },
    { id: 'worldbook', icon: BookMarked, labelKey: 'nav.worldbook', action: () => { setShowLeftOverlay(false); setMobileActivePanel('worldbook'); } },
    { id: 'memory', icon: Brain, labelKey: 'nav.memory', action: () => { setShowLeftOverlay(false); setMobileActivePanel('memory'); } },
    { id: 'settings', icon: Settings, labelKey: 'nav.settings', action: () => { setShowLeftOverlay(false); navigate('settings'); } },
  ];

  // 移动端左侧面板内容渲染
  const renderMobilePanelContent = () => {
    switch (mobileActivePanel) {
      case 'profile':
        return <ProfilePanel gameState={gameState} hasBusinessModule={hasBusinessModule} />;
      case 'characters':
        return <CharacterGrid gameState={gameState} onUpdateChronicles={handleUpdateChronicles} onMergeChronicles={handleMergeChronicles} />;
      case 'notebook':
        return <NotebookPanel gameState={gameState} />;
      case 'variables':
        return <VariableSnapshotPanel messages={engine.messages} varMgr={engine.variableManager} onRestoreSnapshot={(snapshot) => { engine.variableManager.restoreSnapshot(snapshot); setStateVersion(v => v + 1); }} onSave={() => setStateVersion(v => v + 1)} />;
      case 'worldbook':
        return <WorldBookPanel worldId={state.selectedWorld} />;
      case 'memory':
        return <MemorySettingsOverlay visible={true} onClose={() => setMobileActivePanel(null)} onSave={() => {}} mode="inline" />;
      default:
        return null;
    }
  };

  // 移动端左侧面板标题
  const getMobilePanelTitle = () => {
    switch (mobileActivePanel) {
      case 'profile': return t('nav.profile');
      case 'characters': return t('nav.characters');
      case 'notebook': return t('nav.notebook');
      case 'variables': return t('nav.variables');
      case 'worldbook': return t('nav.worldbook');
      case 'memory': return t('nav.memory');
      default: return '导航';
    }
  };

  return (
    <div
      className="full-height"
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      {/* 移动端头部 */}
      {isMobile && (
        <div className="mobile-header">
          <button
            className="mobile-header-btn"
            onClick={() => setShowLeftOverlay(true)}
            aria-label="打开导航菜单"
          >
            <Menu size={22} />
          </button>

          <div className="mobile-header-title">
            {state.selectedWorld ? (findWorldDef(state.selectedWorld)?.name || '世界漫游指南') : '世界漫游指南'}
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="mobile-header-btn"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? '退出全屏' : '全屏'}
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              className="mobile-header-btn"
              onClick={() => setShowRightOverlay(true)}
              aria-label="打开信息面板"
            >
              <PanelRightOpen size={22} />
            </button>
          </div>
        </div>
      )}

      {/* 桌面端：左侧图标导航栏 */}
      {!isMobile && (
        <div style={{
          width: '52px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 0',
          gap: '2px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
        }}>
          {navButtons.map(btn => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.id}
                onClick={() => {
                  if (btn.id === 'home') { navigate('start'); return; }
                  setOverlay(overlay === btn.id ? null : btn.id);
                }}
                title={t(btn.labelKey)}
                style={{
                  width: '38px',
                  height: '38px',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: overlay === btn.id ? 'var(--accent-dim)' : 'transparent',
                  color: overlay === btn.id ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (overlay !== btn.id) e.currentTarget.style.background = 'var(--accent-dim)';
                }}
                onMouseLeave={e => {
                  if (overlay !== btn.id) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon size={18} strokeWidth={1.5} />
              </button>
            );
          })}

          <div style={{ flex: 1 }} />

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? '退出全屏' : '全屏'}
            className="btn-ghost btn-icon"
          >
            {isFullscreen ? <Minimize2 size={18} strokeWidth={1.5} /> : <Maximize2 size={18} strokeWidth={1.5} />}
          </button>

          <button
            onClick={() => navigate('settings')}
            title={t('nav.settings')}
            className="btn-ghost btn-icon"
          >
            <Settings size={18} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* 中间主区域 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatPanel
            messages={engine.messages}
            isGenerating={engine.isGenerating}
            onSend={engine.sendMessage}
            onCancel={engine.cancel}
            onDelete={engine.deleteSingleMessage}
            onEdit={engine.editMessage}
            onResend={engine.resendFromMessage}
            onResendFromHere={engine.resendFromAssistantMessage}
            pipelineStatus={engine.pipelineStatus}
            worldSystem={worldSystem}
            onDiceRoll={handleDiceRoll}
            onRetrySingleStage={engine.retrySingleStage}
          />
        </div>

        {/* 桌面端：侧滑抽屉面板 */}
        {!isMobile && (
          <DrawerPanel
            open={overlay !== null}
            title={getOverlayTitle()}
            onClose={() => setOverlay(null)}
          >
            {renderOverlayContent()}
          </DrawerPanel>
        )}
      </div>

      {/* 桌面端：右侧信息栏 */}
      {!isMobile && (
        <>
          <div style={{
            width: rightCollapsed ? '0px' : 'var(--right-panel-width)',
            flexShrink: 0,
            overflow: 'hidden',
            borderLeft: rightCollapsed ? 'none' : '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            {!rightCollapsed && <RightPanel
              gameState={gameState}
              worldId={state.selectedWorld}
              onSurvivalGenerateRecipe={handleSurvivalGenerateRecipe}
              onSurvivalCraft={handleSurvivalCraft}
              onSurvivalDeleteRecipe={handleSurvivalDeleteRecipe}
              isGeneratingRecipe={isGeneratingRecipe}
              onOpenBusinessOverlay={() => setBusinessOverlayOpen(true)}
            />}
          </div>

          {/* 右侧折叠按钮 */}
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            style={{
              position: 'fixed',
              right: rightCollapsed ? '0' : 'var(--right-panel-width)',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '24px',
              height: '40px',
              border: '1px solid var(--border)',
              borderRight: rightCollapsed ? '1px solid var(--border)' : 'none',
              borderRadius: '4px 0 0 4px',
              background: 'var(--bg-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-muted)',
              zIndex: 50,
              transition: 'right 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {rightCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </>
      )}

      {/* 移动端：左侧导航覆盖层 */}
      {isMobile && (
        <MobileOverlay
          open={showLeftOverlay}
          onClose={() => setShowLeftOverlay(false)}
          title="导航"
          side="left"
          width={260}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0' }}>
            {mobileNavItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    minHeight: 'var(--touch-min)',
                    width: '100%',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  <span>{t(item.labelKey)}</span>
                </button>
              );
            })}
          </nav>
        </MobileOverlay>
      )}

      {/* 移动端：左侧面板覆盖层（显示具体内容） */}
      {isMobile && mobileActivePanel && (
        <MobileOverlay
          open={true}
          onClose={() => setMobileActivePanel(null)}
          title={getMobilePanelTitle()}
          side="left"
          width={300}
        >
          {renderMobilePanelContent()}
        </MobileOverlay>
      )}

      {/* 移动端：右侧信息覆盖层 */}
      {isMobile && (
        <MobileOverlay
          open={showRightOverlay}
          onClose={() => setShowRightOverlay(false)}
          title="信息面板"
          side="right"
          width={320}
        >
          <RightPanel
            gameState={gameState}
            worldId={state.selectedWorld}
            onSurvivalGenerateRecipe={handleSurvivalGenerateRecipe}
            onSurvivalCraft={handleSurvivalCraft}
            onSurvivalDeleteRecipe={handleSurvivalDeleteRecipe}
            isGeneratingRecipe={isGeneratingRecipe}
            onOpenBusinessOverlay={() => setBusinessOverlayOpen(true)}
          />
        </MobileOverlay>
      )}

      {/* 经营管理覆盖层（纯展示） */}
      {(() => {
        const bizData = worldDef?.modules?.find(m => m.moduleId === 'business' && m.enabled)?.data as BusinessModuleSchema | undefined;
        if (!bizData) return null;
        return (
          <BusinessOverlay
            open={businessOverlayOpen}
            data={bizData}
            onClose={() => setBusinessOverlayOpen(false)}
          />
        );
      })()}

      {/* 通知提示 */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: 'var(--font-size-md)',
          color: 'var(--text-primary)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          zIndex: 200,
          animation: 'fadeIn 0.2s ease',
        }}>
          {notification}
        </div>
      )}
    </div>
  );
}
