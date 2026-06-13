import { useState, useEffect, useRef, useCallback } from 'react';
import { Home, User, Users, BookOpen, Settings, X, ChevronLeft, ChevronRight, Save, Clock, CheckCircle, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useUISettings } from '../../context/UISettingsContext';
import { useSaveStore } from '../../stores/saveStore';
import { useConfigStore } from '../../stores/configStore';
import { useMemoryStore } from '../../memory/memoryStore';
import ChatPanel from './chat/ChatPanel';
import ProfilePanel from './panels/ProfilePanel';
import CharacterGrid from './panels/CharacterGrid';
import NotebookPanel from './panels/NotebookPanel';
import RightPanel from './panels/RightPanel';
import { VariableSettingsOverlay } from './VariableSettingsOverlay';

import { eventBus, EVENTS } from '../../engine/eventBus';
type OverlayPanel = null | 'profile' | 'notebook' | 'characters' | 'save';

interface NavButton {
  id: OverlayPanel | 'home';
  icon: LucideIcon;
  labelKey: string;
}

const navButtons: NavButton[] = [
  { id: 'home', icon: Home, labelKey: 'nav.home' },
  { id: 'save', icon: Save, labelKey: 'nav.save' },
  { id: 'profile', icon: User, labelKey: 'nav.profile' },
  { id: 'characters', icon: Users, labelKey: 'nav.characters' },
  { id: 'notebook', icon: BookOpen, labelKey: 'nav.notebook' },
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
            style={{
              border: 'none',
              background: 'var(--bg-tertiary)',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 'var(--font-size-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
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
  const savesMeta = useSaveStore(s => s.savesMeta);
  const currentSaveId = useSaveStore(s => s.currentSaveId);
  const saveGame = useSaveStore(s => s.saveGame);
  const { t } = useUISettings();
  const [overlay, setOverlay] = useState<OverlayPanel>(null);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [stateVersion, setStateVersion] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [showVariables, setShowVariables] = useState(false);

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

  const apiConfig = useConfigStore(s => s.apiConfig);

  const handleSummarizeChronicles = useCallback(async (npcId: string) => {
    if (!apiConfig) return false;
    const ok = await engine.variableManager.summarizeNpcChronicles(npcId, apiConfig);
    if (ok) setStateVersion(v => v + 1);
    return ok;
  }, [engine, apiConfig]);

  const handleManualSave = async () => {
    setSaveStatus('saving');
    try {
      await saveGame(() => {
        const saveId = useSaveStore.getState().currentSaveId;
        if (!saveId || engine.messages.length === 0) return null;
        const cfg = useConfigStore.getState();
        const memStore = useMemoryStore.getState();
        const memData = memStore.toJSON();
        return {
          id: saveId,
          name: useSaveStore.getState().currentSaveName || state.personalInfo?.name || '未命名存档',
          timestamp: Date.now(),
          messages: [...engine.messages],
          gameState: engine.variableManager.getState(),
          apiConfig: cfg.apiConfig,
          apiMode: cfg.apiMode,
          worldId: state.selectedWorld,
          personalInfo: state.personalInfo ?? undefined,
          characterHistory: state.characterHistory || undefined,
          memoryRuntime: memData.memoryRuntime,
          memoryConfig: memData.config,
          vectorMemory: memData.vectorMemory,
        };
      });
      setSaveStatus('done');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch {
      setSaveStatus('idle');
      setNotification('保存失败');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const renderOverlayContent = () => {
    switch (overlay) {
      case 'profile': return <ProfilePanel gameState={gameState} />;
      case 'characters': return <CharacterGrid gameState={gameState} onSummarizeChronicles={handleSummarizeChronicles} />;
      case 'notebook': return <NotebookPanel gameState={gameState} />;
      case 'save': {
        const currentMeta = savesMeta.find(m => m.id === currentSaveId);
        return (
          <div style={{ padding: '16px 20px' }}>
            {/* 当前存档信息 */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '8px' }}>当前存档</div>
              <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)', marginBottom: '4px' }}>
                  {currentMeta?.name || state.personalInfo?.name || '未命名存档'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  {currentMeta ? new Date(currentMeta.timestamp).toLocaleString() : '未保存'}
                </div>
              </div>
            </div>

            {/* 保存按钮 */}
            <button
              onClick={handleManualSave}
              disabled={saveStatus === 'saving'}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-md)',
                background: saveStatus === 'done' ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                color: saveStatus === 'done' ? 'var(--accent)' : 'var(--text-primary)',
                cursor: saveStatus === 'saving' ? 'wait' : 'pointer',
                fontSize: 'var(--font-size-md)',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              {saveStatus === 'saving' ? (
                <><Save size={16} className="spin" /> 保存中...</>
              ) : saveStatus === 'done' ? (
                <><CheckCircle size={16} /> 已保存</>
              ) : (
                <><Save size={16} /> 保存游戏</>
              )}
            </button>

            {/* 存档管理跳转 */}
            <button
              onClick={() => { setOverlay(null); navigate('start'); }}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '8px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-md)',
              }}
            >
              存档管理
            </button>
          </div>
        );
      }
      default: return null;
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      overflow: 'hidden',
    }}>
      {/* 左侧图标导航栏 */}
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

        {/* 变量管理按钮 */}
        <button
          onClick={() => setShowVariables(true)}
          title="变量管理"
          style={{
            width: '38px',
            height: '38px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: showVariables ? 'var(--accent-dim)' : 'transparent',
            color: showVariables ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
          onMouseLeave={e => { if (!showVariables) e.currentTarget.style.background = 'transparent'; }}
        >
          <Layers size={18} strokeWidth={1.5} />
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => navigate('settings')}
          title={t('nav.settings')}
          style={{
            width: '38px',
            height: '38px',
            border: 'none',
            borderRadius: '8px',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-xl)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* 中间主区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
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
          />
        </div>

        {/* 侧滑抽屉面板 */}
        <DrawerPanel
          open={overlay !== null}
          title={getOverlayTitle()}
          onClose={() => setOverlay(null)}
        >
          {renderOverlayContent()}
        </DrawerPanel>
      </div>

      {/* 右侧信息栏 */}
      <div style={{
        width: rightCollapsed ? '0px' : 'var(--right-panel-width)',
        flexShrink: 0,
        overflow: 'hidden',
        borderLeft: rightCollapsed ? 'none' : '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {!rightCollapsed && <RightPanel gameState={gameState} />}
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

      {/* 变量管理全屏面板 */}
      <VariableSettingsOverlay
        visible={showVariables}
        onClose={() => setShowVariables(false)}
        messages={engine.messages}
        varMgr={engine.variableManager}
        onRestoreSnapshot={() => setStateVersion(v => v + 1)}
        onSave={() => setStateVersion(v => v + 1)}
      />
    </div>
  );
}
