import { useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useUISettings } from '../../context/UISettingsContext';
import { useDialog } from '../shared/Dialog';
import { useSaveStore } from '../../stores/saveStore';
import { useConfigStore } from '../../stores/configStore';
import { useWizard } from '../../hooks/useWizard';
import { useAiFill } from '../../hooks/useAiFill';
import { useCharacterHistory } from '../../hooks/useCharacterHistory';
import type { GameSave, PlayerProfile } from '../../storage/db';
import { saveGame as saveGameToDb } from '../../storage/db';
import type { GameState } from '../../schema/variables';
import { createDefaultGameState } from '../../schema/variables';
import { v4 as uuid } from 'uuid';

export function useStartScreen() {
  const { navigate, state, dispatch, engine } = useGame();
  const savesMeta = useSaveStore(s => s.savesMeta);
  const currentSaveId = useSaveStore(s => s.currentSaveId);
  const createNewGame = useSaveStore(s => s.createNewGame);
  const loadSaveFromStore = useSaveStore(s => s.loadSave);
  const deleteSaveFromStore = useSaveStore(s => s.deleteSave);
  const renameSaveFromStore = useSaveStore(s => s.renameSave);
  const importSaveToStore = useSaveStore(s => s.importSave);
  const exportSaveFromStore = useSaveStore(s => s.exportSave);
  const apiConfig = useConfigStore(s => s.apiConfig);
  const apiMode = useConfigStore(s => s.apiMode);
  const setApiConfig = useConfigStore(s => s.setApiConfig);
  const setApiModeCfg = useConfigStore(s => s.setApiMode);
  const { t, settings } = useUISettings();
  const { DialogUI, confirm, alert: showAlert } = useDialog();
  const locale = settings.language === 'en' ? 'en-US' : 'zh-CN';

  // ─── 向导 ───
  const wizard = useWizard({
    initialWorld: state.selectedWorld,
    initialPersonalInfo: state.personalInfo,
  });

  // ─── AI 补全 ───
  const aiFill = useAiFill({
    apiConfig,
    personalInfo: wizard.personalInfo,
    selectedWorld: wizard.selectedWorld,
    allWorlds: wizard.allWorlds,
    worldEntry: wizard.worldEntry,
    setPersonalInfo: wizard.setPersonalInfo,
    navigate, showAlert,
  });

  // ─── 人物经历 ───
  const charHistory = useCharacterHistory({
    apiConfig,
    personalInfo: wizard.personalInfo,
    selectedWorld: wizard.selectedWorld,
    allWorlds: wizard.allWorlds,
    worldEntry: wizard.worldEntry,
    initialCharacterHistory: state.characterHistory,
    navigate, showAlert,
  });

  // 清理
  useEffect(() => () => { aiFill.cleanup(); charHistory.cleanup(); }, []);

  // ─── 构建初始 GameState ───
  const buildInitialState = (): GameState => {
    const gs = createDefaultGameState();
    const pi = wizard.personalInfo;
    gs.玩家.姓名 = pi.name;
    gs.玩家.性别 = pi.gender;
    gs.玩家.年龄 = pi.age;
    gs.玩家.身份信息.背景信息 = pi.background;
    gs.玩家.身份信息.职业 = pi.career || '';
    gs.玩家.身份信息.阶层 = pi.socialClass || '';
    gs.玩家.身份信息.所属组织 = pi.organization || '';
    gs.玩家.身份信息.特殊身份 = pi.specialIdentity || '';
    if (pi.initialSkills) gs.玩家.技能系统 = { ...gs.玩家.技能系统, ...pi.initialSkills };
    if (pi.initialItems) {
      for (const [k, v] of Object.entries(pi.initialItems)) {
        gs.玩家.物品栏[k] = { ...v, 有效期: '', 特殊属性: '' };
      }
    }
    for (const npc of pi.customNpcs) {
      const npcId = `NPC_${npc.name}`;
      gs.人物档案[npcId] = {
        姓名: npc.name, 种族: npc.race || '人类', 性别: npc.gender || '', 年龄: npc.age || '',
        背景: npc.background || '',
        生存状态: { 血量: 100, 体力值: 100 },
        社会身份: {
          职业: npc.occupation || '',
          所属势力: npc.faction || '',
          社会地位: npc.socialStatus || '',
        },
        关系数据: { 好感度: 50, 信任度: 50, 关系类型: npc.relationshipType || '同伴', 印象标签: [], 核心锚点: [] },
        个人信息: {
          价值观: {
            喜好: npc.likes ? npc.likes.split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [],
            厌恶: npc.dislikes ? npc.dislikes.split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [],
            雷区: '',
          },
          执念与目标: npc.longTermGoal || '',
          心理创伤: npc.psychologicalTrauma || '',
          外貌: npc.appearance || '',
          表性格: npc.personality || '',
          里性格: npc.hiddenPersonality || '',
          当前想法: npc.currentThought || '',
          特殊能力: npc.specialAbility || '',
          当前穿着: npc.currentOutfit || '',
          当前位置: '', 当前状态: '',
          持有物品: '', 过往经历: [], 备注: '',
        },
        交互记忆: { 未完成约定: [], 共同秘密: [], 赠礼记录: [] },
        重要NPC: true, _关注: true, 婚姻状态: '', 联系方式: '',
        近期事件: [], 重要经历: [], $time: Date.now(), 人物分类: '在场',
        短期目标: npc.shortTermGoal || '',
        长期目标: npc.longTermGoal || '',
      };
    }
    return gs;
  };

  // ─── 开始游戏 ───
  const handleStartGame = async () => {
    const characterHistory = charHistory.buildFullCharacterHistory();
    // 获取世界名（中文）
    const world = wizard.allWorlds.find((w: any) => w.id === wizard.selectedWorld);
    const worldName = world?.name || '默认世界';
    const characterName = wizard.personalInfo.name || '未命名';
    const saveName = `${characterName} - ${worldName}`;

    dispatch({ type: 'SET_WORLD', worldId: wizard.selectedWorld });
    dispatch({ type: 'SET_PERSONAL_INFO', info: wizard.personalInfo });
    dispatch({ type: 'SET_CHARACTER_HISTORY', history: characterHistory });

    engine.reset();
    engine.setPlayerProfile(wizard.personalInfo);

    if (wizard.personalInfo.customNpcs.length > 0) {
      engine.setInitialNPCs(wizard.personalInfo.customNpcs);
    }

    if (characterHistory.trim()) {
      engine.addMessage({
        id: uuid(), role: 'assistant', content: characterHistory, round: 0, timestamp: Date.now(),
      });
    }

    const saveId = await createNewGame(saveName);

    const save: GameSave = {
      id: saveId, name: saveName, timestamp: Date.now(),
      messages: engine.messages, gameState: engine.variableManager.getState(),
      apiConfig, apiMode: apiMode || 'default',
      worldId: wizard.selectedWorld, personalInfo: wizard.personalInfo, characterHistory,
    };
    await saveGameToDb(save);
    navigate(apiConfig ? 'game' : 'settings');
  };

  // ─── 存档操作 ───
  const handleLoadSave = async (save: GameSave) => {
    const loaded = await loadSaveFromStore(save.id);
    if (loaded) {
      if (loaded.apiConfig) setApiConfig(loaded.apiConfig);
      if (loaded.apiMode) setApiModeCfg(loaded.apiMode);
      dispatch({ type: 'LOAD_SAVE', save: loaded });
      engine.loadSave(loaded);
      navigate('game');
    }
  };

  const handleDeleteSave = async (id: string) => {
    if (!await confirm('确定要删除这个存档吗？此操作不可撤销。', { danger: true, confirmText: '删除' })) return;
    await deleteSaveFromStore(id);
  };

  const handleRenameSave = async (id: string, newName: string) => {
    await renameSaveFromStore(id, newName);
  };

  const handleImportSave = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importSaveToStore(data);
    } catch (err: any) {
      console.error('[导入] 失败:', err);
      await showAlert(`导入失败: ${err.message}`, { title: '导入失败', danger: true });
    }
  };

  const handleExportSave = async (saveId: string) => {
    try {
      const blob = await exportSaveFromStore(saveId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chuanyue-save-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('[导出] 失败:', err);
      await showAlert(`导出失败: ${err.message}`, { title: '导出失败', danger: true });
    }
  };

  return {
    // context
    navigate, state, t, settings, locale, engine, dispatch,
    // config
    apiConfig, apiMode,
    // dialog
    DialogUI,
    // wizard
    view: wizard.view, setView: wizard.setView,
    step: wizard.step, setStep: wizard.setStep,
    selectedWorld: wizard.selectedWorld, setSelectedWorld: wizard.setSelectedWorld,
    worldEntry: wizard.worldEntry,
    personalInfo: wizard.personalInfo, setPersonalInfo: wizard.setPersonalInfo,
    allWorlds: wizard.allWorlds, createdWorlds: wizard.createdWorlds,
    worldEditorOpen: wizard.worldEditorOpen, setWorldEditorOpen: wizard.setWorldEditorOpen,
    editingWorld: wizard.editingWorld, setEditingWorld: wizard.setEditingWorld,
    handleSaveWorld: wizard.handleSaveWorld,
    handleDeleteWorld: wizard.handleDeleteWorld,
    handleCancelWorldEditor: wizard.handleCancelWorldEditor,
    // ai fill
    isFilling: aiFill.isFilling, handleAiFill: aiFill.handleAiFill,
    // character history
    segments: charHistory.segments, setSegments: charHistory.setSegments,
    isGenerating: charHistory.isGenerating, regeneratingId: charHistory.regeneratingId,
    handleGenerateAll: charHistory.handleGenerateAll,
    handleRegenerateSegment: charHistory.handleRegenerateSegment,
    buildInitialState,
    // handlers
    handleStartGame, handleLoadSave, handleDeleteSave,
    handleRenameSave, handleImportSave, handleExportSave,
    // saves
    allSaves: savesMeta, currentSaveId,
  };
}
