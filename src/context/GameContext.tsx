import { createContext, useContext, useReducer, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useGameEngine } from '../engine/useGameEngine';
import type { GameEngine } from '../engine/types';
import type { GameSave, PlayerProfile } from '../storage/db';
import { loadGame as loadGameFromDb, optimizeSnapshots, ACTIVE_SAVE_KEY } from '../storage/db';
import { useSaveStore, setAutoSaveBuilder } from '../stores/saveStore';
import { useConfigStore } from '../stores/configStore';
import { useMemoryStore } from '../memory/memoryStore';

/** 创建带默认值的 PlayerProfile（旧存档缺失字段时兜底） */
function withProfileDefaults(raw: Partial<PlayerProfile> | null | undefined): PlayerProfile | null {
  if (!raw) return null;
  return {
    name: raw.name ?? '', gender: raw.gender ?? '', age: raw.age ?? '', background: raw.background ?? '',
    career: raw.career ?? '', socialClass: raw.socialClass ?? '', organization: raw.organization ?? '',
    specialIdentity: raw.specialIdentity ?? '', perspective: raw.perspective ?? '第三人称',
    initialSkills: raw.initialSkills ?? {}, initialItems: raw.initialItems ?? {}, customNpcs: raw.customNpcs ?? [],
  };
}

type Screen = 'start' | 'settings' | 'game';

interface AppState {
  currentScreen: Screen;
  screenHistory: Screen[];
  selectedWorld: string;
  personalInfo: PlayerProfile | null;
  characterHistory: string;
}

type Action =
  | { type: 'NAVIGATE'; screen: Screen }
  | { type: 'GO_BACK' }
  | { type: 'SET_WORLD'; worldId: string }
  | { type: 'SET_PERSONAL_INFO'; info: PlayerProfile | null }
  | { type: 'SET_CHARACTER_HISTORY'; history: string }
  | { type: 'LOAD_SAVE'; save: GameSave };

const initialState: AppState = {
  currentScreen: 'start',
  screenHistory: [],
  selectedWorld: 'default',
  personalInfo: null,
  characterHistory: '',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, currentScreen: action.screen, screenHistory: [...state.screenHistory, state.currentScreen] };
    case 'GO_BACK': {
      const prev = state.screenHistory[state.screenHistory.length - 1];
      return { ...state, currentScreen: prev || 'start', screenHistory: state.screenHistory.slice(0, -1) };
    }
    case 'SET_WORLD':
      return { ...state, selectedWorld: action.worldId };
    case 'SET_PERSONAL_INFO':
      return { ...state, personalInfo: action.info };
    case 'SET_CHARACTER_HISTORY':
      return { ...state, characterHistory: action.history };
    case 'LOAD_SAVE':
      return {
        ...state,
        selectedWorld: action.save.worldId || 'default',
        personalInfo: withProfileDefaults(action.save.personalInfo),
        characterHistory: action.save.characterHistory ?? '',
      };
    default:
      return state;
  }
}

interface GameContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  navigate: (screen: Screen) => void;
  goBack: () => void;
  engine: GameEngine;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const navigate = useCallback((screen: Screen) => dispatch({ type: 'NAVIGATE', screen }), []);
  const goBack = useCallback(() => dispatch({ type: 'GO_BACK' }), []);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const engineRef = useRef<GameEngine | null>(null);

  // 从 configStore 读取 API 配置
  const apiConfig = useConfigStore(s => s.apiConfig);
  const auxiliaryConfig = useConfigStore(s => s.auxiliaryConfig);

  // ─── 自动存档桥接 ───
  const scheduleAutoSave = useSaveStore(s => s.scheduleAutoSave);
  const scheduleAutoSaveRef = useRef(scheduleAutoSave);
  useEffect(() => { scheduleAutoSaveRef.current = scheduleAutoSave; }, [scheduleAutoSave]);

  const handleAutoSave = useCallback(() => {
    scheduleAutoSaveRef.current();
  }, []);

  // 注入 buildSaveData 到 saveStore（仅挂载时执行一次，builder 内部通过 ref 读取最新状态）
  useEffect(() => {
    setAutoSaveBuilder(() => {
      const eng = engineRef.current;
      const s = stateRef.current;
      const saveId = useSaveStore.getState().currentSaveId;
      if (!eng || eng.messages.length === 0 || !saveId) return null;

      const optimized = optimizeSnapshots([...eng.messages]);
      const memStore = useMemoryStore.getState();
      const memData = memStore.toJSON();

      return {
        id: saveId,
        name: useSaveStore.getState().currentSaveName || s.personalInfo?.name || '未命名存档',
        timestamp: Date.now(),
        messages: optimized,
        gameState: eng.variableManager.getState(),
        apiConfig: useConfigStore.getState().apiConfig,
        apiMode: useConfigStore.getState().apiMode,
        worldId: s.selectedWorld,
        personalInfo: s.personalInfo ?? undefined,
        characterHistory: s.characterHistory || undefined,
        memoryRuntime: memData.memoryRuntime,
        memoryConfig: memData.config,
        vectorMemory: memData.vectorMemory,
      };
    });
  }, []);

  // 引擎
  const engine = useGameEngine(
    apiConfig,
    undefined,
    auxiliaryConfig,
    state.selectedWorld,
    state.personalInfo,
    state.characterHistory,
    handleAutoSave,
  );

  useEffect(() => { engineRef.current = engine; }, [engine]);

  // ─── F5 刷新恢复 ───
  // 加载存档数据到内存，但不自动跳转游戏页面
  // 用户在主页点击"继续游戏"或"读取存档"后才进入游戏
  useEffect(() => {
    let cancelled = false;
    const savedId = localStorage.getItem(ACTIVE_SAVE_KEY);
    if (savedId) {
      loadGameFromDb(savedId).then(save => {
        if (!cancelled && save && save.messages && save.messages.length > 0) {
          useSaveStore.setState({ currentSaveId: savedId, currentSaveName: save.name });
          // 恢复存档中的 API 配置
          if (save.apiConfig) useConfigStore.getState().setApiConfig(save.apiConfig);
          if (save.apiMode) useConfigStore.getState().setApiMode(save.apiMode);
          dispatch({ type: 'LOAD_SAVE', save });
          engine.loadSave(save);
          // 不再自动跳转，留在 start 页面
        } else if (!cancelled) {
          localStorage.removeItem(ACTIVE_SAVE_KEY);
          useSaveStore.setState({ currentSaveId: undefined, currentSaveName: undefined });
        }
      }).catch(err => {
        console.warn('[auto-restore] 加载存档失败:', err);
        if (!cancelled) {
          localStorage.removeItem(ACTIVE_SAVE_KEY);
          useSaveStore.setState({ currentSaveId: undefined, currentSaveName: undefined });
        }
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 初始化 saveStore
  useEffect(() => {
    useSaveStore.getState().initialize();
  }, []);

  // 开发环境暴露（调试用）
  useEffect(() => {
    (window as any).__engine = engine;
    return () => { delete (window as any).__engine; };
  }, [engine]);

  return (
    <GameContext.Provider value={{ state, dispatch, navigate, goBack, engine }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
