// ============================================================
//  融合式世界创建 — 引导风格选择覆盖层
//  UI 复用引导创建的布局（步骤指示器、卡片网格、底部导航）
//  数据来自 AI 动态生成（复用 choice pipeline 的 generateAllOptions）
//  最终调用增强版生成函数，产出丰富粒度的 WorldBookEntryDef[]
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X, ChevronLeft, ChevronRight, SkipForward, Check, Loader,
  Globe, ScrollText, Swords, Map, Flag, BookMarked, DollarSign, User,
  type LucideIcon,
} from 'lucide-react';
import type { WorldDef, WorldBookEntryDef, WorldModule } from '../../data/worlds-schema';
import type { DimensionChoice, DimensionGeneration, DimensionSelection } from '../../worldgen/choice';
import { generateWorldFromSelections, generateModuleEntries } from '../../worldgen/choice';
import { requestStreamWithRetry } from '../../api/client';

// ── 维度配置（8 步，比原 ChoiceFlowOverlay 多 worldType） ──
interface GuidedDimConfig {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  required: boolean;
  color: string;
  multiSelect?: boolean;  // 是否支持多选
  maxSelect?: number;     // 多选时最大选择数量
}

const GUIDED_DIMENSIONS: GuidedDimConfig[] = [
  { key: 'worldType', label: '世界类型', description: '选择一个世界类型，决定整体框架', icon: Globe, required: true, color: '#6366f1' },
  { key: 'tone',      label: '叙事基调', description: '基调决定了 AI 叙述故事时的风格和氛围', icon: ScrollText, required: true, color: '#f59e0b' },
  { key: 'conflict',  label: '核心冲突', description: '核心冲突是驱动故事前进的引擎', icon: Swords, required: true, color: '#ef4444' },
  { key: 'geography', label: '地理格局', description: '世界的地理分布和区域特征', icon: Map, required: true, color: '#10b981', multiSelect: true, maxSelect: 3 },
  { key: 'factions',  label: '势力结构', description: '各方势力的关系和格局', icon: Flag, required: true, color: '#8b5cf6', multiSelect: true, maxSelect: 3 },
  { key: 'npcs',      label: '关键人物', description: '这个世界中的重要角色', icon: User, required: true, color: '#ec4899', multiSelect: true, maxSelect: 3 },
  { key: 'culture',   label: '文化风俗', description: '信仰、习俗、日常生活', icon: BookMarked, required: false, color: '#14b8a6', multiSelect: true, maxSelect: 2 },
  { key: 'rules',     label: '世界规则', description: '力量体系、社会结构、特殊规则', icon: ScrollText, required: true, color: '#f97316' },
];

// ── 维度提示（用于 generateAllOptions 的增强 prompt） ──
const DIMENSION_HINTS: Record<string, string> = {
  worldType: '根据用户描述生成4个不同世界类型变体（如用户描述修仙，可生成"古典仙侠"、"都市修仙"、"末法仙途"等）',
  tone: '不同风格基调，如"严肃古典"、"轻松日常"、"黑暗残酷"、"史诗壮阔"',
  conflict: '不同核心冲突，如"正邪对立"、"生存危机"、"权力争夺"、"身份探索"',
  geography: '不同地理格局，如"五大陆分布"、"群岛散布"、"一超多强"、"层叠世界"',
  factions: '不同势力结构，如"正邪对立"、"群雄割据"、"暗流涌动"、"表面和平"',
  npcs: '不同关键人物组合，如"正道领袖"、"亦正亦邪"、"底层群像"、"权贵阶层"',
  culture: '不同文化特征，如"宗门制度"、"城邦联盟"、"部落传统"、"科技文明"',
  rules: '不同规则体系，如"修仙九境"、"科技等级"、"血脉觉醒"、"契约系统"',
};

interface GuidedChoiceOverlayProps {
  visible: boolean;
  userDesc: string;
  selectedModules: string[];
  apiConfig: any;
  onComplete: (worldDef: WorldDef) => void;
  onClose: () => void;
}

