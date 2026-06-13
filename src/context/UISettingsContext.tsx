import { createContext, useContext, type ReactNode } from 'react';
import { useConfigStore, type UISettings, type Theme, type FontFamily, type FontSize, type LineHeight, type Language } from '../stores/configStore';

export type { Theme, FontFamily, FontSize, LineHeight, Language, UISettings };

interface UISettingsContextType {
  settings: UISettings;
  update: <K extends keyof UISettings>(key: K, value: UISettings[K]) => void;
  t: (key: string) => string;
}

const UISettingsContext = createContext<UISettingsContextType | null>(null);

export function UISettingsProvider({ children }: { children: ReactNode }) {
  const settings = useConfigStore(s => s.settings);
  const updateSettings = useConfigStore(s => s.updateSettings);
  const t = useConfigStore(s => s.t);

  // 初始化 CSS 变量（仅首次）
  const initialized = useConfigStore(s => s._initialized);
  if (!initialized) {
    useConfigStore.getState().initialize();
    useConfigStore.setState({ _initialized: true } as any);
  }

  return (
    <UISettingsContext.Provider value={{ settings, update: updateSettings, t }}>
      {children}
    </UISettingsContext.Provider>
  );
}

export function useUISettings() {
  const ctx = useContext(UISettingsContext);
  if (!ctx) throw new Error('useUISettings must be used within UISettingsProvider');
  return ctx;
}
