import type { ApiConfig } from '../../api/types';

export const PRESETS_KEY = 'chuanyue_api_presets';
export const VARIABLE_ENABLED_KEY = 'chuanyue_variable_enabled';

export interface ApiPreset {
  id: string;
  name: string;
  config: ApiConfig;
  createdAt: number;
}

export function loadPresets(): ApiPreset[] {
  try {
    const saved = localStorage.getItem(PRESETS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

export function savePresets(presets: ApiPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}
