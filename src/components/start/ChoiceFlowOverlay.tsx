// 选择式世界创建 — 覆盖式UI组件（2次调用版本）
// 第1次：生成所有维度选项 → 用户逐个选择
// 第2次：根据选择生成完整世界
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ChevronLeft, ChevronRight, SkipForward, Check,
  Loader, Map, Flag, BookMarked, DollarSign,
  User, Swords, ScrollText, Globe,
} from 'lucide-react';
import type { WorldDef, WorldBookEntryDef, WorldModule } from '../../data/worlds-schema';
import type { DimensionGeneration, DimensionSelection } from '../../worldgen/choice';
import { DIMENSIONS, generateAllOptions, generateWorldFromSelections, generateModuleEntries } from '../../worldgen/choice';
import { requestStreamWithRetry } from '../../api/client';

// ── 维度图标映射 ──
const DIMENSION_ICONS: Record<string, typeof Globe> = {
  worldType: Globe,
  tone: ScrollText,
  geography: Map,
  factions: Flag,
  culture: BookMarked,
  economy: DollarSign,
  npcs: User,
  rules: Swords,
};

interface ChoiceFlowOverlayProps {
  visible: boolean;
  userDesc: string;
  selectedModules: string[];
  apiConfig: any;
  onComplete: (worldDef: Partial<WorldDef>, worldBookEntries: WorldBookEntryDef[]) => void;
  onClose: () => void;
}

