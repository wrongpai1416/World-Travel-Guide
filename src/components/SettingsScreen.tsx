import { useState, useRef, useCallback } from 'react';
import { Palette, Cpu, BarChart3, Brain } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useUISettings } from '../context/UISettingsContext';
import { useConfigStore } from '../stores/configStore';
import type { ApiConfig } from '../api/types';
import GeneralSettingsTab from './settings/GeneralSettingsTab';
import ApiSettingsTab, { type ApiSettingsRef } from './settings/ApiSettingsTab';
import VariableSettingsTab, { type VariableSettingsRef } from './settings/VariableSettingsTab';
import MemorySettingsTab from './settings/MemorySettingsTab';
import { type ApiPreset, loadPresets, VARIABLE_ENABLED_KEY } from './settings/apiPresetUtils';

type SettingsTab = 'general' | 'api' | 'variable' | 'memory';

const TABS: { id: SettingsTab; icon: LucideIcon; label: string }[] = [
  { id: 'general', icon: Palette, label: '通常设置' },
  { id: 'api', icon: Cpu, label: 'API 设置' },
  { id: 'variable', icon: BarChart3, label: '变量系统' },
  { id: 'memory', icon: Brain, label: '记忆系统' },
];

export default function SettingsScreen() {
  const { goBack, engine } = useGame();
  const { t } = useUISettings();
  const apiConfig = useConfigStore(s => s.apiConfig);
  const apiMode = useConfigStore(s => s.apiMode);
  const auxiliaryConfig = useConfigStore(s => s.auxiliaryConfig);
  const setApiConfig = useConfigStore(s => s.setApiConfig);
  const setApiMode = useConfigStore(s => s.setApiMode);
  const setAuxiliaryConfig = useConfigStore(s => s.setAuxiliaryConfig);
  const [tab, setTab] = useState<SettingsTab>('general');
  const presets = loadPresets();

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
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        <button
          className="btn-ghost"
          onClick={goBack}
          style={{ padding: '4px 8px', border: 'none', background: 'var(--bg-tertiary)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'var(--font-size-md)' }}
        >
          ← {t('settings.back')}
        </button>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600' }}>{t('settings.title')}</h1>
      </div>

      {/* 主体：侧边栏 + 内容 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧 Tab 栏 */}
        <div style={{
          width: '130px', flexShrink: 0, display: 'flex', flexDirection: 'column',
          padding: '12px 8px', gap: '4px',
          borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)',
        }}>
          {TABS.map(t => {
            const TabIcon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 10px', border: 'none', borderRadius: 'var(--radius-md)',
                  background: tab === t.id ? 'var(--accent-dim)' : 'transparent',
                  color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 'var(--font-size-base)', cursor: 'pointer', transition: 'all 0.15s',
                  fontWeight: tab === t.id ? '600' : '400',
                  textAlign: 'left', width: '100%',
                }}
                onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.background = 'var(--accent-dim)'; }}
                onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <TabIcon size={15} strokeWidth={1.5} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* 右侧内容 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
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
      {tab !== 'api' && tab !== 'memory' && <div style={{
        padding: '12px 24px', borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0,
      }}>
        <button className="btn-secondary" onClick={goBack} style={{ padding: '8px 20px', fontSize: 'var(--font-size-md)' }}>
          取消
        </button>
        <button className="btn-primary" onClick={handleSave} style={{ padding: '8px 28px', fontSize: 'var(--font-size-md)' }}>
          {t('settings.save')}
        </button>
      </div>}
    </div>
  );
}
