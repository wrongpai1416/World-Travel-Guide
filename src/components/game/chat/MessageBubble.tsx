import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Pencil, Copy, RefreshCw, ArrowLeftToLine, Trash2 } from 'lucide-react';
import { useUISettings } from '../../../context/UISettingsContext';
import { useIsMobile } from '../../../hooks/useIsMobile';
import type { ChatMessage } from '../../../engine/types';
import type { WorldSystemData, DiceRoll } from '../../../modules/schema';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import { parseContent, createIframeSrcDoc } from '../../../utils/markdown';
import { getEnabledTextColorizationRules } from '../../../utils/text-colorization';
import { processRegexScripts } from '../../../utils/regexScripts';
import { getBuiltinDisplayScripts } from '../../../data/builtinPresets';
import { usePresetStore } from '../../../stores/presetStore';
import { useImageStore } from '../../../stores/imageStore';

interface Props {
  message: ChatMessage;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onResend: (id: string) => void;
  onResendFromHere: (id: string) => void;
  onCopy: (text: string) => void;
  onOptionClick?: (optionText: string) => void;
  /** 世界系统数据（用于内联骰子卡片） */
  worldSystem?: WorldSystemData | null;
  /** 骰子掷骰结果回调 */
  onDiceRoll?: (roll: DiceRoll) => void;
}