export default function ChoiceFlowOverlay({
  visible,
  userDesc,
  selectedModules,
  apiConfig,
  onComplete,
  onClose,
}: ChoiceFlowOverlayProps) {
  // ── 整体阶段：'loading_options' | 'selecting' | 'generating_world' | 'done' ──
  const [phase, setPhase] = useState<'loading_options' | 'selecting' | 'generating_world'>('loading_options');
  const [allOptions, setAllOptions] = useState<Record<string, DimensionGeneration> | null>(null);
  const [error, setError] = useState('');

  // ── 维度选择状态 ──
  const [currentDimIndex, setCurrentDimIndex] = useState(0);
  const [selections, setSelections] = useState<DimensionSelection[]>([]);

  // ── 自定义选项编辑状态 ──
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const currentDim = DIMENSIONS[currentDimIndex];
  const isLastDimension = currentDimIndex === DIMENSIONS.length - 1;
  const currentSelection = selections.find(s => s.dimensionKey === currentDim?.key);
  const currentGeneration = currentDim ? allOptions?.[currentDim.key] : undefined;

  // ── 创建 callAI ──
  const createCallAI = useCallback(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    return async (messages: Array<{ role: string; content: string }>): Promise<string> => {
      const result = await requestStreamWithRetry(apiConfig, messages as any, { signal: ctrl.signal, onDelta: () => {} });
      return result.text;
    };
  }, [apiConfig]);

  // ── 第1次调用：生成所有选项 ──
  useEffect(() => {
    if (!visible || allOptions) return;
    let cancelled = false;

    const load = async () => {
      setPhase('loading_options');
      setError('');
      try {
        const callAI = createCallAI();
        const options = await generateAllOptions(userDesc, callAI);
        if (!cancelled) {
          setAllOptions(options);
          setPhase('selecting');
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error && err.name === 'AbortError') return;
          setError(`生成选项失败：${err instanceof Error ? err.message : '未知错误'}`);
        }
      }
    };
    load();

    return () => { cancelled = true; };
  }, [visible, userDesc, createCallAI, allOptions]);

  // ── 选择选项 ──
  const handleSelect = (choiceId: string) => {
    if (!currentDim || !currentGeneration) return;

    // 点击自定义选项 E
    if (choiceId === 'E') {
      setIsEditingCustom(true);
      const existingCustom = selections.find(s => s.dimensionKey === currentDim.key && s.choiceId === 'E');
      if (existingCustom) {
        setCustomTitle(existingCustom.choice.title);
        setCustomSubtitle(existingCustom.choice.subtitle);
      } else {
        setCustomTitle('');
        setCustomSubtitle('');
      }
      return;
    }

    const choice = currentGeneration.choices.find(c => c.id === choiceId);
    if (!choice) return;

    setIsEditingCustom(false);

    const newSelection: DimensionSelection = {
      dimensionKey: currentDim.key,
      dimensionLabel: currentDim.label,
      choiceId,
      choice,
    };

    setSelections(prev => {
      const filtered = prev.filter(s => s.dimensionKey !== currentDim.key);
      return [...filtered, newSelection];
    });
  };

  // ── 保存自定义选项 ──
  const handleSaveCustom = () => {
    if (!currentDim || !customTitle.trim()) return;

    const newSelection: DimensionSelection = {
      dimensionKey: currentDim.key,
      dimensionLabel: currentDim.label,
      choiceId: 'E',
      choice: {
        id: 'E',
        title: customTitle.trim(),
        subtitle: customSubtitle.trim(),
        isCustom: true,
      },
    };

    setSelections(prev => {
      const filtered = prev.filter(s => s.dimensionKey !== currentDim.key);
      return [...filtered, newSelection];
    });

    setIsEditingCustom(false);
  };

  // ── AI 补全 ──
  const handleAIComplete = async () => {
    if (!currentDim || !customTitle.trim()) return;

    setIsCompleting(true);
    try {
      const callAI = createCallAI();
      const prompt = `你是一个世界构建专家。用户正在创建一个世界："${userDesc}"

当前正在设定【${currentDim.label}】维度。

用户输入了以下内容：
- 标题：${customTitle.trim()}
${customSubtitle.trim() ? `- 描述：${customSubtitle.trim()}` : ''}

请根据用户输入的内容，生成一个完整、丰富的【${currentDim.label}】设定。

要求：
- 标题保持在 2-8 个字
- 描述保持在 20-50 个字
- 描述要具体、生动，能让人产生画面感
- 与用户的世界描述"${userDesc}"相匹配

请严格按以下JSON格式返回，不要有任何其他文字：
{
  "title": "生成的标题",
  "subtitle": "生成的描述"
}`;

      const raw = await callAI([{ role: 'user', content: prompt }]);
      const data = JSON.parse(extractJSON(raw));

      if (data.title) setCustomTitle(data.title);
      if (data.subtitle) setCustomSubtitle(data.subtitle);
    } catch (err) {
      console.warn('[AI补全] 失败:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  // ── 下一步 ──
  const handleNext = () => {
    if (!currentSelection) return;
    if (isLastDimension) {
      handleComplete();
    } else {
      setCurrentDimIndex(prev => prev + 1);
    }
  };

  // ── 上一步 ──
  const handlePrev = () => {
    if (currentDimIndex > 0) {
      setCurrentDimIndex(prev => prev - 1);
    }
  };

  // ── 跳过（非必选维度）──
  const handleSkip = () => {
    if (currentDim?.required) return;
    if (isLastDimension) {
      handleComplete();
    } else {
      setCurrentDimIndex(prev => prev + 1);
    }
  };

  // ── 完成：第2次调用生成完整世界 ──
  const handleComplete = async () => {
    setPhase('generating_world');
    setError('');
    try {
      const callAI = createCallAI();

      // 第2次调用：根据选择生成完整世界
      const { worldDef, worldBookEntries } = await generateWorldFromSelections(
        userDesc,
        selections,
        callAI,
      );

      // 模块数据（如果有）
      let modules: WorldModule[] = [];
      let moduleWorldBookEntries: WorldBookEntryDef[] = [];
      if (selectedModules.length > 0) {
        const result = await generateModuleEntries(
          worldDef.description || userDesc,
          selectedModules,
          callAI,
        );
        modules = result.modules;
        moduleWorldBookEntries = result.worldBookEntries;
      }

      const finalEntries = [...worldBookEntries, ...moduleWorldBookEntries];
      onComplete({ ...worldDef, modules: modules.length > 0 ? modules : undefined }, finalEntries);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(`生成世界失败：${err instanceof Error ? err.message : '未知错误'}`);
      setPhase('selecting'); // 回到选择阶段让用户重试
    }
  };

  // ── 关闭时清理 ──
  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  if (!visible) return null;

  // ── 加载选项阶段 ──
  if (phase === 'loading_options') {
    return (
      <div className="choice-flow-overlay">
        <div className="choice-flow-bg" />
        <div className="choice-flow-content">
          <button className="choice-flow-close" onClick={handleClose}>
            <X size={20} />
          </button>
          <div className="choice-flow-header">
            <div className="choice-flow-badge">世界构建</div>
            <h2 className="choice-flow-title">正在分析你的世界...</h2>
            <p className="choice-flow-subtitle">{userDesc}</p>
          </div>
          <div className="choice-flow-loading">
            <Loader size={32} className="animate-spin" />
            <p>AI 正在为你生成世界选项...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── 生成最终世界阶段 ──
  if (phase === 'generating_world') {
    return (
      <div className="choice-flow-overlay">
        <div className="choice-flow-bg" />
        <div className="choice-flow-content">
          <button className="choice-flow-close" onClick={handleClose}>
            <X size={20} />
          </button>
          <div className="choice-flow-header">
            <div className="choice-flow-badge">世界构建</div>
            <h2 className="choice-flow-title">正在生成你的世界...</h2>
            <p className="choice-flow-subtitle">
              已选择 {selections.length} 个维度，AI 正在根据你的选择构建完整世界
            </p>
          </div>
          <div className="choice-flow-loading">
            <Loader size={32} className="animate-spin" />
            <p>正在生成世界名称、设定、势力、NPC...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── 维度选择阶段 ──
  const progressPercent = ((currentDimIndex) / DIMENSIONS.length) * 100;

  return (
    <div className="choice-flow-overlay">
      <div className="choice-flow-bg" />
      <div className="choice-flow-content">
        <button className="choice-flow-close" onClick={handleClose}>
          <X size={20} />
        </button>

        <div className="choice-flow-header">
          <div className="choice-flow-badge">世界构建</div>
          <h2 className="choice-flow-title">选择你的世界</h2>
          <p className="choice-flow-subtitle">{userDesc}</p>
        </div>

        {/* 进度条 */}
        <div className="choice-flow-progress">
          {DIMENSIONS.map((dim, i) => {
            const Icon = DIMENSION_ICONS[dim.key] || Globe;
            const isActive = i === currentDimIndex;
            const isDone = selections.some(s => s.dimensionKey === dim.key);
            const isSkipped = i < currentDimIndex && !isDone;
            return (
              <div
                key={dim.key}
                className={`progress-node ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isSkipped ? 'skipped' : ''}`}
              >
                <div className="progress-dot">
                  {isDone ? <Check size={12} /> : isSkipped ? <SkipForward size={10} /> : <Icon size={12} />}
                </div>
                <span className="progress-label">{dim.label}</span>
              </div>
            );
          })}
          <div className="progress-line">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="choice-flow-error">
            <p>{error}</p>
            <button className="btn-primary" onClick={() => { setError(''); setPhase('loading_options'); setAllOptions(null); }}>重试</button>
          </div>
        )}

        {/* 当前维度内容 */}
        {!error && currentGeneration && (
          <>
            <div className="choice-flow-narrative">
              {currentGeneration.narrative}
            </div>
            <div className="choice-flow-options">
              {currentGeneration.choices.map((choice) => (
                <button
                  key={choice.id}
                  className={`choice-card ${currentSelection?.choiceId === choice.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(choice.id)}
                >
                  <div className="choice-card-id">{choice.id}</div>
                  <div className="choice-card-title">{choice.title}</div>
                  <div className="choice-card-subtitle">{choice.subtitle}</div>
                </button>
              ))}

              {/* E 卡片：自定义选项 */}
              {(() => {
                const isCustomSelected = currentSelection?.choiceId === 'E';
                const customSelection = selections.find(s => s.dimensionKey === currentDim?.key && s.choiceId === 'E');
                const displayTitle = customSelection?.choice.title || '自定义';
                const displaySubtitle = customSelection?.choice.subtitle || '自己填写内容';

                return (
                  <button
                    className={`choice-card ${isCustomSelected ? 'selected' : ''} ${isEditingCustom ? 'editing' : ''}`}
                    onClick={() => handleSelect('E')}
                  >
                    <div className="choice-card-id">E</div>
                    <div className="choice-card-title">{displayTitle}</div>
                    <div className="choice-card-subtitle">{displaySubtitle}</div>
                  </button>
                );
              })()}
            </div>

            {/* 自定义编辑区域 */}
            {isEditingCustom && (
              <div className="choice-flow-custom-edit">
                <div className="custom-edit-title">自定义【{currentDim.label}】</div>

                <div className="custom-edit-field">
                  <label>标题（2-8字）</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    placeholder={`例如：${currentGeneration.choices[0]?.title || '输入标题'}`}
                    maxLength={20}
                  />
                </div>

                <div className="custom-edit-field">
                  <label>描述（20-50字）</label>
                  <textarea
                    value={customSubtitle}
                    onChange={e => setCustomSubtitle(e.target.value)}
                    placeholder={`例如：${currentGeneration.choices[0]?.subtitle || '输入描述'}`}
                    rows={3}
                    maxLength={200}
                  />
                </div>

                <div className="custom-edit-actions">
                  <button className="btn-ghost" onClick={() => setIsEditingCustom(false)}>取消</button>
                  <button
                    className="btn-ghost"
                    onClick={handleAIComplete}
                    disabled={!customTitle.trim() || isCompleting}
                  >
                    {isCompleting ? '补全中...' : 'AI 补全'}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSaveCustom}
                    disabled={!customTitle.trim()}
                  >
                    保存并选中
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* 底部操作栏 */}
        <div className="choice-flow-actions">
          <button
            className="btn-ghost"
            onClick={handlePrev}
            disabled={currentDimIndex === 0}
          >
            <ChevronLeft size={16} /> 上一步
          </button>

          <div className="choice-flow-middle-actions">
            {!currentDim?.required && (
              <button className="btn-ghost" onClick={handleSkip}>
                <SkipForward size={14} /> 跳过
              </button>
            )}
          </div>

          <button
            className="btn-primary"
            onClick={handleNext}
            disabled={!currentSelection && currentDim?.required}
          >
            {isLastDimension ? '完成' : '下一步'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 提取 JSON */
function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}
