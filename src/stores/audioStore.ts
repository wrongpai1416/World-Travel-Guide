import { create } from 'zustand';

interface AudioState {
  bgmMuted: boolean;
  setBgmMuted: (muted: boolean) => void;
}

// 从 localStorage 初始化（兼容旧数据）
const initMuted = localStorage.getItem('bgm_muted') === 'true';

export const useAudioStore = create<AudioState>((set) => ({
  bgmMuted: initMuted,
  setBgmMuted: (muted) => {
    localStorage.setItem('bgm_muted', String(muted));
    set({ bgmMuted: muted });
  },
}));
