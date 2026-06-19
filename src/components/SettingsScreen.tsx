import { useState, useRef, useCallback, useEffect } from 'react';
import { Palette, Cpu, BarChart3, Brain, ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useUISettings } from '../context/UISettingsContext';
import { useConfigStore } from '../stores/configStore';
import { useIsMobile } from '../hooks/useIsMobile';
import type { ApiConfig } from '../api/types';
import GeneralSettingsTab from './settings/GeneralSettingsTab';
import ApiSettingsTab, { type ApiSettingsRef } from './settings/ApiSettingsTab';
import VariableSettingsTab, { type VariableSettingsRef } from './settings/VariableSettingsTab';
import MemorySettingsTab from './settings/MemorySettingsTab';
import { type ApiPreset, loadPresets, VARIABLE_ENABLED_KEY } from './settings/apiPresetUtils';

type SettingsTab = 'general' | 'api' | 'variable' | 'memory';

// 主页设置：只有通常设置和 API 设置
const HOME_TABS: { id: SettingsTab; icon: LucideIcon; label: string }[] = [
  { id: 'general', icon: Palette, label: '通常设置' },
  { id: 'api', icon: Cpu, label: 'API 设置' },
];

// 游戏内设置：全部 4 个 tab
const GAME_TABS: { id: SettingsTab; icon: LucideIcon; label: string }[] = [
  { id: 'general', icon: Palette, label: '通常设置' },
  { id: 'api', icon: Cpu, label: 'API 设置' },
  { id: 'variable', icon: BarChart3, label: '变量系统' },
  { id: 'memory', icon: Brain, label: '记忆系统' },
];

export default function SettingsScreen() {
  const { goBack, engine, state } = useGame();
  const isInGame = state.currentScreen === 'game'; // 判断是否从游戏内进入设置
  const { t } = useUISettings();
  const isMobile = useIsMobile(768);
  const apiConfig = useConfigStore(s => s.apiConfig);
  const apiMode = useConfigStore(s => s.apiMode);
  const auxiliaryConfig = useConfigStore(s => s.auxiliaryConfig);
  const setApiConfig = useConfigStore(s => s.setApiConfig);
  const setApiMode = useConfigStore(s => s.setApiMode);
  const setAuxiliaryConfig = useConfigStore(s => s.setAuxiliaryConfig);
  const [tab, setTab] = useState<SettingsTab>('general');
  const presets = loadPresets();

  // 确保当前 tab 在可用的 tab 列表中
  const availableTabs = isInGame ? GAME_TABS : HOME_TABS;
  useEffect(() => {
    if (!availableTabs.find(t => t.id === tab)) {
      setTab('general');
    }
  }, [isInGame, tab, availableTabs]);

  const apiRef = useRef<ApiSettingsRef>(null);
  const varRef = useRef<VariableSettingsRef>(null);

  // 计算初始辅助 API 预设 ID
  const initialAuxPresetId = (() => {
    if (apiMode !== 'auxiliary' || !auxiliaryConfig) return '';
    const match = presets.find(p =>
      p.config.baseUrl === auxiliaryConfig.endpoint &&
      p.config.apiKey === auxiliaryConfig.apiKey &&
      p.config.model === auxiliaryConfig.model
    );
    return match?.id || '';
  })();

  const handleSave = useCallback(() => {
    const apiValues = apiRef.current?.getValues();
    const varValues = varRef.current?.getValues();

    if (apiValues) {
      setApiConfig(apiValues.config);
    }

    if (varValues) {
      if (varValues.auxPresetId) {
        const preset = presets.find(p => p.id === varValues.auxPresetId);
        if (preset) {
          setAuxiliaryConfig({
            endpoint: preset.config.baseUrl,
            apiKey: preset.config.apiKey,
            model: preset.config.model,
          });
          setApiMode('auxiliary');
        }
      } else {
        setAuxiliaryConfig(null);
        setApiMode('default');
      }
      localStorage.setItem(VARIABLE_ENABLED_KEY, String(varValues.variableEnabled));
      localStorage.setItem('chuanyue_variable_delay', String(varValues.varDelay));
      localStorage.setItem('chuanyue_variable_retries', String(varValues.varRetries));
    }

    goBack();
  }, [goBack, presets, setApiConfig, setApiMode, setAuxiliaryConfig]);

  return (
    <div
      className="full-height"
      style={{
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 头部 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: isMobile ? '12px 16px' : '16px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}>
        <button
          className="btn-ghost btn-sm"
          onClick={goBack}
          style={{
            background: 'var(--bg-tertiary)',
            minHeight: 'var(--touch-min)',
          }}
        >
          <ArrowLeft size={16} />
          {t('settings.back')}
        </button>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600' }}>{t('settings.title')}</h1>
      </div>

      {/* 移动端：顶部标签页 */}
      {isMobile && (
        <div className="settings-mobile-tabs">
          {(isInGame ? GAME_TABS : HOME_TABS).map(t => {
            const TabIcon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`settings-mobile-tab${tab === t.id ? ' active' : ''}`}
              >
                <TabIcon size={15} strokeWidth={1.5} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 主体：侧边栏 + 内容 */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* 桌面端：左侧 Tab 栏 */}
        {!isMobile && (
          <div style={{
            width: '130px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 8px',
            gap: '4px',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
          }}>
            {(isInGame ? GAME_TABS : HOME_TABS).map(t => {
              const TabIcon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`settings-tab-btn${tab === t.id ? ' active' : ''}`}
                >
                  <TabIcon size={15} strokeWidth={1.5} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 内容 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: isMobile ? '16px' : '20px 24px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {tab === 'general' && <GeneralSettingsTab />}
          {tab === 'api' && <ApiSettingsTab ref={apiRef} initialConfig={apiConfig} t={t} onSave={handleSave} onBack={goBack} />}
          {tab === 'variable' && (
            <VariableSettingsTab
              ref={varRef}
              variableManager={engine.variableManager}
              presets={presets}
              initialAuxPresetId={initialAuxPresetId}
              messages={engine.messages}
            />
          )}
          {tab === 'memory' && <MemorySettingsTab onBack={() => setTab('general')} />}
        </div>
      </div>

      {/* 底部保存按钮（API 和 Memory tab 有自己的按钮，此处隐藏） */}
      {tab !== 'api' && tab !== 'memory' && (
        <div style={{
          padding: isMobile ? '12px 16px' : '12px 24px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          flexShrink: 0,
        }}>
          <button
            className="btn-secondary"
            onClick={goBack}
            style={{ minHeight: 'var(--touch-min)' }}
          >
            取消
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            style={{ minHeight: 'var(--touch-min)', padding: '8px 28px' }}
          >
            {t('settings.save')}
          </button>
        </div>
      )}
    </div>
  );
}