export default function MessageBubble({ message, onDelete, onEdit, onResend, onResendFromHere, onCopy, onOptionClick, worldSystem, onDiceRoll }: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const editingRef = useRef(false);
  editingRef.current = editing;
  const isUser = message.role === 'user';
  const { t } = useUISettings();
  const isMobile = useIsMobile(640);

  // ─── 渲染管线 ────────────────────────────────────────
  const colorizationRules = useMemo(() => getEnabledTextColorizationRules(), []);
  // 内置渲染正则始终执行 + 预设正则叠加（合并而非二选一）
  const builtinDisplay = useMemo(() => getBuiltinDisplayScripts(), []);
  const activePreset = usePresetStore((s) => s.getActivePreset());
  const presetDisplayScripts = (activePreset?.regexScripts || []).filter(s => (s.markdownOnly || (!s.markdownOnly && !s.promptOnly)) && !s.disabled);
  const displayScripts = useMemo(() => [...builtinDisplay, ...presetDisplayScripts], [builtinDisplay, presetDisplayScripts]);

  const renderedContent = useMemo(() => {
    if (isUser) return null; // 用户消息不走渲染管线
    const raw = message.rawText || '';
    if (!raw) return { type: 'html' as const, content: '' };
    // 全部交给正则脚本处理（thinking 折叠、OPTION 卡片、元标签剥除）
    const cleaned = processRegexScripts(raw, displayScripts);
    if (!cleaned.trim()) return { type: 'html' as const, content: '' };
    return parseContent(cleaned, {
      isStreaming: !!message.streaming,
      textColorizationRules: colorizationRules,
    });
  }, [isUser, message.rawText, message.streaming, colorizationRules, displayScripts]);

  // iframe 高度自适应
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (renderedContent?.type !== 'iframe') return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'iframe-resize' && iframeRef.current) {
        iframeRef.current.style.height = `${e.data.height}px`;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [renderedContent?.type]);

  // ─── 内联卡片 Portal 挂载 ────────────────────────
  const messageHtmlRef = useRef<HTMLDivElement>(null);
  const diceRootsRef = useRef<Root[]>([]);
  const talentRootsRef = useRef<Root[]>([]);
  const imageGenRootsRef = useRef<Root[]>([]);

  useEffect(() => {
    // 清理旧的 React roots
    diceRootsRef.current.forEach(root => {
      try { root.unmount(); } catch { /* ignore */ }
    });
    diceRootsRef.current = [];

    if (!messageHtmlRef.current || isUser || !worldSystem?.骰子检定 || message.streaming) return;

    const placeholders = messageHtmlRef.current.querySelectorAll('.dice-roll-placeholder');
    if (placeholders.length === 0) return;

    // 动态导入 React 组件（避免循环依赖）
    const mountDiceCards = async () => {
      const { default: InlineDiceCardComponent } = await import('./InlineDiceCard');

      placeholders.forEach(el => {
        const attr = el.getAttribute('data-attr') || '';
        const dc = Number(el.getAttribute('data-dc')) || 10;
        const container = document.createElement('div');
        el.replaceWith(container);
        const root = createRoot(container);
        root.render(
          <InlineDiceCardComponent
            attr={attr}
            dc={dc}
            statData={worldSystem.数值属性}
            onRoll={onDiceRoll}
          />
        );
        diceRootsRef.current.push(root);
      });
    };

    mountDiceCards();

    return () => {
      diceRootsRef.current.forEach(root => {
        try { root.unmount(); } catch { /* ignore */ }
      });
      diceRootsRef.current = [];
    };
  }, [renderedContent, worldSystem, onDiceRoll, isUser, message.streaming]);

  // ─── 内联天赋觉醒卡片 Portal 挂载 ────────────────────────
  useEffect(() => {
    // 清理旧的 React roots
    talentRootsRef.current.forEach(root => {
      try { root.unmount(); } catch { /* ignore */ }
    });
    talentRootsRef.current = [];

    if (!messageHtmlRef.current || isUser || !worldSystem?.天赋体系 || message.streaming) return;

    const placeholders = messageHtmlRef.current.querySelectorAll('.talent-gain-placeholder');
    if (placeholders.length === 0) return;

    // 动态导入 React 组件（避免循环依赖）
    const mountTalentCards = async () => {
      const { default: InlineTalentCardComponent } = await import('./InlineTalentCard');

      placeholders.forEach(el => {
        const talentDataStr = el.getAttribute('data-talent') || '{}';
        try {
          const talentData = JSON.parse(talentDataStr);
          const container = document.createElement('div');
          el.replaceWith(container);
          const root = createRoot(container);
          root.render(
            <InlineTalentCardComponent
              id={talentData.id || ''}
              name={talentData.name || '未知天赋'}
              rarity={talentData.rarity || '普通'}
              description={talentData.description || ''}
              effects={talentData.effects || []}
            />
          );
          talentRootsRef.current.push(root);
        } catch (e) {
          console.warn('[天赋觉醒] 解析天赋数据失败:', e);
        }
      });
    };

    mountTalentCards();

    return () => {
      talentRootsRef.current.forEach(root => {
        try { root.unmount(); } catch { /* ignore */ }
      });
      talentRootsRef.current = [];
    };
  }, [renderedContent, worldSystem, isUser, message.streaming]);

  // ─── 内联生图按钮 Portal 挂载 ────────────────────────
  const inlineImageEnabled = useImageStore((s) => s.config.inlineImageEnabled);

  useEffect(() => {
    imageGenRootsRef.current.forEach(root => {
      try { root.unmount(); } catch { /* ignore */ }
    });
    imageGenRootsRef.current = [];

    if (!messageHtmlRef.current || isUser || !inlineImageEnabled || message.streaming) return;

    const placeholders = messageHtmlRef.current.querySelectorAll('.inline-image-gen-placeholder');
    if (placeholders.length === 0) return;

    const mountImageButtons = async () => {
      const { default: InlineImageGenButtonComponent } = await import('./InlineImageGenButton');

      placeholders.forEach(el => {
        const promptText = el.getAttribute('data-prompt') || '';
        if (!promptText.trim()) return;
        const container = document.createElement('div');
        el.replaceWith(container);
        const root = createRoot(container);
        root.render(<InlineImageGenButtonComponent prompt={promptText.trim()} msgId={message.id} />);
        imageGenRootsRef.current.push(root);
      });
    };

    mountImageButtons();

    return () => {
      imageGenRootsRef.current.forEach(root => {
        try { root.unmount(); } catch { /* ignore */ }
      });
      imageGenRootsRef.current = [];
    };
  }, [renderedContent, inlineImageEnabled, isUser, message.streaming]);

  const bubbleRef = useRef<HTMLDivElement>(null);

  // 用原生事件处理右键菜单，绕过 React 合成事件的委托机制
  useEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      if (editingRef.current) return; // 编辑模式下不拦截，让原生菜单出来
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, []);

  const handleEdit = useCallback(() => {
    // 编辑时显示原始全文（含 thinking/options 等标签），方便查看和修改
    const raw = message.rawText || '';
    setEditText(raw);
    setEditing(true);
    setContextMenu(null); // 清除右键菜单，避免移动端干扰
    setTimeout(() => editRef.current?.focus(), 0);
  }, [message.rawText]);

  const handleEditConfirm = useCallback(() => {
    const raw = message.rawText || '';
    if (editText.trim() !== raw) {
      onEdit(message.id, editText.trim());
    }
    setEditing(false);
  }, [editText, message.id, message.rawText, onEdit]);

  const handleEditCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditConfirm();
    }
    if (e.key === 'Escape') {
      handleEditCancel();
    }
  }, [handleEditConfirm, handleEditCancel]);

  const menuItems: ContextMenuItem[] = [
    {
      label: '编辑消息',
      icon: <Pencil size={14} />,
      action: handleEdit,
    },
    {
      label: '复制内容',
      icon: <Copy size={14} />,
      action: () => {
        const raw = message.rawText || '';
        onCopy(isUser ? raw : processRegexScripts(raw, displayScripts));
      },
    },
    ...(isUser ? [{
      label: '重新发送',
      icon: <RefreshCw size={14} />,
      action: () => onResend(message.id),
    }] : []),
    ...(!isUser && !message.streaming ? [{
      label: '从此处重新开始',
      icon: <ArrowLeftToLine size={14} />,
      action: () => onResendFromHere(message.id),
    }] : []),
    ...(isUser ? [{
      label: '删除消息',
      icon: <Trash2 size={14} />,
      action: () => onDelete(message.id),
      danger: true,
    }] : []),
  ];

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div
        ref={bubbleRef}
        style={{
          width: isUser ? undefined : (isMobile ? '92%' : '75%'),
          maxWidth: isUser ? (isMobile ? '95%' : '80%') : undefined,
          padding: isMobile ? '0.625rem 0.875rem' : '0.75rem 1rem',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser ? 'var(--accent)' : 'var(--bg-secondary)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          border: isUser ? 'none' : '1px solid var(--border)',
          position: 'relative',
          wordBreak: 'break-word',
          lineHeight: 'var(--body-line-height, 1.8)',
          fontSize: 'var(--body-font-size)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* 思维链现在由正则脚本渲染为 <details> 折叠块 */}

        {/* 编辑模式 */}
        {editing ? (
          <div style={{ width: '100%' }}>
            <textarea
              ref={editRef}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              style={{
                width: '100%',
                minHeight: '200px',
                maxHeight: '60vh',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--body-font-size)',
                fontFamily: 'var(--font-family)',
                lineHeight: 'var(--body-line-height, 1.8)',
                resize: 'vertical',
                outline: 'none',
                whiteSpace: 'pre-wrap',
                WebkitUserSelect: 'text',
                userSelect: 'text',
                touchAction: 'auto',
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '6px',
              marginTop: '6px',
            }}>
              <button
                onClick={handleEditCancel}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                }}
              >{t('common.cancel')}</button>
              <button
                onClick={handleEditConfirm}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                }}
              >{t('common.save')}</button>
            </div>
          </div>
        ) : (
          <>
            {/* 正文 —— Markdown 渲染管线 */}
            {isUser ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {message.rawText || ''}
              </div>
            ) : renderedContent?.type === 'iframe' ? (
              <iframe
                ref={iframeRef}
                className="message-renderer-iframe"
                srcDoc={createIframeSrcDoc(renderedContent.content)}
                sandbox="allow-same-origin"
                loading="lazy"
                style={{
                  width: '100%',
                  minHeight: '360px',
                  border: 'none',
                  background: 'transparent',
                }}
              />
            ) : (
              <>
                {renderedContent?.content ? (
                  <div
                    ref={messageHtmlRef}
                    className="message-html-content"
                    dangerouslySetInnerHTML={{ __html: renderedContent.content }}
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement

                      // 代码块复制按钮（事件委托，替代 inline onclick 防止 XSS）
                      const copyBtn = target.closest('[data-action="copy-code"]') as HTMLButtonElement | null
                      if (copyBtn) {
                        e.preventDefault()
                        e.stopPropagation()
                        const wrapper = copyBtn.closest('.code-block-wrapper')
                        const code = wrapper?.querySelector('code')
                        if (code) {
                          navigator.clipboard.writeText(code.textContent || '').then(() => {
                            copyBtn.textContent = '已复制!'
                            setTimeout(() => { copyBtn.textContent = '复制' }, 2000)
                          }).catch(() => {
                            copyBtn.textContent = '失败'
                            setTimeout(() => { copyBtn.textContent = '复制' }, 2000)
                          })
                        }
                        return
                      }

                      // 行动选项点击
                      const optionEl = target.closest('.action-option-card') as HTMLElement
                      if (optionEl && onOptionClick) {
                        const optionText = optionEl.getAttribute('data-option-text')
                        if (optionText) {
                          onOptionClick(optionText)
                        }
                      }
                    }}
                  />
                ) : message.streaming && !(message.rawText) ? (
                  <span style={{ opacity: 0.5 }}>{t('chat.thinking')}</span>
                ) : null}
                {message.streaming && (
                  <span style={{ animation: 'blink 1s infinite', marginLeft: '2px' }}>▋</span>
                )}
              </>
            )}

          </>
        )}

        {/* 悬停操作按钮 */}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