export default function GuidedChoiceOverlay({
  visible,
  userDesc,
  selectedModules,
  apiConfig,
  onComplete,
  onClose,
}: GuidedChoiceOverlayProps) {
  // ── 整体阶段 ──
  const [phase, setPhase] = useState<'loading' | 'selecting' | 'generating'>('loading');
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

  const currentDim = GUIDED_DIMENSIONS[currentDimIndex];
  const isLastDimension = currentDimIndex === GUIDED_DIMENSIONS.length - 1;
  const currentSelection = selections.find(s => s.dimensionKey === currentDim?.key);
  const currentGeneration = currentDim ? allOptions?.[currentDim.key] : undefined;

  // ── 创建 callAI ──
  const createCallAI = useCallback(() => {
    // 中止之前的请求，防止泄漏
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    return async (messages: Array<{ role: string; content: string }>): Promise<string> => {
      const result = await requestStreamWithRetry(apiConfig, messages as any, {
        signal: ctrl.signal,
        onDelta: () => {},
      });
      return result.text;
    };
  }, [apiConfig]);

  // ── 第1次调用：生成所有选项 ──
  useEffect(() => {
    if (!visible || allOptions) return;
    let cancelled = false;

    const load = async () => {
      setPhase('loading');
      setError('');
      try {
        const callAI = createCallAI();
        // 使用增强版 prompt，包含 worldType 和 conflict 维度
        const options = await generateGuidedOptions(userDesc, callAI);
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
      // 如果之前有自定义选择，恢复内容（支持多选模式下的 choiceId 逗号拼接）
      const existingCustom = selections.find(s =>
        s.dimensionKey === currentDim.key && (
          s.choiceId === 'E' || s.choiceIds?.split(',').includes('E')
        )
      );
      if (existingCustom) {
        // 优先从 choices 数组中找自定义选项
        const customChoice = existingCustom.choices?.find(c => c.id === 'E');
        setCustomTitle(customChoice?.title || existingCustom.choice.title);
        setCustomSubtitle(customChoice?.subtitle || existingCustom.choice.subtitle);
      } else {
        setCustomTitle('');
        setCustomSubtitle('');
      }
      return;
    }

    const choice = currentGeneration.choices.find(c => c.id === choiceId);
    if (!choice) return;

    // 点击其他选项时退出自定义编辑
    setIsEditingCustom(false);

    // 多选模式 - 把所有逻辑移到 updater 内部，避免 stale closure
    if (currentDim.multiSelect) {
      const maxSelect = currentDim.maxSelect || 3;
      setSelections(prev => {
        const existingSelection = prev.find(s => s.dimensionKey === currentDim.key);

        if (existingSelection && existingSelection.choices) {
          // 已有选择，检查是否已选中
          const isSelected = existingSelection.choices.some(c => c.id === choiceId);

          let newChoices: DimensionChoice[];
          if (isSelected) {
            // 取消选中
            newChoices = existingSelection.choices.filter(c => c.id !== choiceId);
          } else {
            // 添加选中（检查上限）
            if (existingSelection.choices.length >= maxSelect) return prev;
            newChoices = [...existingSelection.choices, choice];
          }

          if (newChoices.length === 0) {
            // 取消所有选择
            return prev.filter(s => s.dimensionKey !== currentDim.key);
          }

          // 更新选择
          const newSelection: DimensionSelection = {
            dimensionKey: currentDim.key,
            dimensionLabel: currentDim.label,
            choiceId: newChoices.map(c => c.id).join(','),
            choice: newChoices[0], // 主选择
            choiceIds: newChoices.map(c => c.id).join(','),
            choices: newChoices,
          };
          const filtered = prev.filter(s => s.dimensionKey !== currentDim.key);
          return [...filtered, newSelection];
        } else {
          // 新选择
          const newSelection: DimensionSelection = {
            dimensionKey: currentDim.key,
            dimensionLabel: currentDim.label,
            choiceId,
            choice,
            choiceIds: choiceId,
            choices: [choice],
          };
          const filtered = prev.filter(s => s.dimensionKey !== currentDim.key);
          return [...filtered, newSelection];
        }
      });
    } else {
      // 单选模式
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
    }
  };

  // ── 保存自定义选项 ──
  const handleSaveCustom = () => {
    if (!currentDim || !customTitle.trim()) return;

    const customChoice: DimensionChoice = {
      id: 'E',
      title: customTitle.trim(),
      subtitle: customSubtitle.trim(),
      isCustom: true,
    };

    // 多选模式 - 追加到现有选择
    if (currentDim.multiSelect) {
      setSelections(prev => {
        const existingSelection = prev.find(s => s.dimensionKey === currentDim.key);
        const existingChoices = existingSelection?.choices || [];

        // 检查是否已包含自定义选项
        const hasCustom = existingChoices.some(c => c.id === 'E');
        const newChoices = hasCustom
          ? existingChoices.map(c => c.id === 'E' ? customChoice : c) // 更新已有自定义选项
          : [...existingChoices, customChoice]; // 追加新自定义选项

        const newSelection: DimensionSelection = {
          dimensionKey: currentDim.key,
          dimensionLabel: currentDim.label,
          choiceId: newChoices.map(c => c.id).join(','),
          choice: newChoices[0],
          choiceIds: newChoices.map(c => c.id).join(','),
          choices: newChoices,
        };

        const filtered = prev.filter(s => s.dimensionKey !== currentDim.key);
        return [...filtered, newSelection];
      });
    } else {
      // 单选模式
      const newSelection: DimensionSelection = {
        dimensionKey: currentDim.key,
        dimensionLabel: currentDim.label,
        choiceId: 'E',
        choice: customChoice,
      };

      setSelections(prev => {
        const filtered = prev.filter(s => s.dimensionKey !== currentDim.key);
        return [...filtered, newSelection];
      });
    }

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
      // 补全失败不阻断流程，用户仍可手动输入
    } finally {
      setIsCompleting(false);
    }
  };

  // ── 导航 ──
  const canProceed = !!currentSelection || !currentDim?.required;

  const handleNext = () => {
    if (!canProceed) return;
    if (isLastDimension) {
      handleComplete();
    } else {
      setCurrentDimIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentDimIndex > 0) {
      setCurrentDimIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (currentDim?.required) return;
    if (isLastDimension) {
      handleComplete();
    } else {
      setCurrentDimIndex(prev => prev + 1);
    }
  };

  // ── 完成：调用增强版生成 ──
  const handleComplete = async () => {
    setPhase('generating');
    setError('');
    try {
      const callAI = createCallAI();

      // 生成世界
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

      // 组装 WorldDef
      const completeWorldDef: WorldDef = {
        id: `custom_${Date.now()}`,
        name: worldDef.name || '未命名世界',
        description: worldDef.description || '',
        icon: worldDef.icon || 'Globe',
        tags: worldDef.tags || [],
        difficulty: worldDef.difficulty || 'medium',
        entryId: null,
        modules: modules.length > 0 ? modules : undefined,
        worldBookEntries: finalEntries,
      };

      onComplete(completeWorldDef);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(`生成世界失败：${err instanceof Error ? err.message : '未知错误'}`);
      setPhase('selecting');
    }
  };

  // ── 关闭时清理 ──
  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  // ── 重试 ──
  const handleRetry = () => {
    setError('');
    setAllOptions(null);
    setPhase('loading');
  };

  if (!visible) return null;

  // ══════════════════════════════════════════════════
  //  渲染：加载阶段
  // ══════════════════════════════════════════════════
  if (phase === 'loading') {
    return (
      <div style={overlayStyle}>
        <div style={headerBarStyle}>
          <button onClick={handleClose} style={closeBtnStyle}><X size={16} /></button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={titleStyle}>AI 正在分析你的世界...</h1>
            <p style={subtitleStyle}>{userDesc}</p>
          </div>
        </div>
        <div style={centerContentStyle}>
          <div style={spinnerStyle} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
            正在为你生成世界选项...
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  //  渲染：生成阶段
  // ══════════════════════════════════════════════════
  if (phase === 'generating') {
    return (
      <div style={overlayStyle}>
        <div style={headerBarStyle}>
          <button onClick={handleClose} style={closeBtnStyle}><X size={16} /></button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={titleStyle}>正在生成你的世界...</h1>
            <p style={subtitleStyle}>
              已选择 {selections.length} 个维度，AI 正在根据你的选择构建完整世界
            </p>
          </div>
        </div>
        <div style={centerContentStyle}>
          <div style={spinnerStyle} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
            正在生成世界名称、设定、势力、NPC...
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  //  渲染：选择阶段（主体 UI）
  // ══════════════════════════════════════════════════
  return (
    <div style={overlayStyle}>
      {/* ── 顶部标题栏 ── */}
      <div style={headerBarStyle}>
        <button onClick={handleClose} style={closeBtnStyle}><X size={16} /></button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={titleStyle}>选择你的世界</h1>
          <p style={subtitleStyle}>{userDesc}</p>
        </div>
      </div>

      {/* ── 步骤指示器 ── */}
      <div style={stepIndicatorStyle}>
        {GUIDED_DIMENSIONS.map((dim, i) => {
          const Icon = dim.icon;
          const isActive = i === currentDimIndex;
          const isCompleted = selections.some(s => s.dimensionKey === dim.key);
          const isSkipped = i < currentDimIndex && !isCompleted;
          return (
            <div key={dim.key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '20px',
                  background: isActive ? dim.color : isCompleted ? `${dim.color}25` : 'transparent',
                  color: isActive ? '#fff' : isCompleted ? dim.color : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s ease',
                  cursor: isCompleted ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (isCompleted || i < currentDimIndex) setCurrentDimIndex(i);
                }}
              >
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: isActive ? 'rgba(255,255,255,0.3)' : isCompleted ? dim.color : 'var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    color: isCompleted ? '#fff' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  {isCompleted ? '✓' : isSkipped ? '–' : i + 1}
                </span>
                <span className="guide-step-label">{dim.label}</span>
              </div>
              {i < GUIDED_DIMENSIONS.length - 1 && (
                <div
                  style={{
                    width: '16px',
                    height: '1px',
                    background: isCompleted ? dim.color : 'var(--border)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── 主内容区域 ── */}
      <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem 1.5rem 0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '1rem' }}>
          {/* 错误提示 */}
          {error && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
              <button onClick={handleRetry} style={primaryBtnStyle}>重试</button>
            </div>
          )}

          {/* 维度叙事描述 */}
          {!error && currentGeneration?.narrative && (
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', animation: 'slideUp 0.3s ease' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto' }}>
                {currentGeneration.narrative}
              </p>
            </div>
          )}

          {/* 维度标题 */}
          {!error && currentDim && (
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', animation: 'slideUp 0.3s ease' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
                {getDimensionQuestion(currentDim.key)}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.4rem' }}>
                {currentDim.description}
                {currentDim.multiSelect && (
                  <span style={{ marginLeft: '8px', color: 'var(--accent)' }}>
                    （可多选，最多{currentDim.maxSelect || 3}个）
                  </span>
                )}
              </p>
            </div>
          )}

          {/* 选项卡片网格 */}
          {!error && currentGeneration && (
            <>
              <div style={cardGridStyle}>
                {currentGeneration.choices.map((choice) => {
                  const isSelected = currentDim.multiSelect
                    ? currentSelection?.choices?.some(c => c.id === choice.id)
                    : currentSelection?.choiceId === choice.id;
                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleSelect(choice.id)}
                      style={{
                        ...cardStyle,
                        border: `2px solid ${isSelected ? currentDim.color : 'var(--border)'}`,
                        background: isSelected ? `${currentDim.color}15` : 'var(--bg-secondary)',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = `${currentDim.color}80`;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 4px 12px ${currentDim.color}20`;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {/* 选项标识 */}
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isSelected ? currentDim.color : `${currentDim.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isSelected ? '#fff' : currentDim.color,
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}
                      >
                        {choice.id}
                      </div>

                      {/* 文字 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {choice.title}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', lineHeight: 1.4 }}>
                          {choice.subtitle}
                        </div>
                      </div>

                      {/* 选中标记 */}
                      {isSelected && (
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: currentDim.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '0.7rem',
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* E 卡片：自定义选项 */}
                {(() => {
                  // 支持多选模式下的选择检查
                  const isCustomSelected = currentDim.multiSelect
                    ? currentSelection?.choices?.some(c => c.id === 'E')
                    : currentSelection?.choiceId === 'E';
                  // 支持多选模式下的自定义选项查找
                  const customSelection = selections.find(s =>
                    s.dimensionKey === currentDim?.key && (
                      s.choiceId === 'E' || s.choiceIds?.split(',').includes('E')
                    )
                  );
                  const customChoice = customSelection?.choices?.find(c => c.id === 'E');
                  const displayTitle = customChoice?.title || customSelection?.choice.title || '自定义';
                  const displaySubtitle = customChoice?.subtitle || customSelection?.choice.subtitle || '自己填写内容';

                  return (
                    <button
                      onClick={() => handleSelect('E')}
                      style={{
                        ...cardStyle,
                        border: `2px solid ${isCustomSelected ? currentDim.color : isEditingCustom ? `${currentDim.color}80` : 'var(--border)'}`,
                        background: isCustomSelected ? `${currentDim.color}15` : isEditingCustom ? `${currentDim.color}08` : 'var(--bg-secondary)',
                      }}
                      onMouseEnter={e => {
                        if (!isCustomSelected) {
                          e.currentTarget.style.borderColor = `${currentDim.color}80`;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 4px 12px ${currentDim.color}20`;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isCustomSelected) {
                          e.currentTarget.style.borderColor = isEditingCustom ? `${currentDim.color}80` : 'var(--border)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {/* 选项标识 */}
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isCustomSelected ? currentDim.color : `${currentDim.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isCustomSelected ? '#fff' : currentDim.color,
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}
                      >
                        E
                      </div>

                      {/* 文字 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {displayTitle}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', lineHeight: 1.4 }}>
                          {displaySubtitle}
                        </div>
                      </div>

                      {/* 选中标记 */}
                      {isCustomSelected && (
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: currentDim.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '0.7rem',
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })()}
              </div>

              {/* 自定义编辑区域 */}
              {isEditingCustom && (
                <div style={customEditAreaStyle}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                    自定义【{currentDim.label}】
                  </div>

                  {/* Title 输入 */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={labelStyle}>标题（2-8字）</label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                      placeholder={`例如：${currentGeneration.choices[0]?.title || '输入标题'}`}
                      style={inputStyle}
                      maxLength={20}
                    />
                  </div>

                  {/* Subtitle 输入 */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>描述（20-50字）</label>
                    <textarea
                      value={customSubtitle}
                      onChange={e => setCustomSubtitle(e.target.value)}
                      placeholder={`例如：${currentGeneration.choices[0]?.subtitle || '输入描述'}`}
                      style={textareaStyle}
                      rows={3}
                      maxLength={200}
                    />
                  </div>

                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setIsEditingCustom(false)}
                      style={secondaryBtnStyle}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAIComplete}
                      disabled={!customTitle.trim() || isCompleting}
                      style={{
                        ...secondaryBtnStyle,
                        opacity: !customTitle.trim() || isCompleting ? 0.5 : 1,
                        cursor: !customTitle.trim() || isCompleting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isCompleting ? (
                        <>
                          <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                          补全中...
                        </>
                      ) : (
                        'AI 补全'
                      )}
                    </button>
                    <button
                      onClick={handleSaveCustom}
                      disabled={!customTitle.trim()}
                      style={{
                        ...primaryBtnStyle,
                        opacity: !customTitle.trim() ? 0.5 : 1,
                        cursor: !customTitle.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      保存并选中
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ── 底部导航栏 ── */}
      <div style={bottomBarStyle}>
        <button
          onClick={handlePrev}
          disabled={currentDimIndex === 0}
          style={{
            ...navBtnStyle,
            opacity: currentDimIndex === 0 ? 0.5 : 1,
            cursor: currentDimIndex === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <ChevronLeft size={16} />
          上一步
        </button>

        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          {currentDimIndex + 1} / {GUIDED_DIMENSIONS.length}
        </span>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {/* 跳过按钮（非必选维度） */}
          {!currentDim?.required && (
            <button onClick={handleSkip} style={skipBtnStyle}>
              <SkipForward size={14} />
              跳过
            </button>
          )}

          {/* 下一步 / 完成 */}
          <button
            onClick={handleNext}
            disabled={!canProceed}
            style={{
              ...primaryBtnStyle,
              opacity: canProceed ? 1 : 0.5,
              cursor: canProceed ? 'pointer' : 'not-allowed',
            }}
          >
            {isLastDimension ? '完成选择' : '下一步'}
            {!isLastDimension && <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 640px) {
          .guide-step-label { display: none; }
        }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════
//  辅助函数
// ══════════════════════════════════════════════════

/** 增强版选项生成（包含 worldType 和 conflict 维度） */
async function generateGuidedOptions(
  userDesc: string,
  callAI: (messages: Array<{ role: string; content: string }>) => Promise<string>,
): Promise<Record<string, DimensionGeneration>> {
  const dimensionList = GUIDED_DIMENSIONS.map(d =>
    `- ${d.label}（${d.key}）：${DIMENSION_HINTS[d.key] || '生成4个有明显差异的选项'}`
  ).join('\n');

  const prompt = `你是一个世界构建专家。用户想要创建一个世界：
"${userDesc}"

请为以下每个维度各生成4个选项。每个选项要有明显差异，并且与用户描述的世界类型相匹配。

维度列表：
${dimensionList}

请严格按以下JSON格式返回，不要有任何其他文字：
{
  "worldType": {
    "narrative": "关于世界类型的2-3句描述",
    "choices": [
      { "id": "A", "title": "类型名", "subtitle": "一句话描述" },
      { "id": "B", "title": "类型名", "subtitle": "一句话描述" },
      { "id": "C", "title": "类型名", "subtitle": "一句话描述" },
      { "id": "D", "title": "类型名", "subtitle": "一句话描述" }
    ]
  },
  "tone": { "narrative": "...", "choices": [...] },
  "conflict": { "narrative": "...", "choices": [...] },
  "geography": { "narrative": "...", "choices": [...] },
  "factions": { "narrative": "...", "choices": [...] },
  "npcs": { "narrative": "...", "choices": [...] },
  "culture": { "narrative": "...", "choices": [...] },
  "rules": { "narrative": "...", "choices": [...] }
}`;

  const raw = await callAI([{ role: 'user', content: prompt }]);
  const data = JSON.parse(extractJSON(raw));

  // 整理为标准格式
  const result: Record<string, DimensionGeneration> = {};
  for (const dim of GUIDED_DIMENSIONS) {
    const dimData = data[dim.key];
    if (dimData && Array.isArray(dimData.choices)) {
      result[dim.key] = {
        narrative: dimData.narrative || '',
        choices: dimData.choices,
      };
    } else {
      result[dim.key] = { narrative: '', choices: [] };
    }
  }
  return result;
}

/** 提取 JSON */
function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : (text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? text.trim());
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}

/** 获取维度的问题文本 */
function getDimensionQuestion(key: string): string {
  const questions: Record<string, string> = {
    worldType: '你想探索什么样的世界？',
    tone: '你想要什么样的故事基调？',
    conflict: '世界的核心矛盾是什么？',
    geography: '世界的地理格局是怎样的？',
    factions: '各方势力如何分布？',
    npcs: '这个世界有哪些关键人物？',
    culture: '这个世界的文化风俗如何？',
    rules: '这个世界的规则体系是什么？',
  };
  return questions[key] || '请选择';
}

// ══════════════════════════════════════════════════
//  样式常量
// ══════════════════════════════════════════════════

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-primary)',
  overflow: 'hidden',
};

const headerBarStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  padding: '1rem 2rem',
  borderBottom: '1px solid var(--border)',
  animation: 'slideUp 0.3s ease',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  left: '1.5rem',
  border: 'none',
  background: 'var(--bg-secondary)',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 'bold',
  color: 'var(--accent)',
  letterSpacing: '0.05em',
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 'var(--font-size-sm)',
  marginTop: '0.2rem',
  margin: 0,
  maxWidth: '400px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const stepIndicatorStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.25rem',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid var(--border)',
  flexWrap: 'wrap',
};

const centerContentStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const spinnerStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  border: '3px solid var(--border)',
  borderTopColor: 'var(--accent)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const cardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '0.75rem',
  maxWidth: '960px',
  margin: '0 auto',
  animation: 'slideUp 0.3s ease',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '1rem',
  borderRadius: '12px',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.2s ease',
  position: 'relative',
  overflow: 'hidden',
};

const bottomBarStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.75rem 1.5rem',
  borderTop: '1px solid var(--border)',
  background: 'var(--bg-primary)',
};

const navBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 500,
};

const skipBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const customEditAreaStyle: React.CSSProperties = {
  maxWidth: '960px',
  margin: '1rem auto 0',
  padding: '1.25rem',
  borderRadius: '12px',
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  animation: 'slideUp 0.3s ease',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: '0.4rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.8rem',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '80px',
  fontFamily: 'inherit',
  lineHeight: 1.5,
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
  cursor: 'pointer',
};
